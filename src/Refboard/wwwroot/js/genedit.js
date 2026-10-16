/* Working on a picture Generate made (js/generate.js): Finish it and Redraw a
   part, and the menu on each picture that holds them with the rest.

   Both start from the picture itself, not from the choices on the page: the
   picture goes back to the server, which draws over it - img2img, so what is
   in it stays.

   - Finish it: the picture enlarged 1.5 times and drawn again with little
     freedom (denoise 0.4). The enlarged pixels are only blur; the sampler
     fills every shape with the detail the bigger size has room for. A
     draft, made in fewer steps, becomes the picture it was a sketch of.
   - Redraw a part: brush over what is wrong (a hand, an eye) and only that is
     drawn again - the server masks the latent and pastes the new paint over
     the original, so the rest is the same pixels, not "nearly". */

const GEN_FINISH_SCALE = 1.5, GEN_FINISH_DENOISE = 0.4, GEN_FINISH_MAX_W = 1300;
const GEN_REDRAW_LEVELS = [['Slightly', 0.55, 'Keeps the colours and the drawing there'], ['Somewhat', 0.75, 'New details in the same place'], ['Completely', 0.95, 'Draws it as if it was not there']];
let redraw = null;     // { u, w, h, level, ink, undo: [ImageData] } while the sheet is open

/* A generated picture's file as an image, at its own size. */
async function genLoadPicture(u) {
  const url = await storeFileUrl(u.file);
  if (!url) throw new Error('That picture could not be found.');
  const blob = await (await fetch(url)).blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImg(objectUrl);
    const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  } finally { URL.revokeObjectURL(objectUrl); }
}

/* The words a picture was made from. Pictures made before the server kept them
   have none: the tags it was filed under say enough for the sampler to go on. */
const genWordsOf = u => u.prompt || (u.tags || []).join(', ') || 'illustration';

async function genFinish(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  const status = el('genStatus');
  try {
    const pic = await genLoadPicture(u);
    if (pic.width > GEN_FINISH_MAX_W || (u.tags || []).includes('finished')) { status.textContent = 'That one is already finished - bigger than this would not fit on a small card.'; return; }
    const tags = [...(u.tags || []).filter(t => t !== 'draft'), 'finished'].slice(0, 24).map(t => t.slice(0, 40));
    runGenerate([{ prompt: genWordsOf(u), avoid: u.avoid || '', tags, shape: u.shape || 'portrait', seed: u.seed,
      image: genEncode(pic), denoise: GEN_FINISH_DENOISE, scale: GEN_FINISH_SCALE }], 'Finishing it - 1.5 times the size, so a little longer...', 'Finished - in Uploads, Generated.');
  } catch (err) { status.textContent = err.message; }
}

/* ---- Redraw a part: the sheet with the picture and a brush over it. */
const redrawInk = () => el('redrawMask').getContext('2d');

async function genRedrawOpen(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  const pc = el('redrawPic'), mc = el('redrawMask');
  pc.width = mc.width = pic.width; pc.height = mc.height = pic.height;
  pc.getContext('2d').drawImage(pic, 0, 0);
  redraw = { u, w: pic.width, h: pic.height, level: GEN_REDRAW_LEVELS[1][1], ink: false, undo: [], last: null };
  el('redrawLevels').innerHTML = GEN_REDRAW_LEVELS.map(([label, v, tip]) =>
    `<button type="button" class="chip" data-level="${v}" aria-pressed="${v === redraw.level}" title="${esc(tip)}">${label}</button>`).join('');
  el('redrawText').value = '';
  renderRedraw();
  el('redrawSheet').classList.remove('hidden');
  dialogOpened(el('redrawSheet'), mc);
}

function closeRedraw() {
  el('redrawSheet').classList.add('hidden');
  redraw = null;
  dialogClosed(el('redrawSheet'));
}

function renderRedraw() {
  el('redrawGo').disabled = !redraw?.ink;
  el('redrawUndo').disabled = !redraw?.undo.length;
  el('redrawClear').disabled = !redraw?.ink;
  el('redrawHint').textContent = redraw?.ink ? 'Brush over more, or Redraw.' : 'Brush over the part to draw again.';
}

/* A stroke: a dot where the pointer went down, and lines between the points
   after. Positions are in the picture's own pixels, whatever size it is shown. */
function redrawAt(e) {
  const c = el('redrawMask'), r = c.getBoundingClientRect();
  return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height];
}
function redrawBrush() { return Number(el('redrawSize').value) * redraw.w / 832; }
function redrawStroke(e) {
  const g = redrawInk(), [x, y] = redrawAt(e);
  g.fillStyle = g.strokeStyle = '#ff0000';
  g.lineWidth = redrawBrush(); g.lineCap = g.lineJoin = 'round';
  if (redraw.last) { g.beginPath(); g.moveTo(...redraw.last); g.lineTo(x, y); g.stroke(); }
  else { g.beginPath(); g.arc(x, y, redrawBrush() / 2, 0, Math.PI * 2); g.fill(); }
  redraw.last = [x, y];
}
function redrawUndo() {
  if (!redraw?.undo.length) return;
  const g = redrawInk(), snap = redraw.undo.pop();
  g.clearRect(0, 0, redraw.w, redraw.h);
  if (snap) g.putImageData(snap, 0, 0);
  redraw.ink = !!snap;
  renderRedraw();
}
function redrawClear() {
  if (!redraw?.ink) return;
  redraw.undo.push(redrawInk().getImageData(0, 0, redraw.w, redraw.h));
  redrawInk().clearRect(0, 0, redraw.w, redraw.h);
  redraw.ink = false;
  renderRedraw();
}

/* The mask the server takes: white where the brush went, black everywhere else
   (the stroke is red on clear, and the server reads the red channel). */
function redrawMaskPng() {
  const out = Object.assign(document.createElement('canvas'), { width: redraw.w, height: redraw.h }), g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(el('redrawMask'), 0, 0);
  return out.toDataURL('image/png').split(',')[1];
}

function redrawGo() {
  if (!redraw?.ink) return;
  const { u } = redraw, more = el('redrawText').value.trim().slice(0, 100);
  const pic = el('redrawPic');
  // What should be there is weighted: the original's words describe the whole
  // picture, and one more tag among thirty would be lost.
  const prompt = comfyTags([genWordsOf(u), more && `(${more}:1.3)`].filter(Boolean).join(', '));
  const tags = [...(u.tags || []), ...genSplit(more), 'redrawn'].slice(0, 24).map(t => t.slice(0, 40));
  const req = { prompt, avoid: u.avoid || '', tags, shape: u.shape || 'portrait',
    image: genEncode(pic), mask: redrawMaskPng(), denoise: redraw.level };
  closeRedraw();
  runGenerate([req], 'Drawing that part again...', 'Redrawn - in Uploads, Generated.');
}

function initGenEdit() {
  const mask = el('redrawMask');
  mask.addEventListener('pointerdown', e => {
    if (!redraw || e.button > 0) return;
    mask.setPointerCapture(e.pointerId);
    redraw.undo.push(redraw.ink ? redrawInk().getImageData(0, 0, redraw.w, redraw.h) : null);
    if (redraw.undo.length > 12) redraw.undo.shift();
    redraw.last = null;
    redraw.ink = true;
    redrawStroke(e);
    renderRedraw();
  });
  mask.addEventListener('pointermove', e => { if (redraw?.last && e.buttons) redrawStroke(e); });
  const end = () => { if (redraw) redraw.last = null; };
  mask.addEventListener('pointerup', end);
  mask.addEventListener('pointercancel', end);
  el('redrawLevels').addEventListener('click', e => {
    const b = e.target.closest('[data-level]');
    if (!b || !redraw) return;
    redraw.level = Number(b.dataset.level);
    for (const x of el('redrawLevels').children) x.setAttribute('aria-pressed', String(x === b));
  });
  el('redrawUndo').addEventListener('click', redrawUndo);
  el('redrawClear').addEventListener('click', redrawClear);
  el('redrawGo').addEventListener('click', redrawGo);
  el('redrawClose').addEventListener('click', closeRedraw);
  el('redrawText').addEventListener('keydown', e => { if (e.key === 'Enter') redrawGo(); });
  el('redrawSheet').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.target.id !== 'redrawText') { e.preventDefault(); redrawUndo(); }
  });
  initSheet(el('redrawSheet'), closeRedraw);
}
initGenEdit();
