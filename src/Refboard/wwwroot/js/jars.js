/* refboard - Ink wash jars: which jar of diluted ink goes where.
   A bottle of ink is one dark; a wash painting has many. The painter fills a
   few jars - one of neat ink, the others thinned with more and more water -
   and gives each area of the picture the jar of its own value. This reduces
   the picture to 3, 4 or 5 jars (and the bare paper), says how to thin each
   one ("jar 2: 1 part ink to 5 of water") and draws the picture as that
   set of washes would paint it.

   How: the same ladder as the hatching map - the picture's lightness, blurred
   a little, measured against its own 2nd and 98th percentile - but cut into
   equal steps of L* between the paper and the neat ink, since equal steps of
   L* look like equal steps of tone. Each step's jar is found with the wash
   model of paint.js and one pigment (ivory black, burnt umber for a sepia,
   phthalo blue for an indigo): the strength of wash whose L* on the paper is
   the step's, by bisection - the wash only ever gets darker with strength.
   Neat ink is a wash of JARS_NEAT times the strength paint.js calls 1, which
   is a guess at a bottle's density; the thinning is read off that, so it is
   an estimate to try on scrap paper, which the note says.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const JARS_KEY = 'refboard.inkJars.v1';
const JARS_COUNTS = [3, 4, 5];
const JARS_INKS = {
  black: { label: 'Black', pigment: 'black' },
  sepia: { label: 'Sepia', pigment: 'umber' },
  indigo: { label: 'Indigo', pigment: 'phthaloBlue' },
};
const JARS_NEAT = 4;   // a bottle's ink, as a multiple of paint.js's wash strength 1

function jarsLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(JARS_KEY));
    if (v) return { count: JARS_COUNTS.includes(v.count) ? v.count : 4, ink: JARS_INKS[v.ink] ? v.ink : 'black' };
  } catch { /* fall through */ }
  return { count: 4, ink: 'black' };
}
function jarsSave(c) {
  try { localStorage.setItem(JARS_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/* The ratio in words. Neat is neat; a thin jar is "1 : 12"; between, halves
   ("1 : 2.5"), since a pipette cannot tell 2.3 from 2.5. */
function jarsRatio(water) {
  if (water < 0.15) return 'neat ink';
  const n = water >= 3 ? Math.round(water) : Math.round(water * 2) / 2;
  return `1 part ink : ${n} of water`;
}

/* The jars for an ink and a number of them, lightest first:
   [{ n, target, strength, share, water, rgb }] - share of the neat ink (0-1),
   water in parts per part of ink, rgb the wash on the paper. Null before the
   paint model has loaded. */
function jarsOf(inkKey, count) {
  if (!paintInit()) return null;
  const k = JARS_INKS[inkKey].pigment;
  const wash = s => paintRgb(paintWash([[k, 1]], s));
  const paperL = lstar(wash(0)), neatL = lstar(wash(JARS_NEAT));
  const jars = [];
  for (let j = 1; j <= count; j++) {
    const target = paperL - (paperL - neatL) * j / count;
    // The darkest jar IS the neat ink: a dark pigment is at its floor well before
    // JARS_NEAT, and the bisection would stop at the first strength that reaches it.
    let lo = 0, hi = JARS_NEAT;
    if (j < count) for (let it = 0; it < 24; it++) {
      const mid = (lo + hi) / 2;
      if (lstar(wash(mid)) > target) lo = mid; else hi = mid;
    }
    const strength = j === count ? JARS_NEAT : (lo + hi) / 2, share = strength / JARS_NEAT;
    jars.push({ n: j, target, strength, share, water: 1 / share - 1, rgb: wash(strength) });
  }
  return { paper: wash(0), paperL, neatL, jars };
}

/* p: stepsRead(). Gives { w, h, level, share, flat, count }: level per pixel,
   0 (bare paper) to count (the darkest jar); share the percent at each;
   flat true when the picture's values span under 8 L*. */
function jarsPlan(p, count) {
  const { w, h, L } = p, n = w * h, S = Math.max(w, h);
  const soft = stepsBlur(L, w, h, S / 130);
  const sorted = Float32Array.from(soft).sort();
  const lo = sorted[Math.floor(n * 0.02)], hi = sorted[Math.min(n - 1, Math.floor(n * 0.98))], range = hi - lo;
  const level = new Uint8Array(n), tally = new Array(count + 1).fill(0), flat = range < 8;
  for (let i = 0; i < n; i++) {
    const d = flat ? 0 : Math.min(1, Math.max(0, (hi - soft[i]) / range));
    const k = Math.round(d * count);
    level[i] = k; tally[k]++;
  }
  return { w, h, level, share: tally.map(v => v / n * 100), flat, count };
}

// The washes: each area in its jar's colour on the paper's, the large patches numbered.
function jarsDraw(f, set, c) {
  c.width = f.w; c.height = f.h;
  const g = c.getContext('2d'), img = g.createImageData(f.w, f.h), px = img.data;
  const colours = [set.paper, ...set.jars.map(j => j.rgb)];
  for (let i = 0; i < f.w * f.h; i++) {
    const t = colours[f.level[i]];
    px[4 * i] = t[0]; px[4 * i + 1] = t[1]; px[4 * i + 2] = t[2]; px[4 * i + 3] = 235;
  }
  g.putImageData(img, 0, 0);
  g.font = `700 ${Math.round(Math.max(f.w, f.h) / 24)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 4;
  // hatchLabels() (hatch.js) finds one place per large patch of a level.
  for (const l of hatchLabels(f)) {
    const dark = lstar(colours[l.level]) < 50;
    g.strokeStyle = dark ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.85)'; g.strokeText(String(l.level), l.x, l.y);
    g.fillStyle = dark ? '#fff' : '#111'; g.fillText(String(l.level), l.x, l.y);
  }
  return c;
}

function jarsNote(f, set, cfg) {
  const chip = (attr, k, label, on) => `<button type="button" class="chip" data-jars-${attr}="${k}" aria-pressed="${on}">${label}</button>`;
  const bar = `<div class="tone-bar"><span>Jars</span>${JARS_COUNTS.map(n => chip('n', n, n, cfg.count === n)).join('')}` +
    `<span>Ink</span>${Object.entries(JARS_INKS).map(([k, v]) => chip('i', k, v.label, cfg.ink === k)).join('')}</div>`;
  if (f.flat) return bar + 'The values hardly differ in this picture: one jar and the paper say all it has.';
  const key = '<div class="hm-key">' +
    `<span><i style="background:${colHexOf(set.paper)}"></i>0 paper ${Math.round(f.share[0])}%</span>` +
    set.jars.map(j => `<span><i style="background:${colHexOf(j.rgb)}"></i>${j.n} ${esc(jarsRatio(j.water))} ${Math.round(f.share[j.n])}%</span>`).join('') + '</div>';
  const dark = f.share[f.count], light = f.share[0] + f.share[1];
  let line;
  if (dark > 30) line = `${Math.round(dark)}% takes the neat ink: a lot of black. Keep the paper's lights, and let jar ${f.count - 1} do the work wherever you can.`;
  else if (light > 65) line = `${Math.round(light)}% is paper or the palest jar: it is a light picture. Spend the care on jars 1 and 2, where the tones are close.`;
  else line = 'A full ladder: paint from the lightest jar to the darkest, each area with its own, and let each wash dry before the next touches it - or touch them wet to blend.';
  return bar + key + esc(line) + " <small>Measured against this picture's own darkest and lightest. The thinning is the paint model's estimate for one pigment: try each jar on scrap paper first.</small>";
}

/* ---- in a session: the washes over the picture, as a layer. */
let jarsRun = 0;

function clearJars() {
  jarsRun++;
  el('jarsOverlay').classList.add('hidden');
  overlayNote('jars', state.jarsOn ? 'Mixing the jars...' : '');
}

function toggleJars() {
  state.jarsOn = !state.jarsOn;
  el('btnJars').setAttribute('aria-pressed', String(state.jarsOn));
  clearJars();
  if (state.jarsOn) runJars();
}

function runJars() {
  const img = el('img'), run = ++jarsRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== jarsRun || !state.jarsOn) return;
    const cfg = jarsLoad();
    let f, set;
    try {
      set = jarsOf(cfg.ink, cfg.count);
      if (!set) { overlayNote('jars', '<i>The paint model has not loaded.</i>'); return; }
      f = jarsPlan(stepsRead(img), cfg.count);
      jarsDraw(f, set, el('jarsOverlay'));
    } catch (err) { console.error('jars:', err); overlayNote('jars', '<i>Could not work out the jars for this picture.</i>'); return; }
    el('jarsOverlay').classList.remove('hidden');
    overlayNote('jars', jarsNote(f, set, cfg));
  }, 30);
}

el('btnJars').addEventListener('click', toggleJars);
el('poseNote').addEventListener('click', e => {
  const n = e.target.closest('[data-jars-n]'), i = e.target.closest('[data-jars-i]');
  if (!n && !i) return;
  const cfg = jarsLoad();
  if (n && JARS_COUNTS.includes(+n.dataset.jarsN)) cfg.count = +n.dataset.jarsN;
  if (i && JARS_INKS[i.dataset.jarsI]) cfg.ink = i.dataset.jarsI;
  jarsSave(cfg);
  runJars();
});
