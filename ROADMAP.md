# Roadmap

Planned features, not yet built. Almost everything here runs in the
browser, like the rest of the app, so it works on GitHub Pages too; the few
that use the container's backend say so.

**A rule for all of it: every new feature also improves the interface.**
Each one lands in the new interface's structure (see below) rather than as
one more button where there was room, and each is a chance to tidy what is
around it - fewer clicks, clearer labels, the same pattern for the same
kind of control. The interface is never left for a big redesign at the end.

## A new interface

Fifty-odd more features will not fit the present layout, where each tool
lives in the one place it was first built (the pose skeleton and the
eyedropper only in a session, palettes only in the Colour studio). A
clickable mock-up of it - workspace, easel mode, settings - is agreed.

- **One workspace for an image.** Any picture - from a session, the
  library, a museum, a photo of your own work - opens in one place, and
  every tool works on it. The panel is in place in a session (`w`,
  `js/workspace.js`): tabs by the question asked of the picture - Value,
  Colour, Construction, Figure, My work - each row the toolbar's own tool.
  A library image opens there from the grid, a dropped photo opens with
  the panel at Value, and the Colour studio's picture with "Open in
  workspace", at Colour (`openInWorkspace()`). Still to come: the tools
  the tabs are waiting for - the paper's range (Value), temperature (Colour),
  tangents (Construction), eyes and rhythms (Figure), a painting check and
  likeness (My work).
- **Easel mode for a tablet.** Big controls, gestures, one hand, the
  screen kept awake; a left-handed layout.

In place: themes - the four Catppuccin flavours (Mocha by default), Studio
dark and Daylight - with a theme editor that saves, exports and imports
your own (`js/theme.js`, `js/theme-editor.js`); and Find a tool, Ctrl+K,
over every section, trainer, theme and session tool (`js/command.js`);
and layers - every session overlay in one list with on/off and opacity,
"o" to hide them all for a moment (`js/layers.js`). Each new overlay
(the edge map has, colour temperature and a palette highlight will) joins that list;
and pinned tools - the session toolbar holds what you pin, the rest wait
under More with their keys and in Ctrl+K (`js/pins.js`); and My materials
(`js/materials.js`) - see Materials; and navigation by the stage of work -
the rail grouped as Prepare, Practise, Paint and Check, with the same four
as cards on the dashboard, built from the rail's groups (`js/stages.js`).
Each new section joins the stage it is for: the board, simplify, layer plan
and transfer under Prepare; the camera eyedropper under Paint; critique
and the framed view under Check. And hiding what you do not use - "Sections you use" under the
dashboard's cards: a section unticked leaves the rail and its card (a stage
with nothing left goes too), and is still in Ctrl+K. Each new section (oil
paint, manga...) is one more tick there. A tour the first time the app
opens (`js/tour.js`): six notes, each ringing the real control - the rail,
Ctrl+K, the cards, Sections you use, Start drawing and the workspace,
Help - and skipping a section you hid; again from Help or Ctrl+K. And
What's new (`js/whatsnew.js`): after an update, the features that came with
it, the newest four first and the rest folded, each with a button to try
it - keyed by the feature, not the version, since Pages deploys on every
push; never over a first visit's tour; again from the footer, Help or
Ctrl+K. Each new feature adds its entry to `NEWS`. And sheets: the dialogs
beside the rail (the theme editor, My materials, Your data) and What's new
share one look and one behaviour (`.sheet`, `initSheet()`).

## Keeping it fast and working

Browser tests (`tests/`, run in CI) and content-hashed file URLs are in
place. Every new feature adds its own scenario to the tests.

In place: sections that load when first opened - the 3D view, the Colour
studio and the backup wait in `<template id="lazy-...">` in index.html and
come with `loadSection()` (`js/core.js`), starting as the pointer reaches the
rail button; a new section's heavy code goes the same way. And accessibility
(`js/a11y.js`): a focus ring in the theme's accent, Tab kept inside whichever
modal dialog is on top, focus given back when one closes, arrow keys along
the rail, Skip to the content, and a live region that says which section
opened and which pose is up; a test checks that every control on every
screen has a name a screen reader can say.

- **Fast loading, the rest.** The trainers (`train.js`, 1100 lines) still
  load with the page - its colour helpers are shared with the paint engine
  and the Colour studio, and want moving out first.
- **Accessibility, the rest.** The 3D view's canvas and the trainers'
  canvases are pointer-only; each wants a keyboard way to do what a click
  does there.

## Saving what is uploaded

Everything the app is given should be kept: uploaded references and video
frames, photos of your own work, reference boards, swatch photos and the
colours taken from them, the materials profile - and what now lives only in
localStorage (3D scenes, the session log, trainer stats).

In place: one storage layer (`js/store.js`) that asks `/healthz` - the same
answer the footer's version comes from - whether a backend is there. Behind
the container, `POST /api/uploads` stores a file in DataDir named by its
SHA-256 and `/api/items` stores JSON documents (`Services/UserStore.cs`);
uploaded pictures join the library as the Uploads pack on the next index
pass. On GitHub Pages they last until a reload, or, with "Keep in this
browser", are kept in IndexedDB. Dropped pictures and videos, Compare's
photos of your drawing and the Colour studio's pictures are kept, listed
under the drop zone as Your uploads, and the line above them says plainly
where they are kept. And a backup (`js/backup.js`): everything - every
refboard setting in localStorage, every document, every upload - as one
.zip, and restoring from one after saying what is in it.

- **Settings on the server.** 3D scenes, the session log, trainer stats and
  the rest are still in the browser's localStorage, in the backup but not
  on the container's disk: they want to go through `/api/items` too, so a
  second browser at home sees them.

- **Several profiles.** If someone else at home paints too: each with
  their own boards, materials, log and stats, on the one server.
- **Backup to the cloud.** An automatic backup of the archive to Google
  Drive, OneDrive or another drive, so work and boards do not go with the
  computer's disk.

- **Projects.** Everything about one piece in one place: its references,
  board, recipes, layer plan, photos of the stages and the result. Open
  the project and it is all to hand - the unit the saving is organised
  around.
- **Reference report.** Every analysis of one photo - value, palette,
  composition, perspective, recipes - gathered on one page, kept in the
  project to come back to.
- **Source and licence of a reference.** For each image from the web or a
  museum, where it came from and under what licence - so when a piece is
  posted, it is plain whom to credit, and whether it may be used at all.

## At the easel

Hands full of paint: ways to run a session without touching the screen.

- **A phone as a second screen.** In the local version, over the home
  network: the session is run from the computer, and a phone or tablet by
  the paper shows the reference in sync. Needs the backend - not
  possible on GitHub Pages.
- **Voice commands.** "Next", "pause", "flip", "grid" - speech
  recognition in the browser, no server.
- **A remote or a foot pedal.** Bluetooth page-turners and foot pedals to
  change pose and pause.

## Anime

Most of what the app has leans to realism - Loomis, the head scan, real
proportions. Anime has its own rules, and the tools should know them.

In place: a sample pack of six anime girls in watercolour (`wwwroot/samples`,
generated by a local ComfyUI with Animagine XL 4.0 - `scripts/samples/generate.js`),
what the page shows where there is no library - GitHub Pages, an empty
container. Next: more of them - profile heads, whole figures, simpler ones
in flat washes.

In place: generating references on request - Generate references
(`js/generate.js`, `Services/ComfyClient.cs`), with a ComfyUI the container
knows about (`COMFY_URL`): a character, a landscape, buildings, nature or an
animal - one style, anime, for now - the choices as Danbooru tags ("no
humans" for all but a character, or the model draws a girl in), a job the page asks
after, the picture kept in Uploads > Generated with the choices as its tags.
In place too: How to draw it (`js/steps.js`) - any picture taken back to its
steps, per medium, worked out from the picture (an image model asked for an
earlier stage draws a different picture; Paints-Undo, the model trained to
rewind a painting, was weighed and left: 24 GB, and digital painting's
order, not watercolour's or ink's).
In place too: the masking plan, as How to draw it's "Save the whites" step
for watercolour - the near-white areas with colour round them (not the
paper round the subject, not a pale face cut up by its lines), the small
or thin ones for masking fluid, the big ones to paint round.
In place too: the character sheet, the Colour studio's second tab - hair,
skin, eyes, clothes and an accent clicked on a picture, the shadow and the
light worked out the cel-shading way (a value step down and toward violet,
skin toward red), each with a recipe from your paints; kept, and made
again through the ComfyUI as a turnaround in her hair and eye colours.
In place too: the edge map (`js/edges.js`) - over the picture in a session
(`x`, Workspace > Value, a layer), each edge hard or soft by the width of
its change, not its size, with the line art closed out first; a step of How
to draw it in watercolour; and Generate's Edges row, soft or hard, for a
reference to practise either from.
Next: the pose and the light from the 3D figure - its depth or OpenPose
render through a ControlNet - so the reference is the pose you set; a photo
simplified into a study (img2img); variations of one you like (its seed).

Head and face:

In place: the anime head on a photo - Head construction (L, `js/vision.js`)
has two styles, switched in the note under the picture or from Ctrl+K and
kept: Loomis's, and Anime (`ANIME_HEAD`, `animeFace()`), which keeps the
ball, side planes and centre line fitted to the head's angle and draws the
anime face on them - eyes lower and bigger, one eye apart, with the lash
line, iris and gleam; a small nose and mouth; a pointed chin. Still to come
on it: a choice of anime styles (the proportions differ from studio to
studio), and the eye's angle-by-angle detail - see The anime eye.

- **An anime head in 3D.** A stylised head to turn: how flat anime eyes,
  a dot of a nose and the mouth shift and squeeze as it turns - anime
  features do not foreshorten the way real ones do.
- **The anime eye.** The weight of the upper lash line, the iris ellipse,
  where the highlights go, how the eye changes with angle and expression -
  in a few common styles.
- **Expression sheet.** Anime expressions - brows, eyes and mouth for joy,
  anger, surprise, sadness - shown at several head angles.

Body:

- **Anime proportions for the mannequin.** Chibi (2-3 heads), standard
  anime (6-7), stylised long-legged - with a heads-count grid over the
  figure. Beside the body types under From photo to 3D.
- **A photo's pose in anime proportions.** The pose model finds the
  skeleton, and it is redrawn in anime proportions - shorter torso,
  longer legs, larger head: a real pose, seen as it would be in anime.

Shading and colour:

In place: cel shading in 3D - the Anime finish under Surface
(`FORM_FINISHES.anime`, `celTones()` in `js/forms-models.js`, the cel block
in `injectFormGuides()`): a flat base in the key light's colour, one
hard-edged shadow tone of its own colour (`celShadow()`), a highlight sized
by the Shine slider, renamed Highlight meanwhile, and the Second light as a
rim. Cast shadows go hard while any form is Anime. Still to come on it: an
ink outline (the inverted hull), a second, darker shadow tone for occlusion.

- **A photo as anime colouring.** Each area of the photo reduced to a base
  colour, a shadow and a highlight, as anime is coloured - with the shadow
  colour shifted toward purple or blue the way anime usually does.
- **Hair in clumps.** Hair as volumes and strands on the head: the flow,
  where the cel shadow lies, where the highlight goes (the anime ring).

Line and background:

- **Line for anime.** A heavier outer contour, lighter inner lines,
  tapered ends, thicker at overlaps and in shadow - the line weight item,
  for anime line art.
- **Anime backgrounds.** Ghibli's backgrounds are largely painted in
  gouache and watercolour - a direct line to watercolour. Sky and
  landscape palettes in the manner of Ghibli or Makoto Shinkai, with
  recipes for your materials.
- **Studying anime frames.** Frames from a video (the app already takes
  them), analysed: the cel shadow scheme, a character's palette, a
  scene's colour script - learning from favourite work.

Anime in watercolour:

- **Lightbox for transfer.** A tablet as a lightbox: a photo of your
  sketch on copy paper shown at full brightness, cleaned of the paper,
  mirrored if wanted - to trace it onto watercolour paper. The usual
  anime-in-watercolour workflow: sketch apart, final on good paper.

Clothes, movement, settings:

- **Pleated skirt and school uniform.** 3D simulation of pleats and a
  sailor collar, how they behave in motion and foreshortening - pleats in
  perspective being one of the hardest things in anime.
- **Anime camera angles.** 3D camera presets: from below, a wide lens with
  strong perspective, fisheye, from above - the dynamic shots of anime.
  The 3D view already has the focal length; these are the presets.
- **Pose library for the mannequin.** Dynamic poses ready - running,
  jumping, striking, falling, anime sitting - from any angle, not only
  from photos.
- **Simplified hands.** The anime construction of a hand (a mitten with
  fingers) on the existing 3D hand: drawing it in a few shapes rather than
  joint by joint.
- **Japanese settings in 3D.** A classroom, a train carriage, a street
  with power poles, a shrine gate - simple volumes for the backgrounds
  anime keeps returning to.
- **Manga page layout.** Panel templates for a page, right-to-left
  reading order, where speech balloons go - for pages and comics, not
  only single illustrations.

- **Your own anime character in 3D (VRoid / VRM).** VRoid Studio (free)
  builds anime characters and saves them as `.vrm`, a kind of glTF that
  three.js already reads, with a ready library (three-vrm). Load your own
  character, pose it, see it from any angle, in its own anime shading (the
  MToon shader) - likely the strongest single feature here for an anime
  artist.
- **A photo's pose on your character.** With the pose-from-a-photo item:
  the pose model finds the skeleton, and your VRM character takes the
  same pose.
- **Light and weather effects.** Glow, light rays, sparkles, rain, snow, a
  wet street reflecting neon in the manner of Shinkai - how to paint each,
  in watercolour too: where to leave the paper, where the soft edges go,
  in what order the layers.

## Library

In place: uploads sorted and tagged (`js/sort.js`) - behind the container,
each picture kept is looked at in the browser by the pose and face models
and an ImageNet classifier (EfficientNet-Lite0, on the CPU), tagged (one
person, sitting, three-quarter view, lit from the left, low key, warm,
seashore...) and moved by the server into a folder from its own list
(`UserStore.Folders`: Figure, Portrait, Animals, Landscape, City, Plants,
Still life, Illustration, My work, Other). The folders are the Uploads
pack's groups; the tags go into index.json and the library's search matches
them word by word. What was not sorted - older uploads, a failed try - is
queued again when the app opens. Still to come: the same for the mounted
packs (below), and moving a picture to another folder by hand.

- **Auto tags.** The pose and face models run over the whole library and
  tag every image: standing, sitting or lying, the head's angle, where the
  light comes from, how many people - so the pool can be filtered ("seated
  poses lit from the side"). A job for the backend: the container can work
  the tags out ahead of time, the way it already works out tone features.
- **Reference quality check.** A warning on a poor reference: flat flash
  light, blown highlights, a wide-angle lens distorting a portrait (a
  selfie's big nose and small ears - the face model can see it).

- **Search by colour.** Find references with a given palette - "warm
  dusk", "green with a red accent" - or close in colour to a chosen one.
- **Duplicate finder.** The backend finds identical and near-identical
  images (the same photo at different sizes) and offers to drop the
  extras.

## Watercolour

- **Layer plan.** From a reference, the order a watercolour is painted in,
  light to dark: what to leave as bare paper (or mask), the first light
  wash, the mid-tones, the last darks - each step as its own picture with
  its mixing recipe (paint.js). A watercolour counterpart to the session's
  build-up stages.
- **Mixing chart.** A printable grid of the palette's pigments mixed in
  pairs, at a few dilutions. Paint it with real paint, photograph it, and
  the photo calibrates the pigments' colours in PIGMENTS - so the recipes
  become accurate for the painter's own tubes and paper.
- **Glazing.** What a transparent wash of one colour over a dry wash of
  another gives - not the same as mixing the two on the palette
  (ultramarine glazed over burnt sienna is a different grey from the two
  mixed). The Beer-Lambert wash model in paint.js already covers it: the
  layers' absorbances add over the paper.
- **Pigment guide.** For each pigment: transparency, staining, granulation,
  lightfastness. Recipes carry the notes that matter ("granulates - for
  skin, ochre + alizarin is smoother").
- **Camera eyedropper.** Point a phone at the real scene - plein air - and
  read the colour under the crosshair with its watercolour recipe, live.
  The mixing is already there (paint.js); this adds the camera's video.
- **What the paper can do.** The photo squeezed into the value range
  watercolour has - the darkest mix to the white of the paper - showing
  where detail in the lights and darks is lost and has to be simplified.
- **Shadow colour from the light's colour.** Set the light (warm sun, cool
  sky) and get the shadow's colour and its recipe - warm light, cool
  shadow, and the other way round.

- **Vignette.** A watercolour study often fades out before the edge of
  the paper: suggest the vignette's shape - where the picture should end
  and dissolve so the focus stays inside.
- **Layer drying timer.** For wet-in-wet, cues through the stages: shine,
  sheen gone, damp, dry - when the next layer can go on. Tuned to the
  paper and the room's humidity.

- **Weather for watercolour.** Humidity and temperature for the plein air
  spot from Open-Meteo (free, no key). They set how fast watercolour
  dries, so the layer drying timer tunes itself.

- **Preview as watercolour.** The photo rendered as a watercolour: flat
  washes, soft edges, granulation, white paper - how the reference could
  look painted, before the first stroke. The ink one is under Materials.
- **Grey ladder from your palette.** Warm and cool greys mixed from your
  own paints, light to dark, with recipes - greys are the most-mixed
  colours, and muddy ones come from mixing them at random.

## Materials

The medium becomes a setting for the whole app, not only the eyedropper's
watercolour / oil switch: each medium gets lighter and darker in its own
way, so its advice is different. The painter's materials go in a profile
("My materials") that every tool reads.

In place: the My materials profile - what you have, what you are using
now - with each medium's tone ladder (a wash, a layer of hatching, a
pencil grade), read by the value split's legend and the eyedropper. Every
item below reads the same profile.

Ink (bottle ink, liners, ballpoint pen):

- **Ink wash jars.** For bottle ink: the photo's values reduced to 3-5
  dilutions ("jar 1: a drop in ten of water"), and which jar goes where.
  The watercolour wash model (paint.js) with a single pigment.
- **Hatching map.** How many layers of hatching each area wants - one,
  crossed, three, four - with a preview of the picture done in strokes.
  For liners and ballpoint, which build value only by line.
- **Pen sizes and ballpoint pressure.** For liners, which size where
  (0.05 to 0.8) - the line weight item, for pens. For ballpoint, a map of
  pressure and layers: it builds soft gradations like a pencil but cannot
  be erased, so it also marks where the paper must stay white.

Watercolour pencils and watercolour markers - two states each: dry, the
layers mix optically with the paper's tooth showing through; wetted, the
pigment dissolves and it is watercolour, so the wash model applies:

- **My pencil set.** Colour charts of common watercolour pencil sets
  (Faber-Castell Albrecht Dürer, Derwent Inktense and Watercolour,
  Caran d'Ache Supracolor...). Pencils cannot be mixed freely like paint,
  so without knowing the set a recipe is useless.
- **Layer recipes.** For a colour: the order of layers, the pressure, and
  whether to wet it - "183 light -> 187 over it -> go over with a damp
  brush". Order matters.
- **My marker set.** Watercolour brush markers with their codes (Tombow
  Dual Brush, Karin, ZIG Clean Color...): the nearest marker to a colour,
  and a pair to blend it from; also "pick up from the marker onto the
  palette and dilute".
- **Blending groups.** Runs of markers in a set that blend smoothly into
  one another, suggested for a gradient in the photo, and how the set's
  codes are organised.
- **Grey markers for value studies.** The photo split into areas for the
  set's greys (Tombow N15-N95, say), with the marker number on each - the
  simplest first step with markers.

Any medium:

- **Line and wash.** The urban sketcher's liner-plus-watercolour: the
  main contours pulled from the photo as a plan for the line drawing, and
  the wash plan over it - what to say with line, what to leave to colour.
- **Line art preview.** The photo shown as a line drawing, as hatching or
  as stippling - to plan a piece in liner, ballpoint or ink.
- **Texture library for pen.** How to say wood, stone, foliage, fur,
  water, brick in strokes - examples and practice sheets.
- **Presets by medium.** "Liner sketch, 5 min", "watercolour study,
  45 min with stages", "pencil value study, 20 min" - each with its timer,
  its overlays and its advice.
- **Toned paper.** For grey, tan or black paper: where to leave the paper,
  where the white pencil or gel pen goes, where the darks go.
- **Pencil grade map.** For graphite: over the photo, which grade each
  area wants, 2H to 8B, from its value.
- **Calibration from a swatch photo.** Swatch your own pencils or markers
  on your own paper, dry and wetted, photograph it, and the app takes the
  colours from your materials - the published charts are approximate. The
  Mixing chart item, for every medium.

## Colour

- **Master palettes.** Ready palettes taken from known paintings and
  watercolours (Sargent, Sorolla, Turner, Zorn), to lay over a reference
  with In gamut.
- **Seasons and times of day.** Ready palettes for landscape - spring,
  summer, autumn, winter, morning, noon, dusk, fog - with recipes for
  your materials.
- **Skin tones.** Palettes of skin across complexions and light (sun,
  shade, evening, lamplight), with watercolour recipes for the light,
  half-tone, shadow and reflected light.
- **Temperature map.** Over the reference: which areas are warm, which are
  cool, and where the temperature turns between light and shadow.

- **The best limited palette for a reference.** Choose "3 paints" or
  "5 markers": from your own materials, the ones that cover the most of
  the picture's colours - a limited palette makes a study hold together.
- **What to buy next.** From your reference library and your materials:
  the one pigment, pencil or marker that would widen your reach the most
  ("85% of your references are landscapes and greens are short - add
  phthalo green").
- **Colour script from a video.** A strip of a film's or clip's dominant
  colours over time, the way animation studios plan colour. The app can
  already take frames from a video.

- **Eyedropper for any window.** The browser (Chrome, Edge - the
  EyeDropper API) can take a colour from anywhere on the screen, even
  another app - a painting open in a viewer - and give the same recipe
  for your materials.

## Checking your own work

- **Painting check.** Photograph the painting, line it up over the
  reference (as Compare your drawing does), and see a map of where it
  differs in value and colour: darker here, greyer there, warmer here.
  Compare checks a drawing's lines; this checks a painting's tones and
  colours.
- **Framed.** A photo of the work in a mat and frame on a wall, with the
  format and mat colour to choose - to decide how to crop and present it.

- **Symmetry check.** A photo of your drawing (a face, a vase, a
  building) mirrored over itself - where the two halves part.
- **Digitise your work.** A phone photo of a sketchbook page turned into a
  clean scan: perspective straightened, the shadow and the paper's tint
  taken out, white balance corrected. Kept in the local version's archive
  next to its reference.

- **Portfolio site from the archive.** One click turns your digitised
  work into a simple static gallery site, to publish on GitHub Pages like
  refboard itself.

- **Sketch layer.** Draw with a stylus straight over the reference - a
  quick study, marking proportions or lines of action - kept in the
  project.

## Reading a photo

- **Depth planes.** A depth model running in the browser (Depth Anything,
  via transformers.js) splits the photo into foreground, middle ground and
  distance - to plan each plane's value and colour for aerial perspective.
- **Subject silhouette.** The subject cut from its background
  automatically, to study silhouette and negative space on your own
  photos, not only in the trainer.
- **Expressions.** The face model already reads expressions (blendshapes):
  name the muscles at work over the photo - a smile is zygomaticus major,
  a frown corrugator.
- **Eye and gaze construction.** The face model finds the iris: lay the
  eyeball as a ball, the iris as its ellipse and the direction of the gaze
  over the photo - the Loomis head's next step.
- **A hand from a photo onto the 3D hand.** The hand model finds the
  joints; pose the mannequin hand to match, then turn and relight it.

- **Stroke direction.** Over the photo, a field of directions along the
  form (hair, folds, muscle) - to hatch with pencil or liner round the
  form rather than across it.
- **Motion arcs from a video.** The pose model run over a video's frames,
  drawing the arcs traced by the hands, feet and head - how a movement
  makes a line, for dynamic gesture studies.

- **Cast shadow construction.** Place the light source and an object on
  the photo, and the shadow is built by the rules of perspective - for
  still life and street scenes, where shadows by eye often go wrong.
- **Checking a combined reference.** When the figure comes from one photo
  and the background from another, check that the horizons and the light
  directions agree - and see at once when the scene will not hold
  together.

## Likeness and figure checks

- **Portrait likeness.** The face model reads both the photo and your
  drawing of it, and names the differences in numbers: "eyes 8% too far
  apart, nose 5% long, chin narrow".
- **Figure proportions and angles.** The same with the pose model: the
  angles of arms, legs and torso in the drawing against the photo - where
  the shoulder tilt or a leg's length went off.
- **Reilly rhythms.** Frank Reilly's rhythm lines, crossing from one side
  of a form to the other, laid over a figure photo from its pose points.
- **Foreshortening.** A 3D figure with an arm or leg pointing at the
  viewer; draw it as a chain of boxes and cylinders, then see the
  construction.

## Learning

- **Interactive handbook.** Short lessons with live demonstrations on the
  models already in the app: light on form (3D with sliders), aerial
  perspective, mixing (recipes), value against colour - theory and
  practice in one place.

- **Free learning resources.** For each topic, links to good free lessons
  (Proko, drawabox and others): the app gives the practice, they give the
  explanation.

## AI critique

- **AI critique** - *idea, needs working out.* A photo of the finished
  work and its reference, read by Claude, answering in points (proportion,
  value, edges, colour, composition) with three things to fix next time.
  The app measures first, locally (likeness, angles, value and colour
  difference, palette reach), and the model explains those numbers rather
  than guessing them - language models see the whole well but measure
  poorly. The first feature that would send an image out of the browser,
  so only on an explicit button, with a warning. Open questions:
  - *How it reaches Claude.* Three routes, not yet chosen:
    1. **Prompt for claude.ai** - the app prepares the text (instructions
       and its measurements) and the two images to paste into a claude.ai
       chat. Covered by a claude.ai subscription, no key, works on Pages;
       a few manual steps. The likely first step.
    2. **API key** - one button. The key either in the container's
       environment behind a `/api/critique` endpoint (never seen by the
       browser, but container-only), or the user's own key in the browser
       calling the API directly (works on Pages; fine for one person, not
       for a public site). Billed per use, roughly $0.01-0.05 a critique
       depending on the model (check current pricing) - a few dollars a
       month of daily practice.
    3. **A companion claude.ai artifact** - a separate page on claude.ai
       that calls Claude on the viewer's own plan. Not part of refboard
       itself; whether it takes images, and its limits, still to check.
  - Which model: likely Sonnet for the price/quality, Opus as a "deep
    review" option.
  - The prompt and the critique's structure, and how to phrase feedback
    that helps rather than discourages.

## Watercolour practice

- **Mix this colour.** A colour to hit: choose pigments, proportions and
  how much water; see what your mix would give and how close it is. Builds
  a memory for recipes (paint.js).
- **Skies.** Procedural skies and clouds at different times of day, as
  references for sky studies.
- **Techniques guide.** Salt, spatter, dry brush, lifting, masking fluid:
  when to use each, with examples.

## Composition and references

- **Composition analysis.** For a photo: where the eye goes (a saliency
  map), the balance of visual weight, the leading lines - and a few
  suggested crops, best first.
- **Tangents.** Find where the edges of shapes just touch each other or
  the edge of the paper - tangents flatten depth, and are better either
  separated or overlapped.
- **Unequal amounts.** The proportions of light, middle and dark, warm and
  cool, hard and soft edges. A good picture has a dominant one (60/30/10,
  say); equal amounts read as indecision. For a reference and for a photo
  of your own work.
- **Line weight.** Over a photo: where a contour wants to be heavier (the
  shadow side, overlaps, the underside of a form) and where lighter (the
  lit side).
- **Museum search.** The open collections with free APIs - the Met,
  Rijksmuseum, the Art Institute of Chicago - searched from the app
  ("Sargent watercolour"); a painting opens at full resolution, straight
  into a master copy with build-up stages.

- **Classic composition schemes.** Carlson's and Loomis's templates -
  S-curve, L, steelyard (a big mass against a small one), radiating,
  triangle - laid over a photo like the present grids.

- **Streets of the world.** Open street-level photos from Mapillary (like
  Street View, but freely licensed) as references for urban sketching of
  any city.

## Before painting

- **Simplify into shapes.** The reference reduced to 5-12 flat shapes of
  colour and value, the way a painter plans a study; a slider for how much
  small detail survives.
- **Transfer grid.** The reference with a grid, scaled to the paper
  (A4, A3, 30x40 cm...), to print or to transfer the drawing square by
  square.
- **Reference board.** A PureRef-style free canvas: drop several
  references for one painting, move, scale, turn and label them. Boards
  are kept - several of them, one per painting - by the backend in the
  local version (the images through `/api/uploads`, the layout as a JSON
  document through `/api/items`; see Saving what is uploaded), and open
  again exactly as they were left. On GitHub Pages a board lasts until the
  page is reloaded, unless "keep in this browser" is on. A board can also
  be exported as one image and as a file that imports back.
- **PureRef 2.x files.** Export a board as a `.pur` that PureRef 2.x
  opens, and import a `.pur` as a board, layout included - so existing
  PureRef boards move over. The format is closed, but reverse-engineered
  and documented: FyorDev/pur-2-file-format (spec, parser and writer,
  checked against PureRef 2.0.3 and 2.1.3) - an SQLite database behind a
  displaced header, an MD5 checksum, Qt-serialized values. That repository
  states no licence, so: our own implementation from the spec, not its
  code. In the backend (C#, Microsoft.Data.Sqlite; the images are already
  in DataDir), so a local-version feature; on Pages only through SQLite in
  WebAssembly (sql.js), if at all. Unofficial, so an update to PureRef can
  break it: check the file's version and say clearly when it is one we do
  not know. Needs testing against a real PureRef 2.x. The fallbacks always
  work: a zip of the images (PureRef takes them by drag and drop) and the
  board as one image.
- **Perspective grid.** One, two or three vanishing points, a horizon and
  the paper's format, to print and draw over - the other half of the
  perspective check.

## From photo to 3D

- **Pose from a photo onto the mannequin.** The pose model already finds
  the joints in 3D (world landmarks); set the wooden figure's joints from
  them, then turn it, see it from other sides, relight it.
- **Light direction from a photo.** Estimate where the light comes from on
  a face (the face model gives its 3D shape), and set the same light on
  the 3D head.
- **A face from a photo in 3D.** The face model's 478 points, each with
  depth, made into a 3D mask of that very person, to turn and relight -
  in the planes view too: an Asaro head of anyone in a photo.
- **Relight a photo.** The depth map turns the photo into a relief, and a
  light can be set on it from another side - for a reference shot in poor
  light.
- **The sun for a place and time.** In the 3D scene, the real sun for a
  city, a date and an hour - the right shadows and colour of light for
  plein air.
- **Landscape forms.** Simple volumes for trees, clouds, rocks and hills:
  how light falls on a crown as on a ball, on a cloud as on a cluster of
  balls.
- **People in perspective.** Draw the horizon, place one figure, and see
  how tall a person is anywhere in the picture - the horizon runs through
  everyone's eyes. For urban sketching.
- **A street of blocks.** A 3D street of simple building volumes, for
  perspective practice from any viewpoint.
- **Reflections in water.** A 3D scene with still water showing the rules:
  a reflection is vertical, darker than the object, and its length does
  not depend on the viewpoint the way a shadow's does.
- **Light through the day.** The same 3D scene at morning, noon, golden
  hour and under overcast, side by side on one grid - a Monet series.
- **Clothes on the figure.** Cloth simulated over the mannequin's pose:
  folds at elbows, knees and waist. Drapery exists; on a body it does not.
- **Features.** The eye, nose, mouth and ear close up from the head scan,
  in the planes view - how light sits on each form alone.
- **Hatching that follows the form.** The 3D forms rendered in hatching
  that runs round their surface - how to lead a stroke round a ball, a
  cylinder, a head.
- **Character turnaround.** The 3D figure in one pose, front, side, back
  and three-quarter, on one sheet - a reference for illustrators.
- **Body types.** The mannequin as a child, an older person, heavier,
  muscular, with female and male proportions - there is only the one,
  ideal figure now.
- **Still life.** The usual still-life objects - bottle, apple, cup,
  glass, jug - on drapery, to arrange, with lighting set-ups ready. The
  classic watercolour subject; glass and metal are already finishes.
- **Interior.** A room as a box with simple furniture - table, chair,
  window, door - for perspective indoors. Urban sketching is not only
  outside.
- **Botanical forms.** A flower, a petal, a leaf and a stem in 3D: how
  petals turn in perspective. Botanical watercolour is popular.
- **Movement in 3D.** The mannequin in a walk, run or jump cycle with a
  slider: stop at any phase and draw it, or step through the key poses.
- **Trees by species.** The silhouettes and branching of oak, pine,
  birch, willow and spruce - each species is drawn differently.
- **Pattern over folds.** Stripes or checks on the drapery: how a pattern
  breaks and crowds over the folds - it shows a fold's form better than
  plain cloth.
- **Skull.** A 3D skull, anatomical and in planes like the Asaro head,
  that can be shown inside the head scan - where the bone comes to the
  surface.
- **Foot.** A posable 3D foot, jointed like the hand. Feet in
  foreshortening are among the hardest things to draw.
- **Animal mannequins.** A cat, a dog and a horse built from basic
  volumes, jointed like the figure.
- **Anatomy on the mannequin.** Bony landmarks on the figure (clavicle,
  iliac crest, the condyles) and muscle groups as a layer that can be
  turned on.
