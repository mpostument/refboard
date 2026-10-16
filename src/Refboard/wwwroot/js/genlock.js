/* Generate's "Keep to the palette": the picture the model made, recoloured so
   that every colour in it is one of a palette's - your palette from Palettes,
   or the tubes of the Holbein box.

   Words in a prompt only nudge a model ("limited palette, blue theme"); it
   still paints the teal it likes. So the lock works on the finished picture.
   Each coloured pixel takes the HUE and CHROMA of the palette colour nearest
   to it, and keeps its own LIGHTNESS - so the drawing, its shading and the
   white of the eyes stay, and only the colours are yours. Greys (outlines,
   white, shadow) have no hue to move and are left alone.

   "Nearest" weighs the hue difference against the lightness difference: a
   dark red pixel goes to the palette's dark red if it has one, not to its
   pink. Works in OKLCH (rgbOklch / lchRgb in js/train.js), where a step in
   hue looks like the same step everywhere. */

const GEN_LOCK_GREY = 0.025;   // OKLCH chroma under which a pixel is grey and stays
const GEN_LOCK_LSTEPS = 256;   // lightness levels in the lookup table

// The palette as [L, C, h] of its coloured entries (a grey one has no hue to give).
function genLockColours(rgbs) {
  return rgbs.map(rgbOklch).filter(c => c[1] >= GEN_LOCK_GREY);
}

/* A table, per palette colour, of the sRGB of its hue and chroma at each of
   GEN_LOCK_LSTEPS lightnesses - built once, so a megapixel is a lookup and
   not a million gamut searches. lchRgb pulls the chroma in where the screen
   cannot show it (a saturated blue at high lightness). */
function genLockTable(colours) {
  return colours.map(([, C, h]) => {
    const t = new Uint8ClampedArray(GEN_LOCK_LSTEPS * 3);
    for (let i = 0; i < GEN_LOCK_LSTEPS; i++) t.set(lchRgb(i / (GEN_LOCK_LSTEPS - 1), C, h), i * 3);
    return t;
  });
}

/* `data` is ImageData's Uint8ClampedArray, changed in place. `pull` is how far
   the lightness moves toward the palette colour's own (0: keep the picture's
   shading; 1: the palette's flat tones) - a little, so a palette of dark and
   light tones is felt. A pixel keeps its own softness too: its chroma is
   the palette colour's, but never more than 1.25 times its own - a tube's
   full strength on blonde hair made it orange. Returns how many pixels were recoloured, or -1 when
   the palette has no colour (all grey) and nothing could be done. */
function genLockPixels(data, rgbs, pull = 0.2) {
  const colours = genLockColours(rgbs);
  if (!colours.length) return -1;
  const table = genLockTable(colours);
  const n = colours.length;
  // Grey at each lightness: a pixel less coloured than its palette colour is
  // that colour mixed with this grey.
  const grey = new Uint8ClampedArray(GEN_LOCK_LSTEPS * 3);
  for (let i = 0; i < GEN_LOCK_LSTEPS; i++) grey.set(lchRgb(i / (GEN_LOCK_LSTEPS - 1), 0, 0), i * 3);
  let changed = 0;
  for (let p = 0; p < data.length; p += 4) {
    const [L, C, h] = rgbOklch([data[p], data[p + 1], data[p + 2]]);
    if (C < GEN_LOCK_GREY) continue;
    let best = 0, bestCost = Infinity;
    for (let j = 0; j < n; j++) {
      const dh = Math.abs(((h - colours[j][2] + 540) % 360) - 180) / 180; // 0 same hue .. 1 opposite
      // A faint colour has an unreliable hue: let lightness decide more.
      const w = Math.min(1, C / 0.1);
      const cost = dh * (0.4 + 0.6 * w) + Math.abs(L - colours[j][0]) * 0.6;
      if (cost < bestCost) { bestCost = cost; best = j; }
    }
    const L2 = L + (colours[best][0] - L) * pull;
    const i = Math.round(Math.min(Math.max(L2, 0), 1) * (GEN_LOCK_LSTEPS - 1)) * 3;
    const s = Math.min(1, C * 1.25 / colours[best][1]);
    for (let k = 0; k < 3; k++) data[p + k] = grey[i + k] + s * (table[best][i + k] - grey[i + k]);
    changed++;
  }
  return changed;
}

// The Holbein box's tubes as RGB - every pigment that has a tube position.
function genBoxRgbs() {
  if (typeof PIGMENTS === 'undefined') return [];
  return Object.values(PIGMENTS).filter(p => p.tube && /^#[0-9a-f]{6}$/i.test(p.hex))
    .map(p => [1, 3, 5].map(i => parseInt(p.hex.slice(i, i + 2), 16)));
}

// The palette the choices lock to, or [] for none.
function genLockPalette(choices) {
  return choices.colours === 'palette' ? (choices.palette || []) : choices.colours === 'box' ? genBoxRgbs() : [];
}

/* A picture's blob recoloured to the palette, as a PNG blob; null when the
   palette has no colour to give. Drawn at the picture's own size. */
async function genLockBlob(blob, rgbs) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImg(url);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    if (genLockPixels(d.data, rgbs) < 0) return null;
    g.putImageData(d, 0, 0);
    return await new Promise(res => c.toBlob(res, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
