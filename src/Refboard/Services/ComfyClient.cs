using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Refboard.Services;

/// <summary>What the page asks for: the picture's tags (see js/generate.js,
/// which builds them from the choices), what to keep out of it on top of the
/// server's own negative prompt (a simple picture avoids "intricate details",
/// an ink one "solid black"), the tags to file it under, its shape, and a
/// seed - none for a new picture each time.</summary>
public sealed record GenerateRequest(string? Prompt, List<string>? Tags, string? Shape, long? Seed, string? Avoid = null);

/// <summary>
/// Generates references with a ComfyUI (<see cref="RefboardOptions.ComfyUrl"/>)
/// on a machine with a GPU, and keeps each like an upload: stored by
/// UserStore, in the Generated folder, with its tags - so it is in the
/// library a few seconds later and the search finds it.
///
/// A picture takes ten seconds to a minute (the first one loads the model),
/// longer than a proxy in front of this app may let a request run - nginx's
/// default is 60 s. So a request starts a job and returns; the page asks
/// after it until it is done.
/// </summary>
public sealed class ComfyClient(RefboardOptions opts, UserStore store, ILogger<ComfyClient> log)
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };

    /// <summary>The shapes on offer, at the sizes SDXL was trained at.</summary>
    public static readonly IReadOnlyDictionary<string, (int W, int H)> Shapes = new Dictionary<string, (int, int)>
    {
        ["portrait"] = (832, 1216), ["square"] = (1024, 1024), ["landscape"] = (1216, 832),
    };

    // Added by the server, not sent by the page: the model's own quality tags
    // (Animagine's, which other Danbooru-tag models share), and what never to
    // make - nsfw included, always.
    private const string Quality = "masterpiece, high score, great score, absurdres";
    private const string Negative =
        "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, " +
        "worst quality, low quality, low score, bad score, average score, signature, watermark, username, " +
        "blurry, nsfw";

    public sealed record Job(string State, JsonElement? Upload = null, string? Error = null)
    {
        public DateTime Started { get; init; } = DateTime.UtcNow;
    }
    private readonly ConcurrentDictionary<string, Job> jobs = new();

    public bool Configured => opts.ComfyUrl.Length > 0;

    /// <summary>Whether generating can work now: set up, ComfyUI answering,
    /// and the model in it. Asked quickly - a sleeping laptop must not hold
    /// the page up.</summary>
    public async Task<object> StatusAsync(CancellationToken ct)
    {
        if (!Configured) return new { available = false, reason = "No ComfyUI is set up (COMFY_URL)." };
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));
            var models = await Http.GetFromJsonAsync<List<string>>($"{opts.ComfyUrl}/models/checkpoints", cts.Token) ?? [];
            return models.Contains(opts.ComfyCheckpoint)
                ? new { available = true, checkpoint = opts.ComfyCheckpoint }
                : new { available = false, reason = $"ComfyUI has no {opts.ComfyCheckpoint} in models/checkpoints." };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new { available = false, reason = "ComfyUI is not answering - is the machine it runs on awake?" };
        }
    }

    public string Start(GenerateRequest req)
    {
        foreach (var (key, old) in jobs)
            if (DateTime.UtcNow - old.Started > TimeSpan.FromHours(1)) jobs.TryRemove(key, out _);
        var id = Guid.NewGuid().ToString("N");
        jobs[id] = new Job("running");
        _ = Task.Run(async () =>
        {
            try { jobs[id] = new Job("done", await RunAsync(req)); }
            catch (Exception ex)
            {
                log.LogWarning(ex, "generating failed");
                jobs[id] = new Job("error", Error: ex is HttpRequestException or TaskCanceledException
                    ? "ComfyUI stopped answering." : ex.Message);
            }
        });
        return id;
    }

    public Job? Get(string id) => jobs.GetValueOrDefault(id);

    private async Task<JsonElement> RunAsync(GenerateRequest req)
    {
        var (w, h) = Shapes[req.Shape ?? "portrait"];
        var seed = req.Seed ?? Random.Shared.NextInt64(0, 1L << 48);
        // The graph ComfyUI's own "save (API)" writes: checkpoint, two text
        // encodings, an empty latent, the sampler, the decode - and a preview,
        // not a save, so ComfyUI keeps it only in its temp folder.
        var graph = new JsonObject
        {
            ["1"] = Node("CheckpointLoaderSimple", new() { ["ckpt_name"] = opts.ComfyCheckpoint }),
            ["2"] = Node("CLIPTextEncode", new() { ["clip"] = Link("1", 1), ["text"] = $"{req.Prompt}, {Quality}" }),
            ["3"] = Node("CLIPTextEncode", new() { ["clip"] = Link("1", 1),
                ["text"] = string.IsNullOrWhiteSpace(req.Avoid) ? Negative : $"{Negative}, {req.Avoid}" }),
            ["4"] = Node("EmptyLatentImage", new() { ["width"] = w, ["height"] = h, ["batch_size"] = 1 }),
            ["5"] = Node("KSampler", new()
            {
                ["model"] = Link("1", 0), ["positive"] = Link("2", 0), ["negative"] = Link("3", 0),
                ["latent_image"] = Link("4", 0), ["seed"] = seed, ["steps"] = 28, ["cfg"] = 5.0,
                ["sampler_name"] = "euler_ancestral", ["scheduler"] = "normal", ["denoise"] = 1.0,
            }),
            ["6"] = Node("VAEDecode", new() { ["samples"] = Link("5", 0), ["vae"] = Link("1", 2) }),
            ["7"] = Node("PreviewImage", new() { ["images"] = Link("6", 0) }),
        };
        var queued = await Http.PostAsJsonAsync($"{opts.ComfyUrl}/prompt", new JsonObject { ["prompt"] = graph });
        var body = await queued.Content.ReadFromJsonAsync<JsonElement>();
        if (!queued.IsSuccessStatusCode || !body.TryGetProperty("prompt_id", out var pid))
            throw new InvalidOperationException("ComfyUI refused the job: " + body.GetRawText());

        var until = DateTime.UtcNow.AddMinutes(10);
        JsonElement image;
        for (;;)
        {
            if (DateTime.UtcNow > until) throw new TimeoutException("ComfyUI took longer than ten minutes.");
            await Task.Delay(1000);
            var hist = await Http.GetFromJsonAsync<JsonElement>($"{opts.ComfyUrl}/history/{pid.GetString()}");
            if (!hist.TryGetProperty(pid.GetString()!, out var run)) continue;
            if (run.TryGetProperty("status", out var st) && st.TryGetProperty("status_str", out var s) && s.GetString() == "error")
                throw new InvalidOperationException("ComfyUI could not make it - see its log.");
            if (run.TryGetProperty("outputs", out var outs) && outs.TryGetProperty("7", out var o) &&
                o.TryGetProperty("images", out var imgs) && imgs.GetArrayLength() > 0) { image = imgs[0]; break; }
        }
        var q = $"filename={Uri.EscapeDataString(image.GetProperty("filename").GetString()!)}" +
                $"&subfolder={Uri.EscapeDataString(image.GetProperty("subfolder").GetString()!)}" +
                $"&type={Uri.EscapeDataString(image.GetProperty("type").GetString()!)}";
        await using var png = await Http.GetStreamAsync($"{opts.ComfyUrl}/view?{q}");

        // Kept like an upload, filed under Generated, with its own document
        // (the one js/store.js writes for a dropped picture) - which is where
        // the index takes its tags from.
        var saved = await store.SaveFileAsync(png, ".png", CancellationToken.None);
        var entry = store.MoveFile(saved.Id, "generated")!;
        var tags = req.Tags ?? [];
        var doc = JsonSerializer.SerializeToElement(new
        {
            file = entry.Id, name = tags.Count > 0 ? string.Join(", ", tags.Take(3)) : "generated",
            type = "image/png", from = "generate", bytes = entry.Bytes,
            t = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), folder = "generated", tags, prompt = req.Prompt, seed,
        });
        store.PutItem("uploads", entry.Id.Split('.')[0], doc);
        ReindexHostedService.ReindexRequested = true;
        ReindexHostedService.Wake();
        return JsonSerializer.SerializeToElement(new { doc, url = entry.Url });
    }

    private static JsonObject Node(string type, JsonObject inputs) => new() { ["class_type"] = type, ["inputs"] = inputs };
    private static JsonArray Link(string node, int output) => [node, output];
}
