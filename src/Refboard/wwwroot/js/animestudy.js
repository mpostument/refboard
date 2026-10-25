/* refboard - Anime study, the view: two halves, studying frames of a film (js/animeframes.js)
   and painting a background in a manner (js/animebg.js), and the switch between them.

   Frames: give a video, or the pictures themselves in the order you want them read. A video
   gives 8, 12 or 16 frames, the middle of each slice, so the same video always gives the same
   ones. Each frame is read in this browser and nothing is uploaded; the video is not kept, only
   the small pictures of the frames in this page, which go when you leave it.
   Outfits, Proportions, Faces and Storyboard are in js/animetools.js; Hands, Eyes, Hair, Shading,
   Expressions and Perspective in js/animedrawui.js; Inking, Folds, Layers and Angles in js/animemoreui.js;
   Gesture, Tones, Effects, Shots, Legs, Silhouettes and Compare in js/animenewui.js.
   Backgrounds: a manner and an hour, the nine colours that make the picture, each with a job, and
   for each how to mix it from your paints.
   Loaded with the section (loadSection('anime')). */
"use strict";

const AS_MODE_KEY = 'refboard.animeMode.v1';
const AS_COUNT_KEY = 'refboard.animeFrames.v1';
const AS_COUNTS = [8, 12, 16];
const AS_MAX_IMAGES = 24;
// The halves of this view, each a pane; outfits to storyboard are in js/animetools.js, hands to perspective in js/animedrawui.js,
// inking to angles in js/animemoreui.js, the last seven in js/animenewui.js (their panes are made there).
const AS_PANES = { frames: 'afPane', background: 'abPane', outfits: 'aoPane', proportions: 'apPane', faces: 'acPane', storyboard: 'asbPane',
  hands: 'ahdPane', eyes: 'aeyPane', hair: 'ahrPane', shading: 'ashPane', expressions: 'axPane', perspective: 'avPane',
  inking: 'ainPane', folds: 'aflPane', layers: 'alyPane', angles: 'aanPane',
  gesture: 'agtPane', tones: 'atoPane', effects: 'afxPane', shots: 'astPane', legs: 'algPane', silhouette: 'asiPane', compare: 'acpPane', construct: 'acnPane', facelight: 'alfPane', mouth: 'amtPane', skirt: 'akrPane', walk: 'awkPane' };

let asState = null;      // null until first opened; then { frames: [{ canvas, data }], busy }
const abMixCache = new Map();

const asYield = () => new Promise(r => setTimeout(r, 0));

function asCount() {
  try { const n = +localStorage.getItem(AS_COUNT_KEY); if (AS_COUNTS.includes(n)) return n; } catch { /* default */ }
  return 12;
}

function showAnimeStudy() {
  if (!asState) asInit();
  let mode = 'frames';
  try { const m = localStorage.getItem(AS_MODE_KEY); if (AS_PANES[m]) mode = m; } catch { /* frames */ }
  asSetMode(mode, false);
}

function asSetMode(mode, save = true) {
  if (save) try { localStorage.setItem(AS_MODE_KEY, mode); } catch { /* private mode */ }
  for (const b of el('asMode').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  for (const [m, id] of Object.entries(AS_PANES)) el(id).classList.toggle('hidden', m !== mode);
  if (mode === 'background') abRender(false);
  else { atShow(mode); adShow(mode); amuShow(mode); annShow(mode); }
}

function asInit() {
  asState = { frames: [], busy: false };
  el('asMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) asSetMode(b.dataset.mode); });
  // Frames.
  el('afCount').innerHTML = AS_COUNTS.map(n => `<button type="button" class="chip" data-n="${n}" aria-pressed="${n === asCount()}">${n}</button>`).join('');
  el('afCount').addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    try { localStorage.setItem(AS_COUNT_KEY, b.dataset.n); } catch { /* private mode */ }
    for (const c of el('afCount').children) c.setAttribute('aria-pressed', String(c === b));
  });
  el('afPick').addEventListener('click', () => el('afInput').click());
  el('afInput').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) asRun(f); });
  const pane = el('afPane');
  pane.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  pane.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) { e.preventDefault(); asRun([...e.dataTransfer.files]); } });
  el('afThumbs').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    asState.frames[+b.dataset.i].canvas.toBlob(blob => blob && openInWorkspace(URL.createObjectURL(blob), { label: `Frame ${+b.dataset.i + 1}`, tab: 'colour' }), 'image/png');
  });
  el('afPalette').addEventListener('click', () => {
    const rgbs = afMerged(asState.frames.map(f => f.data), 8);
    if (rgbs.length) openPalette(rgbs);
  });
  el('afCopy').addEventListener('click', async () => {
    const t = asState.text;
    try { await navigator.clipboard.writeText(t); el('afStatus').textContent = 'Copied.'; } catch { el('afStatus').textContent = 'Could not copy - select the note and copy it.'; }
  });
  // Backgrounds.
  const st = abLoad();
  el('abManner').innerHTML = Object.entries(AB_MANNERS).map(([k, v]) => `<button type="button" class="chip" data-manner="${k}" aria-pressed="${st.manner === k}" title="${esc(v.about)}">${esc(v.label)}</button>`).join('');
  el('abHour').innerHTML = Object.entries(AB_HOURS).map(([k, v]) => `<button type="button" class="chip" data-hour="${k}" aria-pressed="${st.hour === k}">${esc(v.label)}</button>`).join('');
  el('abManner').addEventListener('click', e => { const b = e.target.closest('[data-manner]'); if (b) { const s = abLoad(); s.manner = b.dataset.manner; abSave(s); abSyncChips(); abRender(true); } });
  el('abHour').addEventListener('click', e => { const b = e.target.closest('[data-hour]'); if (b) { const s = abLoad(); s.hour = b.dataset.hour; abSave(s); abSyncChips(); abRender(true); } });
  el('abAnother').addEventListener('click', () => { const s = abLoad(); s.seed = s.seed % 9999 + 1; abSave(s); abRender(true); });
  el('abSave').addEventListener('click', async () => {
    const blob = await new Promise(res => el('abCanvas').toBlob(res, 'image/png'));
    if (!blob) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'anime-background.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  el('abOpen').addEventListener('click', async () => {
    const blob = await new Promise(res => el('abCanvas').toBlob(res, 'image/png'));
    if (blob) openInWorkspace(URL.createObjectURL(blob), { label: 'Anime background', tab: 'colour' });
  });
  el('abPalette').addEventListener('click', () => {
    const s = abLoad();
    openPalette(abPalette(s.manner, s.hour).slice(0, 8).map(p => p.rgb));
  });
  paintChips(el('abMedium'), el('abPaints'), () => { abMixCache.clear(); abRender(false); });
  atInit();
  adInit();
  amuInit();
  annInit();
}

function abSyncChips() {
  const s = abLoad();
  for (const b of el('abManner').children) b.setAttribute('aria-pressed', String(b.dataset.manner === s.manner));
  for (const b of el('abHour').children) b.setAttribute('aria-pressed', String(b.dataset.hour === s.hour));
}

/* ---- frames */

async function asRun(files) {
  if (asState.busy) return;
  const videos = files.filter(f => f.type.startsWith('video/')), images = files.filter(f => f.type.startsWith('image/'));
  if (!videos.length && !images.length) { el('afStatus').textContent = 'Give a video, or pictures.'; return; }
  asState.busy = true;
  const status = el('afStatus');
  try {
    const canvases = [];
    if (videos.length) {
      const n = asCount();
      try { canvases.push(...await afVideoFrames(videos[0], n, i => { status.textContent = `Taking frames from ${videos[0].name}: ${i}/${n}`; })); }
      catch (err) { status.textContent = `Could not read that video - ${err.message}. The browser has to be able to play it.`; return; }
    } else {
      // Pictures go in the order they are given - a file picker usually gives them by name.
      for (const f of images.slice(0, AS_MAX_IMAGES)) { status.textContent = `Reading ${f.name}...`; canvases.push(await afImageCanvas(f)); }
    }
    const frames = [];
    for (const [i, canvas] of canvases.entries()) {
      status.textContent = `Studying frame ${i + 1} of ${canvases.length}...`;
      await asYield();
      frames.push({ canvas, data: afFrame(stepsRead(canvas)) });
    }
    asState.frames = frames;
    asRender();
    status.textContent = '';
  } finally { asState.busy = false; }
}

function asRender() {
  const frames = asState.frames, data = frames.map(f => f.data);
  const scheme = afScheme(data), script = afScript(data);
  const strip = el('afScript'), src = afScriptCanvas(data, 720, 140);
  strip.width = src.width; strip.height = src.height;
  strip.getContext('2d').drawImage(src, 0, 0);
  strip.setAttribute('aria-label', 'The colour script: one column of colour for each frame, with the value of the frames as a line');
  el('afThumbs').innerHTML = frames.map((f, i) => {
    const d = f.data;
    return `<figure class="af-frame"><button type="button" data-i="${i}" title="Open frame ${i + 1} in the workspace"><img alt="Frame ${i + 1}" src="${f.canvas.toDataURL('image/jpeg', 0.75)}"></button>` +
      `<figcaption><b>${i + 1}</b> L* ${Math.round(d.L * 100)} <span class="af-sw">${d.palette.map(p => `<i style="background:${rgbCss(p.rgb)}" title="${colHexOf(p.rgb)} · ${Math.round(p.share)}%"></i>`).join('')}</span></figcaption></figure>`;
  }).join('');
  asState.text = afSchemeText(scheme) + ' ' + afScriptText(script);
  el('afNote').textContent = asState.text;
  el('afResult').classList.toggle('hidden', !frames.length);
}

/* ---- backgrounds */

function abRender(redraw) {
  const s = abLoad(), pal = abPalette(s.manner, s.hour);
  if (redraw || !el('abCanvas').dataset.drawn || el('abCanvas').dataset.drawn !== `${s.manner}|${s.hour}|${s.seed}`) {
    abDraw(el('abCanvas'), pal, s.hour, s.seed);
    el('abCanvas').dataset.drawn = `${s.manner}|${s.hour}|${s.seed}`;
  }
  el('abNote').innerHTML = abAdvice(s.manner, s.hour).map(esc).join(' ') +
    ` <small>The manner is a reading of a style, set by eye; the colours are not taken from any film.</small>`;
  const host = el('abColours');
  host.innerHTML = pal.map(p => `<div class="ab-colour" data-role="${p.role}"><i style="background:${rgbCss(p.rgb)}"></i>` +
    `<div><b>${esc(p.label)}</b> <span class="count">${colHexOf(p.rgb)}</span><div class="ab-mix"></div></div></div>`).join('');
  // The recipes one colour at a time, so the page is not held for all of them.
  const run = abRender.run = (abRender.run || 0) + 1;
  pal.forEach((p, i) => setTimeout(() => {
    if (abRender.run !== run) return;
    const key = colHexOf(p.rgb) + '|' + paintPaletteKey() + '|' + paintMedium();
    if (!abMixCache.has(key)) abMixCache.set(key, paintRecipes(p.rgb, paintPaletteKey(), 2, paintMedium()));
    const mix = host.querySelector(`[data-role="${p.role}"] .ab-mix`);
    if (mix) mix.innerHTML = abMixCache.get(key).map(paintRecipeHtml).join('') || '<span class="count">No mix found.</span>';
  }, 20 * i));
}
