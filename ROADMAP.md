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

## Game assets

Generate makes references to draw from. A 2D game needs the other thing:
pictures to *use* - a character that walks, a sword in the inventory, a floor
that tiles, a forest in three layers - cut out, at the size the engine wants,
in one style, in a file it can load. The same ComfyUI makes them (Animagine XL
4.0 and the depth ControlNet are what is installed); what is new is the recipes
for each kind, the work *after* the model - cutting out, tiling, shrinking,
packing - which needs no model and runs in the page, and the export.

A new view, **Game assets** (`js/assets.js`, beside Generate in the nav; shares
`runGenerate()`, `ComfyClient`, the More menu, the palette lock and the Redraw /
Extend / Before-and-after sheets rather than copying them). Each picture is kept
in Uploads > Assets with its kind, view and size as tags, so the library finds it.

**What it makes**

| Kind | What you choose | What comes out |
| --- | --- | --- |
| Character | view, pose (idle, walk, attack...), outfit, theme | one sprite on transparent; 4/8 directions; a turnaround |
| Prop | what (barrel, chest, tree, lamp...), view, theme | a cut-out object; 4 variants at once |
| Weapon and item | sword, axe, bow, staff, gun, potion, key...; material | a cut-out object, an inventory icon (square, outlined) |
| Tile | ground, grass, water, stone, wood, lava, snow...; view | a seamless square, 3x3 preview; a terrain set (blob autotile) |
| Background | biome, time of day; a far / middle / near layer | a wide picture; a layer that loops sideways; a room or map from above |
| UI | panel, button, frame, bar, icon set | a stretchable frame (9-slice), a set of icons |

**View** is the first choice on every kind: *Side* (platformer), *Top-down*
(the three-quarter view of a Zelda or Stardew - what a game calls top-down),
*Straight down* (a map, a floor plan; a character from above is a head and
shoulders), *Isometric*. Each is a tag recipe per kind (`from side`, `from above`,
`isometric`, `flat color`...), found by trying, not guessed - phase 0.

**One style for the whole game.** A *Game style* kept once and applied to every
kind: the view, the theme, an outline weight, the palette (the Colour studio's
or the Holbein box, through the palette lock of `js/genlock.js`), the pixel
grid, the sprite size, how simple it is (simple / medium / detailed). Without it fifty assets are fifty styles, which is the
usual way generated art fails a game.

**The parts that need no model** (client-side, `js/assetsfx.js`, all testable
without ComfyUI):

- *Cut out*: the picture is made on a flat colour (the model is told
  `simple background, green background` or white), and the background found from
  the edges and removed - the flood of `genBackgroundMask()`, but with a soft
  edge, a despill of the colour at the rim, and the holes inside (between an arm
  and a body) found too. A checkerboard shows the result. No `rembg`.
- *Pixel it*: nearest-neighbour shrink to a grid (16, 32, 48, 64, 128), the
  colours cut to 8 / 16 / 32 (median cut, or the palette's own), a one-pixel
  outline. What the model drew is a painting; this makes it a sprite.
- *Make seamless*: the tile rolled by half its width and height, so its seams
  lie in the middle as a cross; that cross masked and drawn again through the
  Redraw path (`VAEEncodeForInpaint`), then a 3x3 preview shows what is left. The
  same with the vertical seam only makes a background loop sideways.
- *Pack and export*: a sprite sheet (grid or packed, padding, power of two), a
  JSON atlas (Phaser / generic), a Godot-friendly folder, Tiled's `.tsx`
  for a tile set, a 9-slice description for UI frames.
- *Blob autotile*: from two seamless textures (grass, dirt) the 47 (or 16) tiles
  of a terrain set, the edge between them a noisy mask; pure canvas.

**Phases** (each ends with a commit, tests, and a run on the real ComfyUI with
the pictures looked at - as the Generate features were):

0. **Spike - what the model can do.** Try each kind in each view on Animagine
   XL 4.0, 4-8 seeds each, and write the tags that work (and the ones that fail)
   into this file. Settles the bad cases early: a true top-down character,
   pixel art without a LoRA, a tile that is not a picture of a floor. *Done
   when* there is a table: kind x view -> tags, with a verdict and a sample.
1. **Cut out.** `assetsfx.js` cut-out with the checkerboard view and a PNG
   with alpha; works on any generated picture (a More item) as well as in the
   new view. *Done when* a character on white, one on green and a prop each cut
   out with no halo at 3x zoom, and a picture with no plain background says so.
2. **The view, props and weapons.** The Game assets view with the style
   settings, Prop / Weapon / Item, 4 variants, the icon frame. Server: free
   sizes (`Width`, `Height`, multiples of 64, up to 1.6 MP) instead of three
   shapes - needed for a strip and a square at 512. *Done when* "a wooden chest,
   side view, fantasy" gives four cut-out chests, and "a steel sword" four
   swords pointing the same way. **Done 2026-10-16** (Prop / Weapon / Item; Character,
   Tile and the rest are later phases): the view `js/assets.js`, `Width`/`Height` and `Asset`
   on the server (Uploads > Assets), `assetSolo` / `assetOrient` / `assetIcon` in
   `assetsfx.js`. Run on the real ComfyUI: "wooden treasure chest" gave four cut-out chests
   (3 of 4 closed with `closed lid` + avoid `open lid, jewels, gems`; a bare "chest" was read
   as a body part and gave a panel); "steel sword" gave four *single* swords, all tip up (the
   prompt asks `pointing up`; the long axis is only straightened, and turned over on clear
   evidence - an axe's mass is its head - because a sword's centre of mass is too near the
   middle to say which end is the tip), each with a 45-degree framed icon; a potion cut out
   clean. Not done from the list above: the "game style" settings are phase 6, so only theme,
   material and simplicity are here; the palette lock is not applied yet.
   **Second pass, 2026-10-17** (real runs, 4 seeds each, looked at): the one set of words did
   not fit every weapon and item, so a bow, a shield and ten items have recipes of their own
   (`WEAPON_RECIPES`, `ITEM_RECIPES`, found by the typed name; a name outside them keeps the old
   words), the backdrop words (`border, frame, card, plaque, panel`) are kept out of both, the
   white sticker rim is taken off (`assetDefringe`), and a thing with a hole (bow, ring, key) is cut
   with the hole cleared. A bow, a key, a scroll and a heart are still weak; the table in phase 0
   has the verdict per thing. Drawing on a key colour was tried for them and rejected.
3. **Tiles.** Make seamless; the 3x3 preview; ground / grass / water / stone /
   wood from the Spike's tags; a tile at 256 / 512 and shrunk to 16 / 32.
   *Done when* a 3x3 of a generated tile shows no seam at 1x, and the rolled
   seam is drawn again, not blurred. **Done 2026-10-16** (Tile kind in the Game
   assets view; `tileRoll` / `tileCross` / `tileSeam` / `tileGrid` / `tileShrink` in
   `assetsfx.js`; `assetFinishTile` in `assets.js`). The tile is asked at 1024, rolled by
   half, the cross (14% wide) drawn again as a second job through the Redraw path, then
   shrunk to 512 / 256 / 32 / 16. Real runs, 3x3 looked at: grass, cobblestone, water (the
   phase 0 failure: `waves, ripples` without "tile" gives clean swirls) and dirt show no
   seam at 1x. **What was found:** at denoise 0.95 (the server erases the cross and draws it
   from nothing) the seam at the edge goes but the *cross itself* shows - another green,
   less texture; at 0.6 (it keeps what is under the mask and only heals the join) it does
   not. `tileSeam` cannot say this alone: the model's own tile scored 2.2 - 5.7, the mended
   1.3 - 3.5, the ranges overlap, so it only tags "seam visible" over 4. **Not good yet:**
   dirt at "simple" is a flat orange, not soil; a plain shrink to 32 / 16 px averages the
   detail away (grass becomes one green) - the pixel look (phase 6, below) cuts colours, it does not bring texture back. Not done: the
   ground "view" row (a tile is from above only), lava / snow / wood / sand were not run.
4. **Characters.** One sprite per view, with a pose list (idle, walk, run,
   attack, hurt). Directions and frames through the 3D figure and the depth
   ControlNet that Draw this pose already uses: the figure turned to 4 or 8
   yaws, or set to a walk cycle's keyframes, each drawn with the same seed and
   the same words, then aligned on the feet. *Done when* 4 directions of one
   character are recognisably the same - and if they are not (SDXL does not keep
   a face between pictures), the view says so and offers the next step: the
   frames as candidates to pick from, with onion-skinning, not as an animation
   that was promised. **First slice done 2026-10-16: directions only; the pose list
   (idle, walk...) and onion-skinning are not.** Character kind in the Game assets
   view: the figure and pose set in 3D forms are turned to 4 or 8 yaws (the camera
   goes round; 0 = the figure's front), a depth map per yaw (`formsDepthSnapshot` on a
   copy of the scene), all framed round the union of their boxes (`genFrameImage`), drawn
   with one seed and the same words but the facing (`CHAR_FACE`), cut out, scaled to the
   median height and set feet-on-one-line in one frame (`assetAlign`). Real runs, looked
   at: **the name must be the whole look.** "girl knight" gave a knight in front and
   behind and a white faceless silhouette at the sides, with different shorts; "girl knight,
   short brown hair, silver armor, blue skirt, blue boots" gave one recognisable
   girl in all 4, and "girl archer, blonde ponytail, green tunic, brown boots" in all 8
   (hair length and trouser colour drift a little). The first run also lost the colours
   to the 40-character cut of a name (now 120 for a character). **Not good yet:** a light
   glow round some cut-outs (frontLeft, backLeft: the model draws a coloured halo
   `cutOut` takes as part of the figure); the front's face went red once; nothing says in the view that two directions
   differ - it only tells you to judge the faces.
   **Poses, 2026-10-18** (`js/charpose.js`; the Pose row in the Character kind): Idle, Walk, Run, Attack, Hurt.
   A cycle (walk, run) is 4, 6 or 8 frames (a slider), found from one angle round the circle: the legs
   in opposite phase, an arm opposite its leg, a knee folded only while its leg swings forward; the
   last frame leads back to the first, not to a copy of it. An attack is four keys (ready, wind-up,
   strike, follow-through) blended to the frames chosen. Each frame is the figure with that pose in a
   copy of the scene (the one in Forms is not touched), facing right, drawn with one seed and the same
   words but what she is doing; cut out, lined up, kept tagged `walk`, `frame 3 of 6`. Looked at: the
   8 poses of each action rendered by the real 3D engine (walk, run and attack read right; hurt was
   reworked once), and a test holds every pose inside the figure's joint limits (it found a chest
   twist of 35 against a limit of 30). **Real run (Animagine, ControlNet 0.5, 4 frames of a walk, final quality,
   ~70 s):** the same girl in all four, and the legs do read as a walk. What it found in the cut-out, fixed:
   a white-pink border (the model draws its sticker edge on a key colour too) on some frames and not others,
   which would flicker in a loop - on a key colour `assetDefringe` took no border off, to spare a white cloak;
   now it takes a light edge pixel off only where her own dark outline is within a few pixels behind it
   (`behind`, FRINGE_KEYED_LIGHT 180), and a white garment with no outline stays; and a flat dark floor
   shadow wider than her feet, which makes the frame wider and puts the feet line low (`assetDropShadow`: a column
   whose lowest dark pixels are few and have nothing above them, counted over the ground only, so a toe or a heel
   is not one). **Still there:** the model drifts a little between frames (skirt length, hair, the torso of a
   passing frame drawn wider); the loop playing, run / attack / hurt on the model, and the pixel look over
   frames are not tried; onion-skinning is not done.
   **Run, attack, hurt on the model (same day, final quality, 4 frames each):** run reads as a run in every frame;
   its first words (`running, dynamic pose`) blew the hair out long in half the frames against "short brown
   hair", now `running, mid-stride` (the hair still drifts, less). Attack: the model draws the weapon only in
   the frames where the hand happens to hold one - with "holding a longsword" in the look it is in all four, so
   the view now says to name what she holds. Hurt: the first pose (spine -14, head -22) came out as a calm
   stance with a hand on the hip; thrown back as far as the joints go (spine -25, chest -18, head -25, arms
   flung out and back, knees folded) the head is back and the face reacts. **Not tried:** idle; the pixel look over frames.
   **One sheet, not one picture a frame (2026-10-18, the user: "the character jerks in different directions").**
   Measured on a 6-frame smooth walk drawn frame by frame: bottoms and tops of the frames within 4 px, so the
   lining-up was fine, but six different girls (skirt, hair, armour, the sword's place all changed). SDXL does not
   keep a person between pictures; there is no IP-Adapter or LoRA on this ComfyUI. So the frames of a cycle are
   drawn **together**: their depth maps are laid in a grid on one 1216 x 832 control picture (4 frames 2 x 2, 6 is
   3 x 2, 8 is 4 x 2; `charSheetLayout`, `assetSheetJob`), drawn once ("character sheet, N poses of the same
   character, same outfit and same hair in every pose"), and cut back into cells (`charSheetCells`, 3% in from each
   edge). Real run, 6 frames: the same girl in all six, legs read as a walk, centred to within a pixel. Cost: a
   frame is about 330 px tall (a cell), and a sword "sheathed on the hip" is not drawn. Idle, Hurt and the directions
   (4 / 8 turns) are still one picture each. Found on the way, all fixed: the sheet's fill was the *average* of the
   first depth map (grey) and not its corner (black), so the model drew six panels with white gutters and the cut-out
   kept each panel whole; the paler magenta of a cell (196 118 210, 92 between channels) fell under KEY_SATURATION 100,
   so it was not taken for a key (now 80; a cream is 25, a grey 0); and the white-border removal took 8 px off a figure
   a third of the old size and ate pale skin in blocks (now 1 px in 125 of the figure's height, 2 to 8). Idle on the model:
   18 s, clean; a thin floor line with a soft edge outlived the shadow cut (`assetDropShadow` now skips the pale rows above and
   under a dark line and takes grey slivers once a shadow is sure). Also in the player: Save GIF (own LZW encoder, `js/gif.js`),
   onion skin, one pixel palette over all frames of a cycle (`assetPixelFrames`). **Not yet:** the sheet in the pack as an
   animation; Run / Attack / Hurt drawn as sheets on the model (only Walk was); the user has not watched the loop play.
   **Artifacts after the one-sheet release (2026-10-18, the user: "characters look bad, many artifacts, especially in the
   animation, but not only").** Found on the real model, by keeping the raw picture and replaying the cut-out on it, with a
   count of the pixels still the key's colour (1157 to 7292 a character before; every one was looked at). Four causes, each
   with a test. (1) **The sheet was cut as 3 x 2 whatever the model drew**: 6 asked came back as 10, 13 and 20 poses; sliced
   through, a figure was a boot with no leg and specks in the air. Now the figures are found (`charSheetFigures`: the rows
   they fill make bands, the columns in a band make figures), more than asked are spaced out, and a sheet with the wrong
   count is drawn again with another seed, up to 3 times, the nearest kept; the status says what the model drew. (2) **A
   sheet's key came back lavender** (163 155 195, saturation 40), under the 80 that makes a key, so it was cut as a paper:
   the gap between the legs and the border stayed. A sheet is known to be on a key (`assetCutFigure(.., { sheet: true })`);
   a cream or a grey still is not one. (3) **Small gaps and a hem of the key**: the gap under a heel (150 px) was under the
   cut-out's floor of 0.05% of the picture, and the blend of outline and key (a black line on magenta is a dark magenta)
   stayed on hair and skirt, a palette colour once pixelled. A key colour has no part of her in it: gaps of 6 px up are
   background (`KEY_HOLE_MIN`), and pixels with the key's hue on the outside are peeled (`assetDespill`; not for a pale key,
   whose hue is too weak to tell from her blue). (4) **The border came off where there was none**: the sticker border is
   taken off by light pixels on the edge, which bit pale legs and grey armour out in steps once the sheet's words stopped
   drawing one (white outline, sticker, halo are in its avoid list now). It is taken off only when the ring of the figure is
   near-white (`assetRimPale`: 0.95 to 0.98 with a border, 0.07 to 0.19 without; the line is 0.5). **Not fixed, the
   model's:** magenta painted into the figure (a pink thigh, a pink tunic), a face lost at 48 px, hands that touch on a
   sheet and so are one figure to the projection (the redraw covers it), and the sheet's lower detail (armour often
   comes back as a grey jumper).
5. **Backgrounds.** Biome and time of day; far / middle / near layers made
   in order, each told what is in front of it; a layer that loops sideways;
   Extend (already built) for a longer one; a room or map from above. *Done
   when* three layers laid over one another read as depth and the loop point is
   not found by looking.
6. **Pixel it and the game style.** The shrink and the palette, the Game style
   kept and applied to every kind, a style check (the palette share of an asset
   against the style's). *Done when* a sprite, a tile and an icon from one style
   share a palette and an outline. **In place** (`assetPixelate` in `js/assetsfx.js`,
   the "Pixel look" choices in `js/assets.js`): a grid of 16 / 32 / 48 / 64 on the longest
   side, 8 / 16 / 32 / 64 colours (median cut; a box narrower than 20 on every channel is
   one colour, 6 for a tile), a one-pixel outline in the palette's darkest colour (not on
   a tile), alpha on or off, never half. Applied to every kind in `assetFinish` and to a
   character's directions after they are lined up; the icon is made at 128 and pixelled
   after, so its frame draws from the same palette; a tile's size is the grid. **One
   palette for the game** (`Palette: One for the game`): kept in the browser, handed to
   every picture and grown by it - a pixel near a colour already there takes it, only
   what is not there is cut anew, at most a third of the room left and at least four
   while there is room, so the first picture does not leave a tile nothing. Real run
   (2026-10-17, Animagine XL 4.0, a potion, a sword, a chest, grass, 32 px, 32 colours,
   looked at): sprite, icon and tile share one palette and one dark outline; at 16
   colours the grass was lost (the first pictures filled the palette: brown and grey
   where it was green), at 32 it is there. **Not good yet:** the tile is a flat green -
   the model drew grass with almost no texture and averaging 1024 to 32 takes what is
   left (a tile recipe matter, step 3); the palette is learned from the pictures, not
   chosen (the Holbein box and the Colour studio's palettes are not offered); a style
   check (the palette share of a picture against the game's) and the game style as one
   saved thing (view, theme, simplicity beside the pixel choices) are not done.
   **Since** (tiles and the box): `Palette: Holbein box` draws every pixel in the nearest
   of the box's 28 tubes (a fixed palette, never grown; the colours choice is hidden);
   the pixel choices end in one "Game style (kept)" line. Tiles: snow no longer asks for
   blue, grass asks for shadows between blades and keeps "flat color" out, and a tile
   whose lightness varies less than 5 (`tileFlatness`) is tagged `flat` instead of being
   passed off as a texture. **Not verified on the real model:** the new grass and snow
   words (unit tests only); a flat tile is tagged, not redrawn. Still open: the Colour
   studio's palette as the game's, the style check, view/theme in the saved style.
7. **Sheets and export.** Pack, JSON atlas, Tiled `.tsx`, the animation strip
   with a preview that plays, a GIF of it; the asset pack as one zip. *Done
   when* a pack loads in Godot and Phaser without a hand edit (tried, not
   assumed).
   **In place** (first slices 2026-10-17/18): Pack for a game (zip of a sheet, sprites, tiles) for Unity, and
   the animation strip: the frames of an action in one row of equal cells (`charStrip`), kept as one
   picture tagged `animation strip` and packed to `animations/`, not on the sheet (its frames are there);
   a player after Make (loop, pause, next frame, 4 - 12 fps) to judge the cycle by seeing it move. **Not
   done:** the GIF (no encoder in the app), playing an old strip again later, a Unity .anim.
8. **Blob autotile and UI.** The 47-tile terrain set from two textures; panels
   and buttons with a 9-slice; icon sets (a theme, 12 icons, one frame).
9. **Models, if the above wants them** (each is the user's install, and an item
   on the get-models script of the Generate notes): a pixel-art LoRA (needs a
   `LoraLoader` in the server's graph - not there yet); a line-art ControlNet
   (colour a sketch, keep the outline); IP-Adapter or a trained LoRA for the
   same character across frames, the one real fix for the drift of phase 4; a
   background-removal node for pictures with no plain background.

**What will be hard, said now.** The model is an anime one: a prop asked for
without `no humans` becomes a girl holding it, and a "tree" arrives with a
landscape behind it - every kind needs its keep-out tags (the way Generate's
`no humans` for all but a character was found). True orthographic top-down and
true isometric are rare in its training; expect three-quarter views and fix the
rest by choosing the view's tags carefully, or by the depth ControlNet over a
3D box or figure (the app has both). Pixel art made by shrinking a painting is
good, not what a pixel artist draws. A character's face will change between
frames. None of this is a reason not to build it; it is why phase 0 comes
first and why the table, not this text, is what the recipes are built from.

**Phase 0 results** (2026-10-16; Animagine XL 4.0 through the real server, 4 fixed seeds
per cell, three rounds, every picture looked at; the sheets are not kept, the tags are).

The first round used only the subject and the view ("from side", "from above"): it gave
anime *illustrations* - lit, glossy, with a floor, a fog, a whole scene - not game assets.
What turns them into 2D is two lists, added to every kind:

- **Style words**: `game sprite, 2d game asset, flat color, cel shading, thick outline,
  simple background, white background`.
- **Avoid**: `shadow, cast shadow, gradient, glossy, shiny, depth of field, 3d, realistic,
  floor, ground, lighting`.
- **Simplicity** is a third list and a setting of its own (simple / medium / detailed):
  simple adds `minimalist, simple design, limited color palette` and avoids `detailed,
  intricate, ornate, complex, texture, patterns`. Without it the output is far too busy
  for a game.

| Kind x view | Verdict | What to say | What fails |
| --- | --- | --- | --- |
| Character, side | works (3 of 4) | `1girl, solo, <who>, full body, from side, side view` + style, avoid `chibi` (the user dislikes it) | a floor ellipse under the feet (avoid `floor`) |
| Character, top-down | works (3 of 4) | `from front, from slightly above, rpg sprite, 2d rpg character` + style, avoid `chibi, island, diorama, background objects, foreshortening` - the way a classic RPG draws it: seen from the front, tilted a little, not a camera above her | `from above` alone gives a strong foreshortened shot (big head, short legs) or a floating island with ruins |
| Character, top-down, from behind | works (4 of 4) | the same with `from behind` instead of `from front` - the "up" direction of a 4-way walk | - |
| Character, straight down | fails | - | the same three-quarter view as top-down; the model has no "directly above" |
| Character, isometric | fails | - | an isometric *scene* (a person on a tile island), not an isometric figure |
| Prop, side / top-down | works (4 of 4) | `no humans, <thing>, closed, front view` or `from above, 3/4 view`, `object focus` + style; avoid `open, gold, coins` | without `closed`: the lid opens and the chest is full of gold |
| Prop, isometric | half (2 of 4) | `isometric` + avoid `tile, platform, island` | a base slab under it; one opens the lid; one on a dark background |
| Weapon, sword / spear / axe | works | `(single <thing>:1.3)`, `full length, centered, vertical, pointing up, object focus` + avoid `multiple, set, rack, border, frame, card, plaque, panel, backdrop` | a faint light rim on the blade (white sticker edge, taken off by `assetDefringe`) |
| Weapon, bow | half (1-2 of 4) | `archery bow, curved limbs, bowstring, vertical` + avoid `ribbon, hair bow, bow tie, arrow, quiver, hand`; cut with `holes:true` | the sword's words ("vertical, pointing up") made a *ribbon bow on a stick*; with its own words one in four is a scythe or a bow with a crossed arrow. Not tried: the same with `holes:false` |
| Weapon, shield | works (4 of 4) | `front view, emblem`, 1024 x 1024, avoid `pointing up, vertical, sword, spear, weapon` | asked tall and vertical it came as a framed card or a window |
| Weapon, mace / hammer | works | the sword's words + the backdrop avoid words | a hammer's head often reads as a spear or a mace; a cream sticker rim, gone with the defringe |
| Weapon, on a key colour | **rejected** | - | the model paints the object itself in the key colour: a shield half pink, a hollow shaft pink, a blade pink. Cream background + backdrop words + defringe is better |
| Item, potion / book / gem / ring / mushroom | works (3 of 4 or better) | own words per item (`ITEM_RECIPES` in `js/assets.js`): `(single <thing>:1.3)` + `one glass bottle, cork stopper` / `closed hardcover book` / `cut gemstone, faceted, close-up` / `plain band ring` / `one mushroom, cap and stem`; a ring and a key are cut with `holes:true` | with the general words: a row of three bottles, a ring filled with white |
| Item, apple / coin | half | `whole apple, stem and leaf` / `round gold coin, close-up` | an apple in a stone frame (one in four is not cut at all); a coin on a rounded card, or a speck in the middle of the picture, blurred when the trim enlarges it |
| Item, key / scroll / heart | weak (1 of 4) | `skeleton key, ring head, long shaft` / `old parchment scroll, partly unrolled` / `red love heart` | a key's "bow" is a ribbon to the model (as a bow was), so it is never in the words; "paper roll" gave a mug and a tube; a heart comes in a frame or as a badge. Word tuning stopped after three rounds: the model, not the recipe |
| Item, any | - | avoid `pixel art, pixelated, low resolution` | the model drew a pixel key, coin, heart and mushroom, coarse and blurred once enlarged; the pixel look is made afterwards (phase 6) |
| Tile, grass | works | `grass, seamless texture, tileable, flat color` | a dull flat green (fine); seams not yet tested |
| Tile, stone | works (3 of 4) | `stone floor, cobblestone, flat color` | some white gaps between stones |
| Tile, dirt | half | - | "simple" turns it into a brick / mosaic pattern, not soil |
| Tile, water | fails | - | mosaics, circles, yellow squares; needs another recipe (`waves`, `ripples`, no "tile" word) |
| Background, far layer | works | `distant mountains / hills, sky, clouds, flat color, parallax background layer` | a lit, deep scene at "detailed"; at "simple" a line-art landscape |
| Background, mid layer | works on a *green* background, fails on white | `tree trunks, silhouette, simple background, green background` + avoid `sky, ground, floor` | on white: poles, shadows and a ground; with fog the trunks go see-through |
| Background, near layer | works | `foreground bushes, tall grass, dark silhouette, along the bottom edge, green background` | none seen |
| UI, panel | works (4 of 4) | `empty rectangular panel, plain wooden frame, border only, empty center` | the centre is beige, not transparent (cut it out); the frame is thin and uneven, so 9-slice needs a straightening step |
| UI, ornate | fails | - | an ornament in the centre; a medallion, not a panel |

**Not found, so not promised.** Pixel art by words (`pixel art, 16-bit`): noise, the
figure lost among diamonds and splashes - without a LoRA it is a shrink of a
painting (phase 6), not a prompt. True top-down and isometric figures: not by tags -
the depth ControlNet over the 3D figure (phase 4). A single weapon: not reliably.

**Parallax.** A background is not one picture: *far* (sky, hills; opaque), *middle*
(trunks on a flat key colour, cut out) and *near* (bushes along the bottom edge, cut
out), each made on its own and each looping sideways at its own speed. So phase 1
(cut out) is a prerequisite of phase 5, not a side tool; and the layers must share a
palette (the lock of `js/genlock.js`), which one run of three prompts does not give.

Backgrounds of the pictures are often off-white or cream, not white - the cut-out has to
find the colour from the edges, not assume `#fff`.

**Server changes** (small, all in `ComfyClient.cs` / `Program.cs`): free
`Width` / `Height` (validated); `Kind` filed with the document (`asset:prop`,
`asset:tile`...); later `Lora` (name and weight, validated against ComfyUI's
list) and a `Batch` of N seeds in one job. The rest is the page.

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
- **Reference check, the rest.** In place (`js/quality.js`, Workspace >
  Value, a layer, Ctrl+K "reference"): five checks on the pixels, each ok, with
  care or poor - highlights that are pure white and shadows that are pure
  black (pink and blue over the picture; clipped pixels that the picture's own
  edge reaches are a backdrop and counted apart), the spread of lightness from
  the 2nd to the 98th percentile (flat light), the steepest edge found (focus;
  the top half-percent of the gradient, so one crisp eye passes a soft
  portrait) and the file's long side. The limits are estimates tuned by eye on
  a few pictures, not measured against a body of references; on a painting,
  bare paper reads as lost white. Still to come: a wide-angle lens distorting a
  portrait (a selfie's big nose and small ears - the face model can see it),
  a flash's hard shadow edge and red eyes, a colour cast, JPEG blocking, and
  the limits checked against a library of references people have called good
  and bad.

- **Search by colour, the rest.** In place (`js/colourfind.js`, the Colour
  button beside the library's search box): up to three colours - from the
  picker, twelve named ones, or a mood (warm dusk, autumn, forest, seashore,
  night, pastel) - and the grid keeps the pictures that have every one, the
  best match first; "Like this" on a cell shows the pictures closest to it.
  The server writes `palettes.json` (`PaletteBuilder`, after the features
  pass, cached on mtime and size): five colours per picture by k-means in
  OKLab, with each one's share - for the mounted packs and for uploads, which
  features.json does not cover. A picture counts as having a colour when part
  of it is within 0.105 (OKLab) of it; the first pick needs 4% of the picture,
  an accent 3%. The reach was tuned by eye on the six sample pictures (it
  separated a pink bob's pale pink from a black-haired girl's pale greys by a
  hair), not measured on a real library. Without `palettes.json` - GitHub
  Pages, a server that has not got to it - there is no Colour button. Still to
  come: a name for the colour in words ("rust", "sage"), searching inside a
  picture's own region (the sky is blue, not the picture), and colours of
  generated pictures at the moment they are kept.
- **Duplicate finder.** The backend finds identical and near-identical
  images (the same photo at different sizes) and offers to drop the
  extras.

## Watercolour

- **Layer plan.** From a reference, the order a watercolour is painted in,
  light to dark: what to leave as bare paper (or mask), the first light
  wash, the mid-tones, the last darks - each step as its own picture with
  its mixing recipe (paint.js). A watercolour counterpart to the session's
  build-up stages.
- **Mixing chart, the rest.** In place (`js/mixing.js`, Colour studio >
  Mixing, Ctrl+K "mixing"): the palette's paints with each other, at a light,
  medium or strong wash (in oil, three, one or no parts of white), in equal
  parts - one triangle, since A with B is B with A - or two to one, the whole
  square; the model's colours on screen with what a pair does (dulls, stays
  bright, granulates, stains), and a sheet to print and paint at the paper's
  real size (A4, A3, Letter, turned for the bigger squares, up to 16 mm), the
  squares empty unless asked, the paints numbered, a warning under 7 mm,
  corner marks outside the grid. Still to come: **the photo that calibrates
  the pigments** - the painted sheet photographed, lined up by the corner
  marks, each square's colour read and put in PIGMENTS against the model's,
  so the recipes become accurate for the painter's own tubes and paper (with
  Calibration from a swatch photo, below); a third ratio and the dilutions as
  a second sheet; choosing which paints go on the sheet from a large box;
  and the chart for pencils and markers, which cannot be mixed freely.
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

- **Vignette, the rest.** In place (`js/vignette.js`, Workspace > Composition
  and Onto paper, a layer, Ctrl+K "vignette"): interest from the gradient of
  lightness, colour strength and darkness, each over its own mean and
  blurred into masses; the island the most interesting places that hold 62,
  80 or 92% of it (Tight, Medium, Loose), rounded by a blur and a threshold
  and let out a little; the paper let in across a band, its edge shifted by
  noise (Soft, Ragged). The note names the shape, the sides it reaches and
  whether the darkest accent is kept. Still to come: a shape you drag by
  hand, a vignette on the Watercolour preview itself (the paper over its
  washes, not over the photo), a choice of shapes (an oval, a diagonal
  sweep, a rectangle with one corner dissolved), and the picture's own
  focus point leading it when it has one.

- **Weather for watercolour, the rest.** In place (`js/weather.js`, Prepare >
  Sky and weather > Weather, Ctrl+K "weather"): the air's temperature, humidity
  and wind set by hand or fetched from Open-Meteo for a searched place or where
  the browser says you are (coordinates only, only on a button), turned into
  minutes until a wash loses its shine and until it is dry to the touch -
  `wxDrying()`: the vapour pressure deficit times a wind factor, anchored on
  22 C, 50%, still air = five minutes, sun on the paper half as fast again,
  indoors still air - with advice for the day and for frost, heat, wind and
  rain, the next twelve hours with the best one marked, and the sunset's golden
  hour. The anchor is a rule of thumb, never checked against a stopwatch and a
  real wash. Still to come: the model fitted to the painter's own timings (time
  a wash, tell the app, and the anchor moves), different papers (hot-press,
  rough, a sized sheet) and a thick wash against a thin one, a day's plan as
  strips (when to do the big sky, when the detail), and ink, gouache and oil
  - ink dries like a wash, oil by other rules.

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
  paint and photograph, calibrating the mixes (with the Mixing chart's photo), and
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

- **Ink wash jars, the rest.** In place (`js/jars.js`, Workspace > Value, a
  layer, Ctrl+K "jars"): 3, 4 or 5 jars of black, sepia or indigo, equal steps of
  L* from the paper to neat ink, each thinned by bisection on the wash model of
  one pigment (the darkest jar is the neat ink, taken as 4 times paint.js's wash
  strength 1 - a guess at a bottle's density). Still to come: real inks (a
  bottle's own colour and density from a swatch photo), mixing two inks in a
  jar, and glazing - one jar over another - as an alternative to one jar per area.
- **Hatching map, the rest.** In place (`js/hatch.js`, Workspace > Line, a
  layer, Ctrl+K "hatching map"): the lightness measured against the picture's
  own 2nd to 98th percentile and cut at a darkness of 0.14, 0.34, 0.55 and 0.76
  into five levels - bare paper, one layer, crossed, three, four; a numbered map
  with each level's share, or the picture drawn in strokes at 45, 135, 0 and 90
  degrees, open or close. The cuts are estimates, not checked against a drawing
  made by hand. A liner takes a size for each layer (HATCH_PEN_MM: 0.1, 0.1,
  0.2, 0.3 mm), drawn at that width; a ballpoint is drawn by pressure instead,
  with the whites that cannot be put back marked first - both starting rules, not
  measured on paper. Still to come: strokes that follow the form (the Stroke
  direction field) rather than straight parallels, a pen set of your own for the
  layers, a ballpoint's pressure measured against your own sample strip, and a
  printable plan.

Watercolour pencils - two states: dry, the layers mix optically with the
paper's tooth showing through; wetted, the pigment dissolves and it is
watercolour, so the wash model applies:

- **My pencil set.** Colour charts of common watercolour pencil sets
  (Faber-Castell Albrecht Dürer, Derwent Inktense and Watercolour,
  Caran d'Ache Supracolor...). Pencils cannot be mixed freely like paint,
  so without knowing the set a recipe is useless.
- **Layer recipes.** For a colour: the order of layers, the pressure, and
  whether to wet it - "183 light -> 187 over it -> go over with a damp
  brush". Order matters.
- **My marker set.** Copic markers (alcohol, not water) with their codes
  (Sketch, Ciao, Classic...): the nearest marker to a colour, and a pair to
  blend it from. Copic's own codes carry the blending: markers of one family
  (the letters) blend into one another by their number.
- **Blending groups.** Runs of markers in a set that blend smoothly into
  one another, suggested for a gradient in the photo, and how the set's
  codes are organised.
- **Grey markers for value studies, the rest.** In place (`js/markers.js`,
  Workspace > Value, a layer): the photo split into areas for the greys of a
  set (`MARKER_SETS`: Copic Sketch's neutral, cool and warm greys, N0 to N10,
  C0 to C10, W0 to W10), each area with its marker's number; three, five, seven or all,
  spread between the picture's own 2nd and 98th percentile and matched each to
  its nearest marker, the paper left white, a key with each grey's share. The
  codes are the maker's; each one's lightness (L*) is an estimate. Still to
  come: other makers' sets and your own (My marker set), warm and cool greys
  tinted in the key and not only told apart by name, runs that blend for a gradient
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
- **Presets by medium, the rest.** In place (`js/presets.js`, the Timing tab's
  Kind of session): six kinds, each a secs, a schedule, stages, grayscale and a
  list of layers to switch on at the start (`presetStart()` in `startSession()`),
  recognised by the controls and not remembered. The lengths and the overlays are
  my choice by feel, not what a teacher would set. Still to come: kinds of your own
  (save the current controls and layers under a name), a kind for the medium you
  have in My materials chosen for you, and a kind that changes with the weeks of a
  course.
- **Calibration from a swatch photo.** Swatch your own pencils or markers
  on your own paper, dry and wetted, photograph it, and the app takes the
  colours from your materials - the published charts are approximate. The
  Mixing chart item, for every medium.

## Colour

- **Master palettes.** Ready palettes taken from known paintings and
  watercolours (Sargent, Sorolla, Turner, Zorn), to lay over a reference
  with In gamut.
- **Skin tones, the rest.** In place (`js/skin.js`, Colour studio > Skin, Ctrl+K
  "skin"): nine complexions under the Light tab's six lights, each as light,
  halftone, shadow and reflected light (the shadow with the skin's red glow, the
  halftone at least 8% more colour than the light, the reflected light the fill
  plus a third of the light bounced off earth, white, grass or blue), a lit ball,
  and a recipe from the palette for each zone plus a glaze for the shadow in
  watercolour. The nine skin colours are estimates, not measured off anyone.
  Still to come: skin from a photo (pick the light, halftone and shadow of a
  face and see which complexion and light they match), blush, lips and ears
  (where skin is redder), age, make-up, and a printable sheet of the four zones
  as swatches to paint.
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
  lists them. Seasons and times of day are in (`js/seasons.js`, a row of
  chips above Harmony): eight hand-chosen scenes of six colours each, what
  makes each one and what to do with it; the colours are my choice by eye,
  not sampled from paintings. Still to come: more scenes (rain, snow at dusk,
  the golden hour, a desert, the sea), a scene's palette made from a picture's
  own season, and a scene that suits the reference you are working from.

- **The best limited palette for a reference, the rest.** In place for
  watercolour (`js/fewpaints.js`, Palettes > Fewest paints, a reference's
  colours come there from the Colour studio's "To the palette generator"):
  at most 2 to 5 paints from the paints chosen above (the Holbein box, or any
  other palette), the paper being the white. Each colour is mixed as well as a
  set can (`paintRecipes` given only those paints, scored in the recipes' own
  OKLab x 100), the set built one paint at a time and then each paint tried
  against every other; a paint that brings the mean closer by under 0.5 is
  dropped, so "one paint is enough" is an answer. It says how many colours land
  close (under 4), the furthest, and the recipe for each from the chosen paints
  only. A few seconds in the full box (1 s for three paints, 5 s for four).
  Still to come: "5 markers" and pencils (no mixing: the nearest ready-made
  colours, and for Copic its families), oil and acrylic, weighting the colours
  by how much of the picture they cover (the palette carries none), and
  checking the answer against painted swatches of the real tubes - the box's
  colours are still estimates.
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

- **Painting check.** In place (`js/paintcheck.js`, the last three choices of
  Compare your drawing, "Where it parts"): the photo, laid over the reference as
  Compare lays it, is read in the reference's frame at 120 cells and mapped in
  OKLab - darker / lighter, warmer / cooler, stronger / greyer. The photo's overall
  light and cast are matched to the reference's first (a dim room is not an
  error), the map is softened by a few cells (brushwork is not an error), and the
  note names the two zones of nine where it parts most, with the overall shift
  that was taken out. Still to come: a per-colour reading ("your shadow is
  bluer than the reference's"), the share of the painting off by more than a
  threshold as one number to watch over weeks, and keeping a check with the
  photo. Not tried on a real phone photo of paper.
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
- **Digitise your work.** In place (`js/digitise.js`, Compare's "Clean scan..."): you click the
  page's four corners on the photo; it is stretched back to a rectangle (a projective map,
  bilinear), and the paper under the marks - the brightest fifth of each block - is divided out
  channel by channel, so a shadow, the lamp's tint and the phone's white balance go and the paper
  comes out white. "Line drawing" uses small blocks, "Painting" large ones (a quarter of the side), so a
  wash narrower than that is kept; a wash wider than the block is still bleached - the limit of
  estimating paper from the picture itself. The scan replaces the photo in Compare and is kept in My
  work (`from: 'work'`, tag `digitised`, `reference` = the pose it was drawn beside). Not tried on a
  real phone photo. Still to come: the corners found by themselves, a rotate / mirror step, the paper
  taken from a sample you click on a clear patch, and the portfolio site using the scans in place of
  the photos (below).

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

- **Stroke direction, the rest.** In place (`js/flow.js`, Workspace > Line, a
  layer, Ctrl+K "stroke"): short strokes along the form where the picture has a
  direction to give - the lightness gradient's structure tensor averaged over a
  neighbourhood (a stroke runs at a right angle to its axis), kept where its
  coherence and its trace are enough, so a flat patch gets none; coarse, medium
  or fine; the note names the direction most strokes lean to and whether it is
  one direction (a plait) or many (a face). Still to come: strokes joined into
  curves that follow the field rather than short straight ticks, the field
  turned into the Hatching map's strokes (see Ink) and a choice of across the
  tone for grass and rain.
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

- **Handbook, the rest.** In place (Practise > Handbook, `js/handbook.js`):
  four lessons - light on a form, aerial perspective, mixing, value against
  colour - each with theory, a demonstration to move, things to try and what
  you should have seen. Still to come: lessons on edges, on composition
  (with the schemes), on perspective (with the grid), on temperature; the
  light lesson on the real 3D forms rather than a small ray tracer; and a
  quiz at the end of each, kept with the trainer's scores. A third chapter, Pen
  textures (`js/pentextures.js`), is in: wood, stone, foliage, fur, water and brick
  as rules for the hand, each drawn from a few numbers with a pen size from 0.05 to
  0.8 mm, and a practice sheet to print. They are models of a hand's habit, drawn
  by eye and not compared with a pen drawing by hand. Still to come: more textures
  (hair, cloth, glass, metal, clouds, sand, skin and pores, feathers, scales), a
  texture drawn onto a shape of your own, the practice sheet at the true scale of
  the pen on your paper, and a photo of what you drew checked against the rule.

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

- **Skies, the rest.** In place (`js/sky.js`, Prepare > Sky and weather >
  Skies, Ctrl+K "sky"): a sky from noise, `skyRender()` - six times of day, six
  kinds of cloud (clear, cumulus, a broken layer, overcast, cirrus, storm), a
  cover, and nothing, low hills or the sea beneath; the clouds' deck seen in
  perspective, lit by a second sample of the noise toward the sun, their colours
  measured off the picture and a note on how to paint that sky. The colours are
  tuned by eye, an estimate of a sky's and not a measurement of one, and a
  cloud's shape is noise rather than a model of the air. Still to come: sunrise
  and sunset with the sun's light on the land (the hills lit from the side),
  mist and rain, a moving sky (the same one an hour later, as a series for
  cloud studies), the sky of a given place and time from the weather's own
  cloud cover and the sun's real position, trees and a skyline to put under it,
  and the picture at a larger size than 960 by 540.
- **Techniques guide, the rest.** In place (`js/techniques.js`, Practise >
  Handbook, a second chapter after the four lessons; Ctrl+K "handbook"): salt,
  spatter, dry brush, lifting and masking fluid, each as theory, a demonstration
  drawn from a few numbers (a wetness window for salt, drops of lognormal size in a
  gaussian cloud for spatter, a paper tooth of value noise and a brush that runs
  out for dry brush, the Pigments tab's lifting numbers for lifting, shapes of bare
  paper under a wash for masking), things to try and what to see. The models take
  what decides each effect in practice and no more, and are not checked against
  real paper. Still to come: wax resist, scraping and scratching, blotting, the
  granulating glaze, wet-in-wet and back-runs (the weather model already knows
  when a wash is damp enough), alcohol and plastic wrap, and a photo of the
  real effect beside each demonstration.

## Composition and references

- **Composition analysis, the rest.** In place (`js/composition.js`, Workspace >
  Composition, a layer, Ctrl+K "composition"): interest from OKLab contrast (the
  distance from the picture's mean colour, averaged with a centre-surround
  difference), weight as the interest squared and its centre of mass against the
  middle, the strongest straight lines by a Hough vote of the edges (diagonals
  that pass near the centre of mass "lead"), and the three best crops among
  eight shapes and four sizes scored on interest kept, nearness to a thirds
  point, interest cut by the crop's own edges and density. All of it heuristic
  and tuned by eye on a few pictures. Still to come: a real saliency model (faces
  and text pull the eye far more than contrast does), weight from size and edge
  as well as contrast, curved leading lines (a river, a road), a crop that can
  be saved as a copy, and the scheme of Composition schemes that fits best.
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
  against it. For a liner, three sizes for the three classes of line (a Fine,
  Standard or Bold set, 0.05 to 0.8 mm), with each pen's share of the drawing
  and the lines shown coloured by pen. Still to come: pens of your own (the
  sizes and brands you have), and a drawing's line weights read back from a
  photo of your own pen drawing.
- **Museum search.** In place (`js/museum.js`, Prepare > Museums): the Met
  and the Rijksmuseum searched from the app ("Sargent watercolour"), a
  picture opened in the workspace at 1600 px or at the museum's original,
  with its licence shown and its credit to copy. Still to come: the Art
  Institute of Chicago - its image server answers a browser with a Cloudflare
  bot check, so it needs the container's backend as a proxy (and is then not
  on GitHub Pages); and a painting opened straight into a master copy with
  build-up stages.

- **Classic composition schemes, the rest.** In place (`GRID_STYLES` in
  `js/session.js`, the Grid overlay's picker under Display, in a group of
  its own, *Lay a shape*): Carlson's and Loomis's S-curve, L, steelyard,
  radiating lines and triangle, worked out in the picture's W x 1 frame
  like the armatures so a ring stays round and a curve keeps its shape on
  any format; the steelyard's two rings balance (areas 4 : 1 at distances
  1 : 4 from the fulcrum). A line under the picker says what the chosen
  guide is for (`GRID_NOTES`). Still to come: the scheme fitted to the
  picture (the S-curve through its own masses, the triangle round its
  subject), a cross and a circle, and the shape dragged by hand.

- **Streets of the world.** Open street-level photos from Mapillary (like
  Street View, but freely licensed) as references for urban sketching of
  any city.

## Before painting

- **Simplify into shapes, the rest.** In place (`js/simplify.js`, Workspace >
  Value, a layer, Ctrl+K "simplify"): k-means in OKLab (lightness counted 1.8 times
  hue), trained on a blurred sample and applied to the unblurred pixels, so a
  blur's in-between colours do not become shapes of their own; 5, 8 or 12 shapes,
  a majority vote and islands under a size merged into their neighbours (broad,
  medium or fine); in colour or in value. Still to come: shapes outlined as
  vectors to trace or print, merging that follows edges and not colour alone, and
  painting the shapes only from the paints of the palette.
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
- **Perspective grid, the rest.** In place (`js/perspective.js`, Prepare >
  Perspective grid, Ctrl+K "vanishing"): one, two or three points on a
  horizon, on paper in millimetres (A5 to A3, Letter, square, 4:3, 16:9 or
  your own size, either way round) printed at its real size through a hidden
  frame with an `@page` of the sheet, or saved as an SVG; lines fanned from
  each point over the angles at which the sheet is seen from it, so a point
  far off the sheet still fills it; plumb lines, and in one point level ones
  as squares counted from the horizon; the third point above or below. The
  note works out the view the two points give from the station point (the
  eye as far from the sheet as the geometric mean of the two distances from
  the centre line - a right angle between the points) and warns past 60
  degrees, says whether the horizon makes the viewpoint high or low, and how
  far each point is beyond the paper. Still to come: the grid laid over a
  picture (to check a photo's perspective against it, joining the Perspective
  check in a session), a station point you place by hand (a tilted centre
  line, points not symmetric), a measured scale along the horizon and the
  depth of a floor in squares, and the sheet in a project's kit once Projects
  are in.

## From photo to 3D

- **Pose from a photo onto the mannequin, the rest.** In place (3D forms >
  Pose > From a photo..., `js/posefit.js`): the pose model's world landmarks
  become the rig's angles, joint by joint (the twist of an upper arm or a thigh
  searched so that the elbow or knee folds the right way), and the figure is turned
  as the person is. Seen on two generated pictures (a standing contrapposto
  reads well, a girl lying on her side does not - the model gave an upright
  crouch). Still to come: the hands from the hand model, the camera's height and
  lens from the photo, two people in one photo, and a lying figure.
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
- **People in perspective, the rest.** In place (`js/people.js`, Prepare >
  Perspective grid > People): the horizon dragged to where it is, a white
  reference figure (feet, head, its real height) that fixes the eye's height
  (`ppEye()`), and adults, children and tall people stood by a click at the
  height the rule gives (`ppTall()`: proportional to the feet's distance below
  the horizon), the dashed lines through feet and through heads meeting on the
  horizon, on a street drawn to the horizon you set or a picture of your own.
  Still to come: people on a slope or a stair (the rule holds only on level
  ground), sitting and crouching figures, a figure's height read off the pose
  model from a photo to set the white one, the horizon found from a photo's
  vanishing points (the Perspective check in a session) and the picture's own
  people compared with it, and a crowd - rows of people at once.
- **A street of blocks.** A 3D street of simple building volumes, for
  perspective practice from any viewpoint.
- **Reflections in water.** A 3D scene with still water showing the rules:
  a reflection is vertical, darker than the object, and its length does
  not depend on the viewpoint the way a shadow's does.
- **Light through the day.** The same 3D scene at morning, noon, golden
  hour and under overcast, side by side on one grid - a Monet series.
- **Clothes on the figure.** Cloth simulated over the mannequin's pose:
  folds at elbows, knees and waist. Drapery exists; on a body it does not.
- **A real human body for the figure, the rest.** In place (3D forms > Shape > Human,
  `models/human.glb`, built by `scripts/make-human.js`): MakeHuman's CC0 base body, with fingers,
  straightened to stand arms-down and skinned to the figure's own 17 joints - the same names,
  limits and parents as the mannequin, at a real body's places - so the poses, the Body builds,
  Pose from a photo and the heads grid work on it unchanged (about 7.2 heads). The mannequin
  (Figure) stays as the plain view for practising forms. Still to come: a male body (MakeHuman's
  gender targets - the base is the neutral-female one), fingers that bend (they are rigid with
  the hand now), Character's depth map drawn from this body (not tried), the Bony landmarks and
  Muscle groups marked on it (they are switched off with no Figure in the scene), clothes over
  it, and Figure and Human as one switch beside Body instead of two forms. Anime, Long-legged,
  Chibi and Child are offered on the Figure only (`mannequinOnly` in `FIGURE_BUILDS`): scaled onto
  a real body they gave an adult face on a doll's or a child's body, so a Human is drawn
  Realistic whatever build it was saved in - an anime body would need a stylised base mesh of its
  own, not a scale. Asked for 2026-10-16,
  after the figure's depth map made every character a mannequin's silhouette.
- **Features.** The eye, nose, mouth and ear close up from the head scan,
  in the planes view - how light sits on each form alone.
- **Hatching, the rest.** In place (3D forms > Guides > Hatching along the
  form, a branch of the form shader in `js/forms.js`): ink by the tone the
  light has made, strokes along the surface's contour lines, crossed in the
  deep shadow. Still to come: the floor's cast shadow hatched, a pen and a
  paper of your own, and strokes at an angle a hand would take instead of
  the contour lines' exact ones.
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
