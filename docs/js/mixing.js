/* refboard - The mixing chart: every paint of the palette with every other,
   on a sheet to print and paint. The Colour studio's Mixing tab.

   A painter learns a palette by painting this once: each pair mixed, at the
   same water, in a square - so what two tubes make is a thing seen, not
   guessed. The tab shows what the model says each square will be (paint.js's
   watercolour wash, or oil with white), and prints the sheet empty - squares
   to fill, the paints numbered - at the paper's real size, with the predicted
   colours behind them only if asked for: a printed colour under real paint
   would lie about it.

   Two charts. Equal parts is one triangle - A with B is B with A, so half the
   sheet would only repeat itself. Two to one is the whole square: the row's
   paint twice the column's, so the two halves differ and a pair is seen
   both ways round. The diagonal is each paint alone, at the same water - the
   reference every mix in its row is read against. The water is one of three
   (Light, Medium, Strong); in oil the same three are parts of white. A chart
   is only worth anything if the water is the same in every square, and the
   sheet says so.

   Everything on the sheet is worked out in millimetres first (mcSheet(),
   plain data) and drawn as one SVG (mcSvg()) - the print and the file. The
   squares are as big as the paper allows, up to 16 mm, and the note says
   when they are too small to fill (under 7 mm): a box of 28 tubes wants A3.
   The corner marks are for the day a photo of the painted sheet can be lined
   up by them (calibrating the paints; see the ROADMAP).

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const MC_KEY = 'refboard.mixchart.v1';
// The water of a wash (a share of the paint's strength, for paintWash) and,
// in oil, the white to each part of colour. Named as paintWashWord names them.
const MC_LEVELS = {
  light: { label: 'Light', s: 0.2, white: 3 },
  medium: { label: 'Medium', s: 0.4, white: 1 },
  strong: { label: 'Strong', s: 0.7, white: 0 },
};
const MC_RATIOS = {
  equal: { label: 'Equal parts', a: 1, b: 1, triangle: true,
    hint: 'One triangle: a square is the two paints in equal parts, the same whichever way round, so only half the sheet is needed.' },
  two: { label: 'Two to one', a: 2, b: 1, triangle: false,
    hint: 'The whole square: two parts of the row\'s paint to one of the column\'s, so each pair is seen both ways round.' },
};
// Landscape, in mm.
const MC_PAPERS = { a4: { label: 'A4', mm: [297, 210] }, a3: { label: 'A3', mm: [420, 297] }, letter: { label: 'Letter', mm: [279.4, 215.9] } };
const MC_MIN_CELL = 7;   // mm: a square a small round brush can fill
const MC_MAX_CELL = 16;  // mm: no bigger needed
const MC_MARGIN = 10, MC_GUTTER = 44, MC_HEAD = 5, MC_TITLE = 18, MC_FOOT = 12; // mm

let mc = null;
const mcCache = {};

function mcLoad() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(MC_KEY)) || {}; } catch { /* a fresh start */ }
  mc = { level: MC_LEVELS[p.level] ? p.level : 'medium', ratio: MC_RATIOS[p.ratio] ? p.ratio : 'equal',
    paper: MC_PAPERS[p.paper] ? p.paper : 'a4', colours: p.colours === true, pick: null };
}
function mcSave() {
  try { localStorage.setItem(MC_KEY, JSON.stringify({ level: mc.level, ratio: mc.ratio, paper: mc.paper, colours: mc.colours })); } catch { /* private mode */ }
}

// The chart's paints: the palette's, less white - white is body colour in
// watercolour and the tint, not a paint to mix with, in oil.
const mcKeys = (paletteKey, medium) => paintKeys(paletteKey, medium).filter(k => !PIGMENTS[k].body);

// A square: the paints a and b in the ratio, at the level - a on its own when
// they are the same. A colour as [r, g, b].
function mcColour(a, b, ratio, level, medium) {
  const L = MC_LEVELS[level], R = MC_RATIOS[ratio];
  const parts = a === b ? [[a, 1]] : [[a, R.a], [b, R.b]];
  if (medium === 'water') return paintRgb(paintWash(parts, L.s));
  const total = parts.reduce((n, [, p]) => n + p, 0);
  return paintRgb(paintMix(L.white ? [...parts, ['white', L.white * total]] : parts));
}
// Whether the sheet has a square at (row r, column c).
const mcHas = (ratio, r, c) => !MC_RATIOS[ratio].triangle || c <= r;

function mcChart(paletteKey, medium, level, ratio) {
  const id = [paletteKey, medium, level, ratio].join('|');
  if (!(id in mcCache)) {
    const keys = mcKeys(paletteKey, medium);
    mcCache[id] = { keys, cells: keys.map((a, r) => keys.map((b, c) => mcHas(ratio, r, c) ? mcColour(a, b, ratio, level, medium) : null)) };
  }
  return mcCache[id];
}

/* The sheet in mm: the paper turned whichever way gives the bigger squares,
   the squares that size, where the grid starts, and whether they are too
   small to paint. { W, H, cell, gx, gy, landscape, tooSmall, squares }. */
function mcSheet(n, paper, ratio) {
  const [w0, h0] = MC_PAPERS[paper].mm;
  const fit = (W, H) => Math.min(MC_MAX_CELL, (W - 2 * MC_MARGIN - MC_GUTTER) / n, (H - 2 * MC_MARGIN - MC_TITLE - MC_HEAD - MC_FOOT) / n);
  const land = fit(w0, h0), port = fit(h0, w0), landscape = land >= port;
  const cell = Math.floor(Math.max(land, port) * 10) / 10;
  return { W: landscape ? w0 : h0, H: landscape ? h0 : w0, cell, landscape, n,
    gx: MC_MARGIN + MC_GUTTER, gy: MC_MARGIN + MC_TITLE + MC_HEAD, tooSmall: cell < MC_MIN_CELL,
    squares: MC_RATIOS[ratio].triangle ? n * (n + 1) / 2 : n * n };
}

// How much water, in a few words - what the sheet asks of the painter.
function mcLevelWords(level, medium) {
  const L = MC_LEVELS[level];
  return medium === 'water' ? `${paintWashWord(L.s).replace(/ - .*/, '')} (~${Math.round(L.s * 100)}% paint)`
    : L.white ? `${L.white} part${L.white > 1 ? 's' : ''} white to each part of colour` : 'no white';
}
function mcRecipe(a, b, ratio, level, medium) {
  const R = MC_RATIOS[ratio], n = k => PIGMENTS[k].name.toLowerCase();
  const mix = a === b ? `${n(a)} alone` : `${R.a} part${R.a > 1 ? 's' : ''} ${n(a)} + ${R.b} part ${n(b)}`;
  return `${mix}, ${mcLevelWords(level, medium)}`;
}
const mcName = k => PIGMENTS[k].name + (PIGMENTS[k].tube ? ' ' + PIGMENTS[k].tube.code : '');
// For the sheet's side: a long name is cut, never its tube's code - the code is what finds the tube.
const mcShort = k => {
  const name = PIGMENTS[k].name, code = PIGMENTS[k].tube ? ' ' + PIGMENTS[k].tube.code : '';
  return (name.length > 24 ? name.slice(0, 23) + '…' : name) + code;
};
const mcEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mcN = n => +n.toFixed(2);

/* The printable sheet as one SVG, in mm. `show` paints each square in its
   predicted colour (a sheet to look at, not to paint on); `mm` gives the
   SVG the paper's own size, for the printer and the file. */
function mcSvg(chart, sheet, o, mm = false) {
  const { keys, cells } = chart, { W, H, cell, gx, gy, n } = sheet, med = o.medium, R = MC_RATIOS[o.ratio];
  const text = (x, y, size, t, extra = '') => `<text x="${mcN(x)}" y="${mcN(y)}" font-size="${size}" font-family="sans-serif" fill="#222"${extra}>${mcEsc(t)}</text>`;
  const out = [`<rect width="${W}" height="${H}" fill="#fff"/>`];
  out.push(text(MC_MARGIN, MC_MARGIN + 6, 5.5, 'Mixing chart', ' font-weight="bold"'));
  out.push(text(MC_MARGIN, MC_MARGIN + 11.5, 3.2, `${o.paletteLabel} · ${med === 'water' ? 'watercolour' : 'oil / acrylic'} · ${mcLevelWords(o.level, med)} · ${R.label.toLowerCase()}`));
  out.push(text(MC_MARGIN, MC_MARGIN + 15.5, 2.8, 'The same water in every square, or the chart compares nothing. The diagonal is each paint on its own.'));
  for (let c = 0; c < n; c++) out.push(text(gx + (c + 0.5) * cell, gy - 1.4, 2.6, String(c + 1), ' text-anchor="middle"'));
  keys.forEach((k, r) => out.push(text(gx - 1.6, gy + (r + 0.5) * cell + 0.9, 2.6, `${r + 1}  ${mcShort(k)}`, ' text-anchor="end"')));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!cells[r][c]) continue;
    const fill = o.show ? `rgb(${cells[r][c].join(',')})` : 'none', diag = r === c;
    out.push(`<rect x="${mcN(gx + c * cell)}" y="${mcN(gy + r * cell)}" width="${cell}" height="${cell}" fill="${fill}" stroke="${diag ? '#222' : '#999'}" stroke-width="${diag ? 0.5 : 0.2}"/>`);
  }
  // Corner marks, outside the grid - a photo can be lined up by them.
  const x0 = gx - 2.5, y0 = gy - 2.5, x1 = gx + n * cell + 2.5, y1 = gy + n * cell + 2.5, t = 4;
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]])
    out.push(`<path d="M${mcN(x + dx * t)} ${mcN(y)} L${mcN(x)} ${mcN(y)} L${mcN(x)} ${mcN(y + dy * t)}" fill="none" stroke="#222" stroke-width="0.3"/>`);
  out.push(text(MC_MARGIN, H - MC_MARGIN + 2, 2.8, R.triangle
    ? 'Square where row r meets column c: paints r and c in equal parts.'
    : "Square at row r, column c: two parts of paint r to one of paint c."));
  const size = mm ? ` width="${W}mm" height="${H}mm"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"${size}>${out.join('')}</svg>`;
}

// What mcSvg() needs besides the chart: the palette, medium, level, ratio.
function mcOptions() {
  return { paletteLabel: PAINT_PALETTES[col.paints].label, medium: col.medium, level: mc.level, ratio: mc.ratio, show: mc.colours };
}
function mcPrintHtml() {
  const chart = mcChart(col.paints, col.medium, mc.level, mc.ratio), sheet = mcSheet(chart.keys.length, mc.paper, mc.ratio);
  return `<!doctype html><meta charset="utf-8"><title>Mixing chart</title>` +
    `<style>@page{size:${sheet.W}mm ${sheet.H}mm;margin:0}html,body{margin:0;background:#fff}svg{display:block}</style>${mcSvg(chart, sheet, mcOptions(), true)}`;
}
function mcDownload() {
  const chart = mcChart(col.paints, col.medium, mc.level, mc.ratio), sheet = mcSheet(chart.keys.length, mc.paper, mc.ratio);
  saveBlob(new Blob([mcSvg(chart, sheet, mcOptions(), true)], { type: 'image/svg+xml' }),
    `mixing-chart-${col.paints}-${mc.level}-${mc.ratio}.svg`);
}

/* What a pair makes, in a sentence a painter can use: the mix against its
   two parents' colour strength (chroma). */
function mcPairText(a, b, rgbs) {
  const A = PIGMENTS[a].name, B = PIGMENTS[b].name;
  if (a === b) return PIGMENTS[a].note;
  const [Ca, Cb, Cm] = rgbs.map(c => rgbOklch(c)[1]);
  const lines = [];
  if (Cm < 0.6 * Math.min(Ca, Cb)) lines.push(`${A} and ${B} take each other's colour away: the mix is much duller than either - the way to a grey or a brown. More of one steers it.`);
  else if (Cm > 0.9 * Math.max(Ca, Cb)) lines.push(`${A} and ${B} are near neighbours: the mix keeps the strength of the stronger - the cleanest, brightest way between them.`);
  else lines.push(`The mix is duller than the brighter of the two: neither cancels the other, but each costs the other some of its strength.`);
  if (PIGMENTS[a].gran && PIGMENTS[b].gran) lines.push('Both granulate: expect a grainy wash.');
  const stainer = [a, b].find(k => PIGMENTS[k].stain >= 2);
  if (stainer) lines.push(`${PIGMENTS[stainer].name} stains - once down, the mix will not lift.`);
  return lines.join(' ');
}

function mixingRender() {
  if (!paintInit()) { el('mcChart').textContent = 'The paint model has not loaded.'; return; }
  if (!mc) mcLoad();
  for (const b of el('mcLevel').children) b.setAttribute('aria-pressed', String(b.dataset.mcLevel === mc.level));
  for (const b of el('mcRatio').children) b.setAttribute('aria-pressed', String(b.dataset.mcRatio === mc.ratio));
  el('mcPaper').value = mc.paper;
  el('mcColours').checked = mc.colours;
  const chart = mcChart(col.paints, col.medium, mc.level, mc.ratio), { keys, cells } = chart, n = keys.length;
  const [pr, pc] = mc.pick ? mc.pick.map(k => keys.indexOf(k)) : [-1, -1];  // a pick is paints, so it outlives a change of palette
  const grid = el('mcChart');
  grid.style.setProperty('--gz-n', n);
  const head = '<span></span>' + keys.map((k, c) => `<i class="gz-head" style="background:${rgbCss(cells[c][c])}" title="${esc(`${c + 1}  ${mcName(k)}`)}"></i>`).join('');
  const rows = keys.map((a, r) => `<i class="gz-head" style="background:${rgbCss(cells[r][r])}" title="${esc(`${r + 1}  ${mcName(a)}`)}"></i>` +
    keys.map((b, c) => cells[r][c]
      ? `<button type="button" class="gz-cell${r === pr && c === pc ? ' on' : ''}" data-r="${r}" data-c="${c}" style="background:${rgbCss(cells[r][c])}" ` +
        `aria-label="${esc(mcRecipe(a, b, mc.ratio, mc.level, col.medium))}"></button>`
      : '<span></span>').join('')).join('');
  grid.innerHTML = head + rows;
  mcRenderPair(chart);

  const sheet = mcSheet(n, mc.paper, mc.ratio);
  el('mcSheetNote').textContent = `${MC_PAPERS[mc.paper].label} ${sheet.landscape ? 'landscape' : 'portrait'}: ${n} paints, ${sheet.squares} squares of ${sheet.cell} mm.` +
    (sheet.tooSmall ? ` That is small to fill with a brush (under ${MC_MIN_CELL} mm) - print it on A3, or choose a palette with fewer paints.` : '') +
    ' Print it empty and paint it: the water the same in every square, the paints numbered down the side.';
  el('mcRatioNote').textContent = MC_RATIOS[mc.ratio].hint;
}

function mcRenderPair(chart) {
  const box = el('mcPair');
  const [r, c] = mc.pick ? mc.pick.map(k => chart.keys.indexOf(k)) : [-1, -1];
  if (!chart.cells[r]?.[c]) { box.innerHTML = ''; return; }
  const a = chart.keys[r], b = chart.keys[c];
  const sw = (rgb, label, title) => `<figure><i style="background:${rgbCss(rgb)}" title="${esc(title)} - ${colHex(rgb)}"></i><figcaption>${label}</figcaption></figure>`;
  const A = chart.cells[r][r], B = chart.cells[c][c], M = chart.cells[r][c];
  box.innerHTML = `<div class="gz-title"><b>${esc(PIGMENTS[a].name)}</b>${a === b ? '' : ` + <b>${esc(PIGMENTS[b].name)}</b>`}</div>` +
    `<div class="gz-swatches mc-swatches">${sw(A, 'The first', PIGMENTS[a].name)}${a === b ? '' : sw(B, 'The second', PIGMENTS[b].name)}${sw(M, a === b ? 'Alone' : 'Mixed', mcRecipe(a, b, mc.ratio, mc.level, col.medium))}</div>` +
    `<div class="count">${esc(mcRecipe(a, b, mc.ratio, mc.level, col.medium))} - ${colHex(M)}</div>` +
    `<div class="count">${esc(mcPairText(a, b, [A, B, M]))}</div>`;
}

function initMixing() {
  mcLoad();
  el('mcLevel').innerHTML = Object.entries(MC_LEVELS).map(([k, v]) =>
    `<button class="chip" type="button" data-mc-level="${k}" title="${esc(mcLevelWords(k, 'water'))} in watercolour; in oil, ${v.white ? v.white + ' part(s) of white to each part of colour' : 'no white'}">${v.label}</button>`).join('');
  el('mcRatio').innerHTML = Object.entries(MC_RATIOS).map(([k, v]) =>
    `<button class="chip" type="button" data-mc-ratio="${k}" title="${esc(v.hint)}">${v.label}</button>`).join('');
  el('mcPaper').innerHTML = Object.entries(MC_PAPERS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const change = patch => { Object.assign(mc, patch); mcSave(); mixingRender(); };
  el('mcLevel').addEventListener('click', e => { const b = e.target.closest('[data-mc-level]'); if (b) change({ level: b.dataset.mcLevel, pick: mc.pick }); });
  el('mcRatio').addEventListener('click', e => { const b = e.target.closest('[data-mc-ratio]'); if (b) change({ ratio: b.dataset.mcRatio, pick: null }); });
  el('mcPaper').addEventListener('change', () => change({ paper: el('mcPaper').value }));
  el('mcColours').addEventListener('change', () => change({ colours: el('mcColours').checked }));
  el('mcPrint').addEventListener('click', () => printHtml(mcPrintHtml()));
  el('mcSave').addEventListener('click', mcDownload);
  const grid = el('mcChart');
  grid.addEventListener('click', e => {
    const b = e.target.closest('.gz-cell');
    if (!b) return;
    const { keys } = mcChart(col.paints, col.medium, mc.level, mc.ratio);
    mc.pick = [keys[+b.dataset.r], keys[+b.dataset.c]];
    for (const x of grid.querySelectorAll('.gz-cell.on')) x.classList.remove('on');
    b.classList.add('on');
    mcRenderPair(mcChart(col.paints, col.medium, mc.level, mc.ratio));
  });
  const say = e => {
    const b = e.target.closest('.gz-cell');
    if (b) el('mcReadout').textContent = b.getAttribute('aria-label') + ' - click for the colour and what it does.';
  };
  grid.addEventListener('pointerover', say);
  grid.addEventListener('focusin', say);
}
