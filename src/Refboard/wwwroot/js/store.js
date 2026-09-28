/* refboard - Keeping what the app is given: uploaded pictures and videos,
   photos of your own work, and small documents about them.

   One set of calls, three places behind it, chosen once at start:
     server  - behind the container: POST /api/uploads and /api/items
               (Services/UserStore.cs). Kept on its disk, and an uploaded
               picture joins the library as the Uploads pack.
     browser - on GitHub Pages with "Keep in this browser" on: IndexedDB.
               Kept in this browser only, on this device.
     memory  - otherwise: kept until the page is reloaded, as before.
   Every place that keeps something says which of the three it is -
   storeWhere() - rather than letting a reload be the way to find out.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const KEEP_KEY = 'refboard.keep.v1';
let storeMode = 'memory';
// Asked once: is there a backend? The footer's version comes from the same
// answer - see updateFooterVersion().
const backendInfo = fetch('healthz', { cache: 'no-store' })
  .then(r => r.ok ? r.json() : null).catch(() => null);

const storeMem = { files: new Map(), items: new Map() }; // memory mode
const storeUrls = new Map();                              // file id -> blob: URL

const keepInBrowser = () => { try { return localStorage.getItem(KEEP_KEY) === 'on'; } catch { return false; } };
const canKeepInBrowser = () => typeof indexedDB !== 'undefined';

// Resolves once the mode is known. Called by boot(); safe to call again.
let storeReady = null;
function initStore() {
  return storeReady ||= backendInfo.then(info => {
    storeMode = info ? 'server' : (keepInBrowser() && canKeepInBrowser() ? 'browser' : 'memory');
  });
}

function storeWhere() {
  return {
    server: { saved: true, text: 'Saved on this server, and sorted: each picture is looked at, tagged and put in a folder - Figure, Portrait, Landscape... - in the Uploads pack of the library.' },
    browser: { saved: true, text: 'Kept in this browser, on this device only.' },
    memory: { saved: false, text: 'Not saved in this version - gone when the page is reloaded.' },
  }[storeMode];
}

/* Switches keeping in this browser on or off. On: what this page holds so
   far goes in with it. Off: nothing is deleted - it is still there if it
   is switched on again - but nothing new is kept. */
async function setKeepInBrowser(on) {
  if (storeMode === 'server' || !canKeepInBrowser()) return;
  try { localStorage.setItem(KEEP_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  if (on && storeMode === 'memory') {
    storeMode = 'browser';
    for (const [id, blob] of storeMem.files) await idbPut('files', { id, blob });
    for (const [key, doc] of storeMem.items) await idbPut('items', { key, doc });
  } else if (!on && storeMode === 'browser') {
    storeMode = 'memory';
    storeMem.files.clear(); storeMem.items.clear();
  }
  storeChanged();
}

const storeChanged = () => document.dispatchEvent(new CustomEvent('refboard:store'));

/* ---- IndexedDB, in two stores: files { id, blob } and items { key, doc },
   key being "kind/id". */
let idbOpen = null;
function idb() {
  return idbOpen ||= new Promise((res, rej) => {
    const r = indexedDB.open('refboard', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('files', { keyPath: 'id' });
      r.result.createObjectStore('items', { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(store, mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode), req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  });
}
const idbPut = (store, v) => idbDo(store, 'readwrite', s => s.put(v));
const idbGet = (store, k) => idbDo(store, 'readonly', s => s.get(k));
const idbDel = (store, k) => idbDo(store, 'readwrite', s => s.delete(k));
const idbAll = store => idbDo(store, 'readonly', s => s.getAll());

async function apiJson(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}

/* ---- files. An id is the SHA-256 of the contents and an extension, as
   the server makes it - so the same picture kept twice is kept once, and a
   backup restores to the same ids. In memory - kept only until a reload,
   so a video is not read through for nothing - or without crypto.subtle,
   a random one. */
const FILE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'image/avif': '.avif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
async function fileId(blob, byContent) {
  const ext = FILE_EXT[blob.type] || '.bin';
  if (!byContent || !crypto.subtle) return crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '') + ext;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return [...hash].map(b => b.toString(16).padStart(2, '0')).join('') + ext;
}

async function storeFile(blob) {
  if (storeMode === 'server') {
    return apiJson('api/uploads', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
  }
  const id = await fileId(blob, storeMode === 'browser');
  if (storeMode === 'browser') await idbPut('files', { id, blob });
  else storeMem.files.set(id, blob);
  if (!storeUrls.has(id)) storeUrls.set(id, URL.createObjectURL(blob));
  return { id, url: storeUrls.get(id), bytes: blob.size };
}

// On the server by id through the API, not by its path under uploads/,
// which changes when it is sorted into a folder (js/sort.js).
async function storeFileUrl(id) {
  if (storeMode === 'server') return 'api/uploads/' + id;
  if (!storeUrls.has(id)) {
    const blob = await storeFileBlob(id);
    if (!blob) return null;
    storeUrls.set(id, URL.createObjectURL(blob));
  }
  return storeUrls.get(id);
}

async function storeFileBlob(id) {
  if (storeMode === 'server') { const r = await fetch('api/uploads/' + id); return r.ok ? r.blob() : null; }
  if (storeMode === 'browser') return (await idbGet('files', id))?.blob || null;
  return storeMem.files.get(id) || null;
}

// Every file kept: [{ id, bytes }].
async function storeFiles() {
  if (storeMode === 'server') return apiJson('api/uploads');
  const all = storeMode === 'browser' ? (await idbAll('files')).map(f => [f.id, f.blob]) : [...storeMem.files];
  return all.map(([id, blob]) => ({ id, bytes: blob.size }));
}

// Moves a kept picture into one of the server's folders (UserStore.Folders).
// Only behind the container - on the web page there are no folders.
async function storeSortFile(id, folder) {
  return apiJson(`api/uploads/${id}/folder`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
}

async function storeDeleteFile(id) {
  if (storeMode === 'server') await fetch('api/uploads/' + id, { method: 'DELETE' });
  else if (storeMode === 'browser') await idbDel('files', id);
  else storeMem.files.delete(id);
  if (storeUrls.has(id)) { URL.revokeObjectURL(storeUrls.get(id)); storeUrls.delete(id); }
}

/* ---- documents: small JSON, by kind and id - both lower-case letters,
   digits, - and _ (the server refuses anything else). */
async function storeItems(kind) {
  if (storeMode === 'server') return apiJson('api/items/' + kind);
  const out = {}, pre = kind + '/';
  const all = storeMode === 'browser' ? (await idbAll('items')).map(i => [i.key, i.doc]) : [...storeMem.items];
  for (const [key, doc] of all) if (key.startsWith(pre)) out[key.slice(pre.length)] = doc;
  return out;
}

async function storeItem(kind, id) {
  if (storeMode === 'server') {
    const r = await fetch(`api/items/${kind}/${id}`);
    return r.ok ? r.json() : null;
  }
  if (storeMode === 'browser') return (await idbGet('items', `${kind}/${id}`))?.doc || null;
  return storeMem.items.get(`${kind}/${id}`) || null;
}

async function storeKinds() {
  if (storeMode === 'server') return apiJson('api/items');
  const keys = storeMode === 'browser' ? (await idbAll('items')).map(i => i.key) : [...storeMem.items.keys()];
  return [...new Set(keys.map(k => k.split('/')[0]))];
}

async function storePutItem(kind, id, doc) {
  if (storeMode === 'server') {
    await apiJson(`api/items/${kind}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
  } else if (storeMode === 'browser') await idbPut('items', { key: `${kind}/${id}`, doc });
  else storeMem.items.set(`${kind}/${id}`, doc);
}

async function storeDeleteItem(kind, id) {
  if (storeMode === 'server') await fetch(`api/items/${kind}/${id}`, { method: 'DELETE' });
  else if (storeMode === 'browser') await idbDel('items', `${kind}/${id}`);
  else storeMem.items.delete(`${kind}/${id}`);
}

/* ---- uploads: a file and what it was - its name, where it came in, when.
   Kept as an "uploads" document per file, id the file's hash. */
const uploadKey = fileId => fileId.split('.')[0];

async function keepUpload(blob, { name = blob.name || 'picture', from = 'drop' } = {}) {
  await initStore();
  const f = await storeFile(blob);
  const doc = { file: f.id, name, type: blob.type, from, bytes: blob.size, t: Date.now() };
  // Kept before and sorted since - the server says which folder it is in:
  // it stays there, with its tags.
  if (f.folder) {
    const had = await storeItem('uploads', uploadKey(f.id));
    Object.assign(doc, { folder: f.folder, tags: (had && had.tags) || [] });
  }
  await storePutItem('uploads', uploadKey(f.id), doc);
  storeChanged();
  if (storeMode === 'server' && !doc.folder) queueSort(doc);
  return { ...doc, url: f.url };
}

// Fire and forget, for the places that take a file: keeping it must never
// stand between the picture and the person who dropped it.
function keepUploadQuietly(blob, opts) {
  keepUpload(blob, opts).catch(err => console.warn('not kept:', err));
}

// Newest first.
async function listUploads() {
  await initStore();
  const docs = Object.values(await storeItems('uploads'));
  return docs.filter(d => d && d.file).sort((a, b) => (b.t || 0) - (a.t || 0));
}

async function forgetUpload(doc) {
  await storeDeleteItem('uploads', uploadKey(doc.file));
  await storeDeleteFile(doc.file);
  storeChanged();
}
