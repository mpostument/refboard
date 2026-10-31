/* refboard - Two more things for drawing anime, as plain data and pictures (the view is in js/animenewui.js):

   Construction. The body as blocks - the head, the ribcage, the pelvis, the limbs - in a seven-head figure from the front, with
   the shoulders and the hips tilted against each other. The weight is on the leg of the higher hip, and its foot is put under the
   balance line from the pit of the neck: the way to make a standing figure that does not fall over.
   The light on a face. The same face in cel shading lit from eight sides: the shape of the shadow on the cheek, the nose, the
   chin and the neck, and the band of shadow the bangs throw.

   Loaded with the section (loadSection('anime')) after js/animenew.js, whose tilts it follows, and js/animedraw.js, whose
   colour and SVG helpers it uses. */
"use strict";

/* ---- construction */

const AN_CON = { cx: 220, top: 24, head: 58 };

/* o: { shoulders, hips (degrees, positive: the right side of the picture goes down), shift (pixels the chest lies to the right of
   the pelvis) }. The points of the figure. */
function anConstruct(o) {
  const sh = adClamp(+o.shoulders || 0, -30, 30), hp = adClamp(+o.hips || 0, -30, 30), shift = adClamp(+o.shift || 0, -40, 40);
  const { cx, top, head: h } = AN_CON, floor = top + 7 * h;
  const rot = (c, a, dx, dy) => [c[0] + dx * Math.cos(adRad(a)) - dy * Math.sin(adRad(a)), c[1] + dx * Math.sin(adRad(a)) + dy * Math.cos(adRad(a))];
  const chest = [cx + shift, top + 2.05 * h], pelvis = [cx, top + 3.05 * h];
  const LS = rot(chest, sh, -0.82 * h, -0.55 * h), RS = rot(chest, sh, 0.82 * h, -0.55 * h);
  const LH = rot(pelvis, hp, -0.52 * h, 0.35 * h), RH = rot(pelvis, hp, 0.52 * h, 0.35 * h);
  const neck = rot(chest, sh, 0, -0.95 * h), balance = neck[0];
  // The weight is on the higher hip (the smaller y); its ankle is on the balance line.
  const weightLeft = LH[1] <= RH[1], W = weightLeft ? LH : RH, F = weightLeft ? RH : LH, side = weightLeft ? -1 : 1;
  const wAnkle = [balance, floor], wKnee = [(W[0] + wAnkle[0]) / 2, W[1] + (floor - W[1]) * 0.5];
  const fAnkle = [F[0] - side * 0.75 * h, floor - 4], fKnee = [F[0] + (fAnkle[0] - F[0]) * 0.35 - side * 0.12 * h, F[1] + (floor - F[1]) * 0.5 - 4];
  const arm = (S, s) => { const E = [S[0] + s * 0.16 * h, S[1] + 0.95 * h], Wr = [E[0] + s * 0.14 * h, E[1] + 0.9 * h]; return [S, E, Wr]; };
  return { sh, hp, shift, chest, pelvis, LS, RS, LH, RH, neck, balance, W, F, weightLeft, wKnee, wAnkle, fKnee, fAnkle, arms: [arm(LS, -1), arm(RS, 1)], floor, head: rot(chest, sh * 0.35, 0, -1.45 * h) };
}

function anConstructSvg(o) {
  const g = anConstruct(o), { cx, top, head: h } = AN_CON, ink = AD_INK, skin = '#e8c9ae', fl = g.floor;
  const seg = (a, b, w) => `<path d="M${adP(a)} L${adP(b)}" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
  const joint = (p, r) => `<circle cx="${adF(p[0])}" cy="${adF(p[1])}" r="${r}" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
  let s = `<rect width="440" height="${adF(fl + 36)}" fill="#fff"/>`;
  // The balance line, and the floor.
  s += `<path d="M${adP([g.balance, g.neck[1]])} L${adP([g.balance, fl])}" stroke="#2c8f6a" stroke-width="1.4" stroke-dasharray="6 5" fill="none"/><text x="${adF(g.balance + 6)}" y="${adF(fl - 8)}" font-size="11" fill="#2c8f6a">balance</text>`;
  s += `<path d="M${cx - 170} ${fl} L${cx + 170} ${fl}" stroke="#aab" stroke-width="1.2"/>`;
  // The legs (the free one first), then the pelvis, the spine, the ribcage, the arms, the shoulder and hip lines and the head.
  s += seg(g.F, g.fKnee, 16) + seg(g.fKnee, g.fAnkle, 11) + joint(g.fKnee, 5);
  s += seg(g.W, g.wKnee, 17) + seg(g.wKnee, g.wAnkle, 12) + joint(g.wKnee, 5);
  const ca = Math.cos(adRad(g.hp)), sa = Math.sin(adRad(g.hp));
  const pel = [[-0.62, -0.34], [0.62, -0.34], [0.5, 0.42], [-0.5, 0.42]].map(([x, y]) => adP([g.pelvis[0] + x * h * ca - y * h * sa, g.pelvis[1] + x * h * sa + y * h * ca])).join(' ');
  s += `<polygon points="${pel}" fill="${skin}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
  s += `<path d="M${adP([g.pelvis[0], g.pelvis[1] - 0.2 * h])} Q${adP([(g.pelvis[0] + g.chest[0]) / 2 + g.shift * 0.2, (g.pelvis[1] + g.chest[1]) / 2])} ${adP([g.chest[0], g.chest[1] + 0.5 * h])}" stroke="${ink}" stroke-width="3" fill="none" stroke-dasharray="1 4" stroke-linecap="round"/>`;
  s += `<ellipse cx="${adF(g.chest[0])}" cy="${adF(g.chest[1])}" rx="${adF(0.75 * h)}" ry="${adF(0.98 * h)}" transform="rotate(${adF(g.sh)} ${adF(g.chest[0])} ${adF(g.chest[1])})" fill="${skin}" stroke="${ink}" stroke-width="1.8"/>`;
  for (const a of g.arms) s += seg(a[0], a[1], 12) + seg(a[1], a[2], 9) + joint(a[1], 4.5) + `<circle cx="${adF(a[2][0])}" cy="${adF(a[2][1])}" r="6" fill="${skin}" stroke="${ink}" stroke-width="1.4"/>`;
  s += `<path d="M${adP(g.LS)} L${adP(g.RS)}" stroke="#4a78d8" stroke-width="2.6" stroke-linecap="round"/><path d="M${adP(g.LH)} L${adP(g.RH)}" stroke="#e0883a" stroke-width="2.6" stroke-linecap="round"/>`;
  s += joint(g.LS, 4.5) + joint(g.RS, 4.5) + joint(g.LH, 4.5) + joint(g.RH, 4.5);
  s += seg(g.neck, g.head, 9);
  s += `<ellipse cx="${adF(g.head[0])}" cy="${adF(g.head[1] - 0.2 * h)}" rx="${adF(0.4 * h)}" ry="${adF(0.5 * h)}" fill="${skin}" stroke="${ink}" stroke-width="1.8"/>`;
  s += `<text x="12" y="${adF(top + 2.0 * h)}" font-size="12" fill="#4a78d8">shoulders ${adF(g.sh)}°</text><text x="12" y="${adF(top + 3.1 * h)}" font-size="12" fill="#e0883a">hips ${adF(g.hp)}°</text>`;
  s += `<text x="12" y="${adF(fl - 60)}" font-size="11" fill="#666">weight on the ${g.weightLeft ? 'left' : 'right'} leg</text>`;
  return adSvgOpen([0, 0, 440, fl + 36], `A figure in blocks: the shoulders at ${g.sh} degrees, the hips at ${g.hp}`) + s + '</svg>';
}

function anConstructNotes(o) {
  const g = anConstruct(o), against = Math.abs(g.sh - g.hp), same = g.sh * g.hp > 0 && Math.min(Math.abs(g.sh), Math.abs(g.hp)) > 4, out = [];
  if (same) out.push('The shoulders and the hips tilt the same way: the body leans like a plank. In a relaxed stance the two go against each other.');
  else if (against < 6) out.push('The shoulders and the hips are almost level: a soldier at attention. Tilt the hip of the leg that carries the weight upward.');
  else if (against <= 28) out.push(`The shoulders and the hips tilt against each other by ${Math.round(against)}°: the contrapposto of a relaxed stance.`);
  else out.push(`The two tilt against each other by ${Math.round(against)}°: a strong, dramatic S - keep it for a model's pose or a moment of action.`);
  out.push(`The weight is on the ${g.weightLeft ? 'left' : 'right'} leg, the side of the higher hip; its foot is under the balance line from the pit of the neck. The other leg is free: bent, with its foot a step aside.`);
  if (Math.abs(g.shift) > 25) out.push('The chest is far over the pelvis: she needs a leg or a hand out to the side to hold it up.');
  return out;
}

/* ---- the light on a face */

const AN_FACE_LIGHTS = {
  ul: { label: 'Upper left', d: [-1, -1], says: 'The classic: a crescent of shadow down the right cheek, the nose shadow falling to the lower right, the chin shadowing the neck, a band under the bangs.' },
  ur: { label: 'Upper right', d: [1, -1], says: 'The same from the other side. Keep the light on the same side through the whole page.' },
  l: { label: 'From the left', d: [-1, 0], says: 'Half the face in shadow with a hard edge down the middle: drama and a mood. The nose shadow runs sideways.' },
  r: { label: 'From the right', d: [1, 0], says: 'The same from the right: for the quiet moment, one side of the face lit and the other still.' },
  top: { label: 'From above', d: [0, -1], says: 'Shadow in the eye sockets, under the nose and under the chin; the bangs throw a wide band over the forehead. Noon, or a lamp over her head.' },
  front: { label: 'In front', d: [0, 0], says: 'Almost no shadow: the face is flat, the shadow is only under the chin and the bangs. A snapshot, or a cheerful anime still.' },
  below: { label: 'From below', d: [0, 1], says: 'The shadows go up: under the brows, the nose and the cheekbones. A fire, a torch, a ghost story.' },
  back: { label: 'From behind', d: [1, -0.6], says: 'The face is almost all shadow, with a thin line of light on one edge of the cheek and the hair: a rim light, for a silhouette.' },
};

/* o: { light, skin (hex) }. A head from the front in cel shading: the shadow shape, the nose, the chin and the bangs. */
function anFaceLightSvg(o) {
  const L = AN_FACE_LIGHTS[o.light] ? o.light : 'ul', [dx, dy] = AN_FACE_LIGHTS[L].d, T = adTones(adRgbOf(o.skin || '#f1c9a5')), ink = AD_INK;
  // Cel shadow on skin is a cool, greyed brown, not a saturated orange: the base mixed toward a blue-violet grey.
  const cx = 150, cy = 140, rx = 58, ry = 68, back = L === 'back', skinRgb = adRgbOf(o.skin || '#f1c9a5');
  const shadow = adCss(adMixRgb(skinRgb, [128, 112, 150], 0.34)), base = adCss(T.base), light = adCss(T.light), core = adCss(adMixRgb(skinRgb, [96, 80, 128], 0.52));
  // The lit part: the face ellipse pushed toward the light; what is left of the face is the shadow.
  const k = L === 'front' ? 0 : back ? -0.95 : L === 'l' || L === 'r' ? 0.8 : 0.62;
  const lx = cx + dx * rx * k, ly = cy + dy * ry * k, lrx = rx * (back ? 0.2 : 1), lry = ry * (back ? 0.9 : 1);
  let s = `<defs><clipPath id="fl-face"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath></defs><rect width="300" height="270" fill="#f7f5ef"/>`;
  // The neck, with the shadow of the chin on it.
  s += `<path d="M${cx - 22} ${cy + ry - 8} L${cx - 24} 250 L${cx + 24} 250 L${cx + 22} ${cy + ry - 8}Z" fill="${base}" stroke="${ink}" stroke-width="1.6"/>`;
  s += `<path d="M${cx - 22} ${cy + ry - 8} Q${cx} ${cy + ry + (dy < 0 ? 40 : dy > 0 ? 6 : 24)} ${cx + 22} ${cy + ry - 8} L${cx + 23} ${cy + ry + 8}Z" fill="${shadow}" opacity="0.9"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${shadow}" stroke="${ink}" stroke-width="2"/>`;
  s += `<g clip-path="url(#fl-face)"><ellipse cx="${adF(lx)}" cy="${adF(ly)}" rx="${adF(lrx)}" ry="${adF(lry)}" fill="${back ? shadow : base}"/>`;
  if (back) s += `<ellipse cx="${adF(cx + 0.82 * rx * dx)}" cy="${adF(cy - 0.2 * ry)}" rx="9" ry="${adF(ry * 0.62)}" fill="${light}"/>`;
  // The nose shadow: a wedge on the side away from the light, up for light from below.
  if (L !== 'front' && !back) {
    const nx = cx - dx * 9, ny = cy + 14 - dy * 8;
    s += `<path d="M${cx} ${cy + 6} L${adF(nx - dx * 8)} ${adF(ny + 8)} L${adF(cx + 3)} ${adF(cy + 18)}Z" fill="${core}" opacity="0.85"/>`;
  }
  if (L === 'below') s += `<path d="M${cx - 48} ${cy - 24} Q${cx} ${cy - 46} ${cx + 48} ${cy - 24} L${cx + 48} ${cy - 8} Q${cx} ${cy - 30} ${cx - 48} ${cy - 8}Z" fill="${core}" opacity="0.7"/>`;
  s += '</g>';
  // The hair over the forehead, and the band of shadow the bangs throw under it.
  const band = dy < 0 || L === 'front' ? 0.5 : dy === 0 ? 0.25 : 0;
  s += `<g clip-path="url(#fl-face)"><path d="M${cx - 70} ${cy - 20} Q${cx - 30} ${cy - 54} ${cx} ${cy - 30} Q${cx + 30} ${cy - 54} ${cx + 70} ${cy - 20} L${cx + 70} ${cy - 90} L${cx - 70} ${cy - 90}Z" fill="#46382f"/>` +
    (band ? `<path d="M${cx - 70} ${cy - 20} Q${cx - 30} ${cy - 40} ${cx} ${cy - 18} Q${cx + 30} ${cy - 40} ${cx + 70} ${cy - 20} L${cx + 70} ${cy - 2} Q${cx + 30} ${cy - 24} ${cx} ${cy + 2} Q${cx - 30} ${cy - 24} ${cx - 70} ${cy - 2}Z" fill="${core}" opacity="${band}"/>` : '') + '</g>';
  // The hair at the sides.
  s += `<path d="M${cx - rx - 6} ${cy - 10} Q${cx - rx - 22} ${cy + 60} ${cx - rx + 4} ${cy + 96} L${cx - rx + 4} ${cy + 10}Z" fill="#46382f" stroke="${ink}" stroke-width="1.2"/><path d="M${cx + rx + 6} ${cy - 10} Q${cx + rx + 22} ${cy + 60} ${cx + rx - 4} ${cy + 96} L${cx + rx - 4} ${cy + 10}Z" fill="#46382f" stroke="${ink}" stroke-width="1.2"/>`;
  // The face: eyes, nose, mouth.
  const eye = x => `<path d="M${x - 15} ${cy + 4} Q${x} ${cy - 7} ${x + 15} ${cy + 4}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="${x}" cy="${cy + 8}" rx="6" ry="8" fill="${ink}"/><circle cx="${x - 2}" cy="${cy + 5}" r="2.4" fill="#fff"/>`;
  s += eye(cx - 25) + eye(cx + 25) + `<path d="M${cx - 2} ${cy + 22} L${cx + 2} ${cy + 24}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><path d="M${cx - 8} ${cy + 40} Q${cx} ${cy + 45} ${cx + 8} ${cy + 40}" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  return adSvgOpen([0, 0, 300, 270], `A face lit ${AN_FACE_LIGHTS[L].label.toLowerCase()}`) + s + '</svg>';
}

/* ---- the pleated skirt */

const AN_SKIRT_LENGTHS = { mini: ['Mini', 46], knee: ['To the knee', 78], long: ['Long', 118] };
const AN_SKIRT_PLEATS = { 8: 'Eight pleats', 12: 'Twelve pleats', 16: 'Sixteen pleats' };
const AN_SKIRT_VIEWS = { front: ['Front', 0], three: ['Three-quarter', 35], back: ['From behind', 180] };

/* o: { length (mini, knee, long), pleats (8, 12, 16), view (front, three, back), wind (0 - 2), skin... }. A pleated skirt as a cone cut by two
   ellipses - the waist and the hem - seen from a little above; the pleat lines run from the waist to the hem, and are spaced more closely
   toward the sides, where the cloth turns away. The hem is lifted on one side by the wind. */
function anSkirtSvg(o) {
  const len = (AN_SKIRT_LENGTHS[o.length] || AN_SKIRT_LENGTHS.knee)[1], n = +o.pleats in AN_SKIRT_PLEATS ? +o.pleats : 12, turn = (AN_SKIRT_VIEWS[o.view] || AN_SKIRT_VIEWS.front)[1];
  const wind = adClamp(+o.wind || 0, 0, 2), cx = 160, wy = 60, rw = 42, rh = rw + 20 + len * 0.55, ew = 0.22, eh = 0.22;
  const cloth = adRgbOf(o.colour || '#3b4a8c'), T = adTones(cloth), ink = AD_INK, light = adCss(T.light), base = adCss(T.base), shade = adCss(T.shadow);
  const hemY = wy + len + 40;
  // The point on the waist or the hem at angle a round the skirt (0 is the front; the picture's x is the sine).
  const at = (a, r, y, e) => [cx + r * Math.sin(a), y + r * e * Math.cos(a)];
  const hemLift = (x, a) => wind ? wind * (14 + 10 * Math.sin(a * 2 + 1)) * Math.max(0, Math.sin(a + 0.6)) : 0;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = adRad(turn) + (i / n - 0.5) * Math.PI * 2;
    pts.push({ a, w: at(a, rw, wy, ew), h: at(a, rh + wind * 6 * Math.max(0, Math.sin(a + 0.6)), hemY - 0, eh), front: Math.cos(a) > 0 });
  }
  for (const p of pts) p.h[1] -= hemLift(p.h[0], p.a);
  const vis = pts.map((p, i) => ({ ...p, i })).filter(p => p.front);
  let s = `<rect width="320" height="${hemY + 70}" fill="#f7f5ef"/>`;
  // The waistband and the body of the skirt: the cloth between neighbouring pleat lines, the pleats alternately lit and in shadow.
  const seg = [];
  for (let k = 0; k < vis.length - 1; k++) {
    const a = vis[k], b = vis[k + 1];
    if (b.i !== a.i + 1) continue;
    seg.push(`<path d="M${adP(a.w)} L${adP(b.w)} L${adP(b.h)} L${adP(a.h)}Z" fill="${a.i % 2 ? shade : light}" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"/>`);
  }
  s += seg.join('');
  // The hem as one line through the lower corners, and the waist as one through the upper ones.
  const run = (key) => vis.map((p, k) => (k ? 'L' : 'M') + adP(p[key])).join('');
  s += `<path d="${run('h')}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="${run('w')}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
  s += `<path d="M${cx - rw - 2} ${wy - 12} L${cx + rw + 2} ${wy - 12} L${cx + rw} ${wy + 4} L${cx - rw} ${wy + 4}Z" fill="${adCss(adMixRgb(cloth, [30, 30, 40], 0.3))}" stroke="${ink}" stroke-width="1.6"/>`;
  s += `<text x="12" y="${wy}" font-size="11" fill="#666">waist</text><text x="12" y="${hemY}" font-size="11" fill="#666">hem</text>`;
  return adSvgOpen([0, 0, 320, hemY + 70], `A pleated skirt, ${(AN_SKIRT_LENGTHS[o.length] || AN_SKIRT_LENGTHS.knee)[0].toLowerCase()}, ${n} pleats`) + s + '</svg>';
}

function anSkirtNotes(o) {
  const n = +o.pleats in AN_SKIRT_PLEATS ? +o.pleats : 12, out = [];
  out.push('A pleated skirt is a cone: the pleat lines all come from the waist, and the hem is an arc - it dips in front and rises at the sides when seen from above.');
  out.push('The pleats are narrow at the sides, where the cloth turns away, and widest in the middle of the front: do not draw them all the same.');
  if ((AN_SKIRT_VIEWS[o.view] || [])[1] === 180) out.push('From behind the same arc is seen the other way, and the pleats are the same: only the waist seam has changed.');
  if (+o.wind) out.push('With wind the hem lifts on the side it blows from and the pleats open there: draw the lifted side with longer, straighter lines and keep the other close.');
  out.push(n === 8 ? 'Eight pleats are wide and easy to draw: a school skirt in a drawing with few lines.' : n === 16 ? 'Sixteen pleats are fine: draw the lit and shadow ones alternately and only a few at the edge.' : 'Twelve is the usual: six lit and six in shadow, alternately.');
  return out;
}

/* ---- the walk and the run */

/* The key poses of a cycle, from the side, facing right. Each leg is [thigh, knee]: the thigh's angle from the vertical (forward is
   positive) and how far the knee bends the shin back; each arm is [upper arm, elbow bend]. lean: the torso's lean forward in degrees;
   lift: how far the hips are raised off the height at which the first leg stands on the floor (a flight). */
const AN_GAITS = {
  walk: {
    label: 'Walk', head: 'A walk always has a foot on the floor. Four key poses make half a step; the other half is the same with the legs and the arms changed over.',
    poses: [
      { name: 'Contact', says: 'The front heel meets the floor, the legs are furthest apart, the arms at their furthest too. The hips are at their middle height.', A: [28, 2], B: [-22, 20], armA: [-25, 15], armB: [25, 20], lean: 2, lift: 0 },
      { name: 'Down', says: 'The weight lands on the front leg, which bends a little; the body is at its lowest. The rear foot comes off the floor.', A: [10, 18], B: [-14, 48], armA: [-10, 15], armB: [10, 20], lean: 3, lift: 0 },
      { name: 'Passing', says: 'The free leg passes the standing one with the knee bent; the standing leg is straight and the hips are over it. The arms pass the body.', A: [0, 0], B: [14, 75], armA: [0, 10], armB: [0, 15], lean: 2, lift: 0 },
      { name: 'Up', says: 'The body is at its highest, pushing off the toe of the standing leg; the free leg swings forward to the next contact.', A: [-14, 6], B: [30, 35], armA: [22, 15], armB: [-22, 20], lean: 2, lift: 0 },
    ],
  },
  run: {
    label: 'Run', head: 'A run has a flight: for a moment no foot touches the floor. The body leans forward, the arms are bent at the elbow, and the legs go further.',
    poses: [
      { name: 'Contact', says: 'The front foot lands under or just before the body, the knee a little bent; the rear leg is folded up behind.', A: [32, 18], B: [-40, 95], armA: [-40, 90], armB: [40, 95], lean: 12, lift: 0 },
      { name: 'Down', says: 'The landing leg takes the weight and bends more; the body is at its lowest, the free leg comes through, knee high.', A: [14, 45], B: [20, 100], armA: [-20, 90], armB: [20, 90], lean: 14, lift: 0 },
      { name: 'Passing', says: 'The landing leg pushes up and the free knee is driven forward; the arms cross the body.', A: [-4, 25], B: [48, 95], armA: [5, 85], armB: [-5, 90], lean: 13, lift: 0 },
      { name: 'Flight', says: 'Both feet are in the air: the back leg stretched behind, the front knee up. The body is at its highest, the longest line of the pose.', A: [-38, 35], B: [58, 70], armA: [40, 95], armB: [-40, 95], lean: 12, lift: 42 },
    ],
  },
};

// A limb from a point: two bones of length L at angles (from the vertical, forward positive); returns [start, joint, end].
function anLimb(p, a1, bend, L1, L2) {
  const j = [p[0] + L1 * Math.sin(adRad(a1)), p[1] + L1 * Math.cos(adRad(a1))], a2 = a1 - bend;
  return [p, j, [j[0] + L2 * Math.sin(adRad(a2)), j[1] + L2 * Math.cos(adRad(a2))]];
}

/* The figure of one pose: the hips set so that the first leg stands on the floor (less the lift), then the other limbs. */
function anGaitFigure(pose, floor, x) {
  const T = 62, S = 60, hip0 = [x, 0], legA0 = anLimb(hip0, pose.A[0], pose.A[1], T, S), hipY = floor - legA0[2][1] - pose.lift - 4;
  const hip = [x, hipY], legA = anLimb(hip, pose.A[0], pose.A[1], T, S), legB = anLimb(hip, pose.B[0], pose.B[1], T, S);
  const shoulder = [x + 100 * Math.sin(adRad(pose.lean)), hipY - 100 * Math.cos(adRad(pose.lean))];
  const armA = anLimb(shoulder, pose.armA[0], -pose.armA[1], 44, 42), armB = anLimb(shoulder, pose.armB[0], -pose.armB[1], 44, 42);
  const head = [shoulder[0] + 22 * Math.sin(adRad(pose.lean)), shoulder[1] - 24 * Math.cos(adRad(pose.lean))];
  const foot = l => [l[2], [l[2][0] + 18, l[2][1] + 2]];
  return { hip, legA, legB, shoulder, armA, armB, head, footA: foot(legA), footB: foot(legB) };
}

function anGaitSvg(o) {
  const G = AN_GAITS[o.gait] || AN_GAITS.walk, ink = AD_INK, W = 4 * 150 + 40, floor = 318, H = 372;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/><path d="M10 ${floor} L${W - 10} ${floor}" stroke="#aab" stroke-width="1.2"/>`;
  const line = (pts, col, w) => `<path d="M${pts.map(adP).join(' L')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  G.poses.forEach((pose, i) => {
    const f = anGaitFigure(pose, floor, 90 + i * 150);
    // The far side first, in grey, then the near side in ink.
    s += line(f.legB, '#9aa0b0', 9) + line(f.footB, '#9aa0b0', 7) + line(f.armB, '#9aa0b0', 7);
    s += line(f.legA, ink, 10) + line(f.footA, ink, 8) + line([f.hip, f.shoulder], ink, 16) + line(f.armA, ink, 8);
    s += `<circle cx="${adF(f.head[0])}" cy="${adF(f.head[1])}" r="19" fill="#fff" stroke="${ink}" stroke-width="3"/>`;
    for (const j of [f.legA[1], f.legB[1], f.armA[1], f.armB[1]]) s += `<circle cx="${adF(j[0])}" cy="${adF(j[1])}" r="3.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/>`;
    s += `<text x="${90 + i * 150}" y="${H - 12}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${i + 1}. ${esc(pose.name)}</text>`;
    s += `<path d="M${adP([f.hip[0] - 40, f.hip[1]])} L${adP([f.hip[0] + 40, f.hip[1]])}" stroke="#d67a3a" stroke-width="1" stroke-dasharray="3 4"/>`;
  });
  return adSvgOpen([0, 0, W, H], `${G.label} cycle, four key poses from the side`) + s + '</svg>';
}

function anGaitNotes(o) {
  const G = AN_GAITS[o.gait] || AN_GAITS.walk;
  return [G.head, ...G.poses.map((p, i) => `${i + 1}. ${p.name}. ${p.says}`),
    'Draw each key pose first, then the drawings between them (the in-betweens). At twelve drawings a second, a walk of two steps is eight to twelve drawings, each held for two frames. The dashed orange line is the hip height: see how it rises and falls.'];
}

/* ---- speech balloons */

const AN_BALLOONS = {
  speech: { label: 'Speech', says: 'An oval or a rounded shape, with a tail that points at the mouth - to the mouth, not to the face. One tail for one speaker; the tail is a thin triangle, a little curved.' },
  thought: { label: 'Thought', says: 'A cloud of bumps, with a trail of two or three small circles toward the head. The line is thinner than speech: a thought is quiet.' },
  shout: { label: 'Shout', says: 'A spiked burst: the points are sharp and uneven, and the lettering inside is bigger and bolder. Use it rarely, or it stops meaning anything.' },
  whisper: { label: 'Whisper', says: 'The same oval as speech, but drawn with a dashed line, and the lettering smaller and lighter.' },
  narration: { label: 'Narration', says: 'A plain rectangle with no tail, set in the corner of the panel: the voice of the story, not of anyone in the picture.' },
  offscreen: { label: 'Off the panel', says: 'The tail leaves the balloon and runs to the edge of the panel, toward the speaker who is out of sight: we hear her, we do not see her.' },
};
const AN_BALLOON_RULES = [
  'Balloons are read from the top left to the bottom right (and from the top right to the left in a manga read the Japanese way): put the first speaker\'s balloon highest and furthest in the reading direction.',
  'Keep the face, the hands and the main action out from under a balloon: draw the figures first, then find the empty places for the balloons.',
  'Leave a margin of about one letter\'s height between the lettering and the edge of the balloon, and keep the text centred in it.',
  'A balloon may cross the border of a panel to join two panels, but not more than one at a time.',
];

// One balloon drawn at (ox, oy) in a cell 150 wide and 120 tall: the outline, the placeholder lines of text and the tail.
function anBalloonShape(k, ox, oy) {
  const ink = AD_INK, P = (x, y) => `${ox + x} ${oy + y}`, fill = '#fff';
  const lines = (n, x0, x1, y0, dy) => Array.from({ length: n }, (_, i) => `<path d="M${P(x0 + (i % 2) * 6, y0 + i * dy)} L${P(x1 - (i % 2) * 6, y0 + i * dy)}" stroke="#b6bac6" stroke-width="3.2" stroke-linecap="round"/>`).join('');
  switch (k) {
    case 'thought': {
      let bumps = '';
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; bumps += `<circle cx="${ox + 75 + 46 * Math.cos(a)}" cy="${oy + 44 + 26 * Math.sin(a)}" r="13" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`; }
      return bumps + `<ellipse cx="${ox + 75}" cy="${oy + 44}" rx="46" ry="26" fill="${fill}"/>` + lines(2, 44, 106, 38, 13) +
        `<circle cx="${ox + 50}" cy="${oy + 88}" r="6" fill="${fill}" stroke="${ink}" stroke-width="1.6"/><circle cx="${ox + 38}" cy="${oy + 102}" r="4" fill="${fill}" stroke="${ink}" stroke-width="1.6"/>`;
    }
    case 'shout': {
      const pts = [];
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 0.7 : 1.05 + (i % 4 === 0 ? 0.12 : 0); pts.push(`${ox + 75 + 62 * r * Math.cos(a)},${oy + 50 + 36 * r * Math.sin(a)}`); }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${ink}" stroke-width="2.6" stroke-linejoin="miter"/>` + lines(2, 46, 104, 44, 14).replace(/3\.2/g, '4.6');
    }
    case 'whisper':
      return `<ellipse cx="${ox + 75}" cy="${oy + 46}" rx="56" ry="32" fill="${fill}" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4"/><path d="M${P(48, 74)} L${P(36, 100)} L${P(66, 78)}" fill="${fill}" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>` + lines(2, 44, 106, 42, 12);
    case 'narration':
      return `<rect x="${ox + 14}" y="${oy + 22}" width="122" height="52" fill="#fbf7e8" stroke="${ink}" stroke-width="2.2"/>` + lines(3, 28, 122, 36, 12);
    case 'offscreen':
      return `<rect x="${ox + 4}" y="${oy + 4}" width="142" height="108" fill="none" stroke="#c4c8d4" stroke-width="2" stroke-dasharray="2 4"/><ellipse cx="${ox + 70}" cy="${oy + 44}" rx="46" ry="28" fill="${fill}" stroke="${ink}" stroke-width="2.2"/><path d="M${P(100, 62)} Q${P(124, 70)} ${P(146, 62)} Q${P(124, 76)} ${P(104, 70)}Z" fill="${fill}" stroke="${ink}" stroke-width="2"/>` + lines(2, 44, 96, 38, 13);
    default:
      return `<ellipse cx="${ox + 75}" cy="${oy + 46}" rx="56" ry="32" fill="${fill}" stroke="${ink}" stroke-width="2.4"/><path d="M${P(48, 74)} Q${P(38, 94)} ${P(30, 106)} Q${P(52, 94)} ${P(68, 77)}Z" fill="${fill}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/><path d="M${P(52, 73)} L${P(66, 75)}" stroke="${fill}" stroke-width="4"/>` + lines(2, 44, 106, 40, 13);
  }
}

function anBalloonSheet() {
  const keys = Object.keys(AN_BALLOONS), W = 3 * 160 + 10, H = 2 * 154 + 10;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  keys.forEach((k, i) => {
    const ox = 10 + (i % 3) * 160, oy = 8 + Math.floor(i / 3) * 154;
    s += `<rect x="${ox}" y="${oy}" width="150" height="120" rx="8" fill="#eef0f5" stroke="#dde"/>` + anBalloonShape(k, ox, oy) + `<text x="${ox + 75}" y="${oy + 138}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${esc(AN_BALLOONS[k].label)}</text>`;
  });
  return adSvgOpen([0, 0, W, H], 'Speech balloon shapes') + s + '</svg>';
}

/* ---- a hand holding something */

// The grips: the hand's pose (as AD_HANDS' poses), the turn of the whole drawing, and the object in the hand's own space
// (x across the palm, y up the fingers, z towards us). `obj(P)` gives the object, with P the projection of that space.
const AN_HOLD_ROD = (P, a, b, r, fill = '#c9ced9') => {
  const A = P(a), B = P(b), d = `M${adP(A)}L${adP(B)}`;
  return `<path d="${d}" stroke="${AD_INK}" stroke-width="${r * 2 + 3.4}" stroke-linecap="round"/><path d="${d}" stroke="${fill}" stroke-width="${r * 2}" stroke-linecap="round"/>`;
};
const AN_HOLD_FIST = [85, 100, 70];
const AN_HOLDS = {
  stick: { label: 'A stick or an umbrella', rot: -90,
    pose: { i: AN_HOLD_FIST, m: AN_HOLD_FIST, r: AN_HOLD_FIST, p: AN_HOLD_FIST, t: [35, 45, 35], spread: 0, tabd: 20 },
    obj: P => AN_HOLD_ROD(P, [-150, 98, 25], [120, 98, 25], 12, '#6d7bb0'),
    says: 'A fist closed round a rod: the rod crosses all four fingers at the middle joints, and the thumb closes over the index finger from the other side.',
    tip: 'Hold the rod across the palm, not along it - the hand turns the rod vertical by turning the wrist. The fist is a little larger than usual: it has the rod in it.',
    words: 'hand gripping a stick, fingers wrapped around the handle, umbrella' },
  sword: { label: 'A sword hilt', rot: -50,
    pose: { i: AN_HOLD_FIST, m: AN_HOLD_FIST, r: AN_HOLD_FIST, p: AN_HOLD_FIST, t: [35, 45, 35], spread: 0, tabd: 20 },
    obj: P => AN_HOLD_ROD(P, [-230, 98, 25], [-78, 98, 25], 4, '#dfe6f0') + AN_HOLD_ROD(P, [-78, 98, 25], [70, 98, 25], 10, '#6b5238') +
      `<path d="M${adP(P([-80, 60, 25]))}L${adP(P([-80, 136, 25]))}" stroke="${AD_INK}" stroke-width="7" stroke-linecap="round"/>`,
    says: 'The same fist as on a stick, with the blade running on from the index-finger side, a guard in front of the index finger and the pommel under the little finger.',
    tip: 'The blade is the line of the forearm continued: if the wrist is bent, the blade bends it. Grip it low and firm, the hand just under the guard.',
    words: 'hand gripping a sword hilt, holding sword, fingers wrapped around the grip' },
  mug: { label: 'A mug by the handle', rot: 0,
    pose: { i: [75, 90, 60], m: [80, 95, 65], r: [85, 100, 70], p: [85, 100, 70], t: [25, 35, 25], spread: 0, tabd: 22 },
    obj: P => AN_HOLD_ROD(P, [-36, 98, 20], [80, 98, 20], 8, '#e9e4d8') +
      `<ellipse cx="${adF(P([130, 80, 18])[0])}" cy="${adF(P([130, 80, 18])[1])}" rx="46" ry="52" fill="#f4f1ea" stroke="${AD_INK}" stroke-width="2.4"/>`,
    says: 'Index, middle and ring fingers go through the handle, the little finger rests under it, and the thumb lies on top of the handle to steady it.',
    tip: 'The mug is beside the hand and the handle only a short bar: show the fingers going through the loop. For a cup held with both hands, see Hands, Holding a cup.',
    words: 'hand holding a mug by the handle, fingers through the handle' },
  pen: { label: 'A pen', rot: -22,
    pose: { i: [40, 50, 30], m: [70, 85, 60], r: [85, 100, 70], p: [90, 105, 75], t: [30, 30, 25], spread: 0, tabd: 15 },
    obj: P => AN_HOLD_ROD(P, [-34, 160, 34], [38, 52, 10], 3.4, '#2d3550'),
    says: 'The pen rests on the side of the middle finger, is held between the thumb and the index finger, and leans back into the web between them. The other two fingers curl under, loose.',
    tip: 'The tip of the pen is about two fingers\' width from the fingertips. The pen points over the shoulder, not at the viewer.',
    words: 'hand holding a pen, writing grip, fingers pinching the pen' },
  phone: { label: 'A phone', rot: -15,
    pose: { i: [45, 55, 35], m: [48, 58, 36], r: [50, 60, 38], p: [52, 62, 40], t: [15, 20, 15], spread: 0, tabd: 45 },
    obj: P => { const c = [[-34, -6, 22], [40, -6, 22], [40, 112, 22], [-34, 112, 22]].map(P); return `<path d="M${c.map(adP).join('L')}Z" fill="#2a2f3d" stroke="${AD_INK}" stroke-width="2" stroke-linejoin="round"/>`; },
    says: 'The phone lies across the palm, the four fingers curled at its far edge, the thumb free on the side to touch the screen.',
    tip: 'Show only the finger edges on the far side of the phone: the rest of the hand is hidden behind it. A thin dark rectangle reads as a phone better than any detail.',
    words: 'hand holding a smartphone, thumb on screen' },
  ball: { label: 'An apple or a ball', rot: 0,
    pose: { i: [40, 40, 30], m: [45, 42, 30], r: [45, 42, 30], p: [42, 40, 28], t: [20, 25, 20], spread: 10, tabd: 50 },
    obj: P => { const c = P([0, 78, 36]); return `<circle cx="${adF(c[0])}" cy="${adF(c[1])}" r="52" fill="#c8453b" stroke="${AD_INK}" stroke-width="2.4"/><path d="M${adF(c[0])} ${adF(c[1] - 50)}q4 -14 12 -18" stroke="#4a3a28" stroke-width="3" fill="none" stroke-linecap="round"/>`; },
    says: 'The round thing sits in the palm; the fingers curl up round it and the thumb closes the other side. The fingers do not touch the middle of it, only its sides.',
    tip: 'Leave a small gap between the palm and the object: a hand never grips a ball with the whole palm flat on it.',
    words: 'hand holding an apple, fingers curled around a round object' },
};

function anHoldSheet(key) {
  const H = AN_HOLDS[key] || AN_HOLDS.stick;
  let g = '';
  [[10, 'Front'], [55, 'Three-quarter']].forEach(([turn, label], i) => {
    const ox = i * 300;
    g += `<g transform="rotate(${H.rot} ${ox + 110} 150)">${adHandView(H.pose, turn, ox, H.obj)}</g><text x="${ox + 110}" y="296" text-anchor="middle" font-size="12" fill="#666">${label}</text>`;
  });
  return adSvgOpen([0, 0, 600, 310], `${H.label}, in a hand`) + `<rect width="600" height="310" fill="#fff"/>${g}</svg>`;
}

/* ---- sitting */

/* Six ways to sit, from the side, facing right. hip: how high the hip joint is above the floor. A is the near leg and B the far one:
   [thigh angle from the vertical (forward is positive, 90 is level), how far the knee bends the shin back]. hands: where the arms go -
   on the lap, round the knees, behind on the floor, on the edge of the seat. foot: which way the toes point (1 forward, -1 back). */
const AN_SITS = {
  chair: { label: 'On a chair', hip: 62, A: [90, 88], B: [84, 82], lean: 2, hands: 'lap', foot: 1, prop: 'chair',
    says: 'The thigh is level, the shin straight down, the foot flat: two right angles. The hip is as high as the seat, a shin\'s length above the floor.',
    tip: 'Draw the thigh shorter than when standing - it points a little at us in most views. The back does not touch the chair unless she leans on it.',
    words: 'sitting on a chair, hands on lap, from side' },
  cross: { label: 'Cross-legged', hip: 10, A: [118, 188], B: [104, 170], lean: 3, hands: 'lap', foot: -1, prop: null,
    says: 'The hips almost touch the floor, the knees are a little above them and out to the sides, and each shin lies back under the other thigh.',
    tip: 'From the side the knees are the highest point of the legs and the feet hardly show. Round the back a little: a straight back here looks stiff.',
    words: 'sitting cross-legged, indian style, on the floor' },
  seiza: { label: 'Kneeling (seiza)', hip: 36, A: [56, 146], B: [56, 146], lean: 0, hands: 'lap', foot: -1, prop: null,
    says: 'She sits on her heels: the knees on the floor, the shins flat along it, the toes pointing back. The hip is the height of the heels and one thigh above the floor.',
    tip: 'The back is the straightest line in any sitting pose here. The hands lie on the thighs near the knees.',
    words: 'seiza, kneeling, sitting on heels, hands on thighs' },
  hug: { label: 'Knees up, hugging', hip: 8, A: [145, 135], B: [152, 140], lean: 14, hands: 'knee', foot: 1, prop: null,
    says: 'The knees rise close to the chest, the shins drop to the floor and the arms close round them. The back rounds and the head sinks toward the knees.',
    tip: 'The knee is higher than the hip by a whole thigh: that, and the arms wrapped on the shins, says it is a closed, small pose.',
    words: 'sitting, knees up, hugging own knees, from side' },
  ledge: { label: 'On a ledge, legs hanging', hip: 108, A: [90, 75], B: [94, 98], lean: 4, hands: 'edge', foot: 1, prop: 'ledge',
    says: 'The seat is high, so the shins hang free and the feet swing; one leg is a little forward of the other. The hands rest on the edge beside the hips.',
    tip: 'Give the legs different angles - two shins parallel look like furniture. The weight is on the hands and the hips, so the shoulders lift a little.',
    words: 'sitting on a ledge, legs dangling, hands on edge' },
  long: { label: 'Legs out, leaning back', hip: 8, A: [88, -4], B: [88, -2], lean: -18, hands: 'back', foot: 1, prop: null,
    says: 'The legs lie straight along the floor and the body leans back on straight arms behind, the hands flat on the floor.',
    tip: 'The back arm is straight and takes the weight, so the shoulder is higher than in a relaxed seat. The line from hand to hip to toes is the whole pose.',
    words: 'sitting, legs stretched out, leaning back, hands on floor behind' },
};

// A limb reaching a point: two bones of length L1 and L2 from p, bent at the elbow or knee to the side `side` (1 or -1); the end falls short if it cannot reach.
function anReach(p, to, L1, L2, side) {
  const dx = to[0] - p[0], dy = to[1] - p[1], r = Math.hypot(dx, dy) || 1, d = Math.min(r, L1 + L2 - 0.5);
  const a = Math.atan2(dx, dy) + side * Math.acos(adClamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  return [p, [p[0] + L1 * Math.sin(a), p[1] + L1 * Math.cos(a)], [p[0] + dx / r * d, p[1] + dy / r * d]];
}

function anSitFigure(S, floor, x) {
  const T = 62, SH = 60, hip = [x, floor - S.hip], legA = anLimb(hip, S.A[0], S.A[1], T, SH), legB = anLimb(hip, S.B[0], S.B[1], T, SH);
  const lean = adRad(S.lean), shoulder = [x + 100 * Math.sin(lean), hip[1] - 100 * Math.cos(lean)];
  const head = [shoulder[0] + 22 * Math.sin(lean), shoulder[1] - 24 * Math.cos(lean)];
  const mid = leg => [(leg[0][0] + leg[1][0]) / 2, (leg[0][1] + leg[1][1]) / 2 - 7];
  const at = {
    lap: [mid(legA), [mid(legA)[0] + 8, mid(legA)[1]]],
    knee: [[legA[1][0] + 4, legA[1][1] + 26], [legA[1][0] + 10, legA[1][1] + 22]],
    back: [[x - 78, floor - 2], [x - 94, floor - 2]],
    edge: [[x - 28, hip[1] + 8], [x - 46, hip[1] + 8]],
  }[S.hands];
  const side = S.hands === 'back' ? -1 : 1;
  const armA = anReach(shoulder, at[0], 44, 42, side), armB = anReach(shoulder, at[1], 44, 42, side);
  const foot = l => [l[2], [l[2][0] + 18 * S.foot, l[2][1] + 2]];
  return { hip, legA, legB, shoulder, armA, armB, head, footA: foot(legA), footB: foot(legB) };
}

function anSitSvg(o) {
  const S = AN_SITS[o.sit] || AN_SITS.chair, ink = AD_INK, W = 420, floor = 330, x = 190;
  const f = anSitFigure(S, floor, x);
  // Cut to the figure: a pose low on the floor does not need the height of one on a ledge.
  const top = Math.max(0, Math.floor(Math.min(f.head[1] - 19, f.shoulder[1]) - 24)), H = floor + 44 - top;
  const line = (pts, col, w) => `<path d="M${pts.map(adP).join(' L')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let s = `<rect y="${top}" width="${W}" height="${H}" fill="#fff"/><path d="M10 ${floor + 4} L${W - 10} ${floor + 4}" stroke="#aab" stroke-width="1.2"/>`;
  const seat = f.hip[1] + 9;
  if (S.prop === 'chair') {
    s += `<path d="M${x - 40} ${seat} V${floor + 4} M${x + 62} ${seat} V${floor + 4} M${x - 40} ${seat} V${seat - 100}" stroke="#b8a68a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<rect x="${x - 44}" y="${seat - 3}" width="112" height="8" rx="2" fill="#d8c8a8" stroke="#8a7a5c" stroke-width="1.4"/>`;
  } else if (S.prop === 'ledge') {
    s += `<rect x="${x - 150}" y="${seat}" width="160" height="${floor + 4 - seat}" fill="#e6e8ee" stroke="#9aa0b0" stroke-width="1.4"/>`;
  }
  s += line(f.legB, '#9aa0b0', 9) + line(f.footB, '#9aa0b0', 7) + line(f.armB, '#9aa0b0', 7);
  s += line(f.legA, ink, 10) + line(f.footA, ink, 8) + line([f.hip, f.shoulder], ink, 16) + line(f.armA, ink, 8);
  s += `<circle cx="${adF(f.head[0])}" cy="${adF(f.head[1])}" r="19" fill="#fff" stroke="${ink}" stroke-width="3"/>`;
  for (const j of [f.legA[1], f.legB[1], f.armA[1], f.armB[1]]) s += `<circle cx="${adF(j[0])}" cy="${adF(j[1])}" r="3.4" fill="#fff" stroke="${ink}" stroke-width="1.4"/>`;
  // The hip height, so the weight of the pose can be seen against the floor.
  s += `<path d="M${adP([f.hip[0] - 60, f.hip[1]])} L${adP([f.hip[0] + 60, f.hip[1]])}" stroke="#d67a3a" stroke-width="1" stroke-dasharray="3 4"/>`;
  s += `<text x="${W / 2}" y="${floor + 30}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${esc(S.label)}</text>`;
  return adSvgOpen([0, top, W, H], `${S.label}, a seated figure from the side`) + s + '</svg>';
}

function anSitNotes(o) {
  const S = AN_SITS[o.sit] || AN_SITS.chair;
  return [S.says, S.tip, 'The dashed orange line is the hip. Draw it first, then the spine up from it, then the thighs: where the hip sits against the floor decides how heavy the pose feels.'];
}

/* ---- the ages */

/* Five ages as a figure of heads: heights of the shoulder, crotch and knee in heads from the crown, the whole height in heads and in
   centimetres, where the eyes sit on the face (from the crown, as a share of the head) and how big they are. A child is shorter
   mostly in the legs, and has a rounder, shorter face with the eyes lower. */
const AN_AGES = {
  small: { label: 'Small child', heads: 4.5, cm: 100, shoulder: 1.2, crotch: 2.5, knee: 3.5, eyeLine: 0.6, eye: 1.25, rx: 46, ry: 43,
    says: 'The head is about a fifth of the height. The legs are short and the belly round; the arms reach only to the top of the thighs.' },
  child: { label: 'Child, about 8', heads: 5.5, cm: 125, shoulder: 1.25, crotch: 2.9, knee: 4.2, eyeLine: 0.57, eye: 1.15, rx: 44, ry: 45,
    says: 'The legs have grown longer than the body. The face is still round with big eyes set low; the neck is thin and short.' },
  young: { label: 'Young teen', heads: 6.5, cm: 150, shoulder: 1.3, crotch: 3.3, knee: 4.9, eyeLine: 0.54, eye: 1.05, rx: 42, ry: 47,
    says: 'The height comes from the legs. The shoulders are narrow, the chest and hips begin to show; the face lengthens and the eyes move up.' },
  teen: { label: 'Older teen', heads: 7, cm: 163, shoulder: 1.3, crotch: 3.5, knee: 5.2, eyeLine: 0.52, eye: 1, rx: 41, ry: 49,
    says: 'The usual anime schoolgirl or schoolboy: seven heads, the crotch just below the middle, the shoulders as wide as two heads on a boy.' },
  adult: { label: 'Adult', heads: 7.5, cm: 170, shoulder: 1.35, crotch: 3.75, knee: 5.6, eyeLine: 0.5, eye: 0.9, rx: 40, ry: 51,
    says: 'The eyes are on the middle line of the head, the jaw is longer and more defined, and the eyes are smaller against the face.' },
};
const AN_AGE_VIEWS = { figure: 'Whole figure', face: 'Face' };

function anAgesSvg(o) {
  const ink = AD_INK, keys = Object.keys(AN_AGES), W = 640, H = 420, floor = 360, tall = 300 / AN_AGES.adult.cm;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  if (o.view === 'face') {
    keys.forEach((k, i) => {
      const A = AN_AGES[k], cx = 70 + i * 125, top = 110, h = 140, w = h * A.rx / A.ry * 0.8;
      // The head: a round skull whose jaw narrows with age.
      const chin = top + h, jk = adF(w * (0.34 - i * 0.045)), l = adF(cx - w / 2), r = adF(cx + w / 2), mid = adF(top + h * 0.45), low = adF(top + h * 0.82);
      s += `<path d="M${l} ${mid} C${l} ${adF(top - h * 0.08)} ${r} ${adF(top - h * 0.08)} ${r} ${mid} C${r} ${low} ${adF(cx + +jk)} ${chin} ${cx} ${chin} C${adF(cx - jk)} ${chin} ${l} ${low} ${l} ${mid}Z" fill="#fdf2ea" stroke="${ink}" stroke-width="2.2"/>`;
      const ey = top + h * A.eyeLine, er = 11 * A.eye;
      for (const sx of [-1, 1]) s += `<ellipse cx="${adF(cx + sx * w * 0.24)}" cy="${adF(ey)}" rx="${adF(er * 0.9)}" ry="${adF(er * 1.25)}" fill="#fff" stroke="${ink}" stroke-width="1.8"/>` +
        `<ellipse cx="${adF(cx + sx * w * 0.24)}" cy="${adF(ey + er * 0.1)}" rx="${adF(er * 0.62)}" ry="${adF(er * 0.95)}" fill="#4a6fa5"/>`;
      s += `<path d="M${cx - 2} ${adF(top + h * (A.eyeLine + 0.16))} q2 3 4 0" fill="none" stroke="${ink}" stroke-width="1.4"/>` +
        `<path d="M${cx - 8} ${adF(top + h * 0.84)} q8 5 16 0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
      s += `<path d="M${adF(cx - w / 2 - 6)} ${adF(ey)} H${adF(cx + w / 2 + 6)}" stroke="#d67a3a" stroke-width="1" stroke-dasharray="3 4"/>`;
      s += `<text x="${cx}" y="${H - 52}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#333">${esc(A.label)}</text>` +
        `<text x="${cx}" y="${H - 34}" text-anchor="middle" font-size="11.5" fill="#666">eyes ${Math.round(A.eyeLine * 100)}% down</text>`;
    });
    return adSvgOpen([0, 0, W, H], 'The face at five ages, the eye line dashed') + s + '</svg>';
  }
  s += `<path d="M10 ${floor} L${W - 10} ${floor}" stroke="#aab" stroke-width="1.2"/>`;
  keys.forEach((k, i) => {
    const A = AN_AGES[k], cx = 70 + i * 125, tallPx = A.cm * tall, head = tallPx / A.heads, top = floor - tallPx;
    const y = n => top + n * head, sh = head * (0.5 + i * 0.06);
    const line = (pts, w) => `<path d="M${pts.map(adP).join(' L')}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<ellipse cx="${cx}" cy="${adF(top + head / 2)}" rx="${adF(head * 0.4)}" ry="${adF(head / 2)}" fill="#fff" stroke="${ink}" stroke-width="2.4"/>`;
    s += line([[cx, y(1)], [cx, y(A.crotch)]], 8) + line([[cx - sh, y(A.shoulder)], [cx + sh, y(A.shoulder)]], 5);
    s += line([[cx - sh, y(A.shoulder)], [cx - sh - 4, y(A.shoulder + (A.crotch - A.shoulder) * 0.95)]], 4) + line([[cx + sh, y(A.shoulder)], [cx + sh + 4, y(A.shoulder + (A.crotch - A.shoulder) * 0.95)]], 4);
    s += line([[cx - 5, y(A.crotch)], [cx - 6, y(A.knee)], [cx - 6, floor]], 6) + line([[cx + 5, y(A.crotch)], [cx + 6, y(A.knee)], [cx + 6, floor]], 6);
    // The head-heights as ticks beside the figure: how many of the head fit into the body.
    for (let n = 1; n <= Math.floor(A.heads); n++) s += `<path d="M${adF(cx + head * 0.55)} ${adF(y(n))} h7" stroke="#d67a3a" stroke-width="1.2"/>`;
    s += `<text x="${cx}" y="${floor + 18}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#333">${esc(A.label)}</text>` +
      `<text x="${cx}" y="${floor + 34}" text-anchor="middle" font-size="11.5" fill="#666">${A.heads} heads · ~${A.cm} cm</text>`;
  });
  return adSvgOpen([0, 0, W, H], 'Five ages as figures of heads, side by side') + s + '</svg>';
}

function anAgesNotes() {
  return [...Object.values(AN_AGES).map(A => `${A.label}, ${A.heads} heads. ${A.says}`),
    'The same head drawn at every age: only the body grows more than the head does. The orange ticks on the figures are the head-heights; the dashed line on the faces is the eye line.'];
}

/* ---- footwear */

/* Six kinds of shoe, from the side and the front. Heights are in px at the size drawn (a foot is 230 long): sole, heel block, shaft (the
   height of the opening above the sole at the ankle), vamp (the instep) and toe (the toe box). detail: what is drawn on it. */
const AN_FOOTWEAR = {
  sneaker: { label: 'Sneaker', sole: 12, heel: 0, shaft: 72, vamp: 62, toe: 38, detail: 'laces',
    says: 'A thick sole with a toe cap that curls up, the laces over the instep and a padded collar round the ankle.',
    tip: 'Draw the foot inside first, then the shoe as a shell a little bigger than it: the toe cap is a rounded wedge, not a flat tip.',
    words: 'sneakers, white sneakers, laces' },
  loafer: { label: 'School loafer', sole: 8, heel: 6, shaft: 50, vamp: 54, toe: 32, detail: 'band',
    says: 'A low shoe cut under the ankle bone, a strap or band across the vamp and a thin sole with a small heel.',
    tip: 'The opening is a scoop: the ankle shows above it. Keep the toe box long and low; it is the shape the school-uniform look is made of.',
    words: 'loafers, school uniform, brown shoes' },
  mary: { label: 'Mary Jane', sole: 8, heel: 14, shaft: 46, vamp: 50, toe: 30, detail: 'strap',
    says: 'A round toe, a low heel and a strap across the instep with a button.',
    tip: 'The strap runs across the highest point of the foot, so it bends round the instep: draw it as a curve, not a straight band.',
    words: 'mary janes, strap shoes, round toe' },
  boot: { label: 'Boot', sole: 14, heel: 22, shaft: 150, vamp: 62, toe: 38, detail: 'band',
    says: 'The shaft goes up the calf and hides the ankle; the heel is a block and the opening is a cuff.',
    tip: 'The shaft is a tube that follows the leg and bends at the ankle: a crease or two at the bend, and a cuff or a zip line at the top.',
    words: 'boots, ankle boots, knee-high boots' },
  sandal: { label: 'Sandal', sole: 8, heel: 10, shaft: 0, vamp: 36, toe: 20, detail: 'straps',
    says: 'No upper: the foot, a flat sole and two straps - over the instep and round the ankle - and the toes in view.',
    tip: 'Draw the whole foot first, then lay the straps on it. The toes stay in the picture, so the foot has to be right.',
    words: 'sandals, bare feet, straps' },
  heel: { label: 'High heel', sole: 6, heel: 58, shaft: 40, vamp: 56, toe: 24, detail: 'pump',
    says: 'The heel lifts the foot so that it points down: the arch is steep and the toe barely touches the floor.',
    tip: 'Draw the leg line right down into the toe; the heel is a thin post under the back of the foot, not a block.',
    words: 'high heels, pumps' },
};
const AN_FOOTWEAR_VIEWS = { side: 'From the side', front: 'From the front' };

function anFootwearSide(S, x0, fl, ink) {
  const L = 230, x1 = x0 + L, hl = S.heel, yH = fl - hl - S.sole, yT = fl - S.sole - hl * 0.3, f = adF;
  const at = t => yH + (yT - yH) * t, back = yH - S.shaft;
  let s = '';
  // The leg above the shoe, grey.
  const legTop = Math.min(back, yH - 70) - 60;
  s += `<path d="M${f(x0 + 16)} ${f(legTop)} L${f(x0 + 22)} ${f(back)} M${f(x0 + 86)} ${f(legTop)} L${f(x0 + 90)} ${f(back + 4)}" fill="none" stroke="#9aa0b0" stroke-width="2"/>`;
  if (S.detail === 'straps') {
    // A bare foot on a flat sole with straps.
    s += `<path d="M${f(x0 + 14)} ${f(yH - 66)} L${f(x0 + 18)} ${f(yH)} L${f(x1 - 6)} ${f(yT - 4)} Q${f(x1 + 4)} ${f(yT - 12)} ${f(x1 - 12)} ${f(yT - 22)} Q${f(x0 + 150)} ${f(at(0.5) - 48)} ${f(x0 + 100)} ${f(at(0.3) - 46)} L${f(x0 + 92)} ${f(yH - 68)}Z" fill="#fbe3d3" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
    s += `<path d="M${f(x0 + 120)} ${f(at(0.45) - 40)} Q${f(x0 + 128)} ${f(at(0.45) - 18)} ${f(x0 + 124)} ${f(at(0.45) + 2)} M${f(x0 + 98)} ${f(yH - 54)} Q${f(x0 + 56)} ${f(yH - 44)} ${f(x0 + 16)} ${f(yH - 54)}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
    for (let i = 0; i < 4; i++) s += `<circle cx="${f(x1 - 10 - i * 11)}" cy="${f(yT - 11 + i * 1.2)}" r="${f(5 - i * 0.6)}" fill="#fbe3d3" stroke="${ink}" stroke-width="1.4"/>`;
  } else {
    // The upper.
    const open = x0 + 0.36 * L, dip = S.detail === 'laces' ? 8 : 16;
    const top = [x1 - 16, at(1) - S.toe + 6];
    s += `<path d="M${f(x0)} ${f(yH)} L${f(x0 - 2)} ${f(back)} L${f(open)} ${f(back + dip)} Q${f(x0 + 0.5 * L)} ${f(yH - S.vamp - 4)} ${f(top[0])} ${f(top[1])} Q${f(x1 + 4)} ${f(yT - S.toe * 0.45)} ${f(x1)} ${f(yT)} L${f(x0)} ${f(yH)}Z" fill="#fff" stroke="${ink}" stroke-width="2.6" stroke-linejoin="round"/>`;
    // The sole, and a heel block under the back.
    s += `<path d="M${f(x0 - 2)} ${f(yH)} L${f(x1)} ${f(yT)} L${f(x1)} ${f(yT + S.sole)} L${f(x0 + 36)} ${f(yH + S.sole + hl * 0.7)} L${f(x0 - 2)} ${f(yH + S.sole)}Z" fill="#e6e8ee" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (hl > 0) {
      const w = S.detail === 'pump' ? 12 : 34;
      s += `<path d="M${f(x0 - 2)} ${f(yH + S.sole)} H${f(x0 + w)} L${f(x0 + w - 3)} ${f(fl)} H${f(x0 + 1)}Z" fill="#d6d8e0" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
    }
    if (S.detail === 'laces') {
      for (let i = 0; i < 4; i++) { const px = x0 + 0.42 * L + i * 22, py = yH - S.vamp + 4 + i * 3.5; s += `<path d="M${f(px)} ${f(py - 6)} l8 12" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`; }
      s += `<path d="M${f(x1 - 56)} ${f(yT - 6)} Q${f(x1 - 50)} ${f(yT - S.toe * 0.6)} ${f(x1 - 30)} ${f(yT - S.toe * 0.8)}" fill="none" stroke="${ink}" stroke-width="1.8"/>`;
    } else if (S.detail === 'strap') {
      s += `<path d="M${f(x0 + 0.5 * L - 4)} ${f(yH - S.vamp + 1)} Q${f(x0 + 0.5 * L - 14)} ${f(yH - S.vamp / 2)} ${f(x0 + 0.5 * L - 8)} ${f(yH - 4)}" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><circle cx="${f(x0 + 0.5 * L - 12)}" cy="${f(yH - S.vamp / 2)}" r="3.2" fill="#fff" stroke="${ink}" stroke-width="1.4"/>`;
    } else if (S.detail === 'band') {
      s += `<path d="M${f(x0 + 0.5 * L + 6)} ${f(yH - S.vamp + 4)} Q${f(x0 + 0.5 * L + 20)} ${f(yH - S.vamp / 2)} ${f(x0 + 0.5 * L + 10)} ${f(at(0.7) - 6)}" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="5 4"/>`;
      if (S.shaft > 100) s += `<path d="M${f(x0 - 2)} ${f(back + 14)} L${f(open - 2)} ${f(back + dip + 14)}" stroke="${ink}" stroke-width="1.8"/>`;
    }
  }
  return s;
}

function anFootwearFront(S, cx, fl, ink) {
  const f = adF, w = 66, h = S.vamp * 0.8 + S.toe * 0.3;
  let s = '';
  for (const sx of [-1, 1]) {
    const x = cx + sx * 48, top = fl - S.heel * 0.2 - S.sole - h;
    s += `<path d="M${f(x - 8)} ${f(top - 70)} V${f(top + 6)} M${f(x + 8)} ${f(top - 70)} V${f(top + 6)}" stroke="#9aa0b0" stroke-width="2" fill="none"/>`;
    if (S.shaft > 100) s += `<rect x="${f(x - 20)}" y="${f(top - 90)}" width="40" height="${f(S.shaft - 6)}" rx="6" fill="#fff" stroke="${ink}" stroke-width="2.4"/>`;
    s += `<path d="M${f(x - w / 2)} ${f(fl - S.sole)} C${f(x - w / 2)} ${f(top - h * 0.25)} ${f(x + w / 2)} ${f(top - h * 0.25)} ${f(x + w / 2)} ${f(fl - S.sole)}Z" fill="${S.detail === 'straps' ? '#fbe3d3' : '#fff'}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
    s += `<rect x="${f(x - w / 2 - 2)}" y="${f(fl - S.sole)}" width="${w + 4}" height="${S.sole}" rx="3" fill="#e6e8ee" stroke="${ink}" stroke-width="2.2"/>`;
    if (S.detail === 'laces') for (let i = 0; i < 3; i++) s += `<path d="M${f(x - 7)} ${f(top + 10 + i * 8)} l14 5 M${f(x + 7)} ${f(top + 10 + i * 8)} l-14 5" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (S.detail === 'strap' || S.detail === 'straps') s += `<path d="M${f(x - w / 2 + 4)} ${f(top + h * 0.55)} Q${f(x)} ${f(top + h * 0.4)} ${f(x + w / 2 - 4)} ${f(top + h * 0.55)}" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`;
    if (S.detail === 'band') s += `<path d="M${f(x - w / 2 + 6)} ${f(top + h * 0.5)} Q${f(x)} ${f(top + h * 0.38)} ${f(x + w / 2 - 6)} ${f(top + h * 0.5)}" fill="none" stroke="${ink}" stroke-width="1.8" stroke-dasharray="5 4"/>`;
    if (S.detail === 'pump') s += `<path d="M${f(x - 12)} ${f(top + 8)} Q${f(x)} ${f(top + 18)} ${f(x + 12)} ${f(top + 8)}" fill="none" stroke="${ink}" stroke-width="1.8"/>`;
    if (S.detail === 'straps') for (let i = 0; i < 5; i++) s += `<circle cx="${f(x - 20 + i * 10)}" cy="${f(fl - S.sole - 6 - (i === 0 || i === 4 ? 0 : 3))}" r="4" fill="#fbe3d3" stroke="${ink}" stroke-width="1.2"/>`;
  }
  return s;
}

function anFootwearSvg(o) {
  const S = AN_FOOTWEAR[o.shoe] || AN_FOOTWEAR.sneaker, ink = AD_INK, W = 420, H = 300, fl = 262;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/><path d="M10 ${fl} H${W - 10}" stroke="#aab" stroke-width="1.2"/>`;
  s += o.view === 'front' ? anFootwearFront(S, W / 2, fl, ink) : anFootwearSide(S, 90, fl, ink);
  s += `<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${esc(S.label)}</text>`;
  return adSvgOpen([0, 0, W, H], `${S.label} ${o.view === 'front' ? 'from the front' : 'from the side'}`) + s + '</svg>';
}

function anFootwearNotes(o) {
  const S = AN_FOOTWEAR[o.shoe] || AN_FOOTWEAR.sneaker;
  return [S.says, S.tip, 'The leg in grey goes down into the shoe: draw the ankle first, then the shoe round it.'];
}

/* ---- ears and neck */

const AN_EARNECK_VIEWS = { ear: 'The ear', neck: 'The neck' };
const AN_EARNECK_NOTES = {
  ear: ['The top of the ear is on the eyebrow line and the bottom of the lobe on the line of the base of the nose, from every side.',
    'From the front the ears flare out at the top. In three-quarter only the far one is shown, further back; from the side it sits behind the middle of the head, nearer the back than the nose.',
    'The dashed orange lines are the eyebrow line and the nose line: draw them across the head first, then fit the ear between them.'],
  neck: ['The neck is about half the width of the head from the front, and it does not stand straight: from the side it leans forward and is set on under the back of the skull.',
    'The collarbones make a V that starts at the notch under the throat and run out to the shoulders; the trapezius slopes from the neck to the shoulder, not at a right angle.',
    'In three-quarter the muscle from behind the ear to the notch is the one line that tells the turn. Draw it and the neck turns with the head.'],
};

function anEarNeckSvg(o) {
  const ink = AD_INK, W = 640, H = 380, f = adF, G = '#d67a3a';
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  const line = (d, w = 2.4, extra = '') => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const label = (x, t) => `<text x="${x}" y="${H - 16}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#333">${esc(t)}</text>`;
  if (o.view === 'neck') {
    // Front.
    let cx = 110;
    s += `<ellipse cx="${cx}" cy="95" rx="42" ry="52" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4"/>`;
    s += line(`M${cx - 22} 138 L${cx - 24} 205 M${cx + 22} 138 L${cx + 24} 205`) +
      line(`M${cx - 24} 205 Q${cx - 60} 212 ${cx - 112} 240 M${cx + 24} 205 Q${cx + 60} 212 ${cx + 112} 240`, 2.4, 'stroke-opacity=".75"') +
      line(`M${cx} 214 Q${cx - 36} 214 ${cx - 70} 232 M${cx} 214 Q${cx + 36} 214 ${cx + 70} 232`, 1.8) +
      `<path d="M${cx - 44} 200 H${cx + 44}" stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>`;
    s += label(cx, 'Front');
    // Three-quarter.
    cx = 320;
    s += `<ellipse cx="${cx - 6}" cy="95" rx="38" ry="52" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4" transform="rotate(-6 ${cx - 6} 95)"/>`;
    s += line(`M${cx - 18} 140 L${cx - 22} 205 M${cx + 22} 128 L${cx + 26} 205`) +
      line(`M${cx + 20} 128 Q${cx + 4} 168 ${cx - 14} 212`, 1.8) +
      line(`M${cx - 22} 205 Q${cx - 70} 214 ${cx - 114} 240 M${cx + 26} 205 Q${cx + 66} 212 ${cx + 106} 238`, 2.4, 'stroke-opacity=".75"') +
      line(`M${cx - 14} 214 Q${cx - 44} 216 ${cx - 70} 232 M${cx - 14} 214 Q${cx + 16} 216 ${cx + 50} 230`, 1.8);
    s += label(cx, 'Three-quarter');
    // Side.
    cx = 530;
    s += `<path d="M${cx - 44} 80 C${cx - 44} 40 ${cx + 40} 40 ${cx + 44} 86 C${cx + 46} 112 ${cx + 30} 130 ${cx + 8} 142 L${cx - 22} 140 C${cx - 40} 128 ${cx - 46} 106 ${cx - 44} 80Z" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4"/>`;
    s += line(`M${cx + 26} 118 Q${cx + 34} 168 ${cx + 40} 212 M${cx - 14} 140 Q${cx - 14} 176 ${cx - 12} 206`) +
      line(`M${cx - 12} 206 Q${cx - 50} 214 ${cx - 90} 238 M${cx + 40} 212 Q${cx + 70} 222 ${cx + 100} 246`, 2.4, 'stroke-opacity=".75"');
    s += `<path d="M${cx - 26} 130 L${cx + 46} 166" stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>`;
    s += label(cx, 'Side');
    return adSvgOpen([0, 0, W, H], 'The neck from the front, in three-quarter and from the side') + s + '</svg>';
  }
  // The ear, on three heads with the eyebrow and nose lines through them.
  const top = 60, h = 220, brow = top + h * 0.42, nose = top + h * 0.7, mid = (brow + nose) / 2;
  const ear = (x, rx, ry, tilt = 0, inner = true) => `<g transform="rotate(${tilt} ${f(x)} ${f(mid)})"><ellipse cx="${f(x)}" cy="${f(mid)}" rx="${rx}" ry="${ry}" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4"/>` +
    (inner ? `<path d="M${f(x + rx * 0.2)} ${f(mid - ry * 0.55)} Q${f(x - rx * 0.6)} ${f(mid)} ${f(x + rx * 0.2)} ${f(mid + ry * 0.5)}" fill="none" stroke="${ink}" stroke-width="1.4"/>` : '') + '</g>';
  // Front.
  let cx = 110;
  s += `<path d="M${cx - 62} ${top + 80} C${cx - 62} ${top - 14} ${cx + 62} ${top - 14} ${cx + 62} ${top + 80} C${cx + 62} ${top + 170} ${cx + 22} ${top + h} ${cx} ${top + h} C${cx - 22} ${top + h} ${cx - 62} ${top + 170} ${cx - 62} ${top + 80}Z" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4"/>`;
  s += ear(cx - 68, 9, 26, -8) + ear(cx + 68, 9, 26, 8);
  s += `<path d="M${cx - 6} ${top + h * 0.62} q6 5 12 0" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
  s += label(cx, 'Front');
  // Three-quarter.
  cx = 320;
  s += `<path d="M${cx - 56} ${top + 80} C${cx - 56} ${top - 12} ${cx + 66} ${top - 12} ${cx + 66} ${top + 80} C${cx + 66} ${top + 170} ${cx + 20} ${top + h} ${cx - 14} ${top + h} C${cx - 40} ${top + h - 6} ${cx - 56} ${top + 160} ${cx - 56} ${top + 80}Z" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4"/>`;
  s += ear(cx + 62, 12, 26, 4) + `<path d="M${cx - 58} ${top + h * 0.62} q-12 4 -2 10" fill="none" stroke="${ink}" stroke-width="2"/>`;
  s += label(cx, 'Three-quarter');
  // Side.
  cx = 530;
  s += `<path d="M${cx - 66} ${top + h * 0.62} C${cx - 70} ${top + 10} ${cx + 66} ${top - 14} ${cx + 66} ${top + 80} C${cx + 66} ${top + 150} ${cx + 30} ${top + h - 20} ${cx - 8} ${top + h} L${cx - 40} ${top + h - 4} C${cx - 52} ${top + h - 30} ${cx - 54} ${top + h * 0.78} ${cx - 56} ${top + h * 0.72} L${cx - 66} ${top + h * 0.7}Z" fill="#fdf2ea" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>`;
  s += ear(cx + 10, 15, 27, 8) + `<path d="M${cx - 4} ${top + 40} V${top + h - 4}" stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>`;
  s += label(cx, 'Side');
  for (const y of [brow, nose]) s += `<path d="M20 ${f(y)} H${W - 20}" stroke="${G}" stroke-width="1" stroke-dasharray="3 4"/>`;
  return adSvgOpen([0, 0, W, H], 'The ear on a head from the front, in three-quarter and from the side, between the eyebrow line and the nose line') + s + '</svg>';
}

function anEarNeckNotes(o) { return AN_EARNECK_NOTES[o.view] || AN_EARNECK_NOTES.ear; }
