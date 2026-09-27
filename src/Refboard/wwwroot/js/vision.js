/* refboard - The MediaPipe models: pose skeleton and Loomis head.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ------------------------------------------------------ pose skeleton
   A pose model (Google's MediaPipe pose landmarker) finds the figure's
   joints, and what is drawn from them is what a figure-drawing teacher
   would chalk over the photo - not the model's own stick figure:

   - The tilt of the shoulders and of the hips, and whether they tilt
     against each other - contrapposto, the weight shift that makes a
     standing figure look alive rather than propped up.
   - The line of action: one smooth curve from the head down the spine to
     the leg that carries the weight - the gesture to draw first.
   - The balance line: a plumb line down from the pit of the neck. On a
     figure at rest it lands on the foot that carries the weight; when it
     misses both feet, the figure is moving (or leaning on something).

   It runs in this browser. The first use downloads the model once (about
   6 MB from Google's model storage, and its runtime from the jsDelivr CDN)
   - like three.js, only when first asked for, so nothing else changes. The
   image itself is never sent anywhere: the model comes to it. */
const POSE_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
// BlazePose's 33 points: the ones used here.
const PL = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lToe: 31, rToe: 32 };
const POSE_BONES = [['lSh', 'rSh'], ['lSh', 'lEl'], ['lEl', 'lWr'], ['rSh', 'rEl'], ['rEl', 'rWr'], ['lSh', 'lHip'], ['rSh', 'rHip'],
  ['lHip', 'rHip'], ['lHip', 'lKn'], ['lKn', 'lAn'], ['rHip', 'rKn'], ['rKn', 'rAn'], ['lAn', 'lToe'], ['rAn', 'rToe']];
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// The MediaPipe tasks this page uses - one runtime, fetched once, shared by
// both; each model is fetched the first time its button is pressed.
const VISION_TASKS = {
  pose: { cls: 'PoseLandmarker', model: POSE_MODEL, opts: { numPoses: 2 } },
  face: { cls: 'FaceLandmarker', model: FACE_MODEL, opts: { numFaces: 4 } },
};
const visionModels = {}, visionLoading = {};
let poseRun = 0;

function loadVision(kind) {
  if (visionModels[kind]) return Promise.resolve(visionModels[kind]);
  if (!visionLoading[kind]) {
    const t = VISION_TASKS[kind];
    visionLoading[kind] = (async () => {
      const lib = await import(`${POSE_LIB}/vision_bundle.mjs`);
      const files = await lib.FilesetResolver.forVisionTasks(`${POSE_LIB}/wasm`);
      const make = delegate => lib[t.cls].createFromOptions(files, {
        baseOptions: { modelAssetPath: t.model, delegate }, runningMode: 'IMAGE', ...t.opts });
      // The GPU path is faster but not every browser can give it a context.
      try { visionModels[kind] = await make('GPU'); } catch { visionModels[kind] = await make('CPU'); }
      return visionModels[kind];
    })();
    visionLoading[kind].catch(() => { visionLoading[kind] = null; });
  }
  return visionLoading[kind];
}

// The one note box is shared: the head's note above the pose's when both
// are on.
const overlayNotes = { head: '', pose: '' };
function overlayNote(key, html) {
  overlayNotes[key] = html || '';
  const all = [overlayNotes.head, overlayNotes.pose].filter(Boolean).join('<hr>');
  el('poseNote').classList.toggle('hidden', !all);
  el('poseNote').innerHTML = all;
}
const poseNote = html => overlayNote('pose', html);
function clearPose() {
  poseRun++;
  el('poseOverlay').classList.add('hidden');
  el('poseOverlay').innerHTML = '';
  poseNote(state.poseOn ? 'Finding the pose...' : '');
}

function togglePose() {
  state.poseOn = !state.poseOn;
  el('btnPose').setAttribute('aria-pressed', String(state.poseOn));
  if (state.poseOn) runPose(); else clearPose();
}

async function runPose() {
  const img = el('img'), run = ++poseRun;
  if (!img.naturalWidth) return;
  if (!visionModels.pose) poseNote('Loading the pose model - about 6 MB, once. The image stays in this browser.');
  let model;
  try { model = await loadVision('pose'); }
  catch (err) {
    console.error('pose model:', err);
    poseNote('<i>The pose model could not load</i> - it needs a connection the first time, and WebAssembly.');
    return;
  }
  if (run !== poseRun || !state.poseOn) return;   // the pose changed while it loaded
  let res;
  try { res = model.detect(img); }
  catch (err) { console.error('pose detect:', err); poseNote('<i>Could not read a pose from this image.</i>'); return; }
  drawPose(res.landmarks || []);
}

// A smooth curve through the points (Catmull-Rom, as cubic Beziers).
function smoothPath(pts) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function drawPose(poses) {
  const img = el('img'), svg = el('poseOverlay');
  const W = img.naturalWidth, H = img.naturalHeight, flip = img.classList.contains('flip');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!poses.length) { svg.innerHTML = ''; poseNote('No figure found in this image.'); return; }
  let m = '', note = '';
  const fr = n => n.toFixed(1);
  poses.forEach((lm, pi) => {
    // Image pixels, mirrored when the image is shown flipped; null when the
    // model is not confident the joint is in view.
    const P = {};
    for (const [k, i] of Object.entries(PL)) {
      const p = lm[i];
      P[k] = p && (p.visibility === undefined || p.visibility > 0.5) ? [flip ? (1 - p.x) * W : p.x * W, p.y * H] : null;
    }
    const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
    const line = (a, b, cls) => `<line class="${cls}" x1="${fr(a[0])}" y1="${fr(a[1])}" x2="${fr(b[0])}" y2="${fr(b[1])}"/>`;
    for (const [a, b] of POSE_BONES) if (P[a] && P[b]) m += line(P[a], P[b], 'bone-o') + line(P[a], P[b], 'bone');
    const neck = mid(P.lSh, P.rSh), pelvis = mid(P.lHip, P.rHip);
    const torso = neck && pelvis ? Math.hypot(neck[0] - pelvis[0], neck[1] - pelvis[1]) : H / 4;

    // Tilt, as it reads on screen: positive rises to the right.
    const tilt = (a, b) => { const [l, r] = a[0] <= b[0] ? [a, b] : [b, a]; return Math.atan2(l[1] - r[1], r[0] - l[0]) * 180 / Math.PI; };
    const ext = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], k = 0.25; return [[a[0] - dx * k, a[1] - dy * k], [b[0] + dx * k, b[1] + dy * k]]; };
    let ts = null, th = null;
    if (P.lSh && P.rSh) { ts = tilt(P.lSh, P.rSh); m += line(...ext(P.lSh, P.rSh), 'tilt'); }
    if (P.lHip && P.rHip) { th = tilt(P.lHip, P.rHip); m += line(...ext(P.lHip, P.rHip), 'tilt'); }

    // Which foot carries the weight: the one under the pit of the neck.
    let support = null, balance = '';
    if (neck && (P.lAn || P.rAn)) {
      const ys = [P.lAn, P.rAn].filter(Boolean).map(p => p[1]);
      m += line(neck, [neck[0], Math.max(...ys) + torso * 0.1], 'plumb');
      if (P.lAn && P.rAn) {
        const lo = Math.min(P.lAn[0], P.rAn[0]), hi = Math.max(P.lAn[0], P.rAn[0]), span = hi - lo, slack = torso * 0.12;
        const dl = Math.abs(neck[0] - P.lAn[0]), dr = Math.abs(neck[0] - P.rAn[0]);
        if (neck[0] < lo - slack || neck[0] > hi + slack) balance = 'The balance line misses both feet - the figure is <u>moving</u>, or leaning on something.';
        else if (span < torso * 0.25) { balance = 'Both feet under the body - the weight is <u>shared</u>.'; support = mid(P.lAn, P.rAn); }
        else if (Math.min(dl, dr) < span * 0.3) {
          // Named by the side of the PICTURE it is on, not the figure's own
          // left or right: that needs to know which way the figure faces,
          // which the model can get wrong (a back view, a faceless
          // mannequin), while where the foot is on the page is never in doubt.
          support = dl < dr ? P.lAn : P.rAn;
          const other = dl < dr ? P.rAn : P.lAn;
          balance = `The weight is on the <u>foot to the ${support[0] < other[0] ? 'left' : 'right'}</u> in the picture - the balance line lands on it.`;
        } else { balance = 'The weight falls <u>between the feet</u>.'; support = mid(P.lAn, P.rAn); }
      } else support = P.lAn || P.rAn;
    }

    // The line of action: head, pit of the neck, pelvis, supporting foot.
    const spine = [P.nose, neck, pelvis, support].filter(Boolean);
    if (spine.length >= 3) m += `<path class="action" d="${smoothPath(spine.map(p => p.map(v => +v.toFixed(1))))}"/>`;
    for (const k of Object.keys(PL)) if (P[k] && k !== 'nose') m += `<circle cx="${fr(P[k][0])}" cy="${fr(P[k][1])}" r="${fr(W / 220)}"/>`;

    if (pi === 0) {
      const deg = a => `${Math.abs(a).toFixed(0)}°`;
      const parts = [];
      if (ts !== null) parts.push(`<b>Shoulders</b> ${Math.abs(ts) < 2 ? 'level' : deg(ts)}`);
      if (th !== null) parts.push(`<b>hips</b> ${Math.abs(th) < 2 ? 'level' : deg(th)}`);
      let rel = '';
      if (ts !== null && th !== null && Math.abs(ts) >= 2 && Math.abs(th) >= 2) {
        rel = Math.sign(ts) !== Math.sign(th)
          ? ' - tilted against each other: <b>contrapposto</b>, the weight shifted onto one leg.'
          : ' - tilted the same way: the whole body leans.';
      } else if (ts !== null && th !== null) rel = '.';
      note = `${parts.join(', ')}${rel}` + (balance ? `<br>${balance}` : '') +
        `<br><i>Red</i>: the line of action - draw it first. <u>Blue</u>: the balance line.` +
        (poses.length > 1 ? ` (${poses.length} figures; this is about the first.)` : '');
    }
  });
  svg.innerHTML = m;
  svg.classList.remove('hidden');
  positionGrid();
  poseNote(note);
}

el('btnPose').addEventListener('click', togglePose);

/* ------------------------------------------------------ Loomis head
   Andrew Loomis's construction, the one most portrait courses start from,
   fitted to each face in the picture:

   - the cranium is a ball; its sides are sliced off flat, and the slice -
     the side plane - is a circle, where the ear sits just behind the middle;
   - the face hangs off the front of the ball in three equal parts: hairline
     to brow, brow to the base of the nose, nose to chin. The side circle
     runs from the hairline to the nose line, so brow line is its middle;
   - a centre line runs over the ball and down the face.

   A face model (MediaPipe's face landmarker - 478 points, each with a depth)
   finds the face; from four of its points comes which way the head is
   turned, as three axes: across (outer corner of one eye to the other), up
   (chin to forehead, made square to across) and forward (square to both).
   Where the ball sits and how big it is come from matching three points of
   the construction to the model's: the brow, the base of the nose and the
   chin. Everything else is then drawn in the head's own frame and turned
   with it - so a head seen from below gets its lines arching up, the far
   side plane disappears on a three-quarter view, and so on.

   The model's depth is in the same units as its x (a fraction of the image
   width), which is what lets its points be treated as a 3D shape at all.
   Projection is flat (no perspective), right for a head, which is small
   against its distance from the camera. */
// Loomis's proportions, in units of the ball's radius: one third of the
// face - the side circle's radius, its diameter two thirds of the ball's -
// and how far out the side planes are cut (where a sphere of radius 1 is a
// circle of radius U - Pythagoras). That puts the side planes about as far
// apart as the cheekbones, which is where Loomis has them.
const LOOMIS_U = 2 / 3, LOOMIS_SIDE = Math.sqrt(1 - LOOMIS_U * LOOMIS_U);
// Face-mesh points: between the brows, base of the nose, chin, the outer
// corners of the eyes (the face's right and left), top of the forehead.
const FM = { brow: 9, nose: 2, chin: 152, rEye: 33, lEye: 263, top: 10 };
let headRun = 0;

function clearHead() {
  headRun++;
  el('headOverlay').classList.add('hidden');
  el('headOverlay').innerHTML = '';
  overlayNote('head', state.headOn ? 'Finding the head...' : '');
}

function toggleHead() {
  state.headOn = !state.headOn;
  el('btnHead').setAttribute('aria-pressed', String(state.headOn));
  if (state.headOn) runHead(); else clearHead();
}

async function runHead() {
  const img = el('img'), run = ++headRun;
  if (!img.naturalWidth) return;
  if (!visionModels.face) overlayNote('head', 'Loading the face model - about 4 MB, once. The image stays in this browser.');
  let model;
  try { model = await loadVision('face'); }
  catch (err) {
    console.error('face model:', err);
    overlayNote('head', '<i>The face model could not load</i> - it needs a connection the first time, and WebAssembly.');
    return;
  }
  if (run !== headRun || !state.headOn) return;
  let faces;
  try { faces = detectFaces(model, img); }
  catch (err) { console.error('face detect:', err); overlayNote('head', '<i>Could not read a face from this image.</i>'); return; }
  drawHead(faces);
}

/* The face detector looks for a face with some room round it, so a tight
   portrait crop - the face filling the frame, the commonest reference of
   all - often finds nothing. Then it tries again on a copy with a grey
   margin added, and moves the points back onto the photo: x and y out of
   the bigger canvas's fractions, and depth, which is in units of the
   canvas's width, rescaled to the photo's. */
function detectFaces(model, img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  for (const pad of [0, 0.3, 0.6]) {
    let src = img;
    if (pad) {
      src = document.createElement('canvas');
      src.width = Math.round(W * (1 + 2 * pad)); src.height = Math.round(H * (1 + 2 * pad));
      const g = src.getContext('2d');
      g.fillStyle = '#808080'; g.fillRect(0, 0, src.width, src.height);
      g.drawImage(img, W * pad, H * pad);
    }
    const found = model.detect(src).faceLandmarks || [];
    if (found.length) {
      const kx = src.width / W, ky = src.height / H;
      return found.map(lm => lm.map(p => ({ x: p.x * kx - pad, y: p.y * ky - pad, z: p.z * kx })));
    }
  }
  return [];
}

const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  norm: a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

/* The head's frame from its landmarks, in image pixels with y down and depth
   away from the camera: X across (toward the face's own left), Y up, Z out of
   the face; C the ball's centre and s its radius in pixels. */
function headFrame(lm, W, H) {
  const P = i => [lm[i].x * W, lm[i].y * H, lm[i].z * W];
  const X = v3.norm(v3.sub(P(FM.lEye), P(FM.rEye)));
  const up = v3.sub(P(FM.top), P(FM.chin));
  const Y = v3.norm(v3.sub(up, v3.scale(X, v3.dot(up, X))));
  // Across x up points toward the camera here (y is down, depth is away).
  const Z = v3.cross(X, Y);
  const U = LOOMIS_U;
  // Brow to chin is two thirds of the face: that sets the size.
  const s = v3.dot(v3.sub(P(FM.brow), P(FM.chin)), Y) / (2 * U);
  // And these three, placed on the construction, set where the ball is -
  // averaged, so no one point's error decides it.
  const pairs = [[FM.brow, [0, 0, 1]], [FM.nose, [0, -U, 1]], [FM.chin, [0, -2 * U, 0.88]]];
  const C = [0, 0, 0];
  for (const [i, m] of pairs) {
    const w = v3.sub(P(i), v3.scale([
      m[0] * X[0] + m[1] * Y[0] + m[2] * Z[0],
      m[0] * X[1] + m[1] * Y[1] + m[2] * Z[1],
      m[0] * X[2] + m[1] * Y[2] + m[2] * Z[2]], s));
    for (let k = 0; k < 3; k++) C[k] += w[k] / pairs.length;
  }
  return { X, Y, Z, C, s };
}

function drawHead(faces) {
  const img = el('img'), svg = el('headOverlay');
  const W = img.naturalWidth, H = img.naturalHeight, flip = img.classList.contains('flip');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  if (!faces.length) {
    svg.innerHTML = '';
    overlayNote('head', 'No face found - it needs to be fairly large in the picture, and not turned fully away.');
    return;
  }
  const U = LOOMIS_U, S = LOOMIS_SIDE, fr = n => n.toFixed(1);
  let m = '', note = '';
  faces.forEach((lm, fi) => {
    const f = headFrame(lm, W, H);
    const world = p => [0, 1, 2].map(k => p[0] * f.X[k] + p[1] * f.Y[k] + p[2] * f.Z[k]);
    const at = p => { const w = world(p), x = f.C[0] + w[0] * f.s; return [flip ? W - x : x, f.C[1] + w[1] * f.s]; };
    // Facing the camera when its normal points toward it (depth decreasing).
    const seen = n => world(n)[2] < 0;
    // A curve p(t), split into the runs that face the camera and those that
    // do not; `normal` defaults to the point itself - right on the ball.
    const curve = (cls, p, t0, t1, normal = p, steps = 48) => {
      let run = [], vis = null;
      const flush = () => {
        if (run.length > 1) {
          const d = 'M' + run.map(q => `${fr(q[0])} ${fr(q[1])}`).join('L');
          m += `<path class="o${vis ? '' : ' hid'}" d="${d}"/><path class="${cls}${vis ? '' : ' hid'}" d="${d}"/>`;
        }
      };
      for (let i = 0; i <= steps; i++) {
        const t = t0 + (t1 - t0) * i / steps, q = at(p(t)), v = seen(normal(t));
        if (vis !== null && v !== vis) { run.push(q); flush(); run = [run[run.length - 1]]; }
        vis = v; run.push(q);
      }
      flush();
    };
    const PI = Math.PI, edge = Math.asin(S);

    // The ball's outline - a sphere looks like a circle from anywhere.
    const c = at([0, 0, 0]);
    m += `<circle class="o" cx="${fr(c[0])}" cy="${fr(c[1])}" r="${fr(f.s)}"/><circle class="ball" cx="${fr(c[0])}" cy="${fr(c[1])}" r="${fr(f.s)}"/>`;
    // The centre line, from the brow up over the ball and down the back to
    // its underside (below the brow, the face is in front of the ball), then
    // down the face.
    curve('mid', t => [0, Math.sin(t), Math.cos(t)], 0, 1.5 * PI, undefined, 72);
    curve('mid', t => [0, -U * t, 1 - 0.12 * Math.max(0, t - 1)], 0, 2, () => [0, 0, 1], 8);
    // The side planes: a circle each, and the cross through it.
    for (const sx of [-1, 1]) {
      const n = () => [sx, 0, 0];
      curve('side', t => [sx * S, U * Math.cos(t), U * Math.sin(t)], 0, 2 * PI, n, 64);
      curve('side', t => [sx * S, t, 0], -U, U, n, 4);
      curve('side', t => [sx * S, 0, t], -U, U, n, 4);
    }
    // The thirds: hairline and brow run round the ball between the side
    // planes, the nose line round the front of the face - each ending on the
    // side circle, at its top, middle and bottom.
    curve('third', t => [S * Math.sin(t), U, S * Math.cos(t)], -PI / 2, PI / 2);
    curve('third', t => [Math.sin(t), 0, Math.cos(t)], -edge, edge);
    curve('third', t => [S * Math.sin(t), -U, Math.cos(t)], -PI / 2, PI / 2, t => [Math.sin(t), 0, Math.cos(t)]);
    curve('third', t => [t, -2 * U, 0.86], -0.22, 0.22, () => [0, -0.3, 1], 4);
    // The jaw: from under the ear down to its corner, then forward to the
    // chin - a polyline on each side.
    // The corner of the jaw is narrower than the cheekbones - about four
    // fifths of the side planes' width.
    const jaw = [[S, -0.6 * U, -0.25], [S * 0.8, -1.45 * U, -0.15], [0.3, -1.95 * U, 0.72], [0, -2 * U, 0.88]];
    for (const sx of [-1, 1]) {
      const pts = jaw.map(p => [sx * p[0], p[1], p[2]]);
      curve('jaw', t => {
        const i = Math.min(2, Math.floor(t)), k = t - i, a = pts[i], b = pts[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      }, 0, 3, t => { const p = pts[Math.min(3, Math.round(t))]; return v3.norm([p[0], 0, p[2] + 0.4]); }, 24);
    }
    // The four marks down the centre line.
    for (const p of [[0, U, Math.sqrt(1 - U * U)], [0, 0, 1], [0, -U, 1], [0, -2 * U, 0.88]]) {
      const q = at(p);
      m += `<circle class="dot" cx="${fr(q[0])}" cy="${fr(q[1])}" r="${fr(f.s / 28)}"/>`;
    }

    if (fi === 0) {
      // How the head is turned, as the picture shows it (mirrored with it).
      const Z = f.Z, sgn = flip ? -1 : 1;
      const yaw = sgn * Math.atan2(Z[0], -Z[2]) * 180 / PI;
      const pitch = Math.atan2(-Z[1], Math.hypot(Z[0], Z[2])) * 180 / PI;
      const roll = sgn * Math.atan2(f.X[1], f.X[0]) * 180 / PI;
      const side = a => (a > 0 ? 'right' : 'left');
      const parts = [];
      parts.push(Math.abs(yaw) < 5 ? 'facing you' : `turned ${Math.abs(yaw).toFixed(0)}° to the ${side(yaw)}`);
      if (Math.abs(pitch) >= 5) parts.push(`tipped ${pitch > 0 ? 'up' : 'down'} ${Math.abs(pitch).toFixed(0)}°`);
      if (Math.abs(roll) >= 4) parts.push(`tilted ${Math.abs(roll).toFixed(0)}° toward the ${side(roll)}`);
      let tip = '';
      if (Math.abs(pitch) >= 8) tip = pitch > 0
        ? ' Seen from below, so the lines round the face <b>arch up</b> - the nose covers more of the eyes, the chin looks big.'
        : ' Seen from above, so the lines round the face <b>curve down</b> like a smile - more forehead, the chin tucked away.';
      else if (Math.abs(yaw) >= 20) tip = ' The far half of the face is <b>narrower</b>: its eye smaller and closer to the centre line.';
      note = `<b>Head</b>: ${parts.join(', ')}.${tip}` +
        `<br><b>Yellow</b>: hairline, brow, nose, chin - three equal thirds. <i>Red</i>: the centre line. ` +
        `<u>Blue</u>: the side plane - the ear sits just behind its middle.` +
        (faces.length > 1 ? ` (${faces.length} heads; this is about the first.)` : '');
    }
  });
  svg.innerHTML = m;
  svg.classList.remove('hidden');
  positionGrid();
  overlayNote('head', note);
}

el('btnHead').addEventListener('click', toggleHead);
