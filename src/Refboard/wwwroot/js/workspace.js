/* refboard - The workspace panel: the session's tools sorted by the
   question you are asking of the picture - how light or dark, what colour,
   where things are, how the figure is built, whether your drawing is right.

   It holds no tools of its own. Each row presses the toolbar's own control
   (wherever pins.js has put it - toolbar or More) or turns a layer on or
   off, and shows that control's state; so a tool is the same tool from its
   key, the toolbar, Ctrl+K or here. A tool can answer more than one
   question, and then it is in more than one tab. */
"use strict";

// hud: an id in HUD_TOOLS (js/pins.js); layer: an id in LAYERS (js/layers.js);
// action: something it opens rather than a state it shows.
// about: the question the tool answers, in the words of the tab.
const WS_TABS = [
  { id: 'value', label: 'Value', q: 'How light or dark is each part?', tools: [
    { hud: 'value', about: 'the picture in 2 to 5 tones - notan first' },
    { hud: 'gray', about: 'colour out of the way, value left' },
    { hud: 'squint', about: 'details blurred - the big shapes of light and dark' },
    { hud: 'edges', about: 'which edges are hard and which soft - on dry paper, or wet-in-wet' },
    { hud: 'range', about: 'what the paper can do: the darks and lights your medium cannot tell apart' },
    { hud: 'info', about: 'the histogram: where the values are, the darkest and the lightest' },
  ] },
  { id: 'colour', label: 'Colour', q: 'What colour is it, and how do I mix it?', tools: [
    { hud: 'eyedropper', about: 'one spot: its colour, its value step, a recipe in your medium' },
    { hud: 'temp', about: 'warm and cool areas, and where the temperature turns - is the shadow cooler than the light?' },
    { hud: 'info', about: 'the main colours of the picture' },
    { hud: 'gray', about: 'is it the colour that is off, or the value?' },
  ] },
  { id: 'construction', label: 'Construction', q: 'Where are things, and at what angle?', tools: [
    { hud: 'guides', about: 'thirds, a plumb line, a viewfinder, a perspective check' },
    { hud: 'angle', about: 'the angle of any line, and lengths against each other' },
    { layer: 'grid', label: 'Grid', key: 'r', about: 'squares to place things by' },
    { layer: 'focal', label: 'Focal point', key: '', about: 'where the eye goes first' },
  ] },
  { id: 'figure', label: 'Figure', q: 'How is the body built?', tools: [
    { hud: 'pose', about: 'the gesture, the tilt of shoulders and hips, the weight' },
    { hud: 'head', about: 'the ball, the side plane, the face - Loomis or anime' },
    { layer: 'ghost', label: 'Ghost of the last pose', key: '', about: 'the pose before, to compare the two' },
    { hud: 'similar', about: 'more poses like this one next' },
  ] },
  { id: 'mywork', label: 'My work', q: 'Is my drawing right?', tools: [
    { hud: 'compare', about: 'a photo of your drawing over the reference' },
    { hud: 'flip', about: 'fresh eyes - mistakes jump out mirrored' },
    { hud: 'squint', about: 'do the big shapes match, before the details?' },
  ] },
  { id: 'learn', label: 'Learn', q: 'How do I draw it, step by step?', tools: [
    { action: 'steps', label: 'How to draw it', icon: 'pen', about: 'this picture in the steps it is drawn in, for your medium',
      run: () => openSteps(state.current) },
  ] },
];
const WS_TAB_KEY = 'refboard.workspaceTab.v1';

let wsTab = (() => { try { return localStorage.getItem(WS_TAB_KEY) || 'value'; } catch { return 'value'; } })();
if (!WS_TABS.some(t => t.id === wsTab)) wsTab = 'value';

const wsHud = id => HUD_TOOLS.find(t => t.id === id);
const wsLayer = id => LAYERS.find(l => l.id === id);

function renderWorkspace() {
  el('wsTabs').innerHTML = WS_TABS.map(t =>
    `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${t.id === wsTab}">${t.label}</button>`).join('');
  const tab = WS_TABS.find(t => t.id === wsTab);
  el('wsQuestion').textContent = tab.q;
  el('wsList').innerHTML = tab.tools.map((r, i) => {
    let label, key, icon;
    if (r.action) {
      return `<button type="button" class="ws-row ws-tool" data-row="${i}"><span data-icon="${r.icon}"></span>` +
        `<span class="ws-text"><b>${esc(r.label)}</b><small>${esc(r.about)}</small></span></button>`;
    }
    if (r.hud) {
      const t = wsHud(r.hud), first = t.nodes[0];
      if (first.classList.contains('hidden')) return '';
      if (first.tagName === 'SELECT') {
        return `<div class="ws-row"><span class="ws-text"><b>${esc(t.label)}${t.key ? ` <kbd>${t.key}</kbd>` : ''}</b>` +
          `<small>${esc(r.about)}</small></span><select data-row="${i}" aria-label="${esc(t.label)}">` +
          [...first.options].map(o => `<option value="${o.value}">${esc(o.textContent.trim().replace(/^[^:]*: /, ''))}</option>`).join('') +
          '</select></div>';
      }
      ({ label, key } = t); icon = first.dataset.icon;
    } else {
      ({ label, key } = r); icon = 'layers';
    }
    return `<button type="button" class="ws-row ws-tool" data-row="${i}" aria-pressed="false">` +
      `<span data-icon="${icon}"></span><span class="ws-text"><b>${esc(label)}${key ? ` <kbd>${key}</kbd>` : ''}</b>` +
      `<small>${esc(r.about)}</small></span></button>`;
  }).join('');
  applyIcons(el('wsList'));
  syncWorkspace();
}

// Only when it differs: the rows are inside #session, whose attributes the
// observer below watches - writing the same value again would still be a
// mutation, and call this again, for ever.
function wsPress(n, on) { if (n.getAttribute('aria-pressed') !== String(on)) n.setAttribute('aria-pressed', String(on)); }

// Each row's state from its control: pressed, lit, or the select's value.
function syncWorkspace() {
  if (el('wsPanel').classList.contains('hidden')) return;
  const tab = WS_TABS.find(t => t.id === wsTab);
  for (const n of el('wsList').querySelectorAll('[data-row]')) {
    const r = tab.tools[n.dataset.row];
    if (r.action) continue;
    if (r.layer) { wsPress(n, !!wsLayer(r.layer).on()); continue; }
    const c = wsHud(r.hud).nodes[0];
    // Off when its button is - Grayscale while the value split is on.
    if (n.disabled !== c.disabled) n.disabled = c.disabled;
    if (n.tagName === 'SELECT') { if (n.value !== c.value) n.value = c.value; }
    else wsPress(n, c.getAttribute('aria-pressed') === 'true' || c.classList.contains('active'));
  }
}

function useWorkspaceRow(n) {
  const r = WS_TABS.find(t => t.id === wsTab).tools[n.dataset.row];
  if (r.action) { r.run(); return; }
  if (r.layer) wsLayer(r.layer).toggle();
  else if (n.tagName === 'SELECT') {
    const c = wsHud(r.hud).nodes[0];
    c.value = n.value;
    c.dispatchEvent(new Event('change'));
  } else wsHud(r.hud).nodes[0].click();
  syncWorkspace();
}

// One panel at a time in that corner: the workspace or the layers.
// focus: false when it opens by itself - the panel keeps the keys typed in
// it, and "r" or Escape must still reach the session you just started.
function toggleWorkspace(open = el('wsPanel').classList.contains('hidden'), focus = true) {
  if (open && !el('layersPanel').classList.contains('hidden')) toggleLayersPanel(false);
  el('wsPanel').classList.toggle('hidden', !open);
  el('btnWorkspace').setAttribute('aria-pressed', String(open));
  if (open) { renderWorkspace(); if (focus) el('wsTabs').querySelector('[aria-selected="true"]').focus(); }
  else if (el('wsPanel').contains(document.activeElement)) el('btnWorkspace').focus();
}

// Any one picture onto the session's stage, with the panel open at the
// question it was brought for - from the Colour studio, a dropped photo.
// Browse mode: no clock, nothing logged as practice (see startSession()).
function openInWorkspace(src, { label = 'Workspace', tab } = {}) {
  startSession([{ frames: [src], pack: label, group: label }], { browse: true, label });
  showWorkspaceAt(tab);
}

// The panel open at one tab - not saved: the tab you chose yourself is
// still the one next time.
function showWorkspaceAt(tab) {
  if (WS_TABS.some(t => t.id === tab)) wsTab = tab;
  toggleWorkspace(true, false);
}

function setWorkspaceTab(id) {
  wsTab = id;
  try { localStorage.setItem(WS_TAB_KEY, id); } catch { /* private mode */ }
  renderWorkspace();
  el('wsTabs').querySelector(`[data-tab="${id}"]`).focus();
}

function initWorkspace() {
  el('btnWorkspace').addEventListener('click', () => toggleWorkspace());
  el('btnLayers').addEventListener('click', () => toggleWorkspace(false));
  el('wsClose').addEventListener('click', () => toggleWorkspace(false));
  el('wsTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setWorkspaceTab(b.dataset.tab); });
  el('wsList').addEventListener('click', e => { const b = e.target.closest('button[data-row]'); if (b) useWorkspaceRow(b); });
  el('wsList').addEventListener('change', e => { if (e.target.matches('select[data-row]')) useWorkspaceRow(e.target); });
  el('wsPanel').addEventListener('keydown', e => {
    // Keys typed here stay here - "f" on a tab would flip the picture.
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); toggleWorkspace(false); }
    // Arrows move between tabs, as in any tab list.
    if (e.target.closest('#wsTabs') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const i = WS_TABS.findIndex(t => t.id === wsTab), d = e.key === 'ArrowRight' ? 1 : -1;
      setWorkspaceTab(WS_TABS[(i + d + WS_TABS.length) % WS_TABS.length].id);
    }
  });
  // A tool turned on from its key or the toolbar shows here as well.
  new MutationObserver(syncWorkspace).observe(el('session'), { subtree: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'disabled'] });
  el('hud').addEventListener('change', syncWorkspace);
  new MutationObserver(() => { if (el('session').classList.contains('hidden')) toggleWorkspace(false); })
    .observe(el('session'), { attributes: true, attributeFilter: ['class'] });
}
initWorkspace();
