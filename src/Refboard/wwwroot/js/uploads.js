/* refboard - Your uploads: what you have given the app, under the drop
   zone, to open again - and Your data, the sheet that says where it is all
   kept and makes and restores a backup of it (the archive itself is
   js/backup.js, loaded when it is first needed).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const UPLOADS_SHOWN = 24;
// A size to read, not to compute with: "340 KB", "12.5 MB".
const fmtBytes = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
let uploadsShown = [];   // what the list is drawing, newest first

// Where it is kept, said in both places that keep things; the keep switch
// only where there is a choice - on the web page, with IndexedDB there.
function renderWhere() {
  const w = storeWhere(), choice = storeMode !== 'server' && canKeepInBrowser();
  for (const [text, wrap, box] of [['uploadsWhere', 'keepWrap', 'optKeep'], ['dataWhere', 'dataKeepWrap', 'dataKeep']]) {
    el(text).textContent = w.text;
    el(text).classList.toggle('unsaved', !w.saved);
    el(wrap).classList.toggle('hidden', !choice);
    el(box).checked = storeMode === 'browser';
  }
}

async function renderUploads() {
  await initStore();
  renderWhere();
  let list = [];
  try { list = await listUploads(); } catch (err) { console.warn('uploads:', err); }
  uploadsShown = list.slice(0, UPLOADS_SHOWN);
  const host = el('uploadsList');
  host.innerHTML = '';
  for (const [i, u] of uploadsShown.entries()) {
    const li = document.createElement('li');
    li.className = 'up-tile';
    const video = u.type.startsWith('video/');
    // Where it was sorted to (js/sort.js), and what it was tagged with.
    const folder = u.folder ? SORT_FOLDERS[u.folder] || '' : '';
    const about = [folder, ...(u.tags || [])].filter(Boolean).join(', ');
    li.innerHTML =
      `<button type="button" class="up-open" data-i="${i}" aria-label="Open ${esc(u.name)}${folder ? ' - ' + esc(folder) : ''}" title="${esc(u.name)} - ${new Date(u.t).toLocaleString()}${about ? ' - ' + esc(about) : ''}">` +
      (video ? iconSvg('play') : `<img alt="" loading="lazy">`) + '</button>' +
      `<span class="up-name" aria-hidden="true">${esc(u.name)}</span>` +
      (folder ? `<span class="up-folder" aria-hidden="true">${esc(folder)}</span>` : '') +
      `<button type="button" class="up-forget" data-forget="${i}" aria-label="Forget ${esc(u.name)}" title="Forget it - no longer kept">${iconSvg('close')}</button>`;
    host.appendChild(li);
    if (!video) storeFileUrl(u.file).then(url => { if (url) li.querySelector('img').src = url; });
  }
  el('uploads').classList.toggle('hidden', !list.length && storeMode === 'memory' && !canKeepInBrowser());
  return list;
}

async function openUpload(u) {
  if (u.type.startsWith('video/')) {
    // Frames are taken again - a different twenty, which is the point.
    const blob = await storeFileBlob(u.file);
    if (blob) takeDropped([new File([blob], u.name, { type: u.type })], { keep: false });
    return;
  }
  const url = await storeFileUrl(u.file);
  // What it was made in, for How to draw it (js/steps.js).
  if (url && u.tags) stepsKnown.set(url, u.tags);
  if (url) openInWorkspace(url, { label: u.name, tab: u.from === 'colour' ? 'colour' : 'value' });
}

/* ---- the Your data sheet. */
async function openData() {
  el('dataSheet').classList.remove('hidden');
  el('dataConfirm').classList.add('hidden');
  el('dataMsg').textContent = '';
  dialogOpened(el('dataSheet'), el('dataBackup'));
  const list = await renderUploads();
  const bytes = list.reduce((a, u) => a + (u.bytes || 0), 0);
  el('dataCounts').textContent = `${list.length.toLocaleString()} upload${list.length === 1 ? '' : 's'}` +
    (bytes ? ` (${fmtBytes(bytes)})` : '') + ` · ${localKeys().length} settings kept in this browser`;
  loadSection('backup').catch(() => { /* the buttons will say */ });
}
function closeData() {
  el('dataSheet').classList.add('hidden');
  dialogClosed(el('dataSheet'));
}

// This app's own keys in localStorage - what a backup takes from it.
function localKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('refboard.')) out.push(k); } }
  catch { /* private mode */ }
  return out.sort();
}

function dataMessage(text, bad = false) {
  el('dataMsg').textContent = text;
  el('dataMsg').classList.toggle('bad', bad);
}

function initUploads() {
  el('uploadsList').addEventListener('click', e => {
    const forget = e.target.closest('[data-forget]');
    if (forget) {
      const u = uploadsShown[Number(forget.dataset.forget)];
      if (u) forgetUpload(u).then(() => el('uploadsList').querySelector('.up-open')?.focus());
      return;
    }
    const open = e.target.closest('[data-i]');
    if (open) openUpload(uploadsShown[Number(open.dataset.i)]);
  });
  for (const id of ['optKeep', 'dataKeep']) el(id).addEventListener('change', e => setKeepInBrowser(e.target.checked));
  document.addEventListener('refboard:store', () => { renderUploads(); });

  el('btnData').addEventListener('click', openData);
  el('dataClose').addEventListener('click', closeData);
  initSheet(el('dataSheet'), closeData);
  const lazy = fn => () => loadSection('backup').then(fn, () => dataMessage('The backup could not load - check the connection.', true));
  el('dataBackup').addEventListener('click', lazy(() => downloadBackup()));
  el('dataRestore').addEventListener('click', () => el('dataRestoreInput').click());
  el('dataRestoreInput').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) lazy(() => chooseRestore(f))();
  });
  el('dataConfirmNo').addEventListener('click', () => { el('dataConfirm').classList.add('hidden'); el('dataRestore').focus(); });
}
initUploads();
