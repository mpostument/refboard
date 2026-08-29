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
builder.Services.AddHostedService<ReindexHostedService>();

builder.WebHost.ConfigureKestrel(k => k.ListenAnyIP(options.Port));

var app = builder.Build();

Directory.CreateDirectory(options.SourceDir);
Directory.CreateDirectory(options.DataDir);
Directory.CreateDirectory(options.DisplayDir);

// No UseHttpsRedirection: this is a plain-HTTP LAN tool by design, same as
// the original - a self-signed cert would just be one more thing to accept
// on every device that opens it, for a page with nothing to protect.

// wwwroot/index.html is refboard.html under a conventional name, so it is
// served at "/" with no extra configuration.
app.UseDefaultFiles();
app.UseStaticFiles();

// The generated index.json, features.json and display/* copies - the whole
// of DataDir served at the site root, exactly where refboard.html's own
// relative fetches ('index.json', 'features.json') and the "/display/..."
// URLs FeatureBuilder writes both already expect. No separate alias needed,
// unlike the original nginx setup: the URL prefix and the folder name are
// the same string on purpose (see RefboardOptions.DisplayPrefix).
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(options.DataDir),
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
    return Results.Accepted();
});

app.Run();
