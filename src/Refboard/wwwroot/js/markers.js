/* refboard - Grey markers for value studies: the picture split into areas,
   each for one grey marker of a set, with the marker's number written on it.
   The simplest first step with markers - a value study in a few greys,
   lightest first - and it needs nothing but the set.

   A set is a list of greys as the maker numbers them, each with how light it
   lays down on white paper (L*, 0 black to 100 white). The codes are the
   maker's own; the lightness is an estimate - a marker's printed colour on a
   website is not what it lays down on your paper, and the same marker is
   darker laid twice. To be corrected from a swatch photo (see the roadmap's
   Calibration), as the Holbein box's colours are.

   How many greys: a set of ten has greys too close to tell apart in a study,
   and a study in ten is not a study. The picture's own darkest and lightest are
   found (the 2nd and 98th percentile - a speck of black or a glint of white
   should not stretch the scale), and for n greys the n values spaced evenly
   between them are matched each to its nearest marker. Whatever is lighter
   than the lightest grey chosen is the paper: left white, no marker.

   Areas are blocked in the way a painter reads them - each pixel takes the grey
   most of its neighbourhood has - and an area too small to be worth a label
   (under 0.6% of the picture) is left unlabelled: it is drawn like the rest.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Lightest first. L: an estimate, on white paper.
const MARKER_SETS = {
  tombow10: { label: 'Tombow Dual Brush - grayscale set (10)', markers: [
    { code: 'N95', name: 'Cool Gray 1', L: 90 }, { code: 'N89', name: 'Warm Gray 1', L: 85 },
    { code: 'N79', name: 'Warm Gray 2', L: 79 }, { code: 'N75', name: 'Cool Gray 3', L: 74 },
    { code: 'N65', name: 'Cool Gray 5', L: 65 }, { code: 'N60', name: 'Cool Gray 6', L: 59 },
    { code: 'N55', name: 'Cool Gray 7', L: 52 }, { code: 'N45', name: 'Cool Gray 10', L: 40 },
    { code: 'N25', name: 'Lamp Black', L: 22 }, { code: 'N15', name: 'Black', L: 12 },
  ] },
  tombow12: { label: 'Tombow ABT - grey colours (12)', markers: [
    { code: 'N95', name: 'Cool Gray 1', L: 90 }, { code: 'N89', name: 'Warm Gray 1', L: 85 },
    { code: 'N79', name: 'Warm Gray 2', L: 79 }, { code: 'N75', name: 'Cool Gray 3', L: 74 },
    { code: 'N65', name: 'Cool Gray 5', L: 65 }, { code: 'N57', name: 'Cool Gray 5', L: 60 },
    { code: 'N55', name: 'Cool Gray 7', L: 52 }, { code: 'N45', name: 'Cool Gray 10', L: 40 },
    { code: 'N35', name: 'Cool Gray 12', L: 31 }, { code: 'N25', name: 'Lamp Black', L: 22 },
    { code: 'N15', name: 'Black', L: 12 },
  ] },
};
const MARKER_KEY = 'refboard.greyMarkers.v1';
const MARKER_COUNTS = [3, 5, 7];       // and 0: every grey in the set
const MARKER_MIN_AREA = 0.006;          // of the picture, for an area to be labelled

function markersLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(MARKER_KEY));
    if (v && MARKER_SETS[v.set] && (v.n === 0 || MARKER_COUNTS.includes(v.n))) return { set: v.set, n: v.n };
  } catch { /* fall through */ }
  return { set: 'tombow10', n: 5 };
}
function markersSave(c) {
  try { localStorage.setItem(MARKER_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

// The grey of a marker as a #rrggbb, for drawing it.
const markerHex = L => {
  const Y = L > 8 ? ((L + 16) / 116) ** 3 : L / 903.3;
  const v = Math.round(255 * (Y <= 0.0031308 ? 12.92 * Y : 1.055 * Y ** (1 / 2.4) - 0.055));
  return '#' + [v, v, v].map(c => c.toString(16).padStart(2, '0')).join('');
};

/* Which markers to use for a picture whose values run lo..hi (L*): n of them,
   or all when n is 0 - lightest first, each matched to the value that n evenly
   spaced values between lo and hi call for, never the same marker twice. */
function markersPick(set, n, lo, hi) {
  const all = MARKER_SETS[set].markers;
  if (!n || n >= all.length) return [...all];
  const left = new Set(all), out = [];
  for (let i = 0; i < n; i++) {
    const want = lo + (hi - lo) * (n === 1 ? 0.5 : i / (n - 1));
    let best = null;
    for (const m of left) if (!best || Math.abs(m.L - want) < Math.abs(best.L - want)) best = m;
    left.delete(best); out.push(best);
  }
  return out.sort((a, b) => b.L - a.L);
}

/* p: stepsRead(). Gives { w, h, area, picks, share, spots }:
     area   per pixel, an index into picks, or -1 for the paper;
     picks  the markers used, lightest first;
     share  per pick, then the paper last: percent of the picture;
     spots  where each labelled area's code goes: { i, x, y, size } - the
            pixel of the area nearest its middle, and its side (sqrt of area). */
function markersOf(p, { set = 'tombow10', n = 5 } = {}) {
  const { w, h } = p, px = w * h, S = Math.max(w, h);
  const sorted = Float32Array.from(p.L).sort();
  const lo = sorted[Math.floor(px * 0.02)], hi = sorted[Math.min(px - 1, Math.floor(px * 0.98))];
  const picks = markersPick(set, n, Math.min(lo, hi - 1), hi);
  // The paper is whatever is lighter than half way from the lightest marker
  // to white: a value that would rather be white than that marker.
  const paperAt = (picks[0].L + 100) / 2;
  // The classes, lightest first: the paper is class 0, each marker the next.
  // Each pixel's own class by nearest value, then voted over a neighbourhood.
  const soft = stepsBlur(Float32Array.from(p.L), w, h, 1);
  const own = new Uint8Array(px), K = picks.length + 1;
  for (let i = 0; i < px; i++) {
    const v = soft[i];
    if (v >= paperAt) { own[i] = 0; continue; }
    let best = 1;
    for (let k = 1; k < K; k++) if (Math.abs(picks[k - 1].L - v) < Math.abs(picks[best - 1].L - v)) best = k;
    own[i] = best;
  }
  const votes = Array.from({ length: K }, (_, k) => stepsBlur(Float32Array.from(own, v => v === k ? 1 : 0), w, h, S / 160));
  const area = new Int16Array(px), count = new Float64Array(K);
  for (let i = 0; i < px; i++) {
    let b = 0;
    for (let k = 1; k < K; k++) if (votes[k][i] > votes[b][i]) b = k;
    area[i] = b - 1; count[b]++;
  }
  // Areas: runs of one class, joined; the small ones take a neighbour's.
  const lab = new Int32Array(px), stack = new Int32Array(px), spots = [], comps = [];
  for (let s = 0; s < px; s++) {
    if (lab[s]) continue;
    const id = comps.length + 1, members = [];
    let top = 0;
    stack[top++] = s; lab[s] = id;
    while (top) {
      const i = stack[--top], x = i % w;
      members.push(i);
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < px && !lab[j] && area[j] === area[s]) { lab[j] = id; stack[top++] = j; }
    }
    comps.push({ cls: area[s], members });
  }
  for (const c of comps) {
    if (c.cls < 0 || c.members.length < MARKER_MIN_AREA * px) continue;
    let mx = 0, my = 0;
    for (const i of c.members) { mx += i % w; my += (i / w) | 0; }
    mx /= c.members.length; my /= c.members.length;
    // The member nearest the middle: the middle itself may be outside a ring.
    let at = c.members[0], bd = Infinity;
    for (const i of c.members) {
      const d = (i % w - mx) ** 2 + (((i / w) | 0) - my) ** 2;
      if (d < bd) { bd = d; at = i; }
    }
    spots.push({ i: c.cls, x: at % w, y: (at / w) | 0, size: Math.sqrt(c.members.length) });
  }
  return { w, h, area, picks, share: Array.from(count, c => c / px * 100), spots, lo, hi };
}

// The areas in their greys, the codes on them, onto a canvas of the picture
// read's size (the page scales it). The paper is left clear.
function markersDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const img = new ImageData(m.w, m.h), d = img.data;
  const grey = m.picks.map(k => parseInt(markerHex(k.L).slice(1, 3), 16));
  for (let i = 0; i < m.area.length; i++) {
    const k = m.area[i];
    if (k < 0) continue;
    d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = grey[k]; d[4 * i + 3] = 235;
  }
  const g = c.getContext('2d');
  g.putImageData(img, 0, 0);
  const S = Math.max(m.w, m.h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (const s of m.spots) {
    const size = Math.max(S / 60, Math.min(S / 22, s.size / 4));
    g.font = `600 ${size}px system-ui, sans-serif`;
    const text = m.picks[s.i].code;
    // Light text on the dark greys, dark on the light: on its own halo.
    const dark = m.picks[s.i].L < 50;
    g.lineWidth = size / 4;
    g.strokeStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.85)';
    g.fillStyle = dark ? '#fff' : '#111';
    g.strokeText(text, s.x, s.y); g.fillText(text, s.x, s.y);
  }
  return c;
}

const markersShare = v => v < 1 ? '<1%' : Math.round(v) + '%';

// The key: each grey as a chip with its share, lightest first, the paper last.
function markersKey(m) {
  const rows = m.picks.map((k, i) =>
    `<span class="mk-row"><i class="mk-sw" style="background:${markerHex(k.L)}"></i><b>${esc(k.code)}</b> ${esc(k.name)} <small>${markersShare(m.share[i + 1])}</small></span>`);
  rows.push(`<span class="mk-row"><i class="mk-sw mk-paper"></i><b>paper</b> left white <small>${markersShare(m.share[0])}</small></span>`);
  return rows.join('');
}

function markersNote(m, c) {
  const sets = Object.entries(MARKER_SETS).map(([k, s]) =>
    `<button type="button" class="chip" data-mk-set="${k}" aria-pressed="${c.set === k}" title="${esc(s.label)}">${k === 'tombow10' ? 'Tombow 10' : 'ABT 12'}</button>`).join('');
  const counts = [...MARKER_COUNTS, 0].map(n =>
    `<button type="button" class="chip" data-mk-n="${n}" aria-pressed="${c.n === n}">${n || 'All'}</button>`).join('');
  return `<div class="tone-bar"><span>Set</span>${sets}<span>Greys</span>${counts}</div>` +
    `<div class="mk-key">${markersKey(m)}</div>` +
    `Lay the lightest grey first and the darkest last; a grey over a grey makes the next one down. ` +
    `<small>The greys' lightness is an estimate - your marker on your paper will differ a little.</small>`;
}

/* ---- in a session: the study over the picture, as a layer. */
let markersRun = 0;

function clearMarkers() {
  markersRun++;
  el('markerOverlay').classList.add('hidden');
  overlayNote('markers', state.markersOn ? 'Choosing the greys...' : '');
}

function toggleMarkers() {
  state.markersOn = !state.markersOn;
  el('btnMarkers').setAttribute('aria-pressed', String(state.markersOn));
  clearMarkers();
  if (state.markersOn) runMarkers();
}

// A moment's work, so after a frame: the button shows pressed first.
function runMarkers() {
  const img = el('img'), run = ++markersRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== markersRun || !state.markersOn) return;
    let m;
    const c = markersLoad();
    try { m = markersOf(stepsRead(img), c); }
    catch (err) { console.error('markers:', err); overlayNote('markers', '<i>Could not split this picture into greys.</i>'); return; }
    markersDraw(m, el('markerOverlay')).classList.remove('hidden');
    overlayNote('markers', markersNote(m, c));
  }, 30);
}

el('btnMarkers').addEventListener('click', toggleMarkers);
el('poseNote').addEventListener('click', e => {
  const s = e.target.closest('[data-mk-set]'), n = e.target.closest('[data-mk-n]');
  if (!s && !n) return;
  const c = markersLoad();
  if (s && MARKER_SETS[s.dataset.mkSet]) c.set = s.dataset.mkSet;
  if (n) c.n = Number(n.dataset.mkN);
  markersSave(c);
  runMarkers();
});
