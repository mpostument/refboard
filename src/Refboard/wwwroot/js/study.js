/* refboard - Compare your drawing, memory drawing, build-up stages, the session's keys.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ------------------------------------------------ compare your drawing
   The one question none of the measuring tools answer: is what I drew
   right? Photograph or scan the drawing and lay it over the reference.

   - "Lines in red" pulls just the marks off the paper - each pixel against a
     heavily blurred copy of the photo, which stands in for the paper under
     it, so a phone photo's uneven light and grey paper drop out - and draws
     them in red over the reference. Where red and photo part company is
     where the drawing went off.
   - "Line up 2 points": you pick two landmarks on the reference (top of the
     head, a heel), then the same two on the drawing, and it is scaled,
     turned and moved so those two meet. That takes out the size and tilt,
     which a drawing is allowed to differ in, and leaves everything between
     them - the proportions and angles, which it is not.

   Only in the browser: the photo becomes a blob: URL, never uploaded, and
   it goes away with the pose. Positions are kept in the reference image's
   own pixels, so a resize, a zoom or the split view never moves it off. */
const COMPARE_KEY = 'refboard.compare.v1';
let drawing = null; // { photo, ink, w, h, t:[x,y], s, a, align, hidden }
let compareOpts = (() => {
  const d = { mode: 'lines', opacity: { lines: 1, photo: 0.5 } };
  try { const v = JSON.parse(localStorage.getItem(COMPARE_KEY)); if (v && v.opacity) return { ...d, ...v }; } catch {}
  return d;
})();
let compareBlink = 0;
const ALIGN_HINTS = [
  'Click a landmark on the reference - the top of the head, say.',
  'Now a second one, well away from the first - a heel, the chin.',
  'Click the same first point on your drawing.',
  'And the same second point on your drawing.',
];

function saveCompareOpts() {
  try { localStorage.setItem(COMPARE_KEY, JSON.stringify(compareOpts)); } catch {}
}

/* The marks of a drawing, on nothing: red where there was pencil, clear
   where there was paper. Transparent pixels (a PNG exported from a drawing
   app) are paper too - they are composited onto white first. */
async function inkFromPhoto(img) {
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const canvas = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
  const c = canvas(w, h), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // The paper: shrunk to a few dozen pixels across and stretched back, which
  // averages the thin lines away and keeps the slow changes in light.
  const small = canvas(Math.max(8, Math.round(w / 40)), Math.max(8, Math.round(h / 40)));
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(c, 0, 0, small.width, small.height);
  const bg = canvas(w, h), bctx = bg.getContext('2d', { willReadFrequently: true });
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h), d = px.data, b = bctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < d.length; i += 4) {
    const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const P = Math.max(0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2], 1);
    // How much darker than its own paper: a few percent is grain and
    // shading in the photo, a third darker is a full-strength line.
    const ink = Math.min(Math.max((1 - L / P - 0.07) / 0.28, 0), 1);
    d[i] = 235; d[i + 1] = 38; d[i + 2] = 38; d[i + 3] = ink * 255;
  }
  ctx.putImageData(px, 0, 0);
  return new Promise(res => c.toBlob(res, 'image/png'));
}

function openCompare(file) {
  if (!file || !/^image\//.test(file.type)) return;
  // A photo of your own work: kept, like everything the app is given.
  keepUploadQuietly(file, { from: 'work' });
  // Comparing takes longer than any timer - stop the clock rather than lose
  // the pose under you.
  if (!state.browse && !state.paused) togglePause();
  const pose = state.current, url = URL.createObjectURL(file), img = new Image();
  el('cmpHint').className = '';
  el('cmpHint').textContent = 'Reading your drawing...';
  el('compareBar').classList.remove('hidden');
  img.onload = async () => {
    const inkBlob = await inkFromPhoto(img);
    // Moved on while it was being read: this drawing was for another pose.
    if (state.current !== pose) { URL.revokeObjectURL(url); return; }
    clearDrawing();
    drawing = { photo: url, ink: URL.createObjectURL(inkBlob), w: img.naturalWidth, h: img.naturalHeight,
      t: [0, 0], s: 1, a: 0, align: null, hidden: false };
    fitDrawing();
    el('compareBar').classList.remove('hidden');
    el('cmpHint').className = '';
    el('cmpHint').textContent = 'Drag to move it · Shift+scroll to size it, Alt+scroll to turn it - or line up 2 points.';
    syncCompareBar();
    positionGrid(); // the bar took some height from the stage
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    el('cmpHint').textContent = 'That file could not be read as an image.';
  };
  img.src = url;
}

function clearDrawing() {
  clearInterval(compareBlink); compareBlink = 0;
  if (drawing) { URL.revokeObjectURL(drawing.photo); URL.revokeObjectURL(drawing.ink); }
  drawing = null;
  el('drawWrap').classList.add('hidden');
  el('drawImg').removeAttribute('src');
  el('drawMarks').innerHTML = '';
  const wasOpen = !el('compareBar').classList.contains('hidden');
  el('compareBar').classList.add('hidden');
  el('session').classList.remove('comparing');
  el('btnCompare').setAttribute('aria-pressed', 'false');
  if (wasOpen) positionGrid();
}

// The reference's own pixel size - the units a drawing is placed in.
const refSize = () => [el('img').naturalWidth, el('img').naturalHeight];

// Fitted inside the reference, centred, square to it.
function fitDrawing() {
  const [W, H] = refSize();
  if (!drawing || !W) return;
  const s = Math.min(W / drawing.w, H / drawing.h);
  Object.assign(drawing, { s, a: 0, t: [(W - drawing.w * s) / 2, (H - drawing.h * s) / 2] });
  renderDrawing();
}

// A point on screen in reference pixels. The rendered box of #img already
// carries the zoom (it is inside .zoomwrap), so no separate zoom sums.
function refPointAt(clientX, clientY) {
  const im = el('img'), r = im.getBoundingClientRect();
  if (!r.width) return null;
  return [(clientX - r.left) / r.width * im.naturalWidth, (clientY - r.top) / r.height * im.naturalHeight];
}
// Drawing pixels to reference pixels, and back: p = t + s * R(a) * d.
function drawingToRef([x, y]) {
  const { s, a, t } = drawing, c = Math.cos(a), n = Math.sin(a);
  return [t[0] + s * (c * x - n * y), t[1] + s * (n * x + c * y)];
}
function refToDrawing([x, y]) {
  const { s, a, t } = drawing, c = Math.cos(a), n = Math.sin(a), dx = (x - t[0]) / s, dy = (y - t[1]) / s;
  return [c * dx + n * dy, -n * dx + c * dy];
}

function renderDrawing() {
  const im = el('img'), wrap = el('drawWrap'), di = el('drawImg');
  if (!drawing || !im.naturalWidth || drawing.hidden) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  Object.assign(wrap.style, { left: im.offsetLeft + 'px', top: im.offsetTop + 'px',
    width: im.offsetWidth + 'px', height: im.offsetHeight + 'px' });
  const k = im.offsetWidth / im.naturalWidth; // screen px per reference px, before zoom
  const al = drawing.align;
  // Picking on the reference: the drawing out of the way. Picking on the
  // drawing: the photo itself, solid - the red lines alone can be too thin to
  // find a landmark on.
  const onRef = al && al.step < 2, onDrawing = al && al.step >= 2;
  const mode = compareOpts.mode;
  const src = !onDrawing && mode === 'lines' ? drawing.ink : drawing.photo;
  if (di.getAttribute('src') !== src) di.src = src;
  di.style.width = drawing.w * k + 'px';
  di.style.height = drawing.h * k + 'px';
  di.style.transform = `translate(${drawing.t[0] * k}px, ${drawing.t[1] * k}px) rotate(${drawing.a}rad) scale(${drawing.s})`;
  di.style.opacity = onRef ? '0' : onDrawing || mode === 'blink' ? '1' : String(compareOpts.opacity[mode]);

  const blink = mode === 'blink' && !al;
  if (blink && !compareBlink) compareBlink = setInterval(() => wrap.classList.toggle('blink-off'), 700);
  if (!blink) { clearInterval(compareBlink); compareBlink = 0; wrap.classList.remove('blink-off'); }

  const marks = [];
  if (al) {
    al.ref.forEach(([x, y], i) => marks.push(`<div class="cmp-mark" style="left:${x * k}px;top:${y * k}px">${i + 1}</div>`));
    al.draw.forEach((d, i) => {
      const [x, y] = drawingToRef(d);
      marks.push(`<div class="cmp-mark on-drawing" style="left:${x * k}px;top:${y * k}px">${i + 1}</div>`);
    });
  }
  el('drawMarks').innerHTML = marks.join('');
}

function syncCompareBar() {
  const mode = compareOpts.mode;
  el('cmpMode').value = mode;
  el('cmpOpacity').disabled = mode === 'blink';
  el('cmpOpacity').value = compareOpts.opacity[mode] ?? 1;
  el('cmpAlign').setAttribute('aria-pressed', String(!!(drawing && drawing.align)));
  el('session').classList.toggle('comparing', !!drawing && !drawing.hidden && !drawing.align);
  el('btnCompare').setAttribute('aria-pressed', String(!!drawing && !drawing.hidden));
}

function startAlign() {
  if (!drawing) return;
  drawing.hidden = false;
  drawing.align = { step: 0, ref: [], draw: [] };
  el('cmpHint').className = 'step';
  el('cmpHint').textContent = ALIGN_HINTS[0] + ' (Esc cancels)';
  syncCompareBar();
  renderDrawing();
}
function cancelAlign() {
  if (!drawing || !drawing.align) return;
  drawing.align = null;
  el('cmpHint').className = '';
  el('cmpHint').textContent = '';
  syncCompareBar();
  renderDrawing();
}
function alignClick(p) {
  const al = drawing.align;
  if (al.step < 2) al.ref.push(p); else al.draw.push(refToDrawing(p));
  al.step++;
  if (al.step < 4) {
    el('cmpHint').textContent = ALIGN_HINTS[al.step] + ' (Esc cancels)';
    renderDrawing();
    return;
  }
  // The similarity that carries drawing point 1 onto reference point 1 and 2
  // onto 2: the scale is the ratio of the two distances, the turn the
  // difference of the two directions, and the shift whatever is then left.
  const [r1, r2] = al.ref, [d1, d2] = al.draw;
  const rl = Math.hypot(r2[0] - r1[0], r2[1] - r1[1]), dl = Math.hypot(d2[0] - d1[0], d2[1] - d1[1]);
  drawing.align = null;
  el('cmpHint').className = '';
  if (rl < 4 || dl < 4) {
    el('cmpHint').textContent = 'Those two points were too close together to line anything up - try two far apart.';
  } else {
    const a = Math.atan2(r2[1] - r1[1], r2[0] - r1[0]) - Math.atan2(d2[1] - d1[1], d2[0] - d1[0]);
    Object.assign(drawing, { s: rl / dl, a, t: [0, 0] });
    const [x, y] = drawingToRef(d1);
    drawing.t = [r1[0] - x, r1[1] - y];
    const deg = Math.round(wrap180(a / THREE_DEG));
    el('cmpHint').textContent = `Lined up: both points meet. ${deg ? `The drawing sat ${Math.abs(deg)}° ${deg > 0 ? 'anticlockwise' : 'clockwise'} of the reference.` : ''} Everything between them is your drawing as drawn.`;
  }
  syncCompareBar();
  renderDrawing();
}

// 'd': no drawing yet - pick one; one up - hide it for a look at the
// reference alone, and back.
function compareKey() {
  if (!drawing) { el('cmpInput').click(); return; }
  drawing.hidden = !drawing.hidden;
  if (drawing.hidden) drawing.align = null;
  syncCompareBar();
  renderDrawing();
}

function initCompare() {
  const stage = el('stage');
  el('btnCompare').addEventListener('click', () => (drawing && drawing.hidden) ? compareKey() : el('cmpInput').click());
  el('cmpReplace').addEventListener('click', () => el('cmpInput').click());
  el('cmpInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) openCompare(f);
  });
  el('cmpRemove').addEventListener('click', clearDrawing);
  el('cmpFit').addEventListener('click', () => { cancelAlign(); fitDrawing(); });
  el('cmpAlign').addEventListener('click', () => (drawing && drawing.align) ? cancelAlign() : startAlign());
  el('cmpMode').addEventListener('change', e => {
    compareOpts.mode = e.target.value; saveCompareOpts(); syncCompareBar(); renderDrawing();
  });
  el('cmpOpacity').addEventListener('input', e => {
    compareOpts.opacity[compareOpts.mode] = Number(e.target.value); saveCompareOpts(); renderDrawing();
  });

  // Dropped on the stage, or pasted - a drawing app's copy, a phone's share.
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => {
    e.preventDefault();
    const f = [...(e.dataTransfer.files || [])].find(f => /^image\//.test(f.type));
    if (f) openCompare(f);
  });
  document.addEventListener('paste', e => {
    if (el('session').classList.contains('hidden')) return;
    const f = [...(e.clipboardData?.files || [])].find(f => /^image\//.test(f.type));
    if (f) { e.preventDefault(); openCompare(f); }
  });

  // Any of the measuring tools owns the pointer while it is on; otherwise,
  // with a drawing up, a drag moves it (and a click picks a point while
  // lining up).
  const mine = () => drawing && !drawing.hidden &&
    !state.angleMode && !state.eyedropperMode && state.constructMode === 'off';
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (!mine() || e.button !== 0) return;
    const p = refPointAt(e.clientX, e.clientY);
    if (!p) return;
    if (drawing.align) { alignClick(p); return; }
    drag = { p, t: [...drawing.t] };
    try { stage.setPointerCapture(e.pointerId); } catch {}
  });
  stage.addEventListener('pointermove', e => {
    if (!drag || !drawing) return;
    const p = refPointAt(e.clientX, e.clientY);
    if (!p) return;
    drawing.t = [drag.t[0] + p[0] - drag.p[0], drag.t[1] + p[1] - drag.p[1]];
    renderDrawing();
  });
  const end = () => { drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  // Shift+scroll sizes it and Alt+scroll turns it, both about the pointer;
  // a plain scroll still zooms the view. Capture phase, so this runs before
  // the zoom handler and can keep it from seeing the event.
  stage.addEventListener('wheel', e => {
    if (!mine() || drawing.align || !(e.shiftKey || e.altKey)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const c = refPointAt(e.clientX, e.clientY), dy = e.deltaY || e.deltaX;
    if (!c) return;
    const { t } = drawing;
    if (e.shiftKey) {
      const f = Math.exp(-dy * 0.0012);
      drawing.s *= f;
      drawing.t = [c[0] - f * (c[0] - t[0]), c[1] - f * (c[1] - t[1])];
    } else {
      const da = (dy > 0 ? 0.5 : -0.5) * THREE_DEG, co = Math.cos(da), si = Math.sin(da);
      const vx = t[0] - c[0], vy = t[1] - c[1];
      drawing.a += da;
      drawing.t = [c[0] + co * vx - si * vy, c[1] + si * vx + co * vy];
    }
    renderDrawing();
  }, { capture: true, passive: false });
  syncCompareBar();
}
initCompare();

/* ------------------------------------------------------ memory drawing
   Look, then draw with the reference gone, then check. Copying a photo line
   for line never makes you decide what mattered in it; with nothing left to
   copy, you have to have taken in the gesture, the big shapes and the
   proportions while you could still see them - which is exactly the looking
   timed drawing is meant to train. The 3D forms have their own version of
   this (startMemoryDrill()); this one is for everything a session draws.

   Three phases per pose, on the session's own clock:
     study  - the pose is visible; state.remain counts the study time down
     draw   - the pose is covered; state.remain is the ordinary interval
     reveal - the pose is back and the clock is paused, for Compare (D)
   A pose reached with Previous is shown plainly: it has been drawn already. */
function memoryOn() { return !state.browse && el('optMemory').checked; }

function setMemoryPhase(phase) {
  state.memPhase = phase;
  const c = el('memCover');
  c.className = phase || 'hidden';
  if (phase === 'study') c.innerHTML = `<span>Memorise it - ${Math.max(1, Math.ceil(state.remain))}s &middot; → when you have it</span>`;
  else if (phase === 'draw') c.textContent = 'Draw it from memory. Click here, or press →, when you are done.';
  else if (phase === 'reveal') c.innerHTML = '<span>How close was it? D lays your drawing over it - → for the next pose.</span>';
  else c.textContent = '';
}

function beginMemoryStudy() {
  if (!memoryOn()) return;
  state.remain = Number(el('memorySecs').value);
  setMemoryPhase('study');
  paint();
}

function startMemoryDraw() {
  if (el('optBell').checked) bell();
  // Anything measured during the study would be a crib sheet now.
  clearAngleLine();
  clearConstruct();
  resetClock();
  setMemoryPhase('draw');
}

function revealMemory() {
  setMemoryPhase('reveal');
  if (!state.paused) togglePause();
}

el('memCover').addEventListener('click', () => { if (state.memPhase === 'draw') revealMemory(); });

/* ------------------------------------------------------ build-up stages
   How a copy of a master painting - or any long study - is built: the big
   light and dark masses first, then the values within them, then colour as
   soft masses, and edges and detail last. Seeing the reference only as far
   as the stage you are at stops the eye going to the eyelashes in minute
   one. Each stage gets a share of the interval, up to `upTo` of it. */
const MASTER_STAGES = [
  { upTo: 0.2, label: 'Notan - two masses, light and dark', filter: 'url(#stageNotan)' },
  { upTo: 0.45, label: 'Three values - light, halftone, shadow', filter: 'url(#stageThree)' },
  { upTo: 0.7, label: 'Colour masses - big shapes, no detail', filter: 'blur(7px)' },
  { upTo: 1, label: 'Everything - edges and detail last', filter: '' },
];
function setStage(i) {
  state.stage = i;
  const s = i === null ? null : MASTER_STAGES[i];
  // Inline, so it wins over the Gray and Squint classes while a stage is on
  // and gives them back the moment it is cleared.
  el('img').style.filter = s ? s.filter : '';
  el('session').classList.toggle('staging', i !== null);
  el('stageBadge').classList.toggle('hidden', i === null);
  if (s) el('stageBadge').textContent = `Stage ${i + 1} of ${MASTER_STAGES.length} · ${s.label}`;
}

// Delegated on #session rather than per-control: every HUD button already
// bubbles a pointerdown up through it, so this needs no listener of its own
// on any of them, and it still fires for a tap or mouse-move anywhere over
// the stage itself, not just the bar.
/* Both overlays that are laid out against an image's rendered box, rather
   than against a pane, have to be recomputed when that box changes size -
   which a window resize or a rotated tablet does without any pose changing. */
window.addEventListener('resize', () => {
  if (el('session').classList.contains('hidden')) return;
  positionGrid();
  if (state.focalFrac) positionFocalMarker();
});

el('session').addEventListener('pointerdown', armHudIdle);
el('session').addEventListener('pointermove', armHudIdle);
el('session').addEventListener('touchstart', armHudIdle, { passive: true });

document.addEventListener('keydown', e => {
  if (el('session').classList.contains('hidden')) return;
  // Swallow every session shortcut while the help card is up - Escape closes
  // it instead of stopping the session underneath, and nothing else (f, g,
  // s...) should leak through to the page while someone is reading it.
  if (!el('helpOverlay').classList.contains('hidden')) {
    if (e.key === 'Escape') { e.preventDefault(); toggleHelp(); }
    return;
  }
  armHudIdle();
  switch (e.key) {
    case ' ':          e.preventDefault(); togglePause(); break;
    case 'ArrowRight': stepHistory(1); break;
    case 'ArrowLeft':  stepHistory(-1); break;
    case 'f': case 'F': toggleFlip(); break;
    case 'g': case 'G': toggleGray(); break;
    case 'q': case 'Q': toggleSquint(); break;
    case 'v': case 'V': cycleValueSteps(); break;
    case '+': case '=': zoomBy(1.25); break;
    case '-': case '_': zoomBy(1 / 1.25); break;
    case '0': resetZoom(); break;
    case 'a': case 'A': toggleAngleMode(); break;
    case 'c': case 'C': cycleConstruct(); break;
    case 'e': case 'E': toggleEyedropper(); break;
    case 'd': case 'D': compareKey(); break;
    case 'i': case 'I': toggleValueTools(); break;
    case 'r': case 'R':
      el('optGrid').checked = !el('optGrid').checked; applyOptions(); break;
    case 'o': case 'O': toggleLayersPeek(); break;
    case 'w': case 'W': toggleWorkspace(); break;
    case 'h': case 'H':
      el('optHighContrast').checked = !el('optHighContrast').checked; applyOptions(); break;
    case 'm': case 'M': if (FEATURES) toggleSimilar(); break;
    case 's': case 'S': skipCurrent(); break;
    // Mid-way through lining up a drawing, Esc gives up on that - not on
    // the whole session.
    case 'p': case 'P': togglePose(); break;
    case 'l': case 'L': toggleHead(); break;
    case 'x': case 'X': if (!e.ctrlKey && !e.metaKey) toggleEdges(); break;
    case 'b': case 'B': if (!e.ctrlKey && !e.metaKey) toggleRange(); break;
    case 't': case 'T': if (!e.ctrlKey && !e.metaKey) toggleTemp(); break;
    case 'u': case 'U': if (!e.ctrlKey && !e.metaKey) toggleAmounts(); break;
    case 'n': case 'N': if (!e.ctrlKey && !e.metaKey) toggleTangents(); break;
    case 'k': case 'K': if (!e.ctrlKey && !e.metaKey) toggleLineWeight(); break;
    case 'Backspace':
      if (state.constructMode === 'persp' && state.persp && state.persp.length) { e.preventDefault(); state.persp.pop(); renderConstructOverlay(); }
      break;
    case 'Escape':     if (drawing && drawing.align) cancelAlign(); else stopSession(); break;
  }
});
