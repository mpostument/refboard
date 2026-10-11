/* refboard - Presets by medium: a kind of session in one press.
   "Liner sketch, 5 minutes", "watercolour study, 45 minutes with stages",
   "pencil value study, 20 minutes": each sets what the Timing tab would
   (the interval or a schedule, build-up stages, grayscale), switches on the
   overlays that kind of work wants when the session starts, and says in a
   sentence or two what to do with the time.

   A preset is not a mode of its own. It only moves the controls that were
   already there, so every other control stays editable and nothing needs to
   know a preset exists: which one is "on" is worked out from the controls
   (presetMatching()) rather than remembered, and moves off the moment any of
   them is changed by hand. The overlays are the one thing the controls cannot
   say, so they are applied at the start of a session (presetStart(), called by
   startSession()) when the controls still match a preset.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* secs: the interval (a PRESETS value, or any number of seconds); schedule:
   a SCHEDULES key; stages, gray: the checkboxes; layers: ids from LAYERS
   (layers.js) to switch on when the session starts. No two presets share the
   same secs, schedule, stages and gray - that is how one is told from another. */
const SESSION_PRESETS = [
  { id: 'gesture', label: 'Gesture warm-up', when: '30 s to 5 min', secs: 60, schedule: 'warmup', stages: false, gray: false, layers: [],
    advice: 'Shortest first: only the line of action and the big masses. Do not lift the pen to fix anything - the next pose is already coming.' },
  { id: 'liner', label: 'Liner sketch', when: '5 min', secs: 300, schedule: 'endless', stages: false, gray: false, layers: ['lineweight'],
    advice: 'Contour first, then weight: heavy on the shadow side and the undersides, light on the lit side and for small inner lines. A liner cannot be erased, so draw the big lines once and let them stand.' },
  { id: 'pencil', label: 'Pencil value study', when: '20 min', secs: 1200, schedule: 'endless', stages: false, gray: true, layers: ['grades'],
    advice: 'In grey, so only value counts. Block in the big masses with HB, then go from the hardest grade the picture wants to the softest, lightest first - the grade map says which pencil each area takes.' },
  { id: 'hatching', label: 'Hatching study', when: '20 min', secs: 1200, schedule: 'endless', stages: false, gray: false, layers: ['hatch'],
    advice: 'For a liner or a ballpoint, which build value only by line. Lay the first direction over everything that is not bare paper, then cross it where the numbers rise. Keep the whites - they cannot be put back.' },
  { id: 'inkwash', label: 'Ink wash study', when: '30 min', secs: 1800, schedule: 'endless', stages: false, gray: true, layers: ['jars'],
    advice: 'Mix the jars first - the note says how to thin each - and try them on scrap paper. Then paint from the lightest jar to the darkest, each area with its own, and let each wash dry before the next touches it.' },
  { id: 'watercolour', label: 'Watercolour study', when: '45 min, in stages', secs: 2700, schedule: 'endless', stages: true, gray: false, layers: ['range'],
    advice: 'The time is shared between the stages - two masses of light and dark, three values, soft colour, then everything; the right arrow goes on to the next. The paper\'s range shows which lights and darks your paper cannot tell apart: keep the lights for the paper.' },
];

// The controls as they stand: { secs, schedule, stages, gray }.
function presetControls() {
  return {
    secs: state.secs,
    schedule: document.querySelector('#schedules .chip[aria-pressed="true"]')?.dataset.key || 'endless',
    stages: el('optStages').checked,
    gray: el('optGray').checked,
  };
}

// The preset the controls say, or null.
function presetMatching(c = presetControls()) {
  return SESSION_PRESETS.find(p => p.secs === c.secs && p.schedule === c.schedule && p.stages === c.stages && p.gray === c.gray) || null;
}

// Press the controls the way a hand would, so the settings are saved and every
// listener (stages against memory, the schedule's hint) runs as usual.
function presetApply(p) {
  const schedule = document.querySelector(`#schedules .chip[data-key="${p.schedule}"]`);
  if (schedule) schedule.click();
  const at = PRESETS.indexOf(p.secs);
  if (at >= 0) el('intervals').children[at].click();
  else { el('customSecs').value = p.secs; el('customSecs').dispatchEvent(new Event('input', { bubbles: true })); }
  for (const [id, want] of [['optStages', p.stages], ['optGray', p.gray]]) {
    if (el(id).checked !== want) { el(id).checked = want; el(id).dispatchEvent(new Event('change', { bubbles: true })); }
  }
  presetSync();
}

function presetsRender() {
  el('sessionPresets').innerHTML = SESSION_PRESETS.map(p =>
    `<button type="button" class="chip" data-preset="${p.id}" aria-pressed="false" title="${esc(p.advice)}">${esc(p.label)} <small>${esc(p.when)}</small></button>`).join('');
}

// The chips and the hint follow the controls.
function presetSync() {
  const on = presetMatching();
  for (const b of el('sessionPresets').children) b.setAttribute('aria-pressed', String(b.dataset.preset === on?.id));
  el('presetHint').textContent = on
    ? on.advice + (on.gray ? ' Grayscale is on (Display tab).' : '') + (on.layers.length ? ' The ' + on.layers.map(id => LAYERS.find(l => l.id === id)?.label.toLowerCase()).filter(Boolean).join(' and ') + ' will be on when you start.' : '')
    : 'Pick a kind of session to set the interval and what it needs - you can change anything after.';
}

// Called as a session starts: the overlays of the preset the controls still say.
function presetStart() {
  const p = presetMatching();
  if (!p || state.browse) return;
  for (const id of p.layers) {
    const layer = LAYERS.find(l => l.id === id);
    if (layer && !layer.on()) layer.toggle();
  }
}

presetsRender();
el('sessionPresets').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]');
  const p = b && SESSION_PRESETS.find(x => x.id === b.dataset.preset);
  if (p) presetApply(p);
});
// Any hand on the controls moves the preset off, or on to another that matches.
for (const id of ['intervals', 'schedules']) el(id).addEventListener('click', () => setTimeout(presetSync, 0));
el('customSecs').addEventListener('input', () => setTimeout(presetSync, 0));
for (const id of ['optStages', 'optGray']) el(id).addEventListener('change', () => setTimeout(presetSync, 0));
