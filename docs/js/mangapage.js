/* refboard - The manga page: a sheet of panels to print and draw on.
   Panels for a page of three to six, laid out the way a page is, with the
   order they are read in numbered on them - right to left, top to bottom, the
   way manga is read (or left to right, for a Western comic) - and where the
   speech balloons go. The third half of the Perspective view (Grid sheet,
   People, Manga page): the paper there is the paper you will draw on, in
   millimetres, so the print is the size on screen.

   A layout is a tree of splits (MP_LAYOUTS): a row is cut into panels side by
   side, a column into panels one under another, each part with a relative
   size, down to the panels. The tree is cut into four-cornered shapes
   (mpSplit), not rectangles, so the gutters can be slanted: a slanted gutter
   is the cheapest way to say a page is fast. The panels are numbered by
   walking the tree - a row from its right edge to its left, a column from its
   top down - which gives the reading order whatever the shape of the page
   (mpOrder), and each panel is pulled in by half a gutter (mpInset) so the
   white between two panels is the gutter.

   Balloons go down a panel along the way the eye goes: the first near the top
   corner it starts from, the next lower and toward the far side, the last
   nearest the bottom (mpBalloons). Reading a balloon after the one below it
   is the commonest mistake in a first page, so the note says what it sees:
   how many words the page carries, which panel is the largest - the one the
   eye stays on - and what the slant does.

   Everything is worked out in millimetres on the paper (mpGeometry(), plain
   data), and drawn as one SVG (mpSvg()) that is the preview, the print, the
   file and - drawn to a picture - what is kept in My work.

   Loaded with perspective.js and people.js (loadSection('perspective')). */
"use strict";

const MP_KEY = 'refboard.manga.v1';
// Portrait sizes in mm, the sizes of a manga page: a tankobon, the usual book, the manuscript.
const MP_FORMATS = {
  b6: { label: 'B6 (tankobon)', mm: [128, 182] },
  a5: { label: 'A5', mm: [148, 210] },
  b5: { label: 'B5', mm: [182, 257] },
  a4: { label: 'A4', mm: [210, 297] },
  b4: { label: 'B4 (manuscript)', mm: [257, 364] },
};
const MP_INK = {
  colour: { panel: '#1b1b1b', number: '#c8412f', balloon: '#2f6fb3', path: '#2d8a58', frame: '#999' },
  one: { panel: '#222', number: '#777', balloon: '#777', path: '#777', frame: '#999' },
};
const MP_DEFAULTS = {
  layout: 'grid-4', format: 'b5', rtl: true,
  gutter: 4,      // the white between panels, mm
  margin: 10,     // from the paper's edge to the panels, mm
  slant: 0,       // the gutters between rows, degrees off level
  balloons: 1,    // places for speech in each panel
  numbers: true, path: false, ink: 'colour',
};

// The tree. A leaf is a panel; { h } is panels one under another (top first),
// { v } panels side by side (left first, on the page); `s` is the size next to its neighbours.
const mpP = (s = 1) => ({ s });
const mpH = (s, ...c) => ({ s, h: c });
const mpV = (s, ...c) => ({ s, v: c });
const MP_LAYOUTS = [
  { id: 'bands-3', n: 3, label: 'Three bands', root: mpH(1, mpP(), mpP(), mpP()) },
  { id: 'top-two', n: 3, label: 'Wide, then two', root: mpH(1, mpP(1.1), mpV(1, mpP(), mpP())) },
  { id: 'tall-right', n: 3, label: 'Tall on the right', root: mpV(1, mpH(1, mpP(), mpP()), mpP(1.15)) },
  { id: 'grid-4', n: 4, label: 'Four equal', root: mpH(1, mpV(1, mpP(), mpP()), mpV(1, mpP(), mpP())) },
  { id: 'koma-4', n: 4, label: 'Four strips (4-koma)', root: mpH(1, mpP(), mpP(), mpP(), mpP()) },
  { id: 'wide-three', n: 4, label: 'Wide, then three', root: mpH(1, mpP(1.5), mpV(1, mpP(), mpP(), mpP())) },
  { id: 'two-three', n: 5, label: 'Two over three', root: mpH(1, mpV(1, mpP(), mpP()), mpV(1, mpP(), mpP(), mpP())) },
  { id: 'big-four', n: 5, label: 'One big, four small', root: mpH(1, mpP(1.5), mpV(1, mpP(), mpP()), mpV(1, mpP(), mpP())) },
  { id: 'stagger-5', n: 5, label: 'Staggered', root: mpH(1, mpV(1, mpP(1.5), mpP()), mpV(1, mpP(), mpP(1.5)), mpP(0.8)) },
  { id: 'grid-6', n: 6, label: 'Six equal', root: mpH(1, mpV(1, mpP(), mpP()), mpV(1, mpP(), mpP()), mpV(1, mpP(), mpP())) },
  { id: 'stagger-6', n: 6, label: 'Six staggered', root: mpH(1, mpV(1, mpP(1.4), mpP()), mpV(1, mpP(), mpP(1.4)), mpV(1, mpP(1.4), mpP())) },
  { id: 'columns-6', n: 6, label: 'Three columns of two', root: mpV(1, mpH(1, mpP(), mpP()), mpH(1, mpP(), mpP()), mpH(1, mpP(), mpP())) },
];
const MP_COUNTS = [3, 4, 5, 6];

let mp = null; // the view's state; null until first opened

function mpLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(MP_KEY)) || {}; } catch { /* a fresh start */ }
  const num = (k, lo, hi) => Number.isFinite(+v[k]) ? Math.min(hi, Math.max(lo, +v[k])) : MP_DEFAULTS[k];
  const flag = k => typeof v[k] === 'boolean' ? v[k] : MP_DEFAULTS[k];
  return {
    layout: MP_LAYOUTS.some(l => l.id === v.layout) ? v.layout : MP_DEFAULTS.layout,
    format: MP_FORMATS[v.format] ? v.format : MP_DEFAULTS.format,
    rtl: flag('rtl'), numbers: flag('numbers'), path: flag('path'),
    gutter: num('gutter', 1, 12), margin: [5, 10, 15].includes(+v.margin) ? +v.margin : MP_DEFAULTS.margin,
    slant: num('slant', 0, 12), balloons: Math.round(num('balloons', 0, 3)),
    ink: MP_INK[v.ink] ? v.ink : MP_DEFAULTS.ink,
  };
}
function mpSave() { try { localStorage.setItem(MP_KEY, JSON.stringify(mp)); } catch { /* private mode */ } }

const mpPaper = s => (MP_FORMATS[s.format] || MP_FORMATS.b5).mm;
const mpLerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mpDist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
// A point inside a four-cornered shape, u across (0 left, 1 right) and v down.
const mpAt = ([tl, tr, br, bl], u, v) => mpLerp(mpLerp(tl, tr, u), mpLerp(bl, br, u), v);
const mpArea = q => Math.abs(q.reduce((a, p, i) => a + p.x * q[(i + 1) % q.length].y - q[(i + 1) % q.length].x * p.y, 0)) / 2;
// How wide and how high a shape is, on the average of its opposite sides.
const mpSize = ([tl, tr, br, bl]) => ({ w: (mpDist(tl, tr) + mpDist(bl, br)) / 2, h: (mpDist(tl, bl) + mpDist(tr, br)) / 2 });

// Cut a shape by the tree into its panels: `quads` maps each leaf to its shape.
// The gutters between the parts of a column are tilted by `deg`, less if the
// parts are too low to take it.
function mpSplit(node, quad, deg, quads) {
  const kids = node.h || node.v;
  if (!kids) { quads.set(node, quad); return; }
  const [tl, tr, br, bl] = quad, sum = kids.reduce((a, k) => a + k.s, 0);
  const ts = [0]; for (const k of kids) ts.push(ts[ts.length - 1] + k.s / sum);
  let bounds;
  if (node.h) {
    const { w, h } = mpSize(quad), lowest = Math.min(...kids.map(k => k.s / sum)) * h;
    const tilt = Math.min(Math.tan(deg * Math.PI / 180) * w / 2, lowest * 0.4);
    bounds = ts.map((t, i) => {
      const a = mpLerp(tl, bl, t), b = mpLerp(tr, br, t), inner = i > 0 && i < kids.length;
      return inner ? [{ x: a.x, y: a.y - tilt }, { x: b.x, y: b.y + tilt }] : [a, b];
    });
    kids.forEach((k, i) => mpSplit(k, [bounds[i][0], bounds[i][1], bounds[i + 1][1], bounds[i + 1][0]], deg, quads));
  } else {
    bounds = ts.map(t => [mpLerp(tl, tr, t), mpLerp(bl, br, t)]);
    kids.forEach((k, i) => mpSplit(k, [bounds[i][0], bounds[i + 1][0], bounds[i + 1][1], bounds[i][1]], deg, quads));
  }
}

// The leaves in the order they are read: a row from its right edge to its left
// (from the left, for a Western comic), a column from the top down.
function mpOrder(node, rtl, out = []) {
  const kids = node.h || (node.v && (rtl ? [...node.v].reverse() : node.v));
  if (!kids) out.push(node); else for (const k of kids) mpOrder(k, rtl, out);
  return out;
}

// A four-cornered shape pulled in by d on every side (clockwise on the screen).
function mpInset(quad, d) {
  const n = quad.length, { w, h } = mpSize(quad), dd = Math.min(d, Math.min(w, h) * 0.3);
  const side = quad.map((p, i) => {
    const q = quad[(i + 1) % n], dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    return { x: p.x - dy / len * dd, y: p.y + dx / len * dd, dx, dy };
  });
  return quad.map((p, i) => {
    const a = side[(i + n - 1) % n], b = side[i], det = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(det) < 1e-9) return { x: b.x, y: b.y };
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det;
    return { x: a.x + t * a.dx, y: a.y + t * a.dy };
  });
}

// Where the speech goes in a panel, along the way the eye goes: from the corner it
// starts at, down and across toward the far side.
const MP_SPOTS = [[], [[0.72, 0.2]], [[0.72, 0.2], [0.3, 0.56]], [[0.74, 0.17], [0.5, 0.45], [0.26, 0.73]]];
function mpBalloons(quad, count, rtl) {
  const { w, h } = mpSize(quad), ry = Math.min(h * 0.11, 7), rx = Math.min(ry * 1.7, w * 0.2);
  return MP_SPOTS[count].map(([u, v], i) => {
    const p = mpAt(quad, rtl ? u : 1 - u, v);
    return { x: p.x, y: p.y, rx, ry, letter: 'abc'[i] };
  });
}

/* Everything on the sheet, in mm: { W, H, rect, panels, largest, words, layout }.
   A panel is { n, quad, c, area, w, h, balloons }, n the place in the reading. */
function mpGeometry(s) {
  const [W, H] = mpPaper(s), m = s.margin, e = s.gutter / 2;
  const layout = MP_LAYOUTS.find(l => l.id === s.layout) || MP_LAYOUTS[0];
  const rect = { x0: m, y0: m, x1: W - m, y1: H - m };
  // The whole area is a half gutter bigger each side: the panels are pulled in again by it.
  const root = [{ x: rect.x0 - e, y: rect.y0 - e }, { x: rect.x1 + e, y: rect.y0 - e }, { x: rect.x1 + e, y: rect.y1 + e }, { x: rect.x0 - e, y: rect.y1 + e }];
  const quads = new Map();
  mpSplit(layout.root, root, s.slant, quads);
  const panels = mpOrder(layout.root, s.rtl).map((leaf, i) => {
    const quad = mpInset(quads.get(leaf), e), { w, h } = mpSize(quad);
    const c = mpAt(quad, 0.5, 0.5);
    return { n: i + 1, quad, c, area: mpArea(quad), w, h, balloons: mpBalloons(quad, s.balloons, s.rtl) };
  });
  const largest = panels.reduce((a, p) => p.area > a.area ? p : a, panels[0]);
  return { W, H, rect, panels, largest, words: panels.length * s.balloons, layout };
}

// What the eye does on this page - and what to watch.
function mpNote(s, g) {
  const parts = [];
  parts.push(`${g.panels.length} panels, read ${s.rtl ? 'right to left, top to bottom' : 'left to right, top to bottom'}.`);
  const total = g.panels.reduce((a, p) => a + p.area, 0), share = Math.round(g.largest.area / total * 100);
  parts.push(g.panels.length > 1 && share >= 100 / g.panels.length * 1.4
    ? `Panel ${g.largest.n} is the largest, ${share}% of the panels' area: the eye stays longest there, so put the moment that matters in it.`
    : 'The panels are about the same size: every beat weighs the same, a steady pace.');
  if (g.panels.length > 1 && g.largest.n !== 1 && g.largest.n !== g.panels.length) parts.push('A large panel in the middle slows the page there.');
  if (s.balloons) parts.push(`${g.words} balloon${g.words === 1 ? '' : 's'}: each lower and further ${s.rtl ? 'left' : 'right'} than the one before, so the reading order is the order of the balloons too.` +
    (s.balloons >= 3 || g.words > 14 ? ' That much speech crowds the picture: keep the lines short or give a panel to the words alone.' : ''));
  if (s.slant > 0) parts.push(`The gutters between rows lean ${s.slant}°: the page feels fast, so keep it for action and use level gutters for quiet.`);
  return parts.join(' ');
}

const mpEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mpN = n => +n.toFixed(2);
const mpPts = q => q.map(p => `${mpN(p.x)},${mpN(p.y)}`).join(' ');

// The sheet as one SVG, in mm. `size`: 'mm' gives it the paper's own size (print and
// file), a number its width in pixels (to draw it to a picture); without it it fills its box.
function mpSvg(s, g, size) {
  const ink = MP_INK[s.ink] || MP_INK.colour, { W, H, rect: r } = g, body = [];
  body.push(`<rect width="${W}" height="${H}" fill="#fff"/>`);
  body.push(`<rect x="${r.x0}" y="${r.y0}" width="${r.x1 - r.x0}" height="${r.y1 - r.y0}" fill="none" stroke="${ink.frame}" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>`);
  for (const p of g.panels) body.push(`<polygon points="${mpPts(p.quad)}" fill="#fff" stroke="${ink.panel}" stroke-width="0.5" stroke-linejoin="round"/>`);
  if (s.path && g.panels.length > 1) {
    // The eye's way through the page, panel to panel, with the arrow at its end.
    const pts = g.panels.map(p => p.c), end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const a = Math.atan2(end.y - prev.y, end.x - prev.x), k = 3;
    body.push(`<polyline points="${mpPts(pts)}" fill="none" stroke="${ink.path}" stroke-width="0.4" stroke-dasharray="2 1.5"/>`);
    body.push(`<polygon points="${mpPts([end, { x: end.x - k * Math.cos(a - 0.45), y: end.y - k * Math.sin(a - 0.45) }, { x: end.x - k * Math.cos(a + 0.45), y: end.y - k * Math.sin(a + 0.45) }])}" fill="${ink.path}"/>`);
  }
  for (const p of g.panels) for (const b of p.balloons) {
    // A balloon's place, with a small tail toward the middle of the panel where the speaker stands.
    const a = Math.atan2(p.c.y - b.y, p.c.x - b.x), tx = b.x + Math.cos(a) * (b.rx + 3), ty = b.y + Math.sin(a) * (b.ry + 3);
    const bx = b.x + Math.cos(a) * b.rx * 0.8, by = b.y + Math.sin(a) * b.ry * 0.8, o = 0.35;
    body.push(`<ellipse cx="${mpN(b.x)}" cy="${mpN(b.y)}" rx="${mpN(b.rx)}" ry="${mpN(b.ry)}" fill="#fff" stroke="${ink.balloon}" stroke-width="0.3" stroke-dasharray="1.2 0.9"/>` +
      `<polygon points="${mpPts([{ x: bx + Math.cos(a + 1.57) * b.ry * o, y: by + Math.sin(a + 1.57) * b.ry * o }, { x: tx, y: ty }, { x: bx - Math.cos(a + 1.57) * b.ry * o, y: by - Math.sin(a + 1.57) * b.ry * o }])}" fill="#fff" stroke="${ink.balloon}" stroke-width="0.3" stroke-dasharray="1.2 0.9"/>` +
      `<text x="${mpN(b.x)}" y="${mpN(b.y + Math.min(b.ry * 0.5, 1.6))}" font-size="${mpN(Math.min(b.ry * 1.1, 3.4))}" fill="${ink.balloon}" font-family="sans-serif" text-anchor="middle">${b.letter}</text>`);
  }
  if (s.numbers) for (const p of g.panels) {
    const c = mpAt(p.quad, s.rtl ? 0.88 : 0.12, 0.14), fs = Math.max(5, Math.min(14, Math.min(p.w, p.h) * 0.28));
    body.push(`<text x="${mpN(c.x)}" y="${mpN(c.y + fs * 0.35)}" font-size="${mpN(fs)}" fill="${ink.number}" font-family="sans-serif" font-weight="700" text-anchor="middle" opacity="0.75">${p.n}</text>`);
  }
  const dims = size === 'mm' ? ` width="${W}mm" height="${H}mm"` : size ? ` width="${size}" height="${Math.round(size * H / W)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${dims}>${body.join('')}</svg>`;
}

const mpPrint = () => { const g = mpGeometry(mp); printHtml(`<!doctype html><meta charset="utf-8"><title>Manga page</title>` +
  `<style>@page{size:${g.W}mm ${g.H}mm;margin:0}html,body{margin:0;background:#fff}svg{display:block}</style>${mpSvg(mp, g, 'mm')}`); };

const mpName = (ext) => `manga-page-${mp.layout}-${mp.format}.${ext}`;
function mpDownload() { saveBlob(new Blob([mpSvg(mp, mpGeometry(mp), 'mm')], { type: 'image/svg+xml' }), mpName('svg')); }

// The page drawn to a picture (150 dots to the inch) and kept in My work, tagged, to open beside the drawing.
async function mpKeep() {
  const g = mpGeometry(mp), px = Math.round(g.W / 25.4 * 150), note = el('mpKept');
  note.textContent = 'Keeping...';
  try {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(mpSvg(mp, g, px));
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * g.H / g.W);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const kept = await keepUpload(blob, { name: mpName('png'), from: 'work' });
    const { url, ...doc } = kept;
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...new Set([...(doc.tags || []), 'manga page'])] });
    storeChanged();
    note.textContent = 'Kept in My work as a manga page.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}

// A small picture of a layout, for the row of choices.
function mpThumb(l) {
  const s = { ...MP_DEFAULTS, layout: l.id, format: 'b5', gutter: 6, margin: 6, slant: 0, balloons: 0, numbers: false, path: false };
  const g = mpGeometry(s);
  return `<svg viewBox="0 0 ${g.W} ${g.H}" aria-hidden="true">` +
    g.panels.map(p => `<polygon points="${mpPts(p.quad)}" fill="currentColor" opacity="0.55"/>`).join('') + '</svg>';
}

function mpSync() {
  const cur = MP_LAYOUTS.find(l => l.id === mp.layout) || MP_LAYOUTS[0];
  for (const b of el('mpCount').children) b.setAttribute('aria-pressed', String(+b.dataset.count === cur.n));
  el('mpLayouts').innerHTML = MP_LAYOUTS.filter(l => l.n === cur.n).map(l =>
    `<button type="button" class="mp-layout" data-layout="${l.id}" aria-pressed="${l.id === cur.id}" title="${esc(l.label)}" aria-label="${esc(l.label)}">${mpThumb(l)}</button>`).join('');
  for (const b of el('mpDir').children) b.setAttribute('aria-pressed', String((b.dataset.dir === 'rtl') === mp.rtl));
  el('mpGutterOut').textContent = mp.gutter + ' mm';
  el('mpSlantOut').textContent = mp.slant ? mp.slant + '° off level' : 'level';
  el('mpBalloonsOut').textContent = mp.balloons ? mp.balloons + ' in a panel' : 'none';
}

function mpRender() {
  const g = mpGeometry(mp);
  el('mpSheet').innerHTML = mpSvg(mp, g);
  el('mpSheet').setAttribute('aria-label', `A manga page of ${g.panels.length} panels on ${Math.round(g.W)} by ${Math.round(g.H)} mm paper: ${g.layout.label}`);
  el('mpNote').textContent = mpNote(mp, g);
  el('mpSize').textContent = `${mpN(g.W)} × ${mpN(g.H)} mm`;
  mpSync();
}

function mpChange(patch) {
  Object.assign(mp, patch);
  mpSave();
  mpRender();
}

function mpShow() {
  if (mp) { mpRender(); return; }
  mp = mpLoad();
  el('mpFormat').innerHTML = Object.entries(MP_FORMATS).map(([k, f]) => `<option value="${k}">${esc(f.label)}</option>`).join('');
  el('mpFormat').value = mp.format;
  el('mpCount').innerHTML = MP_COUNTS.map(n => `<button type="button" class="chip" data-count="${n}">${n}</button>`).join('');
  el('mpCount').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const cur = MP_LAYOUTS.find(l => l.id === mp.layout), same = MP_LAYOUTS.filter(l => l.n === +b.dataset.count);
    if (cur.n !== +b.dataset.count) mpChange({ layout: same[0].id });
  });
  el('mpLayouts').addEventListener('click', e => { const b = e.target.closest('[data-layout]'); if (b) mpChange({ layout: b.dataset.layout }); });
  el('mpFormat').addEventListener('change', () => mpChange({ format: el('mpFormat').value }));
  el('mpDir').addEventListener('click', e => { const b = e.target.closest('button'); if (b) mpChange({ rtl: b.dataset.dir === 'rtl' }); });
  const set = { mpGutter: 'gutter', mpSlant: 'slant', mpBalloons: 'balloons' };
  for (const [id, key] of Object.entries(set)) {
    el(id).value = mp[key];
    el(id).addEventListener('input', () => mpChange({ [key]: +el(id).value }));
  }
  el('mpMargin').value = String(mp.margin);
  el('mpMargin').addEventListener('change', () => mpChange({ margin: +el('mpMargin').value }));
  for (const [id, key] of [['mpNumbers', 'numbers'], ['mpPath', 'path']]) {
    el(id).checked = mp[key];
    el(id).addEventListener('change', () => mpChange({ [key]: el(id).checked }));
  }
  el('mpInk').value = mp.ink;
  el('mpInk').addEventListener('change', () => mpChange({ ink: el('mpInk').value }));
  el('mpPrint').addEventListener('click', mpPrint);
  el('mpSavefile').addEventListener('click', mpDownload);
  el('mpKeep').addEventListener('click', mpKeep);
  mpRender();
}
