using System.Text;
using System.Text.Json;

namespace Refboard.Services;

public static class AtomicFile
{
    /// <summary>The JSON shape both index.json and features.json are written and
    /// read with. CamelCase happens to already match every field name in both
    /// documents exactly (v, c, m, b, dhash, dupGroup, webpBytes, displayWebp,
    /// generatedIso, ...), so refboard.html's JS - unchanged from the original -
    /// reads these files with no server-side name mapping at all.</summary>
    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Write via a temp file in the same directory, then replace.
    /// The board fetches these files directly over HTTP; a partial write would
    /// surface there as a parse error instead of a clean "try again shortly" -
    /// same reasoning, and same shape, as the original Python scripts' own
    /// write_atomic().</summary>
    public static void WriteText(string path, string contents)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        var tmp = Path.Combine(directory ?? ".", $".refboard-{Guid.NewGuid():N}.tmp");
        File.WriteAllText(tmp, contents, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        File.Move(tmp, path, overwrite: true);
    }

    public static void WriteJson<T>(string path, T value) =>
        WriteText(path, JsonSerializer.Serialize(value, JsonOptions));
}
