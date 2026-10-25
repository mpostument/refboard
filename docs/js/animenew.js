/* refboard - Seven more things for drawing anime, as plain data and pictures (the view is js/animenewui.js):

   Gesture. Eight marks on a figure - head, chest, hips, feet, both shoulders, both hips - give the line of action
   (a C, an S or a straight I), how far it bends, and how the shoulders and the hips tilt against each other;
   and a drill of timed poses to draw with that line first.
   Tones. A drawing or a photo held to five tones and each tone drawn as ink: hatching and crossing for a fineliner,
   dots for a stipple pen, passes of one direction for a ballpoint - the screen-tone of someone with no screen-tone.
   Effects. Speed lines, focus lines, an impact burst and a field of sparkles, drawn at random from a seed, with how
   to ink each.
   Shots. Two marks, the top of the head and the feet, and the figure's picture is cut to a long shot, a medium,
   a close-up and an extreme close-up, in the shape of the frame you choose.
   Legs. A leg from the front and the side in head units, with the sock, the stocking or the tights and the shoe.
   Silhouettes. Up to three characters as black shapes at one height, and how alike they are.
   Compare. A reference and your drawing, one over the other, as the difference between them, with a grid for
   copying and a timer for the sitting.

   Everything is worked out here as data; the pictures are SVG strings or canvases. Loaded with the section
   (loadSection('anime')) after js/animedraw.js, whose colour and SVG helpers it uses. */
"use strict";

/* ---- gesture */

const AN_GESTURE_MARKS = ['the top of the head', 'the chest', 'the hips', 'the feet (between them)', 'the left shoulder', 'the right shoulder', 'the left hip', 'the right hip'];

/* pts: eight points { x, y }, in the order of AN_GESTURE_MARKS (left and right are the picture's). Returns the curve
   kind, how far it bends (the biggest sideways step of the chest and the hips from the straight line from head to feet,
   as a share of its length), the tilts of the shoulders and the hips from the level, and what they mean. */
function anGestureRead(pts) {
  const [head, chest, hips, feet, sl, sr, hl, hr] = pts, dx = feet.x - head.x, dy = feet.y - head.y, len = Math.hypot(dx, dy) || 1;
  const side = p => ((p.x - head.x) * dy - (p.y - head.y) * dx) / len / len;   // across the head-to-feet line, as a share of its length
  const a = side(chest), b = side(hips), bend = Math.max(Math.abs(a), Math.abs(b));
  const tilt = (p, q) => Math.round(Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI);
  const shoulders = tilt(sl, sr), hipsTilt = tilt(hl, hr), against = Math.abs(shoulders - hipsTilt);
  const kind = bend < 0.03 ? 'I' : a * b > 0 || Math.min(Math.abs(a), Math.abs(b)) < 0.012 ? 'C' : 'S';
  const lean = Math.round(Math.atan2(dx, dy) * 180 / Math.PI);
  const out = [];
  out.push(kind === 'I' ? 'The line of action is almost straight: the pose stands, with no push. Move the chest and the hips a little to opposite sides and it becomes an S.'
    : kind === 'C' ? `A C curve (${Math.round(bend * 100)}% of her height): one long push in one direction, the strong line for a lunge, a reach, a fall.`
      : `An S curve (${Math.round(bend * 100)}% of her height): the chest goes one way and the hips the other - the line for a relaxed or elegant standing pose.`);
  if (kind !== 'I' && bend < 0.06) out.push('The curve is shallow. Anime poses push it further than a photograph shows - try twice as much.');
  if (bend > 0.2) out.push('A very strong curve: right for action, but check that she keeps her balance - her weight has to land over a foot.');
  if (against >= 8) out.push(`The shoulders (${shoulders}°) and the hips (${hipsTilt}°) tilt against each other by ${against}°: that is the contrapposto that makes a standing figure alive.`);
  else out.push(`The shoulders (${shoulders}°) and the hips (${hipsTilt}°) are nearly parallel: the figure looks stiff. Tilt them against each other - one up when the other goes down.`);
  if (Math.abs(lean) > 12) out.push(`The whole figure leans ${Math.abs(lean)}° from the vertical: it needs a leg out to the side or a hand reaching to hold it up.`);
  return { kind, bend, shoulders, hips: hipsTilt, against, lean, notes: out };
}

// The curve through the head, chest, hips and feet as a path of quadratic pieces.
function anGesturePath(pts) {
  const [a, b, c, d] = pts, mid = (p, q) => [(p.x + q.x) / 2, (p.y + q.y) / 2];
  const m1 = mid(a, b), m2 = mid(b, c), m3 = mid(c, d);
  return `M${adF(a.x)} ${adF(a.y)} L${adF(m1[0])} ${adF(m1[1])} Q${adF(b.x)} ${adF(b.y)} ${adF(m2[0])} ${adF(m2[1])} Q${adF(c.x)} ${adF(c.y)} ${adF(m3[0])} ${adF(m3[1])} L${adF(d.x)} ${adF(d.y)}`;
}

// What to draw in the drill: a pose, a mood to draw it in.
const AN_DRILL_POSES = [
  'running', 'running, looking back', 'jumping', 'landing from a jump', 'sitting on the floor', 'sitting on a chair, leaning forward', 'kneeling', 'lying on her side',
  'reaching up', 'reaching forward', 'pulling something', 'pushing a heavy door', 'throwing', 'catching', 'a kick', 'a punch', 'a sword raised', 'drawing a bow',
  'walking with a bag', 'leaning on a wall', 'stretching', 'twirling', 'stepping onto a stair', 'crouching to look at something', 'waving', 'dancing', 'falling backwards', 'holding an umbrella in the wind',
];
const AN_DRILL_SECS = [30, 60, 120];

/* ---- tones */

const AN_TONE_SIDE = 480;
const AN_TONE_KINDS = {
  liner: { label: 'Fineliner hatching', rows: ['Paper', 'One set of lines, about 2 mm apart', 'The lines closer together, about 1.5 mm', 'A second set across the first', 'A third set, or a fill'], about: 'Parallel lines for the light tones, crossed for the dark ones: keep the lines at one angle (about 45°) so the picture reads as one drawing.' },
  dots: { label: 'Dots, a stipple pen', rows: ['Paper', 'A few dots, far apart', 'More dots, still separate', 'The dots nearly touching', 'Solid black'], about: 'Dots of one size: only their number changes. Slow, but the tones blend more gently than hatching.' },
  ballpoint: { label: 'Ballpoint passes', rows: ['Paper', 'One light pass in one direction', 'Two passes, a little firmer', 'Three passes, the last across', 'Four passes, pressed'], about: 'A ballpoint has one width, so the tone comes from passes: go over the same patch again and again, and keep the strokes in one direction.' },
};

/* gray: w*h values 0..255. Returns { levels (0 = paper, n-1 = the darkest), shares } with the tones set from the
   lightest and darkest the picture has (a 2% tail is ignored), so a pale picture still uses all of them. */
function anToneLevels(gray, w, h, n = 5) {
  const hist = new Uint32Array(256);
  for (const v of gray) hist[v]++;
  const total = gray.length, at = share => { let c = 0; for (let v = 0; v < 256; v++) { c += hist[v]; if (c >= total * share) return v; } return 255; };
  const lo = at(0.02), hi = Math.max(lo + 1, at(0.98)), levels = new Uint8Array(gray.length), shares = new Array(n).fill(0);
  for (let i = 0; i < gray.length; i++) {
    const t = adClamp((hi - gray[i]) / (hi - lo), 0, 0.9999);   // 0 = lightest
    // The lightest fifth stays paper: a tone that is hardly there should not be inked.
    levels[i] = Math.floor(t * n);
    shares[levels[i]]++;
  }
  return { levels, shares: shares.map(c => c / gray.length), w, h };
}

// Whether pixel (x, y) of a tone level is inked, for each way of inking. n tones, level 0 paper.
function anToneInk(kind, level, x, y, n) {
  if (level <= 0) return false;
  if (level >= n - 1) return true;
  const L = level;
  if (kind === 'dots') {
    const cell = 6, u = (x + y) / Math.SQRT2, v = (x - y) / Math.SQRT2, fu = ((u % cell) + cell) % cell - cell / 2, fv = ((v % cell) + cell) % cell - cell / 2;
    const cover = [0, 0.1, 0.25, 0.5][Math.min(3, L)];
    return Math.hypot(fu, fv) < Math.sqrt(cover * cell * cell / Math.PI);
  }
  if (kind === 'ballpoint') {
    const space = [0, 9, 6, 4][Math.min(3, L)], wob = Math.sin(y * 0.35) * 0.8;
    return (((x + y + wob) % space) + space) % space < 1.2;
  }
  const a = (((x + y) % [0, 9, 6, 6][Math.min(3, L)]) + 12) % [0, 9, 6, 6][Math.min(3, L)] < 1.3;
  if (L < 3) return a;
  return a || ((((x - y) % 6) + 12) % 6) < 1.3;
}

// The tones as a canvas, k times the size of the levels, white and ink-black.
function anToneCanvas(res, kind, n, k = 2) {
  const cv = Object.assign(document.createElement('canvas'), { width: res.w * k, height: res.h * k }), g = cv.getContext('2d');
  const img = g.createImageData(cv.width, cv.height), d = img.data;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const lv = res.levels[(y / k | 0) * res.w + (x / k | 0)], ink = anToneInk(kind, lv, x, y, n), i = (y * cv.width + x) * 4;
    d[i] = ink ? 28 : 255; d[i + 1] = ink ? 28 : 255; d[i + 2] = ink ? 40 : 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function anToneNote(res, kind) {
  const K = AN_TONE_KINDS[kind], dark = res.shares.slice(-2).reduce((a, b) => a + b, 0), paper = res.shares[0];
  const out = [`${Math.round(paper * 100)}% of the picture stays paper and ${Math.round(dark * 100)}% is the two darkest tones.`];
  if (paper < 0.15) out.push('Very little is paper: the picture is dark, so it will take long to ink. Keep the lightest parts bare to give it air.');
  else if (dark > 0.5) out.push('More than half is in the darkest tones: it will read as heavy. Use the darkest tone for the shadow shapes only.');
  else out.push('A good balance of paper and ink: the dark tones are the shadows, the paper is the light.');
  out.push(K.about);
  return out;
}

/* ---- effects */

const AN_FX = {
  speed: { label: 'Speed lines', about: 'Long thin lines along the direction of the movement, leaving the subject clear. Thin at the ends, a little thicker in the middle; draw them with a ruler, quickly, from the clear space outward.', ink: 'Fineliner 0.2 - 0.5 mm. Two lengths, never a regular spacing.', page: 'Behind a running figure, a car, a hit that sends someone flying.' },
  focus: { label: 'Focus lines', about: 'Lines that run to one point: the eye is pulled to the centre. They start outside a clear circle and grow thinner as they go in.', ink: 'A ruler and a fineliner 0.3 mm; mark the centre with a pencil dot and rule from it.', page: 'A shock, a realisation, a name said aloud; the beat just before the answer.' },
  burst: { label: 'Impact burst', about: 'A spiked star: the sharp points of two different lengths in turn. The outline is heavy, the inside left white or in a flat tone.', ink: 'A brush pen or a 0.8 mm liner for the outline; keep the spikes sharp and uneven.', page: 'The moment of a hit, a bang, a fall. Put the sound word inside.' },
  sparkle: { label: 'Sparkles', about: 'Four-point stars of three sizes and a few round dots, scattered with a gap in the middle for the character. Soft circles stand for bokeh.', ink: 'A fineliner 0.3 mm for the stars; leave the circles in outline or add a light tone.', page: 'A happy, shōjo moment: a gift, a confession, a spring morning.' },
};
const AN_FX_DIRS = { h: 'Across', d: 'Diagonal', v: 'Up and down' };

function anRand(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const AN_FX_W = 520, AN_FX_H = 520;

/* o: { kind, density 1-3, dir (for speed), seed }. A square picture, a clear space in the middle for the character. */
function anEffectSvg(o) {
  const kind = AN_FX[o.kind] ? o.kind : 'speed', rnd = anRand(+o.seed || 1), dens = adClamp(Math.round(+o.density || 2), 1, 3);
  const W = AN_FX_W, H = AN_FX_H, cx = W / 2, cy = H / 2, ink = '#14141c', parts = [];
  if (kind === 'speed') {
    const dir = AN_FX_DIRS[o.dir] ? o.dir : 'h', n = [34, 60, 96][dens - 1], ang = dir === 'h' ? 0 : dir === 'v' ? 90 : -30;
    const ca = Math.cos(adRad(ang)), sa = Math.sin(adRad(ang));
    for (let i = 0; i < n; i++) {
      // A line at a distance across the direction, and a length along it. Near the middle a line keeps to one side of the
      // clear place, so the character is not crossed; further out it may run right across.
      const across = (rnd() - 0.5) * 780, len = 110 + rnd() * 300, w = 1.6 + rnd() * 3.4;
      let along0 = (rnd() - 0.5) * 560 - len / 2;
      if (Math.abs(across) < 125) along0 = rnd() < 0.5 ? 85 + rnd() * 80 : -85 - rnd() * 80 - len;
      const x0 = cx + along0 * ca - across * sa, y0 = cy + along0 * sa + across * ca, x1 = x0 + len * ca, y1 = y0 + len * sa;
      const nx = -sa * w / 2, ny = ca * w / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      parts.push(`<path d="M${adF(x0)} ${adF(y0)} L${adF(mx + nx)} ${adF(my + ny)} L${adF(x1)} ${adF(y1)} L${adF(mx - nx)} ${adF(my - ny)}Z" fill="${ink}"/>`);
    }
  } else if (kind === 'focus') {
    const n = [48, 84, 130][dens - 1], clearR = 70 + rnd() * 20;
    for (let i = 0; i < n; i++) {
      const a = (i + rnd() * 0.8) / n * Math.PI * 2, r0 = clearR + rnd() * 90, r1 = 380 + rnd() * 100, w = 0.012 + rnd() * 0.02;
      const p = (r, da) => `${adF(cx + Math.cos(a + da) * r)} ${adF(cy + Math.sin(a + da) * r)}`;
      parts.push(`<path d="M${p(r0, 0)} L${p(r1, -w)} L${p(r1, w)}Z" fill="${ink}"/>`);
    }
  } else if (kind === 'burst') {
    const n = [14, 20, 28][dens - 1], pts = [], inner = [];
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2 + (rnd() - 0.5) * 0.06, r = i % 2 ? 110 + rnd() * 25 : 190 + rnd() * 80 + (i % 4 === 0 ? 40 : 0);
      pts.push(`${adF(cx + Math.cos(a) * r)},${adF(cy + Math.sin(a) * r)}`);
      inner.push(`${adF(cx + Math.cos(a) * r * 0.62)},${adF(cy + Math.sin(a) * r * 0.62)}`);
    }
    parts.push(`<polygon points="${pts.join(' ')}" fill="#fff" stroke="${ink}" stroke-width="6" stroke-linejoin="miter"/>`);
    parts.push(`<polygon points="${inner.join(' ')}" fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.55"/>`);
  } else {
    const n = [14, 26, 40][dens - 1];
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 120 + rnd() * 150, x = cx + Math.cos(a) * r * 1.25, y = cy + Math.sin(a) * r, s = 8 + rnd() * rnd() * 34;
      if (x < 14 || x > W - 14 || y < 14 || y > H - 14) continue;
      const k = s * 0.22;
      parts.push(`<path d="M${adF(x)} ${adF(y - s)} Q${adF(x + k)} ${adF(y - k)} ${adF(x + s)} ${adF(y)} Q${adF(x + k)} ${adF(y + k)} ${adF(x)} ${adF(y + s)} Q${adF(x - k)} ${adF(y + k)} ${adF(x - s)} ${adF(y)} Q${adF(x - k)} ${adF(y - k)} ${adF(x)} ${adF(y - s)}Z" fill="${ink}"/>`);
    }
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 100 + rnd() * 190, x = cx + Math.cos(a) * r * 1.3, y = cy + Math.sin(a) * r, rr = 4 + rnd() * 16;
      if (x < 14 || x > W - 14 || y < 14 || y > H - 14) continue;
      parts.push(`<circle cx="${adF(x)}" cy="${adF(y)}" r="${adF(rr)}" fill="none" stroke="${ink}" stroke-width="${rr > 10 ? 1.4 : 2}" opacity="${rr > 10 ? 0.5 : 0.9}"/>`);
    }
  }
  // The clear place for the character, drawn pale and dashed so it is seen and is not part of the picture.
  const clear = `<ellipse cx="${cx}" cy="${cy}" rx="70" ry="110" fill="none" stroke="#9aa" stroke-width="1" stroke-dasharray="4 5" opacity="0.7"/>`;
  return adSvgOpen([0, 0, W, H], `${AN_FX[kind].label}, a drawing`) + `<rect width="${W}" height="${H}" fill="#fff"/>${parts.join('')}${clear}</svg>`;
}

/* ---- shots */

// The shots, from the head down to a line in head heights (the top of the head is 0, the chin 1, the feet 7).
const AN_SHOTS = [
  { key: 'ls', label: 'Long', from: -0.7, to: 7.5, code: 'ls' },
  { key: 'ms', label: 'Medium (waist up)', from: -0.6, to: 3.1, code: 'ms' },
  { key: 'cowboy', label: 'Cowboy (to the thigh)', from: -0.6, to: 4.2, code: 'ms' },
  { key: 'mcu', label: 'Medium close-up (chest up)', from: -0.45, to: 2.1, code: 'mcu' },
  { key: 'cu', label: 'Close-up (the face)', from: -0.2, to: 1.3, code: 'cu' },
  { key: 'xcu', label: 'Extreme close-up (the eyes)', from: 0.28, to: 0.78, code: 'xcu' },
];
const AN_FRAMES = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '2:3': 2 / 3 };

/* head, feet: the top of the head and the feet in the picture. Returns for each shot the rectangle to cut out:
   { x, y, w, h } - the frame's height is what the shot spans, its width what the shape needs, centred on the figure.
   The long shot is not bound to be taller than the picture: the cut may reach past it (the canvas fills that grey). */
function anShotRects(head, feet, aspect) {
  const height = feet.y - head.y, unit = height / 7, cx = (head.x + feet.x) / 2;
  return AN_SHOTS.map(s => {
    const h = (s.to - s.from) * unit, w = h * aspect;
    return { ...s, x: cx - w / 2, y: head.y + s.from * unit, w, h };
  });
}

/* ---- legs */

const AN_LEGWEAR = {
  bare: { label: 'Bare legs', about: 'The thigh is the widest part, the knee a small flat bump, the calf curves out on the outer side in the upper third, the ankle is the thinnest part.' },
  knee: { label: 'Knee socks', about: 'The sock hugs the calf and ends just under the knee; a band of sock or a fold marks its top, and the leg shows a soft dent where the band presses. Folds gather at the ankle.' },
  thigh: { label: 'Thigh-highs', about: 'A band at the thigh with the bare thigh above it (zettai ryouiki): the band presses a dent, and the bare strip is about a quarter of the thigh. The band is the widest line, so draw it as a curve round the leg.' },
  tights: { label: 'Tights', about: 'One tone over the whole leg: the shapes stay, the highlights go, and the colour is darker at the edges where the cloth is stretched thinnest, lighter in the middle.' },
};
const AN_SHOES = {
  sneaker: { label: 'Sneakers', about: 'A thick sole with a white edge, a rounded toe cap and laces on a tongue: the whole shoe is a wedge from the heel up to the toe.' },
  loafer: { label: 'Loafers', about: 'A low shoe that shows the instep: a small heel, a flat sole, the top cut low at the ankle.' },
  boot: { label: 'Boots', about: 'The shaft goes up the calf and hides the ankle: draw the shaft as a tube, with a fold at the ankle where it bends.' },
  sandal: { label: 'Sandals', about: 'Straps across the foot over a flat sole: show the toes, and draw the straps as curves round the foot.' },
};
const AN_LEG_RULES = 'In a figure seven heads tall the leg, from the hip to the floor, is about three and a half heads; the knee is at its middle, the thigh and the shin about equal. The foot is about one head long.';

// Catmull-Rom through the points as a cubic path, open.
function anSmooth(pts) {
  let d = `M${adP(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${adP([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${adP([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${adP(p2)}`;
  }
  return d;
}

/* o: { wear, shoe, skin }. A leg from the front (left) and from the side (right), on a ruler of head heights. */
function anLegsSvg(o) {
  const wear = AN_LEGWEAR[o.wear] ? o.wear : 'bare', shoe = AN_SHOES[o.shoe] ? o.shoe : 'sneaker', ink = AD_INK, skin = adCss(adRgbOf(o.skin || '#f1c9a5'));
  const L = 400, top = 30, floor = top + L, knee = top + L * 0.49, ankle = top + L * 0.93, calf = knee + L * 0.17, head = L / 3.5, hem = top + L * 0.08;
  const F = head, sock = '#f4f4f8', tight = '#2b2f4a';
  const cloth = wear === 'tights' ? tight : sock, line = (a, b, st = ink, w = 1.2, dash = '') => `<path d="M${adP(a)} L${adP(b)}" stroke="${st}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} fill="none"/>`;
  // Where the cloth starts: from the knee for knee socks, up the thigh for thigh-highs, the whole leg for tights.
  const wearTop = wear === 'knee' ? knee + 12 : wear === 'thigh' ? top + L * 0.3 : wear === 'tights' ? hem : null;
  let g = '';
  const ruler = (x) => {
    let s = '';
    for (let i = 0; i <= 3; i++) { const y = floor - i * head; s += line([x, y], [x + 8, y], '#778') + `<text x="${x - 4}" y="${adF(y + 4)}" text-anchor="end" font-size="11" fill="#778">${i}</text>`; }
    return s + `<text x="${x - 4}" y="${adF(top - 12)}" text-anchor="end" font-size="11" fill="#778">heads</text>` + line([x + 8, top], [x + 8, floor], '#aab', 0.8);
  };
  /* ---- the front */
  const fx = 190;
  const sideL = [[fx - 36, top], [fx - 40, top + L * 0.14], [fx - 30, knee - 22], [fx - 20, knee], [fx - 26, calf], [fx - 18, ankle - 30], [fx - 13, ankle]];
  const sideR = [[fx + 36, top], [fx + 38, top + L * 0.14], [fx + 28, knee - 22], [fx + 19, knee], [fx + 24, calf], [fx + 17, ankle - 30], [fx + 12, ankle]];
  const outline = pts => anSmooth(pts);
  const leg = `${outline(sideL)} L${adP([fx + 12, ankle])} ${outline([...sideR].reverse()).replace(/^M[^C]*/, '')} Z`;
  g += `<path d="${leg}" fill="${skin}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
  if (wearTop != null) {
    const clip = `<clipPath id="lg-f"><path d="${leg}"/></clipPath>`;
    g += clip + `<g clip-path="url(#lg-f)"><rect x="${fx - 60}" y="${adF(wearTop)}" width="120" height="${adF(ankle + 4 - wearTop)}" fill="${cloth}" opacity="${wear === 'tights' ? 0.88 : 1}"/>` +
      (wear !== 'tights' ? `<rect x="${fx - 60}" y="${adF(wearTop)}" width="120" height="${wear === 'knee' ? 10 : 12}" fill="${wear === 'knee' ? '#c24a5a' : '#3a3f63'}"/>` : '') + `</g>`;
    if (wear === 'thigh') g += `<path d="M${adP([fx - 40, wearTop + 12])} Q${adP([fx, wearTop + 20])} ${adP([fx + 38, wearTop + 12])}" fill="none" stroke="${ink}" stroke-width="1.1" opacity="0.5"/>`;
  }
  g += line([fx - 46, hem], [fx + 46, hem], '#c24a5a', 1.4, '5 4') + `<text x="${fx + 52}" y="${hem + 4}" font-size="11" fill="#c24a5a">skirt hem</text>`;
  // The knee and the ankle, in guide lines.
  g += line([fx - 56, knee], [fx + 56, knee], '#6a7aa8', 1, '4 4') + `<text x="${fx + 60}" y="${knee + 4}" font-size="11" fill="#6a7aa8">knee: half</text>`;
  g += line([fx - 56, ankle], [fx + 56, ankle], '#6a7aa8', 1, '4 4') + `<text x="${fx + 60}" y="${ankle + 4}" font-size="11" fill="#6a7aa8">ankle</text>`;
  // The shoe, front.
  const frontShoe = {
    sneaker: `<path d="M${adP([fx - 20, ankle - 8])} C${adP([fx - 26, ankle + 12])} ${adP([fx - 32, floor - 10])} ${adP([fx - 30, floor])} L${adP([fx + 30, floor])} C${adP([fx + 32, floor - 10])} ${adP([fx + 26, ankle + 12])} ${adP([fx + 18, ankle - 8])}Z" fill="#e9eaf2" stroke="${ink}" stroke-width="1.6"/>` + `<path d="M${adP([fx - 31, floor - 7])} L${adP([fx + 31, floor - 7])}" stroke="${ink}" stroke-width="1.2"/>`,
    loafer: `<path d="M${adP([fx - 17, ankle - 4])} C${adP([fx - 26, ankle + 12])} ${adP([fx - 30, floor - 8])} ${adP([fx - 28, floor])} L${adP([fx + 28, floor])} C${adP([fx + 30, floor - 8])} ${adP([fx + 24, ankle + 12])} ${adP([fx + 16, ankle - 4])}Z" fill="#5a3b32" stroke="${ink}" stroke-width="1.6"/>`,
    boot: `<path d="M${adP([fx - 28, calf - 20])} L${adP([fx - 22, ankle + 20])} C${adP([fx - 32, floor - 12])} ${adP([fx - 32, floor])} ${adP([fx - 30, floor])} L${adP([fx + 30, floor])} C${adP([fx + 32, floor - 12])} ${adP([fx + 26, ankle + 20])} ${adP([fx + 24, ankle + 10])} L${adP([fx + 30, calf - 20])}Z" fill="#3c2f2c" stroke="${ink}" stroke-width="1.6"/>`,
    sandal: `<path d="M${adP([fx - 26, floor - 18])} L${adP([fx - 28, floor])} L${adP([fx + 28, floor])} L${adP([fx + 26, floor - 18])}Z" fill="${skin}" stroke="${ink}" stroke-width="1.4"/>` +
      `<path d="M${adP([fx - 27, floor - 12])} Q${adP([fx, floor - 22])} ${adP([fx + 27, floor - 12])} M${adP([fx - 18, ankle])} Q${adP([fx, ankle + 14])} ${adP([fx + 16, ankle])}" fill="none" stroke="#8a4a3a" stroke-width="3"/>`,
  }[shoe];
  g += frontShoe;
  /* ---- the side */
  const sx = 470;
  const backL = [[sx - 40, top], [sx - 34, top + L * 0.15], [sx - 20, knee - 8], [sx - 22, knee + 10], [sx - 36, calf], [sx - 26, ankle - 36], [sx - 16, ankle - 4]];
  const frontL = [[sx + 30, top], [sx + 36, top + L * 0.16], [sx + 30, knee - 20], [sx + 27, knee], [sx + 22, knee + L * 0.12], [sx + 18, ankle - 30], [sx + 16, ankle - 4]];
  const sleg = `${outline(backL)} L${adP([sx + 16, ankle - 4])} ${outline([...frontL].reverse()).replace(/^M[^C]*/, '')} Z`;
  g += `<path d="${sleg}" fill="${skin}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
  if (wearTop != null) {
    g += `<clipPath id="lg-s"><path d="${sleg}"/></clipPath><g clip-path="url(#lg-s)"><rect x="${sx - 60}" y="${adF(wearTop)}" width="120" height="${adF(ankle + 4 - wearTop)}" fill="${cloth}" opacity="${wear === 'tights' ? 0.88 : 1}"/>` +
      (wear !== 'tights' ? `<rect x="${sx - 60}" y="${adF(wearTop)}" width="120" height="${wear === 'knee' ? 10 : 12}" fill="${wear === 'knee' ? '#c24a5a' : '#3a3f63'}"/>` : '') + `</g>`;
  }
  g += line([sx - 56, knee], [sx + 56, knee], '#6a7aa8', 1, '4 4') + line([sx - 56, ankle], [sx + 56, ankle], '#6a7aa8', 1, '4 4');
  // The calf bulge is above its middle and behind; a mark says so.
  g += `<text x="${sx - 48}" y="${adF(calf + 4)}" text-anchor="end" font-size="11" fill="#6a7aa8">calf</text>`;
  const sideShoe = {
    sneaker: `<path d="M${adP([sx - 16, ankle - 10])} L${adP([sx - 22, floor - 16])} Q${adP([sx - 26, floor])} ${adP([sx - 12, floor])} L${adP([sx + F * 0.92, floor])} Q${adP([sx + F + 6, floor])} ${adP([sx + F * 0.9, floor - 26])} Q${adP([sx + 40, floor - 52])} ${adP([sx + 16, ankle - 10])}Z" fill="#e9eaf2" stroke="${ink}" stroke-width="1.6"/>` + `<path d="M${adP([sx - 24, floor - 8])} L${adP([sx + F + 2, floor - 8])}" stroke="${ink}" stroke-width="1.2"/>`,
    loafer: `<path d="M${adP([sx - 16, ankle - 6])} L${adP([sx - 22, floor - 12])} Q${adP([sx - 24, floor])} ${adP([sx - 10, floor])} L${adP([sx + F * 0.9, floor])} Q${adP([sx + F, floor - 2])} ${adP([sx + F * 0.86, floor - 12])} Q${adP([sx + 34, ankle + 6])} ${adP([sx + 16, ankle - 6])}Z" fill="#5a3b32" stroke="${ink}" stroke-width="1.6"/>`,
    boot: `<path d="M${adP([sx - 36, calf - 16])} L${adP([sx - 24, ankle + 6])} L${adP([sx - 24, floor - 12])} Q${adP([sx - 26, floor])} ${adP([sx - 12, floor])} L${adP([sx + F * 0.9, floor])} Q${adP([sx + F, floor - 2])} ${adP([sx + F * 0.86, floor - 14])} Q${adP([sx + 40, ankle + 14])} ${adP([sx + 22, ankle])} L${adP([sx + 24, calf - 16])}Z" fill="#3c2f2c" stroke="${ink}" stroke-width="1.6"/>`,
    sandal: `<path d="M${adP([sx - 16, ankle - 6])} L${adP([sx - 20, floor - 12])} Q${adP([sx - 20, floor - 4])} ${adP([sx - 8, floor - 4])} L${adP([sx + F * 0.9, floor - 4])} Q${adP([sx + F, floor - 6])} ${adP([sx + F * 0.86, floor - 14])} Q${adP([sx + 36, ankle + 8])} ${adP([sx + 16, ankle - 6])}Z" fill="${skin}" stroke="${ink}" stroke-width="1.4"/>` +
      `<path d="M${adP([sx - 20, floor - 4])} L${adP([sx + F * 0.9, floor - 4])}" stroke="#8a4a3a" stroke-width="4"/><path d="M${adP([sx - 12, ankle + 4])} L${adP([sx - 12, floor - 6])} M${adP([sx + 16, ankle - 6])} Q${adP([sx + 26, floor - 24])} ${adP([sx + 28, floor - 6])}" fill="none" stroke="#8a4a3a" stroke-width="3"/>`,
  }[shoe];
  g += sideShoe + line([sx - 56, floor], [sx + 90, floor], ink, 1.2) + line([fx - 80, floor], [fx + 80, floor], ink, 1.2);
  g += `<text x="${fx}" y="${floor + 22}" text-anchor="middle" font-size="12" fill="#444">Front</text><text x="${sx + 20}" y="${floor + 22}" text-anchor="middle" font-size="12" fill="#444">Side</text>`;
  return adSvgOpen([0, 0, 640, 480], `A leg from the front and the side, ${AN_LEGWEAR[wear].label.toLowerCase()} and ${AN_SHOES[shoe].label.toLowerCase()}`) + `<rect width="640" height="480" fill="#fff"/>${ruler(36)}${g}</svg>`;
}

/* ---- silhouettes */

const AN_SIL_SIDE = 320, AN_SIL_H = 300;

/* A figure's mask: what cannot be reached from the border over pixels of about the border's colour. rgba: ImageData data.
   Returns { mask, found } - found is false when the border is busy (the picture has a background to cut, not a plain one). */
function anSilhouette(rgba, w, h, tol = 42) {
  const n = w * h, bg = [0, 0, 0], samples = [];
  for (let x = 0; x < w; x++) { samples.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { samples.push(y * w, y * w + w - 1); }
  for (let c = 0; c < 3; c++) { const v = samples.map(i => rgba[i * 4 + c]).sort((p, q) => p - q); bg[c] = v[v.length >> 1]; }
  const near = i => Math.abs(rgba[i * 4] - bg[0]) + Math.abs(rgba[i * 4 + 1] - bg[1]) + Math.abs(rgba[i * 4 + 2] - bg[2]) < tol * 1.6;
  const reach = new Uint8Array(n), stack = [];
  const seed = i => { if (!reach[i] && near(i)) { reach[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
  }
  const mask = new Uint8Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) { mask[i] = reach[i] ? 0 : 1; count += mask[i]; }
  return { mask, found: count > n * 0.02 && count < n * 0.85 };
}

// The mask cut to its box and scaled to a height; Returns { w, h, mask }.
function anSilScale(mask, w, h, outH = AN_SIL_H) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { w: 1, h: outH, mask: new Uint8Array(outH) };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = outH / bh, ow = Math.max(1, Math.round(bw * k)), out = new Uint8Array(ow * outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < ow; x++) out[y * ow + x] = mask[(y0 + Math.min(bh - 1, Math.floor(y / k))) * w + x0 + Math.min(bw - 1, Math.floor(x / k))];
  return { w: ow, h: outH, mask: out };
}

/* Two scaled silhouettes laid on each other, centred on their middles (the sideways middle of the mass): the share of
   what they cover that both cover. 1 is the same shape, 0 nothing in common. */
function anSilOverlap(a, b) {
  const mid = s => { let sum = 0, c = 0; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x]) { sum += x; c++; } return c ? sum / c : s.w / 2; };
  const ma = mid(a), mb = mid(b), shift = Math.round(ma - mb), h = Math.min(a.h, b.h), W = Math.max(a.w, b.w) * 2;
  let both = 0, either = 0;
  for (let y = 0; y < h; y++) for (let x = -W; x < W; x++) {
    const pa = x >= 0 && x < a.w && a.mask[y * a.w + x], xb = x - shift, pb = xb >= 0 && xb < b.w && b.mask[y * b.w + xb];
    if (pa || pb) either++;
    if (pa && pb) both++;
  }
  return either ? both / either : 0;
}

// How the silhouette is spread: the share at the top third (hair, hat, ears), and the width against the height.
function anSilTraits(s) {
  let top = 0, all = 0;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask[y * s.w + x]) { all++; if (y < s.h / 3) top++; }
  return { top: all ? top / all : 0, wide: s.w / s.h };
}

function anSilNote(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const o = anSilOverlap(items[i], items[j]), a = i + 1, b = j + 1;
    out.push(o > 0.72 ? `${a} and ${b} overlap ${Math.round(o * 100)}%: as black shapes they are almost one person. Change the hair, the hat or the width of the clothes.`
      : o > 0.5 ? `${a} and ${b} overlap ${Math.round(o * 100)}%: they can be told apart, but only by their size or their outline. Push one thing further.`
        : `${a} and ${b} overlap ${Math.round(o * 100)}%: they read apart even in black.`);
  }
  items.forEach((s, i) => {
    const t = anSilTraits(s);
    out.push(`${i + 1}: ${Math.round(t.top * 100)}% of the shape is in its top third (hair, hat, ears) and it is ${t.wide < 0.3 ? 'narrow' : t.wide > 0.55 ? 'wide' : 'average'} for its height.`);
  });
  return out;
}

/* ---- compare */

const AN_CMP_SIDE = 300;
const AN_CMP_MODES = { overlay: 'Overlay', diff: 'Difference', side: 'Side by side' };
const AN_CMP_GRIDS = [0, 4, 6, 8];
const AN_CMP_MINUTES = [1, 3, 5, 10];

// A canvas as blurred grey at the long side AN_CMP_SIDE, fitted to w x h (its own shape if w, h are not given).
function anCmpGray(canvas, w, h) {
  const k = Math.min(1, AN_CMP_SIDE / Math.max(canvas.width, canvas.height));
  w = w || Math.max(8, Math.round(canvas.width * k)); h = h || Math.max(8, Math.round(canvas.height * k));
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(2px)';
  g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  return { gray, w, h };
}

/* The reference and the drawing at one size; the drawing is stretched over the reference's box.
   Returns { score (0-100: how alike the lights and darks are), lighter, darker (shares of the picture where the drawing is
   lighter / darker than the reference by more than a step), canvas (the difference: red where the drawing is darker than
   the reference, blue where it is lighter) }. */
function anCmpDiff(ref, drawing) {
  const a = anCmpGray(ref), b = anCmpGray(drawing, a.w, a.h), n = a.w * a.h;
  const cv = Object.assign(document.createElement('canvas'), { width: a.w, height: a.h }), g = cv.getContext('2d'), img = g.createImageData(a.w, a.h), d = img.data;
  let sum = 0, lighter = 0, darker = 0;
  const STEP = 40;
  for (let i = 0; i < n; i++) {
    const diff = b.gray[i] - a.gray[i], m = Math.abs(diff);
    sum += m;
    if (diff > STEP) lighter++; else if (diff < -STEP) darker++;
    const t = Math.min(1, m / 120);
    // White where they agree, red where the drawing is darker, blue where it is lighter.
    d[i * 4] = diff < 0 ? 255 : Math.round(255 * (1 - t)); d[i * 4 + 1] = Math.round(255 * (1 - t)); d[i * 4 + 2] = diff > 0 ? 255 : Math.round(255 * (1 - t)); d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { score: Math.round(100 - sum / n / 255 * 100 * 1.8), lighter: lighter / n, darker: darker / n, canvas: cv, w: a.w, h: a.h };
}

function anCmpNote(r) {
  const out = [`The lights and darks agree to ${adClamp(r.score, 0, 100)}%.`];
  if (r.darker > r.lighter * 1.6 && r.darker > 0.05) out.push(`The drawing is darker than the reference over ${Math.round(r.darker * 100)}% of the picture (the red): the shadows may be heavier than they are, or the paper too dark in the photo.`);
  else if (r.lighter > r.darker * 1.6 && r.lighter > 0.05) out.push(`The drawing is lighter than the reference over ${Math.round(r.lighter * 100)}% of the picture (the blue): the darks need to go further.`);
  else if (r.darker + r.lighter > 0.12) out.push('The darks and lights are about even, but they are in the wrong places (red and blue both): check where the shapes sit, not how dark they are.');
  else out.push('The shapes sit where they should: what is left are small differences in the edges.');
  out.push('The drawing is stretched over the reference, so a drawing with another shape will differ everywhere: photograph it square to the paper, with the same margins.');
  return out;
}
