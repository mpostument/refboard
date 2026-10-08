/* refboard - Line and wash: the urban sketcher's plan for liner-plus-
   watercolour - which contours are worth a line, and which are better left
   for the colour change alone to say.

   Line weight (linework.js) already weighs every contour point by how dark
   it is round it and how big a contour it is part of - continuous, and
   classed thin/middle/heavy only to pick a width. A width is never zero, so
   that class is the wrong thing to decide whether a line is drawn at all:
   taken point by point, even one single, even contour (a circle's rim) has
   a third of its own length fall in the "thin" class by nothing but the
   quantiles' own arithmetic, and would come out dashed for no reason a
   painter could see.

   So the decision is made once per contour, not once per point: each
   connected run of points is one line, and it keeps its line only if it is
   among the few that carry most of the picture's own weight - its length
   and its darkness together, summed along it. A picture with one strong
   contour inks all of it; a big shape beside a small mark of the same
   contrast inks the shape and leaves the mark, because the mark's own total
   is a small fraction of the two together. The wash is the picture's own
   colour, blurred until only its broad masses are left - what a line left
   bare still has colour to say it by.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// How far the colour is blurred for the wash, relative to the picture's
// long side: broad masses only, nothing a line would also draw.
const LW_WASH_BLUR = 9;
// The heaviest runs are inked until they carry this share of the picture's
// total weight; what is left over - the minor ones - goes to the wash.
const LW_WASH_INK = 0.85;

// m: lineWeightOf(). Which of its points are inked and which left to the
// wash: each connected run of contour points (8-neighbour, as a painter
// sees one line, not a pixel) judged as a whole by its own total weight.
function lineWashPlan(m) {
  const { w, pts, weight } = m;
  const at = new Map();
  pts.forEach((i, k) => at.set(i, k));
  const runOf = new Int32Array(pts.length).fill(-1);
  const runs = [];
  for (let k0 = 0; k0 < pts.length; k0++) {
    if (runOf[k0] !== -1) continue;
    const id = runs.length, stack = [k0], members = [];
    runOf[k0] = id;
    while (stack.length) {
      const k = stack.pop(), i = pts[k], x = i % w;
      members.push(k);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const kk = at.get(i + dy * w + dx);
        if (kk !== undefined && runOf[kk] === -1) { runOf[kk] = id; stack.push(kk); }
      }
    }
    runs.push({ members, mass: members.reduce((s, k) => s + weight[k], 0) });
  }

  // Heaviest run first, kept until together they are most of the total -
  // the few left over are what the wash is for.
  const order = runs.map((_, id) => id).sort((a, b) => runs[b].mass - runs[a].mass);
  const total = runs.reduce((s, r) => s + r.mass, 0) || 1;
  const keep = new Set();
  let acc = 0;
  for (const id of order) {
    keep.add(id);
    acc += runs[id].mass;
    if (acc / total >= LW_WASH_INK) break;
  }

  const inkIdx = [], washIdx = [];
  for (let k = 0; k < pts.length; k++) (keep.has(runOf[k]) ? inkIdx : washIdx).push(k);
  const inkShare = inkIdx.length / (pts.length || 1) * 100;
  return { m, inkIdx, washIdx, inkShare, washShare: 100 - inkShare };
}

// The picture's own colour, blurred until only its broad masses are left -
// what the wash alone will carry, with no fine edge for the line to repeat.
function lineWashBlur(p) {
  const { w, h, rgba } = p, n = w * h, r = Math.max(4, Math.max(w, h) / LW_WASH_BLUR);
  const out = new Uint8ClampedArray(n * 4);
  for (let k = 0; k < 3; k++) {
    const src = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] = rgba[4 * i + k];
    const blurred = stepsBlur(src, w, h, r);
    for (let i = 0; i < n; i++) out[4 * i + k] = blurred[i];
  }
  for (let i = 0; i < n; i++) out[4 * i + 3] = 255;
  return out;
}

// The wash under the ink, then the ink itself - only the plan's line
// points, drawn exactly as line weight would (same widths and taper).
function lineWashDraw(plan, p, c) {
  const { m } = plan;
  c.width = 2 * m.w; c.height = 2 * m.h;
  const g = c.getContext('2d'), k = Math.max(m.w, m.h) / STEPS_SIDE;

  const wash = document.createElement('canvas');
  wash.width = m.w; wash.height = m.h;
  wash.getContext('2d').putImageData(new ImageData(lineWashBlur(p), m.w, m.h), 0, 0);
  g.globalAlpha = 0.8;
  g.drawImage(wash, 0, 0, c.width, c.height);
  g.globalAlpha = 1;

  g.scale(2, 2);
  g.fillStyle = LW_INK;
  for (const a of plan.inkIdx) {
    const i = m.pts[a], x = i % m.w, y = (i - x) / m.w;
    const r = LW_WIDTH[m.cls[a]] * (0.85 + 0.3 * Math.min(1, m.weight[a])) * m.taper[a] * k / 2;
    g.beginPath(); g.arc(x + 0.5, y + 0.5, Math.max(0.35, r), 0, 2 * Math.PI); g.fill();
  }
  return c;
}

function lineWashVerdict(plan) {
  const { m, inkShare, washShare } = plan;
  if (!m.pts.length) return 'No clear contours here - nothing to plan.';
  const tool = lineWeightTool();
  const medium = { liner: 'the liner', ballpoint: 'the ballpoint', inkWash: 'the pen', graphite: 'the pencil' }[tool] || 'the line';
  return `<b>Line</b> - ${Math.round(inkShare)}% of the contours, inked below: the big shapes, the shadow's edge, where one thing overlaps another. ` +
    `<b>Wash</b> - the other ${Math.round(washShare)}%: small inner edges left bare here, for ${esc(medium)} to leave alone too and the colour change alone to carry.`;
}

/* ---- in a session: the plan over the picture, as a layer. */
let lineWashRun = 0;

function clearLineWash() {
  lineWashRun++;
  el('lineWashOverlay').classList.add('hidden');
  overlayNote('linewash', state.lineWashOn ? 'Planning the line and the wash...' : '');
}

function toggleLineWash() {
  state.lineWashOn = !state.lineWashOn;
  el('btnLineWash').setAttribute('aria-pressed', String(state.lineWashOn));
  clearLineWash();
  if (state.lineWashOn) runLineWash();
}

// A moment's work, so after a frame: the button shows pressed first.
function runLineWash() {
  const img = el('img'), run = ++lineWashRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== lineWashRun || !state.lineWashOn) return;
    let p, plan;
    try { p = stepsRead(img); plan = lineWashPlan(lineWeightOf(p)); }
    catch (err) { console.error('line and wash:', err); overlayNote('linewash', '<i>Could not plan this picture.</i>'); return; }
    lineWashDraw(plan, p, el('lineWashOverlay')).classList.remove('hidden');
    overlayNote('linewash', lineWashVerdict(plan));
  }, 30);
}

el('btnLineWash').addEventListener('click', toggleLineWash);
// The advice names the line medium you have.
document.addEventListener('refboard:materials', () => { if (state.lineWashOn) runLineWash(); });
