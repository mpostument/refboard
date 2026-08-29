# Refboard

A timed gesture-drawing reference board you run yourself. Point it at a folder
of images, mount it into a container, and get a distraction-free timed-pose
viewer with tone-based filtering, near-duplicate detection, a tonal-value
(posterize/Notan) study view, and a standalone drop-zone for checking any
image's value structure - all served from one small container with no
external dependencies at runtime.

This started as a role in a private homelab Ansible repo and was extracted
here to stand on its own.

## Quick start

```bash
curl -O https://raw.githubusercontent.com/mpostument/refboard/main/docker-compose.yml
# edit the volumes: line to point at your own images
docker compose up -d
```

Then open `http://localhost:8080/`.

The container ships **no images of its own** - bring your own reference
photos. Most published pose-reference packs (Proko, Charming Muse, and
similar) are licensed for personal practice use, not redistribution, so
this project never bundles or fetches any.

## How discovery works

Mount your image library read-only at `/references`. A background pass
inside the container walks it every few minutes (`INDEX_INTERVAL_SECS`) and
writes a manifest - that's what makes a newly added folder show up without
restarting anything. A slower, separate pass (`FEATURES_INTERVAL_SECS`)
decodes each image once to compute a resized display copy, tone stats, and a
perceptual hash for near-duplicate detection; it's capped by
`FEATURES_BUDGET_SECS` per pass and resumes where it left off, so a huge
library on first run doesn't block indefinitely. You can also trigger it
immediately instead of waiting for the next tick:

```bash
curl -X POST http://localhost:8080/api/reindex
```

Two folder conventions the indexer looks for:

- **Rotation sets** - a subfolder whose name contains one of
  `ROTATION_PATTERNS` (default `360`, `turnaround`) is treated as one pose
  shot from many angles, and the board draws a single random frame from it
  per pose instead of showing every angle in a row.
- **Natural sort** - `Pose2` sorts before `Pose10` everywhere in the UI.

## Configuration

All via environment variables; every one has a default.

| Variable | Default | Meaning |
|---|---|---|
| `SOURCE_DIR` | `/references` | Where your images are mounted |
| `DATA_DIR` | `/data` | Where the generated index, features, and display copies live |
| `PORT` | `8080` | HTTP port the app listens on |
| `INDEX_INTERVAL_SECS` | `600` | How often the cheap directory-walk index rebuilds |
| `FEATURES_INTERVAL_SECS` | `1800` | How often the expensive per-image feature pass rebuilds |
| `FEATURES_BUDGET_SECS` | `0` | Cap on decode time per feature pass; `0` = unlimited |
| `MAX_PX` | `1600` | Long edge, in pixels, of generated display copies |
| `QUALITY` | `85` | JPEG/WebP quality for display copies |
| `DHASH_THRESHOLD` | `4` | Hamming distance at/below which two frames in one folder are flagged near-duplicate (advisory - off by default in the UI) |
| `ROTATION_PATTERNS` | `360,turnaround` | Comma-separated folder-name substrings marking a rotation set |

## Volumes

Two, deliberately kept separate:

- `/references` - your images. Mount **read-only**; refboard never writes here.
- `/data` - the generated index, features, and display copies. Use a named
  volume so it survives image updates - the first full feature pass over a
  large library can take a while, and there's no reason to pay that cost
  again just because the image was upgraded.

## Features

- **Timed sessions** - presets or a custom interval, endless or a structured
  warm-up/quick/long-study schedule.
- **Tone filtering** - high-contrast / low-key / high-key, computed from the
  actual measured distribution of your own library rather than fixed
  thresholds.
- **Near-duplicate skipping** - off by default and shown as an exact count
  before you opt in, since the underlying hash can't always tell "same pose,
  different angle" from "different pose that happens to look similar."
- **Tonal value / Notan study** - posterize the reference to 2-6 flat tones,
  live, from a HUD dropdown mid-session or a chip on the setup screen; shows
  the original and posterized copies side by side.
- **Check your own image** - a drag-and-drop tool, entirely client-side and
  independent of your library, for checking any image's value structure.
- Grid overlay, grayscale, random mirroring, session history/log, keyboard
  shortcuts, installable as a home-screen app, and a screen wake lock so a
  tablet propped up next to your paper doesn't sleep mid-pose.

## Architecture

One container, one process. An ASP.NET Core app serves the static frontend
and the generated JSON/images, and a background hosted service does what a
cron job would do outside a container: walk the mounted folder, decode new or
changed images, write the manifest. No nginx, no separate cron daemon, no
database - state that needs to persist is a couple of JSON files and a folder
of resized copies, and everything else is `localStorage` in the browser.

```
src/Refboard/
  Program.cs              - HTTP setup: static files, health check, reindex trigger
  RefboardOptions.cs       - environment-variable configuration
  Services/
    IndexBuilder.cs        - the cheap directory walk
    FeatureBuilder.cs      - the expensive per-image pass (ImageSharp)
    ReindexHostedService.cs - the background loop tying the two together
  wwwroot/
    index.html             - the entire frontend: one file, no build step, no JS framework
```

### A note on ImageSharp's license

The feature-building pass uses [SixLabors.ImageSharp](https://sixlabors.com/)
for image decoding, resizing, and encoding, pinned to **2.1.x** on purpose.
Starting with 3.0, ImageSharp ships under the Six Labors Split License -
free for open-source/personal/small-business use, but it requires obtaining
and embedding a license key (even the free one), which isn't something to
bake into a public repo's build. 2.1.x is the last major version under the
plain Apache 2.0 license: no key, no build-time license check, nothing to
configure. The cost is one optimization - see the comment on
`FeatureBuilder.MeasureAsync` - not a feature gap; everything the board uses
(resize, JPEG/WebP encode, the perceptual hash, tone stats) works the same.
If you want 3.x's decode-time downscaling and are fine with its license
terms, that's a deliberate version bump for you to make, not a default.

## Building from source

Requires the .NET 10 SDK.

```bash
cd src/Refboard
dotnet build
SOURCE_DIR=/path/to/images DATA_DIR=/tmp/refboard-data dotnet run
```

Or build the container image directly:

```bash
docker build -t refboard .
```

## What this isn't

There's no user accounts, no server-side session, no telemetry, and no
network calls out. Everything about a session is `localStorage` in whatever
browser opened the page - open it from a different device and it starts
fresh, on purpose, for a tool this small.

## License

[MIT](LICENSE) for this project's own code. See the note above on
ImageSharp's separate license for the dependency it uses.
