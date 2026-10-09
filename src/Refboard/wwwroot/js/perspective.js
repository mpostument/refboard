/* refboard - The perspective grid: a sheet to print and draw over.
   One, two or three vanishing points on a horizon, on the paper you will
   really draw on: its size in millimetres, so the print is the size on
   screen, and the lines are fanned from each point the way a drawing-book
   template does it. The other half of the Perspective check (Construction
   guides, in a session), which finds the points in a picture; this makes the
   sheet to build a box, a room or a street on.

   What a flat sheet cannot say, the note does. Two points far apart make a
   drawing that looks right; two close together stretch every box at the
   edges - the note works out how wide a view the sheet shows from where the
   eye must stand for the two points to be a right angle apart (the station
   point; the picture plane is the sheet, the eye as far from it as the
   geometric mean of the two distances from the centre line to the points),
   and says when it is past the 60 degrees the eye takes in without
   distortion. A point off the sheet is a fact of life - the real ones
   usually are - so it says how far, to tape a strip of paper on and mark it.

   Everything is worked out in millimetres on the paper (pgGeometry(), plain
   data), and drawn as one SVG (pgSvg()) that is the preview, the print and
   the file. Printing goes through a hidden frame with an @page of the
   paper's size (printHtml(), tools.js), so the browser's dialog starts at
   the right paper.

   Loaded the first time the view opens (loadSection('perspective')). */
"use strict";

const PG_KEY = 'refboard.perspective.v1';
// Portrait sizes in mm; a landscape sheet is the same turned.
const PG_FORMATS = {
  a5: { label: 'A5', mm: [148, 210] },
  a4: { label: 'A4', mm: [210, 297] },
  a3: { label: 'A3', mm: [297, 420] },
  letter: { label: 'Letter', mm: [215.9, 279.4] },
  square: { label: 'Square 20 cm', mm: [200, 200] },
  r43: { label: '4:3 tablet', mm: [210, 280] },
  r169: { label: '16:9 screen', mm: [180, 320] },
  custom: { label: 'Custom size', mm: null },
};
const PG_INK = { // one colour per family of lines, and the one-colour print
  colour: { 0: '#c8412f', 1: '#2f6fb3', 2: '#2d8a58', up: '#8a8a8a', horizon: '#111', frame: '#999' },
  one: { 0: '#555', 1: '#555', 2: '#555', up: '#999', horizon: '#111', frame: '#999' },
};
const PG_DEFAULTS = {
  points: 2, format: 'a4', landscape: true, customW: 210, customH: 148,
  horizon: 40,    // eye level, % of the sheet's height from the top
  spread: 90,     // two- and three-point: each point's distance from the centre, % of the width
  vp1x: 50,       // one-point: where the point is, % of the width
  lines: 18,      // lines fanned from each point
  third: 'down',  // three-point: the third point below (looking down) or above
  thirdDist: 150, // ... its distance from the horizon, % of the height
  upright: true,  // the plumb lines (and the level ones in one-point)
  ink: 'colour', margin: 10,
};

let persp = null; // the view's state; null until first opened

function pgLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(PG_KEY)) || {}; } catch { /* a fresh start */ }
  const num = (k, lo, hi) => Number.isFinite(+v[k]) ? Math.min(hi, Math.max(lo, +v[k])) : PG_DEFAULTS[k];
  return {
    points: [1, 2, 3].includes(+v.points) ? +v.points : PG_DEFAULTS.points,
    format: PG_FORMATS[v.format] ? v.format : PG_DEFAULTS.format,
    landscape: typeof v.landscape === 'boolean' ? v.landscape : PG_DEFAULTS.landscape,
    customW: num('customW', 50, 1200), customH: num('customH', 50, 1200),
    horizon: num('horizon', 5, 95), spread: num('spread', 30, 250), vp1x: num('vp1x', 0, 100),
    lines: Math.round(num('lines', 6, 48)),
    third: v.third === 'up' ? 'up' : 'down', thirdDist: num('thirdDist', 40, 400),
    upright: typeof v.upright === 'boolean' ? v.upright : PG_DEFAULTS.upright,
    ink: PG_INK[v.ink] ? v.ink : PG_DEFAULTS.ink,
    margin: [0, 5, 10].includes(+v.margin) ? +v.margin : PG_DEFAULTS.margin,
  };
}
function pgSave() { try { localStorage.setItem(PG_KEY, JSON.stringify(persp)); } catch { /* private mode */ } }

// The paper, in mm: [width, height], turned to the chosen way round.
function pgPaper(s) {
  const f = PG_FORMATS[s.format] || PG_FORMATS.a4;
  // A custom size is as typed, the way round it was given; the others turn.
  if (!f.mm) return [s.customW, s.customH];
  const [short, long] = f.mm;
  return s.landscape ? [long, short] : [short, long];
}

// A line through (x, y) at angle `a`, cut to the rectangle - null if it misses
// (Liang-Barsky on the line's parameter).
function pgClip(x, y, a, r) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, q] of [[-dx, x - r.x0], [dx, r.x1 - x], [-dy, y - r.y0], [dy, r.y1 - y]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  return t1 - t0 > 1e-6 ? [x + dx * t0, y + dy * t0, x + dx * t1, y + dy * t1] : null;
}

// n lines through a point, spread evenly over the angles at which the sheet
// is seen from it - so a point far off the sheet still fills it - or, for a
// point on the sheet, over the half turn (each line runs both ways).
function pgFan(vp, r, n) {
  const inside = vp.x > r.x0 && vp.x < r.x1 && vp.y > r.y0 && vp.y < r.y1;
  let lo = 0, hi = Math.PI;
  if (!inside) {
    const ref = Math.atan2((r.y0 + r.y1) / 2 - vp.y, (r.x0 + r.x1) / 2 - vp.x);
    const turn = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
    const offs = [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]].map(([cx, cy]) => turn(Math.atan2(cy - vp.y, cx - vp.x) - ref));
    lo = ref + Math.min(...offs); hi = ref + Math.max(...offs);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const seg = pgClip(vp.x, vp.y, lo + (i + 0.5) / n * (hi - lo), r);
    if (seg) out.push(seg);
  }
  return out;
}

/* Everything on the sheet, in mm: { W, H, rect, horizonY, vps, lines, view }.
   A line is { seg: [x1, y1, x2, y2], family } - family 0, 1, 2 for the fans
   of the points, 'up' for the plumb and level lines. `view` is the angle the
   sheet spans from the station point (two and three points), in degrees. */
function pgGeometry(s) {
  const [W, H] = pgPaper(s), m = s.margin;
  const rect = { x0: m, y0: m, x1: W - m, y1: H - m };
  const horizonY = H * s.horizon / 100;
  const vps = [];
  if (s.points === 1) vps.push({ x: W * s.vp1x / 100, y: horizonY, name: 'VP' });
  else {
    vps.push({ x: W / 2 - W * s.spread / 100, y: horizonY, name: 'VP 1' },
             { x: W / 2 + W * s.spread / 100, y: horizonY, name: 'VP 2' });
    if (s.points === 3) vps.push({ x: W / 2, y: horizonY + (s.third === 'down' ? 1 : -1) * H * s.thirdDist / 100, name: 'VP 3' });
  }
  const lines = [];
  vps.forEach((vp, i) => { for (const seg of pgFan(vp, rect, s.lines)) lines.push({ seg, family: i }); });
  if (s.upright && s.points < 3) {
    const step = (rect.x1 - rect.x0) / (Math.max(4, Math.round(s.lines * 0.75)) + 1);
    // Plumb lines evenly across; in one point the level ones too, as squares
    // counted from the horizon - the front of the cube is square to the eye.
    for (let x = rect.x0 + step; x < rect.x1 - 1e-6; x += step) lines.push({ seg: [x, rect.y0, x, rect.y1], family: 'up' });
    if (s.points === 1) {
      for (let k = 1; horizonY + k * step < rect.y1; k++) lines.push({ seg: [rect.x0, horizonY + k * step, rect.x1, horizonY + k * step], family: 'up' });
      for (let k = 1; horizonY - k * step > rect.y0; k++) lines.push({ seg: [rect.x0, horizonY - k * step, rect.x1, horizonY - k * step], family: 'up' });
    }
  }
  let view = null;
  if (s.points > 1) {
    const a = W / 2 - vps[0].x, b = vps[1].x - W / 2, h = Math.sqrt(a * b);
    view = 2 * Math.atan(W / 2 / h) * 180 / Math.PI;
  }
  return { W, H, rect, horizonY, vps, lines, view };
}

// Which way, and how far, a point lies off the sheet - null if it is on it.
function pgOff(vp, W, H) {
  const out = [];
  if (vp.x < 0) out.push([-vp.x, 'left of']); else if (vp.x > W) out.push([vp.x - W, 'right of']);
  if (vp.y < 0) out.push([-vp.y, 'above']); else if (vp.y > H) out.push([vp.y - H, 'below']);
  return out.length ? out.map(([d, w]) => `${Math.round(d)} mm ${w}`).join(' and ') + ' the sheet' : null;
}

// The note under the sheet: what the eye is doing, how wide the view is, and
// where the points are that are not on the paper.
function pgNote(s, g) {
  const parts = [];
  const h = s.horizon;
  parts.push(h < 35 ? `The horizon is high on the sheet: a high viewpoint - nearly everything is below your eye, so you see tops.`
    : h > 65 ? `The horizon is low on the sheet: a low viewpoint - most things are above your eye, so you see their undersides.`
    : `The horizon runs near the middle: the eye is about as high as the middle of what you draw.`);
  if (s.points === 1) parts.push('One point: the fronts of boxes face you square and only their depth runs to the point - a corridor, a street, a room seen straight on.');
  else {
    const v = Math.round(g.view);
    parts.push(`From the right distance the sheet shows ${v}° of the view - ` +
      (v <= 60 ? 'inside the 60° the eye takes in without distortion.'
        : v <= 75 ? 'wider than the eye is easy with: boxes at the edges will stretch. Move the points apart.'
        : 'far too wide: boxes at the edges will stretch badly. Move the points apart.'));
    if (s.points === 3) parts.push(`The third point ${s.third === 'down' ? 'below: looking down, verticals draw together toward the ground' : 'above: looking up, verticals draw together toward the sky'}.`);
  }
  const off = g.vps.map(vp => [vp.name, pgOff(vp, g.W, g.H)]).filter(([, o]) => o);
  if (off.length) parts.push(off.map(([n, o]) => `${n} is ${o}`).join('; ') + ' - tape a strip of paper on to mark it; the lines already run to it.');
  return parts.join(' ');
}

const pgEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pgN = n => +n.toFixed(2);

// The sheet as one SVG, in mm. `mm` gives it the paper's own size (print and
// file); without it it fills its box (the preview).
function pgSvg(s, g, mm = false) {
  const ink = PG_INK[s.ink] || PG_INK.colour, { W, H, rect: r } = g;
  const line = ([x1, y1, x2, y2], c, w, extra = '') =>
    `<line x1="${pgN(x1)}" y1="${pgN(y1)}" x2="${pgN(x2)}" y2="${pgN(y2)}" stroke="${c}" stroke-width="${w}"${extra}/>`;
  const body = [];
  body.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  for (const l of g.lines.filter(l => l.family === 'up')) body.push(line(l.seg, ink.up, 0.15));
  for (const l of g.lines.filter(l => l.family !== 'up')) body.push(line(l.seg, ink[l.family], 0.22));
  body.push(line([r.x0, g.horizonY, r.x1, g.horizonY], ink.horizon, 0.5));
  body.push(`<text x="${r.x0 + 1.5}" y="${pgN(g.horizonY - 1.5)}" font-size="3.4" fill="${ink.horizon}" font-family="sans-serif">eye level</text>`);
  body.push(`<rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="none" stroke="${ink.frame}" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>`);
  g.vps.forEach((vp, i) => {
    const on = vp.x >= 0 && vp.x <= W && vp.y >= 0 && vp.y <= H, c = ink[i];
    if (on) {
      body.push(`<circle cx="${pgN(vp.x)}" cy="${pgN(vp.y)}" r="1.6" fill="#fff" stroke="${c}" stroke-width="0.5"/>` +
        `<text x="${pgN(vp.x + 2.6)}" y="${pgN(vp.y - 2)}" font-size="3.4" fill="${c}" font-family="sans-serif">${pgEsc(vp.name)}</text>`);
      return;
    }
    // Off the sheet: where it is, written at the edge it lies beyond.
    const side = vp.x < 0 ? 'l' : vp.x > W ? 'r' : vp.y < 0 ? 't' : 'b';
    const label = `${pgEsc(vp.name)} ${side === 'l' ? '←' : side === 'r' ? '→' : side === 't' ? '↑' : '↓'} ${Math.round(Math.max(side === 'l' ? -vp.x : side === 'r' ? vp.x - W : 0,
      side === 't' ? -vp.y : side === 'b' ? vp.y - H : 0))} mm`;
    const at = { l: [r.x0 + 1.5, g.horizonY + 5], r: [r.x1 - 1.5, g.horizonY + 5], t: [W / 2, r.y0 + 4], b: [W / 2, r.y1 - 2.5] }[side];
    body.push(`<text x="${pgN(at[0])}" y="${pgN(at[1])}" font-size="3.4" fill="${c}" font-family="sans-serif" text-anchor="${side === 'r' ? 'end' : side === 'l' ? 'start' : 'middle'}">${label}</text>`);
  });
  const size = mm ? ` width="${W}mm" height="${H}mm"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}>${body.join('')}</svg>`;
}

// The page the hidden frame prints: the sheet at its own size, no margins,
// and an @page the browser's dialog takes the paper from.
function pgPrintHtml(s) {
  const g = pgGeometry(s);
  return `<!doctype html><meta charset="utf-8"><title>Perspective grid</title>` +
    `<style>@page{size:${g.W}mm ${g.H}mm;margin:0}html,body{margin:0;background:#fff}svg{display:block}</style>${pgSvg(s, g, true)}`;
}

const pgPrint = () => printHtml(pgPrintHtml(persp));

function pgDownload() {
  const g = pgGeometry(persp);
  saveBlob(new Blob([pgSvg(persp, g, true)], { type: 'image/svg+xml' }),
    `perspective-${persp.points}-point-${Math.round(g.W)}x${Math.round(g.H)}mm.svg`);
}

// Which controls make sense for this many points.
function pgSyncControls() {
  for (const row of el('viewPerspective').querySelectorAll('[data-pts]'))
    row.classList.toggle('hidden', !row.dataset.pts.split(' ').includes(String(persp.points)));
  for (const b of el('pgPoints').children) b.setAttribute('aria-pressed', String(+b.dataset.points === persp.points));
  for (const b of el('pgOrient').children) b.setAttribute('aria-pressed', String((b.dataset.orient === 'landscape') === persp.landscape));
  for (const b of el('pgThird').children) b.setAttribute('aria-pressed', String(b.dataset.third === persp.third));
  el('pgCustom').classList.toggle('hidden', persp.format !== 'custom');
  // A custom sheet is as typed, so the way round is the typing's.
  el('pgOrient').classList.toggle('hidden', persp.format === 'custom');
  const out = { pgHorizon: persp.horizon + '% from the top', pgSpread: persp.spread + '% of the width',
    pgVp1x: persp.vp1x + '% across', pgLines: String(persp.lines), pgThirdDist: persp.thirdDist + '% of the height' };
  for (const [id, text] of Object.entries(out)) el(id + 'Out').textContent = text;
}

function pgRender() {
  const g = pgGeometry(persp);
  el('pgSheet').innerHTML = pgSvg(persp, g);
  el('pgSheet').setAttribute('aria-label', `A ${persp.points}-point perspective grid on ${Math.round(g.W)} by ${Math.round(g.H)} mm paper`);
  el('pgNote').textContent = pgNote(persp, g);
  el('pgSize').textContent = `${pgN(g.W)} × ${pgN(g.H)} mm`;
  pgSyncControls();
}

function pgChange(patch) {
  Object.assign(persp, patch);
  pgSave();
  pgRender();
}

function showPerspective() {
  if (persp) { pgRender(); return; }
  persp = pgLoad();
  el('pgFormat').innerHTML = Object.entries(PG_FORMATS).map(([k, f]) => `<option value="${k}">${esc(f.label)}</option>`).join('');
  el('pgFormat').value = persp.format;
  const set = { pgHorizon: 'horizon', pgSpread: 'spread', pgVp1x: 'vp1x', pgLines: 'lines', pgThirdDist: 'thirdDist' };
  for (const [id, key] of Object.entries(set)) {
    el(id).value = persp[key];
    el(id).addEventListener('input', () => pgChange({ [key]: +el(id).value }));
  }
  el('pgCustomW').value = persp.customW; el('pgCustomH').value = persp.customH;
  for (const [id, key] of [['pgCustomW', 'customW'], ['pgCustomH', 'customH']])
    el(id).addEventListener('change', () => { el(id).value = Math.min(1200, Math.max(50, +el(id).value || PG_DEFAULTS[key])); pgChange({ [key]: +el(id).value }); });
  el('pgFormat').addEventListener('change', () => pgChange({ format: el('pgFormat').value }));
  el('pgPoints').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pgChange({ points: +b.dataset.points }); });
  el('pgOrient').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pgChange({ landscape: b.dataset.orient === 'landscape' }); });
  el('pgThird').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pgChange({ third: b.dataset.third }); });
  el('pgUpright').checked = persp.upright;
  el('pgUpright').addEventListener('change', () => pgChange({ upright: el('pgUpright').checked }));
  el('pgInk').value = persp.ink;
  el('pgInk').addEventListener('change', () => pgChange({ ink: el('pgInk').value }));
  el('pgMargin').value = String(persp.margin);
  el('pgMargin').addEventListener('change', () => pgChange({ margin: +el('pgMargin').value }));
  el('pgReset').addEventListener('click', () => {
    persp = { ...PG_DEFAULTS, ...{ points: persp.points, format: persp.format, landscape: persp.landscape, customW: persp.customW, customH: persp.customH } };
    for (const [id, key] of Object.entries(set)) el(id).value = persp[key];
    el('pgUpright').checked = persp.upright; el('pgInk').value = persp.ink; el('pgMargin').value = String(persp.margin);
    pgSave(); pgRender();
  });
  el('pgPrint').addEventListener('click', pgPrint);
  el('pgSavefile').addEventListener('click', pgDownload);
  pgRender();
}
