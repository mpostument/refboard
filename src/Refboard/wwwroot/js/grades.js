/* refboard - Pencil grade map: the picture split into areas, each for the
   grade of graphite pencil that lays down its value, with the grade written
   on it - 2H for the palest tone to 8B for the darkest accent. The same
   study as the grey markers (markers.js does the splitting), with a pencil's
   own advice: graphite is built up, never mixed, so the question is which
   lead to pick up for each part, and in what order.

   A grade's L* is the darkest tone it lays comfortably on white paper, an
   estimate (a lead differs by maker, and by paper and pressure); the
   ladder ends at 26, graphite's darkest in materials.js. A lighter touch
   always gives a lighter tone, so a soft pencil can also do a pale area -
   the grade named is the one that does the area without forcing it.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Lightest first. L: an estimate, on white paper.
const GRADES = [
  { code: '2H', name: 'hard - construction lines, the palest tone', L: 74 },
  { code: 'H', name: 'hard - light tones', L: 70 },
  { code: 'F', name: 'between H and HB', L: 66 },
  { code: 'HB', name: 'the middle - outlines, mid-tones', L: 62 },
  { code: 'B', name: 'soft - darker mid-tones', L: 57 },
  { code: '2B', name: 'soft - where shadow begins', L: 52 },
  { code: '3B', name: 'soft - shadows', L: 46 },
  { code: '4B', name: 'soft - deep shadows', L: 41 },
  { code: '5B', name: 'very soft - the darks', L: 36 },
  { code: '6B', name: 'very soft - the darks; smudges easily', L: 32 },
  { code: '7B', name: 'the softest - accents', L: 29 },
  { code: '8B', name: 'the softest - the darkest accents', L: 26 },
];
// What is in your pencil case.
const GRADE_SETS = {
  all: { chip: 'All 12', label: 'Every grade, 2H to 8B', codes: GRADES.map(g => g.code) },
  six: { chip: 'Six', label: '2H, HB, 2B, 4B, 6B, 8B', codes: ['2H', 'HB', '2B', '4B', '6B', '8B'] },
  three: { chip: 'Three', label: 'HB, 3B, 6B', codes: ['HB', '3B', '6B'] },
};
const GRADE_KEY = 'refboard.gradeSet.v1';

function gradesLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(GRADE_KEY));
    if (v && GRADE_SETS[v.set]) return { set: v.set };
  } catch { /* fall through */ }
  return { set: 'six' };
}
function gradesSave(c) {
  try { localStorage.setItem(GRADE_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

// The grades of a set, lightest first, as markersOf() takes its picks.
const gradePicks = set => GRADES.filter(g => GRADE_SETS[set].codes.includes(g.code));

/* p: stepsRead(). The same result as markersOf() - area, picks, share,
   spots, and the picture's own darkest and lightest - for these grades. */
const gradesOf = (p, { set = 'six' } = {}) => markersOf(p, { picks: gradePicks(set) });

function gradesNote(m, c) {
  const sets = Object.entries(GRADE_SETS).map(([k, s]) =>
    `<button type="button" class="chip" data-gr-set="${k}" aria-pressed="${c.set === k}" title="${esc(s.label)}">${s.chip}</button>`).join('');
  const darkest = m.picks[m.picks.length - 1];
  // The picture's own darks, against the darkest this set can lay down.
  const short = m.lo < darkest.L - 8
    ? `<br><b>Darker than graphite goes</b> - the picture's darks need more than ${esc(darkest.code)} gives; press it firmly, or finish them in charcoal or ink.` : '';
  return `<div class="tone-bar"><span>Pencils</span>${sets}</div>` +
    `<div class="mk-key">${markersKey(m)}</div>` +
    `Work from the hardest grade to the softest: soft graphite smudges under a hand, and cannot be drawn over cleanly with a hard one. ` +
    `A lighter touch is always a lighter tone - the grade is the one that does the area without forcing it.${short} ` +
    `<small>The grades' lightness is an estimate - leads differ by maker and paper.</small>`;
}

/* ---- in a session: the study over the picture, as a layer. */
let gradesRun = 0;

function clearGrades() {
  gradesRun++;
  el('gradeOverlay').classList.add('hidden');
  overlayNote('grades', state.gradesOn ? 'Choosing the pencils...' : '');
}

function toggleGrades() {
  state.gradesOn = !state.gradesOn;
  el('btnGrades').setAttribute('aria-pressed', String(state.gradesOn));
  clearGrades();
  // Two ways of reading the same values in greys: one at a time.
  if (state.gradesOn && state.markersOn) toggleMarkers();
  if (state.gradesOn) runGrades();
}

// A moment's work, so after a frame: the button shows pressed first.
function runGrades() {
  const img = el('img'), run = ++gradesRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== gradesRun || !state.gradesOn) return;
    let m;
    const c = gradesLoad();
    try { m = gradesOf(stepsRead(img), c); }
    catch (err) { console.error('grades:', err); overlayNote('grades', '<i>Could not split this picture into pencil grades.</i>'); return; }
    markersDraw(m, el('gradeOverlay')).classList.remove('hidden');
    overlayNote('grades', gradesNote(m, c));
  }, 30);
}

el('btnGrades').addEventListener('click', toggleGrades);
el('poseNote').addEventListener('click', e => {
  const s = e.target.closest('[data-gr-set]');
  if (!s || !GRADE_SETS[s.dataset.grSet]) return;
  gradesSave({ set: s.dataset.grSet });
  runGrades();
});
