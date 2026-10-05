/* refboard - What's new: after an update, the features that came with it,
   each with a way to try it - so a new thing is not lost among a hundred
   others.

   Keyed by each feature's id, not by the version: the web page is deployed
   on every change, not only on a release, and a feature is new to you until
   you have seen it, whatever number it shipped under. A first visit sees
   none of it - everything is new then, and the tour is for that.
   Again from the footer, Help or Ctrl+K.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const NEWS_KEY = 'refboard.news.v1';
const NEWS_SHOWN = 4; // the rest fold under "Earlier"

// Newest first. `run` is what "try it" does.
const NEWS = [
  { id: 'wheel', title: 'Colour wheel',
    text: "Colour studio > Wheel: click or drag a colour on the wheel and pick a harmony - complementary, split, analogous, triad, tetrad, square, or one hue from pale to deep - and the colours that go with it are laid out round it, each with its hex and name. It is the painter's wheel, where yellow faces violet and blue faces orange (the Picture tab's perceptual wheel is one click away). The dashed line is everything your paints can mix: a colour past it is marked, and How to mix it finds the closest recipes. Start from a colour of an open picture, or send the harmony to the palette generator.",
    act: 'Show me', run: () => openColour('wheel') },
  { id: 'box', title: 'My Holbein box',
    text: "Colour studio > Pigments > My Holbein box: the anime set of 28 Holbein tubes laid out as the pans sit - four rows of seven, each pan its colour. Click one for its place, code and what it was bought for (skin base, night sky, glints in the eyes), and how it behaves on the paper; ask which fade and those pans stay lit. Recipes everywhere can mix from exactly these tubes, in the names on them. Chinese White is a pan, but held out of the mixing - it goes on last, for highlights. The colours and ratings are estimates until painted swatches from the real tubes correct them.",
    act: 'Show me', run: () => { setPaintPaletteKey('box'); openColour('pigments'); } },
  { id: 'pigments', title: 'Pigment guide',
    text: "Colour studio > Pigments: each of your paints as a test swatch - a wash from rich to pale, with a band lifted while wet - and what it does on the paper: whether it glazes cleanly, lifts off or stains, lies smooth or granulates, lasts or fades, and the pigment code to look for on the tube. Ask it a question - which of mine lift? which granulate? - and the answers stay lit. Recipes everywhere now carry a tag where it matters: granulates (with the smooth recipe beside it, for skin), stains, fades.",
    act: 'Show me', run: () => openColour('pigments') },
  { id: 'light', title: 'Light and shadow',
    text: "Colour studio > Light: choose the light - midday sun, golden hour, overcast, a north window, a lamp, moonlight - and every colour is shown three ways: its own, in that light, and in its shadow. Warm light and a cool shadow is the sun and the blue sky; by a window it turns round; under a lamp the shadow is only darker. Click a colour for a ball lit that way and a recipe for each side from your paints - in watercolour, also which one paint to glaze over the light colour for its shadow. Your character's colours too, from the Character tab.",
    act: 'Show me', run: () => openColour('light') },
  { id: 'lightbox', title: 'Lightbox',
    text: "Paint > Lightbox, or Workspace > Onto paper: your tablet as a lightbox, to trace a sketch onto good watercolour paper. Photograph the sketch; drag four corners onto the sheet's and it is straightened; Clean makes the paper white however it was lit, Dark lines turns a blue or red pencil as dark as graphite. Measure the screen once against a bank card and Real size shows it exactly as big as the sheet was. Mirror, turn, and Lock while you trace - touches do nothing, the screen stays on; hold the lock to unlock. Workspace's Learn tab is now Onto paper: how to draw it, the lightbox and the grid.",
    act: 'Show me', run: () => openLightbox() },
  { id: 'glazing', title: 'Glazing chart',
    text: "Colour studio > Glazing: every paint of your palette glazed over every other, as the chart painters paint - first washes down, glazes across. Click a crossing and it is set beside the other order and the palette mix: which paint veils when it goes on top (the opaque ones - cadmiums, ochre, black), which mix on the palette gives the same colour, and where two layers get darker than any single wash can.",
    act: 'Show me', run: () => openColour('glazing') },
  { id: 'greys', title: 'Grey ladder',
    text: "Colour studio > Greys: a warm, a neutral and a cool grey from the paints you picked, each one mix taken light to dark - with water in watercolour, with white in oil - so every grey in a painting stays related instead of going muddy. Each column says its recipe and each step how strong the wash is, or how much white; where your paints cannot make a cooler or warmer grey, the column says so. With a picture open, its own greys are marked on the ladder.",
    act: 'Show me', run: () => openColour('greys') },
  { id: 'lineweight', title: 'Line weight',
    text: "Over any picture in a session (k, or Workspace > Line): its contours drawn as ink, each as heavy as a line drawing wants - heavy on the shadow side, at the undersides and along the big outer contours, light on the lit side and for small inner lines, the ends tapered. An anime frame's own lines are redrawn, weighted. The note says which liner size, or how hard to press, for the line medium you have. Line is a new Workspace tab: line weight, lost edges and the angle tool.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'tangents', title: 'Tangents',
    text: "Over any picture in a session (n, or Workspace > Composition): a pink ring where two shapes just touch or nearly do, and an amber one where a shape just touches the edge of the paper. There the eye cannot tell which shape is in front, and the depth goes flat - overlap them or open a clear gap; move the shape in, or let it go clearly off. In a comic panel the border counts as the edge. Composition now has its own Workspace tab: the focal point, tangents, amounts and a crop.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'amounts', title: 'Which one leads',
    text: "Over any picture in a session (u, or Workspace > Value or My work): how much of it is light, middle and dark, warm and cool, hard-edged and soft, as three bars. A picture with a dominant - 60/30/10, say - reads as meant; equal amounts read as indecision, and the note says which it is and what to push. Each bar's Where? opens the map it counts. Works on a photo of your own painting too.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'temperature', title: 'Temperature map',
    text: "Over any picture in a session (t, or Workspace > Colour): orange where it is warmer than the picture as a whole, blue where it is cooler, and white lines where the temperature turns - most often at the edge of a shadow. The note says whether the light is warm and the shadows cool or the other way round, and what that means for cel shading and for mixing in your medium. Every overlay's note now has its own x, to turn just that one off.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'range', title: "What the paper can do",
    text: "Over any picture in a session (b, or Workspace > Value): where your medium cannot follow the photo. Violet is darker than the darkest mix you can make - watercolour goes to about L* 18, a liner to solid black - and amber is lighter than the paper, which is never quite white. Strong where there is detail that will be lost, faint where it is a flat mass that loses nothing; the note says how much of each, and what to do with it in your medium's terms. Change the main medium in My materials and the range follows.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'anime-shots', title: 'Anime camera angles in 3D',
    text: "The 3D view's Camera group has Anime shots: Worm's eye (down on the floor, looking up - the figure towers), Bird's eye, Wide and close (the fist thrust at you comes out huge), Dutch angle (a new Roll slider tilts the picture), Telephoto (depth flattened) and a real Fisheye, where straight lines bow round the middle. Each moves only the camera - which side you see stays yours - and Draw this shot sends it to Generate's new Lens row.",
    act: 'Show me', run: () => openForms(() => showAnimeShot('worm')) },
  { id: 'pose-builds', title: "A photo's pose in anime proportions",
    text: "The pose skeleton (P) redraws the pose in the 3D figure's builds - Anime, Long-legged, Chibi - switched at the top of its note, or Ctrl+K \"pose anime\". Each bone keeps the photo's angle and only its length changes, standing on the same foot: a real pose, seen as anime would draw it, over the photo's skeleton kept faint, with a tick for every head down its side.",
    act: 'Open a photo', run: () => setView({ kind: 'drop' }) },
  { id: 'figure-builds', title: 'Anime proportions for the 3D figure',
    text: 'The 3D figure has a Body row above its pose: Realistic (about eight heads), Anime (seven - a bigger head, a shorter torso, longer legs), Long-legged (nine) and Chibi (two and a half). A pose carries over from one to another, so the same contrapposto can be seen in each. Heads grid draws a line every head down the figure, numbered, to check your own drawing against.',
    act: 'Show me', run: () => openForms(() => showFigureBuild('anime')) },
  { id: 'palette-generate', title: 'A palette to Generate',
    text: "In Palettes, Use in Generate sends the palette to Generate, where The picture has a Colours row: Your palette, with its colours on it, or Any. The model knows no hex, so the palette goes as the words it does know for a palette as a whole - limited palette, the hue that leads it, muted or pastel, dark or high contrast: the picture comes out in that range and mood, not in five exact colours - those, and how to mix them, stay in Palettes. Not for ink or pencil, which are grey.",
    act: 'Open Palettes', run: () => setView({ kind: 'palette' }) },
  { id: 'palettes', title: 'Palettes: a palette generator',
    text: "Prepare > Palettes: five colours in a harmony - analogous, complementary, split, triadic or one hue - spread over the values, a light and a dark among them. Space for a new palette; lock a colour to keep it, drag to reorder, open its tints and shades for a lighter or darker one, Undo, Copy, Save. Under each colour, how to mix it from your paints; Only what my paints mix makes only colours they can reach. In the Colour studio, To the palette generator takes a picture's own colours there.",
    act: 'Open Palettes', run: () => setView({ kind: 'palette' }) },
  { id: 'gen-clothes', title: 'Generate: clothes, and three more settings',
    text: "A Clothes row dresses the character as her Setting would - Everyday, Festive, Uniform, Armour or Winter: festive is embroidery and a wreath in a Slavic setting, a furisode in an East Asian one, a prince's cape for a Western boy. For figure study: Sportswear, Close-fitting, a one-piece Swimsuit or a Leotard. New settings: Modern, Steampunk and Post-apocalyptic, each with its own streets, land and temple. The long rows are sorted into kinds - the world, genres, figure study.",
    act: 'Open Generate', run: () => setView({ kind: 'generate' }) },
  { id: 'gen-beginner-2', title: 'Generate: a better Beginner figure',
    text: "Beginner no longer strips a figure down to a flat vector drawing with legs like sticks: she keeps the medium you picked - watercolour, ink, pencil, markers - with ordinary proportions, and with no Setting she wears a t-shirt and trousers instead of a gown with a train.",
    act: 'Open Generate', run: () => setView({ kind: 'generate' }) },
  { id: 'gen-prompt', title: 'Generate: see the prompt, switch off what it keeps out',
    text: "Prompt, above More tags, shows what goes to the model: the tags, and what your choices keep out - each of those a switch, so a tag like sepia or holding pen can be let back in; they stay off until you turn them back on. What the server always keeps out is shown too.",
    act: 'Open Generate', run: () => setView({ kind: 'generate' }) },
  { id: 'gen-beginner', title: 'Generate: Beginner, temples everywhere, two more media',
    text: "Detail has Beginner: the fewest shapes - straight hair, flat colour, thick outlines, one building on white instead of a street of a thousand windows. A Temple is the Setting's own - Slavic idols in an oak grove, a cathedral, a stave church, a mosque, a Hindu temple - not always a Japanese shrine. Ink is black lines and hatching, with no pen drawn into the picture. New media: Watercolour markers and Watercolour pencils. Each generated picture can be deleted with its cross, or all of them with Delete all.",
    act: 'Open Generate', run: () => setView({ kind: 'generate' }) },
  { id: 'gen-setting', title: 'Generate: a setting, and a shorter page',
    text: "A Setting row: Slavic (before Christianity - linen, a wreath, log houses behind a palisade, birch and oak), East Asian, Western Europe, Nordic, Middle East, South Asian, Fantasy or Sci-fi - clothes on a character, the buildings on a street, what grows in a landscape. The choices are in groups, two columns of them, and Generate stays at the bottom of the view.",
    act: 'Open Generate', run: () => setView({ kind: 'generate' }) },
  { id: 'head-fit', title: 'Head construction, on the head',
    text: "The head construction (L) and the pose (P) now sit where they belong: on a picture shown smaller than its own size - nearly every one - they were drawn shrunk toward its top left, the chin on the nose. The anime face over a photo is bolder and its note shorter; what each eye style is, is on its button.",
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'expressions', title: 'Anime expressions, and a sheet of them',
    text: "The 3D anime head in Joy, Anger, Surprise or Sadness - brows, lids, iris and mouth as anime draws them, with the blush, the vein and the tears - on its own Face tab, beside its hair and eyes. Expression sheet shows every expression at three angles in one picture. With a ComfyUI, Draw it at this angle takes the expression along, and Draw a sheet asks for one character's expressions.",
    act: 'Show me', run: () => openForms(() => showAnimeHead(undefined, 'joy')) },
  { id: 'anime-eye', title: 'The anime eye, in four styles',
    text: "TV anime, Shōjo, Sharp (tsurime) or Soft (tareme): the lash line's weight, the iris cut by the lids, where the gleams go - on a photo's anime head (the switch in the note) and on the 3D one, where the eyes take a colour too. The note under the 3D view says what the eyes do at that angle; a character sheet gives the head her hair and eyes in one click; Draw it at this angle asks the ComfyUI for the same eyes.",
    act: 'Show me', run: () => openForms(() => showAnimeHead('shojo')) },
  { id: 'anime-hair', title: 'Anime hair, in locks',
    text: "The anime head in 3D has hair: Short, Bob or Long, in locks as anime draws it, with the ring of light round the head - a band broken at each lock, which slides as you turn the head or move the light - and the fringe's shadow on the forehead. In the colours Generate knows, or a character sheet's; Draw it at this angle takes the hair along.",
    act: 'Show me', run: () => openForms(() => showAnimeHead()) },
  { id: 'anime-head-3d', title: 'An anime head in 3D',
    text: 'In 3D forms, Anime head: a head built the anime way, eyes drawn on, to turn and light. Its face is a flat mask - so the far eye narrows far less than on a real head, and the note under the view gives both numbers at the angle you see it from, with what to watch there. With a ComfyUI, Draw it at this angle makes anime heads from the same side.',
    act: 'Show me', run: () => openForms(() => showAnimeHead()) },
  { id: 'edges', title: 'Edge map',
    text: 'Over any picture in a session (x, or Workspace > Value): its edges in red where they are hard and blue where they are soft - on dry paper, or wet-in-wet - with how the two are shared out. Hard is how quickly the change happens, not how big it is. Also a step of How to draw it in watercolour, and Generate asks for soft or hard edges.',
    act: 'Open a picture', run: () => setView({ kind: 'drop' }) },
  { id: 'character', title: 'Character sheet',
    text: 'Her colours in one place, so the next picture of her matches: in the Colour studio, Character sheet - click the hair, the skin, the eyes, the clothes on a picture; the shadow and the light are worked out the anime way, each with how to mix it from your paints. Colours on a generated picture opens it there, and with a ComfyUI, Generate her draws her again as a turnaround.',
    act: 'Open it', run: () => openColour('character') },
  { id: 'whites', title: 'Save the whites',
    text: 'How to draw it in watercolour has a step before the first wash: the whites the paper must keep. Yellow for the small ones - a catchlight, a streak of shine on the hair - to cover with masking fluid; a blue outline round the big ones, to paint round. In watercolour a white painted over does not come back.',
    act: 'Show me', run: () => setView({ kind: 'drop' }) },
  { id: 'steps', title: 'How to draw it, step by step',
    text: 'Any picture in the workspace, taken back to the steps it is drawn in, for your medium: big shapes blocked in, the lines, then the first wash and the shadows for watercolour, hatching for ink, tone for pencil - each with what to do. Workspace > Learn, the Steps button on a generated picture, or Ctrl+K "how to draw".',
    act: 'Show me', run: () => setView({ kind: 'drop' }) },
  { id: 'generate', title: 'Generate references',
    text: 'Behind your own server with a ComfyUI set up (COMFY_URL): anime references made to order - a character, a landscape, buildings, nature or an animal, from where you choose, in the light, weather and season you pick, and the medium: watercolour, ink line, flat colour or pencil. Each is kept in Uploads, in the Generated group, tagged with what you chose.',
    act: 'Show me', run: () => setView({ kind: 'generate' }) },
  { id: 'samples', title: 'A sample pack to start with',
    text: 'With no library connected - the web page, or a container with nothing mounted yet - there is now a Samples pack: six anime girls in watercolour and a fine line, to browse and draw from with every tool while your own pictures are not there yet.',
    act: 'Show me', run: () => setView({ kind: 'all' }) },
  { id: 'sorted-uploads', title: 'Uploads sorted into folders',
    text: 'Behind your own server, every picture you drop is looked at - people, poses, faces, what it is of, its light and colour - tagged, and put in a folder: Figure, Portrait, Landscape, Animals... In the library they are groups of the Uploads pack, and the search finds them by tag: "sitting", "profile", "low key".',
    act: 'Show me', run: () => setView({ kind: 'drop' }) },
  { id: 'anime-head', title: 'Anime head on a photo',
    text: 'Head construction (L) has an Anime style: at the angle of the head in the photo, where anime puts the eyes - lower and bigger - the nose, the mouth and a pointed chin. Switch in the note under the picture, or Ctrl+K "anime".',
    act: 'Open a photo', run: () => setView({ kind: 'drop' }) },
  { id: 'cel', title: 'Anime cel shading in 3D',
    text: 'The Anime finish, under Surface: any form, the figure or the head in flat tones - the colour, a hard-edged shadow, a highlight - and the second light as a rim. Where the shadow shape falls, under any light.',
    act: 'Show me', run: () => setView({ kind: 'forms' }) },
  { id: 'backup', title: 'A backup of everything',
    text: 'One .zip with your settings, materials, themes, 3D scenes, practice log, trainer scores and uploads - to keep safe, or to move to another computer.',
    act: 'Your data', run: () => openData() },
  { id: 'uploads-kept', title: 'What you upload is kept',
    text: 'Pictures you drop, photos of your drawings and the Colour studio\'s pictures are listed under Check your own image, to open again. Behind the container they are saved on its disk and join the library as the Uploads pack; on the web page, tick Keep in this browser.',
    act: 'Show me', run: () => setView({ kind: 'drop' }) },
  { id: 'keyboard', title: 'Everything from the keyboard',
    text: 'A focus ring you can see, Tab kept inside a dialog, the arrow keys along the rail, a Skip to the content link - and a screen reader told where you went and which pose is up.' },
  { id: 'fast', title: 'Opens faster',
    text: 'The 3D view and the Colour studio load the first time you open them, not with the page - they start coming as the pointer reaches their button.' },
  { id: 'tour', title: 'A tour', text: 'Six short notes, each beside the real control it is about.',
    act: 'Take the tour', run: () => startTour() },
  { id: 'workspace-any', title: 'Any picture in the workspace',
    text: 'A library image, a dropped photo or the Colour studio\'s picture opens with every tool: value, colour, construction, the figure.',
    act: 'Show me', run: () => setView({ kind: 'drop' }) },
  { id: 'find', title: 'Find a tool - Ctrl+K', text: 'Type a few letters - "flip", "loomis", "green" - and Enter. Everything is in it.',
    act: 'Try it', run: () => openCommands() },
  { id: 'materials', title: 'My materials', text: 'Tick what you draw and paint with; the value steps and the eyedropper then speak in its terms.',
    act: 'Open', run: () => openMaterials() },
  { id: 'themes', title: 'Themes', text: 'The four Catppuccin flavours, Studio dark and Daylight - and your own, from the theme editor.',
    act: 'Pick one', run: () => el('btnTheme').click() },
];

function newsSeen() {
  try { return JSON.parse(localStorage.getItem(NEWS_KEY)) || []; } catch { return []; }
}
function markNewsSeen() {
  try { localStorage.setItem(NEWS_KEY, JSON.stringify(NEWS.map(n => n.id))); } catch { /* private mode */ }
}

/* Which items to put in front of someone arriving - the policy. `seen` is
   the ids they have already been shown; `firstVisit` is true when this
   browser has never opened the app before (the tour is running instead). */
function newsToShow(seen, firstVisit) {
  if (firstVisit) return [];
  return NEWS.filter(n => !seen.includes(n.id));
}

function newsItem(n) {
  return `<li class="news" data-news="${n.id}"><b>${esc(n.title)}</b><p>${esc(n.text)}</p>` +
    (n.run ? `<button type="button" class="ghost" data-try="${n.id}">${esc(n.act || 'Try it')}</button>` : '') + '</li>';
}

// items: what to show, newest first; with none given, all of it.
function openNews(items = NEWS) {
  el('whatsNewList').innerHTML = items.slice(0, NEWS_SHOWN).map(newsItem).join('');
  const earlier = items.slice(NEWS_SHOWN);
  el('whatsNewEarlierList').innerHTML = earlier.map(newsItem).join('');
  el('whatsNewEarlier').classList.toggle('hidden', !earlier.length);
  el('whatsNewEarlier').open = false;
  el('whatsNew').classList.remove('hidden');
  dialogOpened(el('whatsNew'), el('whatsNewList').querySelector('button') || el('whatsNewClose'));
}
function closeNews() {
  el('whatsNew').classList.add('hidden');
  markNewsSeen();
  dialogClosed(el('whatsNew'));
}

// After boot, when the tour did not run. Not where nothing can be
// remembered: it would come back on every visit in a private window.
function showNewsOnce(firstVisit) {
  try { localStorage.getItem(NEWS_KEY); } catch { return; }
  const items = newsToShow(newsSeen(), firstVisit);
  if (items.length) openNews(items);
  else markNewsSeen();
}

function initNews() {
  el('whatsNewClose').addEventListener('click', closeNews);
  initSheet(el('whatsNew'), closeNews);
  el('whatsNew').addEventListener('click', e => {
    const b = e.target.closest('[data-try]');
    if (!b) return;
    const n = NEWS.find(x => x.id === b.dataset.try);
    closeNews();
    n.run();
  });
  el('btnNewsFooter').addEventListener('click', () => openNews());
  el('btnNewsHelp').addEventListener('click', () => { toggleHelp(); openNews(); });
}
initNews();
