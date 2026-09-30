/* refboard - Light and shadow: a colour under a chosen light, in the light
   and in its own shadow, with how to mix both. The Colour studio's Light tab.

   "Warm light, cool shadow" is not a rule of taste, it is two lights. The
   side that faces the sun is lit by the sun and the sky; the side turned
   away is lit by the sky alone - and the sky is blue. Indoors by a north
   window it turns round: the light is the cool sky, and what reaches the
   shadow has bounced off warm walls and floors. Under a lamp both are the
   lamp, so the shadow is only darker. So a light here is two: the key, and
   the fill that is all the shadow gets.

   Each is a spectrum over spectral.js's 38 bands (380-750 nm), not an RGB:
   the sun and a lamp as a black body at their colour temperature (Planck's
   law), the sky as sunlight scattered by the air, which scatters short
   waves most (Rayleigh, 1/wavelength^4 - softened here, since what reaches
   a shadow is sky and a little of everything else). A surface's colour
   under a light is its reflectance times the light, band by band - the same
   reflectance paint.js mixes with, so a blue cloth goes dark under a candle
   the way it does, not the way multiplying RGB guesses.

   spectral.js turns a reflectance into a colour as seen under daylight
   (D65, close to a black body at 6504 K), so the light is given relative to
   that: 6504 K relative to itself is 1 everywhere, and every colour is its
   own. Each light is scaled so paper in full light is as bright as the
   screen allows - a painter exposes for the light, not the shadow - and the
   shadow is the fill alone, `r` of the light's brightness.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const LT_KEY = 'refboard.light.v1';
const LT_NM = Array.from({ length: 38 }, (_, i) => 380 + 10 * i);
// The fill of each light: a colour temperature, and whether it is sky.
// `r` is the shadow's brightness against the light's - a deep outdoor
// shadow is a quarter of the sun, an overcast one more than half.
const LT_LIGHTS = {
  noon: { label: 'Midday sun', T: 5600, fill: { T: 5800, sky: true }, r: 0.25,
    hint: 'Sun from high up, a clear sky: the lit side a touch warm, the shadow lit by the blue sky.' },
  golden: { label: 'Golden hour', T: 3000, fill: { T: 5800, sky: true }, r: 0.45,
    hint: 'The sun low and orange, the sky still blue and now nearly as strong: the widest warm-cool split of the day.' },
  overcast: { label: 'Overcast', T: 6800, fill: { T: 6800 }, r: 0.6,
    hint: 'The whole sky is the light, and it lights the shadows too: soft, close in value, the same temperature on both sides.' },
  window: { label: 'North window', T: 8000, fill: { T: 3400 }, r: 0.25,
    hint: "The painter's studio light: cool sky through the glass, and a shadow lit by what bounced off warm walls and floor - cool light, warm shadow." },
  lamp: { label: 'Lamp', T: 2700, fill: { T: 2600 }, r: 0.12,
    hint: 'One warm lamp in a room: the shadow is the same lamp bounced off the walls - deep, and as warm as the light.' },
  moon: { label: 'Moonlight', T: 11000, fill: { T: 20000 }, r: 0.2, dim: 0.55,
    hint: 'Moonlight is sunlight off grey rock, but at night the eye loses the reds first - so it is painted cool, low in value, the shadows cooler still.' },
};
// Local colours to try a light on when there is no character: each what it
// is in plain daylight.
const LT_SAMPLES = [
  ['skin', 'Skin', [246, 214, 192]], ['white', 'White shirt', [238, 236, 230]], ['red', 'Red cloth', [184, 38, 58]],
  ['leaves', 'Leaves', [92, 138, 58]], ['blue', 'Blue cloth', [61, 90, 140]], ['hair', 'Dark hair', [58, 48, 52]],
];
const LT_SOURCES = { samples: 'Samples', character: 'Character' };

// A black body's radiance at wavelength nm, temperature T, up to a constant.
function ltPlanck(T, nm) { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4388e-2 / (l * T)) - 1)); }
/* A light's spectrum relative to daylight, band by band. The eye adapts:
   paper under a lamp looks cream, not the orange a camera set to daylight
   records - and a painter paints what the eye sees. So every temperature
   is taken LT_ADAPT of the way from daylight, in mired (1e6 / T, the scale
   on which equal steps look equal) - the key and the fill alike, so the
   difference between them, which is the point, survives. */
const LT_ADAPT = 0.5;
const ltSeen = T => 1e6 / (1e6 / 6504 + (1e6 / T - 1e6 / 6504) * LT_ADAPT);
function ltSpectrum({ T, sky }) {
  const t = ltSeen(T);
  return LT_NM.map(nm => ltPlanck(t, nm) / ltPlanck(6504, nm) * (sky ? (560 / nm) ** (4 * LT_ADAPT) : 1));
}
const ltLuma = E => new spectral.Color(E).XYZ[1];
const ltScale = (E, k) => E.map(v => v * k);

/* The light and the shadow of a setting, as spectra: the key plus the fill
   is the lit side, the fill alone the shadow. Both scaled so paper in the
   light is as bright as it can be on screen without a channel clipping -
   so a warm light shows warm, not a white that ran out of red. */
function ltIllum(T, fill, r, dim = 1) {
  const K = ltSpectrum({ T }), F = ltSpectrum(fill);
  const k = ltScale(K, 1 / ltLuma(K)), f = ltScale(F, r / ltLuma(F));
  const lit = k.map((v, i) => (v + f[i]) / (1 + r)), shade = f.map(v => v / (1 + r));
  const top = Math.max(1, ...new spectral.Color(lit).lRGB);
  return { lit: ltScale(lit, dim / top), shade: ltScale(shade, dim / top), key: k, fill: ltScale(F, 1 / ltLuma(F)) };
}
/* A daylight colour under a light: its reflectance times the light.
   Skin is not a surface: light goes into it, scatters, and some comes out
   on the shadow side - filtered twice by the skin on the way (R squared),
   so red. `glow` is that light, the lit side's, and LT_SKIN_GLOW of it
   reaches the shadow: without it a skin shadow under the sky is a dead
   grey, which no painter paints. */
const LT_SKIN_GLOW = 0.1;
function ltUnder(rgb, E, glow = null) {
  const R = new spectral.Color(rgb).R;
  return paintRgb(new spectral.Color(R.map((v, i) => v * E[i] + (glow ? LT_SKIN_GLOW * v * v * glow[i] : 0))));
}

/* How much warmer the key is than the fill: each alone on white paper,
   in OKLab, along the orange-blue axis (hue 60 degrees). Positive means warm light, cool
   shadow. */
function ltSplit(il) {
  const w = E => { const [, a, b] = new spectral.Color(E).OKLab; return a * 0.5 + b * 0.866; };
  return w(il.key) - w(il.fill);
}
function ltSplitText(d, T) {
  if (d > 0.02) return T <= 6500 ? 'Warm light, cool shadow' : 'Cool light, and a shadow cooler still';
  if (d < -0.02) return 'Cool light, warm shadow';
  return 'Light and shadow the same temperature - the shadow is only darker';
}

/* ---- the Light tab: the light chosen, then each colour - its own, in the
   light, in shadow - and one of them explained, with a ball lit by it. */
let lt = null;
function ltLoad() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(LT_KEY)) || {}; } catch {}
  const light = LT_LIGHTS[p.light] ? p.light : p.light === 'custom' ? 'custom' : 'golden';
  const base = LT_LIGHTS[light] || LT_LIGHTS.golden;
  lt = { light, T: Number.isFinite(p.T) ? p.T : base.T, r: Number.isFinite(p.r) ? p.r : base.r, fill: base.fill, dim: base.dim || 1,
    src: LT_SOURCES[p.src] ? p.src : 'samples', own: Array.isArray(p.own) && p.own.length === 3 ? p.own : null, sel: p.sel || null };
  if (light === 'custom' && p.fillOf && LT_LIGHTS[p.fillOf]) { lt.fill = LT_LIGHTS[p.fillOf].fill; lt.fillOf = p.fillOf; lt.dim = LT_LIGHTS[p.fillOf].dim || 1; }
}
function ltSave() {
  try { localStorage.setItem(LT_KEY, JSON.stringify({ light: lt.light, T: lt.T, r: lt.r, src: lt.src, own: lt.own, sel: lt.sel, fillOf: lt.fillOf })); } catch {}
}
function ltPick(key) {
  const L = LT_LIGHTS[key];
  Object.assign(lt, { light: key, T: L.T, r: L.r, fill: L.fill, dim: L.dim || 1, fillOf: undefined });
  ltSave();
}

// The colours the tab shows: yours first, then the samples or the sheet.
function ltRows() {
  const rows = [];
  if (lt.own) rows.push({ id: 'own', label: 'Your colour', rgb: lt.own });
  if (lt.src === 'character') {
    const doc = typeof charDoc === 'function' ? charDoc() : null;
    for (const p of CHAR_PARTS) {
      const base = doc && doc.parts[p.id] && doc.parts[p.id].base;
      if (base) rows.push({ id: p.id, label: p.label, rgb: base });
    }
  } else for (const [id, label, rgb] of LT_SAMPLES) rows.push({ id, label, rgb });
  return rows;
}

// A recipe per colour, kept: the search behind one is a few thousand mixes.
const ltRecipeCache = new Map();
function ltRecipe(rgb) {
  const key = rgb.join(',') + '|' + col.paints + '|' + col.medium;
  if (!ltRecipeCache.has(key)) ltRecipeCache.set(key, paintRecipes(rgb, col.paints, 1, col.medium)[0] || null);
  return ltRecipeCache.get(key);
}
/* In watercolour a cel shadow is painted as a glaze: the light colour first,
   dry, then one paint washed over where the shadow falls - the anime way,
   and cleaner than mixing a second colour. Which paint, how strong, comes
   nearest the shadow over this light colour's own recipe. */
function ltGlaze(litRecipe, shadowRgb) {
  if (!litRecipe || col.medium !== 'water') return null;
  const R = litRecipe.parts.length ? paintWash(litRecipe.parts, litRecipe.wash).R : paintInit().paper;
  const target = new spectral.Color(shadowRgb).OKLab;
  let best = null;
  for (const k of gzKeys(col.paints, 'water')) for (const s of [0.07, 0.11, 0.17, 0.25, 0.35, 0.5, 0.7]) {
    const c = new spectral.Color(gzOver(R, k, s)), l = c.OKLab;
    const dE = 100 * Math.hypot(l[0] - target[0], l[1] - target[1], l[2] - target[2]);
    if (!best || dE < best.dE) best = { k, s, dE, rgb: paintRgb(c) };
  }
  return best;
}

function lightRender() {
  if (!paintInit()) { el('ltRows').textContent = 'The paint model has not loaded.'; return; }
  if (!lt) ltLoad();
  for (const b of el('ltLights').children) b.setAttribute('aria-pressed', String(b.dataset.lt === lt.light));
  for (const b of el('ltSource').children) b.setAttribute('aria-pressed', String(b.dataset.ltSrc === lt.src));
  el('ltT').value = lt.T; el('ltTOut').textContent = `${Math.round(lt.T / 100) * 100} K`;
  el('ltR').value = Math.round(lt.r * 100); el('ltROut').textContent = `${Math.round(lt.r * 100)}%`;
  if (lt.own) el('ltOwn').value = colHex(lt.own);
  el('ltOwnClear').classList.toggle('hidden', !lt.own);
  const il = ltIllum(lt.T, lt.fill, lt.r, lt.dim);
  const L = LT_LIGHTS[lt.light];
  el('ltHint').textContent = (L ? L.hint : `Your own light at ${Math.round(lt.T / 100) * 100} K, the shadow still lit as by ${LT_LIGHTS[lt.fillOf || 'golden'].label.toLowerCase()}.`) +
    ` ${ltSplitText(ltSplit(il), lt.T)}.`;

  const rows = ltRows();
  if (!rows.some(r => r.id === lt.sel)) lt.sel = rows.length ? rows[0].id : null;
  const cell = (rgb, title) => `<i style="background:${rgbCss(rgb)}" title="${esc(title)} - ${colHex(rgb)}"></i>`;
  const empty = lt.src === 'character' && !rows.some(r => r.id !== 'own')
    ? '<div class="count">This character sheet has no colours yet - pick them on the Character tab, or look at the samples.</div>' : '';
  el('ltRows').innerHTML = (rows.length
    ? '<div class="lt-head"><span></span><span>Its own</span><span>In light</span><span>In shadow</span></div>' +
      rows.map(r => {
        r.lit = ltUnder(r.rgb, il.lit); r.shade = ltUnder(r.rgb, il.shade, r.id === 'skin' ? il.lit : null);
        return `<button type="button" class="lt-row${r.id === lt.sel ? ' on' : ''}" data-id="${r.id}" aria-pressed="${r.id === lt.sel}">` +
          `<span>${esc(r.label)}</span>${cell(r.rgb, 'In daylight')}${cell(r.lit, 'In the light')}${cell(r.shade, 'In shadow')}</button>`;
      }).join('')
    : '') + empty;
  ltRenderOne(rows.find(r => r.id === lt.sel), il);
}

/* One colour, explained: a ball in this light - cel shaded, two tones and
   the shadow it casts on the paper - and a recipe for each side. */
function ltRenderOne(r, il) {
  const host = el('ltOne');
  if (!r) { host.innerHTML = ''; el('ltNote').textContent = ''; return; }
  const paperLit = ltUnder(CHAR_PAPER, il.lit), paperShade = ltUnder(CHAR_PAPER, il.shade);
  const ball = `<svg class="lt-ball" viewBox="0 0 160 96" role="img" aria-label="${esc(r.label)} as a ball in this light">` +
    `<rect width="160" height="96" fill="${rgbCss(paperLit)}"/>` +
    `<ellipse cx="96" cy="80" rx="46" ry="9" fill="${rgbCss(paperShade)}"/>` +
    `<clipPath id="ltClip"><circle cx="70" cy="46" r="32"/></clipPath>` +
    `<circle cx="70" cy="46" r="32" fill="${rgbCss(r.shade)}"/>` +
    `<circle cx="58" cy="36" r="33" fill="${rgbCss(r.lit)}" clip-path="url(#ltClip)"/></svg>`;
  const lit = ltRecipe(r.lit), shade = ltRecipe(r.shade), glaze = ltGlaze(lit, r.shade);
  const row = (label, rec) => rec ? `<div class="lt-mix"><b>${label}</b>${paintRecipeHtml(rec)}</div>` : '';
  host.innerHTML = `<div class="lt-one">${ball}<div>` + row('Light', lit) + row('Shadow', shade) +
    (glaze ? `<div class="lt-mix"><b>Or glaze</b><span class="mix-row"><i style="background:${rgbCss(glaze.rgb)}" title="The glaze over the light colour, dry"></i>` +
      `<span>${esc(PIGMENTS[glaze.k].name)} · ${paintWashWord(glaze.s)} (~${Math.round(glaze.s * 100)}%), over the light colour when dry</span> <em>${paintMatchWord(glaze.dE)}</em></span></div>` : '') +
    '</div></div>';

  // What the light did to it, in words: how far each side moved from the
  // colour's own, and which way in temperature.
  const [L0, , h0] = rgbOklch(r.rgb), [L1, C1, h1] = rgbOklch(r.lit), [L2, C2, h2] = rgbOklch(r.shade);
  const turn = (a, b) => ((b - a + 540) % 360) - 180;
  const lines = [];
  lines.push(`In shadow it is ${Math.round(lstar(r.lit) - lstar(r.shade))} L* darker than in the light` +
    (C2 >= 0.03 && C1 >= 0.03 && Math.abs(turn(h1, h2)) >= 8 ? `, and turned ${Math.round(Math.abs(turn(h1, h2)))}° toward ${hueName(h2)}.` : ', much the same hue.'));
  if (C1 >= 0.03 && Math.abs(turn(h0, h1)) >= 8) lines.push(`Even the lit side is not its own colour: ${Math.round(Math.abs(turn(h0, h1)))}° toward ${hueName(h1)}.`);
  // Light goes into skin and comes back out red: the edge of its shadow
  // glows warm whatever the light, which the spectrum of a surface misses.
  if (r.id === 'skin') lines.push("Skin is the exception: light goes into it and comes out red on the shadow side, so its shadow keeps a warmth no cloth has - warmest at the edge, where light meets shadow.");
  if (lt.src === 'character') lines.push("The Character tab's own shadows assume warm light and a cool shadow; here they follow this light.");
  if (glaze && glaze.dE < 6) lines.push('In watercolour, paint the light colour over the whole shape, and glaze the shadow over it - one clean edge, the way anime is painted.');
  if (L0 > 0.9 && L1 > 0.9) lines.push("A white in the light is the light's own colour - on paper, a pale wash of it or the bare paper.");
  el('ltNote').textContent = lines.join(' ');
}

function initLight() {
  ltLoad();
  el('ltLights').innerHTML = Object.entries(LT_LIGHTS)
    .map(([k, v]) => `<button class="chip" type="button" data-lt="${k}" title="${esc(v.hint)}">${v.label}</button>`).join('');
  el('ltSource').innerHTML = Object.entries(LT_SOURCES)
    .map(([k, v]) => `<button class="chip" type="button" data-lt-src="${k}">${v}</button>`).join('');
  el('ltLights').addEventListener('click', e => {
    const b = e.target.closest('[data-lt]');
    if (b) { ltPick(b.dataset.lt); lightRender(); }
  });
  el('ltSource').addEventListener('click', e => {
    const b = e.target.closest('[data-lt-src]');
    if (b) { lt.src = b.dataset.ltSrc; ltSave(); lightRender(); }
  });
  // Moving a slider makes the light your own; its fill stays the one it
  // came from, so a warmer "midday" still has a sky in its shadows.
  const own = () => { if (lt.light !== 'custom') { lt.fillOf = lt.light; lt.light = 'custom'; } };
  el('ltT').addEventListener('input', e => { own(); lt.T = +e.target.value; ltSave(); lightRender(); });
  el('ltR').addEventListener('input', e => { own(); lt.r = +e.target.value / 100; ltSave(); lightRender(); });
  el('ltOwn').addEventListener('input', e => {
    const h = e.target.value;
    lt.own = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); lt.sel = 'own'; ltSave(); lightRender();
  });
  el('ltOwnClear').addEventListener('click', () => { lt.own = null; ltSave(); lightRender(); });
  el('ltRows').addEventListener('click', e => {
    const b = e.target.closest('.lt-row');
    if (b) { lt.sel = b.dataset.id; ltSave(); lightRender(); }
  });
}

// The Character tab's way here: its colours, under another light.
function lightForCharacter() {
  if (!lt) ltLoad();
  lt.src = 'character'; ltSave();
  colourTab('light');
}
