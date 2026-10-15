using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Refboard.Services;

/// <summary>What the page asks for: the picture's tags (see js/generate.js,
/// which builds them from the choices), what to keep out of it on top of the
/// server's own negative prompt (a simple picture avoids "intricate details",
/// an ink one "solid black"), the tags to file it under, its shape, and a
/// seed - none for a new picture each time.</summary>
/// <remarks>Image is a PNG as base64, already the size of Shape. With Denoise
/// (0.2 - 1; low keeps the picture, high only borrows its layout) it is the
/// picture to start from - a photo drawn as a study, a favourite varied. With
/// Control instead it is the figure the picture is held to, through the
/// ControlNet (COMFY_CONTROLNET), at Strength.</remarks>
public sealed record GenerateRequest(string? Prompt, List<string>? Tags, string? Shape, long? Seed, string? Avoid = null,
    string? Image = null, double? Denoise = null, bool Control = false, double? Strength = null);

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

    /// <summary>What stops a job: its token, and the id ComfyUI gave it once
    /// queued (so it can be taken out of ComfyUI's own queue, or interrupted).</summary>
    private sealed class Control { public CancellationTokenSource Stop { get; } = new(); public volatile string? PromptId; }
    private readonly ConcurrentDictionary<string, Control> controls = new();

    public bool Configured => opts.ComfyUrl.Length > 0;

    /// <summary>Whether generating can work now: set up, ComfyUI answering,
    /// and the model in it. Asked quickly - a sleeping laptop must not hold
    /// the page up. <c>configured</c> tells "none is set up" (the page shows
    /// nothing) from "set up, and not answering now" (it says why, and asks
    /// again): a tunnel or a laptop that is down is not a missing feature.</summary>
    public async Task<object> StatusAsync(CancellationToken ct)
    {
        if (!Configured) return new { available = false, configured = false, reason = "No ComfyUI is set up (COMFY_URL)." };
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));
            var models = await Http.GetFromJsonAsync<List<string>>($"{opts.ComfyUrl}/models/checkpoints", cts.Token) ?? [];
            return models.Contains(opts.ComfyCheckpoint)
                // What it always adds, for the page's Prompt to show.
                ? new { available = true, checkpoint = opts.ComfyCheckpoint, quality = Quality, negative = Negative,
                    control = ControlConfigured && await HasControlNetAsync(cts.Token) }
                : new { available = false, configured = true, reason = $"ComfyUI has no {opts.ComfyCheckpoint} in models/checkpoints." };
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return new { available = false, configured = true, reason = "ComfyUI is not answering - is the machine it runs on awake, and reachable from this server?" };
        }
    }

    private async Task<bool> HasControlNetAsync(CancellationToken ct)
    {
        try { return (await Http.GetFromJsonAsync<List<string>>($"{opts.ComfyUrl}/models/controlnet", ct) ?? []).Contains(opts.ComfyControlNet); }
        catch (Exception ex) when (ex is HttpRequestException or JsonException) { return false; }
    }

    /// <summary>Whether a ControlNet is named in the options.</summary>
    public bool ControlConfigured => opts.ComfyControlNet.Length > 0;

    public string Start(GenerateRequest req)
    {
        foreach (var (key, old) in jobs)
            if (DateTime.UtcNow - old.Started > TimeSpan.FromHours(1)) jobs.TryRemove(key, out _);
        var id = Guid.NewGuid().ToString("N");
        jobs[id] = new Job("running");
        var control = controls[id] = new Control();
        _ = Task.Run(async () =>
        {
            try { jobs[id] = new Job("done", await RunAsync(req, control)); }
            catch (Exception ex) when (control.Stop.IsCancellationRequested)
            {
                // Asked for (Cancel), not a failure: say so, and say nothing of the exception.
                log.LogInformation("generating stopped ({Kind})", ex.GetType().Name);
                jobs[id] = new Job("cancelled", Error: "Stopped.");
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "generating failed");
                jobs[id] = new Job("error", Error: ex is HttpRequestException or TaskCanceledException
                    ? "ComfyUI stopped answering." : ex.Message);
            }
            finally { controls.TryRemove(id, out _); }
        });
        return id;
    }

    /// <summary>Stops a job: the wait ends at once, and ComfyUI is told - the job
    /// taken out of its queue, or, if it is the one running, interrupted. False
    /// for an id that is not running (finished, or unknown).</summary>
    public bool Cancel(string id)
    {
        if (!controls.TryGetValue(id, out var control)) return false;
        control.Stop.Cancel();
        if (control.PromptId is { } pid) _ = Task.Run(() => InterruptAsync(pid));
        return true;
    }

    // ComfyUI's /interrupt stops whichever job is running, which may not be ours,
    // so it is sent only when the queue says ours is the one; a job still waiting
    // is deleted from the queue instead. Best effort: the page has stopped waiting
    // either way, and ComfyUI may be gone.
    private async Task InterruptAsync(string pid)
    {
        try
        {
            using var ask = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            var q = await Http.GetFromJsonAsync<JsonElement>($"{opts.ComfyUrl}/queue", ask.Token);
            var running = q.TryGetProperty("queue_running", out var r) && r.EnumerateArray()
                .Any(e => e.ValueKind == JsonValueKind.Array && e.GetArrayLength() > 1 && e[1].GetString() == pid);
            if (running) await Http.PostAsync($"{opts.ComfyUrl}/interrupt", new StringContent(""), ask.Token);
            else await Http.PostAsJsonAsync($"{opts.ComfyUrl}/queue", new { delete = new[] { pid } }, ask.Token);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException) { /* gone, or slow: nothing more to do */ }
    }

    public Job? Get(string id) => jobs.GetValueOrDefault(id);

    private async Task<JsonElement> RunAsync(GenerateRequest req, Control control)
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
            ["6"] = Node("VAEDecode", new() { ["samples"] = Link("5", 0), ["vae"] = Link("1", 2) }),
            ["7"] = Node("PreviewImage", new() { ["images"] = Link("6", 0) }),
        };
        // Where the sampler starts: an empty latent, or - img2img - the given
        // picture encoded. The denoise is how far it may wander from it: 1.0
        // ignores the picture, 0.3 only repaints it.
        var denoise = 1.0;
        var positive = Link("2", 0);
        var negative = Link("3", 0);
        var hasImage = req.Image is { Length: > 0 };
        if (hasImage && !req.Control)
        {
            graph["8"] = Node("LoadImage", new() { ["image"] = await UploadAsync(req.Image!) });
            graph["4"] = Node("VAEEncode", new() { ["pixels"] = Link("8", 0), ["vae"] = Link("1", 2) });
            denoise = Math.Clamp(req.Denoise ?? 0.6, 0.2, 1.0);
        }
        else graph["4"] = Node("EmptyLatentImage", new() { ["width"] = w, ["height"] = h, ["batch_size"] = 1 });
        // A figure to hold the picture to: the ControlNet reads it and bends
        // both prompts toward it, so the sampler still starts from noise.
        if (hasImage && req.Control)
        {
            if (!ControlConfigured) throw new InvalidOperationException("No ControlNet is set up (COMFY_CONTROLNET).");
            graph["8"] = Node("LoadImage", new() { ["image"] = await UploadAsync(req.Image!) });
            graph["9"] = Node("ControlNetLoader", new() { ["control_net_name"] = opts.ComfyControlNet });
            graph["10"] = Node("ControlNetApplyAdvanced", new()
            {
                ["positive"] = positive, ["negative"] = negative, ["control_net"] = Link("9", 0), ["image"] = Link("8", 0),
                ["strength"] = Math.Clamp(req.Strength ?? 0.8, 0.1, 1.5), ["start_percent"] = 0.0, ["end_percent"] = 0.8,
                ["vae"] = Link("1", 2),
            });
            positive = Link("10", 0);
            negative = Link("10", 1);
        }
        graph["5"] = Node("KSampler", new()
        {
            ["model"] = Link("1", 0), ["positive"] = positive, ["negative"] = negative,
            ["latent_image"] = Link("4", 0), ["seed"] = seed, ["steps"] = 28, ["cfg"] = 5.0,
            ["sampler_name"] = "euler_ancestral", ["scheduler"] = "normal", ["denoise"] = denoise,
        });
        var queued = await Http.PostAsJsonAsync($"{opts.ComfyUrl}/prompt", new JsonObject { ["prompt"] = graph });
        var body = await queued.Content.ReadFromJsonAsync<JsonElement>();
        if (!queued.IsSuccessStatusCode || !body.TryGetProperty("prompt_id", out var pid))
            throw new InvalidOperationException("ComfyUI refused the job: " + body.GetRawText());
        control.PromptId = pid.GetString();
        // Stopped between queueing and here: Cancel() found no id to interrupt.
        if (control.Stop.IsCancellationRequested) { await InterruptAsync(control.PromptId!); control.Stop.Token.ThrowIfCancellationRequested(); }

        var until = DateTime.UtcNow.AddMinutes(10);
        JsonElement image;
        // One answer is asked for 20 seconds, and five misses in a row end it: a
        // laptop that fell asleep drops the packets, and the client's own five
        // minutes per request would have the page waiting that long on a job
        // that is gone. A single miss (Wi-Fi, a busy GPU) is not the end.
        var misses = 0;
        for (;;)
        {
            if (DateTime.UtcNow > until) throw new TimeoutException("ComfyUI took longer than ten minutes.");
            await Task.Delay(1000, control.Stop.Token);
            JsonElement hist;
            try
            {
                using var ask = CancellationTokenSource.CreateLinkedTokenSource(control.Stop.Token);
                ask.CancelAfter(TimeSpan.FromSeconds(20));
                hist = await Http.GetFromJsonAsync<JsonElement>($"{opts.ComfyUrl}/history/{pid.GetString()}", ask.Token);
                misses = 0;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !control.Stop.IsCancellationRequested)
            {
                if (++misses >= 5) throw;
                continue;
            }
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
            t = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), folder = "generated", tags, prompt = req.Prompt, avoid = req.Avoid, shape = req.Shape ?? "portrait", seed,
            kind = req.Image is null ? "new" : req.Control ? "pose" : "img2img",
        });
        store.PutItem("uploads", entry.Id.Split('.')[0], doc);
        ReindexHostedService.ReindexRequested = true;
        ReindexHostedService.Wake();
        return JsonSerializer.SerializeToElement(new { doc, url = entry.Url });
    }

    /// <summary>The picture into ComfyUI's input folder, where its LoadImage
    /// node reads from; returns the name it was given.</summary>
    private async Task<string> UploadAsync(string base64)
    {
        // The page sends a JPEG (a PNG of the frame is 2 MB and nginx in front
        // refuses a body over 1 MB), but a PNG still works: told by its first bytes.
        var bytes = Convert.FromBase64String(base64);
        var jpeg = bytes.Length > 2 && bytes[0] == 0xFF && bytes[1] == 0xD8;
        var name = $"refboard-{Guid.NewGuid():N}.{(jpeg ? "jpg" : "png")}";
        using var form = new MultipartFormDataContent
        {
            { new ByteArrayContent(bytes) { Headers = { ContentType = new(jpeg ? "image/jpeg" : "image/png") } }, "image", name },
            { new StringContent("true"), "overwrite" },
        };
        var r = await Http.PostAsync($"{opts.ComfyUrl}/upload/image", form);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("name").GetString()!;
    }

    private static JsonObject Node(string type, JsonObject inputs) => new() { ["class_type"] = type, ["inputs"] = inputs };
    private static JsonArray Link(string node, int output) => [node, output];
}
