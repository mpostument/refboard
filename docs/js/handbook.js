/* refboard - The handbook: short lessons, each with a live demonstration.

   A drawing book says "reflected light stays darker than the halftone" and
   you nod; here you push a slider until the reflected light is brighter than
   the halftone and watch the ball go flat. Each lesson is the same four
   things: a few sentences of theory, a demonstration you can move (built on
   what the app already knows - a lit sphere, the OKLCH colour model, the
   spectral paint model of paint.js), something to try, and what you should
   have seen, folded away until you have tried.

   The lessons are data (HB_LESSONS): { id, title, theory, build(host), try,
   see }. build() fills the demo's host and returns nothing; the host is
   emptied when another lesson opens, so its listeners go with it. Which
   lessons are done is kept in localStorage - a convenience, not a record.

   The lit sphere is a tiny ray tracer (hbSphere()) - a sphere on a floor,
   orthographic, Lambert with a little sky and floor light, 320 x 210 - run
   again on every move of a slider. It is not the 3D forms' renderer (which
   needs WebGL and a shadow map): it is the same idea in 60 lines, so the
   lesson can read the tones back off the picture and say them in numbers.

   Loaded the first time the view opens (loadSection('handbook')). */
"use strict";

const HB_KEY = 'refboard.handbook.v1';
let hb = null;   // { done: [id], lesson: id }

function hbLoad() {
  hb = { done: [], lesson: HB_LESSONS[0].id };
  try {
    const s = JSON.parse(localStorage.getItem(HB_KEY) || '{}');
    if (Array.isArray(s.done)) hb.done = s.done.filter(id => HB_LESSONS.some(l => l.id === id));
    if (HB_LESSONS.some(l => l.id === s.lesson)) hb.lesson = s.lesson;
  } catch { /* private mode: start at the first lesson */ }
}
function hbSave() {
  try { localStorage.setItem(HB_KEY, JSON.stringify(hb)); } catch { /* private mode */ }
}

/* ---- colour helpers: OKLCH in, [r, g, b] out (lchRgb, train.js) */
const hbLab = ([L, C, h]) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
// Between two OKLCH colours by way of OKLab, so the hue does not swing round the wheel.
function hbMix(c1, c2, t) {
  const a = hbLab(c1), b = hbLab(c2), L = a[0] + (b[0] - a[0]) * t, x = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t;
  return [L, Math.hypot(x, y), (Math.atan2(y, x) * 180 / Math.PI + 360) % 360];
}
const hbGrey = rgb => greyOfLstar(lstar(rgb));
const hbCss = rgb => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
const hbLstarOfY = Y => Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : 24389 / 27 * Y;

/* ---- the lit sphere */
const HB_SW = 320, HB_SH = 210;
/* Draws a sphere on a floor into the canvas and says what each family of
   tones came to, as L* (0 black, 100 white). o: az (the light's direction
   from the viewer's left, degrees), el (its height), bounce (0-1, how much
   of the floor's light comes back up into the ball). */
function hbSphere(cv, o) {
  const g = cv.getContext('2d'), img = g.createImageData(HB_SW, HB_SH), px = img.data;
  const az = o.az * Math.PI / 180, el = o.el * Math.PI / 180;
  const L = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
  const pitch = 18 * Math.PI / 180, D = [0, -Math.sin(pitch), -Math.cos(pitch)], up = [0, Math.cos(pitch), -Math.sin(pitch)];
  const Hf = [L[0] - D[0], L[1] - D[1], L[2] - D[2]], hl = Math.hypot(...Hf);
  Hf[0] /= hl; Hf[1] /= hl; Hf[2] /= hl;
  const C = [0, 1, 0], T = [0, 0.9, 0], halfW = 3.2, halfH = halfW * HB_SH / HB_SW;
  const bg = [0.03, 0.03, 0.045];
  const sums = { light: [0, 0], half: [0, 0], core: [0, 0], refl: [0, 0] };
  const out = (i, rgb) => { for (let k = 0; k < 3; k++) px[i + k] = Math.round(255 * Math.pow(Math.min(Math.max(rgb[k], 0), 1), 1 / 2.2)); px[i + 3] = 255; };
  for (let j = 0; j < HB_SH; j++) for (let i = 0; i < HB_SW; i++) {
    const u = (i + 0.5) / HB_SW * 2 - 1, v = 1 - (j + 0.5) / HB_SH * 2;
    const O = [T[0] + u * halfW - D[0] * 30, T[1] + v * halfH * up[1] - D[1] * 30, T[2] + v * halfH * up[2] - D[2] * 30];
    const oc = [O[0] - C[0], O[1] - C[1], O[2] - C[2]];
    const b = oc[0] * D[0] + oc[1] * D[1] + oc[2] * D[2], c = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - 1, disc = b * b - c;
    const tFloor = -O[1] / D[1];
    const idx = (j * HB_SW + i) * 4;
    if (disc > 0 && -b - Math.sqrt(disc) < tFloor) {
      const t = -b - Math.sqrt(disc), P = [O[0] + D[0] * t, O[1] + D[1] * t, O[2] + D[2] * t];
      const N = [P[0] - C[0], P[1] - C[1], P[2] - C[2]];
      const ndl = N[0] * L[0] + N[1] * L[1] + N[2] * L[2];
      const sky = 0.1 * (0.5 + 0.5 * N[1]);
      // The floor lit by the same light sends some back up, most from the
      // underside, and not at all from a surface facing up.
      const bounce = o.bounce * 0.5 * Math.max(-N[1], 0) * (0.35 + 0.65 * L[1]);
      const spec = ndl > 0 ? 0.3 * Math.pow(Math.max(N[0] * Hf[0] + N[1] * Hf[1] + N[2] * Hf[2], 0), 50) : 0;
      const Y = 0.78 * (Math.max(ndl, 0) * (0.75 + 0.25 * L[1]) + sky + bounce) + spec;
      out(idx, [Y, Y * 0.95, Y * 0.88]);
      const cls = ndl > 0.75 ? sums.light : ndl > 0.25 && ndl < 0.6 ? sums.half : ndl > -0.35 && ndl < -0.05 && N[1] > -0.1 ? sums.core : ndl < -0.3 && N[1] < -0.45 ? sums.refl : null;
      if (cls) { cls[0] += Y; cls[1]++; }
    } else {
      const P = [O[0] + D[0] * tFloor, 0, O[2] + D[2] * tFloor];
      const pc = [P[0] - C[0], P[1] - C[1], P[2] - C[2]], sb = pc[0] * L[0] + pc[1] * L[1] + pc[2] * L[2];
      const sd = sb * sb - (pc[0] * pc[0] + pc[1] * pc[1] + pc[2] * pc[2] - 1);
      const shadow = sb < 0 ? Math.min(Math.max(sd / 0.18, 0), 1) : 0;
      const dist = Math.hypot(...pc), contact = 1 - 0.6 * Math.exp(-(dist - 1) * 3);
      const Y = 0.55 * (0.2 + 0.8 * L[1] * (1 - shadow)) * contact;
      const fade = Math.min(Math.max((Math.hypot(P[0], P[2]) - 2.4) / 0.9, 0), 1);
      out(idx, [Y + (bg[0] - Y) * fade, Y * 0.97 + (bg[1] - Y * 0.97) * fade, Y * 0.92 + (bg[2] - Y * 0.92) * fade]);
    }
  }
  g.putImageData(img, 0, 0);
  const val = ([s, n]) => n ? hbLstarOfY(s / n) : null;
  return { light: val(sums.light), half: val(sums.half), core: val(sums.core), refl: val(sums.refl), reach: 1 / Math.tan(el) };
}

/* ---- the lessons */
const hbSlider = (id, label, min, max, step, value, unit = '') =>
  `<label class="hb-slider" for="${id}"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}Out">${value}${unit}</output></label>`;
const hbOn = (host, id, fn) => {
  const input = host.querySelector('#' + id), out = host.querySelector('#' + id + 'Out');
  input.addEventListener('input', () => { if (out) out.textContent = input.value + (out.dataset.unit || ''); fn(); });
};

const HB_LESSONS = [
  { id: 'light', title: 'Light on a form',
    theory: 'A form lit from one side falls into zones, and a drawing is convincing when each is in its place: the <b>light</b>, the <b>halftone</b> where the surface turns away, the <b>core shadow</b> - the darkest band, a little inside the edge, not at it - and the <b>reflected light</b> that the lit floor throws back into the shadow. The cast shadow on the floor is darkest where it touches.',
    build(host) {
      host.innerHTML = `<canvas class="hb-canvas" width="${HB_SW}" height="${HB_SH}" role="img" aria-label="A ball lit from the side, on a floor"></canvas>
        ${hbSlider('hbAz', 'Light from', -150, 150, 1, 55, '°')}${hbSlider('hbEl', 'Light height', 8, 80, 1, 35, '°')}${hbSlider('hbBounce', 'Reflected light', 0, 1, 0.01, 0.5)}
        <div class="count" id="hbRead" role="status"></div>`;
      host.querySelector('#hbAzOut').dataset.unit = '°'; host.querySelector('#hbElOut').dataset.unit = '°';
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead');
      let frame = 0;
      const draw = () => {
        frame = 0;
        const r = hbSphere(cv, { az: +host.querySelector('#hbAz').value, el: +host.querySelector('#hbEl').value, bounce: +host.querySelector('#hbBounce').value });
        const f = v => v === null ? '-' : Math.round(v);
        const verdict = r.refl === null || r.half === null ? ''
          : r.refl >= r.half ? ' The reflected light is as bright as the halftone: the shadow side has gone flat, and so has the ball.'
          : r.core !== null && r.refl > r.core + 2 ? ' The reflected light lifts the shadow side off the core shadow, and stays darker than the halftone: the form holds.' : '';
        read.textContent = `Values (L*, 0 black to 100 white): light ${f(r.light)} · halftone ${f(r.half)} · core shadow ${f(r.core)} · reflected light ${f(r.refl)}. The shadow reaches about ${r.reach.toFixed(1)} ball-radii from the ball.` + verdict;
      };
      const soon = () => { if (!frame) frame = requestAnimationFrame(draw); };
      for (const id of ['hbAz', 'hbEl', 'hbBounce']) hbOn(host, id, soon);
      draw();
    },
    tryThis: ['Bring the light down to 10° and watch the shadow stretch; raise it to 80° and watch it shrink under the ball.',
      'Turn the light behind the ball (past 90°) - the light side disappears and the ball is a dark shape with a bright edge.',
      'Push Reflected light to the top and read the numbers: when does the reflected light overtake the halftone?'],
    see: 'The core shadow is not at the edge: just inside it the shadow side is lifted by the reflected light, so the darkest band sits a little in. Past a high reflected light the form flattens, because the shadow side is no longer clearly darker than the halftone - the usual mistake in a first shadow.' },

  { id: 'air', title: 'Aerial perspective',
    theory: 'The air between you and a thing is a veil. The further off it is, the more the veil takes: its <b>value</b> moves toward the sky\'s, its <b>colour</b> is washed and goes bluer, its <b>edges</b> soften. That is how a flat sheet gets depth with no lines at all - and why a far mountain painted as dark as a near tree sits on top of it.',
    build(host) {
      host.innerHTML = `<canvas class="hb-canvas" width="${HB_SW}" height="${HB_SH}" role="img" aria-label="Five ridges, one behind another, fading into haze"></canvas>
        ${hbSlider('hbAir', 'Air between', 0, 1.2, 0.01, 0.5)}
        <div class="row hb-toggles"><label class="opt"><input type="checkbox" id="hbSoft" checked> Soften the far edges</label><label class="opt"><input type="checkbox" id="hbSquint"> See it in grey</label></div>
        <div class="count" id="hbRead" role="status"></div>`;
      const cv = host.querySelector('canvas'), read = host.querySelector('#hbRead'), g = cv.getContext('2d');
      const NEAR = [0.36, 0.075, 150], HAZE = [0.9, 0.035, 240], SKY = [0.78, 0.085, 245];
      const DIST = [0.15, 0.9, 1.9, 3.1, 4.5];
      const phase = [[0.3, 1.1], [1.7, 0.4], [2.6, 2.2], [0.9, 3.0], [3.4, 1.5]];
      const draw = () => {
        const k = +host.querySelector('#hbAir').value, soft = host.querySelector('#hbSoft').checked, grey = host.querySelector('#hbSquint').checked;
        const tint = c => grey ? hbGrey(lchRgb(...c)) : lchRgb(...c);
        const sky = g.createLinearGradient(0, 0, 0, HB_SH * 0.6);
        sky.addColorStop(0, hbCss(tint(SKY))); sky.addColorStop(1, hbCss(tint(HAZE)));
        g.clearRect(0, 0, HB_SW, HB_SH);
        g.fillStyle = sky; g.fillRect(0, 0, HB_SW, HB_SH);
        const vals = [], chromas = [];
        for (let i = DIST.length - 1; i >= 0; i--) {
          const t = 1 - Math.exp(-k * DIST[i]), c = hbMix(NEAR, HAZE, t), rgb = tint(c);
          vals.push(lstar(lchRgb(...c))); chromas.push(c[1]);
          const base = HB_SH * (0.5 + 0.1 * (DIST.length - 1 - i)), amp = 16 + 6 * (DIST.length - 1 - i) * 0.5, [p1, p2] = phase[i];
          g.save();
          if (soft && 'filter' in g) g.filter = `blur(${(DIST[i] * k * 0.9).toFixed(2)}px)`;
          g.beginPath(); g.moveTo(-4, HB_SH);
          for (let x = -4; x <= HB_SW + 4; x += 4) g.lineTo(x, base - amp * (Math.sin(x * 0.021 + p1) + 0.5 * Math.sin(x * 0.053 + p2) + 0.25 * Math.sin(x * 0.11 + p1 * 2)));
          g.lineTo(HB_SW + 4, HB_SH); g.closePath();
          g.fillStyle = hbCss(rgb); g.fill();
          g.restore();
        }
        vals.reverse(); chromas.reverse();
        const spread = vals[0] - vals[vals.length - 1];
        read.textContent = `Value of each ridge, near to far (L*): ${vals.map(v => Math.round(v)).join(' · ')}. Colour strength: ${chromas.map(c => Math.round(c * 100)).join(' · ')}. ` +
          (k < 0.05 ? 'No air: every ridge is the same value and colour, and the picture is flat.'
            : `The nearest to the farthest differ by ${Math.round(Math.abs(spread))} in value - ${Math.abs(spread) < 12 ? 'too little to read as distance' : 'enough to read as distance'}.`);
      };
      for (const id of ['hbAir']) hbOn(host, id, draw);
      host.querySelector('#hbSoft').addEventListener('change', draw);
      host.querySelector('#hbSquint').addEventListener('change', draw);
      draw();
    },
    tryThis: ['Take the air to zero: the ridges are one flat shape. Raise it and count how many you can tell apart.',
      'Switch on "See it in grey": does the distance still read? It should - depth is carried by value more than by blue.',
      'Raise the air to the top: the farthest ridge nearly vanishes into the sky. Where would you stop for a hazy morning, and where for a clear day?'],
    see: 'Value does most of the work: the ridges step from dark to light, and in grey they still step. The colour strength falls with distance too, and the edges blur. A clear day is a small number, a misty morning a large one - the ridges are the same shapes.' },

  { id: 'mixing', title: 'Mixing paint',
    theory: 'Paint mixes the other way round from light. Each pigment <b>absorbs</b> some of the colours of the paper\'s light; two pigments together absorb more, so the mix is darker and duller - blue and yellow do not average to a muddy grey of their two colours, they leave green. The paint model of this app works that out per wavelength, which is why its recipes are close.',
    build(host) {
      if (!paintInit()) { host.textContent = 'The paint model has not loaded.'; return; }
      const medium = paintMedium(), keys = paintKeys(paintPaletteKey(), medium);
      const pickKey = (want, i) => keys.includes(want) ? want : keys[i % keys.length];
      const opts = sel => keys.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(PIGMENTS[k].name)}</option>`).join('');
      const a0 = pickKey('phthaloBlue', 0), b0 = pickKey('lemon', 1);
      host.innerHTML = `<div class="chips" id="hbMedium" role="group" aria-label="Medium">${Object.entries(PAINT_MEDIA).map(([k, v]) => `<button type="button" class="chip" data-hb-medium="${k}" aria-pressed="${k === medium}">${v}</button>`).join('')}</div>
        <div class="row hb-pair"><select id="hbA" aria-label="First paint">${opts(a0)}</select><span>into</span><select id="hbB" aria-label="Second paint">${opts(b0)}</select></div>
        <div class="hb-strip" id="hbStrip" aria-hidden="true"></div>
        ${hbSlider('hbT', 'How much of the second', 0, 100, 1, 80, '%')}
        <div class="gz-swatches mc-swatches"><figure><i id="hbPaint"></i><figcaption>Paint mixed</figcaption></figure><figure><i id="hbAvg"></i><figcaption>Colours averaged</figcaption></figure><figure><i id="hbOne"></i><figcaption>First paint</figcaption></figure></div>
        <div class="count" id="hbRead" role="status"></div>
        <h4>The colour you need</h4>
        <div class="chips" id="hbTargets"></div>
        <div id="hbRecipes"></div>`;
      host.querySelector('#hbT').nextElementSibling.dataset.unit = '%';
      const rgbOf = parts => paintRgb(medium === 'water' ? paintWash(parts, 0.6) : paintMix(parts));
      const mixAt = (a, b, t) => rgbOf([[a, 1 - t], [b, t]].filter(p => p[1] > 0.0001));
      const draw = () => {
        const a = host.querySelector('#hbA').value, b = host.querySelector('#hbB').value, t = +host.querySelector('#hbT').value / 100;
        host.querySelector('#hbStrip').innerHTML = Array.from({ length: 11 }, (_, i) => `<i style="background:${hbCss(mixAt(a, b, i / 10))}"></i>`).join('');
        const A = mixAt(a, a, 0), B = mixAt(b, b, 1), M = a === b ? A : mixAt(a, b, t), avg = A.map((v, i) => Math.round(v + (B[i] - v) * t));
        host.querySelector('#hbPaint').style.background = hbCss(M);
        host.querySelector('#hbAvg').style.background = hbCss(avg);
        host.querySelector('#hbOne').style.background = hbCss(A);
        const [, Cm] = rgbOklch(M), [, Ca] = rgbOklch(A), [, Cb] = rgbOklch(B), [, Cv] = rgbOklch(avg);
        host.querySelector('#hbRead').textContent = a === b ? 'The same paint twice - nothing to mix.'
          : `Colour strength: first ${Math.round(Ca * 100)}, second ${Math.round(Cb * 100)}, paint mixed ${Math.round(Cm * 100)}, colours averaged ${Math.round(Cv * 100)}. ` +
            (Cm < 0.6 * Math.min(Ca, Cb) ? 'Each paint takes the other\'s colour away: this is the way to a grey or a brown.' : 'The pair are near neighbours: the mix keeps most of its strength.');
      };
      for (const id of ['hbT']) hbOn(host, id, draw);
      host.querySelector('#hbA').addEventListener('change', draw);
      host.querySelector('#hbB').addEventListener('change', draw);
      host.querySelector('#hbMedium').addEventListener('click', e => {
        const m = e.target.closest('[data-hb-medium]');
        if (m) { setPaintMedium(m.dataset.hbMedium); paintChipsSync(); hbShow(); }
      });
      const TARGETS = [['Skin', '#e8b894'], ['Leaf green', '#5a8a3c'], ['Sky', '#8fb4dc'], ['Violet shadow', '#6a5a8c']];
      host.querySelector('#hbTargets').innerHTML = TARGETS.map(([n, hex]) => `<button type="button" class="chip" data-hb-target="${hex}"><i class="hb-dot" style="background:${hex}"></i> ${n}</button>`).join('') +
        `<label class="lt-own" title="A colour of your own">or <input type="color" id="hbOwn" aria-label="Your colour" value="#c86a4a"></label>`;
      const recipes = hex => {
        const rgb = hexToRgb(hex);
        host.querySelector('#hbRecipes').innerHTML = `<div class="hb-want"><i style="background:${hbCss(rgb)}"></i> ${hex}</div>` + paintRecipes(rgb, paintPaletteKey(), 3, medium).map(paintRecipeHtml).join('');
      };
      host.querySelector('#hbTargets').addEventListener('click', e => { const b = e.target.closest('[data-hb-target]'); if (b) recipes(b.dataset.hbTarget); });
      host.querySelector('#hbOwn').addEventListener('input', e => recipes(e.target.value));
      draw();
      recipes(TARGETS[0][1]);
    },
    tryThis: ['Slide the blue into the yellow from one end to the other: where does the green appear? Not in the middle - why? Then change the blue to ultramarine and see where it moves.',
      'Look at "Colours averaged" beside "Paint mixed": the average is what a screen\'s blend would show, and the paint is not that.',
      'Pick Skin below and read its recipe: how many paints does the best one use? Then try it in oil.'],
    see: 'Blue and yellow mixed as paint give a green - but only when the yellow is the larger share, since a blue pigment tints far more strongly than a yellow, and half and half is a blue-grey. Averaged as screen colours the same pair gives a different, duller colour. The mixed paint is usually less strong than either end, most strongly so for two paints opposite each other on the wheel. The recipes use as few paints as will do - a third tube must earn its place.' },

  { id: 'value', title: 'Value against colour',
    theory: 'Two colours can be as different as a red and a green and still be <b>the same value</b>: the same lightness, which is what the eye reads the form by. In grey they become one patch. A painting whose colours are right and values wrong looks flat; one with the values right can have almost any colour. So judge value first, and colour second.',
    build(host) {
      const HUES = [['Green', 145], ['Blue', 255], ['Yellow', 100], ['Purple', 320]];
      host.innerHTML = `<div class="hb-patches" id="hbPatches"><i id="hbLeft"></i><i id="hbRight"></i></div>
        <div class="chips" id="hbHue" role="group" aria-label="The second colour">${HUES.map(([n, h], i) => `<button type="button" class="chip" data-hb-hue="${h}" aria-pressed="${i === 0}">${n}</button>`).join('')}</div>
        ${hbSlider('hbL', 'Lightness of the second', 30, 95, 1, 50, '')}
        <div class="row hb-toggles"><label class="opt"><input type="checkbox" id="hbGrey"> See it in grey</label></div>
        <div class="count" id="hbRead" role="status"></div>`;
      let hue = HUES[0][1];
      const left = lchRgb(0.62, 0.17, 25);
      const draw = () => {
        const L = +host.querySelector('#hbL').value / 100, right = lchRgb(L, 0.15, hue), grey = host.querySelector('#hbGrey').checked;
        host.querySelector('#hbLeft').style.background = hbCss(grey ? hbGrey(left) : left);
        host.querySelector('#hbRight').style.background = hbCss(grey ? hbGrey(right) : right);
        const d = Math.abs(lstar(left) - lstar(right));
        host.querySelector('#hbRead').textContent = `Value difference: ${d.toFixed(1)} L*. ` +
          (d < 4 ? 'The same value: in grey they are one patch, and a drawing made of both would have no edge between them.' : d < 12 ? 'Close in value: they hold together, with a weak edge.' : 'Clearly different in value: a strong edge, with or without the colour.');
      };
      hbOn(host, 'hbL', draw);
      host.querySelector('#hbGrey').addEventListener('change', draw);
      host.querySelector('#hbHue').addEventListener('click', e => {
        const b = e.target.closest('[data-hb-hue]');
        if (!b) return;
        hue = +b.dataset.hbHue;
        for (const x of host.querySelectorAll('[data-hb-hue]')) x.setAttribute('aria-pressed', String(x === b));
        draw();
      });
      draw();
    },
    tryThis: ['Turn on "See it in grey", then slide the second colour\'s lightness until the two patches vanish into one. Read the difference.',
      'Turn the grey off: with the value matched, the colours are still clearly different - the colour carries nothing of the form.',
      'Try each hue. Which needs the lightest second colour to match the red, and which the darkest?'],
    see: 'Yellow has to be much lighter than red to match it in grey, blue much darker: hues sit at different natural values. A red and a green of the same value are two colours and one shape - which is why squinting, or looking in grey, is the first check of any painting.' },
];

/* ---- the view */
function hbShow() {
  if (!hb) hbLoad();
  const list = el('hbList'), lesson = HB_LESSONS.find(l => l.id === hb.lesson), i = HB_LESSONS.indexOf(lesson);
  list.innerHTML = HB_LESSONS.map((l, n) => `<button type="button" class="hb-item" data-hb-lesson="${l.id}" aria-current="${l.id === hb.lesson}">` +
    `<span class="hb-n">${hb.done.includes(l.id) ? '&#10003;' : n + 1}</span><span>${esc(l.title)}</span></button>`).join('');
  const body = el('hbLesson'), done = hb.done.includes(lesson.id);
  body.innerHTML = `<h3>${esc(lesson.title)}</h3>
    <p class="hb-theory">${lesson.theory}</p>
    <div class="hb-demo" id="hbDemo"></div>
    <h4>Try this</h4>
    <ol class="hb-try">${lesson.tryThis.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
    <details class="hb-see"><summary>What you should see</summary><p>${esc(lesson.see)}</p></details>
    <div class="row hb-foot">
      <button type="button" class="ghost" id="hbDone" aria-pressed="${done}">${done ? 'Done - mark as not done' : 'Mark as done'}</button>
      ${i < HB_LESSONS.length - 1 ? `<button type="button" class="primary" id="hbNext">Next: ${esc(HB_LESSONS[i + 1].title)}</button>` : ''}
    </div>`;
  lesson.build(el('hbDemo'));
  el('viewMeta').textContent = `${hb.done.length} of ${HB_LESSONS.length} lessons done.`;
}

function showHandbook() {
  if (!hb) { hbLoad(); initHandbook(); }
  hbShow();
}

function initHandbook() {
  el('hbList').addEventListener('click', e => {
    const b = e.target.closest('[data-hb-lesson]');
    if (!b) return;
    hb.lesson = b.dataset.hbLesson; hbSave(); hbShow();
  });
  el('hbLesson').addEventListener('click', e => {
    if (e.target.closest('#hbDone')) {
      hb.done = hb.done.includes(hb.lesson) ? hb.done.filter(id => id !== hb.lesson) : [...hb.done, hb.lesson];
      hbSave(); hbShow();
    } else if (e.target.closest('#hbNext')) {
      hb.lesson = HB_LESSONS[HB_LESSONS.findIndex(l => l.id === hb.lesson) + 1].id;
      hbSave(); hbShow(); el('hbLesson').scrollIntoView({ block: 'start' });
    }
  });
}
