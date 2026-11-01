/* refboard - The MediaPipe models the library sort uses (js/sort.js): the face finder and the classifier.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const POSE_LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';

const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
// The MediaPipe tasks this page uses - one runtime, fetched once, shared by
// both; each model is fetched the first time its button is pressed.
// The classifier names what a picture is of - 1000 ImageNet classes - for
// sorting uploads (js/sort.js); about 5 MB.
const CLASSIFY_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/int8/1/efficientnet_lite0.tflite';
const VISION_TASKS = {
  face: { cls: 'FaceLandmarker', model: FACE_MODEL, opts: { numFaces: 4 } },
  // CPU only: on the GPU delegate this quantized model's output comes back
  // as floats, and MediaPipe's dequantizing step refuses them.
  classify: { cls: 'ImageClassifier', model: CLASSIFY_MODEL, opts: { maxResults: 5 }, cpu: true },
};
const visionModels = {}, visionLoading = {};

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
function visionCanvas(img, pad = 0) {
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
  c.width = Math.round(W * (1 + 2 * pad)); c.height = Math.round(H * (1 + 2 * pad));
  const g = c.getContext('2d');
  if (pad) { g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, W * pad, H * pad, W, H);
  return c;
}

const LOOMIS_U = 2 / 3, LOOMIS_SIDE = Math.sqrt(1 - LOOMIS_U * LOOMIS_U);
const FM = { brow: 9, nose: 2, chin: 152, rEye: 33, lEye: 263, top: 10 };

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
