/* refboard - The trainers.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ====================================================================== train
   Drills for the eye and the hand - the skills a reference board cannot
   check by itself: reading a value against a surround that lies about it,
   mixing a colour, knowing where the navel falls on a figure, pulling a
   straight line, seeing where a box's edges meet. Each trainer is ten short
   tasks, every one scored 0-100 with the answer shown and a sentence on
   why; the round's average is kept per browser, best and recent.

   A trainer is { id, title, icon, blurb, task(i, ui) }. task() builds one
   task into ui.stage / ui.controls and calls ui.done(score, html) once it
   has been answered. Nothing here leaves the browser. */
const TRAIN_KEY = 'refboard.train.v1';
const TRAIN_ROUNDS = 10;
let trainState = null; // { t, i, scores, answered }

function trainStats() {
  try { return JSON.parse(localStorage.getItem(TRAIN_KEY)) || {}; } catch { return {}; }
}
function saveTrainResult(id, score) {
  const st = trainStats(), e = st[id] || { best: 0, runs: [] };
  e.best = Math.max(e.best, score);
  e.runs.unshift({ t: Math.floor(Date.now() / 1000), score });
  e.runs = e.runs.slice(0, 30);
  st[id] = e;
  try { localStorage.setItem(TRAIN_KEY, JSON.stringify(st)); } catch {}
}
const clamp01 = v => Math.min(Math.max(v, 0), 1);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---- colour, done properly. Values are CIE L* (what "value" means to a
   painter: perceived lightness, 0 black to 100 white). Mixing is in OKLCH -
   lightness, chroma, hue - the perceptual cousin of a painter's value,
   intensity and hue, where equal steps look equal. */
const srgbToLin = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linToSrgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
function oklabToLin(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
function linToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
const inGamut = lin => lin.every(c => c >= -1e-4 && c <= 1 + 1e-4);
// OKLCH to sRGB 0-255, chroma pulled in until it fits the screen's gamut.
function lchRgb(L, C, h) {
  const hr = h * Math.PI / 180;
  let lo = 0, hi = C, lin = oklabToLin(L, C * Math.cos(hr), C * Math.sin(hr));
  if (!inGamut(lin)) {
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2, t = oklabToLin(L, mid * Math.cos(hr), mid * Math.sin(hr));
      if (inGamut(t)) lo = mid; else hi = mid;
    }
    lin = oklabToLin(L, lo * Math.cos(hr), lo * Math.sin(hr));
  }
  return lin.map(c => Math.round(clamp01(linToSrgb(clamp01(c))) * 255));
}
const rgbCss = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;
function lstar([r, g, b]) {
  const Y = 0.2126 * srgbToLin(r / 255) + 0.7152 * srgbToLin(g / 255) + 0.0722 * srgbToLin(b / 255);
  const f = Y > 216 / 24389 ? Math.cbrt(Y) : (24389 / 27 * Y + 16) / 116;
  return 116 * f - 16;
}
function greyOfLstar(Ls) {
  const Y = Ls > 8 ? ((Ls + 16) / 116) ** 3 : Ls / (24389 / 27);
  const v = Math.round(clamp01(linToSrgb(Y)) * 255);
  return [v, v, v];
}
const rgbOklch = rgb => {
  const [L, a, b] = linToOklab(...rgb.map(c => srgbToLin(c / 255)));
  return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
};
const colHexOf = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
// A colour of this hue and chroma at the given L* - bisection on OKLCH's
// lightness, which runs the same way as L*.
function colourAtLstar(target, C, h) {
  let lo = 0, hi = 1, rgb;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    rgb = lchRgb(mid, C, h);
    if (lstar(rgb) < target) lo = mid; else hi = mid;
  }
  return rgb;
}
// Painters' names for OKLCH hue angles.
const HUE_NAMES = [[20, 'red'], [55, 'orange'], [95, 'yellow'], [140, 'green'], [195, 'cyan'], [255, 'blue'], [300, 'violet'], [345, 'magenta'], [380, 'red']];
const hueName = h => HUE_NAMES.reduce((best, [a, n]) => Math.abs(((h - a + 540) % 360) - 180) < Math.abs(((h - best[0] + 540) % 360) - 180) ? [a, n] : best)[1];

/* ---- shared drawing surface: a canvas the width of the stage, crisp on a
   high-density screen, with pointer positions in its own CSS pixels. */
function trainCanvas(host, h) {
  const c = document.createElement('canvas');
  c.className = 'train-canvas';
  host.appendChild(c);
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = host.clientWidth;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.height = h + 'px';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  return { c, ctx, w, h, pos: e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; } };
}
const trainStageH = () => Math.max(300, Math.min(460, window.innerHeight - 330));
const scoreWord = s => s >= 90 ? 'Spot on' : s >= 70 ? 'Close' : s >= 40 ? 'Some way off' : 'Way off';

/* ---------------------------------------------------------------- value */
const TRAIN_VALUE = {
  id: 'value', title: 'Value', icon: 'gray',
  blurb: 'Read how light a patch really is - on a surround built to fool you. Then do it in colour.',
  task(i, ui) {
    // The first half grey, the second in colour - where value hides.
    const coloured = i >= TRAIN_ROUNDS / 2;
    const answer = 1 + Math.floor(Math.random() * 9);
    const target = answer * 10 + rnd(-3, 3);
    const patch = coloured ? colourAtLstar(target, rnd(0.07, 0.17), rnd(0, 360)) : greyOfLstar(target);
    // Surrounds chosen to push the patch the wrong way: dark behind light,
    // light behind dark, sometimes a strong colour, sometimes a gradient.
    const kind = pick(['contrast', 'contrast', 'colour', 'gradient', 'near']);
    let surround, sL;
    if (kind === 'contrast') { sL = target > 50 ? rnd(4, 18) : rnd(82, 97); surround = rgbCss(greyOfLstar(sL)); }
    else if (kind === 'near') { sL = target + rnd(-8, 8); surround = rgbCss(greyOfLstar(Math.min(Math.max(sL, 2), 98))); }
    else if (kind === 'colour') { const rgb = lchRgb(rnd(0.3, 0.85), 0.2, rnd(0, 360)); sL = lstar(rgb); surround = rgbCss(rgb); }
    else {
      sL = 50;
      surround = `linear-gradient(${Math.round(rnd(0, 360))}deg, ${rgbCss(greyOfLstar(5))}, ${rgbCss(greyOfLstar(95))})`;
    }
    ui.prompt(coloured
      ? 'How light is the colour in the middle? Pick its step on the grey scale - <b>1</b> near black, <b>9</b> near white. Keys 1-9 work.'
      : 'How light is the grey in the middle? Pick its step - <b>1</b> near black, <b>9</b> near white. Keys 1-9 work.');
    ui.stage.innerHTML = `<div class="tv-surround" style="height:${trainStageH()}px;background:${surround}">
      <div class="tv-patch" style="background:${rgbCss(patch)}"></div></div>`;
    ui.controls.innerHTML = `<div class="tv-scale">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k =>
      `<button type="button" data-v="${k}" style="background:${rgbCss(greyOfLstar(k * 10))};color:${k > 5 ? '#111' : '#eee'}">${k}</button>`).join('')}</div>`;
    const answerWith = v => {
      if (ui.answered()) return;
      const diff = Math.abs(v - answer);
      const score = [100, 60, 20][diff] ?? 0;
      for (const b of ui.controls.querySelectorAll('[data-v]')) {
        b.classList.toggle('right', Number(b.dataset.v) === answer);
        b.classList.toggle('wrong', Number(b.dataset.v) === v && v !== answer);
      }
      let why = '';
      if (v !== answer) {
        const tooLight = v > answer;
        if (kind === 'contrast' && (sL < target) === tooLight) {
          why = `A ${sL < target ? 'dark' : 'light'} surround makes whatever sits on it look ${sL < target ? 'lighter' : 'darker'} than it is - simultaneous contrast. Judge a value against the scale, not against its neighbour.`;
        } else if (kind === 'gradient') {
          why = 'On a gradient the patch borrows from whichever side is nearer. Squint, and compare it with one scale step at a time.';
        } else if (coloured) {
          why = `Colour hides value: a strong ${hueName(rgbOklch(patch)[2])} reads ${tooLight ? 'lighter' : 'darker'} than its grey equivalent to most eyes. Squinting drains the colour and leaves the value.`;
        } else why = 'Try squinting: fine detail and edges drop away, and the value is what is left.';
      }
      ui.done(score, `It was <b>${answer}</b> (L* ${Math.round(target)}); you said ${v}. ${why}
        <div class="tv-compare"><span style="background:${rgbCss(patch)}"></span><span style="background:${rgbCss(greyOfLstar(answer * 10))}"></span><em>the patch beside its grey</em></div>`);
    };
    ui.controls.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) answerWith(Number(b.dataset.v)); });
    return { key: e => { const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code); if (m) { answerWith(Number(m[1])); return true; } } };
  },
};

/* --------------------------------------------------------------- colour */
const TRAIN_COLOUR = {
  id: 'colour', title: 'Colour', icon: 'pipette',
  blurb: 'Mix the target by hue, chroma and value - and see which of the three you missed, and which way.',
  task(i, ui) {
    const inContext = i >= TRAIN_ROUNDS / 2;
    let tL, tC, th, rgb;
    do { tL = rnd(0.35, 0.88); tC = rnd(0.03, 0.17); th = rnd(0, 360); rgb = lchRgb(tL, tC, th); }
    while (Math.abs(rgbOklch(rgb)[1] - tC) > 0.01); // keep it on the screen can show as asked
    const surround = inContext ? rgbCss(lchRgb(rnd(0.3, 0.8), 0.18, (th + rnd(120, 240)) % 360)) : '#3a3a3e';
    const me = { L: 0.6, C: 0.02, h: Math.round(rnd(0, 360)) };
    ui.prompt(inContext
      ? 'Mix the colour of the <b>small square</b> - as it is, not as its surround makes it look. Yours is shown on neutral grey.'
      : 'Mix the target: set its <b>hue</b>, then its <b>chroma</b> (how far from grey), then its <b>value</b>.');
    const H = trainStageH();
    ui.stage.innerHTML = `<div class="tc-pair" style="height:${H}px">
      <div class="tc-side" style="background:${surround}"><div class="tc-target" style="background:${rgbCss(rgb)}${inContext ? ';width:26%;height:26%' : ''}"></div><em>target</em></div>
      <div class="tc-side" style="background:#3a3a3e"><div class="tc-target" id="tcMine"></div><em>yours</em></div></div>`;
    const sliders = [['h', 'Hue', 0, 360, 1], ['C', 'Chroma', 0, 0.25, 0.002], ['L', 'Value', 0, 1, 0.002]];
    ui.controls.innerHTML = `<div class="tc-sliders">${sliders.map(([k, label, a, b, st]) =>
      `<label><span>${label}</span><input type="range" data-c="${k}" min="${a}" max="${b}" step="${st}" value="${me[k]}"></label>`).join('')}</div>
      <button type="button" class="ghost tc-check" id="tcCheck">Check (Enter)</button>`;
    const paint = () => {
      el('tcMine').style.background = rgbCss(lchRgb(me.L, me.C, me.h));
      // Each track shows what moving it would do, from where the other two are.
      const stops = (f, n = 12) => [...Array(n + 1).keys()].map(j => rgbCss(f(j / n))).join(', ');
      const bg = { h: stops(t => lchRgb(me.L, Math.max(me.C, 0.08), t * 360), 18), C: stops(t => lchRgb(me.L, t * 0.25, me.h)), L: stops(t => lchRgb(t, me.C, me.h)) };
      for (const inp of ui.controls.querySelectorAll('[data-c]')) inp.style.background = `linear-gradient(90deg, ${bg[inp.dataset.c]})`;
    };
    ui.controls.addEventListener('input', e => { const k = e.target.dataset.c; if (k && !ui.answered()) { me[k] = Number(e.target.value); paint(); } });
    paint();
    const check = () => {
      if (ui.answered()) return;
      const mine = lchRgb(me.L, me.C, me.h);
      const [a, b] = [rgb, mine].map(c => linToOklab(...c.map(v => srgbToLin(v / 255))));
      const dE = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const score = Math.round(100 * clamp01(1 - dE / 0.2));
      const [L1, C1, h1] = rgbOklch(rgb), [L2, C2, h2] = rgbOklch(mine);
      const notes = [];
      const dv = lstar(mine) - lstar(rgb);
      if (Math.abs(dv) > 3) notes.push(`value <b>${dv > 0 ? 'too light' : 'too dark'}</b> by ${Math.round(Math.abs(dv))} L*`);
      if (Math.abs(C2 - C1) > 0.015) notes.push(`<b>${C2 > C1 ? 'too intense' : 'too grey'}</b>`);
      const dh = ((h2 - h1 + 540) % 360) - 180;
      if (C1 > 0.04 && Math.abs(dh) > 8) notes.push(`hue <b>${Math.round(Math.abs(dh))}° off</b>, towards ${hueName(h2)} - the target is a ${hueName(h1)}`);
      ui.done(score, `${notes.length ? 'Yours is ' + notes.join(', ') + '.' : 'Every one of hue, chroma and value within a hair.'}
        ${inContext ? ' The surround pulled the target towards its opposite - a warm surround makes a colour look cooler, a bright one makes it look duller.' : ''}
        <div class="tv-compare"><span style="background:${rgbCss(rgb)}"></span><span style="background:${rgbCss(mine)}"></span><em>target, yours - side by side on grey</em></div>`);
    };
    el('tcCheck').addEventListener('click', check);
    return { key: e => { if (e.code === 'Enter' && !ui.answered()) { check(); return true; } } };
  },
};

/* -------------------------------------------------------------- anatomy
   The canon a figure is built on: an ideal figure eight heads tall, and the
   head itself (Loomis's front view). Idealised - real people vary - but it
   is the scaffold every figure-drawing book starts from. */
const FIGURE_MARKS = [
  ['Chin', 1, 'The first head ends at the chin.'],
  ['Top of the shoulders', 1.33, 'A third of a head under the chin - the neck is shorter than it feels.'],
  ['Nipples', 2, 'Exactly two heads down.'],
  ['Elbows, arms hanging', 2.95, 'Level with the navel and the narrowest part of the waist.'],
  ['Navel', 3, 'Three heads down - level with the elbows.'],
  ['Wrists, arms hanging', 3.9, 'About level with the crotch.'],
  ['Crotch', 4, 'Halfway: the legs are half the height.'],
  ['Fingertips, arms hanging', 4.9, 'Around mid-thigh - arms are longer than they look.'],
  ['Bottom of the kneecaps', 6, 'Six heads - two more to the soles.'],
];
const HEAD_MARKS = [
  ['Eye line', 0.5, 'Halfway down the head. Almost everyone puts the eyes too high - the skull above them is big.'],
  ['Brow line', 0.4, 'Just above the eyes: the face from hairline to chin splits in three - hairline, brow, nose, chin.'],
  ['Bottom of the nose', 0.7, 'Two thirds of the way from hairline to chin. The ears sit between the brow and here.'],
  ['Mouth (lips meet)', 0.8, 'A third of the way from the nose to the chin.'],
  ['Hairline', 0.1, 'Seen from the front the crown curves away, so the hairline sits near the top.'],
];
const TRAIN_ANATOMY = {
  id: 'anatomy', title: 'Anatomy', icon: 'figure',
  blurb: 'Where the landmarks fall on an eight-heads figure and on the head - click the height, see the canon.',
  task(i, ui) {
    const head = i % 2 === 1;
    const [name, answer, why] = pick(head ? HEAD_MARKS : FIGURE_MARKS);
    const H = trainStageH(), pad = 24, span = H - 2 * pad;
    // Units: heads for the figure (0 crown - 8 soles), head heights for the head.
    const units = head ? 1 : 8, u = span / units;
    ui.prompt(head
      ? `Click the height of the <b>${name.toLowerCase()}</b> on this head - crown at the top, chin at the bottom.`
      : `This figure is eight heads tall. Click the height of the <b>${name.toLowerCase()}</b>.`);
    const W = ui.stage.clientWidth, cx = W / 2;
    const Y = v => pad + v * u, X = v => cx + v * u;
    const headPath = (s, ox = 0) => {
      // An egg: the cranium a circle-ish top, the jaw tapering to the chin.
      const x = v => cx + (ox + v) * s, y = v => pad + v * s;
      return `M ${x(-0.37)} ${y(0.45)} C ${x(-0.4)} ${y(-0.02)}, ${x(0.4)} ${y(-0.02)}, ${x(0.37)} ${y(0.45)}
        C ${x(0.36)} ${y(0.72)}, ${x(0.18)} ${y(1)}, ${x(0)} ${y(1)} C ${x(-0.18)} ${y(1)}, ${x(-0.36)} ${y(0.72)}, ${x(-0.37)} ${y(0.45)} Z`;
    };
    const figure = () => {
      // A plain front figure in head units - enough to see the proportions,
      // nothing more. Legs and torso as polygons, arms as thick strokes.
      const poly = pts => `<polygon points="${pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}"/>`;
      const side = sgn => [
        poly([[0, 1.25], [sgn * 0.95, 1.4], [sgn * 0.9, 2.1], [sgn * 0.62, 3], [sgn * 0.8, 3.7], [sgn * 0.78, 4.2], [sgn * 0.08, 4.1], [0, 4]]),
        poly([[sgn * 0.08, 4], [sgn * 0.8, 4], [sgn * 0.62, 5.2], [sgn * 0.46, 6], [sgn * 0.48, 6.6], [sgn * 0.3, 7.75], [sgn * 0.5, 8], [sgn * 0.1, 8], [sgn * 0.14, 7.75], [sgn * 0.15, 6.6], [sgn * 0.14, 6], [sgn * 0.1, 5]]),
        `<path d="M ${X(sgn * 0.98)} ${Y(1.45)} L ${X(sgn * 1.08)} ${Y(2.95)} L ${X(sgn * 1.02)} ${Y(3.9)} L ${X(sgn * 0.98)} ${Y(4.85)}" class="arm" style="stroke-width:${0.26 * u}px"/>`,
      ].join('');
      return `<g class="ta-body"><rect x="${X(-0.13)}" y="${Y(0.9)}" width="${0.26 * u}" height="${0.45 * u}"/>${side(-1)}${side(1)}<path d="${headPath(u)}"/></g>`;
    };
    const guides = () => head
      ? HEAD_MARKS.map(([n, v]) => `<line x1="${cx - 0.5 * u}" x2="${cx + 0.5 * u}" y1="${Y(v)}" y2="${Y(v)}" class="ta-guide"/><text x="${cx + 0.55 * u}" y="${Y(v) + 4}" class="ta-label">${n}</text>`).join('')
      : [...Array(9).keys()].map(k => `<line x1="${cx - 1.6 * u}" x2="${cx + 1.6 * u}" y1="${Y(k)}" y2="${Y(k)}" class="ta-guide"/><text x="${cx + 1.7 * u}" y="${Y(k) + 4}" class="ta-label">${k}</text>`).join('');
    const faceFeatures = () => head ? `<g class="ta-face">
        <path d="M ${cx - 0.24 * u} ${Y(0.5)} q ${0.08 * u} ${-0.05 * u} ${0.16 * u} 0 q ${-0.08 * u} ${0.05 * u} ${-0.16 * u} 0 Z"/>
        <path d="M ${cx + 0.08 * u} ${Y(0.5)} q ${0.08 * u} ${-0.05 * u} ${0.16 * u} 0 q ${-0.08 * u} ${0.05 * u} ${-0.16 * u} 0 Z"/>
        <path d="M ${cx - 0.06 * u} ${Y(0.7)} q ${0.06 * u} ${0.03 * u} ${0.12 * u} 0" /><path d="M ${cx - 0.1 * u} ${Y(0.8)} q ${0.1 * u} ${0.03 * u} ${0.2 * u} 0"/>
        <path d="M ${cx - 0.36 * u} ${Y(0.4)} q ${-0.07 * u} ${0.15 * u} 0 ${0.3 * u}"/><path d="M ${cx + 0.36 * u} ${Y(0.4)} q ${0.07 * u} ${0.15 * u} 0 ${0.3 * u}"/></g>` : '';
    const base = head
      ? `<path d="${headPath(u)}" class="ta-outline"/><line x1="${cx}" x2="${cx}" y1="${Y(0)}" y2="${Y(1)}" class="ta-axis"/>`
      : `<path d="${headPath(u)}" class="ta-outline"/><line x1="${cx}" x2="${cx}" y1="${Y(1)}" y2="${Y(8)}" class="ta-axis"/><line x1="${cx - 1.6 * u}" x2="${cx + 1.6 * u}" y1="${Y(8)}" y2="${Y(8)}" class="ta-ground"/>`;
    ui.stage.innerHTML = `<svg class="ta-svg" width="${W}" height="${H}">${base}<g id="taMark"></g></svg>`;
    const svg = ui.stage.querySelector('svg');
    svg.addEventListener('pointermove', e => {
      if (ui.answered()) return;
      const r = svg.getBoundingClientRect(), y = e.clientY - r.top;
      svg.querySelector('#taMark').innerHTML = `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="ta-hover"/>`;
    });
    svg.addEventListener('click', e => {
      if (ui.answered()) return;
      const r = svg.getBoundingClientRect(), y = e.clientY - r.top;
      const v = (y - pad) / u, err = Math.abs(v - answer);
      const tol = head ? 0.08 : 0.45;
      const score = Math.round(100 * clamp01(1 - err / tol));
      svg.innerHTML = `${head ? `<path d="${headPath(u)}" class="ta-outline"/>` + faceFeatures() : figure()}${guides()}
        <line x1="0" x2="${W}" y1="${Y(answer)}" y2="${Y(answer)}" class="ta-answer"/>
        <line x1="0" x2="${W}" y1="${y}" y2="${y}" class="ta-yours"/>`;
      const off = head ? `${Math.round(err * 100)}% of the head's height` : `${err.toFixed(2)} heads`;
      ui.done(score, `<b>${name}</b>: ${head ? `${Math.round(answer * 100)}% of the way down` : `${answer} heads down`}. You were ${off} ${v < answer ? 'too high' : 'too low'}. ${why}
        <span class="ta-key"><i class="a"></i> the canon <i class="y"></i> yours</span>`);
    });
  },
};

/* --------------------------------------------------------- lines, ellipses
   The hand. One confident stroke each: a straight line between two dots, a
   circle round a dot, an ellipse on an axis at a given degree. Scored on
   how far the stroke strays from the true shape, as a share of its size. */
const TRAIN_LINES = {
  id: 'lines', title: 'Lines and ellipses', icon: 'pen',
  blurb: 'Straight lines, circles and ellipses in one stroke - with a tablet or a mouse. Drawn from the shoulder.',
  task(i, ui) {
    const kind = ['line', 'ellipse', 'circle'][i % 3];
    const cv = trainCanvas(ui.stage, trainStageH()), { ctx, w, h } = cv;
    let target = null;
    const dot = ([x, y], col = '#e3a043') => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); };
    const bg = () => { ctx.fillStyle = '#f1ede4'; ctx.fillRect(0, 0, w, h); };
    bg();
    if (kind === 'line') {
      const len = rnd(0.45, 0.8) * Math.min(w, h * 1.6), a = rnd(0, Math.PI);
      const c = [w / 2 + rnd(-0.1, 0.1) * w, h / 2 + rnd(-0.1, 0.1) * h];
      const d = [Math.cos(a) * len / 2, Math.sin(a) * len / 2];
      target = { A: [c[0] - d[0], c[1] - d[1]], B: [c[0] + d[0], c[1] + d[1]], len };
      // Kept inside the paper.
      const fit = Math.min(1, ...[target.A, target.B].flatMap(([x, y]) => [(w / 2 - 20) / Math.abs(x - w / 2 || 1), (h / 2 - 20) / Math.abs(y - h / 2 || 1)]));
      if (fit < 1) { target.A = target.A.map((v, k) => c[k] + (v - c[k]) * fit); target.B = target.B.map((v, k) => c[k] + (v - c[k]) * fit); target.len *= fit; }
      dot(target.A); dot(target.B);
      ui.prompt('Join the two dots with <b>one straight stroke</b>. Aim, ghost it in the air a couple of times, then commit.');
    } else if (kind === 'circle') {
      const r = rnd(0.18, 0.36) * Math.min(w, h);
      target = { c: [w / 2, h / 2], r };
      dot(target.c, '#999');
      ctx.fillStyle = '#777'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`about ${Math.round(r * 2)} px across`, w / 2, h - 14);
      ui.prompt('Draw <b>a circle</b> round the dot, about the size written under it - one stroke, closing where it started.');
    } else {
      const deg = pick([15, 25, 35, 45, 60]), a = rnd(0, Math.PI), A = rnd(0.22, 0.4) * Math.min(w, h * 1.4);
      target = { c: [w / 2, h / 2], A, B: A * Math.sin(deg * Math.PI / 180), a, deg };
      const ends = [-1, 1].map(s => [w / 2 + s * Math.cos(a) * A, h / 2 + s * Math.sin(a) * A]);
      ctx.strokeStyle = '#bbb'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(...ends[0]); ctx.lineTo(...ends[1]); ctx.stroke(); ctx.setLineDash([]);
      ends.forEach(p => dot(p));
      ui.prompt(`Draw a <b>${deg}° ellipse</b> on this axis - its ends on the two dots, its width ${Math.round(Math.sin(deg * Math.PI / 180) * 100)}% of its length.`);
    }
    let pts = null;
    const c = cv.c;
    c.addEventListener('pointerdown', e => {
      if (ui.answered()) return;
      pts = [cv.pos(e)];
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', e => {
      if (!pts) return;
      const p = cv.pos(e), q = pts[pts.length - 1];
      pts.push(p);
      ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(...q); ctx.lineTo(...p); ctx.stroke();
    });
    c.addEventListener('pointerup', () => {
      if (!pts) return;
      const s = pts; pts = null;
      if (s.length < 8) return; // a tap, not a stroke
      ctx.strokeStyle = 'rgba(40, 150, 90, .85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      let score, text;
      if (kind === 'line') {
        const { A, B, len } = target, ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len;
        const dev = s.reduce((m, [x, y]) => m + Math.abs((x - A[0]) * uy - (y - A[1]) * ux), 0) / s.length;
        const [p0, p1] = [s[0], s[s.length - 1]], d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        const ends = Math.min(d(p0, A) + d(p1, B), d(p0, B) + d(p1, A)) / 2;
        const s1 = clamp01(1 - (dev / len) / 0.03), s2 = clamp01(1 - ends / (len * 0.08));
        score = Math.round(100 * (0.65 * s1 + 0.35 * s2));
        ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke();
        text = `Wobble: <b>${(dev / len * 100).toFixed(1)}%</b> of its length on average · ends missed by <b>${Math.round(ends)} px</b>. ${dev / len > 0.02 ? 'A wobbly line is usually drawn from the wrist - lock it and move from the shoulder, faster.' : ''}`;
      } else if (kind === 'circle') {
        // The best-fitting circle (least squares): how round the stroke is,
        // whatever size it came out.
        const n = s.length, mx = s.reduce((a, p) => a + p[0], 0) / n, my = s.reduce((a, p) => a + p[1], 0) / n;
        let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
        for (const [x, y] of s) { const u = x - mx, v = y - my; suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u; }
        const det = suu * svv - suv * suv || 1e-9;
        const uc = (0.5 * (suuu + suvv) * svv - 0.5 * (svvv + svuu) * suv) / det;
        const vc = (0.5 * (svvv + svuu) * suu - 0.5 * (suuu + suvv) * suv) / det;
        const cx = mx + uc, cy = my + vc, rs = s.map(([x, y]) => Math.hypot(x - cx, y - cy));
        const R = rs.reduce((a, b) => a + b, 0) / n, cvr = Math.sqrt(rs.reduce((a, r) => a + (r - R) ** 2, 0) / n) / R;
        const gap = Math.hypot(s[0][0] - s[n - 1][0], s[0][1] - s[n - 1][1]) / R;
        const sizeErr = Math.abs(R - target.r) / target.r;
        score = Math.round(100 * (0.7 * clamp01(1 - cvr / 0.08) + 0.15 * clamp01(1 - gap / 0.6) + 0.15 * clamp01(1 - sizeErr / 0.35)));
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
        text = `Roundness: radius varies <b>${(cvr * 100).toFixed(1)}%</b> · ${gap > 0.3 ? 'the ends did not meet' : 'closed cleanly'} · ${Math.round(R * 2)} px across for ${Math.round(target.r * 2)}. ${cvr > 0.05 ? 'Flat spots come from the elbow joining in half-way - go round a few times in the air first.' : ''}`;
      } else {
        const { c: [cx, cy], A, B, a } = target, ca = Math.cos(a), sa = Math.sin(a);
        const ring = [...Array(360).keys()].map(k => { const t = k * Math.PI / 180, x = A * Math.cos(t), y = B * Math.sin(t); return [cx + x * ca - y * sa, cy + x * sa + y * ca]; });
        const dev = s.reduce((m, p) => m + Math.min(...ring.map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))), 0) / s.length;
        // Its width as drawn: the stroke's spread across the axis.
        const across = s.map(([x, y]) => (y - cy) * ca - (x - cx) * sa);
        const drawnB = (Math.max(...across) - Math.min(...across)) / 2;
        const drawnDeg = Math.asin(clamp01(drawnB / A)) * 180 / Math.PI;
        score = Math.round(100 * clamp01(1 - (dev / A) / 0.1));
        ctx.beginPath(); ring.forEach((p, k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke();
        text = `Off the true ellipse by <b>${(dev / A * 100).toFixed(1)}%</b> of its half-length on average; yours came out about <b>${Math.round(drawnDeg)}°</b> for ${target.deg}°. ${Math.abs(drawnDeg - target.deg) > 8 ? 'Ellipses drift fatter or thinner than meant - check the width against the length before the ends.' : 'The ends should be round, never pointed.'}`;
      }
      ctx.setLineDash([]);
      ui.done(score, text + ' <span class="ta-key"><i class="g"></i> the true shape</span>');
    });
  },
};

/* ------------------------------------------------- angles and proportions
   Sight-size's two measurements: an angle against the vertical, and one
   length against another - the pencil held at arm's length, as a drill. */
const TRAIN_MEASURE = {
  id: 'measure', title: 'Angles and proportions', icon: 'angle',
  blurb: 'Copy an angle by eye; say how many times one length goes into another. The two things you measure all day.',
  task(i, ui) {
    const cv = trainCanvas(ui.stage, trainStageH()), { ctx, w, h } = cv;
    const half = w / 2, L = Math.min(half, h) * 0.38;
    const bg = () => {
      ctx.fillStyle = '#1e1e21'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(half, 14); ctx.lineTo(half, h - 14); ctx.stroke();
    };
    const seg = (x, y, a, len, col, width = 3) => {
      ctx.strokeStyle = col; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    };
    if (i % 2 === 0) {
      // Angle: turn the right-hand line to match the left.
      const ref = rnd(0, Math.PI);
      let mine = ref + (Math.random() < 0.5 ? -1 : 1) * rnd(0.35, 1.1);
      ui.prompt('Turn the right-hand line to the <b>same angle</b> as the left one - drag anywhere on the right. Then Check.');
      const draw = (show) => {
        bg(); seg(half / 2, h / 2, ref, L, '#e6e6ea');
        seg(half * 1.5, h / 2, mine, L, '#e3a043');
        ctx.fillStyle = '#e3a043'; ctx.beginPath(); ctx.arc(half * 1.5, h / 2, 4, 0, 7); ctx.fill();
        if (show) { ctx.setLineDash([6, 5]); seg(half * 1.5, h / 2, ref, L, 'rgba(90, 200, 130, .9)', 2); ctx.setLineDash([]); }
      };
      draw(false);
      let drag = false;
      const aim = e => { const [x, y] = cv.pos(e); mine = Math.atan2(y - h / 2, x - half * 1.5); draw(false); };
      cv.c.addEventListener('pointerdown', e => { if (ui.answered()) return; drag = true; cv.c.setPointerCapture(e.pointerId); aim(e); });
      cv.c.addEventListener('pointermove', e => { if (drag) aim(e); });
      cv.c.addEventListener('pointerup', () => { drag = false; });
      ui.controls.innerHTML = '<button type="button" class="ghost" id="tmCheck">Check (Enter)</button>';
      const check = () => {
        if (ui.answered()) return;
        // Lines have no direction: 10° and 190° are the same line.
        let err = ((mine - ref) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
        const deg = Math.abs(err) * 180 / Math.PI;
        draw(true);
        const fromVert = a => { const d = Math.abs(((a * 180 / Math.PI) % 180 + 180) % 180 - 90); return Math.round(d); };
        ui.done(Math.round(100 * clamp01(1 - deg / 12)),
          `Off by <b>${deg.toFixed(1)}°</b>. The left line leans ${fromVert(ref)}° from vertical. ${deg > 4 ? 'Angles near 45° are the hardest to judge - compare with the vertical and the horizontal both, not with nothing.' : ''} <span class="ta-key"><i class="g"></i> the left line's angle</span>`);
      };
      el('tmCheck').addEventListener('click', check);
      return { key: e => { if (e.code === 'Enter' && !ui.answered()) { check(); return true; } } };
    }
    // Proportion: how many A in B?
    const unit = rnd(0.12, 0.3) * h;
    const ratio = Math.random() < 0.8 ? rnd(1.3, 4.5) : rnd(0.4, 0.9);
    const bLen = Math.min(unit * ratio, half * 0.85, h * 0.85), realRatio = bLen / unit;
    const bAngle = rnd(0, Math.PI);
    ui.prompt('How many times does <b>A</b> go into <b>B</b>? Set it on the slider, then Check.');
    const draw = (show) => {
      bg();
      seg(half / 2, h / 2, Math.PI / 2, unit / 2, '#e6e6ea');
      seg(half * 1.5, h / 2, bAngle, bLen / 2, '#e3a043');
      ctx.fillStyle = '#999'; ctx.font = '13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('A', half / 2 + 18, h / 2 + 4); ctx.fillText('B', half * 1.5, h - 16);
      if (show) {
        ctx.fillStyle = 'rgba(90, 200, 130, .95)';
        for (let k = 0; k <= Math.floor(realRatio); k++) {
          const t = -bLen / 2 + k * unit;
          ctx.beginPath(); ctx.arc(half * 1.5 + Math.cos(bAngle) * t, h / 2 + Math.sin(bAngle) * t, 4, 0, 7); ctx.fill();
        }
      }
    };
    draw(false);
    ui.controls.innerHTML = `<div class="tm-ratio"><input type="range" id="tmRatio" min="${Math.log(0.25)}" max="${Math.log(5)}" step="0.005" value="${Math.log(2)}"><output id="tmOut">B = 2.00 × A</output></div>
      <button type="button" class="ghost" id="tmCheck">Check (Enter)</button>`;
    const val = () => Math.exp(Number(el('tmRatio').value));
    el('tmRatio').addEventListener('input', () => { el('tmOut').textContent = `B = ${val().toFixed(2)} × A`; });
    const check = () => {
      if (ui.answered()) return;
      const u = val(), err = Math.abs(Math.log(u / realRatio));
      draw(true);
      ui.done(Math.round(100 * clamp01(1 - err / Math.log(1.3))),
        `B is <b>${realRatio.toFixed(2)}</b> × A; you said ${u.toFixed(2)} - ${Math.round(Math.abs(u / realRatio - 1) * 100)}% ${u > realRatio ? 'over' : 'under'}. ${Math.abs(Math.cos(bAngle)) > 0.5 ? 'A length lying down looks shorter than the same length standing up - the vertical-horizontal illusion.' : ''} <span class="ta-key"><i class="g"></i> A stepped along B</span>`);
    };
    el('tmCheck').addEventListener('click', check);
    return { key: e => { if (e.code === 'Enter' && !ui.answered()) { check(); return true; } } };
  },
};

/* ---------------------------------------------------------- perspective */
const TRAIN_PERSPECTIVE = {
  id: 'perspective', title: 'Perspective', icon: 'cube',
  blurb: 'Find where a box\'s edges meet, and where your eye level is - from the box alone.',
  task(i, ui) {
    const cv = trainCanvas(ui.stage, trainStageH()), { ctx, w, h } = cv;
    const bg = () => { ctx.fillStyle = '#1e1e21'; ctx.fillRect(0, 0, w, h); };
    const line = (a, b, col, width = 2, dash = []) => { ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]); };
    const toward = (p, v, t) => [p[0] + (v[0] - p[0]) * t, p[1] + (v[1] - p[1]) * t];
    const hz = rnd(0.2, 0.8) * h;
    const face = (x0, top, bot, vp, t) => {
      const a = [x0, top], b = [x0, bot], c = toward(b, vp, t), d = toward(a, vp, t);
      ctx.fillStyle = 'rgba(227, 160, 67, .10)';
      ctx.beginPath(); [a, b, c, d].forEach((p, k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
      line(a, d, '#e6e6ea'); line(b, c, '#e6e6ea'); line(c, d, '#e6e6ea'); line(a, b, '#e6e6ea', 2.5);
      return [a, b, c, d];
    };
    const tall = rnd(0.2, 0.38) * h, top = Math.min(Math.max(hz + rnd(-1.2, 0.2) * tall, 16), h - 16 - tall), bot = top + tall;
    if (i % 2 === 0) {
      // One face of a box: its top and bottom edges run to one vanishing
      // point, somewhere on the canvas. Click it.
      const left = Math.random() < 0.5;
      const vp = [left ? rnd(0.04, 0.3) * w : rnd(0.7, 0.96) * w, hz];
      const x0 = left ? rnd(0.62, 0.85) * w : rnd(0.15, 0.38) * w;
      bg(); const pts = face(x0, top, bot, vp, rnd(0.3, 0.5));
      ui.prompt('The top and bottom edges of this box face run to <b>one vanishing point</b>. Click where it is.');
      cv.c.addEventListener('click', e => {
        if (ui.answered()) return;
        const p = cv.pos(e), d = Math.hypot(p[0] - vp[0], p[1] - vp[1]);
        line(pts[0], vp, 'rgba(90, 200, 130, .8)', 1.5, [6, 5]); line(pts[1], vp, 'rgba(90, 200, 130, .8)', 1.5, [6, 5]);
        line([0, hz], [w, hz], 'rgba(90, 160, 220, .6)', 1, [2, 5]);
        ctx.fillStyle = 'rgba(90, 200, 130, 1)'; ctx.beginPath(); ctx.arc(...vp, 6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#e3a043'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(...p, 7, 0, 7); ctx.stroke();
        ui.done(Math.round(100 * clamp01(1 - d / (0.12 * w))),
          `Missed by <b>${Math.round(d)} px</b>. The point sits on eye level (blue) - the one line every receding horizontal in the scene runs to. ${Math.abs(p[1] - hz) > 20 ? 'Your point was ' + (p[1] < hz ? 'above' : 'below') + ' eye level: extend both edges with a ruler in your head, and see where they cross.' : ''} <span class="ta-key"><i class="g"></i> the edges run out</span>`);
      });
      return;
    }
    // Two faces, both vanishing points possibly off the canvas: where is
    // eye level?
    const vl = [rnd(-0.7, 0.1) * w, hz], vr = [rnd(0.9, 1.7) * w, hz], x0 = rnd(0.35, 0.65) * w;
    bg();
    const f1 = face(x0, top, bot, vl, rnd(0.25, 0.45)), f2 = face(x0, top, bot, vr, rnd(0.25, 0.45));
    ui.prompt('A box in two-point perspective. Click the height of <b>your eye level</b> - the horizon.');
    cv.c.addEventListener('click', e => {
      if (ui.answered()) return;
      const [, y] = cv.pos(e), d = Math.abs(y - hz);
      for (const [p, v] of [[f1[0], vl], [f1[1], vl], [f2[0], vr], [f2[1], vr]]) line(p, v, 'rgba(90, 200, 130, .7)', 1.5, [6, 5]);
      line([0, hz], [w, hz], 'rgba(90, 200, 130, 1)', 2);
      line([0, y], [w, y], '#e3a043', 2, [4, 4]);
      const where = hz < top ? 'above the box - you are looking up at it' : hz > bot ? 'below its top - you are looking down on it' : 'across the box';
      ui.done(Math.round(100 * clamp01(1 - d / (0.1 * h))),
        `Off by <b>${Math.round(d)} px</b>. Eye level runs ${hz < top ? 'above the box: its top edges slope down to it' : hz > bot ? 'below the box: its edges slope up to it' : 'through the box: edges above it slope down, edges below slope up'}. Where the edges are level, that is eye level. <span class="ta-key"><i class="g"></i> the horizon, from the edges</span>`);
    });
  },
};

const TRAINERS = [TRAIN_VALUE, TRAIN_COLOUR, TRAIN_ANATOMY, TRAIN_MEASURE, TRAIN_LINES, TRAIN_PERSPECTIVE];

/* ---- sources for the trainers that need a picture. The 3D figure is
   rendered off screen by the same engine as the 3D view (which it loads on
   first use); a library image comes from the index when there is one. */
async function trainFigureUrl({ plain = false } = {}) {
  await loadSection('forms');
  showForms();
  await formsLoading;
  if (!forms) throw new Error('the 3D engine could not load');
  const base = { ...structuredClone(formScene), active: 0, lightOn: 0 };
  base.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'figure', color: plain ? '#6f6a64' : '#cfc7bb' }];
  const sc = randomFormScene(base, false);
  Object.assign(sc, { lines: false, zones: false, floorGrid: false, zoom: 1, focal: 50, pitch: Math.round(rnd(0, 25)) });
  if (plain) {
    // Facing you, limbs away from the body - so there is space between
    // them to see. Side on, a figure has almost none.
    const o = sc.objects[0], p = { ...o.pose };
    o.ry = Math.round(wrap180(sc.yaw + rnd(-35, 35)));
    p['upperArm.L'] = [rnd(-40, 20), 0, rnd(25, 80)]; p['upperArm.R'] = [rnd(-40, 20), 0, -rnd(25, 80)];
    p['forearm.L'] = [-rnd(15, 110), 0, 0]; p['forearm.R'] = [-rnd(15, 110), 0, 0];
    p['thigh.L'] = [p['thigh.L'] ? p['thigh.L'][0] : 0, 0, rnd(6, 24)]; p['thigh.R'] = [p['thigh.R'] ? p['thigh.R'][0] : 0, 0, -rnd(6, 24)];
    o.pose = cleanFormPose(p);
  }
  // Plain: the figure on white with no floor, for cutting out its shape.
  if (plain) Object.assign(sc, { bg: '#ffffff', ground: false, fillOn: false });
  return URL.createObjectURL(await formsSnapshot(sc));
}
function trainLibraryImage() {
  if (!INDEX) return null;
  const all = [];
  for (const pack of INDEX.packs) for (const g of pack.groups) for (const img of g.images) if (!isSkipped(img.src)) all.push(img.src);
  return all.length ? displayCandidates(pick(all))[0] : null;
}
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
const trainUrls = [];
function trainKeepUrl(u) { trainUrls.push(u); while (trainUrls.length > 4) URL.revokeObjectURL(trainUrls.shift()); return u; }
const trainLoading = (ui, text = 'Rendering...') => { ui.stage.innerHTML = `<div class="train-wait" style="height:${trainStageH()}px">${text}</div>`; };
const trainAlive = ui => document.body.contains(ui.stage);

/* -------------------------------------------------------------- gesture
   The figure, posed at random, for as long as you choose - then hidden,
   while you finish from what you took in. No machine can mark a gesture, so
   you do: honestly, against the pose shown again. Compare in the viewer lays
   a photo of your drawing over it. */
const GESTURE_SECS = [30, 60, 120];
const TRAIN_GESTURE = {
  id: 'gesture', title: 'Gesture', icon: 'figure',
  blurb: 'A random pose on the 3D figure, timed - then hidden while you finish. Judge it against the pose, or lay your photo over it.',
  task(i, ui) {
    let secs = 30;
    try { secs = Number(localStorage.getItem('refboard.gestureSecs.v1')) || 30; } catch {}
    ui.prompt('Draw the <b>line of action</b> first - the one curve through the spine - then hang the rest on it.');
    trainLoading(ui, 'Posing the figure...');
    trainFigureUrl().then(url => {
      if (!trainAlive(ui)) { URL.revokeObjectURL(url); return; }
      trainKeepUrl(url);
      const H = trainStageH();
      ui.stage.innerHTML = `<div class="tg-wrap" style="height:${H}px"><img src="${url}" alt="" id="tgImg"><div class="tg-cover hidden" id="tgCover"></div>
        <div class="tg-bar"><i id="tgFill"></i></div></div>`;
      ui.controls.innerHTML = `<div class="chips" id="tgSecs">${GESTURE_SECS.map(v => `<button type="button" class="chip" data-s="${v}" aria-pressed="${v === secs}">${fmt(v)}</button>`).join('')}</div>
        <button type="button" class="ghost" id="tgDone">Done - hide it</button>`;
      let left = secs, timer = 0;
      const tick = () => {
        if (!trainAlive(ui)) { clearInterval(timer); return; }
        left -= 0.25;
        el('tgFill').style.width = Math.max(0, left / secs * 100) + '%';
        if (left <= 0) finish();
      };
      const finish = () => {
        clearInterval(timer);
        if (!trainAlive(ui) || ui.answered()) return;
        el('tgCover').classList.remove('hidden');
        el('tgCover').innerHTML = `<div>Time. Finish from memory - then look again and be honest.</div>
          <div class="factions" style="justify-content:center"><button type="button" class="ghost" id="tgShow">Show the pose</button></div>`;
        ui.controls.innerHTML = '';
        el('tgShow').addEventListener('click', () => {
          el('tgCover').classList.add('hidden');
          ui.controls.innerHTML = `<span class="count">How close is your gesture?</span>
            <button type="button" class="ghost" data-g="100">Caught it</button>
            <button type="button" class="ghost" data-g="70">Close - small misses</button>
            <button type="button" class="ghost" data-g="35">The pose is off</button>
            <button type="button" class="ghost" id="tgViewer" title="Open the pose in the viewer, where Compare (d) lays a photo of your drawing over it">Compare in viewer</button>`;
          ui.controls.addEventListener('click', e => {
            if (e.target.id === 'tgViewer') {
              startSession([{ frames: [url], pack: 'Train', group: 'Gesture' }], { browse: true, label: 'Train' });
              return;
            }
            const b = e.target.closest('[data-g]');
            if (!b) return;
            const sc = Number(b.dataset.g);
            ui.done(sc, sc === 100 ? 'Good - the same curve through the spine, the same tilt of hips against shoulders.'
              : 'Check the three things a gesture is: the curve of the spine, the tilt of the hips against the shoulders, and which leg carries the weight.');
          });
        });
      };
      el('tgSecs').addEventListener('click', e => {
        const b = e.target.closest('[data-s]');
        if (!b) return;
        secs = left = Number(b.dataset.s);
        try { localStorage.setItem('refboard.gestureSecs.v1', String(secs)); } catch {}
        for (const c of el('tgSecs').children) c.setAttribute('aria-pressed', String(c === b));
      });
      el('tgDone').addEventListener('click', finish);
      timer = setInterval(tick, 250);
    }).catch(err => { if (trainAlive(ui)) trainLoading(ui, 'The 3D figure needs WebGL and the 3D engine: ' + esc(err.message || String(err))); });
  },
};

/* -------------------------------------------------------- negative space
   The shapes between the figure and itself, or the figure and its frame -
   easier to see true than the figure, because the mind has no idea what a
   negative shape "should" look like. Pick the true one of three: the other
   two are the same area stretched or turned. */
async function trainNegativeShape() {
  for (let tries = 0; tries < 5; tries++) {
    const url = await trainFigureUrl({ plain: true });
    const im = await loadImg(url);
    const W = 260, H = Math.round(W * im.naturalHeight / im.naturalWidth);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data, fg = new Uint8Array(W * H);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let k = 0; k < W * H; k++) {
      if (Math.min(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]) < 238) {
        fg[k] = 1;
        const px = k % W, py = (k / W) | 0;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
    }
    if (x1 <= x0) { URL.revokeObjectURL(url); continue; }
    // The frame: the figure's own box, tight. Touching all four sides, the
    // figure cuts the space around it into separate shapes, closed off by
    // the frame edge as much as by the figure - which is how a drawing's
    // own border cuts them.
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, lab = new Int32Array(bw * bh).fill(-1), comps = [];
    for (let py = 0; py < bh; py++) for (let px = 0; px < bw; px++) {
      const k = py * bw + px;
      if (lab[k] >= 0 || fg[(py + y0) * W + px + x0]) continue;
      const id = comps.length, stack = [k], pix = [];
      lab[k] = id;
      while (stack.length) {
        const q = stack.pop(); pix.push(q);
        const qx = q % bw, qy = (q / bw) | 0;
        for (const [nx, ny] of [[qx + 1, qy], [qx - 1, qy], [qx, qy + 1], [qx, qy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          const n = ny * bw + nx;
          if (lab[n] < 0 && !fg[(ny + y0) * W + nx + x0]) { lab[n] = id; stack.push(n); }
        }
      }
      comps.push(pix);
    }
    const area = bw * bh;
    // Not too small to see, not most of the frame, and not a plain box -
    // a shape that nearly fills its own bounding box teaches nothing.
    const fill = p => {
      const xs = p.map(q => q % bw), ys = p.map(q => (q / bw) | 0);
      return p.length / ((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1));
    };
    const good = comps.filter(p => p.length > area * 0.02 && p.length < area * 0.38 && fill(p) < 0.78);
    if (!good.length) { URL.revokeObjectURL(url); continue; }
    const pix = pick(good);
    return { url, im, W, H, box: [x0, y0, bw, bh], pix, bw };
  }
  throw new Error('no clear negative shape in five poses');
}
const TRAIN_NEGATIVE = {
  id: 'negative', title: 'Negative space', icon: 'similar',
  blurb: 'See the shapes around the figure instead of the figure - pick the true one from three near-misses.',
  task(i, ui) {
    ui.prompt('Look at the empty shape marked with the dot - the space, not the body. Which of the three is <b>that shape</b>?');
    trainLoading(ui, 'Posing the figure...');
    trainNegativeShape().then(ns => {
      if (!trainAlive(ui)) { URL.revokeObjectURL(ns.url); return; }
      trainKeepUrl(ns.url);
      const H = trainStageH(), [x0, y0, bw, bh] = ns.box;
      const scale = Math.min((H - 20) / bh, (ui.stage.clientWidth * 0.42) / bw);
      // A shape's own mask, as a canvas at display scale.
      const minX = Math.min(...ns.pix.map(q => q % bw)), maxX = Math.max(...ns.pix.map(q => q % bw));
      const minY = Math.min(...ns.pix.map(q => (q / bw) | 0)), maxY = Math.max(...ns.pix.map(q => (q / bw) | 0));
      const sw = maxX - minX + 1, sh = maxY - minY + 1;
      const mask = document.createElement('canvas'); mask.width = sw; mask.height = sh;
      const mx = mask.getContext('2d'), md = mx.createImageData(sw, sh);
      for (const q of ns.pix) { const k = (((q / bw) | 0) - minY) * sw + (q % bw) - minX; md.data[k * 4 + 3] = 255; }
      mx.putImageData(md, 0, 0);
      // Tinted once, here: the options draw it onto their own paper.
      mx.globalCompositeOperation = 'source-in'; mx.fillStyle = '#2c2a28'; mx.fillRect(0, 0, sw, sh);
      // Three versions of the same area: true, stretched one way, turned.
      const f = rnd(1.28, 1.42);
      const variants = [{ ok: true, t: [1, 1, 0] }, { t: Math.random() < 0.5 ? [f, 1 / f, 0] : [1 / f, f, 0] }, { t: [1, 1, pick([-1, 1]) * rnd(18, 28)] }];
      variants.sort(() => Math.random() - 0.5);
      const cell = Math.round(Math.min(H / 3 - 12, 160));
      ui.stage.innerHTML = `<div class="tn-wrap" style="height:${H}px"><canvas id="tnRef"></canvas><div class="tn-opts">${variants.map((v, k) => `<button type="button" data-k="${k}"><canvas width="${cell}" height="${cell}"></canvas></button>`).join('')}</div></div>`;
      const ref = el('tnRef');
      ref.width = Math.round(bw * scale); ref.height = Math.round(bh * scale);
      const rx = ref.getContext('2d');
      rx.fillStyle = '#fff'; rx.fillRect(0, 0, ref.width, ref.height);
      rx.drawImage(ns.im, x0 / ns.W * ns.im.naturalWidth, y0 / ns.H * ns.im.naturalHeight, bw / ns.W * ns.im.naturalWidth, bh / ns.H * ns.im.naturalHeight, 0, 0, ref.width, ref.height);
      rx.strokeStyle = '#999'; rx.strokeRect(0.5, 0.5, ref.width - 1, ref.height - 1);
      // The dot: the shape's own pixel nearest its middle.
      const cxm = ns.pix.reduce((a, q) => a + q % bw, 0) / ns.pix.length, cym = ns.pix.reduce((a, q) => a + ((q / bw) | 0), 0) / ns.pix.length;
      const mid = ns.pix.reduce((best, q) => Math.hypot(q % bw - cxm, ((q / bw) | 0) - cym) < Math.hypot(best % bw - cxm, ((best / bw) | 0) - cym) ? q : best);
      rx.fillStyle = '#e3a043'; rx.beginPath(); rx.arc((mid % bw + 0.5) * scale, (((mid / bw) | 0) + 0.5) * scale, 6, 0, 7); rx.fill();
      // Every option at the same scale as the picture, centred in its box -
      // the same size is not the clue; the proportions are.
      const optScale = Math.min(scale, (cell - 16) / Math.max(sw * f, sh * f));
      ui.stage.querySelectorAll('.tn-opts canvas').forEach((cv, k) => {
        const [sx, sy, rot] = variants[k].t, c2 = cv.getContext('2d');
        c2.fillStyle = '#f4f1ea'; c2.fillRect(0, 0, cell, cell);
        c2.save(); c2.translate(cell / 2, cell / 2); c2.rotate(rot * Math.PI / 180); c2.scale(sx * optScale, sy * optScale);
        c2.drawImage(mask, -sw / 2, -sh / 2);
        c2.restore();
      });
      ui.stage.querySelector('.tn-opts').addEventListener('click', e => {
        const b = e.target.closest('[data-k]');
        if (!b || ui.answered()) return;
        const k = Number(b.dataset.k), v = variants[k];
        ui.stage.querySelectorAll('.tn-opts button').forEach((bb, j) => bb.classList.add(variants[j].ok ? 'right' : j === k ? 'wrong' : 'dim'));
        // Show the shape itself on the picture.
        rx.globalAlpha = 0.45; rx.fillStyle = '#e3a043';
        for (const q of ns.pix) rx.fillRect((q % bw) * scale, ((q / bw) | 0) * scale, scale + 0.5, scale + 0.5);
        rx.globalAlpha = 1;
        const how = v.ok ? '' : v.t[2] ? 'That one is the true shape turned - a tilt you would copy into the arm or the torso around it.'
          : 'That one is the true shape stretched - the same area, wrong proportions: it is how a limb comes out too long.';
        ui.done(v.ok ? 100 : 0, `${v.ok ? 'Right.' : 'Not that one.'} ${how} Drawing the empty shapes checks the figure for free: get the space between the arm and the body right, and the arm is right.`);
      });
    }).catch(err => { if (trainAlive(ui)) trainLoading(ui, 'Needs the 3D figure: ' + esc(err.message || String(err))); });
  },
};

/* ---------------------------------------------------------------- tones
   Reading value in a real picture, where colour, texture and detail get in
   the way: which of two spots is darker, where the darkest dark and the
   lightest light are. Judged on the picture blurred - squinted - since that
   is the value a painter blocks in. */
const TRAIN_TONES = {
  id: 'tones', title: 'Tone map', icon: 'squint',
  blurb: 'On real pictures: which spot is darker, where the darkest dark and lightest light are - judged squinting.',
  task(i, ui) {
    const kind = ['pair', 'dark', 'pair', 'light'][i % 4];
    ui.prompt(kind === 'pair' ? 'Which spot is <b>darker</b> - A or B? Click it, or press A or B.'
      : kind === 'dark' ? 'Click the <b>darkest dark</b> - the darkest mass, not a tiny speck.'
      : 'Click the <b>lightest light</b> - the lightest mass, not a single glint.');
    trainLoading(ui, 'Finding a picture...');
    const lib = trainLibraryImage();
    (lib ? Promise.resolve(lib) : trainFigureUrl().then(trainKeepUrl)).then(loadImg).then(im => {
      if (!trainAlive(ui)) return;
      const H = trainStageH(), maxW = ui.stage.clientWidth;
      const k = Math.min(maxW / im.naturalWidth, H / im.naturalHeight), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      ui.stage.innerHTML = `<div class="tt-wrap" style="height:${H}px"><canvas id="ttPic" width="${w}" height="${h}"></canvas></div>`;
      const cv = el('ttPic'), x = cv.getContext('2d');
      x.drawImage(im, 0, 0, w, h);
      // The squint: the picture at about 40 px across, each pixel an average.
      const sw = 40, sh = Math.max(4, Math.round(40 * h / w));
      const small = document.createElement('canvas'); small.width = sw; small.height = sh;
      const sx = small.getContext('2d', { willReadFrequently: true });
      sx.imageSmoothingQuality = 'high'; sx.drawImage(im, 0, 0, sw, sh);
      const sd = sx.getImageData(0, 0, sw, sh).data;
      const L = (gx, gy) => { const q = (Math.min(sh - 1, Math.max(0, gy)) * sw + Math.min(sw - 1, Math.max(0, gx))) * 4; return lstar([sd[q], sd[q + 1], sd[q + 2]]); };
      const at = (px, py) => L(Math.floor(px / w * sw), Math.floor(py / h * sh));
      const cells = []; for (let gy = 1; gy < sh - 1; gy++) for (let gx = 1; gx < sw - 1; gx++) cells.push([gx, gy, L(gx, gy)]);
      const toPx = ([gx, gy]) => [(gx + 0.5) / sw * w, (gy + 0.5) / sh * h];
      const squint = () => {
        // The answer is shown on the squinted picture - the view that decides it.
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(small, 0, 0, w, h);
      };
      const mark = ([px, py], col, label) => {
        x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.arc(px, py, 11, 0, 7); x.stroke();
        if (label) { x.fillStyle = col; x.font = 'bold 13px system-ui'; x.fillText(label, px + 14, py + 5); }
      };
      if (kind === 'pair') {
        let a, b, tries = 0;
        do {
          a = pick(cells); b = pick(cells); tries++;
        } while (tries < 800 && !(Math.abs(a[2] - b[2]) > 4 && Math.abs(a[2] - b[2]) < 14 && Math.hypot(a[0] - b[0], a[1] - b[1]) > sw * 0.25));
        const A = toPx(a), B = toPx(b);
        const drawMarks = () => { mark(A, '#fff', 'A'); mark(B, '#fff', 'B'); mark(A, '#111'); mark(B, '#111'); mark(A, '#fff', 'A'); mark(B, '#fff', 'B'); };
        drawMarks();
        const answer = a[2] < b[2] ? 'A' : 'B';
        const choose = c => {
          if (ui.answered()) return;
          squint(); drawMarks();
          ui.done(c === answer ? 100 : 0, `<b>${answer}</b> is darker: L* ${Math.round(Math.min(a[2], b[2]))} against ${Math.round(Math.max(a[2], b[2]))}, squinted (the picture now shows it that way). ${c === answer ? '' : 'Colour and surrounding detail fool the eye: a saturated or busy patch reads darker than it is. Squint until the detail goes.'}`);
        };
        ui.controls.innerHTML = '<button type="button" class="ghost" data-ab="A">A is darker</button><button type="button" class="ghost" data-ab="B">B is darker</button>';
        ui.controls.addEventListener('click', e => { const bb = e.target.closest('[data-ab]'); if (bb) choose(bb.dataset.ab); });
        cv.addEventListener('click', e => {
          const r = cv.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top];
          choose(Math.hypot(p[0] - A[0], p[1] - A[1]) < Math.hypot(p[0] - B[0], p[1] - B[1]) ? 'A' : 'B');
        });
        // Registered, not returned: this runs after the picture has loaded,
        // long after task() itself has returned.
        ui.keys(e => { if (e.code === 'KeyA' || e.code === 'KeyB') { choose(e.code === 'KeyA' ? 'A' : 'B'); return true; } });
        return;
      }
      const dark = kind === 'dark';
      const best = cells.reduce((m, c) => (dark ? c[2] < m[2] : c[2] > m[2]) ? c : m);
      const range = Math.max(...cells.map(c => c[2])) - Math.min(...cells.map(c => c[2])) || 1;
      cv.addEventListener('click', e => {
        if (ui.answered()) return;
        const r = cv.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top], v = at(...p);
        const off = Math.abs(v - best[2]);
        squint(); mark(toPx(best), '#5ac882', dark ? 'darkest' : 'lightest'); mark(p, '#e3a043');
        ui.done(Math.round(100 * clamp01(1 - off / (range * 0.25))), `Squinted, your spot is L* ${Math.round(v)}; the ${dark ? 'darkest' : 'lightest'} mass is ${Math.round(best[2])}. ${off > range * 0.1 ? `The ${dark ? 'darkest dark usually sits where two shadows overlap, or deep in an occlusion - not on the most contrasty edge' : 'lightest light is a mass facing the light squarely, not the sharpest highlight'}.` : 'That is the one.'} <span class="ta-key"><i class="g"></i> the answer</span>`);
      });
    }).catch(() => {
      if (!trainAlive(ui)) return;
      trainLoading(ui, 'Could not load a picture for this one.');
      ui.done(0, 'No picture could be loaded - Enter moves on.');
    });
  },
};

/* ---------------------------------------------------------- temperature
   Warm and cool are relative, and painters mean something specific: a
   colour is warmer the nearer its hue leans towards orange. So a violet-blue
   is a warm blue and a green-blue a cool one; a crimson is a cool red. */
const TRAIN_TEMPERATURE = {
  id: 'temperature', title: 'Colour temperature', icon: 'sun',
  blurb: 'Which of two is warmer - two reds, two blues, two greys - with value and intensity changed to throw you.',
  task(i, ui) {
    const warmth = h => -Math.abs(((h - 55 + 540) % 360) - 180); // nearer orange: warmer
    let h1, h2, C;
    do {
      h1 = rnd(0, 360); h2 = h1 + pick([-1, 1]) * rnd(14, 34);
      h2 = (h2 + 360) % 360;
      // Away from the far side of the wheel, where "which way is warmer"
      // stops having an answer.
    } while ([h1, h2].some(h => Math.abs(((h - 235 + 540) % 360) - 180) < 22));
    const grey = i % 3 === 2;
    C = grey ? rnd(0.012, 0.03) : rnd(0.06, 0.15);
    const L1 = rnd(0.45, 0.85), L2 = Math.min(0.9, Math.max(0.35, L1 + pick([-1, 1]) * rnd(0.05, 0.18)));
    const C2 = grey ? C : Math.max(0.04, C * rnd(0.6, 1.4));
    const a = lchRgb(L1, C, h1), b = lchRgb(L2, C2, h2);
    const askWarm = Math.random() < 0.6;
    const warmer = warmth(h1) > warmth(h2) ? 0 : 1, answer = askWarm ? warmer : 1 - warmer;
    ui.prompt(`Which is <b>${askWarm ? 'warmer' : 'cooler'}</b>${grey ? ' - two greys, barely coloured' : ''}? Click it, or press ← or →.`);
    const H = trainStageH();
    ui.stage.innerHTML = `<div class="tt-pair" style="height:${H}px"><button type="button" data-t="0" style="background:${rgbCss(a)}"></button><button type="button" data-t="1" style="background:${rgbCss(b)}"></button></div>`;
    const choose = c => {
      if (ui.answered()) return;
      ui.stage.querySelectorAll('[data-t]').forEach((bb, k) => bb.classList.add(k === answer ? 'right' : k === c ? 'wrong' : 'dim'));
      const dist = h => Math.round(Math.abs(((h - 55 + 540) % 360) - 180));
      ui.done(c === answer ? 100 : 0, `Left: a ${hueName(h1)}, ${dist(h1)}° round the wheel from orange; right: a ${hueName(h2)}, ${dist(h2)}° from it. The ${warmer ? 'right' : 'left'} one leans nearer orange, so it is the warmer. ${c === answer ? '' : 'Lighter or brighter is not warmer - temperature is only which way the hue leans.'}`);
    };
    ui.stage.addEventListener('click', e => { const bb = e.target.closest('[data-t]'); if (bb) choose(Number(bb.dataset.t)); });
    return { key: e => { if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { choose(e.code === 'ArrowLeft' ? 0 : 1); return true; } } };
  },
};

/* ---------------------------------------------------------------- edges
   Hard and soft edges, with contrast changed to lie about them: a soft edge
   with strong contrast reads harder than a sharp one that barely differs
   from its ground. Hardness here is only how quickly the edge turns. */
const TRAIN_EDGES = {
  id: 'edges', title: 'Edges', icon: 'eye',
  blurb: 'Which edge is hardest, which softest - when contrast is set to fool you.',
  task(i, ui) {
    const hardest = i % 2 === 0;
    const H = trainStageH(), W = ui.stage.clientWidth;
    const blurs = [0, 2, 6, 14].map(b => b * Math.min(W, H) / 400).sort(() => Math.random() - 0.5);
    const groundL = rnd(35, 65);
    const shapes = blurs.map((b, k) => {
      // The sharpest edges get the least contrast, often, to make it hard.
      const lowContrast = b < 3 ? Math.random() < 0.7 : Math.random() < 0.3;
      const dl = (lowContrast ? rnd(7, 13) : rnd(22, 38)) * pick([-1, 1]);
      return { b, L: Math.min(95, Math.max(5, groundL + dl)), round: Math.random() < 0.5, x: (k % 2 ? 0.72 : 0.28) * W, y: (k < 2 ? 0.3 : 0.72) * H };
    });
    const size = Math.min(W, H) * 0.22;
    ui.prompt(`Click the shape with the <b>${hardest ? 'hardest' : 'softest'}</b> edge.`);
    ui.stage.innerHTML = `<div class="te-wrap" style="height:${H}px;background:${rgbCss(greyOfLstar(groundL))}">${shapes.map((s, k) =>
      `<button type="button" data-e="${k}" style="left:${s.x - size / 2}px;top:${s.y - size / 2}px;width:${size}px;height:${size}px;border-radius:${s.round ? '50%' : '8px'};background:${rgbCss(greyOfLstar(s.L))};filter:blur(${s.b}px)"></button>`).join('')}</div>`;
    const target = blurs.indexOf(hardest ? Math.min(...blurs) : Math.max(...blurs));
    ui.stage.addEventListener('click', e => {
      if (ui.answered()) return;
      const r = ui.stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const k = shapes.reduce((m, s, j) => Math.hypot(px - s.x, py - s.y) < Math.hypot(px - shapes[m].x, py - shapes[m].y) ? j : m, 0);
      ui.stage.querySelectorAll('[data-e]').forEach((bb, j) => { bb.style.outline = j === target ? '3px solid #5ac882' : j === k ? '3px solid #d0604f' : ''; bb.style.outlineOffset = '6px'; });
      const lie = Math.abs(shapes[k].L - groundL) > Math.abs(shapes[target].L - groundL) + 8;
      ui.done(k === target ? 100 : 0, `${k === target ? 'Right.' : 'Not that one.'} ${lie && k !== target ? 'The one you picked has more contrast, which reads as a harder edge - but hardness is how quickly the change happens, not how big it is.' : 'Look along the edge itself, not at the whole shape.'} In a painting: hard edges where you want the eye, soft ones everywhere else.`);
    });
  },
};

/* ---------------------------------------------- ellipses and centres
   Two rules of drawing in perspective that the eye keeps getting wrong:
   the ellipse at the end of a cylinder has its minor axis along the
   cylinder's axis; and the middle of a rectangle in perspective is where
   its diagonals cross - not the middle of the shape on the page. */
const TRAIN_ELLIPSES = {
  id: 'ellipses', title: 'Ellipses and centres', icon: 'target',
  blurb: 'Fit a cylinder\'s ellipse to its axis; find the true middle of a rectangle in perspective.',
  task(i, ui) {
    const cv = trainCanvas(ui.stage, trainStageH()), { ctx, w, h } = cv;
    const bg = () => { ctx.fillStyle = '#1e1e21'; ctx.fillRect(0, 0, w, h); };
    const line = (a, b, col, width = 2, dash = []) => { ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]); };
    if (i % 2 === 0) {
      // A cylinder by its sides and far end; turn the near ellipse to fit.
      const ang = rnd(-70, 70) * Math.PI / 180, len = h * rnd(0.35, 0.5), R = len * rnd(0.22, 0.35), deg = rnd(20, 55);
      const ax = [Math.sin(ang), -Math.cos(ang)], nx = [Math.cos(ang), Math.sin(ang)];
      const c0 = [w / 2 - ax[0] * len / 2, h / 2 - ax[1] * len / 2], c1 = [w / 2 + ax[0] * len / 2, h / 2 + ax[1] * len / 2];
      const r = R * Math.sin(deg * Math.PI / 180);
      const ell = (c, rot, col, dash = []) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); ctx.ellipse(c[0], c[1], R, r, rot, 0, 7); ctx.stroke(); ctx.setLineDash([]); };
      const trueRot = Math.atan2(nx[1], nx[0]); // major axis across the cylinder
      let mine = trueRot + pick([-1, 1]) * rnd(0.3, 0.8);
      const draw = show => {
        bg();
        line([c0[0] + nx[0] * R, c0[1] + nx[1] * R], [c1[0] + nx[0] * R, c1[1] + nx[1] * R], '#e6e6ea');
        line([c0[0] - nx[0] * R, c0[1] - nx[1] * R], [c1[0] - nx[0] * R, c1[1] - nx[1] * R], '#e6e6ea');
        ell(c0, trueRot, '#8a8a94');
        line(c0, c1, '#55555c', 1, [4, 5]);
        ell(c1, mine, '#e3a043');
        if (show) ell(c1, trueRot, 'rgba(90, 200, 130, .95)', [6, 5]);
      };
      draw(false);
      ui.prompt('Turn the <b>orange ellipse</b> so it sits right on the end of this cylinder - drag across the picture to turn it.');
      let drag = null;
      cv.c.addEventListener('pointerdown', e => { if (ui.answered()) return; drag = { x: cv.pos(e)[0], m: mine }; cv.c.setPointerCapture(e.pointerId); });
      cv.c.addEventListener('pointermove', e => { if (!drag) return; mine = drag.m + (cv.pos(e)[0] - drag.x) / 120; draw(false); });
      cv.c.addEventListener('pointerup', () => { drag = null; });
      ui.controls.innerHTML = '<button type="button" class="ghost" id="teCheck">Check (Enter)</button>';
      const check = () => {
        if (ui.answered()) return;
        const err = Math.abs((((mine - trueRot) % Math.PI) + Math.PI * 1.5) % Math.PI - Math.PI / 2) * 180 / Math.PI;
        draw(true);
        ui.done(Math.round(100 * clamp01(1 - err / 15)), `Off by <b>${err.toFixed(1)}°</b>. The rule: an ellipse's <b>minor axis lies along the cylinder's axis</b> (the dashed line), so its long axis is square to it - however the cylinder leans. <span class="ta-key"><i class="g"></i> the true ellipse</span>`);
      };
      el('teCheck').addEventListener('click', check);
      return { key: e => { if (e.code === 'Enter' && !ui.answered()) { check(); return true; } } };
    }
    // A rectangle on a tilted plane, in perspective: click its middle.
    const f = h * 1.2, d = rnd(3.2, 4.5), tilt = rnd(0.5, 1.2), turn = rnd(-0.9, 0.9);
    const hw = rnd(0.8, 1.3), hd = rnd(0.8, 1.3), ox = rnd(-0.8, 0.8), oz = rnd(-0.6, 0.6);
    const proj = ([x, y, z]) => {
      const x1 = x * Math.cos(turn) - z * Math.sin(turn), z1 = x * Math.sin(turn) + z * Math.cos(turn);
      const y2 = y * Math.cos(tilt) - z1 * Math.sin(tilt), z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt) + d;
      return [w / 2 + f * x1 / z2, h / 2 - f * y2 / z2];
    };
    // Off the middle of the picture, so its middle is not the picture's.
    const P = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]].map(([x, y, z]) => proj([x + ox, y, z + oz]));
    const centre = proj([ox, 0, oz]);
    const naive = [P.reduce((a, p) => a + p[0], 0) / 4, P.reduce((a, p) => a + p[1], 0) / 4];
    bg();
    ctx.fillStyle = 'rgba(227, 160, 67, .1)'; ctx.beginPath(); P.forEach((p, k) => k ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 4; k++) line(P[k], P[(k + 1) % 4], '#e6e6ea');
    ui.prompt('This is a rectangle lying in perspective. Click <b>its true middle</b> - the middle in depth, not on the page.');
    const size = Math.max(...P.map(p => Math.hypot(p[0] - naive[0], p[1] - naive[1])));
    cv.c.addEventListener('click', e => {
      if (ui.answered()) return;
      const p = cv.pos(e), dist = Math.hypot(p[0] - centre[0], p[1] - centre[1]);
      line(P[0], P[2], 'rgba(90, 200, 130, .8)', 1.5, [6, 5]); line(P[1], P[3], 'rgba(90, 200, 130, .8)', 1.5, [6, 5]);
      ctx.fillStyle = '#5ac882'; ctx.beginPath(); ctx.arc(...centre, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e3a043'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(...p, 7, 0, 7); ctx.stroke();
      const nearNaive = Math.hypot(p[0] - naive[0], p[1] - naive[1]) < dist;
      ui.done(Math.round(100 * clamp01(1 - dist / (size * 0.25))), `Off by <b>${Math.round(dist)} px</b>. The middle in perspective is where the <b>diagonals cross</b>. ${nearNaive ? 'You went for the middle of the shape on the page - but the far half is drawn smaller, so the true middle sits further back.' : ''} <span class="ta-key"><i class="g"></i> the diagonals</span>`);
    });
  },
};

TRAINERS.push(TRAIN_GESTURE, TRAIN_NEGATIVE, TRAIN_TONES, TRAIN_TEMPERATURE, TRAIN_EDGES, TRAIN_ELLIPSES);


/* ---- the frame around a trainer: the home grid, the task, the result. */
function showTrain() {
  if (!trainState) renderTrainHome();
}

function renderTrainHome() {
  trainState = null;
  const st = trainStats();
  el('viewTrain').innerHTML = `<div class="train-grid">${TRAINERS.map(t => {
    const e = st[t.id], runs = e ? e.runs.slice(0, 5).map(r => r.score) : [];
    return `<button type="button" class="train-card" data-train="${t.id}">
      <span class="train-ico">${iconSvg(t.icon)}</span>
      <b>${t.title}</b><span class="train-blurb">${t.blurb}</span>
      <span class="train-score">${e ? `Best <b>${e.best}</b> · recent ${runs.join(' · ')}` : 'Not tried yet'}</span></button>`;
  }).join('')}</div>`;
}

function startTrainer(id) {
  trainState = { t: TRAINERS.find(t => t.id === id), i: 0, scores: [] };
  renderTrainTask();
}

function renderTrainTask() {
  const s = trainState, t = s.t;
  const avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null;
  el('viewTrain').innerHTML = `<div class="train-run">
    <div class="train-head">
      <button type="button" class="icon-btn" data-train-home title="All trainers (Esc)" aria-label="All trainers">${iconSvg('prev')}</button>
      <b>${t.title}</b>
      <div class="train-progress">${[...Array(TRAIN_ROUNDS).keys()].map(k => `<i class="${k < s.scores.length ? (s.scores[k] >= 70 ? 'ok' : s.scores[k] >= 40 ? 'mid' : 'bad') : k === s.i ? 'now' : ''}"></i>`).join('')}</div>
      <span class="count">${s.i + 1} / ${TRAIN_ROUNDS}${avg !== null ? ` · average ${avg}` : ''}</span>
    </div>
    <div class="train-prompt" id="trainPrompt"></div>
    <div class="train-stage" id="trainStage"></div>
    <div class="train-controls" id="trainControls"></div>
    <div class="train-feedback hidden" id="trainFeedback"></div></div>`;
  s.answered = false;
  const ui = {
    stage: el('trainStage'), controls: el('trainControls'), el,
    prompt: html => { el('trainPrompt').innerHTML = html; },
    answered: () => s.answered,
    keys: f => { s.handlers = { key: f }; },
    done: (score, html) => {
      if (s.answered) return;
      s.answered = true;
      s.scores.push(score);
      const fb = el('trainFeedback');
      fb.classList.remove('hidden');
      fb.innerHTML = `<div class="train-verdict ${score >= 70 ? 'ok' : score >= 40 ? 'mid' : 'bad'}"><b>${score}</b><span>${scoreWord(score)}</span></div>
        <div class="train-why">${html}</div>
        <button type="button" class="ghost train-next" data-train-next>${s.i + 1 < TRAIN_ROUNDS ? 'Next (Enter)' : 'See the result (Enter)'}</button>`;
    },
  };
  s.handlers = {};
  const h = t.task(s.i, ui);
  if (h) s.handlers = h;
}

function renderTrainResult() {
  const s = trainState, avg = Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length);
  const prev = trainStats()[s.t.id];
  saveTrainResult(s.t.id, avg);
  const best = !prev || avg > prev.best;
  s.done = true;
  el('viewTrain').innerHTML = `<div class="train-run train-result">
    <div class="train-head"><button type="button" class="icon-btn" data-train-home title="All trainers (Esc)" aria-label="All trainers">${iconSvg('prev')}</button><b>${s.t.title}</b></div>
    <div class="train-big">${avg}<span>${best ? 'a new best' : `best ${prev.best}`}</span></div>
    <div class="train-bars">${s.scores.map(v => `<i style="height:${Math.max(v, 3)}%" class="${v >= 70 ? 'ok' : v >= 40 ? 'mid' : 'bad'}" title="${v}"></i>`).join('')}</div>
    <div class="factions" style="justify-content:center">
      <button type="button" class="ghost" data-train="${s.t.id}">Again (Enter)</button>
      <button type="button" class="ghost" data-train-home>All trainers</button></div></div>`;
}

function trainNext() {
  const s = trainState;
  if (!s || !s.answered) return;
  s.i++;
  if (s.i >= TRAIN_ROUNDS) renderTrainResult(); else renderTrainTask();
}

function initTrain() {
  el('viewTrain').addEventListener('click', e => {
    const b = e.target.closest('[data-train], [data-train-home], [data-train-next]');
    if (!b) return;
    if (b.dataset.train) startTrainer(b.dataset.train);
    else if (b.hasAttribute('data-train-home')) renderTrainHome();
    else trainNext();
  });
  document.addEventListener('keydown', e => {
    if (el('viewTrain').classList.contains('hidden') || !trainState) return;
    if (!el('session').classList.contains('hidden') || !el('helpOverlay').classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Escape') { e.preventDefault(); renderTrainHome(); return; }
    if (trainState.done) { if (e.code === 'Enter') { e.preventDefault(); startTrainer(trainState.t.id); } return; }
    if (trainState.handlers.key && trainState.handlers.key(e)) { e.preventDefault(); return; }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && trainState.answered) { e.preventDefault(); trainNext(); }
  });
}
initTrain();
