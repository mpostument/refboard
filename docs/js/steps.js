/* refboard - Reading a picture: the shared helpers the pencil-grades and generate checks work from
   (a box blur, Otsu's threshold, and the picture read once at a working size).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// The long side the picture is read at: small enough to be quick.
const STEPS_SIDE = 560;

// Three passes of a box blur, near enough a Gaussian of radius r.
function stepsBlur(src, w, h, r) {
  r = Math.max(1, Math.round(r));
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {                 // rows
      let acc = 0; const o = y * w;
      for (let x = -r; x <= r; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[o + x] = acc / (2 * r + 1);
        acc += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {                 // columns
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

// Otsu: the lightness (0-100) that best splits the values given into two
// groups - the darker ones and the lighter ones.
function stepsOtsu(vals, lo = 0, hi = 100) {
  const bins = new Float64Array(101);
  let n = 0;
  for (const v of vals) if (v >= lo && v <= hi) { bins[Math.round(v)]++; n++; }
  if (!n) return (lo + hi) / 2;
  let sum = 0;
  for (let i = 0; i <= 100; i++) sum += i * bins[i];
  let wB = 0, sumB = 0, best = -1, t = (lo + hi) / 2;
  for (let i = 0; i <= 100; i++) {
    wB += bins[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * bins[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; t = i + 0.5; }
  }
  return t;
}

/* The picture read once: its pixels at STEPS_SIDE, and their lightness
   (L*, 0-100). */
function stepsRead(img) {
  const s = Math.min(1, STEPS_SIDE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * s));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.drawImage(img, 0, 0, w, h);
  const rgba = g.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  for (let i = 0; i < w * h; i++) {
    const Y = 0.2126 * lin(rgba[4 * i]) + 0.7152 * lin(rgba[4 * i + 1]) + 0.0722 * lin(rgba[4 * i + 2]);
    L[i] = Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }
  return { w, h, rgba, L, img };
}
