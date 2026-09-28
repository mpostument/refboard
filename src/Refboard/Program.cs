using System.Reflection;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Refboard;
using Refboard.Services;

// InformationalVersion, not GetName().Version: the latter is AssemblyVersion,
// a strictly-numeric 4-part number that silently drops a "-dev" suffix -
// InformationalVersion is what -p:Version=X.Y.Z at publish time (see the
// Dockerfile's VERSION build-arg) actually lands in, unmodified.
var appVersion = Assembly.GetExecutingAssembly()
    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
    ?? "0.0.0-dev";

var builder = WebApplication.CreateBuilder(args);

var options = RefboardOptions.FromEnvironment();
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<UserStore>();
builder.Services.AddSingleton<ComfyClient>();
builder.Services.AddHostedService<ReindexHostedService>();

builder.WebHost.ConfigureKestrel(k => k.ListenAnyIP(options.Port));

var app = builder.Build();

Directory.CreateDirectory(options.SourceDir);
Directory.CreateDirectory(options.DataDir);
Directory.CreateDirectory(options.DisplayDir);

// No UseHttpsRedirection: this is a plain-HTTP LAN tool by design, same as
// the original - a self-signed cert would just be one more thing to accept
// on every device that opens it, for a page with nothing to protect.

// Nothing with a dot-prefixed part in its path is ever served: UserStore's
// documents (DataDir/.items) and its half-written uploads (.upload-*.tmp)
// are reached only through the API. Said here rather than left to
// PhysicalFileProvider's exclusion filters, which look only at a file's own
// name - not at the folders above it.
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.Value?.Split('/').Any(s => s.StartsWith('.')) == true)
    {
        ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});

// wwwroot/index.html is refboard.html under a conventional name, so it is
// served at "/" with no extra configuration.
app.UseDefaultFiles();
// index.html is always revalidated (a cheap 304 when unchanged), and every
// js/ and css/ file it loads carries a hash of its contents (?v=..., see
// scripts/stamp-assets.js) - so those can be cached for good: a changed
// file is a new URL. Together a browser never runs a new page with an old
// script, or an old page with a new one.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var req = ctx.Context.Request;
        if (req.Query.ContainsKey("v"))
            ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        else if (req.Path.Value?.EndsWith(".html", StringComparison.OrdinalIgnoreCase) == true)
            ctx.Context.Response.Headers.CacheControl = "no-cache";
    },
});

// The generated index.json, features.json and display/* copies - the whole
// of DataDir served at the site root, exactly where refboard.html's own
// relative fetches ('index.json', 'features.json') and the "/display/..."
// URLs FeatureBuilder writes both already expect. No separate alias needed,
// unlike the original nginx setup: the URL prefix and the folder name are
// the same string on purpose (see RefboardOptions.DisplayPrefix).
// Uploads are in here too (DataDir/uploads, see UserStore); nosniff so a
// browser takes each at the type its extension says and never guesses.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(options.DataDir),
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.XContentTypeOptions = "nosniff",
});

// The mounted reference library itself - read-only by convention (the
// compose example mounts it :ro), served under /refs/ to match the prefix
// IndexBuilder bakes into every image's "src".
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(options.SourceDir),
    RequestPath = "/refs",
    ServeUnknownFileTypes = true, // a stray extension in someone's pose pack should not 404
});

app.MapGet("/healthz", () => Results.Ok(new { status = "ok", version = appVersion }));

// Lets you skip the wait for the next scheduled tick right after dropping a
// new pack in - see ReindexHostedService for what "requested" actually does.
app.MapPost("/api/reindex", () =>
{
    ReindexHostedService.ReindexRequested = true;
    ReindexHostedService.Wake();
    return Results.Accepted();
});

// ---- what the app is given to keep - see UserStore. The page asks
// /healthz whether a backend is there before using any of this; on GitHub
// Pages there is none and it keeps things in the browser instead.
var store = app.Services.GetRequiredService<UserStore>();
var typeOfExt = UserStore.Types.GroupBy(kv => kv.Value).ToDictionary(g => g.Key, g => g.First().Key);

// The body is the file itself, its type in Content-Type. A video can be
// large, so the limit is lifted from Kestrel's 30 MB for this one route.
app.MapPost("/api/uploads", async (HttpContext ctx) =>
{
    var type = (ctx.Request.ContentType ?? "").Split(';')[0].Trim().ToLowerInvariant();
    if (!UserStore.Types.TryGetValue(type, out var ext))
        return Results.BadRequest(new { error = "only images and video can be kept" });
    var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
    if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 1L << 30;
    var entry = await store.SaveFileAsync(ctx.Request.Body, ext, ctx.RequestAborted);
    return Results.Ok(entry);
});
app.MapGet("/api/uploads", () => Results.Ok(store.ListFiles()));
// A kept file by its id, whichever folder it has been sorted into - so the
// page's own links to it (the uploads list, a backup) never go stale.
app.MapGet("/api/uploads/{id}", (string id) =>
    !UserStore.ValidFileId(id) ? Results.BadRequest()
    // Rooted, or Results.File would look for it under wwwroot.
    : store.FindFile(id) is { } at ? Results.File(Path.GetFullPath(at.Path), typeOfExt.GetValueOrDefault(Path.GetExtension(id), "application/octet-stream"))
    : Results.NotFound());
// Sorts a kept picture into one of UserStore.Folders; the library shows it
// there after the index pass this asks for.
app.MapPut("/api/uploads/{id}/folder", (string id, FolderRequest req) =>
{
    if (!UserStore.ValidFileId(id) || req.Folder is null || !UserStore.Folders.ContainsKey(req.Folder))
        return Results.BadRequest();
    if (store.MoveFile(id, req.Folder) is not { } entry) return Results.NotFound();
    ReindexHostedService.ReindexRequested = true;
    ReindexHostedService.Wake();
    return Results.Ok(entry);
});
app.MapDelete("/api/uploads/{id}", (string id) =>
    !UserStore.ValidFileId(id) ? Results.BadRequest() : store.DeleteFile(id) ? Results.NoContent() : Results.NotFound());

// Generating references with a ComfyUI - see ComfyClient. The page asks
// first whether it can; a picture is a job it then asks after.
var comfy = app.Services.GetRequiredService<ComfyClient>();
app.MapGet("/api/generate", async (CancellationToken ct) => Results.Ok(await comfy.StatusAsync(ct)));
app.MapPost("/api/generate", (GenerateRequest req) =>
{
    if (!comfy.Configured) return Results.NotFound();
    if (string.IsNullOrWhiteSpace(req.Prompt) || req.Prompt.Length > 800 || (req.Avoid?.Length ?? 0) > 400
        || (req.Tags ?? []).Count > 24 || (req.Tags ?? []).Any(t => t.Length > 40)
        || (req.Shape is not null && !ComfyClient.Shapes.ContainsKey(req.Shape)))
        return Results.BadRequest();
    return Results.Accepted(value: new { id = comfy.Start(req) });
});
app.MapGet("/api/generate/{id}", (string id) =>
    comfy.Get(id) is { } job ? Results.Ok(new { state = job.State, upload = job.Upload, error = job.Error }) : Results.NotFound());

app.MapGet("/api/items", () => Results.Ok(store.ListKinds()));
app.MapGet("/api/items/{kind}", (string kind) =>
    !UserStore.ValidName(kind) ? Results.BadRequest() : Results.Ok(store.ListItems(kind)));
app.MapGet("/api/items/{kind}/{id}", (string kind, string id) =>
    !UserStore.ValidName(kind) || !UserStore.ValidName(id) ? Results.BadRequest()
    : store.GetItem(kind, id) is { } doc ? Results.Ok(doc) : Results.NotFound());
app.MapPut("/api/items/{kind}/{id}", (string kind, string id, System.Text.Json.JsonElement doc) =>
{
    if (!UserStore.ValidName(kind) || !UserStore.ValidName(id)) return Results.BadRequest();
    store.PutItem(kind, id, doc);
    return Results.NoContent();
});
app.MapDelete("/api/items/{kind}/{id}", (string kind, string id) =>
    !UserStore.ValidName(kind) || !UserStore.ValidName(id) ? Results.BadRequest()
    : store.DeleteItem(kind, id) ? Results.NoContent() : Results.NotFound());

app.Run();

record FolderRequest(string? Folder);
