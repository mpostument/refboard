/* refboard - Skies: a sky to study, made to order.
   Sky and cloud studies want many skies - the same cloud at dawn and at dusk,
   cumulus against a storm - and a photograph of each is a day's wait. This
   paints one on the spot: a time of day, a kind of cloud, how much of the sky
   it covers, and what is under it (nothing, low hills, the sea), with a new
   one at a click. It is a reference in the sense of a diagram, not a photograph:
   the clouds are noise, lit by a cheap rule, and the colours are estimates of a
   sky's, tuned by eye.

   How: the clouds are fractal noise (fbm of a value noise) on a flat deck of
   cloud above the viewer, seen in perspective - a ground-plane mapping turned
   upside down - so they crowd together and flatten toward the horizon as a
   real deck does, and the kinds differ in how the noise is stretched (stratus
   long and low, cirrus drawn out into wisps by a warp) and where it is cut
   off (the threshold, which the cover moves). A cloud is lit by one more
   sample of the same noise a few pixels toward the sun: if the cloud thins
   that way, this is its sun-facing rim and it is bright; if it thickens, the
   cloud's shadow side. The deeper in the cloud, the darker its base. The sky
   under it is three colours (zenith, middle, horizon) with the sun's glow
   added as light is, not painted over.

   The note says how to paint the sky shown, and gives its colours - the
   zenith, the horizon, a lit and a shaded cloud - measured off what was
   drawn. A sky can be saved as a PNG or opened in the workspace, so the
   value, edge and marker tools work on it like on any reference.
   Loaded with the section (loadSection('sky')). */
"use strict";

const SKY_KEY = 'refboard.sky.v1';
const SKY_W = 960, SKY_H = 540;

// Colours are [r, g, b]. zen, mid, hor: the sky from the top to the horizon; sun: where
// (x across, alt up from the horizon as a share of the picture) and its colour; lit and
// shade: a cloud's sunny and shadow sides; glow: how much of the sun's light spreads.
const SKY_TIMES = {
  dawn: { label: 'Dawn', zen: [58, 82, 148], mid: [158, 150, 190], hor: [252, 178, 150], sun: { x: 0.3, alt: 0.03, c: [255, 186, 140] }, lit: [255, 220, 204], shade: [112, 118, 160], glow: 0.9 },
  morning: { label: 'Morning', zen: [80, 138, 212], mid: [138, 182, 228], hor: [200, 220, 236], sun: { x: 0.3, alt: 0.22, c: [255, 240, 208] }, lit: [255, 252, 246], shade: [148, 166, 196], glow: 0.4 },
  noon: { label: 'Noon', zen: [38, 104, 202], mid: [88, 148, 222], hor: [168, 204, 238], sun: { x: 0.5, alt: 0.9, c: [255, 255, 240] }, lit: [255, 255, 255], shade: [138, 158, 190], glow: 0.12 },
  golden: { label: 'Golden hour', zen: [64, 100, 168], mid: [196, 160, 160], hor: [255, 192, 112], sun: { x: 0.72, alt: 0.07, c: [255, 196, 110] }, lit: [255, 226, 176], shade: [116, 102, 138], glow: 1 },
  dusk: { label: 'Dusk', zen: [28, 36, 86], mid: [128, 88, 128], hor: [232, 122, 92], sun: { x: 0.62, alt: -0.03, c: [255, 130, 100] }, lit: [250, 172, 150], shade: [66, 60, 102], glow: 0.8 },
  night: { label: 'Night', zen: [6, 10, 28], mid: [14, 22, 50], hor: [30, 44, 84], sun: { x: 0.7, alt: 0.45, c: [214, 224, 255] }, lit: [120, 138, 184], shade: [14, 20, 42], glow: 0.18, stars: true },
};
// How the noise is shaped: f the size of a cloud, ax and az its stretch across and in depth,
// thr(c) the density that is cloud for a cover c (0 to 1), soft how gradual the edge,
// warp the pull that draws wisps, alpha how solid, dark how much storm in its shadows.
const SKY_CLOUDS = {
  clear: { label: 'Clear' },
  cumulus: { label: 'Cumulus', f: 2.3, ax: 1, az: 1.9, oct: 5, thr: c => 0.78 - 0.34 * c, soft: 0.11, alpha: 1, dark: 0 },
  broken: { label: 'Broken layer', f: 3.4, ax: 0.8, az: 2.4, oct: 5, thr: c => 0.72 - 0.28 * c, soft: 0.17, alpha: 0.95, dark: 0 },
  stratus: { label: 'Overcast', f: 1.3, ax: 0.5, az: 2.3, oct: 4, thr: c => 0.62 - 0.46 * c, soft: 0.36, alpha: 0.97, dark: 0.15 },
  cirrus: { label: 'Cirrus wisps', f: 2, ax: 0.22, az: 1.4, oct: 5, thr: c => 0.76 - 0.27 * c, soft: 0.26, alpha: 0.7, dark: 0, warp: 0.6 },
  storm: { label: 'Storm', f: 1.5, ax: 0.9, az: 1.4, oct: 5, thr: c => 0.66 - 0.36 * c, soft: 0.2, alpha: 1, dark: 0.6 },
};
const SKY_GROUNDS = { none: 'Sky only', hills: 'Low hills', sea: 'The sea' };
const SKY_DEFAULTS = { time: 'golden', cloud: 'cumulus', cover: 55, ground: 'hills', seed: 7 };

function skyLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(SKY_KEY)) || {}; } catch { /* a fresh start */ }
  return {
    time: SKY_TIMES[v.time] ? v.time : SKY_DEFAULTS.time,
    cloud: SKY_CLOUDS[v.cloud] ? v.cloud : SKY_DEFAULTS.cloud,
    cover: Number.isFinite(+v.cover) ? Math.min(100, Math.max(0, Math.round(+v.cover))) : SKY_DEFAULTS.cover,
    ground: SKY_GROUNDS[v.ground] ? v.ground : SKY_DEFAULTS.ground,
    seed: Number.isInteger(v.seed) ? v.seed : SKY_DEFAULTS.seed,
  };
}
function skySave(s) { try { localStorage.setItem(SKY_KEY, JSON.stringify(s)); } catch { /* private mode */ } }

/* ---- the noise: the same seed always makes the same sky. */
function skyHash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function skyNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = skyHash(xi, yi, seed), b = skyHash(xi + 1, yi, seed), c = skyHash(xi, yi + 1, seed), d = skyHash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function skyFbm(x, y, seed, oct) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * skyNoise(x, y, seed + i * 17); n += a;
    x = x * 2.03 + 11.3; y = y * 2.03 + 7.1; a *= 0.5;
  }
  return s / n;
}
const skySS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const skyMix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const skyHex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/* The noise value (0 to 1, spread over the range so a threshold means a cover)
   of the cloud deck at a pixel: the deck is flat, above you, so it is
   mapped through the ground-plane's 1 / depth - v is 1 at the top of the
   picture and 0 at the horizon, where the deck runs away. */
function skyField(P, x, y, hy, seed) {
  const v = Math.max(0.002, (hy - y) / hy), z = 1 / (v * 0.9 + 0.12);
  let X = (x / SKY_W - 0.5) * 2.2 * z;
  if (P.warp) X += P.warp * (skyFbm(X * 0.7, z * 0.7, seed + 99, 3) - 0.5);
  return 0.5 + (skyFbm(X * P.f * P.ax, z * P.f * P.az, seed, P.oct) - 0.5) * 1.9;
}

// The ground line, as a share of the picture's height.
const skyHorizon = ground => ground === 'none' ? 1 : 0.8;

/* Draws the sky for state s onto canvas c; gives { palette, cloudShare } - the colours
   measured off the picture (null where there is none of it) and the share of the sky
   under cloud, percent. */
function skyRender(s, c) {
  const W = SKY_W, H = SKY_H, T = SKY_TIMES[s.time], P = SKY_CLOUDS[s.cloud];
  const hy = skyHorizon(s.ground) * H, sx = T.sun.x * W, sy = hy - T.sun.alt * H;
  c.width = W; c.height = H;
  const img = new ImageData(W, H), d = img.data;
  // Below 15% the cut-off is pushed out of the noise's reach, so a cover of 0 is a clear sky and a few clouds come in gradually.
  const cover = s.cover / 100, thr = P.thr ? P.thr(cover) + (cover < 0.15 ? 0.7 * (1 - cover / 0.15) ** 2 : 0) : 1, seed = s.seed;
  const sunOn = T.sun.alt > -0.01;
  const acc = { zen: null, hor: null, lit: [0, 0, 0, 0], shade: [0, 0, 0, 0] }, step = 7;
  // Where the sky's own colours are read - before any cloud is laid over them.
  const zx = W >> 1, zy = Math.round(0.03 * H), hx = Math.round(W * 0.12), hyy = Math.round(hy - 0.035 * H);
  let skyPx = 0, cloudPx = 0;
  const gsum = (a, col) => { a[0] += col[0]; a[1] += col[1]; a[2] += col[2]; a[3]++; };
  const hillTop = (x, k) => hy - (k ? 0.045 : 0.1) * H * (0.15 + 1.5 * skyFbm(x / W * (k ? 3.6 : 2) + 3 * k, 0.5 + k, seed + 313, 4)) + (k ? 0.01 * H : 0);
  const hillA = Float32Array.from({ length: W }, (_, x) => hillTop(x, 0)), hillB = Float32Array.from({ length: W }, (_, x) => hillTop(x, 1));
  const farC = skyMix(T.hor, [60, 56, 84], 0.5), nearC = skyMix(T.hor, [24, 24, 40], 0.78);
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, y / hy);
    const gradCol = t < 0.5 ? skyMix(T.zen, T.mid, (t / 0.5) ** 1.3) : skyMix(T.mid, T.hor, ((t - 0.5) / 0.5) ** 1.5);
    for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x);
      let col;
      if (y >= hy) {
        // Under the horizon: the sea, with the sun's path on it - or the hills' ground, never seen.
        if (s.ground === 'sea') {
          const k = (y - hy) / (H - hy);
          col = skyMix(skyMix(T.hor, T.zen, 0.35), skyMix(T.zen, [0, 0, 0], 0.45), Math.sqrt(k));
          const dx = (x - sx) / W, streak = T.glow * Math.exp(-dx * dx / (2 * (0.02 + 0.07 * k) ** 2)) * (0.35 + 0.65 * skyNoise(x * 0.04, y * 0.9, seed + 5)) * (1 - 0.6 * k);
          col = skyMix(col, T.sun.c, Math.min(1, streak * (T.sun.alt > -0.01 ? 0.9 : 0.4)));
        } else col = skyMix(T.hor, [24, 24, 40], 0.78);
      } else {
        col = gradCol;
        // The sun's glow, added as light: a round one about the sun and a band along the horizon.
        const dx = (x - sx) / W, dy = (y - sy) / H;
        const g1 = Math.exp(-(dx * dx + dy * dy * 2.2) / (2 * 0.13 * 0.13)) * T.glow;
        const g2 = Math.exp(-(((hy - y) / H) / 0.1) * (((hy - y) / H) / 0.1)) *Math.exp(-dx * dx / (2 * 0.38 * 0.38)) * T.glow;
        const gl = Math.min(1, g1 * 0.8 + g2 * 0.5);
        col = [255 - (255 - col[0]) * (1 - gl * T.sun.c[0] / 255), 255 - (255 - col[1]) * (1 - gl * T.sun.c[1] / 255), 255 - (255 - col[2]) * (1 - gl * T.sun.c[2] / 255)];
        const rr = Math.hypot(x - sx, y - sy), disc = 0.012 * W;
        if (sunOn && rr < disc + 1.5) col = skyMix(col, [255, 255, 250], skySS(disc + 1.5, disc - 1.5, rr));
        if (T.stars && skyHash(x, y, seed + 7) > 0.9987) col = skyMix(col, [255, 255, 255], 0.5 + 0.5 * skyHash(y, x, seed + 9));
        if (y === zy && x === zx) acc.zen = col.slice();
        if (y === hyy && x === hx) acc.hor = col.slice();
        let a = 0, lightness = 0;
        if (P.thr) {
          const f = skyField(P, x, y, hy, seed), dn = skySS(thr, thr + P.soft, f);
          if (dn > 0.003) {
            // Toward the sun: if the cloud thins that way, this is its bright rim.
            const ux = sx - x, uy = sy - y, un = Math.hypot(ux, uy) || 1;
            const f2 = skyField(P, x + ux / un * step, Math.min(hy - 1, y + uy / un * step), hy, seed);
            // f - f2 > 0: the cloud thickens away from the sun, so this face looks at it. A thin edge near the sun glows.
            const slope = Math.max(-1, Math.min(1, (f - f2) * 7)), core = skySS(thr + P.soft, thr + P.soft + 0.35, f);
            const sunNear = Math.exp(-(ux * ux + uy * uy) / (2 * (0.3 * W) ** 2));
            lightness = Math.max(0, Math.min(1, 0.6 + 0.38 * slope - 0.22 * core + 0.5 * (1 - dn) * (0.3 + 0.7 * sunNear) - P.dark * 0.25));
            const v = (hy - y) / hy;
            a = dn * P.alpha * skySS(0, 0.05, v);
            const shade = skyMix(T.shade, [30, 32, 44], P.dark * 0.7);
            let cc = skyMix(shade, T.lit, lightness);
            cc = skyMix(cc, skyMix(T.hor, [255, 255, 255], 0.2), Math.max(0, 1 - v * 3.5) * 0.55);   // haze in the distance
            col = skyMix(col, cc, a);
            skyPx++; if (a > 0.04) cloudPx++;
            if (a > 0.7) gsum(lightness > 0.6 ? acc.lit : lightness < 0.3 ? acc.shade : [0, 0, 0, 0], cc);
          } else skyPx++;
        } else skyPx++;
      }
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  // Hills last: two silhouettes, the far one lighter.
  if (s.ground === 'hills') {
    for (let x = 0; x < W; x++) for (let y = Math.floor(Math.min(hillA[x], hillB[x])); y < H; y++) {
      const i = 4 * (y * W + x), c2 = y >= hillB[x] ? nearC : y >= hillA[x] ? farC : null;
      if (c2) { d[i] = c2[0]; d[i + 1] = c2[1]; d[i + 2] = c2[2]; }
    }
  }
  c.getContext('2d').putImageData(img, 0, 0);
  const mean = a => a[3] > 40 ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : null;
  return { palette: { zenith: acc.zen, horizon: acc.hor, lit: mean(acc.lit), shade: mean(acc.shade) },
    cloudShare: skyPx ? cloudPx / skyPx * 100 : 0 };
}

// How to paint the sky shown: its time of day, then its clouds. Rules of thumb for watercolour.
function skyAdvice(s) {
  const out = [];
  out.push({
    dawn: 'Dawn: a wet sky, the warm rose and peach kept low and the cool blue-violet above, each grading into the next while it is damp - the colours meet soft, no edge.',
    morning: 'Morning: a clean graded wash, the strongest blue at the top thinning toward the horizon, which is nearly white-blue; shadows in clouds a warm grey, not black.',
    noon: 'Noon: the deepest and plainest sky - a graded blue wash from the top, the lightest at the horizon; clouds are almost white on top with a cool grey underside.',
    golden: 'Golden hour: warm first, at the bottom - yellow-orange near the horizon, grading up through rose to a cool violet-blue - and the shadow sides of the clouds violet, their lit edges the paper left bare.',
    dusk: 'Dusk: dark above, warm below - a blue-violet wash from the top, a hot orange-pink band by the horizon, and the cloud shapes darker than the sky behind them, with their rims the last light.',
    night: 'Night: a deep graded wash, the darkest at the top; the moon and stars are the paper (masking fluid) or gouache on top at the end. Clouds only show where the moon lights an edge.',
  }[s.time]);
  out.push({
    clear: 'No clouds: the whole picture is the graded wash. Wet the paper, tilt the board, and do not go back into it.',
    cumulus: 'Cumulus: paint the blue round the clouds and leave the paper (or lift with tissue) for their lit tops; give the bases one flat shadow grey while damp, flatter than the tops.',
    broken: 'A broken layer: the clouds shrink in size toward the horizon - paint them in rows, bigger at the top, and let the gaps between be the sky wash.',
    stratus: 'Overcast: one grey wash wet-in-wet, with a darker grey dropped into the lower band; no hard edges - a stratus sky is all soft transitions. The light is flat, so keep the land below it quiet.',
    cirrus: 'Cirrus: a pale graded wash first; the wisps are lifted out with a damp flat brush and tissue, all along one direction, thin and few.',
    storm: 'Storm: paint the darks first, wet-in-wet - a heavy grey of blue and a warm brown, darkest at the bases - and leave one lit rim of paper where the light breaks through.',
  }[s.cloud]);
  return out;
}

const skyChips = (id, obj, cur, attr) => Object.entries(obj).map(([k, v]) =>
  `<button type="button" class="chip" data-${attr}="${k}" aria-pressed="${cur === k}">${esc(v.label || v)}</button>`).join('');

function skyNote(s, r) {
  const sw = [['Top of the sky', r.palette.zenith], ['By the horizon', r.palette.horizon], ['Cloud, lit', r.palette.lit], ['Cloud, in shadow', r.palette.shade]]
    .filter(([, c]) => c).map(([n, c]) => `<span class="sky-sw"><i style="background:${skyHex(c)}"></i>${esc(n)} <code>${skyHex(c)}</code></span>`).join('');
  const hasCloud = s.cloud !== 'clear';
  const share = hasCloud ? `About ${Math.round(r.cloudShare)}% of the sky is under cloud. ` : '';
  return `<div class="sky-sws">${sw}</div>` + esc(share) +
    skyAdvice(s).map(t => esc(t)).join(' ') +
    ` <small>The colours are measured off the picture above - estimates of a sky's, not a measurement of one.</small>`;
}

let skyState = null, skyBusy = 0, skyLast = null;

function skyDraw() {
  const run = ++skyBusy;
  el('skyStatus').textContent = 'Painting the sky...';
  // A frame later, so the button has shown it was pressed before the work holds the page.
  setTimeout(() => {
    if (run !== skyBusy) return;
    skyLast = skyRender(skyState, el('skyCanvas'));
    el('skyStatus').textContent = '';
    el('skyNote').innerHTML = skyNote(skyState, skyLast);
    el('skyCanvas').setAttribute('aria-label', `A ${SKY_TIMES[skyState.time].label.toLowerCase()} sky, ${SKY_CLOUDS[skyState.cloud].label.toLowerCase()}`);
  }, 20);
}

function skySync() {
  const s = skyState;
  el('skyTime').innerHTML = skyChips('skyTime', SKY_TIMES, s.time, 'time');
  el('skyCloud').innerHTML = skyChips('skyCloud', SKY_CLOUDS, s.cloud, 'cloud');
  el('skyGround').innerHTML = skyChips('skyGround', SKY_GROUNDS, s.ground, 'ground');
  el('skyCover').value = s.cover; el('skyCoverOut').textContent = s.cover + '% of the sky';
  el('skyCoverRow').classList.toggle('hidden', s.cloud === 'clear');
}

function skyChange(patch) {
  Object.assign(skyState, patch);
  skySave(skyState);
  skySync();
  skyDraw();
}

function skyBlob() { return new Promise(res => el('skyCanvas').toBlob(res, 'image/png')); }

function skyInit() {
  skyState = skyLoad();
  el('skyTime').addEventListener('click', e => { const b = e.target.closest('[data-time]'); if (b) skyChange({ time: b.dataset.time }); });
  el('skyCloud').addEventListener('click', e => { const b = e.target.closest('[data-cloud]'); if (b) skyChange({ cloud: b.dataset.cloud }); });
  el('skyGround').addEventListener('click', e => { const b = e.target.closest('[data-ground]'); if (b) skyChange({ ground: b.dataset.ground }); });
  el('skyCover').addEventListener('input', () => { skyState.cover = +el('skyCover').value; skySave(skyState); el('skyCoverOut').textContent = skyState.cover + '% of the sky'; skyDraw(); });
  el('skyAnother').addEventListener('click', () => skyChange({ seed: Math.floor(Math.random() * 1e6) }));
  el('skySave').addEventListener('click', async () => {
    const blob = await skyBlob();
    if (blob) saveBlob(blob, `sky-${skyState.time}-${skyState.cloud}-${skyState.seed}.png`);
  });
  el('skyOpen').addEventListener('click', async () => {
    const blob = await skyBlob();
    if (blob) openInWorkspace(URL.createObjectURL(blob), { label: 'Sky study', tab: 'value' });
  });
}

// The section's two halves - the sky and the weather - and the switch between them.
function showSky() {
  if (!skyState) {
    skyInit();
    el('skyMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) skySetMode(b.dataset.mode); });
    if (typeof wxInit === 'function') wxInit();
  }
  skySync();
  let mode = 'sky';
  try { if (localStorage.getItem(SKY_MODE_KEY) === 'weather') mode = 'weather'; } catch { /* the sky */ }
  skySetMode(mode, false);
}

const SKY_MODE_KEY = 'refboard.skyMode.v1';
function skySetMode(mode, save = true) {
  if (save) try { localStorage.setItem(SKY_MODE_KEY, mode); } catch { /* private mode */ }
  for (const b of el('skyMode').children) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  el('skyPane').classList.toggle('hidden', mode !== 'sky');
  el('wxPane').classList.toggle('hidden', mode !== 'weather');
  if (mode === 'sky') { if (!skyLast) skyDraw(); }
  else if (typeof wxShow === 'function') wxShow();
}
