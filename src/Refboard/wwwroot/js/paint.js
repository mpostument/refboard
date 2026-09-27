/* refboard - Paint: real pigments, how they mix, and recipes for a colour.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---- mixing real paint. A colour on screen is light added up; paint is
   light taken away - every pigment absorbs some of every wavelength, and a
   mixture absorbs what all of its pigments do. That is why blue and yellow
   paint make green although blue and yellow light make grey: yellow keeps
   the greens and reds, blue keeps the greens and blues, and green is the one
   band both let through. Three RGB numbers cannot know that; a spectrum can.

   So each pigment is a reflectance curve over 38 bands of the visible
   spectrum, rebuilt from its colour by spectral.js (js/vendor/, MIT - Ronald
   van Wijnen), and mixed with Kubelka-Munk theory: per band, K/S (absorption
   over scattering) of the mixture is the concentration-weighted average of
   the pigments' K/S, and K/S back to reflectance is 1 + KS - sqrt(KS² + 2KS).

   Concentration is parts x tinting strength x sqrt(luminance). Tinting
   strength is the pigment's own (phthalos are famously strong - a speck
   turns a pile of white blue); the luminance term is spectral.js's own
   correction, softened to its square root, that stops a dark pigment's
   enormous K/S swamping everything: without it one part ultramarine to
   three of lemon comes out blue-grey rather than green, with all of it six
   parts white to one of ultramarine comes out nearly white. The square root
   was checked against mixtures every painter knows (lemon + ultramarine
   green, burnt sienna + ultramarine neutral, ochre + black olive, white +
   cadmium red salmon).

   Watercolour is another medium, and another model. There is no white: a
   wash is a transparent film on white paper, and light goes through it,
   off the paper, and back through it. That is the Beer-Lambert law -
   absorbances add - so per band R = paper x exp(-s x sum(w_i x A_i)), where
   A_i is how much pigment i absorbs at full strength (worked out from its
   colour on the paper, -ln(masstone / paper)), w_i its share of the mix,
   and s the strength of the wash: 1 barely diluted, 0.1 a pale tint.
   Lighter means more water, never white paint; white means the paper.

   It is still a model. Real tubes differ by brand, and screens by
   calibration: what this gives is the right pigments in about the right
   proportions - a place to start mixing, then judge by eye. */

// Masstone colours (straight from the tube, thinly spread), and tinting
// strength relative to an average pigment.
const PIGMENTS = {
  white:        { name: 'Titanium white',   hex: '#f4f4f0', ts: 1 },
  lemon:        { name: 'Lemon yellow',     hex: '#f3e23a', ts: 0.9 },
  cadYellow:    { name: 'Cadmium yellow',   hex: '#f7b50a', ts: 1 },
  ochre:        { name: 'Yellow ochre',     hex: '#c28d31', ts: 0.6 },
  cadRed:       { name: 'Cadmium red',      hex: '#d2331f', ts: 1 },
  alizarin:     { name: 'Alizarin crimson', hex: '#7b1b2d', ts: 1 },
  sienna:       { name: 'Burnt sienna',     hex: '#8a3d20', ts: 0.8 },
  umber:        { name: 'Burnt umber',      hex: '#4b3224', ts: 0.9 },
  ultramarine:  { name: 'Ultramarine blue', hex: '#27318c', ts: 1 },
  phthaloBlue:  { name: 'Phthalo blue',     hex: '#10295f', ts: 3 },
  phthaloGreen: { name: 'Phthalo green',    hex: '#0b4a3d', ts: 2.5 },
  violet:       { name: 'Dioxazine violet', hex: '#36205a', ts: 1.5 },
  black:        { name: 'Ivory black',      hex: '#1e1d1c', ts: 1.2 },
};

// Palettes painters actually set out - each a choice about what is left out.
const PAINT_PALETTES = {
  full:    { label: 'Full palette', keys: Object.keys(PIGMENTS),
    hint: 'Every pigment here - the closest mixes, not necessarily the simplest.' },
  split:   { label: 'Split primary', keys: ['white', 'lemon', 'cadYellow', 'cadRed', 'alizarin', 'ultramarine', 'phthaloBlue'],
    hint: 'A warm and a cool of each primary: clean mixes of almost any hue.' },
  primary: { label: 'Primaries', keys: ['white', 'cadYellow', 'alizarin', 'phthaloBlue'],
    hint: 'One yellow, one red, one blue - everything is mixed, so everything is related.' },
  zorn:    { label: 'Zorn', keys: ['white', 'ochre', 'cadRed', 'black'],
    hint: "Anders Zorn's: ochre, red and black (and white, in oil) - flesh and warm greys, and a black that passes for blue next to them." },
  earth:   { label: 'Earth', keys: ['white', 'ochre', 'sienna', 'umber', 'ultramarine', 'black'],
    hint: 'Earth colours and ultramarine - the old masters\' portrait palette: rich darks, nothing that shouts.' },
};
const PAINT_KEY = 'refboard.paints.v1';
const PAINT_MEDIUM_KEY = 'refboard.paintMedium.v1';
const PAINT_MEDIA = { water: 'Watercolour', opaque: 'Oil / acrylic' };
// Watercolour paper: not quite white, a touch warm.
const PAINT_PAPER = '#f5f3ec';
// Wash strengths tried, from barely diluted to a pale tint.
const PAINT_WASH = [1, 0.7, 0.5, 0.35, 0.25, 0.17, 0.11, 0.07, 0.04];
function paintMedium() {
  try { const k = localStorage.getItem(PAINT_MEDIUM_KEY); if (PAINT_MEDIA[k]) return k; } catch {}
  return 'water';
}
function setPaintMedium(k) {
  if (!PAINT_MEDIA[k]) return;
  try { localStorage.setItem(PAINT_MEDIUM_KEY, k); } catch {}
}
// A palette's pigments in a medium - watercolour has no white.
const paintKeys = (paletteKey, medium) => PAINT_PALETTES[paletteKey].keys.filter(k => medium !== 'water' || k !== 'white');
function paintPaletteKey() {
  try { const k = localStorage.getItem(PAINT_KEY); if (PAINT_PALETTES[k]) return k; } catch {}
  return 'full';
}
function setPaintPaletteKey(k) {
  if (!PAINT_PALETTES[k]) return;
  try { localStorage.setItem(PAINT_KEY, k); } catch {}
}

// Each pigment's spectrum and weight, worked out once, when first needed.
let paintData = null;
function paintInit() {
  if (paintData) return paintData;
  if (typeof spectral === 'undefined') return null;
  paintData = {};
  const paper = new spectral.Color(PAINT_PAPER).R;
  for (const [k, p] of Object.entries(PIGMENTS)) {
    const c = new spectral.Color(p.hex);
    paintData[k] = { KS: c.KS, w: p.ts * Math.sqrt(c.luminance),
      A: c.R.map((r, i) => Math.max(0, -Math.log(Math.max(r, 1e-4) / paper[i]))) };
  }
  paintData.paper = paper;
  return paintData;
}

// A mixture - [[pigmentKey, parts], ...] - as a spectral.js Color.
function paintMix(parts) {
  const D = paintInit(), R = new Array(38);
  for (let i = 0; i < 38; i++) {
    let ks = 0, t = 0;
    for (const [k, n] of parts) { const c = n * D[k].w; ks += D[k].KS[i] * c; t += c; }
    ks /= t;
    R[i] = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  }
  return new spectral.Color(R);
}
// A watercolour wash of a mixture at strength s, on the paper.
function paintWash(parts, s) {
  const D = paintInit(), R = new Array(38);
  const t = parts.reduce((a, [k, n]) => a + n * PIGMENTS[k].ts, 0);
  for (let i = 0; i < 38; i++) {
    let a = 0;
    for (const [k, n] of parts) a += n * PIGMENTS[k].ts / t * D[k].A[i];
    R[i] = D.paper[i] * Math.exp(-s * a);
  }
  return new spectral.Color(R);
}
const paintRgb = c => c.sRGB.map(v => Math.round(Math.max(0, Math.min(255, v))));
const gcd = (a, b) => b ? gcd(b, a % b) : a;

/* Recipes for a colour: a handful of different ways to mix it from the
   palette, best first. Every single pigment, every pair in whole-number
   parts, then a third pigment added to the most promising pairs - each
   scored by how far its colour lands from the target (OKLab distance x 100,
   roughly "just noticeable" at 2), plus 2.5 for every pigment beyond the
   first: a simpler mix that is nearly as close is the better advice - a
   third tube that buys half a shade is not worth the mud it risks.
   Then only one recipe per set of pigments, so the variants are genuinely
   different routes to the colour - not the same two tubes in 3:1 and 4:1 -
   and only ones that land within reach of the best: for white, "white" is
   the answer, and a yellowish tint is not a second way to mix it. */
const PAINT_PARTS = [1, 2, 3, 4, 6, 8, 12, 16, 24];
function paintRecipes(rgb, paletteKey = paintPaletteKey(), count = 4, medium = paintMedium()) {
  if (!paintInit()) return [];
  const keys = paintKeys(paletteKey, medium), water = medium === 'water';
  const target = new spectral.Color(rgb).OKLab;
  const dist = lab => 100 * Math.hypot(lab[0] - target[0], lab[1] - target[1], lab[2] - target[2]);
  const all = [];
  // In watercolour each mixture is tried at every strength of wash, and
  // only its best kept.
  const add = (parts, washes = PAINT_WASH) => {
    const g = parts.reduce((a, [, n]) => gcd(a, n), 0);
    const p = parts.map(([k, n]) => [k, n / g]).sort((a, b) => b[1] - a[1]);
    let best = null;
    for (const w of water ? washes : [null]) {
      const c = water ? paintWash(p, w) : paintMix(p), dE = dist(c.OKLab);
      if (!best || dE < best.dE) best = { parts: p, wash: w, dE, score: dE + 2.5 * (p.length - 1), set: p.map(q => q[0]).sort().join('+'), rgb: paintRgb(c) };
    }
    all.push(best);
  };
  // The paper itself - the watercolourist's white.
  if (water) {
    const c = new spectral.Color(paintInit().paper), dE = dist(c.OKLab);
    all.push({ parts: [], wash: 0, dE, score: dE, set: 'paper', rgb: paintRgb(c) });
  }
  for (const k of keys) add([[k, 1]]);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    for (const a of PAINT_PARTS) for (const b of PAINT_PARTS) if (gcd(a, b) === 1) add([[keys[i], a], [keys[j], b]]);
  // Best pair per set, the top few of those, each with every third pigment.
  const bestOf = list => {
    const m = new Map();
    for (const r of list) if (!m.has(r.set) || m.get(r.set).score > r.score) m.set(r.set, r);
    return [...m.values()].sort((a, b) => a.score - b.score);
  };
  const T = water ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 6, 8, 12];
  for (const pr of bestOf(all.filter(r => r.parts.length === 2)).slice(0, 8)) {
    const [a, b] = pr.parts.map(q => q[0]);
    // Washes near the pair's own: a third pigment shifts the hue more than
    // how much water the colour wants.
    const wi = PAINT_WASH.indexOf(pr.wash), washes = water ? PAINT_WASH.slice(Math.max(0, wi - 2), wi + 3) : undefined;
    for (const c of keys) {
      if (c === a || c === b) continue;
      for (const x of T) for (const y of T) for (const z of T) add([[a, x], [b, y], [c, z]], washes);
    }
  }
  const ranked = bestOf(all), out = [];
  const within = Math.max(ranked[0].dE + 6, 8);
  for (const r of ranked) {
    if (out.length && r.dE > within) continue;
    // A recipe that only adds a pigment to one already chosen has to earn it.
    if (out.some(o => r.set.split('+').filter(k => !o.set.split('+').includes(k)).length <= 1 &&
      o.set.split('+').every(k => r.set.split('+').includes(k)) && r.dE > o.dE - 2)) continue;
    out.push(r);
    if (out.length >= count) break;
  }
  // Chosen with simplicity in the scales; shown closest first.
  return out.sort((a, b) => a.dE - b.dE);
}

function paintMatchWord(dE) {
  return dE < 2 ? 'spot on' : dE < 4 ? 'close' : dE < 8 ? 'near' : 'as near as this palette gets';
}
// How much water, in the words a watercolourist uses.
function paintWashWord(s) {
  return s >= 0.85 ? 'rich - barely any water' : s >= 0.5 ? 'strong wash' : s >= 0.3 ? 'medium wash'
    : s >= 0.15 ? 'light wash' : 'pale tint - mostly water';
}
function paintRecipeText(r) {
  if (!r.parts.length) return 'Leave the paper white (or mask it)';
  const mix = r.parts.length === 1
    ? PIGMENTS[r.parts[0][0]].name + (r.wash === null ? ', straight' : '')
    : r.parts.map(([k, n]) => `${n} ${PIGMENTS[k].name.toLowerCase()}`).join(' + ');
  return r.wash === null ? mix : `${mix} · ${paintWashWord(r.wash)} (~${Math.round(r.wash * 100)}%)`;
}
// One recipe as a row: the mixture's colour beside the recipe and its match.
function paintRecipeHtml(r) {
  return `<span class="mix-row"><i style="background:${rgbCss(r.rgb)}" title="What this mix gives"></i>` +
    `<span>${esc(paintRecipeText(r))}</span> <em>${paintMatchWord(r.dE)}</em></span>`;
}

/* Every colour the palette can reach, as a shape on the colour wheel: the
   hull of every pigment and every pair mixed in steps, in OKLab a/b. White
   and black only pull colours toward the middle, so the outline is what
   the coloured pigments can do between them. */
function paintReach(paletteKey = paintPaletteKey(), medium = paintMedium()) {
  if (!paintInit()) return null;
  const keys = paintKeys(paletteKey, medium), pts = [], water = medium === 'water';
  // A dark pigment is at its most colourful let down - with water in
  // watercolour, with white in oil - so each mix is tried at a few strengths.
  const push = parts => {
    for (const w of water ? [1, 0.6, 0.35, 0.2] : [null]) {
      const l = (water ? paintWash(parts, w) : paintMix(parts)).OKLab;
      pts.push([l[1], l[2]]);
    }
  };
  for (const k of keys) push([[k, 1]]);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    for (let s = 1; s < 10; s++) push([[keys[i], s], [keys[j], 10 - s]]);
  if (!water) for (const k of keys) if (k !== 'white') for (const w of [1, 3, 8]) push([[k, 1], ['white', w]]);
  return convexHull(pts);
}

// Andrew's monotone chain.
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
