/* refboard - Four more things for drawing anime, as plain data and pictures (the view is js/animemoreui.js):

   Inking. A drawing or a photo read for where the line should be heavy and where light: heavy on the
   outline against the paper and on the side away from the light, light inside. A map of three weights,
   with the pens to use for each (fineliner, ink with a nib or brush, ballpoint).
   Folds. Six kinds of fold in cloth - pipe, zigzag, spiral, half-lock, diaper, drop - each drawn on a
   piece of cloth, and where each comes from (a bent elbow, a sitting skirt, a hand pulling).
   Layers. The order of the layers for skin, hair, eyes and cloth in watercolour, watercolour pencils,
   Copic markers and ink: which tone goes down when, what stays bare, and - with the background's colour -
   the reflected light the surroundings throw into the shadow.
   Angles. A head and a figure seen from below, level and above, tilted or not: the curves the features lie
   on, what the forehead, the nose and the chin do, and how the legs and the head change in size.

   Everything is worked out here as data; the pictures are SVG strings or canvases. Loaded with the
   section (loadSection('anime')) after js/animedraw.js, whose colour and SVG helpers it uses. */
"use strict";

/* ---- inking */

const AM_INK_SIDE = 560;       // the long side a drawing is read at
const AM_INK_LIGHTS = { ul: 'Upper left', ur: 'Upper right', top: 'Above' };
const AM_INK_SHADES = ['', '#a2a8bd', '#4c5170', '#14141c'];   // the colour of weight 1, 2 and 3 on the map

/* gray: w*h values 0..255. light: the way to the light, x right and y down (so up is negative).
   Edges are found with Sobel; each edge pixel starts at weight 1, gains one for lying against the plain paper
   around the figure (the outline), and one for being on the side away from the light: an outline whose paper side
   faces away from it, or - inside the figure - a strong edge whose dark side does. Returns { weights, counts: [0, n1, n2, n3], paper } - paper is the share of the
   picture that is plain background. */
function amInkWeights(gray, w, h, light = [-0.62, -0.78]) {
  const n = w * h, gx = new Float32Array(n), gy = new Float32Array(n), mag = new Float32Array(n);
  let peak = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const a = gray[i - w - 1], b = gray[i - w], c = gray[i - w + 1], d = gray[i - 1], f = gray[i + 1], g = gray[i + w - 1], m = gray[i + w], k = gray[i + w + 1];
    const sx = (c + 2 * f + k) - (a + 2 * d + g), sy = (g + 2 * m + k) - (a + 2 * b + c);
    gx[i] = sx; gy[i] = sy; mag[i] = Math.hypot(sx, sy);
    if (mag[i] > peak) peak = mag[i];
  }
  const T = Math.max(60, peak * 0.14);
  // The paper: what can be reached from the border over pixels about as light as the border's middle value.
  const border = [];
  for (let x = 0; x < w; x++) border.push(gray[x], gray[(h - 1) * w + x]);
  for (let y = 0; y < h; y++) border.push(gray[y * w], gray[y * w + w - 1]);
  border.sort((p, q) => p - q);
  const mid = border[border.length >> 1], paper = new Uint8Array(n), stack = [];
  const seed = i => { if (!paper[i] && Math.abs(gray[i] - mid) < 24) { paper[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
  }
  let paperN = 0;
  for (let i = 0; i < n; i++) paperN += paper[i];
  const nearPaper = i => {
    const x = i % w, y = (i - x) / w;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h && paper[yy * w + xx]) return true;
    }
    return false;
  };
  const weights = new Uint8Array(n), counts = [0, 0, 0, 0];
  const paperAt = (x, y) => x >= 0 && x < w && y >= 0 && y < h && paper[y * w + x] === 1;
  for (let i = 0; i < n; i++) {
    if (mag[i] < T) continue;
    const x = i % w, y = (i - x) / w, nx = gx[i] / mag[i], ny = gy[i] / mag[i];
    let q = 1, away = false;
    if (paperN && nearPaper(i)) {
      // On the outline: it is heavy, and heavier still where the paper lies away from the light - the outline of the shadow side.
      q++;
      const s = paperAt(Math.round(x + 4 * nx), Math.round(y + 4 * ny)) ? 1 : paperAt(Math.round(x - 4 * nx), Math.round(y - 4 * ny)) ? -1 : 0;
      away = s !== 0 && s * (nx * light[0] + ny * light[1]) < -0.35;
    } else {
      // Inside: heavier where the dark side of a strong edge is turned from the light.
      away = (-nx * light[0] - ny * light[1]) < -0.35 && mag[i] > T * 1.8;
    }
    if (away) q++;
    weights[i] = Math.min(3, q);
    counts[weights[i]]++;
  }
  return { weights, counts, paper: paperN / n, w, h };
}

// The map as a canvas: white, the three weights in three shades, the heaviest a pixel wider.
function amInkCanvas(res) {
  const cv = Object.assign(document.createElement('canvas'), { width: res.w, height: res.h }), g = cv.getContext('2d');
  const img = g.createImageData(res.w, res.h), d = img.data;
  d.fill(255);
  const paint = (i, q) => { d[i * 4] = parseInt(AM_INK_SHADES[q].slice(1, 3), 16); d[i * 4 + 1] = parseInt(AM_INK_SHADES[q].slice(3, 5), 16); d[i * 4 + 2] = parseInt(AM_INK_SHADES[q].slice(5, 7), 16); };
  for (const q of [1, 2, 3]) for (let i = 0; i < res.weights.length; i++) if (res.weights[i] === q) {
    paint(i, q);
    if (q === 3) for (const j of [i - 1, i + 1, i - res.w, i + res.w]) if (j >= 0 && j < res.weights.length && !res.weights[j]) paint(j, 3);
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// A picture canvas as grey values, at AM_INK_SIDE on its long side.
function amInkRead(canvas) {
  const k = Math.min(1, AM_INK_SIDE / Math.max(canvas.width, canvas.height));
  const w = Math.max(3, Math.round(canvas.width * k)), h = Math.max(3, Math.round(canvas.height * k));
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  return { gray, w, h };
}

const AM_PENS = {
  liner: { label: 'Fineliner', rows: [
    ['Thin', '0.1 - 0.2 mm', 'lines inside the shape: the face, folds, strands of hair, stitching'],
    ['Medium', '0.3 - 0.4 mm', 'the outline where it is lit, the edges of the clothes'],
    ['Thick', '0.5 - 0.8 mm', 'the outline against the paper on the shadow side, under the chin, the ground line']] },
  ink: { label: 'Ink, nib or brush', rows: [
    ['Thin', 'the tip, light pressure', 'a nib held upright and drawn lightly; a size 0 brush on its point'],
    ['Medium', 'half pressure', 'the lit outline: the nib pressed a little so the tines open'],
    ['Thick', 'full pressure, or go over', 'the shadow side: press, or draw the line a second time beside the first and fill the gap']] },
  ballpoint: { label: 'Ballpoint', rows: [
    ['Thin', 'one light pass', 'a ballpoint cannot change its width: keep the pressure light and fast'],
    ['Medium', 'two passes', 'the same line gone over once, a little firmer'],
    ['Thick', 'three passes, or hatch', 'go over the line again and again on the shadow side, or add a few hatch lines beside it']] },
};

function amInkNote(res) {
  const total = res.counts[1] + res.counts[2] + res.counts[3] || 1, pc = q => Math.round(res.counts[q] / total * 100);
  const out = [`Of the lines found, ${pc(3)}% should be heavy, ${pc(2)}% medium and ${pc(1)}% thin.`];
  if (pc(3) > 40) out.push('That is a lot of heavy line: the picture is mostly outline against the paper, so keep the heavy line for the shadow side and the ground, and let the rest be medium.');
  else if (pc(3) < 8) out.push('Little is heavy: the lines do not meet the paper or the shadow, so the picture reads flat - thicken the underside of the forms.');
  else out.push('A good spread: the heavy line is a minority, so it reads as weight and not as an outline.');
  out.push(res.paper > 0.1
    ? `The paper around the figure was found (${Math.round(res.paper * 100)}% of the picture), so the outline is told from the lines inside.`
    : 'No plain paper was found round the figure, so only the shadow side makes a line heavy; a photo with a busy background does that.');
  return out;
}

/* ---- folds */

const AM_FOLDS = {
  pipe: { label: 'Pipe', about: 'Cloth hanging from a gathered point falls in rounded tubes, like organ pipes - each one wider at the hem. A loose sleeve, a long skirt, a curtain.',
    words: 'loose sleeves, hanging cloth folds' },
  zigzag: { label: 'Zigzag', about: 'Cloth pushed together along a limb, and folded back and forth on itself like a bellows. The inside of a bent elbow, a trouser leg at the ankle.',
    words: 'wrinkled sleeve, cloth folds at the elbow' },
  spiral: { label: 'Spiral', about: 'Cloth that wraps round a limb and twists: the folds run diagonally round it, the far half hidden. A tight sleeve on a turned forearm, a scarf, a wrapped leg.',
    words: 'twisted fabric, wrapped cloth' },
  halflock: { label: 'Half-lock', about: 'Where a limb bends, one fold shapes like a wedge: the cloth stacks up on the inside of the bend and stays smooth on the outside. A bent knee, a lifted elbow.',
    words: 'cloth creased at the knee' },
  diaper: { label: 'Diaper', about: 'Cloth held at two points sags between them: the folds fan out from each point and meet in the middle in a hanging curve. A skirt over two knees, a cape on the shoulders.',
    words: 'cloth stretched between knees, draped fabric' },
  drop: { label: 'Drop', about: 'Cloth held at one point and left to fall: the folds radiate from the point and spread into a bell. A cloth lifted by a hand, a skirt held at the hip, a flag on a pole.',
    words: 'cloth held up in the hand, bell-shaped drape' },
};
const AM_FOLD_SPOTS = {
  hang: { label: 'Standing, arms down', types: ['pipe', 'drop'], says: 'Loose sleeves and a skirt hang from the shoulder and the waist: pipe folds where the cloth is gathered, and a drop where one point pulls it, such as a pocket or a hand.' },
  elbow: { label: 'Arm bent', types: ['zigzag', 'halflock', 'spiral'], says: 'The inside of the elbow gathers: zigzag folds on a tight sleeve, a half-lock on a loose one. If the forearm is turned, a spiral runs down it.' },
  knee: { label: 'Leg bent', types: ['halflock', 'zigzag', 'diaper'], says: 'A half-lock at the front of the knee, zigzags below it where the cloth is pushed down the shin, and a diaper over the thigh if the cloth is long.' },
  sit: { label: 'Sitting in a skirt', types: ['diaper', 'pipe'], says: 'The skirt is held at both knees and sags between them: a diaper. The two sides hang from the knees in pipes.' },
  twist: { label: 'Twisting', types: ['spiral', 'halflock'], says: 'The waist or the forearm turns and the cloth follows: spirals round the turn, and a half-lock where the twist folds the cloth over itself.' },
  wind: { label: 'In the wind', types: ['pipe', 'spiral', 'drop'], says: 'Wind lifts the hem and stretches the pipes toward the wind; the end curls into a spiral, and a held corner is a drop that flies out sideways.' },
  hold: { label: 'A hand pulling it', types: ['drop', 'diaper'], says: 'One hand on cloth makes a drop; two hands make a diaper between them. The folds point at the hands.' },
};
AM_FOLD_SPOTS.all = { label: 'All six', types: Object.keys(AM_FOLDS), says: 'Every kind side by side. Pick a place above to see only the ones that form there.' };
const AM_FOLD_RULE = 'In anime, two to four fold lines are plenty: put each one where the cloth bends or is pulled, and leave the rest of the cloth smooth.';

const amF = n => Math.round(n * 10) / 10;

// One fold type drawn on a piece of cloth, in a box 160 wide and 200 tall. `lit` tints its background.
function amFoldSvg(key, lit = false) {
  const ink = AD_INK, cloth = '#eef0f8', shade = '#cfd3e6';
  let g = '';
  const line = (d, w = 1.6, extra = '') => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  if (key === 'pipe') {
    const tops = [50, 66, 82, 98, 114], hems = [30, 54, 78, 102, 126];
    g += `<path d="M40 22 H124 L${hems[4] + 14} 176 Q${(hems[4] + hems[0]) / 2} 190 ${hems[0] - 14} 176Z" fill="${cloth}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    for (let i = 0; i < 4; i++) g += `<path d="M${tops[i]} 22 Q${(tops[i] + hems[i]) / 2 + 4} 100 ${hems[i]} 180 L${hems[i + 1]} 180 Q${(tops[i + 1] + hems[i + 1]) / 2 + 4} 100 ${tops[i + 1]} 22Z" fill="${i % 2 ? 'none' : shade}" stroke="none"/>`;
    for (let i = 0; i < 5; i++) g += line(`M${tops[i]} 22 Q${(tops[i] + hems[i]) / 2 + 4} 100 ${hems[i]} 180`, 1.4);
    g += line('M26 176 Q52 192 78 178 Q104 192 138 176', 1.8);
  } else if (key === 'zigzag' || key === 'halflock') {
    // A sleeve bent at the elbow: the outside edge is one line, the inside edge is where the cloth gathers.
    g += `<path d="M58 14 L100 14 L100 88 L146 140 L112 168 L62 112 L58 112Z" fill="${cloth}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    g += line('M58 112 L112 168', 1.8);
    if (key === 'zigzag') {
      for (let t = 0; t < 5; t++) g += line(`M${100 - t * 2} ${78 + t * 7} L${70 + t * 3} ${86 + t * 8} L${96 - t * 2} ${92 + t * 7}`, 1.4);
      g += `<path d="M100 78 L72 90 L98 96 L74 106 L100 110 L116 128Z" fill="${shade}" opacity="0.7"/>`;
    } else {
      g += `<path d="M100 82 L70 98 L88 112 L112 128 L100 104Z" fill="${shade}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`;
      g += line('M100 82 L76 100', 1.4) + line('M64 110 L84 124', 1.2);
    }
    g += line('M58 14 H100', 2) + line('M112 168 L146 140', 2);
  } else if (key === 'spiral') {
    g += `<path d="M58 16 H102 V184 H58Z" fill="${cloth}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    for (let i = 0; i < 6; i++) {
      const y = 28 + i * 28;
      g += `<path d="M58 ${y} Q80 ${y + 22} 102 ${y - 4} L102 ${y + 12} Q80 ${y + 34} 58 ${y + 8}Z" fill="${shade}" opacity="0.65"/>`;
      g += line(`M58 ${y} Q80 ${y + 22} 102 ${y - 4}`, 1.5);
      g += line(`M58 ${y + 8} Q80 ${y - 10} 102 ${y + 12}`, 1, ' stroke-dasharray="3 3" opacity="0.5"');
    }
  } else if (key === 'diaper') {
    g += `<path d="M24 24 Q80 44 136 24 L128 100 Q80 196 32 100Z" fill="${cloth}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    for (let i = 0; i < 4; i++) {
      const yx = 52 + i * 18;
      g += `<path d="M24 24 Q${50 + i * 8} ${70 + i * 12} ${60 + i * 6} ${yx + 70 - i * 3} Q${40 + i * 6} ${yx + 28} 24 24Z" fill="${i % 2 ? shade : 'none'}" opacity="0.6"/>`;
      g += line(`M24 24 Q${48 + i * 9} ${60 + i * 14} ${58 + i * 6} ${116 + i * 4}`, 1.4);
      g += line(`M136 24 Q${112 - i * 9} ${60 + i * 14} ${102 - i * 6} ${116 + i * 4}`, 1.4);
    }
    g += `<circle cx="24" cy="24" r="5" fill="#fff" stroke="${ink}" stroke-width="1.6"/><circle cx="136" cy="24" r="5" fill="#fff" stroke="${ink}" stroke-width="1.6"/>`;
  } else {
    // drop: held at one point, falling in a bell
    g += `<path d="M80 26 Q48 100 30 176 Q50 192 62 178 Q80 194 98 178 Q110 192 130 176 Q112 100 80 26Z" fill="${cloth}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`;
    const feet = [34, 54, 80, 106, 126];
    for (let i = 0; i < feet.length; i++) {
      if (i % 2 === 0) g += `<path d="M80 28 Q${(80 + feet[i]) / 2 + (feet[i] < 80 ? -4 : 4)} 100 ${feet[i]} 178 L${feet[Math.min(i + 1, 4)] || 128} 178 Q80 100 80 28Z" fill="${shade}" opacity="0.55"/>`;
      g += line(`M80 28 Q${(80 + feet[i]) / 2 + (feet[i] < 80 ? -4 : feet[i] > 80 ? 4 : 0)} 100 ${feet[i]} 178`, 1.4);
    }
    g += `<circle cx="80" cy="24" r="6" fill="#fff" stroke="${ink}" stroke-width="1.8"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200" role="img" aria-label="${esc(AM_FOLDS[key].label)} fold"><rect width="160" height="200" fill="${lit ? '#fff7e0' : '#fff'}"/>${g}</svg>`;
}

/* The folds a spot makes, as one sheet: every type a spot gives, side by side, with its name. */
function amFoldSheetSvg(spot) {
  const S = AM_FOLD_SPOTS[spot] || AM_FOLD_SPOTS.hang;
  const w = 170 * S.types.length;
  const parts = S.types.map((k, i) => amFoldSvg(k, false).replace('<svg ', `<svg x="${i * 170 + 5}" y="0" `) +
    `<text x="${i * 170 + 85}" y="216" text-anchor="middle" font-size="14" font-weight="600" fill="#333" font-family="system-ui, sans-serif">${esc(AM_FOLDS[k].label)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 226" width="${w}" height="226" role="img" aria-label="Folds for: ${esc(S.label)}"><rect width="${w}" height="226" fill="#fff"/>${parts.join('')}</svg>`;
}

/* ---- layers */

const AM_MATERIALS = { water: 'Watercolour', pencil: 'Watercolour pencils', copic: 'Copic markers', ink: 'Ink' };
const AM_PARTS = { skin: 'Skin', hair: 'Hair', eyes: 'Eyes', cloth: 'Cloth' };
const AM_PART_DEFAULT = { skin: '#f1c9a5', hair: '#6b4a2f', eyes: '#3f7fb8', cloth: '#7a8fc4' };
const AM_PAPER = [245, 243, 236];

// The extra layer a part asks for, put in before the last one.
const AM_PART_EXTRA = {
  skin: { water: 'The blush: a thin warm pink on the cheeks and the tips of the ears, put in while the last layer is still damp so it melts in.', pencil: 'The blush: a pink pencil, very light, rubbed in with the wet brush on the cheeks and the ears.', copic: 'The blush: a pale pink marker (R20 or E000) on the cheeks, blended out at once with the colourless blender.', ink: 'The blush: a few light parallel hatching lines on the cheeks, or leave it white.' },
  hair: { water: 'The ring of light: leave it as bare paper, or lift it with a damp brush; do the hair one clump at a time, from root to tip.', pencil: 'The ring of light: leave it unlaid; draw each clump from root to tip, and darken at the root.', copic: 'The ring of light: leave it white, or lift it with the colourless blender; strokes run root to tip, flicking out at the tip.', ink: 'The ring of light: leave it as paper; add a few thin lines in the direction of each clump.' },
  eyes: { water: 'The iris is darkest at the top (the lid casts a shadow) and lightest at the bottom; the highlight is bare paper - paint round it.', pencil: 'The iris is darkest at the top and lightest at the bottom; keep the highlight clean and wet only the rest.', copic: 'The iris is darkest at the top and lightest at the bottom, in two markers; leave the highlight white or add it with a white gel pen at the end.', ink: 'Fill the pupil solid and put a lighter wash round it; leave the highlight as paper.' },
  cloth: { water: 'Folds: put the shadow only on the side of each fold that turns from the light; the other side stays in the base tone.', pencil: 'Folds: lay the shadow only on the side of each fold turned from the light; the other side stays in the base tone.', copic: 'Folds: second marker only on the shadow side of each fold; the other side stays in the first marker.', ink: 'Folds: wash only on the shadow side of each fold; the other side stays pale.' },
};

/* o: { material, part, base: [r, g, b], bg: [r, g, b] or null }. Rows: { n, tone, rgb, text }, where rgb is the colour
   of the layer or null for a step with none, and tone says which of the tones it is. The reflected light takes
   the colour of the surroundings when they are given. */
function amLayers(o) {
  const material = AM_MATERIALS[o.material] ? o.material : 'water', part = AM_PARTS[o.part] ? o.part : 'skin';
  const T = adTones(o.base || adRgbOf(AM_PART_DEFAULT[part])), steps = [];
  const add = (tone, rgb, text) => steps.push({ n: steps.length + 1, tone, rgb, text });
  const reflect = o.bg ? adMixRgb(T.reflect, o.bg, 0.5) : T.reflect;
  const reflectText = o.bg
    ? 'Reflected light from the surroundings: a thin glaze of the background\'s colour mixed into the light tone, along the edge of the shadow nearest the background. It makes the shadow part of the scene.'
    : 'Reflected light: a thin glaze of the warm light tone inside the edge of the shadow, so the shadow is not a flat patch.';
  if (material === 'water') {
    add('line', null, 'A light pencil drawing, erased until it is a ghost. Lines in waterproof ink now, if you want colour over them - and wait for them to dry.');
    add('light', T.light, 'The light tone as a pale wash over the whole shape, leaving the highlight as bare paper. Let it dry completely.');
    add('base', T.base, 'The base tone on everything but the lit side, with a hard edge. Dry.');
    add('shadow', T.shadow, 'The shadow in a cooler tone, hard-edged, on the side away from the light.');
    add('core', T.core, 'The core shadow: the smallest, darkest shape, along the edge where the form turns away.');
    add('reflect', reflect, reflectText);
  } else if (material === 'pencil') {
    add('line', null, 'A light drawing in a hard pencil, or lines in a waterproof pen before the water goes on.');
    add('light', T.light, 'The light tone laid dry with light pressure over the whole shape, the strokes following the form. Keep the highlight bare.');
    add('base', T.base, 'The base tone with medium pressure over everything but the lit side.');
    add('shadow', T.shadow, 'The shadow tone with firm pressure on the side away from the light.');
    add('core', T.core, 'The core shadow, firm and small, along the turning edge.');
    add('water', null, 'Now the wet brush, one pass from the light to the dark; keep the highlight dry. Let it dry.');
    add('reflect', reflect, reflectText.replace('thin glaze', 'light layer of pencil'));
  } else if (material === 'copic') {
    add('line', null, 'Lines first, in an ink made for alcohol markers (a "Copic-safe" fineliner): a ballpoint or an ordinary ink smears. Test it on a corner.');
    add('light', T.light, 'The lightest marker all over the shape, leaving the highlight white. Work while it is wet so the edges join.');
    add('base', T.base, 'The base marker over everything but the lit side, while the first is still damp.');
    add('shadow', T.shadow, 'The shadow marker on the side away from the light, a second pass: its edge stays hard.');
    add('core', T.core, 'The core shadow with the darkest marker, small, along the turning edge.');
    add('reflect', reflect, reflectText.replace('thin glaze', 'light layer') + ' Blend it in with the colourless blender (0).');
  } else {
    const wash = (t) => adMixRgb(AM_PAPER, [30, 30, 38], t);
    add('line', null, 'A light pencil drawing, then the lines in waterproof ink (a fineliner, or a nib) - see Inking for the weights.');
    add('light', wash(0.12), 'A pale wash of ink and water (one part ink to eight of water) over the shadow side and the middle tones. Dry.');
    add('base', wash(0.3), 'A middle wash (one to three) on the shadow shapes only. Dry.');
    add('shadow', wash(0.55), 'A strong wash (one to one) in the deepest shadows, hard-edged.');
    add('core', wash(0.85), 'Pure ink in the darkest accents only: under the chin, in the folds\' deepest corners, in the pupils.');
  }
  const extra = AM_PART_EXTRA[part][material];
  const last = steps.pop();
  add('part', null, extra);
  steps.push({ ...last, n: steps.length + 1 });
  return steps;
}

/* ---- angles */

const AM_ANGLE_FEATURES = [['top', 80], ['brow', 20], ['eyes', -3], ['nose', -24], ['mouth', -38]];
const AM_CHIN = -62, AM_JAW = 1.12;
const AM_ANGLES = { bird: ['Bird\'s-eye', 55], high: ['High', 25], eye: ['Eye level', 0], low: ['Low', -25], worm: ['Worm\'s-eye', -55] };

/* Where the face's features lie in the picture: a ring at elevation `deg` on a sphere of radius R seen from
   `pitch` degrees above (negative: below). On the centre line a point is at R sin(deg - pitch); at the sides
   of the head, where the ring turns away, at R sin(deg) cos(pitch) - the bend between them is the curve
   the line is drawn with: a smile from above, a frown from below. */
function amRing(deg, pitch, R) {
  const t = deg * Math.PI / 180, p = pitch * Math.PI / 180;
  return { centre: -R * Math.sin(t - p), edge: -R * Math.sin(t) * Math.cos(p), half: R * Math.cos(t) };
}

// How a stretch of the face changes against the same face seen level (as a percentage).
function amAngleFacts(pitch) {
  const span = (a, b, p) => Math.abs(amRing(a, p, 1).centre - amRing(b, p, 1).centre);
  const change = (a, b) => Math.round((span(a, b, pitch) / span(a, b, 0) - 1) * 100);
  const top = AM_ANGLE_FEATURES[0][1], brow = AM_ANGLE_FEATURES[1][1], eyes = AM_ANGLE_FEATURES[2][1], nose = AM_ANGLE_FEATURES[3][1];
  const sag = Math.round((amRing(eyes, pitch, 1).centre - amRing(eyes, pitch, 1).edge) * 100);
  return {
    forehead: change(top, brow), nose: change(eyes, nose), jaw: change(nose, AM_CHIN),
    bend: sag,                     // percent of the head's radius the eye line bows by; positive: a smile
  };
}

function amAngleNotes(pitch) {
  const f = amAngleFacts(pitch), out = [];
  const sgn = n => (n > 0 ? '+' : '') + n + '%';
  if (Math.abs(pitch) < 6) return ['Level: the lines across the face are straight, the ears sit between the brow and the nose, and nothing is foreshortened. The dashed grey in every other picture is this.'];
  const up = pitch > 0;
  out.push(up
    ? `From above the lines across the face bow into a smile (${Math.abs(f.bend)}% of the head's radius), the forehead grows (${sgn(f.forehead)}), and the stretch from nose to chin shortens (${sgn(f.jaw)}).`
    : `From below the lines across the face bow into a frown (${Math.abs(f.bend)}% of the head's radius), the forehead shortens (${sgn(f.forehead)}), and the stretch from nose to chin grows (${sgn(f.jaw)}); the underside of the jaw shows.`);
  out.push(up ? 'The ears sit above the eye line and the top of the skull shows; the legs shorten more than the head does.' : 'The ears sit below the eye line; the nostrils show, the eyes are covered by the brow more, and the feet grow larger than the head.');
  out.push('Keep the eyes on one curve that bows with the angle: if each eye is drawn level, the head looks flat.');
  return out;
}

/* o: { pitch, roll, near }. pitch is the camera's height in degrees (-60 worm's-eye .. 60 bird's-eye), roll tilts
   the whole picture (the Dutch angle), near is how close the camera is (0: far, with little change in size;
   1: near, with a lot). */
function amAngleSvg(o) {
  const pitch = adClamp(+o.pitch || 0, -60, 60), roll = adClamp(+o.roll || 0, -30, 30), near = adClamp(+o.near || 0, 0, 1);
  const R = 62, cx = 130, cy = 120, ink = AD_INK, grey = '#b4b8c8';
  const rings = (p, colour, width, dash) => {
    let s = '';
    for (const [, deg] of AM_ANGLE_FEATURES.slice(1)) {
      const r = amRing(deg, p, R), bow = r.centre - r.edge;
      s += `<path d="M${amF(cx - r.half)} ${amF(cy + r.edge)} Q${cx} ${amF(cy + r.edge + 2 * bow)} ${amF(cx + r.half)} ${amF(cy + r.edge)}" fill="none" stroke="${colour}" stroke-width="${width}"${dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    }
    const top = amRing(80, p, R), chin = amRing(AM_CHIN, p, R * AM_JAW);
    s += `<path d="M${cx} ${amF(cy + top.centre)} V${amF(cy + chin.centre)}" stroke="${colour}" stroke-width="${width}"${dash ? ' stroke-dasharray="5 4"' : ''}/>`;
    return s;
  };
  const head = p => {
    const chin = amRing(AM_CHIN, p, R * AM_JAW), side = amRing(-14, p, R);
    const yc = cy + chin.centre, ys = cy + side.edge;
    return `M${amF(cx - side.half)} ${amF(ys)} Q${amF(cx - side.half * 0.7)} ${amF(yc - 4)} ${cx} ${amF(yc)} Q${amF(cx + side.half * 0.7)} ${amF(yc - 4)} ${amF(cx + side.half)} ${amF(ys)}`;
  };
  const eyeAt = (sd) => {
    const t = AM_ANGLE_FEATURES[2][1] * Math.PI / 180, p = pitch * Math.PI / 180, phi = 32 * Math.PI / 180;
    return [cx + sd * R * Math.cos(t) * Math.sin(phi), cy - R * (Math.sin(t) * Math.cos(p) - Math.cos(t) * Math.sin(p) * Math.cos(phi))];
  };
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fbe9dc" stroke="${ink}" stroke-width="1.8"/>`;
  g += `<path d="${head(pitch)}" fill="#fbe9dc" stroke="${ink}" stroke-width="1.8"/>`;
  // the same head seen level, dashed, to see what moved
  if (Math.abs(pitch) >= 6) g += rings(0, grey, 1.2, true);
  g += rings(pitch, '#c8412f', 1.8, false);
  for (const sd of [-1, 1]) {
    const [ex, ey] = eyeAt(sd);
    g += `<ellipse cx="${amF(ex)}" cy="${amF(ey)}" rx="12" ry="${amF(7 + 3 * Math.cos(pitch * Math.PI / 180))}" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="${amF(ex)}" cy="${amF(ey)}" r="5" fill="${ink}"/>`;
    const brow = amRing(AM_ANGLE_FEATURES[1][1], pitch, R), nose = amRing(AM_ANGLE_FEATURES[3][1], pitch, R);
    g += `<ellipse cx="${amF(cx + sd * R)}" cy="${amF(cy + (brow.edge + nose.edge) / 2)}" rx="6" ry="${amF(Math.abs(nose.edge - brow.edge) / 2)}" fill="#f6d8c4" stroke="${ink}" stroke-width="1.4"/>`;
  }
  g += `<text x="${cx}" y="${cy + R + 46}" text-anchor="middle" font-size="13" fill="#333">${pitch === 0 ? 'Level' : `${Math.abs(Math.round(pitch))}° ${pitch > 0 ? 'from above' : 'from below'}`}</text>`;
  // The figure, seven heads tall: each part is scaled by cos(pitch) and, the nearer the camera, by how near to it
  // that part is - the top part grows when the camera is above, the feet when it is below.
  const sp = Math.sin(pitch * Math.PI / 180), cp = Math.cos(pitch * Math.PI / 180), fx = 330, unit = 30;
  const rows = [['head', 1, 1], ['body', 2.2, 0.72], ['thighs', 1.7, 0.4], ['shins', 2.1, 0.12]];
  let y = 28, fig = '', total = 0, headLen = 0;
  for (const [name, heads, mid] of rows) {
    const len = heads * unit * cp * (1 + near * sp * (2 * mid - 1) * 0.6);
    if (name === 'head') { headLen = len; fig += `<ellipse cx="${fx}" cy="${amF(y + len / 2)}" rx="${amF(len * 0.42)}" ry="${amF(len / 2)}" fill="#fbe9dc" stroke="${ink}" stroke-width="1.6"/>`; }
    else {
      const wide = name === 'body' ? 0.7 : name === 'thighs' ? 0.46 : 0.34;
      fig += `<rect x="${amF(fx - len * wide / 2)}" y="${amF(y)}" width="${amF(len * wide)}" height="${amF(len)}" rx="6" fill="${name === 'body' ? '#cfd6ee' : '#e4e7f4'}" stroke="${ink}" stroke-width="1.6"/>`;
    }
    total += len; y += len;
  }
  fig += `<text x="${fx}" y="${amF(y + 22)}" text-anchor="middle" font-size="13" fill="#333">${(total / headLen).toFixed(1)} heads</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="A head and a figure seen ${pitch === 0 ? 'level' : pitch > 0 ? 'from above' : 'from below'}"><rect width="400" height="300" fill="#fff"/>` +
    `<g transform="rotate(${roll} 200 150)">${g}${fig}</g></svg>`;
  return svg;
}

// The words for Generate for an angle.
function amAngleWords(pitch) {
  if (pitch >= 45) return 'from above, bird\'s-eye view, foreshortening';
  if (pitch >= 15) return 'from above, high angle';
  if (pitch <= -45) return 'from below, worm\'s-eye view, foreshortening';
  if (pitch <= -15) return 'from below, low angle';
  return '';
}
