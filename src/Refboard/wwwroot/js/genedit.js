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
     the original, so the rest is the same pixels, not "nearly".
   - New background: Redraw a part with the mask already brushed over the
     background - found from the picture's edges - for you to correct.
   - Light it differently, In other media: the same picture drawn again, img2img,
     with the light row's or the medium row's tags swapped in - several at once,
     to put side by side. */

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
      image: genEncode(pic), denoise: GEN_FINISH_DENOISE, scale: GEN_FINISH_SCALE, parent: u.file }], 'Finishing it - 1.5 times the size, so a little longer...', 'Finished - in Uploads, Generated.');
  } catch (err) { status.textContent = err.message; }
}

/* The picture again with something about it changed: img2img at this denoise, from the
   picture itself, in its own words with the tags of a row swapped in. */
// Compared without the backslashes the escaping adds, so "ink (medium)" and "ink \(medium\)" are one tag.
const genWithout = (list, drop) => { const bare = s => s.replace(/\\/g, ''), d = new Set([...drop].map(bare)); return list.filter(t => !d.has(bare(t))); };
function genRework(u, pic, prompt, avoid, tags, denoise) {
  return { prompt, avoid, tags: tags.slice(0, 24).map(t => t.slice(0, 40)), shape: u.shape || 'portrait', seed: u.seed,
    image: genEncode(pic), denoise, parent: u.file };
}
const genOptionOf = (row, id) => GEN_CHOICES.find(c => c.id === row).options.find(o => o.id === id);
const genWordsOfOption = o => o.words ?? o.label.toLowerCase();

/* Light it differently: soft, from the side, backlit, dramatic - four pictures of the same
   picture. The new light's tags are weighted: the picture is the sampler's start and its
   old light would win. */
async function genLights(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  try {
    const pic = await genLoadPicture(u), all = GEN_CHOICES.find(c => c.id === 'light').options.filter(o => o.id !== 'any');
    const oldWords = new Set(all.map(genWordsOfOption)), oldTags = new Set(all.flatMap(o => genSplit(o.tags)));
    const jobs = all.map(o => genRework(u, pic,
      comfyTags([...genWithout(genSplit(genWordsOf(u)), oldTags), ...genSplit(o.tags).map(t => `(${t}:1.3)`)].join(', ')),
      u.avoid || '', [...genWithout(u.tags || [], oldWords), genWordsOfOption(o)], 0.55));
    runGenerate(jobs, 'Lighting it four ways...', 'Four lights - in Uploads, Generated.');
  } catch (err) { el('genStatus').textContent = err.message; }
}

/* In other media: the picture in the media you draw in, except the one it is in. The old
   medium's tags and what it kept out are taken out of its words first - ink's "no colour"
   would be kept out of a watercolour. A medium is a bigger change than a light, so more freedom. */
const GEN_REWORK_MEDIA = ['watercolour', 'ink', 'copic', 'sketch'];
async function genMedia(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  try {
    const pic = await genLoadPicture(u), all = GEN_CHOICES.find(c => c.id === 'medium').options;
    const oldTags = new Set(all.flatMap(o => genSplit(comfyTags(o.tags || '')))), oldAvoid = new Set(all.flatMap(o => genSplit(comfyTags(o.avoid || ''))));
    const oldWords = new Set(all.map(genWordsOfOption)), have = new Set((u.tags || []).map(t => t.toLowerCase()));
    const jobs = all.filter(o => GEN_REWORK_MEDIA.includes(o.id) && !have.has(genWordsOfOption(o))).map(o => genRework(u, pic,
      comfyTags([...genWithout(genSplit(genWordsOf(u)), oldTags), o.tags].join(', ')),
      [...genWithout(genSplit(u.avoid || ''), oldAvoid), ...genSplit(comfyTags(o.avoid || ''))].join(', '),
      [...genWithout(u.tags || [], oldWords), genWordsOfOption(o)], GEN_GREY.includes(o.id) ? 0.8 : 0.65));
    runGenerate(jobs, `Drawing it in ${jobs.length} media...`, `${jobs.length} media - in Uploads, Generated.`);
  } catch (err) { el('genStatus').textContent = err.message; }
}

/* ---- Redraw a part: the sheet with the picture and a brush over it. */
const redrawInk = () => el('redrawMask').getContext('2d');

async function genRedrawOpen(u, background = false) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  const pc = el('redrawPic'), mc = el('redrawMask');
  pc.width = mc.width = pic.width; pc.height = mc.height = pic.height;
  pc.getContext('2d').drawImage(pic, 0, 0);
  redraw = { u, w: pic.width, h: pic.height, level: GEN_REDRAW_LEVELS[background ? 2 : 1][1], ink: false, undo: [], last: null, background };
  el('redrawTitle').textContent = background ? 'New background' : 'Redraw a part';
  el('redrawLabel').firstChild.textContent = background ? 'What the background is ' : 'What should be there ';
  el('redrawText').placeholder = background ? 'e.g. a beach at sunset, a classroom' : 'optional - e.g. open hand, brown eyes';
  if (background) redraw.ink = genBackgroundMask(pic);
  el('redrawLevels').innerHTML = GEN_REDRAW_LEVELS.map(([label, v, tip]) =>
    `<button type="button" class="chip" data-level="${v}" aria-pressed="${v === redraw.level}" title="${esc(tip)}">${label}</button>`).join('');
  if (background) redraw.hint = redraw.ink ? 'The background is brushed already - take off what is not, brush on what is.' : 'No plain background found - brush over it.';
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
  el('redrawHint').textContent = redraw?.hint || (redraw?.ink ? 'Brush over more, or Redraw.' : 'Brush over the part to draw again.');
}

/* A stroke: a dot where the pointer went down, and lines between the points
   after. Positions are in the picture's own pixels, whatever size it is shown. */
function redrawAt(e) {
  const c = el('redrawMask'), r = c.getBoundingClientRect();
  return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height];
}
function redrawBrush() { return Number(el('redrawSize').value) * redraw.w / 832; }
function redrawStroke(e) {
  redraw.hint = '';
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
  // A new background: the plain one's words go, or "white background" fights the new one.
  const own = redraw.background ? genWithout(genSplit(genWordsOf(u)), new Set(['simple background', 'white background', 'transparent background'])) : genSplit(genWordsOf(u));
  const text = redraw.background ? (more || 'detailed background, scenery') : more;
  const prompt = comfyTags([...own, text && `(${text}:1.3)`].filter(Boolean).join(', '));
  const tags = [...(u.tags || []), ...genSplit(more), redraw.background ? 'new background' : 'redrawn'].slice(0, 24).map(t => t.slice(0, 40));
  const req = { prompt, avoid: u.avoid || '', tags, shape: u.shape || 'portrait',
    image: genEncode(pic), mask: redrawMaskPng(), denoise: redraw.level, parent: u.file };
  const bg = redraw.background;
  closeRedraw();
  runGenerate([req], bg ? 'Drawing the background...' : 'Drawing that part again...', bg ? 'New background - in Uploads, Generated.' : 'Redrawn - in Uploads, Generated.');
}

/* The background of a picture with a plain one: the colour that touches the picture's edge,
   spread inward over pixels that differ little from the one beside them (a soft gradient
   goes on, the line round the figure stops it) and not far from where it began. Worked out
   on a 200-px copy and drawn on the mask as red, scaled up - a soft edge, which the server
   blurs further. Returns whether any was found (under 4% of the picture is not a background). */
function genBackgroundMask(pic) {
  const k = 200 / Math.max(pic.width, pic.height), w = Math.max(1, Math.round(pic.width * k)), h = Math.max(1, Math.round(pic.height * k));
  const small = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = small.getContext('2d', { willReadFrequently: true });
  g.drawImage(pic, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, seen = new Uint8Array(w * h), from = new Int32Array(w * h), queue = [];
  const dist = (a, b) => Math.abs(d[a * 4] - d[b * 4]) + Math.abs(d[a * 4 + 1] - d[b * 4 + 1]) + Math.abs(d[a * 4 + 2] - d[b * 4 + 2]);
  // The edge's own colour: the corners' (a figure rarely stands in all four).
  const corners = [0, w - 1, (h - 1) * w, h * w - 1], ref = corners.sort((a, b) => d[a * 4] + d[a * 4 + 1] + d[a * 4 + 2] - d[b * 4] - d[b * 4 + 1] - d[b * 4 + 2])[1];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = y * w + x; if (dist(i, ref) < 90 && !seen[i]) { seen[i] = 1; from[i] = i; queue.push(i); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = y * w + x; if (dist(i, ref) < 90 && !seen[i]) { seen[i] = 1; from[i] = i; queue.push(i); } }
  let found = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % w, y = (i / w) | 0;
    found++;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (!seen[n] && dist(n, i) <= 18 && dist(n, ref) <= 150) { seen[n] = 1; queue.push(n); }
    }
  }
  if (found < 0.04 * w * h) return false;
  const m = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) if (seen[i]) { m.data[i * 4] = 255; m.data[i * 4 + 3] = 255; }
  g.putImageData(m, 0, 0);
  const out = redrawInk();
  out.clearRect(0, 0, pic.width, pic.height);
  out.imageSmoothingEnabled = true;
  out.drawImage(small, 0, 0, pic.width, pic.height);
  return true;
}

/* ---- Before and after: the picture over the one it was made from, and a slider.
   The "before" is clipped to the left of the slider; both are drawn in the same box, so a
   Finished picture (1.5 times the size) lines up with its draft. */
let compareOpen = false;
function compareSet(v) {
  v = Math.max(0, Math.min(100, v));
  el('compareSlider').value = String(v);
  el('compareBefore').style.clipPath = `inset(0 ${100 - v}% 0 0)`;
  el('compareStage').style.setProperty('--cmp', v + '%');
}
async function genCompare(u) {
  const hint = el('genStatus');
  const [before, after] = await Promise.all([storeFileUrl(u.parent), storeFileUrl(u.file)]);
  if (!before || !after) { hint.textContent = 'The picture it was made from is not there any more.'; return; }
  el('compareHint').textContent = '';
  // The original may have been deleted: a server answers with a URL either way.
  const probe = new Image();
  probe.onerror = () => { closeCompare(); hint.textContent = 'The picture it was made from is not there any more.'; };
  probe.src = before;
  el('compareBefore').src = before;
  el('compareAfter').src = after;
  compareSet(50);
  compareOpen = true;
  el('compareSheet').classList.remove('hidden');
  dialogOpened(el('compareSheet'), el('compareSlider'));
}
function closeCompare() {
  if (!compareOpen) return;
  compareOpen = false;
  el('compareSheet').classList.add('hidden');
  dialogClosed(el('compareSheet'));
}

function initGenEdit() {
  const stage = el('compareStage');
  const drag = e => { const r = stage.getBoundingClientRect(); compareSet((e.clientX - r.left) / r.width * 100); };
  stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); drag(e); });
  stage.addEventListener('pointermove', e => { if (e.buttons) drag(e); });
  el('compareSlider').addEventListener('input', e => compareSet(Number(e.target.value)));
  el('compareClose').addEventListener('click', closeCompare);
  initSheet(el('compareSheet'), closeCompare);
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
