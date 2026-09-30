/* refboard - Edge map: over the picture, which edges are hard and which are
   soft - where a watercolour is laid on dry paper, and where it is run in
   wet. The Edges trainer teaches it on grey shapes; this puts it on the
   picture being painted.

   Hardness is how quickly the change across an edge happens, not how big it
   is (the trainer's lesson). So each edge is measured twice: its contrast -
   how much the colour differs either side of it, looking out only as far as
   it takes to see most of the change - and its steepest step, from one
   pixel to the next. Contrast over step is the edge's width in pixels: a
   hard edge makes the whole change at once, in three or four (the slight
   blur taken first to quiet the noise); a soft one takes ten or more.

   The line art is taken out first: its every line would be two hard edges,
   one each side, and bury the map - and the lines are drawn anyway. What is
   left is the edges between the washes, which is what is to be decided.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const EDGE_HARD = [255, 84, 112], EDGE_SOFT = [80, 190, 255];
// Less than this across it (L*, 0-100) is not an edge worth painting.
const EDGE_MIN_CONTRAST = 9;
// Wider than this, in pixels of the picture read at STEPS_SIDE, is soft.
const EDGE_HARD_WIDTH = 6;

/* Thin dark lines out: a closing - the lightest pixel round each, then the
   darkest of those - takes away a dark line narrower than the window and
   leaves a dark area its own size. It keeps, for each pixel, which pixel its
   value came from, so a line takes the whole colour of the wash beside it,
   not only its lightness. In rows, then columns: a square window is the two. */
function edgeClose(L, w, h, r) {
  const n = w * h;
  let from = Int32Array.from({ length: n }, (_, i) => i);
  const pass = (lighter, step, len, lines, stride) => {
    const out = new Int32Array(n);
    for (let a = 0; a < lines; a++) {
      for (let b = 0; b < len; b++) {
        let best = from[a * stride + b * step];
        for (let d = -r; d <= r; d++) {
          const c = from[a * stride + Math.min(len - 1, Math.max(0, b + d)) * step];
          if (lighter ? L[c] > L[best] : L[c] < L[best]) best = c;
        }
        out[a * stride + b * step] = best;
      }
    }
    from = out;
  };
  for (const lighter of [true, false]) { pass(lighter, 1, w, h, w); pass(lighter, w, h, w, 1); }
  return from;
}

/* The picture with its line art out, as three channels lightly blurred -
   ch: value and two colour-opponents - and at each pixel the steepest step
   G and the direction across the edge (NX, NY). Line weight (linework.js)
   starts from the same. */
function edgeGradient(p) {
  const { w, h, rgba } = p, n = w * h;
  const from = edgeClose(p.L, w, h, 2);
  // Value, and two colour-opponent channels at half weight: a red against
  // a green of the same value is an edge to paint too.
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = from[i], r = rgba[4 * j], g = rgba[4 * j + 1], b = rgba[4 * j + 2];
    L[i] = p.L[j];
    A[i] = (r - g) / 255 * 25;
    B[i] = ((r + g) / 2 - b) / 255 * 25;
  }
  const ch = [stepsBlur(L, w, h, 1), stepsBlur(A, w, h, 1), stepsBlur(B, w, h, 1)];

  // The steepest step at each pixel, and the direction across the edge -
  // one for all three channels (Di Zenzo's), so a value edge and a hue
  // edge in the same place are one edge, not two.
  const G = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let xx = 0, yy = 0, xy = 0;
      for (const c of ch) {
        const gx = (c[i + 1] - c[i - 1]) / 2, gy = (c[i + w] - c[i - w]) / 2;
        xx += gx * gx; yy += gy * gy; xy += gx * gy;
      }
      G[i] = Math.sqrt((xx + yy + Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)) / 2);
      const t = Math.atan2(2 * xy, xx - yy) / 2;
      NX[i] = Math.cos(t); NY[i] = Math.sin(t);
    }
  }
  return { ch, G, NX, NY };
}

/* Every edge worth painting, and how hard it is. p: stepsRead(). kind:
   per pixel, 0 no edge, 1 hard, 2 soft; hard and soft: how many of each. */
function edgeMap(p) {
  const { w, h } = p, n = w * h;
  const { ch, G, NX, NY } = edgeGradient(p);

  // On the crest of each edge only (a line one pixel wide), its width.
  const R = Math.max(8, Math.round(Math.max(w, h) / 50));
  const dists = [2, 3, 4, 6, 8, 11, 15, 20].filter(d => d <= R);
  const at = (c, x, y) => c[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const width = new Float32Array(n);
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x, g = G[i];
      if (g < 0.8) continue;
      const nx = NX[i], ny = NY[i], o = Math.round(ny) * w + Math.round(nx);
      if (g < G[i + o] || g <= G[i - o]) continue;
      const across = dists.map(d => Math.hypot(...ch.map(c => at(c, x + nx * d, y + ny * d) - at(c, x - nx * d, y - ny * d))));
      const most = Math.max(...across);
      if (most < EDGE_MIN_CONTRAST) continue;
      // Not the most: a hard shadow edge on a shaded ball would have the
      // ball's own gradient added to it, and look soft.
      width[i] = across.find(v => v >= 0.8 * most) / g;
    }
  }

  // Specks and stubs out: a painter sees an edge, not a pixel.
  const minRun = Math.max(5, Math.round(Math.max(w, h) / 60));
  const seen = new Uint8Array(n), stack = new Int32Array(n), run = [];
  for (let s = 0; s < n; s++) {
    if (!width[s] || seen[s]) continue;
    run.length = 0;
    let top = 0;
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top], x = i % w;
      run.push(i);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * w + dx;
          if ((dx || dy) && x + dx >= 0 && x + dx < w && j >= 0 && j < n && width[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
        }
      }
    }
    if (run.length < minRun) for (const i of run) width[i] = 0;
  }

  // Each point judged with its neighbours along the edge, so one edge does
  // not flicker hard-soft-hard pixel by pixel.
  const kind = new Uint8Array(n);
  let hard = 0, soft = 0;
  const limit = Math.log(EDGE_HARD_WIDTH);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!width[i]) continue;
      let sum = 0, k = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const v = width[yy * w + xx];
          if (v) { sum += Math.log(v); k++; }
        }
      }
      if (sum / k <= limit) { kind[i] = 1; hard++; } else { kind[i] = 2; soft++; }
    }
  }
  return { w, h, kind, hard, soft };
}

// The map drawn onto a canvas of the picture's size, two pixels thick so it
// reads when the picture is shown larger.
function edgeDraw(m, c) {
  const img = new ImageData(m.w, m.h), d = img.data;
  for (let i = 0; i < m.kind.length; i++) {
    const k = m.kind[i];
    if (!k) continue;
    const col = k === 1 ? EDGE_HARD : EDGE_SOFT, x = i % m.w;
    for (const j of [i, x < m.w - 1 ? i + 1 : -1, i + m.w < m.kind.length ? i + m.w : -1]) {
      if (j < 0 || (d[4 * j + 3] && m.kind[j] === 1)) continue; // hard wins where they touch
      d[4 * j] = col[0]; d[4 * j + 1] = col[1]; d[4 * j + 2] = col[2]; d[4 * j + 3] = 255;
    }
  }
  // Through a second canvas: putImageData would replace what is under it.
  const t = document.createElement('canvas');
  t.width = m.w; t.height = m.h;
  t.getContext('2d').putImageData(img, 0, 0);
  c.getContext('2d').drawImage(t, 0, 0, c.width, c.height);
  return c;
}

// How a hard and a soft edge are made, in a medium's own terms. paint:
// MATERIALS' paint - 'water', 'opaque', or null for dry media and ink.
function edgeWords(paint) {
  if (paint === 'water') return { hard: 'laid on dry paper - the brush leaves it sharp',
    soft: 'run in wet-in-wet, or softened with a damp brush before it dries' };
  if (paint === 'opaque') return { hard: 'one clean stroke, left alone', soft: 'blended into its neighbour while both are wet' };
  return { hard: 'a firm line, or hatching that stops clean', soft: 'tone that fades out - hatching thinning away, or smudged' };
}

// What the map says, for someone about to paint it.
function edgeVerdict(m) {
  const all = m.hard + m.soft;
  if (!all) return 'No edge here is strong enough to map - the picture is one soft, even tone.';
  const pct = Math.round(m.hard / all * 100);
  if (pct >= 70) return `Nearly every edge is hard (${pct}%) - the look of line art and cel shading. In paint, keep the hard ones round the face and the eyes, and let some of the rest go soft: the eye goes where the edges are sharpest.`;
  if (pct <= 30) return `Mostly soft - ${pct}% hard. A few hard edges where you want the eye to go will hold it together.`;
  return `A mix - ${pct}% of the edges hard. The hard ones pull the eye: check they are where the picture is about.`;
}

/* ---- in a session: the map over the picture, as a layer. */
let edgeRun = 0;

function clearEdges() {
  edgeRun++;
  el('edgeOverlay').classList.add('hidden');
  overlayNote('edges', state.edgesOn ? 'Finding the edges...' : '');
}

function toggleEdges() {
  state.edgesOn = !state.edgesOn;
  el('btnEdges').setAttribute('aria-pressed', String(state.edgesOn));
  clearEdges();
  if (state.edgesOn) runEdges();
}

// A moment's work, so after a frame: the button shows pressed first.
function runEdges() {
  const img = el('img'), run = ++edgeRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== edgeRun || !state.edgesOn) return;
    let m;
    try { m = edgeMap(stepsRead(img)); }
    catch (err) { console.error('edges:', err); overlayNote('edges', '<i>Could not read the edges of this picture.</i>'); return; }
    const c = el('edgeOverlay');
    c.width = m.w; c.height = m.h;
    edgeDraw(m, c);
    c.classList.remove('hidden');
    const words = edgeWords(mainMaterial()?.paint ?? 'water');
    overlayNote('edges', `<b class="edge-h">Hard</b> - ${esc(words.hard)}. <b class="edge-s">Soft</b> - ${esc(words.soft)}.<br>${esc(edgeVerdict(m))}`);
  }, 30);
}

el('btnEdges').addEventListener('click', toggleEdges);
