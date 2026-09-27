/* refboard - The colour studio.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ------------------------------------------------------------ colour studio
   The colour questions a painter asks of a picture, answered from its pixels:
   what are its colours (a palette, found by clustering), where do they sit
   (a colour wheel with every pixel on it), how saturated is it really (most
   photos are far greyer than they look - the wheel shows it at a glance),
   and does its value hold up without colour (each palette colour beside its
   grey, and a warning where two different colours are the same value).

   And the gamut mask, James Gurney's tool: a shape laid over the wheel that
   says which colours a painting may use. Everything outside it is out, and
   the picture repainted inside it shows what that choice does - a triad, a
   complementary pair, a limited "atmospheric" palette - before a brush
   touches paint. The wheel is OKLCH at one lightness: hue round it, chroma
   out from the grey centre. Chroma past COL_CMAX sits on the rim.

   And the paints: a palette of real tubes (paint.js - a full palette, Zorn's
   four, the earths...) drawn on the wheel as the outline of every colour it
   can mix, so what it cannot reach in this picture is plain to see before
   the picture is started; and under each colour of the image, how to mix it
   from those tubes.

   Everything happens here in the browser; the image never leaves it. */
const COLOUR_KEY = 'refboard.colour.v1';
const COL_CMAX = 0.25;      // OKLCH chroma at the wheel's rim
const COL_WHEEL_L = 0.72;   // the lightness the wheel itself is painted at
const COL_WORK_EDGE = 720;  // long edge the image is worked on at
const COL_K = 6;            // palette size
// [hue°, radius 0..1] - a shape at rest; dragging it turns it round the wheel.
const COL_MASKS = {
  triad: { label: 'Triad', pts: [[40, 0.95], [160, 0.95], [280, 0.95]],
    hint: 'Three hues a third of the way round from each other, and every mixture between them.' },
  comp: { label: 'Complementary', pts: [[60, 0.95], [150, 0.2], [240, 0.95], [330, 0.2]],
    hint: 'Two opposite hues at full strength, and the greys that mixing them makes - little else.' },
  atmos: { label: 'Atmospheric', pts: [[25, 0.95], [95, 0.7], [220, 0.28]],
    hint: 'One family of hues, warm here, with a hint of its opposite near grey - the limited palette of a mood or a time of day.' },
  split: { label: 'Split', pts: [[50, 0.95], [205, 0.75], [255, 0.75]],
    hint: 'One hue against the two either side of its complement - contrast, without the clash of a direct pair.' },
};

// Lookup tables: a per-pixel pow() is what makes repainting slow.
const COL_TO_LIN = Float32Array.from({ length: 256 }, (_, i) => srgbToLin(i / 255));
const COL_TO_SRGB = Uint8ClampedArray.from({ length: 4097 }, (_, i) => Math.round(linToSrgb(i / 4096) * 255));
const colByte = v => COL_TO_SRGB[Math.round(clamp01(v) * 4096)];

let col = null; // the studio's state; null until first opened

function loadColourPrefs() {
  try { const v = JSON.parse(localStorage.getItem(COLOUR_KEY)); if (v && typeof v === 'object') return v; } catch {}
  return {};
}
function saveColourPrefs() {
  try { localStorage.setItem(COLOUR_KEY, JSON.stringify({ mode: col.mode, mask: col.mask })); } catch {}
}

/* ---- the mask's geometry, in wheel units: [a, b] / COL_CMAX, so the rim
   is radius 1 and a point's angle is its OKLCH hue. */
function colPolarToPt([h, r]) { const a = h * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }
function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nearestOnPolygon([x, y], poly) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    const px = ax + t * dx, py = ay + t * dy, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}

/* Where a colour outside the mask goes when the picture is repainted inside
   it. Called only for points already known to be outside `poly`; must return
   a point inside it or on its edge. Lightness is not this function's
   business - it stays exactly as it was, which is what keeps the drawing.

   The nearest point on the mask's edge is the smallest possible change, but
   it will happily trade hue for chroma: a red just outside a mask that
   stops short of red comes back orange. The alternative is to walk the
   colour in toward grey along its own hue until it meets the mask - it
   keeps its hue and loses intensity, which is closer to how a painter
   "knocks a colour back" - but a hue the mask does not reach at all has no
   such point, so it still needs a fallback.

   So: along its own hue first. The segment from grey (the origin) out to the
   colour crosses the mask's edge wherever the mask covers that hue; of those
   crossings the one furthest out (largest t) is the most intense version of
   this exact hue the mask allows. Only a hue the mask misses entirely falls
   back to the nearest point - there, changing hue is the only way in. */
function mapIntoGamut(pt, poly) {
  const [px, py] = pt;
  let best = -1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], ex = poly[i][0] - ax, ey = poly[i][1] - ay;
    // origin + t*pt = a + s*e, solved by cross products.
    const den = px * ey - py * ex;
    if (Math.abs(den) < 1e-12) continue;          // parallel to this edge
    const t = (ax * ey - ay * ex) / den, s = (ax * py - ay * px) / den;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best >= 0 ? [px * best, py * best] : nearestOnPolygon(pt, poly);
}

/* ---- the palette: k-means over the image's pixels in OKLab, with chroma
   weighted up - lightness alone spans most of OKLab's distances, and left
   as is every cluster would be a value step, not a colour. Seeded by
   farthest-point from the sample nearest the average, so the same image
   always gives the same palette. */
const COL_CHROMA_W = 2;
function colKmeans(pts, k) {
  const W = COL_CHROMA_W;
  const d2 = (p, q) => (p[0] - q[0]) ** 2 + W * ((p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
  const n = pts.length, mean = [0, 0, 0];
  for (const p of pts) for (let c = 0; c < 3; c++) mean[c] += p[c] / n;
  let first = pts[0];
  for (const p of pts) if (d2(p, mean) < d2(first, mean)) first = p;
  const centers = [first.slice(0, 3)], dist = pts.map(p => d2(p, first));
  while (centers.length < k) {
    let bi = 0;
    for (let i = 1; i < n; i++) if (dist[i] > dist[bi]) bi = i;
    if (dist[bi] === 0) break;
    centers.push(pts[bi].slice(0, 3));
    for (let i = 0; i < n; i++) dist[i] = Math.min(dist[i], d2(pts[i], pts[bi]));
  }
  const assign = new Int32Array(n);
  for (let it = 0; it < 14; it++) {
    const sum = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      let bc = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) { const d = d2(pts[i], centers[c]); if (d < bd) { bd = d; bc = c; } }
      assign[i] = bc;
      const s = sum[bc]; s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3]++;
    }
    sum.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const counts = centers.map(() => 0);
  for (let i = 0; i < n; i++) counts[assign[i]]++;
  return centers.map((lab, c) => {
    const rgb = oklabToLin(...lab).map(colByte);
    return { lab, rgb, share: counts[c] / n };
  // Under half a percent is the anti-aliased fringe of an edge, not a colour
  // anyone painted.
  }).filter(p => p.share >= 0.005).sort((a, b) => b.share - a.share);
}

/* Which palette colour every pixel belongs to - the nearest, by the same
   measure the palette was found with - so the picture can show where each
   one is used. */
function colAssign(lab, palette) {
  const n = lab.length / 3, out = new Uint8Array(n), W = COL_CHROMA_W;
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    let bc = 0, bd = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const q = palette[c].lab;
      const d = (lab[j] - q[0]) ** 2 + W * ((lab[j + 1] - q[1]) ** 2 + (lab[j + 2] - q[2]) ** 2);
      if (d < bd) { bd = d; bc = c; }
    }
    out[i] = bc;
  }
  return out;
}

const colHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const colChromaWord = C => C < 0.03 ? 'grey' : C < 0.08 ? 'muted' : C < 0.15 ? 'clear' : 'vivid';

async function colourLoad(src) {
  let im;
  try { im = await loadImg(src); } catch { el('colReadout').textContent = 'That image could not be read.'; return; }
  const s = Math.min(1, COL_WORK_EDGE / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(im, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  // Every pixel's OKLab once, kept: the value and in-gamut views and the
  // wheel all read from this rather than redoing the cube roots.
  const lab = new Float32Array(w * h * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const L = linToOklab(COL_TO_LIN[data[i]], COL_TO_LIN[data[i + 1]], COL_TO_LIN[data[i + 2]]);
    lab[j] = L[0]; lab[j + 1] = L[1]; lab[j + 2] = L[2];
  }
  const step = Math.max(1, Math.floor(Math.sqrt(w * h / 5000)));
  const samples = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const p = (y * w + x), q = p * 3;
    samples.push([lab[q], lab[q + 1], lab[q + 2], data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  }
  const palette = colKmeans(samples, COL_K);
  Object.assign(col, { w, h, data, lab, samples, palette, assign: colAssign(lab, palette), mapped: null, hover: null, focus: null, pin: null });
  el('colEmpty').classList.add('hidden');
  el('colImg').classList.remove('hidden');
  el('colReadout').textContent = 'Point at the image to find a colour on the wheel.';
  colourRender();
}

// The image, in the chosen view, into #colImg at its working size.
function colourRenderImage() {
  if (!col.data) return;
  const cv = el('colImg'), { w, h, data, lab } = col;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  const mode = col.mode === 'mapped' && !col.mask ? 'colour' : col.mode;
  const out = new ImageData(w, h), o = out.data;
  if (mode === 'colour') o.set(data);
  else if (mode === 'value') {
    // Relative luminance, back to sRGB: exactly the grey of each pixel's L*.
    for (let i = 0; i < data.length; i += 4) {
      const g = colByte(0.2126 * COL_TO_LIN[data[i]] + 0.7152 * COL_TO_LIN[data[i + 1]] + 0.0722 * COL_TO_LIN[data[i + 2]]);
      o[i] = o[i + 1] = o[i + 2] = g; o[i + 3] = 255;
    }
  } else {
    const key = JSON.stringify(col.mask);
    if (!col.mapped || col.mappedKey !== key) {
      const m = new Uint8ClampedArray(data.length), poly = col.mask;
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        let a = lab[j + 1], b = lab[j + 2];
        const pt = [a / COL_CMAX, b / COL_CMAX];
        if (!pointInPolygon(pt, poly)) { const q = mapIntoGamut(pt, poly); a = q[0] * COL_CMAX; b = q[1] * COL_CMAX; }
        const lin = oklabToLin(lab[j], a, b);
        m[i] = colByte(lin[0]); m[i + 1] = colByte(lin[1]); m[i + 2] = colByte(lin[2]); m[i + 3] = 255;
      }
      col.mapped = m; col.mappedKey = key;
    }
    o.set(col.mapped);
  }
  // One palette colour in focus: everywhere else sinks to a dark grey, so
  // what is left in colour is exactly where that colour is used.
  if (col.focus !== null && col.assign) {
    const f = col.focus, a = col.assign;
    for (let i = 0, p = 0; p < a.length; i += 4, p++) {
      if (a[p] === f) continue;
      const g = (o[i] * 0.3 + o[i + 1] * 0.59 + o[i + 2] * 0.11) * 0.35;
      o[i] = o[i + 1] = o[i + 2] = g;
    }
  }
  ctx.putImageData(out, 0, 0);
}

// The wheel's own colours, painted once at low resolution and scaled up -
// a gamut-clipped OKLCH per pixel is too slow to redo at screen size.
function colWheelBackground() {
  if (col.bg) return col.bg;
  const N = 160, c = N / 2, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), id = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5 - c) / c, v = (c - y - 0.5) / c, r = Math.hypot(u, v);
    if (r > 1) continue;
    const rgb = lchRgb(COL_WHEEL_L, r * COL_CMAX, Math.atan2(v, u) * 180 / Math.PI), k = (y * N + x) * 4;
    id.data[k] = rgb[0]; id.data[k + 1] = rgb[1]; id.data[k + 2] = rgb[2]; id.data[k + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return (col.bg = cv);
}

function colWheelGeom() {
  const cv = el('colWheel'), dpr = window.devicePixelRatio || 1;
  const S = Math.round(cv.clientWidth * dpr);
  if (S && cv.width !== S) { cv.width = cv.height = S; }
  const c = cv.width / 2, R = c - 10 * dpr;
  return { cv, dpr, c, R, toXY: ([u, v]) => [c + u * R, c - v * R], fromXY: (x, y) => [(x * dpr - c) / R, (c - y * dpr) / R] };
}

function colourRenderWheel() {
  const g = colWheelGeom(), { cv, dpr, c, R, toXY } = g;
  if (!cv.width) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  // Dimmed, so the image's own colours on top of it stand out.
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.clip();
  ctx.globalAlpha = 0.32; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(colWheelBackground(), c - R, c - R, 2 * R, 2 * R);
  ctx.restore();
  // Chroma rings and the hue spokes, as a scale to read positions against.
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1 * dpr;
  for (const f of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(c, c, R * f, 0, 2 * Math.PI); ctx.stroke(); }
  // Every sampled pixel, in its own colour.
  if (col.samples) {
    for (const s of col.samples) {
      const [x, y] = toXY([Math.max(-1.02, Math.min(1.02, s[1] / COL_CMAX)), Math.max(-1.02, Math.min(1.02, s[2] / COL_CMAX))]);
      ctx.fillStyle = `rgb(${s[3]},${s[4]},${s[5]})`;
      ctx.fillRect(x - 1.2 * dpr, y - 1.2 * dpr, 2.4 * dpr, 2.4 * dpr);
    }
  }
  // What the chosen paints can mix: a dashed outline.
  const reach = colReach();
  if (reach) {
    ctx.save();
    ctx.beginPath();
    reach.map(q => toXY([q[0] / COL_CMAX, q[1] / COL_CMAX])).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.restore();
  }
  // The mask: everything outside it darkened, its edge and its corners.
  if (col.mask) {
    const pts = col.mask.map(toXY);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, R + 2 * dpr, 0, 2 * Math.PI);
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.fillStyle = 'rgba(12,12,14,.62)'; ctx.fill('evenodd');
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    ctx.strokeStyle = themeVar('accent'); ctx.lineWidth = 2 * dpr; ctx.stroke();
    for (const [x, y] of pts) {
      ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = themeVar('accent'); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1 * dpr; ctx.stroke();
    }
    ctx.restore();
  }
  // The palette, each colour sized by how much of the image it covers.
  ctx.font = `600 ${10 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  (col.palette || []).forEach((p, i) => {
    const [x, y] = toXY([p.lab[1] / COL_CMAX, p.lab[2] / COL_CMAX]), r = (6 + 10 * Math.sqrt(p.share)) * dpr;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = rgbCss(p.rgb); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = (col.focus === i ? 3.5 : 1.5) * dpr; ctx.stroke();
    ctx.fillStyle = p.lab[0] > 0.62 ? '#111' : '#fff'; ctx.fillText(String(i + 1), x, y + 0.5 * dpr);
  });
  if (col.hover) {
    const [x, y] = toXY(col.hover);
    ctx.beginPath(); ctx.arc(x, y, 8 * dpr, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 10 * dpr, 0, 2 * Math.PI);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1 * dpr; ctx.stroke();
  }
}

// Each palette colour beside its grey, and the pairs that are two colours
// but one value - the ones a black-and-white study will merge.
function colourRenderPalette() {
  const pal = col.palette;
  if (!pal) return;
  el('colPalette').innerHTML = pal.map((p, i) => {
    const L = lstar(p.rgb), [, C, h] = rgbOklch(p.rgb);
    return `<div class="col-sw${col.pin === i ? ' pinned' : ''}" data-i="${i}" title="Where this colour is in the picture - click to keep it shown"><b>${i + 1}</b><i style="background:${rgbCss(p.rgb)}" title="${colHex(p.rgb)}"></i>` +
      `<i style="background:${rgbCss(greyOfLstar(L))}" title="Its value as grey"></i>` +
      `<span>${colHex(p.rgb)} · ${colChromaWord(C)}${C >= 0.03 ? ' ' + hueName(h) : ''}</span>` +
      `<b>L* ${Math.round(L)} <span>· ${Math.round(p.share * 100)}%</span></b></div>` + colMixHtml(p);
  }).join('');
  const same = [];
  for (let i = 0; i < pal.length; i++) for (let j = i + 1; j < pal.length; j++) {
    const a = pal[i], b = pal[j], la = lstar(a.rgb), lb = lstar(b.rgb);
    const [, ca, ha] = rgbOklch(a.rgb), [, cb, hb] = rgbOklch(b.rgb);
    const dh = Math.abs(((ha - hb + 540) % 360) - 180);
    if (Math.abs(la - lb) < 5 && (Math.max(ca, cb) > 0.04) && (dh > 40 || Math.abs(ca - cb) > 0.06)) same.push(`${i + 1} and ${j + 1}`);
  }
  el('colValueNote').innerHTML = same.length
    ? `<b>Same value, different colour:</b> ${same.join(', ')}. In a value study each pair is one shape - the picture separates them by colour alone.`
    : 'Every palette colour has a value of its own - the picture reads in black and white too.';
}

/* ---- the paints. The reach outline and the recipes both depend only on
   the palette of tubes (and the recipes on the image's colours), so both are
   worked out once per choice and kept - colourRender() runs on every step
   of dragging the mask. */
const colReachCache = {};
function colReach() {
  const k = col.paints + '|' + col.medium;
  if (!(k in colReachCache)) colReachCache[k] = paintReach(col.paints, col.medium);
  return colReachCache[k];
}
function colMixHtml(p) {
  const key = col.paints + '|' + col.medium;
  if (!p.mix || p.mix.key !== key) p.mix = { key, recipes: paintRecipes(p.rgb, col.paints, 3, col.medium) };
  const [best, ...more] = p.mix.recipes;
  if (!best) return '';
  if (!more.length) return `<div class="col-mix">${paintRecipeHtml(best)}</div>`;
  return `<details class="col-mix"><summary>${paintRecipeHtml(best)} <span>· ${more.length} more</span></summary>${more.map(paintRecipeHtml).join('')}</details>`;
}
function colourRenderPaints() {
  for (const b of document.querySelectorAll('[data-col-paints]')) b.setAttribute('aria-pressed', String(b.dataset.colPaints === col.paints));
  for (const b of document.querySelectorAll('[data-col-medium]')) b.setAttribute('aria-pressed', String(b.dataset.colMedium === col.medium));
  let note = PAINT_PALETTES[col.paints].hint;
  // How much of the picture these paints can reach - by pixel, on the wheel.
  const reach = colReach();
  if (reach && col.samples) {
    const poly = reach.map(q => [q[0] / COL_CMAX, q[1] / COL_CMAX]);
    const inside = col.samples.filter(s => pointInPolygon([s[1] / COL_CMAX, s[2] / COL_CMAX], poly)).length;
    const pct = Math.round(100 * inside / col.samples.length);
    note += ` Dashed on the wheel: all they can mix. ${pct}% of this picture is inside it` +
      (pct < 90 ? ' - the rest is too intense, or a hue these paints cannot make.' : '.');
  }
  el('colPaintHint').textContent = note;
}

function colourRender() {
  if (!col) return;
  colourRenderPaints();
  for (const b of document.querySelectorAll('[data-col-mode]')) b.setAttribute('aria-pressed', String(b.dataset.colMode === col.mode));
  const key = col.maskKey || null;
  for (const b of document.querySelectorAll('[data-col-mask]')) b.setAttribute('aria-pressed', String((b.dataset.colMask || null) === key));
  el('colMaskHint').textContent = col.mask
    ? (COL_MASKS[key] ? COL_MASKS[key].hint + ' ' : '') + 'Drag inside the shape to turn it, a corner to reshape it.'
    : 'A shape that limits which colours a painting may use. Pick one, then look at the image In gamut.';
  colourRenderImage();
  colourRenderWheel();
  colourRenderPalette();
}

// Coalesced to a frame: dragging the mask repaints the whole image.
let colFrame = 0;
function colourSoon() {
  if (colFrame) return;
  colFrame = requestAnimationFrame(() => { colFrame = 0; colourRender(); });
}

function initColour() {
  // The mask's outline is drawn in the theme's accent.
  document.addEventListener('refboard:theme', colourRenderWheel);
  const prefs = loadColourPrefs();
  col = { mode: ['colour', 'value', 'mapped'].includes(prefs.mode) ? prefs.mode : 'colour', mask: null, maskKey: null, paints: paintPaletteKey(), medium: paintMedium() };
  if (Array.isArray(prefs.mask) && prefs.mask.length >= 3 &&
      prefs.mask.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) col.mask = prefs.mask;
  el('colMasks').innerHTML = `<button class="chip" type="button" data-col-mask="">Off</button>` +
    Object.entries(COL_MASKS).map(([k, m]) => `<button class="chip" type="button" data-col-mask="${k}" title="${esc(m.hint)}">${m.label}</button>`).join('');

  el('colPaints').innerHTML = Object.entries(PAINT_PALETTES)
    .map(([k, p]) => `<button class="chip" type="button" data-col-paints="${k}" title="${esc(p.hint)}">${p.label}</button>`).join('');
  el('colMedium').innerHTML = Object.entries(PAINT_MEDIA)
    .map(([k, label]) => `<button class="chip" type="button" data-col-medium="${k}">${label}</button>`).join('');
  el('colMedium').addEventListener('click', e => {
    const b = e.target.closest('[data-col-medium]');
    if (!b) return;
    col.medium = b.dataset.colMedium;
    setPaintMedium(col.medium);
    el('mediumSelect').value = col.medium;
    colourRender();
  });
  el('colPaints').addEventListener('click', e => {
    const b = e.target.closest('[data-col-paints]');
    if (!b) return;
    col.paints = b.dataset.colPaints;
    // One choice of paints for the whole app - the eyedropper's too.
    setPaintPaletteKey(col.paints);
    el('paintSelect').value = col.paints;
    colourRender();
  });

  el('colModes').addEventListener('click', e => {
    const b = e.target.closest('[data-col-mode]');
    if (!b) return;
    col.mode = b.dataset.colMode; saveColourPrefs(); colourRender();
  });
  el('colMasks').addEventListener('click', e => {
    const b = e.target.closest('[data-col-mask]');
    if (!b) return;
    const k = b.dataset.colMask;
    col.maskKey = k || null;
    col.mask = k ? COL_MASKS[k].pts.map(colPolarToPt) : null;
    // Choosing a mask is asking to see what it does.
    if (k && col.mode === 'colour') col.mode = 'mapped';
    saveColourPrefs(); colourRender();
  });

  // A palette row: pointing at it shows where that colour is; a click keeps
  // it shown (and a second click, or another row, lets it go).
  const pal = el('colPalette');
  const focus = i => { if (col.focus !== i) { col.focus = i; colourRenderImage(); colourRenderWheel(); } };
  pal.addEventListener('pointerover', e => {
    const row = e.target.closest('.col-sw');
    if (row) focus(+row.dataset.i);
  });
  pal.addEventListener('pointerleave', () => focus(col.pin));
  pal.addEventListener('click', e => {
    const row = e.target.closest('.col-sw');
    if (!row) return;
    const i = +row.dataset.i;
    col.pin = col.pin === i ? null : i;
    focus(col.pin === null ? i : col.pin);
    colourRenderPalette();
  });

  const take = file => { if (file && file.type.startsWith('image/')) colourLoad(trainKeepUrl(URL.createObjectURL(file))); };
  el('colPick').addEventListener('click', () => el('colInput').click());
  el('colInput').addEventListener('change', e => { take(e.target.files[0]); e.target.value = ''; });
  el('colRandom').addEventListener('click', () => { const u = trainLibraryImage(); if (u) colourLoad(u); });
  const stage = el('colStage');
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('over'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('over'));
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('over'); take(e.dataTransfer.files[0]); });
  document.addEventListener('paste', e => {
    if (view.kind !== 'colour') return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
    if (item) take(item.getAsFile());
  });

  // Pointing at the image: that pixel's colour, and where it sits on the wheel.
  el('colImg').addEventListener('pointermove', e => {
    if (!col.lab) return;
    const r = el('colImg').getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * col.w), y = Math.floor((e.clientY - r.top) / r.height * col.h);
    if (x < 0 || y < 0 || x >= col.w || y >= col.h) return;
    const p = y * col.w + x, rgb = [col.data[p * 4], col.data[p * 4 + 1], col.data[p * 4 + 2]], j = p * 3;
    col.hover = [col.lab[j + 1] / COL_CMAX, col.lab[j + 2] / COL_CMAX];
    const [, C, h] = rgbOklch(rgb);
    const inMask = col.mask ? (pointInPolygon(col.hover, col.mask) ? ' · inside the mask' : ' · outside the mask') : '';
    el('colReadout').textContent = `${colHex(rgb)} · value L* ${Math.round(lstar(rgb))} · ${colChromaWord(C)}${C >= 0.03 ? ' ' + hueName(h) : ''} · palette ${col.assign[p] + 1}${inMask}`;
    colourRenderWheel();
  });
  el('colImg').addEventListener('pointerleave', () => { col.hover = null; colourRenderWheel(); });

  // The mask on the wheel: a corner drags that corner; inside, the whole
  // shape turns about the centre - which is how a mask is used, since the
  // shape is the harmony and where it points is the choice of hues.
  let drag = null;
  const wheel = el('colWheel');
  wheel.addEventListener('pointerdown', e => {
    if (!col.mask) return;
    const g = colWheelGeom(), r = wheel.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top, pt = g.fromXY(px, py);
    const vi = col.mask.findIndex(q => { const [x, y] = g.toXY(q); return Math.hypot(x / g.dpr - px, y / g.dpr - py) < 12; });
    if (vi >= 0) drag = { vi };
    else if (pointInPolygon(pt, col.mask)) drag = { a0: Math.atan2(pt[1], pt[0]), pts: col.mask.map(q => q.slice()) };
    else return;
    col.maskKey = drag.vi !== undefined ? null : col.maskKey;
    try { wheel.setPointerCapture(e.pointerId); } catch {}
  });
  wheel.addEventListener('pointermove', e => {
    if (!drag) return;
    const g = colWheelGeom(), r = wheel.getBoundingClientRect(), pt = g.fromXY(e.clientX - r.left, e.clientY - r.top);
    if (drag.vi !== undefined) {
      const len = Math.hypot(pt[0], pt[1]), k = len > 1 ? 1 / len : 1;
      col.mask[drag.vi] = [pt[0] * k, pt[1] * k];
    } else {
      const d = Math.atan2(pt[1], pt[0]) - drag.a0, cs = Math.cos(d), sn = Math.sin(d);
      col.mask = drag.pts.map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
    }
    colourSoon();
  });
  const end = () => { if (drag) { drag = null; saveColourPrefs(); colourSoon(); } };
  wheel.addEventListener('pointerup', end);
  wheel.addEventListener('pointercancel', end);
  window.addEventListener('resize', () => { if (view.kind === 'colour') colourRenderWheel(); });
}

function showColour() {
  if (!col) initColour();
  // Either may have been changed from the eyedropper since.
  col.paints = paintPaletteKey();
  col.medium = paintMedium();
  el('colRandom').classList.toggle('hidden', !trainLibraryImage());
  colourRender();
}
