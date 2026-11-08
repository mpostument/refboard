/* refboard - Your own tags on pictures, and a session picked for you from them.

   Tags: a word or two you give a picture - "hands", "dress folds", "for Friday" - on the grid (the # on a cell) or
   in a session (T). Kept in this browser (refboard.tags.v1) as src -> [tag]; they join the search words of the grid
   and are chips under the search box, where one press shows only that tag. Same shape as the stars (js/marks.js).

   Picked for you: Draw these takes a number - 10, 20, 30, 50 - and picks that many from what the grid shows,
   preferring the pictures not drawn lately (refboard.seen.v1: src -> when it was last on screen in a timed
   session) and the starred. Pressing "Fresh" off makes the pick plain chance. */
"use strict";

const TAGS_KEY = 'refboard.tags.v1', SEEN_KEY = 'refboard.seen.v1', DRAW_KEY = 'refboard.draw.v1';
const TAG_MAX = 24, TAGS_PER = 12;
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
const writeJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };

let userTagMap = readJson(TAGS_KEY, {});
let seenMap = readJson(SEEN_KEY, {});
let activeTag = '';
let drawPrefs = { n: 0, fresh: true, ...readJson(DRAW_KEY, {}) };

const userTags = src => userTagMap[src] || [];
const cleanTag = s => String(s).toLowerCase().replace(/[,#]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX);
function setUserTags(src, list) {
  const tags = [...new Set(list.map(cleanTag).filter(Boolean))].slice(0, TAGS_PER);
  if (tags.length) userTagMap[src] = tags; else delete userTagMap[src];
  writeJson(TAGS_KEY, userTagMap);
}
// [[tag, how many pictures]], the most used first.
function tagCounts() {
  const n = new Map();
  for (const list of Object.values(userTagMap)) for (const t of list) n.set(t, (n.get(t) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/* ---- the grid */
function gridTagButton(item) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell-tagbtn';
  paintTagButton(b, item.src);
  return b;
}
function paintTagButton(b, src) {
  const n = userTags(src).length;
  b.textContent = n ? `# ${n}` : '#';
  b.classList.toggle('has', n > 0);
  b.title = n ? `Tags: ${userTags(src).join(', ')} - click to change` : 'Tag this picture (T in a session)';
}
function filterByTag(list) {
  return activeTag ? list.filter(i => userTags(i.src).includes(activeTag)) : list;
}
function renderTagBar() {
  const bar = el('tagBar');
  if (!bar) return;
  const all = tagCounts();
  if (activeTag && !all.some(([t]) => t === activeTag)) activeTag = '';
  bar.classList.toggle('hidden', !all.length);
  bar.innerHTML = all.length
    ? `<span class="count">Your tags</span>` + all.slice(0, 16).map(([t, n]) =>
        `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${t === activeTag}">${esc(t)} <span class="count">${n}</span></button>`).join('')
    : '';
}

/* ---- the editor: one small box, shared by the grid and the session */
let tagPop = null, tagSrc = '', tagOnChange = null;
function ensureTagPop() {
  if (tagPop) return tagPop;
  tagPop = document.createElement('div');
  tagPop.id = 'tagPop';
  tagPop.className = 'tag-pop hidden';
  tagPop.setAttribute('role', 'dialog');
  tagPop.setAttribute('aria-label', 'Tags for this picture');
  tagPop.innerHTML = '<div class="tag-have" id="tagHave"></div>' +
    '<input type="text" id="tagInput" maxlength="24" autocomplete="off" placeholder="Add a tag, Enter" aria-label="Add a tag">' +
    '<div class="tag-sugg" id="tagSugg"></div>';
  document.body.appendChild(tagPop);
  tagPop.addEventListener('click', e => {
    const x = e.target.closest('[data-untag]'), add = e.target.closest('[data-addtag]');
    if (x) setUserTags(tagSrc, userTags(tagSrc).filter(t => t !== x.dataset.untag));
    else if (add) setUserTags(tagSrc, [...userTags(tagSrc), add.dataset.addtag]);
    else return;
    renderTagPop();
  });
  tagPop.addEventListener('keydown', e => {
    if (e.target.id !== 'tagInput') return;
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.target.value.trim()) { setUserTags(tagSrc, [...userTags(tagSrc), e.target.value]); e.target.value = ''; renderTagPop(); }
      else closeTagPop();
    } else if (e.key === 'Escape') { e.preventDefault(); closeTagPop(); }
    else if (e.key === 'Backspace' && !e.target.value && userTags(tagSrc).length) {
      setUserTags(tagSrc, userTags(tagSrc).slice(0, -1)); renderTagPop();
    }
  });
  document.addEventListener('pointerdown', e => {
    if (!tagPop.classList.contains('hidden') && !tagPop.contains(e.target) && !e.target.closest('.cell-tagbtn')) closeTagPop();
  });
  return tagPop;
}
function renderTagPop() {
  const mine = userTags(tagSrc);
  el('tagHave').innerHTML = mine.map(t => `<span class="tag-chip">${esc(t)}<button type="button" data-untag="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join('');
  el('tagSugg').innerHTML = tagCounts().filter(([t]) => !mine.includes(t)).slice(0, 8)
    .map(([t]) => `<button type="button" class="chip" data-addtag="${esc(t)}">${esc(t)}</button>`).join('');
  tagOnChange && tagOnChange();
}
// anchor: a grid cell's button, or null for the middle of the session.
function openTagPop(src, anchor, onChange) {
  const pop = ensureTagPop();
  tagSrc = src; tagOnChange = onChange || null;
  pop.classList.remove('hidden');
  renderTagPop();
  if (anchor) {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    pop.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - h - 8)) + 'px';
    pop.style.bottom = '';
  } else {
    pop.style.left = Math.max(8, (innerWidth - pop.offsetWidth) / 2) + 'px';
    pop.style.top = '';
    pop.style.bottom = '90px';
  }
  el('tagInput').value = '';
  el('tagInput').focus();
}
function closeTagPop() {
  if (!tagPop || tagPop.classList.contains('hidden')) return;
  tagPop.classList.add('hidden');
  tagOnChange = null;
  renderTagBar();
  if (typeof refreshGrid === 'function' && !el('setup').classList.contains('hidden') && activeTag) refreshGrid();
}
function toggleCellTags(i, cell) {
  const item = gridItems[i];
  if (!item) return;
  const btn = cell.querySelector('.cell-tagbtn');
  if (tagPop && !tagPop.classList.contains('hidden') && tagSrc === item.src) { closeTagPop(); return; }
  openTagPop(item.src, btn, () => { paintTagButton(btn, item.src); renderTagBar(); });
}
function tagCurrent() {
  if (!state.current) return;
  const src = state.current;
  openTagPop(src, null, () => marksToast(userTags(src).length ? '# ' + userTags(src).join(', ') : 'No tags'));
}

/* ---- what was drawn when */
function markSeen(src) {
  seenMap[src] = Math.floor(Date.now() / 1000);
  writeJson(SEEN_KEY, seenMap);
}

/* ---- Draw these, a number of them */
function pickForSession(items, n, fresh) {
  if (!(n > 0) || items.length <= n) return items;
  const now = Date.now() / 1000;
  const score = i => {
    if (!fresh) return Math.random();
    const seen = seenMap[i.src];
    // Never drawn beats drawn a year ago beats drawn yesterday; a star adds, chance blurs the ties.
    const stale = seen ? Math.min(365, (now - seen) / 86400) / 365 : 1.2;
    return stale + (isStarred(i.src) ? 0.3 : 0) + Math.random() * 0.5;
  };
  return items.map(i => [score(i), i]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
function syncDrawPick() {
  const sel = el('drawCount'), fresh = el('drawFresh');
  if (!sel) return;
  const total = gridItems.length;
  for (const o of sel.options) o.hidden = Number(o.value) > 0 && Number(o.value) >= total;
  sel.options[0].textContent = total ? `All ${total}` : 'All';
  const picking = Number(sel.value) > 0 && Number(sel.value) < total;
  fresh.classList.toggle('hidden', !picking);
  fresh.setAttribute('aria-pressed', String(drawPrefs.fresh));
  fresh.title = drawPrefs.fresh ? 'Preferring pictures not drawn lately, and starred ones - click for plain chance' : 'Plain chance - click to prefer pictures not drawn lately';
}
function drawThese() {
  if (!gridItems.length) return;
  const picked = pickForSession(gridItems, drawPrefs.n, drawPrefs.fresh);
  const units = picked.map(browseUnit);
  // A number asked for is a shuffled pick; All stays in the order of the grid, as it was.
  startSession(picked !== gridItems ? shuffle(units) : units,
    { label: activeTag ? `Tag: ${activeTag}` : 'Picked for you' });
}

function initTags() {
  el('tagBar').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    activeTag = activeTag === b.dataset.tag ? '' : b.dataset.tag;
    renderTagBar();
    refreshGrid();
  });
  const sel = el('drawCount');
  if ([...sel.options].some(o => o.value === String(drawPrefs.n))) sel.value = String(drawPrefs.n); else drawPrefs.n = 0;
  sel.addEventListener('change', () => { drawPrefs.n = Number(sel.value); writeJson(DRAW_KEY, drawPrefs); syncDrawPick(); });
  el('drawFresh').addEventListener('click', () => { drawPrefs.fresh = !drawPrefs.fresh; writeJson(DRAW_KEY, drawPrefs); syncDrawPick(); });
  el('btnBrowseDraw').addEventListener('click', drawThese);
  renderTagBar();
  syncDrawPick();
}
