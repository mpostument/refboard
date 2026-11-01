namespace Refboard.Models;

/// <summary>
/// The main colours of one image, as "rrggbb:share" strings, biggest first -
/// "c8553d:41" is a brick red that covers 41% of the picture. A string rather
/// than an object per colour: a library of thousands carries five of these
/// each, and the page reads the whole file before it can search.
/// </summary>
public sealed class PaletteRecord
{
    public string[] P { get; set; } = [];

    /// <summary>Source file's mtime, unix seconds - the cache key alongside <see cref="B"/>.</summary>
    public long M { get; set; }

    /// <summary>Source file's size in bytes - the other half of the cache key.</summary>
    public long B { get; set; }
}

/// <summary>palettes.json: the colour search reads this. Like features.json it is
/// optional - a page without it hides the search rather than failing.</summary>
public sealed class PalettesDocument
{
    public long Generated { get; set; }
    public Dictionary<string, PaletteRecord> Images { get; set; } = [];
}
