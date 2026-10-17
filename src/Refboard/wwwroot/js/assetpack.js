/* Game assets, phase 7: what Unity loads. The sprites made in Assets are packed into one sheet (Unity's
   Sprite Editor cuts it again: Slice, Automatic - the empty pixels between pictures are what it cuts
   along), every picture is a file of its own for a Tile Palette or a prefab, and all of it is one zip.
   The functions here take sizes and names and give numbers and names - the canvases and the zip are
   put together in assets.js - so that they can be tried without a picture. */

const PACK_PAD = 2;   // empty pixels between two pictures: a scaled sprite does not pull in its neighbour's edge

/* `sizes` ([{ w, h }]) laid out in rows on a sheet of a power-of-two width and height, the smallest
   by area that holds them with `pad` between. Tall ones go first so that a row is as high as its
   first picture. Returns { w, h, at: [{ x, y }] } with `at` in the order of `sizes`. */
function packRects(sizes, pad = PACK_PAD) {
  if (!sizes.length) return { w: 0, h: 0, at: [] };
  const order = sizes.map((s, i) => i).sort((a, b) => sizes[b].h - sizes[a].h || sizes[b].w - sizes[a].w);
  const widest = Math.max(...sizes.map(s => s.w + 2 * pad));
  const pow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
  let best = null;
  for (let w = pow2(widest); w <= 8192; w *= 2) {
    const at = new Array(sizes.length);
    let x = pad, y = pad, row = 0;
    for (const i of order) {
      const s = sizes[i];
      if (x + s.w + pad > w) { x = pad; y += row + pad; row = 0; }
      at[i] = { x, y };
      x += s.w + pad; row = Math.max(row, s.h);
    }
    const h = pow2(y + row + pad);
    if (!best || w * h < best.w * best.h) best = { w, h, at };
    if (h <= w) break;   // wider only makes the sheet bigger
  }
  return best;
}

/* A file name for a picture: letters, digits, dash, underscore; the same name asked twice gets
   -2, -3 ... so that no frame in an atlas, and no file in a zip, overwrites another. */
function packNames(names) {
  const seen = new Map();
  return names.map(n => {
    const base = String(n || 'asset').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'asset';
    const k = (seen.get(base) || 0) + 1;
    seen.set(base, k);
    return k === 1 ? base : `${base}-${k}`;
  });
}
