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
so it comes with a small **sample pack** instead - six anime girls in
watercolour, to browse and draw from - and the drop-zone: drop one image to
check its tonal value, or several to run a real timed session against them. Run it behind a
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
| `DATA_DIR` | `/data` | Where the generated index, features, and display copies live - and what you upload (see Volumes) |
| `PORT` | `8080` | HTTP port the app listens on |
| `INDEX_INTERVAL_SECS` | `600` | How often the cheap directory-walk index rebuilds |
| `FEATURES_INTERVAL_SECS` | `1800` | How often the expensive per-image feature pass rebuilds |
| `FEATURES_BUDGET_SECS` | `0` | Cap on decode time per feature pass; `0` = unlimited |
| `MAX_PX` | `1600` | Long edge, in pixels, of generated display copies |
| `THUMB_PX` | `400` | Long edge, in pixels, of the grid thumbnails the library browser draws |
| `QUALITY` | `85` | JPEG/WebP quality for display copies |
| `DHASH_THRESHOLD` | `4` | Hamming distance at/below which two frames in one folder are flagged near-duplicate (advisory - off by default in the UI) |
| `ROTATION_PATTERNS` | `360,turnaround` | Comma-separated folder-name substrings marking a rotation set |
| `COMFY_URL` | *(empty - off)* | A [ComfyUI](https://github.com/comfyanonymous/ComfyUI) to generate references with, e.g. `http://192.168.1.20:8188` - on a machine with a GPU, started with `--listen` so this container can reach it. Empty: the page does not offer generating. |
| `COMFY_CHECKPOINT` | `animagine-xl-4.0-opt.safetensors` | The SDXL checkpoint in that ComfyUI's `models/checkpoints`. The prompts are Danbooru tags, so an anime model trained on them ([Animagine XL 4.0](https://huggingface.co/cagliostrolab/animagine-xl-4.0) is the one it is tuned for). |

## Volumes

Two, deliberately kept separate:

- `/references` - your images. Mount **read-only**; refboard never writes here.
- `/data` - the generated index, features, and display copies. Use a named
  volume so it survives image updates - the first full feature pass over a
  large library can take a while, and there's no reason to pay that cost
  again just because the image was upgraded.

  It also holds what you give the app, which cannot be regenerated: dropped
  pictures and videos, photos of your drawings, the Colour studio's pictures
  (`/data/uploads`, each file named by the SHA-256 of its contents, so the
  same one uploaded twice is stored once), and the small JSON documents about
  them (`/data/.items`). Uploaded pictures join the library as an **Uploads**
  pack, **sorted into folders** by subject - `/data/uploads/Figure`,
  `Portrait`, `Landscape`, `Animals`, `City`, `Plants`, `Still life`,
  `Illustration`, `My work`, `Other` - each a group of the pack, and tagged
  (see *Sorted uploads* below); what is not sorted yet waits in the folder
  itself, as *Unsorted*. Back the volume up - or use *Your data* in the
  app, which downloads everything, settings included, as one .zip.

### The storage API

What the frontend's `js/store.js` calls; nothing else needs it. Only images
and video are accepted (an HTML or SVG file served from this origin would run
as the page), and nothing under a dot-prefixed path is served as a static file.

| | |
|---|---|
| `POST /api/uploads` | The body is the file, its type in `Content-Type`. Returns `{ id, url, bytes, folder }` - `folder` set if the same file was kept and sorted before. Up to 1 GB. |
| `GET /api/uploads` | Every stored file. |
| `GET /api/uploads/{id}` | One stored file, whichever folder it is in. |
| `PUT /api/uploads/{id}/folder` | `{ "folder": "figure" }` - moves it into one of the fixed folders (keys: `figure`, `portrait`, `animals`, `landscape`, `city`, `plants`, `still-life`, `illustration`, `my-work`, `other`) and wakes the index pass. |
| `DELETE /api/uploads/{id}` | |
| `GET /api/generate` | Whether references can be generated: `{ available, checkpoint }`, or `{ available: false, reason }` - no `COMFY_URL`, ComfyUI not answering, or the model not in it. |
| `POST /api/generate` | `{ prompt, avoid, tags, shape, seed }` - Danbooru tags, and more to keep out (the server adds the quality tags and its own negative prompt, nsfw always in it), the words to file it under, `portrait`/`square`/`landscape`, and a seed or none. Returns `202 { id }`: a picture can take longer than a proxy lets a request run. |
| `GET /api/generate/{id}` | That job: `{ state, upload, error }` - state `running`, `done` or `error`. Done, the picture is kept like an upload, in the `generated` folder with its tags. |
| `GET /api/items` | The kinds of document stored. |
| `GET /api/items/{kind}` | Every document of a kind, as `{ id: document }`. |
| `GET` / `PUT` / `DELETE /api/items/{kind}/{id}` | One JSON document. Kind and id: lower-case letters, digits, `-` and `_`. |

## Features

- **Generate references** - with a [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
  on a machine with a GPU (`COMFY_URL`): anime references made to order - a
  character (who, the hair, how much of them, from where, the pose), a
  landscape (where, the time of day, the weather, the season), buildings,
  nature or an animal, in the light and medium you pick (watercolour, ink
  and hatching, flat colour, pencil and hatching) - simple by default, a few
  big shapes to copy rather than a finished illustration - kept in the
  Uploads pack's Generated group, tagged with those choices, and opened with
  every tool.
- **A studio layout** - dark throughout, an icon rail down the left for the
  sections, and the library and session controls as panels either side that
  fold away, so the image gets the screen. The session panel and the 3D
  panel are tabbed, with Start always in reach. The viewer's controls are icons,
  each named on hover.
- **Train** - short scored drills, ten tasks a round, the answer and the
  reason shown after each: **value** (a patch against surrounds built to
  fool you, then in colour), **colour** (mix a target by hue, chroma and
  value, told which was off), **anatomy** (landmarks on an eight-heads
  figure and on the head), **angles and proportions**, **lines and
  ellipses** (one stroke, scored on how far it strays) and **perspective**
  (find a vanishing point, find eye level), then **gesture** (a timed random
  pose on the 3D figure), **negative space** (pick the true empty shape),
  **tone map** (value on real pictures, squinted), **colour temperature**,
  **edges** (hard and soft, contrast set to fool you) and **ellipses and
  centres** (a cylinder's ellipse, the middle of a rectangle in perspective).
  Best and recent scores are kept.
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
- **Compare your drawing** (`d`) - photograph or scan what you drew and lay
  it over the reference: its lines in red (pulled off the paper against a
  blurred copy of the photo, so uneven phone lighting drops out), a
  see-through photo, or blinking between the two. **Line up 2 points** -
  two landmarks on the reference, the same two on the drawing - scales,
  turns and moves it so they meet, leaving only what differs between them:
  your proportions and angles. Drop or paste works too; nothing is uploaded.
- **Pack filter** - a text box above the library tree narrows it by name for a
  large library, without changing which packs are already ticked. The All /
  None buttons act on exactly what it is showing, so "all the hands packs"
  is one click after typing `hands`.
- **3D forms** - simple forms under light you control, for the shading and
  perspective exercises every drawing course starts with.
  - *Forms:* cube, sphere, cylinder, cone, pyramid, prism, torus, capsule and
    egg, up to six on the floor at once casting shadows on each other, or your
    own **.glb / .gltf / .obj** model (a planes-of-the-head bust, a skull)
    loaded in the browser - or a jointed wooden **figure**: pick a joint by its
    dot and bend it with rings, R or sliders, from classic poses (contrapposto,
    walk, kneel...), random ones, or a mirror of the last. Each with its own placement, proportions, rotation,
    colour and surface: matte, satin, glossy, metal, glass or velvet - or
    **Anime**, cel shading: a flat colour, one hard-edged shadow tone of its
    own (pulled toward blue-violet, as anime colours it), a highlight, and the
    second light as a rim.
  - *Posed in the view, Blender-style:* move, rotate and scale handles on the
    selected form (click a form to select it; Z lifts it off the floor), and
    Blender's keys - **G / R / S**, then **X / Y / Z** to
    lock an axis, a typed number, Ctrl to snap, click or Esc to keep or
    cancel - plus Shift+D, Delete, Alt+G/R/S, undo, and Blender's axis ball
    and numpad keys for front, side and top views.
  - *Light, aimed in the view:* click the selected form to light that spot, click the
    floor to throw the shadow there, drag the light handle and a lamp follows
    the pointer, scroll over it (or Shift+scroll) to move it nearer or further -
    from the sun's parallel rays to a close lamp with falloff across the form
    and a shadow that fans out. The lights stay put while you orbit. Plus
    height, strength, colour and softness, presets, a second fill or rim
    light, and separate fill and floor-coloured bounce light.
  - *Seeing it:* a light-and-shadow zones view that paints highlight, light,
    halftone, terminator, core shadow, reflected light and cast shadow onto the
    forms from the actual lighting; 1-, 2- and 3-point camera presets and a
    lens in millimetres (the camera dollies, so only convergence changes);
    vanishing points of the box around a form, cross-section ellipses and their
    axis, cross-contour lines, a floor grid and an eye-level line.
  - *Using it:* **Open in viewer** puts the render in the same full-screen
    viewer as everything else (tonal split, grid, angle tool, eyedropper),
    **Save PNG**, **Draw random forms** starts a timed session of random
    poses and lighting, a **memory drill** hides a scene while you draw it, a
    **view drill** asks for it from another side, height, light or lens and
    then swings round to the answer, **Clean** (Shift+Alt+Z) hides every
    handle and guide,
    and scenes can be saved by name or shared as a link.

  Rendered with [three.js](https://threejs.org/), loaded from jsDelivr only
  when this view is first opened - see *What this isn't* below.
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
- **Uploads kept, and a backup** - everything you give the app (dropped
  pictures and videos, photos of your drawings, the Colour studio's pictures)
  is listed under the drop zone to open again, and every screen that keeps
  something says where: on the container's disk, in this browser (on GitHub
  Pages, with *Keep in this browser* ticked), or not at all. *Your data*
  downloads everything - settings, materials, themes, 3D scenes, practice
  log, trainer scores, uploads - as one .zip, and restores from one.
- **Sorted uploads** - behind the container, each picture you drop is looked
  at in the browser (the pose and face models, and an image classifier),
  tagged - *one person, sitting, three-quarter view, lit from the left, low
  key, warm, seashore* - and moved into a folder by subject. The library's
  search finds them by tag, each word on its own: `sitting lit left`.
- **Anime head on a photo** - the head construction (`l`) in an *Anime* style:
  the ball, side planes and centre line fitted to the head's angle, with the
  face drawn as anime does - eyes lower and bigger, a small nose and mouth, a
  pointed chin. Switched in the note under the picture, or from Ctrl+K.
- **The keyboard, and screen readers** - a visible focus ring, Tab kept inside
  dialogs, arrow keys along the rail, a *Skip to the content* link, and a
  live region that says which section opened and which pose is up.
- **What's new** - after an update, the features that came with it, each with
  a button to try it; shown once, and never over a first visit's tour.
- **In-app help** - a `? Help` button on the setup screen, a matching `?` in
  the HUD, or the `?` key from either, opens a card explaining every feature
  above and how to use it, without leaving the page.

## Architecture

One container, one process. An ASP.NET Core app serves the static frontend
and the generated JSON/images, and a background hosted service does what a
cron job would do outside a container: walk the mounted folder, decode new or
changed images, write the manifest. No nginx, no separate cron daemon, no
database - state that needs to persist is a couple of JSON files, a folder
of resized copies and a folder of what you uploaded (with a JSON document
about each), and everything else is `localStorage` in the browser.

The frontend (`wwwroot/`) itself doesn't assume a backend exists at
all - `boot()` falls back to the sample pack (`wwwroot/samples/`) when
`index.json` isn't there or is empty, and to a "no library" mode (see its own
comment) without that too, which is what makes the same file work as a GitHub
Pages demo with nothing behind it at all. The samples are generated by a local
[ComfyUI](https://github.com/comfyanonymous/ComfyUI) with Animagine XL 4.0:
`node scripts/samples/generate.js` asks it for each (a subject line and a
seed, so the same picture comes back), encodes it as JPEG with the tests'
Playwright and writes `samples/index.json`.

```
src/Refboard/
  Program.cs              - HTTP setup: static files, health check, reindex trigger
  RefboardOptions.cs       - environment-variable configuration
  Services/
    IndexBuilder.cs        - the cheap directory walk
    FeatureBuilder.cs      - the expensive per-image pass (Magick.NET)
    ReindexHostedService.cs - the background loop tying the two together
    UserStore.cs           - what the app is given to keep: uploads and JSON documents
  wwwroot/
    index.html             - the frontend's markup; no build step, no JS framework
    css/app.css            - all of its styles
    samples/               - the sample pack (see above), with its own index.json
    js/*.js                - its code, as plain classic scripts loaded in order
                              (see the note above the <script> tags in index.html:
                              a file may use at load time only what earlier files
                              define). Opens straight from disk too - classic
                              scripts, unlike modules, load over file://. The
                              3D view, the Colour studio and the backup load
                              when first opened: see loadSection() in core.js.
docs/
  index.html               - GitHub Pages source (Settings > Pages > main /docs).
                              A copy of wwwroot/ (index.html, css/, js/, samples/, the icon
                              and manifest), not a symlink or a build step - the
                              Sync GitHub Pages workflow copies it on every push
                              that touches wwwroot/.
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

## Tests

Browser tests for the frontend live in `tests/` (Playwright). They serve
`src/Refboard/wwwroot` as GitHub Pages does - no backend - and fail on any
uncaught error or `console.error`, as well as on their own checks: every
section opens, a dropped image reaches the eyedropper's recipes, the colour
studio finds a palette, the paint engine keeps its rules, every control has
a name a screen reader can say, and a backup restores into an empty browser.
CI runs them on every push. The storage API is checked against the real
container by `scripts/smoke-test.sh`.

```bash
cd tests
npm ci
npx playwright install chromium
npx playwright test
```

After changing anything under `wwwroot/js/` or `wwwroot/css/`, re-stamp
`index.html` - every script and stylesheet it loads carries a hash of its
contents (`js/paint.js?v=1a2b3c4d`), so browsers never mix old and new files
from their cache, and the container can let them cache those for good:

```bash
node scripts/stamp-assets.js
```

CI fails when a stamp is out of date, and so do the tests. A tab left open
across a deploy notices the new stamps when it comes back into view and
offers to reload.

`tests/specs/paint.spec.js` has a `KNOWN_MIXES` table of mixes a painter
knows to be right - add to it when a recipe looks wrong.

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
network calls out - except to fetch code and models the first time a feature
that needs them is used, all pinned to exact versions: the **3D forms** view
fetches three.js and, when a head is picked, a 400 KB head scan from
`cdn.jsdelivr.net`; the **pose skeleton**, the **head construction** and,
behind the container, the **sorting of uploads** fetch the MediaPipe runtime
from `cdn.jsdelivr.net` and their models from `storage.googleapis.com`. Nothing is sent there beyond those requests - the
image a model reads stays in the browser - and every other view keeps
working offline. Everything about a session is `localStorage` in whatever
browser opened the page - open it from a different device and it starts
fresh, on purpose, for a tool this small.

## License

[MIT](LICENSE) for this project's own code. See the note above on the
imaging library's own (also permissive) license.
