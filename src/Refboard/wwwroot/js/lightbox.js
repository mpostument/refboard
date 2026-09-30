/* refboard - Lightbox: the tablet as a lightbox for transfer. The usual
   anime-in-watercolour way is a sketch on cheap paper first and the final
   on good paper; laid over a bright screen, the good paper shows the
   sketch through, and it is traced.

   A photo of the sketch is rarely square to the camera, and the paper in
   it is grey, not white, and darker at one corner than the other. So:
   - corners: its four corners dragged onto the sheet's (found by
     themselves where the sheet is the big light shape in the photo), and
     the sheet unbent from them - a homography, each pixel of the flat
     sheet looked up in the photo;
   - clean: each pixel divided by the paper's own colour round it, so the
     paper goes white however it was lit and the lines stay - in their
     colour, or all dark (a blue or red col-erase pencil is faint through
     watercolour paper);
   - real size: shown as big as the sheet was, once the screen is measured
     against a bank card - the browser does not know how big its pixels
     are;
   - mirrored if wanted, the screen kept awake, and locked while tracing,
     so a hand on the glass does not move it; held down to unlock.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Paper sizes, short side by long, in mm. B5 is the Japanese one manga
// paper comes in.
const LB_PAPERS = {
  a5: { label: 'A5', mm: [148, 210] },
  b5: { label: 'B5 (manga)', mm: [182, 257] },
  a4: { label: 'A4', mm: [210, 297] },
  a3: { label: 'A3', mm: [297, 420] },
  custom: { label: 'Other width' },
};
// A bank card - any ID-1 card: a driving licence, an ID - is this wide.
const LB_CARD_MM = [85.6, 53.98];
// The flat sheet's long side at most, in pixels: plenty to trace, quick to clean.
const LB_SIDE = 2000;
const LB_KEY = 'refboard.lightbox.v1';
const LB_CORNERS = ['Top left', 'Top right', 'Bottom right', 'Bottom left'];

const lb = {
  img: null, corners: null, stage: 'empty', flat: null, ratio: null, mm: null,
  pan: [0, 0], rot: 0, locked: false, wake: null, fromFile: false,
  opts: { paper: 'a4', widthCm: 21, mode: 'clean', lines: 0.5, mirror: false, size: 'fit', pxPerMm: 0 },
};

function lbLoadOpts() {
  try { Object.assign(lb.opts, JSON.parse(localStorage.getItem(LB_KEY)) || {}); } catch { /* defaults */ }
  if (!LB_PAPERS[lb.opts.paper]) lb.opts.paper = 'a4';
}
function lbSaveOpts() {
  try { localStorage.setItem(LB_KEY, JSON.stringify(lb.opts)); } catch { /* private mode: this visit only */ }
}

/* ---- the sheet in the photo */

/* Its four corners, TL TR BR BL, in the image's pixels: the biggest light
   shape (above Otsu's split of the lightness), its corners the points
   furthest out along the diagonals. Where there is no such shape - the
   picture is all sheet, or a digital image - the image's own corners. */
function lbDetectCorners(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const k = Math.min(1, 256 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  const whole = [[0, 0], [W, 0], [W, H], [0, H]];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]) / 2.55;
  const t = stepsOtsu(L);
  const light = Uint8Array.from(L, v => v > t ? 1 : 0), seen = new Uint8Array(w * h);
  let best = null;
  for (let s = 0; s < w * h; s++) {
    if (!light[s] || seen[s]) continue;
    const part = [s], stack = [s]; seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w;
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && light[j] && !seen[j]) { seen[j] = 1; stack.push(j); part.push(j); }
    }
    if (!best || part.length > best.length) best = part;
  }
  // A sheet is most of the photo but not all of it, and has something dark
  // round it - the table.
  if (!best || best.length < 0.15 * w * h || best.length > 0.97 * w * h) return whole;
  let tl = Infinity, br = -Infinity, tr = -Infinity, bl = Infinity, P = [];
  for (const i of best) {
    const x = i % w + 0.5, y = ((i / w) | 0) + 0.5;
    if (x + y < tl) { tl = x + y; P[0] = [x, y]; }
    if (x - y > tr) { tr = x - y; P[1] = [x, y]; }
    if (x + y > br) { br = x + y; P[2] = [x, y]; }
    if (x - y < bl) { bl = x - y; P[3] = [x, y]; }
  }
  // A pixel in, towards the middle: at this size an edge pixel is part
  // table, and the table's dark would run round the flat sheet as a border.
  const cx = P.reduce((a, p) => a + p[0], 0) / 4, cy = P.reduce((a, p) => a + p[1], 0) / 4;
  const quad = P.map(([x, y]) => {
    const d = Math.hypot(cx - x, cy - y) || 1;
    return [(x + (cx - x) * 1.5 / d) / k, (y + (cy - y) * 1.5 / d) / k];
  });
  return lbArea(quad) > 0.12 * W * H ? quad : whole;
}

// A quad's area (the shoelace formula) - small, or folded, is no sheet.
function lbArea(q) {
  let a = 0;
  for (let i = 0; i < 4; i++) { const [x0, y0] = q[i], [x1, y1] = q[(i + 1) % 4]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

/* The unit square onto the quad TL TR BR BL (Heckbert's closed form): for
   a point (u, v) of the flat sheet, 0 to 1 each way, where it is in the
   photo. */
function lbSquareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return (u, v) => { const z = g * u + h * v + 1; return [(a * u + b * v + x0) / z, (d * u + e * v + y0) / z]; };
}

// How wide and tall the quad is, as the mean of its opposite sides.
function lbQuadSize(q) {
  const len = (p, r) => Math.hypot(r[0] - p[0], r[1] - p[1]);
  return [(len(q[0], q[1]) + len(q[3], q[2])) / 2, (len(q[0], q[3]) + len(q[1], q[2])) / 2];
}

/* The sheet's size in mm, the way round the photo has it: a named paper
   turned to match, or the width you gave with the photo's own shape. A
   picture that is not a photo of a sheet keeps its shape, fitted in the
   paper. */
function lbPaperMm(q = lb.corners) {
  const [qw, qh] = lbQuadSize(q), p = LB_PAPERS[lb.opts.paper];
  if (!p.mm) { const w = lb.opts.widthCm * 10; return [w, w * qh / qw]; }
  const [pw, ph] = qw > qh ? [p.mm[1], p.mm[0]] : p.mm;
  if (lb.fromFile) return [pw, ph];
  // A reference is not a sheet: kept its own shape, as big as fits the paper.
  const k = Math.min(pw / qw, ph / qh);
  return [qw * k, qh * k];
}

/* The flat sheet: every pixel looked up in the photo, bilinear. Its shape
   is the paper's; its size the photo's own detail, up to LB_SIDE. */
function lbFlatten(img, q, mm) {
  const [qw, qh] = lbQuadSize(q), side = Math.min(LB_SIDE, Math.max(64, Math.round(Math.max(qw, qh))));
  const W = mm[0] >= mm[1] ? side : Math.round(side * mm[0] / mm[1]);
  const H = mm[0] >= mm[1] ? Math.round(side * mm[1] / mm[0]) : side;
  const IW = img.naturalWidth || img.width, IH = img.naturalHeight || img.height;
  const src = document.createElement('canvas');
  src.width = IW; src.height = IH;
  const sg = src.getContext('2d', { willReadFrequently: true });
  sg.drawImage(img, 0, 0);
  const s = sg.getImageData(0, 0, IW, IH).data;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const og = out.getContext('2d'), o = og.createImageData(W, H), od = o.data;
  const map = lbSquareToQuad(q);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let [fx, fy] = map((x + 0.5) / W, (y + 0.5) / H);
      fx = Math.min(IW - 1.001, Math.max(0, fx - 0.5)); fy = Math.min(IH - 1.001, Math.max(0, fy - 0.5));
      const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0;
      const i00 = 4 * (y0 * IW + x0), i10 = i00 + 4, i01 = i00 + 4 * IW, i11 = i01 + 4, j = 4 * (y * W + x);
      for (let c = 0; c < 3; c++)
        od[j + c] = (s[i00 + c] * (1 - ax) + s[i10 + c] * ax) * (1 - ay) + (s[i01 + c] * (1 - ax) + s[i11 + c] * ax) * ay;
      od[j + 3] = 255;
    }
  }
  og.putImageData(o, 0, 0);
  return out;
}

/* ---- the paper made white */

/* The paper's own colour at every pixel: in blocks, the mean of each
   block's lightest pixels (a line covers little of a block); then each
   block the lightest of it and its neighbours - one a line filled all but
   gives way to the paper beside it - smoothed, and spread back over the
   pixels bilinearly. A shadow across the sheet, a warm lamp at one end:
   the paper under each is that paper's colour. */
function lbPaper(d, W, H) {
  const B = Math.max(8, Math.round(Math.max(W, H) / 32)), gw = Math.ceil(W / B), gh = Math.ceil(H / B);
  const blk = new Float32Array(gw * gh * 4);   // r, g, b, luma
  const hist = new Uint32Array(256);
  for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
    hist.fill(0);
    let n = 0;
    const x1 = Math.min(W, (bx + 1) * B), y1 = Math.min(H, (by + 1) * B);
    for (let y = by * B; y < y1; y++) for (let x = bx * B; x < x1; x++) {
      const i = 4 * (y * W + x);
      hist[(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0]++; n++;
    }
    // The lightest fifth, down from the top.
    let cut = 255;
    for (let acc = 0; cut > 0 && (acc += hist[cut]) < n * 0.2; cut--);
    let r = 0, g = 0, b = 0, m = 0;
    for (let y = by * B; y < y1; y++) for (let x = bx * B; x < x1; x++) {
      const i = 4 * (y * W + x);
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < cut) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; m++;
    }
    const k = 4 * (by * gw + bx);
    blk[k] = r / m; blk[k + 1] = g / m; blk[k + 2] = b / m; blk[k + 3] = 0.299 * blk[k] + 0.587 * blk[k + 1] + 0.114 * blk[k + 2];
  }
  const near = (a, pick) => {
    const out = new Float32Array(a.length);
    for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
      const o = 4 * (by * gw + bx);
      let best = -1, acc = [0, 0, 0, 0], n = 0;
      for (let yy = Math.max(0, by - 1); yy <= Math.min(gh - 1, by + 1); yy++)
        for (let xx = Math.max(0, bx - 1); xx <= Math.min(gw - 1, bx + 1); xx++) {
          const k = 4 * (yy * gw + xx);
          if (pick) { if (a[k + 3] > best) { best = a[k + 3]; for (let c = 0; c < 4; c++) out[o + c] = a[k + c]; } }
          else { for (let c = 0; c < 4; c++) acc[c] += a[k + c]; n++; }
        }
      if (!pick) for (let c = 0; c < 4; c++) out[o + c] = acc[c] / n;
    }
    return out;
  };
  const grid = near(near(blk, true), false);
  // Spread over the pixels, from the blocks' centres.
  const bg = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = Math.min(gh - 2, fy | 0), ay = gh > 1 ? fy - y0 : 0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / B - 0.5)), x0 = Math.min(gw - 2, fx | 0), ax = gw > 1 ? fx - x0 : 0;
      const k00 = 4 * (Math.max(0, y0) * gw + Math.max(0, x0)), k10 = gw > 1 ? k00 + 4 : k00, k01 = gh > 1 ? k00 + 4 * gw : k00, k11 = gh > 1 ? k10 + 4 * gw : k10;
      for (let c = 0; c < 3; c++)
        bg[3 * (y * W + x) + c] = (grid[k00 + c] * (1 - ax) + grid[k10 + c] * ax) * (1 - ay) + (grid[k01 + c] * (1 - ax) + grid[k11 + c] * ax) * ay;
    }
  }
  return bg;
}

/* Each pixel over the paper's colour there, per channel, 255 being the
   paper - and a fourth, the darkest of the three. Once per sheet: the
   slider below only looks these up. */
function lbRatio(flat, bg) {
  const W = flat.width, H = flat.height;
  const d = flat.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let p = 0, n = W * H; p < n; p++) {
    const r = 255 * d[4 * p] / Math.max(1, bg[3 * p]), g = 255 * d[4 * p + 1] / Math.max(1, bg[3 * p + 1]), b = 255 * d[4 * p + 2] / Math.max(1, bg[3 * p + 2]);
    out[4 * p] = r; out[4 * p + 1] = g; out[4 * p + 2] = b; out[4 * p + 3] = Math.min(r, g, b);
  }
  return out;
}

/* The flat sheet as it is shown:
   - photo: as it is;
   - clean: over the paper's colour, so the paper is white; what is within
     12% of it goes white too (the paper's grain), and the rest is pressed
     darker by `lines` (0 to 1) - a pencil line through thick watercolour
     paper wants to be darker than it was drawn;
   - dark: the same, but each pixel the darkest of its channels, in grey -
     a blue or red pencil line as dark as graphite.
   Returns ImageData the flat sheet's size. */
function lbRender(flat, ratio, mode, lines) {
  const W = flat.width, H = flat.height;
  if (mode === 'photo') return flat.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
  const img = new ImageData(W, H), d = img.data, gamma = 1 + 2.5 * lines, curve = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) curve[i] = 255 * Math.min(1, i / 255 / 0.88) ** gamma;
  for (let i = 0, n = W * H * 4; i < n; i += 4) {
    if (mode === 'dark') d[i] = d[i + 1] = d[i + 2] = curve[ratio[i + 3]];
    else { d[i] = curve[ratio[i]]; d[i + 1] = curve[ratio[i + 1]]; d[i + 2] = curve[ratio[i + 2]]; }
    d[i + 3] = 255;
  }
  return img;
}

/* ---- on the screen */

function lbDraw() {
  const c = el('lbCanvas');
  c.width = lb.flat.width; c.height = lb.flat.height;
  c.getContext('2d').putImageData(lbRender(lb.flat, lb.ratio, lb.opts.mode, lb.opts.lines), 0, 0);
  lbPlace();
}

// The sheet's size on the screen, in CSS pixels, before any turn: fitted
// to the screen, or as big as the paper - see lbCalibrate().
function lbShownSize() {
  const mm = lb.mm, turned = lb.rot % 180 !== 0, box = el('lbStage').getBoundingClientRect();
  if (lb.opts.size === 'real' && lb.opts.pxPerMm) return [mm[0] * lb.opts.pxPerMm, mm[1] * lb.opts.pxPerMm];
  const [w, h] = turned ? [mm[1], mm[0]] : mm, k = Math.min(box.width / w, box.height / h);
  return [mm[0] * k, mm[1] * k];
}

function lbPlace() {
  const c = el('lbCanvas'), [w, h] = lbShownSize();
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  c.style.transform = `translate(-50%, -50%) translate(${lb.pan[0]}px, ${lb.pan[1]}px) rotate(${lb.rot}deg)${lb.opts.mirror ? ' scaleX(-1)' : ''}`;
  const real = lb.opts.size === 'real' && lb.opts.pxPerMm;
  el('lbSizeNote').textContent = real
    ? `${Math.round(lb.mm[0]) / 10} x ${Math.round(lb.mm[1]) / 10} cm, as on the paper${lbBiggerThanScreen() ? ' - bigger than the screen: trace a part, unlock, drag to the next' : ''}`
    : 'Fitted to the screen';
}

function lbBiggerThanScreen() {
  const [w, h] = lbShownSize(), box = el('lbStage').getBoundingClientRect(), t = lb.rot % 180 !== 0;
  return (t ? h : w) > box.width + 1 || (t ? w : h) > box.height + 1;
}

/* ---- the stages: empty, corners, view, calibrate */

function lbShow(stage) {
  lb.stage = stage;
  const box = el('lightbox');
  box.dataset.stage = stage;
  el('lbEmpty').hidden = stage !== 'empty';
  el('lbCornersBar').hidden = stage !== 'corners';
  el('lbViewBar').hidden = stage !== 'view';
  el('lbCalBar').hidden = stage !== 'calibrate';
  el('lbCanvas').hidden = stage !== 'view';
  el('lbPhoto').hidden = el('lbHandles').hidden = stage !== 'corners';
  el('lbCard').hidden = stage !== 'calibrate';
  if (stage === 'corners') lbDrawCorners();
  if (stage === 'view') lbSyncView();
  if (stage === 'calibrate') lbDrawCard();
}

// The photo fitted to the screen, the quad over it, and the four handles
// where its corners are - buttons, so the keyboard can move them too.
function lbPhotoFit() {
  const box = el('lbStage').getBoundingClientRect(), W = lb.img.naturalWidth, H = lb.img.naturalHeight;
  const k = Math.min((box.width - 48) / W, (box.height - 48) / H);
  return { k, x: (box.width - W * k) / 2, y: (box.height - H * k) / 2, w: W * k, h: H * k };
}

function lbDrawCorners() {
  const f = lbPhotoFit(), c = el('lbPhoto'), dpr = window.devicePixelRatio || 1, box = el('lbStage').getBoundingClientRect();
  c.width = Math.round(box.width * dpr); c.height = Math.round(box.height * dpr);
  c.style.width = `${box.width}px`; c.style.height = `${box.height}px`;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#111'; g.fillRect(0, 0, box.width, box.height);
  g.drawImage(lb.img, f.x, f.y, f.w, f.h);
  const pts = lb.corners.map(([x, y]) => [f.x + x * f.k, f.y + y * f.k]);
  // Outside the sheet dimmed, the sheet's edge drawn.
  g.save();
  g.beginPath(); g.rect(0, 0, box.width, box.height);
  pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fillStyle = 'rgb(0 0 0 / .55)'; g.fill('evenodd');
  g.restore();
  g.strokeStyle = '#f5c2e7'; g.lineWidth = 2;
  g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
  el('lbHandles').querySelectorAll('button').forEach((b, i) => {
    b.style.left = `${pts[i][0]}px`; b.style.top = `${pts[i][1]}px`;
  });
  const mm = lbPaperMm();
  el('lbCornersNote').textContent = lb.opts.paper === 'custom'
    ? `${Math.round(mm[0]) / 10} x ${Math.round(mm[1]) / 10} cm, its shape from the corners`
    : `${lb.fromFile ? '' : 'Fitted in '}${LB_PAPERS[lb.opts.paper].label}, ${mm[0] > mm[1] ? 'landscape' : 'portrait'}`;
}

function lbCornersDone() {
  lb.mm = lbPaperMm();
  lb.flat = lbFlatten(lb.img, lb.corners, lb.mm);
  const f = lb.flat;
  lb.ratio = lbRatio(f, lbPaper(f.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, f.width, f.height).data, f.width, f.height));
  lb.pan = [0, 0];
  // Its long side along the screen's: a landscape sheet on an upright tablet
  // turned, rather than shown a third of the size. Turn puts it back.
  const box = el('lbStage').getBoundingClientRect();
  lb.rot = (lb.mm[0] > lb.mm[1]) !== (box.width > box.height) ? 90 : 0;
  lbShow('view');
  lbDraw();
  el('lbLock').focus();
}

function lbSyncView() {
  for (const b of el('lbMode').querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === lb.opts.mode));
  for (const b of el('lbSize').querySelectorAll('[data-size]')) b.setAttribute('aria-pressed', String(b.dataset.size === lb.opts.size));
  el('lbMirror').setAttribute('aria-pressed', String(lb.opts.mirror));
  el('lbLines').value = String(Math.round(lb.opts.lines * 100));
  el('lbLinesWrap').hidden = lb.opts.mode === 'photo';
}

/* ---- the screen measured: a card's outline, made as wide as a real card
   held against the glass. Pixels per mm are kept - for this screen, at
   this browser zoom. */
function lbDrawCard() {
  const w = Number(el('lbCardW').value), c = el('lbCard');
  c.style.width = `${w}px`; c.style.height = `${w * LB_CARD_MM[1] / LB_CARD_MM[0]}px`;
}

function lbCalibrate() {
  el('lbCardW').value = String(Math.round((lb.opts.pxPerMm || 3.78) * LB_CARD_MM[0]));
  lbShow('calibrate');
  el('lbCardW').focus();
}

function lbCalibrated(save) {
  if (save) {
    lb.opts.pxPerMm = Number(el('lbCardW').value) / LB_CARD_MM[0];
    lb.opts.size = 'real';
    lbSaveOpts();
  }
  lbShow(lb.flat ? 'view' : 'empty');
  if (lb.flat) { lb.pan = [0, 0]; lbPlace(); el('lbCalibrate').focus(); }
}

/* ---- locked while tracing: the bar gone and every touch ignored, but
   for a small button held down to unlock - a palm on the glass only taps. */
let lbHold = 0;
function lbLock(on) {
  lb.locked = on;
  el('lightbox').classList.toggle('locked', on);
  el('lbUnlock').hidden = !on;
  if (on) { el('lbUnlock').focus(); announce('Locked. Hold the lock button to unlock.'); }
  else { clearTimeout(lbHold); el('lbUnlock').classList.remove('holding'); el('lbLock').focus(); }
}

/* ---- the screen kept on: a lightbox that dims after a minute is no use.
   The Wake Lock is let go when the page is hidden, so asked for again. */
async function lbWake() {
  if (!('wakeLock' in navigator) || el('lightbox').classList.contains('hidden')) return;
  try { lb.wake = await navigator.wakeLock.request('screen'); } catch { lb.wake = null; }
}

/* ---- open and close */

/* With a picture's URL: onto the lightbox as it is (a reference is not a
   photo of a sheet; its corners can still be moved). Without: asks for a
   photo of the sketch. */
async function openLightbox(src) {
  lbLoadOpts();
  el('lightbox').classList.remove('hidden');
  dialogOpened(el('lightbox'));
  el('lightbox').requestFullscreen?.().catch(() => { /* not allowed here: the window will do */ });
  lbWake();
  lb.img = null; lb.flat = null;
  if (!src) { lbShow('empty'); el('lbPick').focus(); return; }
  await lbUse(src, false);
}

async function lbUse(src, fromFile) {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { announce('That picture could not be read.'); lbShow('empty'); return; }
  lb.img = img; lb.fromFile = fromFile;
  lb.corners = fromFile ? lbDetectCorners(img) : [[0, 0], [img.naturalWidth, 0], [img.naturalWidth, img.naturalHeight], [0, img.naturalHeight]];
  // A reference has no paper size: A4 is only where it starts.
  if (fromFile) { lbShow('corners'); el('lbCornersDone').focus(); }
  else lbCornersDone();
}

function closeLightbox() {
  if (lb.locked) lbLock(false);
  el('lightbox').classList.add('hidden');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  lb.wake?.release().catch(() => {});
  lb.wake = null; lb.img = null; lb.flat = null; lb.ratio = null;
  dialogClosed(el('lightbox'));
}

function initLightbox() {
  lbLoadOpts();
  el('lbPaper').innerHTML = Object.entries(LB_PAPERS).map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join('');
  el('lbHandles').innerHTML = LB_CORNERS.map((n, i) =>
    `<button type="button" data-corner="${i}" aria-label="${n} corner - arrow keys move it" title="${n} corner"></button>`).join('');
  el('btnLightbox').addEventListener('click', () => openLightbox());
  el('lbPick').addEventListener('click', () => el('lbInput').click());
  el('lbOther').addEventListener('click', () => el('lbInput').click());
  el('lbInput').addEventListener('change', () => {
    const f = el('lbInput').files[0];
    el('lbInput').value = '';
    if (f) lbUse(URL.createObjectURL(f), true);
  });
  // A photo dropped anywhere on it, as well.
  el('lightbox').addEventListener('dragover', e => e.preventDefault());
  el('lightbox').addEventListener('drop', e => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (f && !lb.locked) lbUse(URL.createObjectURL(f), true);
  });
  for (const id of ['lbClose', 'lbEmptyClose', 'lbCornersClose']) el(id).addEventListener('click', closeLightbox);

  // Corners: dragged, or moved with the arrows (Shift for bigger steps).
  let drag = null;
  el('lbHandles').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-corner]');
    if (!b) return;
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    drag = Number(b.dataset.corner);
    b.focus();
  });
  el('lbHandles').addEventListener('pointermove', e => {
    if (drag === null) return;
    const f = lbPhotoFit(), r = el('lbStage').getBoundingClientRect();
    const x = Math.min(lb.img.naturalWidth, Math.max(0, (e.clientX - r.left - f.x) / f.k));
    const y = Math.min(lb.img.naturalHeight, Math.max(0, (e.clientY - r.top - f.y) / f.k));
    lb.corners[drag] = [x, y];
    lbDrawCorners();
  });
  const endDrag = () => { drag = null; };
  el('lbHandles').addEventListener('pointerup', endDrag);
  el('lbHandles').addEventListener('pointercancel', endDrag);
  el('lbHandles').addEventListener('keydown', e => {
    const b = e.target.closest('[data-corner]'), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!b || !d) return;
    e.preventDefault();
    const i = Number(b.dataset.corner), step = Math.max(lb.img.naturalWidth, lb.img.naturalHeight) * (e.shiftKey ? 0.02 : 0.004);
    lb.corners[i] = [Math.min(lb.img.naturalWidth, Math.max(0, lb.corners[i][0] + d[0] * step)),
      Math.min(lb.img.naturalHeight, Math.max(0, lb.corners[i][1] + d[1] * step))];
    lbDrawCorners();
  });
  el('lbPaper').value = lb.opts.paper;
  el('lbWidthCm').value = String(lb.opts.widthCm);
  el('lbWidthWrap').hidden = lb.opts.paper !== 'custom';
  el('lbPaper').addEventListener('change', () => {
    lb.opts.paper = el('lbPaper').value;
    el('lbWidthWrap').hidden = lb.opts.paper !== 'custom';
    lbSaveOpts(); lbDrawCorners();
  });
  el('lbWidthCm').addEventListener('input', () => {
    const v = Number(el('lbWidthCm').value);
    if (v > 0) { lb.opts.widthCm = v; lbSaveOpts(); lbDrawCorners(); }
  });
  el('lbWhole').addEventListener('click', () => {
    const W = lb.img.naturalWidth, H = lb.img.naturalHeight;
    lb.corners = [[0, 0], [W, 0], [W, H], [0, H]];
    lbDrawCorners();
  });
  el('lbCornersDone').addEventListener('click', lbCornersDone);

  // The view.
  el('lbMode').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    lb.opts.mode = b.dataset.mode; lbSaveOpts(); lbSyncView(); lbDraw();
  });
  el('lbLines').addEventListener('input', () => { lb.opts.lines = Number(el('lbLines').value) / 100; lbDraw(); });
  el('lbLines').addEventListener('change', lbSaveOpts);
  el('lbMirror').addEventListener('click', () => { lb.opts.mirror = !lb.opts.mirror; lbSaveOpts(); lbSyncView(); lbPlace(); });
  el('lbRotate').addEventListener('click', () => { lb.rot = (lb.rot + 90) % 360; lb.pan = [0, 0]; lbPlace(); });
  el('lbSize').addEventListener('click', e => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    // Real size needs the screen measured first.
    if (b.dataset.size === 'real' && !lb.opts.pxPerMm) { lbCalibrate(); return; }
    lb.opts.size = b.dataset.size; lb.pan = [0, 0]; lbSaveOpts(); lbSyncView(); lbPlace();
  });
  el('lbCalibrate').addEventListener('click', lbCalibrate);
  el('lbCorners').addEventListener('click', () => { lbShow('corners'); el('lbCornersDone').focus(); });
  el('lbLock').addEventListener('click', () => lbLock(true));
  el('lbCardW').addEventListener('input', lbDrawCard);
  el('lbCalSave').addEventListener('click', () => lbCalibrated(true));
  el('lbCalCancel').addEventListener('click', () => lbCalibrated(false));

  // The sheet dragged about - a sheet bigger than the screen is traced a
  // part at a time.
  let pan = null;
  el('lbCanvas').addEventListener('pointerdown', e => {
    if (lb.locked) return;
    el('lbCanvas').setPointerCapture(e.pointerId);
    pan = [e.clientX - lb.pan[0], e.clientY - lb.pan[1]];
  });
  el('lbCanvas').addEventListener('pointermove', e => { if (pan) { lb.pan = [e.clientX - pan[0], e.clientY - pan[1]]; lbPlace(); } });
  el('lbCanvas').addEventListener('pointerup', () => { pan = null; });
  el('lbCanvas').addEventListener('pointercancel', () => { pan = null; });

  // Unlock: held for a second - a tap is what a resting hand does.
  const holdStart = e => {
    e.preventDefault();
    el('lbUnlock').classList.add('holding');
    lbHold = setTimeout(() => lbLock(false), 1000);
  };
  const holdEnd = () => { clearTimeout(lbHold); el('lbUnlock').classList.remove('holding'); };
  el('lbUnlock').addEventListener('pointerdown', holdStart);
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el('lbUnlock').addEventListener(t, holdEnd);
  el('lightbox').addEventListener('contextmenu', e => { if (lb.locked) e.preventDefault(); });

  el('lightbox').addEventListener('keydown', e => {
    // Keys stay here: "f" must not flip the session's picture behind.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      // A keyboard is never a palm on the glass: Esc unlocks at once.
      if (lb.locked) lbLock(false);
      else if (lb.stage === 'calibrate') lbCalibrated(false);
      else closeLightbox();
      return;
    }
    if (lb.locked && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); lbLock(false); return; }
    if (lb.stage === 'view' && !lb.locked && !e.target.closest('input, select')) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d && !e.target.closest('button')) { e.preventDefault(); lb.pan = [lb.pan[0] - d[0] * 40, lb.pan[1] - d[1] * 40]; lbPlace(); }
    }
  });
  window.addEventListener('resize', () => {
    if (el('lightbox').classList.contains('hidden')) return;
    if (lb.stage === 'corners') lbDrawCorners();
    if (lb.stage === 'view') lbPlace();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lbWake(); });
}
initLightbox();
