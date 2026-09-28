/* refboard - A backup of everything, as one .zip, and restoring from one.
   Loaded the first time Your data is opened (loadSection('backup')).

   In it: refboard-backup.json - this browser's settings (every refboard.*
   key in localStorage: materials, themes, 3D scenes, the practice log,
   trainer scores...), every stored document, and the list of files - and
   the uploads themselves under files/. The same from the server version and
   the web page: it goes through js/store.js, which knows where each is.

   The zip is written "stored", not deflated: the uploads are JPEG, PNG and
   video, already as small as deflate would make them, and stored is a
   format a few dozen lines can write and read with no library. Any zip tool
   opens it. Up to 4 GB - there is no zip64 here. */
"use strict";

const BACKUP_MANIFEST = 'refboard-backup.json';
const BACKUP_FORMAT = 1;

/* ---- zip, stored. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entries: [{ name, data: Uint8Array }] -> a Blob of the zip.
function makeZip(entries, when = new Date()) {
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nm = new TextEncoder().encode(name), crc = crc32(data);
    // Flag 0x0800: the names are UTF-8.
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
    head.setUint16(8, 0, true); head.setUint16(10, time, true); head.setUint16(12, date, true);
    head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, data.length, true);
    head.setUint16(26, nm.length, true); head.setUint16(28, 0, true);
    parts.push(head, nm, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true); cd.setUint16(12, time, true); cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, nm.length, true); cd.setUint32(42, offset, true);
    central.push(cd, nm);
    offset += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((a, p) => a + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// A zip's bytes -> Map of name -> Uint8Array. Stored entries only, which is
// what makeZip() writes; anything else is not one of ours.
function readZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('That file is not a zip.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('That zip is damaged.');
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), note = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (method !== 0) throw new Error('That zip was not made by Refboard (its files are compressed).');
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    out.set(name, bytes.subarray(start, start + size));
    p += 46 + nameLen + extra + note;
  }
  return out;
}

const EXT_TYPE = Object.fromEntries(Object.entries(FILE_EXT).map(([t, e]) => [e, t]));

/* ---- making one. */
async function downloadBackup() {
  const btn = el('dataBackup');
  btn.disabled = true;
  try {
    dataMessage('Gathering your settings...');
    const local = {};
    for (const k of localKeys()) local[k] = localStorage.getItem(k);
    const items = {};
    for (const kind of await storeKinds()) items[kind] = await storeItems(kind);
    const files = await storeFiles(), entries = [], list = [];
    for (const [i, f] of files.entries()) {
      dataMessage(`Adding upload ${i + 1} of ${files.length}...`);
      const blob = await storeFileBlob(f.id);
      if (!blob) continue;
      const path = 'files/' + f.id;
      entries.push({ name: path, data: new Uint8Array(await blob.arrayBuffer()) });
      list.push({ id: f.id, path, type: blob.type || EXT_TYPE['.' + f.id.split('.').pop()] || '' });
    }
    const manifest = { app: 'refboard', format: BACKUP_FORMAT, made: new Date().toISOString(), version: APP_VERSION, local, items, files: list };
    entries.unshift({ name: BACKUP_MANIFEST, data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
    const zip = makeZip(entries);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = `refboard-backup-${manifest.made.slice(0, 10)}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    dataMessage(`Backup made: ${Object.keys(local).length} settings, ${list.length} upload${list.length === 1 ? '' : 's'}, ` +
      `${fmtBytes(zip.size)}.`);
  } catch (err) {
    dataMessage('The backup could not be made - ' + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

/* ---- restoring one: read and described first, restored only on Restore. */
let restoreFrom = null;
async function chooseRestore(file) {
  el('dataConfirm').classList.add('hidden');
  try {
    const zip = readZip(new Uint8Array(await file.arrayBuffer()));
    const raw = zip.get(BACKUP_MANIFEST);
    if (!raw) throw new Error('That zip is not a Refboard backup.');
    const manifest = JSON.parse(new TextDecoder().decode(raw));
    if (manifest.app !== 'refboard' || typeof manifest.local !== 'object') throw new Error('That zip is not a Refboard backup.');
    if (manifest.format > BACKUP_FORMAT) throw new Error('That backup is from a newer Refboard - update this one first.');
    restoreFrom = { manifest, zip };
  } catch (err) {
    dataMessage(err instanceof SyntaxError ? 'That backup is damaged.' : err.message, true);
    return;
  }
  const m = restoreFrom.manifest, n = (m.files || []).length;
  const lost = n && storeMode === 'memory' && !canKeepInBrowser();
  el('dataConfirmText').innerHTML =
    `A backup from <b>${esc(new Date(m.made).toLocaleString())}</b>: ${Object.keys(m.local).length} settings, ` +
    `${n} upload${n === 1 ? '' : 's'}. Restoring puts its settings in place of this browser's, and adds its uploads to yours. ` +
    (lost ? 'This browser cannot keep files, so the uploads are left out. ' : '') +
    (n && storeMode === 'memory' && !lost ? '"Keep in this browser" is switched on to hold them. ' : '') +
    'The page reloads after.';
  dataMessage('');
  el('dataConfirm').classList.remove('hidden');
  el('dataConfirmYes').focus();
}

async function restoreBackup() {
  if (!restoreFrom) return;
  const { manifest: m, zip } = restoreFrom;
  el('dataConfirm').classList.add('hidden');
  try {
    if ((m.files || []).length && storeMode === 'memory' && canKeepInBrowser()) await setKeepInBrowser(true);
    // Files first: in this browser they may get new ids, and the documents
    // that name them follow.
    const ids = {};
    if (storeMode !== 'memory') {
      for (const [i, f] of (m.files || []).entries()) {
        dataMessage(`Restoring upload ${i + 1} of ${m.files.length}...`);
        const bytes = zip.get(f.path);
        if (bytes) ids[f.id] = (await storeFile(new Blob([bytes], { type: f.type }))).id;
      }
    }
    for (const [kind, docs] of Object.entries(m.items || {})) {
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(kind) || !docs || typeof docs !== 'object') continue;
      for (let [id, doc] of Object.entries(docs)) {
        if (kind === 'uploads') {
          if (!doc || !ids[doc.file]) continue;
          doc = { ...doc, file: ids[doc.file] };
          id = uploadKey(doc.file);
        }
        if (/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) await storePutItem(kind, id, doc);
      }
    }
    for (const [k, v] of Object.entries(m.local)) {
      if (k.startsWith('refboard.') && typeof v === 'string') localStorage.setItem(k, v);
    }
    // The backup's own keep switch must not turn off what was just filled.
    if (storeMode === 'browser') localStorage.setItem(KEEP_KEY, 'on');
    dataMessage('Restored - reloading...');
    setTimeout(() => location.reload(), 700);
  } catch (err) {
    dataMessage('The restore stopped part-way - ' + err.message, true);
  }
}

el('dataConfirmYes').addEventListener('click', restoreBackup);
