/* refboard - Fewest paints: which few of your paints are enough to paint this
   palette. The Palette view's "Your paints" box can hold two dozen tubes; a
   study held to three of them hangs together, and a painter who has to pick
   three wants to know which three. Watercolour - the paints are mixed with
   water, and the white is the paper (paint.js).

   For every set of paints the palette's colours are mixed as well as that set
   can (paintRecipes, given only those paints), and the set is scored by how far
   the colours land from the ones asked for - OKLab distance x 100, the recipes'
   own scale, where 2 is "just noticeable". The best set is built up one paint
   at a time, each step taking the paint that helps most, then every chosen
   paint is tried against every other in its place: the best three are not
   always the best two plus one more.

   Loaded with palette.js - see lazy-palette in index.html. */
"use strict";

const FEW_KEY = 'refboard.fewpaints.v1';
const FEW_FOR = { paints: 'Paints', copic: 'Copic markers' };

/* Copic Sketch colours people reach for first - NOT the whole range. The
   codes and names are the maker's; the hex is my estimate of what each lays
   down on white paper (a printed chip is not your paper, and a second layer
   goes darker), to be corrected from a swatch photo like the Holbein box. A
   marker is not mixed with another on the page - it is laid over it - so a
   colour here is matched to the NEAREST single marker. */
const COPIC_COLOURS = [
  ['E000', 'Pale Fruit Pink', '#fbeae3'], ['E11', 'Barely Beige', '#f6dcc4'], ['E21', 'Soft Sun', '#f4e4cc'], ['E04', 'Lipstick Natural', '#eab0a0'],
  ['E35', 'Chamois', '#d9b98c'], ['E43', 'Dull Ivory', '#e8d3b4'], ['E57', 'Light Walnut', '#b88a5e'], ['E29', 'Burnt Sienna', '#a6603f'], ['E37', 'Sepia', '#7a4a32'],
  ['R05', 'Salmon Red', '#ee6b5c'], ['R20', 'Blush', '#f6cdd1'], ['R29', 'Lipstick Red', '#e0383b'], ['R59', 'Cardinal', '#a8283a'],
  ['RV25', 'Pink', '#f19bb2'], ['RV04', 'Shock Pink', '#ec4f8e'], ['RV09', 'Fuchsia', '#d6317f'],
  ['YR04', 'Chrome Orange', '#f7b33e'], ['YR07', 'Cadmium Orange', '#ef7a2c'], ['Y11', 'Pale Yellow', '#fbf2a3'], ['Y15', 'Cadmium Yellow', '#fbe03b'], ['Y08', 'Acacia', '#f0c648'],
  ['YG09', 'Lettuce Green', '#a6d35a'], ['YG17', 'Grass Green', '#7fbf4a'], ['YG67', 'Moss', '#8a9a4a'], ['G17', 'Forest Green', '#2f8f4e'], ['G28', 'Ocean Green', '#57b9a0'],
  ['BG13', 'Mint Green', '#bfe5d4'], ['BG09', 'Blue Green', '#2fae9a'], ['B02', 'Robin Egg Blue', '#a7dbe8'], ['B04', 'Tahitian Blue', '#2fb3dc'],
  ['B14', 'Light Blue', '#7cc3ea'], ['B24', 'Sky', '#bfdcf0'], ['B29', 'Ultramarine', '#2f6fc0'], ['B39', 'Prussian Blue', '#2b4f94'],
  ['V12', 'Pale Lavender', '#d8cbe6'], ['V04', 'Lilac', '#b9a2d4'], ['V09', 'Violet', '#7d56a8'], ['V17', 'Amethyst', '#6a4a96'],
  ['N1', 'Neutral Gray 1', '#e6e6e4'], ['N3', 'Neutral Gray 3', '#c9c9c8'], ['N5', 'Neutral Gray 5', '#a6a6a6'], ['N7', 'Neutral Gray 7', '#7f7f80'], ['N9', 'Neutral Gray 9', '#515253'], ['100', 'Black', '#1f1f21'],
].map(([code, name, hex]) => ({ code, name, hex, rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
const FEW_COPIC = Object.fromEntries(COPIC_COLOURS.map(m => [m.code, m]));
const fewLab = rgb => linToOklab(...rgb.map(v => srgbToLin(v / 255)));
const FEW_COUNTS = [2, 3, 4, 5];
const FEW_CAP = 25;      // a colour that lands further than this is "not reached" - and no further wrong than that
const FEW_WORTH = 0.5;   // a paint that brings the mean closer by less than this is not worth its place
const FEW_CLOSE = 4;     // paint.js's "close"

let few = { medium: 'paints', n: 3, result: null, sig: '', run: 0, running: false };
const fewCache = new Map(); // 'set|hex' -> the best recipe for that colour from that set

function fewLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(FEW_KEY));
    if (FEW_COUNTS.includes(v?.n)) few.n = v.n;
    if (FEW_FOR[v?.medium]) few.medium = v.medium;
  } catch { /* the default */ }
}
function fewSave() {
  try { localStorage.setItem(FEW_KEY, JSON.stringify({ n: few.n, medium: few.medium })); } catch { /* private mode */ }
}

/* The best way to mix this colour from just these paints, in watercolour. */
function fewBest(rgb, keys) {
  if (few.medium === 'copic') return fewNearest(rgb, keys);
  const k = [...keys].sort().join('+') + '|' + colHexOf(rgb);
  if (!fewCache.has(k)) fewCache.set(k, paintRecipes(rgb, null, 1, 'water', keys)[0] || null);
  return fewCache.get(k);
}

/* Markers: the nearest single one, as a recipe-shaped answer. */
function fewNearest(rgb, keys) {
  const t = fewLab(rgb);
  let best = null;
  for (const k of keys) {
    const l = FEW_COPIC[k].lab || (FEW_COPIC[k].lab = fewLab(FEW_COPIC[k].rgb));
    const d = 100 * Math.hypot(l[0] - t[0], l[1] - t[1], l[2] - t[2]);
    if (!best || d < best.dE) best = { key: k, dE: d };
  }
  return best;
}

/* How far a set of paints lands from the colours, on average - lower is better. */
function fewScore(keys, rgbs) {
  let t = 0;
  for (const rgb of rgbs) t += Math.min(FEW_CAP, fewBest(rgb, keys)?.dE ?? FEW_CAP);
  return t / rgbs.length;
}

const fewTick = () => new Promise(r => setTimeout(r, 0));

/* The paints, from `pool`, to use for `rgbs` - at most `n` of them. Gives
   { keys, scores } where scores[i] is the mean distance with the first i + 1
   paints, so the caller can say what a further paint bought. `step` reports
   progress; `alive` says whether this run is still wanted (a new one started,
   or the palette changed). */
async function fewChoose(rgbs, pool, n, step, alive) {
  let chosen = [];
  const scores = [];
  for (let size = 1; size <= Math.min(n, pool.length); size++) {
    let best = null;
    const rest = pool.filter(k => !chosen.includes(k));
    for (let i = 0; i < rest.length; i++) {
      const keys = [...chosen, rest[i]], sc = fewScore(keys, rgbs);
      if (!best || sc < best.sc) best = { keys, sc };
      step(size, i + 1, rest.length);
      await fewTick();
      if (!alive()) return null;
    }
    chosen = best.keys;
    scores.push(best.sc);
  }
  // Each chosen paint against every other in its place, until nothing improves.
  let cur = scores[scores.length - 1];
  for (let pass = 0, again = true; again && pass < 3; pass++) {
    again = false;
    for (let i = 0; i < chosen.length; i++) {
      for (const k of pool) {
        if (chosen.includes(k)) continue;
        const keys = chosen.map((c, j) => j === i ? k : c), sc = fewScore(keys, rgbs);
        if (sc < cur - 0.05) { chosen = keys; cur = sc; again = true; }
        await fewTick();
        if (!alive()) return null;
      }
    }
    step(chosen.length + 1, pass + 1, 3);
  }
  scores[scores.length - 1] = cur;
  // Fewest: drop the paints at the end that earn nothing. The scores are for the
  // greedy order, so the dropped ones are the last it added - after the swaps the
  // set is judged again as a whole.
  let keep = chosen.length;
  while (keep > 1) {
    const without = chosen.slice(0, keep - 1), withAll = chosen.slice(0, keep);
    if (fewScore(without, rgbs) - fewScore(withAll, rgbs) >= FEW_WORTH) break;
    keep--;
  }
  return { keys: chosen.slice(0, keep), asked: n, scores };
}

const fewSig = () => pg.swatches.map(s => colHexOf(s.rgb)).join() + '|' + (few.medium === 'copic' ? 'copic' : paintPaletteKey()) + '|' + few.n;

async function fewRun() {
  const run = ++few.run, host = el('pgFew'), rgbs = pg.swatches.map(s => s.rgb);
  const copic = few.medium === 'copic';
  const pool = copic ? COPIC_COLOURS.map(m => m.code) : paintKeys(paintPaletteKey(), 'water');
  if (!copic && !paintInit()) { host.innerHTML = '<span class="count">Mixing needs js/vendor/spectral.js, which did not load.</span>'; return; }
  if (pool.length < 2) { host.innerHTML = '<span class="count">Two paints at least are needed in the box above.</span>'; return; }
  host.classList.remove('hidden');
  el('pgFewGo').disabled = true;
  const sig = fewSig();
  few.running = true; few.sig = sig; few.result = null;
  const res = await fewChoose(rgbs, pool, few.n, (size, i, of) => {
    host.innerHTML = `<span class="count" aria-busy="true">${size <= few.n ? `Looking for paint ${size} of ${few.n} - ${i} of ${of} tried` : 'Trying each paint in place of another'}...</span>`;
  }, () => run === few.run);
  if (run !== few.run) return;            // another run, or the palette changed, took over
  el('pgFewGo').disabled = false;
  few.running = false; few.result = res;
  fewRender();
  // The palette row is tall: the answer is below the fold on most screens.
  host.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function fewRender() {
  const host = el('pgFew'), res = few.result;
  if (!res || few.sig !== fewSig()) { host.classList.add('hidden'); host.innerHTML = ''; return; }
  host.classList.remove('hidden');
  if (few.medium === 'copic') { fewRenderCopic(host, res); return; }
  const rows = pg.swatches.map(s => ({ rgb: s.rgb, r: fewBest(s.rgb, res.keys) }));
  const close = rows.filter(x => x.r && x.r.dE < FEW_CLOSE).length;
  const far = rows.reduce((a, x) => (x.r?.dE ?? FEW_CAP) > (a.r?.dE ?? FEW_CAP) ? x : a, rows[0]);
  const named = k => esc(PIGMENTS[k].name) + (PIGMENTS[k].tube ? ` <span class="count">(box ${esc(PIGMENTS[k].tube.pos)})</span>` : '');
  const fewer = res.keys.length < res.asked
    ? ` ${res.keys.length === 1 ? 'One paint is' : res.keys.length + ' paints are'} enough: another would not bring any colour noticeably closer.`
    : '';
  host.innerHTML =
    `<h4>${res.keys.length === 1 ? 'One paint' : res.keys.length + ' paints'} for this palette</h4>` +
    '<div class="pg-few-paints">' + res.keys.map(k => `<span class="pg-few-paint"><i style="background:${PIGMENTS[k].hex}"></i>${named(k)}</span>`).join('') + '</div>' +
    `<p class="count">${close} of ${rows.length} colours land close (under ${FEW_CLOSE}); the furthest, ${esc(palgenName(far.rgb))} (${colHexOf(far.rgb)}), is as near as ${(far.r?.dE ?? FEW_CAP).toFixed(1)}.${fewer} Paper is the white.</p>` +
    '<div class="pg-few-rows">' + rows.map(x => `<div class="pg-few-row"><i style="background:${colHexOf(x.rgb)}" title="${colHexOf(x.rgb)} - the colour asked for"></i>` +
      (x.r ? paintRecipeHtml(x.r) : '<span class="count">no mix found</span>') + '</div>').join('') + '</div>';
}

function fewRenderCopic(host, res) {
  const rows = pg.swatches.map(s => ({ rgb: s.rgb, r: fewNearest(s.rgb, res.keys) }));
  const close = rows.filter(x => x.r.dE < FEW_CLOSE).length;
  const far = rows.reduce((a, x) => x.r.dE > a.r.dE ? x : a, rows[0]);
  const chip = m => `<i style="background:${m.hex}"></i>${esc(m.code)} ${esc(m.name)}`;
  const fewer = res.keys.length < res.asked
    ? ` ${res.keys.length === 1 ? 'One marker is' : res.keys.length + ' markers are'} enough: another would not bring any colour noticeably closer.` : '';
  host.innerHTML =
    `<h4>${res.keys.length === 1 ? 'One marker' : res.keys.length + ' markers'} for this palette</h4>` +
    '<div class="pg-few-paints">' + res.keys.map(k => `<span class="pg-few-paint">${chip(FEW_COPIC[k])}</span>`).join('') + '</div>' +
    `<p class="count">${close} of ${rows.length} colours land close (under ${FEW_CLOSE}); the furthest, ${esc(palgenName(far.rgb))} (${colHexOf(far.rgb)}), is ${far.r.dE.toFixed(1)} away.${fewer} ` +
    'A marker is not mixed with another, so each colour takes its nearest one; laid over a lighter one it goes darker. The markers\' colours are my estimate, from a short list - not the whole range.</p>' +
    '<div class="pg-few-rows">' + rows.map(x => `<div class="pg-few-row"><i style="background:${colHexOf(x.rgb)}" title="${colHexOf(x.rgb)} - the colour asked for"></i><span class="pg-few-paint">${chip(FEW_COPIC[x.r.key])}</span> <span class="count">${x.r.dE.toFixed(1)}</span></div>`).join('') + '</div>';
}

/* The palette or the paints changed under a result: it no longer answers. */
function fewSync() {
  if ((few.result || few.running) && few.sig !== fewSig()) {
    few.run++;                            // a run still going is for the old palette
    few.running = false; few.result = null;
    el('pgFewGo').disabled = false;
    fewRender();                          // clears the panel
  }
}

function initFewPaints() {
  fewLoad();
  const forHost = el('pgFewFor');
  forHost.innerHTML = Object.entries(FEW_FOR).map(([k, l]) => `<button class="chip" type="button" data-few-for="${k}" aria-pressed="${k === few.medium}">${l}</button>`).join('');
  forHost.addEventListener('click', e => {
    const b = e.target.closest('[data-few-for]');
    if (!b) return;
    few.medium = b.dataset.fewFor;
    fewSave();
    for (const c of forHost.children) c.setAttribute('aria-pressed', String(c === b));
    fewSync();
  });
  const chips = el('pgFewN');
  chips.innerHTML = FEW_COUNTS.map(n => `<button class="chip" type="button" data-few="${n}" aria-pressed="${n === few.n}">${n}</button>`).join('');
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-few]');
    if (!b) return;
    few.n = Number(b.dataset.few);
    fewSave();
    for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b));
    fewSync();
  });
  el('pgFewGo').addEventListener('click', fewRun);
}
