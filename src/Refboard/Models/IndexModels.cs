namespace Refboard.Models;

/// <summary>One image file within a group: its served URL and its size on disk
/// - and, for an uploaded picture that has been sorted, what it was tagged
/// with (js/sort.js), which the library's search matches too.</summary>
public sealed class ImageRecord
{
    public string Src { get; set; } = "";
    public long Bytes { get; set; }
    public List<string>? Tags { get; set; }
}

/// <summary>
/// One draw unit's worth of images - either a pack's flat contents, or one
/// subfolder of it. <see cref="Rotation"/> marks a folder holding one pose shot
/// from many angles, so the client draws a single frame from it per pose
/// rather than every angle in a row - see IndexBuilder for how that is decided.
/// </summary>
public sealed class GroupRecord
{
    public string Name { get; set; } = "";
    public bool Rotation { get; set; }
    public List<ImageRecord> Images { get; set; } = [];
}

public sealed class PackRecord
{
    public string Name { get; set; } = "";
    public int Count { get; set; }
    public List<GroupRecord> Groups { get; set; } = [];
}

/// <summary>The manifest the board's setup screen reads: what packs exist, how
/// they are grouped, and every image path. Mirrors index.json as produced by
/// the original refboard-index.py, field for field, since refboard.html's own
/// JS is unchanged and expects this exact shape.</summary>
public sealed class IndexDocument
{
    public long Generated { get; set; }
    public string GeneratedIso { get; set; } = "";
    public string Source { get; set; } = "";
    public int TotalImages { get; set; }
    public long TotalBytes { get; set; }
    public int PackCount { get; set; }
    public string SizeHuman { get; set; } = "";
    public List<PackRecord> Packs { get; set; } = [];
}
