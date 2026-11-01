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
   Composition sketches. The same scene in six compositions - centred, left third, right third,
   diagonal, framed, small in a big place - as small quick drafts with one seed, to choose from
   before any is drawn big: they wait in the drafts strip, and Finish this makes the one you like.
   A or B. Two pictures made here, one after the other: which is better? What the winner has and
   the loser has not is counted, so the words that keep winning show, and can go into More tags.
   looks and what she does - drawn as pictures of one scene with one seed.
   The sketch pad, Line art, Details, Other conditions, the grid, the cards and the challenge are in js/gennew.js.
   Paint-ready, in Colours to a palette: the lightest part left as bare paper and the tones held
   to a few steps, so the picture shows what to leave unpainted and how many values to use.

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

// The request's words without the framing the choices carry: a view, a composition or a shot says its own.
function genPlainOfFraming(base) {
  const framing = new Set(GEN_CHOICES.find(c => c.id === 'framing').options.flatMap(o => typeof o.tags === 'string' ? genSplit(o.tags) : []));
  return genWithout(genSplit(base.prompt), framing);
}
const genWeighted = (tags, weight) => genSplit(tags).map(t => `(${t}:${weight})`);

/* base: the request the choices make (genRequest()); views: GEN_VIEWS rows; seed: the one they share.
   One job for each view. */
function genSeriesJobs(base, views, seed) {
  const plain = genPlainOfFraming(base);
  return views.map(([, label, tags]) => ({
    ...base, seed,
    prompt: [...plain, ...genWeighted(tags, GEN_VIEW_WEIGHT)].join(', '),
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
  [/стоїть|стоят|стоїш|stand/, 'standing'],
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

const GEN_READY_PAPER = [['Off', 0], ['5%', 0.05], ['12%', 0.12], ['25%', 0.25]];
const GEN_READY_STEPS = [['Off', 0], ['3 tones', 3], ['4 tones', 4], ['5 tones', 5]];
const GEN_READY_KEY = 'refboard.generate.ready.v1';
const GEN_PAPER_RGB = [245, 243, 236];

/* Paint-ready, on ImageData's Uint8ClampedArray, changed in place. `paper` is the share of the picture,
   its lightest part, that becomes bare paper; `steps` is how many tones the rest is held to (0: as it is).
   The tones are laid evenly between the 2nd and the 98th percentile of the picture's lightness, and each
   pixel keeps its hue: it is scaled to the middle of its band. Returns { paper, bands }: the share that is
   paper, and the share in each band, darkest first. */
function genPaintReady(data, { paper = 0, steps = 0 } = {}) {
  const n = data.length / 4, Y = new Float32Array(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    Y[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    hist[Math.min(255, Math.round(Y[i] * 255))]++;
  }
  // The lightness below which this share of the picture lies.
  const below = share => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= share * n) return v / 255; } return 1; };
  const cut = paper > 0 ? below(1 - paper) : 2;
  const lo = below(0.02), hi = Math.max(lo + 0.05, Math.min(below(0.98), cut));
  const bands = new Array(Math.max(steps, 0)).fill(0);
  let bare = 0, rest = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (paper > 0 && Y[i] >= cut) { data[p] = GEN_PAPER_RGB[0]; data[p + 1] = GEN_PAPER_RGB[1]; data[p + 2] = GEN_PAPER_RGB[2]; bare++; continue; }
    rest++;
    if (!steps) continue;
    const t = Math.min(1, Math.max(0, (Y[i] - lo) / (hi - lo))), band = Math.min(steps - 1, Math.floor(t * steps));
    bands[band]++;
    const k = Math.min(2.2, Math.max(0.4, (lo + (band + 0.5) / steps * (hi - lo)) / Math.max(Y[i], 0.03)));
    for (let c = 0; c < 3; c++) data[p + c] = data[p + c] * k;
  }
  return { paper: bare / n, bands: bands.map(b => b / Math.max(1, rest)) };
}

/* The canvas `src` pulled to the palette `rgbs`, `amount` of the way from its own colours, and then made
   paint-ready as `ready` says ({ paper, steps }); null when the palette has no colour but grey. The canvas
   carries what paint-ready found as `.ready`. */
function genPullCanvas(src, rgbs, amount, ready = null) {
  const out = Object.assign(document.createElement('canvas'), { width: src.width, height: src.height });
  const g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, out.width, out.height), was = new Uint8ClampedArray(d.data);
  if (genLockPixels(d.data, rgbs) < 0) return null;
  if (amount < 1) for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = was[i + k] + (d.data[i + k] - was[i + k]) * amount;
  if (ready && (ready.paper || ready.steps)) out.ready = genPaintReady(d.data, ready);
  g.putImageData(d, 0, 0);
  return out;
}

function genReadyLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(GEN_READY_KEY));
    return { paper: GEN_READY_PAPER.some(([, x]) => x === v?.paper) ? v.paper : 0, steps: GEN_READY_STEPS.some(([, x]) => x === v?.steps) ? v.steps : 0 };
  } catch { return { paper: 0, steps: 0 }; }
}
const genReadySay = r => !r ? '' :
  [r.paper ? `${Math.round(r.paper * 100)}% is left as bare paper - do not paint it.` : '',
    r.bands.length ? `Tones, darkest first: ${r.bands.map(b => Math.round(b * 100) + '%').join(', ')}.` : ''].filter(Boolean).join(' ');

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
    `<div class="pg-row"><span class="pg-label">Bare paper</span><div class="chips" id="pullPaper" role="group" aria-label="How much of the lightest part to leave as bare paper"></div></div>` +
    `<div class="pg-row"><span class="pg-label">Tones</span><div class="chips" id="pullSteps" role="group" aria-label="How many tones to hold the rest to"></div></div>` +
    `<div class="pull-changes" id="pullChanges"></div><p class="count" id="pullNote" role="status"></p>` +
    `<div class="row"><button type="button" class="primary" id="pullKeep" title="Keep the pulled picture beside the original, in Generated">Keep as a new picture</button></div></div>`;
  document.body.appendChild(box);
  initSheet(box, genPullClose);
  box.querySelector('#pullClose').addEventListener('click', genPullClose);
  box.querySelector('#pullSource').addEventListener('click', e => { const b = e.target.closest('[data-source]'); if (b && pull) { pull.source = b.dataset.source; genPullRender(); } });
  box.querySelector('#pullAmount').addEventListener('click', e => { const b = e.target.closest('[data-amount]'); if (b && pull) { pull.amount = Number(b.dataset.amount); genPullRender(); } });
  const ready = (id, key) => box.querySelector(id).addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b || !pull) return;
    pull[key] = Number(b.dataset.v);
    try { localStorage.setItem(GEN_READY_KEY, JSON.stringify({ paper: pull.paper, steps: pull.steps })); } catch { /* private mode */ }
    genPullRender();
  });
  ready('#pullPaper', 'paper'); ready('#pullSteps', 'steps');
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
  pull = { u, pic, small, source, amount: 0.7, ...genReadyLoad() };
  const box = genPullSheet();
  box.querySelector('#pullSource').innerHTML =
    `<button type="button" class="chip" data-source="box" title="The 28 tubes of the Holbein box">Holbein box</button>` +
    `<button type="button" class="chip" data-source="palette" title="The palette sent from Palettes">Your palette</button>`;
  box.querySelector('#pullAmount').innerHTML = GEN_PULL_AMOUNTS.map(([label, v, hint]) => `<button type="button" class="chip" data-amount="${v}" title="${esc(hint)}">${esc(label)}</button>`).join('');
  box.querySelector('#pullPaper').innerHTML = GEN_READY_PAPER.map(([label, v]) => `<button type="button" class="chip" data-v="${v}" title="${v ? `The lightest ${label} of the picture becomes bare paper` : 'Keep the light parts as they are'}">${esc(label)}</button>`).join('');
  box.querySelector('#pullSteps').innerHTML = GEN_READY_STEPS.map(([label, v]) => `<button type="button" class="chip" data-v="${v}" title="${v ? `The picture held to ${v} tones of light and dark` : 'Keep every tone'}">${esc(label)}</button>`).join('');
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
  for (const b of box.querySelectorAll('#pullPaper [data-v]')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === pull.paper));
  for (const b of box.querySelectorAll('#pullSteps [data-v]')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === pull.steps));
  const draw = (id, src) => { const c = box.querySelector(id); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); };
  draw('#pullBefore', pull.small);
  const out = genPullCanvas(pull.small, rgbs, pull.amount, { paper: pull.paper, steps: pull.steps });
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
  box.querySelector('#pullNote').textContent = 'The biggest changes, by share of what moved: the colour it was (left) and the one it became. ' + genReadySay(out.ready);
}

// The pulled picture at the picture's own size, kept as a new one beside the old.
async function genPullKeep() {
  if (!pull || !pull.out) return;
  const note = el('pullNote'), doc = pull.u, ready = { paper: pull.paper, steps: pull.steps };
  note.textContent = 'Keeping...';
  try {
    const full = genPullCanvas(pull.pic, genPullRgbs(pull.source), pull.amount, ready);
    const blob = await new Promise(res => full.toBlob(res, 'image/png'));
    const f = await storeFile(blob);
    if (storeMode === 'server') await storeSortFile(f.id, doc.folder || 'generated');
    await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png', parent: doc.file,
      tags: [...new Set([...(doc.tags || []), 'palette pulled', ...(ready.paper || ready.steps ? ['paint ready'] : [])])].slice(0, 24), t: Date.now() });
    storeChanged();
    await showGenerate(false);
    note.textContent = 'Kept in Made here, beside the original.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}

/* ---- the best of several */

/* The request drawn several times with different seeds, each picture read for what its pixels can say - the focus, the spread of
   light and what is lost to pure white or black (the Reference check's measures, js/quality.js) - and the best few kept. It cannot
   see a sixth finger or a wrong eye: it puts aside the blurred, the flat and the burnt, and the rest is for the eye. */
const GEN_BEST_COUNTS = [4, 6, 8];
const GEN_BEST_KEY = 'refboard.generate.best.v1';
const GEN_BEST_KEEP = 2;

function genBestLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(GEN_BEST_KEY)) || {}; } catch { /* defaults */ }
  return { count: GEN_BEST_COUNTS.includes(+s.count) ? +s.count : 6, drop: s.drop === true };
}
const genBestSave = patch => { try { localStorage.setItem(GEN_BEST_KEY, JSON.stringify({ ...genBestLoad(), ...patch })); } catch { /* private mode */ } };

// 0 to 100 from quality.js's measurements q: the steepest edge counts most, then the spread of light; pure white and black take away.
function genBestScore(q) {
  return Math.max(0, Math.round(Math.min(q.sharp, 30) / 30 * 55 + Math.min(q.spread, 80) / 80 * 35 + 10 - Math.min(q.blown + q.crushed, 12) * 2.5));
}

// rows: [{ doc, score }]. The best `keep` by score, then the rest; a tie goes to the one made first.
function genBestOrder(rows, keep = GEN_BEST_KEEP) {
  const sorted = rows.map((r, i) => ({ ...r, i })).sort((a, b) => b.score - a.score || a.i - b.i);
  return { best: sorted.slice(0, keep), rest: sorted.slice(keep) };
}

async function genBestGo() {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (genSource) { status.textContent = 'The best of several is drawn from the choices alone: drop the picture first.'; return; }
  const { count, drop } = genBestLoad(), base = genRequest();
  if (el('genQuality').value === 'draft') { base.steps = GEN_DRAFT_STEPS; base.tags = [...base.tags, 'draft'].slice(0, 24); }
  const jobs = Array.from({ length: count }, () => ({ ...base, seed: Math.floor(Math.random() * 2 ** 48) }));
  const rows = [];
  await runGenerate(jobs, (i, n) => `Drawing ${i} of ${n}...`, '',
    async made => {
      rows.push({ doc: made.doc, score: genBestScore(qualityOf(stepsRead(await genLoadPicture(made.doc)))) });
    });
  if (genStopped || rows.length < count) return;
  if (rows.length <= GEN_BEST_KEEP) { status.textContent = 'Too few pictures to choose from.'; return; }
  const { best, rest } = genBestOrder(rows);
  // Keep to the palette is done to the ones kept only: the rest are not worth the colouring.
  for (const r of best) {
    const doc = { ...r.doc, tags: [...(r.doc.tags || []), `best of ${rows.length}`].slice(0, 24) };
    await storePutItem('uploads', uploadKey(doc.file), doc);
    if (genLockWanted()) await genLockMade({ doc }, status);
  }
  for (const r of rest) {
    if (drop) await forgetUpload(r.doc);
    else await storePutItem('uploads', uploadKey(r.doc.file), { ...r.doc, tags: [...(r.doc.tags || []), 'passed over'].slice(0, 24) });
  }
  storeChanged();
  await showGenerate(false);
  status.textContent = `Kept the best ${best.length} of ${rows.length} (${best.map(r => r.score).join(' and ')} of 100); the other ${rest.length} ${drop ? 'deleted' : 'are tagged "passed over"'}. It reads focus and light, not hands: look them over.`;
}

/* ---- the panel */

function genMoreInit() {
  const body = el('genMoreBody');
  if (body.dataset.ready) return;
  body.dataset.ready = '1';
  const chips = (id, label, list, attr) => `<div class="chips" id="${id}" role="group" aria-label="${label}">${list.map(([k, name, tags]) => `<button type="button" class="chip" data-${attr}="${k}" title="${esc(tags)}">${esc(name)}</button>`).join('')}</div>`;
  const block = (id, title, text, inner) => `<details class="gm-block" id="${id}"><summary>${title}</summary><p class="count">${text}</p>${inner}</details>`;
  body.innerHTML =
    block('gmSeriesBlock', 'A series', 'One scene, several views, the same seed and palette. Uses the choices above.',
      chips('gmViews', 'Views of the scene', GEN_VIEWS, 'view') + `<button type="button" class="ghost" id="gmSeries">Make the series</button>`) +
    block('gmBestBlock', 'The best of several', 'The request drawn several times with different seeds; the pictures are read for focus and light and the best two kept. It cannot see hands.',
      `<div class="chips" id="gmBestCount" role="group" aria-label="How many to draw">${GEN_BEST_COUNTS.map(n => `<button type="button" class="chip" data-n="${n}">${n}</button>`).join('')}</div>` +
      `<div class="chips" id="gmBestDrop" role="group" aria-label="The ones passed over"><button type="button" class="chip" data-drop="0" title="They stay in Uploads, tagged 'passed over'">Keep the rest</button><button type="button" class="chip" data-drop="1" title="They are deleted">Delete the rest</button></div>` +
      `<button type="button" class="ghost" id="gmBestGo">Draw and choose</button>`) +
    block('gmMoveBlock', 'A movement', 'What she does, in your words - the tags go into More tags.',
      `<div class="row"><input type="text" id="genMoveText" maxlength="80" placeholder="e.g. біжить, озирається" aria-label="What she does"><button type="button" class="ghost" id="gmMove">Add</button></div>`) +
    genNewBlocks() + genPickBlocks();
  const sync = (id, picked, attr) => { const p = picked(); for (const b of el(id).children) b.setAttribute('aria-pressed', String(p.includes(b.dataset[attr]))); };
  const toggle = (id, key, picked, attr) => {
    sync(id, picked, attr);
    el(id).addEventListener('click', e => {
      const b = e.target.closest(`[data-${attr}]`); if (!b) return;
      const p = new Set(picked()); p.has(b.dataset[attr]) ? p.delete(b.dataset[attr]) : p.add(b.dataset[attr]);
      try { localStorage.setItem(key, JSON.stringify([...p])); } catch { /* private mode */ }
      sync(id, picked, attr);
    });
  };
  toggle('gmViews', GEN_VIEWS_KEY, genViewsPicked, 'view');
  const bestSync = () => {
    const b = genBestLoad();
    for (const x of el('gmBestCount').children) x.setAttribute('aria-pressed', String(+x.dataset.n === b.count));
    for (const x of el('gmBestDrop').children) x.setAttribute('aria-pressed', String((x.dataset.drop === '1') === b.drop));
  };
  bestSync();
  el('gmBestCount').addEventListener('click', e => { const x = e.target.closest('[data-n]'); if (x) { genBestSave({ count: +x.dataset.n }); bestSync(); } });
  el('gmBestDrop').addEventListener('click', e => { const x = e.target.closest('[data-drop]'); if (x) { genBestSave({ drop: x.dataset.drop === '1' }); bestSync(); } });
  // One block open at a time: the panel holds a dozen, and open they would be a page to scroll.
  body.addEventListener('toggle', e => { if (e.target.open) for (const d of body.querySelectorAll('details.gm-block[open]')) if (d !== e.target) d.open = false; }, true);
  el('gmBestGo').addEventListener('click', genBestGo);
  el('gmSeries').addEventListener('click', genSeriesGo);
  el('gmMove').addEventListener('click', genMoveAdd);
  el('genMoveText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); genMoveAdd(); } });
  genNewWire();
  genPickWire();
}
