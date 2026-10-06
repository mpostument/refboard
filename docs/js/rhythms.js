/* refboard - Reilly rhythms: the long flowing lines that run through a figure
   from one side of a form to the other, as Frank Reilly taught them - drawn
   before any contour, so the pose has its swing before it has its shapes.

   A rhythm is not a bone. A bone is a straight stick from joint to joint; a
   rhythm leaves a shoulder, crosses the chest, passes the opposite hip and
   goes on down the leg to the foot, in one curve. The two that cross like this
   (shoulder to the opposite foot, both ways) are the figure's main rhythms;
   the spine's, from the head to the pelvis, and each arm's, from the shoulder
   to the wrist, run with them.

   The points come from the pose model (the same BlazePose points as the pose
   skeleton, p); the lines are smooth curves through them (smoothPath()). Each
   curve is also measured: its length against the straight distance from end to
   end. A rhythm that is nearly straight is a stiff pose, or a figure drawn
   from sticks; the note names the one with the most swing and any that are
   stiff, to draw as a curve whatever the photo shows.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// Each rhythm: the points it runs through, in order (see PL in vision.js);
// 'chest' is the middle of the torso, 'neck' and 'pelvis' the middles of the
// shoulders and the hips. Colours are set in the stylesheet by `cls`.
const RHYTHMS = [
  { id: 'diagL', cls: 'r-a', label: 'cyan', what: 'the left shoulder to the right foot', via: ['lSh', 'chest', 'rHip', 'rKn', 'rAn'] },
  { id: 'diagR', cls: 'r-b', label: 'pink', what: 'the right shoulder to the left foot', via: ['rSh', 'chest', 'lHip', 'lKn', 'lAn'] },
  { id: 'spine', cls: 'r-s', label: 'red', what: 'the head to the pelvis', via: ['head', 'neck', 'chest', 'pelvis'] },
  { id: 'armL', cls: 'r-c', label: 'amber', what: 'the left arm', via: ['lSh', 'lEl', 'lWr'] },
  { id: 'armR', cls: 'r-c', label: 'amber', what: 'the right arm', via: ['rSh', 'rEl', 'rWr'] },
];
// Under this the curve is nearly a straight line: its length is within 3% of
// the straight distance from end to end.
const RHYTHM_STIFF = 1.03;

/* P: points by name as drawPose() has them - [x, y] in the picture's pixels,
   or null where the model is not sure. Each rhythm that has at least three
   points left comes out: { id, cls, label, what, pts, bend } - `bend` is its
   length over the straight line from end to end, 1 for a straight one. Left and
   right are the picture's (the model's), as in the pose skeleton. */
function rhythmsOf(P) {
  const mid = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
  const neck = mid(P.lSh, P.rSh), pelvis = mid(P.lHip, P.rHip);
  const at = {
    ...P, neck, pelvis,
    chest: mid(neck, pelvis),
    // The head's own point is the nose, or the middle of the ears.
    head: P.nose || mid(P.lEar, P.rEar),
  };
  const out = [];
  for (const r of RHYTHMS) {
    const pts = r.via.map(k => at[k]).filter(Boolean);
    // One that lost its ends is a stub, not a rhythm: it must still start and
    // end where it should (the first and the last point).
    if (pts.length < 3 || !at[r.via[0]] || !at[r.via[r.via.length - 1]]) continue;
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const chord = Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]);
    out.push({ id: r.id, cls: r.cls, label: r.label, what: r.what, pts, bend: chord > 0 ? len / chord : 1 });
  }
  return out;
}

// The rhythms as an SVG fragment in the picture's pixels, W wide: each curve
// twice, a dark under-stroke first so it reads on light and dark alike.
function rhythmsSvg(rs, W) {
  const sw = Math.max(2, W / 170), fr = v => +v.toFixed(1);
  return rs.map(r => {
    const d = smoothPath(r.pts.map(p => [fr(p[0]), fr(p[1])]));
    return `<path class="r-o" d="${d}" stroke-width="${fr(sw + 3)}"/><path class="${r.cls}" d="${d}" stroke-width="${fr(sw)}"/>`;
  }).join('') + rs.flatMap(r => [r.pts[0], r.pts[r.pts.length - 1]])
    .map(p => `<circle class="r-end" cx="${fr(p[0])}" cy="${fr(p[1])}" r="${fr(sw * 1.4)}"/>`).join('');
}

// What the lines say, and what to do about them.
function rhythmsVerdict(rs) {
  if (!rs.length) return 'No rhythms: the model needs to see at least a shoulder and the hip across from it.';
  const out = [], has = id => rs.find(r => r.id === id);
  const main = ['diagL', 'diagR'].map(has).filter(Boolean);
  if (main.length === 2)
    out.push('<b class="r-ta">Cyan</b> and <b class="r-tb">pink</b> cross the chest: each shoulder to the foot opposite. Draw them first, as long curves, before any contour.');
  else if (main.length === 1)
    out.push(`<b class="${main[0].id === 'diagL' ? 'r-ta' : 'r-tb'}">${main[0].label[0].toUpperCase() + main[0].label.slice(1)}</b> runs ${main[0].what}, across the chest. Draw it first, as one long curve.`);
  const by = [...rs].sort((a, b) => b.bend - a.bend);
  const swing = by[0];
  if (swing.bend >= RHYTHM_STIFF)
    out.push(`Most swing: ${esc(swing.what)} - ${Math.round((swing.bend - 1) * 100)}% longer than straight.`);
  const stiff = rs.filter(r => r.bend < RHYTHM_STIFF);
  if (stiff.length)
    out.push(`Nearly straight: ${stiff.map(r => esc(r.what)).join(', ')} - a stiff pose, or draw it with a curve anyway: a rhythm that does not bend is only a stick.`);
  return out.join('<br>');
}

/* ---- in a session: the lines over the picture, as a layer. */
let rhythmsRun = 0;
// The model's landmarks for the picture shown, kept until it changes.
let rhythmsFor = { src: '', lm: null };

function clearRhythms() {
  rhythmsRun++;
  el('rhythmOverlay').classList.add('hidden');
  el('rhythmOverlay').innerHTML = '';
  overlayNote('rhythms', state.rhythmsOn ? 'Finding the pose...' : '');
}

function toggleRhythms() {
  state.rhythmsOn = !state.rhythmsOn;
  el('btnRhythms').setAttribute('aria-pressed', String(state.rhythmsOn));
  clearRhythms();
  if (state.rhythmsOn) runRhythms();
}

async function runRhythms() {
  const img = el('img'), run = ++rhythmsRun;
  if (!img.naturalWidth) return;
  const done = () => run !== rhythmsRun || !state.rhythmsOn;
  let lm;
  if (rhythmsFor.src === img.src && rhythmsFor.lm) lm = rhythmsFor.lm;
  else {
    if (!visionModels.pose) overlayNote('rhythms', 'Loading the pose model - about 6 MB, once. The image stays in this browser.');
    let model;
    try { model = await loadVision('pose'); }
    catch (err) {
      console.error('pose model:', err);
      if (!done()) overlayNote('rhythms', '<i>The pose model could not load</i> - it needs a connection the first time, and WebAssembly.');
      return;
    }
    if (done()) return;
    try { lm = (model.detect(visionCanvas(img)).landmarks || [])[0] || null; }
    catch (err) { console.error('pose detect:', err); overlayNote('rhythms', '<i>Could not read a pose from this image.</i>'); return; }
    rhythmsFor = { src: img.src, lm };
  }
  if (!lm) { overlayNote('rhythms', 'No figure found in this image.'); return; }
  const W = img.naturalWidth, H = img.naturalHeight, P = {};
  for (const [k, i] of Object.entries(PL)) {
    const p = lm[i];
    P[k] = p && (p.visibility === undefined || p.visibility > 0.5) ? [p.x * W, p.y * H] : null;
  }
  const rs = rhythmsOf(P), svg = el('rhythmOverlay');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = rhythmsSvg(rs, W);
  svg.classList.remove('hidden');
  overlayNote('rhythms', rhythmsVerdict(rs));
}

el('btnRhythms').addEventListener('click', toggleRhythms);
