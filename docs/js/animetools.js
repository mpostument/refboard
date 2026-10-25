/* refboard - Anime study, the four tools beside frames and backgrounds: Outfits, Proportions,
   Faces and Storyboard. What they work out is in js/animecheck.js; this is the page that
   gathers the pictures and clicks and shows the answers. Nothing is uploaded: a picture is read
   in this browser and goes when you leave the page (the storyboard's frames and the colours of
   the hair and eyes are kept in this browser).
   Loaded with the section (loadSection('anime')); asInit() in js/animestudy.js calls atInit(). */
"use strict";

const AT_KEY = 'refboard.animeTools.v1';

function atLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(AT_KEY)) || {}; } catch { /* defaults */ }
  s.hair = /^#[0-9a-f]{6}$/i.test(s.hair) ? s.hair : '#6b4a2f';
  s.eyes = /^#[0-9a-f]{6}$/i.test(s.eyes) ? s.eyes : '#3f7fb8';
  s.build = AC_BUILDS[s.build] ? s.build : 'anime';
  s.manner = AC_FACES[s.manner] ? s.manner : 'soft';
  const ok = f => f && AC_SHOTS[f.shot] && AC_ANGLES[f.angle] && AC_GAZE[f.gaze];
  s.frames = (Array.isArray(s.frames) ? s.frames.filter(ok) : []).slice(0, AC_MAX_FRAMES).map(f => ({ ...f, text: String(f.text || '').slice(0, 120) }));
  if (!s.frames.length) s.frames = atSequence('open');
  return s;
}
function atSave(s) { try { localStorage.setItem(AT_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
const atSequence = k => AC_SEQUENCES[k].frames.map(([shot, angle, gaze]) => ({ shot, angle, gaze, text: '' }));
const atRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const atBlob = (canvas, type = 'image/png') => new Promise(res => canvas.toBlob(res, type));
function atDownload(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const at = { outfits: [], faceCanvas: null, faceStep: 0, drawing: null, ys: {}, mark: 0 };

function atInit() {
  const st = atLoad();
  // Outfits.
  el('aoHair').value = st.hair; el('aoEyes').value = st.eyes;
  for (const [id, key] of [['aoHair', 'hair'], ['aoEyes', 'eyes']]) el(id).addEventListener('input', () => { const s = atLoad(); s[key] = el(id).value; atSave(s); aoRender(); });
  el('aoAdd').addEventListener('click', () => el('aoInput').click());
  el('aoInput').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) aoAddFiles(f); });
  el('aoPane').addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  el('aoPane').addEventListener('drop', e => { if (e.dataTransfer?.files?.length) { e.preventDefault(); aoAddFiles([...e.dataTransfer.files]); } });
  el('aoList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { at.outfits.splice(+b.dataset.rm, 1); aoRender(); } });
  el('aoClear').addEventListener('click', () => { at.outfits = []; aoRender(); });
  el('aoPalette').addEventListener('click', () => {
    const rgbs = at.outfits.flatMap(o => o.palette.slice(0, 3).map(p => p.rgb)).slice(0, 12);
    if (rgbs.length) openPalette(rgbs);
  });
  el('aoFacePick').addEventListener('click', () => el('aoFaceInput').click());
  el('aoFaceInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    at.faceCanvas = await afImageCanvas(f); at.faceStep = 0;
    const cv = el('aoFaceCanvas'); cv.width = at.faceCanvas.width; cv.height = at.faceCanvas.height;
    cv.getContext('2d').drawImage(at.faceCanvas, 0, 0); cv.classList.remove('hidden');
    el('aoStatus').textContent = 'Click her hair.';
  });
  el('aoFaceCanvas').addEventListener('click', e => {
    const cv = e.currentTarget, r = cv.getBoundingClientRect();
    const x = Math.round((e.clientX - r.left) / r.width * cv.width), y = Math.round((e.clientY - r.top) / r.height * cv.height);
    const d = cv.getContext('2d').getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
    const m = [0, 1, 2].map(k => Math.round([...Array(25).keys()].reduce((a, i) => a + d[4 * i + k], 0) / 25));
    const s = atLoad(), hex = colHexOf(m);
    if (at.faceStep === 0) { s.hair = hex; el('aoHair').value = hex; el('aoStatus').textContent = 'Now click her eyes.'; at.faceStep = 1; }
    else { s.eyes = hex; el('aoEyes').value = hex; el('aoStatus').textContent = 'Taken. Add her outfits.'; at.faceStep = 0; }
    atSave(s); aoRender();
  });
  // Proportions.
  el('apBuild').innerHTML = Object.entries(AC_BUILDS).map(([k, b]) => `<button type="button" class="chip" data-build="${k}" aria-pressed="${st.build === k}">${esc(b.label)}</button>`).join('');
  el('apBuild').addEventListener('click', e => {
    const b = e.target.closest('[data-build]'); if (!b) return;
    const s = atLoad(); s.build = b.dataset.build; atSave(s);
    for (const c of el('apBuild').children) c.setAttribute('aria-pressed', String(c === b));
    apRender();
  });
  el('apPick').addEventListener('click', () => el('apInput').click());
  el('apInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) apLoad(f); });
  el('apPane').addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  el('apPane').addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f && f.type.startsWith('image/')) { e.preventDefault(); apLoad(f); } });
  el('apCanvas').addEventListener('click', e => {
    if (at.mark >= AC_MARKS.length) return;
    const cv = e.currentTarget, r = cv.getBoundingClientRect();
    at.ys[AC_MARKS[at.mark][0]] = (e.clientY - r.top) / r.height * cv.height;
    at.mark++;
    apRender();
  });
  el('apSkip').addEventListener('click', () => { if (at.drawing && at.mark < AC_MARKS.length - 1) { at.mark++; apRender(); } });
  el('apUndo').addEventListener('click', () => { if (at.mark) { at.mark--; delete at.ys[AC_MARKS[at.mark][0]]; apRender(); } });
  el('apClear').addEventListener('click', () => { at.ys = {}; at.mark = 0; apRender(); });
  // Faces.
  el('acManner').innerHTML = Object.entries(AC_FACES).map(([k, f]) => `<button type="button" class="chip" data-manner="${k}" aria-pressed="${st.manner === k}" title="${esc(f.about)}">${esc(f.label)}</button>`).join('');
  el('acManner').addEventListener('click', e => { const b = e.target.closest('[data-manner]'); if (b) acPick(b.dataset.manner); });
  el('acFaces').addEventListener('click', e => { const b = e.target.closest('[data-manner]'); if (b) acPick(b.dataset.manner); });
  el('acCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(AC_FACES[atLoad().manner].words); announce('Copied.'); } catch { announce('Could not copy - the words are under the face.'); }
  });
  el('acToGenerate').addEventListener('click', () => {
    setView({ kind: 'generate' });
    // Generate fills its page when it opens; the words go into its "More tags" box once it has.
    const put = () => { const box = el('genExtra'); if (!box) return false; box.value = AC_FACES[atLoad().manner].words; box.dispatchEvent(new Event('input')); return true; };
    if (!put()) setTimeout(put, 400);
  });
  el('acToGenerate').classList.toggle('hidden', typeof genAvailable === 'function' && !genAvailable());
  // Storyboard.
  el('asbSeq').innerHTML = Object.entries(AC_SEQUENCES).map(([k, q]) => `<button type="button" class="chip" data-seq="${k}">${esc(q.label)}</button>`).join('');
  el('asbSeq').addEventListener('click', e => { const b = e.target.closest('[data-seq]'); if (!b) return; const s = atLoad(); s.frames = atSequence(b.dataset.seq); atSave(s); asbRender(); });
  el('asbAdd').addEventListener('click', () => { const s = atLoad(); if (s.frames.length >= AC_MAX_FRAMES) return; s.frames.push({ shot: 'ms', angle: 'eye', gaze: 'right', text: '' }); atSave(s); asbRender(); });
  el('asbEdit').addEventListener('change', e => asbEdit(e.target));
  el('asbEdit').addEventListener('input', e => { if (e.target.matches('input[data-k=text]')) asbEdit(e.target, true); });
  el('asbEdit').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const s = atLoad(); if (s.frames.length > 1) { s.frames.splice(+b.dataset.rm, 1); atSave(s); asbRender(); } });
  el('asbPrint').addEventListener('click', () => printHtml(`<!doctype html><meta charset="utf-8"><title>Storyboard</title><style>body{margin:0}svg{width:100%;height:auto}@page{margin:10mm}</style>${acStripSvg(atLoad().frames)}`));
  el('asbSave').addEventListener('click', () => atDownload(new Blob([acStripSvg(atLoad().frames)], { type: 'image/svg+xml' }), 'storyboard.svg'));
  el('asbKeep').addEventListener('click', asbKeep);
}

// The pane for a mode has just been shown.
function atShow(mode) {
  if (mode === 'outfits') aoRender();
  if (mode === 'proportions') apRender();
  if (mode === 'faces') acRender();
  if (mode === 'storyboard') asbRender();
}

/* ---- outfits */

// The colours of an outfit picture without its plain ground: the border's colour is not the outfit's.
function aoPalette(canvas) {
  const pal = afFrame(stepsRead(canvas)).palette.map(p => ({ rgb: p.rgb, share: p.share }));
  const w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
  const edge = [g.getImageData(0, 0, w, 1).data, g.getImageData(0, h - 1, w, 1).data, g.getImageData(0, 0, 1, h).data, g.getImageData(w - 1, 0, 1, h).data];
  const labs = edge.flatMap(d => { const o = []; for (let i = 0; i < d.length; i += 16) o.push(acLab([d[i], d[i + 1], d[i + 2]])); return o; });
  const mean = [0, 1, 2].map(k => labs.reduce((a, l) => a + l[k], 0) / labs.length);
  const spread = labs.reduce((a, l) => a + acDist(l, mean), 0) / labs.length;
  if (spread > 0.04) return pal;                  // a busy border: no plain ground to drop
  const kept = pal.filter(p => acDist(acLab(p.rgb), mean) > 0.05);
  const total = kept.reduce((a, p) => a + p.share, 0);
  return kept.length && total > 0 ? kept.map(p => ({ rgb: p.rgb, share: p.share / total * 100 })) : pal;
}

async function aoAddFiles(files) {
  const images = files.filter(f => f.type.startsWith('image/'));
  if (!images.length) { el('aoStatus').textContent = 'Give pictures of the outfits.'; return; }
  for (const f of images.slice(0, 8 - at.outfits.length)) {
    el('aoStatus').textContent = `Reading ${f.name}...`;
    await asYield();
    const canvas = await afImageCanvas(f);
    at.outfits.push({ name: f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 30) || 'Outfit', palette: aoPalette(canvas), thumb: canvas.toDataURL('image/jpeg', 0.7) });
  }
  el('aoStatus').textContent = at.outfits.length >= 8 ? 'Eight outfits is the most.' : 'Add more, or change the hair or eye colour.';
  aoRender();
}

function aoRender() {
  const s = atLoad(), has = at.outfits.length > 0;
  el('aoActions').classList.toggle('hidden', !has);
  if (!has) { el('aoList').innerHTML = ''; el('aoPairs').textContent = ''; return; }
  const res = acOutfits(atRgb(s.hair), atRgb(s.eyes), at.outfits.map(o => ({ name: o.name, palette: o.palette })));
  const word = { good: 'Works', check: 'Check', plain: 'Plain' };
  el('aoList').innerHTML = res.outfits.map((o, i) =>
    `<figure class="ao-card" data-verdict="${o.verdict}"><img alt="${esc(o.name)}" src="${at.outfits[i].thumb}">` +
    `<figcaption><div class="row"><b class="grow">${esc(o.name)}</b><span class="ao-verdict">${word[o.verdict]}</span>` +
    `<button type="button" class="ghost" data-rm="${i}" aria-label="Remove ${esc(o.name)}">Remove</button></div>` +
    `<div class="af-sw">${o.main.map(m => `<i style="background:${rgbCss(m.rgb)}" title="${colHexOf(m.rgb)} · ${Math.round(m.share)}%"></i>`).join('')}</div>` +
    `<ul>${o.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></figcaption></figure>`).join('');
  el('aoPairs').textContent = res.pairs.join(' ');
}

/* ---- proportions */

function apLoad(file) {
  // The drawing at a size to click on, not the small size colours are read at.
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const k = Math.min(1, 720 / img.naturalHeight, 900 / img.naturalWidth), cv = el('apCanvas');
    at.drawing = document.createElement('canvas');
    at.drawing.width = Math.max(1, Math.round(img.naturalWidth * k)); at.drawing.height = Math.max(1, Math.round(img.naturalHeight * k));
    at.drawing.getContext('2d').drawImage(img, 0, 0, at.drawing.width, at.drawing.height);
    cv.width = at.drawing.width; cv.height = at.drawing.height; cv.classList.remove('hidden');
    at.ys = {}; at.mark = 0; apRender();
  };
  img.onerror = () => { URL.revokeObjectURL(url); el('apNext').textContent = 'That file could not be read as a picture.'; };
  img.src = url;
}

function apRender() {
  const cv = el('apCanvas'), build = atLoad().build;
  if (!at.drawing) { el('apNext').textContent = 'Choose a drawing of a standing figure, or drop one here.'; el('apNote').textContent = ''; el('apRows').innerHTML = ''; return; }
  const g = cv.getContext('2d'); g.drawImage(at.drawing, 0, 0);
  const res = acProportions(at.ys, build), B = AC_BUILDS[build];
  const line = (y, colour, label, dash) => {
    g.save(); g.strokeStyle = colour; g.fillStyle = colour; g.lineWidth = 1.5; g.setLineDash(dash ? [6, 4] : []);
    g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke(); g.setLineDash([]); g.font = '12px system-ui, sans-serif';
    g.fillText(label, 6, y - 3); g.restore();
  };
  for (const [key, label] of AC_MARKS) if (at.ys[key] != null) line(at.ys[key], '#e0453a', label.replace(/^the /, ''), false);
  if (at.ys.crown != null && at.ys.chin != null && at.ys.chin > at.ys.crown) {
    const head = at.ys.chin - at.ys.crown;
    for (const key of ['shoulder', 'crotch', 'knee']) line(at.ys.crown + head * B[key], '#3a86e0', `${key} for ${B.heads} heads`, true);
    line(at.ys.crown + head * B.heads, '#3a86e0', `soles for ${B.heads} heads`, true);
  }
  el('apNext').textContent = at.mark < AC_MARKS.length ? `Click ${AC_MARKS[at.mark][1]}.` : 'All marked. Undo a mark to move it.';
  el('apNote').textContent = res ? res.text : at.mark ? 'Mark the crown, the chin and the soles to find the height in heads (skip the others if you cannot see them: Undo, or Clear).' : '';
  el('apRows').innerHTML = res ? res.rows.map(r => `<div class="ap-row" data-on="${r.word === 'on the mark'}"><b>${esc(r.label)}</b> at ${r.at.toFixed(1)} heads: ${esc(r.word)}</div>`).join('') : '';
}

/* ---- faces */

function acPick(k) {
  const s = atLoad(); s.manner = k; atSave(s);
  for (const c of el('acManner').children) c.setAttribute('aria-pressed', String(c.dataset.manner === k));
  acRender();
}
function acRender() {
  const k = atLoad().manner, F = AC_FACES[k];
  el('acFaces').innerHTML = Object.keys(AC_FACES).map(m => `<button type="button" class="ac-face" data-manner="${m}" aria-pressed="${m === k}" title="${esc(AC_FACES[m].label)}">${acFaceSvg(m)}<span>${esc(AC_FACES[m].label)}</span></button>`).join('');
  el('acNote').innerHTML = `${esc(F.about)} ${acFaceNotes(k).map(esc).join(' ')} <small>For Generate: ${esc(F.words)}.</small>`;
}

/* ---- storyboard */

function asbRender() {
  const s = atLoad(), opts = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(v.label || v)}</option>`).join('');
  el('asbStrip').innerHTML = acStripSvg(s.frames);
  el('asbEdit').innerHTML = s.frames.map((f, i) =>
    `<div class="asb-row" data-i="${i}"><b>${i + 1}</b>` +
    `<select data-k="shot" aria-label="Shot of frame ${i + 1}">${opts(AC_SHOTS, f.shot)}</select>` +
    `<select data-k="angle" aria-label="Angle of frame ${i + 1}">${opts(AC_ANGLES, f.angle)}</select>` +
    `<select data-k="gaze" aria-label="Where she looks in frame ${i + 1}">${opts(AC_GAZE, f.gaze)}</select>` +
    `<input type="text" data-k="text" maxlength="120" placeholder="What happens" value="${esc(f.text)}" aria-label="What happens in frame ${i + 1}">` +
    `<button type="button" class="ghost" data-rm="${i}" aria-label="Remove frame ${i + 1}">Remove</button></div>`).join('');
  el('asbAdd').disabled = s.frames.length >= AC_MAX_FRAMES;
  const does = s.frames.map((f, i) => `${i + 1}. ${AC_SHOTS[f.shot].does} ${AC_ANGLES[f.angle].does}`).join(' ');
  el('asbNote').textContent = acStripNote(s.frames) + ' ' + does;
}

function asbEdit(target, typing) {
  const row = target.closest('.asb-row'); if (!row) return;
  const s = atLoad(), f = s.frames[+row.dataset.i]; if (!f) return;
  f[target.dataset.k] = target.value; atSave(s);
  if (typing) { el('asbStrip').innerHTML = acStripSvg(s.frames); return; }
  asbRender();
}

async function asbKeep() {
  const note = el('asbKept'); note.textContent = 'Keeping...';
  try {
    const frames = atLoad().frames, svg = acStripSvg(frames), m = svg.match(/viewBox="0 0 (\d+) (\d+)"/), k = 2;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const cv = document.createElement('canvas'); cv.width = +m[1] * k; cv.height = +m[2] * k;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const kept = await keepUpload(await atBlob(cv), { name: 'storyboard.png', from: 'work' });
    const { url, ...doc } = kept;
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...new Set([...(doc.tags || []), 'storyboard'])] });
    storeChanged();
    note.textContent = 'Kept in My work as a storyboard.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}
