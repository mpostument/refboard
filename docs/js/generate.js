/* refboard - Generate references: pictures made to order by a ComfyUI the
   server knows about (COMFY_URL; see Services/ComfyClient.cs) - who, the
   hair, how much of them, from where - or a landscape, buildings, nature,
   an animal - the light, the medium. Only behind a
   server that has one: the rail button stays hidden otherwise.

   Each picture is kept like a dropped one - in Uploads, in its own Generated
   folder, tagged with the choices in plain words ("three-quarter",
   "backlit", "watercolour") - so the library's search finds it later.

   The prompt is Danbooru tags, which the anime models learnt from:
   genPrompt() turns the choices into them. The server adds the model's
   quality tags and what never to make.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const GEN_KEY = 'refboard.generate.v1';

// Each choice: its label, the words it files the picture under, its tags for
// the model, and what it keeps out (avoid - the negative prompt); 'any'
// leaves it to the model. A row with `for` is shown, and used, only for
// those subjects; one with `when`, only when the other choices say so.
const ANY = { id: 'any', label: 'Any', tags: '' };
const PERSON = ['character'], OUTDOORS = ['landscape', 'building'];
const GEN_CHOICES = [
  // One style for now - the models behind this are anime models. A second
  // one is a row here, and its tags.
  { id: 'style', label: 'Style', options: [
    { id: 'anime', label: 'Anime', tags: '', words: 'anime' },
  ] },
  // Anything but a character says "no humans": an anime model draws a girl
  // into a landscape unless told not to - most of what it learnt from has one.
  { id: 'subject', label: 'Subject', options: [
    { id: 'character', label: 'Character', tags: '', words: '' },
    { id: 'landscape', label: 'Landscape', tags: 'no humans, scenery, landscape' },
    { id: 'building', label: 'Buildings', tags: 'no humans, scenery, building, architecture', words: 'buildings' },
    { id: 'nature', label: 'Nature', tags: 'no humans, nature, still life, close-up' },
    { id: 'animal', label: 'Animal', tags: 'no humans, animal focus, solo' },
  ] },

  { id: 'who', label: 'Who', for: PERSON, options: [
    { id: 'girl', label: 'Girl', tags: '1girl, solo' },
    { id: 'boy', label: 'Boy', tags: '1boy, solo' },
  ] },
  { id: 'hair', label: 'Hair', for: PERSON, options: [
    ANY,
    { id: 'short', label: 'Short', tags: 'short hair' },
    { id: 'bob', label: 'Bob', tags: 'short hair, bob cut' },
    { id: 'long', label: 'Long', tags: 'long hair' },
    { id: 'ponytail', label: 'Ponytail', tags: 'ponytail' },
    { id: 'twintails', label: 'Twin tails', tags: 'twintails' },
  ] },
  { id: 'colour', label: 'Hair colour', for: PERSON, options: [
    ANY,
    ...['black', 'brown', 'blonde', 'red', 'orange', 'pink', 'purple', 'silver', 'white', 'blue', 'green']
      .map(c => ({ id: c, label: c[0].toUpperCase() + c.slice(1), tags: c + ' hair', words: c + ' hair' })),
  ] },
  { id: 'eyes', label: 'Eyes', for: PERSON, options: [
    ANY,
    ...['blue', 'green', 'brown', 'red', 'purple', 'yellow', 'pink', 'aqua', 'grey', 'black']
      .map(c => ({ id: c, label: c[0].toUpperCase() + c.slice(1), tags: c + ' eyes', words: c + ' eyes' })),
  ] },
  // The eye's style as anime draws it (ANIME_EYES in js/vision.js): tsurime,
  // the outer corner up; tareme, down. Not "sparkling eyes" for shojo: to the
  // model that is star shapes in the iris - a gimmick, not an eye to learn.
  { id: 'eyeShape', label: 'Eye shape', for: PERSON, options: [
    ANY,
    { id: 'shojo', label: 'Shōjo', tags: 'large eyes, long eyelashes, eyelashes', avoid: 'sparkling eyes, star-shaped pupils', words: 'shojo eyes' },
    { id: 'sharp', label: 'Sharp', tags: 'tsurime, narrowed eyes', words: 'sharp eyes' },
    { id: 'soft', label: 'Soft', tags: 'tareme, round eyes', words: 'soft eyes' },
  ] },
  { id: 'framing', label: 'How much', for: PERSON, options: [
    { id: 'head', label: 'Head', tags: 'portrait, close-up', words: 'head' },
    { id: 'bust', label: 'Bust', tags: 'upper body', words: 'bust' },
    { id: 'half', label: 'Half figure', tags: 'cowboy shot', words: 'half figure' },
    { id: 'full', label: 'Whole figure', tags: 'full body', words: 'whole figure' },
    // The model sheet an animator draws from: one character, turned round.
    { id: 'sheet', label: 'Turnaround', tags: 'reference sheet, multiple views, turnaround, full body, standing', words: 'turnaround' },
  ] },
  { id: 'view', label: 'From', for: PERSON, options: [
    { id: 'front', label: 'Front', tags: 'straight-on, looking at viewer', words: 'front' },
    { id: 'three', label: 'Three-quarter', tags: 'three quarter view', words: 'three-quarter' },
    { id: 'profile', label: 'Profile', tags: 'profile, from side', words: 'profile' },
    { id: 'below', label: 'Below', tags: 'from below', words: 'from below' },
    { id: 'above', label: 'Above', tags: 'from above', words: 'from above' },
    { id: 'back', label: 'Behind', tags: 'from behind, looking back', words: 'from behind' },
  ] },
  { id: 'pose', label: 'Pose', for: PERSON, options: [
    ANY,
    { id: 'standing', label: 'Standing', tags: 'standing' },
    { id: 'sitting', label: 'Sitting', tags: 'sitting' },
    { id: 'walking', label: 'Walking', tags: 'walking' },
    { id: 'arms', label: 'Arms up', tags: 'arms up', words: 'arms raised' },
    { id: 'lying', label: 'Lying', tags: 'lying', words: 'lying' },
  ] },

  { id: 'place', label: 'Where', for: ['landscape'], options: [
    { id: 'mountains', label: 'Mountains', tags: 'mountain, valley' },
    { id: 'sea', label: 'Sea', tags: 'ocean, beach, horizon' },
    { id: 'lake', label: 'Lake', tags: 'lake, reflection' },
    { id: 'fields', label: 'Fields', tags: 'field, grass, rural, path' },
    { id: 'forest', label: 'Forest', tags: 'forest, tree, path' },
    { id: 'river', label: 'River', tags: 'river, rock, tree' },
    { id: 'sky', label: 'Sky', tags: 'sky, cloud, horizon, wide shot' },
  ] },
  { id: 'building', label: 'What', for: ['building'], options: [
    { id: 'street', label: 'Street', tags: 'street, city, road, building' },
    { id: 'town', label: 'Old town', tags: 'town, old building, stone floor' },
    { id: 'house', label: 'House', tags: 'house, garden, fence' },
    { id: 'shrine', label: 'Shrine', tags: 'shrine, torii, stairs' },
    { id: 'castle', label: 'Castle', tags: 'castle, tower' },
    { id: 'cafe', label: 'Cafe inside', tags: 'cafe, indoors, table, window', words: 'interior' },
    { id: 'station', label: 'Station', tags: 'train station, railroad tracks' },
  ] },
  { id: 'seen', label: 'Seen from', for: ['building'], options: [
    { id: 'street', label: 'The street', tags: 'eye level', words: 'eye level' },
    { id: 'above', label: 'Above', tags: 'from above, cityscape', words: 'from above' },
    { id: 'below', label: 'Below', tags: 'from below', words: 'from below' },
  ] },
  { id: 'thing', label: 'What', for: ['nature'], options: [
    { id: 'flowers', label: 'Flowers', tags: 'flower, petals' },
    { id: 'tree', label: 'A tree', tags: 'tree, branch, leaf', words: 'tree' },
    { id: 'leaves', label: 'Leaves', tags: 'leaf, branch' },
    { id: 'mushrooms', label: 'Mushrooms', tags: 'mushroom, moss' },
    { id: 'fruit', label: 'Fruit', tags: 'fruit, food focus' },
    { id: 'water', label: 'Water and stones', tags: 'water, stone, stream', words: 'water' },
  ] },
  { id: 'animal', label: 'Animal', for: ['animal'], options: [
    ...['cat', 'dog', 'fox', 'rabbit', 'bird', 'horse', 'deer', 'owl']
      .map(a => ({ id: a, label: a[0].toUpperCase() + a.slice(1), tags: a })),
    { id: 'koi', label: 'Koi', tags: 'koi, fish, water' },
  ] },
  { id: 'size', label: 'How much', for: ['animal'], options: [
    { id: 'close', label: 'Head', tags: 'portrait, close-up', words: 'head' },
    { id: 'whole', label: 'Whole', tags: 'full body', words: 'whole' },
  ] },

  { id: 'time', label: 'Time of day', for: OUTDOORS, options: [
    ANY,
    { id: 'day', label: 'Day', tags: 'day, blue sky' },
    { id: 'dawn', label: 'Morning', tags: 'morning, dawn' },
    { id: 'sunset', label: 'Sunset', tags: 'sunset, orange sky, evening' },
    { id: 'night', label: 'Night', tags: 'night, night sky, starry sky' },
  ] },
  { id: 'weather', label: 'Weather', for: OUTDOORS, options: [
    ANY,
    { id: 'clear', label: 'Clear', tags: 'clear sky' },
    { id: 'cloudy', label: 'Cloudy', tags: 'cloudy sky, overcast' },
    { id: 'rain', label: 'Rain', tags: 'rain, wet' },
    { id: 'snow', label: 'Snow', tags: 'snow, snowing' },
    { id: 'fog', label: 'Fog', tags: 'fog, mist' },
  ] },
  { id: 'season', label: 'Season', for: ['landscape', 'nature'], options: [
    ANY,
    { id: 'spring', label: 'Spring', tags: 'spring (season), cherry blossoms' },
    { id: 'summer', label: 'Summer', tags: 'summer' },
    { id: 'autumn', label: 'Autumn', tags: 'autumn, autumn leaves' },
    { id: 'winter', label: 'Winter', tags: 'winter, snow' },
  ] },

  { id: 'light', label: 'Light', options: [
    ANY,
    { id: 'soft', label: 'Soft', tags: 'soft lighting', words: 'soft light' },
    { id: 'side', label: 'From the side', tags: 'sidelighting', words: 'side light' },
    { id: 'back', label: 'Backlit', tags: 'backlighting, rim lighting', words: 'backlit' },
    { id: 'dramatic', label: 'Dramatic', tags: 'dramatic lighting, chiaroscuro', words: 'low key' },
  ] },
  // Ink is lines and hatching - "greyscale" alone had it fill the shadows
  // solid black, like oil paint - and pencil is hatched graphite: both are
  // the marks a beginner copies stroke by stroke.
  { id: 'medium', label: 'Medium', options: [
    { id: 'watercolour', label: 'Watercolour', tags: 'watercolor (medium), traditional media, lineart', words: 'watercolour' },
    { id: 'ink', label: 'Ink and hatching', words: 'ink',
      tags: 'monochrome, lineart, hatching (texture), cross-hatching, ink (medium), pen (medium), traditional media',
      avoid: 'color, gradient, screentone, solid black, black fill, grey wash, greyscale shading' },
    { id: 'flat', label: 'Flat colour', tags: 'flat color, cel shading', words: 'flat colour' },
    { id: 'sketch', label: 'Pencil and hatching', words: 'pencil',
      tags: 'monochrome, greyscale, sketch, graphite (medium), hatching (texture), traditional media',
      avoid: 'color, digital' },
  ] },
  // Watercolour's own question - are the colours run together wet, or laid
  // crisp on dry paper: a reference to practise the one or the other from.
  { id: 'edges', label: 'Edges', when: ch => ch.medium === 'watercolour', options: [
    ANY,
    { id: 'soft', label: 'Soft - wet-in-wet', tags: 'wet-on-wet, color bleeding, soft edges, blurry edges', words: 'soft edges' },
    { id: 'hard', label: 'Hard - on dry paper', tags: 'hard edges, sharp edges, layered glazing, flat wash', words: 'hard edges',
      avoid: 'blurry, color bleeding' },
  ] },
  // Simple, the default: a few big shapes to copy, not a finished
  // illustration to be daunted by.
  { id: 'detail', label: 'Detail', options: [
    { id: 'simple', label: 'Simple', tags: 'minimalist, simple drawing', words: 'simple',
      avoid: 'detailed, intricate details, complex background, gradient, shiny skin, shiny hair' },
    { id: 'normal', label: 'Normal', tags: '', words: '' },
  ] },
  // A landscape or a street is its own background.
  { id: 'ground', label: 'Background', for: ['character', 'nature', 'animal'], options: [
    { id: 'plain', label: 'Plain', tags: 'simple background, white background', words: '' },
    { id: 'scene', label: 'A place', tags: 'outdoors, scenery', words: 'scene' },
  ] },
];

const GEN_DEFAULTS = { style: 'anime', subject: 'character', who: 'girl', hair: 'any', colour: 'any', eyes: 'any', eyeShape: 'any', framing: 'bust',
  view: 'front', pose: 'any', place: 'mountains', building: 'street', seen: 'street', thing: 'flowers', animal: 'cat',
  size: 'whole', time: 'any', weather: 'any', season: 'any', light: 'any', medium: 'watercolour', edges: 'any', detail: 'simple',
  ground: 'plain' };

// Whether a row is asked, and used, with these choices.
const genApplies = (c, ch) => (!c.for || c.for.includes(ch.subject)) && (!c.when || c.when(ch));

/* The choices as the model's prompt, what to keep out of it, the plain words
   the picture is filed under, and its shape: tall for a figure, wide for a landscape or a
   street, square for a head or a close look at something. extra is what was
   typed under More tags, passed on as it is. */
function genPrompt(choices, extra = '') {
  const subjects = GEN_CHOICES.find(c => c.id === 'subject').options;
  const subject = subjects.some(o => o.id === choices.subject) ? choices.subject : GEN_DEFAULTS.subject;
  const tags = [], words = [], avoid = [];
  for (const c of GEN_CHOICES) {
    if (!genApplies(c, { ...GEN_DEFAULTS, ...choices, subject })) continue;
    const o = c.options.find(x => x.id === choices[c.id]) || c.options.find(x => x.id === GEN_DEFAULTS[c.id]);
    if (o.tags) tags.push(o.tags);
    if (o.avoid) avoid.push(o.avoid);
    const w = o.words ?? (o.id === 'any' ? '' : o.label.toLowerCase());
    if (w) words.push(w);
  }
  const more = extra.split(',').map(s => s.trim()).filter(Boolean);
  const shape = subject === 'character' ? (choices.framing === 'head' ? 'square' : choices.framing === 'sheet' ? 'landscape' : 'portrait')
    : subject === 'landscape' || subject === 'building' ? 'landscape' : 'square';
  return { prompt: [...tags, ...more].join(', '), avoid: avoid.join(', '), tags: [...words, ...more].slice(0, 24).map(w => w.slice(0, 40)), shape };
}

let genChoices = { ...GEN_DEFAULTS };
let genBusy = false;

function loadGenChoices() {
  try { Object.assign(genChoices, JSON.parse(localStorage.getItem(GEN_KEY)) || {}); } catch { /* defaults */ }
}
function saveGenChoices() {
  try { localStorage.setItem(GEN_KEY, JSON.stringify(genChoices)); } catch { /* private mode */ }
}

function renderGenerate() {
  el('genChoices').innerHTML = GEN_CHOICES.map(c =>
    `<div class="gen-row" data-row="${c.id}"><h4 id="genL-${c.id}">${esc(c.label)}</h4>` +
    `<div class="chips" role="group" aria-labelledby="genL-${c.id}">` +
    c.options.map(o => `<button type="button" class="chip" data-gen="${c.id}" data-opt="${o.id}" ` +
      `aria-pressed="${genChoices[c.id] === o.id}">${esc(o.label)}</button>`).join('') + '</div></div>').join('');
  syncGenRows();
  el('genWhere').textContent = 'Made by the ComfyUI your server is set up with, and kept in Uploads - ' +
    'the Generated group of the Uploads pack in the library, tagged with these choices.';
}

// Only the rows the choices ask: a landscape has no hair colour, ink no
// wet-in-wet.
function syncGenRows() {
  for (const c of GEN_CHOICES)
    el('genChoices').querySelector(`[data-row="${c.id}"]`).classList.toggle('hidden', !genApplies(c, genChoices));
}

async function showGenerate() {
  if (!el('genChoices').children.length) renderGenerate();
  const list = (await listUploads()).filter(u => u.from === 'generate').slice(0, 24);
  renderGenResults(list);
}

function renderGenResults(list) {
  const host = el('genResults');
  host.innerHTML = '';
  for (const u of list) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="gen-open" title="${esc((u.tags || []).join(', '))}" ` +
      `aria-label="Open ${esc(u.name)}"><img alt="" loading="lazy"></button>` +
      `<button type="button" class="gen-steps" aria-label="How to draw ${esc(u.name)}" title="How to draw it - step by step">Steps</button>` +
      `<button type="button" class="gen-colours" aria-label="Character sheet from ${esc(u.name)}" title="Her colours, with how to mix them - the Colour studio's Character sheet">Colours</button>`;
    storeFileUrl(u.file).then(url => { if (url) li.querySelector('img').src = url; });
    li.querySelector('.gen-open').addEventListener('click', () => openUpload(u));
    li.querySelector('.gen-steps').addEventListener('click', async () => {
      const url = await storeFileUrl(u.file);
      if (!url) return;
      stepsKnown.set(url, u.tags || []);
      openSteps(url);
    });
    li.querySelector('.gen-colours').addEventListener('click', async () => {
      const url = await storeFileUrl(u.file);
      if (url) openColour('character', url);
    });
    host.appendChild(li);
  }
  el('genEmpty').classList.toggle('hidden', list.length > 0);
}

// One picture: start the job, then ask after it once a second.
async function generateOne(req) {
  const r = await fetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
  if (!r.ok) throw new Error(r.status === 404 ? 'This server has no ComfyUI set up.' : 'The server refused it (HTTP ' + r.status + ').');
  const { id } = await r.json();
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    const s = await (await fetch('api/generate/' + id)).json();
    if (s.state === 'done') return s.upload;
    if (s.state === 'error') throw new Error(s.error || 'ComfyUI could not make it.');
  }
}

async function runGenerate() {
  if (genBusy) return;
  genBusy = true;
  el('genGo').disabled = true;
  const n = Number(el('genCount').value) || 1;
  const req = genPrompt(genChoices, el('genExtra').value);
  const status = el('genStatus');
  try {
    for (let i = 1; i <= n; i++) {
      status.textContent = n > 1 ? `Making ${i} of ${n}...` : 'Making it...';
      await generateOne(req);
      storeChanged();
      await showGenerate();
    }
    status.textContent = n > 1 ? `${n} made - in Uploads, Generated.` : 'Made - in Uploads, Generated.';
  } catch (err) {
    status.textContent = err.message;
  } finally {
    genBusy = false;
    el('genGo').disabled = false;
  }
}

async function initGenerate() {
  loadGenChoices();
  el('genChoices').addEventListener('click', e => {
    const b = e.target.closest('[data-gen]');
    if (!b) return;
    genChoices[b.dataset.gen] = b.dataset.opt;
    saveGenChoices();
    for (const x of el('genChoices').querySelectorAll(`[data-gen="${b.dataset.gen}"]`))
      x.setAttribute('aria-pressed', String(x === b));
    if (b.dataset.gen === 'subject' || b.dataset.gen === 'medium') syncGenRows();
  });
  el('genGo').addEventListener('click', runGenerate);
  el('genExtra').addEventListener('keydown', e => { if (e.key === 'Enter') runGenerate(); });

  // Offered only where it can work: a server, with a ComfyUI it can reach.
  await initStore();
  if (storeMode !== 'server') return;
  let info = null;
  try { info = await (await fetch('api/generate')).json(); } catch { /* an older server: no such route */ }
  if (!info || !info.available) return;
  document.querySelector('.nav-item[data-view="generate"]').classList.remove('hidden');
  renderStages();
}
initGenerate();
