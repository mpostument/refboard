/* refboard - Four more ways to make references in Generate, none of them 3D:

   A series. One scene drawn from several views - wide, close, from above, from below, from the
   side, from behind - with one seed and one palette, so the room, the clothes and the light
   are the same in each. The words of the views replace the framing the choices carry (a
   "close-up" over "full body" would pull both ways), and are weighted: the seed holds the
   picture together and the old framing would win.
   A movement. What she does, in your own words (Ukrainian or English: "біжить, озирається"),
   turned into the tags a model knows - running, looking back over the shoulder - and put into
   More tags, where they can be read and changed. No pose is drawn: the model decides the figure.
   Colours to the palette. Any picture made here, pulled to a palette - the Holbein box or Your
   palette - by as much as you choose, with the picture and the pulled one side by side and
   which colours went where. It is Keep to the palette (js/genlock.js) done after the fact, and
   kept as a new picture beside the old.
   Four lights from a photo. A photo of an object, started from in Generate, drawn again four
   ways: soft, from the side, backlit, dramatic - to see the same thing in different light,
   as Light it four ways does for a picture made here.

   Loaded the first time "More ways to make" is opened or one of them is asked for
   (loadSection('genmore')). */
"use strict";

/* ---- a series */

const GEN_VIEWS = [
  ['wide', 'Wide', 'wide shot, full scene'],
  ['close', 'Close', 'close-up'],
  ['above', 'From above', 'from above, high angle'],
  ['below', 'From below', 'from below, low angle'],
  ['side', 'From the side', 'from side'],
  ['behind', 'From behind', 'from behind'],
];
const GEN_VIEWS_KEY = 'refboard.generate.views.v1';
const GEN_VIEW_WEIGHT = 1.3;

function genViewsPicked() {
  try {
    const v = JSON.parse(localStorage.getItem(GEN_VIEWS_KEY));
    if (Array.isArray(v)) return GEN_VIEWS.filter(x => v.includes(x[0])).map(x => x[0]);
  } catch { /* default */ }
  return ['wide', 'close', 'above'];
}

/* base: the request the choices make (genRequest()); views: GEN_VIEWS rows; seed: the one they share.
   One job for each view. */
function genSeriesJobs(base, views, seed) {
  const framing = new Set(GEN_CHOICES.find(c => c.id === 'framing').options.flatMap(o => typeof o.tags === 'string' ? genSplit(o.tags) : []));
  const plain = genWithout(genSplit(base.prompt), framing);
  return views.map(([, label, tags]) => ({
    ...base, seed,
    prompt: [...plain, ...genSplit(tags).map(t => `(${t}:${GEN_VIEW_WEIGHT})`)].join(', '),
    tags: [...base.tags, 'series', label.toLowerCase()].slice(0, 24).map(t => t.slice(0, 40)),
  }));
}

function genSeriesGo() {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (genSource) { status.textContent = 'A series is drawn from the choices alone: drop the picture first.'; return; }
  const picked = genViewsPicked(), views = GEN_VIEWS.filter(v => picked.includes(v[0]));
  if (views.length < 2) { status.textContent = 'Choose at least two views.'; return; }
  const base = genRequest();
  if (el('genQuality').value === 'draft') { base.steps = GEN_DRAFT_STEPS; base.tags = [...base.tags, 'draft'].slice(0, 24); }
  const jobs = genSeriesJobs(base, views, Math.floor(Math.random() * 2 ** 48));
  runGenerate(jobs, (i, n) => `Drawing view ${i} of ${n} - ${views[i - 1][1].toLowerCase()}...`, `${jobs.length} views of one scene - in Uploads, Generated.`,
    async made => { if (genLockWanted()) await genLockMade(made, status); });
}

/* ---- a movement */

// What she does, as the tags a model knows. Each row: the stems it is written with (English and
// Ukrainian) and the tags it gives.
const GEN_MOVES = [
  [/біж|біг|run|sprint|jog/, 'running, dynamic pose, motion lines'],
  [/йде|іде|ходи|ступ|walk|stroll/, 'walking'],
  [/стриб|jump|leap|hop/, 'jumping, mid-air, dynamic pose'],
  [/озир|оглян|назад|look(ing)? back|over (her )?shoulder/, 'looking back, over shoulder'],
  [/сид|сіда|sit/, 'sitting'],
  [/навколіш|kneel/, 'kneeling'],
  [/лежи|лягл|lying|lie down/, 'lying, on back'],
  [/пада|fall/, 'falling, dynamic angle'],
  [/тягн|дотяг|reach/, 'reaching, outstretched arm'],
  [/удар|бє|б'є|атак|strike|attack|punch/, 'attacking, fighting stance, dynamic pose, foreshortening'],
  [/копа|kick/, 'kicking, dynamic pose, foreshortening'],
  [/танц|dance/, 'dancing, dynamic pose'],
  [/кружля|крут|обертає|spin|twirl|turning/, 'spinning, turning around, hair flowing'],
  [/маха|wave|waving/, 'waving'],
  [/смі|laugh/, 'laughing, open mouth'],
  [/плач|плак|cry|tears/, 'crying, tears'],
  [/крич|крик|shout|yell/, 'shouting, open mouth'],
  [/спить|спати|сплять|sleep/, 'sleeping, closed eyes'],
  [/потягу|stretch/, 'stretching, arms up'],
  [/присіда|crouch|squat/, 'crouching'],
  [/тримає|holding|hold/, 'holding'],
];

/* text: "біжить, озирається". Gives { tags, unknown }: the tags to add, and the parts that no row knew and
   that are not plain English (an English part is passed on as it is: it is already a tag). */
function genMoveTags(text) {
  const tags = [], unknown = [];
  for (const part of String(text).toLowerCase().split(/,|;|\s+і\s+|\s+та\s+|\s+and\s+/).map(s => s.trim()).filter(Boolean)) {
    const hit = GEN_MOVES.filter(([re]) => re.test(part));
    if (hit.length) { for (const [, t] of hit) for (const x of t.split(', ')) if (!tags.includes(x)) tags.push(x); }
    else if (/^[a-z0-9 '-]+$/.test(part)) { if (!tags.includes(part)) tags.push(part); }
    else unknown.push(part);
  }
  return { tags, unknown };
}

function genMoveAdd() {
  const status = el('genStatus'), { tags, unknown } = genMoveTags(el('genMoveText').value);
  if (!tags.length) { status.textContent = unknown.length ? `Not known yet: ${unknown.join(', ')}. Try another word, or write it in English.` : 'Say what she does first.'; return; }
  const have = genSplit(el('genExtra').value), add = tags.filter(t => !have.includes(t));
  el('genExtra').value = [...have, ...add].join(', ').slice(0, 200);
  el('genExtra').dispatchEvent(new Event('input'));
  status.textContent = `Added to More tags: ${add.join(', ') || 'all were there already'}.` + (unknown.length ? ` Not known: ${unknown.join(', ')}.` : '');
}

/* ---- four lights from a photo */

async function genPhotoLights() {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (!genSource || genSource.mode !== 'study') { status.textContent = 'Start from a photo first.'; return; }
  const base = genRequest(), all = GEN_CHOICES.find(c => c.id === 'light').options.filter(o => o.id !== 'any');
  const oldWords = new Set(all.map(genWordsOfOption)), oldTags = new Set(all.flatMap(o => genSplit(o.tags)));
  const jobs = all.map(o => ({
    ...base,
    prompt: comfyTags([...genWithout(genSplit(base.prompt), oldTags), ...genSplit(o.tags).map(t => `(${t}:1.3)`)].join(', ')),
    tags: [...genWithout(base.tags, oldWords), genWordsOfOption(o)].slice(0, 24).map(t => t.slice(0, 40)),
    // A light is a change the sampler has to be free to make: not as close to the photo as a study would be.
    denoise: Math.max(base.denoise, 0.55),
  }));
  runGenerate(jobs, 'Drawing it in four lights...', 'Four lights from the photo - in Uploads, Generated.');
}

/* ---- colours to the palette */

const GEN_PULL_AMOUNTS = [['A little', 0.35, 'The colours move toward the palette; the picture still has its own'], ['Mostly', 0.7, 'Most of the way to the palette'], ['Fully', 1, 'Every coloured pixel takes a palette colour']];
const GEN_PULL_SIDE = 480;       // the long side the preview is made at
let pull = null;                 // { u, pic, small, rgbs, source, amount } while the sheet is open

// The palette a source names: the Holbein box, or the one sent from Palettes.
const genPullRgbs = source => source === 'box' ? genBoxRgbs() : (genChoices.palette || []);

/* The canvas `src` pulled to the palette `rgbs`, `amount` of the way from its own colours; null when
   the palette has no colour but grey. */
function genPullCanvas(src, rgbs, amount) {
  const out = Object.assign(document.createElement('canvas'), { width: src.width, height: src.height });
  const g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, out.width, out.height), was = new Uint8ClampedArray(d.data);
  if (genLockPixels(d.data, rgbs) < 0) return null;
  if (amount < 1) for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = was[i + k] + (d.data[i + k] - was[i + k]) * amount;
  g.putImageData(d, 0, 0);
  return out;
}

/* Which colours went where: pixels that moved, grouped by the colour they became (to 16 levels a
   channel), each with the mean colour it was and the colour it is, the biggest first. */
function genPullChanges(before, after, n = 6) {
  const a = before.getContext('2d').getImageData(0, 0, before.width, before.height).data;
  const b = after.getContext('2d').getImageData(0, 0, after.width, after.height).data;
  const groups = new Map();
  let moved = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < 24) continue;
    moved++;
    const key = (b[i] >> 4) << 8 | (b[i + 1] >> 4) << 4 | b[i + 2] >> 4;
    const g = groups.get(key) || { n: 0, from: [0, 0, 0], to: [0, 0, 0] };
    g.n++;
    for (let k = 0; k < 3; k++) { g.from[k] += a[i + k]; g.to[k] += b[i + k]; }
    groups.set(key, g);
  }
  return [...groups.values()].sort((x, y) => y.n - x.n).slice(0, n)
    .map(g => ({ share: g.n / Math.max(1, moved) * 100, from: g.from.map(v => Math.round(v / g.n)), to: g.to.map(v => Math.round(v / g.n)) }));
}

function genPullSheet() {
  let box = document.getElementById('pullSheet');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'pullSheet'; box.className = 'sheet sheet-center hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'pullTitle');
  box.innerHTML = `<div class="sheet-box pull-box"><div class="row"><h2 id="pullTitle" class="grow">Colours to the palette</h2>` +
    `<button type="button" class="ghost" id="pullClose" title="Close (Esc)">Close</button></div>` +
    `<div class="pull-pair"><figure><canvas id="pullBefore" aria-label="The picture"></canvas><figcaption>Now</figcaption></figure>` +
    `<figure><canvas id="pullAfter" aria-label="The picture pulled to the palette"></canvas><figcaption>Pulled</figcaption></figure></div>` +
    `<div class="pg-row"><span class="pg-label">Palette</span><div class="chips" id="pullSource" role="group" aria-label="Palette"></div></div>` +
    `<div class="pg-row"><span class="pg-label">How far</span><div class="chips" id="pullAmount" role="group" aria-label="How far to pull"></div></div>` +
    `<div class="pull-changes" id="pullChanges"></div><p class="count" id="pullNote" role="status"></p>` +
    `<div class="row"><button type="button" class="primary" id="pullKeep" title="Keep the pulled picture beside the original, in Generated">Keep as a new picture</button></div></div>`;
  document.body.appendChild(box);
  initSheet(box, genPullClose);
  box.querySelector('#pullClose').addEventListener('click', genPullClose);
  box.querySelector('#pullSource').addEventListener('click', e => { const b = e.target.closest('[data-source]'); if (b && pull) { pull.source = b.dataset.source; genPullRender(); } });
  box.querySelector('#pullAmount').addEventListener('click', e => { const b = e.target.closest('[data-amount]'); if (b && pull) { pull.amount = Number(b.dataset.amount); genPullRender(); } });
  box.querySelector('#pullKeep').addEventListener('click', genPullKeep);
  return box;
}

async function genPullOpen(u) {
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  const k = Math.min(1, GEN_PULL_SIDE / Math.max(pic.width, pic.height));
  const small = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(pic.width * k)), height: Math.max(1, Math.round(pic.height * k)) });
  small.getContext('2d').drawImage(pic, 0, 0, small.width, small.height);
  const source = genChoices.colours === 'palette' && (genChoices.palette || []).length ? 'palette' : 'box';
  pull = { u, pic, small, source, amount: 0.7 };
  const box = genPullSheet();
  box.querySelector('#pullSource').innerHTML =
    `<button type="button" class="chip" data-source="box" title="The 28 tubes of the Holbein box">Holbein box</button>` +
    `<button type="button" class="chip" data-source="palette" title="The palette sent from Palettes">Your palette</button>`;
  box.querySelector('#pullAmount').innerHTML = GEN_PULL_AMOUNTS.map(([label, v, hint]) => `<button type="button" class="chip" data-amount="${v}" title="${esc(hint)}">${esc(label)}</button>`).join('');
  box.classList.remove('hidden');
  dialogOpened(box, box.querySelector('#pullKeep'));
  genPullRender();
}

function genPullClose() {
  const box = document.getElementById('pullSheet');
  if (!box || !pull) return;
  pull = null;
  box.classList.add('hidden');
  dialogClosed(box);
}

function genPullRender() {
  const box = genPullSheet(), rgbs = genPullRgbs(pull.source);
  for (const b of box.querySelectorAll('[data-source]')) b.setAttribute('aria-pressed', String(b.dataset.source === pull.source));
  for (const b of box.querySelectorAll('[data-amount]')) b.setAttribute('aria-pressed', String(Number(b.dataset.amount) === pull.amount));
  const draw = (id, src) => { const c = box.querySelector(id); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); };
  draw('#pullBefore', pull.small);
  const out = genPullCanvas(pull.small, rgbs, pull.amount);
  pull.out = out;
  box.querySelector('#pullKeep').disabled = !out;
  if (!out) {
    draw('#pullAfter', pull.small);
    box.querySelector('#pullChanges').innerHTML = '';
    box.querySelector('#pullNote').textContent = pull.source === 'palette' ? 'There is no palette yet: make one in Palettes and send it with Use in Generate, or choose the Holbein box.' : 'This palette has no colour to pull to - only greys.';
    return;
  }
  draw('#pullAfter', out);
  box.querySelector('#pullChanges').innerHTML = genPullChanges(pull.small, out).map(c =>
    `<div class="pull-row"><i style="background:${rgbCss(c.from)}" title="${colHexOf(c.from)}"></i> &rarr; <i style="background:${rgbCss(c.to)}" title="${colHexOf(c.to)}"></i> <span>${Math.round(c.share)}%</span></div>`).join('');
  box.querySelector('#pullNote').textContent = 'The biggest changes, by share of what moved: the colour it was (left) and the one it became.';
}

// The pulled picture at the picture's own size, kept as a new one beside the old.
async function genPullKeep() {
  if (!pull || !pull.out) return;
  const note = el('pullNote'), doc = pull.u;
  note.textContent = 'Keeping...';
  try {
    const full = genPullCanvas(pull.pic, genPullRgbs(pull.source), pull.amount);
    const blob = await new Promise(res => full.toBlob(res, 'image/png'));
    const f = await storeFile(blob);
    if (storeMode === 'server') await storeSortFile(f.id, doc.folder || 'generated');
    await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png', parent: doc.file,
      tags: [...new Set([...(doc.tags || []), 'palette pulled'])].slice(0, 24), t: Date.now() });
    storeChanged();
    await showGenerate(false);
    note.textContent = 'Kept in Made here, beside the original.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}

/* ---- the panel */

function genMoreInit() {
  const body = el('genMoreBody');
  if (body.dataset.ready) return;
  body.dataset.ready = '1';
  body.innerHTML =
    `<div class="gm-block"><h5>A series</h5><p class="count">One scene, several views, the same seed and palette. Uses the choices above.</p>` +
    `<div class="chips" id="gmViews" role="group" aria-label="Views of the scene">${GEN_VIEWS.map(([id, label, tags]) => `<button type="button" class="chip" data-view="${id}" title="${esc(tags)}">${esc(label)}</button>`).join('')}</div>` +
    `<button type="button" class="ghost" id="gmSeries">Make the series</button></div>` +
    `<div class="gm-block"><h5>A movement</h5><p class="count">What she does, in your words - the tags go into More tags.</p>` +
    `<div class="row"><input type="text" id="genMoveText" maxlength="80" placeholder="e.g. біжить, озирається" aria-label="What she does"><button type="button" class="ghost" id="gmMove">Add</button></div></div>`;
  const syncViews = () => { const p = genViewsPicked(); for (const b of el('gmViews').children) b.setAttribute('aria-pressed', String(p.includes(b.dataset.view))); };
  syncViews();
  el('gmViews').addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    const p = new Set(genViewsPicked()); p.has(b.dataset.view) ? p.delete(b.dataset.view) : p.add(b.dataset.view);
    try { localStorage.setItem(GEN_VIEWS_KEY, JSON.stringify([...p])); } catch { /* private mode */ }
    syncViews();
  });
  el('gmSeries').addEventListener('click', genSeriesGo);
  el('gmMove').addEventListener('click', genMoveAdd);
  el('genMoveText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); genMoveAdd(); } });
}
