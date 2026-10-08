/* refboard - 3D forms: Japanese settings. The places anime keeps coming back
   to - a classroom, a train carriage, a lane with power poles, a shrine - as
   simple volumes round the forms: boxes, cylinders, a gable, a plane. One of
   the classic scripts index.html loads in order; see the note there.

   A setting is a list of parts, in METRES (a figure is 1.7 of them, 4 of the
   forms' units - SETTING_UNIT). x runs right, y up, z toward the camera's
   starting side, and the forms stand at the origin, so a setting is laid out
   round the middle of its floor. Each part names a colour from the setting's
   palette; formSettingGroup() turns the list into one merged mesh per
   colour, so a street of three hundred boxes is a handful of draw calls.

   Walls, floors and ceilings are single planes that face INTO the room, and
   a plane is drawn from its front only. Orbit round the room and the walls
   between you and it face away, so they vanish: you always look in over a
   cut-away, like a model of a room, without any code deciding which wall to
   hide. They receive shadows but cast none, so the light comes in through
   them the same way. */
"use strict";

const SETTING_UNIT = 4 / 1.7; // the forms' units in a metre

/* ---- the little vocabulary the settings are written in. Every helper
   returns a part (or a list of parts) { k: kind, c: colour name, at, s:
   size, r: [rx, ry, rz] in degrees } - see settingPartGeometry(). Boxes,
   cylinders, gables and pyramids stand ON y (their base is at it), planes
   are placed by their middle. */
const sB = (c, x, y, z, w, h, d, ry = 0, rz = 0) => ({ k: 'box', c, at: [x, y, z], s: [w, h, d], r: [0, ry, rz] });
// A cylinder, or a cone when `top` (the top's radius against the bottom's) is
// small; rx 90 lays it down along +z, as a pole or a disc on a wall.
const sC = (c, x, y, z, rad, h, top = 1, rx = 0, ry = 0, rz = 0) => ({ k: 'cyl', c, at: [x, y, z], s: [rad, h, rad], top, r: [rx, ry, rz] });
// A gable: a triangle w wide and h tall, d long - a roof with its ridge along z.
const sG = (c, x, y, z, w, h, d, ry = 0) => ({ k: 'gable', c, at: [x, y, z], s: [w, h, d], r: [0, ry, 0] });
const sY = (c, x, y, z, w, h, d, ry = 0) => ({ k: 'pyr', c, at: [x, y, z], s: [w, h, d], r: [0, ry, 0] });
const sT = (c, x, y, z, R, tube, ry = 0) => ({ k: 'tor', c, at: [x, y, z], s: [1, 1, 1], R, tube, r: [0, ry, 0] });
// A plane w by h, facing `face`: a number is a wall turned that many degrees
// (0 faces +z, 90 faces +x, 180 faces -z, 270 faces -x; y is its foot), or
// 'up' for a floor and 'down' for a ceiling (y is its height).
const sP = (c, x, y, z, w, h, face) => face === 'up' ? { k: 'plane', c, at: [x, y, z], s: [w, h, 1], r: [-90, 0, 0], flat: true }
  : face === 'down' ? { k: 'plane', c, at: [x, y, z], s: [w, h, 1], r: [90, 0, 0], flat: true }
  : { k: 'plane', c, at: [x, y, z], s: [w, h, 1], r: [0, face, 0], wall: true };
/* A wire between two points, hanging in a curve `sag` deep: a chain of thin
   boxes, since a catenary is only a few straight pieces to the eye. */
function sW(c, a, b, sag = 0.3, t = 0.014, n = 8) {
  const out = [], at = u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u];
  for (let i = 0; i < n; i++) {
    const p = at(i / n), q = at((i + 1) / n);
    const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], len = Math.hypot(...d);
    out.push({ k: 'seg', c, at: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], s: [len, t, t], dir: d.map(v => v / len) });
  }
  return out;
}
const sRange = (from, to, step) => { const o = []; for (let v = from; v <= to + 1e-9; v += step) o.push(+v.toFixed(4)); return o; };

/* ---- the classroom. 8 m across, 9 deep, 3 high: the blackboard wall at
   the back, the window wall on the left, rows of desks with an aisle down
   the middle, where the forms stand. */
function buildClassroom() {
  const p = [], H = 3;
  p.push(sP('floor', 0, 0.003, -0.5, 8, 9, 'up'), sP('ceiling', 0, H, -0.5, 8, 9, 'down'));
  p.push(sP('wall', 0, 0, -5, 8, H, 0), sP('wall', -4, 0, -0.5, 9, H, 90),
    sP('wall', 4, 0, -0.5, 9, H, 270), sP('wall', 0, 0, 4, 8, H, 180));
  // A skirting board along the two walls you see.
  p.push(sB('trim', 0, 0, -4.97, 8, 0.1, 0.06), sB('trim', -3.97, 0, -0.5, 0.06, 0.1, 9));
  // The blackboard, its frame, the chalk tray, the clock, the notice board.
  // What hangs ON a wall is a plane laid a few millimetres in front of it,
  // facing the same way - so it, too, is gone when the wall is.
  p.push(sP('board', 0, 0.9, -4.996, 3.8, 1.2, 0), sP('trim', 0, 2.1, -4.992, 3.9, 0.06, 0),
    sP('trim', 0, 0.84, -4.992, 3.9, 0.06, 0), sP('trim', -1.92, 0.9, -4.992, 0.06, 1.2, 0),
    sP('trim', 1.92, 0.9, -4.992, 0.06, 1.2, 0), sB('chalk', 0, 0.8, -4.93, 3.6, 0.04, 0.12),
    sC('clock', 0, 2.55, -5, 0.17, 0.05, 1, 90), sP('cork', 3.0, 1.1, -4.996, 1.1, 0.8, 0));
  // The corridor door on the right wall, seen from the far side of the room.
  p.push(sP('door', 3.996, 0, 2, 1.7, 2.0, 270), sP('glass', 3.992, 1.15, 2, 1.3, 0.6, 270));
  // Four windows on the left, each with its bars and sill, and a curtain.
  for (const z of [-3.4, -1.3, 0.8, 2.9]) {
    p.push(sP('glass', -3.996, 0.9, z, 1.8, 1.3, 90), sP('sash', -3.992, 0.9, z, 0.05, 1.3, 90),
      sP('sash', -3.992, 0.9, z - 0.9, 0.05, 1.3, 90), sP('sash', -3.992, 0.9, z + 0.9, 0.05, 1.3, 90),
      sP('sash', -3.992, 0.9, z, 1.85, 0.05, 90), sP('sash', -3.992, 2.15, z, 1.85, 0.05, 90),
      sB('trim', -3.9, 0.86, z, 0.14, 0.04, 2.0), sP('curtain', -3.988, 0.45, z + 0.85, 0.5, 2.0, 90));
  }
  // The teacher's platform, desk and lectern.
  p.push(sB('platform', 0, 0, -4.35, 7.6, 0.14, 1.3),
    sB('desk', -1.3, 0.14 + 0.72, -4.3, 1.5, 0.04, 0.7), sB('metal', -1.95, 0.14, -4.3, 0.05, 0.72, 0.6),
    sB('metal', -0.65, 0.14, -4.3, 0.05, 0.72, 0.6), sB('metal', -1.3, 0.14 + 0.35, -4.58, 1.4, 0.36, 0.03),
    sB('platform', 1.8, 0.14, -4.2, 0.65, 1.0, 0.5));
  // Pupils' desks: a top, two side frames, a shelf under it; a chair behind.
  for (const z of [-2.8, -1.7, -0.6, 0.5, 1.6]) for (const x of [-2.8, -1.9, -1.0, 1.0, 1.9, 2.8]) {
    p.push(sB('desk', x, 0.7, z, 0.6, 0.03, 0.45), sB('metal', x - 0.27, 0, z, 0.03, 0.7, 0.4),
      sB('metal', x + 0.27, 0, z, 0.03, 0.7, 0.4), sB('chalk', x, 0.5, z - 0.03, 0.5, 0.16, 0.34),
      sB('chair', x, 0.42, z + 0.58, 0.38, 0.03, 0.38), sB('chair', x, 0.45, z + 0.78, 0.38, 0.22, 0.03),
      sB('metal', x - 0.16, 0, z + 0.45, 0.03, 0.42, 0.03), sB('metal', x + 0.16, 0, z + 0.45, 0.03, 0.42, 0.03),
      sB('metal', x - 0.16, 0, z + 0.7, 0.03, 0.42, 0.03), sB('metal', x + 0.16, 0, z + 0.7, 0.03, 0.42, 0.03));
  }
  return p;
}

/* ---- a train carriage, a commuter train's: 2.9 m across, 18 long, 2.3
   high; a bench along each wall, a door in the middle, hanging straps. */
function buildTrain() {
  const p = [], H = 2.3, X = 1.45;
  p.push(sP('floor', 0, 0.003, 0, 2.9, 18, 'up'), sP('ceiling', 0, H, 0, 2.9, 18, 'down'),
    sP('wall', -X, 0, 0, 18, H, 90), sP('wall', X, 0, 0, 18, H, 270),
    sP('wall', 0, 0, -9, 2.9, H, 0), sP('wall', 0, 0, 9, 2.9, H, 180));
  for (const side of [-1, 1]) {
    // Planes on the wall, in layers a few millimetres apart (see the
    // classroom): windows between the pillars, the door at the middle.
    const lean = -side * 8, a = side < 0 ? 90 : 270, at = n => side * (X - 0.004 * n);
    for (const z of [-7.4, -5.2, -3.0, 3.0, 5.2, 7.4]) {
      p.push(sP('glass', at(1), 0.95, z, 1.7, 0.95, a), sP('frame', at(2), 0.95, z, 1.8, 0.05, a),
        sP('frame', at(2), 1.9, z, 1.8, 0.05, a), sP('frame', at(2), 0.95, z - 0.9, 0.05, 1.0, a),
        sP('frame', at(2), 0.95, z + 0.9, 0.05, 1.0, a));
    }
    p.push(sP('door', at(1), 0, -0.68, 0.66, 1.95, a), sP('door', at(1), 0, 0.68, 0.66, 1.95, a),
      sP('glass', at(2), 1.1, -0.68, 0.4, 0.6, a), sP('glass', at(2), 1.1, 0.68, 0.4, 0.6, a),
      sP('frame', at(2), 0, 0, 0.07, 1.98, a));
    // A long bench each side of the door: base, cushion, a leaning back.
    for (const [z0, z1] of [[-8.7, -1.3], [1.3, 8.7]]) {
      const zc = (z0 + z1) / 2, len = z1 - z0;
      p.push(sB('seatbase', side * 1.17, 0, zc, 0.55, 0.3, len), sB('seat', side * 1.15, 0.3, zc, 0.5, 0.12, len),
        sB('seat', side * (X - 0.12), 0.4, zc, 0.12, 0.55, len, 0, lean));
    }
  }
  // Stanchions by the door, the grab rails along the ceiling, the straps.
  for (const x of [-0.85, 0.85]) for (const z of [-1.0, 1.0]) p.push(sC('pole', x, 0, z, 0.024, H));
  for (const x of [-0.55, 0.55]) {
    p.push(sC('pole', x, 1.95, -8.9, 0.018, 17.8, 1, 90));
    for (const z of sRange(-8.2, 8.2, 0.75)) p.push(sB('strap', x, 1.74, z, 0.012, 0.21, 0.012), sT('strap', x, 1.62, z, 0.07, 0.009, 90));
  }
  // The connecting door at the far end, and the near one.
  p.push(sP('frame', 0, 0, -8.996, 1.2, 2.05, 0), sP('door', 0, 0, -8.992, 1.1, 1.95, 0), sP('glass', 0, 1.15, -8.988, 0.7, 0.55, 0));
  return p;
}

/* ---- a house of a Japanese lane: a plaster body, a dark tiled gable, a
   window and a door on the road side, windows above for two floors.
   `side` is -1 for the left of the road, +1 for the right. */
function lanePartsHouse(side, z, d, w, floors, tone) {
  const p = [], xc = side * (3.6 + w / 2), h = floors * 3.0, face = side * 3.6, out = -side * 0.03;
  p.push(sB(tone, xc, 0, z, w, h, d), sG('roof', xc, h, z, w + 0.9, w * 0.22, d + 0.8));
  p.push(sB('door', face + out, 0, z - d * 0.25, 0.06, 2.0, 0.9), sB('trim', face + out, 2.0, z - d * 0.25, 0.14, 0.06, 1.1));
  p.push(sB('pane', face + out, 0.9, z + d * 0.18, 0.06, 1.2, 1.6), sB('trim', face + out, 0.84, z + d * 0.18, 0.12, 0.05, 1.8));
  for (let f = 1; f < floors; f++) for (const dz of [-0.28, 0.1, 0.38]) {
    p.push(sB('pane', face + out, f * 3.0 + 0.9, z + d * dz, 0.06, 1.2, 1.0), sB('trim', face + out, f * 3.0 + 0.84, z + d * dz, 0.12, 0.05, 1.2));
  }
  if (floors > 1) p.push(sB('trim', face + out * 5, 2.9, z, 0.3, 0.1, d)); // the eave between the floors
  return p;
}
/* ---- a lane: a 4 m road with a white line each side, block walls, houses,
   power poles that run off with their wires, a vending machine, a traffic
   mirror, and a block of flats closing the far end. */
function buildStreet() {
  const p = [], z0 = -54, z1 = 12, zc = (z0 + z1) / 2, len = z1 - z0;
  p.push(sP('road', 0, 0.003, zc, 4, len, 'up'), sP('line', -1.75, 0.006, zc, 0.1, len, 'up'), sP('line', 1.75, 0.006, zc, 0.1, len, 'up'));
  for (const s of [-1, 1]) p.push(sB('block', s * 2.4, 0, zc, 0.16, 1.15, len), sB('blockcap', s * 2.4, 1.15, zc, 0.22, 0.05, len));
  for (const [z, d, w, fl, tone] of [[-6, 7, 6, 2, 'plaster'], [-14.5, 8, 5.5, 2, 'plaster2'], [-23.5, 8, 6.5, 1, 'plaster'], [-32.5, 8, 6, 2, 'plaster2'], [-42, 8, 6, 2, 'plaster']]) {
    p.push(lanePartsHouse(-1, z, d, w, fl, tone));
  }
  for (const [z, d, w, fl, tone] of [[-3, 6, 5.5, 2, 'plaster2'], [-11.5, 8, 6, 1, 'plaster'], [-20.5, 9, 6, 2, 'plaster'], [-30.5, 9, 5.5, 2, 'plaster2'], [-40, 8, 6.5, 1, 'plaster']]) {
    p.push(lanePartsHouse(1, z, d, w, fl, tone));
  }
  // The block of flats across the end: floors of windows and balconies.
  p.push(sB('flats', 0, 0, -58, 22, 12, 6));
  for (const y of [1.2, 4.2, 7.2, 10.0]) for (const x of sRange(-9, 9, 3)) p.push(sB('pane', x, y, -54.97, 1.6, 1.3, 0.06), sB('trim', x, y - 0.1, -54.93, 2.0, 0.08, 0.2));
  // The power poles: concrete, tapering, two crossarms; three wires and two
  // telephone lines between each pair; a transformer on the middle ones.
  const poles = [6, -8, -22, -36, -50];
  for (const z of poles) {
    p.push(sC('pole', 2.1, 0, z, 0.12, 10, 0.65), sB('arm', 2.1, 8.7, z, 1.9, 0.08, 0.1), sB('arm', 2.1, 8.1, z, 1.6, 0.08, 0.1));
    for (const dx of [-0.8, 0, 0.8]) p.push(sC('insul', 2.1 + dx, 8.78, z, 0.035, 0.14));
  }
  poles.slice(1).forEach((z, i) => {
    const a = poles[i];
    for (const dx of [-0.8, 0, 0.8]) p.push(sW('wire', [2.1 + dx, 8.95, a], [2.1 + dx, 8.95, z], 0.45));
    for (const dx of [-0.65, 0.65]) p.push(sW('wire', [2.1 + dx, 8.3, a], [2.1 + dx, 8.3, z], 0.5));
  });
  for (const z of [-8, -36]) p.push(sC('xfmr', 1.72, 7.1, z, 0.22, 0.6), sB('pole', 1.9, 7.6, z, 0.3, 0.05, 0.05));
  // A traffic mirror at a corner, a vending machine against the wall.
  p.push(sC('post', -2.2, 0, -1.5, 0.04, 2.7), sC('mirrorframe', -2.2, 2.55, -1.47, 0.34, 0.05, 1, 90), sC('mirror', -2.2, 2.55, -1.42, 0.29, 0.03, 1, 90));
  p.push(sB('vend', -3.1, 0, -1.2, 0.62, 1.8, 0.78), sB('vendface', -2.78, 0.35, -1.2, 0.03, 1.2, 0.62));
  return p;
}

/* ---- a shrine: a gravel approach with a torii across it, stone lanterns
   in pairs, cedars either side, and the hall at the end with its offering
   box and rope. */
function buildTorii(z) {
  const p = [];
  for (const x of [-2.1, 2.1]) p.push(sC('black', x, 0, z, 0.3, 0.45), sC('torii', x, 0.45, z, 0.22, 4.3, 0.84));
  p.push(sB('torii', 0, 3.55, z, 5.2, 0.24, 0.3), sB('torii', 0, 3.8, z, 0.2, 0.7, 0.26),
    sB('black', 0, 4.5, z, 5.8, 0.2, 0.42), sB('black', 0, 4.7, z, 5.4, 0.3, 0.56),
    sB('black', -2.95, 4.7, z, 1.3, 0.3, 0.56, 0, -9), sB('black', 2.95, 4.7, z, 1.3, 0.3, 0.56, 0, 9));
  return p;
}
function buildLantern(x, z) {
  return [sB('lantern', x, 0, z, 0.55, 0.14, 0.55), sC('lantern', x, 0.14, z, 0.13, 1.0), sB('lantern', x, 1.14, z, 0.42, 0.1, 0.42),
    sB('lanternlit', x, 1.24, z, 0.3, 0.38, 0.3), sB('lantern', x, 1.62, z, 0.5, 0.08, 0.5),
    sY('lanternroof', x, 1.7, z, 0.95, 0.35, 0.95), sC('lantern', x, 2.05, z, 0.05, 0.12)];
}
function buildShrine() {
  const p = [], z0 = -40, z1 = 10;
  p.push(sP('gravel', 0, 0.003, (z0 + z1) / 2, 3.4, z1 - z0, 'up'),
    sB('curb', -1.8, 0, (z0 + z1) / 2, 0.14, 0.14, z1 - z0), sB('curb', 1.8, 0, (z0 + z1) / 2, 0.14, 0.14, z1 - z0));
  p.push(buildTorii(-4));
  for (const z of [1.5, -9, -18, -26]) p.push(buildLantern(-2.7, z), buildLantern(2.7, z));
  // The hall: a stone base with steps, dark pillars, a plaster body, a big tiled gable.
  p.push(sB('stone', 0, 0, -36, 10, 0.7, 8), sB('stone', 0, 0, -31.4, 3.4, 0.46, 0.7), sB('stone', 0, 0, -30.8, 3.4, 0.23, 0.6),
    sB('wood', 0, 0.7, -37.2, 8.4, 3.4, 5.4), sB('plaster', 0, 0.7, -34.45, 6.8, 3.0, 0.1));
  for (const x of sRange(-4, 4, 2)) p.push(sC('pillar', x, 0.7, -33.7, 0.17, 3.5));
  p.push(sB('woodd', 0, 4.1, -33.7, 8.8, 0.18, 0.4), sG('roof', 0, 4.2, -36.5, 11.4, 3.4, 9.4),
    sB('roof', 0, 4.15, -36.5, 11.4, 0.1, 9.4));
  p.push(sB('woodd', 0, 0.7, -32.4, 1.7, 0.9, 0.7), sB('slat', 0, 1.6, -32.4, 1.7, 0.04, 0.7),
    sC('rope', -3.4, 3.35, -33.5, 0.07, 6.8, 1, 0, 0, -90), ...sRange(-3, 3, 1.5).map(x => sB('paper', x, 2.7, -33.5, 0.12, 0.6, 0.02)));
  // Cedars: a trunk and two cones, down both sides of the approach.
  let i = 0;
  for (const z of sRange(8, -38, 5.2)) for (const side of [-1, 1]) {
    const h = 7.5 + ((i++ * 37) % 5), x = side * (6.5 + ((i * 53) % 4)), r = 1.7 * h / 8;
    p.push(sC('trunk', x, 0, z, 0.35, 2.5, 0.8), sC('cedar', x, 1.6, z, r, h * 0.6, 0.02), sC('cedar', x, h * 0.4, z, r * 0.7, h * 0.6, 0.02));
  }
  return p;
}

/* Each setting: its name and hint for the panel; `build` the parts; `colours`
   the palette (sRGB); `reach` how far round the forms, in metres, the light's
   shadow map must cover to shadow the furniture; `depth` how far the farthest
   thing is from the middle (the haze starts beyond it); `stage` the sky, the ground and the dolly it
   suggests, which pickFormSetting() puts in only while those are still at the defaults. */
const FORM_SETTINGS = {
  none: { label: 'None', hint: 'Just the floor and the forms.' },
  classroom: { label: 'Classroom', build: buildClassroom, reach: 3.5, depth: 5.5, stage: { zoom: 1.7 },
    hint: 'A school classroom, 8 by 9 metres: the blackboard wall at the back, windows on the left, rows of desks on either side of an aisle.',
    colours: { floor: '#b48d5e', ceiling: '#efece4', wall: '#e6e2d4', trim: '#c9c1ac', board: '#33503f', chalk: '#a9a38f', clock: '#f0efe9',
      cork: '#b58b57', door: '#9eaea6', glass: '#cfe3ec', sash: '#9aa5ab', curtain: '#d9d1b6', platform: '#c7a77a',
      desk: '#d8c59b', metal: '#707a80', chair: '#b98f69' } },
  train: { label: 'Train carriage', build: buildTrain, reach: 2.6, depth: 9, stage: { zoom: 1.5 },
    hint: 'The inside of a commuter train, 2.9 metres wide: a bench along each wall, doors in the middle, straps hanging from the rails.',
    colours: { floor: '#8b8f94', ceiling: '#efede6', wall: '#d7d4c9', glass: '#bcd8e5', frame: '#8e9498', door: '#b7bcbf',
      seat: '#4c8a6a', seatbase: '#7b7f83', pole: '#cdd0d4', strap: '#767b80' } },
  street: { label: 'Lane', build: buildStreet, reach: 3.5, depth: 58,
    stage: { bg: '#aac8dc', groundColor: '#8b8e88', zoom: 2.2, yaw: 6, pitch: 14 },
    hint: 'A narrow residential lane: block walls, two-storey houses with dark tile roofs, power poles running off with their wires, a vending machine, a corner mirror.',
    colours: { road: '#5d5f63', line: '#e9e8e2', block: '#b9b6ae', blockcap: '#d3d0c8', plaster: '#e8e3d8', plaster2: '#d3cdbd',
      roof: '#474d53', door: '#7a5a43', trim: '#bdb6a6', pane: '#6e8191', flats: '#cfcdc6', arm: '#8a8c8e', insul: '#d9d4c7',
      wire: '#2c2e30', pole: '#8b8d8a', xfmr: '#8a8d90', post: '#4a4e52', mirrorframe: '#d8731c', mirror: '#cfe0e8',
      vend: '#2f5f9f', vendface: '#e8eef3' } },
  shrine: { label: 'Shrine', build: buildShrine, reach: 4, depth: 42,
    stage: { bg: '#b4cfd9', groundColor: '#9d9482', zoom: 2.4, yaw: 8, pitch: 10 },
    hint: 'A shrine approach: a vermilion torii, stone lanterns in pairs, cedars either side, and the hall at the end with its offering box and rope.',
    colours: { gravel: '#aaa59a', curb: '#8e8a80', torii: '#c9402a', black: '#2a2a2e', lantern: '#9d998f', lanternlit: '#d9d3bf',
      lanternroof: '#8a867c', stone: '#a49f94', wood: '#7d4b30', woodd: '#5e3a28', plaster: '#e6dfcd', pillar: '#b0432b',
      roof: '#454b50', slat: '#4a3020', rope: '#d7c9a3', paper: '#f3f0e6', trunk: '#58463a', cedar: '#2e4d37' } },
};

/* ---- parts into meshes. */
function settingPartGeometry(T, p) {
  let g;
  switch (p.k) {
    case 'cyl': g = new T.CylinderGeometry(p.top, 1, 1, 20).translate(0, 0.5, 0); break;
    case 'gable': {
      const sh = new T.Shape();
      sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 1); sh.closePath();
      g = new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
      break;
    }
    // Four sides, turned to stand square: a cone's corners are on the axes.
    case 'pyr': g = new T.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0); break;
    case 'tor': g = new T.TorusGeometry(p.R, p.tube, 6, 20); break;
    case 'plane': g = new T.PlaneGeometry(1, 1); if (p.wall) g.translate(0, 0.5, 0); break;
    case 'seg': g = new T.BoxGeometry(1, 1, 1); break;
    default: g = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  }
  const q = new T.Quaternion();
  if (p.k === 'seg') q.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(...p.dir));
  else q.setFromEuler(new T.Euler(...p.r.map(a => a * Math.PI / 180), 'YXZ'));
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p.at), q, new T.Vector3(...p.s)));
  // Merging wants every piece alike: unindexed, with the same three attributes.
  const flat = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(flat.attributes)) if (!['position', 'normal', 'uv'].includes(k)) flat.deleteAttribute(k);
  return flat;
}

/* A setting's group: one merged mesh per colour, built the first time it is
   wanted and kept - switching away and back costs nothing. Planes (walls,
   floors) go in meshes of their own that cast no shadow. Its materials are the
   forms' own kind, so the light, the soft shadow, the zones view and the cel
   shading all treat a wall as they treat a form; what they leave out is the
   contour lines and the occlusion, which are for forms. */
function formSettingGroup(T, id) {
  const F = forms;
  if (F.settings[id]) return F.settings[id];
  const def = FORM_SETTINGS[id], bins = new Map();
  for (const p of def.build().flat(Infinity)) {
    const key = p.c + (p.flat || p.wall ? '|plane' : '');
    if (!bins.has(key)) bins.set(key, { c: p.c, plane: !!(p.flat || p.wall), geos: [] });
    bins.get(key).geos.push(settingPartGeometry(T, p));
  }
  const group = new T.Group();
  group.scale.setScalar(SETTING_UNIT);
  group.userData.parts = [];
  for (const { c, plane, geos } of bins.values()) {
    const mesh = new T.Mesh(F.merge(geos), newFormMaterial());
    mesh.castShadow = !plane;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // one big mesh, measured once - not worth a bounding box per orbit
    applyFormFinish(mesh.material, { finish: 'matte', color: def.colours[c] || '#cccccc', gloss: 0.05 }, {});
    group.add(mesh);
    group.userData.parts.push({ mat: mesh.material, color: def.colours[c] || '#cccccc' });
    geos.forEach(g => g.dispose());
  }
  return (F.settings[id] = group);
}

/* Puts the scene's setting in the three.js scene (or takes it out), and gives
   back its definition, or null for none. */
function syncFormSetting(sc) {
  const F = forms, def = FORM_SETTINGS[sc.setting], id = def && def.build ? sc.setting : null;
  if (F.settingId !== id) {
    if (F.settingGroup) F.scene.remove(F.settingGroup);
    F.settingGroup = id ? formSettingGroup(F.T, id) : null;
    F.settingId = id;
    if (F.settingGroup) F.scene.add(F.settingGroup);
  }
  return id ? def : null;
}

/* The setting's materials for this frame: lit like the forms, the zones view
   on them too, the tones flat under Anime. `rimDir` is the second light's
   direction in view space, as formCelUniforms() wants it. */
function styleFormSetting(sc, clean, rimDir) {
  const F = forms, cel = formSceneIsCel(sc);
  for (const { mat, color } of F.settingGroup.userData.parts) {
    const u = mat.userData.u;
    u.uLines.value = 0;
    u.uZones.value = sc.zones && !clean ? 1 : 0;
    u.uCel.value = cel ? 1 : 0;
    if (cel) formCelUniforms(u, color, 0, sc, rimDir);
  }
}
