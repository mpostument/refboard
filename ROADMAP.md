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
clickable mock-up of it - workspace, settings - is agreed.

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
Each new section joins the stage it is for: the board, simplify and layer
plan under Prepare; the camera eyedropper under Paint; critique
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

- **Fast loading, the rest.** In place for the trainers: `js/train.js` (1040
  lines) is now `<template id="lazy-train">` and loads when Train is first
  opened, or Ctrl+K opens a trainer; the colour maths, `clamp01`/`rnd`/`pick`,
  `loadImg` and the library picker it shared with the paint engine and the
  Colour studio moved to `js/colourmath.js`, which loads with the page. Ctrl+K
  lists the trainers before their code is there, from its own
  `TRAINER_COMMANDS`, and a test checks the list says what the trainers say.
  Not measured on a slow connection: only that the page no longer asks for the
  file.
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

- **Several profiles, the rest.** In place (`js/profile.js`, Your data >
  Profile, Ctrl+K "paint as"): a profile is a name; the main one keeps its
  keys as they were, any other reads and writes the same localStorage keys
  as `refboard.p.<id>.…` (the page's getItem/setItem are replaced, so no
  caller changed) and its documents under the kind `u-<id>-<kind>`; the
  device's own - which profile, the tour and news seen, keeping in the
  browser - and the scene API's two channels are shared; uploaded files are
  kept once for everyone. Still to come: the settings are in the browser's
  localStorage, so a profile made on one device is empty on another until
  *Settings on the server* is done; no password or PIN; pictures the
  server's ComfyUI generates join the main profile's list, whoever asked;
  a way to delete a profile's things (today it is only taken off the list).
- **Backup to the cloud.** An automatic backup of the archive to Google
  Drive, OneDrive or another drive, so work and boards do not go with the
  computer's disk.

- **Projects.** Everything about one piece in one place: its references,
  board, recipes, layer plan, photos of the stages and the result. Open
  the project and it is all to hand - the unit the saving is organised
  around.
- **Reference report.** In place (`js/refreport.js`, the workspace's Report, Ctrl+K "reference
  report"): the session's own checks - `qualityOf`, `amountsOf`, `rangeMap`, `tempMap`,
  `compositionOf`, `tangentsOf` - run together on one read of the picture and set in five sections
  (is it a good picture to work from; value against the medium's range; colour - the five biggest
  colours, each with its recipe or its step in the medium chosen in My materials, then temperature;
  where the eye goes and the crops; shapes, edges and tangents), each with a small map. One piece of
  HTML with its own style and its pictures inline: shown in a sheet, printed, or drawn to a picture
  (an SVG foreignObject) kept in My work tagged `reference report`. Loaded when first asked for. The
  words are the tools' own (`compositionSay` was taken out of the composition note to be shared);
  a check that fails leaves its section out. Tried on a drawn picture and one sample, not on a body of
  photos. Not done: other analyses (perspective, the pose skeleton, the palette's recipes in every
  medium); a report kept as a document that can be edited, not a picture; a project to keep it in.
- **Source and licence of a reference.** For each image from the web or a
  museum, where it came from and under what licence - so when a piece is
  posted, it is plain whom to credit, and whether it may be used at all.
  Museums shows the licence and copies the credit while you are choosing;
  still to come is keeping it with the picture once it is open.

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
view. Still to come on it: a setting for the 3D forms' scene.
In place too: Era (`era` row after Setting, for a character, a landscape and a building) - when,
apart from where: Ancient, Medieval, Kyivan Rus, Victorian, with tags per subject, added after the
Setting's and not swapped for them; a named character takes it as an outfit asked for (alternate
costume); hidden with Setting Original, which adds nothing. Kyivan Rus keeps out the onion dome, the
sunflower and, after one real run drew a Gothic spire behind a wooden street, gothic architecture
and spires. Checked on Animagine XL 4.0 (seed 4242): the girls read as a veiled long tunic with an
embroidered hem, a hooded brown cloak and a bonnet with a lace-gloved gown; a church "with a helmet
dome" was not drawn, only log houses under thatch.
In place too: a Character field (`genCharacterTags()` - name then series, lower
case, after "1girl, solo") and Setting: Original, a character's own clothes: it
owns Detail, since Simple and Beginner's "minimalist, simple drawing" drew a
named character bare-shouldered (seen 2026-10-15, Animagine XL 4.0, bust); any
other outfit adds "alternate costume". The last eight drawn are chips under
the field. In place too: Her hair and eyes (`genLookTags()`, the field under Character once she is
named) - "silver hair, green eyes" typed once, kept with her (`genLooksRemember()`, back with her chip,
and only hers: Rei's eyes do not follow Gojo; a name with its series added keeps what was written),
each comma part weighted like the name and put right after it; a part about the eyes is left out when
Eyes is set, one about the hair when Hair colour is - the rows win. The app knows no character's look,
so she tells it; a lookup by name (Danbooru) was weighed and left. Seen on Frieren, 4 seeds, bust: the
eyes stayed green where they ranged blue to teal, the ears were drawn either way (the model knows her at
this framing); one of the four came out in a blue coat with darker skin - a weight can tint the rest.
Still to come: a picture of her as a reference to draw from.
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
which had made its lines reddish. Copic markers and watercolour pencils, and
deleting generated pictures, one or all.
In place too: a More menu on each generated picture (`js/genedit.js`) - Redraw a
part (a brush over the picture; `SetLatentNoiseMask` on the grown mask, the
original pasted back through the blurred mask so only the brushed pixels
change), Finish it (`ImageScaleBy` 1.5, tiled VAE, denoise 0.4: on Animagine XL
4.0 a 14-step draft kept its composition and gained detail, 32 s on this card)
and Drafts (`steps` 14). Run against a real ComfyUI: a box over one eye made it
green and left every other pixel alone, with no seam to see. Still to come:
a Finish that picks 2x for a big card, a mask from "the hands" found by the
pose model. In place too: the draft strip (`renderGenDrafts()` in `js/generate.js`) - drafts not yet
finished (no picture names one as its parent) are a row under Generate, apart from Made here, each with
Finish this and Drop, and Drop all for the lot. Tried in tests only.
In place too, in the same menu: New background (`genBackgroundMask()` - the
colour at the picture's edge spread inward over pixels that change little
from their neighbour, on a 200-px copy; "Completely" erases the masked part
first, `VAEEncodeForInpaint`, since with only a noise mask the model took the
white round it for a margin and drew a white frame), Light it four ways
(soft, side, back, dramatic: the new light weighted 1.3, denoise 0.55) and In
other media (watercolour, ink, Copic, pencil: the old medium's tags and
what it kept out removed first, denoise 0.65, 0.8 for ink and pencil - and
even then red hair stayed red; a ControlNet on the line art would fix it).
In place too: Redraw in detail (`redrawCrop()`, `redrawZoom()`, `redrawPasteBack()` in `js/genedit.js`) -
the brushed part's box widened by 60% of its long side each way (at least 256 px across, moved - not cut -
to stay inside the picture) is cut out and enlarged to 1024 px (at most 4 times; not at all under 1.4, or
for a part over a third of the picture), drawn as a picture of its own by the same server path, made small
again and put back through the brush mask, grown and softened (`ctx.filter` blur, added to itself twice), as
the same picture's new version; the cut-out the server kept is forgotten. Run against a real ComfyUI on a
full-length figure's closed right hand (72 x 100 px): the plain Redraw gave a smeared hand with a white
halo, In detail five clean fingers in the picture's own line - with a few pale pink flecks past the
fingertips, which the mask's grow lets through. Still to come: the hands and the face found for you (the
pose and face models of `js/vision.js` were tried on the six sample girls: no face in any, a pose in one,
so not on anime), and a second pass over the paste-back's edge.
In place too: Extend (`genExtendOpen()` in `js/genedit.js`) - a bigger canvas, the picture in it, a
mask white over the new part (a quarter or half of the width for left and right, of the height for top
and bottom; at most 1.7 megapixels, multiples of 8), "Completely" Redraw on the server so the original
is pasted back as it was. Run against a real ComfyUI (832x1216 + 208 right, 18 s): the picture is
untouched and has no seam, but asked to draw the strip from the picture's own words ("1girl, blonde
hair") the model drew more hair there - so the person's words are left out (`genScenery()`: the tags of
the rows about her, 1girl, solo, anything about hair or eyes, a character's weighted name), "no humans" is
in and she is kept out by name; "Continue the character too" turns that off for a body cropped at
the edge. Watercolour words drew a sketchbook page with a spiral binding and paint swatches in the strip
(kept out by name); what is left is mostly blank white with now and then one stray shape. Still to come:
the strip drawn in two steps for a bigger extension, and a plain colour fill for the white-background
picture, which needs no model.
In place too: Before and after (`genCompare()` in `js/genedit.js`) - every picture made from another
(Redraw, Finish, New background, Light, Media) keeps its `parent` file id in its document; the More menu
then shows the two in one box, the first clipped to the left of a slider (`clip-path`, so a Finished
picture at 1.5 times the size lines up with its draft). The menu itself is now grouped - Change it,
Try it another way, Learn from it.
In place too: Cut out (`cutOut()` in `js/assetsfx.js`, sheet in `js/genedit.js`; Game assets phase 1) - the
background's colour is the commonest on the picture's outer two pixels (the edge must be 60% of it, or the
picture "has no plain background"); it is spread inward from the edge over pixels within a tolerance of it
that also differ little from the pixel they came from; the rim two pixels deep is given the colour of the
figure just inside it and an alpha from where it lies on the background -> figure line, so there is no
pale halo. Gaps inside (an arm against the body) are off by default - a white plate of armour is the same
colour - and loose pieces under 0.2% of the biggest are dropped as specks. ~40 ms on a 832x1216 picture.
Tried on the spike's pictures: characters (side and slightly from above) and chests cut cleanly; white armour on a
white background loses its white parts at the default tolerance (lower it); a panel round four swords
stays, because its frame stops the flood. **Not solved**: a background layer for parallax. Its "plain"
ground is a gradient (lime to dark green), which a flood from the edge does not cross, and the figure
touches the edge it must be seeded from - so layers need their own mode (phase 5).
Checked on a real ComfyUI (3 rounds of the spike's pictures, 12 on cream or white, 8 on "green background",
4 on magenta): 0 of ~40 000 rim pixels on the green ones were greenish, the characters and chests
read clean on a dark ground. "Green background" comes back pale mint, not a key green - found from the
edge, so it does not matter. A chest drawn with `thick outline` on white often gets a white "sticker"
border; it is the model's, not a halo, and stays in the cut-out (avoid `sticker, white border`).
In place too: the Prompt box (`renderGenPrompt()` - closed by default,
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
In place: starting from a picture (`genSetSource()` in `js/generate.js`, the
`image` of `POST /api/generate`): **a study** - any picture, dropped on
Generate or picked, simplified into flat shapes in the style chosen (img2img:
the picture encoded as the sampler's start, `denoise` .45 / .62 / .8); **Vary**
on a generated picture - its own tags and shape again, a little or a lot
changed; and **Draw this pose** (Forms > Pose, only with `COMFY_CONTROLNET`) -
the 3D figure's render through a ControlNet, so the reference is the pose you
set. The page crops the picture to the shape's size, so the server only passes
it on. Run against a real ComfyUI (Animagine XL 4.0, diffusers
controlnet-depth-sdxl-1.0 fp16): at strength 0.8 the model drew the wooden
mannequin itself, in watercolour; at 0.5 with clothes and hair named it drew a girl
in the same pose - so Firm is 0.5, the mannequin is kept out, and a character
with nothing said about her clothes gets "casual, t-shirt, pants". The picture is
cropped to the figure's box in the shape's proportions (the 3D view is wide, the
figure a sixth of it). The figure goes
as a depth map (`formsDepthSnapshot()` in `js/forms.js`: the forms alone,
MeshDepthMaterial, the camera's near and far closed in on them, the greys
stretched), and the key light - which a depth map cannot carry - as Generate's
Light row (`formLightChoice()`: from behind the subject is Backlit, from a
side Side, low and across Dramatic, from the camera's side Soft); From and
the framing follow the camera too. Draw this shot sets Light the same way.
Next: OpenPose from the figure's joints, for a ControlNet that reads a
skeleton, not a volume.

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

- **A photo as anime colouring.** In place (`js/animecolour.js`, Simplify's third
  "Show" choice, Anime): the picture's shapes found by hue (lightness counts a fifth
  as much as in the other views, or the shading would become shapes of its own), each
  in three flat tones. The shadow is the base turned up to 22 degrees toward blue-violet
  and a step down in value (less for a dark colour), the highlight a step up and up to
  14 degrees toward warm yellow; a grey takes a blue-grey shadow. Which pixels are in
  shadow or light is read from the photo: darker than the shape's average by 0.045 of
  OKLab lightness, or lighter by 0.06, voted inside the shape; a shape with no real
  shading stays one tone, marked flat. The key lists the three tones of each shape. The
  thresholds and the turns were set by eye on drawn test pictures, not on real photos or
  against anime frames; a face is not told from a shirt, so a nose shadow is only what
  the photo's light makes it.
In place: hair in clumps - the anime head's Hair (`formAnimeHairGeometry()`,
`HAIR_STYLES` in `js/forms-models.js`; the ring in `injectHairRing()` in
`js/forms.js`): Short, Bob or Long, as pointed locks over a scalp mass, each
lying on the skull and hanging from the widest point it passed; the ring worked
out as hair shines (Kajiya-Kay), broken into a sawtooth at each lock, cel shaded
on an Anime head with the fringe's hard shadow on the forehead. Colours named
as Generate names them, or a character sheet's; Draw it at this angle sends the
style and colour.
In place too: Ponytail and Twin tails (`HAIR_STYLES.ponytail`, `.twintails`; ids as Generate's Hair row
has them) - each tail is nine locks run down a shared axis (a ring of eight about one down the middle,
`tails` in `hairLocks()`): out from a tie behind the head or behind each ear, swelling, then hanging 2.9
head-units, so it has a body seen from any side (a first pass with the locks side by side was a ribbon
seen edge-on). And a Parting row (`HAIR_PARTS`, `hairPart` on the object: Free, Centre, Side): the
fringe's locks swing apart where it parts. Looked at in 3D from the front, side, back and three-quarters;
not drawn on a model. Generate has a Parting row of its own (Centre: `parted bangs`, Side: `swept
bangs`; asked once a hair is chosen), not tied to the 3D head; the tags are Danbooru's, not yet tried on
the model. Still to come on it: a hair tie, a side parting that shows more gap, and locks you can move.

Line and background:

- **Anime backgrounds.** In place (`js/animebg.js`, Anime study > Backgrounds, a tab with
  the Colour studio and Palettes): two manners - soft and painted, luminous and high-key -
  at five hours (day, golden hour, dusk, night, rain). Each is nine colours with a job
  (top of the sky, horizon, a cloud's lit side and shade, far hills, foliage lit and in
  shade, ground, a light accent), set in OKLCH for the hour and moved by the manner
  (luminous: stronger chroma, a deeper sky, shades turned up to 26 degrees toward
  blue-violet; soft: less chroma, values closer), a picture painted from those nine
  (gradient sky, clouds with a flat base in three flat layers, hills fading to the
  horizon colour, trees), a note on how to paint it, and for each colour how to mix it
  from your paints (the same recipes as Palettes). The picture goes to the workspace or
  a PNG, the colours to Palettes. The manners are my reading of a style and set by eye;
  no colour is taken from a film. A diagram of a background, not a painting: the clouds
  are rounds, not drawn cloud, and nothing is looked at from a different angle.
- **Studying anime frames.** In place (`js/animeframes.js`, Anime study > Study frames):
  a video (8, 12 or 16 frames, the middle of each slice) or pictures in the order given.
  Each frame is read at 320 px in Simplify's anime shapes: the cel scheme is the weighted
  median, over all the shapes, of how much darker the shadow is than its base, how many
  degrees its hue turns toward blue-violet and whether it keeps its colour - from two
  places, a shape's own darker pixels, and two touching shapes of one hue (the smaller
  the shadow) - plus how flat the picture is (the share of pixels within 0.018 of the tone
  of their shape); the palette is the five largest shapes; the colour script is a column
  of palette for each frame with the value as a line, and the note names the darkest and
  lightest frame, the one with most colour and the coolest, and the biggest changes of
  colour. The palette of all the frames goes to Palettes. Checked on drawn frames only, not
  on a real film: compression noise may lower the flatness, and a hue turn is only read
  where the base has colour. Not done: reading one character apart from the background, and
  taking frames at the cuts instead of evenly.

Anime in watercolour:

- **Outfits, proportions, faces, storyboard.** In place (`js/animecheck.js` for the numbers and the pictures,
  `js/animetools.js` for the page; four more modes in Anime study). Outfits: hair and eye colours (typed, or
  clicked on a picture of her) against the three largest colours of each outfit picture, with a plain ground
  taken out by its border; in OKLab - an outfit colour near the hair, as light as the hair, in the eyes' hue,
  opposite the hair - and two outfits with the same main colour. Proportions: six clicks (any can be skipped)
  give the height in heads, the nearest of four builds and each mark's distance from the chosen build, drawn as
  dashed lines on the drawing; the build marks are set by eye. Faces: soft, sharp, retro as numbers (eye size,
  gap, eye line, nose, mouth, chin) drawn as a front face, a note, and words for Generate's More tags.
  Storyboard: up to six frames of shot x angle x gaze drawn as plain diagrams, four sequences to start from,
  printed, saved as SVG or kept in My work. Not done: the faces are diagrams, not a style guide from any
  studio; the storyboard does not feed the 3D camera or the manga page; wind and cloth on the mannequin.
- **More ways to make, in Generate.** In place (`js/genmore.js`, lazy `lazy-genmore`, loaded when
  "More ways to make" under the choices is first opened or one of its items is asked for). A series:
  the choices drawn from two to six views with one seed and the palette lock, the views weighted 1.3 and
  the framing row's own tags taken out. A movement: Ukrainian and English stems (`GEN_MOVES`) to tags in
  More tags; a part it does not know is said, an English part is passed on. Colours to a palette (More >
  on a picture): `genLockPixels` after the fact, at "a little / mostly / fully", Holbein box or Your
  palette, the picture beside the pulled one, the biggest changes by share, kept as a new picture
  tagged `palette pulled`. Four lights, from a photo started from (the source strip). Only tested with a
  stand-in server: no real ComfyUI run, so how well a seed holds a scene across views, and how
  "біжить" reads to the model, are not known.
- **Hands, eyes, hair, shading, expressions, background perspective.** In place (`js/animedraw.js` for what is
  drawn, `js/animedrawui.js` for the page; six more modes in Anime study, whose switch is now two groups, Colour
  and Drawing). Hands: twelve gestures as joint bends of a palm-box and three-joint fingers, projected in three
  turns (front, three-quarter, side), with what each says and where to use it. Eyes: sharp, soft, flat; height,
  iris, highlights, lashes; the 90s and the modern manner side by side with the order of the layers; the iris
  takes Outfits' eye colour. Hair: five styles as tapered clumps (root, bend, tip), wind that moves the tips and
  not the roots, drawn as colour, numbered clumps or flow lines, with the ring of light; tones from the hair
  colour. Shading: a sphere and a tube in cel, two-step cel, soft and painted, lit from the upper left, upper
  right or above, with light/base/shadow/core/reflected tones worked out in HSL (shadow turned cool, light warm).
  Expressions: twelve emotions as brow, eye and mouth offsets from a neutral face drawn dashed, with arrows, and
  the anime marks (blush, sweat, vein, tears, sparkle) that can be switched off. Perspective: a room, a street
  corner and a tower from the horizon and the points, a draggable horizon, figures whose eyes sit on it, the roof
  shown only when the horizon is above the box. Every picture can be saved as SVG or kept in My work, and the
  words go to Generate's More tags. Not done: the hands are a flat model, not an anatomy study (the OK sign's
  circle is closed by eye); hair is a diagram of a head, not a character; the expression marks are the common
  ones, not every studio's; the perspective scenes are one box and a room, not a street.
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
- **Simplified hands.** In place: 3D forms > Figure and head > Anime hand
  (`handAnime`, `FORM_HAND_ANIME_JOINTS` in `js/forms-models.js`) - the hand
  the anime way, a soft mitten (an egg and a bar for the knuckles) with long
  fingers of two shapes each, a base and a bend, and a thumb of two: eleven
  joints for the hand's sixteen. Its poses are the full hand's folded (the
  middle and tip joints add up to the one bend), so Relaxed, Spread, Fist,
  Point, Pinch and Grip are the same gestures. Looked at in 3D, not drawn on a
  model. Still to come: the fingers still pinch a little at the bend, the
  figure's own hands are still the egg, and a hand in a pose set for a
  figure (the pose library below).
- **Japanese settings in 3D.** In place (`js/forms-settings.js`, 3D forms >
  View > Setting): a classroom, a train carriage, a lane with power poles and
  a shrine with its torii, as simple volumes in metres round the forms, with
  walls that face in so the near ones fall away as you turn. Still to come: a
  convenience store, a rooftop with a fence, a station platform, a bedroom
  and a school gate with cherry trees; furniture you can move; windows that
  show a sky.
- **Manga page layout.** In place (`js/mangapage.js`, Perspective grid > Manga
  page): twelve layouts for a page of three to six panels, as trees of splits cut
  into four-cornered shapes, so the gutters between rows can be slanted; panels
  numbered in the reading order (a row from its right edge to its left, a column
  from the top down; or left to right), the gutter and margin in millimetres on
  B6 to B4 paper, places for up to three balloons in a panel going down and
  across the way the eye goes, an eye path, and a note on which panel is the
  largest and what the slant does. Printed at the paper's size, saved as SVG, or
  kept in My work tagged `manga page`. A page of panels, not of drawn pictures: no
  two-page spread yet, no panels you move or cut by hand, no Japanese manuscript
  frame (the trim and the safe area of a real manuscript were not checked), balloons
  as places, not shapes.

- **Your own anime character in 3D (VRoid / VRM).** VRoid Studio (free)
  builds anime characters and saves them as `.vrm`, a kind of glTF that
  three.js already reads, with a ready library (three-vrm). Load your own
  character, pose it, see it from any angle, in its own anime shading (the
  MToon shader) - likely the strongest single feature here for an anime
  artist.
- **A photo's pose on your character.** With the pose-from-a-photo item:
  the pose model finds the skeleton, and your VRM character takes the
  same pose.
- **Light and weather effects.** In place (`js/lightfx.js`, Practise > Handbook,
  a third chapter "Light and weather"): glow round a lamp, light rays, sparkles
  on water, rain, snow, and a wet street with neon. Each lesson says where to
  leave the paper, where the edges go soft and in what order the layers go, for
  watercolour and for ink with markers, and has a demonstration drawn from a few
  numbers (light falling off with the square of the distance as rings, beams from
  one point, sparkle bars growing toward the viewer, streaks leaning with one
  wind and fading with distance, flakes in three depths, a reflection stretched
  and dimmed by the wet). Models of how it looks, not of the optics, and not
  checked against paintings. Also in place: fog and mist (ridges taking the sky's
  colour with distance), a rainbow with its twin and the dark band between,
  lightning, fireflies, and sunbeams under water; the Watercolour or Ink and
  markers choice is made once for the whole chapter. Still to come: a photo of
  a real painting beside each.

## Materials

In place: Fewest paints (`js/fewpaints.js`, Palettes) for watercolour paints, Copic markers
and watercolour pencils - the 2 to 5 that are enough for a palette; and, for markers and
pencils, **Which do you have?**: a chip for each on the list, pressed while it is yours (nothing
marked is the whole list), kept in this browser for each of the two, with All and None. The
search is kept to the ones marked, the result says "from the N you marked", and fewer than two
marked is said plainly instead of searching. The markers' and pencils' colours are still my
estimates from short lists, not the whole range. Not done: adding a marker or pencil that is not
on the list (a code, a name and a swatch photo to read its colour from), and the same choice for
the watercolour paints beyond the box above them.
