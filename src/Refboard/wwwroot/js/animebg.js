/* refboard - Anime backgrounds: the sky and the land under it, in the manner of two ways anime
   backgrounds are painted, with the palette of each and how to mix it from your own paints.

   Two manners, both my own reading of a style and not colours taken from any film:
     soft      painted in gouache or watercolour: a quiet sky, white cumulus with blue-grey
               undersides, deep teal-green foliage, warm earth; the colour a little muted and
               the values close together, so the picture breathes;
     luminous  a high, clear sky - a deep blue graded to a pale warm horizon - clouds with a
               bright rim, shadows turned to blue-violet and saturated, and one light accent;
               the colour strong and the values far apart.
   Five hours or weathers: day, golden hour, dusk, night, rain.

   A palette is nine colours with a job each, the ninth a light accent: the top of the sky, its horizon, a cloud's lit side
   and its shade, the far hills, foliage in light and in shade, and the ground. Each is set in OKLCH
   (lightness, chroma, hue) for the hour, then moved by the manner: luminous raises the chroma,
   deepens the top of the sky and turns every shade toward blue-violet; soft takes the chroma down
   a little and brings the values closer. The picture is painted from those nine colours - the
   sky as a gradient, clouds as overlapping rounds in three flat layers, hills and trees as
   flat shapes that fade toward the horizon colour with distance (aerial perspective) - so it shows
   the palette at work, in the same flat way an anime background is blocked in. A diagram, not a
   painting.
   Loaded with the section (loadSection('anime')). */
"use strict";

const AB_KEY = 'refboard.animebg.v1';
const AB_W = 960, AB_H = 540;

// [L, C, h] for each role at each hour. h in degrees of OKLCH.
const AB_HOURS = {
  day: { label: 'Day',
    sky: [0.64, 0.15, 245], horizon: [0.90, 0.05, 220], cloud: [0.985, 0.012, 95], shade: [0.76, 0.05, 262],
    far: [0.74, 0.06, 240], leaf: [0.72, 0.17, 135], leafShade: [0.43, 0.10, 175], ground: [0.67, 0.09, 75] },
  golden: { label: 'Golden hour',
    sky: [0.55, 0.12, 255], horizon: [0.88, 0.13, 70], cloud: [0.94, 0.08, 70], shade: [0.58, 0.09, 320],
    far: [0.58, 0.08, 320], leaf: [0.70, 0.13, 125], leafShade: [0.36, 0.08, 200], ground: [0.60, 0.11, 55] },
  dusk: { label: 'Dusk',
    sky: [0.28, 0.09, 280], horizon: [0.75, 0.17, 40], cloud: [0.78, 0.14, 25], shade: [0.40, 0.09, 310],
    far: [0.36, 0.07, 300], leaf: [0.46, 0.08, 150], leafShade: [0.22, 0.05, 270], ground: [0.40, 0.06, 30] },
  night: { label: 'Night',
    sky: [0.16, 0.05, 265], horizon: [0.40, 0.08, 250], cloud: [0.50, 0.05, 260], shade: [0.24, 0.04, 270],
    far: [0.27, 0.05, 265], leaf: [0.34, 0.06, 200], leafShade: [0.17, 0.04, 265], ground: [0.28, 0.04, 250] },
  rain: { label: 'Rain',
    sky: [0.55, 0.03, 250], horizon: [0.80, 0.02, 230], cloud: [0.84, 0.012, 240], shade: [0.55, 0.03, 255],
    far: [0.63, 0.03, 225], leaf: [0.55, 0.09, 155], leafShade: [0.34, 0.06, 190], ground: [0.50, 0.03, 240] },
};
/* How each manner moves a role: chroma and lightness multipliers/offsets on every colour, and then
   the extras: how far shades turn toward blue-violet and the light accent (the lamp, the sun's last
   spot, a window) each hour gets. */
const AB_MANNERS = {
  soft: { label: 'Soft, painted', about: 'Gouache and watercolour: the colour a little muted, the values close, a quiet sky.',
    chroma: 0.88, lift: 0.0, squeeze: 0.12, shadeTurn: 8, skyDeepen: 0.0 },
  luminous: { label: 'Luminous, high-key', about: 'A clear, deep sky, bright rims, strong colour, shadows turned blue-violet.',
    chroma: 1.3, lift: 0.0, squeeze: -0.1, shadeTurn: 26, skyDeepen: 0.05 },
};
// The light accent of each hour: a small spot of the strongest light, in OKLCH.
const AB_ACCENT = { day: [0.97, 0.05, 95], golden: [0.9, 0.17, 80], dusk: [0.85, 0.15, 60], night: [0.88, 0.14, 88], rain: [0.88, 0.1, 85] };
const AB_ROLES = [
  ['sky', 'Top of the sky'], ['horizon', 'Horizon'], ['cloud', 'Cloud, lit side'], ['shade', 'Cloud, shade'],
  ['far', 'Far hills'], ['leaf', 'Foliage, lit'], ['leafShade', 'Foliage, shade'], ['ground', 'Ground'], ['accent', 'Light accent'],
];

function abLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(AB_KEY));
    if (v) return { manner: AB_MANNERS[v.manner] ? v.manner : 'soft', hour: AB_HOURS[v.hour] ? v.hour : 'day', seed: Number.isInteger(v.seed) ? v.seed : 1 };
  } catch { /* fall through */ }
  return { manner: 'soft', hour: 'day', seed: 1 };
}
function abSave(s) {
  try { localStorage.setItem(AB_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

/* The nine colours of a manner at an hour: [{ role, label, rgb }]. Lightness is squeezed toward the
   middle (or pushed away from it, for a negative squeeze) before the chroma is multiplied; shades are
   turned toward blue-violet by shadeTurn degrees at most. */
function abPalette(manner, hour) {
  const m = AB_MANNERS[manner], t = AB_HOURS[hour];
  const turn = (h, deg) => {
    const d = ((285 - h + 540) % 360) - 180;
    return (h + Math.max(-deg, Math.min(deg, d)) + 360) % 360;
  };
  return AB_ROLES.map(([role, label]) => {
    let [L, C, h] = role === 'accent' ? AB_ACCENT[hour] : t[role];
    if (role !== 'accent') {
      L = L + (0.55 - L) * m.squeeze + m.lift;
      if (role === 'sky') L -= m.skyDeepen;
      if (role === 'shade' || role === 'leafShade') h = turn(h, m.shadeTurn);
      // The sky and the clouds take the manner's whole chroma; the land only part of it, or the leaves go acid.
      C *= ['foliage', 'leaf', 'leafShade', 'ground', 'far'].includes(role) ? 1 + (m.chroma - 1) * 0.35 : m.chroma;
    } else C *= m.chroma;
    return { role, label, rgb: lchRgb(Math.max(0.04, Math.min(0.99, L)), C, h) };
  });
}

const abMix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/* The picture of a palette, on `c` (AB_W x AB_H): a seeded arrangement of clouds and land. */
function abDraw(c, palette, hour, seed) {
  c.width = AB_W; c.height = AB_H;
  const g = c.getContext('2d'), P = Object.fromEntries(palette.map(p => [p.role, p.rgb]));
  const rnd = simplifyRandom(seed * 7919 + 13);
  const css = rgbCss, horizon = AB_H * 0.62;
  // The sky: top to horizon, in more steps than the eye counts, so it reads as one graded wash.
  const grad = g.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, css(P.sky)); grad.addColorStop(0.55, css(abMix(P.sky, P.horizon, 0.55))); grad.addColorStop(1, css(P.horizon));
  g.fillStyle = grad; g.fillRect(0, 0, AB_W, AB_H);
  // The light: a wide soft glow near the horizon for the hours that have a sun at it.
  if (hour === 'golden' || hour === 'dusk') {
    const gx = AB_W * (0.3 + 0.4 * rnd()), glow = g.createRadialGradient(gx, horizon, 4, gx, horizon, AB_W * 0.5);
    glow.addColorStop(0, `rgba(${P.accent.join(',')},0.75)`);
    glow.addColorStop(1, `rgba(${P.accent.join(',')},0)`);
    g.fillStyle = glow; g.fillRect(0, 0, AB_W, horizon);
  }
  if (hour === 'night') {
    g.fillStyle = css(P.accent);
    for (let i = 0; i < 70; i++) { g.globalAlpha = 0.35 + 0.65 * rnd(); g.fillRect(Math.floor(rnd() * AB_W), Math.floor(rnd() * horizon * 0.8), 2, 2); }
    g.globalAlpha = 1;
  }
  // A cloud: rounds in a row, painted three times - the shade, then the lit side lifted up and toward the light, then a rim.
  const cloud = (cx, cy, size) => {
    // A cumulus has a flat base: nothing is painted under the line, so the rounds sit on it.
    g.save(); g.beginPath(); g.rect(0, 0, AB_W, cy + size * 0.1); g.clip();
    const rounds = [];
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) rounds.push([cx + (i - n / 2) * size * 0.34 + (rnd() - 0.5) * size * 0.1, cy - Math.sin(i / (n - 1) * Math.PI) * size * 0.22 + (rnd() - 0.5) * size * 0.06, size * (0.18 + 0.12 * Math.sin(i / (n - 1) * Math.PI))]);
    const layer = (col, dy, grow) => {
      g.fillStyle = css(col);
      g.beginPath();
      for (const [x, y, r] of rounds) { g.moveTo(x + r * grow, y + dy); g.arc(x, y + dy, r * grow, 0, 7); }
      g.fill();
    };
    layer(P.shade, size * 0.05, 1);
    layer(abMix(P.shade, P.cloud, 0.45), -size * 0.02, 0.9);
    layer(P.cloud, -size * 0.06, 0.75);
    if (hour !== 'night') { g.globalAlpha = 0.75; layer(abMix(P.cloud, P.accent, 0.5), -size * 0.1, 0.5); g.globalAlpha = 1; }
    g.restore();
  };
  const count = hour === 'rain' ? 4 : hour === 'night' ? 3 : 5;
  for (let i = 0; i < count; i++) cloud(AB_W * (0.1 + 0.8 * rnd()), horizon * (0.3 + 0.5 * rnd()), 80 + 130 * (1 - i / count) * (0.5 + rnd() * 0.7));
  // Rain: slanted streaks.
  if (hour === 'rain') {
    g.strokeStyle = css(abMix(P.cloud, P.sky, 0.3)); g.globalAlpha = 0.35; g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < 260; i++) { const x = rnd() * AB_W, y = rnd() * AB_H; g.moveTo(x, y); g.lineTo(x - 7, y + 28); }
    g.stroke(); g.globalAlpha = 1;
  }
  // The land: three bands of hills, each nearer one darker and warmer, the farthest pulled toward the horizon colour.
  const ridge = (base, amp, col, seedShift) => {
    const r2 = simplifyRandom(seed * 31 + seedShift), ph = [r2() * 6, r2() * 6, r2() * 6];
    g.fillStyle = css(col); g.beginPath(); g.moveTo(0, AB_H);
    for (let x = 0; x <= AB_W; x += 8) g.lineTo(x, base - amp * (0.5 * Math.sin(x / 190 + ph[0]) + 0.3 * Math.sin(x / 83 + ph[1]) + 0.2 * Math.sin(x / 41 + ph[2])));
    g.lineTo(AB_W, AB_H); g.fill();
  };
  ridge(horizon + 6, 40, abMix(P.far, P.horizon, 0.5), 1);
  ridge(horizon + 40, 46, P.far, 2);
  ridge(horizon + 90, 38, abMix(P.leafShade, P.far, 0.35), 3);
  ridge(horizon + 140, 30, abMix(P.leaf, P.ground, 0.4), 4);
  // Trees on the near ground: a dark round with a lit cap, the light on the side of the sun.
  const side = rnd() < 0.5 ? -1 : 1;
  for (let i = 0; i < 9; i++) {
    const x = AB_W * (0.04 + 0.92 * (i + rnd() * 0.6) / 9), r = 34 + 40 * rnd(), y = horizon + 150 + 40 * rnd();
    g.fillStyle = css(P.leafShade); g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = css(P.leaf); g.beginPath(); g.arc(x + side * r * 0.22, y - r * 0.2, r * 0.7, 0, 7); g.fill();
    if (hour === 'night') { g.fillStyle = css(P.accent); if (rnd() < 0.4) g.fillRect(x - 3, y + r * 0.3, 6, 7); }
  }
  g.fillStyle = css(P.ground); g.fillRect(0, AB_H - 52, AB_W, 52);
  return c;
}

// How to paint it: the manner's rules of thumb, then the hour's.
function abAdvice(manner, hour) {
  const out = [];
  out.push({
    soft: 'Soft: block the sky as one graded wash, then lift the cloud tops with a damp brush or tissue so they stay soft; keep the values of the land close to each other, and let the greens be a mix of a yellow and a blue, not one tube.',
    luminous: 'Luminous: grade the sky strongly - the deep colour at the top, almost clear at the horizon - and leave the rim of each cloud as bare paper; put the shadows in a saturated blue-violet, and add the one light accent last, in gouache or a white gel pen.',
  }[manner]);
  out.push({
    day: 'Day: the horizon is the lightest part of the sky; the far hills go cooler and paler with distance.',
    golden: 'Golden hour: warm at the horizon, cool above, and shadows blue-violet against the warm light - the colour contrast carries it.',
    dusk: 'Dusk: dark above, a band of warm light at the horizon; cloud undersides darker than the sky behind them, their rims the last light.',
    night: 'Night: keep the values tight and dark; one warm light (a window, a lamp) is the whole accent - save it for the end.',
    rain: 'Rain: almost no chroma in the sky; a grey wash wet-in-wet, the colour kept in the foliage, and the streaks scraped or painted after the land is dry.',
  }[hour]);
  return out;
}
