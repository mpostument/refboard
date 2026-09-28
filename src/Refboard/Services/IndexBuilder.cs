using Refboard.Models;

namespace Refboard.Services;

/// <summary>
/// Ports of refboard-index.py's build_index(): walks the pose packs and
/// produces the manifest the board's setup screen reads. Deliberately does no
/// image work - it opens nothing, decodes nothing, so a full run over a few
/// thousand files costs a directory walk and nothing more.
///
/// Two things the app cannot work out for itself, decided here:
///
///   Rotation sets. A folder like "sitting 360" holds one pose photographed
///   from many angles. Left alone, a random draw serves five near-identical
///   frames in a row and the session is worthless. Those folders are marked
///   so the app can draw ONE frame per pose from them.
///
///   Natural ordering. See NaturalComparer.
/// </summary>
public static class IndexBuilder
{
    private static readonly HashSet<string> ImageExts =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".gif" };

    /// <summary>The name the uploads pack takes in the library - see
    /// <paramref name="uploads"/> on <see cref="Build"/>.</summary>
    public const string UploadsPack = "Uploads";

    /// <summary>The group the uploads not yet sorted into a folder are in.</summary>
    public const string UnsortedGroup = "Unsorted";

    /// <param name="uploads">What the app was given to keep (UserStore), as
    /// one more pack after the mounted ones - so an uploaded reference can be
    /// ticked and drawn from like any other - each folder it has been sorted
    /// into a group. Null for none.</param>
    /// <param name="uploadTags">An uploaded file's tags, by its file name; null
    /// when it has none.</param>
    public static IndexDocument Build(string sourceDir, string urlPrefix, string[] rotationPatterns,
        (string Dir, string Prefix)? uploads = null, Func<string, List<string>?>? uploadTags = null)
    {
        if (!Directory.Exists(sourceDir))
            throw new DirectoryNotFoundException($"source directory not found: {sourceDir}");

        var packs = new List<PackRecord>();
        long totalBytes = 0;
        var totalImages = 0;

        var packDirs = Directory.EnumerateDirectories(sourceDir)
            .OrderBy(Path.GetFileName, NaturalComparer.Instance);

        foreach (var packPath in packDirs)
        {
            var packName = Path.GetFileName(packPath)!;
            var groups = new Dictionary<string, GroupRecord>();

            WalkPack(packPath, packPath, sourceDir, urlPrefix, rotationPatterns, groups, ref totalBytes);

            if (groups.Count == 0) continue;

            var ordered = groups.Keys.OrderBy(k => k, NaturalComparer.Instance)
                .Select(k => groups[k]).ToList();
            var count = ordered.Sum(g => g.Images.Count);
            totalImages += count;
            packs.Add(new PackRecord { Name = packName, Count = count, Groups = ordered });
        }

        if (uploads is { } up && Directory.Exists(up.Dir))
        {
            var groups = new Dictionary<string, GroupRecord>();
            WalkPack(up.Dir, up.Dir, up.Dir, up.Prefix, [], groups, ref totalBytes);
            // The folder itself holds what is not sorted yet; its subfolders
            // are the sorted ones, already named as the library shows them.
            var rootName = Path.GetFileName(up.Dir)!;
            var ordered = groups.Values.OrderBy(g => g.Name == rootName ? 1 : 0)
                .ThenBy(g => g.Name, NaturalComparer.Instance).ToList();
            foreach (var g in ordered)
            {
                if (g.Name == rootName) g.Name = UnsortedGroup;
                if (uploadTags != null)
                    foreach (var img in g.Images) img.Tags = uploadTags(img.Src[(img.Src.LastIndexOf('/') + 1)..]);
            }
            var count = ordered.Sum(g => g.Images.Count);
            if (count > 0)
            {
                // A mounted folder already called "Uploads" keeps its name.
                var name = packs.Any(p => p.Name == UploadsPack) ? UploadsPack + " (kept by Refboard)" : UploadsPack;
                totalImages += count;
                packs.Add(new PackRecord { Name = name, Count = count, Groups = ordered });
            }
        }

        var now = DateTimeOffset.UtcNow;
        return new IndexDocument
        {
            Generated = now.ToUnixTimeSeconds(),
            GeneratedIso = TimeFormat.Iso(now),
            Source = sourceDir,
            TotalImages = totalImages,
            TotalBytes = totalBytes,
            PackCount = packs.Count,
            SizeHuman = HumanBytes(totalBytes),
            Packs = packs,
        };
    }

    private static void WalkPack(string dirPath, string packPath, string sourceRoot, string urlPrefix,
        string[] rotationPatterns, Dictionary<string, GroupRecord> groups, ref long totalBytes)
    {
        var images = new List<ImageRecord>();
        var files = Directory.EnumerateFiles(dirPath)
            .Where(f => ImageExts.Contains(Path.GetExtension(f)))
            .OrderBy(Path.GetFileName, NaturalComparer.Instance);

        foreach (var abs in files)
        {
            long size;
            try { size = new FileInfo(abs).Length; }
            catch (IOException) { continue; }            // gone mid-walk - not worth failing the run over
            catch (UnauthorizedAccessException) { continue; }

            var rel = Path.GetRelativePath(sourceRoot, abs).Replace(Path.DirectorySeparatorChar, '/');
            images.Add(new ImageRecord { Src = urlPrefix + rel, Bytes = size });
            totalBytes += size;
        }

        if (images.Count > 0)
        {
            var relDir = Path.GetRelativePath(packPath, dirPath).Replace(Path.DirectorySeparatorChar, '/');
            var groupName = relDir == "." ? Path.GetFileName(packPath)! : relDir;
            var leaf = Path.GetFileName(dirPath)!;
            // Never the pack's own root, even for a flat pack whose only group IS
            // the root - see refboard-index.py's own comment on this exact line.
            var rotation = relDir != "." && IsRotation(leaf, rotationPatterns);

            if (!groups.TryGetValue(groupName, out var g))
            {
                g = new GroupRecord { Name = groupName, Rotation = rotation };
                groups[groupName] = g;
            }
            g.Images.AddRange(images);
        }

        var subdirs = Directory.EnumerateDirectories(dirPath)
            .OrderBy(Path.GetFileName, NaturalComparer.Instance);
        foreach (var sub in subdirs)
            WalkPack(sub, packPath, sourceRoot, urlPrefix, rotationPatterns, groups, ref totalBytes);
    }

    private static bool IsRotation(string folderName, string[] patterns)
    {
        var lowered = folderName.ToLowerInvariant();
        return patterns.Any(p => lowered.Contains(p.ToLowerInvariant(), StringComparison.Ordinal));
    }

    private static string HumanBytes(long n)
    {
        if (n == 0) return "0 B";
        string[] units = ["B", "KB", "MB", "GB", "TB"];
        double v = n;
        foreach (var unit in units)
        {
            if (v < 1024 || unit == "TB")
                return unit == "B" ? $"{n} B" : $"{v:F1} {unit}";
            v /= 1024;
        }
        return $"{v:F1} TB";
    }
}
