/* refboard - Anime study, the four more tools: Inking, Folds, Layers and Angles. What they work out
   is in js/animemore.js; this is the page that gathers the choices and shows the answers. Nothing is
   uploaded: a drawing is read in this browser and goes when you leave the page, and the choices are
   kept in this browser. The hair and eye colours are the ones Outfits uses (js/animetools.js).
   Loaded with the section (loadSection('anime')); asInit() in js/animestudy.js calls amuInit(). */
"use strict";

const AMU_KEY = 'refboard.animeMore.v1';
const AMU_MODES = ['inking', 'folds', 'layers', 'angles'];

function amuLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(AMU_KEY)) || {}; } catch { /* defaults */ }
  const key = (v, map, d) => (Object.hasOwn(map, v) ? v : d);
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const num = (v, lo, hi, d) => (v == null || v === '' || !Number.isFinite(+v) ? d : adClamp(+v, lo, hi));
  return {
    light: key(s.light, AM_INK_LIGHTS, 'ul'), pen: key(s.pen, AM_PENS, 'liner'),
    spot: key(s.spot, AM_FOLD_SPOTS, 'all'),
    material: key(s.material, AM_MATERIALS, 'water'), part: key(s.part, AM_PARTS, 'skin'),
    skin: hex(s.skin, AM_PART_DEFAULT.skin), cloth: hex(s.cloth, AM_PART_DEFAULT.cloth),
    bgOn: s.bgOn === true, bg: hex(s.bg, '#6fa8dc'),
    pitch: Math.round(num(s.pitch, -60, 60, 0)), roll: Math.round(num(s.roll, -30, 30, 0)), near: num(s.near, 0, 1, 0.5),
  };
}
function amuSave(s) { try { localStorage.setItem(AMU_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
function amuPatch(patch) { const s = { ...amuLoad(), ...patch }; amuSave(s); return s; }

const amu = { ink: null, svg: {}, run: 0 };

function amuInit() {
  // Inking.
  adMakeChips('ainLight', Object.entries(AM_INK_LIGHTS), v => { amuPatch({ light: v }); amuInkRender(); });
  adMakeChips('ainPen', Object.entries(AM_PENS).map(([k, v]) => [k, v.label]), v => { amuPatch({ pen: v }); amuInkRender(); });
  el('ainPick').addEventListener('click', () => el('ainInput').click());
  el('ainInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) amuInkLoad(f); });
  el('ainPane').addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  el('ainPane').addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); amuInkLoad(f); } });
  el('ainSave').addEventListener('click', async () => { const b = await atBlob(el('ainMap')); if (b) atDownload(b, 'anime-ink-map.png'); });
  el('ainOpen').addEventListener('click', async () => { const b = await atBlob(el('ainMap')); if (b) openInWorkspace(URL.createObjectURL(b), { label: 'Ink line weights', tab: 'colour' }); });
  // Folds.
  adMakeChips('aflSpot', Object.entries(AM_FOLD_SPOTS).map(([k, v]) => [k, v.label]), v => { amuPatch({ spot: v }); amuFoldsRender(); });
  adWire('afl', () => amu.svg.folds, 'anime-folds', 'anime-folds', () => AM_FOLD_SPOTS[amuLoad().spot].types.map(k => AM_FOLDS[k].words).join(', '));
  // Layers.
  adMakeChips('alyMaterial', Object.entries(AM_MATERIALS), v => { amuPatch({ material: v }); amuLayersRender(); });
  adMakeChips('alyPart', Object.entries(AM_PARTS), v => { amuPatch({ part: v }); amuLayersRender(); });
  el('alyColour').addEventListener('input', () => {
    const s = amuLoad(), c = el('alyColour').value;
    if (s.part === 'hair' || s.part === 'eyes') { const a = atLoad(); a[s.part] = c; atSave(a); } else amuPatch({ [s.part]: c });
    amuLayersRender();
  });
  el('alyBgOn').addEventListener('change', () => { amuPatch({ bgOn: el('alyBgOn').checked }); amuLayersRender(); });
  el('alyBg').addEventListener('input', () => { amuPatch({ bg: el('alyBg').value }); amuLayersRender(); });
  paintChips(el('alyMedium'), el('alyPaints'), () => amuLayersRender());
  el('alyPalette').addEventListener('click', () => { const rgbs = (amu.layers || []).filter(r => r.rgb).map(r => r.rgb); if (rgbs.length) openPalette(rgbs); });
  el('alyCopy').addEventListener('click', async () => {
    const t = (amu.layers || []).map(r => `${r.n}. ${r.text}`).join('\n');
    try { await navigator.clipboard.writeText(t); el('alyStatus').textContent = 'Copied.'; } catch { el('alyStatus').textContent = 'Could not copy - select the steps and copy them.'; }
  });
  // Angles.
  adMakeChips('aanKind', Object.entries(AM_ANGLES).map(([k, [label]]) => [k, label]), v => { amuPatch({ pitch: AM_ANGLES[v][1] }); el('aanPitch').value = AM_ANGLES[v][1]; amuAnglesRender(); });
  for (const [id, k] of [['aanPitch', 'pitch'], ['aanRoll', 'roll'], ['aanNear', 'near']]) el(id).addEventListener('input', () => { amuPatch({ [k]: +el(id).value }); amuAnglesRender(); });
  adWire('aan', () => amu.svg.angles, 'anime-angle', 'anime-angles', () => amAngleWords(amuLoad().pitch));
}

// The pane for a mode has just been shown.
function amuShow(mode) {
  if (!AMU_MODES.includes(mode)) return;
  if (mode === 'inking') { adPress('ainLight', amuLoad().light); adPress('ainPen', amuLoad().pen); amuInkRender(); }
  if (mode === 'folds') amuFoldsRender();
  if (mode === 'layers') amuLayersRender();
  if (mode === 'angles') { const s = amuLoad(); el('aanPitch').value = s.pitch; el('aanRoll').value = s.roll; el('aanNear').value = s.near; amuAnglesRender(); }
}

/* ---- inking */

async function amuInkLoad(file) {
  el('ainStatus').textContent = 'Reading the drawing...';
  try { amu.ink = await afImageCanvas(file); } catch { el('ainStatus').textContent = 'Could not read that picture.'; return; }
  amuInkRender();
}

function amuInkRender() {
  const s = amuLoad();
  adPress('ainLight', s.light); adPress('ainPen', s.pen);
  el('ainPens').innerHTML = `<b>${esc(AM_PENS[s.pen].label)}</b>` + `<table>${AM_PENS[s.pen].rows.map(([w, size, use]) => `<tr><th>${esc(w)}</th><td>${esc(size)}</td><td>${esc(use)}</td></tr>`).join('')}</table>`;
  if (!amu.ink) return;
  const read = amInkRead(amu.ink), res = amInkWeights(read.gray, read.w, read.h, AD_LIGHTS[s.light][1]);
  amu.inkRes = res;
  const map = amInkCanvas(res), dst = el('ainMap'), src = el('ainSrc');
  dst.width = map.width; dst.height = map.height; dst.getContext('2d').drawImage(map, 0, 0);
  src.width = read.w; src.height = read.h; src.getContext('2d').drawImage(amu.ink, 0, 0, read.w, read.h);
  el('ainPair').classList.remove('hidden'); el('ainSave').classList.remove('hidden'); el('ainOpen').classList.remove('hidden');
  el('ainStatus').textContent = '';
  el('ainNote').innerHTML = amInkNote(res).map(esc).join(' ') + ' <small>The weights are worked out from the light you chose and the edges found; a drawing is a judgement, so move any line you disagree with.</small>';
}

/* ---- folds */

function amuFoldsRender() {
  const s = amuLoad(), S = AM_FOLD_SPOTS[s.spot];
  adPress('aflSpot', s.spot);
  amu.svg.folds = amFoldSheetSvg(s.spot);
  el('aflStage').innerHTML = amu.svg.folds;
  el('aflNote').innerHTML = `<b>${esc(S.label)}.</b> ${esc(S.says)}` +
    `<ul>${S.types.map(k => `<li><b>${esc(AM_FOLDS[k].label)}.</b> ${esc(AM_FOLDS[k].about)}</li>`).join('')}</ul><small>${esc(AM_FOLD_RULE)} The pictures are diagrams of the shape, not of a garment.</small>`;
}

/* ---- layers */

function amuLayerColour(s) {
  return s.part === 'hair' || s.part === 'eyes' ? atLoad()[s.part] : s[s.part];
}

async function amuLayersRender() {
  const s = amuLoad(), colour = amuLayerColour(s), run = ++amu.run;
  adPress('alyMaterial', s.material); adPress('alyPart', s.part);
  el('alyColour').value = colour; el('alyBgOn').checked = s.bgOn; el('alyBg').value = s.bg; el('alyBg').disabled = !s.bgOn;
  el('alyPaintRow').classList.toggle('hidden', s.material !== 'water');
  el('alyColourNote').textContent = s.part === 'hair' || s.part === 'eyes' ? 'the same as in Outfits' : '';
  const steps = amu.layers = amLayers({ material: s.material, part: s.part, base: adRgbOf(colour), bg: s.bgOn ? adRgbOf(s.bg) : null });
  el('alySteps').innerHTML = steps.map(r => `<li data-n="${r.n}"><span class="aly-sw"${r.rgb ? ` style="background:${adCss(r.rgb)}" title="${colHexOf(r.rgb)}"` : ''}></span>` +
    `<div><div>${esc(r.text)}</div><div class="aly-mix count"></div></div></li>`).join('');
  el('alyNote').textContent = s.material === 'ink' ? 'Ink is one colour in different strengths, so there is nothing to mix: the swatches are the strengths of the wash.'
    : 'The tones come from your colour: the shadow cooler, the light warmer. Each swatch says how to make it from what you have.';
  el('alyStatus').textContent = '';
  if (s.material === 'ink') return;
  if (s.material !== 'water') {
    try { await loadSection('palette'); fewLoad(); } catch { el('alyStatus').textContent = 'The marker and pencil lists could not load - check the connection.'; return; }
    if (run !== amu.run) return;
  }
  // The mixes one step at a time, so the page is not held for all of them.
  steps.forEach((r, i) => setTimeout(() => {
    if (run !== amu.run || !r.rgb) return;
    const host = el('alySteps').querySelector(`[data-n="${r.n}"] .aly-mix`);
    if (host) host.innerHTML = amuMixHtml(s.material, r.rgb);
  }, 20 * i));
}

// How to get a colour from the material: paint recipes, the nearest marker, or the nearest pencils.
function amuMixHtml(material, rgb) {
  if (material === 'water') return paintRecipes(rgb, paintPaletteKey(), 2, 'water').map(paintRecipeHtml).join('') || 'No mix found.';
  const sw = c => `<i class="aly-chip" style="background:${rgbCss(c)}"></i>`;
  if (material === 'copic') {
    const b = fewNearest(rgb, fewMine('copic'));
    if (!b) return 'No marker found.';
    const m = FEW_COPIC[b.key];
    return `${sw(m.rgb)} <b>${esc(m.code)}</b> ${esc(m.name)} <span class="count">${b.dE < FEW_CLOSE ? 'close' : 'nearest of your markers'}</span>`;
  }
  const b = fewLayers(rgb, fewMine('pencils'));
  if (!b) return 'No pencil found.';
  const one = (k, press) => `<b>${esc(FEW_PENCIL[k].code)}</b> ${esc(FEW_PENCIL[k].name)} (${press === 'light' ? 'light' : 'firm'})`;
  return `${sw(b.rgb)} ${one(b.key, b.press)}${b.over ? ` then ${one(b.over, b.pressOver)}` : ''} <span class="count">${b.dE < FEW_CLOSE ? 'close' : 'nearest of your pencils'}</span>`;
}

/* ---- angles */

function amuAnglesRender() {
  const s = amuLoad();
  const near = Object.entries(AM_ANGLES).find(([, [, p]]) => p === s.pitch);
  adPress('aanKind', near ? near[0] : '');
  el('aanToGenerate').classList.toggle('hidden', !amAngleWords(s.pitch) || (typeof genAvailable === 'function' && !genAvailable()));
  amu.svg.angles = amAngleSvg({ pitch: s.pitch, roll: s.roll, near: s.near });
  el('aanStage').innerHTML = amu.svg.angles;
  el('aanNote').innerHTML = amAngleNotes(s.pitch).map(esc).join(' ') + ' <small>The curves are worked out from a ball and a jaw: a real head is less regular, but the direction of every change is right.</small>';
}
