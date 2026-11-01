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
function cutEdgeColour(src, w, h, reach = 60) {
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
  ring(i => { if (Math.abs(src[i] - c[0]) + Math.abs(src[i + 1] - c[1]) + Math.abs(src[i + 2] - c[2]) <= reach) near++; });
  return { c, share: near / total };
}

/* pic: a canvas. Returns { found: false, share, bgShare } for a picture with no plain
   background, else { found: true, canvas (RGBA, cropped if trim), ref, bgShare, x, y }
   where x, y are where the crop's corner was in the picture. */
function cutOut(pic, { tolerance = CUT_TOLERANCE, holes = false, holeMin = 0, trim = true, specks = true } = {}) {
  const w = pic.width, h = pic.height, n = w * h;
  const src = pic.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const { c: ref, share } = cutEdgeColour(src, w, h, Math.max(60, tolerance));
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
    const seen = new Uint8Array(n), near = tolerance * 0.75, minArea = holeMin || Math.max(30, n * 0.0005);
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

/* ---- After Cut out, for a prop, a weapon or an item (js/assets.js).

   The model draws "a sword" as a rack of swords, a potion with a second bottle behind
   it: so the cut-out is reduced to one piece (assetSolo). A weapon is then turned to
   stand along the vertical with its working end up (assetOrient), so four swords
   made one after another point the same way. An icon is the piece, at the angle a
   game draws it in an inventory, in a square frame (assetIcon). */

const ASSET_ALPHA = 8;   // an alpha above this is the figure (the same line cutOut draws)

/* The picture cut to its opaque part, CUT_PAD all round; null if nothing is opaque. */
function assetTrim(canvas, pad = CUT_PAD) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > ASSET_ALPHA) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const cx = Math.max(0, x0 - pad), cy = Math.max(0, y0 - pad);
  const cw = Math.min(w, x1 + 1 + pad) - cx, ch = Math.min(h, y1 + 1 + pad) - cy;
  const out = Object.assign(document.createElement('canvas'), { width: cw, height: ch });
  out.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

/* Only the biggest piece of a cut-out, trimmed. Pieces closer than two pixels count as
   one (a guard and a blade the outline parts), so the mask is grown before it is labelled
   and the pixels kept are the figure's own. Returns { canvas, pieces } - how many there
   were - or null if nothing is opaque. */
function assetSolo(canvas) {
  const w = canvas.width, h = canvas.height, n = w * h;
  const img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data;
  // Grown by two pixels, along x then along y.
  const on = new Uint8Array(n), wide = new Uint8Array(n), grown = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = d[i * 4 + 3] > ASSET_ALPHA ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = Math.max(0, x - 2); k <= Math.min(w - 1, x + 2); k++) if (on[y * w + k]) { wide[y * w + x] = 1; break; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let k = Math.max(0, y - 2); k <= Math.min(h - 1, y + 2); k++) if (wide[k * w + x]) { grown[y * w + x] = 1; break; }
  }
  const label = new Int32Array(n), sizes = [0], stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!grown[s] || label[s]) continue;
    const id = sizes.length;
    let size = 0, sp = 1;
    label[s] = id; stack[0] = s;
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i / w) | 0;
      if (on[i]) size++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (grown[j] && !label[j]) { label[j] = id; stack[sp++] = j; }
      }
    }
    sizes.push(size);
  }
  if (sizes.length < 2) return null;
  let best = 1;
  for (let k = 2; k < sizes.length; k++) if (sizes[k] > sizes[best]) best = k;
  for (let i = 0; i < n; i++) if (label[i] !== best) d[i * 4 + 3] = 0;
  const kept = Object.assign(document.createElement('canvas'), { width: w, height: h });
  kept.getContext('2d').putImageData(img, 0, 0);
  const out = assetTrim(kept);
  return out && { canvas: out, pieces: sizes.length - 1 };
}

/* The picture turned by rad (clockwise) about its centre onto a canvas big enough to hold it. */
function assetRotate(canvas, rad) {
  const w = canvas.width, h = canvas.height, c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const out = Object.assign(document.createElement('canvas'), { width: Math.ceil(w * c + h * s), height: Math.ceil(w * s + h * c) });
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.translate(out.width / 2, out.height / 2);
  g.rotate(rad);
  g.drawImage(canvas, -w / 2, -h / 2);
  return out;
}

/* The opaque part's centre of mass and how stretched it is: the long axis' angle from the
   x axis (y down), and the ratio of the long extent to the short. */
function assetShape(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let m = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = d[(y * w + x) * 4 + 3] / 255;
    m += a; sx += a * x; sy += a * y;
  }
  if (!m) return null;
  const cx = sx / m, cy = sy / m;
  let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = d[(y * w + x) * 4 + 3] / 255;
    xx += a * (x - cx) ** 2; yy += a * (y - cy) ** 2; xy += a * (x - cx) * (y - cy);
  }
  xx /= m; yy /= m; xy /= m;
  const half = (xx + yy) / 2, spread = Math.sqrt(((xx - yy) / 2) ** 2 + xy ** 2);
  return { cx, cy, angle: 0.5 * Math.atan2(2 * xy, xx - yy), stretch: Math.sqrt((half + spread) / Math.max(half - spread, 1e-6)) };
}

const ASSET_STRETCH = 1.6;   // a piece less stretched than this (a shield, a coin) has no up
const ASSET_SNAP = 3 * Math.PI / 180;   // already this close to upright: left as it is
const ASSET_FLIP = 0.58;   // the mass this far down a piece (0 top, 1 bottom) says it hangs head down

/* A long piece stood upright. The long axis is brought to the vertical by the shorter way
   round, so a piece drawn tip up and crooked stays tip up (js/assets.js asks the model for
   "pointing up"). Turned over only on clear evidence: the mass of an axe is its head, of a
   staff its orb, so with the mass in the lower part the piece hangs from it. A sword's
   centre of mass is too near the middle to say - blade against guard and grip - and is not
   trusted. Returns { canvas, turned } - the angle in degrees, 0 if it was left as it was -
   or null if nothing is opaque. */
function assetOrient(canvas) {
  const first = assetShape(canvas);
  if (!first) return null;
  if (first.stretch < ASSET_STRETCH) return { canvas, turned: 0 };
  // The long axis to the vertical by the shorter way round. An axis has no direction - its
  // angle is only known up to a half turn (atan2 of a symmetric piece may say -90 or 90) - so
  // the turn is taken modulo a half turn, into (-90, 90], never a full flip by accident.
  const half = Math.PI;
  let turn = Math.PI / 2 - first.angle;
  turn = ((turn + Math.PI / 2) % half + half) % half - Math.PI / 2;
  let out = Math.abs(turn) < ASSET_SNAP ? canvas : assetRotate(canvas, turn);
  let total = turn;
  const tall = assetTrim(out, 0), s = assetShape(tall);
  if (s.cy > tall.height * ASSET_FLIP) { out = assetRotate(tall, Math.PI); total += Math.PI; }
  const trimmed = assetTrim(out);
  return { canvas: trimmed, turned: Math.round(((total * 180 / Math.PI) % 360 + 360) % 360) };
}

/* The inventory icon: a framed square with the piece in it. A weapon (diagonal) is laid at
   45 degrees, its top toward the upper right - how a sword is drawn in a slot. */
function assetIcon(canvas, { size = 128, diagonal = false } = {}) {
  const out = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = out.getContext('2d');
  const r = size * 0.14, inset = Math.max(2, size * 0.02);
  g.beginPath();
  g.roundRect(inset, inset, size - 2 * inset, size - 2 * inset, r);
  g.fillStyle = '#2b2b3d';
  g.fill();
  g.lineWidth = Math.max(2, size * 0.035);
  g.strokeStyle = '#a6adc8';
  g.stroke();
  let piece = canvas;
  if (diagonal) piece = assetRotate(piece, Math.PI / 4);
  piece = assetTrim(piece, 0) || piece;
  const room = size * 0.68, k = Math.min(room / piece.width, room / piece.height);
  const dw = Math.max(1, Math.round(piece.width * k)), dh = Math.max(1, Math.round(piece.height * k));
  g.imageSmoothingQuality = 'high';
  g.drawImage(piece, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
  return out;
}

/* A figure cut out of a background that may not be plain. An anime illustration with soft shading
   comes on a cream *gradient* (a vignette, darker in the corners), and cutOut at its usual tolerance
   takes only the strip near the edge colour and leaves the rest: the picture looks cut and is not.
   So the tolerance is raised step by step until the picture's own edge is clear - the test a cut
   figure must pass: nothing of it touches the border, so every border pixel is background. The
   bigger tolerances are safe only because the flood still cannot cross a jump in colour (CUT_STEP),
   and the figure has an outline. Returns { found, canvas (trimmed), tolerance }. */
// The last two reach a gradient that darkens 200 steps from the colour the edge is mostly of; the
// last is "as far as the step between neighbours allows" (765 is the greatest |dR|+|dG|+|dB|).
const FIGURE_TOLERANCES = [CUT_TOLERANCE, 100, 160, 260, 765];
const FIGURE_EDGE_CLEAR = 0.98;   // of the border's pixels that must be transparent
function assetBorderClear(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let clear = 0, total = 0;
  const look = (x, y) => { total++; if (d[(y * w + x) * 4 + 3] <= ASSET_ALPHA) clear++; };
  for (let x = 0; x < w; x++) { look(x, 0); look(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { look(0, y); look(w - 1, y); }
  return clear / total;
}
/* Some pictures have two backgrounds: a darker frame (a vignette, a torn paper edge) and a paler
   sheet inside it that the figure stands on. cutOut takes the frame, and the sheet - cut off from
   it by a soft edge bigger than one step - stays, as a pale patch round the figure. After a clean
   cut the figure's rim is its own dark outline; after a half cut it is mostly this one pale
   colour. So: if most of the rim is light and of one colour, that colour is spread inward from the
   rim, over pixels near it and near their neighbour - it cannot cross the figure's outline.
   Repeated, in case there is a third layer. Returns a new canvas, or the same one if nothing was
   peeled. */
const PEEL_SHARE = 0.25;    // the rim must be this much one colour
const PEEL_LIGHT = 170;     // and every channel at least this light
const PEEL_REACH = 60;      // |dR|+|dG|+|dB| from that colour that still counts as it
function assetPeel(canvas, rounds = 3) {
  const w = canvas.width, h = canvas.height, n = w * h;
  const img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data;
  const solid = i => d[i * 4 + 3] > ASSET_ALPHA;
  const nbrs = i => { const x = i % w, o = []; if (x > 0) o.push(i - 1); if (x < w - 1) o.push(i + 1); if (i >= w) o.push(i - w); if (i < n - w) o.push(i + w); return o; };
  const jump = (a, b) => Math.abs(d[a * 4] - d[b * 4]) + Math.abs(d[a * 4 + 1] - d[b * 4 + 1]) + Math.abs(d[a * 4 + 2] - d[b * 4 + 2]);
  let peeled = false;
  for (let r = 0; r < rounds; r++) {
    const rim = [];
    for (let i = 0; i < n; i++) if (solid(i) && (nbrs(i).length < 4 || nbrs(i).some(j => !solid(j)))) rim.push(i);
    if (!rim.length) break;
    const bins = new Map();
    for (const i of rim) { const k = (d[i * 4] >> 4) << 8 | (d[i * 4 + 1] >> 4) << 4 | (d[i * 4 + 2] >> 4); const b = bins.get(k) || [0, 0, 0, 0]; b[0]++; b[1] += d[i * 4]; b[2] += d[i * 4 + 1]; b[3] += d[i * 4 + 2]; bins.set(k, b); }
    let best = null;
    for (const b of bins.values()) if (!best || b[0] > best[0]) best = b;
    const c = [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
    if (best[0] / rim.length < PEEL_SHARE || Math.min(...c) < PEEL_LIGHT) break;
    const near = i => Math.abs(d[i * 4] - c[0]) + Math.abs(d[i * 4 + 1] - c[1]) + Math.abs(d[i * 4 + 2] - c[2]) <= PEEL_REACH;
    const stack = [], gone = new Uint8Array(n);
    for (const i of rim) if (near(i)) { gone[i] = 1; stack.push(i); }
    let count = 0;
    while (stack.length) {
      const i = stack.pop(); count++;
      for (const j of nbrs(i)) if (!gone[j] && solid(j) && near(j) && jump(i, j) <= CUT_STEP) { gone[j] = 1; stack.push(j); }
    }
    if (!count) break;
    for (let i = 0; i < n; i++) if (gone[i]) d[i * 4 + 3] = 0;
    peeled = true;
  }
  if (!peeled) return canvas;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

/* A character is asked for on a flat colour that is not in her look (a "green screen": see charKey in
   js/assets.js), because a white or cream background cannot be told from a white cloak - cutOut, assetPeel
   and assetDefringe all take pale pixels for background, and the cloak went with it. When the picture's
   edge is that kind of colour (a saturated one) the figure cannot own it, so: the gaps inside the figure
   (between the legs, under an arm) are cleared too, and the two steps that exist only for a pale background
   are left out - they would take the pale parts of the figure. Returns { found, canvas (trimmed), tolerance, keyed }. */
const KEY_SATURATION = 80;   // the edge colour's strongest channel less its weakest: a flat key, not a cream or grey (100 until the cells of a sheet, whose magenta is drawn paler: 196 118 210 is 92)
const KEY_HOLE_MIN = 6;      // the smallest gap cleared on a key colour, in pixels: no part of her is that colour, so even the gap under a heel is background (a cut-out's usual floor of 0.05% of the picture left it pink)
const KEY_HOLES_UP_TO = 160;  // the widest tolerance gaps are cleared at - a wider one is a gradient, and would eat the figure
/* Whether an edge colour is a key and not a paper: a saturated one. A cell of a sheet is asked for on the key too, and
   comes back a pale lavender (163 155 195, saturation 40) that the saturated test took for a cream: the gaps between
   the legs stayed, and so did the white border. There the picture is known to be on a key, so any colour that is
   not near white or grey (KEY_SHEET_SATURATION, and some channel under KEY_PAPER) is one. */
const KEY_SHEET_SATURATION = 30, KEY_PAPER = 200;
const keyColour = (c, sheet) => { const sat = Math.max(...c) - Math.min(...c); return sat >= KEY_SATURATION || (sheet && sat >= KEY_SHEET_SATURATION && Math.min(...c) < KEY_PAPER); };
function assetCutFigure(pic, { sheet = false } = {}) {
  const w = pic.width, h = pic.height;
  const edge = cutEdgeColour(pic.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, w, h);
  const keyed = edge.share >= CUT_EDGE_SHARE && keyColour(edge.c, sheet);
  for (const tolerance of FIGURE_TOLERANCES) {
    const cut = cutOut(pic, { tolerance, trim: false, holes: keyed && tolerance <= KEY_HOLES_UP_TO, holeMin: KEY_HOLE_MIN });
    if (!cut.found || assetBorderClear(cut.canvas) < FIGURE_EDGE_CLEAR) continue;
    const canvas = assetTrim(keyed ? cut.canvas : assetPeel(cut.canvas));
    if (canvas) return { found: true, canvas, tolerance, keyed, key: cut.ref, sheet };
  }
  return { found: false };
}

/* The white edge the model draws round a figure (a sticker's border), taken off. The plain
   background it was cut from is a cream, not white, so the border is a different colour from it
   and cutOut keeps it - and on a dark game background it shows as a bright outline. Each pass
   removes one pixel from the outside of the figure where that pixel is near-white; it stops at
   the figure's own dark outline, and at anything coloured. Up to `passes` pixels, so a white
   garment with no outline loses at most that much. Returns a new canvas. */
const FRINGE_LIGHT = 205;   // every channel at least this: a near-white pixel
const FRINGE_KEYED_LIGHT = 180;   // on a key colour the border's edge is blended with the key (a pink white on magenta), so it is paler by less
const FRINGE_DARK = 110;
const FRINGE_SHEET_DARK = 170;   // a cell of a sheet draws its outline thin and grey-blue, not black: darker than this is an outline there   // a pixel this dark (every channel) is the figure's own outline
const FRINGE_MAX = 7;   // how far a border may stand from the outline it hides: further, and what is there is not a border
/* `behind` (for a picture drawn on a key colour, where a white cloak and a white border are both there) takes a
   light edge pixel only if the figure's own dark outline lies within a few pixels (FRINGE_MAX + 2) inside it: a border
   is a band between the outside and the outline, and a white garment with no outline is not. */
function assetDefringe(canvas, passes = 8, { light = FRINGE_LIGHT, behind = false, dark = FRINGE_DARK } = {}) {
  const w = canvas.width, h = canvas.height;
  const img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > ASSET_ALPHA;
  const removed = [];
  for (let k = 0; k < passes; k++) {
    const gone = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      if (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) continue;
      const i = (y * w + x) * 4;
      if (d[i] >= light && d[i + 1] >= light && d[i + 2] >= light) gone.push(i);
    }
    if (!gone.length) break;
    for (const i of gone) { removed.push([i, d[i + 3]]); d[i + 3] = 0; }
  }
  if (behind && removed.length) {
    // The outline's reach: a pixel is near one if a dark, solid pixel is within r, found by two sweeps (across, then down).
    const r = Math.min(passes, FRINGE_MAX) + 2, near = new Uint8Array(w * h), across = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let last = -1e9;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > ASSET_ALPHA && d[i] < dark && d[i + 1] < dark && d[i + 2] < dark) last = x; across[y * w + x] = x - last <= r ? 1 : 0; }
      last = 1e9;
      for (let x = w - 1; x >= 0; x--) { const i = (y * w + x) * 4; if (d[i + 3] > ASSET_ALPHA && d[i] < dark && d[i + 1] < dark && d[i + 2] < dark) last = x; if (last - x <= r) across[y * w + x] = 1; }
    }
    for (let x = 0; x < w; x++) {
      let last = -1e9;
      for (let y = 0; y < h; y++) { if (across[y * w + x]) last = y; if (y - last <= r) near[y * w + x] = 1; }
      last = 1e9;
      for (let y = h - 1; y >= 0; y--) { if (across[y * w + x]) last = y; if (last - y <= r) near[y * w + x] = 1; }
    }
    // Put back what has no outline near it: that was the figure's own, not a border.
    for (const [i, a] of removed) if (!near[i >> 2]) d[i + 3] = a;
  }
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

/* Whether the model drew a white border (a sticker's) round the figure: the share of its outermost pixels that are near-white.
   A border is the whole ring - 0.95 to 0.98 measured on the sheets that had one - and a figure with none has a dark or a coloured
   edge, with only a pale limb or a white sleeve here and there (0.07 to 0.19 on the sheets without). Taking a border off is
   taking light pixels off the edge, so it is done only where there is one: where there is none it bites the pale skin of a leg and
   the grey of an armour plate out in steps (real run, 2026-10-18). */
const BORDER_SHARE = 0.5;
function assetRimPale(canvas) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > ASSET_ALPHA;
  let edge = 0, pale = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y) || (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) continue;
    edge++;
    const i = (y * w + x) * 4;
    if (d[i] >= FRINGE_LIGHT && d[i + 1] >= FRINGE_LIGHT && d[i + 2] >= FRINGE_LIGHT) pale++;
  }
  return edge ? pale / edge : 0;
}

/* A key colour's last traces. Where the figure's outline meets the key colour the model blends them (a black line
   on magenta is a dark magenta), and those pixels are further from the key than the cut-out reaches, so they stay
   as a coloured hem on the hair and the skirt - and a pixel grid makes each one a palette colour. The key is a colour
   her look does not name, so a pixel with the key's hue (the same direction away from grey, whatever the lightness)
   is the key's, not hers. Peels such pixels off the outside, one pixel a pass, up to `passes`. A pale pink skin
   or a blue skirt points elsewhere (cosine under KEY_HUE); only a pixel on the outside is taken, so an inner one stays. */
const KEY_HUE = 0.85, KEY_CHROMA = 20;
function assetDespill(canvas, key, passes = 4) {
  // A pale key (a lavender) has a hue too weak to tell from the figure's own blue: only the defringe takes its border.
  if (!key || Math.max(...key) - Math.min(...key) < KEY_SATURATION) return canvas;
  const w = canvas.width, h = canvas.height, img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data;
  const mk = (key[0] + key[1] + key[2]) / 3, ck = [key[0] - mk, key[1] - mk, key[2] - mk], nk = Math.hypot(...ck);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > ASSET_ALPHA;
  const tinted = i => {
    const m = (d[i] + d[i + 1] + d[i + 2]) / 3, a = d[i] - m, b = d[i + 1] - m, c = d[i + 2] - m, n = Math.hypot(a, b, c);
    return n >= KEY_CHROMA && (a * ck[0] + b * ck[1] + c * ck[2]) / (n * nk) >= KEY_HUE;
  };
  for (let k = 0; k < passes; k++) {
    const gone = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y) || (on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) continue;
      const i = (y * w + x) * 4;
      if (tinted(i)) gone.push(i);
    }
    if (!gone.length) break;
    for (const i of gone) d[i + 3] = 0;
  }
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

/* The shadow the model draws on the floor under a figure however it is told not to: a flat dark ellipse,
   wider than her feet. It cuts out with her, makes the picture wider than she is, and sets the feet line
   a few pixels low in one frame of a walk and not in the next. What marks it: a column whose lowest solid
   pixels are dark and few (SHADOW_HIGH of the height at most) and have nothing above them - a sliver on the
   ground, where a leg, a boot's toe or a heel is joined to what is above. A toe tip is such a sliver too, but
   a few pixels wide: only when the slivers add up to SHADOW_SPAN of the height is it a shadow. Takes the
   slivers off (what is under a foot is joined to it and stays). Returns a new canvas, or the same one if
   there is none. */
const SHADOW_HIGH = 0.04, SHADOW_SPAN = 0.12, SHADOW_DARK = 80, SHADOW_GREY = 170, SHADOW_FRINGE = 3;
function assetDropShadow(canvas) {
  const w = canvas.width, h = canvas.height, img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h), d = img.data;
  const solid = (x, y) => y >= 0 && y < h && d[(y * w + x) * 4 + 3] > ASSET_ALPHA;
  const shade = (x, y) => { const i = (y * w + x) * 4; return Math.max(d[i], d[i + 1], d[i + 2]); };
  let low = -1, top = h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) { low = Math.max(low, y); top = Math.min(top, y); }
  if (low < 0) return canvas;
  const tall = low - top + 1, most = Math.max(2, Math.round(tall * SHADOW_HIGH));
  // The column's sliver on the ground: { x, y, n } (n rows up from y), or null. A pixel is the line when its brightest channel is under `limit`.
  const sliver = (x, limit) => {
    // The lowest solid pixel of the column, and the run of dark pixels up from it.
    let y = h - 1; while (y >= 0 && !solid(x, y)) y--;
    if (y < 0) return null;
    // The model's soft edge leaves a row or two of pale pixels under a dark line (found on a real idle: 2 rows
    // under a 4-row line): they are skipped, and go with it.
    let f = 0; while (f < SHADOW_FRINGE && y - f >= 0 && solid(x, y - f) && shade(x, y - f) >= limit) f++;
    const yy = y - f;
    let n = 0; while (yy - n >= 0 && solid(x, yy - n) && shade(x, yy - n) < limit) n++;
    if (n === 0 || n > most) return null;
    // Isolated: above it comes nothing - not a pixel of a leg, a boot or a skirt for a few rows (the line's soft
    // edge is pale on top as well, so a few pale rows above it do not count).
    let g = 0; while (g < SHADOW_FRINGE && solid(x, yy - n - g) && shade(x, yy - n - g) >= limit) g++;
    for (let k = 0; k < 3; k++) if (solid(x, yy - n - g - k)) return null;
    return { x, y, n: n + f + g };   // the pale rows above the line go with it, as those under it do
  };
  // Only what is on the ground: a fingertip or a lock of hair is a sliver too, high up. The shadow is in pieces (the feet
  // are joined to what is above and are not slivers), so what counts is how many columns there are in all.
  const onGround = r => r && r.y > low - 2 * most;
  const runs = [];
  for (let x = 0; x < w; x++) { const r = sliver(x, SHADOW_DARK); if (onGround(r)) runs.push(r); }
  if (runs.length < tall * SHADOW_SPAN) return canvas;
  // It is a shadow: where its line thins to a grey 1-2 rows, between the dark stretches, those columns go too.
  const got = new Set(runs.map(r => r.x));
  for (let x = 0; x < w; x++) if (!got.has(x)) { const r = sliver(x, SHADOW_GREY); if (onGround(r)) runs.push(r); }
  for (const r of runs) for (let k = 0; k < r.n; k++) d[((r.y - k) * w + r.x) * 4 + 3] = 0;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h });
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

/* ---- Characters (js/assets.js): the directions of one character are drawn one at a time, so
   each comes out a little taller or shorter than the next, and cut out each stands in a box
   of its own size. A game swaps them in one place, so they have to share a frame: the same
   height, the feet on the same line, the figure in the middle.

   assetAlign takes the cut-out canvases (each trimmed to its figure), scales every one to the
   median height - the middle one, so a single odd picture does not drag the others - and sets
   them in canvases of one size, feet on the bottom line, the body on the middle line. Returns
   { canvases, width, height }, or null if there is nothing to align.

   The middle line is the body's, not the figure box's: a bow held out to one side widens the box
   on that side only, and centring the box would slide the body the other way. assetBodyCentre
   finds the body; the frame is as wide as the widest left side plus the widest right side. */
const BODY_BAND = [0.15, 0.85];   // the rows (as a share of the height) the body's centre is read from: head to hip, not the feet
function assetBodyCentre(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const mids = [];
  for (let y = Math.floor(h * BODY_BAND[0]); y < Math.ceil(h * BODY_BAND[1]); y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > ASSET_ALPHA) { if (l < 0) l = x; r = x; }
    if (l >= 0) mids.push((l + r + 1) / 2);
  }
  if (!mids.length) return w / 2;
  mids.sort((a, b) => a - b);
  // The median: the few rows a bow or a sword reaches into do not move it, as they would an average.
  return mids.length % 2 ? mids[mids.length >> 1] : (mids[(mids.length >> 1) - 1] + mids[mids.length >> 1]) / 2;
}
function assetAlign(canvases, pad = CUT_PAD) {
  const list = canvases.filter(Boolean);
  if (!list.length) return null;
  const heights = list.map(c => c.height).sort((a, b) => a - b);
  const mid = heights.length >> 1, target = heights.length % 2 ? heights[mid] : (heights[mid - 1] + heights[mid]) / 2;
  const scaled = list.map(c => { const k = target / c.height, cx = assetBodyCentre(c) * k; return { c, k, cx, rest: c.width * k - cx }; });
  const left = Math.round(Math.max(...scaled.map(s => s.cx))), right = Math.round(Math.max(...scaled.map(s => s.rest)));
  const width = left + right + 2 * pad, height = Math.round(target) + 2 * pad;
  const out = scaled.map(({ c, k, cx }) => {
    const o = Object.assign(document.createElement('canvas'), { width, height }), g = o.getContext('2d');
    const w = Math.max(1, Math.round(c.width * k)), h = Math.max(1, Math.round(c.height * k));
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, pad + left - Math.round(cx), height - pad - h, w, h);
    return o;
  });
  return { canvases: out, width, height };
}

/* ---- Tiles (js/assets.js): the model draws a square of grass, and its left edge does not
   meet its right. The mending is done in two halves, and only the half that needs a model
   asks for one.

   1. tileRoll shifts the picture by half its width and height, with wrap-around. Now the
      four edges are the picture's own inside (they meet: they were neighbours), and the old
      seams lie in the middle as a cross.
   2. That cross is drawn again by the model (tileCross is the mask for it), in the words the
      tile was made from, so what fills it is grass between grass.
   Then tileSeam says, without looking, how well the edges meet, and tileGrid lays the tile
   3 x 3 to look at it. */

/* The picture shifted right by dx and down by dy, what leaves one side coming in on the other. */
function tileRoll(canvas, dx, dy) {
  const w = canvas.width, h = canvas.height;
  const x = ((dx % w) + w) % w, y = ((dy % h) + h) % h;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = out.getContext('2d');
  for (const [ox, oy] of [[0, 0], [-w, 0], [0, -h], [-w, -h]]) g.drawImage(canvas, x + ox, y + oy);
  return out;
}

/* The mask of a cross through the middle, band wide: white where to draw again, black elsewhere
   (the server reads the red channel). */
function tileCross(w, h, band) {
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.fillRect(Math.round((w - band) / 2), 0, band, h);
  g.fillRect(0, Math.round((h - band) / 2), w, band);
  return out;
}

/* The mended cross, in the tone of the rest. The model draws it again from the words and comes back a
   shade off (a real run: a lighter green band through a grass tile, a darker one through dirt - a grid
   of lines at 3 x 3). Each channel under the mask is moved by the difference between the mean outside
   it and the mean inside, so the band is no lighter or darker than what it joins; the texture in it is
   left as drawn. Returns a new canvas. */
function tileMatch(canvas, mask) {
  const w = canvas.width, h = canvas.height;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const m = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const inside = [0, 0, 0], outside = [0, 0, 0];
  let ni = 0, no = 0;
  for (let i = 0; i < d.length; i += 4) {
    const into = m[i] > 127 ? inside : outside;
    for (let c = 0; c < 3; c++) into[c] += d[i + c];
    if (m[i] > 127) ni++; else no++;
  }
  if (!ni || !no) return out;
  const shift = [0, 1, 2].map(c => outside[c] / no - inside[c] / ni);
  for (let i = 0; i < d.length; i += 4) if (m[i] > 127)
    for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round(d[i + c] + shift[c])));
  g.putImageData(img, 0, 0);
  return out;
}

/* How much the wrap-around edge differs from the picture's own inside: the mean difference of
   the last column from the first, over the mean difference of the two pairs of columns on each
   side of it (and the same for rows); the worse of the two. 1 is a seamless tile - the step
   across the edge is no bigger than the steps next to it, however steep the picture is there;
   a tile cut from a picture is 2 - 6. (Against the median of all the pairs a smooth, steep
   edge of a wave that does wrap would read as a seam.) */
function tileSeam(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const px = (x, y) => (y * w + x) * 4;
  const pair = (a, b) => Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);
  const across = (len, mean) => {
    const diffs = Array.from({ length: len }, (_, i) => mean(i, (i + 1) % len));
    const near = (diffs[len - 3] + diffs[len - 2] + diffs[0] + diffs[1]) / 4;
    return diffs[len - 1] / Math.max(near, 1);
  };
  const cols = across(w, (x, x2) => { let s = 0; for (let y = 0; y < h; y++) s += pair(px(x, y), px(x2, y)); return s / h; });
  const rows = across(h, (y, y2) => { let s = 0; for (let x = 0; x < w; x++) s += pair(px(x, y), px(x, y2)); return s / w; });
  return Math.max(cols, rows);
}

/* How much a tile varies: the standard deviation of its lightness (0 - 255), from every 4th pixel
   each way. The model draws grass or snow nearly flat on some seeds (one colour, and at 32 px
   one pixel colour); a real texture is 8 or more, a flat fill 1 - 4. */
function tileFlatness(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let n = 0, sum = 0, sq = 0;
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
    const i = (y * w + x) * 4, l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    n++; sum += l; sq += l * l;
  }
  return n ? Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) : 0;
}

/* The tile laid n x n, to look at. */
function tileGrid(canvas, n = 3) {
  const out = Object.assign(document.createElement('canvas'), { width: canvas.width * n, height: canvas.height * n }), g = out.getContext('2d');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g.drawImage(canvas, x * canvas.width, y * canvas.height);
  return out;
}

/* The tile at size x size, halved while it is more than twice too big so that every pixel is
   the mean of the ones it covers (one jump from 1024 to 16 would keep one pixel in sixty-four). */
function tileShrink(canvas, size) { return assetShrinkTo(canvas, size, size); }

/* The same for any shape: w x h, halved while either side is more than twice too big. */
function assetShrinkTo(canvas, w, h) {
  let c = canvas;
  while (c.width > w * 2 && c.height > h * 2) {
    const half = Object.assign(document.createElement('canvas'), { width: c.width >> 1, height: c.height >> 1 });
    const g = half.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, half.width, half.height);
    c = half;
  }
  if (c.width === w && c.height === h) return c;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, w, h);
  return out;
}

/* ---- The pixel look (ROADMAP Game assets, phase 6) ----
   What the model drew is a painting; a pixel game wants a sprite. Three steps, none of
   which needs the model: shrink to a grid (the mean of the pixels each cell covers, then
   the edge made hard - alpha is on or off, never half), cut the colours to a few (median
   cut: the widest box of colours is split at its median until there are enough), and a
   one-pixel outline in the palette's darkest colour round the shape. A game's palette is
   handed in and handed back, so that the sprite, the tile and the icon of one game draw
   from the same colours: a pixel already near one of them takes it, and only the colours
   the palette does not have yet are cut anew - at most a third of what room is left (and at least four, while there is room), or the
   first picture would use them all and the tile of grass after it find none. */

const PIX_NEAR = 3000;   // weighted RGB distance (pixDist) within which a pixel is "in" the palette already
const PIX_ALPHA = 128;
const PIX_SPLIT = 20;   // a box of colours narrower than this (on every channel) is one colour: it is not cut again
const PIX_SPLIT_TILE = 6;   // a tile is its texture: fine shades of one green are kept apart

// Redmean-ish: green counts most, blue least, as the eye does.
const pixDist = (a, b) => 2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2;

/* `pixels` ([r, g, b] each) cut into at most n colours: the mean of each box. */
function pixelMedianCut(pixels, n, split = PIX_SPLIT) {
  if (!pixels.length || n <= 0) return [];
  const boxes = [pixels];
  while (boxes.length < n) {
    let at = -1, ch = 0, widest = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > widest) { widest = hi - lo; at = i; ch = c; }
      }
    });
    if (at < 0 || widest < split) break;   // every box is (near enough) one colour
    const b = boxes[at].slice().sort((p, q) => p[ch] - q[ch]), mid = b.length >> 1;
    boxes.splice(at, 1, b.slice(0, mid), b.slice(mid));
  }
  return boxes.map(b => [0, 1, 2].map(c => Math.round(b.reduce((s, p) => s + p[c], 0) / b.length)));
}

/* The canvas as pixel art: longest side `grid` cells (outline included), `colours` at most,
   a one-cell outline when `outline`. `palette` ([r, g, b] list, may be empty) is the game's:
   it is used first and grown, up to `colours`, when `shared`; when not, it is only the
   picture's own and starts empty. Returns { canvas, palette } - the palette afterwards. */
function assetPixelate(canvas, { grid = 32, colours = 16, outline = true, palette = [], shared = false, split = PIX_SPLIT } = {}) {
  const pad = outline ? 1 : 0, k = (grid - 2 * pad) / Math.max(canvas.width, canvas.height);
  const w = Math.max(1, Math.round(canvas.width * k)), h = Math.max(1, Math.round(canvas.height * k));
  const small = assetShrinkTo(canvas, w, h);
  const src = small.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const W = w + 2 * pad, H = h + 2 * pad;
  const on = new Uint8Array(W * H), rgb = new Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src[i + 3] >= PIX_ALPHA) { on[(y + pad) * W + x + pad] = 1; rgb[(y + pad) * W + x + pad] = [src[i], src[i + 1], src[i + 2]]; }
  }
  const pal = palette.map(c => c.slice());
  const nearest = c => { let best = 0, d = Infinity; for (let j = 0; j < pal.length; j++) { const e = pixDist(c, pal[j]); if (e < d) { d = e; best = j; } } return [best, d]; };
  const room = Math.max(0, colours - pal.length);
  const take = shared ? Math.min(room, Math.max(4, Math.ceil(room / 3))) : room;
  const unseen = [];
  for (let i = 0; i < W * H; i++) if (on[i] && (!pal.length || nearest(rgb[i])[1] > PIX_NEAR)) unseen.push(rgb[i]);
  pal.push(...pixelMedianCut(unseen, take, split));
  const out = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = out.getContext('2d');
  if (!pal.length) return { canvas: out, palette: pal };
  const dark = pal.reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a));
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let c = null;
    if (on[i]) c = pal[nearest(rgb[i])[0]];
    else if (outline && ((x > 0 && on[i - 1]) || (x < W - 1 && on[i + 1]) || (y > 0 && on[i - W]) || (y < H - 1 && on[i + W]))) c = dark;
    if (c) img.data.set([c[0], c[1], c[2], 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return { canvas: out, palette: pal };
}
