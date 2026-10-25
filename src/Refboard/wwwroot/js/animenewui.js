/* refboard - Anime study, the seven newer tools: Gesture, Tones, Effects, Shots, Legs, Silhouettes and Compare.
   What they work out is in js/animenew.js; this is the page that gathers the choices and shows the answers.
   Nothing is uploaded: a picture is read in this browser and goes when you leave the page, and the choices are
   kept in this browser. The panes are made here, not in index.html, and added after the others.
   Loaded with the section (loadSection('anime')); asInit() in js/animestudy.js calls annInit(). */
"use strict";

const ANN_KEY = 'refboard.animeNew.v1';
const ANN_MODES = ['gesture', 'tones', 'effects', 'shots', 'legs', 'silhouette', 'compare', 'construct', 'facelight'];

function annLoad() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(ANN_KEY)) || {}; } catch { /* defaults */ }
  const key = (v, map, d) => (Object.hasOwn(map, v) ? v : d);
  const num = (v, lo, hi, d) => (v == null || v === '' || !Number.isFinite(+v) ? d : adClamp(+v, lo, hi));
  return {
    secs: AN_DRILL_SECS.includes(+s.secs) ? +s.secs : 60,
    shoulders: Math.round(num(s.shoulders, -30, 30, 8)), hips: Math.round(num(s.hips, -30, 30, -10)), shift: Math.round(num(s.shift, -40, 40, 12)), light: key(s.light, AN_FACE_LIGHTS, 'ul'),
    tone: key(s.tone, AN_TONE_KINDS, 'liner'),
    fx: key(s.fx, AN_FX, 'speed'), dir: key(s.dir, AN_FX_DIRS, 'h'), density: Math.round(num(s.density, 1, 3, 2)), seed: Math.round(num(s.seed, 1, 99999, 7)),
    aspect: key(s.aspect, AN_FRAMES, '16:9'),
    wear: key(s.wear, AN_LEGWEAR, 'thigh'), shoe: key(s.shoe, AN_SHOES, 'sneaker'),
    cmp: key(s.cmp, AN_CMP_MODES, 'overlay'), opacity: num(s.opacity, 0, 1, 0.5), grid: AN_CMP_GRIDS.includes(+s.grid) ? +s.grid : 0, minutes: AN_CMP_MINUTES.includes(+s.minutes) ? +s.minutes : 5,
  };
}
function annSave(s) { try { localStorage.setItem(ANN_KEY, JSON.stringify(s)); } catch { /* private mode */ } }
function annPatch(patch) { const s = { ...annLoad(), ...patch }; annSave(s); return s; }

const ann = { svg: {}, gesture: { img: null, pts: [], drag: -1 }, tone: null, shot: { img: null, pts: [] }, sil: [], cmp: { ref: null, mine: null }, timers: {} };

// A pane for a mode, added after the others in the Anime view.
function annPane(id, label, note, controls, stage) {
  const d = document.createElement('div');
  d.className = 'pg-body hidden'; d.id = id;
  d.innerHTML = `<div class="pg-controls" role="group" aria-label="${esc(label)}"><p class="te-note">${note}</p>${controls}</div><div class="pg-stage">${stage}</div>`;
  el('viewAnime').appendChild(d);
}
const annPicker = (id, text, multiple = false) => `<div class="pg-row"><button type="button" class="primary" id="${id}Pick">${text}</button><input type="file" id="${id}Input" accept="image/*"${multiple ? ' multiple' : ''} class="hidden" aria-label="${esc(text)}"></div>`;
const annRow = (label, id, aria) => `<div class="pg-row"><span class="pg-label">${label}</span><div class="chips" id="${id}" role="group" aria-label="${esc(aria || label)}"></div></div>`;
const annRange = (label, id, min, max, step, value) => `<label class="ad-range"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
const annSaveRow = (p, extra = '') => `<div class="pg-row">${extra}<button type="button" class="ghost" id="${p}Save">Save SVG</button><button type="button" class="ghost" id="${p}Keep" title="Keep the picture in My work">Keep in My work</button></div><div class="count" id="${p}Kept" role="status" aria-live="polite"></div>`;
const annPngRow = p => `<div class="pg-row"><button type="button" class="ghost hidden" id="${p}Save">Save PNG</button><button type="button" class="ghost hidden" id="${p}Open" title="In the workspace, to draw over">Open in workspace</button></div>`;

function annDropOn(paneId, onFiles) {
  const pane = el(paneId);
  pane.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
  pane.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); onFiles(f); } });
}
function annPick(p, onFiles) {
  el(p + 'Pick').addEventListener('click', () => el(p + 'Input').click());
  el(p + 'Input').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) onFiles(f); });
}
async function annSavePng(canvas, name) { const b = await atBlob(canvas); if (b) atDownload(b, name); }
async function annOpenPng(canvas, label) { const b = await atBlob(canvas); if (b) openInWorkspace(URL.createObjectURL(b), { label, tab: 'colour' }); }
function annPngWire(p, getCanvas, name, label) {
  el(p + 'Save').addEventListener('click', () => { const c = getCanvas(); if (c) annSavePng(c, name); });
  el(p + 'Open').addEventListener('click', () => { const c = getCanvas(); if (c) annOpenPng(c, label); });
}
const annShowPng = (p, on) => { el(p + 'Save').classList.toggle('hidden', !on); el(p + 'Open').classList.toggle('hidden', !on); };
const annClock = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

// The canvas point of a pointer event.
function annPoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}

function annInit() {
  /* Gesture. */
  annPane('agtPane', 'The gesture',
    'Choose a photo or a drawing of a figure and click eight marks on it: the head, the chest, the hips, the feet, then both shoulders and both hips. The line of action is drawn through the first four, the shoulders and hips as two lines - and what they say about the pose is below. Below that, a drill of timed poses to draw with the line first.',
    annPicker('agt', 'Choose a figure') +
    `<div class="pg-row"><button type="button" class="ghost" id="agtUndo">Take back a mark</button><button type="button" class="ghost" id="agtReset">Start over</button></div>` + annPngRow('agt') +
    `<div class="count" id="agtStatus" role="status" aria-live="polite">Or drop a picture here.</div>` +
    `<div class="pg-row"><span class="pg-label">Drill</span><div class="chips" id="agtSecs" role="group" aria-label="Seconds for each pose"></div><button type="button" class="ghost" id="agtNext">Next pose</button></div>` +
    `<div class="agt-drill"><b id="agtPose">Press Next pose</b> <span class="count" id="agtTimer" role="timer"></span></div>`,
    `<div class="agt-stage"><canvas id="agtCanvas" class="hidden" role="img" aria-label="The figure with the marks on it"></canvas></div><div class="count pg-note" id="agtNote"></div>`);
  annPick('agt', f => annGestureLoad(f[0])); annDropOn('agtPane', f => annGestureLoad(f[0]));
  adMakeChips('agtSecs', AN_DRILL_SECS.map(n => [n, `${n} s`]), v => { annPatch({ secs: +v }); adPress('agtSecs', v); });
  el('agtNext').addEventListener('click', annDrillNext);
  el('agtUndo').addEventListener('click', () => { ann.gesture.pts.pop(); annGestureRender(); });
  el('agtReset').addEventListener('click', () => { ann.gesture.pts = []; annGestureRender(); });
  annPngWire('agt', () => el('agtCanvas'), 'anime-gesture.png', 'Line of action');
  const cv = el('agtCanvas');
  cv.addEventListener('pointerdown', e => {
    // A mark is dragged only once all eight are on (a new mark may lie close to an old one); before that Take back a mark undoes.
    const p = annPoint(cv, e), g = ann.gesture, near = g.pts.length < 8 ? -1 : g.pts.findIndex(q => Math.hypot(q.x - p.x, q.y - p.y) < 14 * cv.width / cv.getBoundingClientRect().width);
    if (near >= 0) { g.drag = near; cv.setPointerCapture(e.pointerId); return; }
    if (g.pts.length < 8) { g.pts.push(p); annGestureRender(); }
  });
  cv.addEventListener('pointermove', e => { const g = ann.gesture; if (g.drag >= 0) { g.pts[g.drag] = annPoint(cv, e); annGestureRender(); } });
  cv.addEventListener('pointerup', () => { ann.gesture.drag = -1; });

  /* Tones. */
  annPane('atoPane', 'The tones',
    'Choose a drawing or a photo: it is held to five tones, and each tone is drawn the way your pen can make it - lines for a fineliner, dots for a stipple pen, passes for a ballpoint. Use it as the plan for the ink: where the paper stays bare, and where each tone goes.',
    annPicker('ato', 'Choose a picture') + annRow('Pen', 'atoKind') + annPngRow('ato') + `<div class="count" id="atoStatus" role="status" aria-live="polite">Or drop a picture here.</div>`,
    `<div class="ain-pair hidden" id="atoPair"><figure><canvas id="atoSrc" aria-label="The picture"></canvas><figcaption>The picture</figcaption></figure><figure><canvas id="atoOut" aria-label="The picture in five tones of ink"></canvas><figcaption>In ink</figcaption></figure></div><div class="count pg-note" id="atoNote"></div><div class="ain-pens" id="atoKey"></div>`);
  annPick('ato', f => annToneLoad(f[0])); annDropOn('atoPane', f => annToneLoad(f[0]));
  adMakeChips('atoKind', Object.entries(AN_TONE_KINDS).map(([k, v]) => [k, v.label]), v => { annPatch({ tone: v }); annToneRender(); });
  annPngWire('ato', () => el('atoOut'), 'anime-ink-tones.png', 'Ink tones');

  /* Effects. */
  annPane('afxPane', 'The effects',
    'Speed lines, focus lines, an impact burst and a field of sparkles, drawn at random: press Another for a new one. The dashed ellipse is the place for the character, and nothing is drawn in it. Each says how to ink it, and where on a page it belongs.',
    annRow('Effect', 'afxKind') + `<div class="pg-row" id="afxDirRow"><span class="pg-label">Direction</span><div class="chips" id="afxDir" role="group" aria-label="Direction of the lines"></div></div>` +
    annRange('Amount', 'afxDensity', 1, 3, 1, 2) + annSaveRow('afx', '<button type="button" class="ghost" id="afxAnother" title="A new one, from the same settings">Another</button>'),
    `<div class="ad-stage" id="afxStage"></div><div class="count pg-note" id="afxNote"></div>`);
  adMakeChips('afxKind', Object.entries(AN_FX).map(([k, v]) => [k, v.label]), v => { annPatch({ fx: v }); annEffectsRender(); });
  adMakeChips('afxDir', Object.entries(AN_FX_DIRS), v => { annPatch({ dir: v }); annEffectsRender(); });
  el('afxDensity').addEventListener('input', () => { annPatch({ density: +el('afxDensity').value }); annEffectsRender(); });
  el('afxAnother').addEventListener('click', () => { annPatch({ seed: annLoad().seed % 99999 + 1 + Math.floor(Math.random() * 40) }); annEffectsRender(); });
  adWire('afx', () => ann.svg.fx, 'anime-effect', 'anime-effects', null);

  /* Shots. */
  annPane('astPane', 'The shots',
    'Choose a photo or a drawing of a whole figure and click two marks: the top of her head and her feet. The picture is cut to six shots in the shape of the frame you choose, so you can see what each shot keeps and drops. Click a cut to open it in the workspace.',
    annPicker('ast', 'Choose a figure') + annRow('Frame', 'astAspect') +
    `<div class="pg-row"><button type="button" class="ghost" id="astReset">Start over</button></div>` + annPngRow('ast') +
    `<div class="count" id="astStatus" role="status" aria-live="polite">Or drop a picture here.</div>`,
    `<div class="agt-stage"><canvas id="astCanvas" class="hidden" role="img" aria-label="The figure, with the head and the feet marked"></canvas></div><div class="ast-grid" id="astGrid"></div><div class="count pg-note" id="astNote"></div>`);
  annPick('ast', f => annShotLoad(f[0])); annDropOn('astPane', f => annShotLoad(f[0]));
  adMakeChips('astAspect', Object.keys(AN_FRAMES).map(k => [k, k]), v => { annPatch({ aspect: v }); annShotRender(); });
  el('astReset').addEventListener('click', () => { ann.shot.pts = []; annShotRender(); });
  el('astCanvas').addEventListener('pointerdown', e => { if (ann.shot.pts.length < 2) { ann.shot.pts.push(annPoint(el('astCanvas'), e)); annShotRender(); } });
  el('astGrid').addEventListener('click', e => { const c = e.target.closest('canvas'); if (c) annOpenPng(c, c.getAttribute('aria-label') || 'Shot'); });
  annPngWire('ast', () => ann.shot.sheet, 'anime-shots.png', 'The six shots');

  /* Legs. */
  annPane('algPane', 'The legs',
    'One leg from the front and from the side, on a ruler in head heights, with the sock or the stocking and the shoe. The guide lines show the knee at the middle of the leg and the ankle low; the skirt hem shows where the bare thigh begins.',
    annRow('Legwear', 'algWear') + annRow('Shoe', 'algShoe') + `<div class="pg-row"><span class="pg-label">Skin</span><input type="color" id="algSkin" value="#f1c9a5" aria-label="Skin colour"></div>` + annSaveRow('alg'),
    `<div class="ad-stage ad-wide" id="algStage"></div><div class="count pg-note" id="algNote"></div>`);
  adMakeChips('algWear', Object.entries(AN_LEGWEAR).map(([k, v]) => [k, v.label]), v => { annPatch({ wear: v }); annLegsRender(); });
  adMakeChips('algShoe', Object.entries(AN_SHOES).map(([k, v]) => [k, v.label]), v => { annPatch({ shoe: v }); annLegsRender(); });
  el('algSkin').addEventListener('input', () => { amuPatch({ skin: el('algSkin').value }); annLegsRender(); });
  adWire('alg', () => ann.svg.legs, 'anime-legs', 'anime-legs', null);

  /* Silhouettes. */
  annPane('asiPane', 'The silhouettes',
    'Choose up to three characters, each on a plain background: they are turned to black shapes at one height, side by side. A character who is clear only in colour will be lost in black - and two shapes that lie on each other are one person.',
    annPicker('asi', 'Choose characters', true) + annPngRow('asi') + `<div class="count" id="asiStatus" role="status" aria-live="polite">Or drop up to three pictures here.</div>`,
    `<canvas id="asiCanvas" class="asi-canvas hidden" role="img" aria-label="The characters as black shapes"></canvas><div class="count pg-note" id="asiNote"></div>`);
  annPick('asi', f => annSilLoad(f)); annDropOn('asiPane', f => annSilLoad(f));
  annPngWire('asi', () => el('asiCanvas'), 'anime-silhouettes.png', 'Silhouettes');

  /* Compare. */
  annPane('acpPane', 'The comparison',
    'Choose the reference and your drawing of it (a photo of the paper): they are laid one over the other, or as the difference - red where your drawing is darker than the reference, blue where it is lighter. The grid is for copying: draw the same squares on the paper. The timer is for the sitting.',
    `<div class="pg-row"><button type="button" class="primary" id="acpRefPick">Choose the reference</button><button type="button" class="primary" id="acpMinePick">Choose your drawing</button><input type="file" id="acpRefInput" accept="image/*" class="hidden" aria-label="The reference"><input type="file" id="acpMineInput" accept="image/*" class="hidden" aria-label="Your drawing"></div>` +
    annRow('Show', 'acpMode') + annRange('Overlay', 'acpOpacity', 0, 1, 0.05, 0.5) + annRow('Grid', 'acpGrid') + annRow('Sitting', 'acpMinutes') +
    `<div class="pg-row"><button type="button" class="ghost" id="acpTimer">Start</button><span class="count" id="acpClock" role="timer"></span></div>` + annPngRow('acp') +
    `<div class="count" id="acpStatus" role="status" aria-live="polite">Choose the reference first.</div>`,
    `<canvas id="acpCanvas" class="asi-canvas hidden" role="img" aria-label="The reference and your drawing"></canvas><div class="count pg-note" id="acpNote"></div>`);
  el('acpRefPick').addEventListener('click', () => el('acpRefInput').click());
  el('acpMinePick').addEventListener('click', () => el('acpMineInput').click());
  el('acpRefInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) annCmpLoad('ref', f); });
  el('acpMineInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) annCmpLoad('mine', f); });
  annDropOn('acpPane', f => annCmpLoad(ann.cmp.ref ? 'mine' : 'ref', f[0]));
  adMakeChips('acpMode', Object.entries(AN_CMP_MODES), v => { annPatch({ cmp: v }); annCmpRender(); });
  adMakeChips('acpGrid', AN_CMP_GRIDS.map(n => [n, n ? `${n} x ${n}` : 'None']), v => { annPatch({ grid: +v }); annCmpRender(); });
  adMakeChips('acpMinutes', AN_CMP_MINUTES.map(n => [n, `${n} min`]), v => { annPatch({ minutes: +v }); adPress('acpMinutes', v); });
  el('acpOpacity').addEventListener('input', () => { annPatch({ opacity: +el('acpOpacity').value }); annCmpRender(); });
  el('acpTimer').addEventListener('click', annSittingToggle);
  annPngWire('acp', () => el('acpCanvas'), 'anime-compare.png', 'Reference and drawing');

  /* Construction. */
  annPane('acnPane', 'The construction',
    'The body as blocks: the head, the ribcage, the pelvis and the limbs. Tilt the shoulders and the hips against each other and the weight goes on the leg of the higher hip; its foot is put under the balance line from the neck. The picture shows what a standing figure needs to stay up.',
    annRange('Shoulders', 'acnSh', -30, 30, 1, 8) + annRange('Hips', 'acnHp', -30, 30, 1, -10) + annRange('Chest over the pelvis', 'acnShift', -40, 40, 1, 12) +
    `<div class="pg-row"><button type="button" class="ghost" id="acnLevel" title="Both level: a figure standing at attention">Level</button><button type="button" class="ghost" id="acnRelaxed" title="A relaxed contrapposto">Relaxed</button></div>` + annSaveRow('acn') +
    `<div class="pg-row"><button type="button" class="ghost hidden" id="acnToGenerate" title="Add the words for this to Generate's More tags">Use in Generate</button></div>`,
    `<div class="ad-stage" id="acnStage"></div><div class="count pg-note" id="acnNote"></div>`);
  for (const [id, k] of [['acnSh', 'shoulders'], ['acnHp', 'hips'], ['acnShift', 'shift']]) el(id).addEventListener('input', () => { annPatch({ [k]: +el(id).value }); annConstructRender(); });
  el('acnLevel').addEventListener('click', () => { annPatch({ shoulders: 0, hips: 0, shift: 0 }); annConstructRender(); });
  el('acnRelaxed').addEventListener('click', () => { annPatch({ shoulders: 8, hips: -10, shift: 12 }); annConstructRender(); });
  adWire('acn', () => ann.svg.construct, 'anime-construction', 'anime-construction', () => { const s = annLoad(); return Math.abs(s.shoulders - s.hips) >= 8 ? 'contrapposto, standing, weight on one leg' : 'standing, symmetrical, straight posture'; });

  /* The light on a face. */
  annPane('alfPane', 'The light on a face',
    'The same face in cel shading, lit from one of eight sides: where the shadow lies on the cheek, how the nose and the chin throw theirs, and what the bangs do to the forehead. The skin colour is the one of Layers.',
    annRow('Light from', 'alfLight') + `<div class="pg-row"><span class="pg-label">Skin</span><input type="color" id="alfSkin" value="#f1c9a5" aria-label="Skin colour"></div>` + annSaveRow('alf') +
    `<div class="pg-row"><button type="button" class="ghost hidden" id="alfToGenerate" title="Add the words for this light to Generate's More tags">Use in Generate</button></div>`,
    `<div class="ad-stage ad-face" id="alfStage"></div><div class="count pg-note" id="alfNote"></div>`);
  adMakeChips('alfLight', Object.entries(AN_FACE_LIGHTS).map(([k, v]) => [k, v.label]), v => { annPatch({ light: v }); annFaceLightRender(); });
  el('alfSkin').addEventListener('input', () => { amuPatch({ skin: el('alfSkin').value }); annFaceLightRender(); });
  adWire('alf', () => ann.svg.facelight, 'anime-face-light', 'anime-face-light', () => ({ ul: 'light from the upper left', ur: 'light from the upper right', l: 'light from the side, half-lit face', r: 'light from the side, half-lit face', top: 'light from above, overhead lighting', front: 'front lighting, flat lighting', below: 'light from below, underlighting', back: 'backlighting, rim lighting, face in shadow' }[annLoad().light]));
}

// The pane for a mode has just been shown.
function annShow(mode) {
  if (!ANN_MODES.includes(mode)) return;
  const s = annLoad();
  if (mode === 'gesture') { adPress('agtSecs', s.secs); annGestureRender(); }
  if (mode === 'tones') { adPress('atoKind', s.tone); annToneRender(); }
  if (mode === 'effects') annEffectsRender();
  if (mode === 'shots') annShotRender();
  if (mode === 'legs') annLegsRender();
  if (mode === 'silhouette') annSilRender();
  if (mode === 'compare') { adPress('acpMinutes', s.minutes); annCmpRender(); }
  if (mode === 'construct') annConstructRender();
  if (mode === 'facelight') annFaceLightRender();
}

/* ---- construction and the light on a face */

function annConstructRender() {
  const s = annLoad();
  el('acnSh').value = s.shoulders; el('acnHp').value = s.hips; el('acnShift').value = s.shift;
  ann.svg.construct = anConstructSvg({ shoulders: s.shoulders, hips: s.hips, shift: s.shift });
  el('acnStage').innerHTML = ann.svg.construct;
  el('acnNote').innerHTML = anConstructNotes({ shoulders: s.shoulders, hips: s.hips, shift: s.shift }).map(esc).join(' ') + ' <small>The blocks are a plan, not a drawing: the figure is seven heads tall and seen from the front.</small>';
}

function annFaceLightRender() {
  const s = annLoad(), skin = amuLoad().skin;
  adPress('alfLight', s.light); el('alfSkin').value = skin;
  ann.svg.facelight = anFaceLightSvg({ light: s.light, skin });
  el('alfStage').innerHTML = ann.svg.facelight;
  el('alfNote').innerHTML = `<b>${esc(AN_FACE_LIGHTS[s.light].label)}.</b> ${esc(AN_FACE_LIGHTS[s.light].says)} <small>The shadow is the skin colour turned cool and darker; its edge stays hard in cel shading.</small>`;
}

/* ---- gesture */

async function annGestureLoad(file) {
  el('agtStatus').textContent = 'Reading the picture...';
  try { ann.gesture.img = await afImageCanvas(file); } catch { el('agtStatus').textContent = 'Could not read that picture.'; return; }
  ann.gesture.pts = [];
  annGestureRender();
}

function annGestureRender() {
  const g = ann.gesture, cv = el('agtCanvas'), has = !!g.img;
  cv.classList.toggle('hidden', !has);
  annShowPng('agt', has);
  if (!has) { el('agtNote').textContent = ''; return; }
  const k = Math.min(1, 640 / Math.max(g.img.width, g.img.height));
  if (cv.width !== Math.round(g.img.width * k)) { cv.width = Math.round(g.img.width * k); cv.height = Math.round(g.img.height * k); g.pts = g.pts.map(p => p); }
  const c = cv.getContext('2d');
  c.drawImage(g.img, 0, 0, cv.width, cv.height);
  const r = Math.max(3, cv.width / 90);
  if (g.pts.length >= 4) {
    c.strokeStyle = 'rgba(230,60,60,.95)'; c.lineWidth = Math.max(2, cv.width / 220);
    c.stroke(new Path2D(anGesturePath(g.pts)));
    c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.moveTo(g.pts[0].x, g.pts[0].y); c.lineTo(g.pts[3].x, g.pts[3].y); c.stroke(); c.setLineDash([]);
  }
  if (g.pts.length >= 6) { c.strokeStyle = 'rgba(70,140,255,.95)'; c.lineWidth = Math.max(2, cv.width / 260); c.beginPath(); c.moveTo(g.pts[4].x, g.pts[4].y); c.lineTo(g.pts[5].x, g.pts[5].y); c.stroke(); }
  if (g.pts.length >= 8) { c.strokeStyle = 'rgba(255,170,40,.95)'; c.beginPath(); c.moveTo(g.pts[6].x, g.pts[6].y); c.lineTo(g.pts[7].x, g.pts[7].y); c.stroke(); }
  g.pts.forEach((p, i) => {
    c.fillStyle = i < 4 ? '#e63c3c' : i < 6 ? '#468cff' : '#ffaa28';
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = `${Math.round(r * 1.5)}px system-ui`; c.fillText(String(i + 1), p.x + r + 2, p.y - r);
  });
  const left = g.pts.length < 8;
  el('agtStatus').textContent = left ? `Click ${AN_GESTURE_MARKS[g.pts.length]} (mark ${g.pts.length + 1} of 8). Take back a mark if it is wrong.` : 'All eight marks are on. Drag any of them to correct it.';
  el('agtUndo').disabled = !g.pts.length; el('agtReset').disabled = !g.pts.length;
  if (!left) {
    const r8 = anGestureRead(g.pts);
    el('agtNote').innerHTML = r8.notes.map(esc).join(' ') + ' <small>The marks are yours, so the reading is only as good as they are.</small>';
  } else el('agtNote').textContent = '';
}

function annDrillNext() {
  const pose = AN_DRILL_POSES[Math.floor(Math.random() * AN_DRILL_POSES.length)], secs = annLoad().secs;
  el('agtPose').textContent = pose[0].toUpperCase() + pose.slice(1);
  clearInterval(ann.timers.drill);
  let left = secs;
  el('agtTimer').textContent = annClock(left);
  ann.timers.drill = setInterval(() => {
    left--;
    el('agtTimer').textContent = left > 0 ? annClock(left) : 'Time. Next pose when you are ready.';
    if (left <= 0) clearInterval(ann.timers.drill);
  }, 1000);
}

/* ---- tones */

async function annToneLoad(file) {
  el('atoStatus').textContent = 'Reading the picture...';
  try { ann.tone = await afImageCanvas(file); } catch { el('atoStatus').textContent = 'Could not read that picture.'; return; }
  annToneRender();
}

function annToneRender() {
  const s = annLoad(), K = AN_TONE_KINDS[s.tone];
  adPress('atoKind', s.tone);
  el('atoKey').innerHTML = `<b>${esc(K.label)}</b><table>${K.rows.map((r, i) => `<tr><th>${i + 1}</th><td>${esc(r)}</td></tr>`).join('')}</table>`;
  if (!ann.tone) return;
  const read = amInkRead(ann.tone), res = anToneLevels(read.gray, read.w, read.h, 5);
  const out = anToneCanvas(res, s.tone, 5, 2), dst = el('atoOut'), src = el('atoSrc');
  dst.width = out.width; dst.height = out.height; dst.getContext('2d').drawImage(out, 0, 0);
  src.width = read.w; src.height = read.h; src.getContext('2d').drawImage(ann.tone, 0, 0, read.w, read.h);
  el('atoPair').classList.remove('hidden'); annShowPng('ato', true);
  el('atoStatus').textContent = '';
  el('atoNote').innerHTML = anToneNote(res, s.tone).map(esc).join(' ');
}

/* ---- effects */

function annEffectsRender() {
  const s = annLoad(), F = AN_FX[s.fx];
  adPress('afxKind', s.fx); adPress('afxDir', s.dir);
  el('afxDirRow').classList.toggle('hidden', s.fx !== 'speed');
  el('afxDensity').value = s.density;
  ann.svg.fx = anEffectSvg({ kind: s.fx, dir: s.dir, density: s.density, seed: s.seed });
  el('afxStage').innerHTML = ann.svg.fx;
  el('afxNote').innerHTML = `<b>${esc(F.label)}.</b> ${esc(F.about)} <div><b>Ink.</b> ${esc(F.ink)}</div><div><b>On the page.</b> ${esc(F.page)}</div>`;
}

/* ---- shots */

async function annShotLoad(file) {
  el('astStatus').textContent = 'Reading the picture...';
  try { ann.shot.img = await afImageCanvas(file); } catch { el('astStatus').textContent = 'Could not read that picture.'; return; }
  ann.shot.pts = [];
  annShotRender();
}

function annShotRender() {
  const s = annLoad(), sh = ann.shot, cv = el('astCanvas'), has = !!sh.img;
  adPress('astAspect', s.aspect);
  cv.classList.toggle('hidden', !has); el('astReset').disabled = !sh.pts.length;
  if (!has) { el('astGrid').innerHTML = ''; el('astNote').textContent = ''; annShowPng('ast', false); return; }
  const k = Math.min(1, 560 / Math.max(sh.img.width, sh.img.height));
  cv.width = Math.round(sh.img.width * k); cv.height = Math.round(sh.img.height * k);
  const c = cv.getContext('2d'), scale = sh.img.width / cv.width;
  c.drawImage(sh.img, 0, 0, cv.width, cv.height);
  sh.pts.forEach((p, i) => { c.fillStyle = i ? '#468cff' : '#e63c3c'; c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI * 2); c.fill(); });
  if (sh.pts.length < 2) {
    el('astStatus').textContent = sh.pts.length ? 'Now click her feet.' : 'Click the top of her head.';
    el('astGrid').innerHTML = ''; el('astNote').textContent = ''; annShowPng('ast', false);
    return;
  }
  el('astStatus').textContent = 'The marks can be set again with Start over.';
  const [head, feet] = sh.pts.map(p => ({ x: p.x * scale, y: p.y * scale })), rects = anShotRects(head, feet, AN_FRAMES[s.aspect]);
  const W = 220, cells = rects.map(r => {
    const h = Math.round(W / (r.w / r.h)), cell = Object.assign(document.createElement('canvas'), { width: W, height: h }), g = cell.getContext('2d');
    g.fillStyle = '#7d8397'; g.fillRect(0, 0, W, h);
    g.drawImage(sh.img, r.x, r.y, r.w, r.h, 0, 0, W, h);   // a cut that reaches past the picture shows the grey
    cell.setAttribute('aria-label', r.label);
    return { r, cell };
  });
  el('astGrid').innerHTML = '';
  for (const { r, cell } of cells) {
    const fig = document.createElement('figure');
    fig.append(cell);
    const cap = document.createElement('figcaption');
    cap.innerHTML = `<b>${esc(r.label)}</b> <span class="count">${esc((AC_SHOTS[r.code] || {}).does || '')}</span>`;
    fig.append(cap);
    el('astGrid').append(fig);
  }
  // The sheet for saving: the cuts in two rows of three.
  const sheet = Object.assign(document.createElement('canvas'), { width: 3 * W + 40, height: 0 }), rows = [cells.slice(0, 3), cells.slice(3)];
  const rh = rows.map(r => Math.max(...r.map(x => x.cell.height)));
  sheet.height = rh[0] + rh[1] + 30;
  const g = sheet.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height);
  rows.forEach((row, ri) => row.forEach(({ cell }, ci) => g.drawImage(cell, 10 + ci * (W + 10), 10 + (ri ? rh[0] + 10 : 0))));
  sh.sheet = sheet; annShowPng('ast', true);
  el('astNote').innerHTML = 'The marks give one head as a seventh of her height, so the cuts follow anime proportions: a figure of another build will come out a little high or low. <small>Where the cut goes past the picture it is grey.</small>';
}

/* ---- legs */

function annLegsRender() {
  const s = annLoad(), skin = amuLoad().skin;
  adPress('algWear', s.wear); adPress('algShoe', s.shoe);
  el('algSkin').value = skin;
  ann.svg.legs = anLegsSvg({ wear: s.wear, shoe: s.shoe, skin });
  el('algStage').innerHTML = ann.svg.legs;
  el('algNote').innerHTML = `<b>${esc(AN_LEGWEAR[s.wear].label)}.</b> ${esc(AN_LEGWEAR[s.wear].about)} <div><b>${esc(AN_SHOES[s.shoe].label)}.</b> ${esc(AN_SHOES[s.shoe].about)}</div><small>${esc(AN_LEG_RULES)} The pictures are diagrams of a leg, not of a garment.</small>`;
}

/* ---- silhouettes */

async function annSilLoad(files) {
  const status = el('asiStatus');
  status.textContent = 'Reading the pictures...';
  const items = [];
  for (const f of files.slice(0, 3)) {
    let cv;
    try { cv = await afImageCanvas(f); } catch { continue; }
    const k = Math.min(1, AN_SIL_SIDE / Math.max(cv.width, cv.height)), w = Math.max(8, Math.round(cv.width * k)), h = Math.max(8, Math.round(cv.height * k));
    const small = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = small.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(cv, 0, 0, w, h);
    const r = anSilhouette(g.getImageData(0, 0, w, h).data, w, h);
    items.push({ name: f.name, found: r.found, ...anSilScale(r.mask, w, h) });
  }
  ann.sil = items;
  annSilRender();
}

function annSilRender() {
  const items = ann.sil, cv = el('asiCanvas');
  cv.classList.toggle('hidden', !items.length); annShowPng('asi', !!items.length);
  if (!items.length) { el('asiNote').textContent = ''; return; }
  const gap = 24, W = items.reduce((a, s) => a + s.w, 0) + gap * (items.length + 1), H = AN_SIL_H + 50;
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#eef0f5'; g.fillRect(0, 0, W, H);
  let x = gap;
  items.forEach((s, i) => {
    const img = g.createImageData(s.w, s.h);
    for (let j = 0; j < s.mask.length; j++) { const v = s.mask[j] ? 20 : 238; img.data[j * 4] = v; img.data[j * 4 + 1] = v; img.data[j * 4 + 2] = s.mask[j] ? 28 : 245; img.data[j * 4 + 3] = 255; }
    g.putImageData(img, x, 14);
    g.fillStyle = '#444'; g.font = '13px system-ui'; g.fillText(`${i + 1}. ${s.name.slice(0, Math.max(8, Math.floor(s.w / 7)))}`, x, AN_SIL_H + 36);
    x += s.w + gap;
  });
  const lost = items.map((s, i) => (s.found ? '' : i + 1)).filter(Boolean);
  el('asiStatus').textContent = '';
  el('asiNote').innerHTML = anSilNote(items).map(esc).join(' ') + (lost.length ? ` <b>No plain background was found for ${lost.join(', ')}</b>: the shape may include the background. Use a picture on white or a flat colour.` : '');
}

/* ---- compare */

async function annCmpLoad(which, file) {
  el('acpStatus').textContent = 'Reading the picture...';
  try { ann.cmp[which] = await afImageCanvas(file); } catch { el('acpStatus').textContent = 'Could not read that picture.'; return; }
  annCmpRender();
}

function annCmpRender() {
  const s = annLoad(), c = ann.cmp, cv = el('acpCanvas');
  adPress('acpMode', s.cmp); adPress('acpGrid', s.grid);
  el('acpOpacity').value = s.opacity; el('acpOpacity').disabled = s.cmp !== 'overlay';
  cv.classList.toggle('hidden', !c.ref); annShowPng('acp', !!c.ref);
  if (!c.ref) { el('acpStatus').textContent = 'Choose the reference first.'; el('acpNote').textContent = ''; return; }
  const k = Math.min(1, 420 / Math.max(c.ref.width, c.ref.height)), w = Math.round(c.ref.width * k), h = Math.round(c.ref.height * k);
  const g = cv.getContext('2d');
  const drawGrid = (ox) => {
    if (!s.grid) return;
    g.strokeStyle = 'rgba(230,60,60,.7)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < s.grid; i++) { g.moveTo(ox + w * i / s.grid, 0); g.lineTo(ox + w * i / s.grid, h); g.moveTo(ox, h * i / s.grid); g.lineTo(ox + w, h * i / s.grid); }
    g.stroke();
  };
  let note = [];
  if (!c.mine) {
    cv.width = w; cv.height = h; g.drawImage(c.ref, 0, 0, w, h); drawGrid(0);
    el('acpStatus').textContent = 'Now choose your drawing (a photo of the paper).';
    el('acpNote').textContent = s.grid ? `The reference with a ${s.grid} x ${s.grid} grid: rule the same squares on your paper.` : '';
    return;
  }
  el('acpStatus').textContent = '';
  const r = anCmpDiff(c.ref, c.mine);
  if (s.cmp === 'side') {
    cv.width = w * 2 + 12; cv.height = h; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, h);
    g.drawImage(c.ref, 0, 0, w, h); drawGrid(0); g.drawImage(c.mine, w + 12, 0, w, h); drawGrid(w + 12);
  } else {
    cv.width = w; cv.height = h; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    if (s.cmp === 'diff') g.drawImage(r.canvas, 0, 0, w, h);
    else { g.drawImage(c.ref, 0, 0, w, h); g.globalAlpha = s.opacity; g.drawImage(c.mine, 0, 0, w, h); g.globalAlpha = 1; }
    drawGrid(0);
  }
  note = anCmpNote(r);
  el('acpNote').textContent = note.join(' ');
}

function annSittingToggle() {
  const btn = el('acpTimer');
  if (ann.timers.sit) { clearInterval(ann.timers.sit); ann.timers.sit = 0; btn.textContent = 'Start'; el('acpClock').textContent = ''; return; }
  let left = annLoad().minutes * 60;
  btn.textContent = 'Stop'; el('acpClock').textContent = annClock(left);
  ann.timers.sit = setInterval(() => {
    left--;
    el('acpClock').textContent = left > 0 ? annClock(left) : 'Time. Put the pen down and compare.';
    if (left <= 0) { clearInterval(ann.timers.sit); ann.timers.sit = 0; btn.textContent = 'Start'; }
  }, 1000);
}
