/* refboard - Generate references: pictures made to order by a ComfyUI the
   server knows about (COMFY_URL; see Services/ComfyClient.cs) - who, the
   hair, how much of them, from where, the light, the medium. Only behind a
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

// Each choice: its label, the words it files the picture under, and its
// tags for the model. 'any' leaves it to the model.
const GEN_CHOICES = [
  { id: 'who', label: 'Who', options: [
    { id: 'girl', label: 'Girl', tags: '1girl, solo' },
    { id: 'boy', label: 'Boy', tags: '1boy, solo' },
  ] },
  { id: 'hair', label: 'Hair', options: [
    { id: 'any', label: 'Any', tags: '' },
    { id: 'short', label: 'Short', tags: 'short hair' },
    { id: 'bob', label: 'Bob', tags: 'short hair, bob cut' },
    { id: 'long', label: 'Long', tags: 'long hair' },
    { id: 'ponytail', label: 'Ponytail', tags: 'ponytail' },
    { id: 'twintails', label: 'Twin tails', tags: 'twintails' },
  ] },
  { id: 'colour', label: 'Hair colour', options: [
    { id: 'any', label: 'Any', tags: '' },
    ...['black', 'brown', 'blonde', 'red', 'pink', 'silver', 'blue', 'green']
      .map(c => ({ id: c, label: c[0].toUpperCase() + c.slice(1), tags: c + ' hair', words: c + ' hair' })),
  ] },
  { id: 'framing', label: 'How much', options: [
    { id: 'head', label: 'Head', tags: 'portrait, close-up', words: 'head' },
    { id: 'bust', label: 'Bust', tags: 'upper body', words: 'bust' },
    { id: 'half', label: 'Half figure', tags: 'cowboy shot', words: 'half figure' },
    { id: 'full', label: 'Whole figure', tags: 'full body', words: 'whole figure' },
  ] },
  { id: 'view', label: 'From', options: [
    { id: 'front', label: 'Front', tags: 'straight-on, looking at viewer', words: 'front' },
    { id: 'three', label: 'Three-quarter', tags: 'three quarter view', words: 'three-quarter' },
    { id: 'profile', label: 'Profile', tags: 'profile, from side', words: 'profile' },
    { id: 'below', label: 'Below', tags: 'from below', words: 'from below' },
    { id: 'above', label: 'Above', tags: 'from above', words: 'from above' },
    { id: 'back', label: 'Behind', tags: 'from behind, looking back', words: 'from behind' },
  ] },
  { id: 'pose', label: 'Pose', options: [
    { id: 'any', label: 'Any', tags: '' },
    { id: 'standing', label: 'Standing', tags: 'standing' },
    { id: 'sitting', label: 'Sitting', tags: 'sitting' },
    { id: 'walking', label: 'Walking', tags: 'walking' },
    { id: 'arms', label: 'Arms up', tags: 'arms up', words: 'arms raised' },
    { id: 'lying', label: 'Lying', tags: 'lying', words: 'lying' },
  ] },
  { id: 'light', label: 'Light', options: [
    { id: 'any', label: 'Any', tags: '' },
    { id: 'soft', label: 'Soft', tags: 'soft lighting', words: 'soft light' },
    { id: 'side', label: 'From the side', tags: 'sidelighting', words: 'side light' },
    { id: 'back', label: 'Backlit', tags: 'backlighting, rim lighting', words: 'backlit' },
    { id: 'dramatic', label: 'Dramatic', tags: 'dramatic lighting, chiaroscuro', words: 'low key' },
  ] },
  { id: 'medium', label: 'Medium', options: [
    { id: 'watercolour', label: 'Watercolour', tags: 'watercolor (medium), traditional media, lineart', words: 'watercolour' },
    { id: 'ink', label: 'Ink line', tags: 'lineart, monochrome, greyscale, ink (medium)', words: 'ink' },
    { id: 'flat', label: 'Flat colour', tags: 'flat color, cel shading', words: 'flat colour' },
    { id: 'sketch', label: 'Pencil sketch', tags: 'sketch, traditional media, graphite (medium), monochrome', words: 'sketch' },
  ] },
  { id: 'ground', label: 'Background', options: [
    { id: 'plain', label: 'Plain', tags: 'simple background, white background', words: '' },
    { id: 'scene', label: 'A place', tags: 'outdoors, scenery', words: 'scene' },
  ] },
];

const GEN_DEFAULTS = { who: 'girl', hair: 'any', colour: 'any', framing: 'bust', view: 'front', pose: 'any',
  light: 'any', medium: 'watercolour', ground: 'plain' };

/* The choices as the model's prompt, the plain words the picture is filed
   under, and its shape - tall for a figure, which is most of them. extra is
   what was typed under More tags, passed on as it is. */
function genPrompt(choices, extra = '') {
  const tags = [], words = [];
  for (const c of GEN_CHOICES) {
    const o = c.options.find(x => x.id === choices[c.id]) || c.options.find(x => x.id === GEN_DEFAULTS[c.id]);
    if (o.tags) tags.push(o.tags);
    const w = o.words ?? (o.id === 'any' ? '' : o.label.toLowerCase());
    if (w) words.push(w);
  }
  const more = extra.split(',').map(s => s.trim()).filter(Boolean);
  const shape = choices.framing === 'head' ? 'square' : 'portrait';
  return { prompt: [...tags, ...more].join(', '), tags: [...words, ...more].slice(0, 24).map(w => w.slice(0, 40)), shape };
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
    `<h4 id="genL-${c.id}">${esc(c.label)}</h4><div class="chips" role="group" aria-labelledby="genL-${c.id}">` +
    c.options.map(o => `<button type="button" class="chip" data-gen="${c.id}" data-opt="${o.id}" ` +
      `aria-pressed="${genChoices[c.id] === o.id}">${esc(o.label)}</button>`).join('') + '</div>').join('');
  el('genWhere').textContent = 'Made by the ComfyUI your server is set up with, and kept in Uploads - ' +
    'the Generated group of the Uploads pack in the library, tagged with these choices.';
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
      `aria-label="Open ${esc(u.name)}"><img alt="" loading="lazy"></button>`;
    storeFileUrl(u.file).then(url => { if (url) li.querySelector('img').src = url; });
    li.querySelector('button').addEventListener('click', () => openUpload(u));
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
