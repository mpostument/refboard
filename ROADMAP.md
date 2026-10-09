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
  workspace", at Colour (`openInWorkspace()`). Every tab now holds its tools:
  the paper's range and grey markers (Value), temperature (Colour), tangents
  (Composition), the symmetry check (Construction, My work), Reilly rhythms
  (Figure). Still to come: the two the tabs are still waiting for - eyes and
  gaze (Figure; see Eye and gaze construction) and a painting check and
  likeness (My work; see Checking your own work, and Likeness and figure
  checks).
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
  Museums shows the licence and copies the credit while you are choosing;
  still to come is keeping it with the picture once it is open.

## At the easel

Hands full of paint: ways to run a session without touching the screen.

- **A phone as a second screen.** In the local version, over the home
  network: the session is run from the computer, and a phone or tablet by
  the paper shows the reference in sync. Needs the backend - not
  possible on GitHub Pages.
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
In place too: its Setting row - Slavic, East Asian, Western Europe, Nordic,
Middle East, South Asian, Fantasy, Sci-fi - with tags per subject (clothes on
a character, buildings, what grows in a land), placed in the prompt after the
character and the shot. Checked on Animagine XL 4.0: "harem pants" made the
Middle East a dancer's costume, so a long dress and a shawl; Slavic is
before Christianity - no church or onion dome, and no sunflowers, which came
from America in the 1700s. The rows are grouped (What, The character, The
shot, Light and time, The picture; `GEN_GROUPS`) in two columns, a group
hidden with its rows, and More tags and Generate stay at the bottom of the
view. Still to come on it: a setting for the 3D forms' scene, and eras
(ancient, medieval, Victorian, Kyivan Rus) apart from places.
In place too: Modern, Steampunk and Post-apocalyptic Settings, each with a
temple, and a Clothes row - Setting's (the default), Everyday, Festive,
Uniform, Armour, Winter, each with tags per Setting (`wear(girl, boy)` for
the ones that differ: a prince's cape, not a ball gown), and Sportswear,
Close-fitting, Swimsuit, Leotard for figure study, which keep out anything
revealing (`MODEST`). A choice other than the Setting's `owns` its
clothes. On a character "post-apocalypse" drew the ruins behind her,
whatever the background, so there she is a survivor in torn clothes; the
ruins are for streets and land. Long rows are captioned in kinds (an
option's `group`: The world, Genre; Figure study), each on its own line.
In place too: Detail's Beginner - weighted tags ("(minimalist:1.4)") per
subject, since Simple still drew hair of a hundred strands and a street of
a thousand windows; a building on white. A figure is weighted lighter
(`BEGIN_FIGURE`: at 1.4 the medium was lost and the legs went to sticks)
and, with Setting Any, dressed in a t-shirt and trousers - left alone the
model drew gowns with trains. A Temple per Setting (`owns`: its
tags stand in for the Setting's, whose log houses drew a Slavic hut, not
idols). Tags escaped for ComfyUI (`comfyTags()`): bare brackets are its
emphasis, so "pen (medium)" drew a pen into ink pictures; ink avoids sepia,
which had made its lines reddish. Watercolour markers and pencils, and
deleting generated pictures, one or all.
In place too: the Prompt box (`renderGenPrompt()`) - closed by default,
the tags as sent, the choices' negative tags as switches kept in
localStorage (`genRequest()` leaves the switched-off ones out), the
server's quality and negative tags (from `GET /api/generate`) read-only.
In place too: How to draw it (`js/steps.js`) - any picture taken back to its
steps, per medium, worked out from the picture (an image model asked for an
earlier stage draws a different picture; Paints-Undo, the model trained to
rewind a painting, was weighed and left: 24 GB, and digital painting's
order, not watercolour's or ink's).
In place too: the masking plan, as How to draw it's "Save the whites" step
for watercolour - the near-white areas with colour round them (not the
paper round the subject, not a pale face cut up by its lines), the small
or thin ones for masking fluid, the big ones to paint round.
In place too: the character sheet, the Colour studio's third tab - hair,
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
on it: a choice of anime styles for the rest of the face (the proportions
differ from studio to studio) - the eye has its styles (see The anime eye).
In place too: the anime head in 3D - Anime head among the 3D forms
(`formAnimeHeadGeometry()`, `formAnimeFace()` in `js/forms-models.js`), the
same proportions made solid with its face a flat mask and the features drawn
on as a decal, the gleam on the light's side; the note under the view
(`animeHeadReading()` in `js/forms.js`) gives the far eye's width against the
near one's, on the mask and on a ball, with what to watch at that angle, and
sends the angle to Generate. Its hair is in place too - see Hair in clumps,
and its expressions - see the expression sheet.

In place: the anime eye - `ANIME_EYES` and `animeEyeShape()` in `js/vision.js`,
one description drawn both on a photo's head (the eye switch beside Loomis /
Anime, and Ctrl+K) and on the 3D head (`drawAnimeFace()`, each head with its
own face materials, `formFaceMaterials()`): TV anime, Shōjo, Sharp (tsurime),
Soft (tareme) - the lash line's weight and flick, the iris ellipse cut by the
lids, the gleams on the light's side, the brow. In 3D an eye colour too, a
character sheet's chip setting hair and eyes at once, a line on what the
eyes do at each angle in the note, and the colour and shape sent to Generate
(its Eye shape row). Still to come on it: the irises turned to look
somewhere, and more styles.

In place: the expression sheet - `ANIME_EXPRESSIONS` in `js/vision.js`, on top
of any eye style (`animeEyeShape()` takes the expression): Calm, Joy, Anger,
Surprise, Sadness - the brows raised, tilted and arched, the lids pushed up
into a crescent or dropped over one corner, the iris shrunk, and the mouth
(`drawAnimeMouth()` in `js/forms-models.js`) with anime's signs: the blush,
the vein, tears. The 3D head's hair, eyes and expression are on a Face tab of
their own, shown only for a head with a face. Expression sheet
(`animeExpressionSheet()` in `js/forms.js`) renders the head in each
expression from the front, at three-quarters and near profile, as one
picture in the viewer; the note under the view says what the expression
does at that angle. Generate has an Expression row and an Expression sheet
under How much - checked on Animagine XL 4.0: "expressions" alone drew one
calm face ten times over captions in made-up script, so the sheet names each
feeling and keeps text out. Still to come on it: brows drawn over the fringe,
as anime does, more expressions (embarrassed, smug, crying), and a photo's
head read for its expression.

Body:

In place: anime proportions for the mannequin, and body types, on the
figure's Body row above its pose (`FIGURE_BUILDS`, `figureScale()` in
`js/forms-models.js`): Realistic (7.8 heads), Anime (7), Long-legged (9),
Chibi (2.5) - a style, each stretching the whole figure at its own rate -
and Child (5.5), Older (7.5), Heavier, Muscular, Female and Male, which
keep the realistic figure's own style and vary the build instead: wider or
narrower through the chest and the waist, which are two parts, not one, so
shoulders and hips can widen apart from each other (Heavier fullest at the
waist, Muscular broadest at the chest, Female and Male opposite ways
round). Each part of the body a girth and a length times the real one's, a
joint hung where its parent's length puts it - so one rig and every pose
fit every build. The count is worked out from the rig (`figureHeights()`),
not written down, and the Heads grid (`drawFormHeads()` in `js/forms.js`)
draws it across the figure, from the floor as it would stand. Still to
come on it: a child's proportions scaled further by age, and the build
sent to Generate.

In place too: a photo's pose in anime proportions - the pose skeleton's
switch (`rebuildPose()` in `js/vision.js`, which now holds FIGURE_BUILDS for
both): every bone the model found keeps its angle and takes the build's
length, hung from the joint above it and planted on the lowest foot, in pink
over the photo's own, the head a circle against the photo's dashed one, a
tick for each head. Still to come on it: the rebuilt pose sent to the 3D
figure (with Pose from a photo onto the mannequin), and a bent figure's
length measured along its bones rather than top to bottom.

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
In place: hair in clumps - the anime head's Hair (`formAnimeHairGeometry()`,
`HAIR_STYLES` in `js/forms-models.js`; the ring in `injectHairRing()` in
`js/forms.js`): Short, Bob or Long, as pointed locks over a scalp mass, each
lying on the skull and hanging from the widest point it passed; the ring worked
out as hair shines (Kajiya-Kay), broken into a sawtooth at each lock, cel shaded
on an Anime head with the fringe's hard shadow on the forehead. Colours named
as Generate names them, or a character sheet's; Draw it at this angle sends the
style and colour. Still to come on it: ponytail and twin tails, a parting to
choose, and locks you can move.

Line and background:

- **Anime backgrounds.** Ghibli's backgrounds are largely painted in
  gouache and watercolour - a direct line to watercolour. Sky and
  landscape palettes in the manner of Ghibli or Makoto Shinkai, with
  recipes for your materials.
- **Studying anime frames.** Frames from a video (the app already takes
  them), analysed: the cel shadow scheme, a character's palette, a
  scene's colour script - learning from favourite work.

Anime in watercolour:

- **Lightbox, the rest.** In place (`js/lightbox.js`, Paint > Lightbox,
  Workspace > Onto paper, Ctrl+K "trace"): a photo of the sketch unbent
  from its four corners (a homography; found as the biggest light shape),
  the paper made white by dividing by its own colour in blocks, the lines
  in colour or all dark; real size from a bank card held to the screen;
  mirror, a quarter turn, the screen kept awake, locked against touches and
  held to unlock. Still to come: the photo taken inside it with the camera,
  the lines only (the shading left out, for a clean trace), and a sheet
  bigger than the screen split into numbered tiles to trace one by one.

Clothes, movement, settings:

In place: anime camera angles - the 3D view's Anime shots (`ANIME_SHOTS` in
`js/forms-models.js`), each a height, lens, distance and roll, never a turn:
Worm's eye, Bird's eye, Wide and close, Dutch angle, Telephoto, Fisheye. The
camera may now go below the forms' middle with the floor showing, as far as
the floor (`formFloorPitch()`); a Roll slider; and a fisheye rendered all
round the camera into a cube and bent stereographically (`renderFisheye()`),
with the overlay, the picking and the eye-level line through the same
projection (`formProject()`) - the fog measured by distance now, or the
cube's faces showed. Draw this shot sends it to Generate's Lens row (wide and
close, Dutch angle, fisheye) and From. Still to come on it: over the
shoulder and other two-figure shots, and a lens's distortion on a photo.

- **Pleated skirt and school uniform.** 3D simulation of pleats and a
  sailor collar, how they behave in motion and foreshortening - pleats in
  perspective being one of the hardest things in anime.
- **Pose library for the mannequin.** Dynamic poses ready - running,
  jumping, striking, falling, anime sitting - from any angle, not only
  from photos.
- **Simplified hands.** The anime construction of a hand (a mitten with
  fingers) on the existing 3D hand: drawing it in a few shapes rather than
  joint by joint.
- **Japanese settings in 3D.** In place (`js/forms-settings.js`, 3D forms >
  View > Setting): a classroom, a train carriage, a lane with power poles and
  a shrine with its torii, as simple volumes in metres round the forms, with
  walls that face in so the near ones fall away as you turn. Still to come: a
  convenience store, a rooftop with a fence, a station platform, a bedroom
  and a school gate with cherry trees; furniture you can move; windows that
  show a sky.
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
- **Glazing, the rest.** In place (`js/glazing.js`, Colour studio >
  Glazing, Ctrl+K "glazing"): the palette's glazing chart, each paint over
  each at a light, medium or strong wash, and a crossing set beside the
  other order and the palette mix. With transparent paints absorbances only
  add, so the glaze equals a mix and the tab says which; an opaque paint
  (`GZ_OPACITY`) veils on top, so there the order shows; two layers past
  strength 1 are darker than any one wash. In oil, over an underpainting
  with white. Still to come: granulation and staining (with the Pigment
  guide), three layers and more, and a glaze asked for - "what over this
  wash gives that colour" - from a picture's palette.
- **Pigment guide, the rest.** In place (`js/pigments.js`, Colour studio >
  Pigments, Ctrl+K "pigment"): transparency, staining, granulation and
  lightfastness for each paint in PIGMENTS (paint.js), with its Colour Index
  code; a test swatch painted from the wash model, grain as noise on the
  strength and a lifted band keeping what a staining paint leaves; questions
  (glaze cleanly, lift off, granulate, fade) that light the paints that
  answer. Glazing reads its opacity from the same table and says whether
  the first wash survives the glaze. Recipes tag granulates, stains and
  fades, and a granulating one names the smooth recipe beside it. Also in
  place: **My Holbein box** (palette `box`, 28 Holbein Artists' Watercolor
  tubes, each its own PIGMENTS entry with `tube`: pan position, code, what
  it was bought for) - the Pigments tab lays it out as the pans sit, four
  rows of seven, and recipes, glazing and greys read in the names on the
  tubes. A paint flagged `body` (Chinese White) is a pan but not a mixing
  paint in watercolour. Its colours and ratings are estimates - Holbein's
  own chart could not be fetched - to be corrected from painted swatches
  of the real tubes; Colour Index codes are given only where confirmed.
  Still to come: more pigments (quinacridones, pyrroles, a permanent
  alizarin), the paints of other makers and a palette builder (below),
  granulation in the Glazing chart and the Preview as watercolour, and a
  recipe asked to keep to smooth or lasting paints.
- **Palette builder, with paints of many makers.** A tool to make a palette
  of your own from real tubes: a catalogue of the main makers' watercolours
  (Holbein, Winsor & Newton, Daniel Smith, Schmincke, Sennelier, Mijello,
  Sakura Koi, Kuretake Gansai Tambi and others) with each tube's name,
  code, Colour Index code, opacity, staining, granulation and lightfastness
  as the maker prints them, and the colour of the tube as an estimate to be
  corrected by a painted swatch. You pick tubes into pans, lay them out in
  the box's rows (any size, with free slots), and the palette joins the
  chips beside Zorn and the others - the Colour studio, the palette
  generator and the eyedropper then mix from exactly it. Export it as a
  file (JSON, one pan per entry: maker, code, name, position, colour) and
  import one back, so a box can be kept, shared or moved between machines;
  an unknown tube imports as a custom paint with its own colour and
  ratings. Open questions: where the data comes from (the makers' charts
  could not be fetched automatically, so the catalogue is typed from their
  published lists and each entry marked as confirmed or estimated), and how
  to tell a free slot's best candidate ("what to buy next" for the box).
  The sample is the anime box in `box`.
- **Camera eyedropper.** Point a phone at the real scene - plein air - and
  read the colour under the crosshair with its watercolour recipe, live.
  The mixing is already there (paint.js); this adds the camera's video.
- **What the paper can do, the rest.** In place (`js/range.js`, `b`, Workspace >
  Value, a layer): the picture against the range of your main medium - its
  darkest (`floor` in `MATERIALS`, round figures) to the paper's L* 95 -
  violet below, amber above, strong where there is detail to lose and faint
  where the area is flat. Still to come: the range measured from a swatch
  photo (see Calibration), the paper's own tone, and the picture shown
  squeezed into the range, as a preview.
- **Shadows in the 3D forms, the rest.** In place (`formSoftShadowChunk()` in
  `js/forms.js`): percentage-closer soft shadows in place of three's PCF, whose
  five samples blurred every edge alike and left the lit side of a form
  speckled under a lamp (39% of a lit ball's pixels, measured; 0.3% now). The
  map's raw depths are read to find what blocks the light and how far above the
  point it is; the penumbra is that gap times the light's size, so the foot of
  a form is sharp and a shadow thrown far is soft, from the sun (a tangent
  from `softness`) and from a lamp (a radius in world units). A surface is
  compared as the plane it lies in, which is what keeps a wide penumbra from
  shadowing a tilted lit face. Sky occlusion is in place too (`formOcclusionRender()`): the
  dark halo under a form where the hemisphere's light is blocked, which the
  key's shadow does not give. Two pictures of the forms (lowest and highest
  height above each spot of floor) and a horizon scan in sixteen directions;
  exact for a ball, a wall at its foot, and less for a form held up. The forms get it too: each
  pixel casts sixteen rays out of its surface and counts those ending between
  the lowest and highest height of a form above a spot (the same two pictures)
  or under the floor (`FORM_AO_FORM_REACH`; the rays are the same at every
  pixel - random angles gave grain). A column holds one span, so a gap between
  two forms stacked above one spot reads as filled. The second light has its own shadow map now (`aimSunShadow()`, one
  helper for both directional lights, the penumbra growth the light's own
  `shadow.radius`); it is left out in Anime. Bounce also
  carries colour from one form to a near one (the 16 occlusion rays read a
  colour picture of the forms from above, `ao.tint`; not weighted by how lit
  the neighbour is, and one colour per column, the topmost). Still to come: the cost, if a scene of many
  forms is slow - 44 depth reads a pixel is what a Worker or a half-size
  shadow pass would trim.
- **Light and shadow, the rest.** In place (`js/light.js`, Colour studio >
  Light, Ctrl+K "shadow"): a light as two spectra - the key (a black body
  at its colour temperature) and the fill that is all a shadow gets (the
  sky, scattered sunlight; or warm walls; or the lamp again) - each colour's
  reflectance times them, the eye's adaptation taken half way, skin's
  shadow warmed by the light that comes back out of it. Six lights, a
  temperature and a shadow slider, samples, your own colour or the
  character sheet's; a lit ball, recipes for both sides, and the shadow as
  a glaze over the light colour. Still to come: the light read from a
  picture (its lit and shadow sides, as the Temperature map sees them), a
  ground bounce (green grass, a red floor), and the Character tab's
  automatic shadows following the light chosen here.

- **Vignette.** A watercolour study often fades out before the edge of
  the paper: suggest the vignette's shape - where the picture should end
  and dissolve so the focus stays inside.
- **Weather for watercolour.** Humidity and temperature for the plein air
  spot from Open-Meteo (free, no key). They set how fast watercolour
  dries.

- **Preview as watercolour, the rest.** In place (`js/watercolour.js`,
  Workspace > Colour and Onto paper, a layer, Ctrl+K "watercolour"): the
  picture as washes - a Kuwahara filter (`wcKuwahara()`, the means and
  spreads of four squares round each pixel from summed-area tables) so flat
  areas come out flat and edges stay where they were; the edge map decides
  the rest - along a hard edge the pigment pools in a rim on its darker side,
  near a soft one the washes are blurred together, wet-in-wet; a wash
  worked out as an absorbance against the paper and let down to 85% (paler
  than the photo, its darks layers rather than black); grain in the paper's
  tooth that thickens the wash in the darks (Smooth, Light, Granulating);
  and what is near-white and colourless left as the paper, with the share
  said. Detail (Loose, Medium, Tight) and Colours - kept to what the chosen
  palette mixes (`paintReach()`, a colour outside pulled in along its own hue,
  lightness kept) - sit in the note, with a button into How to draw it. About
  150 ms at 560 px. Still to come: the wash worked out from the paints'
  own spectra rather than from the photo's sRGB (so a glaze really is one),
  blooms, backruns and the cauliflower edge where a wet wash meets a damp
  one, granulation by each pigment's own rating (Pigment guide), the whites
  ringed for masking fluid, and the same look for ink and for pencil
  (the ink one is under Materials).
- **Grey ladder, the rest.** In place (`js/greys.js`, Colour studio >
  Greys, Ctrl+K "grey"): a warm, a neutral and a cool grey from the chosen
  paints, each one mixture taken over seven values with water or white, and
  the picture's own greys marked on it. Still to come: a ladder printed to
  paint and photograph, calibrating the mixes (with the Mixing chart), and
  greys chosen for a picture - its shadows' temperature deciding the column.

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
- **Grey markers for value studies, the rest.** In place (`js/markers.js`,
  Workspace > Value, a layer): the photo split into areas for the greys of a
  set (`MARKER_SETS`: Tombow Dual Brush's grayscale ten, N95 to N15, and the
  ABT twelve), each area with its marker's number; three, five, seven or all,
  spread between the picture's own 2nd and 98th percentile and matched each to
  its nearest marker, the paper left white, a key with each grey's share. The
  codes are the maker's; each one's lightness (L*) is an estimate. Still to
  come: other makers' sets and your own (My marker set), warm and cool greys
  told apart and not only by lightness, runs that blend for a gradient
  (Blending groups), and the lightness from a swatch photo (Calibration).

Any medium:

In place: Line and wash (`js/linewash.js`, Workspace > Line) - the urban
sketcher's liner-plus-watercolour plan. Line weight's own contours
(linework.js), but judged whole rather than point by point: each connected
run is kept for ink only if it is among the few that carry most of the
picture's own weight (length and darkness summed along it), so one strong
contour is inked entire and a small mark beside a big shape is left out -
never a single line dashed by the quantiles' own arithmetic. What is left
bare sits over a wash: the picture's own colour, blurred down to its broad
masses, so the colour change alone still says what the line does not. The
note gives the share each side takes. Still to come: the wash read against
the painter's own palette, so it shows what the paints can actually mix
rather than the photo's own colour; and a slider for how much is left to
the wash.
- **Line art preview.** The photo shown as a line drawing, as hatching or
  as stippling - to plan a piece in liner, ballpoint or ink.
- **Texture library for pen.** How to say wood, stone, foliage, fur,
  water, brick in strokes - examples and practice sheets.
- **Presets by medium.** "Liner sketch, 5 min", "watercolour study,
  45 min with stages", "pencil value study, 20 min" - each with its timer,
  its overlays and its advice.
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
- **Temperature map, the rest.** In place (`js/temperature.js`, `t`,
  Workspace > Colour, a layer): each area's colour on OKLab's orange-blue
  axis, against the picture's own middle, orange warmer and blue cooler,
  white lines where it turns; the note tells warm light / cool shadow from
  the reverse. Still to come: temperature read against the local colour
  (a red shadow on a red dress is still a cool red), and a picker for which
  hue counts as neutral under a coloured light.
- **Colour wheel, the rest.** In place (`js/wheel.js`, Colour studio >
  Wheel, Ctrl+K "wheel"): a painter's (RYB) and a perceptual (OKLCH) wheel,
  the painter's a warp of the other through twelve named hues; seven
  harmonies as turns on the drawn wheel; a base moved by pointer or keys; a
  value slider; the paints' reach as a dashed outline and a mark on every
  colour past it; recipes on request; a colour of the open picture as the
  base; the harmony to the palette generator. Still to come: the picture's
  own colours plotted on this wheel (the Picture tab's wheel is the
  perceptual one only), the harmony a picture is closest to, a wheel of the
  paints themselves - each tube as a dot, and a click on two shows what
  they mix to - and the wheel's value as a plane you can tilt, to see
  chroma fall away at the light and dark ends.
- **Palette generator, the rest.** In place (`js/palette.js`, Prepare >
  Palettes): the row, Space, locks, reordering, tints and shades, the
  harmonies, a value structure, recipes for your paints, Only what my
  paints mix, saved palettes, a picture's palette from the Colour studio,
  and a palette sent to Generate as its Colours (`genPaletteTags()` in
  `js/generate.js`: limited palette, the leading hue family's theme,
  muted/pastel, dark/high contrast - checked on Animagine XL 4.0, one seed:
  the theme tag is strong, the picture comes out nearly in one hue).
  Still to come: a palette kept to a project (once Projects are in), and
  recipes for pencils and markers by their own names once My materials
  lists them.

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

- **Symmetry check, the rest.** In place (`js/symmetry.js`, `y`, Workspace >
  Construction and My work, a layer): the picture folded on a vertical line,
  found by trying every fold in the middle half and keeping the one with the
  least difference (nudged by hand, or put back in the middle), pink where the
  halves differ by more than 14 L*; counted as a share of the drawing, not of
  the empty sheet round it, with the half that runs farther, the darker half
  and the third the worst of it is in. Still to come: a tilted fold (a face
  turned or leaning), a horizontal one for reflections in water, colour and
  not only value, and the fold dragged by the pointer.
- **Digitise your work.** A phone photo of a sketchbook page turned into a
  clean scan: perspective straightened, the shadow and the paper's tint
  taken out, white balance corrected. Kept in the local version's archive
  next to its reference.

- **Portfolio site, the rest.** In place (`js/portfolio.js`, Your data > Make
  a portfolio site): the pictures kept as your work - Compare's photos of your
  drawing (`from: 'work'`) and the My work folder - newest first, as a .zip
  with one index.html (its style inside, no script, nothing fetched), the
  pictures under images/, a .nojekyll and a README on publishing with GitHub
  Pages; the site's title is yours, and kept. Still to come: digitised pages
  (see Digitise your work) in place of the photos as they were taken, a
  caption and a date of your own per piece in place of the file's name, an
  order you choose, and a project's pieces as a page of their own (once
  Projects are in).

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
- **Reilly rhythms, the rest.** In place (`js/rhythms.js`, `z`, Workspace >
  Figure, a layer): from a photo's pose points, the two long curves from each
  shoulder across the chest and past the opposite hip to the foot (`diagL`,
  `diagR`), the spine from the head to the pelvis and each arm - smooth curves
  (`smoothPath()`), each measured against the straight line from end to end;
  the one with most swing is named, and any within 3% of straight called
  stiff. Still to come: the curves carried on past the joints the way Reilly
  drew them, a figure's rhythms on the 3D mannequin and its pose library, and
  the drawing's own rhythms checked against the photo's (see Figure
  proportions and angles).
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
- **Tangents, the rest.** In place (`js/tangents.js`, `n`, Workspace >
  Composition and My work, a layer): value shapes that just touch or nearly
  do, and shapes that just touch the paper's edge or are cut by it by a
  hair, ringed, with the fix in the note. Still to come: tangents of
  colour alone (a red against a green of one value), a line that runs
  exactly into a corner, and edges that run parallel just inside the frame.
- **Unequal amounts, the rest.** In place (`js/amounts.js`, `u`,
  Workspace > Value, Composition and My work): light, middle and dark (the thirds `v` at
  3 shows), warm, neutral and cool, bright, muted and grey, big, medium and
  small shapes, hard and soft edges, each as a bar with its verdict - a clear
  lead, a lean, or equal amounts that read as indecision - and a Where? that
  opens the map it counts. Where the whole has no leader, the same counts in
  nine windows (the halves, the corners, the middle) find the crop where
  something does, and the viewfinder tries it. Still to come: a crop searched
  at any size and place rather than from nine windows; shapes cut by colour
  as well as value; and the bright held against where the picture's focus is,
  not only against the rest.
- **Line weight, the rest.** In place (`js/linework.js`, `k`, Workspace >
  Line and My work, a layer): contours weighed by the darkness round them,
  their size and length, with tapered ends; an anime frame's own line art
  weighed; heavier where one line meets another (a T: found where three
  long branches meet, or a line ends a hair short of another - not at the
  whisker of a stroke's end), and a line that ends against another does
  not taper there. Still to come: a whole strand of hair as one line
  rather than dashes, a heavier line where a form passes in front (not
  only where lines meet), and a photo of your own line drawing checked
  against it.
- **Museum search.** In place (`js/museum.js`, Prepare > Museums): the Met
  and the Rijksmuseum searched from the app ("Sargent watercolour"), a
  picture opened in the workspace at 1600 px or at the museum's original,
  with its licence shown and its credit to copy. Still to come: the Art
  Institute of Chicago - its image server answers a browser with a Cloudflare
  bot check, so it needs the container's backend as a proxy (and is then not
  on GitHub Pages); and a painting opened straight into a master copy with
  build-up stages.

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
In place: body types for the mannequin - Child, Older, Heavier, Muscular,
Female and Male, on the figure's Body row beside Realistic, Anime,
Long-legged and Chibi (see Anime proportions for the mannequin, under
Anime > Body, above).
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
- **Foot, the rest.** In place (`FORM_FOOT_*` and `FORM_RIGS.foot` in
  `js/forms-models.js`; 3D forms > Figure and head > Foot): a right foot on
  the same rig machinery as the hand - the heel a ball, the instep a wedge
  rising to the ankle, the forefoot a block with the pad of the ball, the
  big toe of two joints and the other four of three, shortening and thinning
  toward the little one. A toe runs along +z, which a limb (down its own y)
  cannot, so each toe's pivot holds a rest turn of 90 degrees about x, and
  the outer toes' small outward turn with it. Joints: the ankle, the middle
  of the foot and every toe; poses Relaxed, Pointed, Flexed, On the toes,
  Curled and Spread; random forms deal it a new pose. Still to come: a left
  foot (this one mirrored), this foot in place of the figure's single-box
  foot, the foot's own anatomy (the arches, the tendons, the ankle's
  bones; see Anatomy on the mannequin) and a sole that rests flat on the
  floor under load.
- **Animal mannequins.** A cat, a dog and a horse built from basic
  volumes, jointed like the figure.
- **Anatomy on the mannequin, the rest.** In place (`FORM_ANATOMY_*` in
  `js/forms-models.js`, `drawFormAnatomy()` in `js/forms.js`; 3D forms > a
  figure > Body): bony landmarks and muscle groups as labelled marks on the
  figure's own forms, turning with the pose and drawn where they face you.
  Still to come: the hand and the foot (carpals, the arches), the deeper
  muscles under the surface ones, and the same on the Head scan.
