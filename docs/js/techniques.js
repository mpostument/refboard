/* refboard - Techniques guide: salt, spatter, dry brush, lifting and masking
   fluid - when to use each, and a small demonstration of each to move. The
   second chapter of the Handbook (Practise > Handbook), in the same four
   parts: theory, a demonstration, things to try, and what you should see.

   Each demonstration is a function that draws into a canvas from a few
   numbers and gives back what it drew (tkSalt, tkSpatter, tkDryBrush,
   tkLift, tkMask), so the lesson's words are read off the same numbers the
   picture was made from, and a test can ask them. They are models of the
   effect, not of the chemistry: each takes what decides the effect in
   practice and no more.
     salt       a bell curve of how wet the wash is - the stars need the
                moment the shine has gone but the paper is still damp;
     spatter    drops of lognormal size, falling in a gaussian cloud, the
                big ones near the brush and only fine ones far (a heavy drop
                does not carry);
     dry brush  a paper tooth made of smooth value noise, and a brush whose
                load runs out along the stroke: paint lands where the load
                reaches above the paper's height there;
     lifting    the Pigments tab's own numbers - a band lifted from a wash
                keeps [0.12, 0.4, 0.82] of it by how much the pigment stains
                - and the older the wash, the more stays;
     masking    shapes of bare paper under a wash, the mask shown or peeled,
                the peeled edge hard or softened on one side.
   Loaded with handbook.js (loadSection('handbook')); it adds to HB_LESSONS. */
"use strict";

const TK_PAPER = [247, 242, 230];
const TK_KEEP = [0.12, 0.4, 0.82];   // what a lifted band keeps of a wash, by staining (pigments.js)
const TK_GROUP = 'Watercolour techniques';

// A small seeded generator (mulberry32): a demonstration draws the same picture every time it is moved.
function tkRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tkGauss = rnd => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const tkSmooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tkRgba = (c, a) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

// Smooth value noise, 0 to 1, with one random value every `cell` pixels: the paper's tooth.
function tkTooth(W, H, cell, seed) {
  const rnd = tkRandom(seed), cw = Math.ceil(W / cell) + 2, ch = Math.ceil(H / cell) + 2;
  const grid = Float32Array.from({ length: cw * ch }, rnd), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = grid[y0 * cw + x0], b = grid[y0 * cw + x0 + 1], c = grid[(y0 + 1) * cw + x0], d = grid[(y0 + 1) * cw + x0 + 1];
    out[y * W + x] = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  return out;
}

// The paper, with a faint grain. Gives the tooth so that a stroke can read it.
function tkPaper(g, W, H, cell = 1.6, seed = 3) {
  const tooth = tkTooth(W, H, cell, seed), img = g.createImageData(W, H), px = img.data;
  for (let i = 0; i < W * H; i++) {
    const k = 1 - 0.05 * tooth[i];
    px[4 * i] = TK_PAPER[0] * k; px[4 * i + 1] = TK_PAPER[1] * k; px[4 * i + 2] = TK_PAPER[2] * k; px[4 * i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tooth;
}

/* ---- salt */
// How well salt works at a wetness 0 (bone dry) to 1 (glossy): at its best when the shine has just gone.
const tkSaltStrength = wet => Math.exp(-(((wet - 0.5) / 0.2) ** 2));
function tkSaltWord(wet) {
  if (wet < 0.2) return 'Dry: nothing is there to pull the pigment, so the salt just sits on the paper.';
  if (wet < 0.35) return 'Nearly dry: a few faint, small marks.';
  if (wet <= 0.65) return 'Damp, the shine just gone: the best stars - sharp, with a darker rim.';
  if (wet < 0.85) return 'Still wet: the stars come soft and small, the water running back over them.';
  return 'Glossy: the water floods back at once and the salt only dissolves. Nothing shows.';
}
function tkSalt(cv, { wet = 0.5, grain = 2 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), blue = [52, 96, 168];
  tkPaper(g, W, H);
  const wash = g.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, tkRgba([86, 128, 190], 0.9)); wash.addColorStop(1, tkRgba([40, 76, 150], 0.92));
  g.fillStyle = wash; g.fillRect(14, 14, W - 28, H - 28);
  const s = tkSaltStrength(wet), rnd = tkRandom(11), count = 46;
  if (s > 0.04) for (let i = 0; i < count; i++) {
    const x = 28 + rnd() * (W - 56), y = 28 + rnd() * (H - 56), r = grain * (2.2 + 4.2 * s) * (0.7 + 0.6 * rnd());
    const glow = g.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, tkRgba(TK_PAPER, 0.9 * s)); glow.addColorStop(0.55, tkRgba(TK_PAPER, 0.45 * s)); glow.addColorStop(1, tkRgba(TK_PAPER, 0));
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = tkRgba(TK_PAPER, 0.55 * s); g.lineWidth = 1;
    const rays = 9;
    for (let k = 0; k < rays; k++) {
      const a = Math.PI * 2 * k / rays + rnd() * 0.5, len = r * (0.9 + 0.9 * rnd());
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    g.strokeStyle = tkRgba([24, 52, 120], 0.3 * s); g.lineWidth = 1.2;     // the pigment pushed to the rim
    g.beginPath(); g.arc(x, y, r * 1.02, 0, Math.PI * 2); g.stroke();
  }
  return { strength: s, stars: s > 0.15 ? count : 0, word: tkSaltWord(wet), wash: blue };
}

/* ---- spatter */
function tkSpatter(cv, { load = 0.5, distance = 0.5, amount = 0.5, mask = false } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  tkPaper(g, W, H);
  const rnd = tkRandom(21), spread = 30 + distance * 90, N = Math.round(120 + amount * 520), median = 0.7 + 2.6 * load;
  const hole = { x: 116, y: 70, w: 88, h: 70 };      // the covered shape
  let drops = 0, skipped = 0, sumR = 0, far = 0, farR = 0, near = 0, nearR = 0;
  for (let i = 0; i < N; i++) {
    const dx = tkGauss(rnd) * spread, dy = tkGauss(rnd) * spread * 0.8, d = Math.hypot(dx, dy);
    // Big drops are heavy and fall near the brush; only the fine ones carry.
    const r = Math.max(0.5, median * Math.exp(0.55 * tkGauss(rnd)) * (1 - 0.55 * Math.min(1, d / (2.2 * spread))));
    const x = W / 2 + dx, y = H / 2 + dy, alpha = 0.55 + 0.35 * rnd();
    if (x < 0 || y < 0 || x > W || y > H) continue;
    if (mask && x > hole.x - r && x < hole.x + hole.w + r && y > hole.y - r && y < hole.y + hole.h + r) { skipped++; continue; }
    g.fillStyle = tkRgba([44, 62, 128], alpha); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    drops++; sumR += r;
    if (d > spread) { far++; farR += r; } else { near++; nearR += r; }
  }
  if (mask) { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(hole.x, hole.y, hole.w, hole.h); g.setLineDash([]); }
  return { drops, skipped, meanR: drops ? sumR / drops : 0, nearR: near ? nearR / near : 0, farR: far ? farR / far : 0, spread };
}

/* ---- dry brush */
function tkDryBrush(cv, { load = 0.5, pressure = 0.4, tooth = 0.5 } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  const field = tkPaper(g, W, H, 1.2 + 3.2 * tooth, 5);      // a rougher paper has a coarser tooth...
  const rough = 0.35 + 1.3 * tooth;                           // ...and a deeper one: smooth paper is nearly level
  // Bristles: gaps between hairs run along the stroke, so this varies across it only.
  const bristle = tkTooth(1, H, 2.2, 9);
  const img = g.getImageData(0, 0, W, H), px = img.data, ink = [58, 88, 112];
  const covered = [0, 0, 0], area = [0, 0, 0];                // the top stroke, in thirds along its length
  [[48, load], [105, load * 0.6], [162, load * 0.3]].forEach(([cy, l], s) => {
    for (let x = 20; x < 300; x++) {
      const along = (x - 20) / 280, loadHere = l * (1 - 0.8 * along);     // the brush runs out of paint
      for (let y = cy - 22; y <= cy + 22; y++) {
        const edge = tkSmooth(0, 5, 22 - Math.abs(y - cy)), i = y * W + x;
        // Paint lands where the load reaches above the paper's height here.
        const height = 0.5 + (field[i] - 0.5) * rough + (bristle[y] - 0.5) * 0.45;
        const reach = loadHere * (0.55 + 0.9 * pressure) * edge, a = tkSmooth(height - 0.16, height + 0.16, reach) * 0.92;   // a wide step: partial tones, not bare pixels
        px[4 * i] += (ink[0] - px[4 * i]) * a; px[4 * i + 1] += (ink[1] - px[4 * i + 1]) * a; px[4 * i + 2] += (ink[2] - px[4 * i + 2]) * a;
        if (s === 0) { const third = Math.min(2, Math.floor(along * 3)); area[third]++; if (a > 0.45) covered[third]++; }
      }
    }
  });
  g.putImageData(img, 0, 0);
  const pct = k => covered[k] / area[k] * 100;
  return { coverage: (covered[0] + covered[1] + covered[2]) / (area[0] + area[1] + area[2]) * 100, left: pct(0), right: pct(2) };
}

/* ---- lifting */
function tkLift(cv, { k, age = 0.3 }) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), p = PIGMENTS[k];
  const field = tkPaper(g, W, H);
  const wash = paintRgb(paintWash([[k, 1]], 0.55));
  const keep = TK_KEEP[p.stain] + (1 - TK_KEEP[p.stain]) * 0.55 * age;      // the older the wash, the more stays
  const grain = [0, 0.1, 0.22][p.gran];
  const img = g.getImageData(0, 0, W, H), px = img.data;
  for (let y = 24; y < H - 24; y++) for (let x = 14; x < W - 14; x++) {
    const i = y * W + x, hollow = (1 - field[i]) * grain;      // a granulating paint settles in the hollows
    const lifted = tkSmooth(0, 6, 21 - Math.abs(y - H / 2));
    const residue = keep + hollow * 1.2;                         // what a lifted band still holds, grain included
    for (let c = 0; c < 3; c++) {
      const own = wash[c] * (1 - hollow * 0.6), paper = px[4 * i + c], left = paper + (own - paper) * Math.min(1, residue);
      px[4 * i + c] = own + (left - own) * lifted;
    }
  }
  g.putImageData(img, 0, 0);
  const band = [0, 1, 2].map(c => Math.round(TK_PAPER[c] + (wash[c] - TK_PAPER[c]) * keep));
  return { keep, stain: p.stain, gran: p.gran, wash, band };
}

/* ---- masking fluid */
const TK_SPARKLES = [[60, 50, 12], [112, 96, 8], [252, 60, 10], [204, 150, 14], [40, 150, 7], [286, 118, 6]];
const TK_TWIG = [[142, 28], [170, 72], [150, 112], [192, 176]];
function tkShapes(g, fill) {
  g.fillStyle = fill;
  for (const [x, y, r] of TK_SPARKLES) {       // a four-pointed sparkle
    g.beginPath(); g.moveTo(x, y - r);
    g.quadraticCurveTo(x + r * 0.15, y - r * 0.15, x + r, y); g.quadraticCurveTo(x + r * 0.15, y + r * 0.15, x, y + r);
    g.quadraticCurveTo(x - r * 0.15, y + r * 0.15, x - r, y); g.quadraticCurveTo(x - r * 0.15, y - r * 0.15, x, y - r);
    g.fill();
  }
  g.strokeStyle = fill; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); TK_TWIG.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}
function tkMask(cv, { wash = 0.7, peeled = false, soften = false } = {}) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d');
  tkPaper(g, W, H);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, tkRgba([92, 132, 192], wash)); sky.addColorStop(1, tkRgba([26, 48, 108], wash));
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (!peeled) tkShapes(g, 'rgba(236, 222, 170, 0.95)');                  // the fluid, a yellowish film over the wash
  else {
    if (soften) {
      // A damp brush along one side: the paper-coloured halo falls to the upper left of each shape.
      g.save(); g.shadowColor = tkRgba(TK_PAPER, 0.9); g.shadowBlur = 9; g.shadowOffsetX = -3; g.shadowOffsetY = -3;
      tkShapes(g, tkRgba(TK_PAPER, 1)); g.restore();
    }
    tkShapes(g, tkRgba(TK_PAPER, 1));
  }
  return { whites: TK_SPARKLES.length + 1, hard: peeled && !soften, peeled };
}

/* ---- the lessons */
const tkLoad = label => `<canvas class="hb-canvas" width="${HB_SW}" height="${HB_SH}" role="img" aria-label="${label}"></canvas>`;
const tkValue = (host, id) => +host.querySelector('#' + id).value;

HB_LESSONS.push(
  { id: 'salt', group: TK_GROUP, title: 'Salt',
    theory: 'Salt <b>pulls water, and the pigment in it,</b> toward itself and leaves a pale, spiky star where the crystal sat. It is the quick way to frost, snow, sparkle on water or the grain of a rock. It works at <b>one moment only</b>: the wash must have lost its shine but still be damp. On a glossy wash the water floods back and the salt just dissolves; on a dry one there is nothing to draw. Coarse salt makes big stars, table salt small ones - and the salt is brushed off only when the paper is dry.',
    build(host) {
      host.innerHTML = tkLoad('A blue wash with pale stars where salt has been sprinkled') +
        hbSlider('hbWet', 'Wash', 0, 100, 1, 50, '') + hbSlider('hbGrain', 'Salt grain', 1, 3, 0.1, 2, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      host.querySelector('#hbWetOut').dataset.unit = '';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const wet = tkValue(host, 'hbWet') / 100, r = tkSalt(cv, { wet, grain: tkValue(host, 'hbGrain') });
        read.textContent = `Wetness ${Math.round(wet * 100)} of 100 (0 dry, 100 glossy). ` + r.word;
      };
      hbOn(host, 'hbWet', draw); hbOn(host, 'hbGrain', draw);
      draw();
    },
    tryThis: ['Slide the wash from dry to glossy and stop where the stars are sharpest. How wide is that range?',
      'Make the salt coarse: what grows, and what stays the same?',
      'Both ends of the slider fail, but not in the same way. What would you see on the paper at each end?'],
    see: 'The stars are sharp and strong only in a window around the middle, roughly where the shine has just gone. Too wet and they are soft and small, then nothing; too dry, nothing. A bigger grain makes bigger stars, not more. In practice you watch the wash: when the gloss goes from shiny to a dull sheen, that is the moment.' },

  { id: 'spatter', group: TK_GROUP, title: 'Spatter',
    theory: 'Flicking paint from a loaded brush - or drawing a toothbrush\'s bristles back - throws drops of <b>every size</b>. The eye reads a field of random dots as a surface: gravel, sand, snow, foam, stars. Three things control it: the <b>load</b> (a wetter brush throws bigger, heavier drops), the <b>distance</b> (big drops fall near the brush; only fine ones carry far, so the cloud thins and fines out toward its edge) and <b>masking</b> - whatever must stay clean has to be covered first.',
    build(host) {
      host.innerHTML = tkLoad('A cloud of blue drops of different sizes on paper') +
        hbSlider('hbLoad', 'Water on the brush', 0, 100, 1, 50, '') + hbSlider('hbDist', 'Distance', 0, 100, 1, 50, '') + hbSlider('hbAmt', 'Flicks', 0, 100, 1, 50, '') +
        '<div class="row hb-toggles"><label class="opt"><input type="checkbox" id="hbCover"> Cover a shape first</label></div>' +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const cover = host.querySelector('#hbCover').checked;
        const r = tkSpatter(cv, { load: tkValue(host, 'hbLoad') / 100, distance: tkValue(host, 'hbDist') / 100, amount: tkValue(host, 'hbAmt') / 100, mask: cover });
        read.textContent = `${r.drops} drops, ${r.meanR.toFixed(1)} px across on average - ${r.nearR.toFixed(1)} near the middle, ${r.farR ? r.farR.toFixed(1) : '-'} at the edge of the cloud.` +
          (cover ? ` The covered shape kept ${r.skipped} drops off.` : ' Nothing is covered: drops land everywhere.');
      };
      for (const id of ['hbLoad', 'hbDist', 'hbAmt']) hbOn(host, id, draw);
      host.querySelector('#hbCover').addEventListener('change', draw);
      draw();
    },
    tryThis: ['Raise the water on the brush: what happens to the drops, and to how many fall?',
      'Increase the distance and read the two sizes in the note: which is bigger, the middle or the edge?',
      'Cover a shape, then turn it off: what would have been spoiled?'],
    see: 'The pattern is a dense middle and a fading edge of finer drops - not an even sprinkle, which looks mechanical. A wetter brush gives bigger drops; distance spreads the cloud and shrinks its far drops. The covered shape stays paper, with the drops stopping dead at its edge: that is the only way to keep something clean. Spatter on dry paper stays round; on damp paper it blooms.' },

  { id: 'drybrush', group: TK_GROUP, title: 'Dry brush',
    theory: 'A brush loaded with <b>little paint</b> and dragged lightly over rough paper touches only the peaks of the paper\'s tooth, so the colour breaks into streaks and flecks and the white of the paper shows through. It reads as sunlit grass, bark, weathered wood, rock or glitter on water. Three things decide it: how little paint is on the brush (blot it first), how lightly it moves, and how rough the paper is. Cold-press and rough paper take it well; smooth, hot-pressed paper barely breaks the stroke.',
    build(host) {
      host.innerHTML = tkLoad('Three strokes of a dry brush across paper, each with less paint, breaking up toward the right') +
        hbSlider('hbDLoad', 'Paint on the brush', 5, 100, 1, 55, '') + hbSlider('hbDPress', 'Pressure', 0, 100, 1, 40, '') + hbSlider('hbDTooth', 'Paper tooth', 0, 100, 1, 60, '') +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const r = tkDryBrush(cv, { load: tkValue(host, 'hbDLoad') / 100, pressure: tkValue(host, 'hbDPress') / 100, tooth: tkValue(host, 'hbDTooth') / 100 });
        read.textContent = `The top stroke is ${Math.round(r.coverage)}% paint, the rest paper. Below it, the same brush with 60% and then 30% of the paint.` +
          (r.coverage > 85 ? ' So much paint that it is a wash, not a dry brush: blot the brush.' : r.coverage < 8 ? ' Almost nothing lands: more paint, a firmer hand or a rougher paper.' : '');
      };
      for (const id of ['hbDLoad', 'hbDPress', 'hbDTooth']) hbOn(host, id, draw);
      draw();
    },
    tryThis: ['Take the paint down until the top stroke breaks up. Where along the stroke does it first go to flecks, and why there?',
      'Press harder with the same load: the paint reaches into the hollows. What does that do to the streaks?',
      'Make the paper smooth, then rough. Which would you choose for bark, and which for a smooth sky?'],
    see: 'Each stroke begins solid and breaks up as the brush runs out - the end of a dry-brush stroke is where its texture is. Pressure fills the hollows and turns it toward a flat stroke; less paint and a rougher tooth give more white. On smooth paper the same brush makes an almost solid line.' },

  { id: 'lifting', group: TK_GROUP, title: 'Lifting',
    theory: 'Lifting takes colour back off the paper: a damp brush (a soft edge), a tissue pressed on a wet wash (a cloud), a clean stiff brush and water on a dry wash (rescuing a highlight), or a sponge. How much comes back depends on the <b>pigment</b> more than on you. Non-staining paints (the cadmiums, ultramarine, ochre) go back almost to the paper; staining ones (phthalo, alizarin, most quinacridones) leave a tint whatever you do, and granulating ones leave their grain in the hollows. The older and drier the wash, the less comes back.',
    build(host) {
      if (!paintInit()) { host.textContent = 'The paint model has not loaded.'; return; }
      const keys = paintKeys(paintPaletteKey(), 'water').filter(k => !PIGMENTS[k].body);
      // The one that lifts best and the one that stains most, if the palette has them, to start with.
      const first = keys.find(k => PIGMENTS[k].stain === 0) || keys[0];
      host.innerHTML = tkLoad('A wash of one paint with a band lifted out of it across the middle') +
        `<div class="row hb-pair"><select id="hbLiftPaint" aria-label="Paint">${keys.map(k => `<option value="${k}"${k === first ? ' selected' : ''}>${esc(PIGMENTS[k].name)}</option>`).join('')}</select></div>` +
        hbSlider('hbAge', 'Wash', 0, 100, 1, 30, '') + '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      const draw = () => {
        const k = host.querySelector('#hbLiftPaint').value, age = tkValue(host, 'hbAge') / 100, r = tkLift(cv, { k, age });
        read.textContent = `${PIGMENTS[k].name}: ${['lifts off', 'stains a little', 'stains'][r.stain]}${r.gran ? ', and granulates' : ''}. ` +
          `The band keeps ${Math.round(r.keep * 100)}% of the wash (the wash is ${age < 0.25 ? 'still wet' : age < 0.65 ? 'damp' : 'dry'}).`;
      };
      host.querySelector('#hbLiftPaint').addEventListener('change', draw);
      hbOn(host, 'hbAge', draw);
      draw();
    },
    tryThis: ['Pick the paint in your palette that lifts best and the one that stains most. Compare the bands.',
      'Slide the wash from wet to dry on a paint that lifts: how much does it lose?',
      'Choose a granulating paint: the band is lighter, but is it clean?'],
    see: 'A non-staining paint at a wet stage comes back to nearly paper; the same paint dry keeps about half its colour. A staining paint keeps most of it at any stage - plan for that: paint the lights first, and keep the staining paints for the darks you will not need to change. Lift what you can before the wash dries. The Pigments tab lists which of your paints lift, stain and granulate.' },

  { id: 'masking', group: TK_GROUP, title: 'Masking fluid',
    theory: 'Masking fluid is liquid latex painted onto <b>dry</b> paper wherever the white (or a lighter underlayer) must be kept. Paint over it freely, let the wash dry completely, then rub the film off with a finger or a rubber pick-up. It gives what a brush cannot: a <b>hard-edged white shape</b> in one pass - sparkles, a twig across a dark sky, a white sail. The rules: dry paper only; do not leave it on for weeks (it bonds); use an old brush or a silicone shaper, never a good one; and soften one side of the white with a damp brush afterwards, since the edge it leaves is hard and a little artificial.',
    build(host) {
      host.innerHTML = tkLoad('A dark blue sky wash with white sparkles and a white twig, where masking fluid kept the paper') +
        hbSlider('hbMWash', 'Wash strength', 20, 100, 1, 75, '') +
        '<div class="row hb-toggles"><label class="opt"><input type="checkbox" id="hbPeel"> Peel the mask</label><label class="opt"><input type="checkbox" id="hbSoft"> Soften one side with a damp brush</label></div>' +
        '<div class="count" id="hbRead" role="status"></div>';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead'), peel = host.querySelector('#hbPeel'), soft = host.querySelector('#hbSoft');
      const draw = () => {
        soft.disabled = !peel.checked;
        const r = tkMask(cv, { wash: tkValue(host, 'hbMWash') / 100, peeled: peel.checked, soften: peel.checked && soft.checked });
        read.textContent = !r.peeled ? 'The mask is on (the yellowish film): the wash goes over it and the paper below is safe. Wait until the wash is bone dry before peeling.'
          : r.hard ? `Peeled: ${r.whites} shapes of pure paper with hard edges all round. Often that is right for a sparkle; for a twig or a highlight on a form, soften it.`
            : 'Softened on the upper left: the white fades into the wash on one side and stays crisp on the other - the way light turns a form.';
      };
      hbOn(host, 'hbMWash', draw);
      peel.addEventListener('change', draw); soft.addEventListener('change', draw);
      draw();
    },
    tryThis: ['With the mask on, raise the wash to full strength: what is still safe underneath?',
      'Peel it: how do the whites\' edges look against the wash?',
      'Soften one side. Which side would you soften for a light coming from the upper left?'],
    see: 'The wash can be as dark as you like and the whites stay the pure white of the paper - which is the whole value of the fluid. Peeled, every edge is hard and even; a damp brush softens the shadow side and leaves the light side crisp, so the shape looks lit rather than cut out.' },
);
