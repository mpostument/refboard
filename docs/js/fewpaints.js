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
const FEW_FOR = { paints: 'Paints', copic: 'Copic markers', pencils: 'Pencils' };

/* The whole Copic Sketch range (js/copic-colours.js). The hex is the maker's swatch as a screen shows it - NOT what
   it lays down on your paper (a second layer goes darker). A marker is not mixed with another on the page - it is laid
   over it - so a colour is matched to the NEAREST single marker. family: the letters of the code - E, R, RV, YG... */
const COPIC_COLOURS = COPIC_ALL.map(([code, name, hex]) => ({ code, name, hex, family: code.replace(/\d.*$/, '') || code,
  rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
const FEW_COPIC = Object.fromEntries(COPIC_COLOURS.map(m => [m.code, m]));
const fewLab = rgb => linToOklab(...rgb.map(v => srgbToLin(v / 255)));
/* Watercolour pencils - the Faber-Castell numbering (js/pencil-colours.js), the whole range bar white and the metallics.
   The colours are an estimate of the dry stroke on white paper, to be corrected from a swatch photo like the Holbein
   box and the markers. A pencil is not mixed on a palette - it is laid in layers on the paper - so a colour is matched
   by one pencil (pressed lightly or firmly) or by two, the second over the first. family: the hue group, so 116
   pencils can be marked a group at a time. */
function pencilFamily(rgb) {
  const [r, g, b] = rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 0.1 || (d / (1 - Math.abs(2 * l - 1) || 1)) < 0.14) return "Grey";
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 50 && l < 0.58 && h >= 8) return "Brown";
  if (h >= 330 || h < 8) return l > 0.72 ? "Pink" : "Red";
  if (h < 20) return "Red";
  if (h < 42) return "Orange";
  if (h < 70) return "Yellow";
  if (h < 175) return "Green";
  if (h < 255) return "Blue";
  if (h < 290) return "Violet";
  return "Pink";
}
const PENCIL_COLOURS = PENCIL_ALL.map(([code, name, hex]) => { const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return { code, name, hex, rgb, family: pencilFamily(rgb) }; });
const FEW_PENCIL = Object.fromEntries(PENCIL_COLOURS.map(m => [m.code, m]));
const PENCIL_PRESS = { light: 0.5, firm: 1 };   // how much of the pencil's colour a stroke lays on what is under it
const FEW_COUNTS = [2, 3, 4, 5];
const FEW_CAP = 25;      // a colour that lands further than this is "not reached" - and no further wrong than that
const FEW_WORTH = 0.5;   // a paint that brings the mean closer by less than this is not worth its place
const FEW_CLOSE = 4;     // paint.js's "close"

// own: the codes of the markers and of the pencils you have, or null where nothing is marked - the whole list.
let few = { medium: 'paints', n: 3, result: null, sig: '', run: 0, running: false, own: { copic: null, pencils: null } };
const FEW_LISTS = () => ({ copic: COPIC_COLOURS, pencils: PENCIL_COLOURS });
const FEW_THINGS = { copic: 'markers', pencils: 'pencils' };
// The codes the search may use: the ones marked as yours, or the whole list.
function fewMine(kind) {
  const all = FEW_LISTS()[kind].map(m => m.code), own = few.own[kind];
  return own ? all.filter(c => own.includes(c)) : all;
}
const fewCache = new Map(); // 'set|hex' -> the best recipe for that colour from that set

function fewLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(FEW_KEY));
    if (FEW_COUNTS.includes(v?.n)) few.n = v.n;
    if (FEW_FOR[v?.medium]) few.medium = v.medium;
    for (const k of Object.keys(few.own)) if (Array.isArray(v?.own?.[k])) few.own[k] = v.own[k];
  } catch { /* the default */ }
}
function fewSave() {
  try { localStorage.setItem(FEW_KEY, JSON.stringify({ n: few.n, medium: few.medium, own: few.own })); } catch { /* private mode */ }
}

/* The best way to get this colour from just these paints, markers or pencils. */
function fewBest(rgb, keys) {
  if (few.medium === 'copic') return fewNearest(rgb, keys);
  if (few.medium === 'pencils') return fewLayers(rgb, keys);
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

/* A pencil laid on what is under it: the stroke's lightness lets the under
   colour show, and where it covers it multiplies - a yellow over a blue goes
   green, as a glaze does. */
const pencilOver = (under, rgb, press) => under.map((u, i) => u * (1 - press) + (u * rgb[i] / 255) * press);

/* Pencils: the nearest single pencil (light or firm), or two laid one over the
   other. As a recipe: { key, press, over?, pressOver?, rgb, dE }. */
function fewLayers(rgb, keys) {
  const ck = 'pencils|' + [...keys].sort().join('+') + '|' + colHexOf(rgb);
  if (fewCache.has(ck)) return fewCache.get(ck);
  const t = fewLab(rgb), WHITE = [255, 255, 255];
  let best = null;
  const tryIt = (r, got) => {
    const l = fewLab(got), d = 100 * Math.hypot(l[0] - t[0], l[1] - t[1], l[2] - t[2]);
    if (!best || d < best.dE) best = { ...r, rgb: got.map(Math.round), dE: d };
  };
  for (const a of keys) for (const [pa, va] of Object.entries(PENCIL_PRESS)) {
    const first = pencilOver(WHITE, FEW_PENCIL[a].rgb, va);
    tryIt({ key: a, press: pa }, first);
    for (const b of keys) if (b !== a) for (const [pb, vb] of Object.entries(PENCIL_PRESS))
      tryIt({ key: a, press: pa, over: b, pressOver: pb }, pencilOver(first, FEW_PENCIL[b].rgb, vb));
  }
  fewCache.set(ck, best);
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

const fewSig = () => pg.swatches.map(s => colHexOf(s.rgb)).join() + '|' + (few.medium === 'paints' ? paintPaletteKey() : few.medium + ':' + fewMine(few.medium).join('.')) + '|' + few.n;

async function fewRun() {
  const run = ++few.run, host = el('pgFew'), rgbs = pg.swatches.map(s => s.rgb);
  const ready = few.medium !== 'paints';   // markers and pencils are ready-made colours: no mixing to load
  const pool = ready ? fewMine(few.medium) : paintKeys(paintPaletteKey(), 'water');
  if (!ready && !paintInit()) { host.innerHTML = '<span class="count">Mixing needs js/vendor/spectral.js, which did not load.</span>'; return; }
  if (pool.length < 2) {
    host.innerHTML = ready ? `<span class="count">Mark at least two of your ${FEW_THINGS[few.medium]} above.</span>`
      : '<span class="count">Two paints at least are needed in the box above.</span>';
    return;
  }
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
  if (few.medium === 'pencils') { fewRenderPencils(host, res); return; }
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
    `<h4>${res.keys.length === 1 ? 'One marker' : res.keys.length + ' markers'} for this palette${fewOwnNote('copic')}</h4>` +
    '<div class="pg-few-paints">' + res.keys.map(k => `<span class="pg-few-paint">${chip(FEW_COPIC[k])}</span>`).join('') + '</div>' +
    `<p class="count">${close} of ${rows.length} colours land close (under ${FEW_CLOSE}); the furthest, ${esc(palgenName(far.rgb))} (${colHexOf(far.rgb)}), is ${far.r.dE.toFixed(1)} away.${fewer} ` +
    'A marker is not mixed with another, so each colour takes its nearest one; laid over a lighter one it goes darker. The markers\' colours are my estimate, from a short list - not the whole range.</p>' +
    '<div class="pg-few-rows">' + rows.map(x => `<div class="pg-few-row"><i style="background:${colHexOf(x.rgb)}" title="${colHexOf(x.rgb)} - the colour asked for"></i><span class="pg-few-paint">${chip(FEW_COPIC[x.r.key])}</span> <span class="count">${x.r.dE.toFixed(1)}</span></div>`).join('') + '</div>';
}

/* Pencils: what to lay down for each colour, in order. */
function fewRenderPencils(host, res) {
  const rows = pg.swatches.map(s => ({ rgb: s.rgb, r: fewLayers(s.rgb, res.keys) }));
  const close = rows.filter(x => x.r.dE < FEW_CLOSE).length;
  const far = rows.reduce((a, x) => x.r.dE > a.r.dE ? x : a, rows[0]);
  const chip = m => `<i style="background:${m.hex}"></i>${esc(m.code)} ${esc(m.name)}`;
  const fewer = res.keys.length < res.asked
    ? ` ${res.keys.length === 1 ? 'One pencil is' : res.keys.length + ' pencils are'} enough: another would not bring any colour noticeably closer.` : '';
  const step = (k, p) => `<span class="pg-few-paint">${chip(FEW_PENCIL[k])}</span> ${p}`;
  const recipe = r => r.over
    ? `${step(r.key, r.press)} <span class="count">then over it</span> ${step(r.over, r.pressOver)}`
    : step(r.key, r.press);
  host.innerHTML =
    `<h4>${res.keys.length === 1 ? 'One pencil' : res.keys.length + ' pencils'} for this palette${fewOwnNote('pencils')}</h4>` +
    '<div class="pg-few-paints">' + res.keys.map(k => `<span class="pg-few-paint">${chip(FEW_PENCIL[k])}</span>`).join('') + '</div>' +
    `<p class="count">${close} of ${rows.length} colours land close (under ${FEW_CLOSE}); the furthest, ${esc(palgenName(far.rgb))} (${colHexOf(far.rgb)}), is ${far.r.dE.toFixed(1)} away.${fewer} ` +
    "Light is a gentle stroke with the paper showing through; firm is pressed. Where two are named, lay the first and the second over it, then go over it with a damp brush to melt the layers - wet, the colour goes deeper than shown. The pencils' colours are my estimate, read off swatches of the Faber-Castell range.</p>" +
    '<div class="pg-few-rows">' + rows.map(x => `<div class="pg-few-row"><i style="background:${colHexOf(x.rgb)}" title="${colHexOf(x.rgb)} - the colour asked for"></i>` +
      `<i style="background:${colHexOf(x.r.rgb)}" title="${colHexOf(x.r.rgb)} - what the layers lay down"></i><span class="pg-few-how">${recipe(x.r)} <span class="count">${x.r.dE.toFixed(1)}</span></span></div>`).join('') + '</div>';
}

// Said beside a result when the search was kept to what you marked.
const fewOwnNote = kind => few.own[kind] ? ` <span class="count">(from the ${fewMine(kind).length} you marked)</span>` : '';

/* Which markers or pencils you have: a chip for each on the list, pressed while it is yours.
   Nothing marked yet is the whole list - every chip pressed. */
/* The chips of the markers or pencils you can mark as yours, a group to a family of the range, narrowed by the
   find box. A marker you have is pressed. */
function fewMineRender() {
  const kind = few.medium, host = el('pgFewMine');
  host.classList.toggle('hidden', !FEW_THINGS[kind]);
  if (!FEW_THINGS[kind]) { myRender(); return; }
  const mine = new Set(fewMine(kind)), list = FEW_LISTS()[kind];
  el('pgFewMineSum').textContent = few.own[kind]
    ? `Which ${FEW_THINGS[kind]} do you have? ${mine.size} of ${list.length} marked`
    : `Which ${FEW_THINGS[kind]} do you have? All ${list.length} on the list`;
  const q = el('pgFewMineFind').value.trim().toLowerCase();
  const shown = q ? list.filter(m => (m.code + ' ' + m.name).toLowerCase().includes(q)) : list;
  const groups = new Map();
  for (const m of shown) { const f = m.family; if (!groups.has(f)) groups.set(f, []); groups.get(f).push(m); }
  const chip = m => `<button class="chip" type="button" data-few-own="${esc(m.code)}" aria-pressed="${mine.has(m.code)}" title="${esc(m.name)}"><i style="background:${m.hex}"></i>${esc(m.code)}</button>`;
  el('pgFewMineList').innerHTML = shown.length ? [...groups].map(([f, ms]) => {
    const have = ms.filter(m => mine.has(m.code)).length;
    return `<div class="pg-own-fam">` + (f ? `<button type="button" class="pg-own-all" data-few-fam="${esc(f)}" title="Mark every ${esc(f)} ${FEW_THINGS[kind].replace(/s$/, '')} as yours, or clear them if you have them all">${esc(f)} <small>${have}/${ms.length}</small></button>` : '') +
      ms.map(chip).join('') + `</div>`;
  }).join('') : `<span class="count">Nothing is called that.</span>`;
  myRender();
}

function fewSetMine(kind, codes) {
  const all = FEW_LISTS()[kind].length;
  few.own[kind] = codes && codes.length < all ? codes : null;
  fewSave();
  fewMineRender();
  fewSync();
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
    fewMineRender();
    fewSync();
  });
  fewMineRender();
  el('pgFewMineList').addEventListener('click', e => {
    const b = e.target.closest('[data-few-own]');
    if (!b) return;
    const kind = few.medium, mine = fewMine(kind), code = b.dataset.fewOwn;
    fewSetMine(kind, mine.includes(code) ? mine.filter(c => c !== code) : [...mine, code]);
    el('pgFewMineList').querySelector(`[data-few-own="${code}"]`)?.focus();
  });
  el('pgFewMineFind').addEventListener('input', fewMineRender);
  el('pgFewMineList').addEventListener('click', e => {
    const b = e.target.closest('[data-few-fam]');
    if (!b) return;
    const kind = few.medium, ms = FEW_LISTS()[kind].filter(m => m.family === b.dataset.fewFam).map(m => m.code), mine = fewMine(kind);
    const all = ms.every(c => mine.includes(c));
    fewSetMine(kind, all ? mine.filter(c => !ms.includes(c)) : [...new Set([...mine, ...ms])]);
  });
  el('pgFewMineAll').addEventListener('click', () => fewSetMine(few.medium, null));
  el('pgFewMineNone').addEventListener('click', () => fewSetMine(few.medium, []));
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
  initMySet();
}
