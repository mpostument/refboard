/* refboard - Mix this colour: a colour to hit, and your own mix of the
   palette's paints to hit it with. The Colour studio's Match tab.

   Mixing recipes (paint.js) tell you the answer; this is the practice that
   makes the answer yours. A target is shown - a random reachable colour, or
   one of your own - and you choose up to three paints, how many parts of
   each, and in watercolour how much water. The mix is worked out with the
   same model as the recipes, shown against the target on a hard edge (the
   best way to compare two colours), scored in the recipes' own OKLab
   distance, and told in a painter's words what to change: lighter or
   darker, duller or stronger, and which way the hue must go.

   Looking at the answer is allowed and is not hidden: "Show a recipe" asks
   paintRecipes for the best one. A mix that lands close (under 4) can be
   remembered; the list of remembered recipes is a memory that outlives the
   session, and a click puts one back on the bench.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const MT_KEY = 'refboard.matchColour.v1';
const MT_SLOTS = 3;
const MT_MAX_PARTS = 12;
const MT_KEEP = 30;       // recipes remembered
const MT_CLOSE = 4;       // under this a mix is "close" - paint.js calls 2 "spot on", 4 "close"
const MT_PARTS = [1, 2, 3, 4, 6];

let mt = null;            // { target, slots: [{ k, n }], water, recipes, sig, peeked }
const mtAnswers = {};     // paintRecipes is slow (~75 ms): once per target and palette

function mtLoad() {
  mt = { target: null, slots: Array.from({ length: MT_SLOTS }, () => ({ k: '', n: 1 })), water: 0.5, recipes: [], sig: '', peeked: false };
  try {
    const s = JSON.parse(localStorage.getItem(MT_KEY) || '{}');
    if (Array.isArray(s.target) && s.target.length === 3 && s.target.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) mt.target = s.target;
    if (Array.isArray(s.recipes)) mt.recipes = s.recipes.filter(r => r && Array.isArray(r.rgb) && Array.isArray(r.parts) && r.parts.every(p => Array.isArray(p) && p[0] in PIGMENTS)).slice(0, MT_KEEP);
  } catch { /* private mode, or a damaged entry: start empty */ }
}
function mtSave() {
  try { localStorage.setItem(MT_KEY, JSON.stringify({ target: mt.target, recipes: mt.recipes })); } catch { /* private mode */ }
}

/* The mix on the bench: the chosen paints with their parts (the same paint
   in two slots adds up), and the water. A colour as [r, g, b], or null in
   oil with nothing chosen - watercolour with nothing chosen is the bare
   paper, which is also an answer (a white to leave). */
function mtParts(slots) {
  const sum = new Map();
  for (const { k, n } of slots) if (k && n > 0) sum.set(k, (sum.get(k) || 0) + n);
  return [...sum];
}
function mtMix(parts, water, medium) {
  if (!parts.length) return medium === 'water' ? paintRgb(new spectral.Color(paintInit().paper)) : null;
  return paintRgb(medium === 'water' ? paintWash(parts, water) : paintMix(parts));
}

// A random colour that the palette can make: a mix of one to three paints,
// so the target is always reachable and the best recipe can be exact.
function mtRandomTarget(keys, medium) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const roll = Math.random(), count = roll < 0.15 ? 1 : roll < 0.75 ? 2 : 3;
  const pool = keys.slice(), parts = [];
  while (parts.length < count && pool.length) parts.push([pool.splice(Math.floor(Math.random() * pool.length), 1)[0], pick(MT_PARTS)]);
  return mtMix(parts, medium === 'water' ? pick(PAINT_WASH.slice(0, 5)) : 0, medium);
}

// Distance between two colours, the recipes' own: OKLab x 100, about 2 at the edge of noticing.
function mtDelta(a, b) {
  const x = new spectral.Color(a).OKLab, y = new spectral.Color(b).OKLab;
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
// Hue angles (OKLab) to names; estimates, to the nearest colour a painter would say.
const MT_HUES = [[20, 'pink'], [42, 'red'], [72, 'orange'], [115, 'yellow'], [165, 'green'], [215, 'cyan'], [275, 'blue'], [322, 'violet'], [361, 'pink']];
const mtHueName = h => MT_HUES.find(([to]) => h < to)[1];

/* What to change, in a few words: lightness first (the biggest error most
   mixes make), then strength, then hue. Empty when the mix is close. */
function mtAdvice(mine, target, medium) {
  const [L1, C1, h1] = rgbOklch(mine), [L2, C2, h2] = rgbOklch(target), say = [];
  const dL = 100 * (L1 - L2), dC = 100 * (C1 - C2);
  if (dL > 4) say.push(medium === 'water' ? 'Yours is lighter: less water, or more paint.' : 'Yours is lighter: less white, or a darker paint.');
  else if (dL < -4) say.push(medium === 'water' ? 'Yours is darker: more water.' : 'Yours is darker: more white.');
  if (dC > 3) say.push('Yours is stronger: a little of its opposite will quieten it.');
  else if (dC < -3) say.push('Yours is duller: fewer paints, or ones nearer the hue.');
  const dh = ((h2 - h1 + 540) % 360) - 180;
  if (Math.abs(dh) > 10 && C1 > 0.03 && C2 > 0.03) say.push(`The hue wants to go toward ${mtHueName(h2)}.`);
  return say.join(' ');
}

const mtRecipeOf = () => ({ parts: mtParts(mt.slots), wash: col.medium === 'water' ? mt.water : null });
const mtWords = r => paintRecipeText({ parts: r.parts.map(([k, n]) => [k, n]), wash: r.wash });

function mtOptions() {
  const keys = paintKeys(col.paints, col.medium);
  return '<option value="">- none -</option>' + keys.map(k => `<option value="${k}">${esc(PIGMENTS[k].name + (PIGMENTS[k].tube ? ' ' + PIGMENTS[k].tube.code : ''))}</option>`).join('');
}

// The controls that depend on the palette and the medium: built once per change of either.
function mtBuild() {
  const keys = paintKeys(col.paints, col.medium);
  for (const s of mt.slots) if (s.k && !keys.includes(s.k)) s.k = '';
  el('mtSlots').innerHTML = mt.slots.map((s, i) =>
    `<label class="mt-slot"><span class="mt-sw" id="mtSw${i}"></span>` +
    `<select data-mt-k="${i}" aria-label="Paint ${i + 1}">${mtOptions()}</select>` +
    `<input type="range" min="1" max="${MT_MAX_PARTS}" step="1" value="${s.n}" data-mt-n="${i}" aria-label="Parts of paint ${i + 1}">` +
    `<output id="mtN${i}"></output></label>`).join('');
  mt.slots.forEach((s, i) => { el('mtSlots').querySelector(`[data-mt-k="${i}"]`).value = s.k; });
  el('mtWaterRow').hidden = col.medium !== 'water';
  mt.sig = col.paints + '|' + col.medium;
}

function matchRender() {
  if (!paintInit()) { el('mtNote').textContent = 'The paint model has not loaded.'; return; }
  if (!mt) mtLoad();
  if (mt.sig !== col.paints + '|' + col.medium) mtBuild();
  if (!mt.target) mt.target = mtRandomTarget(paintKeys(col.paints, col.medium), col.medium);
  mtUpdate();
  mtRenderMemory();
}

// Everything that moves while a slider does: the swatches, the numbers, the verdict.
function mtUpdate() {
  const medium = col.medium, r = mtRecipeOf(), mine = mtMix(r.parts, mt.water, medium);
  el('mtTarget').style.background = rgbCss(mt.target);
  el('mtTargetHex').textContent = colHex(mt.target);
  el('mtOwn').value = colHex(mt.target);
  el('mtMine').style.background = mine ? rgbCss(mine) : 'transparent';
  el('mtMineHex').textContent = mine ? colHex(mine) : 'choose a paint';
  mt.slots.forEach((s, i) => {
    el(`mtN${i}`).textContent = s.k ? `${s.n} part${s.n > 1 ? 's' : ''}` : '';
    el('mtSlots').querySelector(`[data-mt-n="${i}"]`).disabled = !s.k;
    const sw = el(`mtSw${i}`);
    sw.style.background = s.k ? rgbCss(mtMix([[s.k, 1]], 1, medium)) : 'transparent';
  });
  el('mtWater').value = Math.round(mt.water * 100);
  el('mtWaterOut').textContent = `${Math.round(mt.water * 100)}% paint - ${paintWashWord(mt.water)}`;
  const verdict = el('mtVerdict'), keep = el('mtKeep');
  if (!mine) {
    verdict.textContent = 'Choose a paint to start.';
    keep.disabled = true;
  } else {
    const dE = mtDelta(mine, mt.target);
    mt.dE = dE;
    verdict.textContent = `${dE < 8 ? paintMatchWord(dE).replace(/^./, c => c.toUpperCase()) : 'Still far'} - distance ${dE.toFixed(1)}. ` + (dE < 2 ? 'You have hit it.' : mtAdvice(mine, mt.target, medium));
    keep.disabled = dE >= MT_CLOSE || !r.parts.length;
  }
  keep.title = keep.disabled ? `A mix within ${MT_CLOSE} of the target can be remembered` : 'Remember this recipe for this colour';
}

// The best recipe the palette has for the target, on request.
function mtShowAnswer() {
  const key = [colHex(mt.target), col.paints, col.medium].join('|');
  if (!(key in mtAnswers)) mtAnswers[key] = paintRecipes(mt.target, col.paints, 1, col.medium)[0];
  const best = mtAnswers[key];
  el('mtAnswer').innerHTML = best ? paintRecipeHtml(best) + '<button type="button" class="ghost" id="mtUse" title="Put these paints on the bench">Put it on the bench</button>' : '';
  mt.answer = best;
}

function mtBench(parts, wash) {
  mt.slots = Array.from({ length: MT_SLOTS }, (_, i) => parts[i] ? { k: parts[i][0], n: Math.min(MT_MAX_PARTS, parts[i][1]) } : { k: '', n: 1 });
  if (wash !== null && wash !== undefined) mt.water = wash;
  mt.sig = '';
  matchRender();
}

function mtRenderMemory() {
  const host = el('mtMemory');
  if (!mt.recipes.length) { host.innerHTML = '<div class="count">Hit a colour (distance under 4) and remember the recipe: it stays here.</div>'; return; }
  host.innerHTML = mt.recipes.map((r, i) =>
    `<div class="mt-mem"><button type="button" class="mt-mem-pick" data-mt-mem="${i}" title="${esc(mtWords(r))} - put it back on the bench">` +
    `<i style="background:${rgbCss(r.rgb)}"></i><span>${esc(mtWords(r))}</span><em>${r.medium === 'water' ? 'watercolour' : 'oil'} - ${colHex(r.rgb)}</em></button>` +
    `<button type="button" class="ghost mt-mem-del" data-mt-del="${i}" aria-label="Forget this recipe" title="Forget it">&times;</button></div>`).join('');
}

function mtNewTarget(rgb) {
  mt.target = rgb || mtRandomTarget(paintKeys(col.paints, col.medium), col.medium);
  mt.answer = null;
  el('mtAnswer').innerHTML = '';
  mtSave();
  mtUpdate();
}

function initMatch() {
  mtLoad();
  const slots = el('mtSlots');
  slots.addEventListener('input', e => {
    const k = e.target.closest('[data-mt-k]'), n = e.target.closest('[data-mt-n]');
    if (k) mt.slots[+k.dataset.mtK].k = k.value;
    if (n) mt.slots[+n.dataset.mtN].n = +n.value;
    if (k || n) mtUpdate();
  });
  el('mtWater').addEventListener('input', () => { mt.water = +el('mtWater').value / 100; mtUpdate(); });
  el('mtNew').addEventListener('click', () => mtNewTarget());
  el('mtOwn').addEventListener('input', () => mtNewTarget(hexToRgb(el('mtOwn').value)));
  el('mtShow').addEventListener('click', mtShowAnswer);
  el('mtAnswer').addEventListener('click', e => { if (e.target.closest('#mtUse') && mt.answer) mtBench(mt.answer.parts, mt.answer.wash); });
  el('mtKeep').addEventListener('click', () => {
    const r = mtRecipeOf(), id = colHex(mt.target) + col.medium;
    mt.recipes = [{ rgb: mt.target, parts: r.parts, wash: r.wash, medium: col.medium, dE: +mt.dE.toFixed(1) },
      ...mt.recipes.filter(x => colHex(x.rgb) + x.medium !== id)].slice(0, MT_KEEP);
    mtSave();
    mtRenderMemory();
  });
  el('mtMemory').addEventListener('click', e => {
    const del = e.target.closest('[data-mt-del]'), pick = e.target.closest('[data-mt-mem]');
    if (del) { mt.recipes.splice(+del.dataset.mtDel, 1); mtSave(); mtRenderMemory(); return; }
    if (!pick) return;
    const r = mt.recipes[+pick.dataset.mtMem];
    mt.target = r.rgb;
    mt.answer = null;
    el('mtAnswer').innerHTML = '';
    // The paints go on the bench only in the medium they were made in.
    if (r.medium === col.medium) mtBench(r.parts.filter(([k]) => paintKeys(col.paints, col.medium).includes(k)), r.wash);
    else { mtSave(); matchRender(); }
  });
}
