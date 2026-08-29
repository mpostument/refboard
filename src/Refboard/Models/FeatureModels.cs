namespace Refboard.Models;

/// <summary>
/// Everything measured for one image: tone stats, a perceptual hash, and the
/// generated display copies. Mirrors one entry of features.json's "images" map
/// as produced by the original refboard-features.py - see FeatureBuilder.
///
/// WebpBytes/DisplayWebp are nullable rather than defaulting to 0/"" so a
/// record that has genuinely never had a WebP twin computed (missing) can be
/// told apart from one where the encode was attempted and produced 0 bytes -
/// the same distinction the Python original drew via "key not in dict" vs a
/// falsy value, needed by the cached-record backfill path in FeatureBuilder.
/// </summary>
public sealed class FeatureRecord
{
    public string? Dhash { get; set; }
    public double? V { get; set; }
    public double? C { get; set; }
    public int W { get; set; }
    public int H { get; set; }
    public int Dw { get; set; }
    public int Dh { get; set; }
    public long Dbytes { get; set; }
    public long? WebpBytes { get; set; }

    /// <summary>Source file's mtime, unix seconds - the cache key alongside <see cref="B"/>.</summary>
    public long M { get; set; }

    /// <summary>Source file's size in bytes - the other half of the cache key.</summary>
    public long B { get; set; }

    public string? Display { get; set; }
    public string? DisplayWebp { get; set; }
    public string? DupGroup { get; set; }
}

/// <summary>Mirrors features.json's top level, field for field.</summary>
public sealed class FeaturesDocument
{
    public long Generated { get; set; }
    public string GeneratedIso { get; set; } = "";
    public int MaxPx { get; set; }
    public int Threshold { get; set; }
    public int Featured { get; set; }
    public int Pending { get; set; }
    public int DupGroups { get; set; }
    public int DupImages { get; set; }
    public Dictionary<string, FeatureRecord> Images { get; set; } = [];
}
