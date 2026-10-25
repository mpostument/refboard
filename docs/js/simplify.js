/* refboard - Simplify into shapes: the reference reduced to 5-12 flat shapes
   of colour and value, the way a painter plans a study. Before any detail,
   a painting is a handful of shapes each of one colour; this finds them.

   How: the colour of every pixel is taken in OKLab (where a distance is how
   different two colours look), with lightness weighted more than hue - a
   painter groups by value first. k-means finds the k colours that best stand
   for the picture (k-means++ picks the first guesses, so two near colours do
   not both start as one; the generator is seeded, so the same picture always
   gives the same shapes), trained on a sample of a blurred copy so that grain
   does not pull a colour off - but every pixel is then given to its nearest
   colour from the picture itself, unblurred: a blur makes in-between colours
   along every border, and a pixel taken from the blurred copy would turn them
   into seams of shapes of their own.
   That leaves speckle in grainy areas and islands of a few pixels, so: a
   majority vote (each pixel takes the label most of its neighbours have, over
   a square as wide as the detail allows, then once more over 3 x 3), and
   every island smaller than the detail allows is given to the neighbouring
   shape it shares most border with. Each shape is finally painted the
   average colour of the pixels it ended up with.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const SIMPLIFY_KEY = 'refboard.simplify.v1';
const SIMPLIFY_COUNTS = [5, 8, 12];
// blur: the radius is the long side over this; min: the smallest island kept, as a share of the picture.
// vote: radius of the majority vote that cleans speckle (2r+1 square).
const SIMPLIFY_DETAIL = { broad: { blur: 70, min: 0.008, vote: 3 }, medium: { blur: 130, min: 0.0025, vote: 2 }, fine: { blur: 260, min: 0.0006, vote: 1 } };
const SIMPLIFY_VIEWS = ['colour', 'value', 'anime'];   // anime: each shape in a base, a shadow and a highlight (js/animecolour.js)
const SIMPLIFY_ANIME_WEIGHT = 0.35;    // anime colours by hue, and shades a colour itself: lightness counts less, or the shading becomes shapes
const SIMPLIFY_LIGHT_WEIGHT = 1.8;     // lightness counts this much more than a or b in telling colours apart

function simplifyLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(SIMPLIFY_KEY));
    if (v) return { n: SIMPLIFY_COUNTS.includes(v.n) ? v.n : 8, detail: SIMPLIFY_DETAIL[v.detail] ? v.detail : 'medium', view: SIMPLIFY_VIEWS.includes(v.view) ? v.view : 'colour' };
  } catch { /* fall through */ }
  return { n: 8, detail: 'medium', view: 'colour' };
}
function simplifySave(c) {
  try { localStorage.setItem(SIMPLIFY_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

// A small seeded generator (mulberry32): the same picture, the same shapes.
function simplifyRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The label of each pixel changed so that no island smaller than minPx remains:
   the smallest first, each into the neighbouring label it borders most. */
function simplifyMerge(labels, w, h, minPx) {
  const n = w * h, comp = new Int32Array(n).fill(-1), sizes = [], starts = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const id = sizes.length, lab = labels[s], stack = [s];
    comp[s] = id; let size = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      size++;
      if (x > 0 && comp[i - 1] < 0 && labels[i - 1] === lab) { comp[i - 1] = id; stack.push(i - 1); }
      if (x < w - 1 && comp[i + 1] < 0 && labels[i + 1] === lab) { comp[i + 1] = id; stack.push(i + 1); }
      if (i >= w && comp[i - w] < 0 && labels[i - w] === lab) { comp[i - w] = id; stack.push(i - w); }
      if (i < n - w && comp[i + w] < 0 && labels[i + w] === lab) { comp[i + w] = id; stack.push(i + w); }
    }
    sizes.push(size); starts.push(s);
  }
  const small = sizes.map((s, id) => [s, id]).filter(([s]) => s < minPx).sort((a, b) => a[0] - b[0]);
  for (const [, id] of small) {
    // Re-walk the island (its pixels still carry its own label unless an earlier merge ate it).
    const lab = labels[starts[id]], stack = [starts[id]], seen = new Set([starts[id]]), around = {};
    if (comp[starts[id]] !== id) continue;
    const cells = [];
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      cells.push(i);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1]) {
        if (j < 0) continue;
        if (labels[j] === lab && comp[j] === id) { if (!seen.has(j)) { seen.add(j); stack.push(j); } }
        else if (labels[j] !== lab) around[labels[j]] = (around[labels[j]] || 0) + 1;
      }
    }
    const best = Object.entries(around).sort((a, b) => b[1] - a[1])[0];
    if (best) for (const i of cells) labels[i] = +best[0];
  }
}

/* p: stepsRead(); { n, detail }. Gives { w, h, labels, shapes }: labels per
   pixel (an index into shapes) and shapes [{ rgb, share, L }] - the average
   colour, the percent of the picture and its L* - in no particular order. */
function simplifyOf(p, { n = 8, detail = 'medium', view } = {}) {
  const LW = view === 'anime' ? SIMPLIFY_ANIME_WEIGHT : SIMPLIFY_LIGHT_WEIGHT;
  const { w, h, rgba } = p, px = w * h, S = Math.max(w, h), D = SIMPLIFY_DETAIL[detail];
  const ch = [new Float32Array(px), new Float32Array(px), new Float32Array(px)];
  for (let i = 0; i < px; i++) {
    const [l, a, b] = compositionOklab(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
    ch[0][i] = l * LW; ch[1][i] = a; ch[2][i] = b;
  }
  const f = ch.map(c => stepsBlur(c, w, h, Math.max(1, S / D.blur)));   // to train on; the pixels themselves are assigned from ch
  // k-means on a sample.
  const rnd = simplifyRandom(7), stride = Math.max(1, Math.floor(px / 7000)), pts = [];
  for (let i = 0; i < px; i += stride) pts.push(i);
  const d2 = (i, c, v = f) => (v[0][i] - c[0]) ** 2 + (v[1][i] - c[1]) ** 2 + (v[2][i] - c[2]) ** 2;
  const centres = [pts[Math.floor(rnd() * pts.length)]].map(i => [f[0][i], f[1][i], f[2][i]]);
  const near = new Float64Array(pts.length).fill(Infinity);
  while (centres.length < n) {
    const last = centres[centres.length - 1];
    let total = 0;
    pts.forEach((i, k) => { near[k] = Math.min(near[k], d2(i, last)); total += near[k]; });
    if (total <= 1e-12) break;                         // fewer different colours than shapes asked for
    let r = rnd() * total, k = 0;
    while (k < pts.length - 1 && (r -= near[k]) > 0) k++;
    centres.push([f[0][pts[k]], f[1][pts[k]], f[2][pts[k]]]);
  }
  for (let iter = 0; iter < 10; iter++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (const i of pts) {
      let best = 0, bd = Infinity;
      centres.forEach((c, k) => { const d = d2(i, c); if (d < bd) { bd = d; best = k; } });
      const s = sum[best]; s[0] += f[0][i]; s[1] += f[1][i]; s[2] += f[2][i]; s[3]++;
    }
    sum.forEach((s, k) => { if (s[3]) centres[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  let labels = new Uint8Array(px);
  for (let i = 0; i < px; i++) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < centres.length; k++) { const d = d2(i, centres[k], ch); if (d < bd) { bd = d; best = k; } }
    labels[i] = best;
  }
  // Majority vote: the width the detail allows, then 3 x 3.
  const k = centres.length;
  for (const r of [D.vote, 1]) {
    const out = Uint8Array.from(labels), count = new Uint16Array(k);
    for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) {
      count.fill(0);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) count[labels[(y + dy) * w + x + dx]]++;
      let best = labels[y * w + x];
      for (let c = 0; c < k; c++) if (count[c] > count[best]) best = c;
      out[y * w + x] = best;
    }
    labels = out;
  }
  const minPx = Math.max(4, Math.floor(D.min * px));
  simplifyMerge(labels, w, h, minPx);
  simplifyMerge(labels, w, h, minPx);
  // The colour of each shape that is left: the average of the pixels it holds.
  const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
  for (let i = 0; i < px; i++) { const s = sum[labels[i]]; s[0] += rgba[4 * i]; s[1] += rgba[4 * i + 1]; s[2] += rgba[4 * i + 2]; s[3]++; }
  const index = new Int16Array(k).fill(-1), shapes = [];
  sum.forEach((s, c) => {
    if (!s[3]) return;
    index[c] = shapes.length;
    const rgb = [0, 1, 2].map(j => Math.round(s[j] / s[3]));
    shapes.push({ rgb, share: s[3] / px * 100, L: lstar(rgb) });
  });
  for (let i = 0; i < px; i++) labels[i] = index[labels[i]];
  // The picture's own lightness, only lightly blurred: where inside a shape it is darker or lighter (animecolour.js).
  const tone = stepsBlur(ch[0], w, h, Math.max(1, S / 300));
  for (let i = 0; i < px; i++) tone[i] /= LW;
  return { w, h, labels, shapes, tone };
}

// The flat picture on a canvas of the picture read's size: in colour, or in the grey of each shape's value.
function simplifyDraw(f, c, cfg) {
  c.width = f.w; c.height = f.h;
  const g = c.getContext('2d'), img = g.createImageData(f.w, f.h), px = img.data;
  if (cfg.view === 'anime') {
    const a = animeColour(f);
    px.set(a.px); g.putImageData(img, 0, 0);
    c.animeResult = a;
    return c;
  }
  const paint = f.shapes.map(s => cfg.view === 'value' ? greyOfLstar(s.L) : s.rgb);
  for (let i = 0; i < f.w * f.h; i++) {
    const p = paint[f.labels[i]];
    px[4 * i] = p[0]; px[4 * i + 1] = p[1]; px[4 * i + 2] = p[2]; px[4 * i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function simplifyNote(f, cfg) {
  const chip = (attr, k, label, on) => `<button type="button" class="chip" data-simp-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const bar = '<div class="tone-bar"><span>Shapes</span>' + SIMPLIFY_COUNTS.map(n => chip('n', n, n, cfg.n === n)).join('') +
    '<span>Detail</span>' + Object.keys(SIMPLIFY_DETAIL).map(k => chip('d', k, k[0].toUpperCase() + k.slice(1), cfg.detail === k)).join('') +
    '<span>Show</span>' + chip('v', 'colour', 'Colour', cfg.view === 'colour') + chip('v', 'value', 'Value', cfg.view === 'value') + chip('v', 'anime', 'Anime', cfg.view === 'anime') + '</div>';
  if (cfg.view === 'anime') {
    const a = f.anime || animeColour(f);
    return bar + animeKey(f, a) + 'Each shape in three flat tones, as anime is coloured: the shadow is not the base made darker but turned toward blue-violet, the highlight a step lighter and a little warmer. Where the photo shows no real shading the shape stays one tone (marked flat). <small>Shadows and highlights are read from the photo; the shapes are those of Simplify.</small>';
  }
  const byValue = f.shapes.slice().sort((a, b) => a.L - b.L);
  const key = '<div class="hm-key">' + byValue.map(s =>
    `<span title="${colHexOf(s.rgb)}"><i style="background:${rgbCss(s.rgb)}"></i>${colHexOf(s.rgb)} · ${s.share < 1 ? '<1' : Math.round(s.share)}% · L* ${Math.round(s.L)}</span>`).join('') + '</div>';
  const bySize = f.shapes.slice().sort((a, b) => b.share - a.share);
  const top3 = bySize.slice(0, 3).reduce((a, s) => a + s.share, 0);
  const dark = byValue[0], light = byValue[byValue.length - 1];
  const said = [`${f.shapes.length} shape${f.shapes.length === 1 ? '' : 's'}${f.shapes.length < cfg.n ? ` (fewer than the ${cfg.n} asked for: the picture has no more different colours)` : ''}, listed darkest first.`];
  if (f.shapes.length > 2) said.push(`The three largest make up ${Math.round(top3)}% of the picture: block those in first, then the small ones.`);
  if (f.shapes.length > 1) said.push(`The values run from L* ${Math.round(dark.L)} to ${Math.round(light.L)}.`);
  return bar + key + esc(said.join(' ')) + ' <small>Each shape is the average colour of what it holds; islands smaller than the detail allows were given to their neighbour.</small>';
}

/* ---- in a session: the flat picture over the original, as a layer. */
let simplifyRun = 0;

function clearSimplify() {
  simplifyRun++;
  el('simplifyOverlay').classList.add('hidden');
  overlayNote('simplify', state.simplifyOn ? 'Finding the shapes...' : '');
}

function toggleSimplify() {
  state.simplifyOn = !state.simplifyOn;
  el('btnSimplify').setAttribute('aria-pressed', String(state.simplifyOn));
  clearSimplify();
  if (state.simplifyOn) runSimplify();
}

// A moment's work, so after a frame: the button shows pressed first.
function runSimplify() {
  const img = el('img'), run = ++simplifyRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== simplifyRun || !state.simplifyOn) return;
    const cfg = simplifyLoad();
    let f;
    try { f = simplifyOf(stepsRead(img), cfg); simplifyDraw(f, el('simplifyOverlay'), cfg); f.anime = el('simplifyOverlay').animeResult; }
    catch (err) { console.error('simplify:', err); overlayNote('simplify', '<i>Could not find shapes in this picture.</i>'); return; }
    el('simplifyOverlay').classList.remove('hidden');
    overlayNote('simplify', simplifyNote(f, cfg));
  }, 30);
}

el('btnSimplify').addEventListener('click', toggleSimplify);
el('poseNote').addEventListener('click', e => {
  const n = e.target.closest('[data-simp-n]'), d = e.target.closest('[data-simp-d]'), v = e.target.closest('[data-simp-v]');
  if (!n && !d && !v) return;
  const cfg = simplifyLoad();
  if (n && SIMPLIFY_COUNTS.includes(+n.dataset.simpN)) cfg.n = +n.dataset.simpN;
  if (d && SIMPLIFY_DETAIL[d.dataset.simpD]) cfg.detail = d.dataset.simpD;
  if (v && SIMPLIFY_VIEWS.includes(v.dataset.simpV)) cfg.view = v.dataset.simpV;
  simplifySave(cfg);
  runSimplify();
});
