/* refboard - Light and weather effects: glow, light rays, sparkles on water,
   rain, snow, a wet street with neon, fog, a rainbow, lightning, fireflies and
   sunbeams under water - the things a Shinkai sky is made of.
   The third chapter of the Handbook (Practise > Handbook), in the same four
   parts: theory, a demonstration, things to try, and what you should see.

   Every effect is the same problem for a painter: light is not a colour you
   can put down, it is the paper (or the lightest layer) kept clean and the
   dark built round it. So each lesson says where to leave the paper, where the
   edges go soft, and in what order the layers go - for watercolour and for ink
   with markers - and its demonstration is drawn from a few numbers (lxGlow,
   lxRays, lxSparkles, lxRain, lxSnow, lxStreet, lxFog, lxRainbow, lxLightning,
   lxFireflies, lxDeep), which give back what they drew
   so the lesson's words are read off the same numbers and a test can ask them.
   They are models of how the effect looks, not of the optics.
     glow      light falls off with the square of the distance from a point:
               1 / (1 + (d / r)^2), laid down as rings, a wash each, the
               smallest ring over the others, the core left bare;
     rays      beams between the gaps of a screen (leaves, clouds), parallel
               in the world and so converging toward the sun in a picture;
     sparkles  a glitter path of marks on water, big near the viewer and fine
               toward the horizon, the path as wide as the swell is rough;
     rain      streaks that lean with the wind, long and dark near, short and
               pale far (aerial perspective), none where the sky is dry;
     snow      flakes in three depths: the near ones large and out of focus,
               the far ones small and sharp;
     street    a neon sign and its reflection in a wet road - stretched
               downward, dimmer by what the road absorbs, broken by ripples;
     fog       ridges one behind another, each taking the sky's colour by
               1 - exp(-k * distance), mist thickest at the foot;
     rainbow   seven colours, red outside, a fainter twin with the order
               reversed, the dark band between the two;
     lightning a bolt by midpoint displacement - crooked, with thinner forks
               running down - and a glow that falls off fast;
     fireflies bare points with a small yellow-green glow, big near, tiny far;
     deep      water taking red first, then green, blue deepest, and slanting
               beams that fade with it.
   The watercolour and the ink paragraph of a lesson show one at a time: the
   medium is chosen once at the top (handbook.js, hbParts).
   Loaded with handbook.js after techniques.js (loadSection('handbook')); it
   adds to HB_LESSONS. */
"use strict";

const LX_GROUP = 'Light and weather';
const LX_NIGHT = [14, 20, 48];

const lxClamp01 = x => Math.min(1, Math.max(0, x));
// How much of a point light is left d away, when r is where it has fallen to half.
const lxFalloff = (d, r) => 1 / (1 + (d / r) ** 2);

function lxSky(g, W, H, top, bottom, to = H) {
  const s = g.createLinearGradient(0, 0, 0, to);
  s.addColorStop(0, tkRgba(top, 1)); s.addColorStop(1, tkRgba(bottom, 1));
  g.fillStyle = s; g.fillRect(0, 0, W, H);
}

/* ---- glow */
// Rings from the outside in: the paper is built dark and the light is what is left.
function lxGlow(cv, { strength = 0.6, spread = 0.5, warm = 0.6 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), cx = W / 2, cy = H * 0.46;
  lxSky(g, W, H, LX_NIGHT, [28, 36, 74]);
  const r = 14 + spread * 70, rings = Math.max(2, Math.round(3 + strength * 4));
  const hot = [255, 214 + 30 * (1 - warm), 120 + 110 * (1 - warm)];
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < rings; i++) {
    const rr = r * 2.6 * (1 - i / rings) + 6, a = strength * 0.9 / rings;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    grad.addColorStop(0, tkRgba(hot, a * 1.6)); grad.addColorStop(1, tkRgba(hot, 0));
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = tkRgba([255, 250, 232], 1); g.beginPath(); g.arc(cx, cy, 4.5, 0, Math.PI * 2); g.fill();      // the bare core
  g.fillStyle = tkRgba([10, 14, 30], 1); g.fillRect(cx - 1.2, cy + 6, 2.4, H);                                // the pole
  const lum = d => { const p = g.getImageData(Math.round(cx + d), Math.round(cy), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
  return { rings, radius: r, core: lum(0), near: lum(r * 0.5), far: lum(60), reach: r * 2.6 };
}

/* ---- light rays */
function lxRays(cv, { beams = 5, tilt = 0.3, soft = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(5);
  lxSky(g, W, H, [60, 92, 120], [150, 180, 170]);
  const sun = { x: W * 0.78 - tilt * 80, y: -18 };
  const lean = (tilt - 0.5) * 0.9;                      // where the beams point: a little either side of straight down
  g.globalCompositeOperation = 'lighter';
  const list = [];
  for (let i = 0; i < beams; i++) {
    const spanA = Math.PI / 2 + lean + (i - (beams - 1) / 2) * (0.5 / Math.max(1, beams - 1)) + (rnd() - 0.5) * 0.04;
    const half = 0.012 + 0.05 * soft * (0.6 + 0.8 * rnd()), len = H * 1.5;
    const a1 = spanA - half, a2 = spanA + half, a = 0.16 + 0.16 * rnd();
    const grad = g.createLinearGradient(sun.x, sun.y, sun.x + Math.cos(spanA) * len, sun.y + Math.sin(spanA) * len);
    grad.addColorStop(0, tkRgba([255, 240, 190], a)); grad.addColorStop(1, tkRgba([255, 240, 190], 0));
    g.fillStyle = grad; g.beginPath(); g.moveTo(sun.x, sun.y);
    g.lineTo(sun.x + Math.cos(a1) * len, sun.y + Math.sin(a1) * len); g.lineTo(sun.x + Math.cos(a2) * len, sun.y + Math.sin(a2) * len);
    g.closePath(); g.fill();
    list.push({ angle: spanA, width: (a2 - a1) * len });
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = tkRgba([20, 36, 40], 1);                // the screen the light comes through: ground and a trunk
  g.fillRect(0, H - 26, W, 26); g.fillRect(34, 0, 14, H);
  const s = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 52);
  s.addColorStop(0, tkRgba([255, 250, 225], 0.9)); s.addColorStop(1, tkRgba([255, 250, 225], 0));
  g.fillStyle = s; g.fillRect(0, 0, W, 80);
  const row = y => { let lo = 255, hi = 0; for (let x = 60; x < W - 10; x += 2) { const p = g.getImageData(x, y, 1, 1).data, v = (p[0] + p[1] + p[2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  return { beams: list.length, lean, softness: soft, contrast: row(Math.round(H * 0.55)), lit: list };
}

/* ---- sparkles on water */
function lxSparkles(cv, { rough = 0.5, amount = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(9), horizon = H * 0.38;
  lxSky(g, W, H, [24, 40, 82], [214, 150, 120], horizon);
  const sunG = g.createRadialGradient(W / 2, horizon, 0, W / 2, horizon, 70);
  sunG.addColorStop(0, tkRgba([255, 226, 170], 0.9)); sunG.addColorStop(1, tkRgba([255, 226, 170], 0));
  g.fillStyle = sunG; g.fillRect(0, horizon - 70, W, 70);
  g.fillStyle = tkRgba([200, 150, 130], 0.5); g.fillRect(0, horizon - 2, W, 3);
  g.save(); g.beginPath(); g.rect(0, horizon, W, H - horizon); g.clip();
  g.fillStyle = tkRgba([20, 34, 66], 1); g.fillRect(0, horizon, W, H - horizon);
  const N = Math.round(60 + amount * 340), centre = W * 0.5;
  let big = 0, fine = 0, widest = 0, nearHalf = 0;
  for (let i = 0; i < N; i++) {
    const t = Math.pow(rnd(), 0.8), y = horizon + 3 + t * (H - horizon - 6);    // t: 0 at the horizon, 1 at the viewer
    const path = 12 + rough * 70 * (0.3 + t), x = centre + tkGauss(rnd) * path * 0.55;
    const w = (1.5 + 8 * t * (0.4 + rough)) * (0.5 + rnd()), h = 1 + 1.3 * t * (0.6 + rnd() * 0.8);     // short bars: the water is a mirror in slices
    g.fillStyle = tkRgba([255, 236, 200], 0.4 + 0.5 * rnd());
    g.fillRect(x - w / 2, y, w, h);
    if (w > 7) big++; else fine++;
    if (t > 0.5) nearHalf++;
    widest = Math.max(widest, Math.abs(x - centre) * 2);
  }
  g.restore();
  return { marks: N, big, fine, near: nearHalf, width: widest, horizon };
}

/* ---- rain */
function lxRain(cv, { amount = 0.5, wind = 0.3, length = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(17);
  lxSky(g, W, H, [78, 90, 106], [150, 158, 164]);
  g.fillStyle = tkRgba([64, 74, 86], 1);                         // far buildings, the haze takes them
  for (let i = 0; i < 7; i++) g.fillRect(i * 50 + 6, H * 0.52 - 28 * rnd(), 42, H);
  g.fillStyle = tkRgba([90, 102, 112], 0.5); g.fillRect(0, H * 0.45, W, H);
  const N = Math.round(40 + amount * 260), slant = (wind - 0.5) * 1.1;
  let near = 0, far = 0, dir = 0;
  for (let i = 0; i < N; i++) {
    const d = rnd(), x = rnd() * (W + 80) - 40, y = rnd() * H;     // d 0 near, 1 far
    const len = (6 + 34 * length) * (1.2 - 0.9 * d), a = 0.5 - 0.35 * d, lw = 1.5 - d;
    g.strokeStyle = tkRgba(d < 0.5 ? [232, 238, 246] : [196, 206, 216], a); g.lineWidth = Math.max(0.5, lw);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(slant) * len, y + Math.cos(slant) * len); g.stroke();
    if (d < 0.5) near++; else far++;
  }
  dir = slant;
  return { streaks: N, near, far, slant: dir * 180 / Math.PI, long: 6 + 34 * length };
}

/* ---- snow */
function lxSnow(cv, { amount = 0.5, blur = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(23);
  lxSky(g, W, H, [38, 52, 84], [118, 136, 170]);
  g.fillStyle = tkRgba([30, 42, 62], 1); g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.64 - 22 * Math.sin(x / 38) * rnd());
  g.lineTo(W, H); g.fill();
  const N = Math.round(60 + amount * 340), depth = [0, 0, 0];
  let widest = 0;
  for (let i = 0; i < N; i++) {
    const d = rnd(), layer = d < 0.15 ? 0 : d < 0.5 ? 1 : 2;       // 0 near, 2 far
    const r = [4.6, 2.2, 1.0][layer] * (0.7 + 0.6 * rnd()), soft = layer === 0 ? 0.35 + 0.65 * blur : layer === 1 ? 0.5 * blur : 0;
    const x = rnd() * W, y = rnd() * H;
    const grad = g.createRadialGradient(x, y, r * (1 - soft) * 0.5, x, y, r * (1 + soft));
    grad.addColorStop(0, tkRgba([250, 252, 255], layer === 0 ? 0.85 : 0.9)); grad.addColorStop(1, tkRgba([250, 252, 255], 0));
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r * (1 + soft), 0, Math.PI * 2); g.fill();
    depth[layer]++; widest = Math.max(widest, r * 2 * (1 + soft));
  }
  return { flakes: N, near: depth[0], mid: depth[1], far: depth[2], widest };
}

/* ---- a wet street with neon */
function lxStreet(cv, { wet = 0.7, ripple = 0.4, glow = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(31), road = H * 0.56;
  lxSky(g, W, H, [10, 14, 34], [36, 28, 64], road);
  g.fillStyle = tkRgba([18, 22, 40], 1); g.fillRect(0, road, W, H - road);
  const signs = [{ x: 40, w: 54, y: 44, c: [255, 70, 150] }, { x: 126, w: 38, y: 70, c: [60, 220, 255] }, { x: 214, w: 62, y: 38, c: [255, 190, 70] }];
  const hide = 0.62 * wet;                                       // how much of a sign the road gives back
  for (const s of signs) {
    const mirror = (road - s.y) * 1.8;                           // stretched down: the road is seen at a low angle
    const top = road + 3;
    const grad = g.createLinearGradient(0, top, 0, top + mirror);
    grad.addColorStop(0, tkRgba(s.c, hide)); grad.addColorStop(1, tkRgba(s.c, 0));
    g.fillStyle = grad;
    for (let y = top; y < Math.min(H, top + mirror); y += 2) {
      const sway = Math.sin(y * 0.5 + s.x) * ripple * 7 * ((y - top) / mirror + 0.2) * (rnd() + 0.3);
      g.globalAlpha = 1 - 0.7 * ((y - top) / mirror);
      g.fillRect(s.x + sway, y, s.w, 1.6);
    }
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'lighter';
  for (const s of signs) {
    const halo = g.createRadialGradient(s.x + s.w / 2, s.y + 6, 2, s.x + s.w / 2, s.y + 6, 50 + 40 * glow);
    halo.addColorStop(0, tkRgba(s.c, 0.35 * glow)); halo.addColorStop(1, tkRgba(s.c, 0));
    g.fillStyle = halo; g.fillRect(0, 0, W, road);
  }
  g.globalCompositeOperation = 'source-over';
  for (const s of signs) { g.fillStyle = tkRgba(s.c, 1); g.fillRect(s.x, s.y, s.w, 12); g.fillStyle = tkRgba([255, 255, 255], 0.6); g.fillRect(s.x + 3, s.y + 4, s.w - 6, 3); }
  const lumAt = (x, y) => { const p = g.getImageData(x, y, 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
  return { signs: signs.length, keeps: hide, stretch: 1.8, ripple, source: lumAt(signs[0].x + 8, signs[0].y + 4), mirror: lumAt(signs[0].x + 8, road + 8), road };
}

/* ---- fog and mist */
const lxLum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const lxMixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Ridges one behind another: each takes the sky's colour by 1 - exp(-k * distance), the Beer-Lambert law.
function lxFog(cv, { density = 0.5, mist = 0.4, layers = 5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(41);
  const sky = [196, 206, 212], dark = [38, 54, 52], k = 0.1 + density * 1.1;
  lxSky(g, W, H, [150, 172, 190], sky);
  const contrasts = [], veil = [];
  for (let i = layers - 1; i >= 0; i--) {                       // far first, so the near ones cover them
    const dist = 0.3 + i * 0.9, f = 1 - Math.exp(-k * dist), col = lxMixRgb(dark, sky, f), base = H * (0.7 - 0.075 * i);
    g.fillStyle = tkRgba(col, 1); g.beginPath(); g.moveTo(0, H);
    const ph = rnd() * 6;
    for (let x = 0; x <= W; x += 8) g.lineTo(x, base - (10 + 16 * (1 - i / layers)) * (Math.sin(x / (30 + 9 * i) + ph) * 0.6 + Math.sin(x / 11 + ph * 2) * 0.4));
    g.lineTo(W, H); g.fill();
    contrasts[i] = Math.abs(lxLum(col) - lxLum(sky)); veil[i] = f;
  }
  const m = g.createLinearGradient(0, H, 0, H * (1 - 0.15 - mist * 0.55));
  m.addColorStop(0, tkRgba(sky, 0.55 + 0.4 * mist)); m.addColorStop(1, tkRgba(sky, 0));
  g.fillStyle = m; g.fillRect(0, 0, W, H);                      // mist lying in the valley, thickest at the bottom
  return { layers, contrasts, veil, near: contrasts[0], far: contrasts[layers - 1], gone: contrasts.filter(c => c < 10).length, mist };
}

/* ---- a rainbow */
const LX_BOW = [[220, 40, 40], [240, 130, 40], [240, 210, 60], [80, 180, 80], [70, 160, 210], [70, 80, 190], [140, 70, 180]];
// Light bent back at 42 degrees from the point opposite the sun, red outside; a fainter twin at 51, reversed.
function lxRainbow(cv, { strength = 0.6, width = 0.5, twin = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), cx = W / 2, cy = H * 0.95, R = H * 0.62;
  lxSky(g, W, H, [62, 70, 92], [136, 146, 158]);
  g.fillStyle = tkRgba([26, 38, 30], 1); g.fillRect(0, cy, W, H - cy);
  const bw = 3 + width * 9, total = bw * LX_BOW.length, R2 = R * 1.28;
  const ring = (r0, r1, a) => { g.fillStyle = a; g.beginPath(); g.arc(cx, cy, r1, Math.PI, 2 * Math.PI); g.arc(cx, cy, r0, 2 * Math.PI, Math.PI, true); g.closePath(); g.fill(); };
  ring(0, R - total, tkRgba([255, 255, 255], 0.1 * strength));  // the sky inside the bow is lighter
  ring(R, R2 - total, tkRgba([0, 0, 0], 0.22 * strength));      // Alexander's dark band between the two
  g.lineWidth = bw + 0.8;
  LX_BOW.forEach((c, i) => { g.strokeStyle = tkRgba(c, strength * 0.75); g.beginPath(); g.arc(cx, cy, R - bw * (i + 0.5), Math.PI, 2 * Math.PI); g.stroke(); });
  const second = twin > 0.05;
  if (second) LX_BOW.forEach((c, i) => { g.strokeStyle = tkRgba(LX_BOW[LX_BOW.length - 1 - i], strength * twin * 0.35); g.beginPath(); g.arc(cx, cy, R2 - bw * (i + 0.5), Math.PI, 2 * Math.PI); g.stroke(); });
  const lum = r => { const p = g.getImageData(Math.round(cx), Math.round(cy - r), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
  return { radius: R, bands: LX_BOW.length, bandWidth: bw, across: total, second, outer: 'red', secondOuter: 'violet', inside: lum(R - total - 14), between: lum((R + R2 - total) / 2 + 2), outside: lum(R2 + 14) };
}

/* ---- lightning */
function lxLightning(cv, { forks = 2, glow = 0.6, jag = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(53);
  lxSky(g, W, H, [20, 22, 40], [64, 66, 92]);
  // midpoint displacement: each segment is split and its middle pushed sideways, less each time
  const bolt = (x0, y0, x1, y1, amp, depth) => {
    if (depth === 0) return [[x0, y0], [x1, y1]];
    const mx = (x0 + x1) / 2 + (rnd() - 0.5) * amp, my = (y0 + y1) / 2 + (rnd() - 0.5) * amp * 0.3;
    return bolt(x0, y0, mx, my, amp / 2, depth - 1).concat(bolt(mx, my, x1, y1, amp / 2, depth - 1).slice(1));
  };
  const main = bolt(W * 0.56, 0, W * 0.44, H * 0.8, 20 + jag * 120, 5);
  const paths = [{ pts: main, w: 2.2 }];
  for (let f = 0; f < forks; f++) {
    const at = main[Math.round(6 + (f + 0.5) / forks * (main.length - 14))], side = f % 2 ? -1 : 1;
    paths.push({ pts: bolt(at[0], at[1], at[0] + side * (40 + 40 * rnd()), at[1] + 50 + 50 * rnd(), 10 + jag * 40, 3), w: 1.1 });
  }
  const stroke = (w, col, a) => { g.strokeStyle = tkRgba(col, a); g.lineJoin = 'round'; for (const p of paths) { g.beginPath(); p.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineWidth = w * p.w / 2.2; g.stroke(); } };
  g.globalCompositeOperation = 'lighter';
  if (glow > 0) { stroke(34 * glow + 4, [120, 140, 255], 0.07 * glow + 0.02); stroke(16 * glow + 3, [160, 176, 255], 0.14 * glow + 0.03); stroke(7 * glow + 2, [210, 220, 255], 0.35); }
  g.globalCompositeOperation = 'source-over';
  stroke(2.2, [255, 255, 255], 1);                               // the core is the bare paper
  const mid = main[Math.round(main.length * 0.6)], at = (dx) => { const p = g.getImageData(Math.max(0, Math.min(W - 1, Math.round(mid[0] + dx))), Math.round(mid[1]), 1, 1).data; return (p[0] + p[1] + p[2]) / 3; };
  let len = 0; for (let i = 1; i < main.length; i++) len += Math.hypot(main[i][0] - main[i - 1][0], main[i][1] - main[i - 1][1]);
  const straight = Math.hypot(W * 0.12, H * 0.8);
  return { forks, glow, points: main.length, crooked: len / straight, beside: at(14), away: at(W * 0.45 * (mid[0] > W / 2 ? -1 : 1)), core: at(0) };
}

/* ---- fireflies */
function lxFireflies(cv, { amount = 0.5, glow = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(61);
  lxSky(g, W, H, [6, 14, 26], [16, 36, 34]);
  g.fillStyle = tkRgba([4, 12, 12], 1); g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, H * 0.82 - 14 * rnd());
  g.lineTo(W, H); g.fill();
  const N = Math.round(6 + amount * 54); let near = 0, far = 0, biggest = 0;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const d = rnd(), x = rnd() * W, y = H * 0.12 + rnd() * H * 0.7, r = 1 + 3.4 * (1 - d), halo = r * (1.6 + 4.4 * glow);
    const grad = g.createRadialGradient(x, y, 0, x, y, halo);
    grad.addColorStop(0, tkRgba([210, 255, 120], 0.55 + 0.3 * glow)); grad.addColorStop(1, tkRgba([210, 255, 120], 0));
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, halo, 0, Math.PI * 2); g.fill();
    g.fillStyle = tkRgba([255, 255, 215], 0.95); g.beginPath(); g.arc(x, y, Math.max(0.8, r * 0.55), 0, Math.PI * 2); g.fill();     // the lamp itself: bare paper
    if (d < 0.4) near++; else far++;
    biggest = Math.max(biggest, halo * 2);
  }
  g.globalCompositeOperation = 'source-over';
  return { count: N, near, far, biggest, glow };
}

/* ---- sunbeams under water */
// Water takes red first, then green; blue goes deepest. Beams fade the same way.
function lxDeep(cv, { depth = 0.5, rays = 0.5, clear = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), rnd = tkRandom(71);
  const top = [120, 214, 222], k = (0.5 + depth * 2.2) * (1.5 - clear), per = [1.0, 0.28, 0.1];
  const at = f => top.map((v, i) => v * Math.exp(-per[i] * k * f));            // f: 0 at the surface, 1 at the bottom of the picture
  const grad = g.createLinearGradient(0, 0, 0, H);
  for (let s = 0; s <= 8; s++) grad.addColorStop(s / 8, tkRgba(at(s / 8), 1));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const N = Math.round(2 + rays * 8), lean = 0.35, reach = 0.35 + 0.65 * clear;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const x = (i + 0.3 + rnd() * 0.5) / N * (W + 80) - 20, w = 6 + 18 * rnd(), a = 0.1 + 0.14 * rnd(), len = H * reach * (0.7 + 0.5 * rnd());
    const gr = g.createLinearGradient(x, 0, x + lean * len, len);
    gr.addColorStop(0, tkRgba([210, 255, 250], a)); gr.addColorStop(1, tkRgba([210, 255, 250], 0));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + lean * len + w, len); g.lineTo(x + lean * len, len); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = tkRgba([8, 20, 28], 0.9); g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, H - 8 - 16 * Math.abs(Math.sin(x / 40)) * rnd());
  g.lineTo(W, H); g.fill();
  const t = at(0), b = at(1);
  return { beams: N, reach, red: [t[0], b[0]], green: [t[1], b[1]], blue: [t[2], b[2]], keptRed: b[0] / t[0], keptBlue: b[2] / t[2] };
}

/* ---- the lessons */
HB_LESSONS.push(
  { id: 'glow', group: LX_GROUP, title: 'Glow round a light',
    theory: 'A lamp, a window at night, the sun low on the sea: the light is a <b>bare core, with the dark built round it</b>. Light fades with the square of the distance, so the glow is bright and tight at the core and then a long, soft tail. In <b>watercolour</b> leave the paper white at the core, wet the area round it and lay the colour on from the outside in - a wash for every ring, each one smaller than the last, drying between if you want the rings to blend only softly. In <b>ink with markers</b> go the other way: the lightest marker first for the widest ring and work darker toward the edges only if the lamp is dark, or keep the lightest tone and add a white gel pen for the core.',
    build(host) {
      host.innerHTML = tkLoad('A street lamp at night with a halo of light round it, bright at the middle and fading into the dark blue') +
        hbSlider('hbGStr', 'Strength', 5, 100, 1, 60, '') + hbSlider('hbGSpread', 'Spread', 0, 100, 1, 50, '') + hbSlider('hbGWarm', 'Warm to cool', 0, 100, 1, 60, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxGlow(cv, { strength: tkValue(host, 'hbGStr') / 100, spread: tkValue(host, 'hbGSpread') / 100, warm: tkValue(host, 'hbGWarm') / 100 });
        read.textContent = `${r.rings} washes, from the widest (${Math.round(r.reach)} px across to its edge) down to the smallest at the core, which stays bare paper. Light left at half the radius: ${Math.round(r.near / Math.max(1, r.core) * 100)}% of the core.`;
      };
      for (const id of ['hbGStr', 'hbGSpread', 'hbGWarm']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Raise the strength: what is added, more rings or a brighter centre?',
      'Widen the spread and read how far the first wash reaches. How far out would your brush have to wet the paper?',
      'Cool the light. Where in the glow would you keep it warm even so?'],
    see: 'A tight bright core and a soft long tail, not an even disc: the eye reads the sharp drop beside the core as brightness. More strength means more washes and a brighter heart, not a bigger one; spread is what makes the glow big. Keep the very middle bare, and let the edges dissolve into the dark rather than ending in a ring.' },

  { id: 'rays', group: LX_GROUP, title: 'Light rays',
    theory: 'Beams of light through leaves or between clouds are <b>parallel in the world, but converge on the sun in a picture</b>, so draw them from one point, not as parallel stripes. A few wide beams and several fine ones look natural; all the same width looks like a fan. In <b>watercolour</b> paint the whole dark scene first, then <b>lift</b> the beams with a damp stiff brush or a tissue, a quick stroke each, or keep them as bare paper if you planned for it; they are brightest near the sun and fade away from it. In <b>ink with markers</b> add them last with a white gel pen or opaque white, thin over the dark, or leave the lightest marker tone and darken only the gaps.',
    build(host) {
      host.innerHTML = tkLoad('Beams of sunlight falling from the upper right between a tree trunk and the ground') +
        hbSlider('hbRBeams', 'Beams', 1, 9, 1, 5, '') + hbSlider('hbRTilt', 'Direction', 0, 100, 1, 30, '') + hbSlider('hbRSoft', 'Softness', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxRays(cv, { beams: tkValue(host, 'hbRBeams'), tilt: tkValue(host, 'hbRTilt') / 100, soft: tkValue(host, 'hbRSoft') / 100 });
        const widths = r.lit.map(b => b.width), wide = Math.max(...widths), thin = Math.min(...widths);
        read.textContent = `${r.beams} ${r.beams === 1 ? 'beam' : 'beams'}, all from one point at the sun. The widest is ${Math.round(wide)} px across at its far end, the thinnest ${Math.round(thin)}. Lightest-to-darkest across the picture: ${Math.round(r.contrast)} of 255.` + (r.beams > 6 ? ' So many beams read as a fan: take some out or make them uneven.' : '');
      };
      for (const id of ['hbRBeams', 'hbRTilt', 'hbRSoft']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Turn the direction and follow where each beam would meet the others if it went on.',
      'Add beams up to nine: where does the picture stop looking like light and start looking like a fan?',
      'Soften the edges. Which is truer in thick mist, hard or soft?'],
    see: 'All the beams lead back to the sun, at slightly different angles - the sign of light from one point. They are widest and faintest far from it. A few beams of uneven width look found; many equal ones look drawn. Softer edges read as haze or mist in the air.' },

  { id: 'sparkles', group: LX_GROUP, title: 'Sparkles on water',
    theory: 'The glitter path under a low sun or the moon is <b>not a spread of light but many small mirrors</b>, each wave tilted to reflect it. The marks are <b>short horizontal bars</b>, big and bold close to you, finer and denser toward the horizon, and the path is as wide as the swell is rough: calm water gives a narrow shining road, a choppy sea a wide scatter. In <b>watercolour</b> the best sparkle is the paper: paint the water around them, or lift them when it is dry, or use masking fluid beforehand; only the largest few get opaque white. In <b>ink with markers</b>: dark water laid first, then bars of white gel pen, bigger near the bottom.',
    build(host) {
      host.innerHTML = tkLoad('A sea at dusk with a glittering path of short bright bars under the sun on the horizon') +
        hbSlider('hbSRough', 'Rough water', 0, 100, 1, 50, '') + hbSlider('hbSAmt', 'Marks', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxSparkles(cv, { rough: tkValue(host, 'hbSRough') / 100, amount: tkValue(host, 'hbSAmt') / 100 });
        read.textContent = `${r.marks} marks: ${r.big} big, ${r.fine} fine, ${r.near} in the nearer half. The path is about ${Math.round(r.width)} px at its widest.` + (r.big < 3 ? ' Almost no big ones: the water is too calm for bold bars; use fine ones only.' : '');
      };
      hbOn(host, 'hbSRough', draw); hbOn(host, 'hbSAmt', draw);
      draw();
    },
    tryThis: ['Calm the water all the way down: how wide is the path now, and what happens to the big bars?',
      'Raise the marks to the top. Which would you keep if you were to cut it by a half?',
      'Look at where the biggest bars are. What does that tell the eye about distance?'],
    see: 'A narrow road for calm water and a wide scatter for rough, brightest on the line to the sun. The marks grow toward the viewer and thin out toward the horizon - without that they look like a sprinkle on a flat plane. A few big ones plus many small is the whole trick; all the same size is a pattern, not water.' },

  { id: 'rain', group: LX_GROUP, title: 'Rain',
    theory: 'Rain is <b>streaks that lean the way the wind leans</b>, all at nearly the same angle, with distance doing the rest: near drops are long, bold and bright, far ones short, thin and pale, melting into the grey of the air. Never paint it everywhere; rain falls in sheets, with gaps. In <b>watercolour</b> paint the wet, dull scene first (a grey wash, soft edges, nothing sharp), then lift the near streaks with a damp stiff brush or scratch them with a blade, and add a few pale lines with a rigger for the far ones. In <b>ink with markers</b> fine liner or white gel pen strokes on a mid-grey Copic ground, near ones longer and with more pressure.',
    build(host) {
      host.innerHTML = tkLoad('A grey street with buildings in the haze and diagonal streaks of rain') +
        hbSlider('hbNAmt', 'Heaviness', 0, 100, 1, 50, '') + hbSlider('hbNWind', 'Wind', 0, 100, 1, 30, '') + hbSlider('hbNLen', 'Streak length', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxRain(cv, { amount: tkValue(host, 'hbNAmt') / 100, wind: tkValue(host, 'hbNWind') / 100, length: tkValue(host, 'hbNLen') / 100 });
        read.textContent = `${r.streaks} streaks, ${r.near} near and ${r.far} far, leaning ${Math.abs(Math.round(r.slant))} degrees ${r.slant > 3 ? 'to the right' : r.slant < -3 ? 'to the left' : '(straight down)'}. The longest is about ${Math.round(r.long)} px.`;
      };
      for (const id of ['hbNAmt', 'hbNWind', 'hbNLen']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Set the wind to the middle and then to either end. What else in the picture would have to lean too (umbrellas, hair, flags)?',
      'Count the near and far streaks: which would you paint first, and which last?',
      'Raise the heaviness to the top. At what number does it stop being rain and become a curtain?'],
    see: 'All the streaks lean at the same angle - one wind. Near ones are long, bright and few; far ones short, pale and many. More rain adds the far ones first and the picture goes greyer, because a downpour hides the distance. A few streaks, in the right directions, say more than hundreds in all of them.' },

  { id: 'snow', group: LX_GROUP, title: 'Snow',
    theory: 'Falling snow has <b>three depths</b>: a few big flakes close to you, <b>out of focus</b> and soft-edged; a middle layer, mostly sharp; and a lot of small crisp dots far off. Any of them put down evenly looks like a pattern, so vary the size and leave gaps. In <b>watercolour</b> the flakes are the paper: mask them with fluid before the sky wash, or lift soft ones with a damp brush after, and use opaque white (gouache) for the sharp ones over dark. Snow lies in the same light as everything: blue shadows, warm lights if the sun is low. In <b>ink with markers</b> use the white gel pen with a dot, press for the larger ones and soften them with a light marker blended round the edge.',
    build(host) {
      host.innerHTML = tkLoad('A dusk sky of blue with falling snow, big soft flakes in front and fine sharp ones behind') +
        hbSlider('hbWAmt', 'Heaviness', 0, 100, 1, 50, '') + hbSlider('hbWBlur', 'Soft near flakes', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxSnow(cv, { amount: tkValue(host, 'hbWAmt') / 100, blur: tkValue(host, 'hbWBlur') / 100 });
        read.textContent = `${r.flakes} flakes: ${r.near} near and soft, ${r.mid} middle, ${r.far} far and small. The biggest is about ${Math.round(r.widest)} px across.`;
      };
      hbOn(host, 'hbWAmt', draw); hbOn(host, 'hbWBlur', draw);
      draw();
    },
    tryThis: ['Take the softness to zero: what does the scene lose?',
      'Raise the heaviness. Which of the three layers grows the most?',
      'Where would you put only the near flakes, if you want a feeling of closeness?'],
    see: 'Big soft flakes up close, small sharp ones far away: the blur does the depth, as in a photograph with a shallow focus. More snow adds mostly small flakes. Without the soft near ones the snow lies flat on the picture like confetti.' },

  { id: 'street', group: LX_GROUP, title: 'Wet street and neon',
    theory: 'A wet road is a <b>dim, stretched mirror</b>. Each light is repeated straight below itself, <b>longer than the thing itself</b> (you see the road at a low angle), <b>darker than the light</b> by what the road swallows, and broken into streaks by the ripples. The glow round a sign gets brighter on a wet night because the air is damp. In <b>watercolour</b> paint the dark first with wet-in-wet blues and purples, keep the paper bare for the signs and the cores of the reflections, and drag a damp brush downward through the colour for the stretch; add the colour of each sign into its reflection while it is still wet so it bleeds. In <b>ink with markers</b> a lighter Copic of the same hue, in vertical strokes, and a few horizontal breaks.',
    build(host) {
      host.innerHTML = tkLoad('A night street with three neon signs, pink, blue and orange, and their stretched reflections in the wet road') +
        hbSlider('hbTWet', 'Wet road', 0, 100, 1, 70, '') + hbSlider('hbTRip', 'Ripples', 0, 100, 1, 40, '') + hbSlider('hbTGlow', 'Glow in the air', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxStreet(cv, { wet: tkValue(host, 'hbTWet') / 100, ripple: tkValue(host, 'hbTRip') / 100, glow: tkValue(host, 'hbTGlow') / 100 });
        read.textContent = `The reflection gives back ${Math.round(r.keeps * 100)}% of the sign and is ${r.stretch} times as long as the sign is high above the road. At the top of the first sign the reflection is ${Math.round(r.mirror / Math.max(1, r.source) * 100)}% as bright as the sign.` + (r.keeps < 0.05 ? ' A dry road: no reflection at all.' : '');
      };
      for (const id of ['hbTWet', 'hbTRip', 'hbTGlow']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Dry the road completely. What is left under the signs?',
      'Wet it to the top: is the reflection ever as bright as the sign?',
      'Add ripples. Do the reflections widen or break, and which looks more like rain-wet asphalt?'],
    see: 'The reflection sits under its sign, darker and longer, fading with distance down the road, and ripples break it into wavy bars. It is never as bright as the source. A dry road has none; a very wet one gives a clear but still dimmer copy. Glow in the air softens the signs without changing what the road does.' },

  { id: 'fog', group: LX_GROUP, title: 'Fog and mist',
    theory: 'Fog is not a grey you paint over things, it is <b>distance made thick</b>: every layer between you and the thing takes some of its colour and gives it the colour of the air. So each ridge behind the last is <b>lighter, bluer and softer</b>, with less contrast against the sky, until the farthest is nearly the sky itself. Mist lying in a valley is the same, thickest at the bottom. In <b>watercolour</b> paint the farthest layer first and palest, let it dry, then each nearer one a step darker, softening the top edge of the far ones with a damp brush; leave the paper bare for the brightest mist, or lift it with a tissue. In <b>ink with markers</b> use one light grey-blue marker for the farthest layer and a darker one for each step nearer, and blend the mist at the foot with a colourless blender or a white pastel pencil.',
    build(host) {
      host.innerHTML = tkLoad('Five ridges of dark trees one behind another in morning fog, the nearest nearly black and the farthest almost lost in the pale sky') +
        hbSlider('hbFDen', 'Thickness of the fog', 0, 100, 1, 50, '') + hbSlider('hbFMist', 'Mist in the valley', 0, 100, 1, 40, '') + hbSlider('hbFLay', 'Layers', 2, 7, 1, 5, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxFog(cv, { density: tkValue(host, 'hbFDen') / 100, mist: tkValue(host, 'hbFMist') / 100, layers: tkValue(host, 'hbFLay') });
        read.textContent = `${r.layers} layers. The nearest keeps ${Math.round(r.near)} of 255 against the sky, the farthest ${Math.round(r.far)}; the farthest has ${Math.round(r.veil[r.layers - 1] * 100)}% of its colour taken by the air.` + (r.gone ? ` ${r.gone === 1 ? 'One layer is' : r.gone + ' layers are'} lost in the fog: do not paint ${r.gone === 1 ? 'it' : 'them'}.` : '');
      };
      for (const id of ['hbFDen', 'hbFMist', 'hbFLay']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Thicken the fog. Which layer disappears first, the near or the far?',
      'Add layers without changing the fog. Do the steps between them stay even?',
      'Raise the mist in the valley: what happens to the lowest part of the nearest ridge?'],
    see: 'The values step evenly toward the sky: near dark, far pale, none darker than the one in front. Thicker fog loses the far layers first and squeezes all that is left toward the sky\'s value. Mist at the foot lightens whatever is lowest. Fog is a value change before it is a colour change.' },

  { id: 'rainbow', group: LX_GROUP, title: 'A rainbow',
    theory: 'A rainbow is a <b>circle round the point opposite the sun</b>, of which you see the upper part. It is always the same size: red on the <b>outside</b>, violet inside, about <b>42 degrees</b> from that point. A fainter twin sits outside it at 51 degrees with the colours <b>reversed</b>, and the sky between the two is <b>darker</b> than the sky inside the bow or outside the twin. It is a band of light, not seven stripes: the colours run into each other. In <b>watercolour</b> keep the bow as bare paper under a grey storm sky, or lift it with a damp brush, then glaze it with very thin transparent colours wet-in-wet, yellow and blue meeting in a green rather than a stripe; paint the dark band between the two last. In <b>ink with markers</b> use light markers in a very pale tone over the grey ground, and blend the colours where they meet with a colourless blender.',
    build(host) {
      host.innerHTML = tkLoad('A rainbow over a dark field under a storm sky, the sky inside the bow lighter and a fainter second bow outside it') +
        hbSlider('hbBStr', 'Strength', 0, 100, 1, 60, '') + hbSlider('hbBWid', 'Width of the colours', 0, 100, 1, 50, '') + hbSlider('hbBTwin', 'Second bow', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxRainbow(cv, { strength: tkValue(host, 'hbBStr') / 100, width: tkValue(host, 'hbBWid') / 100, twin: tkValue(host, 'hbBTwin') / 100 });
        read.textContent = `${r.bands} colours across ${Math.round(r.across)} px, red outside. ` + (r.second ? `A second bow outside with ${r.secondOuter} on the outer edge. The sky between the two is ${Math.round(r.inside - r.between)} of 255 darker than inside the bow.` : 'No second bow.');
      };
      for (const id of ['hbBStr', 'hbBWid', 'hbBTwin']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Lower the strength until the bow is nearly gone: what makes it still readable, the colours or the light and dark of the sky?',
      'Widen the colours. Where do they begin to look like stripes?',
      'Take the second bow away and back. Which order do its colours run in?'],
    see: 'The sky inside the bow is lighter and the band between the two is darker; with those two values alone the bow is read even in grey. The colours blend, red outermost; the twin is fainter and runs the other way. A bow that is as bright as it is wide looks pasted on.' },

  { id: 'lightning', group: LX_GROUP, title: 'Lightning',
    theory: 'A bolt is the brightest thing in the picture and should be the <b>only bare paper</b> in it. It is <b>crooked, not zigzag</b>: it turns often and by different amounts, with a few <b>forks</b> that thin out and run mostly downward, and no branch is as bold as the trunk. Its light scatters in the cloud and air, so there is a <b>glow</b> round it that falls off fast. In <b>watercolour</b> paint the cloudy sky dark and wet-in-wet, darker round where the bolt will be, and keep the line as bare paper, scratched with a blade or lifted, or put it in with white gouache over the dry dark, thin, with a rigger; lift a soft halo on one side of it. In <b>ink with markers</b> lay a dark sky and draw the bolt with a white gel pen, then dab a light blue marker round it for the glow.',
    build(host) {
      host.innerHTML = tkLoad('A bolt of lightning from a dark cloud to the ground with two thin forks and a pale blue glow round it') +
        hbSlider('hbLForks', 'Forks', 0, 5, 1, 2, '') + hbSlider('hbLGlow', 'Glow', 0, 100, 1, 60, '') + hbSlider('hbLJag', 'Crookedness', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxLightning(cv, { forks: tkValue(host, 'hbLForks'), glow: tkValue(host, 'hbLGlow') / 100, jag: tkValue(host, 'hbLJag') / 100 });
        read.textContent = `${r.forks === 0 ? 'No forks' : r.forks + (r.forks === 1 ? ' fork' : ' forks')}. The bolt is ${Math.round((r.crooked - 1) * 100)}% longer than a straight line between its ends. Beside it the sky is ${Math.round(r.beside)} of 255, far from it ${Math.round(r.away)}; the core is ${Math.round(r.core)}.`;
      };
      for (const id of ['hbLForks', 'hbLGlow', 'hbLJag']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Take the glow to nothing. What does the bolt look like on the dark, and what is missing?',
      'Give it five forks. At what number does it start to look like a tree?',
      'Straighten the bolt all the way. Why does a straight one look wrong?'],
    see: 'The core is the lightest thing and the sky next to it a little lighter than the sky far off; the glow drops away quickly, so the bolt is sharp. Fewer forks than you think, thinner than the trunk and mostly running down. More crookedness lengthens the path, never the distance it covers.' },

  { id: 'fireflies', group: LX_GROUP, title: 'Fireflies',
    theory: 'Fireflies are <b>points of light with a small glow</b>, and the picture is read by the dark they are set in. Near ones are bigger and softer, far ones are tiny and sharp; none is evenly spaced and most are scattered in clumps with gaps. The glow is a yellow-green that reaches only a little way. In <b>watercolour</b> paint the night wet-in-wet in deep blue-greens, keep the points as bare paper by masking fluid, or put them in with gouache once dry, and add a thin halo of pale yellow-green around the larger. In <b>ink with markers</b> use dark blue-green markers for the night, a white gel pen for the dots, and a light yellow-green marker dabbed once round the nearest.',
    build(host) {
      host.innerHTML = tkLoad('A dark summer meadow at night with small yellow-green lights floating in the air, the nearest large and soft, the far ones tiny') +
        hbSlider('hbIAmt', 'How many', 0, 100, 1, 50, '') + hbSlider('hbIGlow', 'Glow', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxFireflies(cv, { amount: tkValue(host, 'hbIAmt') / 100, glow: tkValue(host, 'hbIGlow') / 100 });
        read.textContent = `${r.count} lights: ${r.near} near and soft, ${r.far} far and small. The biggest glow is about ${Math.round(r.biggest)} px across.` + (r.count > 45 ? ' So many read as a snowfall of light: take out half.' : '');
      };
      hbOn(host, 'hbIAmt', draw); hbOn(host, 'hbIGlow', draw);
      draw();
    },
    tryThis: ['Raise the number to the top. Where does it stop looking like fireflies?',
      'Take the glow to zero: are they still lights, or only dots?',
      'Which would you paint first, the night or the lights?'],
    see: 'A dark field with few lights, uneven, the near ones large and soft and the far ones fine. More lights add mostly far ones. The glow is what makes them light and not paint: without it they are dots. The night must stay dark for them to read.' },

  { id: 'deep', group: LX_GROUP, title: 'Sunbeams under water',
    theory: 'Water takes colour out of light as it goes down, <b>red first, then green, blue deepest</b>: near the surface it is a turquoise, at depth a dark blue and then nearly black. Beams from the surface come in at a slant, <b>fade with depth</b> as the colours do, and are brightest near the top. Clear water carries them farther; cloudy water loses them within a short way. In <b>watercolour</b> start at the top with a pale warm turquoise and go down in wet-in-wet blues, adding a little ultramarine and then indigo; <b>lift</b> the beams with a damp flat brush while it is still a little wet, longest in clear water. In <b>ink with markers</b> use light turquoise at the top and darker blues down, then white gel pen lines for the beams, thin near the bottom, with a blender over to soften them.',
    build(host) {
      host.innerHTML = tkLoad('Under the sea, turquoise at the top and dark blue below, with slanting pale beams of sunlight fading as they go down') +
        hbSlider('hbDDep', 'Depth', 0, 100, 1, 50, '') + hbSlider('hbDRays', 'Beams', 0, 100, 1, 50, '') + hbSlider('hbDClear', 'Clear water', 0, 100, 1, 50, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = lxDeep(cv, { depth: tkValue(host, 'hbDDep') / 100, rays: tkValue(host, 'hbDRays') / 100, clear: tkValue(host, 'hbDClear') / 100 });
        read.textContent = `${r.beams} beams, reaching ${Math.round(r.reach * 100)}% of the way down. At the bottom the water keeps ${Math.round(r.keptRed * 100)}% of its red and ${Math.round(r.keptBlue * 100)}% of its blue.`;
      };
      for (const id of ['hbDDep', 'hbDRays', 'hbDClear']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Go deeper. Which colour is gone first, and which is left?',
      'Make the water cloudy. How far down do the beams reach now?',
      'Put in as many beams as you can: when does the water stop looking deep?'],
    see: 'Warm light out at the top, then green, then blue, then dark - the red gone long before the blue. Clear water gives longer beams; cloudy shorter ones. The beams are slanted, all the same way, fading as they go down. A few, uneven, look like water; many look like a fan.' }
);
