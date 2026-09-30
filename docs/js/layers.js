/* refboard - Layers: every overlay the session can lay over a picture, in
   one list, as in Photoshop - each with on/off and its own opacity - so the
   pose skeleton, the Loomis head and a faint grid can be seen together, and
   the ghost and the focal point no longer need the setup screen.

   A layer is not a new tool: the checkbox calls the same function as the
   tool's own button or key, and reads the same state, so the HUD, the keys
   and this list can never disagree. What is new is opacity, and "o" - every
   overlay out of the way for a moment, for a clean look at the picture. */
"use strict";

// Top of the list is on top of the picture, as the elements stack in #stage.
// base: the opacity a layer is drawn at until you move its slider.
const LAYERS = [
  { id: 'guides', label: 'Construction guides', els: ['constructOverlay'], base: 1,
    on: () => state.constructMode !== 'off',
    // Off and on again brings back the guide that was showing.
    toggle: () => {
      if (state.constructMode === 'off') { setConstructMode(layerLastGuide); return; }
      layerLastGuide = state.constructMode;
      setConstructMode('off');
    },
    note: () => state.constructMode !== 'off' ? el('constructSelect').selectedOptions[0]?.textContent : '' },
  { id: 'angle', label: 'Angle lines', els: ['angleOverlay'], base: 1,
    on: () => state.angleMode, toggle: () => toggleAngleMode() },
  { id: 'focal', label: 'Focal point', els: ['focalMarker'], base: 0.75,
    on: () => el('optFocalPoint').checked, toggle: () => layerOption('optFocalPoint') },
  { id: 'ghost', label: 'Ghost of the last pose', els: ['ghostImg'], base: 0.35,
    on: () => el('optGhost').checked, toggle: () => layerOption('optGhost'),
    note: () => el('optGhost').checked && !state.ghostSrc ? 'from the next pose' : '' },
  { id: 'head', label: 'Head construction', els: ['headOverlay'], base: 1,
    on: () => !!state.headOn, toggle: () => toggleHead() },
  { id: 'edges', label: 'Edge map', els: ['edgeOverlay'], base: 1,
    on: () => !!state.edgesOn, toggle: () => toggleEdges() },
  { id: 'range', label: "Paper's range", els: ['rangeOverlay'], base: 1,
    on: () => !!state.rangeOn, toggle: () => toggleRange() },
  { id: 'temp', label: 'Temperature map', els: ['tempOverlay'], base: 1,
    on: () => !!state.tempOn, toggle: () => toggleTemp() },
  { id: 'tangents', label: 'Tangents', els: ['tanOverlay'], base: 1,
    on: () => !!state.tangentsOn, toggle: () => toggleTangents() },
  { id: 'lineweight', label: 'Line weight', els: ['lineOverlay'], base: 1,
    on: () => !!state.lineWeightOn, toggle: () => toggleLineWeight() },
  { id: 'pose', label: 'Pose skeleton', els: ['poseOverlay'], base: 1,
    on: () => !!state.poseOn, toggle: () => togglePose() },
  { id: 'grid', label: 'Grid', els: ['grid', 'gridValue'], base: 0.3,
    on: () => el('optGrid').checked, toggle: () => layerOption('optGrid') },
  // Your drawing already has an opacity, per compare mode, in the compare
  // bar - this slider is that same setting, not a second one on top of it.
  { id: 'drawing', label: 'Your drawing', els: ['drawWrap'],
    on: () => !!drawing && !drawing.hidden, toggle: () => compareKey(),
    note: () => !drawing ? 'opens a photo' : '',
    getOp: () => compareOpts.mode === 'blink' ? null : compareOpts.opacity[compareOpts.mode],
    setOp: v => {
      compareOpts.opacity[compareOpts.mode] = v;
      saveCompareOpts();
      el('cmpOpacity').value = v;
      renderDrawing();
    } },
];

const LAYERS_KEY = 'refboard.layers.v1';
let layerLastGuide = 'vp';
let layerOps = (() => {
  try { const v = JSON.parse(localStorage.getItem(LAYERS_KEY)); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
})();

function layerOption(id) {
  el(id).checked = !el(id).checked;
  applyOptions();
}

const layerOpacity = L => L.getOp ? L.getOp() : layerOps[L.id] ?? L.base;

// Only a slider you have moved sets anything - until then each overlay
// keeps its stylesheet opacity, high-contrast mode's stronger grid included.
function paintLayerOpacity(L) {
  if (L.getOp) return;
  for (const id of L.els) {
    if (L.id in layerOps) el(id).style.setProperty('--layer-op', layerOps[L.id]);
    else el(id).style.removeProperty('--layer-op');
  }
}

function setLayerOpacity(L, v) {
  if (L.setOp) { L.setOp(v); return; }
  layerOps[L.id] = v;
  try { localStorage.setItem(LAYERS_KEY, JSON.stringify(layerOps)); } catch { /* private mode */ }
  paintLayerOpacity(L);
}

/* The rows are built once and then only updated in place: rebuilding them
   while a slider is being dragged would drop the drag. */
function buildLayers() {
  el('layersList').innerHTML = LAYERS.map(L =>
    `<div class="layer-row" data-layer="${L.id}">` +
    `<label><input type="checkbox" data-layer-on="${L.id}"><span>${L.label}<small></small></span></label>` +
    `<input type="range" min="0.05" max="1" step="0.05" data-layer-op="${L.id}" aria-label="${L.label} opacity">` +
    `<output></output></div>`).join('');
  LAYERS.forEach(paintLayerOpacity);
}

function syncLayers() {
  const onCount = LAYERS.filter(L => L.on()).length;
  el('btnLayers').dataset.count = onCount || '';
  if (el('layersPanel').classList.contains('hidden')) return;
  el('layersCount').textContent = onCount ? `${onCount} on` : 'none on';
  for (const L of LAYERS) {
    const row = el('layersList').querySelector(`[data-layer="${L.id}"]`);
    const on = L.on(), op = layerOpacity(L), range = row.querySelector('input[type=range]');
    row.querySelector('input[type=checkbox]').checked = on;
    row.classList.toggle('off', !on);
    row.querySelector('small').textContent = L.note?.() || '';
    if (document.activeElement !== range && op != null) range.value = op;
    range.disabled = op == null;
    row.querySelector('output').textContent = op == null ? 'blink' : Math.round(op * 100) + '%';
  }
  el('layersHC').checked = el('optHighContrast').checked;
}

let layersSyncQueued = false;
function queueLayersSync() {
  if (layersSyncQueued) return;
  layersSyncQueued = true;
  requestAnimationFrame(() => { layersSyncQueued = false; syncLayers(); });
}

function toggleLayersPanel(open = el('layersPanel').classList.contains('hidden')) {
  el('layersPanel').classList.toggle('hidden', !open);
  el('btnLayers').setAttribute('aria-pressed', String(open));
  if (open) { syncLayers(); el('layersList').querySelector('input')?.focus(); }
  else if (el('layersPanel').contains(document.activeElement)) el('btnLayers').focus();
}

// "o": every overlay hidden at once, nothing turned off - "o" again brings
// them all back as they were.
function toggleLayersPeek(hide = !el('stage').classList.contains('overlays-off')) {
  el('stage').classList.toggle('overlays-off', hide);
  el('peekBadge').classList.toggle('hidden', !hide);
  el('layersPeek').setAttribute('aria-pressed', String(hide));
}

// What Find a tool (Ctrl+K) offers for layers that have no HUD button.
function layerCommands() {
  const out = [];
  for (const L of LAYERS.filter(L => ['grid', 'ghost', 'focal'].includes(L.id))) {
    out.push({ id: 'layer-' + L.id, label: `${L.on() ? 'Hide' : 'Show'} ${L.label.toLowerCase()}`, hint: 'Layer',
      words: 'layer overlay', run: L.toggle });
  }
  const peek = el('stage').classList.contains('overlays-off');
  out.push({ id: 'layers-peek', label: peek ? 'Show the overlays again' : 'Hide all overlays', hint: 'o',
    words: 'layers clean peek picture only', run: () => toggleLayersPeek() });
  return out;
}

function initLayers() {
  buildLayers();
  const list = el('layersList');
  list.addEventListener('change', e => {
    const L = LAYERS.find(L => L.id === e.target.dataset.layerOn);
    if (L) { L.toggle(); queueLayersSync(); }
  });
  list.addEventListener('input', e => {
    const L = LAYERS.find(L => L.id === e.target.dataset.layerOp);
    if (!L) return;
    setLayerOpacity(L, Number(e.target.value));
    e.target.nextElementSibling.textContent = Math.round(e.target.value * 100) + '%';
  });
  el('btnLayers').addEventListener('click', () => toggleLayersPanel());
  el('layersClose').addEventListener('click', () => toggleLayersPanel(false));
  el('layersPeek').addEventListener('click', () => toggleLayersPeek());
  el('layersHC').addEventListener('change', e => {
    el('optHighContrast').checked = e.target.checked;
    applyOptions();
  });
  // Keys stay in the panel - an arrow key on a slider must not also step to
  // the next pose - except Escape, which closes it.
  el('layersPanel').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); toggleLayersPanel(false); }
  });

  /* Every tool changes its overlay's classes or its HUD button's
     aria-pressed, whichever way it was turned on - a key, a button, Ctrl+K -
     so watching those keeps the list true without each tool telling it. */
  const watch = new MutationObserver(queueLayersSync);
  watch.observe(el('stage'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  watch.observe(el('hud'), { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  for (const id of ['optGrid', 'optGhost', 'optFocalPoint', 'optHighContrast', 'constructSelect']) el(id).addEventListener('change', queueLayersSync);
  // #session's classes: high contrast ("h"), and hidden - a session
  // starts with every overlay showing.
  new MutationObserver(() => {
    if (el('session').classList.contains('hidden')) { toggleLayersPeek(false); toggleLayersPanel(false); }
    queueLayersSync();
  }).observe(el('session'), { attributes: true, attributeFilter: ['class'] });
}
initLayers();
