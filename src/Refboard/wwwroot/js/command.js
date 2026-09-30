/* refboard - Find a tool (Ctrl+K). Type a few letters of what you want -
   "loomis", "green", "flip" - and go straight to it, from anywhere.

   Most commands are not listed here but read off the page when the box
   opens: in a session, every button and every choice in the HUD; outside
   one, every section on the rail. A new button in either place is findable
   with no change to this file. What is listed here is what has no button:
   the trainers, the themes, and the extra words a tool is known by. */
"use strict";

// The words each build (FIGURE_BUILDS) is looked for by - the pose's and the 3D figure's.
const BUILD_WORDS = { real: 'eight realistic', anime: 'seven', tall: 'long legs fashion nine', chibi: 'sd super deformed cute small' };
// The 3D camera's anime shots (ANIME_SHOTS, in the 3D view's own code, which
// loads only when the view opens - so named here too), with their words.
const SHOT_COMMANDS = [
  ['worm', "Worm's eye", 'low from below floor looking up heroic menacing'],
  ['bird', "Bird's eye", 'high from above overhead top down'],
  ['wide', 'Wide, close', 'wide angle lens foreshortening close up punch action'],
  ['dutch', 'Dutch angle', 'tilted canted roll horizon'],
  ['tele', 'Telephoto', 'long lens flat compressed far'],
  ['fish', 'Fisheye', 'fish eye distortion curved bent lens'],
];
// Other words a tool is looked for by, keyed by its element's id.
const COMMAND_WORDS = {
  btnHead: 'face construction ball thirds loomis anime eyes',
  btnPose: 'skeleton gesture figure body weight',
  btnEdges: 'hard soft lost edges wet in wet dry watercolour sharp blur',
  btnAmounts: 'unequal amounts dominant proportion light middle dark warm cool hard soft edges 60 30 10 composition balance',
  btnTemp: 'temperature warm cool colour color shadow light turn hue cel shading',
  btnRange: 'paper range darkest darks lights white clipped blown lost detail values limit medium contrast',
  btnEyedropper: 'colour color picker sample pipette mix recipe paint watercolour',
  btnCompare: 'overlay my drawing check photo',
  btnAngle: 'measure proportion line',
  btnGray: 'greyscale value black white',
  btnSquint: 'blur big shapes',
  btnInfo: 'histogram dominant colours palette',
  btnSkip: 'never again hide',
  btnStop: 'end quit exit',
  btnPause: 'resume timer',
  constructSelect: 'guide perspective',
  valueSelect: 'notan tone value levels',
  'view-dashboard': 'home start',
  'view-all': 'browse grid images search',
  'view-drop': 'open file upload photo check own image video',
  'view-forms': '3d model mannequin head asaro planes light shadow anime cel toon shading hair',
  'view-colour': 'palette wheel gamut mask mix recipe paint watercolour green red blue yellow',
  'view-palette': 'palette generator colours harmony scheme swatches coolors complementary analogous triadic random lock hex',
  'view-train': 'drill practice exercise test',
  btnLibrary: 'folders packs',
  btnPaint: 'session timed timer draw go begin',
  btnMaterials: 'medium media watercolour ink liner ballpoint pen pencil marker graphite gouache oil acrylic',
  btnMoreTools: 'pin toolbar customise',
  btnWorkspace: 'panel tabs value colour construction figure my work question',
  btnLayers: 'overlays opacity visibility stack ghost focal grid',
};

const COMMAND_RECENT_KEY = 'refboard.commandRecent.v1';
let commandList = [], commandSel = 0;

function commandRecent() {
  try { return JSON.parse(localStorage.getItem(COMMAND_RECENT_KEY)) || []; } catch { return []; }
}

// A button's own name, and the shortcut from its title: "Flip (f)" -> f.
const commandKey = title => ((title || '').match(/\(([^)]{1,9})\)/) || [])[1] || '';

/* Everything that can be done from where you are now, as
   { id, label, hint, words, run }. */
function collectCommands() {
  const out = [], inSession = !el('session').classList.contains('hidden');
  // Shown, or waiting under More (js/pins.js) - an unpinned tool is still
  // one to find.
  const visible = n => !n.disabled && !n.classList.contains('hidden')
    && (n.offsetParent !== null || !!n.closest('#hudMoreList'));
  if (inSession) {
    for (const b of el('hud').querySelectorAll('button[id]')) {
      if (!visible(b) || ['btnHelpHud', 'btnFindHud', 'hudPinReset'].includes(b.id)) continue;
      // A button's name; failing that, its title up to the shortcut - the
      // zoom reset's text is only "100%".
      const label = b.getAttribute('aria-label') || b.title.split(/[(:]/)[0].trim() || b.textContent.trim();
      out.push({ id: b.id, label, hint: commandKey(b.title), words: COMMAND_WORDS[b.id] || '', run: () => b.click() });
    }
    for (const s of el('hud').querySelectorAll('select[id]')) {
      if (!visible(s)) continue;
      for (const o of s.options) {
        if (o.value === s.value) continue;
        out.push({
          id: `${s.id}:${o.value}`, label: o.textContent.trim(), hint: commandKey(s.title),
          words: COMMAND_WORDS[s.id] || '',
          run: () => { s.value = o.value; s.dispatchEvent(new Event('change')); },
        });
      }
    }
    out.push(...layerCommands());
    out.push({ id: 'btnMaterials', label: 'My materials', hint: 'Medium', words: COMMAND_WORDS.btnMaterials, run: openMaterials });
    out.push({ id: 'steps', label: 'How to draw it', hint: 'Learn', words: 'steps stages guide tutorial learn order sketch hatching wash',
      run: () => openSteps(state.current) });
    // The head construction in either style - turned on too, if it is off.
    for (const [k, label] of Object.entries(HEAD_STYLES)) {
      if (state.headOn && k === headStyle) continue;
      out.push({
        id: 'head-' + k, label: 'Head construction: ' + label, hint: 'L',
        words: k === 'anime' ? 'face manga eyes chin' : 'face thirds ball',
        run: () => { setHeadStyle(k); if (!state.headOn) toggleHead(); },
      });
    }
    // And the anime face with each of the other eye styles (the one in use
    // is the plain Anime above) - named as that one's variants, so "anime"
    // still finds the head first.
    for (const [k, e] of Object.entries(ANIME_EYES)) {
      if (k === headEyes) continue;
      out.push({
        id: 'head-eyes-' + k, label: `Head construction: Anime, ${e.label} eyes`, hint: 'L',
        words: 'eye iris lashes gleam highlight manga ' + { shojo: 'shojo shoujo sparkle', sharp: 'tsurime narrow', soft: 'tareme round ghibli', tv: 'tv standard' }[k],
        run: () => { setHeadEyes(k); setHeadStyle('anime'); if (!state.headOn) toggleHead(); },
      });
    }
    // The pose skeleton in each build (FIGURE_BUILDS) - turned on too.
    for (const [k, b] of Object.entries(FIGURE_BUILDS)) {
      if (state.poseOn && k === poseBuild) continue;
      out.push({
        id: 'pose-build-' + k, label: k === 'real' ? 'Pose skeleton: as photographed' : `Pose skeleton: ${b.label} proportions`, hint: 'P',
        words: 'figure body heads anime redraw ' + BUILD_WORDS[k],
        run: () => { setPoseBuild(k); if (!state.poseOn) togglePose(); },
      });
    }
  } else {
    for (const b of el('rail').querySelectorAll('button')) {
      // A section you hid (js/stages.js) is off the rail, not out of reach.
      const hid = b.classList.contains('user-hidden') && !b.classList.contains('hidden');
      if ((!hid && !visible(b)) || b.id === 'btnFind') continue;
      const id = b.dataset.view ? 'view-' + b.dataset.view : b.id;
      // Its stage is its hint, and a word it is found by: "paint" lists the Paint group.
      const stage = b.closest('.rail-stage')?.dataset.stage;
      out.push({
        id, label: b.dataset.tip || b.getAttribute('aria-label'), hint: (stage || 'Section') + (hid ? ' · hidden' : ''),
        words: `${COMMAND_WORDS[id] || ''} ${stage || ''}`, run: () => b.click(),
      });
    }
    for (const t of TRAINERS) {
      out.push({
        id: 'train-' + t.id, label: t.title + ' trainer', hint: 'Train', words: 'drill practice ' + (t.blurb || ''),
        run: () => { setView({ kind: 'train' }); startTrainer(t.id); },
      });
    }
  }
  for (const [id, t] of Object.entries(allThemes())) {
    if (id !== themeId()) out.push({ id: 'theme-' + id, label: 'Theme: ' + t.label, hint: 'Appearance', words: 'colours dark light', run: () => setTheme(id) });
  }
  if (!inSession) out.push({ id: 'character', label: 'Character sheet', hint: 'Colour studio', words: 'hair skin eyes clothes palette recipe mix anime oc model sheet',
    run: () => openColour('character') });
  if (!inSession) out.push({ id: 'anime-head-3d', label: 'Anime head in 3D', hint: '3D forms', words: 'face eyes iris lashes turn angle three-quarter manga model hair ring locks fringe bangs',
    run: () => openForms(() => showAnimeHead()) });
  // Its expressions, each by name - and all of them at once, as a sheet.
  if (!inSession) {
    for (const [k, x] of Object.entries(ANIME_EXPRESSIONS)) if (k !== 'calm') out.push({
      id: 'anime-expr-' + k, label: `Anime head in 3D: ${x.label}`, hint: '3D forms',
      words: 'expression emotion face feeling ' + { joy: 'happy smile laugh blush', anger: 'angry mad rage vein', surprise: 'shock surprised wide', sadness: 'sad cry tears crying' }[k],
      run: () => openForms(() => showAnimeHead(undefined, k)) });
    // The figure in each of its proportions, with the heads grid.
    for (const [k, b] of Object.entries(FIGURE_BUILDS)) out.push({
      id: 'figure-build-' + k, label: `Figure in 3D: ${b.label}`, hint: '3D forms',
      words: 'proportions heads tall body mannequin grid anime ' + BUILD_WORDS[k],
      run: () => openForms(() => showFigureBuild(k)) });
    for (const [k, label, words] of SHOT_COMMANDS) out.push({
      id: 'anime-shot-' + k, label: `3D camera: ${label}`, hint: '3D forms', words: 'anime shot angle camera storyboard ' + words,
      run: () => openForms(() => showAnimeShot(k)) });
    out.push({ id: 'anime-expr-sheet', label: 'Expression sheet', hint: '3D forms', words: 'expressions emotions faces anime head model sheet joy anger surprise sadness',
      run: () => openForms(async () => { showAnimeHead(); await formsReady(); openExpressionSheet(); }) });
  }
  out.push({ id: 'theme-editor', label: 'Theme editor', hint: 'Appearance', words: 'colours customise custom own import export', run: openThemeEditor });
  out.push({ id: 'help', label: 'Help - how everything works', hint: '?', words: 'manual guide', run: toggleHelp });
  out.push({ id: 'tour', label: 'Tour - where things are', hint: 'Help', words: 'intro start new guide walkthrough', run: startTour });
  out.push({ id: 'whats-new', label: "What's new", hint: 'Help', words: 'news update latest features changes', run: () => openNews() });
  out.push({ id: 'your-data', label: 'Your data - back up and restore', hint: 'Data', words: 'backup restore export import uploads saved keep zip', run: openData });
  return out;
}

/* Best first: the name starting with what was typed, then a word in the
   name starting with it, then anywhere in the name, then only in the extra
   words. Every typed word has to be found somewhere. With nothing typed,
   the ones used last come first. */
function rankCommands(all, query) {
  const recent = commandRecent();
  const q = query.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
  if (!words.length) {
    const r = id => { const i = recent.indexOf(id); return i < 0 ? recent.length : i; };
    return [...all].sort((a, b) => r(a.id) - r(b.id));
  }
  const scored = [];
  for (const c of all) {
    const label = c.label.toLowerCase(), hay = `${label} ${c.hint} ${c.words}`.toLowerCase();
    if (!words.every(w => hay.includes(w))) continue;
    const score = label.startsWith(q) ? 0 : label.split(/[^a-z0-9]+/).some(w => w.startsWith(words[0])) ? 1 : label.includes(q) ? 2 : 3;
    scored.push([score, c]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(s => s[1]);
}

function renderCommands() {
  commandList = rankCommands(collectCommands(), el('cmdkInput').value).slice(0, 12);
  commandSel = Math.min(commandSel, Math.max(0, commandList.length - 1));
  el('cmdkList').innerHTML = commandList.length ? commandList.map((c, i) =>
    `<li role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === commandSel}">` +
    `<span>${esc(c.label)}</span>${c.hint ? `<kbd>${esc(c.hint)}</kbd>` : ''}</li>`).join('')
    : '<li class="cmdk-none">Nothing by that name here.</li>';
  el('cmdkInput').setAttribute('aria-activedescendant', commandList.length ? `cmdk-${commandSel}` : '');
  el('cmdk-' + commandSel)?.scrollIntoView({ block: 'nearest' });
}

let commandReturnFocus = null;
function openCommands() {
  if (!el('helpOverlay').classList.contains('hidden')) toggleHelp();
  commandReturnFocus = document.activeElement;
  el('cmdk').classList.remove('hidden');
  el('cmdkInput').value = '';
  commandSel = 0;
  renderCommands();
  el('cmdkInput').focus();
}

function closeCommands() {
  el('cmdk').classList.add('hidden');
  commandReturnFocus?.focus?.();
}

function runCommand(c) {
  if (!c) return;
  const recent = commandRecent().filter(id => id !== c.id);
  recent.unshift(c.id);
  try { localStorage.setItem(COMMAND_RECENT_KEY, JSON.stringify(recent.slice(0, 8))); } catch { /* private mode */ }
  commandReturnFocus = null;
  closeCommands();
  c.run();
}

function initCommands() {
  const input = el('cmdkInput');
  input.addEventListener('input', () => { commandSel = 0; renderCommands(); });
  // Every key typed here stays here: the session, the 3D view and the
  // trainers all listen on the document for single letters, and "flip"
  // typed into this box must not also flip the picture.
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeCommands(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!commandList.length) return;
      commandSel = (commandSel + (e.key === 'ArrowDown' ? 1 : commandList.length - 1)) % commandList.length;
      renderCommands();
    } else if (e.key === 'Enter') { e.preventDefault(); runCommand(commandList[commandSel]); }
  });
  el('cmdkList').addEventListener('click', e => {
    const li = e.target.closest('[data-i]');
    if (li) runCommand(commandList[Number(li.dataset.i)]);
  });
  el('cmdk').addEventListener('pointerdown', e => { if (e.target === el('cmdk')) closeCommands(); });
  el('btnFind').addEventListener('click', openCommands);
  el('btnFindHud').addEventListener('click', openCommands);
  // Capture phase, so it is seen before any other shortcut handler. By
  // e.code, the physical key: on a Ukrainian layout e.key is 'л'.
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK') {
      e.preventDefault(); e.stopPropagation();
      if (el('cmdk').classList.contains('hidden')) openCommands(); else closeCommands();
    }
  }, true);
}
initCommands();
