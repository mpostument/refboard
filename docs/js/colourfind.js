/* Search the library by colour (Library > the Colour button beside the search
   box). Pick up to three colours - or a named one, or a mood like "warm dusk" -
   and the grid keeps the pictures that have them, the best match first; or press
   "Like this" on a picture to see the ones closest to it in colour.

   What it reads is palettes.json, written by the server (PaletteBuilder): the
   five main colours of every picture, each with the share of the picture it
   covers. A page without that file - GitHub Pages, a server that has not got to
   it yet - has no Colour button at all, the way it has no brightness order
   without features.json.

   Colour is compared in OKLab, where the distance between two colours is about
   how different they look. A picture is scored by how much of it is NEAR each
   chosen colour: "green" is not a single green but a stretch around it, and a
   picture that is half pale-green and half deep-green is a green picture. */

let PALETTES = null;            // palettes.json's "images", or null
const cfCache = new Map();      // src -> [{ hex, lab, share }]
let cfQuery = [];               // up to three '#rrggbb', in the order they were picked
let cfLike = null;              // { src, name } while "like this picture" is the question
let cfScores = new Map();       // src -> score of the last filter, for the sort
const CF_MAX = 3;
const CF_REACH = 0.105;         // OKLab distance past which a colour no longer counts as the chosen one. Tuned on the sample pack: the pale pink of a pink bob is 0.087 from pink, the pale greys of a black-haired girl 0.108 and 0.116
const CF_LIKE_REACH = 0.14;     // the same for "like this picture": mean distance to its colours
const CF_NEED = [0.04, 0.03, 0.03]; // share of the picture each pick must have: the first is the subject, the others may be an accent

/* The colours a person reaches for first - not a colour wheel, which is what the
   picker is for. */
const CF_NAMES = [
  ['Red', '#c8372d'], ['Orange', '#e07a2e'], ['Yellow', '#e6c23a'], ['Green', '#4c9a48'],
  ['Teal', '#2f9a96'], ['Blue', '#3d6fc4'], ['Purple', '#7a4fa8'], ['Pink', '#e089b0'],
  ['Brown', '#7a4a2c'], ['Grey', '#8a8a8a'], ['Black', '#161616'], ['White', '#f2f2f2'],
];
/* Moods: several colours at once, the way a picture is remembered ("warm dusk",
   "green with a red accent"). */
const CF_MOODS = [
  ['Warm dusk', ['#e0703a', '#5a3b6e']], ['Autumn', ['#b5532a', '#d9a23a']], ['Forest', ['#3f6b3a', '#1f3a2a']],
  ['Seashore', ['#3f8fb0', '#e3d3a8']], ['Night', ['#16203a', '#3d4f8a']], ['Pastel', ['#f2c9d6', '#c9e4de', '#f6ecb8']],
];

const cfHexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const cfLab = hex => linToOklab(...cfHexRgb(hex).map(c => srgbToLin(c / 255)));
const cfDist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

/* "c8553d:41" -> { hex: '#c8553d', lab, share: 0.41 }. Read once per picture. */
function cfColours(src) {
  let c = cfCache.get(src);
  if (c) return c;
  const e = PALETTES && PALETTES[src];
  if (!e) return null;
  c = (e.p || []).map(s => {
    const [hex, share] = s.split(':');
    return { hex: '#' + hex, lab: cfLab('#' + hex), share: Number(share) / 100 };
  });
  cfCache.set(src, c);
  return c;
}

/* How much of the picture is near this colour, 0 to 1. A colour inside the reach
   counts in full at the centre and fades to nothing at the edge. */
function cfCover(cols, lab) {
  let s = 0;
  for (const c of cols) {
    const d = cfDist(c.lab, lab) / CF_REACH;
    if (d < 1) s += c.share * (1 - d * d);
  }
  return s;
}

/* 0 for a picture that does not have the chosen colours (or has no palette),
   otherwise higher is better. Every chosen colour has to be there - "green with
   a red accent" is not a red picture with a speck of green - but the first has
   to be a real share and the rest may be small. */
function cfScore(src) {
  const cols = cfColours(src);
  if (!cols) return 0;
  if (cfLike) {
    const like = cfColours(cfLike.src);
    if (!like) return 0;
    // Each colour of one to the nearest colour of the other, weighted by its
    // share, both ways: a picture of one flat colour is not "like" a picture
    // that merely contains that colour.
    const away = (a, b) => a.reduce((t, c) => t + c.share * Math.min(...b.map(o => cfDist(c.lab, o.lab))), 0)
      / (a.reduce((t, c) => t + c.share, 0) || 1);
    const d = (away(like, cols) + away(cols, like)) / 2;
    return d < CF_LIKE_REACH ? 1 - d / CF_LIKE_REACH : 0;
  }
  let total = 0;
  for (let i = 0; i < cfQuery.length; i++) {
    const have = cfCover(cols, cfLab(cfQuery[i]));
    if (have < CF_NEED[i]) return 0;
    total += have * (i ? 0.8 : 1);
  }
  return total;
}

const cfActive = () => !!PALETTES && (cfQuery.length > 0 || !!cfLike);

/* The grid's filter: the pictures that score, and the scores kept for cfSort(). */
function cfFilter(list) {
  if (!cfActive()) return list;
  cfScores = new Map();
  return list.filter(i => {
    const s = cfScore(i.src);
    if (s > 0) cfScores.set(i.src, s);
    return s > 0;
  });
}
/* Best match first; the grid's usual order breaks a tie. */
const cfSort = list => [...list].sort((a, b) => (cfScores.get(b.src) || 0) - (cfScores.get(a.src) || 0));

/* Palettes load once, with the rest of the library. Not fatal: no file, no button. */
async function cfLoad() {
  try {
    const res = await fetch('palettes.json', { cache: 'no-store' });
    if (!res.ok) return;
    const doc = await res.json();
    if (doc && doc.images && Object.keys(doc.images).length) PALETTES = doc.images;
  } catch { /* the colour search stays away */ }
  el('btnColour').classList.toggle('hidden', !PALETTES);
}

/* ---- the panel ---- */

function cfSet(query, like = null) {
  cfQuery = query.slice(0, CF_MAX);
  cfLike = like;
  cfRender();
  refreshGrid();
}

function cfRender() {
  const panel = el('colourPanel');
  const on = cfActive();
  el('btnColour').classList.toggle('on', on);
  el('thumbGrid').classList.toggle('colour-on', on);
  const picks = cfLike
    ? `<span class="cf-like">Like <b>${esc(cfLike.name)}</b> <button type="button" class="cf-x" data-cf="unlike" aria-label="Stop looking for pictures like this one">×</button></span>`
    : cfQuery.map((hex, i) => `<span class="cf-pick"><span class="cf-sw" style="background:${hex}"></span>` +
      `<button type="button" class="cf-x" data-cf="drop" data-i="${i}" aria-label="Remove colour ${hex}">×</button></span>`).join('');
  const room = !cfLike && cfQuery.length < CF_MAX;
  panel.innerHTML =
    `<div class="cf-row">${picks || '<span class="count">Pick up to three colours - the grid keeps the pictures that have all of them.</span>'}` +
    (room ? '<label class="cf-add" title="Any colour"><input type="color" id="cfPicker" value="#4c9a48" aria-label="Add a colour"><span>+ Colour</span></label>' : '') +
    (on ? '<button type="button" class="ghost cf-clear" data-cf="clear">Clear</button>' : '') + '</div>' +
    '<div class="cf-row cf-names" role="group" aria-label="Named colours">' +
    CF_NAMES.map(([n, hex]) => `<button type="button" class="cf-name" data-cf="add" data-hex="${hex}" title="${n}"><span class="cf-sw" style="background:${hex}"></span>${n}</button>`).join('') + '</div>' +
    '<div class="cf-row" role="group" aria-label="Moods">' +
    CF_MOODS.map(([n, hexes], i) => `<button type="button" class="chip" data-cf="mood" data-i="${i}" title="${hexes.join(' ')}">${n}</button>`).join('') + '</div>' +
    `<div class="count" id="cfNote">${cfNote()}</div>`;
}

/* How many of the pictures in view have been measured: palettes come in as the
   server gets to them, and a picture without one is not a miss, it is unknown. */
function cfNote() {
  if (!PALETTES) return '';
  const all = viewImages();
  const known = all.filter(i => PALETTES[i.src]).length;
  return known === all.length ? '' : `Colours are measured for ${known.toLocaleString()} of ${all.length.toLocaleString()} pictures here - the rest turn up as the server gets to them.`;
}

/* The five colours of a picture as a strip along the cell's foot. */
function cfStrip(src) {
  const cols = cfColours(src);
  if (!cols || !cols.length) return null;
  const strip = document.createElement('span');
  strip.className = 'cell-pal';
  strip.setAttribute('aria-hidden', 'true');
  strip.innerHTML = cols.map(c => `<i style="flex:${c.share * 100};background:${c.hex}"></i>`).join('');
  return strip;
}

function initColourFind() {
  const btn = el('btnColour');
  btn.addEventListener('click', () => {
    const open = el('colourPanel').classList.toggle('hidden') === false;
    btn.setAttribute('aria-expanded', String(open));
    if (open) cfRender();
  });
  const panel = el('colourPanel');
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-cf]');
    if (!b) return;
    const act = b.dataset.cf;
    if (act === 'clear') cfSet([]);
    else if (act === 'unlike') cfSet([]);
    else if (act === 'drop') cfSet(cfQuery.filter((_, i) => i !== Number(b.dataset.i)));
    // A fourth pick takes the place of the last, rather than doing nothing.
    else if (act === 'add') cfSet(cfQuery.length < CF_MAX ? [...cfQuery, b.dataset.hex] : [...cfQuery.slice(0, CF_MAX - 1), b.dataset.hex]);
    else if (act === 'mood') cfSet(CF_MOODS[Number(b.dataset.i)][1]);
  });
  // 'change' rather than 'input': the picker fires input all the way along a drag.
  panel.addEventListener('change', e => {
    if (e.target.id === 'cfPicker') cfSet([...cfQuery, e.target.value]);
  });
}

/* Added to each grid cell: the strip, and the button that asks for its look-alikes. */
function cfCell(cell, item) {
  const strip = cfStrip(item.src);
  if (!strip) return;
  cell.appendChild(strip);
  const like = document.createElement('button');
  like.type = 'button';
  like.className = 'cell-like';
  like.textContent = 'Like this';
  like.title = 'Show the pictures closest to this one in colour';
  cell.appendChild(like);
}

/* Opens the panel too, so the picture it is "like" is there to be removed. */
function cfLikeThis(item) {
  el('colourPanel').classList.remove('hidden');
  el('btnColour').setAttribute('aria-expanded', 'true');
  cfSet([], { src: item.src, name: item.name });
}

/* The note under the panel follows the folder in view. */
function cfSync() {
  const note = document.getElementById('cfNote');
  if (note) note.textContent = cfNote();
}
