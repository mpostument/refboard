/* refboard - Seven more ways to make and use references in Generate, none of them 3D (loaded with js/genmore.js):

   A sketch. A pad to draw a rough sketch or a stick figure on; what you draw is the picture's start, so the pose and
   the layout are yours and the choices say who and what. Opened from Draw a sketch, beside Start from a picture.
   Line art to trace. A generated picture as only its lines, pale, to print and draw over with your own ink; and the
   shapes numbered by tone, for planning the paint. In the menu of a picture.
   Details. Parts of a picture cut out and enlarged on a sheet to study; or a part drawn again four ways. In the menu
   of a picture.
   Other conditions. The same picture at another hour, in other weather or in another season, one picture for each.
   A grid. One thing changed at a time - the hair colour, the eyes, the light - nine ways, with one seed, then seen
   on one sheet.
   Character cards. A character kept under a name with her look, to put back in a click and to draw in a storyboard.
   The challenge. A pose, an outfit, a light and a mood drawn at random (or the day's), put into More tags, with
   a timer for the sitting.

   Loaded the first time "More ways to make" is opened or one of them is asked for (loadSection('genmore')). */
"use strict";

// A sheet made when first needed, as genPullSheet() does.
function gnSheet(id, title, inner, close) {
  let box = document.getElementById(id);
  if (box) return box;
  box = document.createElement('div');
  box.id = id; box.className = 'sheet sheet-center hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', id + 'Title');
  box.innerHTML = `<div class="sheet-box gn-box"><div class="row"><h2 id="${id}Title" class="grow">${esc(title)}</h2><button type="button" class="ghost" id="${id}Close" title="Close (Esc)">Close</button></div>${inner}</div>`;
  document.body.appendChild(box);
  initSheet(box, close);
  box.querySelector('#' + id + 'Close').addEventListener('click', close);
  return box;
}
const gnOpenSheet = (box, first) => { box.classList.remove('hidden'); dialogOpened(box, first); };
const gnCloseSheet = box => { if (!box || box.classList.contains('hidden')) return; box.classList.add('hidden'); dialogClosed(box); };
const gnChips = (id, list, label) => `<div class="chips" id="${id}" role="group" aria-label="${esc(label)}">${list.map(([k, name, tip]) => `<button type="button" class="chip" data-v="${esc(String(k))}" aria-pressed="false"${tip ? ` title="${esc(tip)}"` : ''}>${esc(name)}</button>`).join('')}</div>`;
function gnPress(host, test) { for (const b of host.querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(test(b.dataset.v))); }
const gnStore = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
const gnPut = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
const gnClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const gnCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// A canvas kept as a new picture in Generated, from the one it was made of (without naming it its parent: a draft that is
// kept as lines would stop being a draft).
async function gnKeep(canvas, u, tags) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const f = await storeFile(blob), { parent, ...doc } = u;
  if (storeMode === 'server') await storeSortFile(f.id, doc.folder || 'generated');
  await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png', tags: [...new Set([...(doc.tags || []), ...tags])].slice(0, 24), t: Date.now() });
  storeChanged();
  await showGenerate(false);
}

/* ---- a sketch */

const GN_SKETCH_PX = { portrait: [416, 608], square: [512, 512], landscape: [608, 416] };
const GN_SKETCH_UNDO = 20;
let sketch = null;      // { shape, undo: [ImageData], ink: bool, last, tool } while the sheet is open

function genSketchSheet() {
  const box = gnSheet('sketchSheet', 'Draw a sketch',
    `<p class="count">A rough sketch or a stick figure: the pose and the layout you draw are kept, and the choices above say who she is and what she wears. Lines only are enough.</p>` +
    `<div class="gn-pad"><canvas id="skCanvas" role="img" aria-label="The sketch pad, to draw on with a pointer or a pen"></canvas></div>` +
    `<div class="row gn-tools"><span class="count">Shape</span>${gnChips('skShape', [['portrait', 'Tall'], ['square', 'Square'], ['landscape', 'Wide']], 'Shape of the picture')}` +
    `<span class="count">Tool</span>${gnChips('skTool', [['pen', 'Pen'], ['eraser', 'Eraser']], 'Tool')}` +
    `<label>Size <input type="range" id="skSize" min="2" max="30" value="5"></label>` +
    `<button type="button" class="ghost" id="skUndo" title="Take back the last stroke (Ctrl+Z)">Undo</button><button type="button" class="ghost" id="skClear">Clear</button></div>` +
    `<div class="row"><span class="grow count" id="skHint" role="status"></span><button type="button" class="primary" id="skUse" title="Close the pad and start from this sketch">Use as the start</button></div>`, genSketchClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    const cv = box.querySelector('#skCanvas');
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    const brush = () => Number(box.querySelector('#skSize').value) * (sketch.tool === 'eraser' ? 3 : 1);
    cv.addEventListener('pointerdown', e => {
      if (!sketch) return;
      cv.setPointerCapture(e.pointerId);
      sketch.undo.push(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height));
      if (sketch.undo.length > GN_SKETCH_UNDO) sketch.undo.shift();
      const g = cv.getContext('2d'), [x, y] = at(e);
      g.fillStyle = g.strokeStyle = sketch.tool === 'eraser' ? '#fff' : '#17171f'; g.lineWidth = brush(); g.lineCap = g.lineJoin = 'round';
      g.beginPath(); g.arc(x, y, brush() / 2, 0, Math.PI * 2); g.fill();
      sketch.last = [x, y]; sketch.ink = true; sketch.stroke = true;
      genSketchSync();
    });
    cv.addEventListener('pointermove', e => {
      if (!sketch?.stroke) return;
      const g = cv.getContext('2d'), [x, y] = at(e);
      g.beginPath(); g.moveTo(...sketch.last); g.lineTo(x, y); g.stroke();
      sketch.last = [x, y];
    });
    const up = () => { if (sketch) sketch.stroke = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    box.querySelector('#skShape').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && sketch) { sketch.shape = b.dataset.v; genSketchBlank(); } });
    box.querySelector('#skTool').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && sketch) { sketch.tool = b.dataset.v; genSketchSync(); } });
    box.querySelector('#skUndo').addEventListener('click', genSketchUndo);
    box.querySelector('#skClear').addEventListener('click', () => { if (sketch?.ink) { genSketchPush(); genSketchFill(); sketch.ink = false; genSketchSync(); } });
    box.querySelector('#skUse').addEventListener('click', genSketchUse);
    box.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && sketch) { e.preventDefault(); genSketchUndo(); } });
  }
  return box;
}
function genSketchPush() { const cv = el('skCanvas'); sketch.undo.push(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height)); if (sketch.undo.length > GN_SKETCH_UNDO) sketch.undo.shift(); }
function genSketchFill() { const cv = el('skCanvas'), g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); }
function genSketchBlank() {
  const cv = el('skCanvas'), [w, h] = GN_SKETCH_PX[sketch.shape];
  cv.width = w; cv.height = h; genSketchFill();
  sketch.undo = []; sketch.ink = false;
  genSketchSync();
}
function genSketchUndo() {
  if (!sketch?.undo.length) return;
  const snap = sketch.undo.pop(), cv = el('skCanvas');
  cv.getContext('2d').putImageData(snap, 0, 0);
  sketch.ink = sketch.undo.length > 0;
  genSketchSync();
}
function genSketchSync() {
  gnPress(el('skShape'), v => v === sketch.shape); gnPress(el('skTool'), v => v === sketch.tool);
  el('skUndo').disabled = !sketch.undo.length;
  el('skClear').disabled = !sketch.ink;
  el('skUse').disabled = !sketch.ink;
  el('skHint').textContent = sketch.ink ? 'Draw more, or use it.' : 'Draw with the pointer or a pen.';
}
function genSketchOpen() {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  const shape = GN_SKETCH_PX[genChoices.shape] ? genChoices.shape : 'portrait';
  sketch = { shape, undo: [], ink: false, last: null, tool: 'pen', stroke: false };
  const box = genSketchSheet();
  genSketchBlank();
  gnOpenSheet(box, el('skCanvas'));
}
function genSketchClose() { const box = document.getElementById('sketchSheet'); sketch = null; gnCloseSheet(box); }
async function genSketchUse() {
  if (!sketch?.ink) return;
  const cv = el('skCanvas'), shape = sketch.shape, blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  genSketchClose();
  await genSetSource(blob, 'sketch', { shape });
}

/* ---- line art to trace */

const GN_LINE_SIDE = 900, GN_NUM_SIDE = 640;
const GN_LINE_COLOURS = [['blue', 'Pale blue', '#8fb4e8'], ['grey', 'Grey', '#9aa0ad'], ['black', 'Black', '#1c1c24']];
const GN_LINE_DETAIL = [['few', 'Few lines', 0.94], ['some', 'Some', 0.89], ['many', 'Many', 0.82]];
const GN_NUM_TONES = [0, 3, 4, 5, 6];

function gnGrayOf(canvas, side) {
  const k = Math.min(1, side / Math.max(canvas.width, canvas.height)), w = Math.max(8, Math.round(canvas.width * k)), h = Math.max(8, Math.round(canvas.height * k));
  const cv = gnCanvas(w, h), g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return { gray, w, h };
}
function gnBlur(gray, w, h, r = 1) {
  const out = new Float32Array(gray.length), tmp = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) { s += gray[y * w + xx]; c++; } } tmp[y * w + x] = s / c; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; c++; } } out[y * w + x] = s / c; }
  return out;
}
// Sobel strength of each pixel of a lightly blurred grey picture.
function gnEdges(gray, w, h) {
  const b = gnBlur(gray, w, h, 1), mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const sx = (b[i - w + 1] + 2 * b[i + 1] + b[i + w + 1]) - (b[i - w - 1] + 2 * b[i - 1] + b[i + w - 1]);
    const sy = (b[i + w - 1] + 2 * b[i + w] + b[i + w + 1]) - (b[i - w - 1] + 2 * b[i - w] + b[i - w + 1]);
    mag[i] = Math.hypot(sx, sy);
  }
  return mag;
}
// The strength below which a share of the pixels lie.
function gnQuantile(values, share) {
  const s = Float32Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.floor(s.length * share))];
}

/* The lines of a picture: white, with the edges in a colour, softly. detail: the share of the pixels with no line. */
function gnLineArt(pic, detail, hex) {
  const { gray, w, h } = gnGrayOf(pic, GN_LINE_SIDE), mag = gnEdges(gray, w, h), T = Math.max(8, gnQuantile(mag, detail));
  const cv = gnCanvas(w, h), g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < mag.length; i++) {
    const a = gnClamp((mag[i] - T * 0.7) / (T * 0.9), 0, 1);
    d[i * 4] = 255 + (c[0] - 255) * a; d[i * 4 + 1] = 255 + (c[1] - 255) * a; d[i * 4 + 2] = 255 + (c[2] - 255) * a; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/* The shapes of a picture by tone: the picture held to n bands of light (1 the lightest), the regions of one band that
   touch found, and each big enough numbered. Returns { canvas, bands: [{ n, rgb, share }], regions }. */
function gnNumbered(pic, n, hex) {
  const { gray, w, h } = gnGrayOf(pic, GN_NUM_SIDE), sm = gnBlur(gnBlur(gray, w, h, 2), w, h, 2), N = w * h;
  const sorted = Float32Array.from(sm).sort(), cuts = [];
  for (let i = 1; i < n; i++) cuts.push(sorted[Math.floor(N * i / n)]);
  const band = new Uint8Array(N);
  for (let i = 0; i < N; i++) { let b = 0; for (const c of cuts) if (sm[i] < c) b++; band[i] = b; }   // 0 = the lightest
  // The colour of each band: the mean of the picture's own colours in it.
  const src = gnCanvas(w, h); src.getContext('2d').drawImage(pic, 0, 0, w, h);
  const px = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, sum = Array.from({ length: n }, () => [0, 0, 0, 0]);
  for (let i = 0; i < N; i++) { const s = sum[band[i]]; s[0] += px[i * 4]; s[1] += px[i * 4 + 1]; s[2] += px[i * 4 + 2]; s[3]++; }
  const bands = sum.map((s, i) => ({ n: i + 1, rgb: s[3] ? [Math.round(s[0] / s[3]), Math.round(s[1] / s[3]), Math.round(s[2] / s[3])] : [200, 200, 200], share: s[3] / N }));
  // Connected regions of one band.
  const lab = new Int32Array(N).fill(-1), stack = new Int32Array(N), regions = [];
  for (let s0 = 0; s0 < N; s0++) {
    if (lab[s0] >= 0) continue;
    const id = regions.length, b = band[s0], r = { id, band: b, area: 0, sx: 0, sy: 0 };
    let sp = 0; stack[sp++] = s0; lab[s0] = id;
    while (sp) {
      const i = stack[--sp], x = i % w, y = (i - x) / w;
      r.area++; r.sx += x; r.sy += y;
      if (x > 0 && lab[i - 1] < 0 && band[i - 1] === b) { lab[i - 1] = id; stack[sp++] = i - 1; }
      if (x < w - 1 && lab[i + 1] < 0 && band[i + 1] === b) { lab[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && lab[i - w] < 0 && band[i - w] === b) { lab[i - w] = id; stack[sp++] = i - w; }
      if (y < h - 1 && lab[i + w] < 0 && band[i + w] === b) { lab[i + w] = id; stack[sp++] = i + w; }
    }
    regions.push(r);
  }
  const minArea = N * 0.004, big = regions.filter(r => r.area >= minArea);
  // Where to put a number: the pixel of the region nearest its middle.
  const best = new Float32Array(regions.length).fill(Infinity), at = new Int32Array(regions.length).fill(-1);
  for (let i = 0; i < N; i++) {
    const r = regions[lab[i]]; if (r.area < minArea) continue;
    const x = i % w, y = (i - x) / w, d = (x - r.sx / r.area) ** 2 + (y - r.sy / r.area) ** 2;
    if (d < best[r.id]) { best[r.id] = d; at[r.id] = i; }
  }
  const cv = gnCanvas(w, h), g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data, c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  d.fill(255);
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (band[i] !== band[i + 1] || band[i] !== band[i + w]) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = hex === '#8fb4e8' ? '#2c4a7a' : '#14141c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const r of big) {
    const i = at[r.id]; if (i < 0) continue;
    g.font = `600 ${Math.round(gnClamp(Math.sqrt(r.area) * 0.3, 9, 30))}px system-ui`;
    g.fillText(String(r.band + 1), i % w, (i - (i % w)) / w);
  }
  return { canvas: cv, bands, regions: big.length };
}

let lineArt = null;     // { u, pic, colour, detail, tones, out } while the sheet is open
function genLineSheet() {
  const box = gnSheet('lineSheet', 'Line art to trace',
    `<p class="count">Only the lines of the picture, pale, to print and draw over with your own ink - or the shapes numbered from the lightest to the darkest, to plan the paint.</p>` +
    `<div class="gn-pad"><canvas id="lnCanvas" role="img" aria-label="The line art"></canvas></div>` +
    `<div class="pg-row"><span class="pg-label">Lines</span>${gnChips('lnDetail', GN_LINE_DETAIL.map(([k, name]) => [k, name]), 'How many lines')}</div>` +
    `<div class="pg-row"><span class="pg-label">Colour</span>${gnChips('lnColour', GN_LINE_COLOURS.map(([k, name]) => [k, name]), 'Colour of the lines')}</div>` +
    `<div class="pg-row"><span class="pg-label">Number the shapes</span>${gnChips('lnTones', GN_NUM_TONES.map(n => [n, n ? `${n} tones` : 'Off']), 'How many tones to number')}</div>` +
    `<div class="gn-bands" id="lnBands"></div><p class="count" id="lnNote" role="status"></p>` +
    `<div class="row"><button type="button" class="ghost" id="lnSave">Save PNG</button><button type="button" class="primary" id="lnKeep" title="Keep it in Generated, beside the original">Keep as a new picture</button></div>`, genLineClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    const pick = (id, key, map) => box.querySelector(id).addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && lineArt) { lineArt[key] = map(b.dataset.v); genLineRender(); } });
    pick('#lnDetail', 'detail', v => v); pick('#lnColour', 'colour', v => v); pick('#lnTones', 'tones', v => +v);
    box.querySelector('#lnSave').addEventListener('click', async () => { if (lineArt?.out) atDownload(await atBlob(lineArt.out), 'line-art.png'); });
    box.querySelector('#lnKeep').addEventListener('click', async () => {
      if (!lineArt?.out) return;
      const note = el('lnNote'); note.textContent = 'Keeping...';
      try { await gnKeep(lineArt.out, lineArt.u, [lineArt.tones ? 'numbered shapes' : 'line art']); note.textContent = 'Kept in Made here.'; }
      catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
    });
  }
  return box;
}
async function genLineOpen(u) {
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  lineArt = { u, pic, colour: 'blue', detail: 'some', tones: 0, out: null };
  const box = genLineSheet();
  gnOpenSheet(box, box.querySelector('#lnKeep'));
  genLineRender();
}
function genLineClose() { gnCloseSheet(document.getElementById('lineSheet')); lineArt = null; }
function genLineRender() {
  const L = lineArt, hex = GN_LINE_COLOURS.find(c => c[0] === L.colour)[2], box = document.getElementById('lineSheet');
  gnPress(box.querySelector('#lnDetail'), v => v === L.detail); gnPress(box.querySelector('#lnColour'), v => v === L.colour); gnPress(box.querySelector('#lnTones'), v => +v === L.tones);
  box.querySelector('#lnDetail').closest('.pg-row').classList.toggle('hidden', !!L.tones);
  let out, bandsHtml = '', note;
  if (L.tones) {
    const r = gnNumbered(L.pic, L.tones, hex);
    out = r.canvas;
    bandsHtml = r.bands.map(b => `<span class="gn-band"><i style="background:${rgbCss(b.rgb)}" title="${colHexOf(b.rgb)}"></i><b>${b.n}</b> ${b.n === 1 ? 'lightest - bare paper or the palest wash' : b.n === L.tones ? 'darkest - the last layer' : `wash ${b.n - 1}`} <span class="count">${Math.round(b.share * 100)}%</span></span>`).join('');
    note = `${r.regions} shapes are numbered; the smallest are left out. Paint 1 first or leave it bare, then the numbers upward; the colour beside each number is the picture's own average there.`;
  } else {
    out = gnLineArt(L.pic, GN_LINE_DETAIL.find(d => d[0] === L.detail)[2], hex);
    note = 'Print it at the size of your paper; light lines are easy to cover with ink and vanish from a scan.';
  }
  L.out = out;
  const cv = box.querySelector('#lnCanvas');
  cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0);
  box.querySelector('#lnBands').innerHTML = bandsHtml;
  box.querySelector('#lnNote').textContent = note;
}

/* ---- details */

const GN_DETAIL_MAX = 6, GN_DETAIL_CELL = 300, GN_DETAIL_SHOW = 560;
let detail = null;      // { u, pic, k, sel, parts, drag } while the sheet is open

function genDetailSheet() {
  const box = gnSheet('detailSheet', 'Details',
    `<p class="count">Drag a box round a part - an eye, a hand, the hair - and add it. The parts are enlarged on a sheet to study; a part can be drawn again four ways, to choose from.</p>` +
    `<div class="gn-pad"><canvas id="dtPic" role="img" aria-label="The picture: drag a box round the part to cut out"></canvas></div>` +
    `<div class="row"><button type="button" class="ghost" id="dtAdd">Add this part to the sheet</button><button type="button" class="ghost" id="dtRedraw" title="Opens Redraw a part with this box brushed, and four tries to choose from">Draw this part again, four ways</button><span class="grow count" id="dtHint" role="status"></span></div>` +
    `<div class="gn-parts" id="dtParts"></div><div class="gn-pad"><canvas id="dtSheetPic" class="hidden" role="img" aria-label="The parts, enlarged on a sheet"></canvas></div>` +
    `<div class="row"><button type="button" class="ghost" id="dtSave">Save the sheet</button><button type="button" class="primary" id="dtKeep">Keep the sheet in Generated</button></div>`, genDetailClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    const cv = box.querySelector('#dtPic');
    const at = e => { const r = cv.getBoundingClientRect(); return [gnClamp((e.clientX - r.left) * cv.width / r.width, 0, cv.width), gnClamp((e.clientY - r.top) * cv.height / r.height, 0, cv.height)]; };
    cv.addEventListener('pointerdown', e => { if (!detail) return; cv.setPointerCapture(e.pointerId); detail.drag = at(e); detail.sel = null; genDetailPaint(); });
    cv.addEventListener('pointermove', e => {
      if (!detail?.drag) return;
      const [x, y] = at(e), [x0, y0] = detail.drag;
      detail.sel = { x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0) };
      genDetailPaint();
    });
    cv.addEventListener('pointerup', () => { if (detail) { detail.drag = null; genDetailPaint(); } });
    box.querySelector('#dtAdd').addEventListener('click', () => {
      if (!detail?.sel || detail.parts.length >= GN_DETAIL_MAX) return;
      detail.parts.push({ ...detail.sel }); detail.sel = null; genDetailPaint();
    });
    box.querySelector('#dtParts').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b && detail) { detail.parts.splice(+b.dataset.rm, 1); genDetailPaint(); } });
    box.querySelector('#dtRedraw').addEventListener('click', genDetailRedraw);
    box.querySelector('#dtSave').addEventListener('click', async () => { if (detail?.sheet) atDownload(await atBlob(detail.sheet), 'details.png'); });
    box.querySelector('#dtKeep').addEventListener('click', async () => {
      if (!detail?.sheet) return;
      const hint = el('dtHint'); hint.textContent = 'Keeping...';
      try { await gnKeep(detail.sheet, detail.u, ['details']); hint.textContent = 'Kept in Made here.'; } catch (err) { hint.textContent = 'Not kept: ' + (err.message || err); }
    });
  }
  return box;
}
async function genDetailOpen(u) {
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  const k = Math.min(1, GN_DETAIL_SHOW / Math.max(pic.width, pic.height));
  detail = { u, pic, k, sel: null, parts: [], drag: null, sheet: null };
  const box = genDetailSheet(), cv = box.querySelector('#dtPic');
  cv.width = Math.round(pic.width * k); cv.height = Math.round(pic.height * k);
  gnOpenSheet(box, cv);
  genDetailPaint();
}
function genDetailClose() { gnCloseSheet(document.getElementById('detailSheet')); detail = null; }
function genDetailPaint() {
  const D = detail, box = document.getElementById('detailSheet'), cv = box.querySelector('#dtPic'), g = cv.getContext('2d');
  g.drawImage(D.pic, 0, 0, cv.width, cv.height);
  const frame = (r, colour, label) => {
    g.strokeStyle = colour; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h);
    if (label) { g.fillStyle = colour; g.font = '600 14px system-ui'; g.fillText(label, r.x + 4, r.y + 15); }
  };
  D.parts.forEach((p, i) => frame(p, '#3aa86a', String(i + 1)));
  if (D.sel) frame(D.sel, '#e5543c');
  const ok = !!D.sel && D.sel.w > 12 && D.sel.h > 12;
  box.querySelector('#dtAdd').disabled = !ok || D.parts.length >= GN_DETAIL_MAX;
  box.querySelector('#dtRedraw').disabled = !ok && !D.parts.length;
  box.querySelector('#dtHint').textContent = D.parts.length >= GN_DETAIL_MAX ? `${GN_DETAIL_MAX} parts: that is the sheet's most.` : ok ? 'Add it, or drag again.' : 'Drag a box on the picture.';
  box.querySelector('#dtParts').innerHTML = D.parts.map((p, i) => `<span class="gn-part"><b>${i + 1}</b> ${Math.round(p.w / D.k)} x ${Math.round(p.h / D.k)} px <button type="button" class="ghost" data-rm="${i}" aria-label="Take part ${i + 1} off the sheet">&times;</button></span>`).join('');
  // The sheet: the parts at one width, three across.
  const sc = box.querySelector('#dtSheetPic');
  sc.classList.toggle('hidden', !D.parts.length);
  box.querySelector('#dtSave').disabled = box.querySelector('#dtKeep').disabled = !D.parts.length;
  if (!D.parts.length) { D.sheet = null; return; }
  const W = GN_DETAIL_CELL, cells = D.parts.map(p => ({ p, h: Math.max(20, Math.round(W * p.h / p.w)) }));
  const rows = []; for (let i = 0; i < cells.length; i += 3) rows.push(cells.slice(i, i + 3));
  const rh = rows.map(r => Math.max(...r.map(c => c.h)));
  const sheet = gnCanvas(3 * W + 40, rh.reduce((a, b) => a + b + 10, 10)), sg = sheet.getContext('2d');
  sg.fillStyle = '#fff'; sg.fillRect(0, 0, sheet.width, sheet.height); sg.imageSmoothingQuality = 'high';
  let y = 10;
  rows.forEach((row, ri) => {
    row.forEach((c, ci) => { sg.drawImage(D.pic, c.p.x / D.k, c.p.y / D.k, c.p.w / D.k, c.p.h / D.k, 10 + ci * (W + 10), y, W, c.h); sg.fillStyle = '#3aa86a'; sg.font = '600 14px system-ui'; sg.fillText(String(ri * 3 + ci + 1), 16 + ci * (W + 10), y + 16); });
    y += rh[ri] + 10;
  });
  D.sheet = sheet; sc.width = sheet.width; sc.height = sheet.height; sc.getContext('2d').drawImage(sheet, 0, 0);
}
// Redraw a part, with the box brushed in and four tries asked for.
async function genDetailRedraw() {
  const D = detail; if (!D) return;
  const r = D.sel && D.sel.w > 12 && D.sel.h > 12 ? D.sel : D.parts[D.parts.length - 1];
  if (!r) return;
  const u = D.u, box = { x: r.x / D.k, y: r.y / D.k, w: r.w / D.k, h: r.h / D.k };
  genDetailClose();
  await genRedrawOpen(u);
  if (!redraw) return;
  const g = redrawInk(), rad = Math.min(box.w, box.h) * 0.25;
  g.fillStyle = '#ff0000'; g.beginPath(); g.roundRect(box.x, box.y, box.w, box.h, rad); g.fill();
  redraw.ink = true; renderRedraw();
  el('redrawFour').checked = true;
}

/* ---- other conditions */

const GN_CONDS = [
  ['dawn', 'Sunrise', 'sunrise, dawn, golden hour, orange sky'],
  ['noon', 'Midday', 'midday, bright sunlight, blue sky, clear sky'],
  ['sunset', 'Sunset', 'sunset, evening, orange sky, warm light'],
  ['night', 'Night', 'night, dark, moonlight, night sky, stars'],
  ['rain', 'Rain', 'rain, overcast, wet, grey sky'],
  ['snow', 'Snow', 'snowing, snow, winter, white landscape'],
  ['fog', 'Fog', 'fog, mist, hazy'],
  ['spring', 'Spring', 'spring, cherry blossoms, fresh green'],
  ['summer', 'Summer', 'summer, lush green, cumulonimbus, bright'],
  ['autumn', 'Autumn', 'autumn, autumn leaves, falling leaves, orange foliage'],
];
const GN_CONDS_KEY = 'refboard.generate.conds.v1';
const GN_COND_LEVELS = [['Somewhat', 0.55, 'The place stays, the light and the weather change'], ['Very', 0.7, 'Only the layout stays - for night from midday, or snow from summer']];
const GN_CONDS_MAX = 6;
let cond = null;        // { u, picked: [ids], level }

const genCondsPicked = () => { const v = gnStore(GN_CONDS_KEY, null); return Array.isArray(v) ? GN_CONDS.filter(c => v.includes(c[0])).map(c => c[0]).slice(0, GN_CONDS_MAX) : ['sunset', 'night', 'rain', 'snow']; };

/* The picture's words with those of every condition taken out, and the chosen condition's weighted (the picture is the start, and its
   old condition would win). u: the picture; c: a GN_CONDS row. */
function genCondJob(u, pic, c, level) {
  const all = GN_CONDS.flatMap(x => genSplit(x[2])), names = GN_CONDS.map(x => x[1].toLowerCase());
  return genRework(u, pic,
    comfyTags([...genWithout(genSplit(genWordsOf(u)), new Set(all)), ...genSplit(c[2]).map(t => `(${t}:1.3)`)].join(', ')),
    u.avoid || '', [...genWithout(u.tags || [], new Set([...all, ...names])), c[1].toLowerCase()], level);
}

function genCondSheet() {
  const box = gnSheet('condSheet', 'Other conditions',
    `<p class="count">The same picture at another hour, in other weather or in another season: one picture for each you choose. The picture is the start, so a strong change needs Very.</p>` +
    `<div class="pg-row"><span class="pg-label">Conditions</span>${gnChips('cdPick', GN_CONDS.map(c => [c[0], c[1], c[2]]), 'Conditions')}</div>` +
    `<div class="pg-row"><span class="pg-label">How different</span>${gnChips('cdLevel', GN_COND_LEVELS.map(([n, v, t]) => [v, n, t]), 'How different')}</div>` +
    `<div class="row"><span class="grow count" id="cdNote" role="status"></span><button type="button" class="primary" id="cdGo">Draw them</button></div>`, genCondClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    box.querySelector('#cdPick').addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b || !cond) return;
      const p = new Set(cond.picked); p.has(b.dataset.v) ? p.delete(b.dataset.v) : p.add(b.dataset.v);
      if (p.size > GN_CONDS_MAX) { el('cdNote').textContent = `Most ${GN_CONDS_MAX} at a time.`; return; }
      cond.picked = GN_CONDS.map(c => c[0]).filter(k => p.has(k)); gnPut(GN_CONDS_KEY, cond.picked); genCondSync();
    });
    box.querySelector('#cdLevel').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b && cond) { cond.level = +b.dataset.v; genCondSync(); } });
    box.querySelector('#cdGo').addEventListener('click', genCondGo);
  }
  return box;
}
function genCondOpen(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  cond = { u, picked: genCondsPicked(), level: 0.55 };
  const box = genCondSheet();
  gnOpenSheet(box, box.querySelector('#cdGo'));
  genCondSync();
}
function genCondClose() { gnCloseSheet(document.getElementById('condSheet')); cond = null; }
function genCondSync() {
  const box = document.getElementById('condSheet');
  gnPress(box.querySelector('#cdPick'), v => cond.picked.includes(v)); gnPress(box.querySelector('#cdLevel'), v => +v === cond.level);
  box.querySelector('#cdGo').disabled = !cond.picked.length;
  box.querySelector('#cdNote').textContent = `${cond.picked.length} picture${cond.picked.length === 1 ? '' : 's'}.`;
}
async function genCondGo() {
  if (!cond || genBusy) return;
  const { u, picked, level } = cond;
  genCondClose();
  try {
    const pic = await genLoadPicture(u), rows = GN_CONDS.filter(c => picked.includes(c[0]));
    runGenerate(rows.map(c => genCondJob(u, pic, c, level)), (i, n) => `Drawing ${rows[i - 1][1].toLowerCase()}, ${i} of ${n}...`, `${rows.length} conditions - in Uploads, Generated.`);
  } catch (err) { el('genStatus').textContent = err.message; }
}

/* ---- a grid */

const GN_GRID_SKIP = ['style', 'subject', 'who', 'lock', 'colours', 'detail', 'ground'];
const GN_GRID_KEY = 'refboard.generate.grid.v1';
const GN_GRID_MAX = 9;

// The rows that can make a grid with these choices: asked now, and with at least three options to set against each other.
function genGridRows(ch = genChoices) {
  return GEN_CHOICES.filter(c => !GN_GRID_SKIP.includes(c.id) && genApplies(c, ch) && genGridOptions(c, ch).length >= 3);
}
const genGridOptions = (c, ch = genChoices) => c.options.filter(o => o.id !== 'any' && (!o.when || o.when(ch)) && !(o.id === 'palette' && !ch.palette)).slice(0, GN_GRID_MAX);

/* One job for each option of the row: the choices as they are but for that one, with one seed. */
function genGridJobs(rowId, seed) {
  const row = GEN_CHOICES.find(c => c.id === rowId), keep = genChoices, jobs = [];
  try {
    for (const o of genGridOptions(row)) {
      genChoices = { ...keep, [rowId]: o.id };
      const req = genRequest();
      jobs.push({ ...req, seed, tags: [...req.tags, 'grid', row.label.toLowerCase()].slice(0, 24).map(t => t.slice(0, 40)), label: o.label });
    }
  } finally { genChoices = keep; }
  return jobs;
}

async function genGridGo() {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (genSource) { status.textContent = 'A grid is drawn from the choices alone: drop the picture first.'; return; }
  const rowId = el('gnGridRow').value, row = GEN_CHOICES.find(c => c.id === rowId);
  if (!row) { status.textContent = 'Choose what to change first.'; return; }
  gnPut(GN_GRID_KEY, rowId);
  const jobs = genGridJobs(rowId, Math.floor(Math.random() * 2 ** 48)), labels = jobs.map(j => j.label);
  jobs.forEach(j => { delete j.label; if (el('genQuality').value === 'draft') j.steps = GEN_DRAFT_STEPS; });
  const made = [];
  await runGenerate(jobs, (i, n) => `Drawing ${i} of ${n} - ${labels[i - 1].toLowerCase()}...`, `${jobs.length} pictures, ${row.label.toLowerCase()} changed - in Uploads, Generated.`, m => { made.push(m); });
  if (made.length >= 2) genGridShow(made, labels, row.label);
}

let gridSheet = null;   // { made, labels, canvas }
function genGridSheet() {
  const box = gnSheet('gridSheet', 'The grid',
    `<div class="gn-pad"><canvas id="grCanvas" role="img" aria-label="The pictures side by side, each labelled"></canvas></div><p class="count" id="grNote" role="status"></p>` +
    `<div class="row"><button type="button" class="ghost" id="grSave">Save PNG</button><button type="button" class="primary" id="grKeep" title="Keep the sheet in Generated">Keep the sheet</button></div>`, genGridClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    box.querySelector('#grSave').addEventListener('click', async () => { if (gridSheet) atDownload(await atBlob(gridSheet.canvas), 'grid.png'); });
    box.querySelector('#grKeep').addEventListener('click', async () => {
      if (!gridSheet) return;
      const note = el('grNote'); note.textContent = 'Keeping...';
      try { await gnKeep(gridSheet.canvas, gridSheet.made[0], ['grid sheet']); note.textContent = 'Kept in Made here.'; } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
    });
  }
  return box;
}
async function genGridShow(made, labels, what) {
  const imgs = [];
  for (const m of made) { const url = await storeFileUrl(m.file); imgs.push(url ? await loadImg(url) : null); }
  const cols = made.length > 6 ? 3 : made.length > 3 ? 3 : made.length, rows = Math.ceil(made.length / cols), cw = 260, first = imgs.find(Boolean);
  if (!first) return;
  const ch = Math.round(cw * first.naturalHeight / first.naturalWidth), cv = gnCanvas(cols * (cw + 10) + 10, rows * (ch + 30) + 10), g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.font = '600 13px system-ui';
  imgs.forEach((img, i) => {
    const x = 10 + (i % cols) * (cw + 10), y = 10 + Math.floor(i / cols) * (ch + 30);
    if (img) g.drawImage(img, x, y, cw, ch);
    g.fillStyle = '#333'; g.fillText(labels[i] || '', x, y + ch + 18);
  });
  gridSheet = { made, labels, canvas: cv };
  const box = genGridSheet(), view = box.querySelector('#grCanvas');
  view.width = cv.width; view.height = cv.height; view.getContext('2d').drawImage(cv, 0, 0);
  box.querySelector('#grNote').textContent = `${what} changed, the rest and the seed kept: the pictures are in Made here too.`;
  gnOpenSheet(box, box.querySelector('#grKeep'));
}
function genGridClose() { gnCloseSheet(document.getElementById('gridSheet')); gridSheet = null; }

/* ---- character cards */

const GN_CARDS_KEY = 'refboard.generate.cards.v1', GN_CARDS_MAX = 12;
const GN_CARD_FIELDS = ['character', 'look', 'who', 'hair', 'parting', 'colour', 'eyes', 'eyeShape'];

const genCardsLoad = () => { const v = gnStore(GN_CARDS_KEY, []); return Array.isArray(v) ? v.filter(c => c && typeof c.name === 'string' && c.pick && typeof c.pick === 'object').slice(0, GN_CARDS_MAX) : []; };

// Who she is: the fields of the choices that make her, and a name to find her by. A card of the same name is replaced.
function genCardMake(name, ch = genChoices) {
  const pick = {};
  for (const f of GN_CARD_FIELDS) if (ch[f] != null) pick[f] = ch[f];
  return { name: String(name || '').trim().slice(0, 40), pick };
}
function genCardSave() {
  const status = el('genStatus'), name = el('gnCardName').value.trim();
  if (!name) { status.textContent = 'Name her first.'; return; }
  const card = genCardMake(name), list = [card, ...genCardsLoad().filter(c => c.name.toLowerCase() !== card.name.toLowerCase())].slice(0, GN_CARDS_MAX);
  gnPut(GN_CARDS_KEY, list);
  el('gnCardName').value = '';
  genCardsRender();
  status.textContent = `${card.name} is kept as a card.`;
}
function genCardUse(i) {
  const card = genCardsLoad()[i];
  if (!card) return null;
  genChoices.subject = 'character';
  for (const f of GN_CARD_FIELDS) if (card.pick[f] != null && (f === 'character' || f === 'look' || GEN_CHOICES.find(c => c.id === f)?.options.some(o => o.id === card.pick[f]))) genChoices[f] = card.pick[f];
  saveGenChoices();
  renderGenerate();
  el('genStatus').textContent = `${card.name} is in the choices.`;
  return card;
}
function genCardsRender() {
  const host = el('gnCards'), list = genCardsLoad();
  host.innerHTML = list.length ? list.map((c, i) => `<div class="gn-card" data-i="${i}"><b>${esc(c.name)}</b> <span class="count">${esc([c.pick.character, c.pick.look].filter(Boolean).join(' - ') || 'by her choices')}</span>` +
    `<button type="button" class="ghost" data-act="use" title="Put her back in the choices">Use</button><button type="button" class="ghost" data-act="story" title="Draw the storyboard of Anime study with her">In the storyboard</button>` +
    `<button type="button" class="ghost" data-act="drop" aria-label="Forget ${esc(c.name)}" title="Forget this card">&times;</button></div>`).join('') : '<p class="count">No cards yet: set the character, her hair and eyes in the choices above, name her, and keep her.</p>';
}

/* ---- the challenge */

const GN_CHAL = {
  pose: ['running', 'jumping', 'sitting on the floor', 'kneeling', 'reaching up', 'looking back', 'stretching', 'crouching', 'dancing', 'leaning on a wall', 'holding an umbrella', 'walking away from the viewer'],
  outfit: ['school uniform', 'kimono', 'hoodie', 'sundress', 'winter coat', 'sailor uniform', 'yukata', 'overalls', 'pajamas', 'raincoat', 'apron', 'cardigan and skirt'],
  light: ['backlighting', 'sunset', 'candlelight', 'moonlight', 'neon lights', 'window light', 'dappled sunlight', 'rim lighting'],
  mood: ['happy', 'angry', 'surprised', 'embarrassed', 'sleepy', 'smug', 'crying', 'determined', 'shy', 'worried'],
};
const GN_CHAL_KEY = 'refboard.generate.challenge.v1';
const GN_CHAL_MINUTES = [10, 20, 30];

// A small seeded generator, so that the day's challenge is the same all day.
function gnRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gnDaySeed = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/* A pose, an outfit, a light and a mood. rnd: a function of 0..1. */
function genChallenge(rnd = Math.random) {
  const pick = list => list[Math.floor(rnd() * list.length)];
  return { pose: pick(GN_CHAL.pose), outfit: pick(GN_CHAL.outfit), light: pick(GN_CHAL.light), mood: pick(GN_CHAL.mood) };
}
const genChallengeTags = c => [c.pose, c.outfit, c.light, c.mood].join(', ');

// Puts the challenge in More tags, in the place of the last one.
function genChallengePut(c) {
  const last = gnStore(GN_CHAL_KEY, null), words = genChallengeTags(c), box = el('genExtra');
  const drop = new Set(last?.tags ? genSplit(last.tags) : []);
  box.value = [...genSplit(box.value).filter(t => !drop.has(t)), ...genSplit(words)].join(', ').slice(0, 200);
  box.dispatchEvent(new Event('input'));
  gnPut(GN_CHAL_KEY, { tags: words, c });
}
function genChallengeShow(c) {
  el('gnChal').innerHTML = [['Pose', c.pose], ['Outfit', c.outfit], ['Light', c.light], ['Mood', c.mood]].map(([k, v]) => `<span class="gn-chal"><span class="count">${k}</span> <b>${esc(v)}</b></span>`).join('');
}
function genChallengeRoll(today) {
  const c = genChallenge(today ? gnRand(gnDaySeed()) : Math.random);
  genChallengeShow(c); genChallengePut(c);
  el('genStatus').textContent = 'The challenge is in More tags. Draw the reference, or draw it yourself before you look.';
}
let gnTimer = 0;
function genChallengeTimer() {
  const btn = el('gnChalTimer');
  if (gnTimer) { clearInterval(gnTimer); gnTimer = 0; btn.textContent = 'Start the timer'; el('gnChalClock').textContent = ''; return; }
  const minutes = +(gnStore(GN_CHAL_KEY + '.min', 20)) || 20;
  let left = minutes * 60;
  btn.textContent = 'Stop the timer';
  const tick = () => { el('gnChalClock').textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Time. Put the pen down.'; };
  tick();
  gnTimer = setInterval(() => { left--; tick(); if (left <= 0) { clearInterval(gnTimer); gnTimer = 0; btn.textContent = 'Start the timer'; } }, 1000);
}

/* ---- describe it */

// Words of the Ukrainian (and some Russian) a reference is described in, as the tags a model knows. Colours come before the
// thing they colour: "червона сукня" is "red dress", and a colour with no thing is left out.
const GN_COLOURS = [
  [/^червон|^красн/, 'red'], [/^син[іьяєю]|^синь|^блакитн|^голуб/, 'blue'], [/^зелен/, 'green'], [/^жовт|^желт/, 'yellow'], [/^помаранч|^оранж/, 'orange'],
  [/^рожев|^розов/, 'pink'], [/^фіолет|^пурпур|^лілов|^сирен/, 'purple'], [/^біл|^бел/, 'white'], [/^чорн|^черн/, 'black'], [/^сір|^сер[іыо]/, 'grey'],
  [/^коричнев|^бежев|^карі/, 'brown'], [/^золот/, 'golden'], [/^срібл|^серебр/, 'silver'], [/^бірюз/, 'turquoise'], [/^бордов|^винн/, 'maroon'], [/^темн/, 'dark'],
  [/^світл|^светл/, 'light'], [/^рудий|^рудо|^рижий|^рыж/, 'red'],
];
const GN_NOUNS = [
  // what she wears
  [/^сукн|^платт|^плать/, 'dress'], [/^спідниц|^юбк/, 'skirt'], [/^курт/, 'jacket'], [/^светр|^свитер|^кофт/, 'sweater'], [/^футболк/, 't-shirt'], [/^сорочк|^блуз|^рубаш/, 'shirt'],
  [/^штан|^брюк/, 'pants'], [/^джинс/, 'jeans'], [/^шорт/, 'shorts'], [/^капелюх|^шляп/, 'hat'], [/^шапк/, 'beanie'], [/^шарф/, 'scarf'], [/^окуляр|^очки/, 'glasses'],
  [/^плащ/, 'cloak'], [/^пальт/, 'coat'], [/^худі|^толстовк/, 'hoodie'], [/^кімоно/, 'kimono'], [/^форм/, 'school uniform'], [/^вишиванк|^вишит/, 'embroidered shirt'],
  [/^вінок|^венок/, 'flower wreath'], [/^стрічк|^лент/, 'ribbon'], [/^черевик|^ботинк/, 'boots'], [/^кросівк|^кроссовк/, 'sneakers'], [/^рукавич|^перчат/, 'gloves'],
  [/^намист|^ожерел/, 'necklace'], [/^сережк|^серьг/, 'earrings'], [/^корон/, 'crown'], [/^маск/, 'mask'],
  // her
  [/^волосс|^волос/, 'hair'], [/^очі|^очей|^глаз|^очима/, 'eyes'], [/^кіс|^кос[аиу]/, 'braid'], [/^хвостик|^хвіст/, 'ponytail'], [/^чубчик|^чілк|^чёлк/, 'bangs'], [/^веснянк|^веснушк/, 'freckles'],
  // what she holds, and what is near
  [/^парасол|^зонт/, 'umbrella'], [/^сумк/, 'bag'], [/^рюкзак/, 'backpack'], [/^книг|^книж/, 'book'], [/^чашк|^кружк/, 'cup'], [/^кав/, 'coffee'], [/^чай/, 'tea'], [/^телефон/, 'smartphone'],
  [/^квіт|^цвет/, 'flowers'], [/^букет/, 'bouquet'], [/^кіт|^кот|^кішк|^кошк/, 'cat'], [/^пес|^собак/, 'dog'], [/^птах|^птиц/, 'bird'], [/^метелик|^бабочк/, 'butterfly'], [/^меч/, 'sword'], [/^лук$/, 'bow (weapon)'],
  [/^ліхтар|^фонар/, 'lantern'], [/^свічк|^свеч/, 'candle'], [/^гітар|^гитар/, 'guitar'], [/^велосипед/, 'bicycle'], [/^м.яч|^мяч/, 'ball'],
  // where
  [/^вікн|^окн/, 'window'], [/^дерев/, 'tree'], [/^ліс|^лес/, 'forest'], [/^мор[еяю]/, 'ocean'], [/^пляж/, 'beach'], [/^місто|^город/, 'city'], [/^вулиц|^улиц/, 'street'], [/^гор[иу]|^гір/, 'mountains'],
  [/^міст$|^мост/, 'bridge'], [/^дощ|^дожд/, 'rain'], [/^сніг|^снег/, 'snow'], [/^тум[аан]/, 'fog'], [/^зірк|^звезд|^зорі/, 'stars'], [/^місяц|^луна/, 'moon'], [/^сонц|^солнц/, 'sun'], [/^хмар|^облак/, 'clouds'],
  [/^кімнат|^комнат/, 'indoors, room'], [/^клас/, 'classroom'], [/^кухн/, 'kitchen'], [/^кав.ярн|^кафе/, 'cafe'], [/^бібліотек|^библиотек/, 'library'], [/^парк/, 'park'], [/^поле|^полі/, 'field'], [/^луг/, 'meadow'],
  [/^храм/, 'temple'], [/^замок/, 'castle'], [/^озер|^озеро/, 'lake'], [/^річк|^рек[аиу]/, 'river'], [/^вогн|^огон|^огн/, 'fire'], [/^ніч|^ноч/, 'night'], [/^вечір|^вечер/, 'evening'], [/^ранок|^утро|^ранк/, 'morning'],
  [/^осін|^осен/, 'autumn'], [/^зим/, 'winter'], [/^весн/, 'spring'], [/^літ[оа]|^лето/, 'summer'],
];
// Words that join a description and say nothing a model needs.
const GN_JOIN = /^(біля|на|в|у|з|із|до|над|під|за|при|без|по|і|й|та|а|але|з|про|від|між|поруч|коло|около|возле|рядом|с|со|и|the|a|an|of|in|on)$/;

/* text: "червона сукня, зелені очі, біля вікна". Gives { tags, unknown }: the tags to add, and the Ukrainian words nobody knew.
   English parts go as they are, verbs are the movement rows of Generate (genMoveTags), and the rest is looked up word by word. */
function genDescribeTags(text) {
  const tags = [], unknown = [], add = t => { if (t && !tags.includes(t)) tags.push(t); };
  for (const part of String(text).toLowerCase().split(/[,;]|\s+і\s+|\s+та\s+|\s+and\s+/).map(s => s.trim()).filter(Boolean)) {
    if (/^[a-z0-9 '-]+$/.test(part)) { add(part); continue; }
    const moves = GEN_MOVES.filter(([re]) => re.test(part));
    for (const [, t] of moves) for (const x of t.split(', ')) add(x);
    let colour = '';
    for (const w of part.match(/[\p{L}'-]+/gu) || []) {
      if (GN_JOIN.test(w)) continue;
      const c = GN_COLOURS.find(([re]) => re.test(w)), n = GN_NOUNS.find(([re]) => re.test(w));
      if (n) { add(colour && !/^(rain|snow|fog|night|evening|morning|autumn|winter|spring|summer)$/.test(n[1]) ? `${colour} ${n[1]}` : n[1]); colour = ''; }
      else if (c) colour = c[1];
      else if (!moves.some(([re]) => re.test(w)) && !/^[a-z'-]+$/.test(w)) unknown.push(w);
      else if (/^[a-z'-]+$/.test(w)) add(w);
    }
  }
  return { tags, unknown: [...new Set(unknown)] };
}

function genDescribeAdd() {
  const status = el('genStatus'), { tags, unknown } = genDescribeTags(el('gnDescText').value);
  if (!tags.length) { status.textContent = unknown.length ? `Not known yet: ${unknown.join(', ')}. Try other words, or write them in English.` : 'Describe it first.'; return; }
  const have = genSplit(el('genExtra').value), add = tags.filter(t => !have.includes(t));
  el('genExtra').value = [...have, ...add].join(', ').slice(0, 200);
  el('genExtra').dispatchEvent(new Event('input'));
  status.textContent = `Added to More tags: ${add.join(', ') || 'all were there already'}.` + (unknown.length ? ` Not known: ${unknown.join(', ')}.` : '');
}

/* ---- saved settings */

const GN_SETS_KEY = 'refboard.generate.sets.v1', GN_SETS_MAX = 12;
const genSetsLoad = () => { const v = gnStore(GN_SETS_KEY, []); return Array.isArray(v) ? v.filter(s => s && typeof s.name === 'string' && s.choices && typeof s.choices === 'object').slice(0, GN_SETS_MAX) : []; };

// Every choice as it is, and the More tags, under a name: the way a kind of reference is asked for again (a watercolour study of
// a street, a sheet of faces in ink). A set of the same name is replaced.
function genSetMake(name, ch = genChoices, extra = el('genExtra').value) {
  const { palette, ...rest } = ch;
  return { name: String(name || '').trim().slice(0, 40), choices: { ...rest }, extra: String(extra || '').slice(0, 200), medium: ch.medium, subject: ch.subject };
}
function genSetSave() {
  const status = el('genStatus'), name = el('gnSetName').value.trim();
  if (!name) { status.textContent = 'Name the settings first.'; return; }
  const set = genSetMake(name);
  gnPut(GN_SETS_KEY, [set, ...genSetsLoad().filter(s => s.name.toLowerCase() !== set.name.toLowerCase())].slice(0, GN_SETS_MAX));
  el('gnSetName').value = '';
  genSetsRender();
  status.textContent = `${set.name} is kept: every choice and the More tags.`;
}
function genSetUse(i) {
  const set = genSetsLoad()[i];
  if (!set) return;
  // The palette is not kept with them (it comes from Palettes): a set that asks for it keeps the one there is.
  const keep = genChoices.palette;
  genChoices = { ...GEN_DEFAULTS, ...set.choices };
  if (keep) genChoices.palette = keep;
  saveGenChoices();
  el('genExtra').value = set.extra || '';
  renderGenerate();
  renderGenPrompt();
  el('genStatus').textContent = `${set.name} is back in the choices.`;
}
function genSetsRender() {
  const list = genSetsLoad(), host = el('gnSets');
  host.innerHTML = list.length ? list.map((s, i) => `<div class="gn-card" data-i="${i}"><b>${esc(s.name)}</b> <span class="count">${esc([s.subject, s.medium].filter(Boolean).join(', '))}</span>` +
    `<button type="button" class="ghost" data-act="use" title="Put every choice and the More tags back as they were">Use</button>` +
    `<button type="button" class="ghost" data-act="drop" aria-label="Forget ${esc(s.name)}" title="Forget these settings">&times;</button></div>`).join('')
    : '<p class="count">None yet: set the choices the way you want them, name them and keep them.</p>';
}

/* ---- the blocks in the panel (genMoreInit calls these) */

function genNewBlocks() {
  const block = (id, title, text, inner) => `<details class="gm-block" id="${id}"><summary>${title}</summary><p class="count">${text}</p>${inner}</details>`;
  return block('gnDescBlock', 'Describe it', 'In your own words - Ukrainian or English: "червона сукня, зелені очі, біля вікна". The words become tags in More tags, where they can be read and changed.',
      `<div class="row"><input type="text" id="gnDescText" maxlength="160" placeholder="e.g. червона сукня, біля вікна, дощ" aria-label="Describe it"><button type="button" class="ghost" id="gnDescAdd">Add</button></div>`) +
    block('gnSetBlock', 'Saved settings', 'All the choices and the More tags under a name - a watercolour street, a face sheet in ink - to ask for the same kind of reference again.',
      `<div class="row"><input type="text" id="gnSetName" maxlength="40" placeholder="a name" aria-label="Name for the settings"><button type="button" class="ghost" id="gnSetSave">Keep the settings</button></div><div id="gnSets"></div>`) +
    block('gnGridBlock', 'A grid', 'One thing changed at a time - the hair colour, the eyes, the light - with one seed, then seen on one sheet.',
      `<div class="row"><select id="gnGridRow" aria-label="What to change"></select><button type="button" class="ghost" id="gnGridGo">Make the grid</button></div>`) +
    block('gnCardBlock', 'Character cards', 'A character kept under a name with her hair and eyes: put her back in a click, or draw her in the storyboard.',
      `<div class="row"><input type="text" id="gnCardName" maxlength="40" placeholder="her name" aria-label="Name for the card"><button type="button" class="ghost" id="gnCardSave" title="Keep the character, her look and her hair and eyes as they are in the choices">Keep her</button></div><div id="gnCards"></div>`) +
    block('gnChalBlock', 'The challenge', 'A pose, an outfit, a light and a mood at random. It goes into More tags: draw it yourself first, then make the reference to compare.',
      `<div class="row"><button type="button" class="ghost" id="gnChalRoll">Roll</button><button type="button" class="ghost" id="gnChalToday" title="The same one all day">Today\'s</button>` +
      `<span class="chips" id="gnChalMin" role="group" aria-label="Minutes for the sitting">${GN_CHAL_MINUTES.map(n => `<button type="button" class="chip" data-v="${n}" aria-pressed="false">${n} min</button>`).join('')}</span>` +
      `<button type="button" class="ghost" id="gnChalTimer">Start the timer</button><span class="count" id="gnChalClock" role="timer"></span></div><div class="gn-chals" id="gnChal"></div>`);
}

function genNewWire() {
  // The grid: the rows that can make one with the choices now, checked each time the block is opened.
  const fill = () => {
    const rows = genGridRows(), sel = el('gnGridRow'), want = gnStore(GN_GRID_KEY, '');
    sel.innerHTML = rows.map(c => `<option value="${c.id}">${esc(c.label)} (${genGridOptions(c).length})</option>`).join('');
    if (rows.some(c => c.id === want)) sel.value = want;
  };
  fill();
  el('gnGridBlock').addEventListener('toggle', () => { if (el('gnGridBlock').open) fill(); });
  el('gnGridGo').addEventListener('click', genGridGo);
  // Describe it.
  el('gnDescAdd').addEventListener('click', genDescribeAdd);
  el('gnDescText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); genDescribeAdd(); } });
  // Saved settings.
  genSetsRender();
  el('gnSetSave').addEventListener('click', genSetSave);
  el('gnSetName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); genSetSave(); } });
  el('gnSets').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'), row = e.target.closest('[data-i]'); if (!b || !row) return;
    if (b.dataset.act === 'drop') { gnPut(GN_SETS_KEY, genSetsLoad().filter((_, j) => j !== +row.dataset.i)); genSetsRender(); } else genSetUse(+row.dataset.i);
  });
  // The cards.
  genCardsRender();
  el('gnCardSave').addEventListener('click', genCardSave);
  el('gnCardName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); genCardSave(); } });
  el('gnCards').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'), row = e.target.closest('[data-i]'); if (!b || !row) return;
    const i = +row.dataset.i;
    if (b.dataset.act === 'drop') { gnPut(GN_CARDS_KEY, genCardsLoad().filter((_, j) => j !== i)); genCardsRender(); }
    else if (b.dataset.act === 'use') genCardUse(i);
    else if (b.dataset.act === 'story' && genCardUse(i)) genStoryGo();
  });
  // The challenge.
  const min = +gnStore(GN_CHAL_KEY + '.min', 20) || 20;
  gnPress(el('gnChalMin'), v => +v === min);
  el('gnChalMin').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { gnPut(GN_CHAL_KEY + '.min', +b.dataset.v); gnPress(el('gnChalMin'), v => v === b.dataset.v); } });
  el('gnChalRoll').addEventListener('click', () => genChallengeRoll(false));
  el('gnChalToday').addEventListener('click', () => genChallengeRoll(true));
  el('gnChalTimer').addEventListener('click', genChallengeTimer);
  const last = gnStore(GN_CHAL_KEY, null);
  if (last?.c) genChallengeShow(last.c);
}
