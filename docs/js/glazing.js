/* refboard - Glazing: a transparent wash of one paint over a dry wash of
   another, against mixing the two on the palette. The Colour studio's
   Glazing tab.

   In paint.js's watercolour model absorbances add - a wash of A, dried, and
   a wash of B over it absorb exactly what one wash of A and B mixed would,
   in the same amounts. So for transparent paints the glaze IS a mix, and
   the tab says which one. What glazing buys is not a new colour but three
   other things, and those are what it shows:
   - Depth. One wash is at most paint straight from the tube (strength 1);
     two layers of 0.8 are 1.6. Glazing reaches darks no single wash can.
   - Order, where a paint is opaque. Cadmiums, ochre and black scatter light
     inside their own layer: on top, part of the light comes back off the
     particles before it reaches what is under - a veil, chalky over a dark.
     Underneath they are only a colour the next wash filters. So the veil:
     R = h x top-alone + (1 - h) x under x transmittance(top), with h the
     paint's opacity times the glaze's strength. A transparent paint (h near
     0) filters; an opaque one partly covers.
   - Clean edges, and no mud: the first layer's shapes stay under the glaze,
     and nothing is stirred. That the model cannot show, so the note says it.

   Oil glazes too, over a dry underpainting: there the under layer is the
   paint with two parts white, as an underpainting is lighter than the
   picture, and the glaze filters it the same way.

   Opacity is each paint's `op` in PIGMENTS (paint.js), which the Pigment
   guide shows too: 0 transparent, 1 hides the layer under it at full
   strength.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const GZ_OPACITY = Object.fromEntries(Object.entries(PIGMENTS).map(([k, p]) => [k, p.op]));
// The glaze's strength - each layer's - as a watercolourist would say it.
const GZ_STRENGTHS = { light: { label: 'Light', s: 0.25 }, medium: { label: 'Medium', s: 0.5 }, strong: { label: 'Strong', s: 0.8 } };
const GZ_KEY = 'refboard.glazing.v1';

const gzOpacityWord = pigmentOpacityWord;

// A pigment's absorbance at strength s, per band.
const gzAbs = (k, s) => paintInit()[k].A.map(a => a * s);
// The under layer, dry: a wash on the paper, or in oil an underpainting.
function gzUnder(k, s, water) {
  if (water) return paintWash([[k, 1]], s).R;
  return paintMix([[k, 1], ['white', 2]]).R;
}
// `top` glazed at strength s over the reflectance `R` of what is under it.
function gzOver(R, top, s) {
  const D = paintInit(), A = gzAbs(top, s), h = GZ_OPACITY[top] * s;
  return R.map((r, i) => {
    const alone = D.paper[i] * Math.exp(-A[i]);
    return h * alone + (1 - h) * r * Math.exp(-A[i]);
  });
}
// Layers, first to last - [[pigment, strength], ...] - as a spectral.js Color.
function gzLayers(layers, water) {
  const [[k0, s0], ...rest] = layers;
  let R = gzUnder(k0, s0, water);
  for (const [k, s] of rest) R = gzOver(R, k, s);
  return new spectral.Color(R);
}

// A ratio as small whole parts, a:b with both up to 8.
function gzParts(r) {
  let best = [1, 1];
  for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
    if (gcd(a, b) !== 1) continue;
    if (Math.abs(Math.log(a / b / r)) < Math.abs(Math.log(best[0] / best[1] / r)) - 0.02) best = [a, b];
  }
  return best;
}
const gzDist = (c1, c2) => { const a = c1.OKLab, b = c2.OKLab; return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

/* One pair, worked out: the under layer, the over paint alone, the glaze,
   the glaze the other way round, and the palette mix that would come
   nearest. In watercolour the mix is the same pigment in one wash: parts in
   the ratio of each layer's strength over its tinting strength (paintWash
   shares by parts x strength), at the two strengths added up - capped at 1,
   the tube. In oil it is the two paints and the underpainting's white. */
function glazePair(under, over, s, medium = paintMedium()) {
  if (!paintInit()) return null;
  const water = medium === 'water';
  const glazed = gzLayers([[under, s], [over, s]], water);
  const reversed = gzLayers([[over, s], [under, s]], water);
  const parts = gzParts((s / PIGMENTS[under].ts) / (s / PIGMENTS[over].ts));
  const mixParts = [[under, parts[0]], [over, parts[1]]];
  const wash = water ? Math.min(1, 2 * s) : null;
  const mixed = water ? paintWash(mixParts, wash) : paintMix([...mixParts, ['white', 2 * (parts[0] + parts[1])]]);
  return {
    under, over, s, water, mixParts, wash, tooDark: water && 2 * s > 1,
    rgb: { under: paintRgb(new spectral.Color(gzUnder(under, s, water))), over: paintRgb(gzLayers([[over, s]], water)),
      glazed: paintRgb(glazed), reversed: paintRgb(reversed), mixed: paintRgb(mixed) },
    order: gzDist(glazed, reversed), vsMix: gzDist(glazed, mixed),
  };
}

// The chart's paints: the palette's, less white - a white glaze is a scumble.
const gzKeys = (paletteKey, medium) => paintKeys(paletteKey, medium).filter(k => k !== 'white');

/* ---- the Glazing tab: a glazing chart, as painters paint one - each paint
   a stripe down (the first wash), each glazed across (the second) - and
   one crossing of it explained. The chart depends on the paints, the medium
   and the strength only, so it is kept per choice. */
let gz = null;
const gzCache = {};
function gzLoad() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(GZ_KEY)) || {}; } catch {}
  gz = { s: GZ_STRENGTHS[p.s] ? p.s : 'medium', under: p.under || 'sienna', over: p.over || 'ultramarine' };
}
function gzSave() {
  try { localStorage.setItem(GZ_KEY, JSON.stringify(gz)); } catch {}
}
// From the Pigment guide: this paint as the glaze, over another of the chart's.
function gzPick(k) {
  if (!gz) gzLoad();
  const keys = gzKeys(col.paints, col.medium);
  if (!keys.includes(k)) return;
  gz.over = k;
  if (!keys.includes(gz.under) || gz.under === k) gz.under = keys.find(u => u !== k) || k;
  gzSave();
}
function gzChart() {
  const s = GZ_STRENGTHS[gz.s].s, k = col.paints + '|' + col.medium + '|' + gz.s;
  if (!(k in gzCache)) {
    const keys = gzKeys(col.paints, col.medium), water = col.medium === 'water';
    gzCache[k] = { keys, water, s,
      alone: keys.map(u => paintRgb(new spectral.Color(gzUnder(u, s, water)))),
      over: keys.map(o => paintRgb(gzLayers([[o, s]], water))),
      cells: keys.map(o => keys.map(u => paintRgb(gzLayers([[u, s], [o, s]], water)))) };
  }
  return gzCache[k];
}

const gzName = k => PIGMENTS[k].name.toLowerCase();
function gzDiffWord(d) {
  return d < 2 ? 'the same colour' : d < 5 ? 'a little different' : d < 10 ? 'clearly different' : 'a different colour';
}
function gzMixText(p) {
  const mix = p.mixParts.map(([k, n]) => `${n} ${gzName(k)}`).join(' + ');
  return p.water ? `${mix}, ${paintWashWord(p.wash)}` : `${mix} + white`;
}

function glazingRender() {
  if (!paintInit()) { el('gzChart').textContent = 'The paint model has not loaded.'; return; }
  if (!gz) gzLoad();
  for (const b of el('gzStrength').children) b.setAttribute('aria-pressed', String(b.dataset.gzS === gz.s));
  const c = gzChart();
  // Pigments this palette lacks give way to its first two.
  if (!c.keys.includes(gz.under)) gz.under = c.keys[0];
  if (!c.keys.includes(gz.over)) gz.over = c.keys[Math.min(1, c.keys.length - 1)];

  const chart = el('gzChart');
  chart.style.setProperty('--gz-n', c.keys.length);
  const head = '<span title="Along the top: the first wash. Down the side: the glaze over it."></span>' +
    c.keys.map((u, i) => `<i class="gz-head" style="background:${rgbCss(c.alone[i])}" title="${PIGMENTS[u].name} - ${gzOpacityWord(u)}"></i>`).join('');
  const rows = c.keys.map((o, r) => `<i class="gz-head" style="background:${rgbCss(c.over[r])}" title="${PIGMENTS[o].name} - ${gzOpacityWord(o)}"></i>` +
    c.keys.map((u, i) => `<button type="button" class="gz-cell${u === gz.under && o === gz.over ? ' on' : ''}" data-u="${u}" data-o="${o}" ` +
      `style="background:${rgbCss(c.cells[r][i])}" aria-label="${PIGMENTS[o].name} over ${gzName(u)}"></button>`).join('')).join('');
  chart.innerHTML = head + rows;
  gzRenderPair();
}

function gzRenderPair() {
  const p = glazePair(gz.under, gz.over, GZ_STRENGTHS[gz.s].s, col.medium);
  const sw = (rgb, label, title) => `<figure><i style="background:${rgbCss(rgb)}" title="${esc(title)} - ${colHex(rgb)}"></i><figcaption>${label}</figcaption></figure>`;
  const U = PIGMENTS[p.under].name, O = PIGMENTS[p.over].name;
  el('gzPair').innerHTML =
    `<div class="gz-title"><b>${esc(O)}</b> over <b>${esc(gzName(p.under))}</b></div>` +
    '<div class="gz-swatches">' +
    sw(p.rgb.under, p.water ? 'First wash' : 'Underpainting', U + (p.water ? ', dry' : ' with white, dry')) +
    sw(p.rgb.over, 'Glaze alone', O + ' on bare paper') +
    sw(p.rgb.glazed, 'Glazed', `${O} over ${gzName(p.under)}`) +
    sw(p.rgb.reversed, 'Other way', `${U} over ${gzName(p.over)}`) +
    sw(p.rgb.mixed, 'Mixed', gzMixText(p)) + '</div>';

  const lines = [];
  // Order: which of the two covers, if either does.
  if (p.under === p.over) lines.push(`The same paint twice: a second layer deepens it without lifting the first - darker than one wash of it${p.tooDark ? ' can go' : ''}.`);
  // Only a paint that really covers is named as veiling: in the deepest
  // darks even a transparent one's faint scatter shows, and says nothing.
  else if (p.order >= 3 && Math.max(GZ_OPACITY[p.under], GZ_OPACITY[p.over]) >= 0.3) {
    const cover = GZ_OPACITY[p.over] >= GZ_OPACITY[p.under] ? p.over : p.under, other = cover === p.over ? p.under : p.over;
    lines.push(`Order matters - ${gzDiffWord(p.order)} the other way round. ${PIGMENTS[cover].name} is ${gzOpacityWord(cover)}: on top it veils what is under it, a chalky film; put it down first and glaze ${gzName(other)} over it for the cleaner colour.`);
  } else lines.push(`Order hardly matters: ${gzName(p.under)} is ${gzOpacityWord(p.under)} and ${gzName(p.over)} ${gzOpacityWord(p.over)} - each only filters the light, so either can go first.`);
  // Against the palette.
  if (p.under !== p.over && !p.water) lines.push(`Mixed wet with the underpainting's white instead (${gzMixText(p)}), the same paints go ${p.vsMix >= 5 ? 'pale and chalky' : 'a little chalky'}: a glaze keeps the underpainting's light under a film of pure colour.`);
  else if (p.under !== p.over) {
    if (p.tooDark) lines.push(`Mixed on the palette (${gzMixText(p)}) it cannot get this dark - one wash is at most the paint straight from the tube. Depth like this is what glazing is for.`);
    else if (p.vsMix < 2) lines.push(`Mixed on the palette - ${gzMixText(p)} - gives the same colour. What the glaze buys is the edges: the first wash's shapes stay under it, and nothing is stirred into mud.`);
    else lines.push(`Mixed on the palette (${gzMixText(p)}) is ${gzDiffWord(p.vsMix)}: an opaque paint scatters inside its own layer, so glazed it veils, mixed it only tints.`);
  }
  // Whether the first wash survives the brush: a staining paint is in the
  // paper and stays put; one that lifts can be stirred up by the glaze.
  if (p.water && p.under !== p.over) lines.push(PIGMENTS[p.under].stain >= 2
    ? `${U} stains, so the glaze cannot disturb it - the safest kind of first wash.`
    : PIGMENTS[p.under].stain === 0 ? `${U} lifts easily: let it dry completely and glaze in one light pass, or the brush brings it back up into the glaze.` : '');
  if (!p.water) lines.push('In oil: glaze only over a dry underpainting, the glaze thinned with medium, never with white.');
  el('gzNote').textContent = lines.filter(Boolean).join(' ');
}

function initGlazing() {
  gzLoad();
  el('gzStrength').innerHTML = Object.entries(GZ_STRENGTHS)
    .map(([k, v]) => `<button class="chip" type="button" data-gz-s="${k}" title="Each layer at ~${Math.round(v.s * 100)}% strength">${v.label}</button>`).join('');
  el('gzStrength').addEventListener('click', e => {
    const b = e.target.closest('[data-gz-s]');
    if (!b) return;
    gz.s = b.dataset.gzS; gzSave(); glazingRender();
  });
  const chart = el('gzChart');
  chart.addEventListener('click', e => {
    const b = e.target.closest('.gz-cell');
    if (!b) return;
    gz.under = b.dataset.u; gz.over = b.dataset.o; gzSave();
    for (const x of chart.querySelectorAll('.gz-cell.on')) x.classList.remove('on');
    b.classList.add('on');
    gzRenderPair();
  });
  const say = e => {
    const b = e.target.closest('.gz-cell');
    if (b) el('gzReadout').textContent = `${PIGMENTS[b.dataset.o].name} (${gzOpacityWord(b.dataset.o)}) over ${gzName(b.dataset.u)} (${gzOpacityWord(b.dataset.u)}) - click to compare it with the mix.`;
  };
  chart.addEventListener('pointerover', say);
  chart.addEventListener('focusin', say);
}
