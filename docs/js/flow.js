/* refboard - Stroke direction: the way to hatch a form, read from the photo.
   Hair, folds and muscle are drawn with strokes that go the way the form goes,
   not across it. This lays short strokes over the picture that do, in the
   places where the picture has a direction to give.

   How: the lightness gradient at a pixel points to where the tone changes
   fastest, so a stroke that stays in the same tone runs at a right angle to it.
   One pixel's gradient is noisy, though (and opposite on the two sides of a
   line), so the gradient's outer product [gx*gx gx*gy; gx*gy gy*gy] is
   averaged over a neighbourhood - the structure tensor - and the principal
   axis of that is the orientation (which, unlike the gradient, does not
   cancel itself across a stroke). Its coherence, (l1 - l2) / (l1 + l2), says
   whether the neighbourhood has one direction (a strand, a fold: 1) or none
   (a flat patch, a corner, noise: 0), and its trace how much tone changes there. A stroke is
   drawn only where both are enough, so a flat wall or a plain sky gets no
   strokes - there is no direction in them to follow, which the note says.

   The note names the direction most strokes lean to and how one-sided it is:
   a plait runs one way; a face turns through all of them.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const FLOW_KEY = 'refboard.strokeDirection.v1';
// Strokes across the long side: coarse for a quick look, fine for a close one.
const FLOW_DENSITY = { coarse: 22, medium: 34, fine: 52 };
const FLOW_MIN_COHERENCE = 0.3;
const FLOW_MIN_ENERGY = 0.25;     // trace of the tensor: L* squared per pixel squared

function flowLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(FLOW_KEY));
    if (v && FLOW_DENSITY[v.density]) return { density: v.density };
  } catch { /* fall through */ }
  return { density: 'medium' };
}
function flowSave(c) {
  try { localStorage.setItem(FLOW_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/* p: stepsRead(). Gives { w, h, strokes, step, readable, lean, one }:
     strokes   { x, y, a, len, coh, dark }: where, the angle of the stroke in
               radians from the horizontal (y down, so positive leans down to
               the right), its length in pixels, how coherent, and whether the
               picture is dark under it (the page draws it light then);
     readable  the share of the picture with a direction, percent;
     lean      the direction most strokes lean to, degrees in [0, 180);
     one       how much of one direction there is, 0 to 1 (the length of the
               mean of the doubled angles - a stroke and its turned half are the same line). */
function flowOf(p, { density = 'medium' } = {}) {
  const { w, h, L } = p, px = w * h, S = Math.max(w, h);
  const soft = stepsBlur(Float32Array.from(L), w, h, 1);
  const gxx = new Float32Array(px), gyy = new Float32Array(px), gxy = new Float32Array(px);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, gx = (soft[i + 1] - soft[i - 1]) / 2, gy = (soft[i + w] - soft[i - w]) / 2;
    gxx[i] = gx * gx; gyy[i] = gy * gy; gxy[i] = gx * gy;
  }
  const r = S / 70;
  const jxx = stepsBlur(gxx, w, h, r), jyy = stepsBlur(gyy, w, h, r), jxy = stepsBlur(gxy, w, h, r);
  const step = S / FLOW_DENSITY[density];
  const strokes = [];
  let readableN = 0, cells = 0, sc = 0, ss = 0, sw = 0;
  for (let cy = step / 2; cy < h; cy += step) for (let cx = step / 2; cx < w; cx += step) {
    const x = Math.round(cx), y = Math.round(cy), i = y * w + x;
    cells++;
    const a = jxx[i], b = jyy[i], c = jxy[i];
    const trace = a + b;
    if (trace < FLOW_MIN_ENERGY) continue;
    const coh = Math.hypot(a - b, 2 * c) / trace;
    if (coh < FLOW_MIN_COHERENCE) continue;
    // The gradient's orientation, turned a quarter: along the tone, not across it.
    const grad = 0.5 * Math.atan2(2 * c, a - b), ang = grad + Math.PI / 2;
    readableN++;
    sc += Math.cos(2 * ang) * coh; ss += Math.sin(2 * ang) * coh; sw += coh;
    strokes.push({ x, y, a: ang, len: step * (0.45 + 0.5 * coh), coh, dark: soft[i] < 50 });
  }
  const mean = 0.5 * Math.atan2(ss, sc);
  let lean = (mean * 180 / Math.PI + 180) % 180;
  if (lean < 0) lean += 180;
  return { w, h, strokes, step, readable: cells ? readableN / cells * 100 : 0,
    lean, one: sw ? Math.hypot(sc, ss) / sw : 0 };
}

// The direction as a word: the horizontal and the vertical, and the two slants (y is down).
function flowWord(deg) {
  if (deg < 22.5 || deg >= 157.5) return 'horizontal';
  if (deg < 67.5) return 'falling to the right';
  if (deg < 112.5) return 'vertical';
  return 'rising to the right';
}

// The strokes, each in dark on a light halo (or the reverse over a dark spot), onto a canvas of the picture read's size.
function flowDraw(f, c) {
  c.width = f.w; c.height = f.h;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  const width = Math.max(1.2, f.step / 9);
  for (const dark of [true, false]) {
    // The halos first, so a stroke is never cut by its neighbour's halo.
    for (const pass of [0, 1]) {
      g.lineWidth = pass ? width : width + 2.2;
      for (const s of f.strokes) {
        if (s.dark !== dark) continue;
        g.strokeStyle = pass ? (dark ? '#fff' : '#111') : (dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.7)');
        const dx = Math.cos(s.a) * s.len / 2, dy = Math.sin(s.a) * s.len / 2;
        g.beginPath(); g.moveTo(s.x - dx, s.y - dy); g.lineTo(s.x + dx, s.y + dy); g.stroke();
      }
    }
  }
  return c;
}

function flowNote(f, c) {
  const chips = Object.keys(FLOW_DENSITY).map(k =>
    `<button type="button" class="chip" data-flow-d="${k}" aria-pressed="${c.density === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
  const share = f.readable < 1 ? 'almost none of the picture' : Math.round(f.readable) + '% of the picture';
  let line;
  if (!f.strokes.length) line = 'No direction to read: the picture is flat, or too soft for the tone to lean any way. Hatch across the form yourself.';
  else if (f.one > 0.55) line = `Most strokes run ${flowWord(f.lean)}: hatch that way, and cross it only in the deepest shadow.`;
  else line = `Directions vary, leaning ${flowWord(f.lean)}: the form turns here - let the strokes bend with it rather than set one angle.`;
  return `<div class="tone-bar"><span>Strokes</span>${chips}</div>` +
    `${esc(line)} <small>${esc(share)} has a direction; flat patches have none to follow.</small>`;
}

/* ---- in a session: the strokes over the picture, as a layer. */
let flowRun = 0;

function clearFlow() {
  flowRun++;
  el('flowOverlay').classList.add('hidden');
  overlayNote('flow', state.flowOn ? 'Reading the directions...' : '');
}

function toggleFlow() {
  state.flowOn = !state.flowOn;
  el('btnFlow').setAttribute('aria-pressed', String(state.flowOn));
  clearFlow();
  if (state.flowOn) runFlow();
}

// A moment's work, so after a frame: the button shows pressed first.
function runFlow() {
  const img = el('img'), run = ++flowRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== flowRun || !state.flowOn) return;
    let f;
    const c = flowLoad();
    try { f = flowOf(stepsRead(img), c); }
    catch (err) { console.error('flow:', err); overlayNote('flow', '<i>Could not read directions in this picture.</i>'); return; }
    flowDraw(f, el('flowOverlay')).classList.remove('hidden');
    overlayNote('flow', flowNote(f, c));
  }, 30);
}

el('btnFlow').addEventListener('click', toggleFlow);
el('poseNote').addEventListener('click', e => {
  const d = e.target.closest('[data-flow-d]');
  if (!d || !FLOW_DENSITY[d.dataset.flowD]) return;
  flowSave({ density: d.dataset.flowD });
  runFlow();
});
