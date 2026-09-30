/* refboard - The palette generator.
   A row of colours to plan a picture with: Space for a new one, a lock on
   each colour to keep it while the rest change, drag to reorder, and a
   colour's tints and shades to pick a lighter or darker one of it. The
   colours follow a harmony - neighbours, opposites, a triad - and a
   structure of values, so a palette is never five mid-tones: a painting
   reads by its values first.

   What a painter needs past a web colour tool: under each colour, how to
   mix it from your own paints (paint.js), and a switch to make only
   colours those paints can reach - the dashed outline of the Colour
   studio's wheel, used as a gamut mask. A picture's own palette comes here
   from the Colour studio, a palette you like is kept, and one goes to
   Generate as the colours of a reference made to order.

   Loaded the first time the view opens (loadSection('palette')). */
"use strict";

const PALGEN_KEY = 'refboard.palette.v1';
const PALGEN_MIN = 2, PALGEN_MAX = 8;
const PALGEN_SAVED_MAX = 40;
const PALGEN_UNDO_MAX = 40;
// Hue offsets from the palette's key hue, in OKLCH degrees; `spread` is
// analogous's, worked out for however many colours there are.
const PALGEN_HARMONIES = {
  any: { label: 'Any', hint: 'A different harmony each time.' },
  analogous: { label: 'Analogous', spread: 36, hint: 'Neighbours on the wheel - calm, one mood, one light.' },
  complementary: { label: 'Complementary', offsets: [0, 180], hint: 'Two opposite hues - the strongest contrast. Let one of them lead.' },
  split: { label: 'Split', offsets: [0, 150, 210], hint: 'One hue against the two beside its opposite - contrast without the clash.' },
  triadic: { label: 'Triadic', offsets: [0, 120, 240], hint: 'Three hues a third of the way round - lively; mute two of them.' },
  mono: { label: 'One hue', offsets: [0], hint: 'One hue in many values and intensities - the values do all the work.' },
};

let pg = null; // the view's state; null until first opened

function palgenLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(PALGEN_KEY)) || {}; } catch { /* a fresh start */ }
  const okRgb = c => Array.isArray(c) && c.length === 3 && c.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
  const sw = Array.isArray(v.swatches) ? v.swatches.filter(s => s && okRgb(s.rgb)).slice(0, PALGEN_MAX) : [];
  return {
    swatches: sw.length >= PALGEN_MIN ? sw.map(s => ({ rgb: s.rgb, locked: !!s.locked })) : null,
    harmony: PALGEN_HARMONIES[v.harmony] ? v.harmony : 'any',
    fit: !!v.fit,
    saved: Array.isArray(v.saved) ? v.saved.filter(p => Array.isArray(p?.rgb) && p.rgb.length >= PALGEN_MIN && p.rgb.every(okRgb)).slice(0, PALGEN_SAVED_MAX) : [],
  };
}
function palgenSave() {
  try {
    localStorage.setItem(PALGEN_KEY, JSON.stringify({
      swatches: pg.swatches, harmony: pg.harmony, fit: pg.fit, saved: pg.saved }));
  } catch { /* private mode - it lasts until a reload */ }
}

/* ---- making a palette. OKLCH throughout: lightness, chroma and hue are
   the painter's value, intensity and hue, and equal steps look equal. */

/* The values (OKLab lightness, 0 black to 1 white) the unlocked colours
   take. A palette of five mid-tones is flat whatever its hues: spread the
   values out, so there is a light, a dark and steps between, and leave out
   the step nearest each locked colour - that one is already there. */
function palgenValues(n, lockedL) {
  const steps = Array.from({ length: n }, (_, i) => 0.3 + 0.62 * (n === 1 ? 0.5 : i / (n - 1)) + rnd(-0.035, 0.035));
  for (const L of lockedL) {
    let bi = 0;
    for (let i = 1; i < steps.length; i++) if (Math.abs(steps[i] - L) < Math.abs(steps[bi] - L)) bi = i;
    steps.splice(bi, 1);
  }
  // Shuffled: the order along the row is the painter's to choose by dragging.
  for (let i = steps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [steps[i], steps[j]] = [steps[j], steps[i]]; }
  return steps;
}

// Where the harmony puts each of n colours, as offsets from the key hue.
function palgenOffsets(harmony, n) {
  const h = PALGEN_HARMONIES[harmony];
  if (h.spread) return Array.from({ length: n }, (_, i) => n === 1 ? 0 : -h.spread + 2 * h.spread * i / (n - 1));
  return Array.from({ length: n }, (_, i) => h.offsets[i % h.offsets.length]);
}

/* What the chosen paints can mix, as a shape on the wheel in OKLab a/b -
   the Colour studio draws the same one dashed. */
const palgenReachCache = {};
function palgenReach() {
  const k = paintPaletteKey() + '|' + paintMedium();
  if (!(k in palgenReachCache)) palgenReachCache[k] = paintReach();
  return palgenReachCache[k];
}
// A colour pulled in to the paints' reach along its own hue, its value kept.
function palgenFit(rgb) {
  const reach = palgenReach();
  if (!reach) return rgb;
  const [L, a, b] = linToOklab(...rgb.map(c => srgbToLin(c / 255)));
  if (pointInPolygon([a, b], reach)) return rgb;
  const [a2, b2] = mapIntoGamut([a, b], reach);
  // Kept to the screen too: a very light yellow, at its value, can be more
  // intense than sRGB shows, and clipping its red turns it green - out of
  // the paints' reach again. Less intense, same hue, until it fits.
  const fits = s => oklabToLin(L, a2 * s, b2 * s).every(c => c >= 0 && c <= 1);
  let s = 1;
  if (!fits(1)) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    s = lo;
  }
  return oklabToLin(L, a2 * s, b2 * s).map(c => Math.round(clamp01(linToSrgb(clamp01(c))) * 255));
}

function palgenGenerate() {
  const sw = pg.swatches, n = sw.length;
  const harmony = pg.harmony === 'any' ? pick(Object.keys(PALGEN_HARMONIES).filter(k => k !== 'any')) : pg.harmony;
  // The key hue: a locked colour's, if one has a hue at all, so the new
  // colours are in harmony with what was kept.
  const keyIdx = sw.findIndex(s => s.locked && rgbOklch(s.rgb)[1] >= 0.03);
  const key = keyIdx >= 0 ? rgbOklch(sw[keyIdx].rgb)[2] : rnd(0, 360);
  // Turned so the key colour sits at the harmony's own 0.
  const offs = palgenOffsets(harmony, n), shift = keyIdx >= 0 ? keyIdx : 0;
  const values = palgenValues(n, sw.filter(s => s.locked).map(s => rgbOklch(s.rgb)[0]));
  const free = sw.map((s, i) => s.locked ? -1 : i).filter(i => i >= 0);
  // Mostly muted, one colour allowed to sing - how most paintings are made.
  const accent = free.length ? pick(free) : -1;
  const next = sw.map((s, i) => {
    if (s.locked) return s;
    const hue = key + offs[(i - shift + n) % n] + rnd(-8, 8);
    const C = harmony === 'mono' ? rnd(0.02, 0.12) : i === accent ? rnd(0.13, 0.2) : rnd(0.03, 0.11);
    let rgb = lchRgb(values.pop(), C, (hue + 360) % 360);
    if (pg.fit) rgb = palgenFit(rgb);
    return { rgb, locked: false };
  });
  palgenSet(next, harmony);
}

/* ---- changing the palette: every change goes through here, so Undo can
   step back through all of them. */
function palgenSet(swatches, harmonyUsed) {
  if (pg.swatches) {
    pg.undo.push(pg.swatches);
    if (pg.undo.length > PALGEN_UNDO_MAX) pg.undo.shift();
  }
  pg.swatches = swatches.map(s => ({ rgb: s.rgb.slice(), locked: !!s.locked }));
  pg.lastHarmony = harmonyUsed || null;
  pg.shades = null;
  palgenSave();
  palgenRender();
}
function palgenUndo() {
  if (!pg.undo.length) return;
  pg.swatches = pg.undo.pop();
  pg.lastHarmony = null; pg.shades = null;
  palgenSave();
  palgenRender();
}

// A painter's name for a colour: its value, its intensity, its hue.
function palgenName(rgb) {
  const L = lstar(rgb), [, C, h] = rgbOklch(rgb);
  const value = L < 30 ? 'dark' : L < 55 ? '' : L < 80 ? 'light' : 'pale';
  const chroma = C < 0.03 ? '' : C < 0.08 ? 'muted' : C < 0.15 ? '' : 'vivid';
  return [value, chroma, C < 0.03 ? 'grey' : hueName(h)].filter(Boolean).join(' ');
}

// Tints and shades: the same hue and intensity at nine values, light to dark
// (the intensity comes down where the screen cannot show it at that value).
function palgenShades(rgb) {
  const [, C, h] = rgbOklch(rgb);
  return [94, 86, 77, 67, 57, 47, 37, 27, 17].map(L => colourAtLstar(L, C, h));
}

/* ---- the recipes. Mixing is tried in thousands of ways per colour - a
   tenth of a second each - so they are worked out one colour at a time
   after the row is drawn, and kept by colour: Space must feel instant, and
   a locked colour's recipe never needs working out twice. */
const palgenMixCache = new Map();
let palgenMixRun = 0;
function palgenMixKey(rgb) { return colHexOf(rgb) + '|' + paintPaletteKey() + '|' + paintMedium(); }
function palgenMixHtml(recipes) {
  const [best, ...more] = recipes;
  if (!best) return '<span class="count">Mixing needs js/vendor/spectral.js, which did not load.</span>';
  if (!more.length) return paintRecipeHtml(best);
  return `<details><summary>${paintRecipeHtml(best)} <span>· ${more.length} more</span></summary>${more.map(paintRecipeHtml).join('')}</details>`;
}
function palgenMixes() {
  const run = ++palgenMixRun;
  const cells = [...document.querySelectorAll('#pgRow .pg-mix')];
  const step = i => {
    if (run !== palgenMixRun || i >= cells.length) return;
    const cell = cells[i], rgb = pg.swatches[+cell.dataset.i]?.rgb;
    if (rgb) {
      const k = palgenMixKey(rgb);
      if (!palgenMixCache.has(k)) palgenMixCache.set(k, paintRecipes(rgb, paintPaletteKey(), 3, paintMedium()));
      cell.innerHTML = palgenMixHtml(palgenMixCache.get(k));
      cell.removeAttribute('aria-busy');
    }
    setTimeout(() => step(i + 1), 0);
  };
  // Those already known at once; the rest after the row is on screen.
  cells.forEach(c => {
    const k = palgenMixKey(pg.swatches[+c.dataset.i].rgb);
    if (palgenMixCache.has(k)) { c.innerHTML = palgenMixHtml(palgenMixCache.get(k)); c.removeAttribute('aria-busy'); }
  });
  setTimeout(() => step(0), 0);
}

/* ---- drawing it */
function palgenRender() {
  if (!pg) return;
  const sw = pg.swatches, n = sw.length;
  el('pgRow').innerHTML = sw.map((s, i) => {
    const hex = colHexOf(s.rgb), ink = lstar(s.rgb) > 62 ? 'dark' : 'light';
    const shades = pg.shades === i
      ? `<div class="pg-shades" role="group" aria-label="Tints and shades of ${hex}">` + palgenShades(s.rgb).map(c =>
        `<button type="button" class="pg-shade${colHexOf(c) === hex ? ' on' : ''}" data-pg-shade="${colHexOf(c)}" style="background:${colHexOf(c)};color:${lstar(c) > 62 ? '#111' : '#fff'}" aria-label="Use ${colHexOf(c)}, L* ${Math.round(lstar(c))}">${colHexOf(c)}</button>`).join('') + '</div>'
      : '';
    return `<div class="pg-sw ${ink}${s.locked ? ' locked' : ''}" data-i="${i}" draggable="true" style="--c:${hex}">` +
      `<div class="pg-colour">` +
        `<div class="pg-tools">` +
          `<button type="button" class="pg-tool" data-pg="lock" data-icon="${s.locked ? 'lock' : 'unlock'}" aria-pressed="${s.locked}" aria-label="${s.locked ? 'Unlock' : 'Lock'} colour ${i + 1}" title="${s.locked ? 'Locked - kept when the rest change' : 'Lock - keep it when the rest change'}"></button>` +
          `<button type="button" class="pg-tool" data-pg="shades" data-icon="layers" aria-pressed="${pg.shades === i}" aria-label="Tints and shades of colour ${i + 1}" title="Tints and shades - a lighter or darker one of it"></button>` +
          `<button type="button" class="pg-tool pg-move" data-pg="move" data-icon="move" aria-label="Move colour ${i + 1} - drag it, or the left and right arrow keys" title="Drag to move it (or the arrow keys)"></button>` +
          (n > PALGEN_MIN ? `<button type="button" class="pg-tool" data-pg="remove" data-icon="close" aria-label="Remove colour ${i + 1}" title="Remove it"></button>` : '') +
        `</div>` + shades +
        `<div class="pg-label"><button type="button" class="pg-hex" data-pg="copy" aria-label="Copy ${hex}" title="Copy">${hex}</button>` +
        `<span>${esc(palgenName(s.rgb))}</span><span>L* ${Math.round(lstar(s.rgb))}</span></div>` +
      `</div>` +
      `<div class="pg-mix count" data-i="${i}" aria-busy="true">Mixing...</div>` +
    `</div>`;
  }).join('');
  applyIcons(el('pgRow'));
  for (const b of document.querySelectorAll('[data-pg-harmony]')) b.setAttribute('aria-pressed', String(b.dataset.pgHarmony === pg.harmony));
  el('pgFit').setAttribute('aria-pressed', String(pg.fit));
  el('pgUndo').disabled = !pg.undo.length;
  el('pgAdd').disabled = n >= PALGEN_MAX;
  // Only where there is a ComfyUI to ask (initGenerate() shows its rail button).
  el('pgToGenerate').classList.toggle('hidden', !genAvailable());
  const used = pg.lastHarmony && pg.harmony === 'any' ? ` This one: ${PALGEN_HARMONIES[pg.lastHarmony].label.toLowerCase()}.` : '';
  el('pgHarmonyHint').textContent = PALGEN_HARMONIES[pg.harmony].hint + used;
  paintChipsSync();
  el('pgPaintHint').textContent = `Recipes for ${PAINT_PALETTES[paintPaletteKey()].label.toLowerCase()} in ${PAINT_MEDIA[paintMedium()].toLowerCase()} - the same as the Colour studio's and the eyedropper's.` +
    (pg.fit ? ' Only what they mix is on: every new colour is pulled in to what these paints can reach, its value kept.' : '');
  palgenRenderSaved();
  palgenMixes();
}

function palgenRenderSaved() {
  el('pgSaved').innerHTML = pg.saved.length
    ? pg.saved.map((p, i) => `<div class="pg-saved-row">` +
        `<button type="button" class="pg-strip" data-pg-open="${i}" aria-label="Open palette ${p.rgb.map(colHexOf).join(' ')}">` +
          p.rgb.map(c => `<i style="background:${colHexOf(c)}"></i>`).join('') + `</button>` +
        `<button type="button" class="ghost" data-pg-del="${i}" data-icon="close" aria-label="Delete this saved palette" title="Delete"></button>` +
      `</div>`).join('')
    : '<div class="count">None yet - Save keeps the palette above.</div>';
  applyIcons(el('pgSaved'));
}

// Move colour `from` to `to`, the rest shifting along.
function palgenMove(from, to) {
  if (to < 0 || to >= pg.swatches.length || from === to) return;
  const next = pg.swatches.slice(), [s] = next.splice(from, 1);
  next.splice(to, 0, s);
  palgenSet(next);
}

function initPalette() {
  pg = { ...palgenLoad(), undo: [], shades: null, lastHarmony: null };
  el('pgHarmony').innerHTML = Object.entries(PALGEN_HARMONIES)
    .map(([k, h]) => `<button class="chip" type="button" data-pg-harmony="${k}" title="${esc(h.hint)}">${h.label}</button>`).join('');
  el('pgHarmony').addEventListener('click', e => {
    const b = e.target.closest('[data-pg-harmony]');
    if (!b) return;
    // Picking a harmony is asking to see one.
    pg.harmony = b.dataset.pgHarmony;
    palgenGenerate();
  });
  // Recipes and the reach follow the paints; a palette already there stays.
  paintChips(el('pgMedium'), el('pgPaints'), palgenRender);
  document.addEventListener('refboard:materials', () => { if (pg && view.kind === 'palette') palgenRender(); });

  el('pgGenerate').addEventListener('click', palgenGenerate);
  el('pgUndo').addEventListener('click', palgenUndo);
  el('pgFit').addEventListener('click', () => {
    pg.fit = !pg.fit;
    // Kept to the paints from here on - and the palette there now, too.
    if (pg.fit) palgenSet(pg.swatches.map(s => s.locked ? s : { rgb: palgenFit(s.rgb), locked: false }));
    else { palgenSave(); palgenRender(); }
  });
  el('pgAdd').addEventListener('click', () => {
    if (pg.swatches.length >= PALGEN_MAX) return;
    // A neighbour of the last colour, a step of value away.
    const last = pg.swatches[pg.swatches.length - 1].rgb, [L, C, h] = rgbOklch(last);
    let rgb = lchRgb(L > 0.6 ? L - 0.18 : L + 0.18, C, (h + rnd(-20, 20) + 360) % 360);
    if (pg.fit) rgb = palgenFit(rgb);
    palgenSet([...pg.swatches, { rgb, locked: false }]);
  });
  el('pgCopy').addEventListener('click', e => copyLinkText(pg.swatches.map(s => colHexOf(s.rgb)).join(', '), e.currentTarget));
  el('pgSave').addEventListener('click', e => {
    const rgb = pg.swatches.map(s => s.rgb.slice()), key = rgb.map(colHexOf).join();
    // The same palette saved twice is one palette, moved to the top.
    pg.saved = [{ rgb, t: Date.now() }, ...pg.saved.filter(p => p.rgb.map(colHexOf).join() !== key)].slice(0, PALGEN_SAVED_MAX);
    palgenSave(); palgenRenderSaved();
    const b = e.currentTarget, label = b.textContent;
    b.textContent = 'Saved'; setTimeout(() => { b.textContent = label; }, 1400);
  });
  el('pgToGenerate').addEventListener('click', () => genUsePalette(pg.swatches.map(s => s.rgb)));
  el('pgFromPicture').addEventListener('click', () => openColour('picture'));
  el('pgSaved').addEventListener('click', e => {
    const open = e.target.closest('[data-pg-open]'), del = e.target.closest('[data-pg-del]');
    if (open) palgenSet(pg.saved[+open.dataset.pgOpen].rgb.map(rgb => ({ rgb, locked: false })));
    if (del) { pg.saved.splice(+del.dataset.pgDel, 1); palgenSave(); palgenRenderSaved(); }
  });

  const row = el('pgRow');
  /* A button clicked with the mouse lets go of the focus: left on it, the
     next Space would press it again - unlock the colour just locked -
     instead of making a new palette. From the keyboard it stays. */
  el('viewPalette').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (e.detail && b && b.id !== 'pgGenerate') b.blur();
  });
  row.addEventListener('click', e => {
    const shade = e.target.closest('[data-pg-shade]');
    const b = e.target.closest('[data-pg]'), sw = e.target.closest('.pg-sw');
    if (!sw) return;
    const i = +sw.dataset.i;
    if (shade) {
      const rgb = shade.dataset.pgShade.slice(1).match(/../g).map(h => parseInt(h, 16));
      palgenSet(pg.swatches.map((s, j) => j === i ? { rgb, locked: s.locked } : s));
      return;
    }
    if (!b) return;
    switch (b.dataset.pg) {
      case 'lock':
        pg.swatches[i].locked = !pg.swatches[i].locked;
        palgenSave(); palgenRender();
        if (!e.detail) row.querySelector(`.pg-sw[data-i="${i}"] [data-pg="lock"]`)?.focus();
        break;
      case 'shades':
        pg.shades = pg.shades === i ? null : i;
        palgenRender();
        if (!e.detail) row.querySelector(`.pg-sw[data-i="${i}"] [data-pg="shades"]`)?.focus();
        break;
      case 'remove': palgenSet(pg.swatches.filter((_, j) => j !== i)); break;
      case 'copy': copyLinkText(colHexOf(pg.swatches[i].rgb), b); break;
    }
  });
  // The move handle from the keyboard.
  row.addEventListener('keydown', e => {
    const b = e.target.closest('[data-pg="move"]');
    if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const i = +b.closest('.pg-sw').dataset.i, to = i + (e.key === 'ArrowLeft' ? -1 : 1);
    palgenMove(i, to);
    row.querySelector(`.pg-sw[data-i="${Math.max(0, Math.min(pg.swatches.length - 1, to))}"] [data-pg="move"]`)?.focus();
  });
  // And by dragging a colour along the row.
  let dragFrom = -1;
  row.addEventListener('dragstart', e => {
    const sw = e.target.closest('.pg-sw');
    if (!sw) return;
    dragFrom = +sw.dataset.i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colHexOf(pg.swatches[dragFrom].rgb));
    sw.classList.add('dragging');
  });
  row.addEventListener('dragover', e => { if (dragFrom >= 0 && e.target.closest('.pg-sw')) e.preventDefault(); });
  row.addEventListener('drop', e => {
    const sw = e.target.closest('.pg-sw');
    if (dragFrom < 0 || !sw) return;
    e.preventDefault();
    const from = dragFrom; dragFrom = -1;
    palgenMove(from, +sw.dataset.i);
  });
  row.addEventListener('dragend', () => { dragFrom = -1; row.querySelector('.dragging')?.classList.remove('dragging'); });

  // Space for a new palette, Ctrl+Z to go back - here only, and not while
  // a control that wants those keys has the focus (a sheet over the page
  // keeps its keys to itself).
  document.addEventListener('keydown', e => {
    if (view.kind !== 'palette' || e.defaultPrevented) return;
    if (e.target.closest('input, textarea, select, button, summary, [contenteditable]')) return;
    if (e.key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); palgenGenerate(); }
    else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); palgenUndo(); }
  });

  if (pg.swatches) palgenRender();
  else { pg.swatches = Array.from({ length: 5 }, () => ({ rgb: [128, 128, 128], locked: false })); pg.undo = []; palgenGenerate(); pg.undo = []; palgenRender(); }
}

function showPalette() {
  if (!pg) initPalette();
  else palgenRender(); // the paints may have been changed elsewhere since
}

// Colours from elsewhere - a picture's palette in the Colour studio - as
// the palette here, the one before it a step back with Undo.
function palgenTake(rgbs) {
  if (!pg) initPalette();
  palgenSet(rgbs.slice(0, PALGEN_MAX).map(rgb => ({ rgb: rgb.slice(), locked: false })));
}
