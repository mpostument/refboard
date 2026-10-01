/* refboard - Pigment guide: what each paint does on the paper, beyond its
   colour. The Colour studio's Pigments tab.

   Two paints of the same colour can behave nothing alike: one glazes
   cleanly and the other veils, one lifts off with a damp brush and the
   other is in the paper for good, one lies flat and the other settles into
   the grain, one lasts and the other fades. Those four are what a painter
   picks a tube by, and they are in PIGMENTS (paint.js) - the recipes on
   every other tab tag the strong cases from the same numbers.

   Each paint is shown as a swatch painted the way a watercolourist tests a
   tube: a wash from rich to pale, left to right, with a band across it
   lifted with a damp brush while wet. The swatch is paint.js's own wash
   model at each strength; granulation is the strength broken up by noise
   (the particles gathering in the paper's hollows), the lifted band the
   strength times what a staining paint leaves behind. In oil a tint strip
   instead - the paint let down with white - since neither shows there.

   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const PIG_KEY = 'refboard.pigments.v1';
// Questions a painter asks of their tubes; the paints that answer stay lit.
const PIG_FILTERS = {
  all:     { label: 'All', test: () => true },
  glaze:   { label: 'Glaze cleanly', test: p => p.op < 0.12, hint: 'Transparent: over a dry wash they only filter the light.' },
  lift:    { label: 'Lift off', test: p => p.stain === 0, hint: 'A damp brush or a tissue takes them back to nearly white paper.' },
  grain:   { label: 'Granulate', test: p => p.gran >= 1, hint: 'Their particles settle into the grain - texture for skies, stone, bark.' },
  fade:    { label: 'Fade', test: p => p.lf !== 'I', hint: 'Not the best lightfastness: keep the painting out of the sun, or find a lasting paint.' },
};
// What the guide says of each property, by its grade.
const PIG_SAY = {
  op: o => o < 0.12 ? 'Glazes cleanly: over a dry wash it only filters the light, so the colour under it glows through.'
    : o < 0.3 ? 'Mostly transparent - glazes well, with a faint veil over the darkest darks.'
    : o < 0.5 ? 'Semi-opaque: over a dark it leaves a soft, slightly chalky veil. Put it down first, or on its own.'
    : 'Opaque: it covers. A flat, bright wash on white paper; over another colour a chalky film - lay it first.',
  stain: s => ['Lifts off: a damp brush or a tissue takes it back to nearly white paper - clouds, soft highlights, mistakes.',
    'Stains a little: it lifts, but leaves a tint behind.',
    'Stains: it dyes the paper fibres and stays. Leave the lights before it goes on - and a glaze over it will not disturb it.'][s],
  gran: g => ['Smooth: an even, flat wash - for skin, clear skies, flat anime colour.',
    'A little texture, in a wet wash on rough paper.',
    'Granulates: the particles settle into the hollows of the paper - a speckled texture skies, stones and shadows love and smooth skin does not. Stronger on rough paper, with plenty of water, left alone to dry.'][g],
  lf: l => ({ I: 'Lightfastness I: it will outlast the paper.',
    II: 'Lightfastness II: very good in a rich wash; a pale one may shift a little over years in the light.',
    III: 'Lightfastness III: it fades - pale washes first, in months on a sunny wall. Fine for studies; for a painting to keep, a lasting paint of the same colour.' })[l],
};

let pig = null;
function pigLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(PIG_KEY)) || {}; } catch {}
  pig = { filter: PIG_FILTERS[v.filter] ? v.filter : 'all', sel: PIGMENTS[v.sel] ? v.sel : null };
}
function pigSave() {
  try { localStorage.setItem(PIG_KEY, JSON.stringify({ filter: pig.filter, sel: pig.sel })); } catch {}
}

// The same noise for the same paint every time: a hash of the cell.
function pigHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise, smoothed between cells - the paper's grain, a few pixels wide.
function pigNoise(x, y, cell, seed) {
  const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = pigHash(x0, y0, seed), b = pigHash(x0 + 1, y0, seed), c = pigHash(x0, y0 + 1, seed), d = pigHash(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy - 0.5;
}

/* A paint's colour at any strength, from a table: the wash model is a
   spectrum per call, and a swatch wants one per pixel. Kept per paint and
   medium. Strength runs past 1 because granules pile up. */
const PIG_TABLE_MAX = 1.6, PIG_TABLE_N = 40;
const pigTables = new Map();
function pigTable(k, water) {
  const key = k + (water ? '|w' : '|o');
  if (!pigTables.has(key)) {
    const t = [];
    for (let i = 0; i <= PIG_TABLE_N; i++) {
      const f = i / PIG_TABLE_N;
      // Watercolour: strength 0 (the paper) to 1.6. Oil: the paint let down
      // with up to 12 parts of white, masstone at the far end.
      t.push(water ? paintRgb(paintWash([[k, 1]], f * PIG_TABLE_MAX))
        : paintRgb(k === 'white' ? paintMix([['white', 1]]) : paintMix([[k, 1], ['white', 12 * (1 - f) ** 2]])));
    }
    pigTables.set(key, t);
  }
  return pigTables.get(key);
}
function pigAt(t, f) {
  const x = Math.max(0, Math.min(1, f)) * PIG_TABLE_N, i = Math.min(PIG_TABLE_N - 1, Math.floor(x)), u = x - i;
  return [0, 1, 2].map(c => t[i][c] + (t[i + 1][c] - t[i][c]) * u);
}

/* The test swatch, into a canvas at its own pixel size. Left is rich,
   right a pale tint; the band across the lower middle was lifted. */
function pigPaint(cv, k, water) {
  const w = cv.width, h = cv.height, ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), px = img.data;
  const p = PIGMENTS[k], t = pigTable(k, water), seed = Object.keys(PIGMENTS).indexOf(k) + 1;
  // Granules are specks a pixel or two across, gathered loosely into
  // clumps - fine grain times a coarser clumping, never a blotch.
  const grain = [0, 0.22, 0.55][p.gran], keep = [0.12, 0.4, 0.82][p.stain];
  const cell = Math.max(2, w / 60);
  const band0 = 0.58, band1 = 0.82;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // Soft edges to the lifted band, as a brush leaves them.
    const inBand = water ? Math.max(0, Math.min(1, (v - band0) / 0.06, (band1 - v) / 0.06)) : 0;
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let f;
      if (water) {
        let s = Math.exp(Math.log(0.05) * u);           // 1 down to 0.05
        if (grain) s *= Math.max(0, 1 + grain * ((pigHash(x, y, seed) - 0.5) * 1.4 + pigNoise(x, y, cell, seed + 99) * 1.2));
        s *= 1 - inBand * (1 - keep);
        f = s / PIG_TABLE_MAX;
      } else f = 1 - u;
      const c = pigAt(t, f), o = (y * w + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// The four properties, short, as a row reads them.
function pigWords(k, water) {
  const p = PIGMENTS[k], w = [pigmentOpacityWord(k)];
  if (water) w.push(PIGMENT_STAIN[p.stain], PIGMENT_GRAN[p.gran]);
  w.push(PIGMENT_LF[p.lf]);
  return w;
}

function pigmentsRender() {
  if (!paintInit()) { el('pigRows').textContent = 'The paint model has not loaded.'; return; }
  if (!pig) pigLoad();
  const water = col.medium === 'water', keys = paintKeys(col.paints, col.medium);
  // A question about the paper means nothing in oil.
  const paperOnly = k => ['lift', 'grain'].includes(k);
  if (!water && paperOnly(pig.filter)) pig.filter = 'all';
  const f = PIG_FILTERS[pig.filter];
  for (const b of el('pigFilters').children) {
    b.setAttribute('aria-pressed', String(b.dataset.pig === pig.filter));
    b.classList.toggle('hidden', !water && paperOnly(b.dataset.pig));
  }
  const match = keys.filter(k => f.test(PIGMENTS[k]));
  el('pigHint').textContent = pig.filter === 'all'
    ? (water ? 'Each tube as a test swatch: rich to pale, and a band lifted with a damp brush while wet.' : 'Each tube straight, then let down with white. Staining and granulation do not show in oil.')
    : `${f.hint} ${match.length ? match.length + ' of these ' + keys.length + '.' : 'None of these paints.'}`;
  if (!keys.includes(pig.sel)) pig.sel = match[0] || keys[0];
  el('pigRows').innerHTML = keys.map(k => {
    const p = PIGMENTS[k], on = f.test(p);
    return `<button type="button" class="pig-row${k === pig.sel ? ' on' : ''}${on ? '' : ' off'}" data-k="${k}" aria-pressed="${k === pig.sel}">` +
      `<canvas width="120" height="30" aria-hidden="true"></canvas>` +
      `<span><b>${esc(p.name)}</b> <small>${p.ci}</small><br><span class="pig-words">${pigWords(k, water).join(' · ')}</span></span></button>`;
  }).join('');
  for (const b of el('pigRows').children) pigPaint(b.querySelector('canvas'), b.dataset.k, water);
  pigRenderOne(pig.sel, water);
}

// A grade's sentence without its own heading - the row gives it one.
const pigSentence = s => { const t = s.replace(/^[^:]*: /, ''); return t[0].toUpperCase() + t.slice(1); };

function pigRenderOne(k, water) {
  const host = el('pigOne');
  if (!k) { host.innerHTML = ''; return; }
  const p = PIGMENTS[k];
  const says = [['Transparency', pigmentOpacityWord(k), PIG_SAY.op(p.op)]];
  if (water) says.push(['Staining', PIGMENT_STAIN[p.stain], PIG_SAY.stain(p.stain)], ['Granulation', PIGMENT_GRAN[p.gran], PIG_SAY.gran(p.gran)]);
  says.push(['Lightfastness', PIGMENT_LF[p.lf], PIG_SAY.lf(p.lf)]);
  host.innerHTML = `<div class="pig-one"><div class="gz-title"><b>${esc(p.name)}</b> · look for <b>${p.ci}</b> on the tube</div>` +
    `<canvas width="360" height="96" class="pig-big" role="img" aria-label="${esc(p.name)}, a test swatch"></canvas>` +
    (water ? '<div class="pig-cap"><span>rich</span><span>lifted while wet ↓</span><span>pale</span></div>' : '<div class="pig-cap"><span>straight</span><span></span><span>with white</span></div>') +
    `<dl class="pig-says">${says.map(([t, w, s]) => `<dt>${t}</dt><dd><b>${w}.</b> ${esc(pigSentence(s))}</dd>`).join('')}</dl>` +
    `<div class="count">${esc(p.note)}</div>` +
    `<div class="count">Recipes on the other tabs mark the strong cases: <em class="mix-tag">granulates</em> <em class="mix-tag">stains</em> <em class="mix-tag">fades</em> - click one to come here.</div>` +
    (k !== 'white' ? `<button class="linkish" type="button" data-pig-go="glazing">${esc(p.name)} glazed over the others →</button>` : '') + '</div>';
  pigPaint(host.querySelector('canvas'), k, water);
}

// Straight to one paint - from a recipe's tag, anywhere in the studio.
function pigmentsOpen(k) {
  if (!pig) pigLoad();
  if (PIGMENTS[k]) { pig.sel = k; pig.filter = 'all'; pigSave(); }
  colourTab('pigments');
}

function initPigments() {
  pigLoad();
  el('pigFilters').innerHTML = Object.entries(PIG_FILTERS)
    .map(([k, v]) => `<button class="chip" type="button" data-pig="${k}"${v.hint ? ` title="${esc(v.hint)}"` : ''}>${v.label}</button>`).join('');
  el('pigFilters').addEventListener('click', e => {
    const b = e.target.closest('[data-pig]');
    if (b) { pig.filter = b.dataset.pig; pigSave(); pigmentsRender(); }
  });
  el('pigRows').addEventListener('click', e => {
    const b = e.target.closest('.pig-row');
    if (b) { pig.sel = b.dataset.k; pigSave(); pigmentsRender(); }
  });
  el('pigOne').addEventListener('click', e => {
    const go = e.target.closest('[data-pig-go]');
    if (!go) return;
    // The Glazing tab, with this paint as the glaze over the first of the others.
    gzPick(pig.sel);
    colourTab(go.dataset.pigGo);
  });
  // A recipe's tag - granulates, stains, fades - opens its paint here.
  el('viewColour').addEventListener('click', e => {
    const t = e.target.closest('.mix-tag[data-pigment]');
    if (!t) return;
    e.preventDefault();                                  // not the <details> it sits in
    pigmentsOpen(t.dataset.pigment);
  });
}
