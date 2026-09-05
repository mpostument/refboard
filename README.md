# Refboard

A timed gesture-drawing reference board you run yourself. Point it at a folder
of images, mount it into a container, and get a distraction-free timed-pose
viewer with tone-based filtering, near-duplicate detection, a tonal-value
(posterize/Notan) study view, and a standalone drop-zone for checking any
image's value structure - all served from one small container with no
external dependencies at runtime.

This started as a role in a private homelab Ansible repo and was extracted
here to stand on its own.

**[Try it live](https://mpostument.github.io/refboard/)** - no install, no
account, nothing uploaded anywhere. That page has no image library behind it
(GitHub Pages is static hosting; there's nothing to run a background indexer),
so it runs entirely off the drop-zone: drop one image to check its tonal
value, or several to run a real timed session against them. Run it behind a
container (below) for the full thing - your own library, tone filtering,
near-duplicate detection.

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
immediately instead of waiting for the next tick - either from the setup
screen's **Rescan library** button (shown whenever the app has a working
index), or directly:

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
| `THUMB_PX` | `400` | Long edge, in pixels, of the grid thumbnails the library browser draws |
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

- **Browse your library** - the app is three columns: your packs and their
  folders on the left, whatever you are looking at in the middle, the session
  controls on the right. Clicking a folder's *name* opens it as a thumbnail
  grid; clicking its *checkbox* includes it in the pool a timed session draws
  from - browsing a pack to decide whether you want it is how you end up
  ticking it, so the two are separate. **All** / **None** above the list tick
  or clear everything the pack filter is currently showing.

  In the grid, the search box matches file, folder and pack names, and the box
  beside it sets the order: the folder's own (numbered poses are usually
  numbered for a reason), by name across folders, lightest or darkest first to
  pull a value study out of a pack, or shuffled - picking **Shuffle** again
  deals a new order. Any thumbnail opens full-screen in the same viewer a
  session uses (zoom, angle tool, construction guides, tonal-value split,
  eyedropper - with `← →` walking that folder in order and no clock running);
  `Esc` returns to the grid on the image you stopped at. **Draw these** starts
  a real timed session from exactly what is on screen, search filter included.
  **Skip** in a thumbnail's corner marks a pose never to draw again; skipped
  images stay in the grid, dimmed, so it can be undone.

  The grid takes the keyboard too: arrow keys move between thumbnails, `Home`
  and `End` jump to the first and last, `Enter` opens one and `S` skips it.

  Thumbnails are generated by the same background pass that makes the display
  copies (`THUMB_PX`, default 400px). A library indexed before this existed
  gets them backfilled from the existing display copies on the next pass -
  no full re-measure - and one that has never had a features pass at all
  still browses, just off the larger copies.
- **Timed sessions** - presets or a custom interval, **No timer** for a pose
  that changes only when you press Next, endless or a structured
  warm-up/quick/long-study schedule, or build and save your own under
  Custom: any number of steps, each its own seconds-per-pose and pose count.
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
  independent of your library. Drop one image to view it full-screen with
  the tonal-value split, zoom and the angle tool, paused with no timer
  running; drop several and run a real timed session against them - no
  library required, this is the whole of what runs on the
  [live demo](https://mpostument.github.io/refboard/), and it works the
  same way behind a container as a bonus way to throw a handful of extra
  references into an otherwise library-backed session.
- **Zoom and pan** - scroll, drag, or the HUD +/- to zoom into a detail (a
  hand, a face) without leaving the timed session; resets on every new pose.
- **Angle tool** - drag anywhere on the reference to read the angle between
  two points, the on-screen equivalent of holding a pencil up to measure a
  shoulder or hip line before committing to it on paper. The first drag also
  sets a reference length - every drag after it reads its own angle *and* its
  length as a ratio of that reference (a head height, a hand span). A few
  comparison lines stay on screen at once (oldest drops off past that), so
  you can measure a shoulder line and a hip line and read both together
  instead of one at a time - clear them, or turn the tool off and back on,
  to start a fresh reference. **High-contrast overlays** (an Options
  checkbox, or `h`) swaps the colour/opacity normally used to tell lines
  apart for a black-outlined white line with its own dash pattern per line -
  the grid overlay gets the same outline - for bright light or low contrast
  sensitivity.
- **Construction guides** (`c` cycles) - a vanishing point (drag to drop it,
  fanning guide lines out across the whole stage - perspective construction
  on a box, a room, a foreshortened limb), a plumb line (a full
  vertical+horizontal crosshair through a point, for checking whether one
  landmark sits directly over another), or a proportion divider (drag out
  one unit the way the angle tool's reference length works, and it marks off
  repeating multiples of it automatically - "how many head-heights tall,"
  measured instead of eyeballed). One at a time, mutually exclusive with the
  angle tool and eyedropper.
- **Ghost previous pose** and **focal-point marker** - two Options checkboxes:
  a faint edge-detected silhouette of whatever pose was on screen just
  before this one, to help track how a gesture or form carries from pose to
  pose; and a marker at this pose's own visual-weight centroid, from its
  actual brightness distribution - a rough guide to where the eye lands
  first.
- **Squint** (`q`) - blurs the plain original directly, the fastest version
  of the classic "unfocus your eyes" technique to check big shapes and
  values, without going into the full tonal-value split view for it.
- **Selectable grid styles** - rule of thirds, golden ratio, diagonals, or
  just a center cross, under the same Grid overlay checkbox. The grid is
  fitted to the reference's own rendered box rather than the pane around it,
  so its lines land on the image's real thirds whatever its aspect ratio -
  and the tonal-value split draws one per pane, since a single grid stretched
  across two images side by side divides neither of them.
- **Understand the pose, not just look at it** - a collapsible drawer next to
  the HUD (`Info`, or `i`) keeps three things current on every pose:
  - **Colour scheme for the tonal-value view** - grayscale, three duotones
    (Van Dyke brown, Payne's grey, sepia/burnt umber-style), a false-colour
    heatmap, and an edge-detection mode, all the same posterize machinery
    under a different gradient - plus a **blur** step you can dial in before
    posterizing, so tone blocks in as soft masses instead of hard-edged
    islands around every small bit of local contrast.
  - **A live legend** showing exactly what each tone level maps to in the
    current scheme, a brightness histogram, and the pose's top-5 dominant
    colours - read at a glance instead of guessed.
  - **Eyedropper** (`e`) - click anywhere on the reference to read the exact
    hex colour and brightness percent under the cursor, plus a rough
    paint-mixing starting point (which two of Yellow/Blue/Magenta, roughly
    what ratio, and how much to dilute for the value) - useful for
    watercolour, not a precise pigment match, since real paint mixes by
    absorption across the whole spectrum, not a screen's three colour
    channels. The last few samples stay listed as swatches to click-to-copy,
    for comparing two spots (skin vs. background) without re-aiming at
    either one again.
- **Pack filter** - a text box above the library tree narrows it by name for a
  large library, without changing which packs are already ticked. The All /
  None buttons act on exactly what it is showing, so "all the hands packs"
  is one click after typing `hands`.
- **Practice log** - the dashboard counts poses, time, sessions and the run of
  consecutive days you are currently on (a day you have not started yet does
  not break it), over a thirteen-week calendar of one square per day, brighter
  for a heavier day and scaled against your own busiest one rather than a
  fixed number. Below it, your last eight sessions with the packs, interval
  and length of each. Only timed sessions count - browsing the grid is looking,
  not drawing, and is never logged. The most recent 50 are kept.
- Grid overlay, grayscale, random mirroring, keyboard shortcuts, installable
  as a home-screen app, and a screen wake lock so a tablet propped up next to
  your paper doesn't sleep mid-pose.
- **In-app help** - a `? Help` button on the setup screen, a matching `?` in
  the HUD, or the `?` key from either, opens a card explaining every feature
  above and how to use it, without leaving the page.

## Architecture

One container, one process. An ASP.NET Core app serves the static frontend
and the generated JSON/images, and a background hosted service does what a
cron job would do outside a container: walk the mounted folder, decode new or
changed images, write the manifest. No nginx, no separate cron daemon, no
database - state that needs to persist is a couple of JSON files and a folder
of resized copies, and everything else is `localStorage` in the browser.

The frontend (`wwwroot/index.html`) itself doesn't assume a backend exists at
all - `boot()` falls back to a "no library" mode (see its own comment) when
`index.json` isn't there, which is what makes the same file work as a GitHub
Pages demo with nothing behind it at all.

```
src/Refboard/
  Program.cs              - HTTP setup: static files, health check, reindex trigger
  RefboardOptions.cs       - environment-variable configuration
  Services/
    IndexBuilder.cs        - the cheap directory walk
    FeatureBuilder.cs      - the expensive per-image pass (Magick.NET)
    ReindexHostedService.cs - the background loop tying the two together
  wwwroot/
    index.html             - the entire frontend: one file, no build step, no JS framework
docs/
  index.html               - GitHub Pages source (Settings > Pages > main /docs).
                              A manual copy of wwwroot/index.html, not a symlink or
                              a build step - keep them identical by hand when either
                              changes. (icon-refboard.svg and refboard.webmanifest
                              are copied alongside it for the same reason.)
```

### On the imaging library

The feature-building pass uses [Magick.NET](https://github.com/dlemstra/Magick.NET)
(the .NET wrapper around ImageMagick) for image decoding, resizing, and
encoding - Apache 2.0, no license key, no revenue threshold. This project
started on SixLabors.ImageSharp 2.1.x instead, for the same license reasons,
but that version is now over a year old with no sign of another 2.x release
(ImageSharp's own development has moved on to 3.x, which requires a Six
Labors commercial/OSS license key to build - see the note in an earlier
version of this README, or the git history, for why that wasn't used here).
Building new image-processing code against an unmaintained major version
isn't a great trade just to dodge a license file, so this switched to
Magick.NET instead: still fully permissive, and actively maintained.

Bonus: Magick.NET's read-time size hint (`MagickReadSettings.Width/Height`)
gets back the decode-time downscale optimization ImageSharp 2.x couldn't do -
see the comment on `FeatureBuilder.Measure`.

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

## Releasing

Images are tagged by version, not by commit SHA. `main` always gets
`:latest`; a real version comes from an annotated git tag:

```bash
git tag v1.2.3
git push --tags
```

That single tag produces three image tags - `1.2.3`, `1.2`, and `1` - so you
can pin to whichever precision you want. Nothing is pushed for an ordinary
commit to main beyond `:latest`.

## What this isn't

There's no user accounts, no server-side session, no telemetry, and no
network calls out. Everything about a session is `localStorage` in whatever
browser opened the page - open it from a different device and it starts
fresh, on purpose, for a tool this small.

## License

[MIT](LICENSE) for this project's own code. See the note above on the
imaging library's own (also permissive) license.
