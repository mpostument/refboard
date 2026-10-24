/* refboard - Edge tiles: one tile of ground becomes the 47 a tilemap needs to lay it in any
   shape, with rounded edges where the ground ends. Game assets, Made here, a tile's "Edges".

   A cell on the map has eight neighbours, each with the same ground or not. What matters is
   which edges (N, E, S, W) touch the same ground, and a corner only when both of its edges do:
   a corner beside a missing edge is cut off already. That leaves 47 different cells (the "blob"
   set), from a lone island to a cell inside a field with one corner bitten out.

   Each cell is the tile cut to the shape its neighbours leave. The boundary lies `d` in from a
   side that has no neighbour; where two such sides meet the corner is rounded (radius `r`); a
   corner bitten out of a field is a quarter circle of radius `d` - which is exactly the radius
   that meets the straight edges of the two cells beside it with no step, so the pieces join
   into one outline on the map. The edge can get a darker rim, and for the pixel look the shape
   is cut hard (no half-covered pixels).

   The sheet is 8 cells wide, the cells in the order of AUTO_MASKS; the text beside it says which
   neighbours each cell is for, so a Rule Tile (Unity) can be filled without guessing. One of the
   classic scripts index.html loads in order; see the note there. */
"use strict";

// The neighbours of a cell as bits.
const AUTO_BIT = { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 };
const AUTO_COLS = 8;
const AUTO_INSET = 0.14;     // of the tile: how far in the ground ends from a side with no neighbour
const AUTO_ROUND = 0.22;     // of the tile: the radius of a corner where two such sides meet
const AUTO_RIM = 0.55;       // how far the rim is darkened toward black

/* A neighbour mask without the corners that cannot matter. */
function autoReduce(mask) {
  let m = mask & 0b01010101;   // the four edges: N, E, S, W
  for (const [c, a, b] of [['NE', 'N', 'E'], ['SE', 'S', 'E'], ['SW', 'S', 'W'], ['NW', 'N', 'W']]) {
    if ((mask & AUTO_BIT[c]) && (m & AUTO_BIT[a]) && (m & AUTO_BIT[b])) m |= AUTO_BIT[c];
  }
  return m;
}
// The 47, smallest mask first: 0 is the lone island, 255 the cell in the middle of a field.
const AUTO_MASKS = [...new Set(Array.from({ length: 256 }, (_, i) => autoReduce(i)))].sort((a, b) => a - b);

/* How far inside the shape each pixel of a size x size cell is, in pixels (negative: outside).
   The cell is read a quarter at a time; each quarter looks at its two sides and its corner. */
function autoField(mask, size, inset = AUTO_INSET, round = AUTO_ROUND) {
  const d = inset * size, r = round * size, cx = d + r, out = new Float32Array(size * size), half = size / 2;
  const has = k => !!(mask & AUTO_BIT[k]);
  for (let y = 0; y < size; y++) {
    const south = y + 0.5 >= half, u = south ? size - y - 0.5 : y + 0.5;     // across to the north or south side
    const v = has(south ? 'S' : 'N');
    for (let x = 0; x < size; x++) {
      const east = x + 0.5 >= half, w = east ? size - x - 0.5 : x + 0.5;     // across to the west or east side
      const h = has(east ? 'E' : 'W');
      let s;
      if (!v && !h) s = (u < cx && w < cx) ? r - Math.hypot(u - cx, w - cx) : Math.min(u, w) - d;
      else if (!v) s = u - d;
      else if (!h) s = w - d;
      else s = has((south ? 'S' : 'N') + (east ? 'E' : 'W')) ? size : Math.hypot(u, w) - d;
      out[y * size + x] = s;
    }
  }
  return out;
}

/* The tile (a square canvas) as the cell for `mask`. hard: whole pixels, for the pixel look.
   rim: a darker line round the ground, this many pixels wide (0 for none). */
function autoCell(tile, mask, { hard = false, rim } = {}) {
  const size = tile.width, out = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = out.getContext('2d', { willReadFrequently: true });
  g.drawImage(tile, 0, 0);
  const img = g.getImageData(0, 0, size, size), p = img.data, f = autoField(mask, size);
  const line = rim ?? Math.max(1, Math.round(size / 64));
  for (let i = 0; i < f.length; i++) {
    const s = f[i];
    let a = hard ? (s >= 0 ? 1 : 0) : Math.min(1, Math.max(0, s + 0.5));
    if (s < line && s >= -0.5 && line > 0) {    // the rim, from the edge inward
      const k = AUTO_RIM * (hard ? 1 : Math.min(1, Math.max(0, line - s)));
      for (let c = 0; c < 3; c++) p[i * 4 + c] = Math.round(p[i * 4 + c] * (1 - k));
    }
    p[i * 4 + 3] = Math.round(p[i * 4 + 3] * a);
  }
  g.putImageData(img, 0, 0);
  return out;
}

/* All 47 on one sheet, AUTO_COLS across, nothing between the cells (Unity cuts it by cell size). */
function autoSheet(tile, opts) {
  const size = tile.width, rows = Math.ceil(AUTO_MASKS.length / AUTO_COLS);
  const sheet = Object.assign(document.createElement('canvas'), { width: size * AUTO_COLS, height: size * rows });
  const g = sheet.getContext('2d');
  g.imageSmoothingEnabled = false;
  AUTO_MASKS.forEach((m, i) => g.drawImage(autoCell(tile, m, opts), (i % AUTO_COLS) * size, Math.floor(i / AUTO_COLS) * size));
  return sheet;
}

/* Which neighbours each cell is for, as plain text: the cell's place on the sheet (column, row,
   from 0, left to right and top to bottom) and the sides that have the same ground. */
function autoMapText(name, size) {
  const lines = [
    `${name} - ${AUTO_MASKS.length} edge tiles, ${AUTO_COLS} across, each ${size} x ${size} px.`,
    'Neighbour bits: N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128 - a bit is set where the cell next to this one has the same ground.',
    'A corner counts only when both its sides are set. Mask 255 is a cell in the middle of a field, 0 a lone island.', '',
  ];
  AUTO_MASKS.forEach((m, i) => {
    const sides = Object.keys(AUTO_BIT).filter(k => m & AUTO_BIT[k]).join(' ') || 'none';
    lines.push(`col ${i % AUTO_COLS} row ${Math.floor(i / AUTO_COLS)}  mask ${String(m).padStart(3)}  ground on: ${sides}`);
  });
  return lines.join('\n') + '\n';
}
