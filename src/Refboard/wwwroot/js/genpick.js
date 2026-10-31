/* refboard - Generate: a palette from a picture, colours from the set you own, what changed between two pictures, simple forms and the history.
   One of the classic scripts index.html loads in order; see the note there.
   Blocks of the More ways panel (js/genmore.js): genPickBlocks() makes them, genPickWire() wires them. */
"use strict";

/* ---- a palette from a picture */

const GP_PALETTE_SIDE = 240;      // the long side the picture is read at
const GP_PALETTE_SAMPLES = 5000;  // pixels the colours are found from

/* The picture's colours: k-means in OKLab (the Colour studio's), the biggest share first. Transparent pixels are left out.
   rgbs are [[r, g, b], ...]; none for a picture of one colour only is still one. */
async function gpPaletteOf(file, k = 6) {
  await loadSection('colour');
  const url = URL.createObjectURL(file);
  let im;
  try { im = await loadImg(url); } finally { URL.revokeObjectURL(url); }
  const s = Math.min(1, GP_PALETTE_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
  const w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(im, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h).data, step = Math.max(1, Math.floor(Math.sqrt(w * h / GP_PALETTE_SAMPLES))), pts = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) continue;
    pts.push(linToOklab(COL_TO_LIN[data[i]], COL_TO_LIN[data[i + 1]], COL_TO_LIN[data[i + 2]]));
  }
  return pts.length ? colKmeans(pts, k).map(p => p.rgb) : [];
}

let gpPalette = [];      // the colours of the last picture

function gpPaletteShow() {
  el('gpPalSw').innerHTML = gpPalette.map(c => `<i class="gp-sw" style="background:${colHexOf(c)}" title="${colHexOf(c)}"></i>`).join('');
  el('gpPalUse').disabled = !gpPalette.length;
  el('gpPalNote').textContent = gpPalette.length ? `${gpPalette.length} colours, the biggest share first: ${genPaletteTags(gpPalette).join(', ')}.` : '';
}

async function gpPalettePick(file) {
  const note = el('gpPalNote');
  note.textContent = 'Reading the colours...';
  try { gpPalette = await gpPaletteOf(file); } catch { gpPalette = []; gpPaletteShow(); note.textContent = 'That picture could not be read.'; return; }
  gpPaletteShow();
  if (!gpPalette.length) note.textContent = 'There is no colour in that picture - it is empty.';
}

function gpPaletteUse() {
  if (!gpPalette.length) return;
  if (GEN_GREY.includes(genChoices.medium)) { el('genStatus').textContent = 'Ink and pencil are grey: choose a coloured medium first.'; return; }
  genChoices.lock = el('gpPalLock').checked ? 'on' : 'off';
  genUsePalette(gpPalette);
  el('genStatus').textContent = 'Colours is Your palette now' + (genChoices.lock === 'on' ? ', and the picture is recoloured to it.' : '.');
}

/* ---- colours from the set you own */

/* The markers or pencils marked as yours in Fewest markers and pencils (Palettes), as a palette to keep to; the whole list
   where nothing is marked. Watercolour and flat colour have no set of markers: they take the Holbein box. */
const GP_OWN_KEY = 'refboard.fewpaints.v1';
const GP_SETS = { copic: ['copic', 'markers'], wpencil: ['pencils', 'pencils'] };

// The codes of `kind` marked as yours, or null for all; from what Palettes keeps.
function gpOwnCodes(kind) {
  try { const v = JSON.parse(localStorage.getItem(GP_OWN_KEY))?.own?.[kind]; return Array.isArray(v) ? v : null; } catch { return null; }
}

async function gpSetGo() {
  const status = el('genStatus'), medium = genChoices.medium;
  if (GEN_GREY.includes(medium)) { status.textContent = 'Ink and pencil are grey: choose a coloured medium first.'; return; }
  const kind = GP_SETS[medium];
  if (!kind) {
    genChoices.colours = 'box'; genChoices.lock = 'on'; saveGenChoices(); renderGenerate(); renderGenPrompt();
    status.textContent = 'Colours is the Holbein box, and the picture is recoloured to its tubes.';
    return;
  }
  try { await loadSection('palette'); } catch { status.textContent = 'Your set could not load - check the connection.'; return; }
  const all = (kind[0] === 'copic' ? COPIC_COLOURS : PENCIL_COLOURS), own = gpOwnCodes(kind[0]);
  const mine = own ? all.filter(m => own.includes(m.code)) : all;
  if (!mine.length) { status.textContent = `No ${kind[1]} are marked as yours: mark them in Palettes, Fewest markers and pencils.`; return; }
  genChoices.lock = 'on';
  genUsePalette(mine.map(m => m.rgb));
  status.textContent = own ? `Colours is your ${mine.length} ${kind[1]} of ${all.length}, and the picture is recoloured to them.` : `Colours is all ${all.length} ${kind[1]} on the list (none marked as yours), and the picture is recoloured to them.`;
}

/* ---- what changed between two pictures */

/* a, b: pictures made here. The words only one has, the avoid words only one has, and what else differs. */
function gpDiff(a, b) {
  const wa = genTasteWords(a), wb = genTasteWords(b);
  const av = u => new Set(genSplit(String(u.avoid || '')).map(t => t.toLowerCase()));
  const aa = av(a), ab = av(b);
  const facts = [];
  if (a.seed != null && b.seed != null) facts.push(a.seed === b.seed ? 'The same seed.' : 'Different seeds.');
  if (a.shape && b.shape && a.shape !== b.shape) facts.push(`The shape: ${a.shape} and ${b.shape}.`);
  return {
    onlyA: [...wa].filter(t => !wb.has(t)), onlyB: [...wb].filter(t => !wa.has(t)), same: [...wa].filter(t => wb.has(t)).length,
    avoidA: [...aa].filter(t => !ab.has(t)), avoidB: [...ab].filter(t => !aa.has(t)), facts,
  };
}

let gpCmp = null;      // { list } while the sheet is open

function gpCmpSheet() {
  let box = document.getElementById('cmpSheet');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'cmpSheet'; box.className = 'sheet sheet-center hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'cmpTitle');
  box.innerHTML = `<div class="sheet-box pull-box"><div class="row"><h2 id="cmpTitle" class="grow">What changed</h2>` +
    `<button type="button" class="ghost" id="cmpClose" title="Close (Esc)">Close</button></div>` +
    `<p class="count">Two of your pictures side by side, and the words that one has and the other has not.</p>` +
    `<div class="pull-pair"><figure><img id="cmpImgA" alt="Before"><figcaption><select id="cmpSelA" aria-label="The picture before"></select></figcaption></figure>` +
    `<figure><img id="cmpImgB" alt="After"><figcaption><select id="cmpSelB" aria-label="The picture after"></select></figcaption></figure></div>` +
    `<div class="count" id="cmpDiff" role="status" aria-live="polite"></div>` +
    `<div class="row"><button type="button" class="ghost" id="cmpSwap" title="Swap the two">Swap</button>` +
    `<button type="button" class="ghost" id="cmpAdd" title="Put the words only the after picture has into More tags">Add the new words to More tags</button></div></div>`;
  document.body.appendChild(box);
  initSheet(box, gpCmpClose);
  box.querySelector('#cmpClose').addEventListener('click', gpCmpClose);
  box.querySelector('#cmpSelA').addEventListener('change', gpCmpShow);
  box.querySelector('#cmpSelB').addEventListener('change', gpCmpShow);
  box.querySelector('#cmpSwap').addEventListener('click', () => {
    const a = box.querySelector('#cmpSelA'), b = box.querySelector('#cmpSelB');
    [a.value, b.value] = [b.value, a.value];
    gpCmpShow();
  });
  box.querySelector('#cmpAdd').addEventListener('click', gpCmpAdd);
  return box;
}

const gpCmpPair = () => {
  const box = gpCmpSheet(), at = id => gpCmp.list[+box.querySelector(id).value];
  return [at('#cmpSelA'), at('#cmpSelB')];
};
const gpList = items => items.length ? items.map(esc).join(', ') : 'nothing';

async function gpCmpShow() {
  const box = gpCmpSheet(), [a, b] = gpCmpPair(), d = gpDiff(a, b);
  const [ua, ub] = await Promise.all([storeFileUrl(a.file), storeFileUrl(b.file)]);
  box.querySelector('#cmpImgA').src = ua || ''; box.querySelector('#cmpImgB').src = ub || '';
  box.querySelector('#cmpDiff').innerHTML = `<ul><li>Only before: ${gpList(d.onlyA)}.</li><li>Only after: ${gpList(d.onlyB)}.</li>` +
    `<li>${d.same} words are the same.</li>` +
    (d.avoidA.length || d.avoidB.length ? `<li>Kept out - only before: ${gpList(d.avoidA)}; only after: ${gpList(d.avoidB)}.</li>` : '') +
    d.facts.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>';
  box.querySelector('#cmpAdd').disabled = !d.onlyB.length;
}

function gpCmpAdd() {
  const d = gpDiff(...gpCmpPair()), have = genSplit(el('genExtra').value).map(t => t.toLowerCase()), add = d.onlyB.filter(t => !have.includes(t));
  el('genExtra').value = [...genSplit(el('genExtra').value), ...add].join(', ').slice(0, 200);
  el('genExtra').dispatchEvent(new Event('input'));
  el('cmpDiff').insertAdjacentHTML('beforeend', `<p>${add.length ? `Added to More tags: ${esc(add.join(', '))}.` : 'They are in More tags already.'}</p>`);
}

async function gpCmpOpen() {
  const status = el('genStatus');
  const list = (await genMade()).filter(u => u.prompt).slice(0, 40);
  if (list.length < 2) { status.textContent = 'What changed needs two pictures made here.'; return; }
  gpCmp = { list };
  const box = gpCmpSheet(), name = (u, i) => `${i + 1}. ${String(u.name || u.prompt).slice(0, 36)} - ${new Date(u.t).toLocaleString()}`;
  const opts = list.map((u, i) => `<option value="${i}">${esc(name(u, i))}</option>`).join('');
  box.querySelector('#cmpSelA').innerHTML = opts; box.querySelector('#cmpSelB').innerHTML = opts;
  // The newest is the after, the one made before it the before.
  box.querySelector('#cmpSelA').value = '1'; box.querySelector('#cmpSelB').value = '0';
  box.classList.remove('hidden');
  dialogOpened(box, box.querySelector('#cmpSelA'));
  await gpCmpShow();
}

function gpCmpClose() {
  const box = document.getElementById('cmpSheet');
  if (!box || !gpCmp) return;
  gpCmp = null;
  box.classList.add('hidden');
  dialogClosed(box);
}

/* ---- simple forms */

/* The scene taken apart into the solids an artist builds it from, before any line is final. Each row: key, name, the tags. */
const GP_FORMS = [
  ['mannequin', 'Wooden mannequin', 'wooden mannequin, art mannequin, simple shapes, spheres and cylinders for the joints and limbs'],
  ['blocks', 'Boxes and cylinders', 'construction drawing, built from boxes and cylinders, flat planes, perspective box method'],
  ['contour', 'Contour lines on the forms', 'cross-contour lines, volume lines on the form, rounded solids, construction sketch'],
];
const GP_FORMS_KEY = 'refboard.generate.forms.v1';
const GP_FORMS_WEIGHT = 1.3;
const GP_FORMS_AVOID = 'colour, shading, detailed face, texture, background';
const gpFormsPicked = () => { const v = gnStore(GP_FORMS_KEY, null); return Array.isArray(v) ? GP_FORMS.filter(f => v.includes(f[0])).map(f => f[0]) : ['mannequin', 'blocks']; };

/* base: the request the choices make (genRequest()); forms: GP_FORMS rows; seed: the one they share. One job for each. */
function gpFormsJobs(base, forms, seed) {
  return forms.map(([, label, tags]) => ({
    ...base, seed,
    prompt: [...genSplit(base.prompt), ...genWeighted(tags, GP_FORMS_WEIGHT), 'line art, monochrome, white background'].join(', '),
    avoid: [base.avoid, GP_FORMS_AVOID].filter(Boolean).join(', '),
    tags: [...base.tags, 'simple forms', label.toLowerCase()].slice(0, 24).map(t => t.slice(0, 40)),
  }));
}

function gpFormsGo() {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (genSource) { status.textContent = 'Simple forms are drawn from the choices alone: drop the picture first.'; return; }
  const picked = gpFormsPicked(), forms = GP_FORMS.filter(f => picked.includes(f[0]));
  if (!forms.length) { status.textContent = 'Choose at least one way to take it apart.'; return; }
  const jobs = gpFormsJobs(genRequest(), forms, Math.floor(Math.random() * 2 ** 48));
  runGenerate(jobs, (i, n) => `Drawing the forms ${i} of ${n} - ${forms[i - 1][1].toLowerCase()}...`, `${jobs.length} drawings of the scene as simple forms - in Uploads, Generated.`);
}

/* ---- the history */

const GP_PINS_KEY = 'refboard.generate.pins.v1';
const GP_HISTORY_MAX = 60;
const gpPins = () => { const v = gnStore(GP_PINS_KEY, []); return Array.isArray(v) ? v : []; };
let gpHist = null;      // { list, pinned } while the sheet is open

function gpHistorySheet() {
  const box = gnSheet('hisSheet', 'History',
    `<p class="count">Your latest pictures with the words they were made from. Pin the ones to come back to; draw one again with a new seed.</p>` +
    gnChips('hisFilter', [['all', 'All'], ['pinned', 'Pinned']], 'Which to show') + `<div class="gp-his" id="hisList"></div>`, gpHistoryClose);
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    box.querySelector('#hisFilter').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { gpHist.pinned = b.dataset.v === 'pinned'; gpHistoryShow(); } });
    box.querySelector('#hisList').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const u = gpHist.list[+b.closest('[data-i]').dataset.i];
      if (b.dataset.act === 'pin') { const p = new Set(gpPins()); p.has(u.file) ? p.delete(u.file) : p.add(u.file); gnPut(GP_PINS_KEY, [...p]); gpHistoryShow(); }
      else gpHistoryAgain(u);
    });
  }
  return box;
}

async function gpHistoryShow() {
  const box = gpHistorySheet(), pins = new Set(gpPins());
  gnPress(box.querySelector('#hisFilter'), v => (v === 'pinned') === gpHist.pinned);
  const rows = gpHist.list.map((u, i) => [u, i]).filter(([u]) => !gpHist.pinned || pins.has(u.file));
  const urls = await Promise.all(rows.map(([u]) => storeFileUrl(u.file)));
  box.querySelector('#hisList').innerHTML = rows.length ? rows.map(([u, i], k) =>
    `<div class="gp-his-row" data-i="${i}"><img src="${esc(urls[k] || '')}" alt="" loading="lazy"><div><div class="count">${esc(new Date(u.t).toLocaleString())}</div>` +
    `<div class="gp-his-words">${esc(String(u.prompt).slice(0, 160))}</div>` +
    `<div class="row"><button type="button" class="ghost" data-act="pin" aria-pressed="${pins.has(u.file)}">${pins.has(u.file) ? 'Unpin' : 'Pin'}</button>` +
    `<button type="button" class="ghost" data-act="again" title="The same words and the same shape, a new seed">Draw again</button></div></div></div>`).join('')
    : `<p class="count">${gpHist.pinned ? 'Nothing is pinned yet.' : 'No pictures made here yet.'}</p>`;
}

function gpHistoryAgain(u) {
  const status = el('genStatus');
  if (genBusy) { status.textContent = 'Wait for the picture in hand - or Stop it.'; return; }
  if (genSource) { status.textContent = 'A picture is drawn again from its words alone: drop the picture first.'; return; }
  const base = genRequest(), job = { ...base, prompt: u.prompt, avoid: u.avoid || '', shape: u.shape || base.shape, seed: Math.floor(Math.random() * 2 ** 48), tags: [...(u.tags || []).filter(t => t !== 'draft'), 'again'].slice(0, 24) };
  gpHistoryClose();
  runGenerate([job], 'Drawing it again...', 'Drawn again - in Uploads, Generated.');
}

async function gpHistoryOpen() {
  const list = (await genMade()).filter(u => u.prompt && !(u.tags || []).includes('draft')).sort((a, b) => b.t - a.t).slice(0, GP_HISTORY_MAX);
  if (!list.length) { el('genStatus').textContent = 'The history is empty: no pictures were made here yet.'; return; }
  gpHist = { list, pinned: false };
  const box = gpHistorySheet();
  gnOpenSheet(box, box.querySelector('#hisFilter [data-v]'));
  await gpHistoryShow();
}

function gpHistoryClose() { gnCloseSheet(document.getElementById('hisSheet')); gpHist = null; }

/* ---- the panel */

function genPickBlocks() {
  const block = (id, title, text, inner) => `<details class="gm-block" id="${id}"><summary>${title}</summary><p class="count">${text}</p>${inner}</details>`;
  return block('gpPalBlock', 'A palette from a picture', 'Six colours found in a picture you like - a painting, a photo of a sky - become Your palette, as words the model knows and, if you wish, as the colours the picture is kept to.',
      `<div class="row"><button type="button" class="ghost" id="gpPalPick">Choose a picture</button><input type="file" id="gpPalInput" accept="image/*" class="hidden" aria-label="Choose a picture to take the colours from"></div>` +
      `<div class="gp-sws" id="gpPalSw"></div><div class="count" id="gpPalNote" role="status" aria-live="polite"></div>` +
      `<div class="row"><label class="check"><input type="checkbox" id="gpPalLock"> Recolour the picture to it</label><button type="button" class="ghost" id="gpPalUse" disabled>Use as Your palette</button></div>`) +
    block('gpSetBlock', 'Colours from my set', 'Keep the picture to the markers or pencils you marked as yours in Palettes (Fewest markers and pencils); for watercolour, to the Holbein box. All of the list if you marked none.',
      `<button type="button" class="ghost" id="gpSetGo">Use my set</button>`) +
    block('gpCmpBlock', 'What changed', 'Two of your pictures side by side and the words that one has and the other has not: what a change in the choices did.',
      `<button type="button" class="ghost" id="gpCmpGo">Compare two</button>`) +
    block('gpFormsBlock', 'Simple forms', 'The scene taken apart into the solids it is built from - a mannequin, boxes and cylinders, contour lines on the forms - to draw over before you commit to the lines. One seed for all.',
      gnChips('gpForms', GP_FORMS, 'Ways to take it apart') + `<button type="button" class="ghost" id="gpFormsGo">Draw the forms</button>`) +
    block('gpHisBlock', 'History', 'Your latest pictures with their words: pin the ones to come back to, or draw one again with a new seed.',
      `<button type="button" class="ghost" id="gpHisGo">Open the history</button>`);
}

function genPickWire() {
  el('gpPalPick').addEventListener('click', () => el('gpPalInput').click());
  el('gpPalInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) gpPalettePick(f); });
  el('gpPalUse').addEventListener('click', gpPaletteUse);
  el('gpSetGo').addEventListener('click', gpSetGo);
  el('gpCmpGo').addEventListener('click', gpCmpOpen);
  const formsSync = () => gnPress(el('gpForms'), v => gpFormsPicked().includes(v));
  formsSync();
  el('gpForms').addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const p = new Set(gpFormsPicked()); p.has(b.dataset.v) ? p.delete(b.dataset.v) : p.add(b.dataset.v);
    gnPut(GP_FORMS_KEY, [...p]); formsSync();
  });
  el('gpFormsGo').addEventListener('click', gpFormsGo);
  el('gpHisGo').addEventListener('click', gpHistoryOpen);
}
