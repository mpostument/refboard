/* refboard - Preview as watercolour: the picture painted as it could be in
   watercolour, before the first stroke - flat washes, hard edges with a
   darker rim and soft ones that run together, grain, and the whites left as
   the paper.

   Not a filter that makes any photo look "painterly" - each thing is what a
   wash does, so it can be read as advice:
   - flat washes: a Kuwahara filter. Every pixel takes the mean of whichever
     of the four squares round it is the least varied, so a flat area comes
     out flat and an edge stays where it was, never blurred across; run a few
     times and a photo is a handful of big shapes (Detail sets how many).
   - soft edges: where the picture's own edge is soft (edges.js - the width
     of its change, not its size) the washes are let run into each other, as
     wet-in-wet does; where it is hard, the edge stays and pigment pools along
     it, a little darker on the darker side - the rim a dried wash leaves.
   - transparency: a wash does not cover the paper, it filters the light that
     comes back off it. A colour is the paper's colour times exp(-absorbance),
     so it is worked out as an absorbance and let down a little (a wash is
     paler than the photo's own colour, and its darks are layers, not black).
   - grain: a granulating pigment settles into the paper's tooth, so the wash
     is denser in the hollows - more in the darks, where there is more paint.
   - whites: what is near-white is not painted at all. In watercolour the
     white is the paper, and once covered it does not come back.
   - Within my paints: the colours pulled in to what the chosen palette can
     mix (paint.js's reach on the colour wheel), keeping their lightness.
   The absorbance is taken from the sRGB values as they are - a model of the
   look, not the spectral mixing the recipes use. One of the classic scripts
   index.html loads in order; see the note there. */
"use strict";

const WC_KEY = 'refboard.watercolour.v1';
// A wash is let down to this share of the photo's own absorbance: paler than
// the photo, the darks being a second layer rather than black at once.
const WC_STRENGTH = 0.85;
// Detail: the filter's reach as a share of the picture's long side, and how
// many times it is run.
const WC_DETAIL = {
  loose:  { chip: 'Loose',  label: 'a few big washes', r: 1 / 38, passes: 3 },
  medium: { chip: 'Medium', label: 'the main shapes', r: 1 / 62, passes: 2 },
  tight:  { chip: 'Tight',  label: 'most of the detail kept', r: 1 / 120, passes: 2 },
};
// Grain: how far a granulating pigment's settling shows in the wash.
const WC_GRAIN = {
  smooth: { chip: 'Smooth', label: 'a smooth, non-granulating paint', g: 0 },
  light:  { chip: 'Light', label: 'a little grain', g: 0.55 },
  strong: { chip: 'Granulating', label: 'a granulating pigment on rough paper', g: 1.2 },
};
const WC_DEFAULT = { detail: 'medium', grain: 'light', mine: false };

function wcLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(WC_KEY));
    if (v && typeof v === 'object') {
      return { detail: WC_DETAIL[v.detail] ? v.detail : WC_DEFAULT.detail, grain: WC_GRAIN[v.grain] ? v.grain : WC_DEFAULT.grain, mine: v.mine === true };
    }
  } catch { /* fall through */ }
  return { ...WC_DEFAULT };
}
function wcSave(c) {
  try { localStorage.setItem(WC_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

const wcPaper = () => [1, 3, 5].map(i => parseInt(PAINT_PAPER.slice(i, i + 2), 16));
const wcSmooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/* The Kuwahara filter on three channels (0-255 floats). Each square's mean
   and spread come from summed-area tables, so a pixel costs a few lookups
   whatever the radius. A square is the pixel and r more to one side and one
   above or below; at the picture's edge it is cut short. */
function wcKuwahara(ch, w, h, r) {
  const W = w + 1, S = W * (h + 1);
  const sum = [0, 1, 2].map(() => new Float64Array(S)), lum = new Float64Array(S), lum2 = new Float64Array(S);
  for (let y = 0; y < h; y++) {
    let a0 = 0, a1 = 0, a2 = 0, l = 0, l2 = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, v0 = ch[0][i], v1 = ch[1][i], v2 = ch[2][i], v = 0.299 * v0 + 0.587 * v1 + 0.114 * v2;
      a0 += v0; a1 += v1; a2 += v2; l += v; l2 += v * v;
      const j = (y + 1) * W + x + 1, k = y * W + x + 1;
      sum[0][j] = sum[0][k] + a0; sum[1][j] = sum[1][k] + a1; sum[2][j] = sum[2][k] + a2;
      lum[j] = lum[k] + l; lum2[j] = lum2[k] + l2;
    }
  }
  const box = (t, x0, y0, x1, y1) => t[y1 * W + x1] - t[y0 * W + x1] - t[y1 * W + x0] + t[y0 * W + x0];
  const out = ch.map(() => new Float32Array(w * h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity, bx0 = 0, by0 = 0, bx1 = 1, by1 = 1;
      for (let q = 0; q < 4; q++) {
        const x0 = q & 1 ? x : Math.max(0, x - r), x1 = q & 1 ? Math.min(w, x + r + 1) : x + 1;
        const y0 = q & 2 ? y : Math.max(0, y - r), y1 = q & 2 ? Math.min(h, y + r + 1) : y + 1;
        const n = (x1 - x0) * (y1 - y0), m = box(lum, x0, y0, x1, y1) / n;
        const v = box(lum2, x0, y0, x1, y1) / n - m * m;
        if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
      }
      const n = (bx1 - bx0) * (by1 - by0), i = y * w + x;
      for (let k = 0; k < 3; k++) out[k][i] = box(sum[k], bx0, by0, bx1, by1) / n;
    }
  }
  return out;
}

// Value noise on a lattice `cell` pixels apart, 0-1, the same for the same
// seed - so a preview is the same preview each time it is made.
function wcNoise(w, h, cell, seed) {
  const hash = (x, y) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = y / cell, iy = Math.floor(gy), fy = wcSmooth(0, 1, gy - iy);
    for (let x = 0; x < w; x++) {
      const gx = x / cell, ix = Math.floor(gx), fx = wcSmooth(0, 1, gx - ix);
      const top = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx, bottom = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx;
      out[y * w + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

// The paper's tooth, a grain a few pixels across and blotches of denser
// wash a few dozen across, as -1..1 each: grain for the paint, tooth for the
// paper alone.
function wcGrain(w, h) {
  const S = Math.max(w, h);
  const low = wcNoise(w, h, Math.max(6, S / 18), 11), mid = wcNoise(w, h, Math.max(2.5, S / 90), 23), tooth = wcNoise(w, h, Math.max(1.6, S / 300), 37);
  const grain = new Float32Array(w * h), paper = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    grain[i] = (0.2 * (low[i] - 0.5) + 0.4 * (mid[i] - 0.5) + 0.4 * (tooth[i] - 0.5)) * 3.2;
    paper[i] = (tooth[i] - 0.5) * 2;
  }
  return { grain, paper };
}

// The colours the chosen palette can mix in watercolour, as a shape on the
// colour wheel - worked out once for each palette.
let wcReachCache = { key: null, hull: null };
function wcReach() {
  const key = paintPaletteKey();
  if (wcReachCache.key !== key) wcReachCache = { key, hull: paintInit() ? paintReach(key, 'water') : null };
  return wcReachCache.hull;
}

// Pixels (0-255 floats, r g b interleaved) pulled in to the hull, lightness
// and hue kept (mapIntoGamut). Returns the share of the picture it moved.
function wcGamut(px, n, hull) {
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const lin = [srgbToLin(px[3 * i] / 255), srgbToLin(px[3 * i + 1] / 255), srgbToLin(px[3 * i + 2] / 255)];
    const [L, a, b] = linToOklab(...lin);
    if (Math.hypot(a, b) < 0.012 || pointInPolygon([a, b], hull)) continue;
    const [a2, b2] = mapIntoGamut([a, b], hull), back = oklabToLin(L, a2, b2);
    for (let k = 0; k < 3; k++) px[3 * i + k] = clamp01(linToSrgb(clamp01(back[k]))) * 255;
    moved++;
  }
  return moved / n;
}

/* p: stepsRead(). edges: edgeMap(p). c: { detail, grain, mine }. The
   picture as watercolour: rgba at the picture's own size, and what was done
   - the share left as paper, the edges of each kind, and (when asked for)
   how much of the picture the palette could not mix. */
function wcRender(p, edges, c) {
  const { w, h, rgba } = p, n = w * h, S = Math.max(w, h);
  const D = WC_DETAIL[c.detail] || WC_DETAIL.medium, gr = (WC_GRAIN[c.grain] || WC_GRAIN.light).g;
  let ch = [0, 1, 2].map(k => Float32Array.from({ length: n }, (_, i) => rgba[4 * i + k]));
  const r = Math.max(2, Math.round(S * D.r));
  for (let pass = 0; pass < D.passes; pass++) ch = wcKuwahara(ch, w, h, r);

  // Where the edges are soft the washes run into each other: blend toward a
  // blurred copy near a soft edge. Where they are hard, the rim collects.
  const blurred = ch.map(a => stepsBlur(a, w, h, Math.max(3, S / 45)));
  const softSrc = new Float32Array(n), hardSrc = new Float32Array(n);
  for (let i = 0; i < n; i++) { if (edges.kind[i] === 2) softSrc[i] = 1; else if (edges.kind[i] === 1) hardSrc[i] = 1; }
  const soft = stepsBlur(softSrc, w, h, Math.max(3, S / 70)), hard = stepsBlur(hardSrc, w, h, 1);
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * ch[0][i] + 0.587 * ch[1][i] + 0.114 * ch[2][i];
  const lumB = stepsBlur(lum, w, h, 4);

  const { grain, paper: tooth } = wcGrain(w, h);
  const P = wcPaper(), px = new Float32Array(n * 3), keep = new Float32Array(n);
  let white = 0;
  for (let i = 0; i < n; i++) {
    const m = Math.min(1, soft[i] * 4) * 0.85;
    const col = [0, 1, 2].map(k => ch[k][i] + (blurred[k][i] - ch[k][i]) * m);
    // Absorbance of each channel against the paper, then the wash let down.
    const A = col.map((v, k) => -Math.log(Math.min(1, Math.max(0.015, v / P[k]))));
    const dense = 1 + gr * 0.8 * grain[i] * (0.3 + 0.7 * Math.min(1, (A[0] + A[1] + A[2]) / 4.5));
    const rim = Math.min(1, hard[i] * 3.5) * wcSmooth(-3, 9, lumB[i] - lum[i]);
    // Near-white, and without colour, is the paper itself: a pale skin is a
    // pale wash, not bare paper.
    const paperMix = wcSmooth(0.9, 0.97, Math.min(...col) / 255) * (1 - wcSmooth(14, 34, Math.max(...col) - Math.min(...col)));
    keep[i] = 1 - paperMix;
    if (paperMix > 0.5) white++;
    const t = 1 + (0.02 + 0.03 * gr) * tooth[i];
    for (let k = 0; k < 3; k++) {
      const painted = P[k] * Math.exp(-WC_STRENGTH * A[k] * Math.max(0.2, dense)) * (1 - 0.3 * rim);
      px[3 * i + k] = (painted * keep[i] + P[k] * paperMix) * t;
    }
  }

  let moved = null;
  if (c.mine) {
    const hull = wcReach();
    if (hull) moved = wcGamut(px, n, hull);
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[4 * i] = px[3 * i]; out[4 * i + 1] = px[3 * i + 1]; out[4 * i + 2] = px[3 * i + 2]; out[4 * i + 3] = 255;
  }
  return { w, h, rgba: out, white: white / n * 100, hard: edges.hard, soft: edges.soft, moved, reach: c.mine ? !!wcReach() : null };
}

function wcDraw(m, c) {
  c.width = m.w; c.height = m.h;
  c.getContext('2d').putImageData(new ImageData(m.rgba, m.w, m.h), 0, 0);
  return c;
}

function wcNote(m, c) {
  const row = (name, key, table) => `<div class="tone-bar"><span>${name}</span>` + Object.entries(table).map(([k, o]) =>
    `<button type="button" class="chip" data-wc="${key}:${k}" aria-pressed="${c[key] === k}" title="${esc(o.label)}">${o.chip}</button>`).join('') + '</div>';
  const label = PAINT_PALETTES[paintPaletteKey()].label;
  const paints = `<div class="tone-bar"><span>Colours</span>` +
    `<button type="button" class="chip" data-wc="mine:off" aria-pressed="${!c.mine}" title="The photo's own colours, let down">Any</button>` +
    `<button type="button" class="chip" data-wc="mine:on" aria-pressed="${c.mine}" title="Kept to what ${esc(label)} can mix">My paints</button></div>`;
  const edges = m.hard + m.soft
    ? `Where the picture's edges are hard (${Math.round(100 * m.hard / (m.hard + m.soft))}% of them) the wash stops and the pigment pools along it, a little darker; ` +
      `where they are soft the washes run into each other, wet-in-wet. `
    : '';
  let mine = '';
  if (c.mine) {
    mine = m.reach === false ? ' <i>The paints\' colours are not loaded yet - shown in the photo\'s own.</i>'
      : ` ${esc(label)} cannot mix ${Math.round(100 * m.moved)}% of this picture's colours as they are; those are knocked back toward grey, keeping their hue and lightness.`;
  }
  return row('Detail', 'detail', WC_DETAIL) + row('Grain', 'grain', WC_GRAIN) + paints +
    `<b>${Math.round(m.white)}% is left as bare paper</b> - what is near-white is not painted at all: in watercolour the white is the paper, and it does not come back. ` +
    `${edges}A wash is paler than the photo; the darks are second and third layers. ` +
    `<button type="button" class="chip" data-wc-steps>How to paint it, step by step</button>${mine} ` +
    `<small>A look, not a recipe: a simple wash model on the picture's own colours.</small>`;
}

/* ---- in a session: the preview over the picture, as a layer. */
let wcRun = 0, wcCache = { src: '', p: null, edges: null };

function clearWatercolour() {
  wcRun++;
  el('watercolourOverlay').classList.add('hidden');
  overlayNote('watercolour', state.watercolourOn ? 'Painting it...' : '');
}

function toggleWatercolour() {
  state.watercolourOn = !state.watercolourOn;
  el('btnWatercolour').setAttribute('aria-pressed', String(state.watercolourOn));
  clearWatercolour();
  if (state.watercolourOn) runWatercolour();
}

// A moment's work, so after a frame: the button shows pressed first.
function runWatercolour() {
  const img = el('img'), run = ++wcRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== wcRun || !state.watercolourOn) return;
    let m;
    const c = wcLoad();
    try {
      // The picture read and its edges found once for each picture: a chip
      // changes only what is done to them.
      const src = img.currentSrc || img.src;
      if (wcCache.src !== src) { const p = stepsRead(img); wcCache = { src, p, edges: edgeMap(p) }; }
      m = wcRender(wcCache.p, wcCache.edges, c);
    } catch (err) { console.error('watercolour:', err); overlayNote('watercolour', '<i>Could not paint this picture.</i>'); return; }
    wcDraw(m, el('watercolourOverlay')).classList.remove('hidden');
    overlayNote('watercolour', wcNote(m, c));
  }, 30);
}

el('btnWatercolour').addEventListener('click', toggleWatercolour);
el('poseNote').addEventListener('click', e => {
  if (e.target.closest('[data-wc-steps]')) { openSteps(state.current); return; }
  const b = e.target.closest('[data-wc]');
  if (!b) return;
  const [key, value] = b.dataset.wc.split(':'), c = wcLoad();
  if (key === 'mine') c.mine = value === 'on';
  else if (key === 'detail' && WC_DETAIL[value]) c.detail = value;
  else if (key === 'grain' && WC_GRAIN[value]) c.grain = value;
  else return;
  wcSave(c);
  runWatercolour();
});
