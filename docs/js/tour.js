/* refboard - The tour: the first time the app opens, a few notes, each
   beside the real control it is about - a ring round it, the rest dimmed.
   No pictures of the interface, so it cannot go out of date: a step whose
   control is not on the screen (a section you hid) is left out.

   Once seen it does not come back by itself; Help and Ctrl+K start it
   again. */
"use strict";

const TOUR_KEY = 'refboard.tour.v1';
// at: what the ring goes round. Written here, so HTML is fine in text.
const TOUR = [
  { at: '#rail', text: 'The sections, down the left, grouped by the stage of the work: <b>Prepare</b>, <b>Practise</b>, <b>Paint</b>, <b>Check</b>. Hover one for its name.' },
  { at: '#btnFind', text: '<b>Find a tool</b> - <kbd>Ctrl+K</kbd>. Type a few letters - "flip", "loomis", "green" - and Enter. Everything is in it, even what you hide.' },
  { at: '#stages', text: 'The same four stages as cards, each with what is in it. A good place to start.' },
  { at: '#sectionsEdit', text: 'Never open a section? Untick it here - it leaves the rail and its card, and there is less to look past.' },
  { at: '#btnPaint', text: '<b>Start drawing</b>. In a session, <kbd>W</kbd> opens the workspace: the tools sorted by the question you ask - value, colour, construction, the figure, your own work.' },
  { at: '#btnHelpSetup', text: 'Everything else is in <b>Help</b> <kbd>?</kbd> - and this tour, if you want it again.' },
];
let tourSteps = [], tourAt = 0;

// On the screen now: not hidden, by the app or by you.
function tourTarget(s) {
  const n = document.querySelector(s.at);
  return n && n.getClientRects().length ? n : null;
}

function startTour() {
  tourSteps = TOUR.filter(tourTarget);
  if (!tourSteps.length) return;
  if (!el('helpOverlay').classList.contains('hidden')) toggleHelp();
  el('tour').classList.remove('hidden');
  showTourStep(0);
}

// Only the first time - and not when it cannot be remembered, or it would
// come back on every visit in a private window.
function startTourOnce() {
  try { if (localStorage.getItem(TOUR_KEY)) return; } catch { return; }
  if (el('setup').classList.contains('hidden')) return;
  startTour();
}

function endTour() {
  el('tour').classList.add('hidden');
  try { localStorage.setItem(TOUR_KEY, 'seen'); } catch { /* private mode */ }
}

function showTourStep(i) {
  tourAt = i;
  const last = i === tourSteps.length - 1;
  el('tourText').innerHTML = tourSteps[i].text;
  el('tourCount').textContent = `${i + 1} of ${tourSteps.length}`;
  el('tourBack').disabled = i === 0;
  el('tourNext').textContent = last ? 'Done' : 'Next';
  el('tourSkip').classList.toggle('hidden', last);
  placeTour();
  el('tourNext').focus();
}

// The ring round the control; the note to its right if there is room,
// else below it, else above - and always inside the window.
function placeTour() {
  if (el('tour').classList.contains('hidden')) return;
  const n = tourTarget(tourSteps[tourAt]);
  if (!n) { endTour(); return; }
  n.scrollIntoView({ block: 'nearest' });
  const r = n.getBoundingClientRect(), pad = 4, gap = 14, m = 16;
  Object.assign(el('tourRing').style, {
    left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
  });
  const note = el('tourNote'), w = note.offsetWidth, h = note.offsetHeight;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  let x, y;
  if (r.right + gap + w + m <= innerWidth) { x = r.right + gap; y = r.top; }
  else if (r.bottom + gap + h + m <= innerHeight) { x = r.left; y = r.bottom + gap; }
  else { x = r.left; y = r.top - gap - h; }
  note.style.left = `${clamp(x, m, innerWidth - w - m)}px`;
  note.style.top = `${clamp(y, m, innerHeight - h - m)}px`;
}

function initTour() {
  el('tourNext').addEventListener('click', () => tourAt < tourSteps.length - 1 ? showTourStep(tourAt + 1) : endTour());
  el('tourBack').addEventListener('click', () => showTourStep(tourAt - 1));
  el('tourSkip').addEventListener('click', endTour);
  el('btnTour').addEventListener('click', startTour);
  el('tour').addEventListener('keydown', e => {
    // Its keys stay in it: "?" or Ctrl+K would open something under it.
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); endTour(); }
    else if (e.key === 'ArrowRight' && tourAt < tourSteps.length - 1) showTourStep(tourAt + 1);
    else if (e.key === 'ArrowLeft' && tourAt > 0) showTourStep(tourAt - 1);
    // Tab goes round the note's own buttons, not out under the dimming.
    else if (e.key === 'Tab') {
      const bs = [...el('tourNote').querySelectorAll('button:not(.hidden):not(:disabled)')];
      const j = bs.indexOf(document.activeElement), k = (j + (e.shiftKey ? -1 : 1) + bs.length) % bs.length;
      e.preventDefault(); bs[k].focus();
    }
  });
  addEventListener('resize', placeTour);
}
initTour();
