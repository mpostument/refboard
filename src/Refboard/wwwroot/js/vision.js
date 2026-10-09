/* refboard - The MediaPipe models: pose skeleton and head construction
   (and the classifier js/sort.js uses).
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
const PL = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lToe: 31, rToe: 32 };
const POSE_BONES = [['lSh', 'rSh'], ['lSh', 'lEl'], ['lEl', 'lWr'], ['rSh', 'rEl'], ['rEl', 'rWr'], ['lSh', 'lHip'], ['rSh', 'rHip'],
  ['lHip', 'rHip'], ['lHip', 'lKn'], ['lKn', 'lAn'], ['rHip', 'rKn'], ['rKn', 'rAn'], ['lAn', 'lToe'], ['rAn', 'rToe']];
/* The figure's proportions - the 3D figure's Body row (js/forms-models.js,
   figureScale()) and a photo's pose redrawn in them (rebuildPose()). Each part of the body is [girth, length] times
   the real one's - girth across and through it, length along it - and a
   joint hangs where its parent's length puts it: a longer thigh carries the
   knee down with it. The torso is two parts, not one - chest and waist -
   so a build can widen the shoulders without the hips, or the other way
   round: the chest's girth carries the shoulders' width with it (the arms
   hang from it) and the waist's carries the hips' (the legs hang from the
   pelvis, which is the waist's own). The rig itself stays one table, so a
   pose fits every build. Worked out to the heads count each is known by
   (figureHeights()): anime shortens the torso and lengthens the legs round
   a bigger head; chibi is a head as big as the rest of the body.

   real, anime, tall and chibi are stylisations - how many heads tall the
   whole figure is drawn, the way a style guide picks it. child, elderly,
   heavy, muscular, female and male stay at the realistic figure's own
   style and vary the build instead - a body type, not an art style - so
   either kind can be reached from the Body row without the other
   disappearing. */
const FIGURE_BUILDS = {
  real: { label: 'Realistic', hint: 'A real body, about eight heads tall: the crotch halfway down, the elbow at the waist.' },
  anime: { label: 'Anime', chest: [0.9, 0.9], waist: [0.9, 0.9], arm: [0.85, 0.98], hand: [0.85, 0.9], leg: [0.88, 1.1], foot: [0.8, 0.9], head: [1.15, 1.15],
    hint: 'Standard anime, about seven heads: a bigger head, a shorter torso and longer, slimmer legs - a little more than half the height.' },
  tall: { label: 'Long-legged', chest: [0.85, 0.92], waist: [0.85, 0.92], neck: [0.9, 1.15], arm: [0.85, 1.08], hand: [0.85, 0.95], leg: [0.85, 1.25], head: [0.95, 0.95],
    hint: 'Stylised, about nine heads, as fashion drawing and some anime do it: a small head and legs more than half the height.' },
  chibi: { label: 'Chibi', chest: [0.85, 0.45], waist: [0.85, 0.45], neck: [0.8, 0.3], arm: [1.05, 0.5], hand: [1.1, 0.7], leg: [1.05, 0.5], foot: [1.1, 0.8], head: [2.2, 2.2],
    hint: 'Chibi, about two and a half heads: the head is as big as the body under it, the limbs short stubs with no elbows or knees to speak of.' },
  child: { label: 'Child', chest: [0.95, 0.62], waist: [1, 0.62], neck: [0.85, 0.65], arm: [0.92, 0.65], hand: [1, 0.85], leg: [0.95, 0.67], foot: [1, 0.9],
    hint: "About five and a half heads - a six or seven year old's proportion: the head is already near full size, and the rest of the body has not yet caught up to it." },
  elderly: { label: 'Older', chest: [0.95, 0.94], waist: [1.05, 0.92], neck: [0.9, 0.94], arm: [0.92, 0.98], leg: [0.92, 0.96],
    hint: 'A little shorter than the realistic figure and narrower through the shoulders, with a fuller waist - the height loss and softening of later life.' },
  heavy: { label: 'Heavier', chest: [1.22, 1], waist: [1.38, 1], arm: [1.22, 1], hand: [1.08, 1], leg: [1.22, 1], foot: [1.08, 1],
    hint: "The realistic figure's own height, carrying more weight through the torso and limbs - heaviest at the waist." },
  muscular: { label: 'Muscular', chest: [1.3, 1], waist: [1.02, 1], neck: [1.2, 1], arm: [1.3, 1.03], leg: [1.18, 1.02],
    hint: "The realistic figure's own height, built up through the chest, neck and limbs, with a waist that stays comparatively narrow against the chest." },
  female: { label: 'Female', chest: [0.86, 0.95], waist: [1.04, 0.95], neck: [0.9, 0.95], arm: [0.9, 0.96], hand: [0.93, 0.95], leg: [0.95, 0.96], foot: [0.93, 0.95],
    hint: 'About seven and a half heads: narrower through the shoulders than through the waist and hips - the classic proportion for a female figure.' },
  male: { label: 'Male', chest: [1.1, 1], waist: [0.94, 1], neck: [1.08, 1],
    hint: "Close to the realistic figure's own height, broader through the shoulders and narrower at the waist - the classic V of a male figure." },
};
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// The MediaPipe tasks this page uses - one runtime, fetched once, shared by
// both; each model is fetched the first time its button is pressed.
// The classifier names what a picture is of - 1000 ImageNet classes - for
// sorting uploads (js/sort.js); about 5 MB.
const CLASSIFY_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/int8/1/efficientnet_lite0.tflite';
const VISION_TASKS = {
  pose: { cls: 'PoseLandmarker', model: POSE_MODEL, opts: { numPoses: 2 } },
  face: { cls: 'FaceLandmarker', model: FACE_MODEL, opts: { numFaces: 4 } },
  // CPU only: on the GPU delegate this quantized model's output comes back
  // as floats, and MediaPipe's dequantizing step refuses them.
  classify: { cls: 'ImageClassifier', model: CLASSIFY_MODEL, opts: { maxResults: 5 }, cpu: true },
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
      if (t.cpu) visionModels[kind] = await make('CPU');
      else try { visionModels[kind] = await make('GPU'); } catch { visionModels[kind] = await make('CPU'); }
      return visionModels[kind];
    })();
    visionLoading[kind].catch(() => { visionLoading[kind] = null; });
  }
  return visionLoading[kind];
}

// The one note box is shared, in this order: the head's note above the
// pose's when both are on. Each part has its own x, which turns that layer
// off - with three maps on, the note is how you find what to close. The
// keys are LAYERS' ids (js/layers.js), or for a tool that only speaks -
// no overlay - its HUD_TOOLS id (js/pins.js), whose button the x presses.
const overlayNotes = { head: '', pose: '', edges: '', range: '', temp: '', amounts: '', tangents: '', lineweight: '', linewash: '', tone: '', symmetry: '', rhythms: '', markers: '', grades: '', watercolour: '', vignette: '' };
const noteOwner = k => (typeof LAYERS !== 'undefined' && LAYERS.find(l => l.id === k))
  || (typeof HUD_TOOLS !== 'undefined' && HUD_TOOLS.find(t => t.id === k));
function overlayNote(key, html) {
  overlayNotes[key] = html || '';
  const parts = Object.entries(overlayNotes).filter(([, h]) => h).map(([k, h]) => {
    const owner = noteOwner(k);
    const off = owner ? `<button type="button" class="note-off" data-note-off="${k}" title="Turn off ${esc(owner.label)}" aria-label="Turn off ${esc(owner.label)}">×</button>` : '';
    return `<div class="note-part" data-note="${k}">${off}${h}</div>`;
  });
  el('poseNote').classList.toggle('hidden', !parts.length);
  el('poseNote').innerHTML = parts.join('');
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

/* The picture as the models must be given it: a canvas at its own size.
   Given the <img> itself, MediaPipe reads it at the size it is shown - a
   photo shown at 700 of its 900 pixels came back with every point at 7/9
   of where it is, the whole construction shrunk toward the top left. Grey
   round it `pad` of its size each side, for the face model (detectFaces()). */
function visionCanvas(img, pad = 0) {
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
  c.width = Math.round(W * (1 + 2 * pad)); c.height = Math.round(H * (1 + 2 * pad));
  const g = c.getContext('2d');
  if (pad) { g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, W * pad, H * pad, W, H);
  return c;
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
  try { res = model.detect(visionCanvas(img)); }
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

/* A photo's pose in other proportions (FIGURE_BUILDS): each bone the model
   found keeps its direction on the page and only grows or shrinks by its
   part's length - the shoulders' width by the chest's girth, the hips' by
   the waist's - hung from the joint above it, the rule the 3D figure's
   joints follow (poseFormRig()). So the angles stay the photo's and only
   the body changes. Then the whole is moved so the foot lowest in the
   picture stays where it was: the figure still stands where it stood.
   The head is a circle, a real head's height taken as the neck-to-hip
   length over 2.5 (the classic figure's measure) - or from the ears, when
   the torso is turned toward you and foreshortened. */
function rebuildPose(P, build, torso) {
  const B = FIGURE_BUILDS[build] || {}, part = k => B[k] || [1, 1];
  const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
  const neck = mid(P.lSh, P.rSh), pelvis = mid(P.lHip, P.rHip);
  if (!neck || !pelvis) return null;
  // The chest and the waist share the neck-to-pelvis span in the 3D rig;
  // here, with no joint of its own between them, their lengths average.
  const torsoLen = (part('chest')[1] + part('waist')[1]) / 2;
  const Q = { neck: [pelvis[0] + (neck[0] - pelvis[0]) * torsoLen, pelvis[1] + (neck[1] - pelvis[1]) * torsoLen] };
  // The joint `to`, hung from `from`'s new place by the bone's own vector times k.
  const hang = (to, from, base, k) => { if (P[to] && base) Q[to] = [base[0] + (P[to][0] - from[0]) * k, base[1] + (P[to][1] - from[1]) * k]; };
  for (const s of ['l', 'r']) {
    hang(s + 'Sh', neck, Q.neck, part('chest')[0]);
    hang(s + 'El', P[s + 'Sh'], Q[s + 'Sh'], part('arm')[1]);
    hang(s + 'Wr', P[s + 'El'], Q[s + 'El'], part('arm')[1]);
    hang(s + 'Hip', pelvis, pelvis, part('waist')[0]);
    hang(s + 'Kn', P[s + 'Hip'], Q[s + 'Hip'], part('leg')[1]);
    hang(s + 'An', P[s + 'Kn'], Q[s + 'Kn'], part('leg')[1]);
    hang(s + 'Toe', P[s + 'An'], Q[s + 'An'], part('foot')[1]);
  }
  // The head: its centre between the ears (the nose is on its front), on the
  // line from the neck, the neck's own part of that stretched by the neck's
  // length and the rest by the head's size.
  const ears = mid(P.lEar, P.rEar), centre = ears || P.nose;
  const earSpan = P.lEar && P.rEar ? Math.hypot(P.lEar[0] - P.rEar[0], P.lEar[1] - P.rEar[1]) : 0;
  const r0 = Math.max(torso / 2.5, earSpan * 1.3) / 2, kh = part('head')[1];
  if (centre) {
    const d = Math.hypot(centre[0] - neck[0], centre[1] - neck[1]) || 1, u = [(centre[0] - neck[0]) / d, (centre[1] - neck[1]) / d];
    const reach = Math.max(0, d - r0) * part('neck')[1] + r0 * kh;
    Q.head = [Q.neck[0] + u[0] * reach, Q.neck[1] + u[1] * reach];
  }
  // Planted on the foot lowest in the picture.
  const foot = ['lToe', 'rToe', 'lAn', 'rAn'].filter(k => P[k] && Q[k]).sort((a, b) => P[b][1] - P[a][1])[0];
  if (foot) {
    const dx = P[foot][0] - Q[foot][0], dy = P[foot][1] - Q[foot][1];
    for (const k in Q) Q[k] = [Q[k][0] + dx, Q[k][1] + dy];
  }
  // As tall as it stands here, in its own heads: top of the head to the
  // lowest point - fewer than the build's count on a figure that bends.
  const r = r0 * kh, ys = Object.values(Q).map(p => p[1]);
  const top = Q.head ? Q.head[1] - r : Math.min(...ys), bottom = Math.max(...ys);
  return { Q, r, r0, head0: centre, top, bottom, heads: Q.head && foot ? (bottom - top) / (2 * r) : null };
}

// The rebuilt figure: its bones and head in pink over the photo's faint
// ones, the photo's head as a dashed circle to show what changed, and a
// ruler of head heights down its side from the top of the head.
function drawRebuiltPose(R, line, fr) {
  const { Q, r } = R;
  let m = '';
  for (const [a, b] of POSE_BONES) if (Q[a] && Q[b]) m += line(Q[a], Q[b], 'bone-o') + line(Q[a], Q[b], 'rebuilt');
  const neck = Q.neck;
  if (R.head0) m += `<circle class="head0" cx="${fr(R.head0[0])}" cy="${fr(R.head0[1])}" r="${fr(R.r0)}"/>`;
  if (Q.head) {
    // The neck up to the head's edge, not into it.
    const d = Math.hypot(Q.head[0] - neck[0], Q.head[1] - neck[1]), k = Math.max(0, d - r) / (d || 1);
    const chin = [neck[0] + (Q.head[0] - neck[0]) * k, neck[1] + (Q.head[1] - neck[1]) * k];
    m += line(neck, chin, 'bone-o') + line(neck, chin, 'rebuilt');
    m += `<circle class="rebuilt-head" cx="${fr(Q.head[0])}" cy="${fr(Q.head[1])}" r="${fr(r)}"/>`;
  }
  if (R.heads) {
    const xs = Object.values(Q).map(p => p[0]).concat(Q.head[0] - r), x = Math.min(...xs) - r * 0.8, tick = r * 0.35;
    m += line([x, R.top], [x, R.bottom], 'heads');
    for (let y = R.top; y <= R.bottom + 0.5; y += 2 * r) m += line([x - tick, y], [x + tick, y], 'heads');
  }
  return m;
}

// The pose's proportions, kept like the head's style: the photo's own
// ('real') or one of FIGURE_BUILDS.
const POSE_BUILD_KEY = 'refboard.poseBuild.v1';
let poseBuild = (() => { try { const k = localStorage.getItem(POSE_BUILD_KEY); return FIGURE_BUILDS[k] ? k : 'real'; } catch { return 'real'; } })();
let poseLast = null;
function setPoseBuild(build) {
  if (!FIGURE_BUILDS[build] || build === poseBuild) return;
  poseBuild = build;
  try { localStorage.setItem(POSE_BUILD_KEY, build); } catch {}
  if (state.poseOn && poseLast) drawPose(poseLast);
}
// The switch at the head of the pose's note - the head style's, reused.
const poseBuildSwitch = () => `<span class="head-style" role="group" aria-label="Proportions">${Object.entries(FIGURE_BUILDS).map(([k, b]) =>
  `<button type="button" data-pose-build="${k}" aria-pressed="${k === poseBuild}" title="${esc(k === 'real' ? 'The photo as it is' : b.hint)}">${k === 'real' ? 'Photo' : b.label}</button>`).join('')}</span>`;

function drawPose(poses) {
  const img = el('img'), svg = el('poseOverlay');
  const W = img.naturalWidth, H = img.naturalHeight, flip = img.classList.contains('flip');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  poseLast = poses;
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
    const neck = mid(P.lSh, P.rSh), pelvis = mid(P.lHip, P.rHip);
    const torso = neck && pelvis ? Math.hypot(neck[0] - pelvis[0], neck[1] - pelvis[1]) : H / 4;
    // In another build the photo's skeleton stays as a faint ghost under the
    // redrawn one, and the teacher's lines (g) are left out: they are about
    // the photo's body, and would cross the new one.
    const R = poseBuild !== 'real' ? rebuildPose(P, poseBuild, torso) : null;
    let g = '';
    for (const [a, b] of POSE_BONES) if (P[a] && P[b]) m += R ? line(P[a], P[b], 'bone ghost') : line(P[a], P[b], 'bone-o') + line(P[a], P[b], 'bone');

    // Tilt, as it reads on screen: positive rises to the right.
    const tilt = (a, b) => { const [l, r] = a[0] <= b[0] ? [a, b] : [b, a]; return Math.atan2(l[1] - r[1], r[0] - l[0]) * 180 / Math.PI; };
    const ext = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], k = 0.25; return [[a[0] - dx * k, a[1] - dy * k], [b[0] + dx * k, b[1] + dy * k]]; };
    let ts = null, th = null;
    if (P.lSh && P.rSh) { ts = tilt(P.lSh, P.rSh); g += line(...ext(P.lSh, P.rSh), 'tilt'); }
    if (P.lHip && P.rHip) { th = tilt(P.lHip, P.rHip); g += line(...ext(P.lHip, P.rHip), 'tilt'); }

    // Which foot carries the weight: the one under the pit of the neck.
    let support = null, balance = '';
    if (neck && (P.lAn || P.rAn)) {
      const ys = [P.lAn, P.rAn].filter(Boolean).map(p => p[1]);
      g += line(neck, [neck[0], Math.max(...ys) + torso * 0.1], 'plumb');
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
    if (spine.length >= 3) g += `<path class="action" d="${smoothPath(spine.map(p => p.map(v => +v.toFixed(1))))}"/>`;
    const dots = Q => Object.keys(PL).filter(k => Q[k] && !/nose|Ear/.test(k)).map(k => `<circle cx="${fr(Q[k][0])}" cy="${fr(Q[k][1])}" r="${fr(W / 220)}"/>`).join('');
    if (R) m += drawRebuiltPose(R, line, fr) + dots(R.Q);
    else m += g + dots(P);

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
      const B = FIGURE_BUILDS[poseBuild];
      note = poseBuildSwitch() + `${parts.join(', ')}${rel}` + (balance ? `<br>${balance}` : '') +
        (poseBuild === 'real' ? `<br><i>Red</i>: the line of action - draw it first. <u>Blue</u>: the balance line.`
          : !R ? `<br>To redraw it as <b class="pink">${B.label}</b> the model needs to see both shoulders and both hips.`
          // The build's own description is its button's title - here only what it came to.
          : `<br><b class="pink">${B.label}</b>: the same pose` +
            (R.heads ? `, <b>${R.heads.toFixed(1)} heads</b> as it stands here (the ticks)` : '') +
            `. <u>Faint</u>: the photo's own.`) +
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
// The faces last found in the picture on screen - a change of style redraws
// them rather than running the model again.
let headFaces = null;

/* The same head, drawn the anime way. The ball, its side planes and the
   centre line stay - they are how the head is turned, and the angle is the
   hard part of anime - but the face is not Loomis's thirds. Eyes sit lower
   and are far bigger: their line about halfway from the brow to Loomis's
   nose line, each eye about a fifth of the head wide and one eye apart.
   The nose is a mark, the mouth a short line, both close under the eyes;
   the jaw runs almost straight to a pointed chin. Same units as Loomis's:
   the ball's radius, y up from the brow, z out of the face. */
const ANIME_HEAD = {
  eyeY: -0.38, eyeX: 0.36,                          // eye centres; the eye itself is ANIME_EYES'
  nose: -0.84, mouth: -1.07,
  jaw: [[1, -0.4, -0.25], [0.78, -0.92, 0.3], [0.12, -1.27, 0.8], [0, -2 * LOOMIS_U, 0.88]], // x of the first two in side-plane widths
};

/* The anime eye, in the few styles most drawing is in - one eye apart and
   on the same eye line in all of them; what differs is the eye. In the
   head's units: a, the half-width; up and down, how high the upper lash
   line arches and how low the lower lid runs; the iris, a tall ellipse
   (irisA, irisB) with its top cut off by the lash line; lash, the upper
   lash line's weight; flick, where its outer end sweeps to [out, up];
   lower, the run of the lower lid in fractions of the half-turn from the
   outer corner; tilt, how much higher the outer corner sits than the inner
   (tsurime up, tareme down); gleams, [toward the light, up, radius] from
   the eye's centre - the first the big one; brow, its height above the
   eye. gen: Generate's Eye shape for it. */
const ANIME_EYES = {
  tv: { label: 'TV anime', gen: 'any', a: 0.2, up: 0.12, down: 0.144, irisA: 0.085, irisB: 0.13, lash: 1,
    flick: [0.06, -0.05], lower: [0.12, 0.55], tilt: 0, gleams: [[0.035, 0.05, 0.033], [-0.03, -0.07, 0.013]], brow: 0.29,
    hint: 'the everyday look of TV anime: an eye a little taller than wide, the lash line heavy at the outer corner, two gleams.' },
  shojo: { label: 'Shōjo', gen: 'shojo', a: 0.2, up: 0.17, down: 0.17, irisA: 0.1, irisB: 0.18, lash: 1.35,
    flick: [0.08, -0.07], lower: [0.06, 0.7], tilt: 0.01, gleams: [[0.04, 0.065, 0.04], [-0.035, -0.08, 0.018], [0.05, -0.045, 0.012]], brow: 0.33, lashes: 3,
    hint: 'big and tall, the iris nearly fills the eye; three or more gleams, and lashes drawn as separate flicks past the corner.' },
  sharp: { label: 'Sharp', gen: 'sharp', a: 0.21, up: 0.075, down: 0.09, irisA: 0.07, irisB: 0.09, lash: 1.25,
    flick: [0.07, 0.025], lower: [0.1, 0.45], tilt: 0.05, gleams: [[0.025, 0.02, 0.02]], brow: 0.21,
    hint: 'narrow, the outer corner up (tsurime): the lash line nearly straight, the iris cut by it top and bottom, one small gleam; the brow low and close.' },
  soft: { label: 'Soft', gen: 'soft', a: 0.17, up: 0.12, down: 0.12, irisA: 0.07, irisB: 0.1, lash: 0.6,
    flick: [0.02, -0.02], lower: [0.15, 0.5], tilt: -0.03, gleams: [[0.03, 0.035, 0.024]], brow: 0.3,
    hint: 'round and gentle, the outer corner down (tareme): a small iris with white round it, thin lines, a single gleam.' },
};
const animeEyeStyle = k => ANIME_EYES[k] || ANIME_EYES.tv;

/* Anime expressions: what the brows, the eyes and the mouth do, on top of
   any eye style - anime changes the shapes, not the face. open, how far the
   upper lash line arches (x the style's); lower, the lower lid's run - under
   0 the cheek pushes it up into the eye, the crescent of a smile; droop,
   how far the upper lid comes down over the inner corner (anger, > 0) or
   the outer one (sadness, < 0); iris, its size - the pupil shrinks in
   shock. brow: [raise, inner end up or down, arch x, weight x]. mouth, one
   of drawAnimeFace()'s mouths; mark, anime's sign for the feeling. gen:
   Generate's Expression for it. */
const ANIME_EXPRESSIONS = {
  calm: { label: 'Calm', gen: 'any', open: 1, lower: 1, droop: 0, iris: 1, brow: [0, 0, 1, 1], mouth: 'line', mark: '',
    hint: 'the face at rest: brows level, the mouth a short line.' },
  joy: { label: 'Joy', gen: 'joy', open: 0.9, lower: -0.35, droop: 0, iris: 1, brow: [0.03, 0.02, 1.4, 1], mouth: 'smile', mark: 'blush',
    hint: 'the cheeks push the lower lids up into a crescent; brows lifted and round; the mouth open wide, its corners up; a blush under the eyes.',
    profile: 'in profile the open mouth is a wedge whose upper edge curves up into the cheek.' },
  anger: { label: 'Anger', gen: 'anger', open: 0.85, lower: 0.8, droop: 0.07, iris: 0.85, brow: [-0.05, -0.1, 0.4, 1.5], mouth: 'shout', mark: 'vein',
    hint: 'the brows pulled down and in, a sharp V; the upper lids cut across the irises at the inner corners; the mouth squared open over the teeth; the cross-shaped vein.',
    profile: 'in profile the brow juts out over the eye, and the open mouth is a squared notch.' },
  surprise: { label: 'Surprise', gen: 'surprise', open: 1.25, lower: 1.2, droop: 0, iris: 0.72, brow: [0.08, 0.02, 1.8, 0.85], mouth: 'o', mark: '',
    hint: 'white all round a shrunken iris; brows high and arched, well clear of the eyes; the mouth a small O.',
    profile: 'in profile the brows ride up the forehead, and the O becomes a small hollow under the nose.' },
  sadness: { label: 'Sadness', gen: 'sadness', open: 0.85, lower: 1, droop: -0.06, iris: 1, brow: [0.02, 0.08, 0.3, 1], mouth: 'frown', mark: 'tears',
    hint: 'the brows\' inner ends lifted, slanting down and out; the upper lids heavy at the outer corners; a small mouth, corners down; tears welling on the lower lids.',
    profile: 'in profile the brow tilts up toward the nose, and the tear runs down the curve of the cheek.' },
};
const animeExpression = k => ANIME_EXPRESSIONS[k] || ANIME_EXPRESSIONS.calm;

/* One eye of a style, on the flat of the face: sx -1 for the face's right,
   1 for its left, with an expression (ANIME_EXPRESSIONS) on it. Every curve
   runs from the outer corner (t = 0) to the inner (t = π). Shared by the
   drawing on a photo and the 3D head's face. */
function animeEyeShape(style, sx, expression) {
  const S = animeEyeStyle(style), X = animeExpression(expression), A = ANIME_HEAD, ex = sx * A.eyeX, ey = A.eyeY;
  // The style's numbers with the expression's changes in: everything after
  // reads E, so the iris, its clipping and the gleams follow.
  const E = X === ANIME_EXPRESSIONS.calm ? S : { ...S, up: S.up * X.open, down: S.down * X.lower,
    irisA: S.irisA * X.iris, irisB: S.irisB * X.iris, gleams: S.gleams.map(g => g.map(v => v * X.iris)) };
  const lift = c => E.tilt * (1 + c) / 2;   // c = cos t: 1 at the outer corner
  // The lid coming down over one end of the eye. Weighted by sin t, so the
  // corners stay put - only the arch between them sags.
  const droop = c => X.droop > 0 ? X.droop * (1 - c) / 2 : -X.droop * (1 + c) / 2;
  const top = (s, c) => ey + (E.up - droop(c)) * s + lift(c);
  const upper = t => [ex + sx * E.a * Math.cos(t), top(Math.sin(t), Math.cos(t))];
  const lower = t => [ex + sx * E.a * 0.95 * Math.cos(t), ey - E.down * Math.sin(t) + lift(Math.cos(t))];
  // The lash line's height over any x - the iris is tucked under it.
  const lashAt = x => { const c = Math.max(-1, Math.min(1, (x - ex) / (sx * E.a))); return top(Math.sqrt(1 - c * c), c); };
  const lidAt = x => { const c = Math.max(-1, Math.min(1, (x - ex) / (sx * E.a * 0.95))); return ey - E.down * Math.sqrt(1 - c * c) + lift(c); };
  const iris = t => {
    const x = ex + E.irisA * Math.cos(t), y = ey - 0.01 + E.irisB * Math.sin(t);
    return [x, Math.max(lidAt(x), Math.min(lashAt(x), y))];
  };
  // The lash line's weight at t: thick at the outer corner, thinning inward
  // and running out to nothing at the inner corner.
  const weight = t => (0.05 - 0.035 * t / Math.PI) * E.lash * Math.min(1, (Math.PI - t) / (0.2 * Math.PI)) ** 0.7;
  const flick = [ex + sx * (E.a + E.flick[0]), ey + lift(1) + E.flick[1]];
  // A gleam's centre, `side` the way the light comes from (-1 the face's right).
  const gleam = (g, side) => [ex + side * g[0], ey + g[1]];
  // The brow, from its inner end (u = 0) to its outer: a thin arc at the
  // style's height, rising outward as far as the eye's corner does - raised,
  // tilted and arched by the expression.
  const [raise, inner, arch] = X.brow;
  const brow = u => [sx * (0.17 + 0.36 * u),
    ey + E.brow + raise + inner * (1 - u) + 0.035 * arch * Math.sin(Math.PI * (0.35 + 0.65 * u)) + E.tilt * 0.6 * u];
  return { E, X, ex, ey, upper, lower, iris, weight, flick, gleam, brow, corner: upper(0) };
}
const HEAD_STYLES = { loomis: 'Loomis', anime: 'Anime' };
const HEAD_STYLE_KEY = 'refboard.headStyle.v1';
let headStyle = (() => { try { return HEAD_STYLES[localStorage.getItem(HEAD_STYLE_KEY)] ? localStorage.getItem(HEAD_STYLE_KEY) : 'loomis'; } catch { return 'loomis'; } })();
function setHeadStyle(style) {
  if (!HEAD_STYLES[style] || style === headStyle) return;
  headStyle = style;
  try { localStorage.setItem(HEAD_STYLE_KEY, style); } catch {}
  if (state.headOn && headFaces) drawHead(headFaces);
}
// The anime eye's style on a photo (ANIME_EYES), kept like the head's.
const HEAD_EYES_KEY = 'refboard.headEyes.v1';
let headEyes = (() => { try { const k = localStorage.getItem(HEAD_EYES_KEY); return ANIME_EYES[k] ? k : 'tv'; } catch { return 'tv'; } })();
function setHeadEyes(style) {
  if (!ANIME_EYES[style] || style === headEyes) return;
  headEyes = style;
  try { localStorage.setItem(HEAD_EYES_KEY, style); } catch {}
  if (state.headOn && headFaces) drawHead(headFaces);
}

function clearHead() {
  headRun++;
  headFaces = null;
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
  headFaces = null; // they were the last picture's
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
    const src = visionCanvas(img, pad);
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

// A polyline of 3D points round the lower face - the jaw, on each side.
// Its normal, for which parts face the camera, leans out and forward.
function jawLine(curve, jaw) {
  for (const sx of [-1, 1]) {
    const pts = jaw.map(p => [sx * p[0], p[1], p[2]]), last = pts.length - 1;
    curve('jaw', t => {
      const i = Math.min(last - 1, Math.floor(t)), k = t - i, a = pts[i], b = pts[i + 1];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }, 0, last, t => { const p = pts[Math.min(last, Math.round(t))]; return v3.norm([p[0], 0, p[2] + 0.4]); }, 24);
  }
}
const headDot = (at, p, s, cls = 'dot') => {
  const q = at(p);
  return `<circle class="${cls}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(s / 28).toFixed(1)}"/>`;
};

// Loomis's face: the thirds, his jaw, a mark at each third.
function loomisFace(curve, at, s) {
  const U = LOOMIS_U, S = LOOMIS_SIDE, PI = Math.PI, edge = Math.asin(S);
  // The thirds: hairline and brow run round the ball between the side
  // planes, the nose line round the front of the face - each ending on the
  // side circle, at its top, middle and bottom.
  curve('third', t => [S * Math.sin(t), U, S * Math.cos(t)], -PI / 2, PI / 2);
  curve('third', t => [Math.sin(t), 0, Math.cos(t)], -edge, edge);
  curve('third', t => [S * Math.sin(t), -U, Math.cos(t)], -PI / 2, PI / 2, t => [Math.sin(t), 0, Math.cos(t)]);
  curve('third', t => [t, -2 * U, 0.86], -0.22, 0.22, () => [0, -0.3, 1], 4);
  // The jaw: from under the ear down to its corner, then forward to the
  // chin. The corner of the jaw is narrower than the cheekbones - about
  // four fifths of the side planes' width.
  jawLine(curve, [[S, -0.6 * U, -0.25], [S * 0.8, -1.45 * U, -0.15], [0.3, -1.95 * U, 0.72], [0, -2 * U, 0.88]]);
  // The four marks down the centre line.
  return [[0, U, Math.sqrt(1 - U * U)], [0, 0, 1], [0, -U, 1], [0, -2 * U, 0.88]].map(p => headDot(at, p, s)).join('');
}

// The anime face - see ANIME_HEAD.
function animeFace(curve, at, s) {
  const A = ANIME_HEAD, S = LOOMIS_SIDE;
  // The eyes lie on the ball itself, which is what turns them with it: the
  // far one narrows and slides toward the centre line on its own.
  const onBall = (x, y) => [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
  // The eye line round the ball, from one side plane to the other.
  const r = Math.sqrt(1 - A.eyeY * A.eyeY), lim = Math.asin(Math.min(1, S / r));
  curve('eyeline', t => [r * Math.sin(t), A.eyeY, r * Math.cos(t)], -lim, lim);
  let marks = '';
  for (const sx of [-1, 1]) {
    // In the style chosen in the note (animeEyeShape()).
    const e = animeEyeShape(headEyes, sx), on = f => t => onBall(...f(t));
    // The upper lash line - the heaviest line of an anime face - flicked
    // past the outer corner.
    curve('lash', on(e.upper), 0, Math.PI, undefined, 24);
    curve('lash', t => onBall(e.corner[0] + (e.flick[0] - e.corner[0]) * t, e.corner[1] + (e.flick[1] - e.corner[1]) * t), 0, 1, undefined, 3);
    // The lower lid: short, on the outer part only.
    curve('lid', on(e.lower), e.E.lower[0] * Math.PI, e.E.lower[1] * Math.PI, undefined, 10);
    // The iris, tall, its top tucked under the lash line.
    curve('iris', on(e.iris), 0, 2 * Math.PI, undefined, 32);
    // The gleams - on the same side in both eyes, as one light makes it.
    for (const g of e.E.gleams) marks += headDot(at, onBall(...e.gleam(g, -1)), s * g[2] / 0.025, 'gleam');
  }
  // The nose, a small mark; the mouth, a short line - both on the front of
  // the face, which below the ball stands out in front of it.
  curve('feat', t => [-0.03 * t, A.nose + 0.04 * (1 - t), 1.0], 0, 1, () => [0, -0.2, 1], 2);
  curve('feat', t => [t, A.mouth + 0.3 * t * t, 0.97], -0.11, 0.11, () => [0, -0.3, 1], 8);
  // The jaw nearly straight to a pointed chin - the first two points'
  // widths are in side-plane widths, the corner being where the cheek ends.
  jawLine(curve, A.jaw.map(([x, y, z], i) => [i < 2 ? x * S : x, y, z]));
  return marks + headDot(at, A.jaw[A.jaw.length - 1], s, 'dot pink');
}

// The Loomis / Anime switch at the head of the note - and, for Anime, the
// eye's style beside it: the same kind of switch, for the same kind of choice.
function headStyleSwitch() {
  const group = (label, attr, entries, on) => `<span class="head-style" role="group" aria-label="${label}">${entries.map(([k, t, title = '']) =>
    `<button type="button" data-${attr}="${k}" aria-pressed="${k === on}" title="${esc(title)}">${t}</button>`).join('')}</span>`;
  return group('Head construction style', 'head-style', Object.entries(HEAD_STYLES), headStyle) +
    (headStyle === 'anime' ? group('Anime eye style', 'head-eyes', Object.entries(ANIME_EYES).map(([k, e]) => [k, e.label, e.hint[0].toUpperCase() + e.hint.slice(1)]), headEyes) : '');
}

function drawHead(faces) {
  const img = el('img'), svg = el('headOverlay');
  const W = img.naturalWidth, H = img.naturalHeight, flip = img.classList.contains('flip');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  headFaces = faces;
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
    const PI = Math.PI;

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
    // The face itself, in the chosen style. Its lines go through curve();
    // its marks (dots, the eyes' gleam) come back as SVG - added after the
    // call, since `m += face()` would read m before face() adds its lines.
    const marks = (headStyle === 'anime' ? animeFace : loomisFace)(curve, at, f.s);
    m += marks;

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
      else if (Math.abs(yaw) >= 20) tip = headStyle === 'anime'
        ? ' The far eye is <b>narrower</b> and tucked against the centre line; turned much further, it goes behind the bridge of the nose, and the cheek bulges out past it.'
        : ' The far half of the face is <b>narrower</b>: its eye smaller and closer to the centre line.';
      const legend = headStyle === 'anime'
        // Short: it sits over the picture. What each eye style is, is on
        // its button (headStyleSwitch()).
        ? `<b class="pink">Pink</b>: this head drawn the anime way, ${ANIME_EYES[headEyes].label} eyes - lower and bigger than its own, ` +
          'nose and mouth close under them, a pointed chin. <i>Red</i>: the centre line, one eye between the eyes. <u>Blue</u>: the side plane.'
        : '<b>Yellow</b>: hairline, brow, nose, chin - three equal thirds. <i>Red</i>: the centre line. ' +
          '<u>Blue</u>: the side plane - the ear sits just behind its middle.';
      note = headStyleSwitch() + `<b>Head</b>: ${parts.join(', ')}.${tip}<br>${legend}` +
        (faces.length > 1 ? ` (${faces.length} heads; this is about the first.)` : '');
    }
  });
  svg.innerHTML = m;
  svg.classList.remove('hidden');
  positionGrid();
  overlayNote('head', note);
}

el('btnHead').addEventListener('click', toggleHead);
// The note sits on the stage, whose own pointer handlers pan and draw:
// a press on the switch is the switch's alone.
el('poseNote').addEventListener('pointerdown', e => { if (e.target.closest('button')) e.stopPropagation(); });
el('poseNote').addEventListener('click', e => {
  const b = e.target.closest('[data-head-style]'), eyes = e.target.closest('[data-head-eyes]'), build = e.target.closest('[data-pose-build]');
  if (b) setHeadStyle(b.dataset.headStyle);
  if (build) setPoseBuild(build.dataset.poseBuild);
  if (eyes) setHeadEyes(eyes.dataset.headEyes);
  const off = e.target.closest('[data-note-off]');
  if (off) { const o = noteOwner(off.dataset.noteOff); if (o.toggle) o.toggle(); else o.nodes[0].click(); }
});
