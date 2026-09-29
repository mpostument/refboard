/* refboard - Version, icons, the skip list, the session log, settings.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// The footer's fallback, and the only version this page can show at all when
// there is no backend to ask - i.e. on GitHub Pages. Bump this by hand on
// release; see the README's Releasing section. Behind a container,
// updateFooterVersion() below overwrites it with the real running version
// from /healthz, so this constant drifting a little on Pages costs nothing
// where it actually matters.
const APP_VERSION = '0.15.0';

/* ---- icons. Line icons on a 24-unit grid, drawn in currentColor so they
   take the button's colour and its hover and pressed states. Any element
   with data-icon gets one; its words stay in the title and aria-label. */
const ICONS = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  images: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  cube: '<path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  person: '<circle cx="12" cy="4.5" r="2.2"/><path d="M12 7.5v7M7.5 10.5l4.5-2 4.5 2M8.5 21l3.5-6.5 3.5 6.5"/>',
  head: '<circle cx="11" cy="9.5" r="6.5"/><path d="M11 3v13M4.5 9.5h13M16 10v2.5a2 2 0 0 1-1 1.7L11 21M7 14.5 11 21"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.7-1 1.2-1.9-.5-1 0-2.1 1.2-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  brush: '<path d="M18.5 3.5a2 2 0 0 1 2.8 2.8L12 15.6 8.4 12z"/><path d="M8 13.2c-2.4 0-4 1.6-4 4 0 1.4-.6 2.3-1.5 2.8 4.5.8 8.3-.7 8.3-4z"/>',
  edges: '<path d="M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7"/><path d="M12 4h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-7" stroke-dasharray="1.2 2.6"/><path d="M12 4v16"/>',
  layers: '<path d="M12 3 21 8l-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7v.3"/><circle cx="12" cy="17" r=".7" fill="currentColor"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 5v14l12-7z"/>',
  prev: '<path d="m15 6-6 6 6 6"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 2.5"/><path d="M9 7 3.5 17H9zM15 7l5.5 10H15z"/>',
  gray: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  squint: '<path d="M2.5 11s3.5-4.5 9.5-4.5 9.5 4.5 9.5 4.5"/><path d="M2.5 11s3.5 4 9.5 4 9.5-4 9.5-4M5 15.5l1.3-1.6M19 15.5l-1.3-1.6M12 18.5v-2.4M8.2 17.8l.8-2M15.8 17.8l-.8-2"/>',
  zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M8 11h6"/>',
  zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3M8 11h6M11 8v6"/>',
  angle: '<path d="M4 20h16M4 20 15.5 5"/><path d="M10 20a6 6 0 0 0-2.3-4.8"/>',
  clearLines: '<path d="M4 20 16 8" stroke-dasharray="3 2.5"/><path d="m15 4 5 5m0-5-5 5"/>',
  pipette: '<path d="m13 7 4 4M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L17 11l-4-4z"/><path d="M13 7 5 15v4h4l8-8"/>',
  compare: '<rect x="3" y="3" width="12" height="12" rx="1.5"/><rect x="9" y="9" width="12" height="12" rx="1.5" stroke-dasharray="3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".7" fill="currentColor"/>',
  similar: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  move: '<path d="M12 3v18M3 12h18M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5"/>',
  rotate: '<path d="M19.5 13A7.5 7.5 0 1 1 17 6.5"/><path d="M19.5 3.5v4.5H15"/>',
  scale: '<rect x="3.5" y="11.5" width="9" height="9" rx="1"/><path d="M13.5 3.5h7v7M20.5 3.5l-8 8"/>',
  figure: '<circle cx="12" cy="4.5" r="2.2"/><path d="M12 7v7M7 9.5l5 1.5 5-1.5M12 14l-3.5 7M12 14l3.5 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  pen: '<path d="M4 20c4-1 6-6 9.5-9.5L17 7l-2-2-3.5 3.5C8 12 5 14 4 20z"/><path d="m15 5 2-2 4 4-2 2"/>',
  sparkle: '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z"/>',
  clean: '<path d="m3 3 18 18"/><path d="M10.6 5.1Q11.3 5 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.8M6.6 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2"/>',
};
function iconSvg(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
function applyIcons(root = document) {
  for (const n of root.querySelectorAll('[data-icon]')) n.innerHTML = iconSvg(n.dataset.icon);
}
// A button whose icon says its state - Pause turning into Resume.
function setIcon(id, name, title) {
  const b = el(id);
  b.dataset.icon = name;
  b.innerHTML = iconSvg(name);
  if (title) { b.title = title; b.setAttribute('aria-label', title.replace(/ \(.*\)$/, '')); }
}

/* ---- sections that load when first opened. Their scripts wait in
   index.html inside <template id="lazy-NAME">: a template's scripts are
   never run, but their stamped URLs (scripts/stamp-assets.js) are there to
   copy. Added one after another, not async, so a file may use the one
   before it at load time exactly as the static list allows. A failed load
   is forgotten, so opening the section again tries again. */
const lazySections = {};
function loadSection(name) {
  if (lazySections[name]) return lazySections[name];
  const tpl = document.getElementById('lazy-' + name);
  if (!tpl) return Promise.resolve();
  const srcs = [...tpl.content.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  lazySections[name] = srcs.reduce((prev, src) => prev.then(() => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => { s.remove(); rej(new Error('could not load ' + src)); };
    document.body.appendChild(s);
  })), Promise.resolve()).catch(err => { delete lazySections[name]; throw err; });
  return lazySections[name];
}

// Small angle helpers the 3D view and the session's Compare both use - here,
// not in the 3D view's files, which load only when it is opened.
const THREE_DEG = Math.PI / 180;
const wrap180 = a => ((a % 360) + 540) % 360 - 180;

const INDEX_URL = 'index.json';
// The page's own sample pack, for when there is no library (GitHub Pages)
// or an empty one - see boot().
const SAMPLES_INDEX_URL = 'samples/index.json';

// Written by the server's background feature-builder pass: display copies
// plus tone stats and a perceptual hash. Entirely optional - every feature it powers is skipped if the
// fetch fails, and the board behaves exactly as it did before it existed.
const FEATURES_URL = 'features.json';
const STORE_KEY = 'refboard.settings.v1';
const UI_KEY = 'refboard.ui.v1'; // which side panels are folded - this browser only

/* 0 is "no timer": a session that runs on Next instead of a clock. Not the
   same thing as pausing (which stops a session you meant to be timed) and not
   the same thing as the browse viewer (which walks a folder in order) - this
   is a real random draw from the pool with no time pressure on any one pose,
   which is how a long study or a colour study is actually worked.

   Zero rather than null/Infinity because it flows through every existing
   consumer unchanged: currentInterval() returns it, resetClock() stores it,
   and paint()/onTick() each need one falsy check to mean "no clock". */
const PRESETS = [0, 30, 60, 120, 300, 600];

// Standard figure-drawing class shapes. "endless" is the default because a pose
// pack is not a class - most sessions are one interval until you stop.
// `custom`'s steps start null like Endless's and are populated at runtime by
// syncCustomSchedule() from the builder rows under the Custom chip - see the
// HTML comment on #customSchedule. A plain property on this const object,
// not a separate variable: every consumer (startSession(), hintSchedule())
// already just reads `SCHEDULES[key].steps` and needs no special case added
// for where those steps came from.
const SCHEDULES = {
  endless: { label: 'Endless',   steps: null },
  warmup:  { label: 'Warm-up',   steps: [[30,10],[60,5],[120,3],[300,2]] },
  quick:   { label: 'Quick 20',  steps: [[30,20]] },
  long:    { label: 'Long study',steps: [[300,4],[600,2]] },
  // Composition, not figure: a few minutes a picture, drawn small.
  thumbs:  { label: 'Thumbnails', steps: [[90,8]],
             hint: 'Postage-stamp composition sketches: draw a small box first, then only the big shapes in two or three values - the picture, not the pose.' },
  custom:  { label: 'Custom',    steps: null },
};

// Tone filters. Cut points are computed from the actual distribution at load
// rather than hardcoded, so each selects roughly a third of whatever packs are
// present instead of encoding one library's histogram forever.
const TONES = {
  contrast: { label: 'High contrast', hint: 'Widest value range — for value studies.' },
  lowkey:   { label: 'Low key',       hint: 'Darkest third: dramatic, low-light lighting.' },
  highkey:  { label: 'High key',      hint: 'Lightest third: flat, bright, high-key lighting.' },
};

// Posterizes the reference itself to N flat tones - a classic value-study
// step (see any "block in the shapes first" exercise), distinct from TONES
// above: that picks WHICH images are in the pool by their measured
// lightness/contrast, this changes HOW the one on screen right now renders.
// 2 is a Notan (light-mass/dark-mass) study; higher counts read as a
// posterize effect rather than a value study, which is why the set stops at
// 6 - past that the point of collapsing shades starts disappearing.
const VALUE_STEPS = [2, 3, 4, 5, 6];

// Every non-edge scheme is the same mechanism - luminance, then snapped to N
// steps sampled along a gradient - so the schemes differ only in which
// gradient. "stops" is an ordered list of [r,g,b] triples sampled by
// sampleGradient() below; two stops is a plain duotone, more than two is a
// real multi-hue ramp. Named after traditional monochrome-underpainting
// pigments (grisaille) rather than invented names, since that is what an
// artist reaches for this to approximate. "edges" has no stops at all - it
// is a genuinely different filter chain, built by appendEdgeStages().
const PAPER = [245, 239, 226]; // warm off-white "paper", not pure #fff
const VALUE_SCHEMES = {
  gray:    { label: 'Grayscale',      stops: [[0, 0, 0], PAPER] },
  vandyke: { label: 'Van Dyke Brown', stops: [[58, 42, 30], PAPER] },
  payne:   { label: "Payne's Gray",   stops: [[58, 69, 80], PAPER] },
  sepia:   { label: 'Sepia',          stops: [[74, 55, 40], PAPER] },
  umber:   { label: 'Burnt Umber',    stops: [[61, 43, 31], PAPER] },
  heatmap: {
    label: 'Heatmap',
    stops: [[8, 8, 64], [0, 128, 200], [0, 190, 120], [230, 210, 40], [230, 90, 20], [250, 250, 230]],
  },
  edges: { label: 'Outlines', stops: null },
};

// stdDeviation for the optional feGaussianBlur stage - see buildValueFilter().
// Softens texture and small-scale noise so the big value masses read clearly
// on their own, the same reason a value-study thumbnail is squinted at
// through half-closed eyes rather than examined at full detail.
const BLUR_LEVELS = { off: 0, soft: 1.5, medium: 3, strong: 6 };

let INDEX = null;
let FEATURES = null;     // null whenever features.json is missing or unreadable
let TONE_CUTS = null;

/* The speculative choice preloadNext() already made for whatever nextUnit()
   returns next, so advance() can reuse it instead of re-rolling - see
   pickFrame() and preloadNext() below for why the two must agree. Identity
   ('unit' is the exact pool entry, not a copy) is what lets advance() tell
   "this is the unit I preloaded for" from "the draw order changed under me
   (toggleSimilar) since I preloaded" without extra bookkeeping. */
let pendingPick = null;

/* ---------------------------------------------------------------- skipped
   A bad reference - cropped oddly, wrong pack, a scan artifact - has had no
   way to leave the pool short of unchecking the whole pack it came from. This
   is a permanent per-image exclusion, keyed by src, separate from `settings`
   deliberately: settings sync is LAST-WRITE-WINS ON THE WHOLE DOCUMENT (see
   syncSettings above) because a session design is one coherent choice - but a
   skip is a fact about one image, and two devices skipping different images
   between syncs must not have one skip clobber the other. Same shape as
   /videos/'s watchedDoc: a tombstoned {on, t} per key so an UN-skip merges
   correctly too, not just an addition. */
let skipped = {};        // src -> { on: bool, t: unix }
const SKIPPED_KEY = 'refboard.skipped.v1';
const isSkipped = src => !!(skipped[src] && skipped[src].on);

function loadSkipped() {
  try { return JSON.parse(localStorage.getItem(SKIPPED_KEY)) || {}; }
  catch { return {}; }
}
function saveSkipped(share = true) {
  try { localStorage.setItem(SKIPPED_KEY, JSON.stringify(skipped)); } catch { /* private mode */ }
  if (share && window.FleetState) FleetState.push('refboard-skipped');
}
function setSkipped(src, on) {
  if (!src) return;
  skipped[src] = { on, t: Math.floor(Date.now() / 1000) };
  saveSkipped();
}
function skippedCount() {
  return Object.values(skipped).filter(v => v && v.on).length;
}

// Rendered on the setup screen only - by the time a session is running the
// count cannot change except by skipCurrent(), which does not need to be told
// what it just did.
function renderSkipInfo() {
  const host = el('skipInfo');
  const n = skippedCount();
  if (!n) { host.textContent = ''; return; }
  host.innerHTML = `${n.toLocaleString()} pose${n === 1 ? '' : 's'} skipped ` +
    `<button type="button" id="btnClearSkip" style="margin-left:6px;padding:2px 8px;font-size:11px">Clear</button>`;
  el('btnClearSkip').addEventListener('click', () => {
    skipped = {};
    saveSkipped();
    renderSkipInfo();
    refreshPool();
  });
}
function syncSkipped() {
  if (!window.FleetState) return Promise.resolve();
  return FleetState.sync('refboard-skipped', {
    read: () => ({ v: 1, items: skipped }),
    write: (doc) => { skipped = (doc && doc.items) || {}; saveSkipped(false); },
    merge: (mine, theirs) => {
      const a = (mine && mine.items) || {}, b = (theirs && theirs.items) || {};
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const x = a[k], y = b[k];
        out[k] = (!x) ? y : (!y) ? x : ((y.t || 0) > (x.t || 0) ? y : x);
      }
      return { v: 1, items: out };
    },
  });
}

/* --------------------------------------------------------- session log
   Nothing on this board recorded that a session had ever happened - settings
   sync says how it is CONFIGURED right now, which is a different question
   from whether it was used. Log entries are immutable facts once written
   (a session that happened did happen), so unlike settings (whole-document,
   last write wins) and skipped (a tombstone per key), this merges as a UNION
   keyed by session id - closer to how whatsnew.py's own event log is never
   edited, only appended to and capped. */
let sessions = [];       // newest first: { id, start, end, poses, packs, secs }
const SESSIONS_KEY = 'refboard.sessions.v1';
const SESSION_CAP = 50;  // enough for months of practice without an unbounded doc

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || []; }
  catch { return []; }
}
function saveSessions(share = true) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch { /* private mode */ }
  if (share && window.FleetState) FleetState.push('refboard-sessions');
}

// Called once from stopSession(), never from a scripted change - a session
// that never drew a pose (the pool came up empty, or stop was pressed before
// the first advance() landed) is not a session, and logging it would turn
// "12 sessions" into a count of how many times the button was pressed.
function logSession(start, end, poses, packs, secs) {
  if (!(poses > 0)) return;
  const id = start + '-' + Math.random().toString(36).slice(2, 8);
  sessions.unshift({ id, start, end, poses, packs, secs });
  if (sessions.length > SESSION_CAP) sessions.length = SESSION_CAP;
  saveSessions();
  renderSessionLog();
}

function mergeSessions(mine, theirs) {
  if (!theirs || !Array.isArray(theirs.sessions)) return mine;
  // A session id only ever comes from the device that logged it, so a
  // collision means the same entry seen from both sides - keep either.
  const byId = new Map();
  for (const s of (mine && mine.sessions) || []) byId.set(s.id, s);
  for (const s of theirs.sessions) if (!byId.has(s.id)) byId.set(s.id, s);
  return { v: 1, sessions: [...byId.values()].sort((a, b) => b.start - a.start).slice(0, SESSION_CAP) };
}
function syncSessions() {
  if (!window.FleetState) return Promise.resolve();
  return FleetState.sync('refboard-sessions', {
    read: () => ({ v: 1, sessions }),
    write: (doc) => {
      sessions = ((doc && doc.sessions) || []).slice(0, SESSION_CAP);
      saveSessions(false);
      renderSessionLog();
    },
    merge: mergeSessions,
  });
}

function relTime(ts) {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 90) return 'just now';
  if (secs < 5400) return Math.round(secs / 60) + ' min ago';
  if (secs < 172800) return Math.round(secs / 3600) + ' h ago';
  return Math.round(secs / 86400) + ' d ago';
}

/* Local calendar days, not UTC. "Did I draw today" is a question about the
   clock on the wall, and a UTC key would move the boundary by hours - far
   enough to break a streak for someone who draws in the evening. */
function dayKey(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/* poses per calendar day, keyed by dayKey. */
function posesByDay() {
  const by = new Map();
  for (const s of sessions) {
    const k = dayKey(new Date(s.start * 1000));
    by.set(k, (by.get(k) || 0) + (s.poses || 0));
  }
  return by;
}

/* Consecutive days drawn, counting back from today.
   A day with no session yet does not end the streak if it is TODAY: the day
   is not over, and a counter that reads 0 every morning until you sit down
   measures the time of day rather than the habit. Any earlier gap does. */
function currentStreak(by) {
  const d = new Date();
  if (!by.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (by.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* Coarse on purpose - this is a total across sessions, not a stopwatch, and
   "4h 12m" is the useful precision for it.

   NaN-hardened at the bottom rather than at each call site: an entry merged
   from another device (or written by a version that had no `end`) yields
   end - start === NaN, and a run that renders as "NaNm" is a worse answer to
   "how long was that" than one that renders as "<1m". */
function fmtSpan(secs) {
  secs = Math.max(0, Math.round(secs) || 0);
  const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return secs < 60 ? '<1m' : `${m}m`;
}

const CAL_WEEKS = 13;

/* Thirteen weeks of day cells, oldest week first, Monday at the top.
   Emitted as one flat list in date order because the grid is column-first
   with seven rows - see .cal in the stylesheet. */
function renderCalendar(by) {
  const host = el('practiceCal');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Monday of the current week, then back to the start of the window.
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (CAL_WEEKS - 1) * 7);
  const max = Math.max(1, ...by.values());

  // One label per week column, drawn only where the month turns over - the
  // calendar is otherwise thirteen unlabelled columns and the reader has to
  // hover a square to find out where in the year they are.
  const months = document.createDocumentFragment();
  let lastMonth = -1;
  for (let w = 0; w < CAL_WEEKS; w++) {
    // Named for the month the week ENDS in, not the one it starts in: a week
    // that runs 31 Aug - 6 Sep is the first week of September, and keying off
    // its Monday would leave the current month unlabelled all week.
    const sunday = new Date(start);
    sunday.setDate(sunday.getDate() + w * 7 + 6);
    const label = document.createElement('span');
    if (sunday.getMonth() !== lastMonth) {
      lastMonth = sunday.getMonth();
      // Suppressed on the first column unless the month really does begin
      // inside it - otherwise the leftmost label names a month whose earlier
      // weeks are not on screen.
      if (w > 0 || sunday.getDate() <= 7) {
        label.textContent = sunday.toLocaleDateString(undefined, { month: 'short' });
      }
    }
    months.appendChild(label);
  }
  el('practiceCalMonths').innerHTML = '';
  el('practiceCalMonths').appendChild(months);

  const frag = document.createDocumentFragment();
  const d = new Date(start);
  let drawnDays = 0;
  for (let i = 0; i < CAL_WEEKS * 7; i++) {
    const cell = document.createElement('i');
    const poses = by.get(dayKey(d)) || 0;
    const when = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    if (d > today) {
      cell.className = 'future';
    } else {
      // Against the busiest day rather than a fixed pose count: a warm-up
      // habit of twelve gestures a day and a two-hour study habit should
      // both read as a filled calendar.
      const r = poses / max;
      cell.className = poses ? (r >= .75 ? 'l4' : r >= .5 ? 'l3' : r >= .25 ? 'l2' : 'l1') : '';
      cell.title = poses ? `${poses.toLocaleString()} pose${poses === 1 ? '' : 's'} on ${when}` : `nothing on ${when}`;
      if (poses) drawnDays++;
    }
    frag.appendChild(cell);
    d.setDate(d.getDate() + 1);
  }
  host.innerHTML = '';
  host.appendChild(frag);
  el('practiceCalHint').textContent =
    `${drawnDays} day${drawnDays === 1 ? '' : 's'} drawn in the last ${CAL_WEEKS} weeks · ` +
    // Said out loud because the window is longer than the store: with the cap
    // reached, the empty left-hand columns mean "not kept", not "not drawn".
    `only the most recent ${SESSION_CAP} sessions are kept`;
}

function renderRuns() {
  const host = el('practiceRuns');
  const frag = document.createDocumentFragment();
  for (const s of sessions.slice(0, 8)) {
    const row = document.createElement('div');
    row.className = 'run';
    const when = new Date(s.start * 1000);
    const packs = (s.packs || []).join(', ') || 'Unknown';
    row.innerHTML =
      `<span class="when">${esc(when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))}, ` +
      `${esc(when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))}</span>` +
      `<span class="what">${esc(packs)}</span>` +
      `<span class="num">${(s.poses || 0).toLocaleString()} pose${s.poses === 1 ? '' : 's'}` +
      // The interval a session ran at is the difference between a gesture
      // drill and a long study, and the pose count alone hides it.
      `${s.secs ? ' · ' + fmt(s.secs) : ''} · ${fmtSpan(s.end - s.start)}</span>`;
    frag.appendChild(row);
  }
  host.innerHTML = '';
  host.appendChild(frag);
}

// Quiet until there is something to say - see the panel's own comment in the
// markup for why an empty one is worse than none.
function renderSessionLog() {
  const host = el('practice');
  if (!host) return;
  host.classList.toggle('hidden', !sessions.length);
  if (!sessions.length) return;

  const poses = sessions.reduce((a, s) => a + (s.poses || 0), 0);
  const secs = sessions.reduce((a, s) => a + Math.max(0, (s.end || s.start) - s.start), 0);
  const by = posesByDay();
  const streak = currentStreak(by);
  const stats = [
    [poses.toLocaleString(), 'Poses drawn'],
    [fmtSpan(secs), 'Time drawn'],
    [sessions.length.toLocaleString(), 'Sessions'],
    // With no streak running, the useful fact in this slot is when you last
    // sat down - an em-dash would just be a smaller way of saying zero.
    streak
      ? [`${streak} day${streak === 1 ? '' : 's'}`, 'Current streak']
      : [relTime(sessions[0].start), 'Last drawn'],
  ];
  el('practiceStats').innerHTML = stats
    .map(([v, k]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');
  renderCalendar(by);
  renderRuns();
}
const state = {
  pool: [], order: [], cursor: 0, history: [], histPos: -1,
  schedule: null, step: 0, doneInStep: 0,
  secs: 30, remain: 30, paused: false, tick: null, drawn: 0,
  wakeLock: null, audio: null, errors: 0,
  tone: null, current: null, similarTo: null,
  valueSteps: 0,   // 0 == off; otherwise one of VALUE_STEPS
  zoom: 1, panX: 0, panY: 0,   // see applyZoom() - reset on every new pose
  angleMode: false,           // see toggleAngleMode()
  angleRef: null,             // {x1,y1,x2,y2,length} - see toggleAngleMode()
  angleLines: [],             // comparison lines after the reference - see commitAngleLine()
  eyedropperMode: false,      // see toggleEyedropper()
  valueScheme: 'gray',        // key into VALUE_SCHEMES
  valueBlur: 0,               // a value from BLUR_LEVELS
  highContrast: false,        // see applyOptions() and the 'h' key
  gridStyle: 'thirds',        // key into GRID_STYLES - see drawGrid()
  constructMode: 'off',       // 'off'|'vp'|'plumb'|'divider' - see setConstructMode()
  vp: null,                   // {x,y} - vanishing point, construct mode 'vp'
  frame: null,                // {x1,y1,x2,y2} - viewfinder, construct mode 'frame'
  persp: null,                // [{x,y}...] - perspective check, construct mode 'persp'
  plumb: null,                // {x,y} - construct mode 'plumb'
  divider: null,              // {x1,y1,x2,y2} unit vector - construct mode 'divider'
  ghostSrc: null,             // previous pose's src, for #ghostImg - see show()
  focalFrac: null,            // {x,y} 0..1 - see refreshValueTools(), positionFocalMarker()
  hudIdleTimer: null,
  // Memory drawing - null (off, or a pose revisited with Previous), 'study',
  // 'draw' or 'reveal'. See beginMemoryStudy().
  memPhase: null,
  poseOn: false,              // pose skeleton shown - see togglePose()
  headOn: false,              // Loomis head shown - see toggleHead()
  edgesOn: false,             // edge map shown - see toggleEdges()
  // Build-up stages - an index into MASTER_STAGES, or null. See setStage().
  stage: null,
  // Browse mode - the stage opened on a grid cell rather than on a session.
  // Sequential instead of shuffled, no clock, no schedule, not logged. See
  // openViewer() and browseStep().
  browse: false,
  // Set at startSession(), read and cleared at stopSession() - see logSession.
  startedAt: null, startPacks: [],
};

/* ---------------------------------------------------------------- settings */

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
/* Set while applyPackHash() drives the checkboxes through their own change
   handlers. Those handlers save, and a #pack= link is explicitly not allowed to
   overwrite a selection the reader built by hand - see applyPackHash. Suppressed
   here rather than by unbinding the handlers, because sync() and refreshPool()
   in the same handlers DO need to run. */
let SUPPRESS_SAVE = false;

function saveSettings() {
  if (SUPPRESS_SAVE) return;
  const s = {
    packs: [...document.querySelectorAll('.grp:checked')].map(c => c.value),
    // Every group that existed when this was saved. Without it, a pack added
    // later is absent from `packs` for two different reasons - "you turned it
    // off" and "it did not exist yet" - and the picker cannot tell them apart,
    // so a new pack silently arrives switched off.
    known: [...document.querySelectorAll('.grp')].map(c => c.value),
    interval: state.secs,
    schedule: document.querySelector('#schedules .chip[aria-pressed="true"]')?.dataset.key,
    customSchedule: SCHEDULES.custom.steps || [],
    tone: state.tone,
    dedup: el('optDedup').checked,
    valueSteps: state.valueSteps,
    valueScheme: state.valueScheme,
    valueBlur: state.valueBlur,
    gray: el('optGray').checked, flipRandom: el('optFlipRandom').checked,
    grid: el('optGrid').checked, bell: el('optBell').checked, full: el('optFull').checked,
    highContrast: el('optHighContrast').checked,
    gridStyle: el('gridStyle').value,
    gridOrder,
    ghost: el('optGhost').checked, focalPoint: el('optFocalPoint').checked,
    memory: el('optMemory').checked, memorySecs: Number(el('memorySecs').value),
    stages: el('optStages').checked,
    // When this setup was last changed, so the merge in syncSettings() can tell
    // two devices' panels apart - see syncSettings() for why this is a
    // whole-document last-write-wins merge rather than a field-by-field one.
    t: Math.floor(Date.now() / 1000),
  };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
  if (window.FleetState) FleetState.push('refboard');
}
