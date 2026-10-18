/* refboard - Digitise your work: a phone photo of a sketchbook page turned into a clean scan.
   Two things a scanner does and a phone does not, done here in the browser:

   1. Straighten. You click the page's four corners on the photo (top left, top right,
      bottom right, bottom left); the quadrilateral between them is stretched back to a
      rectangle (a projective map - the one a camera makes of a flat sheet seen at an angle),
      each output pixel read from the photo by bilinear sampling.
   2. Flatten the light. The paper under the marks is estimated: the photo is cut into blocks,
      and in each the brightest fifth of the pixels (the paper between the marks, not the
      marks) is averaged. That is smoothed from block to block, and every pixel is divided
      by it, channel by channel - so a shadow across the page, the lamp's yellow and a phone's
      white balance all go with the paper, which comes out white; the marks keep their
      strength relative to it. A line drawing uses small blocks (a pencil line is thin, so
      every block has paper in it); a painting uses large ones, so a wash wider than a block
      is not taken for paper and bleached.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const SCAN_MAX_IN = 3000;    // the photo is read at most this large on its longest side
const SCAN_MAX_OUT = 2400;   // and the scan is at most this large
const SCAN_WHITE = 252;      // what the paper is made
// Block sizes as a fraction of the longest side: a line drawing, a painting.
const SCAN_BLOCK = { drawing: 1 / 30, painting: 1 / 4 };

/* The map from the unit square to the quadrilateral `p` ([[x, y] x 4]: the corners of (0,0), (1,0),
   (1,1), (0,1)), as [a, b, c, d, e, f, g, h]: x = (a u + b v + c) / (g u + h v + 1), y = (d u + e v + f) / (...).
   Heckbert's square-to-quad. */
function scanHomography(p) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0];
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

// The size a scan of the quadrilateral should have: the mean of each pair of opposite edges, scaled to SCAN_MAX_OUT at most.
function scanSize(p) {
  const d = (a, b) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);
  let w = (d(0, 1) + d(3, 2)) / 2, h = (d(0, 3) + d(1, 2)) / 2;
  const k = Math.min(1, SCAN_MAX_OUT / Math.max(w, h));
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}

/* The quadrilateral `p` of an RGBA picture {data, width, height}, drawn out w x h: RGBA bytes. */
function scanWarp(src, p, w, h) {
  const H = scanHomography(p), out = new Uint8ClampedArray(w * h * 4), { data, width, height } = src;
  const px = (x, y, c) => data[(Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4 + c];
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h;
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w, z = H[6] * u + H[7] * v + 1;
      const x = (H[0] * u + H[1] * v + H[2]) / z - 0.5, y = (H[3] * u + H[4] * v + H[5]) / z - 0.5;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = (j * w + i) * 4;
      for (let c = 0; c < 3; c++)
        out[o + c] = (px(x0, y0, c) * (1 - fx) + px(x0 + 1, y0, c) * fx) * (1 - fy) + (px(x0, y0 + 1, c) * (1 - fx) + px(x0 + 1, y0 + 1, c) * fx) * fy;
      out[o + 3] = 255;
    }
  }
  return out;
}

/* The paper under the marks, as a grid of colours: for each block of `block` pixels the mean of the
   brightest fifth of its pixels. Returns { nx, ny, grid } (Float32Array nx*ny*3). */
function scanPaperGrid(data, w, h, block) {
  const nx = Math.max(1, Math.ceil(w / block)), ny = Math.max(1, Math.ceil(h / block)), grid = new Float32Array(nx * ny * 3);
  for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) {
    const px = [];
    for (let y = by * block; y < Math.min(h, (by + 1) * block); y += 2) for (let x = bx * block; x < Math.min(w, (bx + 1) * block); x += 2) {
      const o = (y * w + x) * 4;
      px.push([0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2], data[o], data[o + 1], data[o + 2]]);
    }
    px.sort((a, b) => b[0] - a[0]);
    const top = px.slice(0, Math.max(1, Math.ceil(px.length / 5))), g = (by * nx + bx) * 3;
    for (let c = 0; c < 3; c++) grid[g + c] = top.reduce((s, q) => s + q[c + 1], 0) / top.length;
  }
  return { nx, ny, grid };
}

/* The picture flattened in place: divided by the paper (smoothly between block centres), the paper
   made SCAN_WHITE. `kind`: 'drawing' or 'painting' (SCAN_BLOCK). Returns the data. */
function scanFlatten(data, w, h, kind = 'drawing') {
  const block = Math.max(8, Math.round(Math.max(w, h) * (SCAN_BLOCK[kind] || SCAN_BLOCK.drawing)));
  const { nx, ny, grid } = scanPaperGrid(data, w, h, block);
  for (let y = 0; y < h; y++) {
    // The position in the grid of block centres, and the two rows it lies between.
    const gy = Math.min(ny - 1, Math.max(0, y / block - 0.5)), y0 = Math.floor(gy), y1 = Math.min(ny - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(nx - 1, Math.max(0, x / block - 0.5)), x0 = Math.floor(gx), x1 = Math.min(nx - 1, x0 + 1), fx = gx - x0;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const at = (xx, yy) => grid[(yy * nx + xx) * 3 + c];
        const paper = Math.max(20, (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy);
        data[o + c] = Math.min(255, data[o + c] * SCAN_WHITE / paper);
      }
    }
  }
  return data;
}

/* The scan: `img` (an Image, or any canvas source with width / height) with the page's corners `pts`
   (natural pixels, tl tr br bl) straightened and flattened. A canvas. */
function scanPage(img, pts, kind) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, SCAN_MAX_IN / Math.max(W, H));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const src = g.getImageData(0, 0, c.width, c.height), p = pts.map(([x, y]) => [x * k, y * k]);
  const [w, h] = scanSize(p), out = document.createElement('canvas');
  out.width = w; out.height = h;
  const data = scanWarp(src, p, w, h);
  scanFlatten(data, w, h, kind);
  out.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  return out;
}
