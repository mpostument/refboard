/* refboard - Unequal amounts: how much of the picture is light, middle and
   dark, warm and cool, bright and greyed, big shapes and small, hard-edged
   and soft - and whether one of each is in charge. A picture with a dominant
   (60/30/10, say) reads as meant; light, middle and dark in equal thirds
   read as indecision, however well each part is painted. For a reference,
   before painting it, and for a photo of your own work, after.

   Value, temperature and edges are not maps of their own: those three maps
   already exist - the value split (v), the temperature map (t), the edge map
   (x) - and each bar's "Where?" turns the one it counts on. Colour and
   shapes have one of their own (#amtOverlay), drawn here. It reads the
   picture once and hands the same reading to every count.

   And the same counts inside a crop: where the whole picture has no leader
   (a tie, or a lean), some part of it may - one of nine windows, the halves,
   the quarters, the middle - and that is the crop where the picture is
   decided. It is offered, and the viewfinder (c, Frame) can try it.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Percentage points between the largest amount and the next: this much or
// more is a clear lead, less than AMT_CLOSE is a tie.
const AMT_LEAD = 20, AMT_CLOSE = 10;
// Less than this share of the picture warm or cool together: a grey
// picture, where temperature is not what it is about.
const AMT_COLOURED = 25;
// Colour is OKLab chroma over an area: this much is bright, less than the
// second is greyed (a paper white, a grey wash), between is muted - the
// colour a painter mixes most. A strong orange is 0.14, a sage green 0.05.
const AMT_BRIGHT = 0.10, AMT_GREYED = 0.03;
// A shape is a connected area of one value third; of this share of the
// picture or more it is big, less than the second it is small.
const AMT_BIG = 4, AMT_SMALL = 0.4;
// Fewer edge pixels than this inside a crop: nothing to count.
const AMT_EDGE_MIN = 40;

/* A class map with what is thinner than a window taken out: each class
   opened - eroded (a pixel stays only if every pixel in the window round it
   is of its class) and grown back - which leaves the bodies of the shapes
   and loses the strips between them. A blurred edge between a dark and a
   light area has a strip of 'middle' along it, and the strips of a whole
   picture join into one huge middle shape that is no shape at all; a painter
   sees masses. What is lost is class 3, 'none': counted as no shape, not as
   a small one. Windows are counted by summed-area tables, so they cost the
   same however big. */
function amountsSat(mask, w, h) {
  const W = w + 1, sat = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) { run += mask[y * w + x]; sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + run; }
  }
  return sat;
}
// How much of the mask is in the window of radius R round (x, y), and how big
// the window is (it is cut short at the picture's edge).
function amountsWindow(sat, w, h, x, y, R) {
  const W = w + 1, x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
  return [sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0], (x1 - x0) * (y1 - y0)];
}
function amountsOpen(cls, w, h, R) {
  const n = w * h, out = new Uint8Array(n).fill(3), mask = new Uint8Array(n), core = new Uint8Array(n);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < n; i++) mask[i] = cls[i] === k ? 1 : 0;
    const sat = amountsSat(mask, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [c, area] = amountsWindow(sat, w, h, x, y, R);
      core[y * w + x] = c === area ? 1 : 0;
    }
    const grown = amountsSat(core, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cls[y * w + x] === k && amountsWindow(grown, w, h, x, y, R)[0] > 0) out[y * w + x] = k;
    }
  }
  return out;
}

/* The amounts, in percent. p: stepsRead(). value: dark, middle, light - the
   luma thirds that "v" at 3 shows, so the bar and the split agree; temp:
   warm, neutral, cool, absolute (a warm light is a warm picture - for
   amounts it is the dominant, not something to subtract); colour: bright,
   muted, grey; size: big, medium, small shapes; edges: hard, soft, of the
   edges there are, or null when there are none.
   Behind them, not listed when it is copied or sent anywhere, the class of
   every pixel for each (maps) and the size it was read at - what the crops
   and the colour and shape maps are made from. */
function amountsOf(p) {
  const { w, h, rgba } = p, n = w * h;
  // Masses, not pixels: a painter counts areas.
  const Y = new Float32Array(n);
  for (let i = 0; i < n; i++) Y[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255;
  const r = Math.max(1, Math.max(w, h) / 200);
  const lum = stepsBlur(Y, w, h, r);
  const value = [0, 0, 0], valueMap = new Uint8Array(n);
  for (let i = 0; i < n; i++) value[valueMap[i] = Math.min(2, Math.floor(lum[i] * 3))]++;

  const t = tempMap(p), temp = [0, 0, 0], tempCls = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = t.rel[i] + t.cast;
    temp[tempCls[i] = v >= TEMP_MIN ? 0 : v <= -TEMP_MIN ? 2 : 1]++;
  }

  // Colour: how far from grey, over areas.
  const C = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [, a, b] = linToOklab(TEMP_LIN[rgba[4 * i]], TEMP_LIN[rgba[4 * i + 1]], TEMP_LIN[rgba[4 * i + 2]]);
    C[i] = Math.hypot(a, b);
  }
  const chroma = stepsBlur(C, w, h, r), colour = [0, 0, 0], colourMap = new Uint8Array(n);
  for (let i = 0; i < n; i++) colour[colourMap[i] = chroma[i] >= AMT_BRIGHT ? 0 : chroma[i] < AMT_GREYED ? 2 : 1]++;

  // Shapes: the picture blurred harder, in its three values, each connected
  // area of one value a shape - and how much of the picture is in big ones.
  const mass = stepsBlur(Y, w, h, Math.max(2, Math.max(w, h) / 90)), thirds = new Uint8Array(n);
  for (let i = 0; i < n; i++) thirds[i] = Math.min(2, Math.floor(mass[i] * 3));
  const cls = amountsOpen(thirds, w, h, Math.max(2, Math.round(Math.max(w, h) / 150)));
  const size = [0, 0, 0], sizeMap = new Uint8Array(n).fill(3), seen = new Uint8Array(n), stack = new Int32Array(n), part = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (seen[s] || cls[s] === 3) continue;
    let top = 0, len = 0;
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top], x = i % w;
      part[len++] = i;
      if (x > 0 && !seen[i - 1] && cls[i - 1] === cls[s]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !seen[i + 1] && cls[i + 1] === cls[s]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (i >= w && !seen[i - w] && cls[i - w] === cls[s]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (i + w < n && !seen[i + w] && cls[i + w] === cls[s]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    const share = len / n * 100, k = share >= AMT_BIG ? 0 : share < AMT_SMALL ? 2 : 1;
    for (let j = 0; j < len; j++) sizeMap[part[j]] = k;
    size[k] += len;
  }

  const e = edgeMap(p), all = e.hard + e.soft;
  const pct = a => a.map(v => v / n * 100);
  // Of the picture that is in a shape at all: the strips between are in none.
  const inShape = size[0] + size[1] + size[2];
  const out = { value: pct(value), temp: pct(temp), colour: pct(colour), size: inShape ? size.map(v => v / inShape * 100) : [0, 0, 0], edges: all ? [e.hard / all * 100, e.soft / all * 100] : null };
  Object.defineProperties(out, {
    w: { value: w }, h: { value: h },
    maps: { value: { value: valueMap, temp: tempCls, colour: colourMap, size: sizeMap, edges: e.kind } },
  });
  return out;
}

// Which amount leads, and by how much: 'lead' (a clear dominant), 'lean'
// or 'tie'. i: its index in the list given.
function amountsLead(list) {
  const order = list.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const gap = order[0][0] - order[1][0];
  return { i: order[0][1], gap, kind: gap >= AMT_LEAD ? 'lead' : gap < AMT_CLOSE ? 'tie' : 'lean' };
}

/* The lead of one row's amounts, as it is told in the verdict - or null when
   there is nothing to say: no edges, or a picture too grey for temperature to
   count. Temperature is warm against cool only (the middle is no contender);
   i is still the index into the row's own three. */
function amountsRowLead(id, vals) {
  if (!vals) return null;
  if (id === 'temp') {
    if (vals[0] + vals[2] < AMT_COLOURED) return null;
    const l = amountsLead([vals[0], vals[2]]);
    return { ...l, i: l.i ? 2 : 0 };
  }
  return amountsLead(vals);
}

// What each part of each row is called in a sentence.
const AMT_NAMES = {
  value: ['the dark', 'the middle', 'the light'], temp: ['the warm', 'the neutral', 'the cool'],
  colour: ['bright colour', 'muted colour', 'grey'], size: ['big shapes', 'medium shapes', 'small shapes'],
  edges: ['hard edges', 'soft edges'],
};

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

  // Bright against greyed: the quiet is what makes the loud sing.
  const [bright, muted, grey] = a.colour, cl = amountsLead(a.colour), lean = cl.kind === 'lean' ? ', but not by much' : '';
  if (bright + muted < 15) {
    out.colour = 'Nearly all grey - colour is not what this picture is about. One small bright note in it would be loud.';
  } else if (cl.kind === 'tie') {
    out.colour = 'Bright, muted and grey in about equal amounts - nowhere for the eye to rest and nothing that stands out. Let one lead: grey most of it, and keep the bright for one place.';
  } else if (cl.i === 0) {
    out.colour = `Bright colour leads${lean} - everything is shouting. Grey the big areas (a touch of the complement, or a neutral) and keep the brightest for the focus.`;
  } else if (cl.i === 1) {
    out.colour = `Muted colour leads${lean} - the usual calm. ${bright >= 3 ? 'The bright is the accent: put it where the picture is about.' : 'A small bright note would stand out against it.'}`;
  } else {
    out.colour = `Grey leads${lean}. ${bright >= 3 ? 'The little bright colour sings against it - keep it that small.' : 'The colour there is muted, none of it bright: a small bright note would be the accent.'}`;
  }

  // Big against small shapes: one big shape, a few medium, small accents.
  const sl = amountsLead(a.size);
  const sizeSay = [
    'A few big shapes carry the picture, the medium and small ones are the interest - how a picture is meant to be built.',
    'Middle-sized shapes everywhere - no big mass to rest on, and few small ones to sparkle. Join neighbours into a big shape, and break one or two into small accents.',
    'A crowd of small shapes with nothing big to hold them together. Squint and join those of one value into big masses before any detail.',
  ];
  out.size = sl.kind === 'tie'
    ? 'Big, medium and small shapes in about equal amounts - nothing leads. Squint and join neighbours of one value into big shapes; keep the small ones for the interest.'
    : sizeSay[sl.i] + (sl.kind === 'lean' ? ' (It leads, but not by much.)' : '');

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

/* ---- the same counts inside a crop. Nine windows: the halves, the four
   corners at two thirds, the middle at two thirds - each a good part of the
   picture, so a lead found there is a crop worth having, not a speck. [name,
   x0, y0, x1, y1] as fractions of the picture. */
const AMT_CROPS = [
  ['left half', 0, 0, 0.5, 1], ['right half', 0.5, 0, 1, 1], ['top half', 0, 0, 1, 0.5], ['bottom half', 0, 0.5, 1, 1],
  ['top left', 0, 0, 0.67, 0.67], ['top right', 0.33, 0, 1, 0.67], ['bottom left', 0, 0.33, 0.67, 1],
  ['bottom right', 0.33, 0.33, 1, 1], ['middle', 0.17, 0.17, 0.83, 0.83],
];

// One row's amounts, in percent, inside a window: the same classes the whole
// picture was counted in. Null where there is nothing to count.
function amountsIn(a, id, win) {
  const { w, h } = a, map = a.maps[id];
  const x0 = Math.round(win[1] * w), y0 = Math.round(win[2] * h), x1 = Math.round(win[3] * w), y1 = Math.round(win[4] * h);
  const c = [0, 0, 0, 0]; // a class 3 is a pixel in no shape
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c[map[y * w + x]]++;
  if (id === 'edges') {
    const all = c[1] + c[2];
    return all < AMT_EDGE_MIN ? null : [c[1] / all * 100, c[2] / all * 100];
  }
  const total = c[0] + c[1] + c[2];
  return total ? [c[0] / total * 100, c[1] / total * 100, c[2] / total * 100] : null;
}

/* For each row the whole picture has no clear lead in: the window where one
   does, the clearest of them. { name, win, vals, i, gap } by row id; rows with
   a lead already, or none in any window, are left out. */
function amountsCrops(a) {
  const out = {};
  for (const id of ['value', 'temp', 'colour', 'size', 'edges']) {
    const whole = amountsRowLead(id, a[id]);
    if (!whole || whole.kind === 'lead') continue;
    let best = null;
    for (const win of AMT_CROPS) {
      const vals = amountsIn(a, id, win), l = amountsRowLead(id, vals);
      if (l && l.kind === 'lead' && (!best || l.gap > best.gap)) best = { name: win[0], win: win.slice(1), vals, i: l.i, gap: l.gap };
    }
    if (best) out[id] = best;
  }
  return out;
}

/* ---- in a session: the counts in the shared note. */
let amountsRun = 0;
let amountsLast = null; // the last reading, for the colour and shape maps

// The map each "Where?" opens: the three maps that exist, or the one drawn
// here (state.amtMap names the row it shows; null is off).
const AMT_ROWS = [
  { id: 'value', label: 'Value', parts: ['dark', 'middle', 'light'], cls: ['amt-d', 'amt-m', 'amt-l'],
    where: () => { if (state.valueSteps !== 3) { selectValueSteps(3); applyOptions(); saveSettings(); } } },
  { id: 'temp', label: 'Temperature', parts: ['warm', 'neutral', 'cool'], cls: ['amt-w', 'amt-n', 'amt-c'],
    where: () => { if (!state.tempOn) toggleTemp(); } },
  { id: 'colour', label: 'Colour', parts: ['bright', 'muted', 'grey'], cls: ['amt-v', 'amt-u', 'amt-g'],
    where: () => showAmountsMap('colour') },
  { id: 'size', label: 'Shapes', parts: ['big', 'medium', 'small'], cls: ['amt-b', 'amt-y', 'amt-z'],
    where: () => showAmountsMap('size') },
  { id: 'edges', label: 'Edges', parts: ['hard', 'soft'], cls: ['amt-h', 'amt-s'],
    where: () => { if (!state.edgesOn) toggleEdges(); } },
];
// The colour each class is drawn in on the picture - the bar's own.
const AMT_MAP_COLOURS = {
  colour: [[255, 95, 162], [201, 166, 107], [138, 138, 142]],
  size: [[155, 123, 255], [95, 208, 176], [255, 210, 63]],
};

// A row's classes onto a canvas of the picture's size (the page scales it).
function amountsDraw(a, id, c) {
  c.width = a.w; c.height = a.h;
  const img = new ImageData(a.w, a.h), d = img.data, map = a.maps[id], col = AMT_MAP_COLOURS[id];
  for (let i = 0; i < map.length; i++) {
    const k = col[map[i]];
    if (!k) continue; // in no shape: left clear
    d[4 * i] = k[0]; d[4 * i + 1] = k[1]; d[4 * i + 2] = k[2]; d[4 * i + 3] = 150;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function hideAmountsMap() {
  state.amtMap = null;
  el('amtOverlay').classList.add('hidden');
}
function showAmountsMap(id) {
  if (!amountsLast) return;
  state.amtMap = id;
  amountsDraw(amountsLast, id, el('amtOverlay')).classList.remove('hidden');
}

// A window as the viewfinder: construct mode Frame, drawn over the picture
// where it is on the stage (a flipped picture is mirrored, so is the window).
function amountsTryCrop(win) {
  const img = el('img'), ir = img.getBoundingClientRect(), sr = el('stage').getBoundingClientRect();
  if (!ir.width) return;
  let [x0, y0, x1, y1] = win;
  if (img.classList.contains('flip')) [x0, x1] = [1 - x1, 1 - x0];
  const ox = ir.left - sr.left, oy = ir.top - sr.top;
  setConstructMode('frame');
  state.frame = { x1: ox + x0 * ir.width, y1: oy + y0 * ir.height, x2: ox + x1 * ir.width, y2: oy + y1 * ir.height };
  renderConstructOverlay();
}

function amountsHtml(a) {
  const say = amountsVerdict(a), crops = amountsCrops(a);
  return AMT_ROWS.map(r => {
    const vals = a[r.id];
    const bar = vals
      ? `<span class="amt-bar" role="img" aria-label="${r.parts.map((p, i) => `${p} ${Math.round(vals[i])}%`).join(', ')}">` +
        vals.map((v, i) => `<i class="${r.cls[i]}" style="width:${v.toFixed(1)}%" title="${r.parts[i]} ${Math.round(v)}%"></i>`).join('') + '</span>'
      : '<span class="amt-bar"></span>';
    const nums = vals ? r.parts.map((p, i) => `${p} ${Math.round(vals[i])}%`).join(' · ') : '';
    const c = crops[r.id];
    const crop = c ? `<span class="amt-crop">Cropped to the ${c.name}, ${AMT_NAMES[r.id][c.i]} leads - ${Math.round(c.vals[c.i])}% of it. ` +
      `<button type="button" class="amt-where" data-amt-crop="${c.win.join(',')}" title="Draw this crop over the picture as a viewfinder">Try it</button></span>` : '';
    return `<div class="amt-row"><b>${r.label}</b>${bar}<button type="button" class="amt-where" data-amt-where="${r.id}" ` +
      `title="Show where, on the picture">Where?</button><small>${nums}</small><span class="amt-say">${esc(say[r.id])}</span>${crop}</div>`;
  }).join('');
}

function clearAmounts() {
  amountsRun++;
  amountsLast = null;
  hideAmountsMap();
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
    // A new picture (or a re-count): the map shown goes with the old reading.
    const was = state.amtMap;
    amountsLast = a;
    if (was) showAmountsMap(was);
    overlayNote('amounts', amountsHtml(a));
  }, 30);
}

el('btnAmounts').addEventListener('click', toggleAmounts);
el('poseNote').addEventListener('click', e => {
  const b = e.target.closest('[data-amt-where]'), c = e.target.closest('[data-amt-crop]');
  if (b) AMT_ROWS.find(r => r.id === b.dataset.amtWhere).where();
  if (c) amountsTryCrop(c.dataset.amtCrop.split(',').map(Number));
});
