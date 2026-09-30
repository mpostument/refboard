/* refboard - Grey ladder: warm, neutral and cool greys from your own paints,
   light to dark, and how to mix them. The Colour studio's Greys tab.

   Greys are the colours a painting mixes most, and the muddy ones come from
   mixing each at random - a bit of whatever is on the palette, a different
   bit for the next. The ladder is the opposite habit: one mixture per
   temperature, found once - two complementary tubes that cancel to grey
   (ultramarine and burnt sienna is the classic), leaned warm or cool by
   their ratio - and every value taken from that one puddle: more water in
   watercolour, more white in oil. Greys from one mix stay related, however
   light or dark.

   Finding the mixture: every pigment alone, every pair in whole-number
   parts, and - when no pair gets close, as with three primaries - every
   triple. Each is scored on the ladder it would make: at every step, how
   far its colour lands from the grey wanted there (OKLab a/b x 100 -
   lightness is the ladder's business, not the mixture's), averaged, plus a
   point for each pigment beyond the first, more for black (a black-mixed
   grey is legitimate - it is Zorn's - but in watercolour it deadens), and
   two for each dark step it cannot reach. A warm or cool mix of the same
   tubes as the neutral one earns a point back: one pair of tubes, three
   ratios, is the easiest thing to carry to the easel.

   The grey wanted: no chroma for the neutral; for warm and cool, a small
   one (GL_CHROMA) at an orange or a blue hue, less in the pale steps - a
   pale tint with that much colour is no longer a grey.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

// The ladder's steps, as OKLab lightness - a pale tint to a deep dark.
const GL_STEPS = [0.9, 0.81, 0.72, 0.63, 0.54, 0.45, 0.36];
const GL_CHROMA = 0.026;
const GL_TEMPS = [
  { id: 'warm', label: 'Warm', hue: 65 },
  { id: 'neutral', label: 'Neutral', hue: null },
  { id: 'cool', label: 'Cool', hue: 250 },
];
// Parts tried for a pair; a triple, only when no pair will do, in fewer.
const GL_PAIR_PARTS = [1, 2, 3, 4, 5, 6, 8];
const GL_TRIPLE_PARTS = [1, 2, 3];
// In oil, how much white per part of the mix - numbers a palette knife can measure.
const GL_WHITE = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48, 64];

// The grey wanted at lightness L, as OKLab [a, b].
function glTarget(temp, L) {
  if (temp.hue === null) return [0, 0];
  const c = GL_CHROMA * Math.min(1, (1 - L) / 0.4), h = temp.hue * Math.PI / 180;
  return [c * Math.cos(h), c * Math.sin(h)];
}

/* One mixture at a level x in (0, 1] - the more x, the darker. In
   watercolour x is the wash's strength (paint.js's s); in oil it is the
   mixture's share against white, so 1 is the mixture straight. */
function glColour(parts, x, water) {
  if (water) return paintWash(parts, x);
  if (x >= 1) return paintMix(parts);
  const t = parts.reduce((a, [, n]) => a + n, 0);
  return paintMix([...parts.map(([k, n]) => [k, n / t * x]), ['white', 1 - x]]);
}
// The level at which a mixture comes to lightness L, or null when even
// straight it is lighter than that. Bisected in log space: the pale steps
// live at a few percent.
function glLevel(parts, L, water, iters = 14) {
  if (glColour(parts, 1, water).OKLab[0] > L + 0.015) return null;
  let lo = Math.log(0.002), hi = 0;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (glColour(parts, Math.exp(mid), water).OKLab[0] > L) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}
// White parts per part of mix, rounded to what can be measured, as a level.
function glWhiteLevel(x) {
  const w = (1 - x) / x;
  let best = GL_WHITE[0];
  for (const v of GL_WHITE) if (Math.abs(Math.log1p(v) - Math.log1p(w)) < Math.abs(Math.log1p(best) - Math.log1p(w))) best = v;
  return { white: best, x: 1 / (1 + best) };
}

// How far a mixture's colour lands from the grey wanted, at one lightness.
function glDev(parts, temp, L, water, iters) {
  const x = glLevel(parts, L, water, iters);
  if (x === null) return null;
  const lab = glColour(parts, x, water).OKLab, [ta, tb] = glTarget(temp, lab[0]);
  return 100 * Math.hypot(lab[1] - ta, lab[2] - tb);
}
function glPenalty(parts, water) {
  return parts.length - 1 + (parts.some(([k]) => k === 'black') ? (water ? 2.5 : 1) : 0);
}
const glSet = parts => parts.map(([k]) => k).sort().join('+');

// A mixture's ladder, step by step - its colour, and what to do for it.
function glLadder(parts, water) {
  return GL_STEPS.map(L => {
    let x = glLevel(parts, L, water);
    if (x === null) return { L, reached: false };
    let white = null;
    if (!water) ({ white, x } = glWhiteLevel(x));
    const c = glColour(parts, x, water);
    return { L, reached: true, x, white, lab: c.OKLab, rgb: paintRgb(c) };
  });
}

/* The three mixtures for a palette of tubes in a medium. Candidates are
   scored cheaply first - at three steps, bisected coarsely - and only the
   best few get the whole ladder. */
function greyLadder(paletteKey = paintPaletteKey(), medium = paintMedium()) {
  if (!paintInit()) return null;
  const water = medium === 'water', keys = paintKeys(paletteKey, medium).filter(k => k !== 'white');
  const cands = [];
  const addParts = list => {
    const g = list.reduce((a, [, n]) => gcd(a, n), 0);
    const p = list.map(([k, n]) => [k, n / g]).sort((a, b) => b[1] - a[1]);
    const id = p.map(([k, n]) => k + n).join(' ');
    if (!cands.some(c => c.id === id)) cands.push({ id, parts: p });
  };
  for (const k of keys) addParts([[k, 1]]);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    for (const a of GL_PAIR_PARTS) for (const b of GL_PAIR_PARTS) if (gcd(a, b) === 1) addParts([[keys[i], a], [keys[j], b]]);

  const probe = [GL_STEPS[1], GL_STEPS[3], GL_STEPS[5]];
  const quick = (c, temp) => {
    let sum = 0, n = 0, miss = 0;
    for (const L of probe) { const d = glDev(c.parts, temp, L, water, 7); if (d === null) miss++; else { sum += d; n++; } }
    return n ? sum / n + 2 * miss + glPenalty(c.parts, water) : Infinity;
  };
  const full = (parts, temp) => {
    const steps = glLadder(parts, water), hit = steps.filter(s => s.reached);
    if (!hit.length) return null;
    const dev = hit.reduce((a, s) => { const [ta, tb] = glTarget(temp, s.lab[0]); return a + 100 * Math.hypot(s.lab[1] - ta, s.lab[2] - tb); }, 0) / hit.length;
    return { parts, steps, dev, score: dev + 2 * (steps.length - hit.length) + glPenalty(parts, water) };
  };
  const pick = (temp, list, n = 6) => list.map(c => ({ c, q: quick(c, temp) })).sort((a, b) => a.q - b.q)
    .slice(0, n).map(({ c }) => full(c.parts, temp)).filter(Boolean);
  const triples = () => {
    const tri = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) for (let k = j + 1; k < keys.length; k++)
      for (const a of GL_TRIPLE_PARTS) for (const b of GL_TRIPLE_PARTS) for (const c of GL_TRIPLE_PARTS)
        if (gcd(gcd(a, b), c) === 1) tri.push({ parts: [[keys[i], a], [keys[j], b], [keys[k], c]] });
    return tri;
  };

  const out = {};
  const neutralTemp = GL_TEMPS[1];
  let found = pick(neutralTemp, cands);
  // No pair gets near - three primaries, say: then every triple.
  if (!found.length || Math.min(...found.map(f => f.score)) > 4) found = found.concat(pick(neutralTemp, triples()));
  found.sort((a, b) => a.score - b.score);
  if (!found[0]) return null;
  out.neutral = { ...found[0], temp: neutralTemp };

  /* Warm and cool have to be warmer, or cooler, than the neutral grey - by
     at least a third of the chroma they aim at. Without that, a palette
     whose only grey is black (Zorn's) gets black three times over, each
     "close enough". With it, a column no mix can make says so. */
  const nset = glSet(out.neutral.parts);
  const lean = (steps, temp) => {
    const h = temp.hue * Math.PI / 180, hit = steps.filter(s => s.reached);
    return hit.reduce((a, s) => a + 100 * (s.lab[1] * Math.cos(h) + s.lab[2] * Math.sin(h)), 0) / hit.length;
  };
  for (const temp of [GL_TEMPS[0], GL_TEMPS[2]]) {
    const base = lean(out.neutral.steps, temp), enough = f => lean(f.steps, temp) >= base + 100 * GL_CHROMA / 3;
    let f = pick(temp, cands, 12).filter(enough);
    // The neutral's own tubes in every other ratio are always in the running.
    f = f.concat(cands.filter(c => glSet(c.parts) === nset)
      .map(c => full(c.parts, temp)).filter(x => x && enough(x)));
    if (!f.length || Math.min(...f.map(x => x.score)) > 4) f = f.concat(pick(temp, triples()).filter(enough));
    // The same tubes as the neutral one, only in another ratio: a point back.
    for (const x of f) if (glSet(x.parts) === nset) x.score -= 1;
    f.sort((a, b) => a.score - b.score);
    if (f[0]) out[temp.id] = { ...f[0], temp };
  }
  return { medium, water, cols: GL_TEMPS.map(t => out[t.id] || { temp: t, none: true }) };
}

// The mixture in words - the parts, without the water or white.
function glMixText(parts) {
  return parts.length === 1 ? PIGMENTS[parts[0][0]].name
    : parts.map(([k, n]) => `${n} ${PIGMENTS[k].name.toLowerCase()}`).join(' + ');
}
// What one step asks: how much water, or how much white.
function glStepText(s, water) {
  if (water) return `~${Math.max(1, Math.round(s.x * 100))}%`;
  return s.white ? `+ ${s.white} white` : 'straight';
}
function glStepLong(s, water) {
  if (water) return `${paintWashWord(s.x)} (~${Math.max(1, Math.round(s.x * 100))}% strength)`;
  return s.white ? `1 part of the mix to ${s.white} white` : 'the mix straight, no white';
}
// How near a column comes to the grey it is for.
function glDevWord(dev) {
  return dev < 1.5 ? 'a clean grey' : dev < 3 ? 'nearly' : dev < 5 ? 'leans off' : 'as near as these paints get';
}

/* ---- the Greys tab. The ladder depends only on the tubes and the medium,
   so it is worked out once per choice and kept (the full palette takes a
   third of a second); colourRender() calls this on every drag of the mask. */
const glCache = {};
function glCurrent() {
  const k = col.paints + '|' + col.medium;
  if (!(k in glCache)) glCache[k] = greyLadder(col.paints, col.medium);
  return glCache[k];
}
// A grey's L* from its OKLab lightness: for a true grey L* = 116 L - 16.
const glLstar = L => Math.round(116 * L - 16);

// The picture's own greys - its palette colours with little chroma - each
// against the ladder cell nearest it.
function glPictureGreys(g) {
  if (!col.palette) return null;
  const out = [];
  col.palette.forEach((p, i) => {
    if (rgbOklch(p.rgb)[1] >= 0.05) return;
    const lab = new spectral.Color(p.rgb).OKLab;
    let best = null;
    for (const c of g.cols) if (!c.none) c.steps.forEach((s, j) => {
      if (!s.reached) return;
      const d = Math.hypot(lab[0] - s.lab[0], 2 * (lab[1] - s.lab[1]), 2 * (lab[2] - s.lab[2]));
      if (!best || d < best.d) best = { d, t: c.temp.id, j, n: i + 1 };
    });
    if (best) out.push(best);
  });
  return out;
}

function greysRender() {
  const g = glCurrent();
  if (!g) { el('glGrid').textContent = 'The paint model has not loaded.'; return; }
  const marks = glPictureGreys(g);
  const head = '<span></span>' + g.cols.map(c => `<b>${c.temp.label}</b>`).join('');
  const rows = GL_STEPS.map((L, j) => `<span class="gl-l" title="The value this step is for">${glLstar(L)}</span>` + g.cols.map(c => {
    const s = !c.none && c.steps[j];
    if (!s || !s.reached) return `<span class="gl-cell short" title="${c.none ? 'No mix of these paints' : 'Darker than this mix goes'}">-</span>`;
    const badge = (marks || []).filter(m => m.t === c.temp.id && m.j === j).map(m => `<b>${m.n}</b>`).join('');
    return `<button class="gl-cell${s.lab[0] > 0.62 ? ' light' : ''}" type="button" data-t="${c.temp.id}" data-j="${j}" ` +
      `style="background:${rgbCss(s.rgb)}" aria-label="${c.temp.label} grey, value ${glLstar(L)}">${glStepText(s, g.water)}${badge}</button>`;
  }).join('')).join('');
  el('glGrid').innerHTML = head + rows;

  el('glMixes').innerHTML = g.cols.map(c => c.none
    ? `<div class="gl-mix"><b>${c.temp.label}</b><span>None of these paints mixes a grey ${c.temp.id === 'cool' ? 'cooler' : 'warmer'} than the neutral one. Beside ${c.temp.id === 'cool' ? 'warm' : 'cool'} colours the neutral reads ${c.temp.id} anyway - Zorn's black passes for blue that way.</span></div>`
    : `<div class="gl-mix"><b>${c.temp.label}</b><span>${esc(glMixText(c.parts))} <em>${glDevWord(c.dev)}</em></span></div>`).join('');

  const sets = new Set(g.cols.filter(c => !c.none).map(c => glSet(c.parts)));
  let note = g.water
    ? 'Mix one puddle of each recipe, enough for the whole painting, and take every step from it with water - the percentage is how strong the wash is. Try the darkest on a scrap first: the paper has the last word.'
    : 'Mix one pile of each recipe, enough for the whole painting, and take every step from it with white, measured with the knife.';
  if (sets.size === 1 && g.cols.filter(c => !c.none).length > 1) note += ' All of them from the same tubes - only the ratio changes.';
  if (marks) note += marks.length
    ? ` This picture's greys: ${marks.map(m => `${m.n} is ${m.t}, value ${glLstar(GL_STEPS[m.j])}`).join('; ')}.`
    : " This picture's palette has no greys - every one of its colours is a colour.";
  el('glNote').textContent = note;
  el('glReadout').textContent = 'Point at a step for its whole recipe.';
}

function initGreys() {
  const grid = el('glGrid');
  const say = e => {
    const b = e.target.closest('.gl-cell[data-t]');
    if (!b) return;
    const g = glCurrent(), c = g.cols.find(x => x.temp.id === b.dataset.t), s = c.steps[+b.dataset.j];
    el('glReadout').textContent = `${c.temp.label}, value ${glLstar(s.L)}: ${glMixText(c.parts)} - ${glStepLong(s, g.water)}. ${colHex(s.rgb)}`;
  };
  grid.addEventListener('pointerover', say);
  grid.addEventListener('focusin', say);
}
