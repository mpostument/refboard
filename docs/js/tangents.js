/* refboard - Tangents: where the edges of two shapes just touch, or nearly
   do, and where a shape just touches the edge of the paper. A tangent
   flattens depth - the eye cannot tell which shape is in front, so it reads
   them as one flat pattern - and it pulls the eye to a spot that means
   nothing. The cure is either way: overlap them (one clearly in front) or
   open a clear gap.

   Shapes are the masses of value a painter blocks in - light, half-tone and
   dark, split where the picture itself splits (Otsu), smoothed, with line
   art taken out first (edges.js's closing): in anime art every flat area is
   ringed by a line, and every pair of them would read as nearly touching.

   The trick: every shape is shrunk a little first. Two shapes that
   share a long edge are then a little apart all along it; two that meet
   at one point, or nearly meet, are close only there. So a tangent is a
   short place of closeness, not a small distance. The shrinking also
   cuts two shapes of the same value joined through a point into two.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const TAN_SHAPES = 'rgb(255, 80, 210)', TAN_FRAME = 'rgb(255, 196, 40)';
// At most this many marked - the biggest shapes first; past a dozen the
// marks are noise, and the note says how many more there are.
const TAN_MAX = 10;

// A binary mask shrunk by r (a square window), in rows then columns - a
// pixel stays only if all within r of it are in. Outside the picture counts
// as in, so a shape that runs off the edge still reaches it.
function tanErode(m, w, h, r) {
  const pass = (src, step, len, lines, stride) => {
    const out = new Uint8Array(src.length);
    for (let a = 0; a < lines; a++) {
      let gap = -1;   // index of the last pixel out, along the line
      const o = a * stride, next = new Float64Array(len);
      // next[b]: the first pixel out at or after b (len if none)
      let nx = Infinity;
      for (let b = len - 1; b >= 0; b--) { if (!src[o + b * step]) nx = b; next[b] = nx; }
      for (let b = 0; b < len; b++) {
        if (!src[o + b * step]) gap = b;
        out[o + b * step] = (gap < 0 || b - gap > r) && next[b] - b > r ? 1 : 0;
      }
    }
    return out;
  };
  return pass(pass(m, 1, w, h, w), w, h, w, 1);
}

/* The shapes: tone 0 light, 1 half-tone, 2 dark, per pixel, blocked in -
   each pixel takes the tone most of its neighbourhood has.

   A half-tone only where the picture has one. Split each side of the
   light-dark line again whatever it holds, and a picture in two values gets
   a thin false half-tone ring round every shape - the blur of its edge -
   which moves each shape's rim in by its width. So: the second split on
   the side where it explains more, and only if it holds a real share. */
function tanTones(p) {
  const { w, h } = p, n = w * h, S = Math.max(w, h);
  const from = edgeClose(p.L, w, h, 2);
  const L = Float32Array.from(from, j => p.L[j]);
  const soft = stepsBlur(L, w, h, 1);
  const t1 = stepsOtsu(soft), lo = stepsOtsu(soft, 0, t1), hi = stepsOtsu(soft, t1, 100);
  // Between-class variance of the three groups each pair of lines makes.
  const spread = (a, b) => {
    const s = [0, 0, 0], c = [0, 0, 0];
    for (const v of soft) { const g = v < a ? 0 : v < b ? 1 : 2; s[g] += v; c[g]++; }
    const mean = (s[0] + s[1] + s[2]) / n;
    return c.reduce((acc, cc, g) => acc + (cc ? cc * (s[g] / cc - mean) ** 2 : 0), 0);
  };
  let [a, b] = spread(lo, t1) >= spread(t1, hi) ? [lo, t1] : [t1, hi];
  let mid = 0;
  for (const v of soft) if (v >= a && v < b) mid++;
  if (mid < 0.08 * n) a = b = t1;
  const votes = [0, 1, 2].map(t => stepsBlur(Float32Array.from(soft, v => (v < a ? 2 : v < b ? 1 : 0) === t ? 1 : 0), w, h, S / 150));
  const tone = new Uint8Array(n);
  for (let i = 0; i < n; i++) tone[i] = votes[1][i] > votes[0][i] ? (votes[2][i] > votes[1][i] ? 2 : 1) : (votes[2][i] > votes[0][i] ? 2 : 0);
  return tone;
}

// The long side shapes are looked at: they are big masses, and the search
// round each rim grows with the square of the side.
const TAN_SIDE = 320;

// p's lightness averaged down to about TAN_SIDE, by a whole factor f.
function tanSmall(p) {
  const f = Math.max(1, Math.ceil(Math.max(p.w, p.h) / TAN_SIDE));
  const w = Math.max(1, Math.floor(p.w / f)), h = Math.max(1, Math.floor(p.h / f));
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += p.L[(y * f + dy) * p.w + x * f + dx];
    L[y * w + x] = s / (f * f);
  }
  return { w, h, L, f };
}

/* Every tangent, biggest shapes first. p: stepsRead(). Each: x, y in the
   picture read (0..w, 0..h); kind 'shapes' or 'frame'; size, the smaller
   shape's side (sqrt of its area); side, for 'frame': top/right/bottom/left. */
function tangentsOf(p) {
  const q = tanSmall(p), { w, h, f } = q, n = w * h, S = Math.max(w, h);
  const tone = tanTones(q);
  const gap = Math.max(3, Math.round(S / 50));    // a gap narrower than this is "nearly touching"
  const minArea = 0.0025 * n;
  const stack = new Int32Array(n);

  // The shapes shrunk by kk, labelled tone by tone; the small ones are not
  // shapes (label 0).
  const shrunk = kk => {
    const lab = new Int32Array(n), area = [0], toneOf = [0];
    for (let t = 0; t < 3; t++) {
      const core = tanErode(Uint8Array.from(tone, v => v === t ? 1 : 0), w, h, kk);
      for (let s = 0; s < n; s++) {
        if (!core[s] || lab[s]) continue;
        const id = area.length, members = [];
        let top = 0;
        stack[top++] = s; lab[s] = id;
        while (top) {
          const i = stack[--top], x = i % w;
          members.push(i);
          for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
            if (j >= 0 && j < n && core[j] && !lab[j]) { lab[j] = id; stack[top++] = j; }
        }
        if (members.length < minArea) { for (const i of members) lab[i] = -1; area.push(0); }
        else area.push(members.length);
        toneOf.push(t);
      }
    }
    for (let i = 0; i < n; i++) if (lab[i] < 0) lab[i] = 0;
    return { lab, area, toneOf };
  };

  // From each shape's rim, the nearest pixel of every other shape within
  // D: per pair, the closest two pixels and every rim pixel that saw the
  // other, with how far.
  const closest = (lab, D) => {
    const offs = [];
    for (let dy = -D; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) {
      const d = Math.hypot(dx, dy);
      if (d && d <= D) offs.push([dx, dy, d]);
    }
    offs.sort((a, b) => a[2] - b[2]);
    const pairs = new Map(), found = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, a = lab[i];
        if (!a) continue;
        if ((x && lab[i - 1] === a) && (x < w - 1 && lab[i + 1] === a) && (y && lab[i - w] === a) && (y < h - 1 && lab[i + w] === a)) continue;
        found.length = 0;
        for (const [dx, dy, d] of offs) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const b = lab[yy * w + xx];
          if (!b || b === a || found.includes(b)) continue;
          found.push(b);
          const key = a < b ? a * 65536 + b : b * 65536 + a;
          let e = pairs.get(key);
          if (!e) pairs.set(key, e = { a: Math.min(a, b), b: Math.max(a, b), d: Infinity, pts: [], ds: [] });
          e.pts.push(i); e.ds.push(d);
          if (d < e.d) { e.d = d; e.x = x + dx / 2; e.y = y + dy / 2; e.ia = i; e.ib = yy * w + xx; }
        }
      }
    }
    return [...pairs.values()];
  };

  // The shapes as they are: two pieces of one of these are joined, through
  // a point or through a neck.
  const whole = new Int32Array(n);
  for (let s = 0, id = 0; s < n; s++) {
    if (whole[s]) continue;
    let top = 0;
    stack[top++] = s; whole[s] = ++id;
    while (top) {
      const i = stack[--top], x = i % w;
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < n && !whole[j] && tone[j] === tone[i]) { whole[j] = id; stack[top++] = j; }
    }
  }

  const extent = pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of pts) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return pts.length ? Math.hypot(x1 - x0, y1 - y0) : 0;
  };
  const out = [];

  // 1. Two different shapes. Each shrunk a little, so two that share an
  // edge are a little apart all along it, and two that meet at a point, or
  // nearly, are close only there: a tangent is a short place of closeness.
  const k = Math.max(2, Math.round(S / 60));
  const { lab, area, toneOf } = shrunk(k);
  const short = (a, b) => Math.max(3, Math.min(S / 10, 0.45 * Math.sqrt(Math.min(area[a], area[b] ?? area[a]))));
  for (const e of closest(lab, 2 * k + gap)) {
    if (whole[e.ia] === whole[e.ib]) continue;    // one shape - see 2.
    // Along each rim on its own - both together would add the gap across.
    const zone = e.pts.filter((_, j) => e.ds[j] <= e.d + 1.5);
    const along = Math.max(extent(zone.filter(i => lab[i] === e.a)), extent(zone.filter(i => lab[i] === e.b)));
    if (along > short(e.a, e.b)) continue;       // an edge they share
    out.push({ kind: 'shapes', x: e.x, y: e.y, size: Math.sqrt(Math.min(area[e.a], area[e.b])) });
  }

  // 2. Two shapes of one value that touch are one shape in the value map,
  // joined through a point - and the blocking-in fills the join to a neck
  // (two round shapes are within a pixel of each other along 2 sqrt(radius)
  // of it). Shrunk hard, that neck breaks. But so does a real one - a waist,
  // a wrist - so each break is looked at: across the join, past where it
  // ends, a kiss leaves the ground between the two as a sharp wedge (round
  // shapes part slowly) and a neck leaves it open.
  const K = Math.max(4, Math.round(S / 15));
  const hard = shrunk(K);
  const wedge = (e, t) => {
    const ux = (e.ib % w - e.ia % w) / e.d, uy = (((e.ib / w) | 0) - ((e.ia / w) | 0)) / e.d;
    const inT = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < w && y < h && tone[y * w + x] === t; };
    if (!inT(e.x, e.y)) return false;               // joined some other way round
    for (const sgn of [1, -1]) {
      const vx = -uy * sgn, vy = ux * sgn;
      let d = 0;
      while (d <= K && inT(e.x + vx * d, e.y + vy * d)) d++;
      if (d > K) return false;                     // a thick join
      const far = d + gap, px = e.x + vx * far, py = e.y + vy * far;
      let wid = 0;
      for (const su of [1, -1]) for (let s = 1; s <= far && !inT(px + ux * su * s, py + uy * su * s); s++) wid++;
      if (wid > 0.8 * far) return false;           // open ground: a neck
    }
    return true;
  };
  for (const e of closest(hard.lab, 2 * K + 3 * gap)) {
    if (whole[e.ia] !== whole[e.ib] || !wedge(e, hard.toneOf[e.a])) continue;
    out.push({ kind: 'shapes', x: e.x, y: e.y, size: Math.sqrt(Math.min(hard.area[e.a], hard.area[e.b])) + K });
  }

  // The paper's edge. A shape that nearly reaches it, or just reaches it
  // (shrunk, it stops about k short); or one the edge cuts by a hair - it
  // runs off, but is much wider a little way in than where it is cut.
  const sides = [
    { side: 'top', len: w, at: (s, d) => d * w + s },
    { side: 'bottom', len: w, at: (s, d) => (h - 1 - d) * w + s },
    { side: 'left', len: h, at: (s, d) => s * w + d },
    { side: 'right', len: h, at: (s, d) => s * w + w - 1 - d },
  ];
  const reach = k + Math.max(4, Math.round(S / 50));
  for (const sd of sides) {
    const depth = sd.side === 'top' || sd.side === 'bottom' ? h : w;
    // For each shape: its first row in from this side, and how much of it
    // lies in the edge row and in the row `reach` in.
    const first = new Map(), rows = new Map();
    for (let d = 0; d <= Math.min(depth - 1, reach + 2); d++) {
      for (let s = 0; s < sd.len; s++) {
        const i = sd.at(s, d), a = lab[i];
        if (!a) continue;
        if (!first.has(a)) first.set(a, { d, pts: [] });
        const f = first.get(a);
        if (f.d === d) f.pts.push(i);
        if (d === 0 || d === reach) {
          const r = rows.get(a) || { edge: 0, in: 0 };
          if (d === 0) r.edge++; else r.in++;
          rows.set(a, r);
        }
      }
    }
    for (const [a, f] of first) {
      const r = rows.get(a) || { edge: 0, in: 0 };
      let hit = null;
      if (f.d === 0) {
        if (r.edge <= short(a) && r.in >= 2.5 * r.edge + 2) hit = 'cut';
      } else if (f.d <= reach && extent(f.pts) <= short(a)) hit = f.d <= k + 1.5 ? 'touch' : 'near';
      if (!hit) continue;
      const mid = f.pts[f.pts.length >> 1];
      let x = mid % w, y = (mid / w) | 0;
      if (sd.side === 'top') y = 0; else if (sd.side === 'bottom') y = h - 1;
      else if (sd.side === 'left') x = 0; else x = w - 1;
      out.push({ kind: 'frame', x, y, side: sd.side, how: hit, size: Math.sqrt(area[a]), tones: [toneOf[a]] });
    }
  }

  // One mark per place, the biggest shapes first.
  out.sort((a, b) => b.size - a.size);
  const kept = [];
  for (const t of out) if (!kept.some(u => Math.hypot(u.x - t.x, u.y - t.y) < S / 25)) kept.push(t);
  // Back in the picture read's pixels, the frame's marks on its very edge.
  for (const t of kept) {
    t.x = t.side === 'right' ? p.w - 1 : t.side === 'left' ? 0 : (t.x + 0.5) * f;
    t.y = t.side === 'bottom' ? p.h - 1 : t.side === 'top' ? 0 : (t.y + 0.5) * f;
    t.size *= f;
  }
  return { w: p.w, h: p.h, all: kept };
}

// The marks onto a canvas of the picture read's size (the page scales it):
// a ring round each place, and for the paper's edge a bar along it.
function tangentsDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const g = c.getContext('2d'), S = Math.max(m.w, m.h), R = S / 26;
  g.lineWidth = Math.max(2, S / 180);
  for (const t of m.all.slice(0, TAN_MAX)) {
    const col = t.kind === 'frame' ? TAN_FRAME : TAN_SHAPES;
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = Math.max(2, S / 180) + 2;
    g.beginPath(); g.arc(t.x, t.y, R, 0, 2 * Math.PI); g.stroke();
    g.strokeStyle = col;
    g.lineWidth = Math.max(2, S / 180);
    g.beginPath(); g.arc(t.x, t.y, R, 0, 2 * Math.PI); g.stroke();
    if (t.kind === 'frame') {
      g.lineWidth = Math.max(3, S / 110);
      g.beginPath();
      if (t.side === 'top' || t.side === 'bottom') { g.moveTo(t.x - 1.6 * R, t.y); g.lineTo(t.x + 1.6 * R, t.y); }
      else { g.moveTo(t.x, t.y - 1.6 * R); g.lineTo(t.x, t.y + 1.6 * R); }
      g.stroke();
    }
  }
  return c;
}

/* What the marks say, and what to do about them - short: the note sits
   over the picture, and a long one hides the lower marks. The why is in
   the help and the button's title. */
function tangentsVerdict(m) {
  const shown = m.all.slice(0, TAN_MAX);
  const shapes = shown.filter(t => t.kind === 'shapes').length, frame = shown.length - shapes;
  if (!shown.length) return 'No tangents: the big shapes overlap or stand clearly apart, and none just touches the edge.';
  const out = [];
  if (shapes) out.push(`<b class="tan-s">${shapes} pink</b> - two shapes just touch, and the depth goes flat: overlap them, or open a clear gap.`);
  if (frame) out.push(`<b class="tan-f">${frame} amber</b> - a shape just touches the paper's edge: move it in, or let it go clearly off.`);
  if (m.all.length > shown.length) out.push(`<small>${m.all.length - shown.length} smaller, not marked.</small>`);
  return out.join('<br>');
}

/* ---- in a session: the marks over the picture, as a layer. */
let tangentsRun = 0;

function clearTangents() {
  tangentsRun++;
  el('tanOverlay').classList.add('hidden');
  overlayNote('tangents', state.tangentsOn ? 'Looking for tangents...' : '');
}

function toggleTangents() {
  state.tangentsOn = !state.tangentsOn;
  el('btnTangents').setAttribute('aria-pressed', String(state.tangentsOn));
  clearTangents();
  if (state.tangentsOn) runTangents();
}

// A moment's work, so after a frame: the button shows pressed first.
function runTangents() {
  const img = el('img'), run = ++tangentsRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== tangentsRun || !state.tangentsOn) return;
    let m;
    try { m = tangentsOf(stepsRead(img)); }
    catch (err) { console.error('tangents:', err); overlayNote('tangents', '<i>Could not look for tangents in this picture.</i>'); return; }
    tangentsDraw(m, el('tanOverlay')).classList.remove('hidden');
    overlayNote('tangents', tangentsVerdict(m));
  }, 30);
}

el('btnTangents').addEventListener('click', toggleTangents);
