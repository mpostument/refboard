/* refboard - Sharing the setup, the setup screen, the library browser, the shell (rail and views).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ------------------------------------------------------ sharing the setup
   The board's setup is twelve controls, and rebuilding it by hand on the
   tablet was enough work that the tablet mostly got whatever the defaults
   were.

   LAST WRITE WINS, ON THE WHOLE DOCUMENT, and that is the point of difference
   from every other synced key here. The others merge field by field because
   their fields are independent facts - a course you finished, a class you
   watched. These are not facts, they are one coherent choice: pack selection
   plus interval plus schedule plus tone filter is a session design, and a
   field-wise merge of two designs produces a third that neither device chose
   and nobody asked for. Taking the newer panel whole is the only answer that
   leaves you with a setup someone actually built.

   WHAT IT DOES NOT DO IS REDRAW A PANEL YOU ARE LOOKING AT. write() persists
   and stops there. During boot that is invisible, because this runs before the
   settings are read; afterwards it means a conflict resolved on another device
   lands on the next load rather than moving checkboxes under the cursor. A
   drawing session whose interval changed mid-pose because the phone saved is a
   worse bug than a one-load delay. */
function syncSettings() {
  if (!window.FleetState) return Promise.resolve();
  return FleetState.sync('refboard', {
    read: () => loadSettings(),
    write: (v) => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* private mode */ }
    },
    merge: (mine, theirs) => {
      if (!theirs || typeof theirs !== 'object') return mine;
      if (!mine || typeof mine !== 'object') return theirs;
      return (theirs.t || 0) > (mine.t || 0) ? theirs : mine;
    },
  });
}

const el = id => document.getElementById(id);

/* ---------------------------------------------------------------- setup UI */

/* Footer version. Starts from the hard-coded fallback (the only thing
   GitHub Pages, with no backend at all, can ever show), then tries to
   replace it with the real running container's own version. Fire-and-forget
   - a slow or failed /healthz should never delay or block the rest of
   boot(), it just leaves the fallback showing. */
function updateFooterVersion() {
  el('appVersion').textContent = 'v' + APP_VERSION;
  // The same question the store asks - see backendInfo in js/store.js.
  backendInfo.then(data => { if (data && data.version) el('appVersion').textContent = 'v' + data.version; });
}

/* A tab left open for days - a tablet by the easel - never sees a deploy.
   When it comes back into view, fetch index.html afresh and compare the
   ?v= stamps of its scripts and stylesheet (scripts/stamp-assets.js) with
   the ones this page was loaded with: any difference means new code. Works
   the same on GitHub Pages and behind a container, since it needs nothing
   but the page itself. At most every ten minutes, and never on file://. */
const UPDATE_CHECK_MS = 10 * 60 * 1000;
let lastUpdateCheck = Date.now();
const assetStamps = text => [...new Set([...text.matchAll(/(?:js|css)\/[^"?]+\?v=[0-9a-f]+/g)].map(m => m[0]))].sort().join(' ');
// Read in initUpdateCheck(), not here: while this file runs, the parser
// has not reached the script tags after it yet.
let loadedStamps = '';

async function checkForUpdate() {
  if (location.protocol === 'file:' || !loadedStamps || Date.now() - lastUpdateCheck < UPDATE_CHECK_MS) return;
  lastUpdateCheck = Date.now();
  try {
    const res = await fetch('index.html', { cache: 'no-store' });
    if (!res.ok) return;
    const latest = assetStamps(await res.text());
    if (latest && latest !== loadedStamps) el('updateReady').classList.remove('hidden');
  } catch { /* offline - the next visit will ask again */ }
}

function initUpdateCheck() {
  // The page as served, so the lazy sections' scripts count too: their tags
  // are inside <template>s, where querySelectorAll does not look.
  loadedStamps = assetStamps(document.documentElement.outerHTML);
  el('updateReady').addEventListener('click', () => location.reload());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

/* The theme menu: each theme as a strip of its own colours and its name.
   Picking one applies it at once and keeps it (setTheme(), js/theme.js). */
function initThemeMenu() {
  const btn = el('btnTheme'), menu = el('themeMenu');
  const render = () => {
    const now = themeId();
    // Labels escaped: your own themes' names can come from an imported file.
    menu.innerHTML = Object.entries(allThemes()).map(([id, t]) => {
      const c = themeColours(t);
      return `<button type="button" role="menuitemradio" aria-checked="${id === now}" data-theme="${id}">` +
        `<span class="theme-strip">${[c.bg, c.panel, c['panel-2'], c.accent, c.ink].map(x => `<i style="background:${x}"></i>`).join('')}</span>` +
        `${esc(t.label)}</button>`;
    }).join('') + '<button type="button" role="menuitem" class="theme-edit" data-theme-edit>Edit colours...</button>';
  };
  const open = show => {
    menu.classList.toggle('hidden', !show);
    btn.setAttribute('aria-expanded', String(show));
    if (show) { render(); menu.querySelector('[aria-checked="true"]').focus(); }
  };
  btn.addEventListener('click', e => { e.stopPropagation(); open(menu.classList.contains('hidden')); });
  menu.addEventListener('click', e => {
    if (e.target.closest('[data-theme-edit]')) { open(false); openThemeEditor(); return; }
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    setTheme(b.dataset.theme);
    render();
    menu.querySelector(`[data-theme="${b.dataset.theme}"]`).focus();
  });
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.stopPropagation(); open(false); btn.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  });
  // composedPath(), not menu.contains(e.target): a pick redraws the menu,
  // so by the time the click reaches here its button is no longer in it.
  // The menu stays open after a pick, to try one theme after another.
  document.addEventListener('click', e => {
    if (!menu.classList.contains('hidden') && !e.composedPath().includes(menu)) open(false);
  });
}

async function boot() {
  updateFooterVersion();
  initUpdateCheck();
  initThemeMenu();

  // No library is a real, expected state here - not just "the fetch failed
  // once" - it's the whole of what this page is on GitHub Pages, which has
  // no server behind it to ever produce an index.json at all. So this is not
  // treated as an error: Packs/Tone have nothing to show and stay hidden,
  // and the "Start drawing" bar goes with them, but Interval, Session,
  // Options, and both drop-zone modes all work exactly the same with no
  // backend whatsoever.
  //
  // Except that nothing to draw from is a poor first visit, so where there is
  // no library - or an empty one, a container with nothing mounted yet - the
  // page's own sample pack stands in for it (samples/, generated
  // by scripts/samples): a few simple heads to practise on, browsed and drawn
  // from like any pack.
  let indexOk = false, samples = false;
  try {
    const res = await fetch(INDEX_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    INDEX = await res.json();
    indexOk = true;
    el('btnRescan').classList.remove('hidden');
  } catch { /* none: the samples, below */ }
  if (!indexOk || !INDEX.totalImages) {
    try {
      const res = await fetch(SAMPLES_INDEX_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      INDEX = await res.json();
      indexOk = samples = true;
    } catch { indexOk = false; }
  }
  if (!indexOk) {
    el('packsSection').classList.add('hidden');
    el('startbar').classList.add('hidden');
    // Nothing to browse and no pool to start one from, so the whole middle
    // column collapses to the dashboard and its drop zone - which is exactly
    // what this page is on GitHub Pages.
    document.querySelector('.nav-item[data-view="all"]').classList.add('hidden');
    el('inspector').querySelector('#poolCount').classList.add('hidden');
    el('poolInfo').textContent = '';
  }

  // Optional, and deliberately not fatal. A features run that has not happened,
  // has been budgeted out part-way, or failed entirely must leave a working board
  // rather than an error page - so anything past this point is guarded on
  // FEATURES being non-null.
  if (indexOk && !samples) {
    try {
      const fres = await fetch(FEATURES_URL, { cache: 'no-store' });
      if (fres.ok) {
        const f = await fres.json();
        if (f && f.images && Object.keys(f.images).length) FEATURES = f;
      }
    } catch { /* no features: originals and no filters, exactly as before */ }
  }

  // Awaited rather than left to a race. /state.js is deferred, so it has not
  // necessarily run when the last line of this script calls boot() - by here it
  // has, two fetches later, but the settings the panel is about to be drawn
  // from are exactly the thing that must not depend on that being true. Resolves
  // immediately when the client is absent or the service is down, and the panel
  // is then drawn from localStorage exactly as it always was.
  skipped = loadSkipped();
  sessions = loadSessions();
  await Promise.all([syncSettings(), syncSkipped(), syncSessions()]);

  const saved = loadSettings();
  if (samples) {
    el('summary').textContent =
      `No library connected yet, so here is a sample pack: ${INDEX.totalImages} anime girls in ` +
      'watercolour to practise on. Drop your own pictures below, or run this behind a container ' +
      'with your library mounted (see the project README).';
  } else if (indexOk) {
    const gb = (INDEX.totalBytes / 1073741824).toFixed(1);
    el('summary').textContent =
      `${INDEX.totalImages.toLocaleString()} images · ${INDEX.packs.length} packs · ${gb} GB · ` +
      `indexed ${new Date(INDEX.generated * 1000).toLocaleDateString()}` +
      (FEATURES ? ` · ${FEATURES.featured.toLocaleString()} with display copies` : '');
  } else {
    el('summary').textContent =
      'No image library connected - drop your own images below, or run this ' +
      'behind a container with your library mounted (see the project README).';
  }
  renderSessionLog();

  if (indexOk && FEATURES) {
    TONE_CUTS = computeToneCuts();
    el('toneSection').classList.remove('hidden');
    if (FEATURES.dupImages) el('optDedupWrap').classList.remove('hidden');
    renderTones(saved);
  }

  if (indexOk) {
    renderPacks(saved);
    // After renderPacks, because it overrides what that just drew from settings,
    // and before renderIntervals, because it may edit saved.interval for that
    // call to draw from too.
    applyPackHash(saved);
  }
  renderIntervals(saved);
  renderSchedules(saved);
  renderSkipInfo();
  renderValueSelect(el('valueSelect'), 'Value: ');
  renderValueTools(saved);
  renderValueSteps(saved);
  initDropZone();
  renderUploads();
  initEyedropper();
  initShell(saved);
  // Last, so the tree it highlights and the grid it may draw both exist. The
  // dashboard is the landing view either way: with no library there is
  // nothing else to show, and with one, "what did I draw last, and what is
  // in here" is the question you arrive with.
  setView({ kind: 'dashboard' });
  // A 3D-forms share link opens that view, which reads the scene out of it.
  if (/^#forms=/.test(location.hash)) setView({ kind: 'forms' });
  el('valueSelect').addEventListener('change', e => {
    selectValueSteps(Number(e.target.value));
    applyOptions();
    saveSettings();
  });

  for (const [id, key] of [['optGray','gray'],['optFlipRandom','flipRandom'],
                           ['optGrid','grid'],['optBell','bell'],['optFull','full'],
                           ['optHighContrast','highContrast'],['optGhost','ghost'],
                           ['optFocalPoint','focalPoint'],['optDedup','dedup'],
                           ['optMemory','memory'],['optStages','stages']]) {
    if (saved[key] !== undefined) el(id).checked = saved[key];
    el(id).addEventListener('change', saveSettings);
  }
  // Dedup changes how many poses are in the pool, so it has to repaint the count.
  el('optDedup').addEventListener('change', refreshPool);

  // Not a checkbox, so it sits outside the loop above - same restore-then-
  // persist idea, just a select's .value instead of a checkbox's .checked.
  // Memory and stages both decide what the pose looks like while you draw -
  // hidden, or built up - so only one of them at a time.
  el('optMemory').addEventListener('change', () => { if (el('optMemory').checked) { el('optStages').checked = false; saveSettings(); } });
  el('optStages').addEventListener('change', () => { if (el('optStages').checked) { el('optMemory').checked = false; saveSettings(); } });
  if (el('optMemory').checked && el('optStages').checked) el('optStages').checked = false;
  if (saved.memorySecs) el('memorySecs').value = String(saved.memorySecs);
  el('memorySecs').addEventListener('change', saveSettings);
  el('gridStyle').value = saved.gridStyle || 'thirds';
  const showGridNote = () => { el('gridStyleNote').textContent = GRID_NOTES[el('gridStyle').value] || ''; };
  showGridNote();
  el('gridStyle').addEventListener('change', () => {
    state.gridStyle = el('gridStyle').value;
    showGridNote();
    saveSettings();
    if (el('optGrid').checked) drawGrid();
  });

  // The wrapper, not startSession itself, as the listener: addEventListener
  // hands a click Event as the first argument, and startSession(pool) reads
  // its first argument as an ad hoc pool - passing the raw function would
  // make every ordinary "Start drawing" click try to draw from a MouseEvent.
  el('start').addEventListener('click', () => startSession());
  el('copyLink').addEventListener('click', () => {
    const name = selectedPackName();
    if (!name) return;
    const hash = '#pack=' + encodeURIComponent(name) + '&secs=' + state.secs;
    copyLinkText(location.origin + location.pathname + hash, el('copyLink'));
  });
  // Relative, like every other fetch on this page - resolves under whatever
  // prefix the page itself is served from, container root or nginx's
  // /refboard/ alike, without needing to know which.
  el('btnRescan').addEventListener('click', () => {
    const btn = el('btnRescan');
    const label = btn.textContent;
    btn.disabled = true;
    fetch('api/reindex', { method: 'POST' })
      .then(r => { btn.textContent = r.ok ? 'Rescan requested' : 'Could not start rescan'; })
      .catch(() => { btn.textContent = 'Could not reach the server'; })
      .finally(() => setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2500));
  });
  if (indexOk) refreshPool();
}

/* navigator.clipboard is undefined on a plain-http origin, which is exactly
   what this page is served over - hence the textarea fallback, which works
   everywhere. Reports the outcome on the button itself rather than a toast:
   one button, one thing that can happen to it. */
function copyLinkText(txt, btn) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt); ok = true; }
  } catch (e) { /* fall through to the textarea */ }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, txt.length);
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }
  const label = btn.textContent;
  btn.textContent = ok ? 'Copied!' : 'Could not copy';
  setTimeout(() => { btn.textContent = label; }, 1400);
}

/* Thirds of the observed distribution. Measured over the live packs, lightness
   runs 0.366-0.946 and contrast 0.092-0.407 - both wide enough to partition.
   Saturation and hue were measured too and dropped: the warm fraction had a
   median of 1.000 and a p10 of 0.929 across 200 images, because these are skin
   tones on neutral backdrops. There is no colour axis here to filter on. */
function computeToneCuts() {
  const vs = [], cs = [];
  for (const k in FEATURES.images) {
    const f = FEATURES.images[k];
    if (typeof f.v === 'number') vs.push(f.v);
    if (typeof f.c === 'number') cs.push(f.c);
  }
  vs.sort((a, b) => a - b); cs.sort((a, b) => a - b);
  const q = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null;
  return { vLow: q(vs, 1 / 3), vHigh: q(vs, 2 / 3), cHigh: q(cs, 2 / 3) };
}

function renderTones(saved) {
  const host = el('tones');
  host.innerHTML = '';
  // A stored tone that no longer exists would throw on the hint lookup below and
  // take the whole page down. Filters get removed - the colour ones already were -
  // so treat an unknown value as "no filter" rather than trusting localStorage.
  state.tone = (saved.tone && TONES[saved.tone]) ? saved.tone : null;

  const entries = [['', { label: 'Any', hint: 'No tone filter.' }], ...Object.entries(TONES)];
  for (const [key, t] of entries) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.key = key; b.textContent = t.label;
    b.setAttribute('aria-pressed', String((key || null) === state.tone));
    b.addEventListener('click', () => {
      state.tone = key || null;
      [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      el('toneHint').textContent = t.hint;
      refreshPool(); saveSettings();
    });
    host.appendChild(b);
  }
  el('toneHint').textContent =
    (state.tone ? TONES[state.tone].hint : entries[0][1].hint);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const LUMA = '0.2126 0.7152 0.0722 0 0  '; // Rec. 709 - the same weights every "convert to grayscale" tool uses

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Piecewise-linear sample across an ordered list of [r,g,b] stops at t in
// 0..1 - a plain 2-stop list is a duotone, more stops is a real multi-hue
// ramp, and both are the same code path.
function sampleGradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const pos = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const frac = pos - i;
  const a = stops[i], b = stops[i + 1];
  return [0, 1, 2].map(c => a[c] + (b[c] - a[c]) * frac);
}

/* Edge detection - a genuinely different filter chain from the tone-scheme
   one below, not a variant of it: there is no meaningful "N levels" for a
   line drawing, so state.valueSteps only gates whether this is showing at
   all here, not how many bands - see valueStepsHint().

   The standard SVG edge-detect recipe: a Laplacian kernel (sums to zero
   over a flat area) with bias=0.5, so a flat area lands on mid-gray instead
   of clipping to black, and an edge pushes away from that gray in whichever
   direction its gradient runs - lighter on one side, darker on the other,
   both readable as "something changes here" rather than one direction being
   lost to clipping the way an unbiased convolution would lose it. */
function appendEdgeStages(filter) {
  const gray = document.createElementNS(SVG_NS, 'feColorMatrix');
  gray.setAttribute('type', 'matrix');
  gray.setAttribute('values', LUMA + LUMA + LUMA + '0 0 0 1 0');
  filter.appendChild(gray);

  const conv = document.createElementNS(SVG_NS, 'feConvolveMatrix');
  conv.setAttribute('order', '3');
  conv.setAttribute('kernelMatrix', '-1 -1 -1 -1 8 -1 -1 -1 -1');
  conv.setAttribute('divisor', '1');
  conv.setAttribute('bias', '0.5');
  conv.setAttribute('preserveAlpha', 'true');
  filter.appendChild(conv);
}

/* The one SVG <filter> the tonal-value view uses, rebuilt in place whenever
   levels, colour scheme or blur change, rather than kept as one precomputed
   filter per level the way an earlier version of this did: the combination
   of level count x colour scheme x blur amount is too large to usefully
   precompute, and rebuilding a handful of DOM nodes on a settings change
   nobody makes more than a few times a minute is not a cost worth avoiding.

   Implicit primitive chaining throughout - no in="..."/result="..." on any
   stage - each one simply consumes whichever came before it (or
   SourceGraphic, for whichever stage ends up first once blur is skipped
   entirely at blur=0 rather than merely set to stdDeviation="0").

   Gray/duotone/heatmap are the SAME mechanism with a different gradient:
   feColorMatrix collapses to luminance, feComponentTransfer's discrete type
   snaps that to N steps, and the per-channel tables are sampled from
   whichever scheme's stops are active - not three separate filters for
   three separate looks. Edges is the one genuine exception - see
   appendEdgeStages() above. */
function buildValueFilter() {
  const defs = el('valueFilterDefs');
  defs.innerHTML = '';
  if (!state.valueSteps) { drawLegend(); return; }

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', 'valueFilter');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  if (state.valueBlur > 0) {
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', String(state.valueBlur));
    filter.appendChild(blur);
  }

  if (state.valueScheme === 'edges') {
    appendEdgeStages(filter);
  } else {
    const matrix = document.createElementNS(SVG_NS, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', LUMA + LUMA + LUMA + '0 0 0 1 0');
    filter.appendChild(matrix);

    const n = state.valueSteps;
    const stops = VALUE_SCHEMES[state.valueScheme].stops;
    const tables = [0, 1, 2].map(channel => Array.from({ length: n }, (_, i) =>
      (sampleGradient(stops, i / (n - 1))[channel] / 255).toFixed(4)).join(' '));

    const transfer = document.createElementNS(SVG_NS, 'feComponentTransfer');
    ['feFuncR', 'feFuncG', 'feFuncB'].forEach((tag, idx) => {
      const fn = document.createElementNS(SVG_NS, tag);
      fn.setAttribute('type', 'discrete');
      fn.setAttribute('tableValues', tables[idx]);
      transfer.appendChild(fn);
    });
    filter.appendChild(transfer);
  }

  defs.appendChild(filter);
  drawLegend();
}

// Reflects exactly what the transfer tables above just computed - one swatch
// per tone level, dark to light - so "what does level 3 of 5 actually look
// like in Van Dyke Brown" is a glance at the drawer instead of a guess.
// Edges has no discrete tone levels to show, so the legend just clears.
function drawLegend() {
  const host = el('valueLegend');
  host.innerHTML = '';
  el('paneLegend').innerHTML = '';
  if (!state.valueSteps || state.valueScheme === 'edges') return;
  const n = state.valueSteps;
  const stops = VALUE_SCHEMES[state.valueScheme].stops;
  // Each step named in the medium you are using - js/materials.js.
  const names = materialTones(n).reverse();
  for (let i = 0; i < n; i++) {
    const [r, g, b] = sampleGradient(stops, i / (n - 1));
    const step = document.createElement('span');
    step.className = 'legend-step';
    const sw = document.createElement('span');
    sw.className = 'palette-swatch';
    sw.style.background = `rgb(${r},${g},${b})`;
    step.append(sw, names[i]);
    el('paneLegend').appendChild(step);
    // The drawer keeps the bare swatches; the names are on the pane.
    const bare = sw.cloneNode();
    bare.title = names[i];
    host.appendChild(bare);
  }
}

function valueStepsHint(n) {
  if (!n) return 'Off — the reference shows at its full tonal range.';
  if (state.valueScheme === 'edges') return 'Edge detection — the level count above does not apply to this scheme.';
  return n === 2
    ? 'Notan: light mass vs. dark mass, nothing in between.'
    : `Posterized to ${n} tones — block in shapes before chasing detail.`;
}

/* The one place state.valueSteps actually changes, called from two different
   UI surfaces that both need to agree afterward: the setup-screen chips, and
   the HUD's select (changed directly, or cycled with 'v', live during a
   session). Each has its own trigger, but "what changing the level means" -
   which chip lights up, the hint text, whether Grayscale is disabled, the
   HUD select's own value and highlight - is one thing, not three kept in
   sync by hand. */
function selectValueSteps(n) {
  state.valueSteps = n;
  const host = el('valueSteps');
  if (host) {
    [...host.children].forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.n) === n)));
  }
  el('valueStepsHint').textContent = valueStepsHint(n);
  updateValueStepsUI();
  updateValueSelects();
  buildValueFilter();
}

// Scheme and blur don't need their own "which UI changed it" fan-out the
// way selectValueSteps() does - each has exactly one control (the drawer's
// own selects), so keeping the <select>'s value in sync is just reading it
// back, not broadcasting to siblings.
function selectValueScheme(scheme) {
  state.valueScheme = scheme;
  el('valueStepsHint').textContent = valueStepsHint(state.valueSteps);
  buildValueFilter();
}
function selectValueBlur(blur) {
  state.valueBlur = blur;
  buildValueFilter();
}

/* Builds the <option> list for the HUD's select from VALUE_STEPS, so that
   stays the single source of truth rather than a hand-typed option list
   drifting from it. */
function renderValueSelect(select, labelPrefix) {
  select.innerHTML = '';
  for (const n of [0, ...VALUE_STEPS]) {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = labelPrefix + (n ? String(n) : 'Off');
    select.appendChild(opt);
  }
}

// Keeps the HUD select's value and accent highlight in step with
// state.valueSteps regardless of which UI (the setup chips or the select
// itself) actually changed it.
function updateValueSelects() {
  const sel = el('valueSelect');
  if (!sel) return;
  sel.value = String(state.valueSteps);
  sel.classList.toggle('active', !!state.valueSteps);
}

/* Sets scheme/blur from saved settings BEFORE renderValueSteps() below ever
   calls buildValueFilter() for the first time, so that first build already
   reflects them instead of building once with defaults and immediately
   rebuilding - wasted work, not a correctness problem, but there is no
   reason to pay it on every single boot. */
function renderValueTools(saved) {
  const schemeSelect = el('schemeSelect');
  schemeSelect.innerHTML = '';
  for (const [key, scheme] of Object.entries(VALUE_SCHEMES)) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = scheme.label;
    schemeSelect.appendChild(opt);
  }
  state.valueScheme = VALUE_SCHEMES[saved.valueScheme] ? saved.valueScheme : 'gray';
  schemeSelect.value = state.valueScheme;
  schemeSelect.addEventListener('change', e => { selectValueScheme(e.target.value); saveSettings(); });

  const blurSelect = el('blurSelect');
  blurSelect.innerHTML = '';
  for (const [key, px] of Object.entries(BLUR_LEVELS)) {
    const opt = document.createElement('option');
    opt.value = String(px); opt.textContent = key[0].toUpperCase() + key.slice(1);
    blurSelect.appendChild(opt);
  }
  state.valueBlur = Object.values(BLUR_LEVELS).includes(saved.valueBlur) ? saved.valueBlur : 0;
  blurSelect.value = String(state.valueBlur);
  blurSelect.addEventListener('change', e => { selectValueBlur(Number(e.target.value)); saveSettings(); });
}

function renderValueSteps(saved) {
  const host = el('valueSteps');
  host.innerHTML = '';
  const initial = VALUE_STEPS.includes(saved.valueSteps) ? saved.valueSteps : 0;

  for (const n of [0, ...VALUE_STEPS]) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.n = String(n); b.textContent = n ? String(n) : 'Off';
    b.setAttribute('aria-pressed', String(n === initial));
    b.addEventListener('click', () => { selectValueSteps(n); saveSettings(); });
    host.appendChild(b);
  }
  selectValueSteps(initial);
}

/* Grayscale is disabled, not hidden, while a step count is active: the SVG
   filter already forces its own grayscale (see buildValueFilters), so the
   checkbox would visibly do nothing - and a control that silently does
   nothing is worse than one plainly turned off. Its own checked/unchecked
   state is left alone underneath, so switching value-steps back to Off
   restores whatever Grayscale was actually set to. Same reasoning for the
   HUD's Gray button once a session is running - see applyOptions(). */
function updateValueStepsUI() {
  const gray = el('optGray');
  gray.disabled = !!state.valueSteps;
  gray.closest('label').title = state.valueSteps
    ? 'A tonal value view is active - it already renders in grayscale.' : '';
}

/* Local only - createObjectURL never leaves this browser, nothing is
   uploaded. Independent of the pack library entirely: this exists for
   reference or work-in-progress photos that were never going to be in the
   library at all.

   Both a single file and several build an ad hoc pool and hand off to the
   exact same startSession()/advance() machinery a pack-based session uses.
   That works with no changes there at all: pickFrame() and show() only ever
   deal in URLs and never cared whether one came from the server or from
   createObjectURL - see startSession()'s adHoc branch for the one place
   that DOES need to know the difference (there is no pack checkbox to read
   startPacks from). A small inline preview used to be how one dropped image
   was shown instead of this - replaced because a few-hundred-pixel-wide
   thumbnail is exactly the wrong size to actually judge a reference by, and
   the full-screen stage already has the split view, zoom and the angle
   tool built in for free. */
function initDropZone() {
  const zone = el('dropZone');
  const input = el('dropInput');
  const sessionInfo = el('dropSessionInfo');
  const sessionCount = el('dropSessionCount');
  let droppedUrls = [];      // the multi-image "Start session" pool's URLs

  function showOne(file) {
    sessionInfo.classList.add('hidden');
    // A dropped image with nothing chosen to check it against yet would just
    // show a plain copy of an image already sitting in front of you - the
    // one useless outcome here. 3 is the middle of VALUE_STEPS and the most
    // commonly taught value-study split (dark / mid / light).
    if (!state.valueSteps) { selectValueSteps(3); saveSettings(); }

    startSession([{ frames: [URL.createObjectURL(file)], pack: 'Dropped', group: 'Dropped' }]);
    // "Look at this," not a timed drill - startSession() always starts
    // unpaused, so this is the one place that immediately reverses it.
    if (!state.paused) togglePause();
    // Split into values already - the panel opens at that question.
    showWorkspaceAt('value');
  }

  function showMany(files) {
    // Revoke the previous batch - dropping a new multi-file batch replaces
    // the last one that was only ever staged, not started.
    droppedUrls.forEach(u => URL.revokeObjectURL(u));
    droppedUrls = files.map(f => URL.createObjectURL(f));
    sessionCount.textContent = `${files.length.toLocaleString()} image${files.length === 1 ? '' : 's'} ready`;
    sessionInfo.classList.remove('hidden');
  }

  async function showDropped(fileList, { keep = true } = {}) {
    const files = [...fileList].filter(f => f && f.type);
    const images = files.filter(f => f.type.startsWith('image/'));
    const videos = files.filter(f => f.type.startsWith('video/'));
    // Kept - a video whole, not its frames: opened again, it gives new ones.
    if (keep) for (const f of [...images, ...videos]) keepUploadQuietly(f, { from: f.type.startsWith('video/') ? 'video' : 'drop' });
    if (!videos.length) {
      if (images.length === 1) showOne(images[0]);
      else if (images.length) showMany(images);
      return;
    }
    // Frames go into the same staged pool as dropped images - a video is
    // just a source of stills here, and a session drawn from them is an
    // ordinary session.
    const start = el('startDropped');
    sessionInfo.classList.remove('hidden');
    start.disabled = true;
    const frames = [];
    try {
      for (const [k, v] of videos.entries()) {
        const of = videos.length > 1 ? ` (video ${k + 1} of ${videos.length})` : '';
        frames.push(...await videoFrames(v, VIDEO_FRAMES, i => {
          sessionCount.textContent = `Taking frames from ${v.name}: ${i}/${VIDEO_FRAMES}${of}`;
        }));
      }
    } catch (err) {
      frames.forEach(u => URL.revokeObjectURL(u));
      sessionCount.textContent = `Could not read that video - ${err.message}. The browser has to be able to play it.`;
      start.disabled = false;
      return;
    }
    droppedUrls.forEach(u => URL.revokeObjectURL(u));
    droppedUrls = [...images.map(f => URL.createObjectURL(f)), ...frames];
    sessionCount.textContent = `${frames.length} frames` +
      (images.length ? ` and ${images.length} image${images.length === 1 ? '' : 's'}` : '') + ' ready';
    start.disabled = false;
  }

  el('startDropped').addEventListener('click', () => {
    if (!droppedUrls.length) return;
    startSession(droppedUrls.map(src => ({ frames: [src], pack: 'Dropped', group: 'Dropped' })));
  });

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.style.borderColor = 'var(--accent)';
  });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    if (e.dataTransfer.files) showDropped(e.dataTransfer.files);
  });
  input.addEventListener('change', () => showDropped(input.files));
  takeDropped = showDropped;
}
// A kept video opened again goes the same way as a dropped one - set by
// initDropZone(), whose closure holds the staged pool.
let takeDropped = () => {};

/* Stills out of a video, for gesture drawing from real movement - a dancer,
   a match, an animal - rather than poses held still for a camera. One random
   moment in each of `n` equal slices of the clip (stratified, not uniform
   random), so the frames cover the whole of it and never bunch up into
   near-identical neighbours. Decoded by the browser's own player, drawn to a
   canvas, kept as blob: URLs - nothing leaves the page. */
const VIDEO_FRAMES = 20;
async function videoFrames(file, n, progress) {
  const src = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
  try {
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('unsupported format')); });
    // A recording that was never finalised (a browser's own MediaRecorder,
    // some screen recorders) says its length is Infinity until the player
    // has been to the end - so send it there, and read it back.
    if (v.duration === Infinity) {
      v.currentTime = 1e9;
      await new Promise(res => { v.addEventListener('seeked', res, { once: true }); setTimeout(res, 4000); });
    }
    const dur = v.duration;
    if (!Number.isFinite(dur) || dur <= 0) throw new Error('no length');
    const s = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.videoWidth * s); cv.height = Math.round(v.videoHeight * s);
    const ctx = cv.getContext('2d');
    const out = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = (i + 0.1 + Math.random() * 0.8) * dur / n;
      await new Promise(res => v.addEventListener('seeked', res, { once: true }));
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
      out.push(URL.createObjectURL(blob));
      progress(i + 1);
    }
    return out;
  } finally {
    v.removeAttribute('src'); v.load();
    URL.revokeObjectURL(src);
  }
}

function renderPacks(saved) {
  const host = el('packs');
  host.innerHTML = '';
  const chosen = saved.packs;
  const known = saved.known;

  // A group is on if it was explicitly chosen, or if it is NEW - i.e. it was not
  // present the last time settings were saved. New packs opt in; that is the
  // behaviour you want when you have just gone to the trouble of adding one.
  // `known` is absent in settings saved before this existed, in which case fall
  // back to the old meaning rather than silently re-enabling something.
  const isOn = key => !chosen ? true
    : chosen.includes(key) || (Array.isArray(known) && !known.includes(key));

  for (const pack of INDEX.packs) {
    const box = document.createElement('div');
    box.className = 'pack';

    // A flat pack has exactly one group named after the pack itself; showing it
    // twice would be noise, so only multi-group packs get the nested rows.
    const flat = pack.groups.length === 1;

    // Two hit targets, not one, which is why this stopped being a <label>:
    // the checkbox picks what a session draws from, the name opens the pack
    // in the grid, and clicking one must never do the other's job. A flat
    // pack has no folders to expand, so it gets a spacer rather than a caret
    // that would toggle nothing.
    const head = document.createElement('div');
    head.className = 'row';
    head.innerHTML =
      (flat ? `<span class="caret" aria-hidden="true"></span>`
            : `<button type="button" class="caret" title="Show or hide this pack's folders" aria-label="Show or hide this pack's folders">&#9656;</button>`) +
      `<input type="checkbox" class="packToggle" title="Include this pack in the session pool">` +
      `<button type="button" class="grow name" data-pack="${esc(pack.name)}">${esc(pack.name)}</button>` +
      `<span class="count">${pack.count.toLocaleString()}</span>`;
    box.appendChild(head);
    // Folders start collapsed: a library of thirty packs with a dozen folders
    // each is a scroll of several hundred rows before you have chosen
    // anything. markCurrentInTree() opens whichever one you are looking at.
    if (!flat) box.classList.add('closed');

    const kids = [];
    for (const g of pack.groups) {
      const key = pack.name + ' / ' + g.name;
      const on = isOn(key);
      if (flat) {
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.className = 'grp'; cb.value = key; cb.checked = on;
        cb.style.display = 'none';
        box.appendChild(cb);
        kids.push(cb);
      } else {
        const row = document.createElement('div');
        row.className = 'row sub-group';
        row.innerHTML =
          `<input type="checkbox" class="grp" value="${esc(key)}" ${on ? 'checked' : ''}>` +
          `<button type="button" class="grow name" data-pack="${esc(pack.name)}" data-group="${esc(g.name)}">${esc(g.name)}</button>` +
          (g.rotation ? `<span class="badge" title="One pose from many angles - drawn as a single pose">rotation</span>` : '') +
          `<span class="count">${g.images.length.toLocaleString()}</span>`;
        box.appendChild(row);
        kids.push(row.querySelector('.grp'));
      }
    }

    const head_cb = head.querySelector('.packToggle');
    const sync = () => {
      const on = kids.filter(k => k.checked).length;
      head_cb.checked = on > 0;
      head_cb.indeterminate = on > 0 && on < kids.length;
    };
    head_cb.addEventListener('change', () => {
      kids.forEach(k => { k.checked = head_cb.checked; });
      sync(); refreshPool(); saveSettings(); updateCopyLink();
    });
    kids.forEach(k => k.addEventListener('change', () => { sync(); refreshPool(); saveSettings(); updateCopyLink(); }));
    sync();

    host.appendChild(box);
  }
  updateCopyLink();
  applyPackFilter(); // re-apply whatever was already typed - renderPacks() re-runs on Rescan too
  markCurrentInTree(); // ...and re-mark the open folder, for the same reason
}

// Filters which .pack boxes are VISIBLE only - never touches a checkbox's
// checked state (see the HTML comment on #packFilter), so narrowing the
// list to find one pack and widening it again never silently drops a
// selection made while a pack was hidden. Matches against the pack's own
// name AND its sub-group names, so searching "hands" still finds a pack
// whose own name doesn't say so but has a "Hands" group inside it.
function applyPackFilter() {
  const q = el('packFilter').value.trim().toLowerCase();
  let shown = 0, total = 0;
  for (const box of document.querySelectorAll('#packs .pack')) {
    total++;
    const name = box.querySelector('.name')?.textContent.toLowerCase() || '';
    const groupNames = [...box.querySelectorAll('.sub-group .name')].map(s => s.textContent.toLowerCase());
    const match = !q || name.includes(q) || groupNames.some(g => g.includes(q));
    box.classList.toggle('hidden', !match);
    if (match) shown++;
  }
  el('packFilterCount').textContent = q ? `${shown.toLocaleString()} of ${total.toLocaleString()} packs` : '';
}
el('packFilter').addEventListener('input', applyPackFilter);

/* ------------------------------------------------------- library browser
   The middle column. Everything here answers one question the board could
   not answer before: "what is actually in this pack?" - which previously
   could only be found out by starting a session against it and watching what
   came up.

   Nothing here builds a second image pipeline. A grid cell is a thumbnail URL
   plus an index into gridItems; opening one hands that same list to
   startSession() in browse mode, so the viewer is the identical stage a timed
   session uses, with the identical zoom/angle/tonal-value tools - the only
   difference is which frame comes next and whether a clock is running. */

// Which folder the middle column is showing.
//   'dashboard' - summary, log and the drop zone; no grid
//   'drop'      - the same page, scrolled to and focused on the drop zone
//   'all'       - every image the index knows about
//   'pack'      - one pack, all of its folders
//   'group'     - one folder inside one pack
let view = { kind: 'dashboard', pack: null, group: null };

let gridItems = [];   // what the current view resolves to, after the search box
let viewTotal = 0;    // ...and before it, so the meta line can say "N of M"
let gridShown = 0;    // how many of gridItems are actually in the DOM

/* One page of cells at a time. A pack of several thousand images is a normal
   size for a reference library, and putting that many <img> elements on the
   page at once costs real layout and memory time up front no matter how lazy
   their loading is - loading="lazy" defers the fetch, not the element. */
const GRID_PAGE = 120;

/* Ordered, best first, exactly like displayCandidates() one size up: the
   generated thumbnail, then whatever the stage itself would load. The
   fallback matters - a library whose feature pass has not reached these
   images yet still browses, just at full display-copy weight, and one served
   with no features.json at all (or with a features.json written before
   thumbnails existed) browses off the originals. */
function thumbCandidates(src) {
  const f = FEATURES && FEATURES.images[src];
  const out = [];
  if (f) {
    if (supportsWebp && f.thumbWebp) out.push(f.thumbWebp);
    if (f.thumb) out.push(f.thumb);
  }
  return out.concat(displayCandidates(src));
}

/* The file's own name, which is what a pose pack's numbering lives in
   ("Pose_014.jpg"). decodeURIComponent because src is a URL path - a folder
   with a space in it arrives here as %20 and would otherwise be searched and
   displayed that way. */
function baseName(src) {
  const last = src.split('/').pop() || src;
  try { return decodeURIComponent(last); } catch { return last; }
}

/* Every image the current view covers, in index order. Deliberately not
   filtered by the pack checkboxes: those choose what a SESSION draws from,
   and browsing a pack you have not ticked - to decide whether to tick it - is
   the normal way to arrive at one. */
function viewImages() {
  if (!INDEX || view.kind === 'dashboard' || view.kind === 'drop') return [];
  const out = [];
  for (const pack of INDEX.packs) {
    if (view.kind !== 'all' && pack.name !== view.pack) continue;
    for (const g of pack.groups) {
      if (view.kind === 'group' && g.name !== view.group) continue;
      for (const img of g.images) {
        out.push({
          src: img.src, pack: pack.name, group: g.name,
          rotation: !!g.rotation, name: baseName(img.src), tags: img.tags || [],
        });
      }
    }
  }
  return out;
}

/* Matches the file name, its folder and its pack, not just the file name: in
   a flat "all images" view the folder is the only thing that distinguishes
   two identically-numbered poses from different packs, and it is what you
   actually remember about them. And a sorted upload's tags (js/sort.js).
   Each word on its own, anywhere: "sitting lit left" finds a seated pose lit
   from the left, however the words fall across name, folder and tags. */
function filterImages(list) {
  const words = el('imgFilter').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter(i => {
    const text = [i.name, i.group, i.pack, ...(i.tags || [])].join(' | ').toLowerCase();
    return words.every(w => text.includes(w));
  });
}

/* The order the grid draws its images in - whatever #gridOrder is set to,
 * persisted with the rest of the panel.
 *
 * 'index' is the default and stays first, because the index hands images over
 * already naturally sorted (Pose2 before Pose10) within each folder, and
 * folder by folder within a pack - which is the order they were named in, and
 * in a numbered pose pack that numbering usually means something.
 *
 * The rest earn their place by answering a question the folder order cannot:
 * name ignores which folder a pose came from, brightness turns a pack into a
 * value ramp to pick a light or a dark study out of, and shuffle makes
 * browsing itself a random draw without committing to a timed session. */
let gridOrder = 'index';

const NAT = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/* A random key per image rather than a shuffle of the list, so the order is
   stable across re-sorts: refreshGrid() runs on every keystroke in the search
   box, and a shuffle that reshuffled as you typed would move the thumbnail you
   were reaching for out from under the pointer. Cleared - so the next sort
   draws fresh keys - only when the reader asks for a new shuffle, or when the
   view changes to a different set of images. */
let shuffleKeys = new Map();
function reshuffle() { shuffleKeys = new Map(); }
function shuffleKey(src) {
  let k = shuffleKeys.get(src);
  if (k === undefined) { k = Math.random(); shuffleKeys.set(src, k); }
  return k;
}

/* Mean brightness, or null for an image the feature pass has not reached yet.
   Those sort to the end in both directions rather than to one end or the
   other: "not measured" is not a brightness, and pretending it is 0 would
   bury unmeasured images among the genuinely dark ones. */
function brightness(src) {
  const f = FEATURES && FEATURES.images[src];
  return f && typeof f.v === 'number' ? f.v : null;
}

function gridSort(list) {
  if (gridOrder === 'index') return list;
  const out = [...list];
  if (gridOrder === 'name') {
    out.sort((a, b) => NAT.compare(a.name, b.name) || NAT.compare(a.group, b.group));
  } else if (gridOrder === 'random') {
    out.sort((a, b) => shuffleKey(a.src) - shuffleKey(b.src));
  } else {
    const dir = gridOrder === 'bright' ? -1 : 1;
    out.sort((a, b) => {
      const x = brightness(a.src), y = brightness(b.src);
      if (x === null || y === null) return (x === null) - (y === null);
      return (x - y) * dir;
    });
  }
  return out;
}

function refreshGrid() {
  const all = viewImages();
  viewTotal = all.length;
  gridItems = gridSort(filterImages(all));
  gridShown = 0;
  el('thumbGrid').innerHTML = '';
  renderGridPage();
  updateViewMeta();
}

function renderGridPage() {
  const host = el('thumbGrid');
  const more = el('btnGridMore');
  if (!gridItems.length) {
    host.innerHTML = `<div class="empty">${
      viewTotal ? 'Nothing in this folder matches that search.' : 'No images here yet.'
    }</div>`;
    more.classList.add('hidden');
    return;
  }
  const frag = document.createDocumentFragment();
  const end = Math.min(gridItems.length, gridShown + GRID_PAGE);
  for (let i = gridShown; i < end; i++) frag.appendChild(gridCell(gridItems[i], i));
  host.appendChild(frag);
  gridShown = end;
  const left = gridItems.length - gridShown;
  more.classList.toggle('hidden', left <= 0);
  more.textContent = `Show more (${left.toLocaleString()} left)`;
}

/* A div with role=button rather than a real <button>: the skip toggle sits
   inside the cell and is itself a button, and a button inside a button is
   invalid markup that browsers resolve by dropping one of them. */
function gridCell(item, i) {
  const cell = document.createElement('div');
  cell.className = 'cell' + (isSkipped(item.src) ? ' skipped' : '');
  cell.dataset.i = i;
  cell.tabIndex = 0;
  cell.setAttribute('role', 'button');
  cell.title = item.name;

  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const chain = thumbCandidates(item.src);
  let stage = 0;
  img.onerror = () => { if (++stage < chain.length) img.src = chain[stage]; };
  img.src = chain[0];
  cell.appendChild(img);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'cell-skip';
  skip.textContent = isSkipped(item.src) ? 'Unskip' : 'Skip';
  skip.title = 'Never draw this pose in a session (it stays here so you can undo it)';
  cell.appendChild(skip);

  const meta = document.createElement('span');
  meta.className = 'cell-meta';
  meta.innerHTML =
    `<span class="cell-name">${esc(item.name)}</span>` +
    (view.kind === 'group' ? '' : `<span class="cell-tag">${esc(item.group)}</span>`) +
    (item.rotation ? '<span class="cell-tag">rotation</span>' : '');
  cell.appendChild(meta);

  return cell;
}

/* How many cells the current window width fits on one row. Measured off the
   DOM rather than read from the stylesheet: the grid is auto-fill, so that
   number is whatever the window made it and changes with every resize. */
function cellsPerRow() {
  const cells = document.querySelectorAll('#thumbGrid .cell');
  if (!cells.length) return 1;
  const top = cells[0].offsetTop;
  let n = 0;
  while (n < cells.length && cells[n].offsetTop === top) n++;
  return n || 1;
}

/* Moves focus to one cell, rendering however many pages it takes to reach it
   first - paging is a display detail, and arrow keys stopping dead at cell 120
   of 900 would make it one the reader has to know about.

   Clamped rather than wrapped: ArrowRight off the last image landing back on
   the first reads as the grid having jumped somewhere else entirely. */
function focusCell(i) {
  if (!gridItems.length) return;
  i = Math.min(Math.max(i, 0), gridItems.length - 1);
  while (i >= gridShown && gridShown < gridItems.length) renderGridPage();
  const cell = el('thumbGrid').querySelector(`.cell[data-i="${i}"]`);
  if (!cell) return;
  cell.focus();
  cell.scrollIntoView({ block: 'nearest' });
}

/* Toggled in place rather than by re-rendering the grid: a re-render resets
   the pagination, and un-skipping something 400 cells down should not throw
   away the 400 cells you scrolled past to reach it. */
function toggleCellSkip(i, cell) {
  const item = gridItems[i];
  if (!item) return;
  const now = !isSkipped(item.src);
  setSkipped(item.src, now);  // persists on its own - see setSkipped()
  cell.classList.toggle('skipped', now);
  cell.querySelector('.cell-skip').textContent = now ? 'Unskip' : 'Skip';
  renderSkipInfo();
  refreshPool();
  updateViewMeta();
}

/* The grid's own skip marks after a session that skipped things from inside
   the stage - same in-place update, same reason. */
function syncGridSkips() {
  for (const cell of document.querySelectorAll('#thumbGrid .cell')) {
    const item = gridItems[Number(cell.dataset.i)];
    if (!item) continue;
    const on = isSkipped(item.src);
    cell.classList.toggle('skipped', on);
    cell.querySelector('.cell-skip').textContent = on ? 'Unskip' : 'Skip';
  }
  updateViewMeta();
}

function updateViewMeta() {
  const m = el('viewMeta');
  if (view.kind === 'dashboard') { m.textContent = ''; return; }
  if (view.kind === 'drop') {
    // Behind the container what you drop is kept - and sorted - on it.
    m.textContent = storeMode === 'server'
      ? 'Kept on your own server, sorted into folders - never sent anywhere else.'
      : 'Stays in this browser - nothing is uploaded anywhere.';
    return;
  }
  if (view.kind === 'forms') {
    m.textContent = 'Simple forms under light you control - rendered in this browser, nothing is uploaded.';
    return;
  }
  if (view.kind === 'train') {
    m.textContent = 'Short drills for the eye and the hand - each round scored, your best kept.';
    return;
  }
  if (view.kind === 'colour') {
    m.textContent = 'Palette, colour wheel and gamut mask for any image - a character sheet: her colours, with how to mix them - the greys your paints make, what they give glazed one over another, a colour in the light and in shadow, and what each paint does on the paper.';
    return;
  }
  if (view.kind === 'museum') {
    m.textContent = 'Public-domain pictures from the Met and the Rijksmuseum - open one in the workspace, with the credit to copy.';
    return;
  }
  if (view.kind === 'perspective') {
    m.textContent = 'A sheet to print and draw over: one, two or three vanishing points on a horizon, on your own paper at its real size.';
    return;
  }
  if (view.kind === 'palette') {
    m.textContent = 'Colours to plan a picture with, in harmony and spread over the values - each with how to mix it from your paints.';
    return;
  }
  if (view.kind === 'generate') {
    m.textContent = 'Anime references made to order by your own ComfyUI - a character, a landscape, buildings, nature or an animal, in the light and medium you pick.';
    return;
  }
  const parts = [gridItems.length === viewTotal
    ? `${viewTotal.toLocaleString()} image${viewTotal === 1 ? '' : 's'}`
    : `${gridItems.length.toLocaleString()} of ${viewTotal.toLocaleString()} images`];
  if (view.kind === 'group') parts.push(view.pack);
  const sk = gridItems.reduce((n, i) => n + (isSkipped(i.src) ? 1 : 0), 0);
  if (sk) parts.push(`${sk.toLocaleString()} skipped`);
  m.textContent = parts.join('  ·  ');
  el('btnBrowseDraw').disabled = !gridItems.length;
}

function viewTitle() {
  switch (view.kind) {
    case 'all':   return 'All images';
    case 'pack':  return view.pack;
    case 'group': return view.group;
    case 'drop':  return 'Check your own image';
    case 'forms': return '3D forms';
    case 'train': return 'Train';
    case 'colour': return 'Colour studio';
    case 'generate': return 'Generate references';
    case 'palette': return 'Palettes';
    case 'museum': return 'Museums';
    case 'perspective': return 'Perspective grid';
    default:      return 'Dashboard';
  }
}

function setView(next) {
  const changed = view.kind !== next.kind || view.pack !== (next.pack || null) ||
    view.group !== (next.group || null);
  view = { kind: next.kind, pack: next.pack || null, group: next.group || null };
  // A different folder is a different draw. Same folder re-opened keeps the
  // order it had, so coming back to a shuffled pack finds it as you left it.
  if (changed && gridOrder === 'random') reshuffle();
  const browsing = view.kind === 'all' || view.kind === 'pack' || view.kind === 'group';

  const forms = view.kind === 'forms', train = view.kind === 'train', colour = view.kind === 'colour';
  const generate = view.kind === 'generate', palette = view.kind === 'palette', museum = view.kind === 'museum';
  const perspective = view.kind === 'perspective';
  el('viewBrowse').classList.toggle('hidden', !browsing);
  el('viewForms').classList.toggle('hidden', !forms);
  el('viewTrain').classList.toggle('hidden', !train);
  el('viewColour').classList.toggle('hidden', !colour);
  el('viewGenerate').classList.toggle('hidden', !generate);
  el('viewPalette').classList.toggle('hidden', !palette);
  el('viewMuseum').classList.toggle('hidden', !museum);
  el('viewPerspective').classList.toggle('hidden', !perspective);
  el('mainBody').classList.toggle('forms-mode', forms);
  // The Session inspector is for drawing from the library. Here it only took
  // width from the stage; its one use in this view - the interval for Draw
  // random forms - has its own control in the 3D panel. The trainers have
  // no use for it at all.
  const tool = forms || train || colour || generate || palette || museum || perspective;
  el('setup').classList.toggle('forms-mode', tool);
  el('viewDashboard').classList.toggle('hidden', browsing || tool);
  el('searchbar').classList.toggle('hidden', !browsing);
  el('viewTitle').textContent = viewTitle();
  if (changed) announce(viewTitle());

  for (const b of document.querySelectorAll('.nav-item[data-view]')) {
    b.setAttribute('aria-current', String(b.dataset.view === view.kind));
  }
  markCurrentInTree();

  if (browsing) refreshGrid(); else updateViewMeta();
  // Initialised on first visit, not at boot: a WebGL context and a shadow map
  // are real GPU memory, and most visits to the board never open this view.
  if (forms) openLazyView('forms', () => showForms());
  if (train) showTrain();
  if (colour) openLazyView('colour', () => showColour());
  if (palette) openLazyView('palette', () => showPalette());
  if (museum) openLazyView('museum', () => showMuseum());
  if (perspective) openLazyView('perspective', () => showPerspective());
  if (generate) showGenerate();
  el('sidebar').classList.remove('peek');
  shellSync();
  el('mainBody').scrollTop = 0;

  // The drop zone is on the dashboard page rather than a view of its own -
  // it is three lines of UI, and a whole screen for it would be mostly empty.
  // The nav item scrolls to it and focuses it instead, which is the whole of
  // what a separate screen would have achieved.
  if (view.kind === 'drop') {
    const zone = el('dropZone');
    zone.scrollIntoView({ block: 'center' });
    zone.focus();
  }
  closeDrawers();
}

/* A view whose code loads the first time it opens (loadSection()). Drawn
   only if it is still the view when its code arrives - a quick click on to
   somewhere else must not have it drawn over that. */
function openLazyView(kind, show) {
  loadSection(kind).then(() => { if (view.kind === kind) show(); }, () => {
    if (view.kind === kind) el('viewMeta').textContent = 'This section could not load - check the connection, then open it again.';
  });
}

// The 3D forms, then `then` with its code in - showAnimeHead() and the rest
// of js/forms.js exist only once the section has loaded.
async function openForms(then) {
  setView({ kind: 'forms' });
  await loadSection('forms');
  if (then) await then();
}

// The Colour studio on one of its tabs - and on a picture, if one is given.
async function openColour(tab, src) {
  setView({ kind: 'colour' });
  await loadSection('colour');
  if (!col) initColour();
  colourTab(tab);
  if (src) colourLoad(src);
}

// The palette generator, with these colours as its palette.
async function openPalette(rgbs) {
  setView({ kind: 'palette' });
  await loadSection('palette');
  palgenTake(rgbs);
}

/* Highlights whichever tree row the middle column is showing, and opens the
   pack it lives in - a highlighted row inside a collapsed pack is invisible,
   which is the one state that would make the highlight worse than nothing. */
function markCurrentInTree() {
  for (const box of document.querySelectorAll('#packs .pack')) {
    let inPack = false;
    for (const row of box.querySelectorAll('.row')) {
      const btn = row.querySelector('button.name');
      const on = !!btn && btn.dataset.pack === view.pack &&
        (view.kind === 'group' ? btn.dataset.group === view.group : !btn.dataset.group);
      row.classList.toggle('current', on);
      if (on) inPack = true;
    }
    if (inPack && view.kind === 'group') box.classList.remove('closed');
  }
}

/* Ticks or clears every group checkbox in the packs the filter is currently
   showing - see the comment on the buttons themselves for why it is scoped to
   the visible ones. Drives the boxes directly rather than firing a change
   event per checkbox: the per-checkbox handler saves and rebuilds the pool
   each time it runs, which for a library of a few thousand groups is a few
   thousand pool rebuilds for one click. The three things that handler does
   are done once, at the end, instead. */
function setAllPacks(on) {
  const boxes = [...document.querySelectorAll('#packs .pack')]
    .filter(b => !b.classList.contains('hidden'));
  for (const box of boxes) {
    for (const cb of box.querySelectorAll('.grp')) cb.checked = on;
    const head = box.querySelector('.packToggle');
    if (head) { head.checked = on; head.indeterminate = false; }
  }
  refreshPool();
  saveSettings();
  updateCopyLink();
}

/* -------------------------------------------------------------- the shell */

function closeDrawers() {
  el('sidebar').classList.remove('open');
  el('inspector').classList.remove('open');
}

/* The session panel's tabs. Which one is open is a convenience of this
   browser, like the folded panels, not a setting of the session. */
function initInspectorTabs() {
  const pickTab = name => {
    for (const b of el('inspTabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === name));
    for (const t of document.querySelectorAll('.insp-tab')) t.classList.toggle('on', t.dataset.tab === name);
    try { localStorage.setItem('refboard.inspTab.v1', name); } catch {}
  };
  el('inspTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) pickTab(b.dataset.tab); });
  let saved = 'timing';
  try { saved = localStorage.getItem('refboard.inspTab.v1') || 'timing'; } catch {}
  pickTab(['timing', 'filter', 'display'].includes(saved) ? saved : 'timing');
}

let shellSync = () => {}; // initShell() fills it: the panel buttons follow the view
function initShell(saved = {}) {
  // Brightness needs a measured value per image; with no features.json there
  // is none, and both orders would quietly leave the grid exactly as it was.
  if (!FEATURES) {
    for (const o of document.querySelectorAll('#gridOrder option[data-needs-features]')) o.remove();
  }
  const order = el('gridOrder');
  if ([...order.options].some(o => o.value === saved.gridOrder)) order.value = saved.gridOrder;
  gridOrder = order.value;
  order.addEventListener('change', () => {
    // Re-picking Shuffle while already shuffled is the only way to ask for a
    // different draw, so it has to mean "shuffle again" rather than nothing.
    if (order.value === 'random') reshuffle();
    gridOrder = order.value;
    saveSettings();
    refreshGrid();
  });

  for (const b of document.querySelectorAll('.nav-item[data-view]')) {
    b.addEventListener('click', () => setView({ kind: b.dataset.view }));
    // A lazy section's code starts coming as the pointer reaches its
    // button, so by the click it is usually here.
    if (el('lazy-' + b.dataset.view)) {
      const warm = () => loadSection(b.dataset.view).catch(() => { /* the click will say */ });
      b.addEventListener('pointerenter', warm, { once: true });
      b.addEventListener('focus', warm, { once: true });
    }
  }

  /* The two side panels. On a wide screen each folds away and stays that
     way (remembered per browser); on a narrow one they are drawers over the
     middle column, open only while you use them. */
  const narrow = () => matchMedia('(max-width: 1100px)').matches;
  const ui = (() => { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; } })();
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {} };
  const modeHides = () => el('setup').classList.contains('forms-mode');
  const syncPanels = () => {
    el('sidebar').classList.toggle('collapsed', !!ui.libHidden && !el('sidebar').classList.contains('peek'));
    el('inspector').classList.toggle('collapsed', !!ui.sessionHidden);
    el('btnLibrary').setAttribute('aria-pressed', String(narrow() ? el('sidebar').classList.contains('open')
      : modeHides() ? el('sidebar').classList.contains('peek') : !ui.libHidden));
    el('btnOpenSession').setAttribute('aria-pressed', String(!ui.sessionHidden));
  };
  const toggleLibrary = () => {
    if (narrow()) { el('inspector').classList.remove('open'); el('sidebar').classList.toggle('open'); }
    else if (modeHides()) el('sidebar').classList.toggle('peek');
    else ui.libHidden = !ui.libHidden;
    saveUi(); syncPanels();
  };
  el('btnLibrary').addEventListener('click', toggleLibrary);
  el('btnCollapse').addEventListener('click', () => {
    if (narrow()) el('sidebar').classList.remove('open');
    else if (el('sidebar').classList.contains('peek')) el('sidebar').classList.remove('peek');
    else ui.libHidden = true;
    saveUi(); syncPanels();
  });
  el('btnOpenSession').addEventListener('click', () => {
    if (narrow()) { el('sidebar').classList.remove('open'); el('inspector').classList.toggle('open'); }
    else ui.sessionHidden = !ui.sessionHidden;
    saveUi(); syncPanels();
  });
  el('btnCloseSession').addEventListener('click', () => {
    if (narrow()) closeDrawers(); else { ui.sessionHidden = true; saveUi(); syncPanels(); }
  });
  syncPanels();
  shellSync = syncPanels;
  initInspectorTabs();

  // Delegated: the tree is rebuilt from scratch on every Rescan, and
  // per-row listeners would have to be rebound with it every time.
  el('packs').addEventListener('click', e => {
    const caret = e.target.closest('.caret');
    if (caret) {
      const box = caret.closest('.pack');
      const closed = box.classList.toggle('closed');
      caret.innerHTML = closed ? '&#9656;' : '&#9662;';
      return;
    }
    const name = e.target.closest('button.name');
    if (!name) return;
    setView(name.dataset.group
      ? { kind: 'group', pack: name.dataset.pack, group: name.dataset.group }
      : { kind: 'pack', pack: name.dataset.pack });
  });

  el('thumbGrid').addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const i = Number(cell.dataset.i);
    if (e.target.closest('.cell-skip')) { toggleCellSkip(i, cell); return; }
    openViewer(i);
  });
  // role=button carries no implicit keyboard activation of its own, and a
  // grid of tiles carries no implicit arrow-key navigation either - both are
  // things a real <button> in a real list would have given us for free.
  el('thumbGrid').addEventListener('keydown', e => {
    const cell = e.target.closest('.cell');
    if (!cell || e.altKey || e.ctrlKey || e.metaKey) return;
    const i = Number(cell.dataset.i);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(i); return; }
    // Same key as the viewer's own skip toggle, on purpose.
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleCellSkip(i, cell); return; }
    const per = cellsPerRow();
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: per, ArrowUp: -per }[e.key];
    let target;
    if (step !== undefined) target = i + step;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = gridItems.length - 1;
    else return;
    e.preventDefault();
    focusCell(target);
  });

  el('btnPacksAll').addEventListener('click', () => setAllPacks(true));
  el('btnPacksNone').addEventListener('click', () => setAllPacks(false));

  el('btnGridMore').addEventListener('click', renderGridPage);
  el('imgFilter').addEventListener('input', refreshGrid);
  el('btnBrowseDraw').addEventListener('click', () => {
    if (gridItems.length) startSession(gridItems.map(browseUnit));
  });
}

/* One image per unit, in grid order. A rotation folder is deliberately NOT
   collapsed to one frame here the way buildPool() collapses it for a timed
   session: browsing a turnaround is exactly when you want to see all of its
   angles, which is the opposite of what the session wants from it. */
function browseUnit(item) {
  return { frames: [item.src], pack: item.pack, group: item.group };
}

/* Opens the full stage on one grid cell - same viewer, same tools, no clock.
   The whole visible grid goes in, so Prev/Next walks the folder you were
   looking at rather than one image in isolation. */
function openViewer(i) {
  if (!gridItems.length) return;
  startSession(gridItems.map(browseUnit), { browse: true, startAt: i });
}

/* Sequential, wrapping, and no timer - the two ways browse mode differs from
   a session at all. Everything else about the frame (zoom reset, angle lines,
   ghost, value tools) is show()'s job and is identical either way. */
function browseStep(delta) {
  const n = state.pool.length;
  if (!n) return;
  state.cursor = ((state.cursor + delta) % n + n) % n;
  browseShow();
}

function browseShow() {
  const n = state.pool.length;
  const unit = state.pool[state.cursor];
  if (!unit) return;
  const src = unit.frames[0];
  state.history = [src];
  state.histPos = 0;
  show(src);
  // Warms the frame Next would land on. One ahead only, same as
  // preloadNext() - browsing is a slower loop than a 30-second timer, so
  // reading further ahead would mostly fetch images nobody looks at.
  const next = state.pool[(state.cursor + 1) % n];
  if (next) new Image().src = displayCandidates(next.frames[0])[0];
}

/* The pack hash claims exactly one pack (see applyPackHash), so the link this
   button builds only makes sense under the same constraint - one distinct
   pack name across however many of its groups are checked. Anything else
   (nothing checked, or two packs at once) disables the button rather than
   building a link that would silently narrow to only one of them on arrival. */
function selectedPackName() {
  const checked = [...document.querySelectorAll('#packs .grp:checked')];
  if (!checked.length) return null;
  const packs = new Set(checked.map(b => b.value.split(' / ')[0]));
  return packs.size === 1 ? [...packs][0] : null;
}
function updateCopyLink() {
  const btn = el('copyLink');
  const name = selectedPackName();
  btn.disabled = !name;
  btn.title = name ? '' : 'Select exactly one pack to link to it';
}

/* #pack=<name>[&secs=<n>] - select exactly that pack, and optionally the
 * timer preset to go with it, and nothing else.
 *
 * This exists so What's New can hand off: it reports that a pose pack gained
 * images and its "Draw it" link lands here with that pack already selected,
 * rather than on a board still showing whatever was chosen last time. Without
 * it the handoff is "go and find it", which is what the whole page of links was
 * meant to stop. The copy-link button below builds the same shape by hand, for
 * a setup worth handing to another device or another session.
 *
 * URLSearchParams rather than the old exact regex, so a link that only ever
 * carried #pack=<name> keeps working unchanged - secs is additive, not a
 * breaking reshape of the hash.
 *
 * Deliberately NOT saved. The hash is a way of arriving, not a preference: a
 * link that quietly overwrote a carefully built selection would make the link
 * something you think twice about opening. Press anything and the normal
 * change handlers save as usual, at which point it is your choice rather than
 * the link's. secs follows the same rule: it only sets what renderIntervals()
 * below is about to draw the panel from, by editing the `saved` object this
 * one boot reads and never writes back - see saveSettings for why write-back
 * would break the same promise.
 *
 * A name that matches nothing leaves the board alone - a stale link should cost
 * you nothing, and an empty pool with no explanation looks like a broken index.
 */
function applyPackHash(saved) {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const want = p.get('pack');
  if (!want) return;

  const boxes = [...document.querySelectorAll('#packs .grp')];
  /* The group key is "<pack> / <group>", so the pack is everything before the
     first separator. Compared rather than prefix-matched, or a pack named
     "Hands" would also claim "Hands and Feet". */
  const hit = boxes.filter(b => b.value.split(' / ')[0] === want);
  if (!hit.length) return;

  boxes.forEach(b => { b.checked = hit.includes(b); });

  /* Each pack's head checkbox carries an indeterminate state that nothing
     recomputes after a scripted change. Rather than duplicate that arithmetic,
     fire the event the UI already listens for - one per pack is enough, since
     every group in a pack shares that pack's sync() closure - and let the
     normal handler run sync() and refreshPool().
     SUPPRESS_SAVE is what keeps the same handler from persisting the narrowing. */
  SUPPRESS_SAVE = true;
  try {
    for (const packBox of document.querySelectorAll('#packs .pack')) {
      const first = packBox.querySelector('.grp');
      if (first) first.dispatchEvent(new Event('change'));
    }
  } finally {
    SUPPRESS_SAVE = false;
  }

  // Same bounds as the #customSecs field this ultimately feeds - an
  // out-of-range or malformed value is treated the same as no value at all,
  // rather than handed to the timer unclamped.
  const secsWant = parseInt(p.get('secs'), 10);
  const gotSecs = Number.isFinite(secsWant) && secsWant >= 5 && secsWant <= 3600;
  if (gotSecs) saved.interval = secsWant;

  el('summary').insertAdjacentHTML('afterend',
    `<div class="sub" style="color:var(--accent)">Showing only <b>${esc(want)}</b>` +
    (gotSecs ? ` at <b>${esc(fmt(secsWant))}</b>` : '') +
    `, from the link you followed. Tick another pack to widen it.</div>`);
}

function renderIntervals(saved) {
  const host = el('intervals');
  host.innerHTML = '';
  // ?? not ||: 0 is a real, selectable interval now (no timer), and || would
  // silently rewrite it to 30 on every load.
  state.secs = saved.interval ?? 30;

  for (const s of PRESETS) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button';
    b.textContent = s ? fmt(s) : 'No timer';
    if (!s) b.title = 'Draw at your own pace - a random pose from the pool, ' +
      'and nothing changes it until you press Next.';
    b.setAttribute('aria-pressed', String(s === state.secs));
    b.addEventListener('click', () => {
      state.secs = s; el('customSecs').value = '';
      [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      saveSettings();
    });
    host.appendChild(b);
  }

  if (!PRESETS.includes(state.secs)) el('customSecs').value = state.secs;
  el('customSecs').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (v > 0) {
      state.secs = v;
      [...host.children].forEach(c => c.setAttribute('aria-pressed', 'false'));
      saveSettings();
    }
  });
}

function renderSchedules(saved) {
  const host = el('schedules');
  host.innerHTML = '';
  const want = saved.schedule || 'endless';

  for (const [key, sch] of Object.entries(SCHEDULES)) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.dataset.key = key; b.textContent = sch.label;
    b.setAttribute('aria-pressed', String(key === want));
    b.addEventListener('click', () => {
      [...host.children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
      el('customSchedule').classList.toggle('hidden', key !== 'custom');
      hintSchedule(key); saveSettings();
    });
    host.appendChild(b);
  }
  el('customSchedule').classList.toggle('hidden', want !== 'custom');
  // A single example row rather than one truly blank one - "60 sec x 5
  // poses" shows the shape of a step at a glance instead of two empty
  // placeholder-only fields, the same reasoning selectValueSteps(3) uses for
  // a dropped single image.
  renderCustomScheduleRows(saved.customSchedule?.length ? saved.customSchedule : [[60, 5]]);
  hintSchedule(want);
}

function hintSchedule(key) {
  const sch = SCHEDULES[key];
  el('scheduleHint').textContent = sch.steps
    ? (sch.hint ? sch.hint + '  ' : '') + sch.steps.map(([s, n]) => `${n} × ${fmt(s)}`).join('  ·  ') +
      `  —  ${sch.steps.reduce((a, [s, n]) => a + s * n, 0) / 60 | 0} min total, ignores the interval above`
    : key === 'custom' ? 'Add at least one step below.'
    : 'Runs until you stop, using the interval above.';
}
