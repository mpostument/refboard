/* refboard - Using it with the keyboard alone, or with a screen reader:
   modal dialogs that keep the keyboard inside them, what changed said out
   loud, the rail walked with the arrow keys, a way past the rail.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---- modal dialogs. Each one opens and closes itself; what they all need
   is here, once: Tab and Shift+Tab go round the top dialog's own controls
   instead of out under the dimming, and closing gives the focus back to
   whatever had it. */
const focusableSel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
function focusables(box) {
  return [...box.querySelectorAll(focusableSel)].filter(n => !n.disabled && n.getClientRects().length);
}

// The dialog on top: of those open, the highest - later in the page on a tie.
function topDialog() {
  let top = null, topZ = -Infinity;
  for (const d of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
    if (!d.getClientRects().length) continue;
    const z = parseInt(getComputedStyle(d).zIndex, 10) || 0;
    if (z >= topZ) { top = d; topZ = z; }
  }
  return top;
}

const dialogReturn = new WeakMap();
function dialogOpened(box, first) {
  dialogReturn.set(box, document.activeElement);
  (first || focusables(box)[0])?.focus();
}
function dialogClosed(box) {
  const back = dialogReturn.get(box);
  dialogReturn.delete(box);
  if (back && back.isConnected && back.getClientRects().length) back.focus();
}

/* A sheet (.sheet in the stylesheet): Esc and a click on the dimming close
   it, and every key pressed in it stays in it - the session, the 3D view
   and the trainers all listen for single letters on the document, and a
   name typed here must not also flip the picture. */
function initSheet(box, close) {
  box.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  box.addEventListener('pointerdown', e => { if (e.target === box) close(); });
}

/* ---- said out loud. A polite live region: read when the reader is free,
   never over what it is reading. Emptied first, so the same words twice
   (a pose count that happens to repeat) are read twice. */
function announce(text) {
  const n = el('announce');
  n.textContent = '';
  requestAnimationFrame(() => { n.textContent = text; });
}

function initA11y() {
  // Capture phase: before any dialog's own keydown, several of which stop
  // every key from going further.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
    const box = topDialog();
    if (!box) return;
    const items = focusables(box);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement), last = items.length - 1;
    // Only the ends wrap, and focus outside is pulled in; in between, the
    // browser's own order is the right one.
    if (!box.contains(document.activeElement)) { e.preventDefault(); items[e.shiftKey ? last : 0].focus(); }
    else if (!e.shiftKey && i === last) { e.preventDefault(); items[0].focus(); }
    else if (e.shiftKey && i === 0) { e.preventDefault(); items[last].focus(); }
  }, true);

  // The rail is a column of icons: up and down go along it, Home and End
  // to its ends - Tab still goes through it too, and on out of it.
  el('rail').addEventListener('keydown', e => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step === undefined && e.key !== 'Home' && e.key !== 'End') return;
    const items = focusables(el('rail'));
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = step === undefined ? (e.key === 'Home' ? 0 : items.length - 1) : (i + step + items.length) % items.length;
    items[j].focus();
  });

  // Past the rail and straight to what the screen is about. By script, not
  // by #main in the address: a hash is how this page's share links travel.
  document.querySelector('.skip-link').addEventListener('click', e => {
    e.preventDefault();
    el('main').focus();
  });
}
initA11y();
