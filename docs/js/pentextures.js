/* refboard - Pen textures: how to say wood, stone, foliage, fur, water and
   brick in strokes. A third chapter of the Handbook (Practise > Handbook),
   in the same four parts as the others: theory, a demonstration to move,
   things to try, and what you should see - and, for each texture, a practice
   sheet to print: the example at the top and empty boxes to try it in.

   A texture in ink is not a copy of the surface, it is a short rule for the
   hand: wood is long lines that bend round a knot and never cross; stone is
   short hard strokes that change direction at each facet; foliage is a
   scribble that is denser on the shadow side and ragged at the edge; fur is
   flicks that follow the form and taper; water is horizontal dashes with
   white gaps, closer together toward the horizon; brick is a few bricks drawn
   well and the rest only hinted at. Each demonstration is a function that
   draws its rule into a canvas from a few numbers and gives back what it
   drew (ptWood, ptStone, ptFoliage, ptFur, ptWater, ptBrick), so the words
   under the picture are read off the same numbers and a test can ask them.
   They are models of a hand's habit, not of the surface: they take what
   decides the look and no more.

   The pen is a size from the liner sizes (0.05 to 0.8 mm); the canvas is
   taken as about 80 mm across, so PT_PX_PER_MM turns a size into a width.
   Loaded with handbook.js and techniques.js (loadSection('handbook')), whose
   tkRandom, tkGauss and tkLoad it uses; it adds to HB_LESSONS. */
"use strict";

const PT_GROUP = 'Pen textures';
const PT_INK = '#1d1a24', PT_PAPER = '#f8f4ea';
const PT_PENS = [0.05, 0.1, 0.3, 0.5, 0.8];
const PT_PX_PER_MM = 3.2;
const ptWidth = mm => 0.6 + mm * PT_PX_PER_MM;

// The sheet of paper and the pen, ready to draw with.
function ptStart(cv, mm) {
  const g = cv.getContext('2d');
  g.setLineDash([]);
  g.fillStyle = PT_PAPER; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = PT_INK; g.fillStyle = PT_INK; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = ptWidth(mm);
  return g;
}

/* ---- wood: long lines that part round a knot and never cross. */
function ptWood(cv, { lines = 22, knots = 1, mm = 0.3 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(31);
  // Spread along the board, so each one cuts lines of its own.
  const ks = Array.from({ length: knots }, (_, i) => ({ x: W * (knots === 1 ? 0.3 + 0.4 * rnd() : 0.16 + 0.68 * i / (knots - 1) + 0.04 * rnd()), y: H * (0.3 + 0.4 * rnd()), sx: 30 + 10 * rnd(), sy: 15 + 7 * rnd() }));
  const gap = (H - 16) / lines;
  let strokes = 0, crossings = 0;
  const last = new Array(Math.ceil(W / 3) + 2).fill(-Infinity);
  for (let k = 0; k < lines; k++) {
    const y0 = 8 + gap * (k + 0.5);
    let pen = false;
    g.beginPath();
    for (let x = 6, i = 0; x <= W - 6; x += 3, i++) {
      let y = y0 + 1.8 * Math.sin(x / 37 + k * 0.7) + 1.0 * Math.sin(x / 11 + k * 1.9);
      let inside = false;
      for (const kn of ks) {
        const dx = (x - kn.x) / kn.sx, dy = (y0 - kn.y) / kn.sy;
        y += (y0 - kn.y) * 1.0 * Math.exp(-(dx * dx + dy * dy) / 2);       // the lines part round it
        if (dx * dx * 0.55 + dy * dy * 1.6 < 0.6) inside = true;           // ...and stop at its rings
      }
      const lift = Math.sin(x / 29 + k * 2.3) * Math.sin(x / 7.3 + k) > 0.88;   // a line breaks now and then
      if (inside || lift) { pen = false; continue; }
      if (y - last[i] < g.lineWidth) crossings++;       // closer than the pen is wide: the two lines are one
      last[i] = y;
      if (pen) g.lineTo(x, y); else { g.moveTo(x, y); strokes++; pen = true; }
    }
    g.stroke();
  }
  for (const kn of ks) for (let r = 1; r <= 3; r++) {
    g.beginPath(); g.ellipse(kn.x, kn.y, kn.sx * 0.2 * r + 2, kn.sy * 0.2 * r + 1.2, 0, 0, Math.PI * 2); g.stroke();
  }
  return { lines, knots, strokes, crossings };
}

/* ---- stone: a block of three planes - the top, the left face and the right
   face - each lit by its angle to a light from the upper left and hatched in
   short hard strokes at an angle of its own. */
function ptStone(cv, { rough = 0.5, shade = 0.6, mm = 0.3 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(47);
  const cx = W / 2, cy = H / 2 + 10, n = 12, ring = [];
  // The outline: a lumpy ring (the more so the rougher), each side broken once more.
  const outer = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 2 * i / n + (rnd() - 0.5) * 0.25, r = (1 + (rnd() - 0.5) * 0.5 * rough) * 92;
    outer.push([cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 0.82 - (Math.sin(a) < 0 ? 8 : 0)]);
  }
  for (let i = 0; i < n; i++) {
    const a = outer[i], b = outer[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    ring.push(a, [(a[0] + b[0]) / 2 + (rnd() - 0.5) * len * 0.25 * rough, (a[1] + b[1]) / 2 + (rnd() - 0.5) * len * 0.25 * rough]);
  }
  const m = ring.length, mid = [cx + (rnd() - 0.5) * 24, cy - 6 + rnd() * 10];
  const arc = (i0, i1) => { const out = []; for (let i = i0; i <= i1; i++) out.push(ring[i % m]); return out; };
  // Right face (ring from the right-most point down to the bottom), left face (bottom to left-most), top (left-most over the top).
  const planes = [
    { name: 'top', poly: [...arc(m / 2, m - 1), mid], angle: 8, dark: 0.2 },
    { name: 'left', poly: [...arc(m / 4, m / 2), mid], angle: 72, dark: 0.55 },
    { name: 'right', poly: [...arc(0, m / 4), mid], angle: 108, dark: 0.95 },
  ];
  let dark = 0, strokes = 0;
  g.beginPath(); ring.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.stroke();
  for (const p of planes) {
    const darkness = Math.min(1, p.dark * shade * 1.05);
    if (darkness > 0.5) dark++;
    // The edge the planes share, then the hatching, clipped to the plane.
    g.beginPath(); g.moveTo(...p.poly[0]); g.lineTo(...mid); g.lineTo(...p.poly[p.poly.length - 2]); g.stroke();
    if (darkness < 0.08) continue;
    const th = (p.angle + (rnd() - 0.5) * 8) * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), step = 10 - darkness * 7;
    g.save(); g.beginPath(); p.poly.forEach((q, i) => i ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.clip();
    for (let o = -130; o <= 130; o += step) {
      const px = cx - uy * o, py = cy + ux * o;
      g.beginPath(); g.moveTo(px - ux * 160, py - uy * 160); g.lineTo(px + ux * 160, py + uy * 160); g.stroke(); strokes++;
    }
    g.restore();
  }
  // A few chips and cracks, short and angular.
  for (let k = 0; k < Math.round(2 + 7 * rough); k++) {
    const x = cx + (rnd() - 0.5) * 170, y = cy + (rnd() - 0.3) * 80;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + rnd() * 8, y + (rnd() - 0.4) * 10); g.lineTo(x + 10 + rnd() * 10, y + (rnd() - 0.3) * 16); g.stroke();
  }
  return { facets: planes.length, dark, strokes };
}

/* ---- foliage: a scribble, denser on the shadow side, ragged at the edge. */
function ptFoliage(cv, { leaf = 0.5, density = 0.6, mm = 0.3 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(59);
  // The mass is a cluster of lumps, not an ellipse: it has a lobed edge to be ragged along.
  const cx = W / 2, cy = H / 2 - 6, rx = 118, ry = 78;
  const lumps = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * 2 * i / 7 + rnd() * 0.5; return { x: cx + Math.cos(a) * rx * 0.5, y: cy + Math.sin(a) * ry * 0.5, r: 38 + 18 * rnd() }; });
  const size = 2.5 + leaf * 6, N = Math.round(500 + density * 2600);
  let marks = 0, shadow = 0;
  for (let i = 0; i < N; i++) {
    const L = lumps[Math.floor(rnd() * lumps.length)], a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * L.r;
    const x = L.x + Math.cos(a) * r, y = L.y + Math.sin(a) * r;
    // The shadow side is the lower right: a mark is kept more often there, the lit upper left stays open.
    const side = Math.min(1, Math.max(0, ((x - cx) / rx * 0.7 + (y - cy) / ry * 0.7 + 1) / 2));
    if (rnd() > 0.12 + 0.88 * side * side * (0.35 + 0.65 * density)) continue;
    // A leaf-mark: a small arc, a loop or a zigzag, at a random turn.
    const kind = Math.floor(rnd() * 3), t = rnd() * Math.PI * 2;
    g.beginPath();
    if (kind === 0) g.arc(x, y, size * (0.5 + 0.5 * rnd()), t, t + Math.PI * (1 + rnd()));
    else if (kind === 1) { g.moveTo(x, y); g.bezierCurveTo(x + Math.cos(t) * size * 1.5, y + Math.sin(t) * size * 1.5, x + Math.cos(t + 2) * size * 1.4, y + Math.sin(t + 2) * size * 1.4, x + Math.cos(t + 1) * size * 0.4, y + Math.sin(t + 1) * size * 0.4); }
    else { g.moveTo(x, y); for (let k = 1; k <= 3; k++) g.lineTo(x + Math.cos(t) * size * 0.5 * k + (k % 2 ? 1 : -1) * Math.sin(t) * size * 0.45, y + Math.sin(t) * size * 0.5 * k - (k % 2 ? 1 : -1) * Math.cos(t) * size * 0.45); }
    g.stroke(); marks++;
    if (side > 0.55) shadow++;
  }
  return { marks, shadow, shadowShare: marks ? shadow / marks : 0, size };
}

/* ---- fur: tapered flicks that follow the form. */
function ptFur(cv, { length = 0.5, density = 0.6, mm = 0.1 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(71);
  const cx = W / 2, cy = H / 2, rx = 112, ry = 72, N = Math.round(500 + density * 2200);
  const len = 6 + length * 20;
  let strokes = 0, total = 0;
  g.lineWidth = Math.max(0.5, ptWidth(mm) * 0.85);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()), x = cx + Math.cos(a) * r * rx, y = cy + Math.sin(a) * r * ry;
    const u = (x - cx) / rx, v = (y - cy) / ry, side = (u * 0.7 + v * 0.7 + 1) / 2;
    if (rnd() > 0.2 + 0.8 * side * density) continue;
    // The coat hangs: hairs run down, leaning outward from the middle line, and curl a little at the end.
    const dir = Math.PI / 2 - u * 0.75 + (rnd() - 0.5) * 0.35, L = len * (0.6 + 0.8 * rnd());
    const ex = x + Math.cos(dir) * L, ey = y + Math.sin(dir) * L, bend = (rnd() - 0.4) * L * 0.5;
    // A flick: a curve drawn as two passes, the second shorter, so the ends are lighter than the middle.
    const cxp = (x + ex) / 2 - Math.sin(dir) * bend, cyp = (y + ey) / 2 + Math.cos(dir) * bend;
    g.globalAlpha = 0.45; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cxp, cyp, ex, ey); g.stroke();
    g.globalAlpha = 1; g.beginPath(); g.moveTo(x + (ex - x) * 0.2, y + (ey - y) * 0.2); g.quadraticCurveTo(cxp, cyp, x + (ex - x) * 0.75, y + (ey - y) * 0.75); g.stroke();
    strokes++; total += L;
  }
  g.globalAlpha = 1;
  return { strokes, meanLength: strokes ? total / strokes : 0 };
}

/* ---- water: horizontal dashes with white gaps, closer toward the horizon. */
function ptWater(cv, { ripple = 0.5, reflection = true, mm = 0.3 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(83);
  const horizon = 40, post = { x: W * 0.62, w: 14 };
  let rows = 0, dashes = 0, ink = 0, post0 = 0;
  // Row spacing grows toward the viewer: the far water is a tight stack, the near water open.
  for (let y = horizon + 3, gap = 3.2; y < H - 6; y += gap, gap *= 1.17, rows++) {
    const near = (y - horizon) / (H - horizon);
    let x = 8 + rnd() * 30;
    while (x < W - 8) {
      const len = (8 + 46 * near * (0.4 + rnd())) * (1 - 0.3 * ripple * rnd()), wob = ripple * (1 + 2.5 * near) * (rnd() - 0.5);
      // A reflection: under the post the dashes are darker and doubled, and broken wider by the ripple.
      const under = reflection && x + len > post.x - post.w * (1 + ripple) && x < post.x + post.w * (1 + ripple);
      g.lineWidth = ptWidth(mm) * (under ? 1.5 : 0.8 + 0.5 * near);
      g.beginPath(); g.moveTo(x, y + wob); g.lineTo(x + len, y - wob); g.stroke();
      dashes++; ink += len; if (under) post0 += len;
      x += len + 6 + rnd() * (22 + 40 * near);                           // the white gap: the light on the water
    }
  }
  g.lineWidth = ptWidth(mm); g.beginPath(); g.moveTo(0, horizon); g.lineTo(W, horizon); g.stroke();
  if (reflection) { g.fillRect(post.x - 3, horizon - 26, 6, 26); }
  return { rows, dashes, inkShare: ink / (W * (H - horizon)), reflection: post0 };
}

/* ---- brick: a few bricks drawn well, the rest hinted at. */
function ptBrick(cv, { size = 0.5, weathering = 0.5, mm = 0.3 } = {}) {
  const g = ptStart(cv, mm), W = cv.width, H = cv.height, rnd = tkRandom(97);
  const bw = 20 + size * 26, bh = bw * 0.36, rows = Math.ceil(H / bh);
  let bricks = 0, drawn = 0, shaded = 0;
  const wall = { x0: 12, x1: W - 12, y0: 12, y1: H - 12 };
  for (let r = 0; r < rows; r++) {
    const y = wall.y0 + r * bh;
    if (y + bh > wall.y1) break;
    const off = r % 2 ? bw / 2 : 0;
    for (let x = wall.x0 - off; x < wall.x1; x += bw) {
      const x0 = Math.max(x, wall.x0), x1 = Math.min(x + bw, wall.x1);
      if (x1 - x0 < 6) continue;
      bricks++;
      // Weathering: more bricks are left as a hint - a corner of a line - than drawn all round.
      const full = rnd() > 0.25 + 0.6 * weathering * 0.8;
      if (full) {
        g.beginPath(); g.rect(x0, y, x1 - x0, bh); g.stroke(); drawn++;
      } else {
        g.beginPath(); g.moveTo(x0, y + bh); g.lineTo(x1, y + bh);                      // the joint underneath only
        if (rnd() > 0.4) { g.moveTo(x0, y + bh); g.lineTo(x0, y + bh * 0.4); }           // and half a side
        g.stroke();
      }
      // Some bricks darker: short diagonal strokes, a few of them, never all.
      if (rnd() < 0.12 + 0.3 * weathering) {
        shaded++;
        g.save(); g.beginPath(); g.rect(x0, y, x1 - x0, bh); g.clip();
        for (let o = -bh; o < x1 - x0 + bh; o += 6 - 1.5 * weathering) { g.beginPath(); g.moveTo(x0 + o, y + bh); g.lineTo(x0 + o + bh, y); g.stroke(); }
        g.restore();
      }
    }
  }
  return { bricks, drawn, shaded, shadedShare: bricks ? shaded / bricks : 0 };
}

/* ---- the practice sheet: the texture as it is now, and empty boxes to try it
   in, on an A4 page. The page prints through printHtml() (tools.js). */
function ptSheet(title, canvas, advice) {
  const boxes = Array.from({ length: 6 }, (_, i) => `<div class="box"><span>${i + 1}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} - practice sheet</title><style>
    @page { size: A4; margin: 14mm; }
    body { font: 12pt/1.4 system-ui, sans-serif; color: #222; margin: 0; }
    h1 { font-size: 16pt; margin: 0 0 4mm; }
    img { width: 100%; max-width: 150mm; border: 0.3mm solid #999; }
    p { margin: 3mm 0 6mm; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .box { height: 52mm; border: 0.3mm solid #888; position: relative; }
    .box span { position: absolute; left: 2mm; top: 1mm; font-size: 9pt; color: #999; }
  </style></head><body><h1>${esc(title)} - a practice sheet</h1>
  <img src="${canvas.toDataURL('image/png')}" alt="The example"><p>${esc(advice)}</p>
  <div class="grid">${boxes}</div></body></html>`;
}

/* The lesson's controls, shared: a pen size, and the sheet button. */
const ptPenSelect = (def = 0.3) => `<div class="row hb-pair"><label for="hbPen">Pen</label><select id="hbPen" aria-label="Pen size">` +
  PT_PENS.map(m => `<option value="${m}"${m === def ? ' selected' : ''}>${m} mm</option>`).join('') + `</select>` +
  `<button type="button" class="ghost" id="hbSheet" title="Print the example with empty boxes to practise in">Practice sheet</button></div>`;
const ptPen = host => +host.querySelector('#hbPen').value;
function ptWire(host, draw, title, advice) {
  host.querySelector('#hbPen').addEventListener('change', draw);
  host.querySelector('#hbSheet').addEventListener('click', () => printHtml(ptSheet(title, host.querySelector('canvas'), advice)));
}

HB_LESSONS.push(
  { id: 'pen-wood', group: PT_GROUP, title: 'Wood',
    theory: 'Wood is <b>long lines that run with the grain</b> and part round a knot like water round a stone. They never cross and rarely touch - a gap between lines is the light. Break them now and then rather than drawing each from end to end: a line that stops and starts again reads as a grain, an unbroken one as a rule. Closer lines are darker wood.',
    build(host) {
      host.innerHTML = tkLoad('Lines of wood grain parting round a knot') + ptPenSelect(0.3) +
        hbSlider('hbLines', 'Lines', 8, 40, 1, 22, '') + hbSlider('hbKnots', 'Knots', 0, 3, 1, 1, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = ptWood(cv, { lines: tkValue(host, 'hbLines'), knots: tkValue(host, 'hbKnots'), mm: ptPen(host) });
        read.textContent = `${r.lines} lines in ${r.strokes} strokes - the pen lifted ${r.strokes - r.lines} times. ` +
          (r.knots ? `${r.knots} knot${r.knots > 1 ? 's' : ''}: the lines part round it and stop at its rings.` : 'No knot: a plain board, and the grain does the work alone.') +
          (r.crossings ? ` ${r.crossings} places where a line runs into the next - too close together for this pen.` : '');
      };
      for (const id of ['hbLines', 'hbKnots']) hbOn(host, id, draw);
      ptWire(host, draw, 'Wood', 'Long lines that part round a knot and never cross. Break them now and then.');
      draw();
    },
    tryThis: ['Draw the lines closer together with the same pen. Where do they start to touch, and what does a board that dark look like?',
      'Add a knot, then a second. How far from a knot do the lines stop feeling its pull?',
      'Change the pen from 0.1 to 0.5 mm. Which one says old, weathered wood, and which a new plank?'],
    see: 'Close lines make a darker, denser wood and open ones a pale board; with a heavier pen the lines touch sooner, so a coarse pen wants fewer of them. The knot is the one place the lines bend sharply - everywhere else the waver is gentle. Practise the long, steady stroke: it is the whole skill.' },

  { id: 'pen-stone', group: PT_GROUP, title: 'Stone',
    theory: 'Stone is <b>hard, flat planes</b>: cut it into a few facets and hatch each one at its own angle, <b>darker the further it turns from the light</b>. Short, firm, straight strokes; the outline is angular, with a chip or a crack here and there. The change of hatching direction at each edge is what makes it read as rock and not a pebble or a cloud.',
    build(host) {
      host.innerHTML = tkLoad('A block of stone in facets, each hatched at its own angle') + ptPenSelect(0.3) +
        hbSlider('hbRough', 'Roughness', 0, 100, 1, 50, '') + hbSlider('hbShade', 'Shading', 10, 100, 1, 60, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = ptStone(cv, { rough: tkValue(host, 'hbRough') / 100, shade: tkValue(host, 'hbShade') / 100, mm: ptPen(host) });
        read.textContent = `${r.facets} planes - top, left, right - ${r.dark} of them turned from the light enough to be dark (the light is the upper left). ${r.strokes} hatching strokes.`;
      };
      for (const id of ['hbRough', 'hbShade']) hbOn(host, id, draw);
      ptWire(host, draw, 'Stone', 'A few facets, each hatched at its own angle, darker the further from the light.');
      draw();
    },
    tryThis: ['Take the shading up and down. At what point does the stone stop being a stone and become a dark blob?',
      'Make it smooth, then rough. Which would you draw for a river pebble, and which for a cliff?',
      'Look at the facet nearest the light: how much of it did the pen leave bare?'],
    see: 'The facets facing the light stay almost bare paper; those facing away carry the hatching, packed closer as they turn. Rougher stone means more irregular facets and more chips. A smooth, round stone would have no sharp change of direction - it is the corners between facets that say stone.' },

  { id: 'pen-foliage', group: PT_GROUP, title: 'Foliage',
    theory: 'Do not draw leaves; draw the <b>mass</b>. A scribble of small loops, arcs and zigzags, <b>denser on the shadow side</b> and thinning to a ragged edge on the lit side, where the paper shows through. Big marks read as a tree near you, small ones as a tree far away. Vary the marks - a row of identical loops reads as a chain.',
    build(host) {
      host.innerHTML = tkLoad('A mass of foliage scribbled, dense on the lower right and open on the upper left') + ptPenSelect(0.1) +
        hbSlider('hbLeaf', 'Mark size', 0, 100, 1, 50, '') + hbSlider('hbDens', 'Density', 10, 100, 1, 60, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = ptFoliage(cv, { leaf: tkValue(host, 'hbLeaf') / 100, density: tkValue(host, 'hbDens') / 100, mm: ptPen(host) });
        read.textContent = `${r.marks} marks of about ${r.size.toFixed(1)} px, ${Math.round(r.shadowShare * 100)}% of them on the shadow side. ` +
          (r.shadowShare < 0.4 ? 'The shadow side is not much darker than the lit: the mass will look flat.' : 'Denser on the shadow side - the mass has a light.');
      };
      for (const id of ['hbLeaf', 'hbDens']) hbOn(host, id, draw);
      ptWire(host, draw, 'Foliage', 'A scribble of small marks, denser on the shadow side, ragged and open on the lit edge.');
      draw();
    },
    tryThis: ['Raise the density to the top. Where does the mass lose its light?',
      'Make the marks small, then large. Which says a tree near you?',
      'Draw it with a 0.1 mm pen, then 0.8: where does the finer pen win, and where the heavier?'],
    see: 'With only the density rising the whole mass darkens and the light is lost - a leaf mass needs its lit side left open. Large marks read near, small marks far, and the lit edge must stay ragged: a smooth edge makes a cloud. Keep the marks varied in direction as you draw.' },

  { id: 'pen-fur', group: PT_GROUP, title: 'Fur',
    theory: 'Fur is <b>flicks, not lines</b>: short curved strokes that follow the form of the animal, each <b>pressed at the start and lifted at the end</b>, so they taper to nothing. They lie one way over the body and change direction where the form turns. Draw them thicker in the shadow and leave the lit top almost bare. A fine pen (0.05-0.1 mm) is the fur pen.',
    build(host) {
      host.innerHTML = tkLoad('Tapered flicks following the form of a rounded body') + ptPenSelect(0.1) +
        hbSlider('hbLen', 'Hair length', 0, 100, 1, 50, '') + hbSlider('hbDens', 'Density', 10, 100, 1, 60, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = ptFur(cv, { length: tkValue(host, 'hbLen') / 100, density: tkValue(host, 'hbDens') / 100, mm: ptPen(host) });
        read.textContent = `${r.strokes} flicks of about ${Math.round(r.meanLength)} px each. ` + (r.meanLength > 18 ? 'Long hair: they should curve and cross less.' : r.meanLength < 9 ? 'Short, close hair - a short coat, a mouse.' : 'A medium coat.');
      };
      for (const id of ['hbLen', 'hbDens']) hbOn(host, id, draw);
      ptWire(host, draw, 'Fur', 'Tapered flicks that follow the form: pressed at the start, lifted at the end, heavier in the shadow.');
      draw();
    },
    tryThis: ['Shorten the hair, then lengthen it. Which animal is each?',
      'Switch to the 0.8 mm pen. What happens to the taper?',
      'Where is the coat bare? Why is that the right place to stop?'],
    see: 'Long hair gives long, curving, overlapping flicks, short hair many small ones. A heavy pen cannot taper, so the flicks turn into dashes - fur wants the finest pen you have. The lit top of the form is left open: the paper does the light. Practise one flick again and again: press, curve, lift.' },

  { id: 'pen-water', group: PT_GROUP, title: 'Water',
    theory: 'Water is <b>horizontal dashes with white gaps</b>. The gaps are the light on the water; the dashes are the reflected dark. In the distance the rows are <b>close together and short</b>; near you they open out and grow longer. A reflection of something dark is the same dashes, darker and doubled, broken wider by the ripple - it is never a mirror.',
    build(host) {
      host.innerHTML = tkLoad('Rows of horizontal dashes closer toward the horizon, with the reflection of a post') + ptPenSelect(0.3) +
        hbSlider('hbRip', 'Ripple', 0, 100, 1, 50, '') +
        '<div class="row hb-toggles"><label class="opt"><input type="checkbox" id="hbRefl" checked> Reflection of the post</label></div><div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead'), refl = host.querySelector('#hbRefl');
      const draw = () => {
        const r = ptWater(cv, { ripple: tkValue(host, 'hbRip') / 100, reflection: refl.checked, mm: ptPen(host) });
        read.textContent = `${r.rows} rows, ${r.dashes} dashes, ${Math.round(r.inkShare * 100)}% of the water inked - the rest is white paper, the light. ` +
          (r.reflection ? 'The dashes under the post are darker and heavier.' : 'Without a reflection the water is a plain pattern of light.');
      };
      hbOn(host, 'hbRip', draw);
      refl.addEventListener('change', draw);
      ptWire(host, draw, 'Water', 'Horizontal dashes with white gaps, closer and shorter toward the horizon. A reflection is darker and broken by the ripple.');
      draw();
    },
    tryThis: ['Make the ripple calm, then rough. How does the reflection change?',
      'Where are the rows closest together? Why there?',
      'Turn the reflection off and on. How much of the dark does it add, and where?'],
    see: 'Calm water has straight, even dashes and a clean reflection; a ripple shakes them and breaks the reflection into pieces. The rows crowd toward the horizon - the same rule as perspective, so the water lies flat. The white gaps must stay: fill them and the water goes dead.' },

  { id: 'pen-brick', group: PT_GROUP, title: 'Brick',
    theory: 'Brick is the texture to <b>not finish</b>. Draw a few bricks well - all four sides, a little shading - and only <b>hint at the rest</b> with the joint under them and half a side. The eye completes the pattern. Running bond (each row offset by half a brick) is what makes it read as a wall. Shade some bricks, never all of them, and keep the hatching short.',
    build(host) {
      host.innerHTML = tkLoad('A brick wall: a few bricks drawn fully, the rest hinted at') + ptPenSelect(0.3) +
        hbSlider('hbSize', 'Brick size', 0, 100, 1, 50, '') + hbSlider('hbWeather', 'Weathering', 0, 100, 1, 50, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = ptBrick(cv, { size: tkValue(host, 'hbSize') / 100, weathering: tkValue(host, 'hbWeather') / 100, mm: ptPen(host) });
        read.textContent = `${r.bricks} bricks: ${r.drawn} drawn all round, ${r.bricks - r.drawn} only hinted at, ${r.shaded} shaded (${Math.round(r.shadedShare * 100)}%).`;
      };
      for (const id of ['hbSize', 'hbWeather']) hbOn(host, id, draw);
      ptWire(host, draw, 'Brick', 'A few bricks drawn well, the rest hinted: the joint underneath and half a side. Shade some, never all.');
      draw();
    },
    tryThis: ['Take the weathering to nothing. Does a wall of identical drawn bricks look more real or less?',
      'Make the bricks big, then small. At what size do you stop wanting to draw them?',
      'Cover half the wall with your hand. Can you still tell it is brick?'],
    see: 'A wall where every brick is drawn the same looks like a diagram; the hinted bricks and the few shaded ones are what make it look worn and real. Smaller bricks are further away: draw fewer of them fully. The eye is happy to finish a pattern from a few clear examples.' },
);
