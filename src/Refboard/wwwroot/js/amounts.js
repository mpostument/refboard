/* refboard - Unequal amounts: how much of the picture is light, middle and
   dark, warm and cool, hard-edged and soft - and whether one of each is in
   charge. A picture with a dominant (60/30/10, say) reads as meant; light,
   middle and dark in equal thirds read as indecision, however well each
   part is painted. For a reference, before painting it, and for a photo of
   your own work, after.

   Not a map of its own: the three maps it counts already exist - the value
   split (v), the temperature map (t), the edge map (x) - and each bar's
   "Where?" turns the one it counts on. It reads the picture once and hands
   the same reading to all three counts.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Percentage points between the largest amount and the next: this much or
// more is a clear lead, less than AMT_CLOSE is a tie.
const AMT_LEAD = 20, AMT_CLOSE = 10;
// Less than this share of the picture warm or cool together: a grey
// picture, where temperature is not what it is about.
const AMT_COLOURED = 25;

/* The amounts, in percent. p: stepsRead(). value: dark, middle, light - the
   luma thirds that "v" at 3 shows, so the bar and the split agree; temp:
   warm, neutral, cool, absolute (a warm light is a warm picture - for
   amounts it is the dominant, not something to subtract); edges: hard,
   soft, of the edges there are, or null when there are none. */
function amountsOf(p) {
  const { w, h, rgba } = p, n = w * h;
  // Masses, not pixels: a painter counts areas.
  const Y = new Float32Array(n);
  for (let i = 0; i < n; i++) Y[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255;
  const lum = stepsBlur(Y, w, h, Math.max(1, Math.max(w, h) / 200));
  const value = [0, 0, 0];
  for (let i = 0; i < n; i++) value[Math.min(2, Math.floor(lum[i] * 3))]++;

  const t = tempMap(p), temp = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const v = t.rel[i] + t.cast;
    temp[v >= TEMP_MIN ? 0 : v <= -TEMP_MIN ? 2 : 1]++;
  }

  const e = edgeMap(p), all = e.hard + e.soft;
  const pct = a => a.map(v => v / n * 100);
  return { value: pct(value), temp: pct(temp), edges: all ? [e.hard / all * 100, e.soft / all * 100] : null };
}

// Which amount leads, and by how much: 'lead' (a clear dominant), 'lean'
// or 'tie'. i: its index in the list given.
function amountsLead(list) {
  const order = list.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const gap = order[0][0] - order[1][0];
  return { i: order[0][1], gap, kind: gap >= AMT_LEAD ? 'lead' : gap < AMT_CLOSE ? 'tie' : 'lean' };
}

/* What each count says, for someone about to paint it (or looking at what
   they painted). One sentence per question; a tie says what to push. */
function amountsVerdict(a) {
  const out = {};
  const v = amountsLead(a.value), vn = ['dark', 'middle', 'light'][v.i];
  if (v.kind === 'tie') {
    out.value = 'Light, middle and dark in about equal amounts - it reads as undecided. Let one lead: merge some middle into the dark, or into the light.';
  } else {
    const key = { dark: 'A low-key picture - night, mood, a lamp in the dark. Keep the lights few and small: they are the point.',
      middle: 'Calm and even - the few real lights and darks are where the eye goes, so put them where the picture is about.',
      light: 'A high-key picture - air, morning, a sunlit wash. Keep the darks few and small: they are the accents.' }[vn];
    out.value = `${v.kind === 'lead' ? 'The' : 'Leaning to the'} ${vn} leads${v.kind === 'lean' ? ', but not by much' : ''}. ${key}`;
  }

  const [warm, , cool] = a.temp;
  if (warm + cool < AMT_COLOURED) {
    out.temp = 'Mostly neutral - temperature is not what this picture is about. A small warm or cool accent would stand out.';
  } else {
    const tl = amountsLead([warm, cool]);
    out.temp = tl.kind === 'tie'
      ? 'As much warm as cool - neither light wins. Let one temperature take the big areas and keep the other for accents.'
      : `${tl.i ? 'Cool' : 'Warm'} ${tl.kind === 'lead' ? 'dominates' : 'leads, a little'} - the ${tl.i ? 'warm' : 'cool'} is the accent${tl.kind === 'lead' ? '' : '; pushing it smaller would make it sing'}.`;
  }

  if (!a.edges) out.edges = 'No edge here is strong enough to count.';
  else {
    const ed = amountsLead(a.edges);
    out.edges = ed.kind === 'tie'
      ? 'Hard and soft edges in about equal numbers - the eye has nowhere to settle. Soften most, and keep hard edges where you want it to go.'
      : ed.i ? 'Soft edges dominate - the few hard ones pull the eye, so they belong at the focus.'
        : 'Hard edges dominate - crisp, graphic, the cel-shaded look. A few soft ones (a cheek, a far shape) will turn the form.';
  }
  return out;
}

/* ---- in a session: the counts in the shared note. */
let amountsRun = 0;

// Each row: its parts, their bar colours, and which map shows where.
const AMT_ROWS = [
  { id: 'value', label: 'Value', parts: ['dark', 'middle', 'light'], cls: ['amt-d', 'amt-m', 'amt-l'],
    where: () => { if (state.valueSteps !== 3) { selectValueSteps(3); applyOptions(); saveSettings(); } } },
  { id: 'temp', label: 'Temperature', parts: ['warm', 'neutral', 'cool'], cls: ['amt-w', 'amt-n', 'amt-c'],
    where: () => { if (!state.tempOn) toggleTemp(); } },
  { id: 'edges', label: 'Edges', parts: ['hard', 'soft'], cls: ['amt-h', 'amt-s'],
    where: () => { if (!state.edgesOn) toggleEdges(); } },
];

function amountsHtml(a) {
  const say = amountsVerdict(a);
  return AMT_ROWS.map(r => {
    const vals = a[r.id];
    const bar = vals
      ? `<span class="amt-bar" role="img" aria-label="${r.parts.map((p, i) => `${p} ${Math.round(vals[i])}%`).join(', ')}">` +
        vals.map((v, i) => `<i class="${r.cls[i]}" style="width:${v.toFixed(1)}%" title="${r.parts[i]} ${Math.round(v)}%"></i>`).join('') + '</span>'
      : '<span class="amt-bar"></span>';
    const nums = vals ? r.parts.map((p, i) => `${p} ${Math.round(vals[i])}%`).join(' · ') : '';
    return `<div class="amt-row"><b>${r.label}</b>${bar}<button type="button" class="amt-where" data-amt-where="${r.id}" ` +
      `title="Show where, on the picture">Where?</button><small>${nums}</small><span class="amt-say">${esc(say[r.id])}</span></div>`;
  }).join('');
}

function clearAmounts() {
  amountsRun++;
  overlayNote('amounts', state.amountsOn ? 'Counting...' : '');
}

function toggleAmounts() {
  state.amountsOn = !state.amountsOn;
  el('btnAmounts').setAttribute('aria-pressed', String(state.amountsOn));
  clearAmounts();
  if (state.amountsOn) runAmounts();
}

// A moment's work (the edge map is most of it), so after a frame.
function runAmounts() {
  const img = el('img'), run = ++amountsRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== amountsRun || !state.amountsOn) return;
    let a;
    try { a = amountsOf(stepsRead(img)); }
    catch (err) { console.error('amounts:', err); overlayNote('amounts', '<i>Could not count this picture.</i>'); return; }
    overlayNote('amounts', amountsHtml(a));
  }, 30);
}

el('btnAmounts').addEventListener('click', toggleAmounts);
el('poseNote').addEventListener('click', e => {
  const b = e.target.closest('[data-amt-where]');
  if (b) AMT_ROWS.find(r => r.id === b.dataset.amtWhere).where();
});
