/* refboard - A photo as anime colouring: each flat shape of Simplify (simplify.js) given the
   three tones an anime is coloured in - a base, a shadow and a highlight - with hard edges
   between them, no gradient.

   The base is the shape's own colour. The shadow is not the base made darker: anime shifts it
   toward blue-violet, keeps the colour rich and goes only a step down in value. The highlight
   goes up a step and a little toward warm yellow. Both are made in OKLCH from the base.
   Which pixels of a shape are in shadow or light is read from the photo itself: a pixel that is
   darker than its shape's average by more than ANIME_SHADOW is shadow, lighter by more than
   ANIME_LIGHT is highlight. The levels are then voted within the shape so that grain does not
   become speckle, and a shape that has no real shading in the photo stays one flat tone.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// How far from the shape's average lightness (OKLab L, 0..1) a pixel must be to leave the base tone.
const ANIME_SHADOW = 0.045;
const ANIME_LIGHT = 0.06;
// The hue anime shadows lean to (blue-violet) and highlights lean to (warm yellow), in degrees, and how far each moves at most.
const ANIME_SHADOW_HUE = 285, ANIME_LIGHT_HUE = 85;
const ANIME_SHADOW_TURN = 22, ANIME_LIGHT_TURN = 14;

// The angle from a to b in degrees, the short way round (-180..180).
const animeTurn = (a, b) => ((b - a + 540) % 360) - 180;

/* The three tones for a shape colour (sRGB bytes): { base, shadow, light }, each [r, g, b].
   A grey (almost no chroma) takes its shadow's blue from the shift alone, which is how a
   white shirt gets a pale blue-grey shade. */
function animeTones(rgb) {
  const [L, a, b] = linToOklab(...rgb.map(c => srgbToLin(c / 255)));
  const C = Math.hypot(a, b), h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
  // A bright colour has room to go down; a dark one is shaded less, or it turns to black.
  const down = 0.07 + 0.09 * L, up = 0.05 + 0.05 * (1 - L);
  const toward = (hue, target, max) => (hue + Math.max(-max, Math.min(max, animeTurn(hue, target)))) % 360;
  const shadowC = Math.max(C * 1.05, 0.03 + C * 0.4), lightC = C * 0.92;
  const shadowH = C < 0.02 ? ANIME_SHADOW_HUE : (toward(h, ANIME_SHADOW_HUE, ANIME_SHADOW_TURN) + 360) % 360;
  const lightH = C < 0.02 ? ANIME_LIGHT_HUE : (toward(h, ANIME_LIGHT_HUE, ANIME_LIGHT_TURN) + 360) % 360;
  return {
    base: rgb.slice(),
    shadow: lchRgb(Math.max(0.05, L - down), shadowC, shadowH),
    light: lchRgb(Math.min(0.99, L + up), lightC, lightH),
  };
}

/* The level of each pixel - 0 shadow, 1 base, 2 highlight - from `tone` (the picture's lightness,
   OKLab L, one per pixel) and the shape `labels`. `shapes` is the list the labels index. */
function animeLevels(labels, tone, w, h, shapeCount) {
  const n = w * h, sum = new Float64Array(shapeCount), cnt = new Int32Array(shapeCount);
  for (let i = 0; i < n; i++) { sum[labels[i]] += tone[i]; cnt[labels[i]]++; }
  const mean = Array.from(sum, (s, k) => cnt[k] ? s / cnt[k] : 0);
  let lev = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = tone[i] - mean[labels[i]];
    lev[i] = d < -ANIME_SHADOW ? 0 : d > ANIME_LIGHT ? 2 : 1;
  }
  // Vote inside the shape, twice: grain does not become speckle, a sliver of shadow along an edge stays.
  const r = Math.max(1, Math.round(Math.max(w, h) / 160));
  for (let pass = 0; pass < 2; pass++) {
    const out = Uint8Array.from(lev);
    for (let y = r; y < h - r; y++) for (let x = r; x < w - r; x++) {
      const i = y * w + x, lab = labels[i];
      let c0 = 0, c1 = 0, c2 = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const j = i + dy * w + dx;
        if (labels[j] !== lab) continue;
        if (lev[j] === 0) c0++; else if (lev[j] === 1) c1++; else c2++;
      }
      out[i] = c0 > c1 && c0 >= c2 ? 0 : c2 > c1 && c2 > c0 ? 2 : 1;
    }
    lev = out;
  }
  // A shape whose shadow or light is only a few pixels has none: it stays one flat tone there.
  const per = Array.from({ length: shapeCount }, () => [0, 0, 0]);
  for (let i = 0; i < n; i++) per[labels[i]][lev[i]]++;
  const minLevel = Math.max(6, n * 0.0008);
  for (let i = 0; i < n; i++) if (lev[i] !== 1 && per[labels[i]][lev[i]] < minLevel) lev[i] = 1;
  return lev;
}

/* The picture as bytes (RGBA, w x h): every pixel in the tone its shape and level give.
   f: simplifyOf's result, with `tone`. */
function animeColour(f) {
  const tones = f.shapes.map(s => animeTones(s.rgb));
  const lev = animeLevels(f.labels, f.tone, f.w, f.h, f.shapes.length);
  const px = new Uint8ClampedArray(f.w * f.h * 4);
  const share = f.shapes.map(() => [0, 0, 0]);
  for (let i = 0; i < f.w * f.h; i++) {
    const k = f.labels[i], t = tones[k], c = lev[i] === 0 ? t.shadow : lev[i] === 2 ? t.light : t.base;
    px[4 * i] = c[0]; px[4 * i + 1] = c[1]; px[4 * i + 2] = c[2]; px[4 * i + 3] = 255;
    share[k][lev[i]]++;
  }
  return { px, tones, levels: lev, shaded: share.map(s => ({ shadow: s[0], base: s[1], light: s[2] })) };
}

// The key under the picture: for each shape (darkest first) its three tones as swatches.
function animeKey(f, a) {
  const swatch = (rgb, what) => `<i style="background:${rgbCss(rgb)}" title="${what} ${colHexOf(rgb)}"></i>`;
  const order = f.shapes.map((s, k) => k).sort((p, q) => f.shapes[p].L - f.shapes[q].L);
  return '<div class="hm-key">' + order.map(k => {
    const t = a.tones[k], sh = a.shaded[k], tot = sh.shadow + sh.base + sh.light;
    const used = sh.shadow < tot * 0.01 && sh.light < tot * 0.01 ? ' · flat' : '';
    return `<span title="${colHexOf(t.shadow)} / ${colHexOf(t.base)} / ${colHexOf(t.light)}">${swatch(t.shadow, 'shadow')}${swatch(t.base, 'base')}${swatch(t.light, 'highlight')}${f.shapes[k].share < 1 ? '<1' : Math.round(f.shapes[k].share)}%${used}</span>`;
  }).join('') + '</div>';
}
