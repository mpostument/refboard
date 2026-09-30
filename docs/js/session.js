/* refboard - Schedules, the pose pool, "more like this", the session loop, the HUD, options.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ------------------------------------------------------- custom schedule */
function renderCustomScheduleRows(steps) {
  el('customScheduleRows').innerHTML = '';
  for (const [secs, count] of steps) addScheduleStepRow(secs, count);
  // Pure recompute, no save - this also runs during boot's initial render,
  // and boot must never resave settings that were just loaded unchanged
  // (see syncCustomSchedule()'s own comment for why that matters here more
  // than it would look at first).
  updateCustomScheduleSteps();
}

function addScheduleStepRow(secs, count) {
  const row = document.createElement('div');
  row.className = 'row custom-schedule-row';
  row.style.marginTop = '6px';
  row.innerHTML =
    `<input type="number" class="stepSecs" min="5" max="3600" step="5" placeholder="secs" value="${secs ?? ''}">` +
    `<span class="count">sec ×</span>` +
    `<input type="number" class="stepCount" min="1" max="99" placeholder="count" value="${count ?? ''}">` +
    `<span class="count">poses</span>` +
    `<button type="button" class="ghost" title="Remove this step">×</button>`;
  row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', syncCustomSchedule));
  row.querySelector('button').addEventListener('click', () => { row.remove(); syncCustomSchedule(); });
  el('customScheduleRows').appendChild(row);
}

el('addScheduleStep').addEventListener('click', () => { addScheduleStepRow('', ''); syncCustomSchedule(); });

// Same bounds as #customSecs (5-3600s) plus a 1-99 pose count. An
// incomplete or out-of-range row (still being typed into, or never
// finished) is just dropped rather than blocking the whole schedule on one
// bad field - the same clamp-or-drop treatment applyPackHash()'s own secs
// parsing already uses.
function updateCustomScheduleSteps() {
  const steps = [...document.querySelectorAll('#customScheduleRows .custom-schedule-row')]
    .map(row => [parseInt(row.querySelector('.stepSecs').value, 10), parseInt(row.querySelector('.stepCount').value, 10)])
    .filter(([secs, count]) => secs >= 5 && secs <= 3600 && count >= 1 && count <= 99);
  SCHEDULES.custom.steps = steps.length ? steps : null;
  if (document.querySelector('#schedules .chip[aria-pressed="true"]')?.dataset.key === 'custom') hintSchedule('custom');
}

// A user actually edited a row (typed a value, added or removed a step) -
// recompute AND persist. Kept separate from updateCustomScheduleSteps()
// itself, which boot's own initial render also calls and must not have the
// side effect of writing localStorage (and pinging FleetState.push, see
// saveSettings()) before the user has changed anything at all.
function syncCustomSchedule() {
  updateCustomScheduleSteps();
  saveSettings();
}

/* ------------------------------------------------------------------- pool */

/* A draw unit is one POSE, not one file. A rotation group contributes a single
   unit holding all its frames; drawing it picks one frame at random, so a
   360-degree set can never serve five views of the same figure in a row. */
function buildPool(ignoreFilters) {
  // No library (GitHub Pages, or no index yet): nothing to draw a pool from.
  // stopSession() calls this on the way out of every session, including a
  // dropped-files or 3D-forms one, and throwing there left it half-run.
  if (!INDEX) return [];
  const keys = new Set([...document.querySelectorAll('.grp:checked')].map(c => c.value));
  const F = FEATURES && FEATURES.images;
  const tone = ignoreFilters ? null : state.tone;
  const dedup = !ignoreFilters && F && el('optDedup').checked;

  // An image with no measurements is never filtered OUT. A features run capped by
  // its time budget leaves most of the library unmeasured for a while, and a tone
  // filter that hid everything not yet processed would look like the packs had
  // emptied.
  const passes = src => {
    if (!tone || !F) return true;
    const f = F[src];
    if (!f) return true;
    if (tone === 'contrast') return f.c >= TONE_CUTS.cHigh;
    if (tone === 'lowkey')   return f.v <= TONE_CUTS.vLow;
    if (tone === 'highkey')  return f.v >= TONE_CUTS.vHigh;
    return true;
  };

  const pool = [];
  for (const pack of INDEX.packs) {
    for (const g of pack.groups) {
      if (!keys.has(pack.name + ' / ' + g.name)) continue;
      // Skipped is a permanent exclusion, not a session filter - it stays
      // removed even in the ignoreFilters pass buildPool(true) takes for the
      // "filtered from N" count, or a skipped image would count itself as
      // available and make that number lie.
      const imgs = g.images.filter(i => !isSkipped(i.src)).filter(i => passes(i.src));
      if (!imgs.length) continue;
      const meta = { pack: pack.name, group: g.name };

      if (g.rotation) {
        pool.push({ frames: imgs.map(i => i.src), ...meta });
        continue;
      }
      if (dedup) {
        // Same treatment a rotation group gets: one unit, one frame drawn from it.
        const sets = new Map(), singles = [];
        for (const img of imgs) {
          const d = F[img.src] && F[img.src].dupGroup;
          if (!d) { singles.push(img.src); continue; }
          if (!sets.has(d)) sets.set(d, []);
          sets.get(d).push(img.src);
        }
        for (const s of singles) pool.push({ frames: [s], ...meta });
        for (const frames of sets.values()) pool.push({ frames, ...meta });
        continue;
      }
      for (const img of imgs) pool.push({ frames: [img.src], ...meta });
    }
  }
  return pool;
}

function refreshPool() {
  const pool = buildPool();
  el('start').disabled = pool.length === 0;
  // The big number at the top of the inspector - the same figure poolInfo
  // spells out below it, kept readable from across the room.
  el('poolCount').textContent = pool.length.toLocaleString();

  // When a filter is on, show what it costs. This is the whole reason the dedup
  // option is safe to offer despite its measured unreliability: the number of
  // poses it removes is visible before committing to a session.
  const filtering = !!state.tone || el('optDedup').checked;
  const unfiltered = filtering ? buildPool(true).length : pool.length;

  if (!pool.length) {
    // Distinguish the two ways of reaching zero. Telling someone to select a pack
    // when they have selected several and merely picked a tone that none of them
    // contain sends them looking in the wrong place.
    el('poolInfo').textContent = unfiltered
      ? `no poses match this filter — ${unfiltered.toLocaleString()} in the selected packs`
      : 'select at least one pack';
    return;
  }
  el('poolInfo').textContent = pool.length === unfiltered
    ? `${pool.length.toLocaleString()} poses selected`
    : `${pool.length.toLocaleString()} poses selected — filtered from ${unfiltered.toLocaleString()}`;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Draw without replacement, reshuffling only once the pool is exhausted - so
   every pose appears before any repeats. On reshuffle, if the new first item is
   the one just shown, swap it away: the seam is the only place a repeat can
   feel like a bug. */
function nextUnit() {
  if (state.cursor >= state.order.length) {
    const last = state.order[state.order.length - 1];
    state.order = shuffle([...Array(state.pool.length).keys()]);
    if (state.order.length > 1 && state.order[0] === last) {
      [state.order[0], state.order[1]] = [state.order[1], state.order[0]];
    }
    state.cursor = 0;
    // A reshuffle is a fresh pass over the whole pool; carrying a similarity
    // ordering across it would silently re-sort the new pass too.
    setSimilar(null);
  }
  return state.pool[state.order[state.cursor++]];
}

/* ------------------------------------------------------- "more like this" */

/* Hamming distance over the 64-bit hashes, as two 32-bit halves - parsing the
   whole 16 hex chars at once exceeds the range where bitwise ops stay exact. */
function popcount(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}
function hamm(a, b) {
  return popcount((parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) >>> 0) +
         popcount((parseInt(a.slice(8), 16) ^ parseInt(b.slice(8), 16)) >>> 0);
}

/* Re-order only the part of the pass not yet drawn, so draw-without-replacement
   still holds: every pose appears once before any repeats, just in a different
   order. Ranking is all this hash is trusted for - it is not accurate enough to
   decide that two frames ARE the same pose (see the server's dupGroup
   clustering), but it is perfectly good at putting the closest ones first. */
function setSimilar(src) {
  state.similarTo = src;
  const btn = el('btnSimilar');
  btn.setAttribute('aria-pressed', String(!!src));
  if (!src) return;

  const F = FEATURES && FEATURES.images;
  const ref = F && F[src] && F[src].dhash;
  if (!ref) { state.similarTo = null; btn.setAttribute('aria-pressed', 'false'); return; }

  const dist = idx => {
    let best = 64;
    for (const f of state.pool[idx].frames) {
      const h = F[f] && F[f].dhash;
      if (h) best = Math.min(best, hamm(ref, h));
    }
    return best;
  };
  const rest = state.order.slice(state.cursor);
  const scored = rest.map(i => [dist(i), i]).sort((a, b) => a[0] - b[0]);
  state.order = state.order.slice(0, state.cursor).concat(scored.map(p => p[1]));
}

function toggleSimilar() {
  if (state.similarTo) {
    setSimilar(null);
    // Restore randomness for the remainder of the pass, otherwise the ordering
    // imposed by the last similarity request would persist after switching off.
    const rest = shuffle(state.order.slice(state.cursor));
    state.order = state.order.slice(0, state.cursor).concat(rest);
  } else {
    setSimilar(state.current);
  }
}

/* ---------------------------------------------------------------- session */

/* pool, when given, is an ad hoc list of draw units built from dropped files
   (see initDropZone()) rather than the checked packs - Array.isArray() tells
   the two apart because the no-argument call from the "Start drawing" button
   below passes nothing, not because a falsy pool means anything on its own. */
/* opts.browse opens the stage as a VIEWER over an ordered list instead of a
   timed session over a shuffled one: same stage, same tools, sequential
   frames, no clock and nothing logged. Everything below that is shared is
   shared on purpose - a browse viewer that reimplemented zoom, the angle
   tool or the tonal-value split would be a second copy of the hard part. */
function startSession(pool, opts = {}) {
  const adHoc = Array.isArray(pool);
  state.pool = adHoc ? pool : buildPool();
  if (!state.pool.length) return;
  state.browse = !!opts.browse;

  state.order = state.browse
    ? [...Array(state.pool.length).keys()]
    : shuffle([...Array(state.pool.length).keys()]);
  state.cursor = 0; state.history = []; state.histPos = -1; state.drawn = 0;
  state.errors = 0; state.current = null;
  // Browsing is not drawing. Left null, stopSession() logs nothing - a
  // "session" of forty poses that were flicked past in the grid viewer would
  // make the practice log lie about what was actually drawn.
  state.startedAt = state.browse ? null : Math.floor(Date.now() / 1000);
  // Logged alongside packs so a session record could rebuild
  // #pack=<name>&secs=<n> exactly, the same link applyPackHash() already
  // knows how to read. Kept for copyLink and any future consumer. There is
  // no pack checkbox to read this from for a dropped-files session - it did
  // not come from the library at all - so it gets a name of its own instead.
  state.startPacks = adHoc ? [opts.label || 'Dropped images'] : [...new Set(
    [...document.querySelectorAll('#packs .grp:checked')].map(b => b.value.split(' / ')[0]))];
  state.startSecs = state.secs;
  setSimilar(null);
  // FEATURES, even when present, has nothing keyed by a blob: URL - a
  // dropped-files session has no similarity ranking to offer regardless of
  // whether the library behind this page does.
  el('btnSimilar').classList.toggle('hidden', !FEATURES || adHoc);

  // No schedule in browse mode: a schedule ends the session after N poses,
  // and "you have looked at twelve images, that is enough" is not a thing a
  // folder viewer gets to decide.
  const key = document.querySelector('#schedules .chip[aria-pressed="true"]')?.dataset.key || 'endless';
  state.schedule = state.browse ? null : SCHEDULES[key].steps;
  state.step = 0; state.doneInStep = 0;

  el('setup').classList.add('hidden');
  el('session').classList.remove('hidden');
  // Hides the timer bar, the clock and Pause - see #session.browse in the
  // stylesheet. Everything else in the HUD means the same thing either way.
  el('session').classList.toggle('browse', state.browse);
  applyOptions();

  if (el('optFull').checked && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  requestWakeLock();
  armHudIdle();

  if (state.browse) {
    // No interval timer at all, rather than one started and immediately
    // paused: nothing in browse mode can un-pause it, so a live tick would
    // only be a way for the clock to start running by accident.
    state.cursor = Math.min(Math.max(opts.startAt | 0, 0), state.pool.length - 1);
    state.paused = true;
    browseShow();
    return;
  }

  advance(true);
  state.tick = setInterval(onTick, 250);
}

function stopSession() {
  clearInterval(state.tick); state.tick = null;
  setMemoryPhase(null);
  setStage(null);
  clearDrawing();
  clearHudIdle();
  releaseWakeLock();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  el('session').classList.add('hidden');
  el('setup').classList.remove('hidden');
  if (state.startedAt != null) {
    logSession(state.startedAt, Math.floor(Date.now() / 1000), state.drawn, state.startPacks, state.startSecs);
    state.startedAt = null;
  }
  // Whatever was skipped during the session just spent, so the setup screen
  // must not keep showing the count from before it started.
  renderSkipInfo();
  refreshPool();
  // ...and neither must the grid, which is very likely the thing this
  // returned to and is showing those exact images.
  //
  // state.cursor indexes state.pool, which in browse mode IS gridItems (see
  // openViewer) - the grid cannot have been re-sorted underneath it while the
  // stage was covering the screen. Closing the viewer on image 300 and landing
  // on a grid still scrolled to image 12 leaves no way back but scrolling.
  const returnTo = state.browse ? state.cursor : -1;
  state.browse = false;
  el('session').classList.remove('browse');
  syncGridSkips();
  // Only when the grid is what this returned to - the 3D forms view opens the
  // same viewer in browse mode, and focusing a hidden grid would scroll it.
  if (returnTo >= 0 && !el('viewBrowse').classList.contains('hidden')) focusCell(returnTo);
}

function togglePause() {
  // Nothing to pause - there is no clock in browse mode.
  if (state.browse) return;
  state.paused = !state.paused;
  setIcon('btnPause', state.paused ? 'play' : 'pause', state.paused ? 'Resume (space)' : 'Pause (space)');
  // Held fully visible while paused (armHudIdle no-ops the timer in that
  // state); resuming restarts the idle countdown from a clean slate.
  armHudIdle();
}

/* ------------------------------------------------------------- HUD auto-hide
   #hud.idle exists in the stylesheet - opacity 0, restored on #session:hover -
   but nothing ever added that class, so the bar sat fully visible for the
   whole session regardless of activity. On a tablet propped beside the paper
   that bar covers real drawing-surface area for no reason once someone is
   mid-pose and not touching anything.

   Hidden after HUD_IDLE_MS of no activity, shown again on any pointer motion,
   touch or keypress inside #session - and held visible, with the timer
   cancelled outright, while paused: someone who stopped the clock is deciding
   something, not drawing, and the bar disappearing under them would be the one
   time it is actively unhelpful. #session:hover still forces it visible too,
   for a mouse simply resting over the stage - the two mechanisms agree, they
   just answer "recently active" in different ways for mouse and touch. */
const HUD_IDLE_MS = 3000;

function armHudIdle() {
  el('hud').classList.remove('idle');
  clearTimeout(state.hudIdleTimer);
  if (state.paused) return;
  state.hudIdleTimer = setTimeout(() => el('hud').classList.add('idle'), HUD_IDLE_MS);
}
function clearHudIdle() {
  clearTimeout(state.hudIdleTimer);
  state.hudIdleTimer = null;
  el('hud').classList.remove('idle');
}

function currentInterval() {
  if (!state.schedule) return state.secs;
  const step = state.schedule[state.step];
  return step ? step[0] : state.secs;
}

/* Advance the class schedule, if one is running. Returns false when the last
   step is complete, which ends the session rather than looping silently. */
function advanceSchedule() {
  if (!state.schedule) return true;
  state.doneInStep++;
  if (state.doneInStep >= state.schedule[state.step][1]) {
    state.step++; state.doneInStep = 0;
    if (state.step >= state.schedule.length) return false;
  }
  return true;
}

/* One non-skipped frame from a unit, or null if every frame in it has been
   skipped since the pool was built. Skipping only ever marks the single
   frame shown (see skipCurrent) - right for a rotation or dedup unit, where
   the other frames are still distinct angles/near-duplicates worth drawing -
   so a unit is only actually exhausted once every one of its frames has been
   individually skipped. The single source both advance() and preloadNext()
   call, which is what makes the two agree: before this, preloadNext() always
   warmed frames[0] while advance() picked randomly, so for any multi-frame
   unit (every rotation group, every dedup-collapsed group) the preload was
   very likely for an image that was not the one about to be shown. */
function pickFrame(unit) {
  const avail = unit.frames.filter(f => !isSkipped(f));
  return avail.length ? avail[Math.floor(Math.random() * avail.length)] : null;
}

function advance(first) {
  if (!first && !advanceSchedule()) { stopSession(); return; }

  // Skipping a pose is supposed to mean "never show this again," but
  // buildPool() - which is what skipping actually filters against - only
  // ever runs at session start. Left alone, the fixed state.pool built then
  // would still contain a since-skipped unit for the rest of a session long
  // enough to loop back around to it. Filtering per-draw here, instead of
  // rebuilding pool/order mid-session, means nextUnit()'s draw-without-
  // replacement bookkeeping never needs to know a removal happened - a fully
  // skipped unit is simply redrawn past, bounded by one pass over the pool
  // so a wholly-skipped session cannot spin forever.
  let unit, src;
  for (let tries = 0; tries < state.pool.length; tries++) {
    unit = nextUnit();
    src = (pendingPick && pendingPick.unit === unit) ? pendingPick.src : pickFrame(unit);
    pendingPick = null;
    if (src) break;
  }
  if (!src) {
    stopSession();
    el('summary').innerHTML =
      '<span class="err">Stopped: every remaining pose in this session has been skipped.</span>';
    return;
  }

  state.history.push(src);
  if (state.history.length > 200) state.history.shift();
  state.histPos = state.history.length - 1;
  state.drawn++;

  show(src);
  resetClock();
  beginMemoryStudy();
  if (!state.browse && el('optStages').checked) setStage(0);
  preloadNext();
}

/* The image actually loaded is the resized display copy when one exists, not
   the full-resolution original - many reference photos run tens of
   megapixels, and on a phone or tablet over Wi-Fi that is the difference
   between a clean interval change and a visible stall. Falls back to the
   original whenever a copy is missing.

   WebP support, detected once via canvas rather than trusted from the UA
   string, and cached for the life of the page - this runs once per session,
   not once per pose. The server encodes every display copy as both JPEG and
   WebP; the WebP twin is meaningfully smaller at the same visual quality,
   worth having when a session fetches a few of these a minute. */
const supportsWebp = (() => {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch (e) { return false; }
})();

/* Ordered, best first: the WebP display copy, then the JPEG display copy,
   then the original. show() and preloadNext() both need the exact same
   order - preloadNext() has to warm the URL show() will actually request, or
   the preload just wastes a fetch on the one it won't use. */
function displayCandidates(src) {
  const f = FEATURES && FEATURES.images[src];
  const out = [];
  if (f) {
    if (supportsWebp && f.displayWebp) out.push(f.displayWebp);
    if (f.display) out.push(f.display);
  }
  out.push(src);
  return out;
}

function show(src) {
  const img = el('img');
  const imgValue = el('imgValue');
  // Captured before state.current is overwritten below - see the ghost-
  // overlay block near the end of this function.
  const prevSrc = state.current;
  state.current = src;
  const candidates = displayCandidates(src);
  let stage = 0;
  img.style.opacity = '0';
  imgValue.style.opacity = '0';
  // #imgValue rides along on whatever URL #img settles on - same file, only
  // the CSS filter differs - so it needs no onload/onerror of its own: by
  // the time #img's onload fires the identical URL is already resolved (and
  // very likely browser-cached from preloadNext() besides).
  img.onload = () => {
    img.style.opacity = '1'; imgValue.style.opacity = '1';
    state.errors = 0;
    // A new pose is a new box - a portrait after a landscape changes the
    // rendered size of both panes' images, and with it where the grid goes -
    // and, for the armatures, which lines it draws at all.
    positionGrid();
    if (el('optGrid').checked) drawGrid();
    if (state.poseOn) runPose();
    if (state.headOn) runHead();
    if (state.edgesOn) runEdges();
    if (state.rangeOn) runRange();
    if (state.tempOn) runTemp();
    if (state.amountsOn) runAmounts();
    if (state.tangentsOn) runTangents();
    if (state.lineWeightOn) runLineWeight();
    refreshValueTools();
  };
  img.onerror = () => {
    // A display copy can be absent - or the WebP twin specifically can be,
    // since features runs are budgeted and resume across nights - while a
    // later candidate is perfectly fine. Work down the list before counting
    // a real failure.
    stage++;
    if (stage < candidates.length) {
      img.src = imgValue.src = candidates[stage];
      return;
    }
    // A missing file means the index is stale or the mount dropped. Skipping is
    // right for one bad frame - but if the volume has gone away, EVERY image
    // 404s and skip-on-error becomes an unbounded loop hammering the server a
    // few times a second. Bail out after a run of failures and say why.
    img.style.opacity = '1';
    state.errors++;
    if (state.errors >= 10) {
      stopSession();
      el('summary').innerHTML =
        '<span class="err">Stopped: 10 images in a row failed to load. ' +
        'The index is stale, or /references is not mounted.</span>';
      return;
    }
    setTimeout(() => advance(false), 150);
  };
  img.src = imgValue.src = candidates[0];

  // Flip covers both panes - see the CSS comment on #img.flip, #imgValue.flip.
  const flip = el('optFlipRandom').checked && Math.random() < 0.5;
  img.classList.toggle('flip', flip);
  imgValue.classList.toggle('flip', flip);
  syncViewButtons();

  // Browsing knows exactly where it is in a fixed list, which a shuffled
  // draw never does - so it says so, in place of the running pose count.
  el('pos').textContent = state.browse
    ? `${(state.cursor + 1).toLocaleString()} / ${state.pool.length.toLocaleString()}`
    : `#${state.drawn}` +
      (state.schedule ? `  ·  ${fmt(currentInterval())} × ${state.schedule[state.step][1] - state.doneInStep} left` : '');
  announce(state.browse ? `Image ${el('pos').textContent}` : `Pose ${state.drawn}`);

  // A new pose is a new framing - a zoom level or a measured angle from the
  // last one describes nothing about this one, and would be actively
  // misleading left on screen against a different image.
  resetZoom();
  clearAngleLine();
  clearConstruct();
  // A drawing belongs to the pose it was drawn from.
  clearDrawing();
  // A skeleton belongs to the pose it was found on - and a head to its face.
  clearPose();
  clearHead();
  clearEdges();
  clearRange();
  clearTemp();
  clearAmounts();
  clearTangents();
  clearLineWeight();
  // Previous, browsing and a new pose all start plainly visible; only
  // advance() - a fresh pose - opens a memory study, right after this.
  setMemoryPhase(null);
  setStage(null);
  el('eyedropperReadout').innerHTML = '';
  lastMixRgb = null;
  renderMixGuide(null);
  eyedropperHistory = [];
  renderEyedropperHistory();

  // Ghost overlay - see #ghostImg's own CSS comment. Uses whatever was on
  // screen a moment ago regardless of pack/rotation-group, not just within
  // one rotation set: the shuffled draw order means two consecutive poses
  // are almost never the same figure anyway, so scoping this to "only
  // within a rotation group" would make it fire so rarely it may as well
  // not exist. src is set even when the checkbox is off, so switching it on
  // works immediately without waiting for the pose after next.
  state.ghostSrc = prevSrc;
  el('ghostImg').src = prevSrc || '';
  el('ghostImg').classList.toggle('hidden', !el('optGhost').checked || !prevSrc);
  // The focal-point marker instead waits for refreshValueTools() (img's own
  // onload, just below) - it needs the new image's actual decoded pixels,
  // which are not ready yet at this point in show().
  state.focalFrac = null;
  el('focalMarker').classList.add('hidden');
}

/* One hidden decode ahead. Preloads the same URL show() will request - the
   best display copy where there is one - otherwise the preload warms the
   wrong file and the stall it exists to prevent happens anyway. */
function preloadNext() {
  if (state.cursor >= state.order.length) return;
  const unit = state.pool[state.order[state.cursor]];
  if (!unit) return;
  // Cached so advance() draws the exact frame just warmed rather than
  // re-rolling - see pickFrame(). No cache written when the unit is already
  // fully skipped; advance() will discover that itself and move past it.
  const src = pickFrame(unit);
  if (!src) return;
  pendingPick = { unit, src };
  new Image().src = displayCandidates(src)[0];
}

function resetClock() {
  state.remain = currentInterval();
  state.paused = false;
  setIcon('btnPause', 'pause', 'Pause (space)');
  el('fill').classList.remove('warn');
  el('clock').classList.remove('warn');
  paint();
}

function onTick() {
  // No timer: the tick still runs (Pause, the HUD and the schedule all read
  // from the same loop) but nothing counts down, so a pose only ever changes
  // because Next was pressed.
  const studying = state.memPhase === 'study';
  if (state.paused || (!currentInterval() && !studying)) return;
  state.remain -= 0.25;
  if (studying) {
    if (state.remain <= 0) { startMemoryDraw(); return; }
    setMemoryPhase('study');   // redraws the countdown badge
    paint();
    return;
  }
  if (state.stage !== null) {
    const total = currentInterval(), f = 1 - Math.max(state.remain, 0) / total;
    let i = MASTER_STAGES.findIndex(s => f < s.upTo);
    if (i < 0) i = MASTER_STAGES.length - 1;
    if (i !== state.stage) setStage(i);
  }
  if (state.remain <= 0) {
    if (el('optBell').checked) bell();
    // Drawing time is up: the reference comes back instead of the next pose
    // arriving - checking the drawing is the half of the exercise that teaches.
    if (state.memPhase === 'draw') { revealMemory(); return; }
    flashExpired();
    return;
  }
  paint();
}

// A brief acknowledgment - see the CSS comment on #fill.expired - instead of
// the timer bar and clock silently snapping straight to the next pose with
// no sense that time actually ran out. Purely cosmetic: advance() still
// fires off the same clock tick that would have called it directly, just
// delayed by the flash's own short, fixed duration - re-checked against
// state.tick/state.paused after that delay, in case Stop or Pause happened
// during the gap.
function flashExpired() {
  el('fill').classList.add('expired');
  el('clock').classList.add('expired');
  setTimeout(() => {
    el('fill').classList.remove('expired');
    el('clock').classList.remove('expired');
    if (state.tick && !state.paused) advance(false);
  }, 220);
}

function paint() {
  const total = state.memPhase === 'study' ? Number(el('memorySecs').value) : currentInterval();
  // A bar that would sit at 0% forever, and a clock counting down from
  // nothing, both say the wrong thing about an untimed session - so it gets
  // a full bar and a mark that means "this is not running out".
  if (!total) {
    el('fill').style.width = '100%';
    el('clock').textContent = '∞';
    el('fill').classList.remove('warn');
    el('clock').classList.remove('warn');
    return;
  }
  const pct = Math.max(0, state.remain / total * 100);
  el('fill').style.width = pct + '%';
  const secs = Math.ceil(state.remain);
  el('clock').textContent = fmt(secs);
  const warn = state.remain <= Math.min(5, total * 0.15);
  el('fill').classList.toggle('warn', warn);
  el('clock').classList.toggle('warn', warn);
}

function stepHistory(delta) {
  // Browsing has no history to step through - the list IS the order, and
  // Prev/Next walk it directly. Wrapping, so the end of a folder is not a
  // dead end you have to leave the viewer to get out of.
  if (state.browse) { browseStep(delta); return; }
  // Next while drawing from memory shows the answer, never skips it - one
  // stray keypress would otherwise throw the check away. During the study
  // it means "got it" - cover it now rather than wait out the countdown.
  if (delta > 0 && state.memPhase === 'draw') { revealMemory(); return; }
  if (delta > 0 && state.memPhase === 'study') { startMemoryDraw(); return; }
  // Next during a build-up goes to the next stage, and the clock jumps to
  // where that stage starts, so the stages that follow keep their share.
  if (delta > 0 && state.stage !== null && state.stage < MASTER_STAGES.length - 1) {
    const total = currentInterval();
    if (total) state.remain = Math.min(state.remain, total * (1 - MASTER_STAGES[state.stage].upTo));
    setStage(state.stage + 1);
    paint();
    return;
  }
  const target = state.histPos + delta;
  if (target < 0 || target >= state.history.length) {
    if (delta > 0) advance(false);
    return;
  }
  state.histPos = target;
  show(state.history[target]);
  resetClock();
}

/* ---------------------------------------------------------------- options */

function applyOptions() {
  const splitting = !!state.valueSteps;
  // #paneOrig alone already fills #stage (see the CSS comment on #stage) -
  // showing #paneValue is the only thing "entering split view" means.
  el('paneValue').classList.toggle('hidden', !splitting);
  el('imgValue').style.filter = splitting ? 'url(#valueFilter)' : '';
  el('img').classList.toggle('gray', !splitting && el('optGray').checked);
  // The HUD's Gray button, not just the setup screen's checkbox: toggling it
  // live would grayscale #paneOrig too, and #paneOrig is the one place a
  // split session still guarantees an untouched original. Squint gets the
  // exact same treatment, and for the same reason - see #img.squint's CSS
  // comment.
  el('btnGray').disabled = splitting;
  // Squint has no setup-screen checkbox to reset from the way Gray does
  // (see toggleSquint() - it's HUD-only, like Flip) - so unlike Gray's line
  // just above, this only ever forces it OFF while splitting and otherwise
  // leaves whatever toggleSquint() last set alone.
  el('btnSquint').disabled = splitting;
  if (splitting) el('img').classList.remove('squint');
  syncViewButtons();
  state.gridStyle = el('gridStyle').value;
  const wantGrid = el('optGrid').checked;
  el('grid').classList.toggle('hidden', !wantGrid);
  // The value pane's copy follows the same checkbox - see the comment on
  // #grid in the markup for why there are two.
  el('gridValue').classList.toggle('hidden', !wantGrid);
  if (el('optGrid').checked) drawGrid();
  // Read by renderAngleOverlay() for its per-line dash pattern; the actual
  // black-outlined-white recolor is pure CSS (#session.high-contrast), see
  // that rule's own comment for why the dash pattern can't also live there.
  state.highContrast = el('optHighContrast').checked;
  el('session').classList.toggle('high-contrast', state.highContrast);
  renderAngleOverlay(null); // re-render any lines already on screen in the new mode
  renderConstructOverlay(); // same, for the construction-guide overlay
  // Ghost/focal marker: toggling either checkbox takes effect immediately,
  // using whatever was already computed for the CURRENT pose - no need to
  // wait for the next one just to see the effect of a checkbox click.
  el('ghostImg').classList.toggle('hidden', !el('optGhost').checked || !state.ghostSrc);
  el('focalMarker').classList.toggle('hidden', !el('optFocalPoint').checked || !state.focalFrac);
  if (state.focalFrac) positionFocalMarker();
  // ...and the grids, which have to be re-fitted whenever the split view
  // opens or closes: #paneValue's image only gets a rendered box once its
  // pane is visible.
  positionGrid();
}

/* Keyboard-only now: 'v' cycles Off -> 2 -> 3 -> 4 -> 5 -> 6 -> Off, which is
   faster than reaching for the HUD's select with a mouse or a charcoal-dusted
   finger mid-session. The select itself (see the 'change' listener in boot())
   jumps straight to a level in one action instead - that's the point of
   having both. selectValueSteps() keeps every UI surface (setup chips, HUD
   select, drop-zone select) in step regardless of which one changed it. */
function cycleValueSteps() {
  const order = [0, ...VALUE_STEPS];
  const n = order[(order.indexOf(state.valueSteps) + 1) % order.length];
  selectValueSteps(n);
  applyOptions();
  saveSettings();
}

/* Rule-of-thirds guides. Drawn as an SVG rather than a background image so it
   scales with the stage and costs nothing to toggle. */
// Selectable guide lines under the same grid overlay/checkbox - see the
// #gridStyle select. Every style shares the same dashed center cross
// (drawGrid() appends it unconditionally); only the pair-of-lines-at-two-
// cut-points-per-axis part differs, except "diagonal" and "center" which
// don't have a symmetric pair-of-cuts shape to begin with. cuts() is the one
// bit of actual math (thirds/golden are both just "two lines mirrored around
// the middle at some percentage") shared by the two styles that do.
function cuts(p) {
  return [p, 100 - p].map(x =>
    `<line x1="${x}" y1="0" x2="${x}" y2="100" stroke="#fff" stroke-width=".25"/>` +
    `<line x1="0" y1="${x}" x2="100" y2="${x}" stroke="#fff" stroke-width=".25"/>`
  ).join('');
}
/* The classical armatures below depend on the picture's proportions - a
   reciprocal is perpendicular to a diagonal only in the real rectangle, not
   in the stretched 0..100 square the viewBox is. So they are worked out in
   a W x 1 frame (W the image's aspect ratio) and only then written into the
   viewBox, where the stretch carries them onto the image exactly. */
function gridLines(W, segs) {
  return segs.map(([x1, y1, x2, y2]) =>
    `<line x1="${x1 / W * 100}" y1="${y1 * 100}" x2="${x2 / W * 100}" y2="${y2 * 100}" stroke="#fff" stroke-width=".25"/>`).join('');
}
// From (x, y) along (dx, dy) to where it leaves the W x 1 frame.
function rayToEdge(x, y, dx, dy, W) {
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (W - x) / dx); else if (dx < 0) t = Math.min(t, -x / dx);
  if (dy > 0) t = Math.min(t, (1 - y) / dy); else if (dy < 0) t = Math.min(t, -y / dy);
  return [x, y, x + dx * t, y + dy * t];
}
const GRID_STYLES = {
  thirds: () => cuts(33.33),
  golden: () => cuts(38.2), // ~1/phi - the wider-spaced of the two classic ratios
  diagonal: () => `<line x1="0" y1="0" x2="100" y2="100" stroke="#fff" stroke-width=".25"/>` +
                  `<line x1="100" y1="0" x2="0" y2="100" stroke="#fff" stroke-width=".25"/>`,
  center: () => '',
  // Hambidge's dynamic symmetry: both diagonals, and from each remaining
  // corner the "reciprocal" - the line square to a diagonal. Where they
  // cross are the eyes of the rectangle, the strong places for a focus;
  // the lines themselves are the angles a composition can lean on.
  dynamic: W => gridLines(W, [[0, 0, W, 1], [W, 0, 0, 1],
    rayToEdge(W, 0, -1, W, W), rayToEdge(0, 1, 1, -W, W),
    rayToEdge(0, 0, 1, W, W), rayToEdge(W, 1, -1, -W, W)]),
  // The harmonic armature: the diagonals, the diamond through the middles
  // of the sides, and from each corner to the middles of the two far sides.
  armature: W => {
    const m = [[W / 2, 0], [W, 0.5], [W / 2, 1], [0, 0.5]];
    const corners = [[0, 0, [1, 2]], [W, 0, [3, 2]], [0, 1, [0, 1]], [W, 1, [0, 3]]];
    return gridLines(W, [[0, 0, W, 1], [W, 0, 0, 1],
      ...m.map((p, i) => [...p, ...m[(i + 1) % 4]]),
      ...corners.flatMap(([x, y, to]) => to.map(k => [x, y, ...m[k]]))]);
  },
  // Rabatment: the square folded in from each short side. Its inner edge is
  // a line painters have long hung the main vertical (or horizontal) on.
  rabatment: W => W >= 1
    ? gridLines(W, [[1, 0, 1, 1], [W - 1, 0, W - 1, 1]])
    : gridLines(W, [[0, W, W, W], [0, 1 - W, W, 1 - W]]),
};

function drawGrid() {
  const style = GRID_STYLES[state.gridStyle] ? state.gridStyle : 'thirds';
  const im = el('img'), aspect = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1;
  const markup = GRID_STYLES[style](aspect) +
    `<line x1="50" y1="0" x2="50" y2="100" stroke="#fff" stroke-width=".15" stroke-dasharray="2 2"/>` +
    `<line x1="0" y1="50" x2="100" y2="50" stroke="#fff" stroke-width=".15" stroke-dasharray="2 2"/>`;
  // Both panes, identically: each grid is stretched over its own pane, which
  // is the whole reason the split view needed two of them.
  for (const id of ['grid', 'gridValue']) {
    const g = el(id);
    g.setAttribute('viewBox', '0 0 100 100');
    g.innerHTML = markup;
  }
}

/* Synthesised so the page stays a single file with no audio asset to ship. */
function bell() {
  try {
    state.audio = state.audio || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = state.audio;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

/* Screen wake lock needs a secure context. This is served over plain HTTP on the
   LAN, so it will simply be unavailable in most browsers - hence the silent
   fallback rather than a warning. Tablet users: set the OS sleep timer instead. */
async function requestWakeLock() {
  try {
    if (navigator.wakeLock) state.wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}
function releaseWakeLock() {
  try { state.wakeLock?.release(); } catch {}
  state.wakeLock = null;
}

/* The lock is released BY THE BROWSER, automatically, the moment the page
   loses visibility - an app switch, a notification pulled down, the OS
   locking the screen once - and it does not come back on its own. Left
   alone, whichever of those happens first in a 30-60 minute session
   permanently loses the lock for whatever remains of it: the screen can then
   go dark mid-pose with nothing on screen to explain why. Re-requesting here
   is what makes "hidden then visible again" behave like "never lost it" -
   harmless to call when no session is running or none was ever granted,
   since requestWakeLock() itself is the one thing that decides whether it is
   available at all. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !el('session').classList.contains('hidden')) {
    requestWakeLock();
  }
});
