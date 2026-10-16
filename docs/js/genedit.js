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
   - In detail (on by default in Redraw a part): a small part is cut out with room round it,
     enlarged to about 1024 px, drawn there and put back - see redrawZoom().
   - New background: Redraw a part with the mask already brushed over the
     background - found from the picture's edges - for you to correct.
   - Extend the picture: a bigger canvas with the picture in it and the new part masked.
     The server draws the masked part from scratch (the same "Completely" Redraw) and
     pastes the original back over the rest, so the picture itself does not change.
   - Cut out: the plain background found from the picture's edges and taken away, for
     a PNG with alpha (the work itself is cutOut() in js/assetsfx.js, no model).
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
  // A background is big and wide; there is no part of it to zoom in on.
  el('redrawDetailRow').classList.toggle('hidden', background);
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
  // A small part drawn in detail: the part, with room round it, enlarged and drawn there,
  // then put back - see redrawZoom().
  const zoom = !bg && el('redrawDetail').checked ? redrawZoom() : null;
  if (zoom) { req.image = zoom.image; req.mask = zoom.mask; req.shape = extendShape(zoom.ow, zoom.oh); }
  closeRedraw();
  runGenerate([req], bg ? 'Drawing the background...' : zoom ? 'Drawing that part again, in detail...' : 'Drawing that part again...',
    bg ? 'New background - in Uploads, Generated.' : 'Redrawn - in Uploads, Generated.', zoom && (made => redrawPasteBack(u, made, zoom)));
}

/* ---- In detail. A hand or a face a hundred pixels wide is a handful of the sampler's own
   cells, and drawn again there it gets no more detail than it had. So the part is cut out
   with room round it (for what the model should match), enlarged to about 1024 px - the size
   it draws best at - drawn again as a picture of its own, and the result, made small again,
   is put back where it came from, only where the brush was, with a soft edge. */
const GEN_ZOOM_SIDE = 1024, GEN_ZOOM_MAX_K = 4, GEN_ZOOM_MIN_K = 1.4, GEN_ZOOM_MIN_CROP = 256, GEN_ZOOM_MAX_SHARE = 0.35;
const zoomCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

/* Where to cut: the brushed part's box widened by 60% of its long side each way (at least 256
   px across, in the picture), moved - not cut - to stay inside the picture. Null when
   nothing is brushed, the part is over a third of the picture (it is big enough already),
   or enlarging would be less than 1.4 times. */
function redrawCrop() {
  const { w: W, h: H } = redraw, d = redrawInk().getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  if (bw * bh > GEN_ZOOM_MAX_SHARE * W * H) return null;
  const grow = Math.max(bw, bh) * 0.6;
  // A small part gets more room, not a bigger enlargement: both sides grow by what the long one lacks.
  const lack = Math.max(0, GEN_ZOOM_MIN_CROP - (Math.max(bw, bh) + 2 * grow));
  const cw = Math.min(W, Math.round(bw + 2 * grow + lack)), ch = Math.min(H, Math.round(bh + 2 * grow + lack));
  const x = Math.max(0, Math.min(W - cw, Math.round((x0 + x1) / 2 - cw / 2))), y = Math.max(0, Math.min(H - ch, Math.round((y0 + y1) / 2 - ch / 2)));
  const k = Math.min(GEN_ZOOM_MAX_K, GEN_ZOOM_SIDE / Math.max(cw, ch));
  return k >= GEN_ZOOM_MIN_K ? { x, y, w: cw, h: ch, k } : null;
}

/* The request's picture and mask cut and enlarged, and what the paste-back needs: a copy of
   the whole picture, and the mask at the cut's own size, widened and softened. */
function redrawZoom() {
  const c = redrawCrop();
  if (!c) return null;
  const ow = Math.max(8, Math.round(c.w * c.k / 8) * 8), oh = Math.max(8, Math.round(c.h * c.k / 8) * 8);
  const pic = el('redrawPic'), ink = el('redrawMask');
  const whole = zoomCanvas(pic.width, pic.height);
  whole.getContext('2d').drawImage(pic, 0, 0);
  const cut = zoomCanvas(ow, oh), cg = cut.getContext('2d');
  cg.imageSmoothingQuality = 'high';
  cg.drawImage(pic, c.x, c.y, c.w, c.h, 0, 0, ow, oh);
  const mask = zoomCanvas(ow, oh), mg = mask.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, ow, oh);
  mg.drawImage(ink, c.x, c.y, c.w, c.h, 0, 0, ow, oh);
  // At the cut's own size: blurred by what the server will grow and blur the mask by (about
  // 18 of the enlarged pixels), and added to itself twice so the blur reaches full strength a
  // little outside the brush - a thin stroke would stay faint otherwise.
  const soft = zoomCanvas(c.w, c.h), sg = soft.getContext('2d');
  sg.filter = `blur(${Math.max(2, 14 / c.k).toFixed(1)}px)`;
  sg.drawImage(ink, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  sg.filter = 'none';
  const once = zoomCanvas(c.w, c.h);
  once.getContext('2d').drawImage(soft, 0, 0);
  sg.globalCompositeOperation = 'lighter';
  sg.drawImage(once, 0, 0); sg.drawImage(once, 0, 0);
  return { image: genEncode(cut), mask: mask.toDataURL('image/png').split(',')[1], ow, oh, c, whole, soft };
}

/* The part drawn in detail, made small and put into the picture it was cut from; kept as that
   picture (the same document, the way Keep to the palette keeps its own), and the cut-out
   the server made - a picture of its own, that nobody asked for - forgotten. */
async function redrawPasteBack(u, made, z) {
  const status = el('genStatus'), doc = made.doc;
  status.textContent = 'Putting it back into the picture...';
  const part = await createImageBitmap(await (await fetch(await storeFileUrl(doc.file))).blob());
  const patch = zoomCanvas(z.c.w, z.c.h), pg = patch.getContext('2d');
  pg.imageSmoothingQuality = 'high';
  pg.drawImage(part, 0, 0, z.c.w, z.c.h);
  pg.globalCompositeOperation = 'destination-in';
  pg.drawImage(z.soft, 0, 0);
  const out = zoomCanvas(z.whole.width, z.whole.height), og = out.getContext('2d');
  og.drawImage(z.whole, 0, 0);
  og.drawImage(patch, z.c.x, z.c.y);
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  const f = await storeFile(blob);
  if (storeMode === 'server') await storeSortFile(f.id, doc.folder || 'generated');
  await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png', shape: u.shape || 'portrait',
    tags: [...(doc.tags || []), 'in detail'].slice(0, 24), t: Date.now() });
  await forgetUpload(doc);
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

/* ---- Extend the picture. Sizes are kept to multiples of 8 (the VAE works in 8-pixel
   cells) and to what SDXL draws in one piece without a small card running out: 1.7
   megapixels - 832x1216 and a quarter more on one side is 1.26, half more 1.52. */
const GEN_EXTEND_MAX = 1_700_000;
const GEN_EXTEND_SIDES = [['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom']];
const GEN_EXTEND_AMOUNTS = [[0.25, 'A quarter'], [0.5, 'Half']];
let extend = null;   // { u, pic, sides: Set, frac } while the sheet is open

/* The new canvas: how much is added on each side, and the whole size. A side's amount is
   a fraction of the picture's width (left, right) or height (top, bottom). */
function extendBox(e) {
  const by = n => Math.round(n / 8) * 8, W0 = e.pic.width, H0 = e.pic.height;
  const l = e.sides.has('left') ? by(W0 * e.frac) : 0, r = e.sides.has('right') ? by(W0 * e.frac) : 0;
  const t = e.sides.has('top') ? by(H0 * e.frac) : 0, b = e.sides.has('bottom') ? by(H0 * e.frac) : 0;
  return { l, r, t, b, W: W0 + l + r, H: H0 + t + b };
}
/* A picture's words with the person left out: the tags of the rows about her (who, hair,
   eyes, clothes, pose...), "1girl", "solo", anything about hair or eyes, and the pieces of
   a weighted character name. What is left is the style and the scene. Asked to draw a blank
   strip from "1girl, blonde hair" the sampler draws her hair there - on a white background
   it drew a long fall of it. */
function genScenery(words) {
  // An option's tags are a string, an object by subject or setting (strings, or functions of
  // the choices), or a function: every string in them counts; a function is asked with the defaults.
  const strings = v => typeof v === 'string' ? [v] : typeof v === 'function' ? strings(v({ ...GEN_DEFAULTS })) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
  const own = new Set(GEN_CHOICES.filter(c => c.for === PERSON).flatMap(c => c.options.flatMap(o => strings(o.tags).flatMap(s => genSplit(comfyTags(s))))));
  const person = /^(\d+\+?(girl|boy|other)s?|solo|looking at viewer)$|\b(hair|eyes?|face|lips|blush|smile|breasts?|bangs|twintails|ponytail)\b/i;
  return genSplit(words).filter(t => {
    const bare = t.replace(/^\(|:[\d.]+\)$|\)$/g, '');
    if (own.has(t) || own.has(bare) || person.test(bare)) return false;
    // A weighted tag is whole ("(simple drawing:1.3)") or a piece of one that held a comma
    // (a character's name and series): the pieces are dropped.
    return (t.startsWith('(') ? /:[\d.]+\)$/.test(t) : !/:[\d.]+\)$/.test(t));
  });
}

/* The shape the new picture is filed under: the nearest of the three. */
const extendShape = (W, H) => W / H < 0.9 ? 'portrait' : W / H > 1.1 ? 'landscape' : 'square';

async function genExtendOpen(u) {
  if (genBusy) { el('genStatus').textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  extend = { u, pic, sides: new Set(['right']), frac: 0.25 };
  el('extendText').value = '';
  el('extendPerson').checked = false;
  el('extendSides').innerHTML = GEN_EXTEND_SIDES.map(([id, label]) =>
    `<button type="button" class="chip" data-side="${id}" aria-pressed="${extend.sides.has(id)}">${label}</button>`).join('');
  el('extendAmount').innerHTML = GEN_EXTEND_AMOUNTS.map(([v, label]) =>
    `<button type="button" class="chip" data-frac="${v}" aria-pressed="${v === extend.frac}">${label}</button>`).join('');
  renderExtend();
  el('extendSheet').classList.remove('hidden');
  dialogOpened(el('extendSheet'), el('extendGo'));
}
function closeExtend() {
  if (!extend) return;
  el('extendSheet').classList.add('hidden');
  extend = null;
  dialogClosed(el('extendSheet'));
}
function renderExtend() {
  const e = extend, box = extendBox(e), c = el('extendPreview');
  c.width = box.W; c.height = box.H;
  const g = c.getContext('2d');
  g.drawImage(e.pic, box.l, box.t);
  g.strokeStyle = '#cba6f7'; g.lineWidth = Math.max(2, box.W / 300); g.setLineDash([10, 8]);
  g.strokeRect(box.l, box.t, e.pic.width, e.pic.height);
  const tooBig = box.W * box.H > GEN_EXTEND_MAX, none = !e.sides.size;
  el('extendGo').disabled = tooBig || none;
  el('extendHint').textContent = none ? 'Pick a side to add to.'
    : tooBig ? `${box.W} x ${box.H} is too big to draw in one go - pick fewer sides or a smaller step.`
    : `${e.pic.width} x ${e.pic.height} becomes ${box.W} x ${box.H}. The new part is drawn from what is at the edge.`;
}
function extendGo() {
  const e = extend;
  if (!e || el('extendGo').disabled) return;
  const box = extendBox(e), more = el('extendText').value.trim().slice(0, 100), { u } = e;
  // The picture on a bigger canvas, and a mask white over all of the new part. The server
  // erases that part before drawing, so what the canvas holds there is never seen.
  const big = Object.assign(document.createElement('canvas'), { width: box.W, height: box.H }), g = big.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, box.W, box.H);
  g.drawImage(e.pic, box.l, box.t);
  const mask = Object.assign(document.createElement('canvas'), { width: box.W, height: box.H }), m = mask.getContext('2d');
  m.fillStyle = '#fff'; m.fillRect(0, 0, box.W, box.H);
  m.fillStyle = '#000'; m.fillRect(box.l, box.t, e.pic.width, e.pic.height);
  // Unless asked to go on drawing her, the new part is the scene: her words are left out and
  // "no humans" is in, and she is kept out by name.
  const person = el('extendPerson').checked;
  const words = person ? genSplit(genWordsOf(u)) : ['no humans', ...genScenery(genWordsOf(u))];
  const prompt = comfyTags([...words, more && `(${more}:1.3)`].filter(Boolean).join(', '));
  const avoid = person ? u.avoid || '' : [u.avoid, '1girl, 1boy, solo, face, hair, spiral binding, notebook, paint swatches, color palette, border, frame'].filter(Boolean).join(', ');
  const tags = [...(u.tags || []), ...genSplit(more), 'extended'].slice(0, 24).map(t => t.slice(0, 40));
  const req = { prompt, avoid, tags, shape: extendShape(box.W, box.H), image: genEncode(big),
    mask: mask.toDataURL('image/png').split(',')[1], denoise: 1, parent: u.file };
  closeExtend();
  runGenerate([req], 'Drawing more of it...', 'Extended - in Uploads, Generated.');
}

/* ---- Cut out (cutOut() in js/assetsfx.js): the picture's plain background found and taken
   away. The result is looked at over a checkerboard, a dark, a light and a green ground - a
   pale fringe shows on the dark one - and at three times the size. Keep the PNG files it in
   Uploads with its alpha, under the picture it was cut from. */
const GEN_CUT_BEHIND = [['checker', 'Checkerboard'], ['dark', 'Dark'], ['light', 'Light'], ['green', 'Green']];
const GEN_CUT_LOOK = [[1, 'Fit'], [3, '3x']];
const GEN_CUT_NONE = 'This picture has no plain background to cut away. Make it on a plain one - "simple background, white background" - and try again.';
let cut = null, cutQueued = false;   // cut: { u, pic, result, zoom } while the sheet is open

function cutRender() {
  const c = cut, r = cutOut(c.pic, { tolerance: Number(el('cutTol').value), holes: el('cutHoles').checked, trim: el('cutTrim').checked, specks: el('cutSpecks').checked });
  c.result = r;
  el('cutSave').disabled = !r.found;
  if (!r.found) {
    el('cutHint').textContent = r.bgShare >= 0.5 ? 'Everything counts as background - lower it.' : r.bgShare > 0 ? 'Too little counts as background - raise it.' : GEN_CUT_NONE;
    return;
  }
  const cv = el('cutPreview');
  cv.width = r.canvas.width; cv.height = r.canvas.height;
  cv.getContext('2d').drawImage(r.canvas, 0, 0);
  el('cutHint').textContent = `${r.canvas.width} x ${r.canvas.height}, with a transparent background - ${Math.round(r.bgShare * 100)}% of the picture was background.`;
  cutLook();
}
// 3x is three times the width the picture is shown at, in a stage that scrolls.
function cutLook() {
  const cv = el('cutPreview'), stage = el('cutStage');
  stage.classList.remove('zoomed');
  cv.style.width = '';
  if (cut.zoom > 1) {
    const fit = cv.getBoundingClientRect().width;
    stage.classList.add('zoomed');
    cv.style.width = fit * cut.zoom + 'px';
  }
}
function cutSoon() {
  if (cutQueued) return;
  cutQueued = true;
  requestAnimationFrame(() => { cutQueued = false; if (cut) cutRender(); });
}
async function genCutOpen(u) {
  let pic;
  try { pic = await genLoadPicture(u); } catch (err) { el('genStatus').textContent = err.message; return; }
  el('cutTol').value = String(CUT_TOLERANCE);
  el('cutHoles').checked = false;
  el('cutTrim').checked = true;
  el('cutSpecks').checked = true;
  cut = { u, pic, result: null, zoom: 1 };
  cutRender();
  // A picture with no plain background says so here, not in a sheet with nothing in it.
  if (!cut.result.found) { cut = null; el('genStatus').textContent = GEN_CUT_NONE; return; }
  el('cutStage').dataset.behind = 'checker';
  el('cutBehind').innerHTML = GEN_CUT_BEHIND.map(([id, label]) =>
    `<button type="button" class="chip" data-behind="${id}" aria-pressed="${id === 'checker'}">${label}</button>`).join('');
  el('cutZoom').innerHTML = GEN_CUT_LOOK.map(([v, label]) =>
    `<button type="button" class="chip" data-zoom="${v}" aria-pressed="${v === 1}">${label}</button>`).join('');
  el('cutSheet').classList.remove('hidden');
  dialogOpened(el('cutSheet'), el('cutSave'));
  cutLook();
}
function closeCut() {
  if (!cut) return;
  el('cutSheet').classList.add('hidden');
  cut = null;
  dialogClosed(el('cutSheet'));
}
async function cutSave() {
  const c = cut;
  if (!c?.result?.found) return;
  const blob = await new Promise(res => c.result.canvas.toBlob(res, 'image/png')), { u } = c, status = el('genStatus');
  closeCut();
  try {
    const f = await storeFile(blob);
    if (storeMode === 'server') await storeSortFile(f.id, u.folder || 'generated');
    await storePutItem('uploads', uploadKey(f.id), { ...u, file: f.id, bytes: blob.size, type: 'image/png',
      tags: [...(u.tags || []), 'cut out'].slice(0, 24), parent: u.file, t: Date.now() });
    storeChanged();
    await showGenerate(false);
    status.textContent = 'Cut out - in Uploads, Generated.';
  } catch (err) { status.textContent = err.message; }
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
  el('extendSides').addEventListener('click', ev => {
    const b = ev.target.closest('[data-side]');
    if (!b || !extend) return;
    extend.sides.has(b.dataset.side) ? extend.sides.delete(b.dataset.side) : extend.sides.add(b.dataset.side);
    b.setAttribute('aria-pressed', String(extend.sides.has(b.dataset.side)));
    renderExtend();
  });
  el('extendAmount').addEventListener('click', ev => {
    const b = ev.target.closest('[data-frac]');
    if (!b || !extend) return;
    extend.frac = Number(b.dataset.frac);
    for (const x of el('extendAmount').children) x.setAttribute('aria-pressed', String(x === b));
    renderExtend();
  });
  el('cutBehind').addEventListener('click', ev => {
    const b = ev.target.closest('[data-behind]');
    if (!b || !cut) return;
    el('cutStage').dataset.behind = b.dataset.behind;
    for (const x of el('cutBehind').children) x.setAttribute('aria-pressed', String(x === b));
  });
  el('cutZoom').addEventListener('click', ev => {
    const b = ev.target.closest('[data-zoom]');
    if (!b || !cut) return;
    cut.zoom = Number(b.dataset.zoom);
    for (const x of el('cutZoom').children) x.setAttribute('aria-pressed', String(x === b));
    cutLook();
  });
  for (const id of ['cutTol', 'cutHoles', 'cutSpecks', 'cutTrim']) el(id).addEventListener('input', cutSoon);
  el('cutSave').addEventListener('click', cutSave);
  el('cutClose').addEventListener('click', closeCut);
  initSheet(el('cutSheet'), closeCut);
  el('extendGo').addEventListener('click', extendGo);
  el('extendClose').addEventListener('click', closeExtend);
  el('extendText').addEventListener('keydown', ev => { if (ev.key === 'Enter') extendGo(); });
  initSheet(el('extendSheet'), closeExtend);
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
