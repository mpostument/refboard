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
