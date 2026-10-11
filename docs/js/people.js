/* refboard - People in perspective: how tall a person is anywhere in a picture.
   The second half of the Perspective section (the first is the printed grid).

   The rule: the horizon is your eye level, so it crosses everything that is as
   high as your eye at the same height - the head of every standing adult, near
   or far, if the eye is at their head. A person's height on the page is then
   proportional to how far their feet are below the horizon:

       height on the page = (feet - horizon) * (their height / the eye's height)

   One figure fixes it: set the white figure's feet, its head and how tall it
   really is (a person in a photo, or one you drew) and the eye's height
   follows - (feet - horizon) / (head to feet) times that height. Then any
   other person standing anywhere on the ground, an adult, a child, someone
   tall, has a height on the page worked out, and the picture can be checked
   against it: is the child in the distance the right size?

   The dashed lines are the other half of the rule: through two same-height
   people, the line along their feet and the line along their heads meet at a
   point on the horizon - the vanishing point of the line the two stand on.

   Everything is in fractions of the picture's height (so the horizon is "0.42"
   and a figure half the picture is 0.5), drawn as one SVG. A picture of your
   own is held in the page only; the sample street is drawn from the horizon,
   so its lines run to wherever the horizon is put.
   Loaded with the perspective grid (loadSection('perspective')). */
"use strict";

const PP_KEY = 'refboard.people.v1';
const PP_MODE_KEY = 'refboard.perspectiveMode.v1';
const PP_KINDS = {
  adult: { label: 'Adult', m: 1.7, c: '#ffc428' },
  child: { label: 'Child', m: 1.2, c: '#38d6ff' },
  tall: { label: 'Tall', m: 1.9, c: '#ff50d2' },
};
const PP_MAX_PEOPLE = 14;
const PP_DEFAULTS = { hor: 0.42, refX: 0.5, feet: 0.88, high: 0.46, refM: 1.7, kind: 'adult' };

let ppl = null;                         // the state; null until first shown
let ppPic = null;                       // { url, w, h } for a picture of your own, else the sample street
let ppDrag = null;
let ppTap = null;                       // the last press on a person: { i, t }

const ppNum = (v, lo, hi, d) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d;

// Keeps the figure standing on the ground: below the horizon, head inside the picture.
function ppClamp(s) {
  s.hor = ppNum(s.hor, 0.05, 0.9, PP_DEFAULTS.hor);
  s.refX = ppNum(s.refX, 0.02, 0.98, PP_DEFAULTS.refX);
  s.feet = ppNum(s.feet, s.hor + 0.03, 0.98, PP_DEFAULTS.feet);
  s.high = ppNum(s.high, 0.02, s.feet, PP_DEFAULTS.high);
  s.refM = ppNum(s.refM, 0.4, 2.6, PP_DEFAULTS.refM);
  if (!PP_KINDS[s.kind]) s.kind = 'adult';
  return s;
}

function ppLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(PP_KEY)) || {}; } catch { /* a fresh start */ }
  return { ...ppClamp({ ...PP_DEFAULTS, ...v }), people: [], last: -1 };
}
function ppSave() {
  try { localStorage.setItem(PP_KEY, JSON.stringify({ hor: ppl.hor, refX: ppl.refX, feet: ppl.feet, high: ppl.high, refM: ppl.refM, kind: ppl.kind })); }
  catch { /* private mode */ }
}

// The eye's height above the ground, in metres: the white figure's height times
// how many of its own heights the horizon is above its feet.
const ppEye = s => s.refM * (s.feet - s.hor) / s.high;
// A person m metres tall with feet at y (fractions of the picture's height): how tall on the page.
const ppTall = (s, y, m) => Math.max(0, (y - s.hor) * m / ppEye(s));

// Where on a standing person the horizon crosses, for f = the eye's height over theirs.
function ppBody(f) {
  return f >= 0.92 ? 'the eyes' : f >= 0.8 ? 'the shoulders' : f >= 0.65 ? 'the chest'
    : f >= 0.52 ? 'the waist' : f >= 0.4 ? 'the hips' : f >= 0.2 ? 'the knees' : 'the ankles';
}
// ... as a phrase: the horizon is "above the head" of someone the eye is over, "at the chest" of the rest.
const ppAt = f => f >= 1.08 ? 'above the head' : 'at ' + ppBody(f);

function ppNote(s) {
  const E = ppEye(s), f = E / s.refM, m = x => x.toFixed(1);
  const parts = [`The horizon is ${ppAt(f)} of the white figure: the eye is about ${m(E)} m above the ground.`];
  if (f >= 0.92 && f <= 1.08) parts.push('That is eye level - the head of everyone as tall as the figure, near or far, is on the horizon.');
  else if (f > 1.08) parts.push('A high view: farther people stand higher up the page and are smaller, but no head reaches the horizon.');
  else parts.push('A low view: anyone taller than the eye has their head above the horizon, however far away; anyone shorter, below it.');
  parts.push('Where the horizon falls: ' + Object.values(PP_KINDS).map(k => `${k.label.toLowerCase()} (${m(k.m)} m) ${ppAt(E / k.m)}`).join('; ') + '.');
  if (s.people.length) parts.push(`${s.people.length} standing on the ground. Where two of the figure's height stand, the dashed lines along their feet and along their heads meet on the horizon.`);
  else parts.push('Click the ground to stand a person there; drag the white figure onto someone in a picture to check their size.');
  return parts.join(' ');
}

// A figure of height u with its feet at (x, y): a head, a torso, arms and legs.
function ppFigure(x, y, u, fill, stroke) {
  const r = 0.065 * u, f = n => +n.toFixed(2);
  const ln = (x1, y1, x2, y2, w) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${fill}" stroke-width="${f(Math.max(0.8, w))}" stroke-linecap="round"/>`;
  return `<g class="pp-fig" stroke-opacity="1">` +
    `<circle cx="${f(x)}" cy="${f(y - u + r)}" r="${f(Math.max(0.8, r))}" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>` +
    `<path d="M${f(x - 0.11 * u)} ${f(y - 0.84 * u)}H${f(x + 0.11 * u)}L${f(x + 0.08 * u)} ${f(y - 0.5 * u)}H${f(x - 0.08 * u)}Z" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>` +
    ln(x - 0.04 * u, y - 0.5 * u, x - 0.045 * u, y, 0.07 * u) + ln(x + 0.04 * u, y - 0.5 * u, x + 0.045 * u, y, 0.07 * u) +
    ln(x - 0.12 * u, y - 0.82 * u, x - 0.14 * u, y - 0.52 * u, 0.045 * u) + ln(x + 0.12 * u, y - 0.82 * u, x + 0.14 * u, y - 0.52 * u, 0.045 * u) + `</g>`;
}

// The sample street, drawn from the horizon: sky and ground, a road, the rows
// of its paving and a wall each side, all running to one point on the horizon.
function ppSample(s, W, H) {
  const hy = s.hor * H, vx = W / 2, f = n => +n.toFixed(1), out = [];
  out.push(`<defs><linearGradient id="ppSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fc3e3"/><stop offset="1" stop-color="#e9f0f2"/></linearGradient></defs>`);
  out.push(`<rect width="${W}" height="${f(hy)}" fill="url(#ppSky)"/><rect y="${f(hy)}" width="${W}" height="${f(H - hy)}" fill="#cdc8b8"/>`);
  // A line from the vanishing point down to the bottom edge, at x = vx + k * W at the bottom.
  const edge = k => [vx + k * W, H];
  const roadK = 0.36;
  out.push(`<polygon points="${f(vx)},${f(hy)} ${f(edge(-roadK)[0])},${H} ${f(edge(roadK)[0])},${H}" fill="#8d8f94"/>`);
  for (const k of [-roadK, roadK]) out.push(`<line x1="${f(vx)}" y1="${f(hy)}" x2="${f(edge(k)[0])}" y2="${H}" stroke="#f1efe6" stroke-width="3"/>`);
  // The rows of the paving: depth z comes in as 1 / z.
  for (let z = 1; z < 16; z += 1) {
    const y = hy + (H - hy) / (1 + (z - 1) * 0.55), half = roadK * W * (y - hy) / (H - hy);
    out.push(`<line x1="${f(vx - half)}" y1="${f(y)}" x2="${f(vx + half)}" y2="${f(y)}" stroke="#7c7e83" stroke-width="1"/>`);
  }
  // A wall each side: its foot runs to the point from below the picture, its roof from above the horizon.
  for (const side of [-1, 1]) {
    const k = side * 0.62, xNear = side < 0 ? 0 : W, xFar = vx + side * 0.07 * W;
    const t = x => (x - vx) / (k * W);                                // 0 at the point, 1 at the bottom edge's x
    const foot = x => hy + (H - hy) * t(x), roof = x => hy - (H - hy) * 0.95 * t(x);
    out.push(`<polygon points="${f(xNear)},${f(foot(xNear))} ${f(xNear)},${f(roof(xNear))} ${f(xFar)},${f(roof(xFar))} ${f(xFar)},${f(foot(xFar))}" fill="${side < 0 ? '#d8c8b2' : '#c2b4a2'}"/>`);
    for (let w = 1; w < 7; w++) {                                     // pilasters, narrowing toward the point
      const x = vx + side * (0.07 + 0.55 * (1 - w / 7) ** 1.7) * W;
      out.push(`<line x1="${f(x)}" y1="${f(roof(x))}" x2="${f(x)}" y2="${f(foot(x))}" stroke="rgba(0,0,0,.18)" stroke-width="2"/>`);
    }
  }
  return out.join('');
}

// The white figure, the people, the horizon and the dashed lines, over whatever is behind.
function ppTop(s, W, H) {
  const f = n => +n.toFixed(1), hy = s.hor * H, out = [];
  out.push(`<rect id="ppBg" width="${W}" height="${H}" fill="transparent"/>`);
  out.push(`<line x1="0" y1="${f(hy)}" x2="${W}" y2="${f(hy)}" stroke="#fff" stroke-opacity=".9" stroke-width="2.5" stroke-dasharray="14 8"/>` +
    `<line x1="0" y1="${f(hy)}" x2="${W}" y2="${f(hy)}" stroke="#111" stroke-opacity=".55" stroke-width="1" stroke-dasharray="14 8" stroke-dashoffset="7"/>` +
    `<text x="10" y="${f(hy - 8)}" font-size="15" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">eye level</text>`);
  out.push(`<line data-h="hor" x1="0" y1="${f(hy)}" x2="${W}" y2="${f(hy)}" stroke="transparent" stroke-width="24" vector-effect="non-scaling-stroke" class="pp-hor"><title>Drag the eye level</title></line>`);
  // The guides: feet to feet and head to head of the white figure and the last person of its height.
  const last = s.people[s.last];
  if (last && Math.abs(last.m - s.refM) < 0.005) {
    const x0 = s.refX * W, y0 = s.feet * H, x1 = last.x * W, y1 = last.y * H;
    const th = ppTall(s, last.y, last.m) * H, hy0 = y0 - s.high * H, hy1 = y1 - th;
    if (Math.abs(y1 - y0) > 4) {
      const vx = x0 + (hy - y0) * (x1 - x0) / (y1 - y0);
      for (const [a, b] of [[x0, y0], [x0, hy0]])
        out.push(`<line x1="${f(a)}" y1="${f(b)}" x2="${f(vx)}" y2="${f(hy)}" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 5" stroke-opacity=".85"/>`);
      out.push(`<circle cx="${f(vx)}" cy="${f(hy)}" r="5" fill="#fff" stroke="#111" stroke-width="1.5"/>`);
    }
  }
  s.people.forEach((p, i) => {
    const k = PP_KINDS[p.kind], u = ppTall(s, p.y, p.m) * H;
    out.push(ppFigure(p.x * W, p.y * H, u, k.c, 'rgba(0,0,0,.7)'));
    out.push(`<circle class="pp-handle" data-h="p" data-i="${i}" cx="${f(p.x * W)}" cy="${f(p.y * H)}" r="6" fill="#fff" fill-opacity=".9" stroke="#111" stroke-width="1.5"/>`);
  });
  const rx = s.refX * W, ry = s.feet * H, rh = s.high * H;
  out.push(ppFigure(rx, ry, rh, '#fff', '#111'));
  out.push(`<text x="${f(rx + 0.16 * rh)}" y="${f(ry - rh * 0.5)}" font-size="15" font-family="sans-serif" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${s.refM.toFixed(2).replace(/0$/, '')} m</text>`);
  out.push(`<circle class="pp-handle" data-h="feet" cx="${f(rx)}" cy="${f(ry)}" r="8" fill="#fff" stroke="#111" stroke-width="2"><title>Drag to move the white figure</title></circle>`);
  out.push(`<circle class="pp-handle" data-h="head" cx="${f(rx)}" cy="${f(ry - rh)}" r="8" fill="#ffc428" stroke="#111" stroke-width="2"><title>Drag to set how tall it looks</title></circle>`);
  return out.join('');
}

const ppView = () => ppPic ? { W: 1000, H: Math.round(1000 * ppPic.h / ppPic.w), url: ppPic.url } : { W: 1000, H: 640, url: '' };

// base: the picture or street underneath - redrawn only when the horizon moves the street, or the picture changes.
function ppRender(base = true) {
  const v = ppView(), svg = el('ppSvg');
  svg.setAttribute('viewBox', `0 0 ${v.W} ${v.H}`);
  if (base) el('ppBase').innerHTML = v.url ? `<image href="${v.url}" width="${v.W}" height="${v.H}" preserveAspectRatio="none"/>` : ppSample(ppl, v.W, v.H);
  el('ppTop').innerHTML = ppTop(ppl, v.W, v.H);
  el('ppHor').value = Math.round(ppl.hor * 100); el('ppHorOut').textContent = `${Math.round(ppl.hor * 100)}% from the top`;
  el('ppFeet').value = Math.round(ppl.feet * 100); el('ppFeetOut').textContent = `${Math.round(ppl.feet * 100)}% from the top`;
  el('ppHigh').value = Math.round(ppl.high * 100); el('ppHighOut').textContent = `${Math.round(ppl.high * 100)}% of the picture`;
  if (document.activeElement !== el('ppRefM')) el('ppRefM').value = ppl.refM;
  for (const b of el('ppKind').children) b.setAttribute('aria-pressed', String(b.dataset.kind === ppl.kind));
  el('ppNote').textContent = ppNote(ppl);
  svg.setAttribute('aria-label', `People in perspective: a figure ${ppl.refM} m tall, the eye about ${ppEye(ppl).toFixed(1)} m up, ${ppl.people.length} people standing`);
}

function ppChange(patch, { base = false, save = true } = {}) {
  Object.assign(ppl, patch);
  ppClamp(ppl);
  if (save) ppSave();
  ppRender(base || ('hor' in patch && !ppPic));
}

function ppAdd(x, y) {
  if (y <= ppl.hor + 0.01) { el('ppNote').textContent = 'Above the horizon is sky: people stand on the ground, below it.'; return; }
  const k = PP_KINDS[ppl.kind];
  ppl.people = [...ppl.people.slice(-(PP_MAX_PEOPLE - 1)), { x: ppNum(x, 0.02, 0.98, 0.5), y: ppNum(y, 0, 0.99, 0.9), m: k.m, kind: ppl.kind }];
  ppl.last = ppl.people.length - 1;
  ppRender(false);
}

// Five people in a row down the ground, the near ones low and big, the far ones high and small - no pointer needed.
function ppAlong() {
  const k = PP_KINDS[ppl.kind];
  // How far down the ground (0 at the horizon, 1 at the bottom) and across: staggered, so they do not hide each other.
  const spots = [[0.14, 0.62], [0.28, 0.3], [0.5, 0.74], [0.74, 0.22], [0.97, 0.52]];
  ppl.people = spots.map(([d, x]) => ({ x, y: ppl.hor + (0.97 - ppl.hor) * d, m: k.m, kind: ppl.kind }));
  ppl.last = ppl.people.length - 1;
  ppRender(false);
}

function ppPoint(e) {
  const svg = el('ppSvg'), m = svg.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), v = ppView();
  return { x: p.x / v.W, y: p.y / v.H };
}

function ppPointerDown(e) {
  const t = e.target.closest('[data-h]'), p = ppPoint(e);
  el('ppSvg').setPointerCapture(e.pointerId);
  ppDrag = { what: t ? t.dataset.h : 'add', i: t ? +t.dataset.i : -1, moved: false, cx: e.clientX, cy: e.clientY, x: p.x, y: p.y };
  // A second press on a person soon after a click on it takes it away (a dblclick would be retargeted to
  // the svg by the pointer capture). Only a click counts as the first: a drag that ended there does not.
  if (ppDrag.what === 'p' && ppTap && ppTap.i === ppDrag.i && e.timeStamp - ppTap.t < 450) {
    ppl.people.splice(ppDrag.i, 1); ppl.last = ppl.people.length - 1; ppTap = null; ppDrag = null; ppRender(false);
  }
}
function ppPointerMove(e) {
  if (!ppDrag) return;
  if (Math.hypot(e.clientX - ppDrag.cx, e.clientY - ppDrag.cy) > 4) ppDrag.moved = true;
  if (!ppDrag.moved || ppDrag.what === 'add') return;
  const p = ppPoint(e);
  if (ppDrag.what === 'hor') ppChange({ hor: p.y }, { save: false });
  else if (ppDrag.what === 'feet') ppChange({ refX: p.x, feet: p.y }, { save: false });
  else if (ppDrag.what === 'head') ppChange({ high: ppl.feet - p.y }, { save: false });
  else if (ppDrag.what === 'p' && ppl.people[ppDrag.i]) {
    Object.assign(ppl.people[ppDrag.i], { x: ppNum(p.x, 0.02, 0.98, 0.5), y: ppNum(p.y, ppl.hor + 0.01, 0.99, 0.9) });
    ppl.last = ppDrag.i;
    ppRender(false);
  }
}
function ppPointerUp(e) {
  const d = ppDrag; ppDrag = null;
  if (!d) return;
  ppTap = d.what === 'p' && !d.moved ? { i: d.i, t: e.timeStamp } : null;
  if (d.what === 'add' && !d.moved) { const p = ppPoint(e); ppAdd(p.x, p.y); }
  else ppSave();
}

function ppUsePicture(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    if (ppPic) URL.revokeObjectURL(ppPic.url);
    ppPic = { url, w: img.naturalWidth, h: img.naturalHeight };
    ppl.people = []; ppl.last = -1;
    ppRender(true);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function ppInit() {
  ppl = ppLoad();
  el('ppKind').innerHTML = Object.entries(PP_KINDS).map(([k, v]) =>
    `<button type="button" class="chip" data-kind="${k}" title="${v.m} m tall">${v.label} ${v.m} m</button>`).join('');
  el('ppHor').addEventListener('input', () => ppChange({ hor: +el('ppHor').value / 100 }));
  el('ppFeet').addEventListener('input', () => ppChange({ feet: +el('ppFeet').value / 100 }));
  el('ppHigh').addEventListener('input', () => ppChange({ high: +el('ppHigh').value / 100 }));
  el('ppRefM').addEventListener('change', () => ppChange({ refM: +el('ppRefM').value }));
  el('ppKind').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ppChange({ kind: b.dataset.kind }); });
  el('ppAlong').addEventListener('click', ppAlong);
  el('ppClear').addEventListener('click', () => { ppl.people = []; ppl.last = -1; ppRender(false); });
  el('ppReset').addEventListener('click', () => { Object.assign(ppl, PP_DEFAULTS, { people: [], last: -1 }); ppSave(); ppRender(true); });
  el('ppPick').addEventListener('click', () => el('ppFile').click());
  el('ppFile').addEventListener('change', () => { ppUsePicture(el('ppFile').files[0]); el('ppFile').value = ''; });
  el('ppSample').addEventListener('click', () => { if (ppPic) URL.revokeObjectURL(ppPic.url); ppPic = null; ppl.people = []; ppl.last = -1; ppRender(true); });
  const svg = el('ppSvg');
  svg.addEventListener('pointerdown', ppPointerDown);
  svg.addEventListener('pointermove', ppPointerMove);
  svg.addEventListener('pointerup', ppPointerUp);
  svg.addEventListener('pointercancel', () => { ppDrag = null; });
  const stage = el('ppStage');
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => { e.preventDefault(); ppUsePicture([...e.dataTransfer.files].find(f => /^image\//.test(f.type))); });
}

// The mode switch above the two halves; called each time the view opens.
function ppShowModes() {
  if (!ppl) {
    ppInit();
    el('pgMode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) ppSetMode(b.dataset.mode); });
  }
  let mode = 'sheet';
  try { if (localStorage.getItem(PP_MODE_KEY) === 'people') mode = 'people'; } catch { /* sheet */ }
  ppSetMode(mode, false);
}

function ppSetMode(mode, save = true) {
  if (save) try { localStorage.setItem(PP_MODE_KEY, mode); } catch { /* private mode */ }
  for (const b of el('pgMode').children) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  el('pgSheetMode').classList.toggle('hidden', mode !== 'sheet');
  el('pgPeopleMode').classList.toggle('hidden', mode !== 'people');
  if (mode === 'people') ppRender(true);
}
