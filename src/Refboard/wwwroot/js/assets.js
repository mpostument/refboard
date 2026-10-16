/* refboard - the Game assets view (ROADMAP.md, "Game assets", phase 2): pictures to *use* in
   a 2D game, not to draw from - a prop, a weapon, an item - cut out, one to a picture, in a
   file with a transparent background. It shares the run (runGenerate), the client and the
   server with Generate; what is its own is the recipe (assetRequest: the words that turn an
   anime illustration into a game asset, found in phase 0) and what is done to each picture
   after the model (assetFinish: cut out, one piece, turned upright, an icon).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const ASSET_KEY = 'refboard.assets.v1';

/* What phase 0 found turns the model's lit, glossy illustration into a flat asset on white,
   for every kind; and what it must keep out. */
const ASSET_STYLE = 'game sprite, 2d game asset, flat color, cel shading, thick outline, simple background, white background';
const ASSET_AVOID = 'shadow, cast shadow, gradient, glossy, shiny, depth of field, 3d, realistic, floor, ground, lighting';
// An anime model makes a girl holding the thing, and a landscape behind a tree.
const ASSET_ALONE = 'human, 1girl, 1boy, person, hands, holding, character, scenery, landscape, sky';

/* How simple, a setting of its own: without it the output is far too busy for a game. */
const ASSET_SIMPLE = [
  { id: 'simple', label: 'Simple', tags: 'minimalist, simple design, limited color palette', avoid: 'detailed, intricate, ornate, complex, texture, patterns', hint: 'A few flat colours - what a small sprite can show' },
  { id: 'medium', label: 'Medium', tags: '', avoid: 'intricate, ornate', hint: 'Some detail, no ornament' },
  { id: 'detailed', label: 'Detailed', tags: 'detailed', avoid: '', hint: 'Fine detail - for a big picture, not a small sprite' },
];

const ASSET_THEMES = [
  { id: 'any', label: 'Any', tags: '' },
  { id: 'fantasy', label: 'Fantasy', tags: 'fantasy' },
  { id: 'medieval', label: 'Medieval', tags: 'medieval' },
  { id: 'slavic', label: 'Slavic', tags: 'slavic folklore, folk art' },
  { id: 'scifi', label: 'Sci-fi', tags: 'sci-fi, futuristic' },
  { id: 'steampunk', label: 'Steampunk', tags: 'steampunk' },
  { id: 'modern', label: 'Modern', tags: 'modern' },
];

const ASSET_MATERIALS = [
  { id: 'any', label: 'Any', word: '' }, { id: 'wooden', label: 'Wood', word: 'wooden' }, { id: 'iron', label: 'Iron', word: 'iron' },
  { id: 'steel', label: 'Steel', word: 'steel' }, { id: 'golden', label: 'Gold', word: 'golden' },
  { id: 'stone', label: 'Stone', word: 'stone' }, { id: 'crystal', label: 'Crystal', word: 'crystal' },
];

/* size: what is asked of the model (multiples of 64 - the server's free Width and Height).
   A weapon is tall so that it fits whole; the rest are square. */
const ASSET_KINDS = [
  { id: 'prop', label: 'Prop', size: [1024, 1024], views: true, icon: false, hint: 'Something in the world - a chest, a barrel, a tree',
    things: ['treasure chest', 'barrel', 'crate', 'tree', 'lamp', 'signpost', 'well', 'tent', 'rock', 'bush', 'fence', 'door'] },
  { id: 'weapon', label: 'Weapon', size: [768, 1152], views: false, icon: true, hint: 'Held, one to a picture, turned upright with its working end up',
    things: ['sword', 'axe', 'bow', 'staff', 'spear', 'dagger', 'mace', 'hammer', 'shield'] },
  { id: 'item', label: 'Item', size: [768, 768], views: false, icon: true, hint: 'Something picked up - a potion, a key, a coin',
    things: ['potion', 'key', 'scroll', 'coin', 'gem', 'ring', 'apple', 'book', 'heart', 'mushroom'] },
];

// What a view says to the model; a prop is drawn from the front or from the 3/4 view above it.
const ASSET_VIEWS = [
  { id: 'side', label: 'Side', tags: 'front view' },
  { id: 'top', label: 'Top-down', tags: 'from above, 3/4 view' },
];

// A chest opens its lid and fills with gold unless told it is closed (phase 0); a bare "chest" is
// also read as a body part, so the first idea is "treasure chest" - and the treasure kept inside.
const ASSET_CONTAINER = /\b(chest|box|crate|barrel|door|jar|bag|coffin|basket|pot|book|casket)\b/i;

const ASSET_DEFAULTS = { kind: 'prop', view: 'side', thing: 'treasure chest', theme: 'fantasy', material: 'any', simple: 'simple', count: '4', draft: '', icon: true };
let assetState = { ...ASSET_DEFAULTS };

const assetKind = id => ASSET_KINDS.find(k => k.id === id) || ASSET_KINDS[0];
const assetPick = (list, id) => list.find(x => x.id === id) || list[0];

/* The request for one picture from the settings s (the shape of ASSET_DEFAULTS). Pure: the
   words, what to keep out, the tags it is filed under, its size and its kind. */
function assetRequest(s) {
  const kind = assetKind(s.kind), simple = assetPick(ASSET_SIMPLE, s.simple), theme = assetPick(ASSET_THEMES, s.theme);
  const material = assetPick(ASSET_MATERIALS, s.material), view = assetPick(ASSET_VIEWS, s.view);
  const thing = (s.thing || '').trim().toLowerCase().slice(0, 40) || kind.things[0];
  const named = [material.word, thing].filter(Boolean).join(' ');
  const box = ASSET_CONTAINER.test(thing);
  const tags = ['no humans'], avoid = [ASSET_AVOID, ASSET_ALONE];
  if (kind.id === 'weapon') {
    // The model draws a set of four to six, or a rack on a panel: ask for one, and keep the set out.
    tags.push('solo', `(single ${named}:1.3)`, 'full length', 'centered', 'vertical', 'pointing up', 'object focus');
    avoid.push('multiple, set, collection, rack, weapon rack, panel, display, sheath');
  } else if (kind.id === 'item') {
    tags.push(named, 'solo', 'centered', 'object focus');
    avoid.push('multiple, set, collection');
  } else {
    tags.push(named, ...(box ? ['closed', 'closed lid'] : []), view.tags, 'object focus');
    if (box) avoid.push('open, open lid, gold, coins, jewels, gems, overflowing');
  }
  const prompt = [...tags, theme.tags, simple.tags, ASSET_STYLE].filter(Boolean).join(', ');
  const [width, height] = kind.size;
  return {
    prompt: comfyTags(prompt),
    avoid: comfyTags([...avoid, simple.avoid].filter(Boolean).join(', ')),
    // The thing first: a picture is named from its first three tags.
    tags: [thing, kind.id, ...(kind.views ? [view.id] : []), ...(theme.tags ? [theme.id] : []), `${width}x${height}`, 'asset']
      .slice(0, 24).map(t => t.slice(0, 40)),
    width, height, asset: kind.id,
  };
}

function assetsLoad() {
  try { Object.assign(assetState, JSON.parse(localStorage.getItem(ASSET_KEY)) || {}); } catch { /* defaults */ }
  if (!ASSET_KINDS.some(k => k.id === assetState.kind)) assetState.kind = ASSET_DEFAULTS.kind;
  if (typeof assetState.thing !== 'string' || !assetState.thing) assetState.thing = assetKind(assetState.kind).things[0];
}
function assetsSave() {
  try { localStorage.setItem(ASSET_KEY, JSON.stringify(assetState)); } catch { /* private mode */ }
}

function assetChips(group, label, list, current, hintOf = o => o.hint) {
  return `<div class="gen-row" data-row="${group}"><h4 id="asL-${group}">${esc(label)}</h4>` +
    `<div class="chips" role="group" aria-labelledby="asL-${group}">` +
    list.map(o => `<button type="button" class="chip" data-as="${group}" data-opt="${o.id}" aria-pressed="${current === o.id}"` +
      `${hintOf(o) ? ` title="${esc(hintOf(o))}"` : ''}>${esc(o.label)}</button>`).join('') + '</div></div>';
}

function renderAssets() {
  const s = assetState, kind = assetKind(s.kind);
  el('assetChoices').innerHTML =
    `<section class="gen-group">${assetChips('kind', 'What', ASSET_KINDS, s.kind)}` +
    `<div class="gen-row"><label class="gen-extra" for="assetThing">Name it, in English ` +
    `<input type="text" id="assetThing" maxlength="40" autocomplete="off" spellcheck="false" value="${esc(s.thing)}" placeholder="e.g. ${esc(kind.things[0])}"></label>` +
    `<div class="chips" id="assetThings" role="group" aria-label="Ideas">` +
    kind.things.map(t => `<button type="button" class="chip" data-thing="${esc(t)}" aria-pressed="${s.thing.trim().toLowerCase() === t}">${esc(t)}</button>`).join('') + '</div></div>' +
    (kind.views ? assetChips('view', 'View', ASSET_VIEWS, s.view, () => '') : '') + '</section>' +
    `<section class="gen-group">${assetChips('theme', 'Theme', ASSET_THEMES, s.theme, () => '')}` +
    assetChips('material', 'Material', ASSET_MATERIALS, s.material, () => '') +
    assetChips('simple', 'How simple', ASSET_SIMPLE, s.simple) + '</section>';
  el('assetIconRow').classList.toggle('hidden', !kind.icon);
  el('assetIcon').checked = !!s.icon;
  el('assetCount').value = s.count;
  el('assetDraft').value = s.draft;
  renderAssetPrompt();
}

// The words as they go to the model, for the curious - and for checking a recipe by eye.
function renderAssetPrompt() {
  if (!el('assetPrompt').open) return;
  const r = assetRequest(assetState);
  el('assetPromptBody').innerHTML =
    `<div><h5>Tags</h5><div class="gen-tags">${esc(r.prompt)}${genServer.quality ? `<span class="fixed">, ${esc(genServer.quality)}</span>` : ''}</div></div>` +
    `<div><h5>Kept out</h5><div class="gen-tags">${esc(r.avoid)}</div></div>` +
    `<div><h5>Size asked of the model</h5><div class="gen-tags">${r.width} x ${r.height}</div></div>`;
}

/* One finished picture: cut out, and for a weapon or an item reduced to one piece, a
   weapon turned upright - kept in Uploads, Assets, in the place of the model's own, which
   is forgotten. A picture with no plain background is kept as it came, tagged so. */
async function assetFinish(made, s) {
  const doc = made.doc, kind = assetKind(s.kind);
  const keep = async (canvas, extra, over = {}) => {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const f = await storeFile(blob);
    if (storeMode === 'server') await storeSortFile(f.id, 'assets');
    await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png',
      width: canvas.width, height: canvas.height, tags: [...(doc.tags || []), ...extra].slice(0, 24), t: Date.now(), ...over });
    return f;
  };
  let pic;
  try { pic = await genLoadPicture(doc); } catch { return; }
  const cut = cutOut(pic);
  if (!cut.found) {
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...(doc.tags || []), 'not cut out'].slice(0, 24) });
    return;
  }
  let canvas = cut.canvas;
  const notes = ['cut out'];
  if (kind.id !== 'prop') {
    const solo = assetSolo(canvas);
    if (solo) { canvas = solo.canvas; if (solo.pieces > 1) notes.push('one of ' + solo.pieces); }
  }
  if (kind.id === 'weapon') {
    const o = assetOrient(canvas);
    if (o) { canvas = o.canvas; if (o.turned) notes.push('upright'); }
  }
  const main = await keep(canvas, notes, { width: canvas.width, height: canvas.height });
  await forgetUpload(doc);
  if (kind.icon && s.icon) {
    await keep(assetIcon(canvas, { size: 128, diagonal: kind.id === 'weapon' }), ['icon', '128x128'],
      { parent: main.id, name: `${(doc.tags || [])[0] || kind.id}, icon` });
  }
}

const assetsMade = async () => (await listUploads()).filter(u => u.asset && u.folder === 'assets');
const ASSET_UI = { go: 'assetGo', status: 'assetStatus', goText: 'Make', refresh: () => showAssets(false) };

async function assetsGo() {
  if (genBusy) { genStop(); return; }
  const s = { ...assetState }, r = assetRequest(s), n = Number(s.count) || 1;
  const draft = s.draft === 'draft';
  const jobs = Array.from({ length: n }, () => ({ ...r, ...(draft ? { steps: GEN_DRAFT_STEPS } : {}) }));
  await runGenerate(jobs, (i, total) => total > 1 ? `Making ${i} of ${total}...` : 'Making it...',
    n > 1 ? `${n} made - in Uploads, Assets.` : 'Made - in Uploads, Assets.', made => assetFinish(made, s), ASSET_UI);
}

function assetsOffline() {
  const p = el('assetOffline');
  if (!p) return;
  p.textContent = genOffline;
  p.classList.toggle('hidden', !genOffline);
  el('assetGo').disabled = !!genOffline;
}

async function showAssets(check = true) {
  if (!el('assetChoices').children.length) { assetsLoad(); renderAssets(); }
  if (check) await genCheck();
  assetsOffline();
  const all = await assetsMade();
  const host = el('assetResults');
  host.innerHTML = '';
  el('assetMadeCount').textContent = all.length ? String(all.length) : '';
  el('assetEmpty').classList.toggle('hidden', all.length > 0);
  for (const u of all.slice(0, 48)) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="asset-open" title="${esc((u.tags || []).join(', '))}" aria-label="Open ${esc(u.name)}"><img alt="" loading="lazy"></button>` +
      `<button type="button" class="gen-del" aria-label="Delete ${esc(u.name)}" title="Delete it - from Uploads too">${iconSvg('close')}</button>` +
      `<span class="asset-name">${esc(u.name)}</span>`;
    storeFileUrl(u.file).then(url => { if (url) li.querySelector('img').src = url; });
    li.querySelector('.asset-open').addEventListener('click', () => openUpload(u));
    li.querySelector('.gen-del').addEventListener('click', async () => {
      await forgetUpload(u);
      storeChanged();
      await showAssets(false);
    });
    host.appendChild(li);
  }
}

function initAssets() {
  el('assetChoices').addEventListener('click', e => {
    const t = e.target.closest('[data-thing]');
    if (t) { assetState.thing = t.dataset.thing; el('assetThing').value = t.dataset.thing; }
    const b = e.target.closest('[data-as]');
    if (b) {
      assetState[b.dataset.as] = b.dataset.opt;
      // A different kind has different things to name, and may or may not have views and an icon.
      if (b.dataset.as === 'kind') { assetState.thing = assetKind(b.dataset.opt).things[0]; assetsSave(); renderAssets(); return; }
    } else if (!t) return;
    assetsSave();
    for (const x of el('assetChoices').querySelectorAll('[data-as],[data-thing]'))
      x.setAttribute('aria-pressed', String(x.dataset.thing ? x.dataset.thing === assetState.thing.trim().toLowerCase() : assetState[x.dataset.as] === x.dataset.opt));
    renderAssetPrompt();
  });
  el('assetChoices').addEventListener('input', e => {
    if (e.target.id !== 'assetThing') return;
    assetState.thing = e.target.value;
    assetsSave();
    for (const x of el('assetThings').querySelectorAll('[data-thing]')) x.setAttribute('aria-pressed', String(x.dataset.thing === assetState.thing.trim().toLowerCase()));
    renderAssetPrompt();
  });
  el('assetChoices').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'assetThing') assetsGo(); });
  el('assetPrompt').addEventListener('toggle', renderAssetPrompt);
  el('assetCount').addEventListener('change', e => { assetState.count = e.target.value; assetsSave(); });
  el('assetDraft').addEventListener('change', e => { assetState.draft = e.target.value; assetsSave(); });
  el('assetIcon').addEventListener('change', e => { assetState.icon = e.target.checked; assetsSave(); });
  el('assetGo').addEventListener('click', assetsGo);
}

initAssets();
