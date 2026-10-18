/* A character's actions (Game assets, ROADMAP phase 4): what the 3D figure is set to for each
   frame of an idle, a walk, a run, an attack or a hurt, and the strip the frames are laid out in.
   Pure - no figure, no model: assets.js hands each pose to the figure, takes a depth map of it and
   draws that, so everything here can be tested alone.

   A pose is the figure's own: { joint: [bend, twist, lean] } in degrees (forms-models.js,
   FORM_POSES). Bend is about the x axis, which is the swing of a limb in a side view: a negative
   thigh bend is the leg forward, a negative upper-arm bend is the arm forward, a positive shin bend
   is the knee folding back. A joint a pose does not name is 0, the figure standing. */

const CHAR_FRAMES = [4, 6, 8];   // how many frames a cycle is drawn in: the slider's three stops

const CHAR_ACTIONS = [
  { id: 'own', label: 'As set in Forms', hint: 'The pose you set in 3D forms, turned to the directions below' },
  { id: 'idle', label: 'Idle', frames: false, hint: 'Standing - one picture, facing right' },
  { id: 'walk', label: 'Walk', frames: true, hint: 'A walk cycle, drawn in 4, 6 or 8 frames that loop' },
  { id: 'run', label: 'Run', frames: true, hint: 'A run cycle: leaning in, knees high, arms bent' },
  { id: 'attack', label: 'Attack', frames: true, hint: 'A swing: ready, wind-up, strike, follow-through - plays once' },
  { id: 'hurt', label: 'Hurt', frames: false, hint: 'Thrown back by a hit - one picture' },
];
const charAction = id => CHAR_ACTIONS.find(a => a.id === id) || CHAR_ACTIONS[0];

// What the model is told the figure is doing, in place of "standing".
const CHAR_ACT_WORDS = {
  idle: 'standing', walk: 'walking', run: 'running, mid-stride',
  attack: 'attacking, fighting stance', hurt: 'recoiling, flinching, in pain, grimacing',
};

const CHAR_STAND = { 'upperArm.L': [0, 0, 8], 'upperArm.R': [0, 0, -8], 'forearm.L': [-12, 0, 0], 'forearm.R': [-12, 0, 0] };

/* A cycle at phase `a` (radians; 0 = the left leg furthest forward, the right arm forward). The legs
   run in opposite phase, an arm opposite its leg, and a knee folds only while its leg swings
   forward - from behind the body to in front of it - which is where a walker's foot clears the
   ground. `k` holds the three things that make a run a run and not a quick walk. */
function charCycle(a, k) {
  const c = Math.cos(a), s = Math.sin(a), up = x => Math.max(0, x);
  return {
    spine: [k.lean, 0, 0], chest: [0, k.twist * c, 0], head: [-k.lean * 0.6, -k.twist * 0.8 * c, 0],
    'thigh.L': [k.thighMid - k.thigh * c, 0, 0], 'thigh.R': [k.thighMid + k.thigh * c, 0, 0],
    'shin.L': [k.knee + k.fold * up(-s), 0, 0], 'shin.R': [k.knee + k.fold * up(s), 0, 0],
    'foot.L': [4 - 14 * c, 0, 0], 'foot.R': [4 + 14 * c, 0, 0],
    'upperArm.L': [k.arm * c, 0, 6], 'upperArm.R': [-k.arm * c, 0, -6],
    'forearm.L': [k.elbow - k.bend * up(-c), 0, 0], 'forearm.R': [k.elbow - k.bend * up(c), 0, 0],
  };
}
const CHAR_WALK = { lean: 4, twist: 10, thighMid: -6, thigh: 22, knee: 8, fold: 40, arm: 25, elbow: -12, bend: 22 };
const CHAR_RUN = { lean: 14, twist: 16, thighMid: -12, thigh: 42, knee: 22, fold: 85, arm: 45, elbow: -85, bend: 12 };

/* An attack, a right-handed swing, as the four poses it is made of; the frames between them are
   found by charBlend. Ready, wind-up (the arm back over the shoulder, the chest wound the other
   way), strike (the chest unwound, the weight forward), follow-through (the arm swung down past the
   hip). */
const CHAR_ATTACK = [
  { spine: [2, 0, 0], 'thigh.L': [-12, 0, 0], 'thigh.R': [8, 0, 0], 'shin.R': [14, 0, 0],
    'upperArm.R': [-40, 0, -8], 'forearm.R': [-70, 0, 0], 'upperArm.L': [-10, 0, 14], 'forearm.L': [-30, 0, 0] },
  { spine: [-6, 0, 0], chest: [0, -25, 0], head: [0, 12, 0], 'thigh.L': [-8, 0, 0], 'thigh.R': [18, 0, 0], 'shin.R': [30, 0, 0],
    'upperArm.R': [-150, 0, -20], 'forearm.R': [-60, 0, 0], 'upperArm.L': [-20, 0, 24], 'forearm.L': [-40, 0, 0] },
  { spine: [14, 0, 0], chest: [0, 30, 0], head: [8, -14, 0], 'thigh.L': [-38, 0, 0], 'shin.L': [20, 0, 0], 'thigh.R': [20, 0, 0], 'shin.R': [22, 0, 0],
    'upperArm.R': [-70, 0, -4], 'forearm.R': [-10, 0, 0], 'upperArm.L': [20, 0, 18], 'forearm.L': [-20, 0, 0] },
  { spine: [22, 0, 0], chest: [0, 30, 0], head: [12, -10, 0], 'thigh.L': [-34, 0, 0], 'shin.L': [26, 0, 0], 'thigh.R': [16, 0, 0], 'shin.R': [18, 0, 0],
    'upperArm.R': [10, 0, -30], 'forearm.R': [-8, 0, 0], 'upperArm.L': [24, 0, 20], 'forearm.L': [-20, 0, 0] },
];

const CHAR_HURT = {
  spine: [-25, 0, 0], chest: [-18, 0, 0], head: [-25, 0, 0],
  'upperArm.L': [50, 0, 45], 'forearm.L': [-40, 0, 0], 'upperArm.R': [48, 0, -45], 'forearm.R': [-45, 0, 0],
  'thigh.L': [-24, 0, 0], 'shin.L': [45, 0, 0], 'thigh.R': [20, 0, 0], 'shin.R': [16, 0, 0], 'foot.R': [25, 0, 0],
};

// Poses `a` and `b`, `t` of the way from one to the other, joint by joint (a missing joint is 0).
function charBlend(a, b, t) {
  const out = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const p = a[j] || [0, 0, 0], q = b[j] || [0, 0, 0];
    out[j] = p.map((v, i) => Math.round((v + (q[i] - v) * t) * 10) / 10);
  }
  return out;
}

/* The poses of `action` in `n` frames (n is one of CHAR_FRAMES; an idle and a hurt are one picture
   whatever n). A cycle takes n steps round the circle and stops short of the start, so that the
   loop's last frame is followed by the first and not by a copy of it. An attack runs from the first
   key to the last and is not a loop. Anything else is null: the pose is the figure's own. */
function charActionPoses(action, n = 6) {
  const frames = CHAR_FRAMES.includes(Number(n)) ? Number(n) : 6;
  if (action === 'idle') return [{ ...CHAR_STAND }];
  if (action === 'hurt') return [{ ...CHAR_HURT }];
  if (action === 'walk' || action === 'run') {
    const k = action === 'walk' ? CHAR_WALK : CHAR_RUN;
    return Array.from({ length: frames }, (_, i) => charCycle(2 * Math.PI * i / frames, k));
  }
  if (action === 'attack') {
    const last = CHAR_ATTACK.length - 1;
    return Array.from({ length: frames }, (_, i) => {
      const at = last * i / (frames - 1), lo = Math.min(Math.floor(at), last - 1);
      return charBlend(CHAR_ATTACK[lo], CHAR_ATTACK[lo + 1], at - lo);
    });
  }
  return null;
}

/* The frames side by side in one picture, left to right, each in a cell of the size of the largest
   (assetAlign has already made them one size, so the cells are the frames and the Sprite Editor's
   "grid by cell size" cuts it back exactly). No gap: a gap would be a different cell size. */
function charStrip(canvases) {
  const list = canvases.filter(Boolean);
  if (!list.length) return null;
  const w = Math.max(...list.map(c => c.width)), h = Math.max(...list.map(c => c.height));
  const out = Object.assign(document.createElement('canvas'), { width: w * list.length, height: h }), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  list.forEach((c, i) => g.drawImage(c, i * w + Math.round((w - c.width) / 2), h - c.height));
  return out;
}
