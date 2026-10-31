/* refboard - Six more things for drawing anime, as plain data and pictures (the view is js/animedrawui.js):

   Hands. Twelve gestures, each as the bend of every finger joint, drawn from a palm-box and three-joint
   fingers in three turns (front, three-quarter, side), with what the gesture says and where to use it.
   Eyes. The shape (sharp, soft, flat), the height, the iris, the highlights and the lashes of one eye,
   in the flat 90s manner and the glossy modern one, with the order to draw its layers in.
   Hair. A hairstyle as clumps - a root, a bend, a tip - with the wind bending the tips more than the
   roots, drawn as colour, as numbered clumps, or as flow lines, with the ring of light across it.
   Shading. One sphere and one tube in four manners (cel, cel with two steps, soft, painted), with the
   shadow and light tones worked out from a base colour (shadows cooler, lights warmer).
   Expressions. Twelve emotions as where the brows, eyes and mouth go from the neutral face (shown
   dashed, with arrows), and the marks anime adds on top (blush, sweat, vein, tears, sparkles).
   Perspective for backgrounds. A room (one point), a street corner (two) and a tower (three), built
   from the horizon and the points, with figures whose eyes sit on the horizon.

   Everything is worked out here as data; the pictures are SVG strings. Loaded with the section
   (loadSection('anime')). */
"use strict";

const AD_INK = '#2a2a33';
const adClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const adF = n => Math.round(n * 10) / 10;
const adP = p => `${adF(p[0])} ${adF(p[1])}`;
const adRad = d => d * Math.PI / 180;
const adHex6 = h => /^#[0-9a-f]{6}$/i.test(h) ? h : '#888888';
const adRgbOf = hex => [1, 3, 5].map(i => parseInt(adHex6(hex).slice(i, i + 2), 16));
const adCss = rgb => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
const adMixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function adToHsl(rgb) {
  const [r, g, b] = rgb.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function adFromHsl([h, s, l]) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round(adClamp((v + m) * 255, 0, 255)));
}
// A hue turned a fraction t of the short way towards a target hue.
const adTurn = (h, target, t) => h + (((target - h + 540) % 360) - 180) * t;

/* The tones of a base colour. Anime light is warm and its shadow cool: the shadow is the base turned
   towards blue-violet and darker, the light towards yellow and paler; "painted" turns them further. */
function adTones(rgb, painted = false) {
  const [h, s, l] = adToHsl(rgb), k = painted ? 1.5 : 1;
  return {
    base: rgb,
    light: adFromHsl([adTurn(h, 50, 0.12 * k), s * 0.92, Math.min(0.96, l + (1 - l) * 0.42)]),
    shadow: adFromHsl([adTurn(h, 265, 0.1 * k), Math.min(1, s * 0.92 + 0.02), l * 0.8]),
    core: adFromHsl([adTurn(h, 275, 0.16 * k), Math.min(1, s * 0.95 + 0.04), l * 0.62]),
    reflect: adFromHsl([adTurn(h, 40, 0.1), s * 0.8, Math.min(0.9, l * 0.95 + 0.06)]),
  };
}

const adSvgOpen = (vb, label, extra = '') => {
  const [x, y, w, h] = vb;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="system-ui, sans-serif" role="img" aria-label="${esc(label)}"${extra}>`;
};

/* ---- hands */

/* A hand in a unit of about a millimetre: the palm 100 wide and 110 long, x across (the thumb at
   the negative side), y up the hand, z towards us. Each finger is three joints; a curl is how many
   degrees a joint bends towards the palm, adding up along the finger. The thumb has three, too. */
const AD_FINGERS = [['i', -37.5, [40, 25, 20], 15, -1], ['m', -12.5, [44, 28, 21], 15, -0.33], ['r', 12.5, [40, 25, 20], 14, 0.33], ['p', 37.5, [32, 20, 17], 12, 1]];
const AD_THUMB = { base: [-50, 25, 0], lens: [28, 28, 22] };
const AD_FIST = [85, 100, 70];
const AD_HANDS = {
  open: { label: 'Open palm', pose: { i: [0, 0, 0], m: [0, 0, 0], r: [0, 0, 0], p: [0, 0, 0], t: [0, 0, 0], spread: 12, tabd: 50 },
    says: 'Nothing hidden: greeting, stopping, offering, giving up.', use: 'A "wait", a "hello", a hand held out to be taken.', words: 'open hand, palm facing viewer, fingers slightly spread' },
  fist: { label: 'Fist', pose: { i: [80, 95, 70], m: AD_FIST, r: AD_FIST, p: AD_FIST, t: [30, 40, 30], spread: 0, tabd: 25 },
    says: 'Held-in force: anger, resolve, a promise.', use: 'A hit, a vow, a hand shaking with held-back feeling.', words: 'clenched fist, knuckles visible' },
  point: { label: 'Pointing', pose: { i: [0, 0, 0], m: AD_FIST, r: AD_FIST, p: AD_FIST, t: [10, 10, 5], spread: 0, tabd: 35 },
    says: 'Attention: look there, it is you, it is him.', use: 'Accusing, showing, a teacher at a board. Aimed at us it is the strongest.', words: 'pointing with index finger, other fingers curled' },
  v: { label: 'V sign', pose: { i: [0, 0, 0], m: [0, 0, 0], r: AD_FIST, p: AD_FIST, t: [30, 40, 30], spread: 22, tabd: 25 },
    says: 'Cheer: peace, a win, a photo.', use: 'A happy girl beside her face; the V is spread, never two parallel sticks.', words: 'peace sign, v sign with two fingers' },
  thumb: { label: 'Thumbs up', pose: { i: AD_FIST, m: AD_FIST, r: AD_FIST, p: AD_FIST, t: [0, 0, 0], spread: 0, tabd: 5 },
    says: 'Yes, well done, I am fine.', use: 'A quick answer without words; the fist stays loose, only the thumb is a line.', words: 'thumbs up gesture, fist with raised thumb' },
  ok: { label: 'OK', pose: { i: [45, 60, 40], m: [0, 0, 0], r: [0, 0, 0], p: [0, 0, 0], t: [25, 35, 30], spread: 14, tabd: 30 },
    says: 'All is well, perfect, exactly.', use: 'The circle of thumb and index is the clue; the other three fan out behind it. Drawn here only approximately: close the circle by eye.', words: 'ok hand sign, thumb and index finger forming a circle' },
  cup: { label: 'Holding a cup', pose: { i: [25, 30, 20], m: [30, 35, 22], r: [30, 35, 22], p: [28, 30, 20], t: [15, 20, 15], spread: 8, tabd: 45 },
    says: 'Warmth, calm, a pause.', use: 'Both hands round a mug; the fingers wrap in a loose C, the thumb sits apart.', words: 'hands holding a cup, fingers curled around' },
  cover: { label: 'Covering the face', pose: { i: [15, 20, 10], m: [10, 18, 10], r: [10, 18, 10], p: [15, 20, 10], t: [10, 15, 10], spread: 24, tabd: 60 },
    says: 'Shame, a hidden smile, tears held in.', use: 'Leave a gap between two fingers for an eye: it reads as a peek.', words: 'hands covering face, peeking through fingers' },
  pinch: { label: 'Pinching', pose: { i: [45, 50, 35], m: [35, 40, 30], r: [40, 45, 30], p: [45, 50, 30], t: [30, 30, 30], spread: 6, tabd: 20 },
    says: 'Small and careful: a thread, a petal, a card.', use: 'Only the thumb and index work; the other three curl loosely, as they do in life.', words: 'pinching with thumb and index finger, holding something small' },
  wave: { label: 'Waving', pose: { i: [5, 5, 5], m: [5, 5, 5], r: [5, 5, 5], p: [8, 8, 5], t: [5, 5, 5], spread: 24, tabd: 60 },
    says: 'Hello, goodbye, here I am.', use: 'Draw the arm swung to one side with the hand tilted; a few motion arcs behind the fingers.', words: 'waving hand, fingers spread' },
  chest: { label: 'Hand on chest', pose: { i: [25, 30, 15], m: [30, 35, 15], r: [30, 35, 15], p: [35, 38, 15], t: [10, 15, 10], spread: 0, tabd: 30 },
    says: 'A promise, relief, a heart that is racing.', use: 'The fingers rest together and curve with the ribs; the wrist bends back.', words: 'hand pressed to chest, gentle' },
  reach: { label: 'Reaching', pose: { i: [10, 12, 8], m: [8, 10, 6], r: [10, 12, 8], p: [14, 16, 10], t: [5, 10, 5], spread: 18, tabd: 40 },
    says: 'Want, hope, a hand to be caught.', use: 'Fingers just curved, the middle one furthest; shown from behind it is a long foreshortened shape.', words: 'reaching hand, fingers outstretched towards viewer' },
};
const AD_HAND_VIEWS = [[0, 'Front'], [45, 'Three-quarter'], [90, 'Side']];
const AD_HAND_BUILD = 'Build it as a box for the palm (about as long as the middle finger, a little wider than long), then each finger in three joints, the middle one longest; the knuckles lie on a gentle arc, and the thumb starts low in the palm, not at the wrist.';

function adHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = list => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...build(p), ...build([...p].reverse())];
}

// between(proj): something drawn on the palm and under the fingers - an object the hand holds.
function adHandView(pose, turn, ox, between = null) {
  const th = adRad(turn), cs = Math.cos(th), sn = Math.sin(th);
  const proj = ([x, y, z]) => [ox + 110 + (x * cs + z * sn) * 0.9, 215 - y * 0.9];
  const skin = '#f6d8c3', skinDark = '#e7b99f', ink = AD_INK;
  const poly = pts => pts.map((q, i) => (i ? 'L' : 'M') + adP(q)).join('') + 'Z';
  const box = [], wrist = [];
  for (const x of [-50, 50]) for (const y of [0, 110]) for (const z of [-12, 12]) box.push(proj([x, y, z]));
  for (const x of [-32, 32]) for (const y of [-42, 0]) for (const z of [-11, 11]) wrist.push(proj([x, y, z]));
  const chain = (base, lens, curls, dirAt) => {
    let p = base.slice(), cum = 0; const pts = [proj(p)];
    lens.forEach((L, i) => { cum += adRad(curls[i]); const d = dirAt(cum); p = [p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L]; pts.push(proj(p)); });
    return pts;
  };
  const line = (pts, w) => {
    const d = pts.map((q, i) => (i ? 'L' : 'M') + adP(q)).join('');
    return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w + 3.4}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${skin}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const dots = pts => pts.slice(1, -1).map(q => `<circle cx="${adF(q[0])}" cy="${adF(q[1])}" r="1.8" fill="${skinDark}"/>`).join('');
  let g = `<path d="${poly(adHull(wrist))}" fill="${skin}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="${poly(adHull(box))}" fill="${skin}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>` + (between ? between(proj) : '');
  const sorted = AD_FINGERS.map(f => {
    const [key, bx, lens, w, k] = f, sp = adRad(pose.spread * k);
    const pts = chain([bx, 110, 0], lens, pose[key], c => [Math.sin(sp) * Math.cos(c), Math.cos(sp) * Math.cos(c), Math.sin(c)]);
    return { pts, w };
  });
  for (const f of sorted) g += line(f.pts, f.w) + dots(f.pts);
  const ta = adRad(pose.tabd);
  const thumb = chain(AD_THUMB.base, AD_THUMB.lens, pose.t, c => {
    const d = [-Math.sin(ta) * Math.cos(c) + 0.6 * Math.sin(c), Math.cos(ta) * Math.cos(c), Math.sin(c)], n = Math.hypot(...d) || 1;
    return d.map(v => v / n);
  });
  g += line(thumb, 17) + dots(thumb);
  return g;
}

function adHandSvg(key) {
  const H = AD_HANDS[key] || AD_HANDS.open;
  let g = '';
  AD_HAND_VIEWS.forEach(([turn, label], i) => {
    g += adHandView(H.pose, turn, i * 220) + `<text x="${i * 220 + 110}" y="276" text-anchor="middle" font-size="12" fill="#666">${label}</text>`;
  });
  return adSvgOpen([0, 0, 660, 288], `${H.label}, drawn in three turns`) + `<rect width="660" height="288" fill="#fff"/>${g}</svg>`;
}

/* ---- eyes */

const AD_EYE_SHAPES = {
  tsurime: { label: 'Sharp (tsurime)', about: 'The outer corner is higher than the inner: alert, proud, a little cold.', words: 'sharp upturned eyes' },
  tareme: { label: 'Soft (tareme)', about: 'The outer corner droops: gentle, sleepy, kind.', words: 'soft drooping eyes' },
  jito: { label: 'Flat (jito-me)', about: 'The lid is straight and the eye half-lowered: bored, calm, suspicious.', words: 'flat half-lidded eyes' },
};
const AD_EYE_ERAS = {
  '90s': { label: '90s', about: 'Flat colour, one hard highlight, a thick upper line and a thin lower one.', words: '1990s anime eyes, flat colour, one hard highlight' },
  modern: { label: 'Modern', about: 'A tall iris with a gradient and a lighter glow below, several highlights, thin lashes and a lid crease.', words: 'large glossy anime eyes, gradient iris, several highlights' },
};
const AD_EYE_HL = { none: 'None', one: 'One', two: 'Two', sparkle: 'Sparkle' };
const AD_EYE_STEPS = {
  '90s': ['The eye shape: the upper line, then the lower.', 'The iris as a tall oval, cut by the lid.', 'The darker band at the top of the iris, the round pupil.', 'One big highlight, a hard circle, where the light comes from.', 'Thicken the upper line, with a short wing at the outer corner.', 'The thin lower line.'],
  modern: ['The eye shape with the lid crease above it.', 'The iris, taller than it is wide, cut by the lid.', 'The gradient: dark at the top, lighter and clearer at the bottom.', 'The pupil and a ring round the iris.', 'The glow of reflected light in the lower iris.', 'The highlights: a big one, a small one on the other side, sparkles if you want.', 'A thin upper line with three or four lashes flicking out, a partial lower line.'],
};

function adBez(p0, p1, p2, p3, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}
function adStar(x, y, r) {
  const k = r * 0.22;
  return `<path d="M${adF(x)} ${adF(y - r)} Q${adF(x + k)} ${adF(y - k)} ${adF(x + r)} ${adF(y)} Q${adF(x + k)} ${adF(y + k)} ${adF(x)} ${adF(y + r)} Q${adF(x - k)} ${adF(y + k)} ${adF(x - r)} ${adF(y)} Q${adF(x - k)} ${adF(y - k)} ${adF(x)} ${adF(y - r)}Z" fill="#fff"/>`;
}

/* o: { shape, era, tall (0.6-1.3), iris (0.6-1.2), hl, colour, lash (1-5), key } */
function adEyeSvg(o) {
  const shape = AD_EYE_SHAPES[o.shape] ? o.shape : 'tsurime', era = AD_EYE_ERAS[o.era] ? o.era : 'modern', key = String(o.key || 'e').replace(/[^a-z0-9]/gi, '');
  const tall = adClamp(+o.tall || 1, 0.6, 1.3), irisK = adClamp(+o.iris || 1, 0.6, 1.2), lash = adClamp(+o.lash || 3, 1, 5), hl = AD_EYE_HL[o.hl] ? o.hl : 'two';
  const T = adTones(adRgbOf(o.colour || '#3f7fb8')), ink = AD_INK, up = 82 * tall, st = +o.stage || 9, gxo = adClamp(+o.gx || 0, -1, 1) * 26, gyo = adClamp(+o.gy || 0, -1, 1) * 15;   // st: the stage of the drawing, 1 to 6 (the whole eye when it is not given)
  const I = [35, 114 + (shape === 'tsurime' ? 6 : shape === 'tareme' ? -4 : 0)], O = [225, 114 + (shape === 'tsurime' ? -24 : shape === 'tareme' ? 20 : 0)];
  const c1 = shape === 'tsurime' ? [I[0] + 28, I[1] - up * 1.15] : shape === 'tareme' ? [I[0] + 60, I[1] - up * 0.9] : [I[0] + 48, I[1] - up * 1.05];
  const c2 = shape === 'tsurime' ? [O[0] - 62, O[1] - up * 0.78] : shape === 'tareme' ? [O[0] - 30, O[1] - up * 1.05] : [O[0] - 48, O[1] - up * 1.05];
  const low = (shape === 'jito' ? 46 : 36) * tall, midY = (I[1] + O[1]) / 2;
  const upper = `M${adP(I)} C${adP(c1)} ${adP(c2)} ${adP(O)}`;
  const shapeD = `${upper} Q${adF(130)} ${adF(midY + low)} ${adP(I)}Z`;
  // gx, gy: where she looks, -1 to 1 (right and down are positive): the iris moves inside the lid, which cuts it.
  const cx = 128 + gxo, cy = midY - up * 0.16 + gyo, modern = era === 'modern';
  const rx = (modern ? 46 : 36) * irisK, ry = (modern ? 64 : 50) * irisK * Math.max(0.8, tall);
  const clip = `adc-${key}`, grad = `adg-${key}`, irisClip = `adi-${key}`;
  let g = `<defs><clipPath id="${clip}"><path d="${shapeD}"/></clipPath><clipPath id="${irisClip}"><ellipse cx="${cx}" cy="${adF(cy)}" rx="${adF(rx)}" ry="${adF(ry)}"/></clipPath>` +
    `<linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${adCss(T.core)}"/><stop offset="0.45" stop-color="${adCss(T.base)}"/><stop offset="1" stop-color="${adCss(T.reflect)}"/></linearGradient></defs>`;
  g += `<path d="${shapeD}" fill="#fff"/><g clip-path="url(#${clip})">`;
  if (st < 2) { /* only the outline of the eye */ }
  else if (modern) {
    g += `<ellipse cx="${cx}" cy="${adF(cy)}" rx="${adF(rx)}" ry="${adF(ry)}" fill="${st < 3 ? adCss(T.base) : `url(#${grad})`}" stroke="${adCss(T.core)}" stroke-width="3"/>` +
      (st >= 4 ? `<ellipse cx="${cx}" cy="${adF(cy + ry * 0.55)}" rx="${adF(rx * 0.68)}" ry="${adF(ry * 0.3)}" fill="${adCss(T.light)}" opacity="0.5"/>` : '') +
      (st >= 3 ? `<ellipse cx="${cx}" cy="${adF(cy - ry * 0.05)}" rx="${adF(rx * 0.36)}" ry="${adF(ry * 0.5)}" fill="${ink}"/>` : '');
  } else {
    g += `<ellipse cx="${cx}" cy="${adF(cy)}" rx="${adF(rx)}" ry="${adF(ry)}" fill="${adCss(T.base)}"/>` +
      (st >= 3 ? `<rect x="${adF(cx - rx)}" y="${adF(cy - ry)}" width="${adF(rx * 2)}" height="${adF(ry * 0.8)}" fill="${adCss(T.core)}" opacity="0.85" clip-path="url(#${irisClip})"/>` +
      `<ellipse cx="${cx}" cy="${adF(cy)}" rx="${adF(rx * 0.35)}" ry="${adF(ry * 0.5)}" fill="${ink}"/>` : '');
  }
  if (hl !== 'none' && st >= 5) {
    const r1 = rx * (modern ? 0.3 : 0.34);
    g += `<circle cx="${adF(cx - rx * 0.36)}" cy="${adF(cy - ry * 0.4)}" r="${adF(r1)}" fill="#fff"/>`;
    if (modern && (hl === 'two' || hl === 'sparkle')) g += `<circle cx="${adF(cx + rx * 0.4)}" cy="${adF(cy + ry * 0.44)}" r="${adF(rx * 0.12)}" fill="#fff"/>`;
    if (modern && hl === 'sparkle') g += adStar(cx + rx * 0.05, cy + ry * 0.5, rx * 0.2) + adStar(cx - rx * 0.62, cy + ry * 0.1, rx * 0.11);
  }
  g += '</g>';
  // The upper line: thick and winged in the 90s, thin with flicks now.
  const wUp = st < 6 ? 2 : modern ? lash * 1.1 + 1 : lash * 2.2 + 1;
  g += `<path d="${upper}" fill="none" stroke="${ink}" stroke-width="${adF(wUp)}" stroke-linecap="round"/>`;
  if (st < 6) g += `<path d="M${adP(O)} Q${adF(130)} ${adF(midY + low)} ${adP(I)}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
  else if (modern) {
    for (const t of [0.72, 0.84, 0.95]) {
      const p = adBez(I, c1, c2, O, t), q = adBez(I, c1, c2, O, Math.min(1, t + 0.04)), dx = q[0] - p[0], dy = q[1] - p[1], n = Math.hypot(dx, dy) || 1;
      const f = 7 + lash * 2.2;
      g += `<path d="M${adP(p)} l${adF(dx / n * f * 0.5 + dy / n * f * 0.7)} ${adF(dy / n * f * 0.5 - dx / n * f * 0.7)}" stroke="${ink}" stroke-width="${adF(1.6 + lash * 0.3)}" stroke-linecap="round"/>`;
    }
    const crease = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t, i) => { const p = adBez(I, c1, c2, O, t); return (i ? 'L' : 'M') + adP([p[0], p[1] - 12 * tall]); }).join('');
    g += `<path d="${crease}" fill="none" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>` +
      `<path d="M${adP(O)} Q${adF(130)} ${adF(midY + low)} ${adP(I)}" fill="none" stroke="${ink}" stroke-width="1.2" opacity="0.65"/>`;
  } else {
    const p = O, wing = [p[0] + 16, p[1] - 6 - lash];
    g += `<path d="M${adP(p)} L${adP(wing)}" stroke="${ink}" stroke-width="${adF(wUp * 0.7)}" stroke-linecap="round"/>` +
      `<path d="M${adP(O)} Q${adF(130)} ${adF(midY + low)} ${adP(I)}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return adSvgOpen([0, 0, 260, 200], `${AD_EYE_SHAPES[shape].label} eye in the ${AD_EYE_ERAS[era].label} manner`) + `<rect width="260" height="200" fill="#f7f5ef"/>${g}</svg>`;
}

/* The eye in six stages on one sheet, three across: the shape, the flat iris, the dark top and the pupil, the
   glow, the highlights, and the lines. Each panel is adEyeSvg at one stage. */
const AD_EYE_STAGES = ['The shape of the eye', 'The iris, flat', 'The dark top and the pupil', 'The glow below', 'The highlights', 'The lines and the lashes'];
// What to do at each stage in each material (watercolour, watercolour pencils, Copic markers, ink).
const AD_EYE_MATERIAL = {
  water: ['Pencil only, very light: keep the white of the eye bare paper.', 'One wet wash of the iris colour, with the highlight places left dry. Let it dry.', 'Drop a darker wash of the same colour into the top while it is damp; when dry, the pupil in a dark mix.', 'Lift the bottom of the iris with a damp brush, or glaze a warm light colour there.', 'Keep the highlights as bare paper; if they were lost, white gouache on a dry iris.', 'Fine brush, size 0 or 1: the upper line thick, the lashes in flicks, a pale line for the lower lid.'],
  pencils: ['Draw the shape in a sharp pencil, lightly.', 'Colour the iris with the base pencil, light pressure, leaving the highlights white.', 'Press harder at the top with a darker pencil, then the pupil in the darkest.', 'A lighter pencil in the lower iris, laid on top.', 'Keep the highlights as bare paper; lift a mistake with a kneaded eraser.', 'A sharp dark pencil for the upper line and the lashes; the lower lid in a lighter one.'],
  copic: ['Draw the shape in a light pencil, then the lines later.', 'The iris with the lightest marker of its colour, the highlights left white.', 'The top of the iris and the pupil with a darker marker while the first is wet.', 'A light marker over the bottom, in the lightest of the colour.', 'White gel pen or a white paint marker on the highlights, last.', 'A fineliner for the upper line, thicker at the corner, and a thin lower line.'],
  ink: ['Pencil the shape and keep it light.', 'The iris outline with a thin line; leave it empty.', 'Fill the top of the iris and the pupil with solid black, or hatch it closely.', 'A few close lines or dots in the lower iris, left lighter.', 'The highlights stay as paper: draw round them, do not paint over them.', 'The upper line thick and winged, the lashes flicked outwards, the lower line thin.'],
};
function adEyeStepsSvg(o) {
  const panels = AD_EYE_STAGES.map((name, i) => {
    const r = adEyeSvg({ ...o, stage: i + 1, key: 'es' + i })
      .replace(/ width="[\d.]+" height="[\d.]+"/, ' width="200" height="154"')
      .replace('<svg ', `<svg x="${(i % 3) * 206 + 3}" y="${Math.floor(i / 3) * 190}" `);
    return r + `<text x="${(i % 3) * 206 + 103}" y="${Math.floor(i / 3) * 190 + 174}" text-anchor="middle" font-size="12" font-weight="600" fill="#333">${i + 1}. ${esc(name)}</text>`;
  });
  return adSvgOpen([0, 0, 624, 380], 'The eye in six steps') + `<rect width="624" height="380" fill="#fff"/>${panels.join('')}</svg>`;
}

/* Both eyes looking at one place: gx, gy as the eye takes them, and near (0 - 1) turning both inward as an object comes close. The right
   eye is the left one turned over, so its irises move by the opposite x. */
function adGazeKind(gx, gy) {
  const ax = Math.abs(gx), ay = Math.abs(gy);
  if (ax < 0.25 && ay < 0.25) return 'centre';
  if (ay > ax) return gy < 0 ? 'up' : 'down';
  return gx < 0 ? 'left' : 'right';
}
const AD_GAZE_SAYS = {
  centre: 'Looking straight at us: direct, honest, sometimes a challenge. The iris is in the middle of the lid, a little white on each side.',
  up: 'Looking up: thinking, hoping, remembering. The iris touches the upper lid, and the white shows under it.',
  down: 'Looking down: shy, sad or reading. The upper lid comes down over the iris, so draw the lid heavier and keep the lashes long.',
  left: 'Looking to the left of the picture: out of the frame, so she is looking at something we cannot see. Put what she sees in the next panel.',
  right: 'Looking to the right of the picture: the same, to the other side. Leave room on that side of the frame for what she sees.',
};
function adGazeWords(gx, gy) { return { centre: 'looking at viewer', up: 'looking up', down: 'looking down', left: 'looking to the side, facing left', right: 'looking to the side, facing right' }[adGazeKind(gx, gy)]; }
function adGazeSvg(o) {
  const near = adClamp(+o.near || 0, 0, 1), gx = adClamp(+o.gx || 0, -1, 1), gy = adClamp(+o.gy || 0, -1, 1);
  const one = (key, x) => adEyeSvg({ shape: o.shape, era: o.era, tall: o.tall, iris: o.iris, hl: o.hl, lash: o.lash, colour: o.colour, key, gx: x, gy });
  const left = one('gl', adClamp(gx + near * 0.4, -1, 1)), right = one('gr', adClamp(-(gx - near * 0.4), -1, 1));
  const parts = left.replace('<svg ', '<svg x="0" y="0" ') + `<g transform="translate(540 0) scale(-1 1)">${right.replace('<svg ', '<svg x="0" y="0" ')}</g>`;
  return adSvgOpen([0, 0, 540, 200], 'Both eyes looking ' + adGazeKind(gx, gy)) + `<rect width="540" height="200" fill="#f7f5ef"/>${parts}</svg>`;
}

/* ---- hair */

const AD_HAIR = {
  bob: { label: 'Short bob', len: 90, spread: 26, sideLen: 85, sideSpread: 6, nBack: 7, wave: 0, tied: 0,
    how: 'Three big clumps first - left, back, right - then split each in two. The tips curve in under the jaw.', words: 'short bob haircut' },
  long: { label: 'Long straight', len: 230, spread: 34, sideLen: 210, sideSpread: 10, nBack: 9, wave: 0, tied: 0,
    how: 'A few wide sheets, not hundreds of strands: draw the outline of the fall, then cut a few notches in the tips.', words: 'long straight hair' },
  wavy: { label: 'Long wavy', len: 215, spread: 40, sideLen: 195, sideSpread: 14, nBack: 9, wave: 26, tied: 0,
    how: 'Each clump is an S: the wave goes the same way across neighbouring clumps, a little out of step.', words: 'long wavy hair' },
  ponytail: { label: 'Ponytail', len: 0, spread: 0, sideLen: 45, sideSpread: 4, nBack: 0, wave: 0, tied: 1,
    how: 'The tail grows from the tie, not from the scalp: a fat clump that tapers, with the hair at the top pulled tight towards it.', words: 'ponytail' },
  twintails: { label: 'Twintails', len: 0, spread: 0, sideLen: 70, sideSpread: 6, nBack: 0, wave: 0, tied: 2,
    how: 'Both tails start at the same height, and hang in matching curves; the tie is a small band, the hair swells just below it.', words: 'twintails' },
};
const AD_HAIR_LOOK = { colour: 'Colour', clumps: 'Clumps', flow: 'Flow lines', steps: 'Steps' };
// The six stages a hairstyle is built in; each is drawn by adHairSvg as a look of its own.
const AD_HAIR_STAGES = ['bare', 'mass', 'clumps', 'flow', 'base', 'final'];
const AD_HAIR_STEPS = [
  'The head and the parting: the skull as a ball, the hairline and the parting. Hair grows from the parting, not from the outline.',
  'The mass: the outline of the whole fall as one shape - how wide, how long, where it is fullest - before any clump.',
  'The big clumps: split the mass into a few numbered clumps, each wide at the root and tapering to the tip.',
  'The flow: an arrow down each clump, root to tip. Every clump bends once, and the bends agree.',
  'The flat colour: the base tone in every clump, with the line on.',
  'The shadow and the light: a darker stroke down each clump, and the ring of light across the crown.',
];
const AD_WIND = { none: 'None', left: 'To the left', right: 'To the right' };

// A tapered clump from its root to its tip; bend pushes the middle sideways.
function adClump(r, t, bend, w) {
  const dx = t[0] - r[0], dy = t[1] - r[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const c = [(r[0] + t[0]) / 2 + nx * bend, (r[1] + t[1]) / 2 + ny * bend];
  const a = [r[0] + nx * w / 2, r[1] + ny * w / 2], b = [r[0] - nx * w / 2, r[1] - ny * w / 2];
  const ca = [c[0] + nx * w * 0.45, c[1] + ny * w * 0.45], cb = [c[0] - nx * w * 0.45, c[1] - ny * w * 0.45];
  return { r, t, c, d: `M${adP(a)} Q${adP(ca)} ${adP(t)} Q${adP(cb)} ${adP(b)}Z` };
}

const AD_HEAD = { cx: 150, cy: 135, rx: 58, ry: 68 };

// The clumps of a style in three groups, drawn in this order: behind the head, beside the face, over the brow.
function adHairClumps(style, wind, strength) {
  const S = AD_HAIR[style] || AD_HAIR.long, { cx, cy, rx, ry } = AD_HEAD;
  const W = ({ none: 0, left: -1, right: 1 }[wind] || 0) * adClamp(+strength || 1, 1, 3);
  const blow = (len, k = 1) => [W * len * 0.1 * k, -Math.abs(W) * len * 0.03 * k];
  const back = [], side = [], fringe = [], ties = [];
  if (S.nBack) {
    for (let i = 0; i < S.nBack; i++) {
      const u = S.nBack > 1 ? i / (S.nBack - 1) * 2 - 1 : 0, len = S.len * (0.86 + 0.14 * Math.cos(i * 1.7)), b = blow(len);
      const root = [cx + u * rx * 0.95, cy - ry * 0.5 + Math.abs(u) * 22];
      back.push(adClump(root, [cx + u * (rx + S.spread) + b[0], root[1] + len + b[1]], u * 10 + S.wave * (i % 2 ? 1 : -1), 34));
    }
  }
  if (S.tied === 1) {
    const root = [cx + rx * 0.6, cy - ry * 0.8], b = blow(170, 1.5);
    back.push(adClump(root, [cx + rx + 62 + b[0], cy + 130 + b[1]], 40, 44));
    ties.push(root);
  }
  if (S.tied === 2) {
    for (const sd of [-1, 1]) {
      const root = [cx + sd * (rx + 2), cy - 42], b = blow(180, 1.4);
      back.push(adClump(root, [cx + sd * (rx + 58) + b[0], cy + 170 + b[1]], sd * 30, 40));
      ties.push(root);
    }
  }
  for (const sd of [-1, 1]) {
    const b = blow(S.sideLen);
    side.push(adClump([cx + sd * (rx + 2), cy - 30], [cx + sd * (rx + S.sideSpread) + b[0], cy - 30 + S.sideLen + b[1]], sd * 8 + S.wave * 0.4 * sd, 26));
  }
  for (let i = 0; i < 5; i++) {
    const u = i / 4 * 2 - 1, dir = u + 0.2 < 0 ? -1 : 1, b = blow(60, 0.8);
    const root = [cx + u * rx * 0.8, cy - ry * 0.8 + u * u * 14];
    fringe.push(adClump(root, [root[0] + dir * (12 + 8 * Math.abs(u)) + b[0], cy - 22 + 12 * Math.cos(i * 1.7) + b[1]], dir * 5, 36));
  }
  return { back, side, fringe, ties };
}

/* o: { style, wind, strength, colour, look, key } */
function adHairSvg(o) {
  const style = AD_HAIR[o.style] ? o.style : 'long', key = String(o.key || 'h').replace(/[^a-z0-9]/gi, '');
  const stage = AD_HAIR_STAGES.includes(o.look) ? o.look : '';
  const look = stage ? ({ base: 'colour', final: 'colour' }[stage] || stage) : (AD_HAIR_LOOK[o.look] && o.look !== 'steps' ? o.look : 'colour');
  const shaded = stage !== 'base';       // the shadow strokes and the ring of light come last
  const { cx, cy, rx, ry } = AD_HEAD, tones = adTones(adRgbOf(o.colour || '#6b4a2f')), ink = AD_INK;
  const C = adHairClumps(style, o.wind, o.strength);
  const all = [...C.back, ...C.side, ...C.fringe];
  let n = 0;
  const draw = list => list.map(c => {
    const id = ++n;
    if (look === 'bare') return '';
    if (look === 'mass') return `<path d="${c.d}" fill="#cdc6b4" stroke="#cdc6b4" stroke-width="2" stroke-linejoin="round"/>`;
    if (look === 'clumps') {
      const hue = (id * 47) % 360, m = [(c.r[0] + c.t[0]) / 2, (c.r[1] + c.t[1]) / 2];
      return `<path d="${c.d}" fill="hsl(${hue} 55% 70%)" fill-opacity="0.75" stroke="${ink}" stroke-width="1.4"/><text x="${adF(m[0])}" y="${adF(m[1] + 4)}" text-anchor="middle" font-size="11" font-weight="700" fill="${ink}">${id}</text>`;
    }
    if (look === 'flow') {
      return `<path d="${c.d}" fill="#ebe7dd" stroke="#b9b3a3" stroke-width="1"/>` +
        `<path d="M${adP(c.r)} Q${adP(c.c)} ${adP(c.t)}" fill="none" stroke="#c8412f" stroke-width="1.8" marker-end="url(#ahf-${key})"/>`;
    }
    return `<path d="${c.d}" fill="${adCss(tones.base)}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round"/>` +
      (shaded ? `<path d="M${adP(c.r)} Q${adP(c.c)} ${adP(c.t)}" fill="none" stroke="${adCss(tones.shadow)}" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/>` : '');
  }).join('');
  const skin = '#fbe9dc', capFill = look === 'colour' ? adCss(tones.base) : look === 'flow' ? '#ebe7dd' : look === 'mass' ? '#cdc6b4' : look === 'bare' ? 'none' : 'hsl(210 30% 85%)';
  const face = `M${cx - rx} ${cy - 8} C${cx - rx} ${cy + 40} ${cx - 26} ${cy + ry} ${cx} ${cy + ry} C${cx + 26} ${cy + ry} ${cx + rx} ${cy + 40} ${cx + rx} ${cy - 8} C${cx + rx} ${cy - ry * 0.9} ${cx - rx} ${cy - ry * 0.9} ${cx - rx} ${cy - 8}Z`;
  const cap = `M${cx - rx - 8} ${cy + 12} C${cx - rx - 14} ${cy - ry - 30} ${cx + rx + 14} ${cy - ry - 30} ${cx + rx + 8} ${cy + 12} Q${cx + rx - 6} ${cy - 30} ${cx} ${cy - ry * 0.7} Q${cx - rx + 6} ${cy - 30} ${cx - rx - 8} ${cy + 12}Z`;
  const capId = `ahc-${key}`;
  let g = `<defs><clipPath id="${capId}"><path d="${cap}"/></clipPath><marker id="ahf-${key}" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#c8412f"/></marker></defs>`;
  g += draw(C.back);
  g += `<rect x="${cx - 18}" y="${cy + 50}" width="36" height="52" fill="${skin}" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="${face}" fill="${skin}" stroke="${ink}" stroke-width="1.8"/>` +
    `<path d="M${cx - 34} ${cy + 14} q10 -6 20 0 M${cx + 14} ${cy + 14} q10 -6 20 0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M${cx - 10} ${cy + 46} q10 5 20 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  g += draw(C.side);
  g += `<path d="${cap}" fill="${capFill}" stroke="${look === 'mass' ? capFill : ink}" stroke-width="1.6"${look === 'bare' ? ' stroke-dasharray="5 4"' : ''}/>`;
  if (look === 'bare') g += `<path d="M${cx} ${cy - ry * 0.7} V${cy - 22}" stroke="#c8412f" stroke-width="2"/>`;
  g += draw(C.fringe);
  if (look === 'colour' && shaded) {
    g += `<g clip-path="url(#${capId})"><path d="M${cx - rx + 2} ${cy - 32} Q${cx} ${cy - ry - 4} ${cx + rx - 2} ${cy - 32}" fill="none" stroke="${adCss(tones.light)}" stroke-width="9" stroke-linecap="round" opacity="0.45"/></g>`;
  }
  for (const t of C.ties) g += `<rect x="${adF(t[0] - 7)}" y="${adF(t[1] - 5)}" width="14" height="10" rx="3" fill="#c8412f" stroke="${ink}" stroke-width="1.2"/>`;
  if (look === 'flow') g += `<path d="M${cx - rx} ${cy - 26} Q${cx} ${cy - ry - 8} ${cx + rx} ${cy - 26}" fill="none" stroke="#3a86e0" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  return { svg: adSvgOpen([-30, 0, 360, 420], `${AD_HAIR[style].label} hair as ${(AD_HAIR_LOOK[look] || stage).toLowerCase()}`) + `<rect x="-30" width="360" height="420" fill="#f7f5ef"/>${g}</svg>`, tones, clumps: all.length };
}

/* The hairstyle built in six stages on one sheet, three across: from the head and the parting to the
   shadow strokes. Each panel is adHairSvg at one stage. */
function adHairStepsSvg(o) {
  const panels = AD_HAIR_STAGES.map((stage, i) => {
    const r = adHairSvg({ ...o, look: stage, key: 'st' + i }).svg
      .replace(/ width="[\d.]+" height="[\d.]+"/, ' width="200" height="233"')
      .replace('<svg ', `<svg x="${(i % 3) * 206 + 3}" y="${Math.floor(i / 3) * 262}" `);
    return r + `<text x="${(i % 3) * 206 + 103}" y="${Math.floor(i / 3) * 262 + 252}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${i + 1}</text>`;
  });
  return adSvgOpen([0, 0, 624, 524], `${(AD_HAIR[o.style] || AD_HAIR.long).label} hair in six steps`) + `<rect width="624" height="524" fill="#fff"/>${panels.join('')}</svg>`;
}

function adHairNotes(style, wind, strength) {
  const S = AD_HAIR[style] || AD_HAIR.long, out = [S.how];
  out.push('The ring of light is a curve across the head, following its round, not a straight stripe; it sits about a third of the way down from the crown.');
  if (wind !== 'none') out.push(`Wind from the ${wind === 'left' ? 'right' : 'left'} (strength ${strength}): the roots stay on the head and the tips swing furthest ${wind}, so the clumps fan out and lift. The same wind must move the skirt, the ribbon and the leaves.`);
  else out.push('With no wind the clumps fall by weight: straight down, a little in, tips together.');
  return out;
}

/* ---- shading */

const AD_SHADE = {
  cel: { label: 'Cel', about: 'One flat shadow with a hard edge. The classic: quick, clear, easy to repeat on every frame.',
    steps: ['The flat base colour, with the line already on.', 'One shadow shape, hard-edged, on the side away from the light.', 'A small hard highlight where the light hits.', 'A cast shadow on the ground, flat and the same colour as the shadow.'] },
  cel2: { label: 'Cel, two steps', about: 'A shadow and a darker core inside it, both hard-edged. More form, still flat.',
    steps: ['The flat base colour.', 'The shadow shape, hard-edged, away from the light.', 'A smaller, darker core shadow inside it, along the turning edge.', 'The hard highlight.', 'A cast shadow.'] },
  soft: { label: 'Soft', about: 'An airbrushed blend from light to shadow. Quiet and round; loses the sharp look of cel.',
    steps: ['The flat base colour.', 'A soft gradient of shadow from the side away from the light.', 'A soft glow of light on the lit side.', 'A blurred cast shadow.'] },
  painted: { label: 'Painted', about: 'Shadow turned cool, light warm, a rim of bounced light inside the edge of the shadow and some loose strokes. The look of a painted background or a film still.',
    steps: ['The base colour, with no hard outline.', 'Shadow in a cooler, darker colour, soft where it turns.', 'A rim of bounced light inside the edge of the shadow, in a warmer colour than the shadow.', 'A few loose strokes across the shadow, in the direction of the form.', 'The highlight, small and warm.', 'A cast shadow in the shadow colour, never grey or black.'] },
};
const AD_LIGHTS = { ul: ['Upper left', [-0.62, -0.78]], ur: ['Upper right', [0.62, -0.78]], top: ['Above', [0, -1]] };

/* style: a key of AD_SHADE; base: [r,g,b]; light: a key of AD_LIGHTS */
function adShadeSvg(style, base, lightKey, key = 's') {
  key = String(key).replace(/[^a-z0-9]/gi, '');
  const L = (AD_LIGHTS[lightKey] || AD_LIGHTS.ul)[1], T = adTones(base, style === 'painted'), ink = AD_INK, col = rgb => adCss(rgb);
  const C = [95, 100], R = 58, bx = 190, bw = 60, by0 = 50, by1 = 150;
  const outline = style === 'painted' ? 'none' : ink;
  const sw = style === 'painted' ? 0 : 2;
  const sph = `ads-${key}`, tub = `adt-${key}`;
  let g = `<defs><clipPath id="${sph}"><circle cx="${C[0]}" cy="${C[1]}" r="${R}"/></clipPath>` +
    `<clipPath id="${tub}"><path d="M${bx} ${by0} L${bx} ${by1} A${bw / 2} 12 0 0 0 ${bx + bw} ${by1} L${bx + bw} ${by0}Z"/></clipPath>` +
    `<filter id="adb-${key}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${style === 'soft' ? 5 : 2.5}"/></filter>`;
  // Gradients for the soft and painted manners.
  const fx = C[0] + L[0] * R * 0.4, fy = C[1] + L[1] * R * 0.4;
  const stopsS = style === 'painted' ? [[0, T.light], [0.3, T.base], [0.7, T.shadow], [1, T.core]] : [[0, T.light], [0.35, T.base], [1, T.shadow]];
  g += `<radialGradient id="adr-${key}" cx="${fx}" cy="${fy}" r="${R * 1.55}" gradientUnits="userSpaceOnUse">${stopsS.map(([o, c]) => `<stop offset="${o}" stop-color="${col(c)}"/>`).join('')}</radialGradient>`;
  const sx = L[0] < -0.1 ? -1 : L[0] > 0.1 ? 1 : 0;   // the side the light comes from; 0 is from above
  const lightFirst = style === 'painted' ? [[0, T.light], [0.3, T.base], [0.75, T.shadow], [1, T.core]] : [[0, T.light], [0.35, T.base], [1, T.shadow]];
  // Stops run left to right: the lit side is the first when the light is from the left, the last when from the right.
  const lStops = sx === 0
    ? [[0, T.shadow], [0.3, T.base], [0.5, T.light], [0.7, T.base], [1, T.shadow]]
    : (sx < 0 ? lightFirst : lightFirst.map(([o, c]) => [1 - o, c]).reverse());
  g += `<linearGradient id="adl-${key}" x1="${bx}" y1="0" x2="${bx + bw}" y2="0" gradientUnits="userSpaceOnUse">` + lStops.map(([o, c]) => `<stop offset="${o}" stop-color="${col(c)}"/>`).join('') + `</linearGradient></defs>`;
  g += `<rect width="300" height="210" fill="#f7f5ef"/>`;
  // Cast shadows.
  const castX = C[0] - L[0] * 42, shadowFill = style === 'cel' || style === 'cel2' ? col(T.shadow) : style === 'soft' ? col(T.core) : col(T.shadow);
  g += `<ellipse cx="${adF(castX)}" cy="160" rx="64" ry="12" fill="${shadowFill}" opacity="${style === 'soft' ? 0.45 : 0.7}"${style === 'cel' || style === 'cel2' ? '' : ` filter="url(#adb-${key})"`}/>`;
  g += `<ellipse cx="${adF(bx + bw / 2 - L[0] * 30)}" cy="${by1 + 8}" rx="${bw * 0.8}" ry="9" fill="${shadowFill}" opacity="${style === 'soft' ? 0.45 : 0.7}"${style === 'cel' || style === 'cel2' ? '' : ` filter="url(#adb-${key})"`}/>`;
  // The sphere.
  const lit = (k, rr) => `<circle cx="${adF(C[0] + L[0] * R * k)}" cy="${adF(C[1] + L[1] * R * k)}" r="${adF(R * rr)}"`;
  g += `<g clip-path="url(#${sph})">`;
  if (style === 'cel') g += `<rect x="20" y="20" width="160" height="160" fill="${col(T.shadow)}"/>${lit(0.24, 0.92)} fill="${col(T.base)}"/>`;
  else if (style === 'cel2') g += `<rect x="20" y="20" width="160" height="160" fill="${col(T.core)}"/>${lit(0.12, 0.98)} fill="${col(T.shadow)}"/>${lit(0.3, 0.88)} fill="${col(T.base)}"/>`;
  else g += `<rect x="20" y="20" width="160" height="160" fill="url(#adr-${key})"/>`;
  if (style === 'painted') {
    const ang = Math.atan2(-L[1], -L[0]);
    const a0 = ang - 0.75, a1 = ang + 0.75, rr = R - 4;
    g += `<path d="M${adF(C[0] + Math.cos(a0) * rr)} ${adF(C[1] + Math.sin(a0) * rr)} A${rr} ${rr} 0 0 1 ${adF(C[0] + Math.cos(a1) * rr)} ${adF(C[1] + Math.sin(a1) * rr)}" fill="none" stroke="${col(T.reflect)}" stroke-width="7" stroke-linecap="round" opacity="0.55"/>`;
    const px = -L[1], py = L[0];
    for (let i = 0; i < 6; i++) {
      const o = (i - 2.5) * 9, mx = C[0] - L[0] * R * 0.45 + px * o, my = C[1] - L[1] * R * 0.45 + py * o;
      g += `<path d="M${adF(mx - L[0] * 14)} ${adF(my - L[1] * 14)} L${adF(mx + L[0] * 14)} ${adF(my + L[1] * 14)}" stroke="${col(T.core)}" stroke-width="1.5" opacity="0.35" stroke-linecap="round"/>`;
    }
  }
  g += '</g>';
  if (style !== 'soft') g += `<ellipse cx="${adF(C[0] + L[0] * R * 0.5)}" cy="${adF(C[1] + L[1] * R * 0.5)}" rx="${style === 'painted' ? 8 : 9}" ry="${style === 'painted' ? 5 : 6}" transform="rotate(${adF(Math.atan2(L[1], L[0]) * 180 / Math.PI + 90)} ${adF(C[0] + L[0] * R * 0.5)} ${adF(C[1] + L[1] * R * 0.5)})" fill="${col(style === 'painted' ? T.light : [255, 255, 255])}" opacity="${style === 'painted' ? 0.85 : 0.95}"/>`;
  else g += `<ellipse cx="${adF(C[0] + L[0] * R * 0.45)}" cy="${adF(C[1] + L[1] * R * 0.45)}" rx="12" ry="8" fill="${col(T.light)}" opacity="0.5" filter="url(#adb-${key})"/>`;
  if (sw) g += `<circle cx="${C[0]}" cy="${C[1]}" r="${R}" fill="none" stroke="${outline}" stroke-width="${sw}"/>`;
  // The tube: the shadow strip lies on the side away from the light.
  const tall = by1 - by0 + 14, strip = (frac, fill) => sx === 0
    ? `<rect x="${bx}" y="${by0}" width="${adF(bw * frac / 2)}" height="${tall}" fill="${fill}"/><rect x="${adF(bx + bw - bw * frac / 2)}" y="${by0}" width="${adF(bw * frac / 2)}" height="${tall}" fill="${fill}"/>`
    : `<rect x="${adF(sx < 0 ? bx + bw * (1 - frac) : bx)}" y="${by0}" width="${adF(bw * frac)}" height="${tall}" fill="${fill}"/>`;
  g += `<g clip-path="url(#${tub})">`;
  if (style === 'cel') g += `<rect x="${bx}" y="${by0}" width="${bw}" height="${tall}" fill="${col(T.base)}"/>` + strip(0.4, col(T.shadow));
  else if (style === 'cel2') g += `<rect x="${bx}" y="${by0}" width="${bw}" height="${tall}" fill="${col(T.base)}"/>` + strip(0.5, col(T.shadow)) + strip(0.2, col(T.core));
  else g += `<rect x="${bx}" y="${by0}" width="${bw}" height="${tall}" fill="url(#adl-${key})"/>`;
  if (style === 'painted' && sx !== 0) g += `<rect x="${sx < 0 ? bx + bw - 7 : bx}" y="${by0}" width="7" height="${tall}" fill="${col(T.reflect)}" opacity="0.5"/>`;
  g += '</g>';
  if (sw) g += `<path d="M${bx} ${by0} L${bx} ${by1} A${bw / 2} 12 0 0 0 ${bx + bw} ${by1} L${bx + bw} ${by0}" fill="none" stroke="${outline}" stroke-width="${sw}"/>`;
  g += `<ellipse cx="${bx + bw / 2}" cy="${by0}" rx="${bw / 2}" ry="12" fill="${col(style === 'soft' ? T.light : T.light)}"${sw ? ` stroke="${outline}" stroke-width="${sw}"` : ''}/>`;
  return { svg: adSvgOpen([0, 0, 300, 210], `A sphere and a tube shaded ${AD_SHADE[style].label.toLowerCase()}, lit from ${(AD_LIGHTS[lightKey] || AD_LIGHTS.ul)[0].toLowerCase()}`) + g + '</svg>', tones: T };
}

/* ---- expressions */

/* Offsets are from the neutral face: a brow end's [outward, down], so a positive first number moves
   it out and a positive second moves it down; a mouth's corners go [down] by cd, its middle by curve. */
const AD_EXPR = {
  happy: { label: 'Happy', bi: [0, -4], bo: [0, -6], eye: 'open', mouth: { w: 24, cd: -8, curve: 8 }, fx: ['blush'],
    says: 'The brows lift a little, the mouth corners go up and out, the eyes stay open and bright.', words: 'happy smiling expression' },
  laugh: { label: 'Laughing', bi: [0, -8], bo: [0, -8], eye: 'happy', mouth: { w: 28, cd: -10, curve: 30, open: 30 }, fx: ['sparkle'],
    says: 'The eyes close into arches pushed up by the cheeks; the mouth is open wide, its corners high.', words: 'laughing with eyes closed, open mouth' },
  shy: { label: 'Shy', bi: [0, -6], bo: [0, 2], eye: 'wet', mouth: { w: 12, cd: 2, curve: 0, shape: 'wavy' }, fx: ['blush', 'sweat'],
    says: 'The brows go up at the inner end, the mouth shrinks to a short wobble, the cheeks redden.', words: 'shy embarrassed expression, blushing' },
  angry: { label: 'Angry', bi: [-6, 10], bo: [0, -8], eye: 'narrow', mouth: { w: 22, cd: 8, curve: -6 }, fx: ['vein'],
    says: 'The inner ends of the brows drop and pull in, the eyes narrow under them, the mouth corners go down.', words: 'angry expression, furrowed brows' },
  shock: { label: 'Shocked', bi: [0, -16], bo: [0, -14], eye: 'wide', mouth: { shape: 'oval', w: 9, ry: 16 }, fx: ['gloom'],
    says: 'Everything opens: brows high, eyes wide with a tiny iris, the mouth a small oval.', words: 'shocked expression, wide eyes, small pupils' },
  sad: { label: 'Sad', bi: [0, -12], bo: [0, 6], eye: 'wet', mouth: { w: 16, cd: 7, curve: -5 }, fx: ['tear'],
    says: 'The inner ends of the brows rise, the outer droop; the eyes shine with water; the mouth turns down.', words: 'sad expression, teary eyes' },
  cry: { label: 'Crying', bi: [0, -12], bo: [0, 8], eye: 'closed', mouth: { w: 24, cd: 10, curve: -10, open: 20 }, fx: ['tear'],
    says: 'The eyes shut tight, the mouth open and square at the corners, tears run from the lower lid.', words: 'crying, tears streaming, mouth open' },
  smug: { label: 'Smug', bi: [0, -2], bo: [0, -2], asym: 8, eye: 'narrow', mouth: { w: 22, cd: -2, cdR: -10, curve: 4 }, fx: ['sparkle'],
    says: 'One brow up, one down; the lids half closed; the mouth lifts on one side only.', words: 'smug smirk, one eyebrow raised' },
  worry: { label: 'Worried', bi: [0, -12], bo: [0, 5], eye: 'open', mouth: { w: 16, cd: 3, curve: -2, shape: 'wavy' }, fx: ['sweat'],
    says: 'The inner ends of the brows go up in a slope, the mouth is small and uneven, a sweat drop at the temple.', words: 'worried anxious expression, sweat drop' },
  sleepy: { label: 'Sleepy', bi: [0, 2], bo: [0, 4], eye: 'closed', mouth: { shape: 'oval', w: 5, ry: 6 }, fx: ['zzz'],
    says: 'The lids drop and curve down, the brows relax, the mouth is a small slack oval.', words: 'sleepy expression, closed eyes' },
  scared: { label: 'Scared', bi: [0, -14], bo: [0, -6], eye: 'fear', mouth: { w: 20, cd: 4, curve: 0, shape: 'wavy' }, fx: ['gloom', 'sweat'],
    says: 'The brows are high and tight at the inner ends, the iris shrinks to a dot in a wide eye, the mouth trembles.', words: 'scared frightened expression, trembling' },
  love: { label: 'Smitten', bi: [0, -6], bo: [0, -6], eye: 'heart', mouth: { w: 14, cd: -6, curve: 10 }, fx: ['blush', 'heart'],
    says: 'The eyes turn to hearts or shine like them, the brows lift, the mouth is a small happy curve.', words: 'smitten, heart eyes, blushing' },
};
const AD_FX_NAMES = { blush: 'blush on the cheeks', sweat: 'a sweat drop', vein: 'an anger vein', tear: 'tears', sparkle: 'sparkles', gloom: 'gloom lines', heart: 'a floating heart', zzz: 'sleep Z marks' };

function adExprSvg(key, fx = true, arrows = true) {
  const E = AD_EXPR[key] || AD_EXPR.happy, ink = AD_INK, cx = 120, red = '#c8412f';
  const brow = (side, off, asy) => {
    const dy = asy ? (side > 0 ? -asy : asy * 0.4) : 0, inner = [cx + side * (14 + off.bi[0]), 100 + off.bi[1] + dy], outer = [cx + side * (60 + off.bo[0]), 94 + off.bo[1] + dy];
    return { inner, outer };
  };
  const neutral = side => brow(side, { bi: [0, 0], bo: [0, 0] }, 0), now = side => brow(side, E, E.asym || 0);
  const bpath = b => `M${adP(b.inner)} Q${adP([(b.inner[0] + b.outer[0]) / 2, Math.min(b.inner[1], b.outer[1]) - 6])} ${adP(b.outer)}`;
  const M = E.mouth, my = 206, mcdR = M.cdR != null ? M.cdR : M.cd;
  const mL = [cx - (M.w || 20), my + M.cd], mR = [cx + (M.w || 20), my + mcdR];
  let g = `<defs><marker id="adx-arrow" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${red}"/></marker></defs>`;
  g += `<path d="M${cx - 76} 120 C${cx - 78} 190 ${cx - 40} 250 ${cx} 256 C${cx + 40} 250 ${cx + 78} 190 ${cx + 76} 120 C${cx + 76} 52 ${cx - 76} 52 ${cx - 76} 120Z" fill="#fbe9dc" stroke="${ink}" stroke-width="2.4"/>`;
  const eye = side => {
    const ex = cx + side * 38, ey = 140;
    switch (E.eye) {
      case 'happy': return `<path d="M${ex - 17} ${ey + 6} Q${ex} ${ey - 16} ${ex + 17} ${ey + 6}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>`;
      case 'closed': return `<path d="M${ex - 17} ${ey - 3} Q${ex} ${ey + 13} ${ex + 17} ${ey - 3}" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/><path d="M${ex + side * 17} ${ey - 3} l${side * 6} 4" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`;
      case 'dot': return `<ellipse cx="${ex}" cy="${ey}" rx="5" ry="6" fill="${ink}"/>`;
      case 'heart': return `<path d="M${ex} ${ey + 14} C${ex - 26} ${ey - 4} ${ex - 12} ${ey - 20} ${ex} ${ey - 6} C${ex + 12} ${ey - 20} ${ex + 26} ${ey - 4} ${ex} ${ey + 14}Z" fill="#e0526a" stroke="${ink}" stroke-width="1.8"/><circle cx="${ex - 6}" cy="${ey - 5}" r="2.6" fill="#fff"/>`;
      case 'narrow': return `<path d="M${ex - 17} ${ey - 2} Q${ex} ${ey - 9} ${ex + 17} ${ey - 2} Q${ex} ${ey + 9} ${ex - 17} ${ey - 2}Z" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${ex}" cy="${ey + 1}" r="5" fill="${ink}"/><path d="M${ex - 18} ${ey - 3} Q${ex} ${ey - 11} ${ex + 18} ${ey - 3}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
      case 'wide': case 'fear': {
        const ir = E.eye === 'fear' ? 3.4 : 5;
        return `<ellipse cx="${ex}" cy="${ey}" rx="19" ry="24" fill="#fff" stroke="${ink}" stroke-width="2.2"/><circle cx="${ex}" cy="${ey}" r="${ir}" fill="${ink}"/>`;
      }
      default: { // open, wet
        const wet = E.eye === 'wet';
        return `<ellipse cx="${ex}" cy="${ey}" rx="17" ry="20" fill="#fff" stroke="${ink}" stroke-width="2.2"/><ellipse cx="${ex}" cy="${ey + 1}" rx="11" ry="${wet ? 16 : 14}" fill="#3f7fb8"/><ellipse cx="${ex}" cy="${ey + 1}" rx="5.5" ry="${wet ? 9 : 8}" fill="${ink}"/>` +
          `<circle cx="${ex - 4}" cy="${ey - 6}" r="${wet ? 4.6 : 3.4}" fill="#fff"/>${wet ? `<circle cx="${ex + 4}" cy="${ey + 8}" r="2.4" fill="#fff"/><path d="M${ex - 17} ${ey + 14} Q${ex} ${ey + 24} ${ex + 17} ${ey + 14}" fill="none" stroke="#9cc7ea" stroke-width="2.2"/>` : ''}<path d="M${ex - 19} ${ey - 8} Q${ex} ${ey - 26} ${ex + 19} ${ey - 8}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
      }
    }
  };
  g += eye(-1) + eye(1);
  // Ghosts of the neutral face and the arrows from them.
  if (arrows) {
    for (const side of [-1, 1]) {
      g += `<path d="${bpath(neutral(side))}" fill="none" stroke="#9a9a9a" stroke-width="2" stroke-dasharray="4 3"/>`;
      const a = neutral(side), b = now(side);
      for (const k of ['inner', 'outer']) {
        const dx = b[k][0] - a[k][0], dy = b[k][1] - a[k][1];
        if (Math.hypot(dx, dy) >= 3) g += `<path d="M${adP(a[k])} L${adP(b[k])}" stroke="${red}" stroke-width="1.6" marker-end="url(#adx-arrow)"/>`;
      }
    }
    g += `<path d="M${cx - 20} ${my} L${cx + 20} ${my}" stroke="#9a9a9a" stroke-width="2" stroke-dasharray="4 3"/>`;
    for (const [from, to] of [[[cx - 20, my], mL], [[cx + 20, my], mR]]) {
      if (Math.hypot(to[0] - from[0], to[1] - from[1]) >= 3) g += `<path d="M${adP(from)} L${adP(to)}" stroke="${red}" stroke-width="1.6" marker-end="url(#adx-arrow)"/>`;
    }
  }
  for (const side of [-1, 1]) g += `<path d="${bpath(now(side))}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>`;
  g += `<path d="M${cx - 2} 176 q-2 6 4 8" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  // The mouth.
  if (M.shape === 'oval') g += `<ellipse cx="${cx}" cy="${my + 4}" rx="${M.w}" ry="${M.ry}" fill="#8b2e3a" stroke="${ink}" stroke-width="2.2"/>`;
  else if (M.shape === 'wavy') {
    const w = M.w, y = my + M.cd;
    g += `<path d="M${cx - w} ${y} q${w / 3} -6 ${w / 1.5} 0 t${w / 1.5} 0 t${w / 1.5} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if (M.open) {
    g += `<path d="M${adP(mL)} Q${adP([cx, my + M.curve * 0.3])} ${adP(mR)} Q${adP([cx, my + M.open + M.curve * 0.5])} ${adP(mL)}Z" fill="#8b2e3a" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M${cx - M.w * 0.5} ${my + M.open * 0.8} Q${cx} ${my + M.open * 0.3} ${cx + M.w * 0.5} ${my + M.open * 0.8}" fill="#e07a85"/>`;
  } else g += `<path d="M${adP(mL)} Q${adP([cx, my + M.curve])} ${adP(mR)}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  if (fx) {
    for (const f of E.fx) {
      if (f === 'blush') for (const s of [-1, 1]) g += `<ellipse cx="${cx + s * 54}" cy="176" rx="17" ry="9" fill="#f08a8a" opacity="0.5"/>` + [0, 1, 2].map(i => `<path d="M${cx + s * 54 - 9 + i * 8} 181 l4 -8" stroke="#d65a5a" stroke-width="1.6" stroke-linecap="round"/>`).join('');
      if (f === 'sweat') g += `<path d="M196 70 q-9 14 0 20 q9 -6 0 -20Z" fill="#a8d3f0" stroke="${ink}" stroke-width="1.6"/>`;
      if (f === 'vein') g += `<path d="M186 54 q6 2 8 8 M206 54 q-6 2 -8 8 M186 76 q6 -2 8 -8 M206 76 q-6 -2 -8 -8" fill="none" stroke="${red}" stroke-width="3" stroke-linecap="round"/>`;
      if (f === 'tear') for (const s of [-1, 1]) g += `<path d="M${cx + s * 38 + s * 12} 168 q-6 11 0 15 q6 -4 0 -15Z" fill="#a8d3f0" stroke="${ink}" stroke-width="1.4"/>`;
      if (f === 'sparkle') g += adStar(26, 64, 11).replace('fill="#fff"', 'fill="#f3c93a" stroke="#2a2a33" stroke-width="1"') + adStar(206, 52, 8).replace('fill="#fff"', 'fill="#f3c93a" stroke="#2a2a33" stroke-width="1"');
      if (f === 'gloom') g += [0, 1, 2, 3, 4].map(i => `<path d="M${cx - 40 + i * 20} 44 l0 ${22 + (i % 2) * 8}" stroke="#5a5a8a" stroke-width="2.2" stroke-linecap="round"/>`).join('');
      if (f === 'heart') g += `<path d="M204 56 c-14 -10 -22 6 0 20 c22 -14 14 -30 0 -20Z" fill="#e0526a" stroke="${ink}" stroke-width="1.4"/>`;
      if (f === 'zzz') g += `<text x="186" y="70" font-size="22" font-weight="700" fill="#5a5a8a">Z</text><text x="204" y="50" font-size="16" font-weight="700" fill="#5a5a8a">z</text>`;
    }
  }
  return adSvgOpen([0, 0, 240, 280], `${E.label} face${arrows ? ', with the movement from a neutral face' : ''}`) + `<rect width="240" height="280" fill="#f7f5ef"/>${g}</svg>`;
}

function adExprNotes(key, fx) {
  const E = AD_EXPR[key] || AD_EXPR.happy, out = [E.says];
  if (fx && E.fx.length) out.push(`Anime adds ${E.fx.map(f => AD_FX_NAMES[f]).join(' and ')}: it says the feeling louder than the face can.`);
  return out;
}

/* ---- perspective for backgrounds */

const AD_PERSP = {
  1: { label: 'One point', about: 'Everything facing us stays a flat rectangle; the lines going away meet at one point. For a corridor, a room seen square-on, a road straight ahead, a stage.' },
  2: { label: 'Two points', about: 'Nothing faces us square-on: the corner of a building is nearest, its two sides run to two points on the horizon. The default for a street.' },
  3: { label: 'Three points', about: 'The verticals converge too, to a point above (looking up: a tower is huge) or below (looking down: a drop, a roof). For drama and scale.' },
};
const AD_PERSP_W = 720, AD_PERSP_H = 440;

function adIsect(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}
const adToward = (P, V, t) => [P[0] + (V[0] - P[0]) * t, P[1] + (V[1] - P[1]) * t];

// A person whose eyes are on the horizon: feet at footY, height from there.
function adFigure(x, footY, hy, ink) {
  const h = Math.max(8, (footY - hy) / 0.93), r = h * 0.065;
  return `<circle cx="${adF(x)}" cy="${adF(hy + r * 0.2)}" r="${adF(r)}" fill="#fbe9dc" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="M${adF(x)} ${adF(hy + r * 1.2)} L${adF(x)} ${adF(footY - h * 0.45)} M${adF(x - h * 0.1)} ${adF(hy + h * 0.25)} L${adF(x + h * 0.1)} ${adF(hy + h * 0.25)} M${adF(x)} ${adF(footY - h * 0.45)} L${adF(x - h * 0.07)} ${adF(footY)} M${adF(x)} ${adF(footY - h * 0.45)} L${adF(x + h * 0.07)} ${adF(footY)}" stroke="${ink}" stroke-width="${adF(Math.max(2, h * 0.028))}" stroke-linecap="round" fill="none"/>`;
}

/* o: { kind: 1|2|3, horizon (0.1-0.9 of the height), point (the first point's place: 1 - across, 2 - how far apart, 3 - how far above/below), up (kind 3: looking up) } */
function adPerspSvg(o) {
  const kind = [1, 2, 3].includes(+o.kind) ? +o.kind : 1, W = AD_PERSP_W, H = AD_PERSP_H, ink = AD_INK, red = '#c8412f';
  const hy = adClamp(+o.horizon || 0.5, 0.1, 0.9) * H, cx0 = W / 2;
  const poly = (pts, fill) => `<path d="${pts.map((q, i) => (i ? 'L' : 'M') + adP(q)).join('')}Z" fill="${fill}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
  const dash = (a, b) => `<path d="M${adP(a)} L${adP(b)}" stroke="${red}" stroke-width="1" stroke-dasharray="5 4" opacity="0.75"/>`;
  const vpMark = (p, label) => `<circle cx="${adF(p[0])}" cy="${adF(p[1])}" r="5" fill="${red}"/><text x="${adF(p[0])}" y="${adF(p[1] - 10)}" text-anchor="middle" font-size="12" font-weight="700" fill="${red}">${label}</text>`;
  const frame = `<clipPath id="adp-frame"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>`;
  let g = '', vbX = 0, vbW = W, notes = [];
  if (kind === 1) {
    const vx = adClamp(+o.point || 0.5, 0.2, 0.8) * W, vp = [vx, hy], m = 20, kb = 0.38;
    const TL = [m, m], TR = [W - m, m], BL = [m, H - m], BR = [W - m, H - m], at = (P, k) => [vp[0] + (P[0] - vp[0]) * k, vp[1] + (P[1] - vp[1]) * k];
    g += poly([BL, BR, at(BR, kb), at(BL, kb)], '#e3ddcf') + poly([TL, TR, at(TR, kb), at(TL, kb)], '#efece4') +
      poly([TL, BL, at(BL, kb), at(TL, kb)], '#ece7dc') + poly([TR, BR, at(BR, kb), at(TR, kb)], '#e8e3d7') + poly([at(TL, kb), at(TR, kb), at(BR, kb), at(BL, kb)], '#f7f5ef');
    for (let i = 1; i <= 5; i++) {
      const k = 1 / (1 + i * (1 / kb - 1) / 6);
      g += `<path d="M${adP(at(BL, k))} L${adP(at(BR, k))}" stroke="${ink}" stroke-width="1" opacity="0.5"/>`;
    }
    for (let j = 1; j < 6; j++) {
      const P = [BL[0] + (BR[0] - BL[0]) * j / 6, BL[1]];
      g += `<path d="M${adP(P)} L${adP(at(P, kb))}" stroke="${ink}" stroke-width="1" opacity="0.5"/>`;
    }
    g += dash(vp, BL) + dash(vp, BR) + dash(vp, TL) + dash(vp, TR);
    g += adFigure(at([BL[0] + (BR[0] - BL[0]) * 0.22, BL[1]], 0.86)[0], hy + 0.86 * (BL[1] - hy), hy, ink) + adFigure(at([BL[0] + (BR[0] - BL[0]) * 0.75, BL[1]], 0.58)[0], hy + 0.58 * (BL[1] - hy), hy, ink);
    g += vpMark(vp, 'VP');
    notes = ['One point: every line that runs away from you meets at the VP; the back wall, the floor tiles\' cross lines and anything facing you stay flat and parallel to the frame.',
      'Move the point left or right to move where the eye is pulled; moving the horizon changes how much floor or ceiling shows.'];
  } else {
    const spread = adClamp(+o.point || 0.6, 0.3, 1.3) * W, VPL = [cx0 - spread / 2, hy], VPR = [cx0 + spread / 2, hy], third = kind === 3;
    const up = o.up !== false && o.up !== 'down';
    const dist = third ? adClamp(+o.dist || 700, 400, 1500) : 0, VP3 = third ? [cx0, up ? hy - dist : hy + dist] : null;
    const ty = third ? (up ? H * 0.08 : H * 0.14) : H * 0.30, by = third ? (up ? H * 0.80 : H * 0.88) : H * 0.80;
    const B0 = [cx0, by], T0 = [cx0, ty], widthL = 130, widthR = 110;
    const BL = adToward(B0, VPL, Math.min(0.85, widthL / (cx0 - VPL[0]))), BR = adToward(B0, VPR, Math.min(0.85, widthR / (VPR[0] - cx0)));
    let TL, TR;
    if (third) {
      TL = adIsect(BL, [VP3[0] - BL[0], VP3[1] - BL[1]], T0, [VPL[0] - T0[0], VPL[1] - T0[1]]) || adToward(T0, VPL, 0.3);
      TR = adIsect(BR, [VP3[0] - BR[0], VP3[1] - BR[1]], T0, [VPR[0] - T0[0], VPR[1] - T0[1]]) || adToward(T0, VPR, 0.3);
    } else {
      TL = adToward(T0, VPL, Math.min(0.85, widthL / (cx0 - VPL[0]))); TR = adToward(T0, VPR, Math.min(0.85, widthR / (VPR[0] - cx0)));
    }
    // Guide lines, behind the box.
    g += `<rect x="0" y="${adF(hy)}" width="${W}" height="${adF(H - hy)}" fill="#efe9da"/>`;
    for (const P of [B0, T0]) g += dash(P, VPL) + dash(P, VPR);
    if (third) for (const P of [B0, T0, BL, BR]) g += dash(P, VP3);
    // The faces, and the roof if the horizon is above the top edge.
    g += poly([T0, B0, BL, TL], '#e4ded1') + poly([T0, B0, BR, TR], '#cfc8b8');
    if (ty > hy) {
      const far = adIsect(TL, [VPR[0] - TL[0], VPR[1] - TL[1]], TR, [VPL[0] - TR[0], VPL[1] - TR[1]]);
      if (far) g += poly([T0, TL, far, TR], '#f3efe6');
    }
    g += adFigure(cx0 + 250, H * 0.9, hy, ink) + adFigure(cx0 - 260, H * 0.84, hy, ink);
    g += vpMark(VPL, 'VP1') + vpMark(VPR, 'VP2') + (third ? vpMark(VP3, 'VP3') : '');
    vbX = Math.min(-60, Math.floor(VPL[0] - 60)); vbW = Math.max(W + 60, Math.ceil(VPR[0] + 60)) - vbX;
    if (third && Math.abs(VP3[1]) > H) { /* the third point is far off the page: it is marked where it falls, outside the frame */ }
    notes = kind === 2
      ? ['Two points: the corner nearest you is the tallest edge; the two walls run to two points on the horizon, which are usually off the paper. Pull the points apart for a gentle corner, bring them together for a distorted, wide-lens one.',
        ty > hy ? 'The horizon is above the top of the box, so we look down on the roof.' : 'The horizon is below the top of the box: the roof is hidden. Raise the horizon above it to see the roof.']
      : [`Three points: the third point ${up ? 'above' : 'below'} makes the verticals ${up ? 'lean in towards the sky' : 'close in towards the ground'}. The nearer the third point, the stronger the effect; far away, it looks like two points.`,
        up ? 'Looking up the base is near the horizon and the top far above it. Switch to "down" to look off a roof.' : 'Looking down the horizon is near the top, and the far ground is small below.'];
  }
  notes.push('The horizon is the eye level: the eyes of everyone standing on the same ground, near or far, are on it. A child\'s eyes are lower, but still on a line you can find.');
  const hyHit = `<rect class="av-hit" x="${vbX}" y="${adF(hy - 8)}" width="${vbW}" height="16" fill="transparent" style="cursor:ns-resize"/>`;
  const svg = adSvgOpen([vbX, 0, vbW, H], `${AD_PERSP[kind].label}: a ${kind === 1 ? 'room' : kind === 2 ? 'street corner' : 'tower'} built on the horizon`) +
    `<defs>${frame}</defs><rect x="${vbX}" y="0" width="${vbW}" height="${H}" fill="#d9d4c7"/><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>` +
    `<g${kind === 1 ? ' clip-path="url(#adp-frame)"' : ''}>${g}</g>` +
    `<path d="M${vbX} ${adF(hy)} L${vbX + vbW} ${adF(hy)}" stroke="${red}" stroke-width="1.6" stroke-dasharray="8 5"/>` +
    `<text x="${vbX + 6}" y="${adF(hy - 6)}" font-size="12" fill="${red}">horizon = eye level</text>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${ink}" stroke-width="2"/>${hyHit}</svg>`;
  return { svg, notes, hy: hy / H };
}
