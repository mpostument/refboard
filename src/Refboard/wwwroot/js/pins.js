/* refboard - Pinned tools: the session toolbar holds the tools you pin,
   and the rest wait one click away under More - where each can be pinned,
   or unpinned, with the pin beside it.

   Nothing is lost by unpinning: the tool's key still works, Ctrl+K still
   finds it, and More still has it. The buttons themselves are moved, not
   copied - the same element, with every listener it already had, sits in
   the toolbar or in More - so no tool needs to know this file exists. */
"use strict";

// In toolbar order. A tool can be more than one control (zoom is three
// buttons; the angle tool comes with its clear button). group: the
// separators fall between groups, and only between ones that have
// something pinned.
const HUD_TOOLS = [
  { id: 'flip', label: 'Flip', els: ['btnFlip'], key: 'f', group: 'view' },
  { id: 'gray', label: 'Grayscale', els: ['btnGray'], key: 'g', group: 'view' },
  { id: 'squint', label: 'Squint', els: ['btnSquint'], key: 'q', group: 'view' },
  { id: 'value', label: 'Value split', els: ['valueSelect'], key: 'v', group: 'view' },
  { id: 'zoom', label: 'Zoom', els: ['btnZoomOut', 'btnZoomReset', 'btnZoomIn'], key: '+ −', group: 'zoom' },
  { id: 'angle', label: 'Angle tool', els: ['btnAngle', 'btnAngleClear'], key: 'a', group: 'look' },
  { id: 'guides', label: 'Construction guides', els: ['constructSelect'], key: 'c', group: 'look' },
  { id: 'eyedropper', label: 'Eyedropper', els: ['btnEyedropper'], key: 'e', group: 'look' },
  { id: 'pose', label: 'Pose skeleton', els: ['btnPose'], key: 'p', group: 'look' },
  { id: 'head', label: 'Head construction', els: ['btnHead'], key: 'l', group: 'look' },
  { id: 'edges', label: 'Edge map', els: ['btnEdges'], key: 'x', group: 'look' },
  { id: 'range', label: "Paper's range", els: ['btnRange'], key: 'b', group: 'look' },
  { id: 'temp', label: 'Temperature map', els: ['btnTemp'], key: 't', group: 'look' },
  { id: 'amounts', label: 'Amounts - which leads', els: ['btnAmounts'], key: 'u', group: 'look' },
  { id: 'tangents', label: 'Tangents', els: ['btnTangents'], key: 'n', group: 'look' },
  { id: 'symmetry', label: 'Symmetry check', els: ['btnSymmetry'], key: 'y', group: 'look' },
  { id: 'rhythms', label: 'Reilly rhythms', els: ['btnRhythms'], key: 'z', group: 'look' },
  { id: 'markers', label: 'Grey markers', els: ['btnMarkers'], key: '', group: 'look' },
  { id: 'vignette', label: 'Vignette', els: ['btnVignette'], key: '', group: 'look' },
  { id: 'watercolour', label: 'Watercolour preview', els: ['btnWatercolour'], key: '', group: 'look' },
  { id: 'grades', label: 'Pencil grades', els: ['btnGrades'], key: '', group: 'look' },
  { id: 'lineweight', label: 'Line weight', els: ['btnLineWeight'], key: 'k', group: 'look' },
  { id: 'linewash', label: 'Line and wash', els: ['btnLineWash'], key: '', group: 'look' },
  { id: 'tone', label: 'Toned paper', els: ['btnTone'], key: 'j', group: 'look' },
  { id: 'compare', label: 'Compare your drawing', els: ['btnCompare'], key: 'd', group: 'look' },
  { id: 'workspace', label: 'Workspace - tools by question', els: ['btnWorkspace'], key: 'w', group: 'look' },
  { id: 'layers', label: 'Layers', els: ['btnLayers'], key: '', group: 'look' },
  { id: 'info', label: 'Info - histogram, palette', els: ['btnInfo'], key: 'i', group: 'pose' },
  { id: 'similar', label: 'Similar poses next', els: ['btnSimilar'], key: 'm', group: 'pose' },
  { id: 'skip', label: 'Never show this pose again', els: ['btnSkip'], key: 's', group: 'pose' },
];
// What a first session shows: the tools for looking at a reference while
// drawing it. The rest are one click away under More.
const HUD_PINS_DEFAULT = ['flip', 'gray', 'value', 'zoom', 'angle', 'guides', 'eyedropper', 'workspace', 'layers', 'skip'];
const HUD_PINS_KEY = 'refboard.hudPins.v1';

function hudPins() {
  try {
    const v = JSON.parse(localStorage.getItem(HUD_PINS_KEY));
    if (Array.isArray(v)) return v.filter(id => HUD_TOOLS.some(t => t.id === id));
  } catch { /* fall through */ }
  return [...HUD_PINS_DEFAULT];
}
function saveHudPins(pins) {
  try { localStorage.setItem(HUD_PINS_KEY, JSON.stringify(pins)); } catch { /* private mode: this visit only */ }
}

function renderHudTools() {
  const pins = hudPins(), bar = el('hudTools'), list = el('hudMoreList');
  bar.replaceChildren();
  list.replaceChildren();
  let group = null, span = null;
  for (const t of HUD_TOOLS) {
    const pinned = pins.includes(t.id);
    if (pinned) {
      if (t.group !== group) {
        group = t.group;
        span = document.createElement('span');
        span.className = 'hud-group';
        bar.append(span);
      }
      span.append(...t.nodes);
    } else {
      const row = document.createElement('div');
      row.className = 'more-row';
      row.dataset.tool = t.id;
      const name = document.createElement('span');
      name.className = 'more-name';
      name.textContent = t.label;
      if (t.key) { const k = document.createElement('kbd'); k.textContent = t.key; name.append(' ', k); }
      row.append(...t.nodes, name);
      list.append(row);
    }
  }
  const unpinned = HUD_TOOLS.length - pins.length;
  el('btnMoreTools').dataset.count = unpinned || '';
  el('hudMoreEmpty').classList.toggle('hidden', unpinned > 0);
  renderHudPinList(pins);
}

// Every tool with its pin, in More's lower half: the one place to choose.
function renderHudPinList(pins) {
  el('hudPinList').innerHTML = HUD_TOOLS.map(t => {
    const on = pins.includes(t.id);
    return `<button type="button" class="pin-chip" data-pin="${t.id}" aria-pressed="${on}"` +
      ` title="${on ? 'In the toolbar - click to move it to More' : 'In More - click to pin it to the toolbar'}">${esc(t.label)}</button>`;
  }).join('');
}

function toggleHudPin(id) {
  const pins = hudPins();
  saveHudPins(pins.includes(id) ? pins.filter(p => p !== id) : [...pins, id]);
  renderHudTools();
}

function toggleHudMore(open = el('hudMore').classList.contains('hidden')) {
  el('hudMore').classList.toggle('hidden', !open);
  el('btnMoreTools').setAttribute('aria-expanded', String(open));
  // The toolbar fades when left alone; not while this is open over it.
  if (open) { clearHudIdle(); el('hudMore').querySelector('button, select')?.focus(); }
  else { if (el('hudMore').contains(document.activeElement)) el('btnMoreTools').focus(); armHudIdle(); }
}

function initHudTools() {
  // The elements are held here, not looked up each time: while
  // renderHudTools() moves them they are briefly out of the document, where
  // getElementById cannot find them.
  for (const t of HUD_TOOLS) t.nodes = t.els.map(el);
  // The separators become the groups' own edges.
  for (const s of el('hud').querySelectorAll('.hud-sep')) s.remove();
  renderHudTools();
  el('btnMoreTools').addEventListener('click', () => toggleHudMore());
  el('hudPinList').addEventListener('click', e => {
    const b = e.target.closest('[data-pin]');
    if (!b) return;
    toggleHudPin(b.dataset.pin);
    el('hudPinList').querySelector(`[data-pin="${b.dataset.pin}"]`).focus();
  });
  el('hudPinReset').addEventListener('click', () => { saveHudPins([...HUD_PINS_DEFAULT]); renderHudTools(); });
  // A tool used from More closes it - the picture is what you want to see.
  el('hudMoreList').addEventListener('click', e => { if (e.target.closest('button')) toggleHudMore(false); });
  el('hudMoreList').addEventListener('change', () => toggleHudMore(false));
  el('hudMore').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleHudMore(false); }
  });
  document.addEventListener('pointerdown', e => {
    if (!el('hudMore').classList.contains('hidden') && !e.composedPath().some(n => n === el('hudMore') || n === el('btnMoreTools'))) toggleHudMore(false);
  });
  new MutationObserver(() => { if (el('session').classList.contains('hidden')) toggleHudMore(false); })
    .observe(el('session'), { attributes: true, attributeFilter: ['class'] });
}
initHudTools();
