/* refboard - Composition analysis: where the eye goes, where the weight sits,
   which straight lines lead, and which crops would improve the picture.
   A guess made from the pixels - it knows contrast and colour, not faces or
   words - but contrast and colour are most of what pulls the eye first.

   Interest (saliency). Two things make a patch stand out: it is unlike the
   picture as a whole (a red coat in a grey street), and it is unlike what is
   round it (a bright window in a dark wall). Both are measured in OKLab, the
   colour space in which a distance is how different two colours look:
     global  the distance of the lightly blurred picture from its own mean
             colour (Achanta's frequency-tuned saliency);
     local   the distance between a small blur and a large blur - what a
             centre-surround cell in the eye does;
   each scaled so its 99th percentile is 1, then averaged.

   Balance. Weight is the interest squared (so a peak outweighs a haze of
   small things); its centre of mass against the picture's centre says which
   side is heavy.

   Lines. The strongest edges vote in a Hough space: an edge pixel with
   gradient direction a lies on the line x cos a + y sin a = rho, so it adds
   its strength to that (a, rho) cell. The cells with most votes are the
   picture's straight lines; each is drawn over the stretch of edge that
   supports it, and the diagonals that aim at the centre of mass are the
   ones that lead the eye there.

   Crops. Rectangles of seven shapes and four sizes are scored on how much of
   the interest they keep, how near their own thirds points (or middle) the
   interest falls, how much interest is cut by an edge they make, and how
   much denser the interest is than in the whole picture. The three best,
   not mostly the same rectangle, are offered.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const COMPOSITION_KEY = 'refboard.composition.v1';
// Crop shapes as width / height. The picture's own is added in compositionOf.
const COMPOSITION_SHAPES = [[1, '1:1'], [0.8, '4:5'], [1.25, '5:4'], [1.5, '3:2'], [2 / 3, '2:3'], [16 / 9, '16:9'], [9 / 16, '9:16']];
const COMPOSITION_SCALES = [1, 0.85, 0.72, 0.6];

function compositionLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(COMPOSITION_KEY));
    if (v) return { crop: [0, 1, 2, 3].includes(v.crop) ? v.crop : 1, heat: v.heat !== false };
  } catch { /* fall through */ }
  return { crop: 1, heat: true };
}
function compositionSave(c) {
  try { localStorage.setItem(COMPOSITION_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

// sRGB 0-255 to OKLab (Ottosson).
function compositionOklab(r, g, b) {
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

// The 99th percentile, but never under 0.03 - an OKLab distance too small to see - so a near-flat picture is not stretched into interest.
const compositionP99 = a => {
  const s = Float32Array.from(a).sort();
  return Math.max(0.03, s[Math.min(s.length - 1, Math.floor(s.length * 0.99))]);
};

// Interest per pixel, 0-1.
function compositionSaliency(p) {
  const { w, h, rgba } = p, n = w * h, S = Math.max(w, h);
  const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) [L[i], A[i], B[i]] = compositionOklab(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
  const small = [L, A, B].map(c => stepsBlur(c, w, h, Math.max(1, S / 90)));
  const large = [L, A, B].map(c => stepsBlur(c, w, h, Math.max(2, S / 9)));
  const mean = small.map(c => c.reduce((a, v) => a + v, 0) / n);
  const glob = new Float32Array(n), loc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    glob[i] = Math.hypot(small[0][i] - mean[0], small[1][i] - mean[1], small[2][i] - mean[2]);
    loc[i] = Math.hypot(small[0][i] - large[0][i], small[1][i] - large[1][i], small[2][i] - large[2][i]);
  }
  const g99 = compositionP99(glob), l99 = compositionP99(loc), sal = new Float32Array(n);
  for (let i = 0; i < n; i++) sal[i] = Math.min(1, glob[i] / g99) * 0.5 + Math.min(1, loc[i] / l99) * 0.5;
  return sal;
}

/* The strongest straight lines: up to three, each { x1, y1, x2, y2, len, deg }
   with deg the line's angle from the horizontal, 0-180 (y down). */
function compositionLines(p) {
  const { w, h, L } = p, n = w * h, S = Math.max(w, h);
  const soft = stepsBlur(L, w, h, Math.max(1, S / 280));
  const mag = new Float32Array(n), ang = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = soft[i + 1] - soft[i - 1], gy = soft[i + w] - soft[i - w];
    mag[i] = Math.hypot(gx, gy); ang[i] = Math.atan2(gy, gx);
  }
  // Edges vote that are at least a third as strong as the strongest (its 99.8th percentile, so one pixel
  // does not set the bar), and at least 1.5 L* of change per pixel pair: under that is not a line.
  const sorted = Float32Array.from(mag).sort(), cut = Math.max(1.5, 0.35 * sorted[Math.floor(n * 0.998)]);
  if (sorted[n - 1] < cut) return [];
  const NT = 90, RB = 2, diag = Math.hypot(w, h), NR = Math.ceil(2 * diag / RB) + 3;
  const acc = new Float32Array(NT * NR);
  const edge = [];
  for (let i = 0; i < n; i++) {
    if (mag[i] < cut) continue;
    const x = i % w, y = (i - x) / w;
    edge.push(i);
    let a = ang[i]; if (a < 0) a += Math.PI; if (a >= Math.PI) a -= Math.PI;
    const tb = Math.round(a / Math.PI * NT);
    for (const [d, wt] of [[-1, 0.5], [0, 1], [1, 0.5]]) {
      const t = (tb + d + NT) % NT, th = t * Math.PI / NT;
      const rho = x * Math.cos(th) + y * Math.sin(th);
      acc[t * NR + Math.round((rho + diag) / RB)] += mag[i] * wt;
    }
  }
  // Peaks: a cell no smaller than its neighbours, strongest first, no two the same line.
  const peaks = [];
  for (let t = 0; t < NT; t++) for (let r = 1; r < NR - 1; r++) {
    const v = acc[t * NR + r];
    if (v <= 0) continue;
    let top = true;
    for (let dt = -1; dt <= 1 && top; dt++) for (let dr = -1; dr <= 1; dr++) {
      if (!dt && !dr) continue;
      if (acc[((t + dt + NT) % NT) * NR + r + dr] > v) { top = false; break; }
    }
    if (top) peaks.push({ t, r, v });
  }
  peaks.sort((a, b) => b.v - a.v);
  const lines = [], chosen = [];
  for (const pk of peaks) {
    if (lines.length >= 3 || pk.v < 0.08 * peaks[0].v) break;
    const th = pk.t * Math.PI / NT, rho = pk.r * RB - diag;
    if (chosen.some(c => {
      let dth = Math.abs(c.th - th); if (dth > Math.PI / 2) dth = Math.PI - dth;
      const flip = Math.abs(c.th - th) > Math.PI / 2 ? -1 : 1;
      return dth < Math.PI / 22 && Math.abs(c.rho - flip * rho) < 16;
    })) continue;
    // The stretch of edge on this line: supporters binned along it, the longest run (gaps up to 2 bins).
    const cs = Math.cos(th), sn = Math.sin(th), bins = new Uint8Array(Math.ceil(diag / 4) + 2);
    let any = false;
    for (const i of edge) {
      const x = i % w, y = (i - x) / w;
      if (Math.abs(x * cs + y * sn - rho) > 3) continue;
      let a = ang[i]; if (a < 0) a += Math.PI;
      let da = Math.abs(a - th); if (da > Math.PI / 2) da = Math.PI - da;
      if (da > Math.PI / 18) continue;
      bins[Math.floor((-x * sn + y * cs + diag / 2 + 4) / 4)] = 1; any = true;
    }
    if (!any) continue;
    let best = [0, 0], start = -1, last = -1;
    for (let b = 0; b <= bins.length; b++) {
      if (b < bins.length && bins[b]) { if (start < 0) start = b; last = b; }
      else if (start >= 0 && (b >= bins.length || b - last > 2)) {
        if (last - start > best[1] - best[0]) best = [start, last];
        start = -1;
      }
    }
    const t0 = best[0] * 4 - 4 - diag / 2, t1 = (best[1] + 1) * 4 - 4 - diag / 2, len = t1 - t0;
    chosen.push({ th, rho });
    if (len < S * 0.22) continue;
    // Back from (rho, t) to the picture: the point rho along the normal, t along the line.
    const pt = t => [rho * cs - t * sn, rho * sn + t * cs];
    const [x1, y1] = pt(t0), [x2, y2] = pt(t1);
    lines.push({ x1, y1, x2, y2, len, deg: (th * 180 / Math.PI + 90) % 180 });
  }
  return lines;
}

// Distance from a point to the infinite line through a segment.
const compositionDist = (l, x, y) => Math.abs((l.x2 - l.x1) * (l.y1 - y) - (l.x1 - x) * (l.y2 - l.y1)) / Math.hypot(l.x2 - l.x1, l.y2 - l.y1);

/* p: stepsRead(). Gives { w, h, sal, cx, cy, left, top, lines, leading, crops }:
     cx, cy    the centre of mass of the interest, 0-1 across and down;
     left, top percent of the interest in the left half and the top half;
     lines     as compositionLines;
     leading   how many diagonals (15 to 75 degrees off the horizontal) pass
               within 12% of the long side of the centre of mass;
     crops     up to three { x, y, cw, ch, name, kept }, best first, kept being
               the percent of the interest inside. */
function compositionOf(p) {
  const { w, h } = p, n = w * h, S = Math.max(w, h);
  const sal = compositionSaliency(p), wt = Float32Array.from(sal, v => v * v);
  // Integral images, one row and column larger: sums of weight, weight * x and weight * y.
  const W1 = w + 1, I0 = new Float64Array(W1 * (h + 1)), Ix = new Float64Array(W1 * (h + 1)), Iy = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let r0 = 0, rx = 0, ry = 0;
    for (let x = 0; x < w; x++) {
      const v = wt[y * w + x];
      r0 += v; rx += v * x; ry += v * y;
      const j = (y + 1) * W1 + x + 1;
      I0[j] = I0[j - W1] + r0; Ix[j] = Ix[j - W1] + rx; Iy[j] = Iy[j - W1] + ry;
    }
  }
  const box = (I, x0, y0, x1, y1) => I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  const total = box(I0, 0, 0, w, h) || 1;
  const cx = box(Ix, 0, 0, w, h) / total / w, cy = box(Iy, 0, 0, w, h) / total / h;
  const left = box(I0, 0, 0, w >> 1, h) / total * 100, top = box(I0, 0, 0, w, h >> 1) / total * 100;

  const lines = compositionLines(p);
  const leading = lines.filter(l => l.deg > 15 && l.deg < 165 && Math.abs(l.deg - 90) < 75 && compositionDist(l, cx * w, cy * h) < 0.12 * S).length;

  // Crops.
  const shapes = [[w / h, 'as it is'], ...COMPOSITION_SHAPES.filter(([r]) => Math.abs(r - w / h) > 0.04)];
  const cands = [];
  for (const [ratio, name] of shapes) {
    const fw = Math.min(w, h * ratio);
    for (const s of COMPOSITION_SCALES) {
      const cw = Math.round(fw * s), ch = Math.round(fw * s / ratio);
      if (cw < 40 || ch < 40 || cw * ch > 0.92 * n) continue;
      const stepX = Math.max(2, Math.round(w * 0.03)), stepY = Math.max(2, Math.round(h * 0.03));
      for (let y = 0; y + ch <= h; y += stepY) for (let x = 0; x + cw <= w; x += stepX) {
        const mass = box(I0, x, y, x + cw, y + ch);
        if (mass < total * 0.5) continue;                  // a crop that throws away half the interest is no improvement
        const kept = mass / total, area = cw * ch / n;
        const u = (box(Ix, x, y, x + cw, y + ch) / mass - x) / cw, v = (box(Iy, x, y, x + cw, y + ch) / mass - y) / ch;
        let dmin = 1;
        for (const tx of [1 / 3, 2 / 3]) for (const ty of [1 / 3, 2 / 3]) dmin = Math.min(dmin, Math.hypot(u - tx, v - ty));
        const thirds = Math.max(0, 1 - dmin / 0.22, 0.6 * (1 - Math.hypot(u - 0.5, v - 0.5) / 0.22));
        // Interest cut by the crop's own edges (not by the picture's, which cut it already).
        const e = Math.max(2, Math.round(Math.min(cw, ch) * 0.03));
        let edgeMass = 0, edgeArea = 0;
        if (x > 0) { edgeMass += box(I0, x, y, x + e, y + ch); edgeArea += e * ch; }
        if (x + cw < w) { edgeMass += box(I0, x + cw - e, y, x + cw, y + ch); edgeArea += e * ch; }
        if (y > 0) { edgeMass += box(I0, x, y, x + cw, y + e); edgeArea += e * cw; }
        if (y + ch < h) { edgeMass += box(I0, x, y + ch - e, x + cw, y + ch); edgeArea += e * cw; }
        const cutRatio = edgeArea ? (edgeMass / edgeArea) / (mass / (cw * ch)) : 0;
        const pen = Math.min(cutRatio, 1.5) / 1.5;
        const dens = Math.min(1, Math.max(0, kept / area - 1));
        cands.push({ x, y, cw, ch, name, kept: kept * 100, score: 0.6 * kept + 0.3 * thirds - 0.35 * pen + 0.15 * dens });
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const iou = (a, b) => {
    const iw = Math.max(0, Math.min(a.x + a.cw, b.x + b.cw) - Math.max(a.x, b.x)), ih = Math.max(0, Math.min(a.y + a.ch, b.y + b.ch) - Math.max(a.y, b.y));
    return iw * ih / (a.cw * a.ch + b.cw * b.ch - iw * ih);
  };
  const crops = [];
  for (const c of cands) {
    if (crops.length >= 3) break;
    if (crops.every(k => iou(k, c) < 0.5)) crops.push(c);
  }
  return { w, h, sal, cx, cy, left, top, lines, leading, crops };
}

// The map on a canvas of the picture read's size: the interest as heat, the middle of mass, the lines, the chosen crop.
function compositionDraw(f, c, cfg) {
  const { w, h } = f, S = Math.max(w, h);
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (cfg.heat) {
    const img = g.createImageData(w, h), px = img.data;
    for (let i = 0; i < w * h; i++) {
      const s = f.sal[i];
      if (s < 0.2) continue;
      px[4 * i] = 255; px[4 * i + 1] = Math.round(200 * (1 - s) + 20); px[4 * i + 2] = 30;
      px[4 * i + 3] = Math.round(70 + (s - 0.2) / 0.8 * 150);
    }
    g.putImageData(img, 0, 0);
  }
  g.lineCap = 'round';
  const line = (x1, y1, x2, y2, width, style, dash) => {
    g.setLineDash(dash || []); g.lineWidth = width; g.strokeStyle = style;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  for (const l of f.lines) { line(l.x1, l.y1, l.x2, l.y2, 4.5, 'rgba(0,0,0,.6)'); line(l.x1, l.y1, l.x2, l.y2, 2, '#4fd8ff', [8, 6]); }
  g.setLineDash([]);
  // The crops: the chosen one lit, the rest outlined and numbered.
  f.crops.forEach((k, i) => {
    const on = cfg.crop === i + 1;
    if (on) {
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.beginPath(); g.rect(0, 0, w, h); g.rect(k.x, k.y, k.cw, k.ch); g.fill('evenodd');
    }
    g.lineWidth = on ? 3 : 1.5; g.strokeStyle = on ? '#fff' : 'rgba(255,255,255,.55)';
    g.setLineDash(on ? [] : [6, 5]); g.strokeRect(k.x, k.y, k.cw, k.ch); g.setLineDash([]);
    g.font = `700 ${Math.round(S / 26)}px sans-serif`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(String(i + 1), k.x + 6, k.y + 4);
    g.fillStyle = '#fff'; g.fillText(String(i + 1), k.x + 6, k.y + 4);
  });
  // The picture's middle (a plus) and the middle of the interest (a ring), joined.
  const mx = w / 2, my = h / 2, px = f.cx * w, py = f.cy * h, r = S / 45;
  line(mx, my, px, py, 1.5, 'rgba(255,255,255,.8)', [4, 4]);
  g.setLineDash([]);
  line(mx - r / 2, my, mx + r / 2, my, 2, '#fff'); line(mx, my - r / 2, mx, my + r / 2, 2, '#fff');
  g.lineWidth = 4.5; g.strokeStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.5; g.strokeStyle = '#4fd8ff'; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.stroke();
  return c;
}

// What the analysis says, in words - for the note over the picture and for the reference report.
function compositionSay(f) {
  const dx = f.cx - 0.5, dy = f.cy - 0.5, say = [];
  if (Math.abs(dx) < 0.07 && Math.abs(dy) < 0.07) say.push('The weight sits near the middle: calm and stable, and static unless something pulls away from it.');
  else {
    const where = [Math.abs(dy) >= 0.07 ? (dy < 0 ? 'upper' : 'lower') : '', Math.abs(dx) >= 0.07 ? (dx < 0 ? 'left' : 'right') : ''].filter(Boolean).join(' ');
    const side = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? ['left', f.left] : ['right', 100 - f.left]) : (dy < 0 ? ['upper half', f.top] : ['lower half', 100 - f.top]);
    say.push(`The weight sits ${where}: ${Math.round(side[1])}% of the interest is in the ${side[0]}. Balance it with something small and strong, or an empty space, on the other side.`);
  }
  let dmin = 1;
  for (const tx of [1 / 3, 2 / 3]) for (const ty of [1 / 3, 2 / 3]) dmin = Math.min(dmin, Math.hypot(f.cx - tx, f.cy - ty));
  if (dmin < 0.1) say.push('It falls close to a thirds point, the classic place for it.');
  if (f.leading) say.push(`${f.leading === 1 ? 'A diagonal line leads' : f.leading + ' diagonal lines lead'} the eye to it (the dashed blue line${f.leading === 1 ? '' : 's'}).`);
  else if (f.lines.some(l => l.deg > 15 && l.deg < 165 && Math.abs(l.deg - 90) < 75)) say.push('Diagonals run through the picture but do not aim at the centre of the interest: they could be turned to lead there.');
  else if (!f.lines.length) say.push('No strong straight line was found.');
  if (!f.crops.length) say.push('No crop beats the whole picture.');
  else say.push(`Best crop: ${f.crops[0].name}, keeping ${Math.round(f.crops[0].kept)}% of the interest.`);
  return say.join(' ');
}

function compositionNote(f, cfg) {
  const chip = (attr, k, label, on) => `<button type="button" class="chip" data-comp-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const bar = '<div class="tone-bar"><span>Crop</span>' +
    f.crops.map((k, i) => chip('crop', i + 1, `${i + 1} - ${esc(k.name)} ${Math.round(k.kept)}%`, cfg.crop === i + 1)).join('') +
    chip('crop', 0, 'Off', cfg.crop === 0) + `<span>Eye map</span>${chip('heat', 'on', 'On', cfg.heat)}${chip('heat', 'off', 'Off', !cfg.heat)}</div>`;
  return bar + esc(compositionSay(f)) + ' <small>Red-yellow is where contrast and colour pull the eye: a guess, not a reading of faces or words. The ring is the middle of that interest, the plus is the picture\'s middle.</small>';
}

/* ---- in a session: the analysis over the picture, as a layer. */
let compositionRun = 0;

function clearComposition() {
  compositionRun++;
  el('compositionOverlay').classList.add('hidden');
  overlayNote('composition', state.compositionOn ? 'Looking at the composition...' : '');
}

function toggleComposition() {
  state.compositionOn = !state.compositionOn;
  el('btnComposition').setAttribute('aria-pressed', String(state.compositionOn));
  clearComposition();
  if (state.compositionOn) runComposition();
}

// Read once per picture; the choices in the note only redraw.
let compositionFound = null;
function runComposition(redraw) {
  const img = el('img'), run = ++compositionRun;
  if (!img.naturalWidth) return;
  const go = () => {
    if (run !== compositionRun || !state.compositionOn) return;
    const cfg = compositionLoad();
    try {
      if (!redraw || !compositionFound || compositionFound.src !== img.src) compositionFound = { src: img.src, f: compositionOf(stepsRead(img)) };
      compositionDraw(compositionFound.f, el('compositionOverlay'), cfg);
      el('compositionOverlay').classList.remove('hidden');
      overlayNote('composition', compositionNote(compositionFound.f, cfg));
    } catch (err) { console.error('composition:', err); overlayNote('composition', '<i>Could not analyse this picture.</i>'); }
  };
  if (redraw) go(); else setTimeout(go, 30);
}

el('btnComposition').addEventListener('click', toggleComposition);
el('poseNote').addEventListener('click', e => {
  const k = e.target.closest('[data-comp-crop]'), h = e.target.closest('[data-comp-heat]');
  if (!k && !h) return;
  const cfg = compositionLoad();
  if (k) cfg.crop = [0, 1, 2, 3].includes(+k.dataset.compCrop) ? +k.dataset.compCrop : 1;
  if (h) cfg.heat = h.dataset.compHeat === 'on';
  compositionSave(cfg);
  runComposition(true);
});
