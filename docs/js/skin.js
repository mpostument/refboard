/* refboard - Skin tones: a complexion in a light, in the four zones a painter
   names - the light, the halftone, the shadow and the reflected light - with
   a recipe for each from your own paints. The Colour studio's Skin tab.

   The Light tab already knows what a light does to a colour, and what skin
   does that cloth does not: light goes into skin, scatters, and comes back
   out red, so a skin shadow keeps a warmth (LT_SKIN_GLOW). This tab asks
   that for nine complexions under each of its lights and names the results:
     light      the skin where the light strikes it: its colour under the lit
                side's spectrum;
     halftone   where the form turns from the light - the middle of the lit
                side's and the shadow's light, with the skin's own glow
                counted double, and its chroma then set to the greater of its
                own lifted by SK_HALF_CHROMA and the light's raised by
                SK_HALF_OVER: the turning edge is where skin is reddest, and a
                painter puts the most colour there. A darker version of the
                same skin has less colour, not more, so the rule is stated and
                not left to fall out of the spectra;
     shadow     the skin under the fill alone, with the glow;
     reflected  the shadow lit also by what is round it: the light bounced
                off a surface of the colour chosen (so green grass gives a
                green reflected light, a warm earth a warm one), a third of
                the light's strength times that surface's own spectrum. It
                lands between the shadow and the halftone, never past the
                halftone - the same rule as the Handbook's lit ball.
   The nine daylight skin colours are estimates, chosen to be spread evenly
   in lightness from a pale anime skin to the deepest; there is no one skin
   colour for a complexion, so "Your own" takes any colour.

   The recipes are the Light tab's (paintRecipes over the chosen palette),
   found one zone at a time after the swatches are drawn, since each search
   is a few thousand mixes.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const SK_KEY = 'refboard.skin.v1';
const SK_COMPLEXIONS = [
  { id: 'anime', label: 'Anime pale', rgb: [252, 228, 214] },
  { id: 'vfair', label: 'Very fair', rgb: [246, 222, 205] },
  { id: 'fair', label: 'Fair', rgb: [240, 204, 178] },
  { id: 'light', label: 'Light', rgb: [226, 185, 152] },
  { id: 'olive', label: 'Olive', rgb: [205, 160, 120] },
  { id: 'tan', label: 'Tan', rgb: [176, 125, 88] },
  { id: 'brown', label: 'Brown', rgb: [142, 92, 62] },
  { id: 'deep', label: 'Deep brown', rgb: [105, 66, 45] },
  { id: 'vdeep', label: 'Very deep', rgb: [72, 46, 36] },
];
// What the reflected light came from: a surface's colour in daylight.
const SK_BOUNCES = [
  { id: 'earth', label: 'Warm earth', rgb: [150, 112, 84] },
  { id: 'white', label: 'White cloth or wall', rgb: [236, 236, 230] },
  { id: 'grass', label: 'Grass', rgb: [92, 138, 58] },
  { id: 'blue', label: 'Blue cloth', rgb: [61, 90, 140] },
];
const SK_HALF_CHROMA = 1.18;      // the halftone's chroma against the lit-and-shadow middle's
const SK_HALF_OVER = 1.08;        // and at least this much over the light's
const SK_BOUNCE_STRENGTH = 0.3;     // the bounced light, against the light's own
const SK_ZONES = [
  { id: 'light', label: 'Light', about: 'where the light strikes: the palest of the four - in watercolour, the bare paper or a thin wash.' },
  { id: 'half', label: 'Halftone', about: 'where the form turns away from the light: the most colour, the warmest of the four.' },
  { id: 'shadow', label: 'Shadow', about: 'away from the light: darker, and still warm - skin glows from within.' },
  { id: 'refl', label: 'Reflected light', about: 'light bounced back from what is round it: it lifts the edge of the shadow, and is never as light as the halftone.' },
];

let sk = null;     // { c, own, light, bounce }
function skLoad() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(SK_KEY)) || {}; } catch { /* private mode, or damaged: defaults */ }
  sk = {
    c: p.c === 'own' || SK_COMPLEXIONS.some(x => x.id === p.c) ? p.c : 'light',
    own: Array.isArray(p.own) && p.own.length === 3 && p.own.every(v => Number.isInteger(v) && v >= 0 && v <= 255) ? p.own : null,
    light: LT_LIGHTS[p.light] ? p.light : 'noon',
    bounce: SK_BOUNCES.some(x => x.id === p.bounce) ? p.bounce : 'earth',
  };
  if (sk.c === 'own' && !sk.own) sk.c = 'light';
}
function skSave() {
  try { localStorage.setItem(SK_KEY, JSON.stringify(sk)); } catch { /* private mode */ }
}

const skMix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* The four zones of a skin colour under a light: { light, half, shadow, refl },
   each an [r, g, b]. il: ltIllum()'s spectra; bounce: the surface's [r, g, b]. */
function skinZones(base, il, bounce) {
  const R = new spectral.Color(bounce).R;
  const lit = ltUnder(base, il.lit);
  const middle = il.lit.map((v, i) => (v + il.shade[i]) / 2);
  const turning = ltUnder(base, middle, il.lit.map(v => v * 2)), [tl, tc, th] = rgbOklch(turning);
  const half = lchRgb(tl, Math.max(tc * SK_HALF_CHROMA, rgbOklch(lit)[1] * SK_HALF_OVER), th);
  const shadow = ltUnder(base, il.shade, il.lit);
  const bounced = il.shade.map((v, i) => v + SK_BOUNCE_STRENGTH * il.lit[i] * R[i]);
  const refl = ltUnder(base, bounced, il.lit);
  return { light: lit, half, shadow, refl };
}

function skBase() { return sk.c === 'own' ? sk.own : SK_COMPLEXIONS.find(x => x.id === sk.c).rgb; }
function skIllum() {
  const L = LT_LIGHTS[sk.light];
  return ltIllum(L.T, L.fill, L.r, L.dim || 1);
}

// A ball lit from the upper left, shaded through the four zones - the same arrangement as a painter's study of a form.
function skBall(cv, z, paper, paperShade) {
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), img = g.createImageData(W, H), px = img.data;
  const cx = W * 0.44, cy = H * 0.47, r = H * 0.4;
  const norm = v => { const l = Math.hypot(...v); return v.map(c => c / l); };
  const Ld = norm([-0.55, -0.6, 0.58]), Bd = norm([0.7, 0.5, 0.35]);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x), nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d2 = nx * nx + ny * ny;
    let c;
    if (d2 <= 1) {
      const nz = Math.sqrt(1 - d2), t = nx * Ld[0] + ny * Ld[1] + nz * Ld[2];
      c = skMix(z.shadow, z.half, smooth(0, 0.4, t));
      c = skMix(c, z.light, smooth(0.38, 0.72, t));
      const b = Math.max(0, nx * Bd[0] + ny * Bd[1] + nz * Bd[2]) ** 1.6 * smooth(0.15, -0.35, t);
      c = skMix(c, z.refl, Math.min(1, b * 1.4));
    } else {
      // The cast shadow on the paper: an ellipse under the ball, soft at its edge.
      const ex = (x + 0.5 - cx - r * 0.35) / (r * 1.25), ey = (y + 0.5 - cy - r * 0.95) / (r * 0.3);
      c = skMix(paper, paperShade, 1 - smooth(0.7, 1, Math.hypot(ex, ey)));
    }
    px[i] = Math.round(c[0]); px[i + 1] = Math.round(c[1]); px[i + 2] = Math.round(c[2]); px[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

let skRun = 0;
function skinRender() {
  if (!paintInit()) { el('skZones').textContent = 'The paint model has not loaded.'; return; }
  if (!sk) skLoad();
  const il = skIllum(), bounce = SK_BOUNCES.find(b => b.id === sk.bounce).rgb;
  for (const b of el('skLights').children) b.setAttribute('aria-pressed', String(b.dataset.skLight === sk.light));
  for (const b of el('skBounce').children) b.setAttribute('aria-pressed', String(b.dataset.skBounce === sk.bounce));
  el('skLightHint').textContent = LT_LIGHTS[sk.light].hint + ` ${ltSplitText(ltSplit(il), LT_LIGHTS[sk.light].T)}.`;
  if (sk.own) el('skOwn').value = colHex(sk.own);

  // The grid: every complexion in this light, one row each, the four zones across.
  const rows = SK_COMPLEXIONS.slice();
  if (sk.own) rows.unshift({ id: 'own', label: 'Your own', rgb: sk.own });
  const cell = (rgb, title) => `<i style="background:${rgbCss(rgb)}" title="${esc(title)} - ${colHex(rgb)}"></i>`;
  el('skGrid').innerHTML = '<div class="lt-head"><span></span>' + SK_ZONES.map(z => `<span>${z.label}</span>`).join('') + '</div>' +
    rows.map(r => {
      const z = skinZones(r.rgb, il, bounce);
      return `<button type="button" class="lt-row${r.id === sk.c ? ' on' : ''}" data-sk-c="${r.id}" aria-pressed="${r.id === sk.c}">` +
        `<span>${esc(r.label)}</span>${SK_ZONES.map(zn => cell(z[zn.id], zn.label)).join('')}</button>`;
    }).join('');

  // The one chosen: a ball, and each zone with its words and (soon) its recipe.
  const z = skinZones(skBase(), il, bounce);
  skBall(el('skBall'), z, ltUnder(CHAR_PAPER, il.lit), ltUnder(CHAR_PAPER, il.shade));
  el('skZones').innerHTML = SK_ZONES.map(zn => {
    const L = Math.round(lstar(z[zn.id]));
    return `<div class="sk-zone" data-sk-zone="${zn.id}"><i style="background:${rgbCss(z[zn.id])}"></i><div>` +
      `<b>${zn.label}</b> <small>${colHex(z[zn.id])} - L* ${L}</small><div class="count">${esc(zn.about)}</div>` +
      `<div class="sk-mix"></div></div></div>`;
  }).join('');
  el('skNote').textContent = skNote(z);

  // Recipes, one zone at a time, so the swatches are not held up by a few thousand mixes each.
  const run = ++skRun, medium = col.medium;
  const fill = k => {
    if (run !== skRun || k >= SK_ZONES.length) return;
    const zn = SK_ZONES[k], host = el('skZones').querySelector(`[data-sk-zone="${zn.id}"] .sk-mix`);
    if (host) {
      const rec = ltRecipe(z[zn.id]);
      let html = rec ? paintRecipeHtml(rec) : '';
      if (zn.id === 'shadow' && medium === 'water') {
        const glaze = ltGlaze(ltRecipe(z.light), z.shadow);
        if (glaze) html += `<span class="mix-row"><i style="background:${rgbCss(glaze.rgb)}" title="The glaze over the light colour, dry"></i>` +
          `<span>Or glaze: ${esc(PIGMENTS[glaze.k].name)} · ${paintWashWord(glaze.s)} (~${Math.round(glaze.s * 100)}%), over the light colour when dry</span> <em>${paintMatchWord(glaze.dE)}</em></span>`;
      }
      host.innerHTML = html;
    }
    setTimeout(() => fill(k + 1), 0);
  };
  setTimeout(() => fill(0), 0);
}

// The steps between the zones in numbers, and what the rest of the complexion's range teaches.
function skNote(z) {
  const L = Object.fromEntries(SK_ZONES.map(zn => [zn.id, lstar(z[zn.id])]));
  const [, Cl, hl] = rgbOklch(z.light), [, Ch, hh] = rgbOklch(z.half), [, , hs] = rgbOklch(z.shadow);
  const turn = ((hs - hl + 540) % 360) - 180;
  const say = [`Light ${Math.round(L.light)}, halftone ${Math.round(L.half)}, shadow ${Math.round(L.shadow)}, reflected light ${Math.round(L.refl)} (L*): the shadow is ${Math.round(L.light - L.shadow)} darker than the light, and the reflected light stands ${Math.round(L.refl - L.shadow)} above the shadow and ${Math.round(L.half - L.refl)} under the halftone.`];
  if (Ch > Cl * 1.02) say.push(`The halftone has ${Math.round((Ch / Cl - 1) * 100)}% more colour than the light: put the strongest colour where the form turns.`);
  if (Math.abs(turn) >= 6) say.push(`The shadow's hue has turned ${Math.round(Math.abs(turn))}° from the light's - the shadow is not the light made darker.`);
  if (L.light < 45) say.push('On deep skin the whole range is narrower and the highlight picks up the light itself, cooler and lighter than the rest: leave a little bare paper, or lift one out.');
  if (L.refl >= L.half - 2) say.push('The reflected light has caught up with the halftone here - it will read flat; keep it small and soft.');
  return say.join(' ');
}

function initSkin() {
  skLoad();
  el('skLights').innerHTML = Object.entries(LT_LIGHTS).map(([k, v]) => `<button class="chip" type="button" data-sk-light="${k}" title="${esc(v.hint)}">${v.label}</button>`).join('');
  el('skBounce').innerHTML = SK_BOUNCES.map(b => `<button class="chip" type="button" data-sk-bounce="${b.id}"><i class="hb-dot" style="background:${rgbCss(b.rgb)}"></i> ${b.label}</button>`).join('');
  el('skLights').addEventListener('click', e => { const b = e.target.closest('[data-sk-light]'); if (b) { sk.light = b.dataset.skLight; skSave(); skinRender(); } });
  el('skBounce').addEventListener('click', e => { const b = e.target.closest('[data-sk-bounce]'); if (b) { sk.bounce = b.dataset.skBounce; skSave(); skinRender(); } });
  el('skGrid').addEventListener('click', e => { const b = e.target.closest('[data-sk-c]'); if (b) { sk.c = b.dataset.skC; skSave(); skinRender(); } });
  el('skOwn').addEventListener('input', e => { sk.own = hexToRgb(e.target.value); sk.c = 'own'; skSave(); skinRender(); });
}
