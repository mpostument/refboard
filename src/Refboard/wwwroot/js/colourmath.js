/* refboard - Helpers the trainers share with the rest of the app.
   One of the classic scripts index.html loads in order; see the note there.
   They were part of js/train.js, but the paint engine, the Colour studio and
   the palettes use them too, and the trainers themselves now load when the
   Train section is first opened (see loadSection() in js/core.js). */
"use strict";

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

function trainLibraryImage() {
  if (!INDEX) return null;
  const all = [];
  for (const pack of INDEX.packs) for (const g of pack.groups) for (const img of g.images) if (!isSkipped(img.src)) all.push(img.src);
  return all.length ? displayCandidates(pick(all))[0] : null;
}
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
const trainUrls = [];
function trainKeepUrl(u) { trainUrls.push(u); while (trainUrls.length > 4) URL.revokeObjectURL(trainUrls.shift()); return u; }
