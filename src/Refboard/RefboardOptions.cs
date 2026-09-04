namespace Refboard;

/// <summary>
/// Everything the two Ansible-templated defaults used to supply, now read from
/// the environment - the natural config surface for a container instead of a
/// role's defaults/main.yml. See README.md for the full list with descriptions.
/// </summary>
public sealed class RefboardOptions
{
    public string SourceDir { get; set; } = "/references";
    public string DataDir { get; set; } = "/data";

    /// <summary>Where generated display copies live - a subfolder of <see cref="DataDir"/>
    /// rather than its own volume, so one bind mount is enough to preserve
    /// everything expensive to recompute (see the README's data-vs-references
    /// volume split).</summary>
    public string DisplayDir => Path.Combine(DataDir, "display");

    public int Port { get; set; } = 8080;

    /// <summary>How often the cheap directory-walk index rebuilds. Cheap enough
    /// (a walk over a few thousand files) that a short interval costs nothing -
    /// this is what makes a newly dropped-in pack "discovered".</summary>
    public int IndexIntervalSecs { get; set; } = 600;

    /// <summary>How often the expensive per-image feature pass rebuilds. Every
    /// pass after the first is a cache hit for anything already measured, so
    /// this mostly governs how quickly a *newly added* image gets its display
    /// copy and stats, not repeated work.</summary>
    public int FeaturesIntervalSecs { get; set; } = 1800;

    /// <summary>Caps decode time per feature pass; 0 means no cap. Work is
    /// cached on (mtime, size) and resumes on the next pass, so a capped run
    /// converges over several ticks instead of blocking one for hours on a
    /// library that was just mounted for the first time.</summary>
    public double FeaturesBudgetSecs { get; set; }

    public int MaxPx { get; set; } = 1600;

    /// <summary>Long edge of the grid thumbnails the library browser draws.
    /// Separate from <see cref="MaxPx"/> because the two answer different
    /// questions: a display copy is what you draw from, a thumbnail is one of
    /// a few hundred on screen at once. Sending 1600px copies to fill a grid
    /// is tens of megabytes for a view that renders each of them ~200px wide.</summary>
    public int ThumbPx { get; set; } = 400;

    public int Quality { get; set; } = 85;

    /// <summary>Hamming distance at or below which two frames in the same group
    /// are flagged as near-identical. Advisory only - see FeatureBuilder.Cluster.</summary>
    public int DhashThreshold { get; set; } = 4;

    /// <summary>Folder-name substrings marking a "one pose, many angles" set.</summary>
    public string[] RotationPatterns { get; set; } = ["360", "turnaround"];

    /// <summary>URL prefix for images served straight from <see cref="SourceDir"/>.</summary>
    public string RefsPrefix { get; } = "/refs/";

    /// <summary>URL prefix for generated display copies. Deliberately "/display/",
    /// matching the "display" subfolder name 1:1 - the whole of DataDir is served
    /// at the site root (see Program.cs), so no separate static-file mapping is
    /// needed for this at all, unlike the original nginx setup's own alias.</summary>
    public string DisplayPrefix { get; } = "/display/";

    public static RefboardOptions FromEnvironment()
    {
        static string Str(string name, string fallback) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } v ? v : fallback;
        static int Int(string name, int fallback) =>
            int.TryParse(Environment.GetEnvironmentVariable(name), out var v) ? v : fallback;
        static double Dbl(string name, double fallback) =>
            double.TryParse(Environment.GetEnvironmentVariable(name), out var v) ? v : fallback;

        var opts = new RefboardOptions
        {
            SourceDir = Str("SOURCE_DIR", "/references"),
            DataDir = Str("DATA_DIR", "/data"),
            Port = Int("PORT", 8080),
            IndexIntervalSecs = Int("INDEX_INTERVAL_SECS", 600),
            FeaturesIntervalSecs = Int("FEATURES_INTERVAL_SECS", 1800),
            FeaturesBudgetSecs = Dbl("FEATURES_BUDGET_SECS", 0),
            MaxPx = Int("MAX_PX", 1600),
            ThumbPx = Int("THUMB_PX", 400),
            Quality = Int("QUALITY", 85),
            DhashThreshold = Int("DHASH_THRESHOLD", 4),
        };

        var patterns = Environment.GetEnvironmentVariable("ROTATION_PATTERNS");
        if (!string.IsNullOrWhiteSpace(patterns))
        {
            opts.RotationPatterns = patterns.Split(',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        return opts;
    }
}
