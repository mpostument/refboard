/* Game assets, phase 7: what a game engine loads. The pictures made in Assets are packed into one
   sheet, with an atlas that says where each one is (Phaser's "JSON Hash", which Godot and most
   engines have an importer for), the tiles into a Tiled tile set, and all of it into one zip.
   The functions here take sizes and names and give numbers and text - the canvases and the zip are
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

/* Phaser's JSON Hash atlas: one frame per picture, by name. `items` is [{ name, w, h }], `at` the
   places packRects gave, `image` the sheet's file name. */
function atlasJson(items, at, sheet, image) {
  const frames = {};
  items.forEach((it, i) => {
    frames[it.name] = { frame: { x: at[i].x, y: at[i].y, w: it.w, h: it.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h }, sourceSize: { w: it.w, h: it.h } };
  });
  return JSON.stringify({ frames, meta: { app: 'Refboard', image, format: 'RGBA8888', size: { w: sheet.w, h: sheet.h }, scale: '1' } }, null, 2);
}

const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* A Tiled tile set (.tsx) over one image of tiles laid in rows of `columns`: all of one size, as
   Tiled wants, and each tile's name kept as a property. */
function tilesetTsx(names, size, columns, image) {
  const rows = Math.ceil(names.length / columns);
  const tiles = names.map((n, i) => `  <tile id="${i}"><properties><property name="name" value="${xmlEsc(n)}"/></properties></tile>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<tileset version="1.10" tiledversion="1.10.2" name="tiles" tilewidth="${size}" tileheight="${size}" tilecount="${names.length}" columns="${columns}">\n` +
    ` <image source="${xmlEsc(image)}" width="${columns * size}" height="${rows * size}"/>\n${tiles}\n</tileset>\n`;
}
