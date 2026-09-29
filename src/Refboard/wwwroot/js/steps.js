/* refboard - How to draw it: a picture taken back to the steps it would be
   drawn in, in the order the medium is worked - for someone learning to
   copy it. Any picture, not only a generated one.

   Worked out from the finished picture rather than generated: an image
   model knows finished art, not the stages on the way to it, so asked for
   an earlier stage it draws a different picture. Computed, every frame is
   the same composition, in a second:
   - big shapes: the picture blurred hard and split in two at Otsu's
     threshold - its masses, blocked in lightly;
   - lines: XDoG (a difference of two blurs, sharpened into ink) on a copy
     small enough that fine hatching has merged into tone, so what is left
     is the contours;
   - light and shadow: two Otsu thresholds make three values; then per
     medium - hatching one way in the half-tone and across in the darkest
     for ink, flat grey for pencil, a first wash of the local colours and a
     second of the shadows for watercolour.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// The long side the frames are worked out at: small enough to be quick, and
// for fine hatching in the picture to merge into tone before the lines are
// looked for.
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

/* The subject against the paper: whatever differs from the colour round the
   picture's edge, with its holes filled - only what the edge reaches is
   background. Null where there is no paper to tell it from (a landscape),
   or no subject on it. */
function stepsSubject(p) {
  const { w, h, rgba } = p;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  const med = k => edge.map(i => rgba[4 * i + k]).sort((a, b) => a - b)[edge.length >> 1];
  const paper = [med(0), med(1), med(2)];
  const diff = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    diff[i] = Math.hypot(rgba[4 * i] - paper[0], rgba[4 * i + 1] - paper[1], rgba[4 * i + 2] - paper[2]);
  const soft = stepsBlur(diff, w, h, Math.max(w, h) / 120);
  // Background: from the edge, through whatever is near the paper's colour.
  const bg = new Uint8Array(w * h), stack = edge.filter(i => soft[i] < 18);
  for (const i of stack) bg[i] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
      if (j >= 0 && j < w * h && !bg[j] && soft[j] < 18) { bg[j] = 1; stack.push(j); }
  }
  let n = 0;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (!bg[i]) { mask[i] = 1; n++; }
  return n > 0.04 * w * h && n < 0.85 * w * h ? mask : null;
}

// The outer boundary of each part of a mask larger than minArea, as a loop
// of points - Moore-neighbour tracing, clockwise from its top-left pixel.
function stepsOutlines(mask, w, h, minArea) {
  const seen = new Uint8Array(w * h), loops = [];
  const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || seen[s]) continue;
    // The part: flooded, to know its size and never start on it twice.
    let area = 0;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w; area++;
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    if (area < minArea) continue;
    // s is the part's first pixel in scan order - top-left, so its west is
    // outside: the search starts from there (as if it had been reached
    // moving east). Done when back at the start about to take the first
    // step again - Jacob's criterion: merely passing the start, as round a
    // spur one pixel wide, is not the end.
    let x = s % w, y = (s / w) | 0, dir = 0, first = -1;
    const sx = x, sy = y, loop = [];
    for (let guard = 0; guard < 8 * w * h; guard++) {
      let d = -1;
      for (let k = 0; k < 8; k++) {
        const t = (dir + 5 + k) % 8;     // clockwise from just past where it came from
        if (at(x + DX[t], y + DY[t])) { d = t; break; }
      }
      if (d < 0) break;                  // a lone pixel
      if (x === sx && y === sy && d === first) break;
      if (first < 0) first = d;
      loop.push([x, y]);
      x += DX[d]; y += DY[d]; dir = d;
    }
    loops.push(loop);
  }
  return loops;
}

// Douglas-Peucker: the fewest points that keep a line within eps of the
// original - a contour of hundreds of points, as the few straight strokes
// that block it in.
function stepsSimplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
    if (d > far) { far = d; at = i; }
  }
  if (far <= eps) return [pts[0], pts[pts.length - 1]];
  return stepsSimplify(pts.slice(0, at + 1), eps).slice(0, -1).concat(stepsSimplify(pts.slice(at), eps));
}

// A closed loop simplified: split in two at its far point first, so the
// start does not decide the shape.
function stepsPolygon(loop, eps) {
  const half = loop.length >> 1;
  return stepsSimplify(loop.slice(0, half + 1), eps).slice(0, -1).concat(stepsSimplify(loop.slice(half), eps));
}

/* What every frame is drawn from: the masses, the lines, three values and
   the whites to save. */
function stepsAnalyse(p) {
  const { w, h, L } = p;
  // Masses: the subject against the paper, or where there is no paper the
  // darker half of the picture blurred hard - and each blocked in as a few
  // straight lines.
  const subject = stepsSubject(p);
  let mass = subject;
  if (!mass) {
    const big = stepsBlur(L, w, h, Math.max(w, h) * 0.02);
    const tBig = stepsOtsu(big);
    mass = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mass[i] = big[i] < tBig ? 1 : 0;
  }
  // Smoothed before it is traced: a spur or a speck is not a shape to block in.
  const round = stepsBlur(Float32Array.from(mass), w, h, Math.max(w, h) / 100);
  const smooth = Uint8Array.from(round, v => v > 0.5 ? 1 : 0);
  const blocks = stepsOutlines(smooth, w, h, 0.01 * w * h).map(l => stepsPolygon(l, Math.max(w, h) * 0.03));
  // Inside it, the big dark masses - hair, the shadow under a cap - blocked
  // in the same way, more lightly: the second thing looked for.
  const big = stepsBlur(L, w, h, Math.max(w, h) * 0.015);
  const inMass = []; for (let i = 0; i < w * h; i++) if (smooth[i]) inMass.push(big[i]);
  const tDark = stepsOtsu(inMass);
  const dark = Uint8Array.from(big, (v, i) => smooth[i] && v < tDark ? 1 : 0);
  const darkSmooth = Uint8Array.from(stepsBlur(Float32Array.from(dark), w, h, Math.max(w, h) / 90), v => v > 0.5 ? 1 : 0);
  const inner = stepsOutlines(darkSmooth, w, h, 0.012 * w * h).map(l => stepsPolygon(l, Math.max(w, h) * 0.022));
  // Lines: XDoG. A blur and a wider one; where the first is darker than
  // the second by more than a little, an edge on its dark side - a line.
  const s1 = Math.max(1, Math.max(w, h) / 420), g1 = stepsBlur(L, w, h, s1), g2 = stepsBlur(L, w, h, s1 * 1.6);
  const line = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const d = g1[i] - 0.98 * g2[i];
    line[i] = d < -1.2 ? Math.min(1, (-1.2 - d) / 3) : 0;
  }
  // Values: light, half-tone, darkest - on a little blur, so a hatched area
  // reads as the tone it makes rather than as its separate strokes.
  const soft = stepsBlur(L, w, h, Math.max(1.5, Math.max(w, h) / 260));
  const t1 = stepsOtsu(soft);
  const t2 = stepsOtsu(soft, 0, t1);
  const tone = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) tone[i] = soft[i] < t2 ? 2 : soft[i] < t1 ? 1 : 0;
  return { mass, blocks, inner, line, tone, whites: stepsWhites(p, subject) };
}

// A frame to draw on: paper, at the working size.
function stepsCanvas(p) {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, p.w, p.h);
  return c;
}

// Pixels onto a frame: each gets the colour fn returns, or stays as it is.
function stepsPaint(c, fn) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (let i = 0; i < c.width * c.height; i++) {
    const col = fn(i, px[4 * i], px[4 * i + 1], px[4 * i + 2]);
    if (col) { px[4 * i] = col[0]; px[4 * i + 1] = col[1]; px[4 * i + 2] = col[2]; }
  }
  g.putImageData(d, 0, 0);
  return c;
}

// Multiplies ink of a colour over what is there, by strength 0-1.
const stepsInk = (r, g, b, ink, k) => [r * (1 - k + k * ink[0] / 255), g * (1 - k + k * ink[1] / 255), b * (1 - k + k * ink[2] / 255)];

// The masses, faintly, and the straight strokes that block them in.
function stepsShapes(p, a, ink) {
  const c = stepsPaint(stepsCanvas(p), (i, r, g, b) => a.mass[i] ? stepsInk(r, g, b, ink, 0.07) : null);
  const g = c.getContext('2d');
  g.lineJoin = 'round';
  const draw = (polys, alpha, width) => {
    g.strokeStyle = `rgba(${ink.join(',')},${alpha})`;
    g.lineWidth = width;
    for (const poly of polys) {
      g.beginPath();
      poly.forEach(([x, y], i) => i ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5));
      g.closePath();
      g.stroke();
    }
  };
  draw(a.inner, 0.4, Math.max(1, p.w / 450));
  draw(a.blocks, 0.75, Math.max(1.4, p.w / 300));
  return c;
}

function stepsLines(c, a, ink, k = 1) {
  return stepsPaint(c, (i, r, g, b) => a.line[i] ? stepsInk(r, g, b, ink, a.line[i] * k) : null);
}

// Hatching: lines one way through the half-tone, and the other way too in
// the darkest - the order a pen builds tone in.
function stepsHatch(c, a, w, ink) {
  const gap = Math.max(4, Math.round(w / 110));
  return stepsPaint(c, (i, r, g, b) => {
    if (!a.tone[i]) return null;
    const x = i % w, y = (i / w) | 0;
    const one = (x + y) % gap === 0, across = a.tone[i] === 2 && (x - y + 10000 * gap) % gap === 0;
    return one || across ? stepsInk(r, g, b, ink, 0.8) : null;
  });
}

// The local colours, blurred and lifted towards the paper: a first wash.
function stepsWash(c, p, lift) {
  const { w, h, rgba } = p;
  const ch = [0, 1, 2].map(k => stepsBlur(Float32Array.from({ length: w * h }, (_, i) => rgba[4 * i + k]), w, h, Math.max(w, h) / 90));
  return stepsPaint(c, i => ch.map(v => v[i] + (251 - v[i]) * lift));
}

// Shadow shapes as a second, darker wash over the first.
function stepsShadows(c, a) {
  return stepsPaint(c, (i, r, g, b) => a.tone[i] ? [r * (a.tone[i] === 2 ? 0.62 : 0.8), g * (a.tone[i] === 2 ? 0.62 : 0.8), b * (a.tone[i] === 2 ? 0.66 : 0.84)] : null);
}

/* The whites to save before the first wash - in watercolour the white is
   the paper, and once painted over it does not come back. Near-white,
   near-grey pixels in connected areas; not those that reach the paper
   round the subject (where there is one) - that white is the paper going
   on, left by painting the subject - and not those mostly among other
   whites: a pale face cut into pieces by its lines is not a highlight but
   the lightest wash. A highlight has colour round it. Each is:
   - fluid: small, or thin - a catchlight, a streak of shine on the hair.
     A brush cannot go round it; masking fluid, before any paint.
   - around: big enough to paint round - a white shirt, a cloud. Fluid
     there would only leave a hard, cut-out edge.
   label is per pixel 0, 1 (fluid) or 2 (around); spots are the fluid
   areas' centres and sizes, to ring them where they are too small to see. */
function stepsWhites(p, inside) {
  const { w, h, rgba, L } = p;
  const white = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[4 * i], g = rgba[4 * i + 1], b = rgba[4 * i + 2];
    white[i] = L[i] >= 90 && Math.max(r, g, b) - Math.min(r, g, b) < 30 ? 1 : 0;
  }
  const label = new Uint8Array(w * h), seen = new Uint8Array(w * h), spots = [];
  const minArea = Math.max(6, 0.00006 * w * h), thin = Math.max(4, Math.max(w, h) / 90);
  const ring = Math.max(5, Math.round(Math.max(w, h) / 70));
  let fluid = 0, around = 0;
  for (let s = 0; s < w * h; s++) {
    if (!white[s] || seen[s]) continue;
    const part = [s], stack = [s]; seen[s] = 1;
    let x0 = w, x1 = 0, y0 = h, y1 = 0, outside = !!inside && !inside[s];
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && white[j] && !seen[j]) {
          seen[j] = 1; stack.push(j); part.push(j);
          if (inside && !inside[j]) outside = true;
        }
    }
    if (part.length < minArea || outside) continue;   // a speck of noise; the paper round the subject
    // What is round it, a few pixels out: how much of it is white too. Its
    // own pixels are marked first, to be left out of the count.
    for (const i of part) label[i] = 3;
    let n = 0, whites = 0;
    for (let y = Math.max(0, y0 - ring); y <= Math.min(h - 1, y1 + ring); y++)
      for (let x = Math.max(0, x0 - ring); x <= Math.min(w - 1, x1 + ring); x++) {
        const i = y * w + x;
        if (label[i] === 3) continue;
        n++; whites += white[i];
      }
    if (n && whites / n > 0.3) { for (const i of part) label[i] = 0; continue; }
    // How thick it is: its area over its longer side - a disc's is most of
    // its width, a streak's is its width.
    const thick = part.length / (Math.max(x1 - x0, y1 - y0) + 1);
    const k = part.length < 0.001 * w * h || thick < thin ? 1 : 2;
    for (const i of part) label[i] = k;
    if (k === 1) { fluid++; spots.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0) / 2 }); }
    else around++;
  }
  return { label, spots, fluid, around };
}

// Masking fluid's colour in the frame (it is often tinted, to be seen), and
// the line round a white to paint round.
const STEPS_FLUID = [236, 178, 36], STEPS_AROUND = [58, 120, 200];

function stepsWhitesFrame(p, a) {
  const { label } = a.whites, w = p.w;
  const c = stepsPaint(stepsLines(stepsCanvas(p), a, PENCIL, 0.45), (i, r, g, b) => {
    if (label[i] === 1) return STEPS_FLUID;
    if (label[i] !== 2) return null;
    const x = i % w;
    const edge = [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w].some(j => j < 0 || j >= label.length || label[j] !== 2);
    return edge ? STEPS_AROUND : null;
  });
  // A catchlight is a few pixels: a ring round each, to find it by.
  const g = c.getContext('2d');
  g.strokeStyle = `rgb(${STEPS_FLUID.join(',')})`;
  g.lineWidth = Math.max(1.2, p.w / 400);
  for (const s of a.whites.spots) {
    if (s.r > p.w / 40) continue;
    g.beginPath(); g.arc(s.x + 0.5, s.y + 0.5, s.r + Math.max(5, p.w / 80), 0, 2 * Math.PI); g.stroke();
  }
  return c;
}

function stepsWhitesText(a) {
  const { fluid, around } = a.whites;
  if (!fluid && !around) return 'Nothing here is left pure white: the lightest parts take the first pale wash. Look again for the whites you want - it is now or never.';
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return 'Before any paint, the whites - the paper is the only white watercolour has. ' +
    (fluid ? `Yellow: ${n(fluid, 'small white', 'small whites')} - catchlights, a streak of shine - cover with masking fluid on an old or rubber brush, and let it dry. ` : '') +
    (around ? `Blue outline: ${n(around, 'white', 'whites')} big enough to paint round - no fluid there, it would leave a hard, cut-out edge. ` : '');
}

function stepsFinal(p) {
  const c = document.createElement('canvas');
  c.width = p.w; c.height = p.h;
  c.getContext('2d').drawImage(p.img, 0, 0, p.w, p.h);
  return c;
}

const PENCIL = [70, 70, 76], PEN = [20, 18, 24];

/* The steps for each medium: what to do, and the frame that shows it. The
   words are for someone copying the picture in that medium. */
const STEPS = {
  watercolour: { label: 'Watercolour', steps: [
    { title: 'Big shapes', text: 'Lightly, in pencil: the few big masses and where they sit - no detail yet. Move and correct them now, while it costs nothing.',
      frame: (p, a) => stepsShapes(p, a, PENCIL) },
    { title: 'Lines', text: 'Firm up the contours in pencil, lightly enough to vanish under the paint. Watercolour keeps its lines - make only the ones you want.',
      frame: (p, a) => stepsLines(stepsCanvas(p), a, PENCIL, 0.6) },
    { title: 'Save the whites', text: (p, a) => stepsWhitesText(a),
      key: [[STEPS_FLUID, 'Masking fluid'], [STEPS_AROUND, 'Paint round it']],
      frame: (p, a) => stepsWhitesFrame(p, a) },
    { title: 'First wash', text: 'The local colour of each area, pale and wet - freely over the dry masking fluid, carefully round the big whites. Let it dry.',
      frame: (p, a) => stepsLines(stepsWash(stepsCanvas(p), p, 0.55), a, PENCIL, 0.45) },
    { title: 'Shadows', text: 'On dry paper, the shadow shapes in one stronger glaze over the first: one clean pass, not scrubbed. The darkest go last, small.',
      frame: (p, a) => stepsLines(stepsShadows(stepsWash(stepsCanvas(p), p, 0.35), a), a, PENCIL, 0.45) },
    { title: 'Finish', text: 'The few darkest accents and the edges that must be sharp - eyes, the line of the jaw. When it is all bone dry, rub the masking fluid off with a clean finger, and soften any edge it left too hard with a damp brush. Then stop.',
      frame: p => stepsFinal(p) },
  ] },
  ink: { label: 'Ink and hatching', steps: [
    { title: 'Big shapes', text: 'In pencil first, lightly: the big masses and where they sit. You will ink over it and rub it out.',
      frame: (p, a) => stepsShapes(p, a, PENCIL) },
    { title: 'Contours', text: 'With the pen, the contours - one confident stroke each, not a scratch of many. Thicker where a form turns away or is in shadow.',
      frame: (p, a) => stepsLines(stepsCanvas(p), a, PEN) },
    { title: 'Hatching', text: 'Tone with lines: parallel strokes all one way through the half-tones, then across them where it is darkest. Keep the lights empty.',
      frame: (p, a) => stepsLines(stepsHatch(stepsCanvas(p), a, p.w, PEN), a, PEN) },
    { title: 'Finish', text: 'More strokes where it must be darker, and texture last. Rub out the pencil when the ink is dry.',
      frame: p => stepsFinal(p) },
  ] },
  pencil: { label: 'Pencil and hatching', steps: [
    { title: 'Big shapes', text: 'A hard pencil (H or HB), lightly: the big masses and where they sit. Check the proportions now.',
      frame: (p, a) => stepsShapes(p, a, PENCIL) },
    { title: 'Lines', text: 'The contours over them, still light - lines you can lose later in the tone.',
      frame: (p, a) => stepsLines(stepsCanvas(p), a, PENCIL, 0.8) },
    { title: 'Tone', text: 'Three values only: the paper for the lights, one even half-tone, the darkest. Hatch each in one direction, following the form.',
      frame: (p, a) => stepsLines(stepsPaint(stepsCanvas(p), (i, r, g, b) => a.tone[i] ? stepsInk(r, g, b, PENCIL, a.tone[i] === 2 ? 0.55 : 0.25) : null), a, PENCIL, 0.8) },
    { title: 'Finish', text: 'A softer pencil (2B-4B) for the darkest accents; a kneaded eraser to lift back the highlights.',
      frame: p => stepsFinal(p) },
  ] },
  flat: { label: 'Flat colour', steps: [
    { title: 'Big shapes', text: 'The big masses and where they sit, lightly.',
      frame: (p, a) => stepsShapes(p, a, PENCIL) },
    { title: 'Lines', text: 'Clean contours - they hold the flat colours in.',
      frame: (p, a) => stepsLines(stepsCanvas(p), a, PEN) },
    { title: 'Flat colours', text: 'Each area in one flat colour, edge to edge, no shading yet.',
      frame: (p, a) => stepsLines(stepsWash(stepsCanvas(p), p, 0.1), a, PEN) },
    { title: 'Shadows', text: 'One shadow colour per area, hard-edged, where the light does not reach.',
      frame: p => stepsFinal(p) },
  ] },
};

// The medium a picture was made in, from its tags (see js/generate.js).
function stepsMedium(tags = []) {
  if (tags.includes('ink')) return 'ink';
  if (tags.includes('pencil') || tags.includes('sketch')) return 'pencil';
  if (tags.includes('flat colour')) return 'flat';
  return 'watercolour';
}

// Every frame of one medium, for a picture already read.
function stepsFrames(p, medium) {
  const a = stepsAnalyse(p);
  return STEPS[medium].steps.map(s => ({ title: s.title, text: typeof s.text === 'function' ? s.text(p, a) : s.text,
    key: s.key, canvas: s.frame(p, a) }));
}

/* ---- the sheet. */
const STEPS_KEY = 'refboard.stepsMedium.v1';
// The medium a picture was made in, where it is known: a generated one's
// tags, noted by openUpload() in js/uploads.js as it opens it.
const stepsKnown = new Map();
let stepsNow = null;   // { p, medium, frames, i }

function stepsSaved() {
  try { const m = localStorage.getItem(STEPS_KEY); return STEPS[m] ? m : 'watercolour'; } catch { return 'watercolour'; }
}

/* The steps for a picture, by its URL: its medium from its tags if it has
   any, else the one picked last time. */
async function openSteps(src) {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { announce('That picture could not be read.'); return; }
  const tags = stepsKnown.get(src);
  stepsNow = { p: stepsRead(img), medium: tags ? stepsMedium(tags) : stepsSaved(), i: 0 };
  stepsNow.frames = stepsFrames(stepsNow.p, stepsNow.medium);
  renderSteps();
  el('stepsSheet').classList.remove('hidden');
  dialogOpened(el('stepsSheet'), el('stepsNext'));
}

function closeSteps() {
  el('stepsSheet').classList.add('hidden');
  stepsNow = null;
  dialogClosed(el('stepsSheet'));
}

function setStepsMedium(m) {
  stepsNow.medium = m;
  stepsNow.frames = stepsFrames(stepsNow.p, m);
  stepsNow.i = 0;
  try { localStorage.setItem(STEPS_KEY, m); } catch { /* private mode */ }
  renderSteps();
  // The chips are drawn again, the one clicked with them: focus back on its
  // successor, or it falls out of the sheet and Esc no longer reaches it.
  el('stepsMedia').querySelector(`[data-medium="${m}"]`).focus();
}

function showStep(i) {
  const { frames } = stepsNow;
  stepsNow.i = Math.max(0, Math.min(frames.length - 1, i));
  const f = frames[stepsNow.i], c = el('stepsFrame');
  c.width = f.canvas.width; c.height = f.canvas.height;
  c.getContext('2d').drawImage(f.canvas, 0, 0);
  el('stepsCount').textContent = `Step ${stepsNow.i + 1} of ${frames.length}`;
  el('stepsStepTitle').textContent = f.title;
  el('stepsStepText').textContent = f.text;
  // What the colours in the frame mean, on a step that marks things.
  el('stepsKey').innerHTML = (f.key || []).map(([rgb, label]) =>
    `<li><span class="swatch" style="background:rgb(${rgb.join(',')})"></span>${esc(label)}</li>`).join('');
  el('stepsKey').hidden = !f.key;
  el('stepsPrev').disabled = stepsNow.i === 0;
  el('stepsNext').disabled = stepsNow.i === frames.length - 1;
  for (const b of el('stepsStrip').querySelectorAll('button'))
    b.setAttribute('aria-current', String(Number(b.dataset.step) === stepsNow.i));
}

function renderSteps() {
  el('stepsMedia').innerHTML = Object.entries(STEPS).map(([id, s]) =>
    `<button type="button" class="chip" data-medium="${id}" aria-pressed="${id === stepsNow.medium}">${esc(s.label)}</button>`).join('');
  const strip = el('stepsStrip');
  strip.innerHTML = '';
  stepsNow.frames.forEach((f, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${esc(f.title)}"><canvas></canvas><span>${i + 1}. ${esc(f.title)}</span></button>`;
    const t = li.querySelector('canvas'), k = 120 / Math.max(f.canvas.width, f.canvas.height);
    t.width = Math.round(f.canvas.width * k); t.height = Math.round(f.canvas.height * k);
    t.getContext('2d').drawImage(f.canvas, 0, 0, t.width, t.height);
    strip.appendChild(li);
  });
  showStep(stepsNow.i);
}

function initSteps() {
  el('stepsClose').addEventListener('click', closeSteps);
  initSheet(el('stepsSheet'), closeSteps);
  el('stepsPrev').addEventListener('click', () => showStep(stepsNow.i - 1));
  el('stepsNext').addEventListener('click', () => showStep(stepsNow.i + 1));
  el('stepsStrip').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) showStep(Number(b.dataset.step)); });
  el('stepsMedia').addEventListener('click', e => { const b = e.target.closest('[data-medium]'); if (b) setStepsMedium(b.dataset.medium); });
  el('stepsSheet').addEventListener('keydown', e => {
    if (!stepsNow || e.target.closest('#stepsMedia')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); showStep(stepsNow.i + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showStep(stepsNow.i - 1); }
  });
}
initSteps();
