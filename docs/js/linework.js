/* refboard - Line weight: the picture's contours drawn as ink, each as
   heavy or as light as a line drawing of it wants - heavy on the shadow
   side, at the undersides and along the big contours, light on the lit
   side and for small inner lines, with the ends tapered. The rule anime
   line art and a liner drawing both follow: the weight says where the
   light is and what is in front, which one even line cannot.

   The contours are the edges between masses (edges.js's gradient, with any
   line art taken out first - so an anime frame's own lines are redrawn,
   weighted). Each point is weighed on two things:
   - how dark it is round it - both sides, blurred: the shadow side of a
     form and its underside are dark on the form's side, and a line into a
     dark place is a heavy one;
   - how big the contour is - how much of the edge survives a heavy blur:
     the outline of a head does, a strand of hair inside it does not;
   - whether it meets another line - where one form overlaps another a line
     ends against the line in front of it (a T), and an inker presses there.
   Weight is relative - a line is heavy against the lighter ones - so the
   classes are split by the picture's own lines: the lightest third thin,
   the heaviest third heavy.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Less than this across it (L*-like, the three channels) is not a line.
const LW_MIN_CONTRAST = 10;
// A pixel this much darker than its closing is on a drawn line; a picture
// with this share of such pixels has line art, and its lines are weighed.
const LW_INKED = 10, LW_LINE_ART = 0.01;
// With line art, an edge with this much across it is drawn too.
const LW_MASS = 30;
// Darker than this (L*) on both sides is inside a solid dark.
const LW_FILL = 25;
// The share of lines drawn thin, and heavy; the rest are middle.
const LW_THIN = 0.35, LW_HEAVY = 0.3;
// Line widths, in pixels of the picture read at STEPS_SIDE, thin to heavy.
const LW_WIDTH = [1.2, 2.2, 3.8];
// A T where one line meets another swells both: this much more weight at
// the meeting, falling off over a line-length of about LW_JOIN_REACH of the
// picture's side.
const LW_JOIN = 0.4, LW_JOIN_REACH = 1 / 40;
const LW_INK = '#1d1a24', LW_PAPER = 'rgba(250, 248, 242, 0.86)';

/* Every point of every contour, weighed. p: stepsRead(). pts: the pixel
   index of each point; weight 0..1; cls 0 thin, 1 middle, 2 heavy; taper
   0..1, lower toward the end of a line; share: percent thin, middle, heavy. */
function lineWeightOf(p) {
  const { w, h } = p, n = w * h, S = Math.max(w, h);
  const { ch, G, NX, NY } = edgeGradient(p);
  const at = (c, x, y) => c[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];

  // The picture's own line art, if it has some: how much darker each pixel
  // is than the closing (which took the thin dark lines out) left it.
  const ink = stepsBlur(p.L, w, h, 1);
  for (let i = 0; i < n; i++) ink[i] = ch[0][i] - ink[i];
  let inked = 0;
  for (let i = 0; i < n; i++) if (ink[i] > LW_INKED) inked++;
  const lineArt = inked > LW_LINE_ART * n;

  // The crests, one pixel wide. With line art, the middle of each line -
  // those are the contours its artist chose, and a cel-shading edge (never
  // lined in anime) stays out. Without, the edges between masses, where
  // there is a real change across them.
  const crest = new Uint8Array(n);
  if (lineArt) {
    // Across a line is where it curves most (the Hessian's strongest,
    // downward, direction); its middle is the top of that curve.
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x, v = ink[i];
        if (v < LW_INKED) continue;
        const xx = ink[i + 1] + ink[i - 1] - 2 * v, yy = ink[i + w] + ink[i - w] - 2 * v;
        const xy = (ink[i + w + 1] + ink[i - w - 1] - ink[i + w - 1] - ink[i - w + 1]) / 4;
        const t = Math.atan2(2 * xy, xx - yy) / 2;
        // The two eigen-directions are t and t + 90 degrees: take the one
        // the line falls away along fastest.
        let nx = Math.cos(t), ny = Math.sin(t);
        const bend = xx * nx * nx + 2 * xy * nx * ny + yy * ny * ny;
        if (bend > xx * ny * ny - 2 * xy * nx * ny + yy * nx * nx) [nx, ny] = [-ny, nx];
        const o = Math.round(ny) * w + Math.round(nx);
        if (v >= ink[i + o] && v > ink[i - o]) { crest[i] = 1; NX[i] = nx; NY[i] = ny; }
      }
    }
  }
  // With line art, only a big change between masses joins the lines: a
  // black mass of hair against the paper has no line round it, only its
  // edge - and only where no drawn line runs already, or it is drawn twice.
  const least = lineArt ? LW_MASS : LW_MIN_CONTRAST, near = 3;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x, g = G[i];
      if (g < 0.5 || crest[i]) continue;
      const nx = NX[i], ny = NY[i], o = Math.round(ny) * w + Math.round(nx);
      if (g < G[i + o] || g <= G[i - o]) continue;
      // Looking a little way out and further: a soft edge (a wash fading
      // into the paper) is still a contour to draw.
      const across = Math.max(...[4, 8].map(d => Math.hypot(...ch.map(c => at(c, x + d * nx, y + d * ny) - at(c, x - d * nx, y - d * ny)))));
      if (across < least) continue;
      let lined = false;
      if (lineArt) {
        for (let dy = -near; dy <= near && !lined; dy++) for (let dx = -near; dx <= near; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w && crest[yy * w + xx] === 1) { lined = true; break; }
        }
      }
      if (!lined) crest[i] = 2;
    }
  }

  // Specks and stubs out: a painter draws a contour, not a pixel. Each
  // point keeps its line's length: a short line is a small inner one.
  const minRun = Math.max(6, Math.round(S / 45)), len = new Float32Array(n);
  const seen = new Uint8Array(n), stack = new Int32Array(n), run = [], id = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!crest[s] || seen[s]) continue;
    run.length = 0;
    let top = 0;
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top], x = i % w;
      run.push(i);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const j = i + dy * w + dx;
        if ((dx || dy) && x + dx >= 0 && x + dx < w && j >= 0 && j < n && crest[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    for (const i of run) if (run.length < minRun) crest[i] = 0; else { len[i] = run.length; id[i] = s + 1; }
  }

  // Darkness round each point: both sides of it, a little way off, on the
  // value blurred to areas; from the picture's own light (its 90th
  // percentile) to its own dark (the 10th), so a pale picture still has
  // heavy lines where it is darkest.
  const soft = stepsBlur(ch[0], w, h, Math.max(2, S / 120));
  const sorted = Float32Array.from(soft).sort();
  const lo = sorted[Math.floor(n * 0.1)], hi = sorted[Math.floor(n * 0.9)], span = Math.max(8, hi - lo);
  // The size of the contour: the change across it after a heavy blur.
  const big = stepsBlur(ch[0], w, h, Math.max(3, S / 70));
  const D = Math.max(3, S / 80), B = Math.max(4, S / 45);

  // Inside a solid dark - both sides among the picture's darkest, and
  // dark outright (a grey picture's darkest is still grey) - a line is lost
  // in the fill: in ink that is one black area.
  const pts = [];
  for (let i = 0; i < n; i++) {
    if (!crest[i]) continue;
    const x = i % w, y = (i - x) / w, nx = NX[i], ny = NY[i];
    if (Math.max(at(soft, x + D * nx, y + D * ny), at(soft, x - D * nx, y - D * ny)) < Math.min(lo + 3, LW_FILL)) crest[i] = 0;
    else pts.push(i);
  }
  // The neighbours of a point on a line, along it.
  const nb = i => {
    const x = i % w, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = i + dy * w + dx;
      if ((dx || dy) && x + dx >= 0 && x + dx < w && j >= 0 && j < n && crest[j]) out.push(j);
    }
    return out;
  };
  // The end of a line: all of its own line a few pixels round the point
  // lies to one side. (A neighbour count would miss an end drawn two
  // pixels wide.)
  const endish = new Uint8Array(n);
  for (const i of pts) {
    const x = i % w, y = (i - x) / w;
    let sx = 0, sy = 0, c = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if ((dx || dy) && xx >= 0 && yy >= 0 && xx < w && yy < h && id[yy * w + xx] === id[i]) { sx += dx; sy += dy; c++; }
    }
    if (c && Math.hypot(sx, sy) / c > 1) endish[i] = 1;
  }
  // Where one line meets another: a point with three long branches (a
  // staircase has two, and the stub across the end of a stroke is only a few
  // pixels - so the branches are counted out at 4 to arm pixels, in the
  // directions the line takes there), and the end of a line that stops a
  // hair short of another - one that is a line, not the end of one.
  const arm = Math.max(8, Math.round(S / 50));
  const branches = i => {
    const x = i % w, y = (i - x) / w, sector = new Uint8Array(8);
    for (let dy = -arm; dy <= arm; dy++) for (let dx = -arm; dx <= arm; dx++) {
      const xx = x + dx, yy = y + dy, d = Math.hypot(dx, dy);
      if (d < 4 || d > arm || xx < 0 || yy < 0 || xx >= w || yy >= h || id[yy * w + xx] !== id[i]) continue;
      sector[Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8]++;
    }
    // Round the circle, the groups of sectors with a pixel or two in them.
    let groups = 0;
    for (let k = 0; k < 8; k++) if (sector[k] >= 2 && sector[(k + 7) % 8] < 2) groups++;
    return groups;
  };
  const joints = [], lands = new Uint8Array(n), near2 = Math.max(3, Math.round(S / 90));
  for (const i of pts) {
    const ring = nb(i);
    if (ring.length >= 3 && !endish[i] && branches(i) >= 3) joints.push(i);
    if (!endish[i]) continue;
    const x = i % w, y = (i - x) / w;
    let best = 0, found = -1;
    for (let dy = -near2; dy <= near2; dy++) for (let dx = -near2; dx <= near2; dx++) {
      const xx = x + dx, yy = y + dy, d = Math.hypot(dx, dy);
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || d > near2) continue;
      const j = yy * w + xx;
      if (!crest[j] || !id[j] || id[j] === id[i] || endish[j]) continue;
      if (found < 0 || d < best) { best = d; found = j; }
    }
    if (found >= 0) { joints.push(found); lands[i] = 1; }
  }
  const dark = new Float32Array(pts.length), size = new Float32Array(pts.length);
  pts.forEach((i, k) => {
    const x = i % w, y = (i - x) / w, nx = NX[i], ny = NY[i];
    const mean = (at(soft, x + D * nx, y + D * ny) + at(soft, x - D * nx, y - D * ny)) / 2;
    dark[k] = Math.min(1, Math.max(0, (hi - mean) / span));
    size[k] = Math.abs(at(big, x + B * nx, y + B * ny) - at(big, x - B * nx, y - B * ny));
  });
  // Against the picture's own big contours (the 90th percentile), not a
  // fixed number: a quiet picture has big contours too.
  const bigTop = Float32Array.from(size).sort()[Math.floor(size.length * 0.9)] || 1;
  const raw = new Float32Array(n);
  // A line an eighth of the picture long or more counts as long.
  const long = S / 8;
  pts.forEach((i, k) => { raw[i] = 0.5 * dark[k] + 0.3 * Math.min(1, size[k] / bigTop) + 0.2 * Math.min(1, len[i] / long) + 1e-3; });
  // The meetings swell the lines round them, the most at the point itself.
  const reach = Math.max(4, S * LW_JOIN_REACH);
  for (const q of joints) {
    const qx = q % w, qy = (q - qx) / w;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const xx = qx + dx, yy = qy + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !raw[yy * w + xx]) continue;
      const d = Math.hypot(dx, dy);
      if (d < reach) raw[yy * w + xx] += LW_JOIN * (1 - d / reach);
    }
  }

  // Each point judged with its neighbours along the line, so a line swells
  // and thins smoothly rather than flickering pixel by pixel.
  const weight = new Float32Array(pts.length);
  pts.forEach((i, k) => {
    const x = i % w, y = (i - x) / w;
    let s = 0, c = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const v = raw[yy * w + xx];
      if (v) { s += v; c++; }
    }
    weight[k] = s / c;
  });

  // Tapered ends: how far each point is, along its line, from the nearest
  // end (a point with one neighbour) - a walk out from all the ends at once.
  const T = Math.max(6, S / 35), far = new Float32Array(n).fill(Infinity), queue = new Int32Array(n);
  let qh = 0, qt = 0;
  // A line that ends against another does not taper: it joins it.
  for (const i of pts) if (nb(i).length <= 1 && !lands[i]) { far[i] = 0; queue[qt++] = i; }
  while (qh < qt) {
    const i = queue[qh++];
    if (far[i] >= T) continue;
    for (const j of nb(i)) if (far[j] === Infinity) { far[j] = far[i] + 1; queue[qt++] = j; }
  }
  const taper = Float32Array.from(pts, i => Math.min(1, 0.35 + 0.65 * far[i] / T));

  // The classes, by the picture's own lines.
  const order = Float32Array.from(weight).sort();
  const cut1 = order[Math.floor(order.length * LW_THIN)], cut2 = order[Math.floor(order.length * (1 - LW_HEAVY))];
  const cls = Uint8Array.from(weight, v => v >= cut2 ? 2 : v >= cut1 ? 1 : 0);
  const share = [0, 0, 0];
  for (const c of cls) share[c]++;
  return { w, h, lineArt, joins: joints.length, pts: Int32Array.from(pts), weight, cls, taper,
    share: share.map(v => pts.length ? v / pts.length * 100 : 0) };
}

// The lines onto a canvas twice the picture read's size (the page scales
// it; at the read's own size a line is a row of blurred dots): paper over
// the picture, most of the way, and the contours in ink - a dot at each
// point, as wide as the line there.
function lineWeightDraw(m, c) {
  c.width = 2 * m.w; c.height = 2 * m.h;
  const g = c.getContext('2d'), k = Math.max(m.w, m.h) / STEPS_SIDE;
  g.scale(2, 2);
  g.fillStyle = LW_PAPER;
  g.fillRect(0, 0, m.w, m.h);
  g.fillStyle = LW_INK;
  for (let a = 0; a < m.pts.length; a++) {
    const i = m.pts[a], x = i % m.w, y = (i - x) / m.w;
    // Within a class, a little more or less by the weight itself.
    const r = LW_WIDTH[m.cls[a]] * (0.85 + 0.3 * Math.min(1, m.weight[a])) * m.taper[a] * k / 2;
    g.beginPath(); g.arc(x + 0.5, y + 0.5, Math.max(0.35, r), 0, 2 * Math.PI); g.fill();
  }
  return c;
}

// The line medium the painter has, best first: advice is for the tool in
// hand, and the main medium may be a paint that is not drawn with.
const LW_TOOLS = {
  liner: 'Liners: heavy 0.5-0.8, middle 0.3, light 0.05-0.1.',
  ballpoint: 'Ballpoint: press into the heavy lines or go over them twice; the light ones with the lightest touch.',
  inkWash: 'Brush or dip pen: press into the heavy lines, lift toward the light ones and at the ends.',
  graphite: 'Pencil: heavy lines in a soft lead (2B-4B), light ones in HB, barely pressed.',
};
function lineWeightTool() {
  const have = materialsProfile().have;
  return Object.keys(LW_TOOLS).find(k => have.includes(k)) || null;
}

/* What the lines say - two lines: the note sits over the picture. */
function lineWeightVerdict(m, tool = lineWeightTool()) {
  if (!m.pts.length) return 'No clear contours here - nothing to weigh.';
  return '<b>Heavy</b> - the shadow side, undersides, the big outer contours' + (m.joins ? ' and where one line meets another (the form in front)' : '') +
    '. <b>Light</b> - the lit side and small inner lines; ends taper.<br>' +
    (LW_TOOLS[tool] || 'Press into the heavy lines, lift toward the light ones and at the ends.');
}

/* ---- in a session: the lines over the picture, as a layer. */
let lineWeightRun = 0;

function clearLineWeight() {
  lineWeightRun++;
  el('lineOverlay').classList.add('hidden');
  overlayNote('lineweight', state.lineWeightOn ? 'Weighing the lines...' : '');
}

function toggleLineWeight() {
  state.lineWeightOn = !state.lineWeightOn;
  el('btnLineWeight').setAttribute('aria-pressed', String(state.lineWeightOn));
  clearLineWeight();
  if (state.lineWeightOn) runLineWeight();
}

// A moment's work, so after a frame: the button shows pressed first.
function runLineWeight() {
  const img = el('img'), run = ++lineWeightRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== lineWeightRun || !state.lineWeightOn) return;
    let m;
    try { m = lineWeightOf(stepsRead(img)); }
    catch (err) { console.error('line weight:', err); overlayNote('lineweight', '<i>Could not weigh the lines of this picture.</i>'); return; }
    lineWeightDraw(m, el('lineOverlay')).classList.remove('hidden');
    overlayNote('lineweight', lineWeightVerdict(m));
  }, 30);
}

el('btnLineWeight').addEventListener('click', toggleLineWeight);
// The advice is for the line medium you have.
document.addEventListener('refboard:materials', () => { if (state.lineWeightOn) runLineWeight(); });
