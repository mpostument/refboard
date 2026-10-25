/* refboard - Anime study, the six drawing tools beside the colour ones: Hands, Eyes, Hair, Shading,
   Expressions and Perspective. What they draw is in js/animedraw.js; this is the page that gathers
   the choices and shows the picture. Nothing is uploaded: the choices are kept in this browser, and
   the eye and hair colours are the ones Outfits uses (js/animetools.js), so changing them in one
   changes them in the other.
   Loaded with the section (loadSection('anime')); asInit() in js/animestudy.js calls adInit(). */
"use strict";

const AD_KEY = 'refboard.animeDraw.v1';
const AD_MODES = ['hands', 'eyes', 'hair', 'shading', 'expressions', 'perspective'];
const AD_PERSP_DEFAULT = { 1: { horizon: 0.5, point: 0.5 }, 2: { horizon: 0.4, point: 0.6 }, '3up': { horizon: 0.7, point: 0.6 }, '3down': { horizon: 0.12, point: 0.6 } };

function adLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(AD_KEY)) || {}; } catch { /* defaults */ }
  const key = (v, map, d) => (Object.hasOwn(map, v) ? v : d);
  const num = (v, lo, hi, d) => (v == null || v === '' || !Number.isFinite(+v) ? d : adClamp(+v, lo, hi));
  const kind = [1, 2, 3].includes(+s.kind) ? +s.kind : 1, up = s.up !== false;
  const dflt = AD_PERSP_DEFAULT[kind === 3 ? (up ? '3up' : '3down') : kind];
  return {
    gesture: key(s.gesture, AD_HANDS, 'open'),
    gx: num(s.gx, -1, 1, 0.6), gy: num(s.gy, -1, 1, 0), near: num(s.near, 0, 1, 0),
    eyeLook: ['final', 'gaze', 'steps'].includes(s.eyeLook) ? s.eyeLook : 'final', eyeMat: key(s.eyeMat, AD_EYE_MATERIAL, 'water'),
    shape: key(s.shape, AD_EYE_SHAPES, 'tsurime'), era: ['90s', 'modern', 'both'].includes(s.era) ? s.era : 'both', hl: key(s.hl, AD_EYE_HL, 'two'),
    tall: num(s.tall, 0.6, 1.3, 1), iris: num(s.iris, 0.6, 1.2, 1), lash: num(s.lash, 1, 5, 3),
    style: key(s.style, AD_HAIR, 'long'), wind: key(s.wind, AD_WIND, 'none'), strength: Math.round(num(s.strength, 1, 3, 2)), look: key(s.look, AD_HAIR_LOOK, 'colour'),
    shade: key(s.shade, AD_SHADE, 'cel'), light: key(s.light, AD_LIGHTS, 'ul'), shadeBase: /^#[0-9a-f]{6}$/i.test(s.shadeBase) ? s.shadeBase : '#e8b99a',
    emotion: key(s.emotion, AD_EXPR, 'happy'), fx: s.fx !== false, arrows: s.arrows !== false,
    kind, up, horizon: num(s.horizon, 0.1, 0.9, dflt.horizon), point: num(s.point, 0.2, 1.3, dflt.point), dist: num(s.dist, 400, 1500, 700),
  };
}
function adSave(s) { try { localStorage.setItem(AD_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
function adPatch(patch) { const s = { ...adLoad(), ...patch }; adSave(s); return s; }

// Chips are built once and only their pressed state changes, so keyboard focus stays where it is.
function adMakeChips(id, entries, onPick) {
  const host = el(id);
  host.innerHTML = entries.map(([k, label, title]) => `<button type="button" class="chip" data-v="${esc(String(k))}" aria-pressed="false"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</button>`).join('');
  host.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) onPick(b.dataset.v); });
}
function adPress(id, value) { for (const b of el(id).children) b.setAttribute('aria-pressed', String(b.dataset.v === String(value))); }
const adSwatches = (list) => list.map(([label, rgb]) => `<i style="background:${adCss(rgb)}" title="${esc(label)} ${colHexOf(rgb)}"></i>`).join('');
const adOl = items => `<ol>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;

async function adKeep(svg, name, tag, note) {
  note.textContent = 'Keeping...';
  try {
    const m = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/), k = 2;
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
    const cv = document.createElement('canvas'); cv.width = Math.round(+m[3] * k); cv.height = Math.round(+m[4] * k);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const kept = await keepUpload(await atBlob(cv), { name: name + '.png', from: 'work' });
    const { url, ...doc } = kept;
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...new Set([...(doc.tags || []), tag])] });
    storeChanged();
    note.textContent = 'Kept in My work.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}

// The words go after what is already in Generate's More tags.
function adToGenerate(words) {
  setView({ kind: 'generate' });
  const put = () => {
    const box = el('genExtra'); if (!box) return false;
    box.value = box.value.trim() ? `${box.value.trim()}, ${words}` : words; box.dispatchEvent(new Event('input')); return true;
  };
  if (!put()) setTimeout(put, 400);
}

function adWire(p, svgFn, name, tag, wordsFn) {
  el(p + 'Save').addEventListener('click', () => atDownload(new Blob([svgFn()], { type: 'image/svg+xml' }), name + '.svg'));
  el(p + 'Keep').addEventListener('click', () => adKeep(svgFn(), name, tag, el(p + 'Kept')));
  const g = el(p + 'ToGenerate');
  if (g) {
    g.classList.toggle('hidden', typeof genAvailable === 'function' && !genAvailable());
    g.addEventListener('click', () => adToGenerate(wordsFn()));
  }
}

const ad = { svg: {}, drag: false };

function adInit() {
  // Hands.
  adMakeChips('ahdGesture', Object.entries(AD_HANDS).map(([k, v]) => [k, v.label]), v => { adPatch({ gesture: v }); adRenderHands(); });
  adWire('ahd', () => ad.svg.hands, 'anime-hand', 'anime-hands', () => AD_HANDS[adLoad().gesture].words);
  // Eyes.
  adMakeChips('aeyShape', Object.entries(AD_EYE_SHAPES).map(([k, v]) => [k, v.label, v.about]), v => { adPatch({ shape: v }); adRenderEyes(); });
  adMakeChips('aeyEra', [['90s', '90s'], ['modern', 'Modern'], ['both', 'Both']], v => { adPatch({ era: v }); adRenderEyes(); });
  adMakeChips('aeyHl', Object.entries(AD_EYE_HL), v => { adPatch({ hl: v }); adRenderEyes(); });
  for (const [id, k] of [['aeyGx', 'gx'], ['aeyGy', 'gy'], ['aeyNear', 'near']]) el(id).addEventListener('input', () => { adPatch({ [k]: +el(id).value }); adRenderEyes(); });
  adMakeChips('aeyLook', [['final', 'The eye'], ['gaze', 'Gaze'], ['steps', 'Steps']], v => { adPatch({ eyeLook: v }); adRenderEyes(); });
  adMakeChips('aeyMat', [['water', 'Watercolour'], ['pencils', 'Pencils'], ['copic', 'Copic'], ['ink', 'Ink']], v => { adPatch({ eyeMat: v }); adRenderEyes(); });
  for (const [id, k] of [['aeyTall', 'tall'], ['aeyIris', 'iris'], ['aeyLash', 'lash']]) el(id).addEventListener('input', () => { adPatch({ [k]: +el(id).value }); adRenderEyes(); });
  el('aeyColour').addEventListener('input', () => { const a = atLoad(); a.eyes = el('aeyColour').value; atSave(a); adRenderEyes(); });
  adWire('aey', () => ad.svg.eyes, 'anime-eye', 'anime-eyes', () => { if (adLoad().eyeLook === 'gaze') return adGazeWords(adLoad().gx, adLoad().gy); const s = adLoad(); return [AD_EYE_SHAPES[s.shape].words, s.era === 'both' ? AD_EYE_ERAS.modern.words : AD_EYE_ERAS[s.era].words].join(', '); });
  // Hair.
  adMakeChips('ahrStyle', Object.entries(AD_HAIR).map(([k, v]) => [k, v.label]), v => { adPatch({ style: v }); adRenderHair(); });
  adMakeChips('ahrWind', Object.entries(AD_WIND), v => { adPatch({ wind: v }); adRenderHair(); });
  adMakeChips('ahrLook', Object.entries(AD_HAIR_LOOK), v => { adPatch({ look: v }); adRenderHair(); });
  el('ahrStrength').addEventListener('input', () => { adPatch({ strength: +el('ahrStrength').value }); adRenderHair(); });
  el('ahrColour').addEventListener('input', () => { const a = atLoad(); a.hair = el('ahrColour').value; atSave(a); adRenderHair(); });
  el('ahrPalette').addEventListener('click', () => { const t = ad.hairTones; if (t) openPalette([t.light, t.base, t.shadow, t.core]); });
  adWire('ahr', () => ad.svg.hair, 'anime-hair', 'anime-hair', () => {
    const s = adLoad();
    return AD_HAIR[s.style].words + (s.wind !== 'none' ? ', hair blowing in the wind' : '');
  });
  // Shading.
  adMakeChips('ashLight', Object.entries(AD_LIGHTS).map(([k, v]) => [k, v[0]]), v => { adPatch({ light: v }); adRenderShade(true); });
  el('ashColour').addEventListener('input', () => { adPatch({ shadeBase: el('ashColour').value }); adRenderShade(true); });
  el('ashCards').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { adPatch({ shade: b.dataset.v }); adRenderShade(false); } });
  el('ashPalette').addEventListener('click', () => { const t = ad.shadeTones; if (t) openPalette([t.light, t.base, t.shadow, t.core, t.reflect]); });
  adWire('ash', () => ad.svg.shade, 'anime-shading', 'anime-shading', null);
  // Expressions.
  el('axGrid').innerHTML = Object.entries(AD_EXPR).map(([k, v]) => `<button type="button" class="ad-thumb" data-v="${k}" aria-pressed="false" title="${esc(v.label)}">${adExprSvg(k, false, false)}<span>${esc(v.label)}</span></button>`).join('');
  el('axGrid').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { adPatch({ emotion: b.dataset.v }); adRenderExpr(); } });
  el('axFx').addEventListener('click', () => { adPatch({ fx: !adLoad().fx }); adRenderExpr(); });
  el('axArrows').addEventListener('click', () => { adPatch({ arrows: !adLoad().arrows }); adRenderExpr(); });
  adWire('ax', () => ad.svg.expr, 'anime-expression', 'anime-expressions', () => AD_EXPR[adLoad().emotion].words);
  // Perspective.
  adMakeChips('avKind', Object.entries(AD_PERSP).map(([k, v]) => [k, v.label, v.about]), v => {
    const kind = +v, up = adLoad().up, d = AD_PERSP_DEFAULT[kind === 3 ? (up ? '3up' : '3down') : kind];
    adPatch({ kind, horizon: d.horizon, point: d.point }); adRenderPersp(true);
  });
  adMakeChips('avUp', [['up', 'Looking up'], ['down', 'Looking down']], v => {
    const d = AD_PERSP_DEFAULT[v === 'up' ? '3up' : '3down']; adPatch({ up: v === 'up', horizon: d.horizon }); adRenderPersp(true);
  });
  for (const [id, k] of [['avHorizon', 'horizon'], ['avPoint', 'point'], ['avDist', 'dist']]) el(id).addEventListener('input', () => { adPatch({ [k]: +el(id).value }); adRenderPersp(false); });
  el('avSheet').addEventListener('click', () => setView({ kind: 'perspective' }));
  // The horizon can be taken in the picture and moved.
  el('avStage').addEventListener('pointerdown', e => { if (e.target.classList?.contains('av-hit')) { ad.drag = true; e.preventDefault(); } });
  window.addEventListener('pointermove', e => {
    if (!ad.drag) return;
    const svg = el('avStage').querySelector('svg'); if (!svg) return;
    const r = svg.getBoundingClientRect(), h = adClamp((e.clientY - r.top) / r.height, 0.1, 0.9);
    adPatch({ horizon: h }); adRenderPersp(false);
  });
  window.addEventListener('pointerup', () => { ad.drag = false; });
  adWire('av', () => ad.svg.persp, 'anime-perspective', 'anime-perspective', null);
}

// The pane for a mode has just been shown.
function adShow(mode) {
  const s = adLoad();
  if (mode === 'hands') adRenderHands();
  if (mode === 'eyes') { el('aeyTall').value = s.tall; el('aeyIris').value = s.iris; el('aeyLash').value = s.lash; adRenderEyes(); }
  if (mode === 'hair') { el('ahrStrength').value = s.strength; adRenderHair(); }
  if (mode === 'shading') { el('ashColour').value = s.shadeBase; adRenderShade(true); }
  if (mode === 'expressions') adRenderExpr();
  if (mode === 'perspective') adRenderPersp(true);
}

/* ---- hands */

function adRenderHands() {
  const s = adLoad(), H = AD_HANDS[s.gesture];
  adPress('ahdGesture', s.gesture);
  ad.svg.hands = adHandSvg(s.gesture);
  el('ahdStage').innerHTML = ad.svg.hands;
  el('ahdNote').innerHTML = `<b>${esc(H.label)}.</b> ${esc(H.says)} ${esc(H.use)}<br><small>${esc(AD_HAND_BUILD)} The bends are set by eye, from a flat model: a real hand is looser.</small>`;
}

/* ---- eyes */

function adEyeScene(s) {
  const eras = s.era === 'both' ? ['90s', 'modern'] : [s.era], colour = atLoad().eyes;
  const one = (era, i) => adEyeSvg({ shape: s.shape, era, tall: s.tall, iris: s.iris, hl: s.hl, lash: s.lash, colour, key: 'e' + i });
  if (eras.length === 1) return one(eras[0], 0);
  const parts = eras.map((e, i) => one(e, i).replace('<svg ', `<svg x="${i * 280}" y="0" `) + `<text x="${i * 280 + 130}" y="216" text-anchor="middle" font-size="13" fill="#555">${esc(AD_EYE_ERAS[e].label)}</text>`);
  return adSvgOpen([0, 0, 540, 226], 'The same eye in the 90s and in the modern manner') + `<rect width="540" height="226" fill="#fff"/>${parts.join('')}</svg>`;
}

function adRenderEyes() {
  const s = adLoad(), colour = atLoad().eyes;
  adPress('aeyShape', s.shape); adPress('aeyEra', s.era); adPress('aeyHl', s.hl);
  el('aeyColour').value = colour;
  adPress('aeyLook', s.eyeLook); adPress('aeyMat', s.eyeMat);
  const steps = s.eyeLook === 'steps', gaze = s.eyeLook === 'gaze';
  el('aeyMatRow').classList.toggle('hidden', !steps); el('aeyGazeRow').classList.toggle('hidden', !gaze);
  if (gaze) {
    el('aeyGx').value = s.gx; el('aeyGy').value = s.gy; el('aeyNear').value = s.near;
    ad.svg.eyes = adGazeSvg({ shape: s.shape, era: s.era === '90s' ? '90s' : 'modern', tall: s.tall, iris: s.iris, hl: s.hl, lash: s.lash, colour, gx: s.gx, gy: s.gy, near: s.near });
    el('aeyStage').classList.remove('ad-wide');
    el('aeyStage').innerHTML = ad.svg.eyes;
    el('aeyNote').innerHTML = `${esc(AD_GAZE_SAYS[adGazeKind(s.gx, s.gy)])}${s.near > 0.3 ? ' The eyes turn in a little: she is looking at something close.' : ''} <small>The two irises always look the same way; the highlights stay put, where the light is.</small>`;
    return;
  }
  if (steps) {
    // The stages are drawn in one manner: the modern one, unless only the 90s is chosen.
    ad.svg.eyes = adEyeStepsSvg({ shape: s.shape, era: s.era === '90s' ? '90s' : 'modern', tall: s.tall, iris: s.iris, hl: s.hl, lash: s.lash, colour });
    el('aeyStage').classList.add('ad-wide');
    el('aeyStage').innerHTML = ad.svg.eyes;
    el('aeyNote').innerHTML = `<ol>${AD_EYE_MATERIAL[s.eyeMat].map((t, i) => `<li><b>${esc(AD_EYE_STAGES[i])}.</b> ${esc(t)}</li>`).join('')}</ol>` +
      `<small>The stages are the order the layers go down in; light first, dark last, and the highlights are kept, not added.</small>`;
    return;
  }
  el('aeyStage').classList.remove('ad-wide');
  ad.svg.eyes = adEyeScene(s);
  el('aeyStage').innerHTML = ad.svg.eyes;
  const eras = s.era === 'both' ? ['90s', 'modern'] : [s.era];
  el('aeyNote').innerHTML = `${esc(AD_EYE_SHAPES[s.shape].about)} ` + eras.map(e => `<div><b>${esc(AD_EYE_ERAS[e].label)}.</b> ${esc(AD_EYE_ERAS[e].about)} Draw it in this order:${adOl(AD_EYE_STEPS[e])}</div>`).join('') +
    `<small>The iris is the eye colour of Outfits. Highlights show only where the light comes from: keep them in the same place on both eyes.</small>`;
}

/* ---- hair */

function adRenderHair() {
  const s = adLoad(), colour = atLoad().hair;
  adPress('ahrStyle', s.style); adPress('ahrWind', s.wind); adPress('ahrLook', s.look);
  el('ahrColour').value = colour; el('ahrStrength').value = s.strength; el('ahrStrength').disabled = s.wind === 'none';
  const steps = s.look === 'steps';
  const r = adHairSvg({ style: s.style, wind: s.wind, strength: s.strength, colour, look: steps ? 'colour' : s.look, key: 'h' });
  ad.svg.hair = steps ? adHairStepsSvg({ style: s.style, wind: s.wind, strength: s.strength, colour }) : r.svg; ad.hairTones = r.tones;
  el('ahrStage').innerHTML = ad.svg.hair;
  el('ahrStage').classList.toggle('ad-tall', !steps); el('ahrStage').classList.toggle('ad-wide', steps);
  el('ahrTones').innerHTML = adSwatches([['Light', r.tones.light], ['Base', r.tones.base], ['Shadow', r.tones.shadow], ['Core shadow', r.tones.core]]);
  el('ahrNote').innerHTML = (steps ? `Draw it in this order:${adOl(AD_HAIR_STEPS)}` : '') + adHairNotes(s.style, s.wind, s.strength).map(esc).join(' ') + ` <small>${r.clumps} clumps. Light, base, shadow and core are worked out from the hair colour: the shadow is cooler, the light warmer.</small>`;
}

/* ---- shading */

function adRenderShade(rebuild) {
  const s = adLoad(), base = adRgbOf(s.shadeBase);
  adPress('ashLight', s.light);
  if (rebuild) {
    el('ashCards').innerHTML = Object.keys(AD_SHADE).map(k => `<button type="button" class="ad-card" data-v="${k}" aria-pressed="false">${adShadeSvg(k, base, s.light, 'c' + k).svg}<span>${esc(AD_SHADE[k].label)}</span></button>`).join('');
  }
  for (const b of el('ashCards').children) b.setAttribute('aria-pressed', String(b.dataset.v === s.shade));
  const r = adShadeSvg(s.shade, base, s.light, 'big');
  ad.svg.shade = r.svg; ad.shadeTones = r.tones;
  el('ashNote').innerHTML = `<b>${esc(AD_SHADE[s.shade].label)}.</b> ${esc(AD_SHADE[s.shade].about)} Layers, in order:${adOl(AD_SHADE[s.shade].steps)}` +
    `<div class="af-sw ad-tones">${adSwatches([['Light', r.tones.light], ['Base', r.tones.base], ['Shadow', r.tones.shadow], ['Core shadow', r.tones.core], ['Reflected light', r.tones.reflect]])}</div>` +
    `<small>Light, base, shadow, core and reflected light, from your colour. Shadows turn cool and lights warm; a grey or black shadow looks dead.</small>`;
}

/* ---- expressions */

function adRenderExpr() {
  const s = adLoad(), E = AD_EXPR[s.emotion];
  for (const b of el('axGrid').children) b.setAttribute('aria-pressed', String(b.dataset.v === s.emotion));
  el('axFx').setAttribute('aria-pressed', String(s.fx)); el('axArrows').setAttribute('aria-pressed', String(s.arrows));
  ad.svg.expr = adExprSvg(s.emotion, s.fx, s.arrows);
  el('axStage').innerHTML = ad.svg.expr;
  el('axNote').innerHTML = `<b>${esc(E.label)}.</b> ` + adExprNotes(s.emotion, s.fx).map(esc).join(' ') +
    (s.arrows ? ' <small>Dashed grey: the neutral face. Red arrows: where each part moves.</small>' : '');
}

/* ---- perspective */

function adRenderPersp(full) {
  const s = adLoad();
  adPress('avKind', s.kind); adPress('avUp', s.up ? 'up' : 'down');
  el('avRow3').classList.toggle('hidden', s.kind !== 3); el('avRowDist').classList.toggle('hidden', s.kind !== 3);
  el('avPointLabel').textContent = s.kind === 1 ? 'Point across' : 'Points apart';
  if (full) {
    const p = el('avPoint'); p.min = s.kind === 1 ? 0.2 : 0.3; p.max = s.kind === 1 ? 0.8 : 1.3;
    el('avHorizon').value = s.horizon; p.value = s.point; el('avDist').value = s.dist;
  } else if (document.activeElement !== el('avHorizon')) el('avHorizon').value = s.horizon;
  const r = adPerspSvg({ kind: s.kind, horizon: s.horizon, point: s.point, dist: s.dist, up: s.up });
  ad.svg.persp = r.svg;
  el('avStage').innerHTML = r.svg;
  el('avNote').innerHTML = `${esc(AD_PERSP[s.kind].about)} ` + r.notes.map(esc).join(' ') + ' <small>Drag the dashed horizon in the picture, or use the sliders.</small>';
}
