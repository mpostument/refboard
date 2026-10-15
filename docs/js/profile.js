/* refboard - Profiles. Loaded in <head>, ahead of theme.js and everything
   else, because the very first read of a saved setting must already come
   from the right profile.

   A profile is one person's own boards, materials, themes, practice log and
   stats, plus the list of what they uploaded - for a home where more than
   one person paints on the same server or the same browser. There is no
   account and no password: choosing a profile is choosing whose things
   are shown, nothing more.

   How it is done without touching the ~140 places that read a setting: the
   main profile ("default") keeps its keys exactly as they always were, so
   nothing is moved or lost. Any other profile reads and writes the same
   "refboard.x.v1" keys under "refboard.p.<id>.x.v1" - this file replaces
   localStorage's getItem/setItem/removeItem for the page, so the rest of
   the code never learns the difference. The same goes for the documents
   js/store.js keeps (profileKind()): "uploads" becomes "u-<id>-uploads".

   What is NOT per profile: which profile is in use and the list of them,
   "keep in this browser", the tour and the news seen (all this device's), and the 3D scene
   API's two channels, scene-in and scene-out, which a program on the
   network talks to and which belong to no one. Uploaded files themselves
   are kept once, by content, whoever uploaded them. */
"use strict";

const PROFILES_KEY = 'refboard.profiles.v1';   // [{ id, name }] known on this device
const PROFILE_KEY = 'refboard.profile.v1';     // the id in use
const PROFILE_DEFAULT = 'default';
const PROFILE_DEFAULT_NAME = 'Main';
const PROFILE_PREFIX = 'refboard.p.';
// The device's own: which profile, the list of them, keeping in this browser,
// and whether the tour and the news were shown - switching to another person
// must not bring them back over the page.
const PROFILE_SHARED_KEYS = new Set([PROFILES_KEY, PROFILE_KEY, 'refboard.keep.v1', 'refboard.tour.v1', 'refboard.news.v1']);
const PROFILE_SHARED_KINDS = new Set(['scene-in', 'scene-out']);
const PROFILE_ID_RX = /^[a-z0-9]{1,16}$/;

const profileRaw = {
  get: Storage.prototype.getItem, set: Storage.prototype.setItem, remove: Storage.prototype.removeItem,
};
function profileRead(key) {
  try { return profileRaw.get.call(localStorage, key); } catch { return null; }
}
function profileWrite(key, value) {
  try { profileRaw.set.call(localStorage, key, value); return true; } catch { return false; } // private mode
}

// The profiles this device knows, the main one first.
function profiles() {
  let saved = [];
  try { saved = JSON.parse(profileRead(PROFILES_KEY)) || []; } catch { /* damaged: start again */ }
  saved = saved.filter(p => p && PROFILE_ID_RX.test(p.id) && p.id !== PROFILE_DEFAULT && typeof p.name === 'string');
  return [{ id: PROFILE_DEFAULT, name: PROFILE_DEFAULT_NAME }, ...saved];
}

// The one in use is read once, here: switching reloads the page, so no
// part of a page ever sees two profiles.
const profileId = (() => {
  const id = profileRead(PROFILE_KEY);
  return id && profiles().some(p => p.id === id) ? id : PROFILE_DEFAULT;
})();
const profileName = () => profiles().find(p => p.id === profileId).name;

// A name to an id that is safe in a key and in a folder name on the
// server: lower-case letters and digits, 16 at most. A name with none
// (Cyrillic, say) gets a short hash of itself instead, so it is still the
// same id every time - and the same on another device.
function profileSlug(name) {
  const ascii = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  if (ascii) return ascii;
  let h = 5381;
  for (const ch of name.trim().toLowerCase()) h = (Math.imul(h, 33) + ch.codePointAt(0)) >>> 0;
  return 'p' + h.toString(36).slice(0, 8);
}

// { id } or { error }. Adding a name that is already there is not an error
// worth a message of its own: it just switches to it.
function profileAdd(name) {
  name = (name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) return { error: 'Type a name first.' };
  const id = profileSlug(name);
  if (id === PROFILE_DEFAULT) return { error: '"default" is taken - choose another name.' };
  const have = profiles();
  if (!have.some(p => p.id === id)) {
    const saved = have.slice(1).concat({ id, name });
    if (!profileWrite(PROFILES_KEY, JSON.stringify(saved))) return { error: 'This browser will not keep a profile (private mode?).' };
  }
  return { id };
}

// Takes it off this device's list. Its things are not deleted - on the
// server they stay in their own folder, and adding the same name again
// brings them back.
function profileForget(id) {
  if (id === PROFILE_DEFAULT) return;
  profileWrite(PROFILES_KEY, JSON.stringify(profiles().slice(1).filter(p => p.id !== id)));
  if (id === profileId) profileWrite(PROFILE_KEY, PROFILE_DEFAULT);
}

function profileSwitch(id) {
  if (!profiles().some(p => p.id === id) || id === profileId) return false;
  profileWrite(PROFILE_KEY, id);
  location.reload();
  return true;
}

/* ---- the keys. A setting's name as the code writes it ("logical") and as
   it is stored ("physical"). */
const profileOwns = key => typeof key === 'string' && key.startsWith('refboard.') && !PROFILE_SHARED_KEYS.has(key);
const profilePhysical = key =>
  profileId === PROFILE_DEFAULT || !profileOwns(key) ? key : PROFILE_PREFIX + profileId + '.' + key.slice('refboard.'.length);

Storage.prototype.getItem = function (key) { return profileRaw.get.call(this, this === localStorage ? profilePhysical(key) : key); };
Storage.prototype.setItem = function (key, value) { return profileRaw.set.call(this, this === localStorage ? profilePhysical(key) : key, value); };
Storage.prototype.removeItem = function (key) { return profileRaw.remove.call(this, this === localStorage ? profilePhysical(key) : key); };

/* The settings of the profile in use, by their logical names - what a
   backup takes. Never the device's own (which profile, the list of them). */
function profileLocalKeys() {
  const mine = PROFILE_PREFIX + profileId + '.', out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.startsWith('refboard.') || k === PROFILES_KEY || k === PROFILE_KEY) continue;
      if (profileId === PROFILE_DEFAULT) { if (!k.startsWith(PROFILE_PREFIX)) out.push(k); }
      else if (k.startsWith(mine)) out.push('refboard.' + k.slice(mine.length));
      else if (PROFILE_SHARED_KEYS.has(k)) out.push(k);
    }
  } catch { /* private mode */ }
  return out;
}

/* ---- the documents on the server (and in IndexedDB). */
const profileKind = kind =>
  profileId === PROFILE_DEFAULT || PROFILE_SHARED_KINDS.has(kind) ? kind : `u-${profileId}-${kind}`;

// The kinds the server lists, as this profile's code knows them.
function profileKindsOf(all) {
  const mine = `u-${profileId}-`;
  return all
    .map(k => profileId === PROFILE_DEFAULT ? (/^u-[a-z0-9]{1,16}-/.test(k) ? null : k) : (k.startsWith(mine) ? k.slice(mine.length) : PROFILE_SHARED_KINDS.has(k) ? k : null))
    .filter(Boolean);
}
