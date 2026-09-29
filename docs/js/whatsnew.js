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
