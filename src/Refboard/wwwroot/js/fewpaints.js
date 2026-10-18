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
const FEW_COUNTS = [2, 3, 4, 5];
const FEW_CAP = 25;      // a colour that lands further than this is "not reached" - and no further wrong than that
const FEW_WORTH = 0.5;   // a paint that brings the mean closer by less than this is not worth its place
const FEW_CLOSE = 4;     // paint.js's "close"

let few = { n: 3, result: null, sig: '', run: 0, running: false };
const fewCache = new Map(); // 'set|hex' -> the best recipe for that colour from that set

function fewLoad() {
  try { const n = JSON.parse(localStorage.getItem(FEW_KEY))?.n; if (FEW_COUNTS.includes(n)) few.n = n; } catch { /* the default */ }
}
function fewSave() {
  try { localStorage.setItem(FEW_KEY, JSON.stringify({ n: few.n })); } catch { /* private mode */ }
}

/* The best way to mix this colour from just these paints, in watercolour. */
function fewBest(rgb, keys) {
  const k = [...keys].sort().join('+') + '|' + colHexOf(rgb);
  if (!fewCache.has(k)) fewCache.set(k, paintRecipes(rgb, null, 1, 'water', keys)[0] || null);
  return fewCache.get(k);
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

const fewSig = () => pg.swatches.map(s => colHexOf(s.rgb)).join() + '|' + paintPaletteKey() + '|' + few.n;

async function fewRun() {
  const run = ++few.run, host = el('pgFew'), rgbs = pg.swatches.map(s => s.rgb);
  const pool = paintKeys(paintPaletteKey(), 'water');
  if (!paintInit()) { host.innerHTML = '<span class="count">Mixing needs js/vendor/spectral.js, which did not load.</span>'; return; }
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
