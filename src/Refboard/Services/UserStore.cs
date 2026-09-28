using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Refboard.Services;

/// <summary>
/// What the app is given to keep: uploaded files, and small JSON documents
/// (boards, profiles, the list of uploads with their names).
///
/// Files are stored by the SHA-256 of their contents, so the same photo
/// uploaded twice is stored once, and a name can never be chosen by the
/// client. They go in DataDir/uploads, which the static-file handler already
/// serves at /uploads/ - and which is why only images and video are taken:
/// an HTML or SVG file served from this origin would run as this page.
///
/// Documents go in DataDir/.items/{kind}/{id}.json. The leading dot is what
/// keeps them off the static-file handler (Program.cs never serves a path
/// with a dot-prefixed part), so they are only reached through the API.
/// </summary>
public sealed partial class UserStore(RefboardOptions opts)
{
    /// <summary>The types taken, and the extension each is stored under. The
    /// extension comes from here, never from the uploaded name.</summary>
    public static readonly IReadOnlyDictionary<string, string> Types = new Dictionary<string, string>
    {
        ["image/jpeg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp", ["image/gif"] = ".gif",
        ["image/avif"] = ".avif", ["video/mp4"] = ".mp4", ["video/webm"] = ".webm", ["video/quicktime"] = ".mov",
    };

    /// <summary>The folders an uploaded picture is sorted into (see js/sort.js,
    /// which decides which): the key the page sends, and the folder's name on
    /// disk - which is also its group's name in the library. Fixed here, so a
    /// folder name never comes from the client. Unsorted pictures, and video,
    /// stay in the uploads folder itself.</summary>
    public static readonly IReadOnlyDictionary<string, string> Folders = new Dictionary<string, string>
    {
        ["figure"] = "Figure", ["portrait"] = "Portrait", ["animals"] = "Animals", ["landscape"] = "Landscape",
        ["city"] = "City", ["plants"] = "Plants", ["still-life"] = "Still life", ["illustration"] = "Illustration",
        ["my-work"] = "My work", ["other"] = "Other",
        // Not sorted into: what ComfyClient generates goes here itself.
        ["generated"] = "Generated",
    };

    public string UploadsDir => Path.Combine(opts.DataDir, "uploads");
    private string ItemsDir => Path.Combine(opts.DataDir, ".items");

    // A-z, digits, dash and underscore, and a dot only before the extension:
    // nothing that could climb out of its folder.
    [GeneratedRegex("^[a-z0-9][a-z0-9_-]{0,63}$")]
    private static partial Regex NameRx();
    [GeneratedRegex("^[0-9a-f]{64}\\.[a-z0-9]{2,5}$")]
    private static partial Regex FileIdRx();

    public static bool ValidName(string s) => NameRx().IsMatch(s);
    public static bool ValidFileId(string s) => FileIdRx().IsMatch(s);

    /// <summary>A kept file: its id (hash and extension), where it is served,
    /// its size, and the folder it has been sorted into - null while unsorted.</summary>
    public sealed record FileEntry(string Id, string Url, long Bytes, string? Folder = null);

    private static FileEntry Entry(string id, long bytes, string? folder) =>
        new(id, "uploads/" + (folder is null ? "" : Uri.EscapeDataString(Folders[folder]) + "/") + id, bytes, folder);

    /// <summary>Where a kept file is: the uploads folder, or one of the sorted
    /// folders under it. Null if it is nowhere.</summary>
    public (string Path, string? Folder)? FindFile(string id)
    {
        var root = Path.Combine(UploadsDir, id);
        if (File.Exists(root)) return (root, null);
        foreach (var (key, name) in Folders)
        {
            var p = Path.Combine(UploadsDir, name, id);
            if (File.Exists(p)) return (p, key);
        }
        return null;
    }

    /// <summary>Moves a kept file into a sorted folder. Null if there is no
    /// such file.</summary>
    public FileEntry? MoveFile(string id, string folder)
    {
        if (FindFile(id) is not { } from) return null;
        var len = new FileInfo(from.Path).Length;
        if (from.Folder == folder) return Entry(id, len, folder);
        var dir = Path.Combine(UploadsDir, Folders[folder]);
        Directory.CreateDirectory(dir);
        File.Move(from.Path, Path.Combine(dir, id), overwrite: true);
        return Entry(id, len, folder);
    }

    /// <summary>Streams the body to a temp file while hashing it, then moves
    /// it into place under its hash - unless that file is already there.</summary>
    public async Task<FileEntry> SaveFileAsync(Stream body, string ext, CancellationToken ct)
    {
        Directory.CreateDirectory(UploadsDir);
        var tmp = Path.Combine(UploadsDir, $".upload-{Guid.NewGuid():N}.tmp");
        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        long bytes = 0;
        try
        {
            await using (var file = File.Create(tmp))
            {
                var buf = new byte[81920];
                int n;
                while ((n = await body.ReadAsync(buf, ct)) > 0)
                {
                    sha.AppendData(buf, 0, n);
                    await file.WriteAsync(buf.AsMemory(0, n), ct);
                    bytes += n;
                }
            }
            var id = Convert.ToHexStringLower(sha.GetHashAndReset()) + ext;
            // Kept already - perhaps sorted into a folder since: that copy stays.
            if (FindFile(id) is { } have)
            {
                File.Delete(tmp);
                return Entry(id, bytes, have.Folder);
            }
            File.Move(tmp, Path.Combine(UploadsDir, id));
            return Entry(id, bytes, null);
        }
        catch
        {
            File.Delete(tmp);
            throw;
        }
    }

    public IEnumerable<FileEntry> ListFiles()
    {
        if (!Directory.Exists(UploadsDir)) return [];
        IEnumerable<(FileInfo F, string? Folder)> Files(string dir, string? folder) =>
            !Directory.Exists(dir) ? [] :
            new DirectoryInfo(dir).EnumerateFiles().Where(f => ValidFileId(f.Name)).Select(f => (f, folder));
        return Files(UploadsDir, null)
            .Concat(Folders.SelectMany(kv => Files(Path.Combine(UploadsDir, kv.Value), kv.Key)))
            .OrderBy(x => x.F.LastWriteTimeUtc)
            .Select(x => Entry(x.F.Name, x.F.Length, x.Folder));
    }

    public bool DeleteFile(string id)
    {
        if (FindFile(id) is not { } at) return false;
        File.Delete(at.Path);
        return true;
    }

    private string ItemPath(string kind, string id) => Path.Combine(ItemsDir, kind, id + ".json");

    public JsonElement? GetItem(string kind, string id)
    {
        var path = ItemPath(kind, id);
        if (!File.Exists(path)) return null;
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.Clone();
    }

    /// <summary>Every document of a kind, as id -> document.</summary>
    public Dictionary<string, JsonElement> ListItems(string kind)
    {
        var dir = Path.Combine(ItemsDir, kind);
        var result = new Dictionary<string, JsonElement>();
        if (!Directory.Exists(dir)) return result;
        foreach (var f in Directory.EnumerateFiles(dir, "*.json"))
        {
            var id = Path.GetFileNameWithoutExtension(f);
            if (!ValidName(id)) continue;
            try
            {
                using var doc = JsonDocument.Parse(File.ReadAllText(f));
                result[id] = doc.RootElement.Clone();
            }
            catch (JsonException) { /* a damaged file is skipped, not fatal to the list */ }
        }
        return result;
    }

    public IEnumerable<string> ListKinds() =>
        !Directory.Exists(ItemsDir) ? [] :
        Directory.EnumerateDirectories(ItemsDir).Select(Path.GetFileName).OfType<string>().Where(ValidName);

    public void PutItem(string kind, string id, JsonElement doc) =>
        AtomicFile.WriteText(ItemPath(kind, id), doc.GetRawText());

    public bool DeleteItem(string kind, string id)
    {
        var path = ItemPath(kind, id);
        if (!File.Exists(path)) return false;
        File.Delete(path);
        return true;
    }
}
