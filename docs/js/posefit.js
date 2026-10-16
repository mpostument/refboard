/* A photo's pose onto the wooden figure (FORM_RIG in js/forms-models.js).

   The pose model (js/vision.js) gives 33 landmarks in metres, in 3D, with the
   hip's midpoint as the origin. The figure is not made of points but of
   joints that turn - each [bend, twist, lean], about its own x, y and z, in
   the order x then y then z (Euler 'XYZ', as the rig applies them) - so the
   fit goes down the body, joint by joint, and each time asks: what turn of
   this joint, inside the one above, points the bone where the photo's bone
   points?

   A bone points along its joint's -y (a limb runs down), so the direction in
   the parent's frame gives bend and lean at once:
       Rx(bend) Rz(lean) (0,-1,0) = (sin lean, -cos lean cos bend, -cos lean sin bend)
   and a direction says nothing of the twist about the bone itself. Where the
   next bone fixes it - an elbow only folds one way, so the upper arm must be
   twisted until the forearm lies in the plane the elbow folds in - it is
   found by search; everywhere else it is left at 0. (The rig turns by x, then
   y, then z each about the joint's own moved axes, so the twist is about the
   bone and lean is felt after it: the search runs over turns about the bone,
   not over the y angle, which would break where the bone lies along x.)

   The torso and the neck have no single bone to read: the spine and the chest
   share the turn from the hips to the shoulders equally (a half-rotation
   each, so two of them make the whole), and the neck and head share the
   turn from the shoulders to the ears.

   Coordinates: the landmarks are x right, y DOWN, z away from the camera; the
   figure's are x to its left, y up, z the way it faces - so a person facing
   the camera is (x, -y, -z). Everything here is plain arrays, no three.js. */

const PF_RAD = Math.PI / 180;
const PF_VIS = 0.4; // a landmark the model is less sure of than this is not used

// ---- tiny vector / 3x3 matrix kit (row-major, 9 numbers)
const pfSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const pfDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const pfCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pfLen = a => Math.hypot(a[0], a[1], a[2]);
const pfNorm = a => { const l = pfLen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const pfMul = (A, B) => { const M = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return M; };
const pfT = A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
const pfApply = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const pfRx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const pfRy = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const pfRz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
// The matrix of a joint's [bend, twist, lean] in degrees: Rx Ry Rz.
const pfEuler = ([b, t, l]) => pfMul(pfMul(pfRx(b * PF_RAD), pfRy(t * PF_RAD)), pfRz(l * PF_RAD));
// [bend, twist, lean] in degrees from a matrix (three.js's XYZ decomposition).
function pfAngles(m) {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])));
  const x = Math.abs(m[2]) < 0.9999999 ? Math.atan2(-m[5], m[8]) : Math.atan2(m[7], m[4]);
  const z = Math.abs(m[2]) < 0.9999999 ? Math.atan2(-m[1], m[0]) : 0;
  return [x / PF_RAD, y / PF_RAD, z / PF_RAD];
}
// A frame whose x axis is `x` and whose y axis is as near `y` as is square to x; columns x, y, z.
function pfFrame(x, y) {
  const X = pfNorm(x), yo = pfSub(y, X.map(v => v * pfDot(X, y))), Y = pfNorm(yo), Z = pfCross(X, Y);
  return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
}
// Half of a rotation, about its own axis: applied twice it is the whole.
function pfHalf(m) {
  const tr = m[0] + m[4] + m[8], ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (ang < 1e-6) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let ax;
  if (Math.PI - ang < 1e-3) { // a half turn: the axis is the column with the most in it
    const d = [m[0], m[4], m[8]], k = d.indexOf(Math.max(...d));
    ax = pfNorm([0, 1, 2].map(i => i === k ? (m[k * 3 + k] + 1) / 2 : m[i * 3 + k] / 2));
  } else ax = pfNorm([m[7] - m[5], m[2] - m[6], m[3] - m[1]]);
  // A quaternion of half-angle h turns by 2h: half the rotation is a quarter of the angle.
  const h = ang / 4, s = Math.sin(h), c = Math.cos(h), [x, y, z] = ax.map(v => v * s);
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * c), 2 * (x * z + y * c),
    2 * (x * y + z * c), 1 - 2 * (x * x + z * z), 2 * (y * z - x * c),
    2 * (x * z - y * c), 2 * (y * z + x * c), 1 - 2 * (x * x + y * y)];
}

// The smallest rotation that takes -y to `d`: bend and lean only, no twist.
function pfBone(d) {
  const lean = Math.asin(Math.max(-1, Math.min(1, d[0])));
  return pfMul(pfRx(Math.atan2(-d[2], -d[1])), pfRz(lean));
}
// A turn of `phi` about the axis `k` (Rodrigues).
function pfAbout(k, phi) {
  const [x, y, z] = k, c = Math.cos(phi), s = Math.sin(phi), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}

/* The joint's turn that points -y along `d1` AND lets the next bone `d2` (both
   in the parent's frame) lie in the plane the elbow or the knee folds in: its
   local x is 0, and it folds the right way (`fold`: +1 toward +z, an elbow; -1
   toward -z, a knee). Any turn that points the bone at d1 is the smallest one
   turned about the bone itself (the twist), so the twist is searched, a degree
   at a time, for the least of them that folds right. Returns the matrix. */
function pfJoint(d1, d2, fold) {
  const R0 = pfBone(d1);
  let best = R0, bestCost = Infinity;
  for (let t = -180; t <= 180; t++) {
    const M = pfMul(pfAbout(d1, t * PF_RAD), R0), f = pfApply(pfT(M), d2);
    const cost = Math.abs(f[0]) + (f[2] * fold < 0 ? 0.5 : 0) + Math.abs(t) * 0.0004;
    if (cost < bestCost) { bestCost = cost; best = M; }
  }
  return best;
}

/* The figure's pose from a photo's landmarks.
   `lm` is the pose model's worldLandmarks for one person (33 of {x, y, z,
   visibility}). Returns { pose, rx, ry, rz }: the joints (a joint whose
   landmarks the model could not see is left out, and so stays at rest) and the
   turn of the figure as a whole - a person seen from the side is a figure
   turned to the side. Null when the hips and shoulders are not there. */
function fitFigurePose(lm) {
  const P = i => lm[i] && (lm[i].visibility === undefined || lm[i].visibility >= PF_VIS) ? [lm[i].x, -lm[i].y, -lm[i].z] : null;
  const A = { lSh: P(11), rSh: P(12), lHip: P(23), rHip: P(24) };
  if (!A.lSh || !A.rSh || !A.lHip || !A.rHip) return null;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const hips = mid(A.lHip, A.rHip), neck = mid(A.lSh, A.rSh), up = pfNorm(pfSub(neck, hips));
  const pose = {};
  const put = (name, [b, t, l]) => { pose[name] = [b, t, l].map(a => Math.round(a * 10) / 10); };

  // The figure as a whole: its x along the hips; its y up - unless the body lies
  // down, when the torso says which way is up.
  const standing = Math.abs(up[1]) > 0.5;
  const R0 = pfFrame(pfSub(A.lHip, A.rHip), standing ? [0, 1, 0] : up);
  const [rx, ry, rz] = pfAngles(R0);

  // Spine and chest: the turn from the hips to the shoulders, half each.
  const Rc = pfFrame(pfSub(A.lSh, A.rSh), up);
  const Hs = pfHalf(pfMul(pfT(R0), Rc));
  put('spine', pfAngles(Hs)); put('chest', pfAngles(Hs));
  const Rchest = pfMul(pfMul(R0, Hs), Hs);

  // Neck and head: the turn from the shoulders to the ears, half each.
  const lEar = P(7), rEar = P(8);
  if (lEar && rEar) {
    const Rh = pfFrame(pfSub(lEar, rEar), pfSub(mid(lEar, rEar), neck));
    const Hh = pfHalf(pfMul(pfT(Rchest), Rh));
    put('neck', pfAngles(Hh)); put('head', pfAngles(Hh));
  }

  // A limb: the bone from `a` to `b` in the frame `R` of the joint above, then the
  // next bone from `b` to `c` (the elbow or the knee folds one way only).
  const limb = (side, upper, lower, R, a, b, c, fold) => {
    if (!a || !b) return null;
    const d1 = pfApply(pfT(R), pfNorm(pfSub(b, a)));
    if (!c) { const M = pfBone(d1); put(`${upper}.${side}`, pfAngles(M)); return pfMul(R, M); }
    const d2 = pfApply(pfT(R), pfNorm(pfSub(c, b)));
    const M = pfJoint(d1, d2, fold);
    put(`${upper}.${side}`, pfAngles(M));
    const Ru = pfMul(R, pfEuler(pfAngles(M)));
    const f = pfApply(pfT(Ru), pfNorm(pfSub(c, b)));
    const bend2 = Math.atan2(-f[2], -f[1]);
    put(`${lower}.${side}`, [bend2 / PF_RAD, 0, 0]);
    return pfMul(Ru, pfRx(bend2));
  };
  for (const [side, sh, el, wr, hip, kn, an, toe] of [['L', 11, 13, 15, 23, 25, 27, 31], ['R', 12, 14, 16, 24, 26, 28, 32]]) {
    limb(side, 'upperArm', 'forearm', Rchest, P(sh), P(el), P(wr), +1);
    const Rshin = limb(side, 'thigh', 'shin', R0, P(hip), P(kn), P(an), -1);
    // The foot points along +z (its toes): bend raises or lowers them, twist turns them out.
    const t = P(toe), a = P(an);
    if (Rshin && t && a) {
      const d = pfApply(pfT(Rshin), pfNorm(pfSub(t, a)));
      const twist = Math.max(-40, Math.min(40, Math.asin(Math.max(-1, Math.min(1, d[0]))) / PF_RAD));
      put(`foot.${side}`, [Math.atan2(-d[1], d[2]) / PF_RAD, twist, 0]);
    }
  }
  return { pose, rx: Math.round(rx * 10) / 10, ry: Math.round(ry * 10) / 10, rz: Math.round(rz * 10) / 10 };
}

/* The same fit run forward: where each bone points when the figure is put in
   `fit`. For checking a fit against the photo's own directions. Returns the
   unit directions (in the figure's frame, y up) of the named bones. */
function figureBones(fit) {
  const p = fit.pose, ang = j => p[j] || [0, 0, 0];
  const R0 = pfEuler([fit.rx, fit.ry, fit.rz]);
  const Rchest = pfMul(pfMul(R0, pfEuler(ang('spine'))), pfEuler(ang('chest')));
  const out = {};
  for (const s of ['L', 'R']) {
    const Ru = pfMul(Rchest, pfEuler(ang(`upperArm.${s}`)));
    out[`upperArm.${s}`] = pfApply(Ru, [0, -1, 0]);
    out[`forearm.${s}`] = pfApply(pfMul(Ru, pfEuler(ang(`forearm.${s}`))), [0, -1, 0]);
    const Rt = pfMul(R0, pfEuler(ang(`thigh.${s}`)));
    out[`thigh.${s}`] = pfApply(Rt, [0, -1, 0]);
    out[`shin.${s}`] = pfApply(pfMul(Rt, pfEuler(ang(`shin.${s}`))), [0, -1, 0]);
  }
  return out;
}
