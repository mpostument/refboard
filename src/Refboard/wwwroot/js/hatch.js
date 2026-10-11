/* refboard - Hatching map: how many layers of hatching each area wants.
   A liner or a ballpoint builds value by line alone: the lightest tone is the
   bare paper, a little darker is one set of parallel lines, darker still a
   second set across the first, and so on. This sorts the picture into that
   ladder - none, one, crossed, three, four - and can draw the picture that
   way, so the finished tone is seen before the first line is.

   How: the picture's lightness, blurred a little so a speck does not become
   an island, is measured against the picture's own darkest and lightest (the
   2nd and 98th percentile - a single black pixel should not decide where the
   ladder starts). The darkness d, 0 (as light as the picture gets) to 1
   (as dark), is cut at HATCH_CUTS into five levels. The strokes view lays
   each layer's lines across the sheet at its own angle (45, 135, 0 and 90
   degrees: the second set crosses the first at a right angle, the others
   split the gaps) and lifts the pen wherever the area wants fewer layers than this one -
   a line is walked pixel by pixel, drawn where the level is above its layer.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const HATCH_KEY = 'refboard.hatchMap.v1';
// Darkness (0-1 of the picture's own range) above which one more layer goes on.
const HATCH_CUTS = [0.14, 0.34, 0.55, 0.76];
const HATCH_ANGLES = [45, 135, 0, 90];      // degrees, y down: the first layer falls to the right
const HATCH_LINES = { open: 48, close: 80 }; // lines across the long side of the picture
const HATCH_COLOURS = ['transparent', '#6ec6ff', '#7be08a', '#ffd45c', '#ff6a5c'];
const HATCH_WORDS = ['bare paper', 'one layer', 'crossed', 'three layers', 'four layers'];

function hatchLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(HATCH_KEY));
    if (v) return { view: v.view === 'strokes' ? 'strokes' : 'map', lines: HATCH_LINES[v.lines] ? v.lines : 'open' };
  } catch { /* fall through */ }
  return { view: 'map', lines: 'open' };
}
function hatchSave(c) {
  try { localStorage.setItem(HATCH_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/* p: stepsRead(). Gives { w, h, level, share, flat }:
     level  per pixel, 0 (paper) to 4 (four layers);
     share  percent of the picture at each level;
     flat   true when the picture's values span so little that the ladder
            would only be stretching noise (under 8 L*). */
function hatchOf(p) {
  const { w, h, L } = p, n = w * h, S = Math.max(w, h);
  const soft = stepsBlur(L, w, h, S / 130);
  const sorted = Float32Array.from(soft).sort();
  const lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.min(n - 1, Math.floor(n * 0.98))], range = hi - lo;
  const level = new Uint8Array(n), count = [0, 0, 0, 0, 0];
  const flat = range < 8;
  for (let i = 0; i < n; i++) {
    let k = 0;
    if (!flat) {
      const d = (hi - soft[i]) / range;
      while (k < 4 && d > HATCH_CUTS[k]) k++;
    }
    level[i] = k; count[k]++;
  }
  return { w, h, level, share: count.map(v => v / n * 100), flat };
}

/* Where to write a layer's number: one per large patch, at the patch's pixel
   nearest its middle (a ring's centre may be outside it). 4-connected flood
   fill over equal levels; patches under 1.2% of the picture get no number. */
function hatchLabels(f) {
  const { w, h, level } = f, n = w * h, seen = new Uint8Array(n), out = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const lv = level[s], stack = [s], cells = [];
    seen[s] = 1;
    let sx = 0, sy = 0;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w;
      cells.push(i); sx += x; sy += y;
      if (x > 0 && !seen[i - 1] && level[i - 1] === lv) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && !seen[i + 1] && level[i + 1] === lv) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && !seen[i - w] && level[i - w] === lv) { seen[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && !seen[i + w] && level[i + w] === lv) { seen[i + w] = 1; stack.push(i + w); }
    }
    if (lv === 0 || cells.length < n * 0.012) continue;
    const mx = sx / cells.length, my = sy / cells.length;
    let best = cells[0], bd = Infinity;
    for (const i of cells) {
      const x = i % w, y = (i - x) / w, d = (x - mx) ** 2 + (y - my) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    out.push({ level: lv, area: cells.length, x: best % w, y: Math.floor(best / w) });
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 12);
}

// The map: each level tinted, the large patches numbered by their layers.
function hatchMap(f, c) {
  c.width = f.w; c.height = f.h;
  const g = c.getContext('2d'), img = g.createImageData(f.w, f.h), px = img.data;
  const tints = HATCH_COLOURS.map(h => h === 'transparent' ? null : [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  for (let i = 0; i < f.w * f.h; i++) {
    const t = tints[f.level[i]];
    if (!t) continue;
    px[4 * i] = t[0]; px[4 * i + 1] = t[1]; px[4 * i + 2] = t[2]; px[4 * i + 3] = 120;
  }
  g.putImageData(img, 0, 0);
  g.font = `700 ${Math.round(Math.max(f.w, f.h) / 24)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 4;
  for (const l of hatchLabels(f)) {
    g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(String(l.level), l.x, l.y);
    g.fillStyle = '#fff'; g.fillText(String(l.level), l.x, l.y);
  }
}

/* The strokes: paper, then each layer's parallel lines, walked a pixel at a
   time and drawn wherever the level is above the layer. A line is the points
   (o*n + t*u) for the layer's direction u and its normal n; o is how far the
   line sits across the sheet, t how far along it. */
function hatchStrokes(f, c, cfg) {
  const { w, h, level } = f, S = Math.max(w, h), sp = S / HATCH_LINES[cfg.lines];
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(250,246,236,.96)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1b1b24'; g.lineWidth = Math.max(0.9, sp / 7); g.lineCap = 'round';
  for (let j = 0; j < 4; j++) {
    const th = HATCH_ANGLES[j] * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => x * nx + y * ny);
    const oMin = Math.min(...cs), oMax = Math.max(...cs);
    g.beginPath();
    // A different phase for each layer, so a crossing is not a grid of dots.
    for (let o = oMin + sp * (0.5 + 0.27 * j); o < oMax; o += sp) {
      let t0 = -Infinity, t1 = Infinity, skip = false;
      for (const [u, base, hi] of [[ux, o * nx, w - 1], [uy, o * ny, h - 1]]) {
        if (Math.abs(u) < 1e-9) { if (base < 0 || base > hi) skip = true; continue; }
        const a = -base / u, b = (hi - base) / u;
        t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      }
      if (skip || t1 <= t0) continue;
      let pen = false;
      for (let t = Math.ceil(t0); t <= t1; t++) {
        const x = o * nx + t * ux, y = o * ny + t * uy;
        const xi = Math.min(w - 1, Math.max(0, Math.round(x))), yi = Math.min(h - 1, Math.max(0, Math.round(y)));
        if (level[yi * w + xi] > j) { if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } }
        else pen = false;
      }
    }
    g.stroke();
  }
}

function hatchDraw(f, c, cfg) {
  if (cfg.view === 'strokes') hatchStrokes(f, c, cfg); else hatchMap(f, c);
  return c;
}

function hatchNote(f, cfg) {
  const chip = (attr, k, label, on) => `<button type="button" class="chip" data-hatch-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const bar = `<div class="tone-bar"><span>Show</span>${chip('v', 'map', 'Map', cfg.view === 'map')}${chip('v', 'strokes', 'Strokes', cfg.view === 'strokes')}` +
    `<span>Lines</span>${chip('l', 'open', 'Open', cfg.lines === 'open')}${chip('l', 'close', 'Close', cfg.lines === 'close')}</div>`;
  if (f.flat) return bar + 'The values hardly differ in this picture: there is no ladder to build. One even layer, or none, says all it has.';
  const key = '<div class="hm-key">' + f.share.map((s, k) =>
    `<span><i style="background:${k ? HATCH_COLOURS[k] : 'transparent'}"></i>${k} ${HATCH_WORDS[k]} ${Math.round(s)}%</span>`).join('') + '</div>';
  const dark = f.share[3] + f.share[4], light = f.share[0] + f.share[1];
  let line;
  if (dark > 25) line = `${Math.round(dark)}% wants three layers or four: a lot of ink. Build it from the top of the ladder down - the lightest layer over the whole area first, the crossing only where it is needed - or let a heavier pen fill the darkest.`;
  else if (light > 65) line = `${Math.round(light)}% needs one layer or none: keep the pen light and let the paper be the highlights - they cannot be put back.`;
  else line = 'A full ladder: lay the first direction over everything that is not bare paper, then cross it where the numbers rise.';
  return bar + key + esc(line) + " <small>Measured against this picture's own darkest and lightest, not the sheet's.</small>";
}

/* ---- in a session: the map or the strokes over the picture, as a layer. */
let hatchRun = 0;

function clearHatch() {
  hatchRun++;
  el('hatchOverlay').classList.add('hidden');
  overlayNote('hatch', state.hatchOn ? 'Working out the layers...' : '');
}

function toggleHatch() {
  state.hatchOn = !state.hatchOn;
  el('btnHatch').setAttribute('aria-pressed', String(state.hatchOn));
  clearHatch();
  if (state.hatchOn) runHatch();
}

// A moment's work, so after a frame: the button shows pressed first.
function runHatch() {
  const img = el('img'), run = ++hatchRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== hatchRun || !state.hatchOn) return;
    let f;
    const cfg = hatchLoad();
    try { f = hatchOf(stepsRead(img)); hatchDraw(f, el('hatchOverlay'), cfg); }
    catch (err) { console.error('hatch:', err); overlayNote('hatch', '<i>Could not work out the layers in this picture.</i>'); return; }
    el('hatchOverlay').classList.remove('hidden');
    overlayNote('hatch', hatchNote(f, cfg));
  }, 30);
}

el('btnHatch').addEventListener('click', toggleHatch);
el('poseNote').addEventListener('click', e => {
  const v = e.target.closest('[data-hatch-v]'), l = e.target.closest('[data-hatch-l]');
  if (!v && !l) return;
  const cfg = hatchLoad();
  if (v) cfg.view = v.dataset.hatchV === 'strokes' ? 'strokes' : 'map';
  if (l && HATCH_LINES[l.dataset.hatchL]) cfg.lines = l.dataset.hatchL;
  hatchSave(cfg);
  runHatch();
});
