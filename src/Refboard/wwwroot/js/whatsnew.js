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
