/* refboard - Symmetry check: a picture folded on a vertical axis, and where
   its two halves part. For a drawing that should be symmetrical - a face, a
   vase, a building seen square on - it is the quickest honest test: the eye
   forgives a crooked eye, a mirror does not.

   The axis is found, not assumed. A drawing is rarely centred on its sheet, so
   the middle of the page is the wrong fold. Every fold within the middle of the
   picture is tried, each scored by how little the picture differs from its own
   mirror over the part both sides share, and the best wins - a fold may be
   moved by hand after (the note's arrows), since a face turned a little has two
   halves that never quite agree, and which fold is "right" is then a choice.

   What is compared is value (L*), softened by a small blur so that a line a hair
   out of place does not read as a mismatch, only a shape that is. Where the two
   differ by more than SYM_PART the map is pink. Its note says how much parts,
   which half is darker, which reaches farther from the fold, and where the
   worst of it is - top, middle or bottom.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// How far apart, in L*, two mirrored places must be to count as parting.
const SYM_PART = 14;
// The fold is searched between these fractions of the width; a fold must
// leave at least SYM_SHARE of the width to compare on each side, or one near
// an edge, where almost nothing is compared, would always win.
const SYM_FROM = 0.25, SYM_TO = 0.75, SYM_SHARE = 0.2;
const SYM_COLOR = [255, 70, 190];

// p's value, blurred by a few pixels - a box from the integral image.
function symSoft(p) {
  const { w, h, L } = p, W = w + 1, s = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let a = 0;
    for (let x = 0; x < w; x++) { a += L[y * w + x]; s[(y + 1) * W + x + 1] = s[y * W + x + 1] + a; }
  }
  const r = Math.max(1, Math.round(Math.max(w, h) / 140)), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      out[y * w + x] = (s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/* The mean difference between the picture and its mirror about the fold at
   column `a` (a pixel's centre is x + 0.5, so a fold is a whole column's edge
   when `a` is a whole number), over the columns both sides have. Every
   second row: it is a search, and rows next to each other say the same. */
function symCost(S, w, h, a) {
  const half = Math.min(a, w - a), n = Math.floor(half);
  let sum = 0, cnt = 0;
  for (let y = 0; y < h; y += 2) {
    const o = y * w;
    for (let d = 0; d < n; d++) { sum += Math.abs(S[o + a - 1 - d] - S[o + a + d]); cnt++; }
  }
  return cnt ? sum / cnt : Infinity;
}

// The best fold, as a column (0..w), searched from SYM_FROM to SYM_TO.
function symFindAxis(S, w, h) {
  let best = w / 2, bestCost = Infinity;
  const lo = Math.max(Math.ceil(w * SYM_FROM), Math.ceil(w * SYM_SHARE)), hi = Math.min(Math.floor(w * SYM_TO), Math.floor(w * (1 - SYM_SHARE)));
  for (let a = lo; a <= hi; a++) {
    const c = symCost(S, w, h, a);
    if (c < bestCost) { bestCost = c; best = a; }
  }
  return best;
}

/* p: stepsRead(). axis: the fold as a fraction of the width, or null to find
   it. Gives the fold (`axis`, a fraction; `found` whether it was searched),
   the map (`diff`: |left - mirrored right| in L*, per pixel, 0 where there is
   nothing to compare) and what it adds up to:
     parting   the share of the drawing - the pairs where either side differs from
               the ground round the picture's edge - that differs from its mirror by
               more than SYM_PART. Not the share of the sheet: a small error on a big
               empty sheet would never show;
     darker    which half has more dark in it - 'left', 'right' or null (within 3%);
     reach     which half the picture's own dark mass runs farther from the fold on;
     thirds    parting in the top, middle and bottom third of the picture.
   Left and right are the picture's, not the figure's. */
function symmetryOf(p, axis = null) {
  const { w, h } = p, S = symSoft(p);
  const found = axis === null;
  const a = found ? symFindAxis(S, w, h) : Math.max(1, Math.min(w - 1, Math.round(axis * w)));
  const n = Math.floor(Math.min(a, w - a)), diff = new Float32Array(w * h);
  let part = 0, cnt = 0, dl = 0, dr = 0;
  // The ground: the middle value of the picture's own edge - the paper, for a
  // drawing photographed on it.
  const ring = [];
  for (let x = 0; x < w; x++) ring.push(S[x], S[(h - 1) * w + x]);
  for (let y = 1; y < h - 1; y++) ring.push(S[y * w], S[y * w + w - 1]);
  ring.sort((u, v) => u - v);
  const ground = ring[ring.length >> 1], onGround = v => Math.abs(v - ground) < SYM_PART / 2;
  const thirds = [[0, 0], [0, 0], [0, 0]];
  const mean = S.reduce((s, v) => s + v, 0) / S.length;
  for (let y = 0; y < h; y++) {
    const t = Math.min(2, Math.floor(y * 3 / h)), o = y * w;
    for (let d = 0; d < n; d++) {
      const l = S[o + a - 1 - d], r = S[o + a + d], v = Math.abs(l - r);
      diff[o + a - 1 - d] = diff[o + a + d] = v;
      if (!onGround(l) || !onGround(r)) {
        cnt++; thirds[t][1]++;
        if (v > SYM_PART) { part++; thirds[t][0]++; }
      }
      // How much darker than the picture's middle each side is.
      dl += Math.max(0, mean - l); dr += Math.max(0, mean - r);
    }
  }
  const total = dl + dr;
  const darker = total > 0 && Math.abs(dl - dr) / total > 0.03 ? (dl > dr ? 'left' : 'right') : null;
  // How far from the fold the dark mass reaches: the furthest column, either
  // side, where a column holds a real share of dark (more than 1% of its height
  // darker than the middle by a clear step).
  const reachOf = side => {
    let far = 0;
    for (let d = 0; d < Math.max(a, w - a); d++) {
      const x = side === 'left' ? a - 1 - d : a + d;
      if (x < 0 || x >= w) break;
      let c = 0;
      for (let y = 0; y < h; y++) if (S[y * w + x] < mean - 18) c++;
      if (c > 0.01 * h) far = d + 1;
    }
    return far;
  };
  const rl = reachOf('left'), rr = reachOf('right');
  const reach = Math.abs(rl - rr) / Math.max(rl, rr, 1) > 0.05 ? (rl > rr ? 'left' : 'right') : null;
  return {
    w, h, axis: a / w, found, diff, n,
    // Nothing but ground on the fold (under half a percent): nothing to compare.
    parting: cnt > 0.005 * n * h ? part / cnt : 0, darker, reach, reachBy: Math.abs(rl - rr) / Math.max(rl, rr, 1),
    thirds: thirds.map(([x, c]) => c ? x / c : 0),
  };
}

// The map onto a canvas of the picture read's size (the page scales it):
// pink where the halves part, as strong as they differ; the fold in amber.
function symmetryDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const img = new ImageData(m.w, m.h), d = img.data;
  for (let i = 0; i < m.diff.length; i++) {
    const v = m.diff[i];
    if (v <= SYM_PART) continue;
    d[4 * i] = SYM_COLOR[0]; d[4 * i + 1] = SYM_COLOR[1]; d[4 * i + 2] = SYM_COLOR[2];
    d[4 * i + 3] = Math.min(210, 70 + (v - SYM_PART) * 3);
  }
  const g = c.getContext('2d');
  g.putImageData(img, 0, 0);
  const x = m.axis * m.w;
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = Math.max(3, m.w / 150) + 2;
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, m.h); g.stroke();
  g.strokeStyle = 'rgb(255, 196, 40)'; g.lineWidth = Math.max(3, m.w / 150);
  g.setLineDash([m.h / 40, m.h / 80]);
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, m.h); g.stroke();
  return c;
}

const symPct = v => v < 0.005 ? 'under 1%' : Math.round(v * 100) + '%';

// What the map says, and what to do - short: it sits over the picture.
function symmetryVerdict(m) {
  const pct = m.parting * 100, names = ['top', 'middle', 'bottom'];
  const out = [];
  if (pct < 3) out.push(`<b class="sym-ok">The halves agree</b> - ${symPct(m.parting)} of the drawing differs from its mirror. Symmetrical to the eye.`);
  else {
    out.push(`<b class="sym-p">${symPct(m.parting)} of the drawing differs</b> from its mirror - the pink is where the two halves part.`);
    const worst = m.thirds.indexOf(Math.max(...m.thirds));
    if (m.thirds[worst] > 0.06 && m.thirds[worst] > 1.4 * Math.min(...m.thirds))
      out.push(`Most of it in the <b>${names[worst]}</b> third.`);
  }
  if (m.reach) out.push(`The <b>${m.reach}</b> half runs ${Math.round(m.reachBy * 100)}% farther from the fold.`);
  if (m.darker && pct >= 3) out.push(`The <b>${m.darker}</b> half is the darker.`);
  return out.join('<br>');
}

// The fold's controls, then the verdict.
function symmetryNote(m) {
  return `<div class="sym-bar"><span>Fold</span>` +
    `<button type="button" class="chip" data-sym-nudge="-1" aria-label="Move the fold left" title="Move the fold left (1% of the width)">◂</button>` +
    `<button type="button" class="chip" data-sym-nudge="1" aria-label="Move the fold right" title="Move the fold right (1% of the width)">▸</button>` +
    `<button type="button" class="chip" data-sym-find aria-pressed="${m.found}" title="Search for the fold that makes the halves agree best">Find it</button>` +
    `<button type="button" class="chip" data-sym-mid title="Fold at the middle of the sheet">Middle</button>` +
    `<span class="sym-at">${Math.round(m.axis * 100)}%</span></div>` +
    `<b class="sym-p">Pink</b> - the halves part. <b class="sym-f">Amber</b> - the fold.<br>` + symmetryVerdict(m);
}

/* ---- in a session: the map over the picture, as a layer. */
let symRun = 0;
// The fold chosen by hand, as a fraction of the width; null while it is found.
let symAxis = null;

function clearSymmetry() {
  symRun++;
  symAxis = null;     // a new picture, or off and on again, is folded afresh
  el('symOverlay').classList.add('hidden');
  overlayNote('symmetry', state.symmetryOn ? 'Folding the picture...' : '');
}

function toggleSymmetry() {
  state.symmetryOn = !state.symmetryOn;
  el('btnSymmetry').setAttribute('aria-pressed', String(state.symmetryOn));
  clearSymmetry();
  if (state.symmetryOn) runSymmetry();
}

// A moment's work, so after a frame: the button shows pressed first.
function runSymmetry() {
  const img = el('img'), run = ++symRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== symRun || !state.symmetryOn) return;
    let m;
    try { m = symmetryOf(stepsRead(img), symAxis); }
    catch (err) { console.error('symmetry:', err); overlayNote('symmetry', '<i>Could not fold this picture.</i>'); return; }
    symmetryDraw(m, el('symOverlay')).classList.remove('hidden');
    overlayNote('symmetry', symmetryNote(m));
    symLast = m.axis;
  }, 30);
}
let symLast = 0.5;

el('btnSymmetry').addEventListener('click', toggleSymmetry);
el('poseNote').addEventListener('click', e => {
  if (!state.symmetryOn) return;
  const nudge = e.target.closest('[data-sym-nudge]');
  if (nudge) { symAxis = Math.max(0.2, Math.min(0.8, (symAxis ?? symLast) + 0.01 * Number(nudge.dataset.symNudge))); runSymmetry(); }
  else if (e.target.closest('[data-sym-find]')) { symAxis = null; runSymmetry(); }
  else if (e.target.closest('[data-sym-mid]')) { symAxis = 0.5; runSymmetry(); }
});
