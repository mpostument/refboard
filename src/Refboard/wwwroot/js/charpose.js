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

/* ---- A cycle drawn on one sheet ----
   SDXL does not keep a person from one picture to the next: six frames drawn one by one were six
   different girls (real run, 2026-10-18: skirt, hair, armour and sword all changed). Drawn together,
   in one picture, as the cells of a sheet, it is the same girl. So the frames' depth maps are laid
   in a grid on one control picture, drawn once, and the picture is cut back into cells. The server
   takes a free size only without a picture, so the sheet is the landscape shape (1216 x 832). */
const CHAR_SHEET = [1216, 832];

/* The grid of `n` frames on the sheet: columns and rows, and the cell's size. 4 frames are 2 x 2,
   5 or 6 are 3 x 2, 7 or 8 are 4 x 2: the cells stay near the figure's own proportions, so that she
   is drawn as large as the sheet allows. */
function charSheetLayout(n) {
  const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols);
  return { cols, rows, w: CHAR_SHEET[0] / cols, h: CHAR_SHEET[1] / rows };
}

const CHAR_CELL_INSET = 0.03;   // a cell is cut this much (of its shorter side) in from each edge: where a panel border or a gutter would be

/* The sheet picture cut into its `n` cells, in reading order (left to right, top to bottom), as
   canvases. The edges are rounded to whole pixels, so neighbours neither overlap nor leave a gap;
   `inset` (a share of the cell's shorter side) is then taken off every side, so what the model drew
   at the cells' edges - a border, a white gutter - is not in the cell. */
function charSheetCells(sheet, n, inset = 0) {
  const { cols, rows } = charSheetLayout(n), cw = sheet.width / cols, ch = sheet.height / rows, ins = Math.round(inset * Math.min(cw, ch));
  return Array.from({ length: n }, (_, i) => {
    const x0 = Math.round((i % cols) * cw) + ins, x1 = Math.round((i % cols + 1) * cw) - ins;
    const y0 = Math.round(Math.floor(i / cols) * ch) + ins, y1 = Math.round((Math.floor(i / cols) + 1) * ch) - ins;
    const c = Object.assign(document.createElement('canvas'), { width: x1 - x0, height: y1 - y0 });
    c.getContext('2d').drawImage(sheet, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    return c;
  });
}

/* The figures of a sheet, found and not assumed. The sheet is asked for as n cells (charSheetLayout), and the model draws
   what it likes: a sheet asked for 6 poses came back as 10, in 5 columns, and cut as 3 x 2 it was figures sliced through,
   a boot with no leg and specks in the air (real run, 2026-10-18). So the figure's pixels (cutOut: whatever is not the
   background) are projected: the rows they fill make bands, and in each band the columns they fill make figures, read left
   to right, top to bottom. A gap narrower than SHEET_GAP of the sheet joins (a hand away from the body is still hers); a
   figure with under SHEET_SPECK of the biggest one's pixels is a speck. Each is cut out of the sheet with SHEET_PAD of
   its own size round it, so that its edge is background and assetCutFigure can find the key. More than n found: n of them,
   evenly spaced, so that a cycle drawn long is still a cycle. Returns { frames, found } (found: how many there were), or
   null when the sheet has no plain background (the cells of the layout are then the only thing to cut). */
const CHAR_SHEET_TRIES = 3;   // a sheet with the wrong number of figures is drawn again, with another seed, this many times in all
const SHEET_GAP = 0.015, SHEET_SPECK = 0.08, SHEET_PAD = 0.12;
function charSheetFigures(sheet, n) {
  const cut = cutOut(sheet, { trim: false, specks: false });
  if (!cut.found) return null;
  const w = sheet.width, h = sheet.height, a = cut.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  // [first, last] of every run of a profile above `min`, a run continuing over a gap of up to `gap`.
  const runs = (profile, gap, min) => {
    const out = [];
    for (let i = 0; i < profile.length; i++) {
      if (profile[i] <= min) continue;
      const last = out[out.length - 1];
      if (last && i - last[1] <= gap) last[1] = i; else out.push([i, i]);
    }
    return out;
  };
  const rows = new Uint32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > ASSET_ALPHA) rows[y]++;
  const boxes = [];
  for (const [y0, y1] of runs(rows, Math.max(6, Math.round(h * SHEET_GAP)), 2)) {
    const cols = new Uint32Array(w);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > ASSET_ALPHA) cols[x]++;
    for (const [x0, x1] of runs(cols, Math.max(6, Math.round(w * SHEET_GAP)), 0)) {
      let mass = 0;
      for (let x = x0; x <= x1; x++) mass += cols[x];
      boxes.push({ x0, x1, y0, y1, mass });
    }
  }
  const biggest = boxes.reduce((m, b) => Math.max(m, b.mass), 0), figures = boxes.filter(b => b.mass >= biggest * SHEET_SPECK);
  if (!figures.length) return null;
  const chosen = figures.length > n ? Array.from({ length: n }, (_, i) => figures[Math.floor(i * figures.length / n)]) : figures;
  const frames = chosen.map(b => {
    const pad = Math.round(SHEET_PAD * Math.max(b.x1 - b.x0, b.y1 - b.y0)), x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad);
    const x1 = Math.min(w, b.x1 + 1 + pad), y1 = Math.min(h, b.y1 + 1 + pad);
    const c = Object.assign(document.createElement('canvas'), { width: x1 - x0, height: y1 - y0 });
    c.getContext('2d').drawImage(sheet, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    return c;
  });
  return { frames, found: figures.length };
}
