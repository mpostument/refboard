/* refboard - Marks on pictures, and what a session leaves behind.

   Star: a picture you want to find again (L in a session, the star on a grid
   cell). The grid can show only the starred, and Draw these then draws from
   just those. Same shape as skipped (src -> { on, t }), kept in this browser.

   Come back to this (B in a session): a frame to give another go. It is not
   kept - when the session ends, the card that sums it up lists those frames and
   can draw them again at once. */
"use strict";

const STARRED_KEY = 'refboard.starred.v1';
let starred = (() => {
  try { return JSON.parse(localStorage.getItem(STARRED_KEY)) || {}; } catch { return {}; }
})();
let starsOnly = false;
let revisit = [];            // srcs marked in the session now running
let marksSkipBase = 0;       // how many were skipped when it began

const isStarred = src => !!(starred[src] && starred[src].on);
function setStarred(src, on) {
  if (!src) return;
  starred[src] = { on, t: Math.floor(Date.now() / 1000) };
  try { localStorage.setItem(STARRED_KEY, JSON.stringify(starred)); } catch { /* private mode */ }
}
const starredCount = () => Object.values(starred).filter(v => v && v.on).length;

/* ---- the grid */
function paintStar(btn, on) {
  btn.textContent = on ? '★' : '☆';
  btn.setAttribute('aria-pressed', String(on));
  btn.title = on ? 'Starred - click to remove the star (L)' : 'Star this picture (L)';
}
function gridStarButton(item) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell-star';
  paintStar(b, isStarred(item.src));
  return b;
}
// In place, like toggleCellSkip: a re-render would throw away the pages already shown.
function toggleCellStar(i, cell) {
  const item = gridItems[i];
  if (!item) return;
  const now = !isStarred(item.src);
  setStarred(item.src, now);
  cell.classList.toggle('starred', now);
  paintStar(cell.querySelector('.cell-star'), now);
  syncStarsButton();
  // Un-starring while only the starred are shown takes it out of view.
  if (starsOnly && !now) refreshGrid();
}
function syncStarsButton() {
  const b = el('btnStarred');
  if (!b) return;
  const n = starredCount();
  b.textContent = n ? `★ ${n}` : '★';
  b.setAttribute('aria-pressed', String(starsOnly));
  b.title = starsOnly ? 'Showing only starred pictures - click to show all' : 'Show only the pictures you starred';
}

/* ---- in a session */
function marksToast(text) {
  const t = el('markToast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(marksToast.t);
  marksToast.t = setTimeout(() => t.classList.add('hidden'), 1500);
}
function starCurrent() {
  if (!state.current) return;
  const now = !isStarred(state.current);
  setStarred(state.current, now);
  marksToast(now ? '★ Starred' : 'Star removed');
  syncStarsButton();
}
function revisitCurrent() {
  if (!state.current || state.browse) return;
  const i = revisit.indexOf(state.current);
  if (i >= 0) { revisit.splice(i, 1); marksToast('Not coming back to this one'); return; }
  revisit.push(state.current);
  marksToast(`Will come back to this (${revisit.length})`);
}

function marksBegin() {
  revisit = [];
  marksSkipBase = typeof skippedCount === 'function' ? skippedCount() : 0;
}

/* ---- the card after a session */
function marksFinish(start, end, drawn) {
  const card = el('doneCard');
  clearTimeout(marksFinish.t);
  if (!(drawn > 0)) { card.classList.add('hidden'); return; }
  const skippedNow = Math.max(0, skippedCount() - marksSkipBase);
  const bits = [`${drawn} pose${drawn === 1 ? '' : 's'}`, fmtSpan(end - start)];
  if (skippedNow) bits.push(`${skippedNow} skipped`);
  const back = revisit.slice();
  card.innerHTML =
    `<div class="done-head"><b>Session done</b><button type="button" class="ghost" id="doneClose" aria-label="Close" title="Close">×</button></div>` +
    `<div class="count">${bits.join(' · ')}</div>` +
    (back.length
      ? `<div class="count">Marked to come back to:</div><div class="done-thumbs">` +
        back.map(s => `<img alt="" src="${esc(thumbCandidates(s)[0])}">`).join('') + `</div>` +
        `<button type="button" class="ghost" id="doneAgain">Draw these ${back.length} again</button>`
      : '');
  card.classList.remove('hidden');
  el('doneClose').addEventListener('click', () => card.classList.add('hidden'));
  if (back.length) {
    el('doneAgain').addEventListener('click', () => {
      card.classList.add('hidden');
      startSession(back.map(s => ({ frames: [s], pack: '', group: '' })), { label: 'Come back to' });
    });
  } else {
    marksFinish.t = setTimeout(() => card.classList.add('hidden'), 20000);
  }
  revisit = [];
}

function initMarks() {
  el('btnStarred').addEventListener('click', () => {
    starsOnly = !starsOnly;
    syncStarsButton();
    refreshGrid();
  });
  syncStarsButton();
}
