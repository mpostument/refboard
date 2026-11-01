/* refboard - Painting check: where a photo of your painting parts from the reference in
   value, in warmth and in how strong the colour is. Compare your drawing (study.js) lays
   the photo over the reference to see the lines; this reads the tones.

   A phone photo is never lit like the reference, so before anything is compared the
   photo's overall lightness and colour cast are moved to the reference's (the mean
   difference over the part the two share, in OKLab). What is left is where the painting
   is darker, warmer or greyer than what it was painted from - not a dim room. The map is
   then softened by a few cells, so that brushwork does not read as error, only a
   passage that is.

   Three questions, each its own map:
     tones   value (OKLab L): darker (blue) or lighter (orange);
     warmth  towards orange-red or away from it: warmer (red) or cooler (teal);
     colour  chroma: stronger (magenta) or greyer (grey-green).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// The longest side the two pictures are compared at: a passage is what matters, not a pixel.
const PC_SIDE = 120;
// How far off, in each channel, a place must be to be marked (L is 0..1, so 0.06 is six value steps of a hundred).
const PC_MIN = { tones: 0.06, warmth: 0.035, colour: 0.035 };
// Where a channel is drawn at full strength.
const PC_FULL = { tones: 0.22, warmth: 0.12, colour: 0.12 };
const PC_CHANNELS = {
  tones: { key: 'dL', label: 'Value', neg: ['darker', [50, 110, 255]], pos: ['lighter', [255, 160, 40]], unit: 100, unitName: 'steps of 100' },
  warmth: { key: 'dW', label: 'Warmth', neg: ['cooler', [30, 200, 215]], pos: ['warmer', [255, 70, 55]], unit: 100, unitName: '' },
  colour: { key: 'dC', label: 'Colour', neg: ['greyer', [110, 160, 120]], pos: ['stronger', [235, 50, 200]], unit: 100, unitName: '' },
};
const PC_ZONES = ['top left', 'top', 'top right', 'left', 'the middle', 'right', 'bottom left', 'bottom', 'bottom right'];
// Orange-red in OKLab a/b (hue about 60 degrees): "warm" is how far a colour lies along it.
const PC_WARM = [0.5, 0.866];

const pcLin = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// One pixel's OKLab [L, a, b] (Ottosson's matrices), from sRGB bytes.
function pcLab(r, g, b) {
  const R = pcLin[r], G = pcLin[g], B = pcLin[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

// A box blur of radius r over a w x h float field, from an integral image.
function pcSoften(F, w, h, r) {
  const W = w + 1, s = new Float64Array(W * (h + 1)), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let a = 0;
    for (let x = 0; x < w; x++) { a += F[y * w + x]; s[(y + 1) * W + x + 1] = s[y * W + x + 1] + a; }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      out[y * w + x] = (s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/* The reference and the painting, both RGBA bytes of w x h (a painting pixel with alpha under 250
   is off the photo and is not compared). Gives the three difference fields (painting minus reference,
   after the overall light and cast are matched, softened), the mask of what was compared, and the
   offsets that were taken out. null when the two share nothing. */
function paintingDiff(ref, paint, w, h) {
  const n = w * h, mask = new Uint8Array(n);
  const rl = new Float32Array(n * 3), pl = new Float32Array(n * 3);
  let cnt = 0;
  const off = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (paint[i * 4 + 3] < 250) continue;
    mask[i] = 1; cnt++;
    const a = pcLab(ref[i * 4], ref[i * 4 + 1], ref[i * 4 + 2]), b = pcLab(paint[i * 4], paint[i * 4 + 1], paint[i * 4 + 2]);
    for (let c = 0; c < 3; c++) { rl[i * 3 + c] = a[c]; pl[i * 3 + c] = b[c]; off[c] += b[c] - a[c]; }
  }
  if (cnt < 25) return null;
  for (let c = 0; c < 3; c++) off[c] /= cnt;
  const dL = new Float32Array(n), dW = new Float32Array(n), dC = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const j = i * 3;
    const da = pl[j + 1] - rl[j + 1] - off[1], db = pl[j + 2] - rl[j + 2] - off[2];
    dL[i] = pl[j] - rl[j] - off[0];
    dW[i] = PC_WARM[0] * da + PC_WARM[1] * db;
    // Chroma: the painting's against the reference's, with the cast matched first.
    dC[i] = Math.hypot(pl[j + 1] - off[1], pl[j + 2] - off[2]) - Math.hypot(rl[j + 1], rl[j + 2]);
  }
  // Off the photo, a cell would blur to zero and drag its neighbours toward "no difference": only masked cells count.
  const soft = F => {
    const num = pcSoften(F, w, h, Math.max(1, Math.round(Math.max(w, h) / 40)));
    const den = pcSoften(Float32Array.from(mask), w, h, Math.max(1, Math.round(Math.max(w, h) / 40)));
    for (let i = 0; i < n; i++) num[i] = mask[i] && den[i] > 0 ? num[i] / den[i] : 0;
    return num;
  };
  return { w, h, mask, dL: soft(dL), dW: soft(dW), dC: soft(dC), offsets: { tones: off[0], warmth: PC_WARM[0] * off[1] + PC_WARM[1] * off[2], colour: 0 }, share: cnt / n };
}

/* The map of one channel as RGBA bytes, w x h: blue where the painting is darker and orange where it
   is lighter (and so on, PC_CHANNELS), stronger the farther off, nothing under PC_MIN. */
function paintingMap(diff, channel) {
  const ch = PC_CHANNELS[channel], F = diff[ch.key], min = PC_MIN[channel], full = PC_FULL[channel];
  const out = new Uint8ClampedArray(diff.w * diff.h * 4);
  for (let i = 0; i < F.length; i++) {
    const d = F[i];
    if (!diff.mask[i] || Math.abs(d) < min) continue;
    const c = (d < 0 ? ch.neg : ch.pos)[1], k = Math.min(1, (Math.abs(d) - min) / (full - min));
    out.set([c[0], c[1], c[2], Math.round(110 + 120 * k)], i * 4);
  }
  return out;
}

/* What the map says, in a sentence: for each of the nine zones of the picture the mean difference
   (only zones with a fifth of their cells compared), the largest two over PC_MIN named, with how much.
   `matched` mentions the overall light or cast that was taken out first. */
function paintingNote(diff, channel) {
  const ch = PC_CHANNELS[channel], F = diff[ch.key], min = PC_MIN[channel], { w, h } = diff;
  const sum = new Float64Array(9), cells = new Int32Array(9), total = new Int32Array(9);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const z = Math.min(2, Math.floor(y * 3 / h)) * 3 + Math.min(2, Math.floor(x * 3 / w)), i = y * w + x;
    total[z]++;
    if (diff.mask[i]) { sum[z] += F[i]; cells[z]++; }
  }
  const zones = [];
  for (let z = 0; z < 9; z++) if (cells[z] >= total[z] * 0.2) zones.push({ z, d: sum[z] / cells[z] });
  const off = zones.filter(o => Math.abs(o.d) >= min).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2);
  const matched = Math.abs(diff.offsets[channel]) >= min / 2
    ? ` (Your photo was ${Math.round(Math.abs(diff.offsets[channel]) * 100)} ${channel === 'tones' ? (diff.offsets.tones < 0 ? 'darker' : 'lighter') : (diff.offsets.warmth < 0 ? 'cooler' : 'warmer')} overall - taken out first, so a dim room does not count.)` : '';
  if (!off.length) return `${ch.label}: within a hair of the reference everywhere.${matched}`;
  return `${ch.label}: ` + off.map(o => `${o.d < 0 ? ch.neg[0] : ch.pos[0]} at ${PC_ZONES[o.z]} (${Math.round(Math.abs(o.d) * 100)})`).join(', ') + '.' + matched;
}

/* The painting of `drawing` (study.js: the photo's Image, and where it sits over the reference: t, s, a, in
   the reference's pixels) read in the reference's frame at PC_SIDE, with the reference `refImg`; the
   difference, or null. DOM only for the two canvases. */
function paintingCompare(drawing, refImg) {
  const W = refImg.naturalWidth, H = refImg.naturalHeight;
  if (!W || !H || !drawing.img) return null;
  const k = PC_SIDE / Math.max(W, H), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const a = mk(), ag = a.getContext('2d', { willReadFrequently: true }), b = mk(), bg = b.getContext('2d', { willReadFrequently: true });
  ag.imageSmoothingQuality = bg.imageSmoothingQuality = 'high';
  ag.drawImage(refImg, 0, 0, w, h);
  // p = t + s * R(a) * d, in reference pixels; the canvas is k times smaller.
  const { s, a: ang, t } = drawing, cos = Math.cos(ang), sin = Math.sin(ang);
  bg.setTransform(k * s * cos, k * s * sin, -k * s * sin, k * s * cos, k * t[0], k * t[1]);
  bg.drawImage(drawing.img, 0, 0);
  const diff = paintingDiff(ag.getImageData(0, 0, w, h).data, bg.getImageData(0, 0, w, h).data, w, h);
  return diff;
}

// The map of a channel as a PNG blob URL at the comparison's size (the stage scales it up).
function paintingMapUrl(diff, channel) {
  const c = document.createElement('canvas');
  c.width = diff.w; c.height = diff.h;
  c.getContext('2d').putImageData(new ImageData(paintingMap(diff, channel), diff.w, diff.h), 0, 0);
  return c.toDataURL('image/png');
}
