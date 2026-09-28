using Refboard.Models;

namespace Refboard.Services;

/// <summary>
/// Replaces what cron did in the Ansible-managed original: a container image
/// cannot assume a host scheduler, so this runs inside the app itself.
/// The cheap index rebuilds every tick (IndexIntervalSecs); the expensive
/// feature pass only when its own, longer interval has elapsed, or someone
/// asked for it now via POST /api/reindex.
/// </summary>
public sealed class ReindexHostedService(RefboardOptions opts, UserStore store, ILogger<ReindexHostedService> logger)
    : BackgroundService
{
    private static readonly SemaphoreSlim WakeSignal = new(0, 1);

    /// <summary>Runs the next tick now rather than at the end of the interval
    /// - after an upload is sorted into a folder, so the library shows it
    /// there in seconds, not minutes. Several calls before the tick make one.</summary>
    public static void Wake()
    {
        try { WakeSignal.Release(); } catch (SemaphoreFullException) { /* a tick is already due */ }
    }

    // The tags each sorted upload was given, by its file name - from the
    // "uploads" documents the page keeps (see js/store.js, js/sort.js).
    private Func<string, List<string>?> UploadTags()
    {
        var byFile = new Dictionary<string, List<string>>();
        foreach (var doc in store.ListItems("uploads").Values)
        {
            if (doc.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
            if (!doc.TryGetProperty("file", out var f) || f.ValueKind != System.Text.Json.JsonValueKind.String) continue;
            if (!doc.TryGetProperty("tags", out var t) || t.ValueKind != System.Text.Json.JsonValueKind.Array) continue;
            byFile[f.GetString()!] = t.EnumerateArray()
                .Where(x => x.ValueKind == System.Text.Json.JsonValueKind.String).Select(x => x.GetString()!).ToList();
        }
        return name => byFile.GetValueOrDefault(name);
    }

    /// <summary>Set by the /api/reindex endpoint. A plain volatile flag rather
    /// than a channel or queue: this is a single-process, single-instance tool
    /// with one background loop, and "run the expensive pass on the next
    /// tick" is the entire contract a request-for-immediacy needs.</summary>
    public static volatile bool ReindexRequested;

    /// <summary>The most recently written index, kept in memory so the feature
    /// pass never has to round-trip its own output back in through the
    /// filesystem to know what it just indexed.</summary>
    public static IndexDocument? LastIndex { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(opts.DataDir);
        Directory.CreateDirectory(opts.DisplayDir);

        var lastFeatures = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                LastIndex = IndexBuilder.Build(opts.SourceDir, opts.RefsPrefix, opts.RotationPatterns,
                    (store.UploadsDir, "/uploads/"), UploadTags());
                AtomicFile.WriteJson(Path.Combine(opts.DataDir, "index.json"), LastIndex);
                logger.LogInformation("indexed {Total} images in {Packs} packs -> index.json",
                    LastIndex.TotalImages, LastIndex.Packs.Count);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "index build failed");
            }

            var due = DateTime.UtcNow - lastFeatures >= TimeSpan.FromSeconds(opts.FeaturesIntervalSecs);
            if ((due || ReindexRequested) && LastIndex != null)
            {
                ReindexRequested = false;
                try
                {
                    await FeatureBuilder.RunAsync(LastIndex, opts,
                        Path.Combine(opts.DataDir, "features.json"), logger, stoppingToken);
                    lastFeatures = DateTime.UtcNow;
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    logger.LogError(ex, "feature build failed");
                }
            }

            try { await WakeSignal.WaitAsync(TimeSpan.FromSeconds(opts.IndexIntervalSecs), stoppingToken); }
            catch (OperationCanceledException) { }
        }
    }
}
