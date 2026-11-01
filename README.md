# Refboard

A reference board you run yourself, with three jobs:

- **References** - point it at a folder of images and browse them, or draw from them in timed sessions with the tools that
  help you look: tonal-value split, grayscale, squint, grid and construction guides, an angle tool, an eyedropper that says how
  to mix what it reads, pencil grades, and a way to lay a photo of your drawing over the reference. Museums (the Met and the
  Rijksmuseum) are searchable too.
- **Generate** - references made to order by your own [ComfyUI](https://github.com/comfyanonymous/ComfyUI): a character, a
  landscape, buildings, nature or an animal, in the light, setting and medium you pick.
- **Colours** - palettes in harmony and spread over the values, each colour with how to mix it from your own paints; a
  Colour studio (a picture's palette, a colour wheel, a mixing chart, a pigment guide).

A small extra, **3D forms**, lets you practise light on simple solids. All of it is served from one small container with
no external dependencies at runtime.

**[Try it live](https://mpostument.github.io/refboard/)** - no install, no account, nothing uploaded anywhere. That page has no
image library behind it (GitHub Pages is static hosting), so it comes with a small **sample pack** - six anime girls in
watercolour - and a drop-zone: drop one image to view it, or several to run a real timed session against them. Run it behind a
container (below) for the full thing - your own library, tone filtering, near-duplicate detection, Generate.


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
  pictures and videos, photos of your drawings, and the pictures you generate
  (`/data/uploads`, each file named by the SHA-256 of its contents, so the
  same one uploaded twice is stored once), and the small JSON documents about
  them (`/data/.items`). Uploaded pictures join the library as an **Uploads**
  pack, **sorted into folders** by subject - `/data/uploads/Figure`,
  `Portrait`, `Landscape`, `Animals`, `City`, `Plants`, `Still life`,
  `Illustration`, `My work`, `Other` - each a group of the pack, and tagged
  ; what is not sorted yet waits in the folder itself, as *Unsorted*. Back the volume up - or use *Your data* in the
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
| `GET /api/generate` | Whether references can be generated: `{ available, checkpoint, quality, negative, control }` (`control`: a ControlNet is set up and in ComfyUI; the tags it always adds, shown in the page's Prompt), or `{ available: false, reason }` - no `COMFY_URL`, ComfyUI not answering, or the model not in it. |
| `POST /api/generate` | `{ prompt, avoid, tags, shape, seed, image, denoise, control, strength }` - `image` (optional): a PNG as base64, already the size of `shape`; with `denoise` (0.2-1) the picture is started from (img2img), with `control: true` it is the figure the picture is held to, at `strength`. Otherwise: Danbooru tags, and more to keep out (the server adds the quality tags and its own negative prompt, nsfw always in it), the words to file it under, `portrait`/`square`/`landscape`, and a seed or none. Returns `202 { id }`: a picture can take longer than a proxy lets a request run. |
| `GET /api/generate/{id}` | That job: `{ state, upload, error }` - state `running`, `done` or `error`. Done, the picture is kept like an upload, in the `generated` folder with its tags. |
| `GET /api/items` | The kinds of document stored. |
| `GET /api/items/{kind}` | Every document of a kind, as `{ id: document }`. |
| `GET` / `PUT` / `DELETE /api/items/{kind}/{id}` | One JSON document. Kind and id: lower-case letters, digits, `-` and `_`. |
| `GET /api/scene` | Markdown documentation of the scene API below - the one to hand to Claude or a script. |
| `PUT /api/scene` | `{ "mode": "replace" or "patch", "scene": {...} }` - a 3D forms scene, queued; the page applies it while the 3D forms view is open. |
| `GET /api/scene/schema`, `/current`, `/result` | Written by the page: every name a scene may use, the scene as it is now, and what the last `PUT` changed (`dropped`). 404 until the 3D forms have been opened once. |


## What is in it

- **Library** - packs and folders as a grid, with search, ordering (the folder's own, by name, lightest or darkest first,
  shuffled), tone filtering and near-duplicate detection computed from your own library, and search by colour. Uploads you drop
  join the library as an Uploads pack, sorted into folders by subject.
- **Timed sessions** - a preset or custom interval, a warm-up/quick/long-study schedule, draw from memory, build up in stages;
  options for grayscale, random mirroring, a grid (thirds, golden ratio, diagonals, armatures), a ghost of the last pose, a focal
  marker, a bell, fullscreen. Keys: space pause, arrows step, F flip, G grayscale, Q squint, V value split, E eyedropper,
  A angle, D compare, I info, S skip, Esc stop.
- **Looking tools** - the value split (2-6 tones, a pure Notan at two), the pencil grades map, the eyedropper with recipes
  worked out the way paint mixes (Kubelka-Munk, via spectral.js) in your medium - watercolour, oil, gouache, ink, pencil, marker -
  from the tubes you own (My materials), and Compare: a photo of your drawing over the reference.
- **Museums** - public-domain pictures from the Met and the Rijksmuseum, with the credit to copy.
- **Generate** - needs `COMFY_URL`. Choices instead of prompts, a sketch pad, line art to trace, details enlarged, a series,
  the best of several, a palette taken from a picture or from the markers and pencils you own, simple forms, history. Without a
  ComfyUI the section stays on the rail and says it is not available, with a Check again button.
- **Colours** - Palettes (generate one, take it from a picture, send it to Generate, with the recipes) and the Colour studio:
  Picture, Wheel, Mixing, Pigments.
- **3D forms** - cube, sphere, cylinder, cone, pyramid, prism, torus, capsule and egg under a key light and a second light, with
  soft shadows, sky occlusion and bounce light, a camera with lens, eye height and fisheye, surfaces from matte to anime cel,
  Memory and View drills, Draw random forms as a session, saved scenes, and a scene API for scripts (see below).
- **Yours to keep** - your settings and uploads in the browser (or on the container's disk), profiles, themes with an editor,
  and a backup of everything as one .zip. Ctrl+K finds any section or tool.


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
                              3D view, the Colour studio, Palettes, Museums and the backup load
                              when first opened: see loadSection() in core.js.
docs/
  index.html               - GitHub Pages source (Settings > Pages > main /docs).
                              A copy of wwwroot/ (index.html, css/, js/, samples/, the icon
                              and manifest), not a symlink or a build step - the
                              Sync GitHub Pages workflow copies it on every push
                              that touches wwwroot/.
```

### On the imaging library

Image decoding, resizing and encoding use [Magick.NET](https://github.com/dlemstra/Magick.NET) (ImageMagick for .NET) - Apache 2.0,
no licence key - with its read-time size hint so a big image is downscaled while it is decoded.

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
fetches three.js from
`cdn.jsdelivr.net`; behind the container, the **sorting of uploads** fetches the MediaPipe runtime
from `cdn.jsdelivr.net` and their models from `storage.googleapis.com`. Nothing is sent there beyond those requests - the
image a model reads stays in the browser - and every other view keeps
working offline. Everything about a session is `localStorage` in whatever
browser opened the page - open it from a different device and it starts
fresh, on purpose, for a tool this small.

## License

[MIT](LICENSE) for this project's own code. See the note above on the
imaging library's own (also permissive) license.
