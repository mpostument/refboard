/* refboard - Vignette: a watercolour study often does not go to the edge of
   the paper. It is painted where it matters and thins out into bare paper
   round it - the vignette - so the eye stays on the focus and the paper
   itself finishes the picture. Where should it end?

   Worked out from the picture, in four steps:
   - interest: where there is something to look at - edges (the gradient of
     lightness), strong colour, and darkness against the paper - each
     divided by its own mean so no one drowns the others, then blurred into
     broad masses (the detail of a hair does not decide a shape);
   - the island: the places of most interest, taken in order until they hold
     the share asked for (Amount: Tight 62%, Medium 80%, Loose 92% of all the
     interest) - the smallest area that keeps most of the picture;
   - the shape: that area rounded (a blur and a threshold, so a stray speck
     of interest does not make an arm), and let out a little further than it
     was, since a vignette is painted past the last thing it keeps;
   - the edge: the paper is let in across a band, its edge shifted by noise -
     Soft for a wet edge that fades evenly, Ragged for the dry-brush edge a
     painter breaks it with.
   The note says what the shape is, which sides of the sheet it reaches (a
   vignette that runs off the paper there is a bleed, which is fine), and
   whether the picture's darkest accent is inside it - the one thing that
   should not be faded away. One of the classic scripts index.html loads in
   order; see the note there. */
"use strict";

const VG_KEY = 'refboard.vignette.v1';
// Amount: the share of the picture's interest the island keeps.
const VG_AMOUNT = {
  tight:  { chip: 'Tight',  label: 'a small island of picture, most of the sheet left paper', keep: 0.62 },
  medium: { chip: 'Medium', label: 'the main part of the picture, paper round it', keep: 0.8 },
  loose:  { chip: 'Loose',  label: 'most of the picture, only the edges let go', keep: 0.92 },
};
// Edge: how far noise shifts the fade's edge, in shares of the band.
const VG_EDGE = {
  soft:   { chip: 'Soft',   label: 'a wet edge that fades evenly', rag: 0.1 },
  ragged: { chip: 'Ragged', label: 'a dry-brush edge, broken', rag: 0.34 },
};
const VG_DEFAULT = { amount: 'medium', edge: 'soft' };
const VG_LINE = [190, 85, 55];

function vgLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(VG_KEY));
    if (v && typeof v === 'object') {
      return { amount: VG_AMOUNT[v.amount] ? v.amount : VG_DEFAULT.amount, edge: VG_EDGE[v.edge] ? v.edge : VG_DEFAULT.edge };
    }
  } catch { /* fall through */ }
  return { ...VG_DEFAULT };
}
function vgSave(c) {
  try { localStorage.setItem(VG_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

const vgSmooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// Where there is something to look at, 0 and up, blurred into masses.
function vgInterest(p) {
  const { w, h, rgba, L } = p, n = w * h, S = Math.max(w, h);
  const Ls = stepsBlur(L, w, h, 1);
  const grad = new Float32Array(n), chroma = new Float32Array(n), dark = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      grad[i] = Math.hypot(Ls[i + 1] - Ls[i - 1], Ls[i + w] - Ls[i - w]);
    }
  }
  for (let i = 0; i < n; i++) {
    chroma[i] = Math.max(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]) - Math.min(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
    dark[i] = Math.max(0, 100 - L[i]);
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / n || 1;
  const parts = [[grad, 0.5], [chroma, 0.25], [dark, 0.25]].map(([a, k]) => { const m = mean(a); return [a, k / m, 6 * m]; });
  const raw = new Float32Array(n);
  for (const [a, k, cap] of parts) for (let i = 0; i < n; i++) raw[i] += Math.min(a[i], cap) * k;
  return stepsBlur(raw, w, h, Math.max(3, S / 28));
}

/* p: stepsRead(). c: { amount, edge }. The island: keep, how much of each
   pixel stays picture (0-1), and what to say about it. */
function vgShape(p, c) {
  const { w, h, L } = p, n = w * h, S = Math.max(w, h);
  const A = VG_AMOUNT[c.amount] || VG_AMOUNT.medium, E = VG_EDGE[c.edge] || VG_EDGE.soft;
  const I = vgInterest(p);

  // The most interesting places first, until they hold what was asked for.
  const sorted = Float32Array.from(I).sort();
  let total = 0;
  for (const v of sorted) total += v;
  let acc = 0, t = sorted[n - 1];
  for (let i = n - 1; i >= 0; i--) { acc += sorted[i]; t = sorted[i]; if (acc >= A.keep * total) break; }
  const island = new Float32Array(n);
  for (let i = 0; i < n; i++) island[i] = I[i] >= t ? 1 : 0;

  // Rounded - no arms from a stray speck - then let out a little further.
  const round = stepsBlur(island, w, h, Math.max(3, S / 25));
  for (let i = 0; i < n; i++) island[i] = round[i] > 0.5 ? 1 : 0;
  const out = stepsBlur(island, w, h, Math.max(3, S / 14));

  // The paper let in across a band, its edge shifted by noise.
  const big = wcNoise(w, h, Math.max(6, S / 14), 91), fine = wcNoise(w, h, Math.max(3, S / 45), 53);
  const keep = new Float32Array(n);
  for (let i = 0; i < n; i++) keep[i] = vgSmooth(0.12, 0.5, out[i] + ((0.6 * (big[i] - 0.5) + 0.4 * (fine[i] - 0.5)) * 2) * E.rag * 0.5);

  // What the shape is.
  let cnt = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) if (keep[i] > 0.5) { cnt++; sx += i % w; sy += (i / w) | 0; }
  const cx = cnt ? sx / cnt : w / 2, cy = cnt ? sy / cnt : h / 2;
  let xx = 0, yy = 0, xy = 0;
  for (let i = 0; i < n; i++) if (keep[i] > 0.5) { const dx = (i % w) - cx, dy = ((i / w) | 0) - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  const tr = xx + yy, det = Math.sqrt(Math.max(0, ((xx - yy) / 2) ** 2 + xy * xy));
  const l1 = tr / 2 + det, l2 = Math.max(1e-6, tr / 2 - det);
  const aspect = Math.sqrt(l1 / l2), angle = Math.atan2(2 * xy, xx - yy) / 2 * 180 / Math.PI; // y down

  // Which sides of the sheet it reaches: a strip along each, a quarter of it picture.
  const strip = Math.max(2, Math.round(S / 100)), reach = { left: 0, right: 0, top: 0, bottom: 0 };
  for (let y = 0; y < h; y++) for (let k = 0; k < strip; k++) { reach.left += keep[y * w + k] > 0.5; reach.right += keep[y * w + w - 1 - k] > 0.5; }
  for (let x = 0; x < w; x++) for (let k = 0; k < strip; k++) { reach.top += keep[k * w + x] > 0.5; reach.bottom += keep[(h - 1 - k) * w + x] > 0.5; }
  const touches = Object.entries(reach).filter(([side, v]) => v / (strip * (side === 'left' || side === 'right' ? h : w)) >= 0.25).map(([side]) => side);

  // The darkest accent (a little blurred, so not one dark pixel), and whether it stays.
  const Lb = stepsBlur(L, w, h, 2);
  let di = 0;
  for (let i = 1; i < n; i++) if (Lb[i] < Lb[di]) di = i;
  const dark = { x: di % w, y: (di / w) | 0, L: Lb[di], inside: keep[di] > 0.5 };

  return { w, h, keep, area: cnt / n * 100, cx, cy, aspect, angle, touches, dark };
}

// Round, upright, wide, or leaning - and which way.
function vgName(m) {
  if (m.aspect < 1.3) return 'a roundish island';
  const a = m.angle; // -90..90, y down: negative leans up to the right
  if (Math.abs(a) < 20) return 'a wide oval';
  if (Math.abs(a) > 70) return 'an upright oval';
  return a < 0 ? 'an oval rising to the right' : 'an oval falling to the right';
}
function vgWhere(m) {
  const col = m.cx < m.w * 0.4 ? 'left' : m.cx > m.w * 0.6 ? 'right' : '', row = m.cy < m.h * 0.4 ? 'upper' : m.cy > m.h * 0.6 ? 'lower' : '';
  return row && col ? `${row} ${col}` : row || col || 'the middle';
}

// The island drawn: paper over what is let go, and the shape's edge in a line.
function vgDraw(m, c) {
  const { w, h, keep } = m;
  c.width = w; c.height = h;
  const P = wcPaper(), img = new ImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) {
    d[4 * i] = P[0]; d[4 * i + 1] = P[1]; d[4 * i + 2] = P[2];
    d[4 * i + 3] = (1 - keep[i]) * 0.94 * 255;
    if (Math.abs(keep[i] - 0.5) < 0.035) { d[4 * i] = VG_LINE[0]; d[4 * i + 1] = VG_LINE[1]; d[4 * i + 2] = VG_LINE[2]; d[4 * i + 3] = 230; }
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function vgNote(m, c) {
  const row = (name, key, table) => `<div class="tone-bar"><span>${name}</span>` + Object.entries(table).map(([k, o]) =>
    `<button type="button" class="chip" data-vg="${key}:${k}" aria-pressed="${c[key] === k}" title="${esc(o.label)}">${o.chip}</button>`).join('') + '</div>';
  const sides = m.touches.length
    ? `It reaches the ${m.touches.join(' and ')} of the sheet - there the picture runs off the paper, a bleed, which is fine; let the other sides dissolve.`
    : 'It reaches no side of the sheet: paper all round it, so leave a margin for it.';
  const dark = m.dark.inside
    ? "The picture's darkest accent is inside it - keep it, and the sharpest edge, there."
    : "<b>The picture's darkest accent falls outside it</b> - the one thing a vignette should not fade away. Move the island toward it (Loose) or let it be part of the picture.";
  return row('Amount', 'amount', VG_AMOUNT) + row('Edge', 'edge', VG_EDGE) +
    `<b>${Math.round(m.area)}% of the sheet is picture</b> - ${vgName(m)} in the ${vgWhere(m)}, the rest bare paper. ${sides} ${dark} ` +
    `Paint the focus first, then thin the wash toward the paper with a damp brush, working outward from the middle - and let the edge sit where the picture is lightest and plainest. ` +
    `<small>A suggestion from where the edges, colour and darks gather - the line is the island's edge.</small>`;
}

/* ---- in a session: the vignette over the picture, as a layer. */
let vgRun = 0, vgCache = { src: '', p: null };

function clearVignette() {
  vgRun++;
  el('vignetteOverlay').classList.add('hidden');
  overlayNote('vignette', state.vignetteOn ? 'Finding the vignette...' : '');
}

function toggleVignette() {
  state.vignetteOn = !state.vignetteOn;
  el('btnVignette').setAttribute('aria-pressed', String(state.vignetteOn));
  clearVignette();
  if (state.vignetteOn) runVignette();
}

// A moment's work, so after a frame: the button shows pressed first.
function runVignette() {
  const img = el('img'), run = ++vgRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== vgRun || !state.vignetteOn) return;
    let m;
    const c = vgLoad();
    try {
      const src = img.currentSrc || img.src;
      if (vgCache.src !== src) vgCache = { src, p: stepsRead(img) };
      m = vgShape(vgCache.p, c);
    } catch (err) { console.error('vignette:', err); overlayNote('vignette', '<i>Could not find a vignette for this picture.</i>'); return; }
    vgDraw(m, el('vignetteOverlay')).classList.remove('hidden');
    overlayNote('vignette', vgNote(m, c));
  }, 30);
}

el('btnVignette').addEventListener('click', toggleVignette);
el('poseNote').addEventListener('click', e => {
  const b = e.target.closest('[data-vg]');
  if (!b) return;
  const [key, value] = b.dataset.vg.split(':'), c = vgLoad();
  if (key === 'amount' && VG_AMOUNT[value]) c.amount = value;
  else if (key === 'edge' && VG_EDGE[value]) c.edge = value;
  else return;
  vgSave(c);
  runVignette();
});
