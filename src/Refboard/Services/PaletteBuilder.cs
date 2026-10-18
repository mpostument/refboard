using ImageMagick;
using Refboard.Models;

namespace Refboard.Services;

/// <summary>
/// The main colours of every picture in the library - packs and uploads alike -
/// for the library's colour search (js/colourfind.js). A pass of its own after
/// the features pass rather than a field of FeatureRecord: features.json only
/// covers the mounted packs (see FeatureBuilder, which skips anything outside
/// /refs/), and the pictures a person kept themselves are the ones they most
/// want to search.
///
/// Five colours by k-means in OKLab, the space the page measures colour in too:
/// a distance there is close to how different two colours look, so "the red
/// that covers most of it" is a red a person would call the same red. Cached on
/// (mtime, size) like the features, and capped by the same time budget.
/// </summary>
public static class PaletteBuilder
{
    private const int Side = 48;           // the picture is looked at this big; colour needs no more
    private const int K = 5;               // clusters before merging
    private const double Merge = 0.045;    // OKLab distance under which two clusters are one colour
    private const int MinShare = 3;        // percent; a smaller patch is a speck, not a colour

    public static PalettesDocument Run(IndexDocument index, RefboardOptions opts, string uploadsDir,
        string path, ILogger logger, CancellationToken ct = default)
    {
        var images = new Dictionary<string, PaletteRecord>();
        if (File.Exists(path))
        {
            try
            {
                var prev = System.Text.Json.JsonSerializer.Deserialize<PalettesDocument>(
                    File.ReadAllText(path), AtomicFile.JsonOptions);
                if (prev?.Images != null) images = prev.Images;
            }
            catch (Exception ex)
            {
                logger.LogWarning("could not read existing {Path} ({Message}); starting fresh", path, ex.Message);
            }
        }

        var started = DateTime.UtcNow;
        int done = 0, cached = 0, failed = 0, deferred = 0;
        var known = new HashSet<string>();

        foreach (var src in index.Packs.SelectMany(p => p.Groups).SelectMany(g => g.Images).Select(i => i.Src))
        {
            ct.ThrowIfCancellationRequested();
            known.Add(src);
            var file = Resolve(src, opts, uploadsDir);
            if (file == null) continue;

            FileInfo fi;
            try { fi = new FileInfo(file); if (!fi.Exists) throw new FileNotFoundException(file); }
            catch { images.Remove(src); failed++; continue; }

            var mtime = new DateTimeOffset(fi.LastWriteTimeUtc).ToUnixTimeSeconds();
            if (images.TryGetValue(src, out var have) && have.M == mtime && have.B == fi.Length) { cached++; continue; }

            if (opts.FeaturesBudgetSecs > 0 && (DateTime.UtcNow - started).TotalSeconds > opts.FeaturesBudgetSecs)
            {
                deferred++;
                continue;
            }

            try
            {
                images[src] = new PaletteRecord { P = Read(file), M = mtime, B = fi.Length };
                done++;
            }
            catch (Exception ex)
            {
                logger.LogWarning("{Src}: {Message}", src, ex.Message);
                failed++;
            }
        }

        foreach (var gone in images.Keys.Where(k => !known.Contains(k)).ToList()) images.Remove(gone);

        var doc = new PalettesDocument { Generated = DateTimeOffset.UtcNow.ToUnixTimeSeconds(), Images = images };
        AtomicFile.WriteJson(path, doc);
        logger.LogInformation("palettes: {Done} measured, {Cached} cached, {Deferred} deferred, {Failed} failed",
            done, cached, deferred, failed);
        return doc;
    }

    /// <summary>The file behind a URL in the index: a mounted pack's under SourceDir,
    /// a kept upload's under the uploads folder. Null for anything else.</summary>
    private static string? Resolve(string src, RefboardOptions opts, string uploadsDir)
    {
        string root, rel;
        if (src.StartsWith(opts.RefsPrefix, StringComparison.Ordinal)) { root = opts.SourceDir; rel = src[opts.RefsPrefix.Length..]; }
        else if (src.StartsWith("uploads/", StringComparison.Ordinal)) { root = uploadsDir; rel = src["uploads/".Length..]; }
        else return null;
        return Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar));
    }

    private static string[] Read(string file)
    {
        // The size hint lets a JPEG decode at a fraction of its size, the same
        // shrink-on-load FeatureBuilder uses: a 40-megapixel photo is never expanded
        // just to be looked at 48 pixels wide.
        using var img = new MagickImage(file, new MagickReadSettings { Width = Side * 2, Height = Side * 2 });
        img.FilterType = FilterType.Lanczos;
        img.Resize(new MagickGeometry((uint)Side, (uint)Side) { Greater = true });
        try { img.TransformColorSpace(ColorProfiles.SRGB); } catch { /* an image with no profile to convert from is already sRGB enough */ }

        var pts = new List<(double L, double A, double B)>(Side * Side);
        using var px = img.GetPixels();
        for (var y = 0; y < img.Height; y++)
            for (var x = 0; x < img.Width; x++)
            {
                var p = px.GetPixel(x, y);
                var n = p.Channels;
                // A cut-out sprite's empty corners are not part of its colours.
                if (img.HasAlpha && n >= 4 && p.GetChannel((uint)(n - 1)) < 128) continue;
                var r = p.GetChannel(0);
                var g = n >= 3 ? p.GetChannel(1) : r;
                var b = n >= 3 ? p.GetChannel(2) : r;
                pts.Add(ToOklab(r / 255.0, g / 255.0, b / 255.0));
            }
        return Cluster(pts);
    }

    /// <summary>The clusters of <paramref name="pts"/>, as "rrggbb:share", biggest first.</summary>
    public static string[] Cluster(List<(double L, double A, double B)> pts)
    {
        if (pts.Count == 0) return [];

        // Started on the lightness quantiles rather than at random: the same
        // picture always gives the same palette, and the starting colours already
        // span dark to light.
        var sorted = pts.OrderBy(p => p.L).ToList();
        var cen = new (double L, double A, double B)[K];
        for (var i = 0; i < K; i++) cen[i] = sorted[Math.Min(sorted.Count - 1, (int)((i + 0.5) / K * sorted.Count))];

        var count = new int[K];
        var sum = new (double L, double A, double B)[K];
        for (var iter = 0; iter < 12; iter++)
        {
            Array.Clear(count); Array.Clear(sum);
            foreach (var p in pts)
            {
                var best = 0; var bd = double.MaxValue;
                for (var c = 0; c < K; c++)
                {
                    var d = Dist2(p, cen[c]);
                    if (d < bd) { bd = d; best = c; }
                }
                count[best]++;
                sum[best] = (sum[best].L + p.L, sum[best].A + p.A, sum[best].B + p.B);
            }
            for (var c = 0; c < K; c++)
                if (count[c] > 0) cen[c] = (sum[c].L / count[c], sum[c].A / count[c], sum[c].B / count[c]);
        }

        var list = Enumerable.Range(0, K).Where(c => count[c] > 0).Select(c => (C: cen[c], N: count[c])).ToList();

        // Two clusters that ended up the same colour (a smooth sky split in two)
        // are one colour: merged, weighted by size.
        for (var merged = true; merged;)
        {
            merged = false;
            for (var i = 0; i < list.Count && !merged; i++)
                for (var j = i + 1; j < list.Count && !merged; j++)
                    if (Math.Sqrt(Dist2(list[i].C, list[j].C)) < Merge)
                    {
                        var a = list[i]; var b = list[j]; var n = a.N + b.N;
                        list[i] = ((
                            (a.C.L * a.N + b.C.L * b.N) / n,
                            (a.C.A * a.N + b.C.A * b.N) / n,
                            (a.C.B * a.N + b.C.B * b.N) / n), n);
                        list.RemoveAt(j);
                        merged = true;
                    }
        }

        var total = (double)pts.Count;
        var ordered = list.OrderByDescending(x => x.N).ToList();
        return ordered
            .Select((x, i) => (x, share: (int)Math.Round(x.N * 100 / total), i))
            .Where(t => t.i == 0 || t.share >= MinShare)
            .Select(t => ToHex(t.x.C) + ":" + Math.Max(1, t.share))
            .ToArray();
    }

    private static double Dist2((double L, double A, double B) p, (double L, double A, double B) q)
    {
        double dl = p.L - q.L, da = p.A - q.A, db = p.B - q.B;
        return dl * dl + da * da + db * db;
    }

    private static double ToLinear(double c) => c <= 0.04045 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);
    private static double FromLinear(double c) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.Pow(c, 1 / 2.4) - 0.055;

    /// <summary>sRGB 0-1 to OKLab (Ottosson's matrices).</summary>
    public static (double L, double A, double B) ToOklab(double r, double g, double b)
    {
        r = ToLinear(r); g = ToLinear(g); b = ToLinear(b);
        var l = Math.Cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
        var m = Math.Cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
        var s = Math.Cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
        return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
    }

    public static string ToHex((double L, double A, double B) c)
    {
        var l = Math.Pow(c.L + 0.3963377774 * c.A + 0.2158037573 * c.B, 3);
        var m = Math.Pow(c.L - 0.1055613458 * c.A - 0.0638541728 * c.B, 3);
        var s = Math.Pow(c.L - 0.0894841775 * c.A - 1.2914855480 * c.B, 3);
        double[] rgb =
        [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
        ];
        return string.Concat(rgb.Select(v => Math.Clamp((int)Math.Round(FromLinear(Math.Clamp(v, 0, 1)) * 255), 0, 255).ToString("x2")));
    }
}
