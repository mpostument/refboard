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
   Two pens. A liner builds the ladder in layers, and a pen size goes with each
   layer (HATCH_PEN_MM: fine for the first, so the crossings stay open and the
   tone even; heavier only where the dark must close up), drawn at that width.
   A ballpoint builds the same ladder by pressure instead - it makes soft
   gradations like a pencil, with one direction of line and a second pass only
   in the firmest - and cannot be erased, so the paper that is to stay white
   is marked as the first thing, not the last.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const HATCH_KEY = 'refboard.hatchMap.v1';
// Darkness (0-1 of the picture's own range) above which one more layer goes on.
const HATCH_CUTS = [0.14, 0.34, 0.55, 0.76];
const HATCH_ANGLES = [45, 135, 0, 90];      // degrees, y down: the first layer falls to the right
const HATCH_LINES = { open: 48, close: 80 }; // lines across the long side of the picture
const HATCH_COLOURS = ['transparent', '#6ec6ff', '#7be08a', '#ffd45c', '#ff6a5c'];
const HATCH_WORDS = ['bare paper', 'one layer', 'crossed', 'three layers', 'four layers'];
// The liner's size for each layer, mm: fine first, heavier only for the darks.
const HATCH_PEN_MM = [0.1, 0.1, 0.2, 0.3];
// The ballpoint's pressure for each level, with a ramp of one blue to show it.
const HATCH_PRESSURE = ['keep white', 'feather touch', 'light', 'medium', 'firm, a second pass'];
const HATCH_BLUES = ['transparent', '#bcd7ff', '#7eaef0', '#3f78d6', '#1b3f9c'];
const HATCH_BALL_INK = '#1c2f6b';
const HATCH_BALL_ALPHA = [0, 0.28, 0.5, 0.72, 0.92];

function hatchLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(HATCH_KEY));
    if (v) return { view: v.view === 'strokes' ? 'strokes' : 'map', lines: HATCH_LINES[v.lines] ? v.lines : 'open', pen: v.pen === 'ballpoint' ? 'ballpoint' : 'liner' };
  } catch { /* fall through */ }
  return { view: 'map', lines: 'open', pen: 'liner' };
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
function hatchLabels(f, withPaper = false) {
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
    if ((lv === 0 && !withPaper) || cells.length < n * 0.012) continue;
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
function hatchMap(f, c, cfg = {}) {
  const ball = cfg.pen === 'ballpoint';
  c.width = f.w; c.height = f.h;
  const g = c.getContext('2d'), img = g.createImageData(f.w, f.h), px = img.data;
  const tints = (ball ? HATCH_BLUES : HATCH_COLOURS).map(h => h === 'transparent' ? null : [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  for (let i = 0; i < f.w * f.h; i++) {
    const t = tints[f.level[i]];
    if (!t) continue;
    px[4 * i] = t[0]; px[4 * i + 1] = t[1]; px[4 * i + 2] = t[2]; px[4 * i + 3] = 120;
  }
  // The ballpoint's whites are drawn too - they are the part that cannot be put back.
  if (ball) for (let i = 0; i < f.w * f.h; i++) if (!f.level[i]) { px[4 * i] = px[4 * i + 1] = px[4 * i + 2] = 255; px[4 * i + 3] = 105; }
  g.putImageData(img, 0, 0);
  g.font = `700 ${Math.round(Math.max(f.w, f.h) / 24)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 4;
  for (const l of hatchLabels(f, ball).slice(0, ball ? 14 : 12)) {
    const word = l.level ? String(l.level) : 'white';
    if (!l.level) g.font = `700 ${Math.round(Math.max(f.w, f.h) / 34)}px sans-serif`;
    g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(word, l.x, l.y);
    g.fillStyle = '#fff'; g.fillText(word, l.x, l.y);
    if (!l.level) g.font = `700 ${Math.round(Math.max(f.w, f.h) / 24)}px sans-serif`;
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
  // Paper, but not quite opaque: the picture shows through faintly, so the
  // lines can be placed on the figure - a bare net of hatching shows nothing.
  g.fillStyle = 'rgba(250,246,236,.84)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1b1b24'; g.lineCap = 'round';
  const base = Math.max(0.9, sp / 7);
  for (let j = 0; j < 4; j++) {
    g.lineWidth = Math.max(0.8, base * Math.sqrt(HATCH_PEN_MM[j] / 0.2));
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
      // Where along the line the level is above this layer: runs of t.
      const runs = [];
      let from = null;
      for (let t = Math.ceil(t0); t <= t1; t++) {
        const xi = Math.min(w - 1, Math.max(0, Math.round(o * nx + t * ux))), yi = Math.min(h - 1, Math.max(0, Math.round(o * ny + t * uy)));
        if (level[yi * w + xi] > j) { if (from === null) from = t; }
        else if (from !== null) { runs.push([from, t - 1]); from = null; }
      }
      if (from !== null) runs.push([from, Math.floor(t1)]);
      // A hand does not lift the pen for a gap of a hair, nor make a stroke
      // shorter than the lines are apart: close the first, drop the second.
      // Without that the edge of every area is a fringe of stubs.
      const merged = [];
      for (const r of runs) {
        const last = merged[merged.length - 1];
        if (last && r[0] - last[1] <= sp * 0.7) last[1] = r[1]; else merged.push([...r]);
      }
      for (const [a, b] of merged) {
        if (b - a < sp * 1.2) continue;
        g.moveTo(o * nx + a * ux, o * ny + a * uy);
        g.lineTo(o * nx + b * ux, o * ny + b * uy);
      }
    }
    g.stroke();
  }
}

/* The key's swatch for a level in the strokes view: the lines that level has,
   one set per layer, each at its own angle - so the key shows what to look for
   in the drawing, where the map's colours would be nothing there. */
function hatchSwatch(k) {
  if (!k) return '<svg class="hm-sw" viewBox="0 0 22 14" aria-hidden="true"></svg>';
  let lines = '';
  for (let j = 0; j < k; j++) {
    const ls = [];
    for (let y = -14; y < 28; y += 4) ls.push(`<line x1="-14" y1="${y + j}" x2="36" y2="${y + j}"/>`);
    lines += `<g transform="rotate(${HATCH_ANGLES[j]} 11 7)" stroke-width="${(0.8 + 0.25 * j).toFixed(2)}">${ls.join('')}</g>`;
  }
  return `<svg class="hm-sw" viewBox="0 0 22 14" aria-hidden="true"><g stroke="#1b1b24" fill="none">${lines}</g></svg>`;
}

/* The ballpoint's strokes: one direction, and the pressure is how dark and
   how wide the line is where it crosses each level. Every level is a path of
   its own (a line that passes from one level to another changes pen there);
   the firmest level is gone over again across the first. */
function hatchBallpoint(f, c, cfg) {
  const { w, h, level } = f, S = Math.max(w, h), sp = S / HATCH_LINES[cfg.lines] * 0.75;
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(250,246,236,.96)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = HATCH_BALL_INK; g.lineCap = 'round';
  const base = Math.max(0.8, sp / 6);
  for (const [angle, from, phase] of [[HATCH_ANGLES[0], 1, 0.5], [HATCH_ANGLES[1], 4, 0.77]]) {
    const th = angle * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
    const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => x * nx + y * ny);
    const oMin = Math.min(...cs), oMax = Math.max(...cs), paths = [null, new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    for (let o = oMin + sp * phase; o < oMax; o += sp) {
      let t0 = -Infinity, t1 = Infinity, skip = false;
      for (const [u, b0, hi] of [[ux, o * nx, w - 1], [uy, o * ny, h - 1]]) {
        if (Math.abs(u) < 1e-9) { if (b0 < 0 || b0 > hi) skip = true; continue; }
        const a = -b0 / u, b = (hi - b0) / u;
        t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
      }
      if (skip || t1 <= t0) continue;
      let prev = 0;
      for (let t = Math.ceil(t0); t <= t1; t++) {
        const x = o * nx + t * ux, y = o * ny + t * uy;
        const xi = Math.min(w - 1, Math.max(0, Math.round(x))), yi = Math.min(h - 1, Math.max(0, Math.round(y)));
        const lv = level[yi * w + xi] >= from ? level[yi * w + xi] : 0;
        if (lv) { if (prev !== lv) paths[lv].moveTo(x, y); else paths[lv].lineTo(x, y); }
        prev = lv;
      }
    }
    for (let lv = 1; lv <= 4; lv++) {
      g.globalAlpha = angle === HATCH_ANGLES[1] ? 0.6 : HATCH_BALL_ALPHA[lv];
      g.lineWidth = base * (0.75 + 0.25 * lv);
      g.stroke(paths[lv]);
    }
  }
  g.globalAlpha = 1;
}

function hatchDraw(f, c, cfg) {
  if (cfg.view === 'strokes') (cfg.pen === 'ballpoint' ? hatchBallpoint : hatchStrokes)(f, c, cfg); else hatchMap(f, c, cfg);
  return c;
}

function hatchNote(f, cfg) {
  const chip = (attr, k, label, on) => `<button type="button" class="chip" data-hatch-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const ball = cfg.pen === 'ballpoint', strokes = cfg.view === 'strokes';
  const bar =`<div class="tone-bar"><span>Pen</span>${chip('p', 'liner', 'Liner', !ball)}${chip('p', 'ballpoint', 'Ballpoint', ball)}` +
    `<span>Show</span>${chip('v', 'map', 'Map', cfg.view === 'map')}${chip('v', 'strokes', 'Strokes', cfg.view === 'strokes')}` +
    `<span>Lines</span>${chip('l', 'open', 'Open', cfg.lines === 'open')}${chip('l', 'close', 'Close', cfg.lines === 'close')}</div>`;
  if (f.flat) return bar + 'The values hardly differ in this picture: there is no ladder to build. One even layer, or none, says all it has.';
  const key = '<div class="hm-key">' + f.share.map((s, k) => ball
    ? `<span><i style="background:${k ? HATCH_BLUES[k] : '#fff'}"></i>${k ? k + ' ' : ''}${HATCH_PRESSURE[k]} ${Math.round(s)}%</span>`
    : `<span>${strokes ? hatchSwatch(k) : `<i style="background:${k ? HATCH_COLOURS[k] : 'transparent'}"></i>`}${k} ${HATCH_WORDS[k]}${k ? ', ' + HATCH_PEN_MM[k - 1] + ' mm' : ''} ${Math.round(s)}%</span>`).join('') + '</div>';
  // Strokes: how to read them - the sets of lines are the layers.
  const how = strokes && !ball
    ? '<div>Every set of parallel lines is one layer, each at its own angle: first ╲, second ╱, third —, fourth |. Count the sets crossing at any spot - that is its number; where there are none, leave the paper. The picture is faint underneath to place them by.</div>' : '';
  const dark = f.share[3] + f.share[4], light = f.share[0] + f.share[1];
  let line;
  if (ball) {
    line = `${Math.round(f.share[0])}% must stay white: a ballpoint cannot be erased, so draw round those places first and never into them.` +
      (f.share[4] > 12 ? ` ${Math.round(f.share[4])}% is firm: two light passes across each other beat one hard one, which digs the paper and skips.` : ' Build the tone in light passes and let the pressure, not more lines, make it darker.');
  } else if (dark > 25) line = `${Math.round(dark)}% wants three layers or four: a lot of ink. Build it from the top of the ladder down - the lightest layer over the whole area first, the crossing only where the numbers rise. The pen grows with the layers: fine first keeps the crossings open.`;
  else if (light > 65) line = `${Math.round(light)}% needs one layer or none: keep the pen light and let the paper be the highlights - they cannot be put back.`;
  else line = 'A full ladder: lay the first direction over everything that is not bare paper, then cross it where the numbers rise.';
  return bar + how + key + esc(line) + " <small>Measured against this picture's own darkest and lightest, not the sheet's." + (ball ? '' : ' Pen sizes are a starting rule, not a measurement.') + '</small>';
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
  const v = e.target.closest('[data-hatch-v]'), l = e.target.closest('[data-hatch-l]'), p = e.target.closest('[data-hatch-p]');
  if (!v && !l && !p) return;
  const cfg = hatchLoad();
  if (v) cfg.view = v.dataset.hatchV === 'strokes' ? 'strokes' : 'map';
  if (l && HATCH_LINES[l.dataset.hatchL]) cfg.lines = l.dataset.hatchL;
  if (p) cfg.pen = p.dataset.hatchP === 'ballpoint' ? 'ballpoint' : 'liner';
  hatchSave(cfg);
  runHatch();
});
