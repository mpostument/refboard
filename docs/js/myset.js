/* refboard - My set: the markers or pencils you own, and what the palette is in
   them. fewpaints.js keeps WHICH ones are yours (few.own - the same list
   Generate reads); this file adds
     - named sets, so a desk box and a travel box can each be one click;
     - Match: under the palette, each colour as the nearest marker or pencil
       of the set, how far off it lands, and a button to take those instead -
       a palette from a character's picture, in the markers you can reach for;
     - "only from my set": a new palette is made of the set's own colours;
     - what to buy next: the one marker that would bring the palette closest.
   A marker is matched as a single stroke (a pencil at its firm stroke), by
   OKLab distance x 100, the recipes' scale: under 4 is close, over 12 is far.
   Paints have their own sets: pick the tubes you have and save them (paint.js keeps them as palettes of the
   Colour studio, the eyedropper and this view). Everything - what you have, the named sets, the paint sets -
   can be saved to a file and loaded back.
   Loaded with palette.js - see lazy-palette in index.html. */
"use strict";

const MY_KEY = 'refboard.myset.v1';
const MY_SETS_MAX = 12;
const MY_FAR = 12;

const my = (() => {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(MY_KEY)) || {}; } catch { /* a fresh start */ }
  return { sets: mySanitiseSets(v.sets), match: !!v.match, only: !!v.only };
})();
/* Named sets as they may be trusted: a name, a kind we know, codes that are text - from storage or from a file. */
function mySanitiseSets(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const s of list) {
    if (!s || typeof s.name !== 'string' || !(s.kind === 'copic' || s.kind === 'pencils') || !Array.isArray(s.codes)) continue;
    const name = s.name.trim().slice(0, 40), codes = [...new Set(s.codes.filter(c => typeof c === 'string' && c.length <= 12))].slice(0, 400);
    if (!name || out.some(o => o.kind === s.kind && o.name === name)) continue;
    out.push({ name, kind: s.kind, codes });
    if (out.length >= MY_SETS_MAX) break;
  }
  return out;
}
function mySave() {
  try { localStorage.setItem(MY_KEY, JSON.stringify(my)); } catch { /* private mode */ }
}

// 'copic' or 'pencils' while one of them is the thing being marked; null for paints.
const myKind = () => FEW_THINGS[few.medium] ? few.medium : null;
const myItems = kind => { const own = new Set(fewMine(kind)); return FEW_LISTS()[kind].filter(m => own.has(m.code)); };
const myLab = m => m.lab || (m.lab = fewLab(m.rgb));
const myDist = (a, b) => 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* The nearest of `items` to this colour (not one of `skip`, unless nothing else is left). */
function myNearest(rgb, items, skip) {
  const t = fewLab(rgb);
  let best = null;
  for (const m of items) {
    if (skip && skip.has(m.code)) continue;
    const d = myDist(myLab(m), t);
    if (!best || d < best.dE) best = { m, dE: d };
  }
  return best || (skip && items.length ? myNearest(rgb, items) : null);
}

/* The palette's swatches with the unlocked ones taken to the set, each a different item where the set is big enough. */
function mySnapSwatches(swatches, kind) {
  const items = myItems(kind);
  if (!items.length) return swatches;
  const used = new Set(swatches.filter(s => s.locked).map(s => myNearest(s.rgb, items)?.m.code));
  return swatches.map(s => {
    if (s.locked) return s;
    const hit = myNearest(s.rgb, items, used.size < items.length ? used : null);
    used.add(hit.m.code);
    return { rgb: hit.m.rgb.slice(), locked: false };
  });
}

/* A new palette is made of the set's colours when that is asked for (palette.js calls this). */
function myGenerated(swatches) {
  const kind = myKind();
  return my.only && kind && myItems(kind).length >= 2 ? mySnapSwatches(swatches, kind) : swatches;
}

/* The unowned items to get, one after another, each the one that shrinks the palette's total distance most
   given the ones before it: [{ m, gain, closer }], at most `n`, and only those worth it (half a point on average). */
function myMissing(rgbs, kind, n = 3) {
  const own = myItems(kind), have = new Set(own.map(m => m.code));
  const labs = rgbs.map(fewLab);
  const now = labs.map(t => own.length ? Math.min(...own.map(m => myDist(myLab(m), t))) : FEW_CAP);
  const picks = [];
  while (picks.length < n) {
    let best = null;
    for (const c of FEW_LISTS()[kind]) {
      if (have.has(c.code)) continue;
      const l = myLab(c);
      let gain = 0, closer = 0;
      labs.forEach((t, i) => { const d = myDist(l, t); if (d < now[i]) { gain += now[i] - d; closer++; } });
      if (!best || gain > best.gain) best = { m: c, gain, closer };
    }
    if (!best || best.gain / rgbs.length < 0.5) break;
    picks.push(best); have.add(best.m.code);
    const l = myLab(best.m);
    labs.forEach((t, i) => { now[i] = Math.min(now[i], myDist(l, t)); });
  }
  return picks;
}

/* The nearest few of the set to a colour, nearest first: [{ m, dE }]. */
function myNearestN(rgb, items, n) {
  const t = fewLab(rgb);
  return items.map(m => ({ m, dE: myDist(myLab(m), t) })).sort((a, b) => a.dE - b.dE).slice(0, n);
}

function myRenderSets() {
  const host = el('pgSets'), kind = myKind();
  if (!kind) { host.innerHTML = ''; return; }
  const mine = fewMine(kind).join(',');
  host.innerHTML = my.sets.map((s, i) => s.kind !== kind ? '' :
    `<span class="chip-set"><button class="chip" type="button" data-my-set="${i}" aria-pressed="${s.codes.join(',') === mine}" title="Use this set: ${s.codes.length} ${FEW_THINGS[kind]}">${esc(s.name)} <small>${s.codes.length}</small></button>` +
    `<button class="chip" type="button" data-my-del="${i}" aria-label="Delete the set ${esc(s.name)}" title="Delete this set">&times;</button></span>`).join('');
}

/* ---- paints: the tubes you have, kept as a set of paint.js */
let myDraft = null;   // the pigment keys marked in the builder; null = start from the palette in use
const myDraftKeys = () => myDraft || paintKeys(paintPaletteKey(), paintMedium());

function myRenderPaints() {
  const host = el('pgPaintSet'), on = few.medium === 'paints';
  host.classList.toggle('hidden', !on);
  if (!on) return;
  const mine = new Set(myDraftKeys()), water = paintMedium() === 'water';
  const keys = Object.keys(PIGMENTS).filter(k => !(water && PIGMENTS[k].body));
  el('pgPaintSetSum').textContent = `Which paints do you have? ${[...mine].filter(k => keys.includes(k)).length} marked`;
  el('pgPaintSetList').innerHTML = keys.map(k => `<button class="chip" type="button" data-my-pig="${esc(k)}" aria-pressed="${mine.has(k)}" title="${esc(PIGMENTS[k].name)}"><i style="background:${PIGMENTS[k].hex}"></i>${esc(PIGMENTS[k].name)}</button>`).join('');
  el('pgPaintSets').innerHTML = paintSetsList().map((p, i) => `<span class="chip-set"><span class="chip" aria-hidden="true">${esc(p.name)} <small>${p.keys.length}</small></span>` +
    `<button class="chip" type="button" data-my-pdel="${i}" aria-label="Delete the paint set ${esc(p.name)}" title="Delete this paint set">&times;</button></span>`).join('');
}

function myRender() {
  const kind = myKind(), bar = el('pgMatchBar'), out = el('pgMatchOut');
  myRenderSets();
  myRenderPaints();
  bar.classList.toggle('hidden', !kind);
  el('pgMatch').setAttribute('aria-pressed', String(my.match));
  el('pgOnlyMine').setAttribute('aria-pressed', String(my.only));
  const things = kind ? FEW_THINGS[kind] : '';
  if (!kind || !my.match || typeof pg === 'undefined' || !pg?.swatches) { out.classList.add('hidden'); out.innerHTML = ''; return; }
  const items = myItems(kind);
  if (items.length < 1) {
    out.innerHTML = `<span class="count">Mark at least one of your ${things} above.</span>`;
    out.classList.remove('hidden');
    return;
  }
  const rgbs = pg.swatches.map(s => s.rgb);
  const rows = rgbs.map(rgb => ({ rgb, r: myNearest(rgb, items) }));
  const close = rows.filter(x => x.r.dE < FEW_CLOSE).length, far = rows.filter(x => x.r.dE > MY_FAR).length;
  const chip = m => `<i style="background:${m.hex}"></i>${esc(m.code)} ${esc(m.name)}`;
  const buy = myMissing(rgbs, kind);
  const alts = rgb => {
    const near = myNearestN(rgb, items, 3);
    if (near[0].dE < FEW_CLOSE || near.length < 2) return '';
    const hint = near[0].dE > MY_FAR ? 'Nothing you have is near: lay one over another, or see what to get next below.'
      : 'Close, not exact: one light layer of the nearest, or the second over the first, gets nearer.';
    return '<details class="pg-alt"><summary>Other near ones</summary>' +
      near.map(x => `<span class="pg-few-paint">${chip(x.m)}</span> <span class="count">${x.dE.toFixed(1)}</span>`).join('') + `<div class="count">${hint}</div></details>`;
  };
  out.innerHTML =
    `<h4>In my ${things} <small>${items.length} of ${FEW_LISTS()[kind].length}</small></h4>` +
    `<p class="count">${close} of ${rows.length} colours land close (under ${FEW_CLOSE})` + (far ? `; ${far} ${far === 1 ? 'is' : 'are'} far from anything you have (over ${MY_FAR})` : '') + '.</p>' +
    '<div class="pg-few-rows">' + rows.map(x => {
      const cls = x.r.dE < FEW_CLOSE ? 'close' : x.r.dE > MY_FAR ? 'far' : '';
      return `<div class="pg-few-row"><i style="background:${colHexOf(x.rgb)}" title="${colHexOf(x.rgb)} - the colour in the palette"></i>` +
        `<span class="pg-few-paint">${chip(x.r.m)}</span> <span class="count pg-dE ${cls}">${x.r.dE.toFixed(1)}</span></div>` + alts(x.rgb);
    }).join('') + '</div>' +
    (buy.length ? '<p class="count">Worth getting next, one after another:</p><ol class="pg-buy">' + buy.map(b => `<li><span class="pg-few-paint">${chip(b.m)}</span> <span class="count">- ${b.closer === 1 ? 'one colour' : b.closer + ' colours'} would land closer</span></li>`).join('') + '</ol>' : '') +
    '<div class="row"><button class="ghost" type="button" id="pgMatchUse" title="Replace the palette with these colours, so it is exactly what your set lays down (Undo brings the old one back)">Use these colours</button></div>';
  out.classList.remove('hidden');
}

function initMySet() {
  myIOWire();
  myPaintsWire();
  el('pgMatch').addEventListener('click', () => { my.match = !my.match; mySave(); myRender(); });
  el('pgOnlyMine').addEventListener('click', () => { my.only = !my.only; mySave(); myRender(); });
  el('pgMatchOut').addEventListener('click', e => {
    if (!e.target.closest('#pgMatchUse')) return;
    const kind = myKind();
    if (kind && pg?.swatches) palgenSet(mySnapSwatches(pg.swatches.map(s => ({ ...s, locked: false })), kind));
  });
  el('pgSets').addEventListener('click', e => {
    const use = e.target.closest('[data-my-set]'), del = e.target.closest('[data-my-del]');
    if (use) {
      const s = my.sets[Number(use.dataset.mySet)], known = s && new Set(FEW_LISTS()[s.kind].map(m => m.code));
      const codes = s ? s.codes.filter(c => known.has(c)) : [];
      if (codes.length) fewSetMine(s.kind, codes);
    }
    if (del) { my.sets.splice(Number(del.dataset.myDel), 1); mySave(); myRenderSets(); }
  });
  const name = el('pgSetName');
  const save = () => {
    const kind = myKind(), n = name.value.trim();
    if (!kind || !n || (few.own[kind] && !few.own[kind].length)) { name.focus(); return; }
    const codes = few.own[kind] ? fewMine(kind) : FEW_LISTS()[kind].map(m => m.code), at = my.sets.findIndex(s => s.kind === kind && s.name === n);
    if (at >= 0) my.sets[at].codes = codes;
    else if (my.sets.length < MY_SETS_MAX) my.sets.push({ name: n, kind, codes });
    else { name.setCustomValidity(`${MY_SETS_MAX} sets at most: delete one first`); name.reportValidity(); name.setCustomValidity(''); return; }
    name.value = '';
    mySave(); myRenderSets();
  };
  el('pgSetSave').addEventListener('click', save);
  name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  myRender();
}

/* ---- a file of my set: back it up, or take it to another computer */
function myExport() {
  return { app: 'refboard-myset', v: 1, own: { copic: few.own.copic, pencils: few.own.pencils }, sets: my.sets, paintSets: paintSetsList() };
}
/* Takes a parsed file; returns { ok, text }. Nothing is trusted: names and codes are checked, the codes of the list kept. */
function myImport(data) {
  if (!data || data.app !== 'refboard-myset' || !Number.isInteger(data.v)) return { ok: false, text: 'This is not a My set file from refboard.' };
  let sets = 0, owned = 0, paints = 0;
  for (const kind of Object.keys(FEW_THINGS)) {
    const list = data.own?.[kind], known = new Set(FEW_LISTS()[kind].map(m => m.code));
    if (Array.isArray(list)) {
      const codes = [...new Set(list.filter(c => typeof c === 'string' && known.has(c)))];
      if (codes.length) { few.own[kind] = codes.length < known.size ? codes : null; owned += codes.length; }
    }
  }
  for (const s of mySanitiseSets(data.sets)) {
    const at = my.sets.findIndex(o => o.kind === s.kind && o.name === s.name);
    if (at >= 0) my.sets[at] = s; else if (my.sets.length < MY_SETS_MAX) my.sets.push(s); else continue;
    sets++;
  }
  if (Array.isArray(data.paintSets)) for (const p of data.paintSets) if (p && typeof p.name === 'string' && Array.isArray(p.keys) && paintSetsSave(p.name, p.keys.filter(k => typeof k === 'string'))) paints++;
  fewSave(); mySave(); paintPalettesChanged();
  fewMineRender(); fewSync();
  return { ok: true, text: `Loaded: ${owned} marked, ${sets} named ${sets === 1 ? 'set' : 'sets'}, ${paints} paint ${paints === 1 ? 'set' : 'sets'}.` };
}
function myIOWire() {
  const note = el('pgMyIONote'), file = el('pgMyFile');
  el('pgMyExport').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(myExport(), null, 1)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'refboard-my-set.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    note.textContent = 'Saved refboard-my-set.json.';
  });
  el('pgMyImport').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    try {
      if (f.size > 1e6) throw new Error('too big');
      note.textContent = myImport(JSON.parse(await f.text())).text;
    } catch { note.textContent = 'That file could not be read as a My set file.'; }
  });
}
function myPaintsWire() {
  el('pgPaintSetList').addEventListener('click', e => {
    const b = e.target.closest('[data-my-pig]');
    if (!b) return;
    const k = b.dataset.myPig, cur = myDraftKeys();
    myDraft = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
    myRenderPaints();
    el('pgPaintSetList').querySelector(`[data-my-pig="${k}"]`)?.focus();
  });
  el('pgPaintSets').addEventListener('click', e => {
    const d = e.target.closest('[data-my-pdel]');
    if (!d) return;
    const p = paintSetsList()[Number(d.dataset.myPdel)];
    if (p) { paintSetsDelete(p.name); paintPalettesChanged(); myRenderPaints(); }
  });
  const name = el('pgPaintSetName'), save = () => {
    const n = name.value.trim(), keys = myDraftKeys().filter(k => PIGMENTS[k]);
    if (!n || keys.length < 2) { (n ? el('pgPaintSetList') : name).focus(); return; }
    if (!paintSetsSave(n, keys)) { name.setCustomValidity(`${PAINT_SETS_MAX} sets at most: delete one first`); name.reportValidity(); name.setCustomValidity(''); return; }
    name.value = '';
    setPaintPaletteKey('my:' + n);
    paintPalettesChanged(); myRenderPaints();
    if (typeof palgenRender === 'function') palgenRender();
  };
  el('pgPaintSetSave').addEventListener('click', save);
  name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
}
