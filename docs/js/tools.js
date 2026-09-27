/* refboard - The session's tools: input, zoom and pan, angle tool, construction guides, perspective check, eyedropper, mixing guide, info drawer, help, image analysis.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---------------------------------------------------------------- helpers */

function fmt(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ------------------------------------------------------------------ input */

el('btnPause').addEventListener('click', togglePause);
el('btnNext').addEventListener('click', () => stepHistory(1));
el('btnPrev').addEventListener('click', () => stepHistory(-1));
el('btnStop').addEventListener('click', stopSession);
function toggleFlip() {
  const on = !el('img').classList.contains('flip');
  el('img').classList.toggle('flip', on);
  el('imgValue').classList.toggle('flip', on);
  syncViewButtons();
}
// Flip, Gray and Squint show whether they are on - read off the picture's
// own classes, so a random flip on a new pose or Gray reset by a value
// split shows too.
function syncViewButtons() {
  const img = el('img');
  for (const [id, cls] of [['btnFlip', 'flip'], ['btnGray', 'gray'], ['btnSquint', 'squint']]) {
    el(id).setAttribute('aria-pressed', String(img.classList.contains(cls)));
  }
}
// No-op while splitting: the button stays present (rather than also
// disabled) since Flip's own reasoning - see something fresh - still
// applies to a tonal-value session, only Gray's does not.
function toggleGray() {
  if (state.valueSteps) return;
  el('img').classList.toggle('gray');
  syncViewButtons();
}
// Same disabled-while-splitting treatment as Gray, and the same reason -
// see applyOptions()'s own comment on #btnSquint. The fastest version of
// "squint at it" to check big shapes/values, without going into a full
// tonal-value split view first.
function toggleSquint() {
  if (state.valueSteps) return;
  el('img').classList.toggle('squint');
  syncViewButtons();
}
el('btnFlip').addEventListener('click', toggleFlip);
el('btnGray').addEventListener('click', toggleGray);
el('btnSquint').addEventListener('click', toggleSquint);

/* ------------------------------------------------------------- zoom & pan
   Locked together across both panes, on purpose: the point of the split
   view is comparing the same framing of the same pose, and independent zoom
   levels would defeat that. Resets on every new pose - see show() - since a
   zoom level describes a framing choice about one specific image, not a
   standing preference.

   Pan is stored in already-visual pixels; applyZoom() divides by zoom before
   feeding it to translate() because transform functions compose outer-to-
   inner, so scale(z) translate(x) moves the element by x*z on screen, not x -
   dividing here is what keeps a pixel of drag equal to a pixel of on-screen
   movement regardless of the current zoom level. */
const ZOOM_MIN = 1, ZOOM_MAX = 6;

function applyZoom() {
  const t = state.zoom === 1 ? '' :
    `scale(${state.zoom}) translate(${state.panX / state.zoom}px, ${state.panY / state.zoom}px)`;
  el('zoomOrig').style.transform = t;
  el('zoomValue').style.transform = t;
  el('btnZoomReset').textContent = Math.round(state.zoom * 100) + '%';
  el('btnZoomOut').disabled = state.zoom <= ZOOM_MIN;
  el('btnZoomIn').disabled = state.zoom >= ZOOM_MAX;
}

function resetZoom() {
  state.zoom = 1; state.panX = 0; state.panY = 0;
  applyZoom();
}

// Generous rather than exact: this is a "cannot lose the image entirely"
// backstop, not a precise edge-of-content clamp - object-fit:contain's own
// letterboxing (for a pose whose aspect ratio does not match the pane's)
// makes an exact bound depend on both, and generous costs nothing a viewer
// would notice.
function clampPan() {
  const rect = el('paneOrig').getBoundingClientRect();
  const maxX = (state.zoom - 1) * rect.width, maxY = (state.zoom - 1) * rect.height;
  state.panX = Math.max(-maxX, Math.min(maxX, state.panX));
  state.panY = Math.max(-maxY, Math.min(maxY, state.panY));
}

function zoomBy(factor) {
  state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * factor));
  if (state.zoom === ZOOM_MIN) { state.panX = 0; state.panY = 0; }
  clampPan();
  applyZoom();
}

el('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
el('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.25));
el('btnZoomReset').addEventListener('click', resetZoom);

// Wheel always zooms toward the pane's centre rather than the cursor - a
// real "zoom to point" needs the pan math to know which pane is under the
// cursor and adjust for each one's own aspect-ratio letterboxing to keep
// that point fixed, for a precision a gesture-timer's zoom does not need to
// earn back the complexity.
el('stage').addEventListener('wheel', e => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

let panDrag = null;
el('stage').addEventListener('pointerdown', e => {
  if (state.angleMode || state.eyedropperMode || state.constructMode !== 'off' || state.zoom <= ZOOM_MIN) return;
  if (drawing && !drawing.hidden) return; // the drag is the drawing's - see initCompare()
  panDrag = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
  try { el('stage').setPointerCapture(e.pointerId); } catch { /* keeps the drag going regardless */ }
});
el('stage').addEventListener('pointermove', e => {
  if (!panDrag) return;
  state.panX = panDrag.panX + (e.clientX - panDrag.x);
  state.panY = panDrag.panY + (e.clientY - panDrag.y);
  clampPan();
  applyZoom();
});
el('stage').addEventListener('pointerup', () => { panDrag = null; });
el('stage').addEventListener('pointercancel', () => { panDrag = null; });
el('stage').addEventListener('dblclick', () => { if (!state.angleMode) resetZoom(); });

/* --------------------------------------------------------------- angle tool
   A digital plumb line: drag out a line anywhere on the stage and read its
   angle, the same measuring technique as holding a pencil up against the
   reference at arm's length - checking a shoulder line against a hip line,
   or a limb's angle against vertical, before committing to it on paper.

   The FIRST completed drag after turning this on becomes the comparative-
   measurement reference - drawn faint and dashed once a second line exists -
   and every drag after that reads its own angle AND its length as a ratio of
   that reference, the digital equivalent of measuring one unit (a head
   height, say) and then checking everything else against it.

   Unlike a single vanishing measurement, a FEW comparison lines (state.
   angleLines, capped at MAX_ANGLE_LINES) stay on screen at once - this is
   what makes it a real sight-size comparison tool: drag the shoulder line,
   then the hip line, and read both angles/ratios together instead of one at
   a time. Past the cap, the oldest comparison line (never the reference
   itself) quietly drops off to make room for the newest. "Clear lines" (or
   turning the tool off and back on) wipes both the reference and every
   comparison line so the next drag starts a fresh baseline.

   Deliberately does not follow zoom/pan (#angleOverlay has no transform of
   its own - see its HTML comment) and deliberately has no persistent state
   across poses beyond "on or off" - clearing on the next pose (see show())
   is what stops a stale measurement from ever being mistaken for a current
   one. */
const MAX_ANGLE_LINES = 2; // comparison lines besides the reference - "a few", not a cluttered mess

function toggleAngleMode() {
  state.angleMode = !state.angleMode;
  if (state.angleMode && state.eyedropperMode) toggleEyedropper();
  if (state.angleMode && state.constructMode !== 'off') exitConstructMode();
  el('btnAngle').setAttribute('aria-pressed', String(state.angleMode));
  if (!state.angleMode) clearAngleLine();
}

function clearAngleLine() {
  state.angleRef = null;
  state.angleLines = [];
  el('angleOverlay').classList.add('hidden');
  el('angleOverlay').innerHTML = '';
  el('btnAngleClear').disabled = true;
}

// A line has no direction, so 190 degrees and 10 degrees are the same
// measurement - mod 180 is what keeps the reading from flipping between two
// numbers that mean the same thing depending on which end you happened to
// drag from first.
function angleOf(x1, y1, x2, y2) {
  let deg = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  return ((deg % 180) + 180) % 180;
}

// In high-contrast mode (see applyOptions(), the 'h' key), color/opacity are
// no longer available to tell lines apart - the whole point is not relying
// on them - so each comparison line instead gets its own dash pattern.
// Cycles rather than a fixed 1:1 list, so a comparison line past the end
// still gets *a* distinct pattern instead of silently falling through to
// solid like every other line (were MAX_ANGLE_LINES ever raised past 3).
const COMPARISON_DASHES = ['', '10 4', '2 3'];

// Rebuilds #angleOverlay from state.angleRef + state.angleLines, plus
// (while a drag is in progress) the not-yet-committed live line on top.
// Called on every pointermove (live redraw), after every commit, and
// whenever applyOptions() flips high-contrast mode on an already-drawn set
// of lines.
function renderAngleOverlay(live) {
  const svg = el('angleOverlay');
  const ref = state.angleRef;
  const haveComparisons = state.angleLines.length > 0 || live;
  const hc = state.highContrast;

  const lineMarkup = (l, label, dash) =>
    `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>` +
    `<circle cx="${l.x1}" cy="${l.y1}" r="4"/><circle cx="${l.x2}" cy="${l.y2}" r="4"/>` +
    `<text x="${(l.x1 + l.x2) / 2}" y="${(l.y1 + l.y2) / 2 - 10}" text-anchor="middle">${label}</text>`;

  let markup = '';
  if (ref) {
    // Solid and its own star while nothing exists to compare it against yet
    // (the very first drag); once a comparison line shows up, it recedes to
    // a faint dashed backdrop the same as before (or, in high-contrast, a
    // finer dash instead of relying on opacity to read as "faint").
    if (haveComparisons) {
      markup += `<line x1="${ref.x1}" y1="${ref.y1}" x2="${ref.x2}" y2="${ref.y2}" stroke-dasharray="${hc ? '3 3' : '4 3'}"${hc ? '' : ' opacity=".5"'}/>`;
    } else {
      markup += lineMarkup(ref, `${ref.deg.toFixed(1)}°`);
    }
  }
  state.angleLines.forEach((l, i) => {
    const label = `${l.deg.toFixed(1)}° · ${(l.length / ref.length).toFixed(2)}× reference`;
    markup += lineMarkup(l, label, hc ? COMPARISON_DASHES[i % COMPARISON_DASHES.length] : '');
  });
  if (live) {
    const label = ref ? `${live.deg.toFixed(1)}° · ${(live.length / ref.length).toFixed(2)}× reference` : `${live.deg.toFixed(1)}°`;
    markup += lineMarkup(live, label, hc ? COMPARISON_DASHES[state.angleLines.length % COMPARISON_DASHES.length] : '');
  }

  svg.classList.toggle('hidden', markup === '');
  svg.innerHTML = markup;
  if (markup) avoidLabelCollisions(svg);
}

// Cheap collision avoidance for the handful of labels ever on screen at
// once (at most: the reference-or-not, plus MAX_ANGLE_LINES comparisons,
// plus a live drag). Real SVG bounding boxes via getBBox(), not an estimate
// - meaningful only once the elements are actually in the (visible) DOM,
// which innerHTML just above guarantees. Nudges a colliding label straight
// down a few px at a time against every label already placed, rather than
// solving for a globally non-overlapping layout - enough to keep "which
// line is this" legible when two measurements are drawn close together,
// which is exactly the case multiple on-screen lines exist to support.
function avoidLabelCollisions(svg) {
  const placed = [];
  for (const text of svg.querySelectorAll('text')) {
    let box = text.getBBox();
    let guard = 0;
    while (placed.some(p => rectsOverlap(box, p)) && guard++ < 6) {
      text.setAttribute('y', Number(text.getAttribute('y')) + box.height + 2);
      box = text.getBBox();
    }
    placed.push(box);
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Stage-relative, not viewport-relative - the overlay has no viewBox (see its
// CSS: inset:0 with no scaling), so its coordinate space is CSS pixels from
// #stage's own top-left, not the browser window's.
function angleLineAt(cx1, cy1, cx2, cy2) {
  const rect = el('stage').getBoundingClientRect();
  const x1 = cx1 - rect.left, y1 = cy1 - rect.top;
  const x2 = cx2 - rect.left, y2 = cy2 - rect.top;
  return { x1, y1, x2, y2, length: Math.hypot(x2 - x1, y2 - y1), deg: angleOf(x1, y1, x2, y2) };
}

function commitAngleLine(l) {
  if (l.length === 0) return; // a click with no drag measures nothing - drop it
  if (!state.angleRef) {
    state.angleRef = l;
  } else {
    state.angleLines.push(l);
    if (state.angleLines.length > MAX_ANGLE_LINES) state.angleLines.shift();
  }
  el('btnAngleClear').disabled = false;
}

let angleDrag = null;
el('stage').addEventListener('pointerdown', e => {
  if (!state.angleMode) return;
  angleDrag = { x: e.clientX, y: e.clientY };
  try { el('stage').setPointerCapture(e.pointerId); } catch { /* keeps the drag going regardless */ }
});
el('stage').addEventListener('pointermove', e => {
  if (!angleDrag) return;
  renderAngleOverlay(angleLineAt(angleDrag.x, angleDrag.y, e.clientX, e.clientY));
});
el('stage').addEventListener('pointerup', e => {
  if (!angleDrag) return;
  commitAngleLine(angleLineAt(angleDrag.x, angleDrag.y, e.clientX, e.clientY));
  angleDrag = null;
  renderAngleOverlay(null);
});
el('stage').addEventListener('pointercancel', () => { angleDrag = null; renderAngleOverlay(null); });
el('btnAngle').addEventListener('click', toggleAngleMode);
el('btnAngleClear').addEventListener('click', clearAngleLine);

/* ------------------------------------------------------- construct guides
   Three traditional construction aids sharing one overlay/select, since
   only one is ever active at a time and none needs a HUD button of its own:

   - Vanishing point: click (or drag, following the cursor live) drops a
     point and fans guide lines out from it across the whole stage - the
     classic perspective aid for a box, a room, or a foreshortened limb.
   - Plumb line: click drops a full vertical+horizontal crosshair through
     that point - the digital equivalent of holding a pencil straight up to
     check whether one landmark is directly over another.
   - Proportion divider: drag defines one unit (the same reference-length
     idea the angle tool uses), then the tool marks off repeating multiples
     of it along the same line automatically - "how many head-heights tall"
     made persistent instead of eyeballed one tap at a time.

   Mutually exclusive with the angle tool and the eyedropper (see the guards
   added to toggleAngleMode()/toggleEyedropper() above and setConstructMode()
   below) - all three want the same stage pointer gesture for different
   things, so only one may own it at once. Like the angle tool, has no
   persistent state across poses (clearConstruct() runs from show()) beyond
   which MODE is selected, which stays selected. */
function setConstructMode(mode) {
  if (mode !== state.constructMode) {
    // Turn the other two off directly rather than via their own toggle
    // functions - those would call clearConstruct() right back, undoing
    // the mode this function is in the middle of setting.
    if (state.angleMode) { state.angleMode = false; el('btnAngle').setAttribute('aria-pressed', 'false'); clearAngleLine(); }
    if (state.eyedropperMode) { state.eyedropperMode = false; el('btnEyedropper').setAttribute('aria-pressed', 'false'); }
  }
  state.constructMode = mode;
  el('constructSelect').value = mode;
  // Reads as on, like the value select, whenever a guide is showing.
  el('constructSelect').classList.toggle('active', mode !== 'off');
  clearConstruct();
}
function clearConstruct() {
  state.vp = state.plumb = state.divider = state.frame = state.persp = null;
  renderConstructOverlay();
}
// Fully turns the guide off (mode + select, not just the drawn points) -
// what toggleAngleMode()/toggleEyedropper() actually need when THEY are
// turning on and a guide is active. clearConstruct() alone isn't enough
// there: it deliberately leaves state.constructMode as-is (that's what
// makes it safe for show() to call on every new pose without silently
// switching your selected guide back to Off each time), so using it here
// would clear the drawn guide but leave the select reading a guide that
// is, from the user's perspective, still "on."
function exitConstructMode() {
  state.constructMode = 'off';
  el('constructSelect').value = 'off';
  clearConstruct();
}
function cycleConstruct() {
  const order = ['off', 'vp', 'plumb', 'divider', 'frame', 'persp'];
  setConstructMode(order[(order.indexOf(state.constructMode) + 1) % order.length]);
}
el('constructSelect').addEventListener('change', e => setConstructMode(e.target.value));

/* ---- perspective check. Where the angle tool measures one line and the
   vanishing-point guide is placed by eye, this finds the vanishing points
   FROM the picture: two lines along edges that are parallel in the world
   (two edges of a table top, a window's top and bottom) meet at one. Four
   clicks make a vanishing point, eight make two - and a horizon through
   them - and twelve make three. Then it checks what they imply, since a
   drawing, unlike a photo, can have vanishing points no camera could:

   - The horizon's tilt. Level in almost any photo held straight.
   - Two vanishing points of a right angle (a box's two sides) must lie on
     opposite sides of the centre of vision, and where they are fixes how
     far away the eye was: it sits on the circle whose diameter joins them,
     since the two directions are 90° apart. From that distance comes the
     field of view the picture implies - past about 90° the corners of
     anything will look stretched, which is the classic "vanishing points
     too close together" mistake.
   - With three, the centre of vision is the orthocentre of their triangle
     (the foot of the perpendicular from the eye onto the picture), which
     for an uncropped photo is the middle of the frame.

   Lines are homogeneous here: the line through p and q is p x q, and two
   lines meet at l1 x l2 - a third component near zero is a point at
   infinity, i.e. the edges are parallel on the page too. */
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function perspVP(l1, l2) {
  const h = p => [p.x, p.y, 1];
  const v = cross3(cross3(h(l1[0]), h(l1[1])), cross3(h(l2[0]), h(l2[1])));
  if (Math.abs(v[2]) < 1e-9) return null;
  const p = { x: v[0] / v[2], y: v[1] / v[2] };
  // Far enough that it is parallel for any purpose a drawing has.
  return Math.hypot(p.x, p.y) > 1e6 ? null : p;
}
function orthocentre(A, B, C) {
  // (H - A).(B - C) = 0 and (H - B).(A - C) = 0, two linear equations in H.
  const a1 = B.x - C.x, b1 = B.y - C.y, c1 = A.x * a1 + A.y * b1;
  const a2 = A.x - C.x, b2 = A.y - C.y, c2 = B.x * a2 + B.y * b2;
  const det = a1 * b2 - a2 * b1;
  return Math.abs(det) < 1e-9 ? null : { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
}
function perspMarkup(w, h) {
  const P = state.persp || [];
  const f = v => v.toFixed(1);
  let m = '';
  const notes = [];
  // The whole line through two points, drawn well past the stage.
  const through = (a, b, cls) => {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (!L) return '';
    const k = (w + h) * 20 / L;
    return `<line class="${cls}" x1="${f(a.x - dx * k)}" y1="${f(a.y - dy * k)}" x2="${f(a.x + dx * k)}" y2="${f(a.y + dy * k)}"/>`;
  };
  const lines = [];
  for (let i = 0; i + 1 < P.length; i += 2) lines.push([P[i], P[i + 1]]);
  for (const [a, b] of lines) {
    m += through(a, b, 'persp-ext') +
      `<line class="construct-guide" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}"/>`;
  }
  for (const p of P) m += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="4"/>`;

  const vps = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const v = perspVP(lines[i], lines[i + 1]), n = i / 2 + 1;
    vps.push(v);
    if (!v) { notes.push([`VP${n}: the two edges are parallel on the page - that direction does not converge (it is flat to the picture).`]); continue; }
    if (v.x >= 0 && v.x <= w && v.y >= 0 && v.y <= h) {
      m += `<circle class="persp-vp" cx="${f(v.x)}" cy="${f(v.y)}" r="6"/><text x="${f(v.x + 9)}" y="${f(v.y - 8)}">VP${n}</text>`;
    } else {
      // Off the stage: a marker on its edge, in its direction from the middle.
      const cx = w / 2, cy = h / 2, dx = v.x - cx, dy = v.y - cy;
      const t = Math.min(dx ? (dx > 0 ? w - 14 - cx : 14 - cx) / dx : Infinity, dy ? (dy > 0 ? h - 14 - cy : 14 - cy) / dy : Infinity);
      const ex = cx + dx * t, ey = cy + dy * t;
      m += `<circle class="persp-vp" cx="${f(ex)}" cy="${f(ey)}" r="5"/>` +
        `<text x="${f(Math.min(ex + 8, w - 150))}" y="${f(Math.max(ey - 8, 14))}">VP${n} off by ${(Math.hypot(dx, dy) / w).toFixed(1)} widths</text>`;
    }
  }
  const found = vps.map((v, i) => v && { v, n: i + 1 }).filter(Boolean);

  // The image's own box on the stage: the centre of vision of an uncropped
  // photo, and the width a field of view is measured across.
  const sr = el('stage').getBoundingClientRect(), ir = el('img').getBoundingClientRect();
  const C = { x: ir.left - sr.left + ir.width / 2, y: ir.top - sr.top + ir.height / 2 }, imgW = ir.width || w;

  if (found.length >= 2) {
    // The horizon joins the two whose line is nearest level - with three, the
    // other one is the vertical direction's.
    let pair = [found[0], found[1]];
    if (found.length === 3) {
      const lvl = ([a, b]) => Math.abs(Math.atan2(b.v.y - a.v.y, b.v.x - a.v.x) % Math.PI);
      const pairs = [[found[0], found[1]], [found[0], found[2]], [found[1], found[2]]];
      pair = pairs.reduce((best, p) => Math.min(lvl(p), Math.PI - lvl(p)) < Math.min(lvl(best), Math.PI - lvl(best)) ? p : best);
    }
    const [A, B] = pair.map(p => p.v);
    m += through(A, B, 'persp-horizon');
    let tilt = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
    if (tilt > 90) tilt -= 180; if (tilt < -90) tilt += 180;
    notes.push([Math.abs(tilt) < 0.5 ? 'Horizon (eye level) is level.' : `Horizon (eye level) is tilted ${Math.abs(tilt).toFixed(1)}°.`, Math.abs(tilt) >= 2]);

    if (found.length === 2) {
      // The eye, from the two vanishing points of a right angle.
      const L = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / L, uy = (B.y - A.y) / L;
      const s = (C.x - A.x) * ux + (C.y - A.y) * uy, F = { x: A.x + ux * s, y: A.y + uy * s };
      const t1 = (A.x - F.x) * ux + (A.y - F.y) * uy, t2 = (B.x - F.x) * ux + (B.y - F.y) * uy;
      if (t1 * t2 >= 0) {
        notes.push(['Both vanishing points are on the same side of the picture’s centre - two sides of a square corner cannot do that. One pair of edges is off, or the corner is not square.', true]);
      } else {
        const d = Math.sqrt(-t1 * t2), fov = 2 * Math.atan(imgW / 2 / d) * 180 / Math.PI;
        const mm = 18 / Math.tan(fov / 2 * Math.PI / 180);
        notes.push([`If VP1 and VP2 are a right angle (a box’s two sides), the picture sees ${Math.round(fov)}° across - a ${Math.round(mm)} mm lens on full frame.`]);
        if (fov > 90) notes.push(['Wider than the eye takes in comfortably: square things will look stretched at their corners. Move the vanishing points further apart.', true]);
      }
    } else {
      const H = orthocentre(found[0].v, found[1].v, found[2].v);
      if (H) {
        m += `<line class="construct-guide" x1="${f(H.x - 12)}" y1="${f(H.y)}" x2="${f(H.x + 12)}" y2="${f(H.y)}"/>` +
          `<line class="construct-guide" x1="${f(H.x)}" y1="${f(H.y - 12)}" x2="${f(H.x)}" y2="${f(H.y + 12)}"/>` +
          `<text x="${f(H.x + 14)}" y="${f(H.y + 16)}">centre of vision</text>`;
        const off = Math.hypot(H.x - C.x, H.y - C.y) / imgW;
        notes.push([off < 0.08
          ? 'The centre of vision is near the middle of the picture, as a camera’s is.'
          : `The centre of vision is ${Math.round(off * 100)}% of the width from the middle - a cropped photo, or vanishing points that do not agree.`, off >= 0.25]);
      }
    }
  }
  if (P.length < 12) {
    // Which line of its pair the next click starts: the first along some
    // edge, the second along an edge parallel to it.
    const second = Math.floor(P.length / 2) % 2 === 1;
    const step = second ? 'Now two points along another edge parallel to it in the scene'
      : P.length >= 8 ? 'Optionally, a third direction - two points up a vertical edge - for three-point perspective'
      : P.length >= 4 ? 'Two points along an edge in a new direction (another side of the same box)'
      : 'Click two points along a straight edge in the picture';
    notes.unshift([`${step}. Backspace undoes a point.`]);
  }
  notes.forEach(([t, warn], i) => { m += `<text class="${warn ? 'persp-warn' : 'persp-note'}" x="12" y="${22 + i * 18}">${esc(t)}</text>`; });
  return m;
}

// A frame's proportions, named when they are a paper or canvas shape anyone
// buys (within 2.5%), else as a plain ratio - always width to height.
function frameRatio(fw, fh) {
  const r = fw / fh;
  for (const [a, b] of [[1, 1], [5, 4], [4, 3], [3, 2], [16, 9], [2, 1], [7, 5]]) {
    for (const [p, q] of [[a, b], [b, a]]) if (Math.abs(r / (p / q) - 1) < 0.025) return `${p}:${q}`;
  }
  return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

// Same stage-relative coordinate space as angleLineAt() - see its own
// comment. Rebuilds #constructOverlay from scratch on every call, the same
// full-redraw approach renderAngleOverlay() uses.
function renderConstructOverlay() {
  const svg = el('constructOverlay');
  const rect = el('stage').getBoundingClientRect();
  const w = rect.width, h = rect.height;
  let markup = '';

  if (state.constructMode === 'vp' && state.vp) {
    const { x, y } = state.vp;
    // Half-turn's worth of angles is enough - a line through the point
    // already covers both directions of its own angle, so 0..180 degrees
    // (not 360) is the full set of distinct lines.
    const RAYS = 16;
    const diag = Math.hypot(w, h); // long enough that #constructOverlay's own edge, not the line length, decides where it ends
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI;
      const dx = Math.cos(a) * diag, dy = Math.sin(a) * diag;
      markup += `<line x1="${x - dx}" y1="${y - dy}" x2="${x + dx}" y2="${y + dy}"/>`;
    }
    markup += `<circle cx="${x}" cy="${y}" r="5"/>`;
  } else if (state.constructMode === 'plumb' && state.plumb) {
    const { x, y } = state.plumb;
    markup += `<line class="construct-guide" x1="${x}" y1="0" x2="${x}" y2="${h}"/>` +
      `<line class="construct-guide" x1="0" y1="${y}" x2="${w}" y2="${y}"/>` +
      `<circle cx="${x}" cy="${y}" r="5"/>`;
  } else if (state.constructMode === 'divider' && state.divider) {
    const { x1, y1, x2, y2 } = state.divider;
    const unit = Math.hypot(x2 - x1, y2 - y1);
    if (unit > 0) {
      const nx = (x2 - x1) / unit, ny = (y2 - y1) / unit; // unit direction
      const px = -ny, py = nx;                            // perpendicular, for tick marks
      const TICK = 10;
      // Stops at the first tick that lands off-stage (with a little slack)
      // rather than a fixed count - a short unit near an edge should not
      // draw ticks nobody will ever see, and a long one should not stop
      // early just because some fixed cap said so.
      for (let n = 1; n <= 20; n++) {
        const tx = x1 + nx * unit * n, ty = y1 + ny * unit * n;
        if (tx < -50 || tx > w + 50 || ty < -50 || ty > h + 50) break;
        markup += `<line x1="${tx - px * TICK}" y1="${ty - py * TICK}" x2="${tx + px * TICK}" y2="${ty + py * TICK}"/>` +
          `<text x="${tx + px * (TICK + 9)}" y="${ty + py * (TICK + 9)}" text-anchor="middle">${n}</text>`;
      }
      markup += `<line class="construct-guide" x1="${x1}" y1="${y1}" x2="${x1 + nx * unit * 20}" y2="${y1 + ny * unit * 20}"/>`;
    }
  } else if (state.constructMode === 'persp') {
    markup += perspMarkup(w, h);
  } else if (state.constructMode === 'frame' && state.frame) {
    // A viewfinder: the card with a window cut in it that painters hold up
    // to find a picture in a scene - or here, a better one inside a photo.
    // Thirds inside it, and its proportions, so the crop can be matched to
    // the paper it will be drawn on.
    const f = state.frame;
    const x = Math.min(f.x1, f.x2), y = Math.min(f.y1, f.y2), fw = Math.abs(f.x2 - f.x1), fh = Math.abs(f.y2 - f.y1);
    if (fw > 6 && fh > 6) {
      markup += `<path class="construct-shade" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${x} ${y}h${fw}v${fh}h${-fw}Z"/>`;
      for (const k of [1, 2]) {
        markup += `<line class="construct-thirds" x1="${x + fw * k / 3}" y1="${y}" x2="${x + fw * k / 3}" y2="${y + fh}"/>` +
          `<line class="construct-thirds" x1="${x}" y1="${y + fh * k / 3}" x2="${x + fw}" y2="${y + fh * k / 3}"/>`;
      }
      markup += [[x, y, x + fw, y], [x + fw, y, x + fw, y + fh], [x + fw, y + fh, x, y + fh], [x, y + fh, x, y]]
        .map(([a, b, c, d]) => `<line class="construct-guide" x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`).join('');
      markup += `<text x="${x + 4}" y="${y > 18 ? y - 6 : y + 15}">${frameRatio(fw, fh)}</text>`;
    }
  }

  svg.classList.toggle('hidden', markup === '');
  svg.innerHTML = markup;
}

// Gates live-follow the same way angleDrag gates the angle tool's own drag -
// without it, a bare pointermove (hovering, no button down) would keep
// relocating the vanishing point/plumb line on every mouse twitch.
let constructDrag = null;
el('stage').addEventListener('pointerdown', e => {
  if (state.constructMode === 'off') return;
  const rect = el('stage').getBoundingClientRect();
  constructDrag = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  try { el('stage').setPointerCapture(e.pointerId); } catch { /* keeps the drag going regardless */ }
  if (state.constructMode === 'vp') { state.vp = constructDrag; renderConstructOverlay(); }
  else if (state.constructMode === 'plumb') { state.plumb = constructDrag; renderConstructOverlay(); }
  else if (state.constructMode === 'persp') {
    // Twelve points is three vanishing points; the next click starts over.
    if (!state.persp || state.persp.length >= 12) state.persp = [];
    state.persp.push(constructDrag);
    renderConstructOverlay();
  }
});
el('stage').addEventListener('pointermove', e => {
  if (!constructDrag) return;
  const rect = el('stage').getBoundingClientRect();
  const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (state.constructMode === 'vp') { state.vp = pt; renderConstructOverlay(); }
  else if (state.constructMode === 'plumb') { state.plumb = pt; renderConstructOverlay(); }
  else if (state.constructMode === 'divider') { state.divider = { x1: constructDrag.x, y1: constructDrag.y, x2: pt.x, y2: pt.y }; renderConstructOverlay(); }
  else if (state.constructMode === 'frame') { state.frame = { x1: constructDrag.x, y1: constructDrag.y, x2: pt.x, y2: pt.y }; renderConstructOverlay(); }
});
el('stage').addEventListener('pointerup', () => { constructDrag = null; });
el('stage').addEventListener('pointercancel', () => { constructDrag = null; });

/* -------------------------------------------------------------- eyedropper
   Click the reference to read the exact colour under the cursor - hex and
   brightness percent - rather than estimating it by eye. Samples from the
   same small offscreen canvas refreshValueTools() already draws for the
   histogram/palette on every pose (see analyzeCurrentImage()): 96x96 is
   plenty of precision for "roughly what value is this," and there is no
   reason a second, larger canvas should exist only for this. */
function toggleEyedropper() {
  state.eyedropperMode = !state.eyedropperMode;
  if (state.eyedropperMode && state.angleMode) toggleAngleMode();
  if (state.eyedropperMode && state.constructMode !== 'off') exitConstructMode();
  el('btnEyedropper').setAttribute('aria-pressed', String(state.eyedropperMode));
}

// Newest-first, capped - see the CSS comment on #eyedropperHistory. Not part
// of `state`: like angleDrag, this is transient UI-only scratch, reset by
// show() on every new pose rather than persisted or saved.
const EYEDROPPER_HISTORY_MAX = 5;
let eyedropperHistory = [];

function renderEyedropperHistory() {
  el('eyedropperHistory').innerHTML = eyedropperHistory
    .map(hex => `<span class="palette-swatch" style="background:${hex}" data-hex="${hex}" title="${hex} - click to copy"></span>`)
    .join('');
}

// Click-to-copy rather than a second read of the same pixel - the whole
// point of keeping history is comparing two earlier spots (skin vs
// background) without re-aiming the cursor at either one again.
el('eyedropperHistory').addEventListener('click', e => {
  const hex = e.target.dataset?.hex;
  if (!hex) return;
  navigator.clipboard?.writeText(hex).catch(() => { /* clipboard permission denied - not worth surfacing an error over */ });
});

/* --------------------------------------------------------- mixing guide
   Ways to mix the eyedropper's colour from real paint - paintRecipes() in
   paint.js, which mixes pigments the way paint does (by what they absorb),
   not the way screens do. Several routes, closest first, from whichever
   palette is chosen: the same colour from a full palette, and from Zorn's
   four, are different lessons. In watercolour, water and the white of the
   paper do what white paint does here.

   First, in every medium, what the value is in it - its step on the
   medium's tone ladder (js/materials.js): "a light wash", "cross-hatching",
   "2B". For ink and graphite that is the whole answer - they have one
   colour. Not for watercolour or oil: there the recipe's own wash or white
   is the exact answer, and a ladder step beside it would only disagree. */
const MIX_NOTES = {
  watercolour: 'Parts of paint; the wash says how much water - lighter is more water, and white is the paper.',
  opaque: 'Parts by volume, white included.',
  wcPencil: 'The pigments to look for in your set - wetted, they mix like watercolour. Layer the first one first.',
  wcMarker: 'The pigments to look for in your markers - thinned with water, they mix like watercolour.',
};
function renderMixGuide(rgb) {
  const box = el('mixGuide');
  if (!rgb) { box.innerHTML = ''; return; }
  const p = materialsProfile(), m = MATERIALS[p.main];
  const pct = Math.round((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 * 100);
  const step = ['watercolour', 'opaque'].includes(p.main) ? ''
    : `<span class="mix-step">${esc(m.label)}: <b>${esc(materialToneFor(pct, m))}</b></span>`;
  if (!m.paint) { box.innerHTML = step; return; }
  const recipes = paintRecipes(rgb);
  box.innerHTML = step + (recipes.length
    ? recipes.map(paintRecipeHtml).join('') + `<span class="mix-note">${MIX_NOTES[p.main] || ''}</span>`
    : '<span class="mix-note">Mixing needs js/vendor/spectral.js, which did not load.</span>');
}

function initPaintSelect() {
  const sel = el('paintSelect');
  sel.innerHTML = Object.entries(PAINT_PALETTES).map(([k, p]) => `<option value="${k}" title="${esc(p.hint)}">${p.label}</option>`).join('');
  sel.value = paintPaletteKey();
  sel.addEventListener('change', () => {
    setPaintPaletteKey(sel.value);
    if (lastMixRgb) renderMixGuide(lastMixRgb);
  });
}
let lastMixRgb = null;

function sampleEyedropper(clientX, clientY) {
  const img = el('img');
  const rect = img.getBoundingClientRect();
  if (!ANALYSIS_CANVAS || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
  const relX = (clientX - rect.left) / rect.width, relY = (clientY - rect.top) / rect.height;
  const x = Math.min(ANALYSIS_CANVAS.width - 1, Math.floor(relX * ANALYSIS_CANVAS.width));
  const y = Math.min(ANALYSIS_CANVAS.height - 1, Math.floor(relY * ANALYSIS_CANVAS.height));
  const [r, g, b] = ANALYSIS_CANVAS.getContext('2d').getImageData(x, y, 1, 1).data;
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const pct = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 * 100);
  el('eyedropperReadout').innerHTML =
    `<span class="palette-swatch" style="background:${hex}"></span> ${hex} · ${pct}% value`;
  lastMixRgb = [r, g, b];
  renderMixGuide(lastMixRgb);
  el('valueTools').classList.remove('hidden'); // surface the reading even if the drawer was closed

  eyedropperHistory.unshift(hex);
  eyedropperHistory.length = Math.min(eyedropperHistory.length, EYEDROPPER_HISTORY_MAX);
  renderEyedropperHistory();
}

function initEyedropper() {
  el('stage').addEventListener('pointerdown', e => {
    if (state.eyedropperMode) sampleEyedropper(e.clientX, e.clientY);
  });
  el('btnEyedropper').addEventListener('click', toggleEyedropper);
  initPaintSelect();
}

/* ------------------------------------------------------------- info drawer
   toggleValueTools() just shows/hides #valueTools - the histogram and
   palette inside it are always kept current (see refreshValueTools(),
   called from show()'s own onload) whether or not the drawer is open, so
   opening it is instant rather than waiting on a fresh analysis. */
function toggleValueTools() {
  const open = el('valueTools').classList.toggle('hidden') === false;
  el('btnInfo').setAttribute('aria-pressed', String(open));
}
el('btnInfo').addEventListener('click', toggleValueTools);

/* ------------------------------------------------------------------ help
   Reachable from the setup screen (no session running yet) as well as
   mid-session, so it lives outside both #setup's and #session's own
   keydown-scoped shortcut handling - see the '?' listener and the guard
   added at the top of the session one below, rather than teaching either
   screen's own logic about a dialog that isn't really part of either. */
function toggleHelp() {
  const opening = el('helpOverlay').classList.contains('hidden');
  el('helpOverlay').classList.toggle('hidden');
  if (opening) el('helpModal').scrollTop = 0;
}
el('btnHelpSetup').addEventListener('click', toggleHelp);
el('btnHelpHud').addEventListener('click', toggleHelp);
el('btnHelpClose').addEventListener('click', toggleHelp);
el('helpOverlay').addEventListener('click', e => { if (e.target === el('helpOverlay')) toggleHelp(); });
document.addEventListener('keydown', e => {
  // Not scoped to #session like most shortcuts below - help needs to open
  // (and close) the same way from the setup screen, before any session
  // exists at all. Escape-while-a-session-is-running is deliberately left
  // to the session's own keydown handler below (it needs to swallow every
  // other key too, and closing help there instead of here is what stops
  // this same keypress from also falling through to its stopSession() case).
  if (e.key === 'Escape' && el('session').classList.contains('hidden')
      && !el('helpOverlay').classList.contains('hidden')) {
    toggleHelp();
    return;
  }
  if (e.key !== '?') return;
  // A bare '?' still needs Shift on most layouts, but don't fight typing in
  // the custom-interval field or any other form control that's focused.
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  toggleHelp();
});

/* ---------------------------------------------------------- image analysis
   One small offscreen canvas, redrawn on every pose (see show()'s onload),
   backing three features at once: the histogram, the dominant-colour
   swatches, and the eyedropper's sampling. 96x96 is deliberately tiny - this
   is for statistics and approximate colour reads, not pixels, and a small
   canvas keeps getImageData() cheap enough to run on every single pose
   without a second thought. */
const ANALYSIS_SIZE = 96;
let ANALYSIS_CANVAS = null;

function refreshValueTools() {
  const img = el('img');
  if (!img.naturalWidth) return;
  if (!ANALYSIS_CANVAS) ANALYSIS_CANVAS = document.createElement('canvas');
  ANALYSIS_CANVAS.width = ANALYSIS_SIZE;
  ANALYSIS_CANVAS.height = ANALYSIS_SIZE;
  const ctx = ANALYSIS_CANVAS.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

  let data;
  try { data = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data; }
  catch { return; } // a tainted canvas should never happen here (same-origin/blob), but never break the page over it

  const BUCKETS = 16;
  const hist = new Array(BUCKETS).fill(0);
  // Coarse-quantized (3 bits/channel = 512 buckets) rather than exact RGB,
  // which would almost never repeat across a photo and so would never
  // surface a genuine "dominant" colour at all.
  const colorCounts = new Map();
  // Visual-weight centroid: a luminance-weighted average position, on the
  // rough heuristic that the brightest region of a photo reference is
  // usually also where the eye lands first - the same weighting the
  // histogram/eyedropper already use, just summed against position too
  // instead of only against a tone bucket.
  let sumW = 0, sumX = 0, sumY = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    hist[Math.min(BUCKETS - 1, Math.floor(luma / 256 * BUCKETS))]++;
    const key = (r >> 5) + '_' + (g >> 5) + '_' + (b >> 5);
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    const px = (i / 4) % ANALYSIS_SIZE, py = Math.floor((i / 4) / ANALYSIS_SIZE);
    sumW += luma; sumX += luma * px; sumY += luma * py;
  }
  const palette = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key.split('_').map(v => Number(v) * 32 + 16));

  drawHistogram(hist);
  drawPalette(palette);

  state.focalFrac = sumW > 0 ? { x: sumX / sumW / ANALYSIS_SIZE, y: sumY / sumW / ANALYSIS_SIZE } : null;
  el('focalMarker').classList.toggle('hidden', !el('optFocalPoint').checked || !state.focalFrac);
  if (state.focalFrac) positionFocalMarker();
  // ...and the grids, which have to be re-fitted whenever the split view
  // opens or closes: #paneValue's image only gets a rendered box once its
  // pane is visible.
  positionGrid();
}

// Converts state.focalFrac (0..1 across the image) into a px position
// against #img's OWN rendered box, not a raw % of #paneOrig - #img is
// object-fit:contain, so a reference whose aspect ratio doesn't match the
// pane letterboxes, and a plain percentage would land the marker in that
// letterbox gutter instead of on the actual image content. Read fresh each
// call rather than cached, since the pane's own size can change (a window
// resize) between poses.
/* Sizes each pane's grid to that pane's image, the same problem
   positionFocalMarker() solves just below and for the same reason: #img is
   letterboxed inside its pane, so anything laid out against the PANE misses
   the image by however much gutter there is.
   offsetLeft/Top/Width/Height rather than getBoundingClientRect(): the grid
   is a sibling of the image inside .zoomwrap, which is the offset parent of
   both, so these are already in exactly the coordinate space the inline
   styles below are written in - and, unlike a client rect, they are the
   pre-transform values, which is what a positioned child inside the
   transformed wrapper needs. */
function positionGrid() {
  for (const [gridId, imgId] of [['grid', 'img'], ['gridValue', 'imgValue'], ['poseOverlay', 'img'], ['headOverlay', 'img']]) {
    const g = el(gridId), im = el(imgId);
    if (!im.naturalWidth) continue;   // nothing decoded yet - show()'s onload calls back
    g.style.left = im.offsetLeft + 'px';
    g.style.top = im.offsetTop + 'px';
    // The stylesheet's own 100%/100% stays as the fallback the sizing check
    // wants to see; right/bottom are cleared so its inset:0 cannot fight the
    // explicit width set here.
    g.style.right = g.style.bottom = 'auto';
    g.style.width = im.offsetWidth + 'px';
    g.style.height = im.offsetHeight + 'px';
  }
  renderDrawing();
}

function positionFocalMarker() {
  const pane = el('paneOrig').getBoundingClientRect();
  const img = el('img').getBoundingClientRect();
  const marker = el('focalMarker');
  marker.style.left = (img.left - pane.left + state.focalFrac.x * img.width) + 'px';
  marker.style.top = (img.top - pane.top + state.focalFrac.y * img.height) + 'px';
}

function drawHistogram(hist) {
  const canvas = el('histoCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(1, ...hist);
  const barW = w / hist.length;
  // Read back rather than hardcoded, so this still matches the accent in
  // whichever theme is active - canvas fillStyle cannot take a CSS custom
  // property directly the way an element's own style can.
  ctx.fillStyle = getComputedStyle(el('session')).getPropertyValue('--accent').trim() || '#d8a24a';
  hist.forEach((v, i) => ctx.fillRect(i * barW, h - (v / max) * h, Math.max(1, barW - 1), (v / max) * h));
}

function drawPalette(colors) {
  const host = el('paletteSwatches');
  host.innerHTML = '';
  for (const [r, g, b] of colors) {
    const sw = document.createElement('div');
    sw.className = 'palette-swatch';
    sw.style.background = `rgb(${r},${g},${b})`;
    host.appendChild(sw);
  }
}

el('btnSimilar').addEventListener('click', toggleSimilar);
el('btnSkip').addEventListener('click', skipCurrent);

/* Removes the pose on screen right now and moves on immediately - staying on
   an image someone just said they never want to see again is the one wrong
   answer here. state.current is the single frame shown, which is right even
   for a rotation group: skipping one angle should not remove the other three,
   the same distinction buildPool's own filtering makes. */
function skipCurrent() {
  if (!state.current) return;
  setSkipped(state.current, true);
  // Browsing steps to the next image rather than drawing a new one, and the
  // skipped frame stays in the list: the grid keeps showing skipped images
  // precisely so they can be un-skipped, and the viewer over that same list
  // has to agree with it.
  if (state.browse) { browseStep(1); return; }
  advance(false);
}
