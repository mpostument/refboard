using System.Security.Cryptography;
using System.Text;
using ImageMagick;
using Refboard.Models;

namespace Refboard.Services;

/// <summary>
/// Port of refboard-features.py: display copies, tone stats and a perceptual
/// hash, one decode per image. Deliberately separate from IndexBuilder, and on
/// its own slower schedule - see ReindexHostedService - for the same reason
/// the two were separate scripts originally: this is the expensive half.
///
/// The board works without this ever having run. If features.json is missing
/// or incomplete for an image, the client falls back to its previous
/// behaviour - the full-size original, no tone stats - so a container that
/// has not finished its first pass degrades rather than breaks.
/// </summary>
public static class FeatureBuilder
{
    private const int FeatureSize = 32; // tone stats are computed at this resolution
    private const int HashW = 9, HashH = 8; // dhash compares 8 horizontal pairs across 8 rows

    public static async Task<FeaturesDocument> RunAsync(
        IndexDocument index, RefboardOptions opts, string featuresPath, ILogger logger,
        CancellationToken ct = default)
    {
        var allSrcs = index.Packs.SelectMany(p => p.Groups).SelectMany(g => g.Images)
            .Select(i => i.Src).ToList();

        var features = new Dictionary<string, FeatureRecord>();
        if (File.Exists(featuresPath))
        {
            try
            {
                var prevDoc = System.Text.Json.JsonSerializer.Deserialize<FeaturesDocument>(
                    await File.ReadAllTextAsync(featuresPath, ct), AtomicFile.JsonOptions);
                if (prevDoc?.Images != null) features = prevDoc.Images;
            }
            catch (Exception ex)
            {
                logger.LogWarning("could not read existing {Path} ({Message}); starting fresh",
                    featuresPath, ex.Message);
            }
        }

        Directory.CreateDirectory(opts.DisplayDir);

        var started = DateTime.UtcNow;
        int done = 0, cached = 0, failed = 0, skipped = 0;

        foreach (var src in allSrcs)
        {
            ct.ThrowIfCancellationRequested();
            if (!src.StartsWith(opts.RefsPrefix, StringComparison.Ordinal)) continue;
            var rel = src[opts.RefsPrefix.Length..];
            var path = Path.Combine(opts.SourceDir, rel.Replace('/', Path.DirectorySeparatorChar));

            FileInfo fi;
            try
            {
                fi = new FileInfo(path);
                if (!fi.Exists) throw new FileNotFoundException(path);
            }
            catch
            {
                // Gone since the index ran. Drop any stale entry so the board
                // cannot keep pointing at a display copy for a file that no
                // longer exists.
                features.Remove(src);
                failed++;
                continue;
            }

            var prev = features.GetValueOrDefault(src);
            var digest = Sha1Hex(rel);
            var displayPath = Path.Combine(opts.DisplayDir, digest + ".jpg");
            var webpPath = Path.Combine(opts.DisplayDir, digest + ".webp");
            var mtime = new DateTimeOffset(fi.LastWriteTimeUtc).ToUnixTimeSeconds();

            var overBudget = opts.FeaturesBudgetSecs > 0
                && (DateTime.UtcNow - started).TotalSeconds > opts.FeaturesBudgetSecs;

            if (prev != null && prev.M == mtime && prev.B == fi.Length && File.Exists(displayPath))
            {
                // The WebP twin is allowed to be missing even on an otherwise-cached
                // entry: a record from before WebP support existed has no WebpBytes
                // at all (null, not 0) - re-measuring is wasted decode time when only
                // the encode needs to run. Gated on the budget too, same reasoning
                // as the fresh-measure path below.
                var needsBackfill = prev.WebpBytes is null
                    || (prev.WebpBytes > 0 && !File.Exists(webpPath));
                if (needsBackfill && !overBudget)
                {
                    try
                    {
                        using var disp = new MagickImage(displayPath);
                        await SaveWebpAsync(disp, webpPath, opts.Quality, ct);
                        prev.WebpBytes = new FileInfo(webpPath).Length;
                        prev.DisplayWebp = opts.DisplayPrefix + digest + ".webp";
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning("webp backfill failed for {Rel}: {Message}", rel, ex.Message);
                        prev.WebpBytes = 0;
                        prev.DisplayWebp = null;
                    }
                }
                else if (needsBackfill) skipped++;
                cached++;
                continue;
            }

            if (overBudget) { skipped++; continue; }

            MeasureResult rec;
            try
            {
                rec = Measure(path, displayPath, webpPath, opts.MaxPx, opts.Quality);
            }
            catch (Exception ex)
            {
                logger.LogWarning("{Rel}: {Message}", rel, ex.Message);
                failed++;
                continue;
            }

            features[src] = new FeatureRecord
            {
                Dhash = rec.Dhash,
                V = rec.V,
                C = rec.C,
                W = rec.OrigW,
                H = rec.OrigH,
                Dw = rec.DispW,
                Dh = rec.DispH,
                Dbytes = rec.Dbytes,
                WebpBytes = rec.WebpBytes,
                M = mtime,
                B = fi.Length,
                Display = opts.DisplayPrefix + digest + ".jpg",
                DisplayWebp = rec.WebpBytes > 0 ? opts.DisplayPrefix + digest + ".webp" : null,
            };
            done++;
        }

        // Drop entries the index no longer lists, so features.json cannot grow
        // forever as packs are replaced.
        var known = allSrcs.ToHashSet();
        foreach (var gone in features.Keys.Where(k => !known.Contains(k)).ToList())
            features.Remove(gone);

        var dupGroups = Cluster(index, features, opts.DhashThreshold);
        var dupImages = features.Values.Count(f => !string.IsNullOrEmpty(f.DupGroup));

        var now = DateTimeOffset.UtcNow;
        var payload = new FeaturesDocument
        {
            Generated = now.ToUnixTimeSeconds(),
            GeneratedIso = TimeFormat.Iso(now),
            MaxPx = opts.MaxPx,
            Threshold = opts.DhashThreshold,
            Featured = features.Count,
            Pending = allSrcs.Count - features.Count,
            DupGroups = dupGroups,
            DupImages = dupImages,
            Images = features,
        };
        AtomicFile.WriteJson(featuresPath, payload);

        logger.LogInformation(
            "{Done} measured, {Cached} cached, {Skipped} deferred, {Failed} failed; " +
            "{Featured}/{Total} featured, {DupGroups} near-duplicate groups covering {DupImages} images",
            done, cached, skipped, failed, features.Count, allSrcs.Count, dupGroups, dupImages);

        return payload;
    }

    private sealed record MeasureResult(string Dhash, double V, double C,
        int OrigW, int OrigH, int DispW, int DispH, long Dbytes, long WebpBytes);

    /// <summary>
    /// One decode -> display copy (JPEG + WebP twin), tone stats, perceptual
    /// hash. Mirrors refboard-features.py's measure():
    ///
    ///   - True original dimensions come from MagickImageInfo, a header-only
    ///     read - matching Pillow's im.size captured before im.draft()
    ///     rescales what the decoder actually produces.
    ///   - MagickReadSettings.Width/Height is ImageMagick's own "size hint"
    ///     mechanism: for JPEG it drives libjpeg's shrink-on-load (scaled
    ///     IDCT decode), the same trick im.draft() plays and for the same
    ///     reason - a many-megapixel source should never be fully expanded
    ///     just to be shrunk back down moments later. This is the
    ///     optimization ImageSharp 2.x (kept for its plain Apache-2.0
    ///     license - see README) cannot do; Magick.NET gets it back without
    ///     reintroducing a licensing tradeoff, on top of being the actively
    ///     maintained one of the two.
    ///   - The subsequent Resize with Greater=true is still needed for an
    ///     exact target size and real Lanczos filtering (the size hint only
    ///     hits a handful of discrete ratios) - Greater=true is
    ///     ImageMagick's own "shrink only, never enlarge" geometry flag, so
    ///     it encodes the same never-upscale rule in one call rather than a
    ///     hand-rolled scale computation.
    ///   - Grayscale(Rec601Luma) explicitly matches Pillow's own
    ///     .convert('L') formula (ITU-R 601-2), rather than trusting
    ///     whatever a library's unspecified default grayscale conversion
    ///     happens to be - the dhash/tone-stat thresholds this whole feature
    ///     was calibrated against were measured against that exact formula.
    /// </summary>
    private static MeasureResult Measure(string path, string displayPath, string webpPath, int maxPx, int quality)
    {
        var info = new MagickImageInfo(path);
        int origW = (int)info.Width, origH = (int)info.Height;

        using var disp = new MagickImage(path, new MagickReadSettings
        {
            Width = (uint)maxPx,
            Height = (uint)maxPx,
        });

        disp.FilterType = FilterType.Lanczos;
        disp.Resize(new MagickGeometry((uint)maxPx, (uint)maxPx) { Greater = true });

        Directory.CreateDirectory(Path.GetDirectoryName(displayPath)!);
        var jpegTmp = displayPath + ".tmp";
        disp.Quality = (uint)quality;
        disp.Write(jpegTmp, MagickFormat.Jpeg);
        File.Move(jpegTmp, displayPath, overwrite: true);

        // The JPEG stays the fallback for whatever cannot decode WebP; this
        // must never be the encode that blocks the run. A codec problem here
        // costs the smaller copy, not the frame.
        long webpBytes = 0;
        try { webpBytes = SaveWebp(disp, webpPath, quality); }
        catch { /* logged by the caller via the returned 0 having no WebP file behind it */ }

        var dhash = ComputeDhash(disp);
        var (v, c) = ComputeToneStats(disp);

        return new MeasureResult(dhash, v, c, origW, origH, (int)disp.Width, (int)disp.Height,
            new FileInfo(displayPath).Length, webpBytes);
    }

    private static async Task<long> SaveWebpAsync(IMagickImage<byte> disp, string webpPath, int quality, CancellationToken ct)
    {
        var tmp = webpPath + ".tmp";
        disp.Quality = (uint)quality;
        await disp.WriteAsync(tmp, MagickFormat.WebP, ct);
        File.Move(tmp, webpPath, overwrite: true);
        return new FileInfo(webpPath).Length;
    }

    private static long SaveWebp(IMagickImage<byte> disp, string webpPath, int quality)
    {
        var tmp = webpPath + ".tmp";
        disp.Quality = (uint)quality;
        disp.Write(tmp, MagickFormat.WebP);
        File.Move(tmp, webpPath, overwrite: true);
        return new FileInfo(webpPath).Length;
    }

    /// <summary>64-bit difference hash from a 9x8 grayscale image, as 16 hex
    /// chars - identical scheme to refboard-features.py's dhash().</summary>
    private static string ComputeDhash(IMagickImage<byte> disp)
    {
        using var gray = disp.Clone();
        gray.Grayscale(PixelIntensityMethod.Rec601Luma);
        gray.FilterType = FilterType.Lanczos;
        // IgnoreAspectRatio: an exact WxH stretch, matching Pillow's own
        // .resize((w, h)) - unlike the display copy above, this has no
        // "preserve aspect ratio, fit within bounds" requirement at all.
        gray.Resize(new MagickGeometry((uint)HashW, (uint)HashH) { IgnoreAspectRatio = true });

        using var pixels = gray.GetPixels();
        ulong bits = 0;
        for (var row = 0; row < HashH; row++)
            for (var col = 0; col < HashW - 1; col++)
            {
                var a = pixels.GetPixel(col, row).GetChannel(0);
                var b = pixels.GetPixel(col + 1, row).GetChannel(0);
                bits = (bits << 1) | (a > b ? 1UL : 0UL);
            }
        return bits.ToString("x16");
    }

    /// <summary>Mean lightness and contrast (stddev) at 32x32, normalised to
    /// 0-1 and rounded to 3 decimals - same resolution and rounding as
    /// refboard-features.py's ImageStat pass over disp.convert('L').</summary>
    private static (double V, double C) ComputeToneStats(IMagickImage<byte> disp)
    {
        using var small = disp.Clone();
        small.Grayscale(PixelIntensityMethod.Rec601Luma);
        small.FilterType = FilterType.Lanczos;
        small.Resize(new MagickGeometry((uint)FeatureSize, (uint)FeatureSize) { IgnoreAspectRatio = true });

        using var pixels = small.GetPixels();
        double sum = 0, sumSq = 0;
        for (var y = 0; y < FeatureSize; y++)
        {
            for (var x = 0; x < FeatureSize; x++)
            {
                double val = pixels.GetPixel(x, y).GetChannel(0);
                sum += val;
                sumSq += val * val;
            }
        }

        var n = (double)(FeatureSize * FeatureSize);
        var mean = sum / n;
        var variance = Math.Max(0, sumSq / n - mean * mean); // population variance, matching Pillow's ImageStat
        return (Math.Round(mean / 255.0, 3), Math.Round(Math.Sqrt(variance) / 255.0, 3));
    }

    /// <summary>
    /// Flags near-identical frames per group, by Hamming distance on dhash.
    /// Confined to a single group deliberately: matching across packs would
    /// merge different models shot in the same studio. Advisory only - see
    /// refboard-features.py's module docstring for why this does not drive
    /// the draw pool by default (dupGroup is an opt-in filter in the UI).
    /// </summary>
    private static int Cluster(IndexDocument index, Dictionary<string, FeatureRecord> features, int threshold)
    {
        var groupsFound = 0;
        foreach (var pack in index.Packs)
        {
            foreach (var group in pack.Groups)
            {
                var srcs = group.Images.Select(im => im.Src)
                    .Where(s => features.TryGetValue(s, out var f) && f.Dhash != null)
                    .ToList();
                if (srcs.Count == 0) continue;

                var parent = srcs.ToDictionary(s => s, s => s);
                string Find(string x)
                {
                    while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }
                    return x;
                }

                for (var i = 0; i < srcs.Count; i++)
                {
                    var ha = features[srcs[i]].Dhash!;
                    for (var j = i + 1; j < srcs.Count; j++)
                    {
                        if (Hamming(ha, features[srcs[j]].Dhash!) <= threshold)
                        {
                            var ra = Find(srcs[i]);
                            var rb = Find(srcs[j]);
                            if (ra != rb) parent[ra] = rb;
                        }
                    }
                }

                var members = new Dictionary<string, List<string>>();
                foreach (var s in srcs)
                {
                    var root = Find(s);
                    if (!members.TryGetValue(root, out var list)) { list = []; members[root] = list; }
                    list.Add(s);
                }

                foreach (var groupMembers in members.Values)
                {
                    if (groupMembers.Count < 2) continue;
                    groupsFound++;
                    var gid = $"d{groupsFound}";
                    foreach (var s in groupMembers) features[s].DupGroup = gid;
                }
            }
        }
        return groupsFound;
    }

    private static int Hamming(string a, string b) =>
        System.Numerics.BitOperations.PopCount(Convert.ToUInt64(a, 16) ^ Convert.ToUInt64(b, 16));

    private static string Sha1Hex(string s) =>
        Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes(s)));
}
