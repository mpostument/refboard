/* refboard - The stages of the work: Prepare, Practise, Paint, Check.

   The rail is grouped by them (index.html, .rail-stage), and the dashboard
   shows the same four as cards - built here from the rail's own groups,
   so a button added to a group is on its card too, and the two can never
   disagree. Ctrl+K reads the group as well: "paint" finds what is in it.

   Only one button here does anything new: Start drawing on the rail. Every
   other card button presses the rail button it was built from. */
"use strict";

// Start drawing from the rail: the inspector's Start when packs are ticked;
// when none are, the Library, where they are ticked.
function paintNow() {
  if (!el('start').disabled) { el('start').click(); return; }
  if (el('btnLibrary').getAttribute('aria-pressed') !== 'true') el('btnLibrary').click();
}

// One rail button on its card: the name, then what is in it, smaller -
// data-about where the tip changes as you go (Start drawing counts poses).
function stageToolHtml(b, proxy) {
  const more = b.dataset.about || (b.dataset.tip || '').split(/ - (.*)/s)[1];
  return `<button type="button" class="stage-tool" data-proxy="${proxy}"><span data-icon="${b.dataset.icon}"></span>` +
    `<span><b>${esc(b.getAttribute('aria-label'))}</b>${more ? `<small>${esc(more)}</small>` : ''}</span></button>`;
}

function renderStages() {
  el('stages').innerHTML = [...el('rail').querySelectorAll('.rail-stage')].map((g, gi) =>
    `<div class="stage-card" data-stage="${g.dataset.stage}">` +
    `<h2>${esc(g.dataset.stage)}</h2><p>${esc(g.dataset.blurb)}</p><div class="stage-tools">` +
    [...g.querySelectorAll('button')].map((b, bi) => b.classList.contains('hidden') ? '' : stageToolHtml(b, `${gi}:${bi}`)).join('') +
    `</div>${g.dataset.stage === 'Paint' ? '<p class="stage-note" id="stagePaintNote"></p>' : ''}</div>`).join('');
  applyIcons(el('stages'));
  syncPaintNote();
}

// The Paint card says whether Start drawing will start or send you to pick.
function syncPaintNote() {
  const ready = !el('start').disabled, n = el('poolCount').textContent;
  el('stagePaintNote').textContent = ready ? `${n} ${n === '1' ? 'pose' : 'poses'} ready from the packs you ticked.`
    : 'Tick a pack in the Library first - or drop your own images under Check.';
  el('btnPaint').dataset.tip = ready ? `Start drawing - ${n} ${n === '1' ? 'pose' : 'poses'} ready`
    : 'Start drawing - tick a pack in the Library first';
}

function initStages() {
  renderStages();
  // A section the rail hides - All images, with no library - leaves the
  // card too. Only a button's class is watched: the tips change as you go.
  new MutationObserver(renderStages).observe(el('rail'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  el('stages').addEventListener('click', e => {
    const b = e.target.closest('[data-proxy]');
    if (!b) return;
    const [gi, bi] = b.dataset.proxy.split(':').map(Number);
    el('rail').querySelectorAll('.rail-stage')[gi].querySelectorAll('button')[bi].click();
  });
  el('btnPaint').addEventListener('click', paintNow);
  new MutationObserver(syncPaintNote).observe(el('start'), { attributes: true, attributeFilter: ['disabled'] });
  new MutationObserver(syncPaintNote).observe(el('poolCount'), { childList: true, characterData: true, subtree: true });
}
initStages();
