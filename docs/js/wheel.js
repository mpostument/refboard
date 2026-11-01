/* refboard - The colour wheel: pick a colour, choose a harmony, and the other
   colours that go with it are laid out on the wheel and mixed from your paints.
   The Colour studio's Wheel tab.

   Two wheels, because painters and screens disagree about where colours sit.
   The painter's wheel is the one from art class: yellow, red and blue the
   primaries, and the opposite of yellow is violet, of red is green, of blue is
   orange - which is what paint does when two opposites are mixed (they cancel
   to grey). A screen's colour model puts red opposite cyan instead, and a
   harmony built on it is correct for light and odd for paint. So the painter's
   wheel is the default: its twelve named hues are placed at their OKLCH hue
   (WH_RYB), and the hue in between is found by interpolating - the wheel is a
   warp of the perceptual one the Picture tab uses, the same colours in a
   different order. The harmonies are turns on the *drawn* wheel, so a
   complement is half way round whichever wheel is chosen.

   Everything is worked out in OKLCH at one value (lightness) at a time, as the
   Picture tab's wheel is: hue round the circle, chroma out from the grey in
   the middle. Colours the screen cannot show are pulled in to its gamut
   (lchRgb), and the dashed line is what your paints can mix (paintReach) -
   so a harmony colour outside it says so, before it is mixed.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const WH_KEY = 'refboard.wheel.v1';
// The painter's wheel: the OKLCH hue of each of its twelve colours, yellow
// first and going round through orange and red to violet, blue, green. Falling,
// so the wheel runs the other way round the hue circle; the last entry is
// yellow again, a full turn on (105 - 360).
const WH_RYB = [105, 80, 55, 40, 25, -10, -50, -75, -105, -160, -210, -235, -255];
const WH_RYB_NAMES = ['yellow', 'yellow-orange', 'orange', 'red-orange', 'red', 'red-violet',
  'violet', 'blue-violet', 'blue', 'blue-green', 'green', 'yellow-green'];
const WH_VALUES = [0.9, 0.78, 0.66, 0.54, 0.42];  // "one hue" steps, OKLab L
// Turns round the wheel, in degrees. `shades` stays on one hue and steps down in value.
const WH_HARMONIES = {
  comp: { label: 'Complementary', turns: [0, 180],
    hint: 'Two colours opposite each other: the most contrast there is, and mixed together they go to grey. Let one lead and the other be the accent.' },
  split: { label: 'Split', turns: [0, 150, 210],
    hint: 'One colour with the two beside its opposite - the contrast of a complement, without the clash.' },
  analogous: { label: 'Analogous', turns: [-30, 0, 30],
    hint: 'Neighbours on the wheel: calm and related, like a sunset or a forest. One note of the opposite brings it to life.' },
  triad: { label: 'Triad', turns: [0, 120, 240],
    hint: 'Three colours a third of the way round from each other: lively, and balanced as long as one of them leads.' },
  tetrad: { label: 'Tetrad', turns: [0, 60, 180, 240],
    hint: 'Two complementary pairs: the richest, and the hardest to balance - let one colour dominate and keep the others quiet.' },
  square: { label: 'Square', turns: [0, 90, 180, 270],
    hint: 'Four colours a quarter of the way round: the widest range there is, so mute most of it.' },
  shades: { label: 'One hue', turns: null,
    hint: 'One hue from pale to deep: a value study in colour. In watercolour the pale steps are more water, in oil more white.' },
};
const WH_MODES = {
  painter: { label: "Painter's", hint: "The wheel from art class: yellow, red and blue the primaries, and opposites that mix to grey." },
  perceptual: { label: 'Perceptual', hint: "The Picture tab's wheel (OKLCH): steps look equal, but red sits opposite cyan, not green." },
};

const wh = { mode: 'painter', harmony: 'comp', angle: 90 - 240, r: 0.62, lstar: 62, sel: 0, bg: null, recipes: {} };

function loadWheelPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(WH_KEY));
    if (!v || typeof v !== 'object') return;
    if (WH_MODES[v.mode]) wh.mode = v.mode;
    if (WH_HARMONIES[v.harmony]) wh.harmony = v.harmony;
    if (Number.isFinite(v.angle)) wh.angle = v.angle;
    if (Number.isFinite(v.r)) wh.r = Math.min(1, Math.max(0, v.r));
    if (Number.isFinite(v.lstar)) wh.lstar = Math.min(95, Math.max(15, v.lstar));
  } catch {}
}
function saveWheelPrefs() {
  try { localStorage.setItem(WH_KEY, JSON.stringify({ mode: wh.mode, harmony: wh.harmony, angle: wh.angle, r: wh.r, lstar: wh.lstar })); } catch {}
}

/* ---- the wheels' geometry. `theta` is where a point is on the drawn wheel:
   degrees counter-clockwise from the right, as the Picture tab's wheel has
   it. The perceptual wheel reads it as the OKLCH hue itself. The painter's
   puts yellow at the top and counts clockwise, so its own angle is 90 - theta,
   and the hue comes from walking WH_RYB. */
const whMod = (a, n = 360) => ((a % n) + n) % n;

function whPainterHue(a) {
  a = whMod(a);
  const i = Math.min(11, Math.floor(a / 30)), f = (a - i * 30) / 30;
  return whMod(WH_RYB[i] + (WH_RYB[i + 1] - WH_RYB[i]) * f);
}
// OKLCH hue -> the painter's own angle. The table falls from 105 to -255, so a
// hue is first brought into that range, then found between two entries.
function whPainterAngle(h) {
  const x = whMod(h) <= 105 ? whMod(h) : whMod(h) - 360;
  for (let i = 0; i < 12; i++) {
    if (x <= WH_RYB[i] && x >= WH_RYB[i + 1]) return i * 30 + 30 * (WH_RYB[i] - x) / (WH_RYB[i] - WH_RYB[i + 1]);
  }
  return 0;
}
const whHue = (theta, mode = wh.mode) => mode === 'painter' ? whPainterHue(90 - theta) : whMod(theta);
const whTheta = (hue, mode = wh.mode) => mode === 'painter' ? whMod(90 - whPainterAngle(hue)) : whMod(hue);

// OKLab lightness of a neutral grey at this L*: the wheel's centre is exactly that grey.
const whL = lstar => (lstar + 16) / 116;

// The colours of the chosen harmony: [{ rgb, lch: [L, C, h], theta }], the base first.
function whColours(state = wh) {
  const H = WH_HARMONIES[state.harmony], C = state.r * COL_CMAX, L = whL(state.lstar);
  const one = (theta, l) => {
    const h = whHue(theta, state.mode), rgb = lchRgb(l, C, h);
    return { rgb, lch: rgbOklch(rgb), theta: whMod(theta) };
  };
  if (!H.turns) return WH_VALUES.map(l => one(state.angle, l));
  return H.turns.map(t => one(state.angle + t, L));
}

/* ---- drawing */
// The wheel's own colours at this value, painted once at low resolution and
// scaled up - a gamut-clipped OKLCH per pixel is too slow to redo at screen
// size. Kept for the mode and value it was made at.
function whBackground() {
  const key = wh.mode + '|' + wh.lstar;
  if (wh.bg && wh.bg.key === key) return wh.bg.cv;
  const N = 180, c = N / 2, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), id = ctx.createImageData(N, N), L = whL(wh.lstar);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5 - c) / c, v = (c - y - 0.5) / c, r = Math.hypot(u, v);
    if (r > 1) continue;
    const rgb = lchRgb(L, r * COL_CMAX, whHue(Math.atan2(v, u) * 180 / Math.PI)), k = (y * N + x) * 4;
    id.data[k] = rgb[0]; id.data[k + 1] = rgb[1]; id.data[k + 2] = rgb[2]; id.data[k + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  wh.bg = { key, cv };
  return cv;
}

function whGeom() {
  const cv = el('whWheel'), dpr = window.devicePixelRatio || 1;
  const S = Math.round(cv.clientWidth * dpr);
  if (S && cv.width !== S) cv.width = cv.height = S;
  const c = cv.width / 2, R = c - 8 * dpr;
  return { cv, dpr, c, R,
    toXY: (theta, r) => { const a = theta * Math.PI / 180; return [c + r * R * Math.cos(a), c - r * R * Math.sin(a)]; },
    fromXY: (x, y) => { const u = (x * dpr - c) / R, v = (c - y * dpr) / R; return { theta: whMod(Math.atan2(v, u) * 180 / Math.PI), r: Math.hypot(u, v) }; } };
}

function whRenderWheel(colours) {
  const g = whGeom(), { cv, dpr, c, R, toXY } = g;
  if (!cv.width) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, R, 0, 2 * Math.PI); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(whBackground(), c - R, c - R, 2 * R, 2 * R);
  ctx.restore();
  // A ring at each quarter of the chroma, and a tick at each of the twelve
  // hues - on the painter's wheel, the names it is read by.
  ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1 * dpr;
  for (const f of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(c, c, R * f, 0, 2 * Math.PI); ctx.stroke(); }
  for (let i = 0; i < 12; i++) {
    const theta = wh.mode === 'painter' ? 90 - i * 30 : i * 30, [x0, y0] = toXY(theta, 0.94), [x1, y1] = toXY(theta, 1);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // What the chosen paints can mix.
  const reach = colReach();
  if (reach) {
    ctx.save();
    ctx.beginPath();
    reach.forEach(([a, b], i) => {
      const [x, y] = toXY(whTheta(Math.atan2(b, a) * 180 / Math.PI), Math.min(1.05, Math.hypot(a, b) / COL_CMAX));
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
    ctx.restore();
  }
  // The harmony's shape joining its colours, then each colour.
  const pts = colours.map(k => toXY(k.theta, wh.r));
  if (wh.harmony !== 'shades' && pts.length > 1) {
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (pts.length > 2) ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3.5 * dpr; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
  }
  const shown = wh.harmony === 'shades' ? [colours[Math.min(wh.sel, colours.length - 1)]] : colours;
  shown.forEach(k => {
    const i = colours.indexOf(k), [x, y] = toXY(k.theta, wh.r), base = i === 0 && wh.harmony !== 'shades';
    ctx.beginPath(); ctx.arc(x, y, (base ? 9 : 7) * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = rgbCss(k.rgb); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4 * dpr; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = (i === wh.sel ? 3 : 1.8) * dpr; ctx.stroke();
  });
}

/* ---- the swatches, and the one picked */
// A colour's name on the wheel in use: one of the painter's twelve, or the
// hue word the Picture tab uses. Nothing under a faint chroma has a hue.
function whName(k) {
  const [, C, h] = k.lch;
  if (C < 0.03) return 'grey';
  return wh.mode === 'painter' ? WH_RYB_NAMES[Math.round(whPainterAngle(h) / 30) % 12] : hueName(h);
}
// Can the chosen paints make this colour? By where it sits on the wheel, as
// the Picture tab counts its pixels.
function whReachable(k) {
  const reach = colReach();
  if (!reach) return true;
  const [, C, h] = k.lch, a = C * Math.cos(h * Math.PI / 180) / COL_CMAX, b = C * Math.sin(h * Math.PI / 180) / COL_CMAX;
  return pointInPolygon([a, b], reach.map(q => [q[0] / COL_CMAX, q[1] / COL_CMAX]));
}

function whRecipeKey(k) { return colHex(k.rgb) + '|' + col.paints + '|' + col.medium; }

function whRenderSwatches(colours) {
  el('whSwatches').innerHTML = colours.map((k, i) => {
    const out = !whReachable(k), name = whName(k);
    return `<button type="button" class="wh-sw${i === wh.sel ? ' on' : ''}${out ? ' out' : ''}" data-i="${i}" aria-pressed="${i === wh.sel}" ` +
      `title="${colHex(k.rgb)} · ${name}${out ? ' - outside what your paints can mix' : ''}">` +
      `<i style="background:${rgbCss(k.rgb)}"></i><b>${wh.harmony === 'shades' ? 'L* ' + Math.round(lstar(k.rgb)) : (i === 0 ? 'Base' : name)}</b>` +
      `<span>${colHex(k.rgb)}</span></button>`;
  }).join('');
}

// The recipes for the chosen colour, once the wheel stops moving: a drag
// renders every frame, and a search a frame would hold it up.
let whMixTimer = 0;
function whMixSoon() {
  clearTimeout(whMixTimer);
  whMixTimer = setTimeout(() => {
    const colours = whColours(), k = colours[Math.min(wh.sel, colours.length - 1)], key = whRecipeKey(k);
    if (wh.recipes[key]) return;
    wh.recipes[key] = paintRecipes(k.rgb, col.paints, 3, col.medium);
    wheelRender();
  }, 250);
}

function whRenderOne(colours) {
  const k = colours[Math.min(wh.sel, colours.length - 1)], [, C, h] = k.lch, out = !whReachable(k);
  const key = whRecipeKey(k), hit = wh.recipes[key];
  let body;
  if (hit) body = hit.length ? `<div class="col-mix">${hit.map(paintRecipeHtml).join('')}</div>` : '';
  else { body = '<div class="col-mix count" aria-busy="true">Mixing...</div>'; whMixSoon(); }
  el('whOne').innerHTML = `<div class="wh-one"><i style="background:${rgbCss(k.rgb)}"></i>` +
    `<div><b>${colHex(k.rgb)}</b> · value L* ${Math.round(lstar(k.rgb))} · ${colChromaWord(C)}${C >= 0.03 ? ' ' + whName(k) : ''}` +
    (out ? '<div class="wh-warn">Your paints cannot quite mix this - the nearest they get is below.</div>' : '') +
    `</div></div>${body}`;
}

function wheelRender() {
  if (!col || !el('whWheel')) return;
  const colours = whColours();
  if (wh.sel >= colours.length) wh.sel = 0;
  for (const b of el('whModes').children) b.setAttribute('aria-pressed', String(b.dataset.mode === wh.mode));
  for (const b of el('whHarmonies').children) b.setAttribute('aria-pressed', String(b.dataset.harmony === wh.harmony));
  el('whValue').value = wh.lstar;
  el('whValueOut').textContent = 'L* ' + Math.round(wh.lstar);
  el('whHint').textContent = WH_HARMONIES[wh.harmony].hint + (wh.mode === 'perceptual' ? ' ' + WH_MODES.perceptual.hint : '');
  el('whWheel').setAttribute('aria-label',
    `Colour wheel. Base colour ${colChromaWord(colours[0].lch[1])} ${whName(colours[0])}. Arrow keys turn it and change its strength.`);
  const pal = (col.palette || []);
  el('whPicture').classList.toggle('hidden', !pal.length);
  el('whPictureChips').innerHTML = pal.map((p, i) => `<button type="button" class="wh-pick" data-i="${i}" title="Start from this colour of the picture - ${colHex(p.rgb)}"><i style="background:${rgbCss(p.rgb)}"></i></button>`).join('');
  whRenderWheel(colours);
  whRenderSwatches(colours);
  whRenderOne(colours);
  const reach = colReach();
  const outCount = colours.filter(k => !whReachable(k)).length;
  el('whNote').textContent = reach
    ? (outCount ? `${outCount} of these ${outCount === 1 ? 'is' : 'are'} past the dashed line - more intense, or a hue your paints cannot make. Turn the wheel, or lay a glaze over a mix to get nearer.`
      : 'All inside the dashed line: your paints can mix every one.')
    : '';
}

// Calling the colours of a harmony back from a base colour, for the picture
// chips: sets angle and strength so the wheel's base is this colour.
function whSetBase(rgb) {
  const [L, C, h] = rgbOklch(rgb);
  wh.angle = whTheta(h);
  wh.r = Math.min(1, C / COL_CMAX);
  wh.lstar = Math.min(95, Math.max(15, Math.round(116 * L - 16)));
  wh.sel = 0;
}

function initWheel() {
  loadWheelPrefs();
  el('whModes').innerHTML = Object.entries(WH_MODES).map(([k, m]) =>
    `<button class="chip" type="button" data-mode="${k}" title="${esc(m.hint)}">${m.label}</button>`).join('');
  el('whHarmonies').innerHTML = Object.entries(WH_HARMONIES).map(([k, m]) =>
    `<button class="chip" type="button" data-harmony="${k}" title="${esc(m.hint)}">${m.label}</button>`).join('');
  const change = () => { saveWheelPrefs(); wheelRender(); };
  el('whModes').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b || b.dataset.mode === wh.mode) return;
    // The same colour on the other wheel: carry its hue across, not its place.
    const h = whHue(wh.angle);
    wh.mode = b.dataset.mode; wh.angle = whTheta(h);
    change();
  });
  el('whHarmonies').addEventListener('click', e => {
    const b = e.target.closest('[data-harmony]');
    if (b) { wh.harmony = b.dataset.harmony; wh.sel = 0; change(); }
  });
  el('whValue').addEventListener('input', e => { wh.lstar = +e.target.value; saveWheelPrefs(); wheelSoon(); });
  el('whSwatches').addEventListener('click', e => {
    const b = e.target.closest('.wh-sw');
    if (b) { wh.sel = +b.dataset.i; wheelRender(); }
  });
  el('whPictureChips').addEventListener('click', e => {
    const b = e.target.closest('.wh-pick');
    if (b && col.palette && col.palette[+b.dataset.i]) { whSetBase(col.palette[+b.dataset.i].rgb); change(); }
  });
  el('whToPalette').addEventListener('click', () => openPalette(whColours().map(k => k.rgb)));
  el('whCopy').addEventListener('click', async () => {
    const text = whColours().map(k => `${colHex(k.rgb)} ${whName(k)}`).join('\n');
    try { await navigator.clipboard.writeText(text); announce('Copied'); el('whCopy').textContent = 'Copied'; }
    catch { el('whCopy').textContent = 'Could not copy'; }
    setTimeout(() => { el('whCopy').textContent = 'Copy hex codes'; }, 1500);
  });

  // The wheel: a press or a drag puts the base colour there, and the rest of
  // the harmony follows. Arrow keys do the same for a keyboard - left and
  // right turn, up and down change the strength.
  const wheel = el('whWheel');
  let drag = false;
  const at = e => {
    const g = whGeom(), rc = wheel.getBoundingClientRect(), p = g.fromXY(e.clientX - rc.left, e.clientY - rc.top);
    wh.angle = p.theta; wh.r = Math.min(1, p.r);
    wh.sel = wh.harmony === 'shades' ? wh.sel : 0;
    saveWheelPrefs(); wheelSoon();
  };
  wheel.addEventListener('pointerdown', e => { drag = true; try { wheel.setPointerCapture(e.pointerId); } catch {} at(e); wheel.focus(); });
  wheel.addEventListener('pointermove', e => { if (drag) at(e); });
  const end = () => { drag = false; };
  wheel.addEventListener('pointerup', end);
  wheel.addEventListener('pointercancel', end);
  wheel.addEventListener('keydown', e => {
    const step = e.shiftKey ? 15 : 3;
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, 0.03], ArrowDown: [0, -0.03] }[e.key];
    if (!d) return;
    e.preventDefault();
    wh.angle = whMod(wh.angle + d[0]); wh.r = Math.min(1, Math.max(0, wh.r + d[1]));
    saveWheelPrefs(); wheelSoon();
  });
  window.addEventListener('resize', () => { if (view.kind === 'colour' && col.tab === 'wheel') wheelRender(); });
  document.addEventListener('refboard:theme', () => { if (col.tab === 'wheel') wheelRender(); });
}

// Coalesced to a frame: a drag, or the value slider, repaints the wheel.
let whFrame = 0;
function wheelSoon() {
  if (whFrame) return;
  whFrame = requestAnimationFrame(() => { whFrame = 0; wheelRender(); });
}
