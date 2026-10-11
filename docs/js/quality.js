/* refboard - Reference check: is this a good picture to work from?
   A poor reference costs an hour before you know it: a flash that flattened
   the form, a sky that is only white, a photo too small to see an eye in. The
   checks here read the pixels and say so before the first line.

   Five things, each an ok, a "with care" or a poor:
     highlights   pixels that are pure white - detail there is gone, not just
                  light - and the same for pure black shadows. A plain
                  backdrop is not that: clipped pixels that the picture's own
                  edge reaches are counted apart, so a white studio background
                  (or a black one) does not mark a good photo down;
     light        the spread of lightness from the 2nd to the 98th percentile.
                  Flat light (a flash, an overcast haze) leaves the shadows
                  saying nothing of the form;
     sharpness    the steepest edge found (the top half-percent of the lightness
                  gradient, in L* per pixel at the 560 px the page reads at).
                  The sharpest edge, not the average, so a soft-focus portrait
                  with one crisp eye passes - that is the part to draw from;
     size         the long side of the file as it came.
   The limits are estimates, tuned by eye on a handful of photos, not measured
   against a body of references; the note says so. The overlay marks the lost
   highlights in pink and the lost shadows in blue.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const QC_WHITE = 250;     // a channel at or above this, in all three: pure white
const QC_BLACK = 6;       // ... at or below this, in all three: pure black
const QC_LOST = [1.5, 6]; // % of the picture lost: past the first "with care", past the second poor
const QC_SPREAD = [45, 30];   // L* from darkest to lightest: under the first "with care", under the second poor
const QC_SHARP = [10, 5];     // L* per pixel at the steepest edge: under the first "with care", under the second poor
const QC_SIZE = [1200, 700];  // the long side, px

const qcPct = v => v < 0.1 ? '<0.1%' : v < 1 ? v.toFixed(1) + '%' : Math.round(v) + '%';
// 'ok', 'warn' or 'bad' for a value against two limits; `less` when smaller is worse.
const qcLevel = (v, [a, b], less) => less ? (v >= a ? 'ok' : v >= b ? 'warn' : 'bad') : (v < a ? 'ok' : v < b ? 'warn' : 'bad');

/* The pixels of one kind of loss, split into those a backdrop explains (joined
   to the picture's edge through pixels of the same kind) and the rest. */
function qcSplit(flag, w, h) {
  const px = w * h, back = new Uint8Array(px), stack = new Int32Array(px);
  let top = 0, total = 0, kept = 0;
  const seed = i => { if (flag[i] && !back[i]) { back[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (top) {
    const i = stack[--top], x = i % w;
    if (x) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < px - w) seed(i + w);
  }
  for (let i = 0; i < px; i++) if (flag[i]) { total++; if (back[i]) kept++; }
  return { back, lost: total - kept, backdrop: kept };
}

/* p: stepsRead(). Gives the five measurements, the overlay's two masks and
   `checks`: [{ id, level, label, text }] in the order they are shown, with a
   one-line `verdict` over them. */
function qualityOf(p) {
  const { w, h, rgba, L } = p, px = w * h;
  const white = new Uint8Array(px), black = new Uint8Array(px);
  for (let i = 0; i < px; i++) {
    const r = rgba[4 * i], g = rgba[4 * i + 1], b = rgba[4 * i + 2];
    if (r >= QC_WHITE && g >= QC_WHITE && b >= QC_WHITE) white[i] = 1;
    else if (r <= QC_BLACK && g <= QC_BLACK && b <= QC_BLACK) black[i] = 1;
  }
  const hi = qcSplit(white, w, h), lo = qcSplit(black, w, h);
  const blown = hi.lost / px * 100, crushed = lo.lost / px * 100;
  const backWhite = hi.backdrop / px * 100, backBlack = lo.backdrop / px * 100;

  const sorted = Float32Array.from(L).sort();
  const p02 = sorted[Math.floor(px * 0.02)], p98 = sorted[Math.min(px - 1, Math.floor(px * 0.98))];
  const spread = p98 - p02;

  // The steepest edge (the top half-percent of pixels): a histogram of the gradient (0.25 L* a bin up to 60).
  const bins = new Uint32Array(241);
  let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = (L[i + 1] - L[i - 1]) / 2, gy = (L[i + w] - L[i - w]) / 2;
    bins[Math.min(240, Math.round(Math.hypot(gx, gy) * 4))]++; n++;
  }
  let acc = 0, sharp = 0;
  for (let b = 240; b >= 0; b--) { acc += bins[b]; if (acc >= n * 0.005) { sharp = b / 4; break; } }

  const nat = p.img ? Math.max(p.img.naturalWidth || p.img.width, p.img.naturalHeight || p.img.height) : Math.max(w, h);
  const side = p.img ? `${p.img.naturalWidth || p.img.width} x ${p.img.naturalHeight || p.img.height}` : `${w} x ${h}`;

  const back = (white, k) => white > 5 ? ` The plain ${k} round it (${qcPct(white)}) is not counted.` : '';
  const checks = [];
  const lost = (id, label, word, v, bd, fix) => {
    const level = qcLevel(v, QC_LOST);
    checks.push({ id, level, label, text: level === 'ok'
      ? `${qcPct(v)} is pure ${word}.${back(bd, word === 'white' ? 'white' : 'black')}`
      : `${qcPct(v)} is pure ${word} - the form is gone there, and what to draw in it is a guess. ${fix}` });
  };
  lost('highlights', 'Highlights', 'white', blown, backWhite, 'Look for the same subject in softer light, or draw those parts from another picture.');
  lost('shadows', 'Shadows', 'black', crushed, backBlack, 'The darks hold no shapes; decide them yourself, and keep them as one mass.');

  const lightLevel = qcLevel(spread, QC_SPREAD, true);
  checks.push({ id: 'light', level: lightLevel, label: 'Light', text: lightLevel === 'ok'
    ? `Values run over ${Math.round(spread)} L* - enough light and dark to show the form.`
    : `Values run over only ${Math.round(spread)} L*: a flat light (a flash, an overcast haze). The shadows say nothing of the form - plan your own value structure.` });

  const sharpLevel = qcLevel(sharp, QC_SHARP, true);
  checks.push({ id: 'sharpness', level: sharpLevel, label: 'Focus', text: sharpLevel === 'ok'
    ? 'There are crisp edges in it - the picture is in focus somewhere.'
    : sharpLevel === 'warn' ? 'The sharpest edge is a little soft: shake or a long lens. Fine for shapes, thin for small detail.'
      : 'No crisp edge anywhere - out of focus or shaken. Draw the big shapes only, or find another.' });

  const sizeLevel = qcLevel(nat, QC_SIZE, true);
  checks.push({ id: 'size', level: sizeLevel, label: 'Size', text: sizeLevel === 'ok'
    ? `${side} px - room to look into the small parts.`
    : sizeLevel === 'warn' ? `${side} px: enough for the whole, short of the small parts - zoom in and they blur.`
      : `${side} px: too small to see an eye in. Look for the original.` });

  const bad = checks.filter(c => c.level === 'bad'), warn = checks.filter(c => c.level === 'warn');
  const verdict = bad.length ? `A poor reference to work from: ${bad.map(c => c.label.toLowerCase()).join(', ')}.`
    : warn.length ? `Usable, with care: ${warn.map(c => c.label.toLowerCase()).join(', ')}.`
      : 'A good picture to work from.';
  return { w, h, blown, crushed, backWhite, backBlack, spread, p02, p98, sharp, size: nat, checks, verdict,
    white, black, whiteBack: hi.back, blackBack: lo.back };
}

// The lost highlights in pink and the lost shadows in blue; backdrops are left clear.
function qualityDraw(q, c) {
  c.width = q.w; c.height = q.h;
  const img = new ImageData(q.w, q.h), d = img.data;
  for (let i = 0; i < q.w * q.h; i++) {
    if (q.white[i] && !q.whiteBack[i]) { d[4 * i] = 255; d[4 * i + 1] = 45; d[4 * i + 2] = 149; d[4 * i + 3] = 215; }
    else if (q.black[i] && !q.blackBack[i]) { d[4 * i] = 45; d[4 * i + 1] = 123; d[4 * i + 2] = 255; d[4 * i + 3] = 215; }
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function qualityNote(q) {
  const rows = q.checks.map(c =>
    `<span class="qc-row qc-${c.level}"><i class="qc-dot" aria-hidden="true"></i><b>${esc(c.label)}</b> ${esc(c.text)}</span>`).join('');
  return `<div class="qc-verdict qc-${q.checks.some(c => c.level === 'bad') ? 'bad' : q.checks.some(c => c.level === 'warn') ? 'warn' : 'ok'}">${esc(q.verdict)}</div>` +
    `<div class="qc-rows">${rows}</div>` +
    `<small><span class="qc-pink">Pink</span> is highlight lost, <span class="qc-blue">blue</span> shadow lost. ` +
    `The limits are estimates, and a plain white or black background is not counted. ` +
    `On a painting, bare paper is white by design: read pink there as paper, not a fault.</small>`;
}

/* ---- in a session: the check over the picture, as a layer. */
let qualityRun = 0;

function clearQuality() {
  qualityRun++;
  el('qualityOverlay').classList.add('hidden');
  overlayNote('quality', state.qualityOn ? 'Checking the picture...' : '');
}

function toggleQuality() {
  state.qualityOn = !state.qualityOn;
  el('btnQuality').setAttribute('aria-pressed', String(state.qualityOn));
  clearQuality();
  if (state.qualityOn) runQuality();
}

// A moment's work, so after a frame: the button shows pressed first.
function runQuality() {
  const img = el('img'), run = ++qualityRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== qualityRun || !state.qualityOn) return;
    let q;
    try { q = qualityOf(stepsRead(img)); }
    catch (err) { console.error('quality:', err); overlayNote('quality', '<i>Could not check this picture.</i>'); return; }
    qualityDraw(q, el('qualityOverlay')).classList.remove('hidden');
    overlayNote('quality', qualityNote(q));
  }, 30);
}

el('btnQuality').addEventListener('click', toggleQuality);
