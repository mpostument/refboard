/* refboard - the half of Game assets (ROADMAP.md, "Game assets") that needs no
   model: work on a picture that runs in the page, so it is testable without a
   ComfyUI. Today only Cut out; pixel-it, make-seamless and the export join it.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---- Cut out: a figure drawn on a plain background, with nothing behind it.

   The model is told "simple background, white background" (or green), and the
   picture comes back on a background that is almost that colour - cream, a pale
   grey, a slow gradient. So it is found, not assumed:

   1. The background's colour is the commonest colour on the picture's edge.
      If the edge is not mostly one colour (a landscape, a figure filling the
      frame) there is no plain background, and cutOut says so.
   2. It is spread inward from the edge over every pixel near that colour. A
      line round the figure stops it: a pixel the background would cross to must
      be near the colour *and* near the pixel it came from.
   3. The gaps inside (between an arm and the body) are the same colour but
      cannot be told from a white plate of armour, so they are left alone unless
      asked for.
   4. The rim. The pixels two steps in from the background are a mix of figure
      and background - that is the pale halo seen on a dark game level. Each is
      given the colour of the figure just inside it, and an alpha from how far
      along the background -> figure line it lies. */

const CUT_TOLERANCE = 48;    // |dR|+|dG|+|dB| from the background's colour that still counts as it
const CUT_STEP = 28;         // the most two neighbouring pixels may differ for the background to cross
const CUT_MIN_BG = 0.04;     // under 4% of the picture gone is not a background
const CUT_EDGE_SHARE = 0.6;  // the edge must be this much one colour
const CUT_PAD = 4;           // room kept round the figure when it is cropped
const CUT_SPECK = 0.002;     // a loose piece under this fraction of the biggest piece is a speck

/* The commonest colour on the outer two pixels of the picture, and how much of
   that ring is near it. Colours are counted in 16 steps a channel, then averaged. */
function cutEdgeColour(src, w, h) {
  // The ring: all of the top and bottom two rows, and the first and last two pixels of the rest.
  const ring = fn => {
    for (let y = 0; y < h; y++) {
      const full = y < 2 || y >= h - 2;
      for (let x = 0; x < w; x++) {
        if (!full && x >= 2 && x < w - 2) { x = w - 3; continue; }
        fn((y * w + x) * 4);
      }
    }
  };
  const bins = new Uint32Array(4096), sum = new Float64Array(4096 * 3);
  let total = 0;
  ring(i => {
    const k = (src[i] >> 4) << 8 | (src[i + 1] >> 4) << 4 | (src[i + 2] >> 4);
    bins[k]++; sum[k * 3] += src[i]; sum[k * 3 + 1] += src[i + 1]; sum[k * 3 + 2] += src[i + 2];
    total++;
  });
  let best = 0;
  for (let k = 1; k < 4096; k++) if (bins[k] > bins[best]) best = k;
  const c = [sum[best * 3] / bins[best], sum[best * 3 + 1] / bins[best], sum[best * 3 + 2] / bins[best]];
  let near = 0;
  ring(i => { if (Math.abs(src[i] - c[0]) + Math.abs(src[i + 1] - c[1]) + Math.abs(src[i + 2] - c[2]) <= 60) near++; });
  return { c, share: near / total };
}

/* pic: a canvas. Returns { found: false, share, bgShare } for a picture with no plain
   background, else { found: true, canvas (RGBA, cropped if trim), ref, bgShare, x, y }
   where x, y are where the crop's corner was in the picture. */
function cutOut(pic, { tolerance = CUT_TOLERANCE, holes = false, trim = true, specks = true } = {}) {
  const w = pic.width, h = pic.height, n = w * h;
  const src = pic.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const { c: ref, share } = cutEdgeColour(src, w, h);
  if (share < CUT_EDGE_SHARE) return { found: false, share, bgShare: 0 };

  const far = new Uint16Array(n);
  for (let i = 0; i < n; i++) far[i] = Math.abs(src[i * 4] - ref[0]) + Math.abs(src[i * 4 + 1] - ref[1]) + Math.abs(src[i * 4 + 2] - ref[2]);
  const jump = (a, b) => Math.abs(src[a * 4] - src[b * 4]) + Math.abs(src[a * 4 + 1] - src[b * 4 + 1]) + Math.abs(src[a * 4 + 2] - src[b * 4 + 2]);

  // 2. From the edge inward. Marked when pushed, so each pixel goes on the stack once.
  const bg = new Uint8Array(n), stack = new Int32Array(n);
  let sp = 0, count = 0;
  const seed = i => { if (!bg[i] && far[i] <= tolerance) { bg[i] = 1; stack[sp++] = i; } };
  const grow = (i, j) => { if (!bg[j] && far[j] <= tolerance && jump(i, j) <= CUT_STEP) { bg[j] = 1; stack[sp++] = j; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp], x = i % w;
    count++;
    if (x > 0) grow(i, i - 1);
    if (x < w - 1) grow(i, i + 1);
    if (i >= w) grow(i, i - w);
    if (i < n - w) grow(i, i + w);
  }
  if (count < CUT_MIN_BG * n || count === n) return { found: false, share, bgShare: count / n };

  // 3. The gaps inside: pieces of the figure's own area that are the background's colour.
  if (holes) {
    const seen = new Uint8Array(n), near = tolerance * 0.75, minArea = Math.max(30, n * 0.0005);
    for (let s = 0; s < n; s++) {
      if (bg[s] || seen[s] || far[s] > near) continue;
      const piece = [s];
      seen[s] = 1;
      for (let q = 0; q < piece.length; q++) {
        const i = piece[q], x = i % w;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (j >= 0 && j < n && !bg[j] && !seen[j] && far[j] <= near) { seen[j] = 1; piece.push(j); }
        }
      }
      if (piece.length >= minArea) for (const i of piece) bg[i] = 1;
    }
  }

  // 4. The rim. depth: 0 background, 1 and 2 = that many steps in from it, 3 deeper.
  const depth = new Uint8Array(n);
  const touches = (i, test) => {
    const x = i % w;
    return (x > 0 && test(i - 1)) || (x < w - 1 && test(i + 1)) || (i >= w && test(i - w)) || (i < n - w && test(i + w));
  };
  for (let i = 0; i < n; i++) if (!bg[i]) depth[i] = touches(i, j => bg[j]) ? 1 : 3;
  for (let i = 0; i < n; i++) if (depth[i] === 3 && touches(i, j => depth[j] === 1)) depth[i] = 2;

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) if (depth[i] === 3) {
    out[i * 4] = src[i * 4]; out[i * 4 + 1] = src[i * 4 + 1]; out[i * 4 + 2] = src[i * 4 + 2]; out[i * 4 + 3] = 255;
  }
  // The figure's colour just inside a rim pixel: the mean of its neighbours that are deeper.
  const inside = (i, k) => {
    const x = i % w, y = (i / w) | 0;
    let r = 0, g = 0, b = 0, m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (depth[j] > k) { r += out[j * 4]; g += out[j * 4 + 1]; b += out[j * 4 + 2]; m++; }
    }
    return m ? [r / m, g / m, b / m] : null;
  };
  for (const k of [2, 1]) for (let i = 0; i < n; i++) {
    if (depth[i] !== k) continue;
    const f = inside(i, k);
    let a = 255, rgb = [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]];
    if (f) {
      const d = [f[0] - ref[0], f[1] - ref[1], f[2] - ref[2]], den = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      // A figure colour that is the background's own (a white plate) has no line to measure along.
      if (den > 300) {
        const t = ((rgb[0] - ref[0]) * d[0] + (rgb[1] - ref[1]) * d[1] + (rgb[2] - ref[2]) * d[2]) / den;
        a = Math.round(Math.max(0, Math.min(1, t)) * 255);
        rgb = f;
      }
    }
    out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = a < 10 ? 0 : a;
  }

  // Specks: pieces that touch nothing and are a small fraction of the biggest piece - the
  // sparks and dots the model scatters round a figure. A sword held out, or a boot, is not one.
  if (specks) {
    const label = new Int32Array(n), sizes = [0];
    for (let s = 0; s < n; s++) {
      if (out[s * 4 + 3] <= 8 || label[s]) continue;
      const id = sizes.length;
      let size = 0;
      label[s] = id; stack[0] = s; sp = 1;
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        size++;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!label[j] && out[j * 4 + 3] > 8) { label[j] = id; stack[sp++] = j; }
        }
      }
      sizes.push(size);
    }
    const biggest = sizes.reduce((a, b) => Math.max(a, b), 0);
    for (let i = 0; i < n; i++) if (label[i] && sizes[label[i]] < biggest * CUT_SPECK) out[i * 4 + 3] = 0;
  }

  // Where the figure is, for the crop.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) if (out[i * 4 + 3] > 8) {
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { found: false, share, bgShare: count / n };

  const full = Object.assign(document.createElement('canvas'), { width: w, height: h });
  full.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
  if (!trim) return { found: true, canvas: full, ref, bgShare: count / n, x: 0, y: 0 };
  const cx = Math.max(0, x0 - CUT_PAD), cy = Math.max(0, y0 - CUT_PAD);
  const cw = Math.min(w, x1 + 1 + CUT_PAD) - cx, ch = Math.min(h, y1 + 1 + CUT_PAD) - cy;
  const crop = Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  crop.getContext('2d').drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
  return { found: true, canvas: crop, ref, bgShare: count / n, x: cx, y: cy };
}
