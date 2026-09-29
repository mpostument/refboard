/* refboard - What the paper can do: a photo goes from black to white, a
   painting only from the darkest mix to the paper. Everything in the photo
   darker than your darkest mix comes out as that one dark; everything
   lighter than the paper is the paper. So detail down in the shadows or up
   in the lights is lost - unless the painter simplifies it on purpose.

   Two ends, both in L* (0-100, what stepsRead() gives):
     - the paper is not white - about 95 for a good cotton paper - so a photo
       lighter than that is bare paper, whatever it shows;
     - the darkest a medium goes (`floor` in MATERIALS, js/materials.js) -
       thick watercolour about 18, a liner's solid black about 10.
   Those are round figures for a typical set, not a measurement of yours.

   Only a clipped area with something in it is a loss: a black background
   loses nothing by going to the darkest mix. So each clipped pixel is
   told by its neighbourhood - the spread of L* within a few pixels - and
   the map shows the two apart, the lost detail strong and the flat mass
   faint.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const RANGE_PAPER = 95;
const RANGE_DARK = [110, 80, 255], RANGE_LIGHT = [255, 190, 40];
// Spread of L*, in a small window, that is "something there" rather than a
// flat area or sensor noise (a dark JPEG's is about 1). Not blurred first: the
// blur would average a fine texture into the flat.
const RANGE_DETAIL = 2;

/* p: stepsRead(). kind, per pixel: 0 inside the range, 1 a dark that will
   merge, 2 a flat dark, 3 a light that will go bare, 4 a flat light. The
   figures are shares of the whole picture, in percent. */
function rangeMap(p, floor, paper = RANGE_PAPER) {
  const { w, h } = p, n = w * h;
  const L = p.L;
  // The spread from integral images of L and L*L: no per-pixel window loop.
  const W = w + 1, s1 = new Float64Array(W * (h + 1)), s2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let a = 0, b = 0;
    for (let x = 0; x < w; x++) {
      const v = L[y * w + x];
      a += v; b += v * v;
      s1[(y + 1) * W + x + 1] = s1[y * W + x + 1] + a;
      s2[(y + 1) * W + x + 1] = s2[y * W + x + 1] + b;
    }
  }
  const box = (s, x0, y0, x1, y1) => s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0];
  const kind = new Uint8Array(n), count = [0, 0, 0, 0, 0];
  // A window a fiftieth of the picture across: wide enough to see a shadow
  // modelled by a slow gradient, not only by a texture.
  const r = Math.max(3, Math.round(Math.max(w, h) / 50));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, v = p.L[i];
      const dark = v < floor, light = v > paper;
      if (dark || light) {
        const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(w, x + r + 1), y1 = Math.min(h, y + r + 1);
        const m = (x1 - x0) * (y1 - y0), mean = box(s1, x0, y0, x1, y1) / m;
        const sd = Math.sqrt(Math.max(0, box(s2, x0, y0, x1, y1) / m - mean * mean));
        kind[i] = (dark ? 1 : 3) + (sd >= RANGE_DETAIL ? 0 : 1);
      }
      count[kind[i]]++;
    }
  }
  const pct = k => count[k] / n * 100;
  return { w, h, kind, floor, paper, dark: pct(1) + pct(2), darkLost: pct(1), light: pct(3) + pct(4), lightLost: pct(3) };
}

// The map onto a canvas of the picture's size (the page scales it).
function rangeDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const img = new ImageData(m.w, m.h), d = img.data;
  for (let i = 0; i < m.kind.length; i++) {
    const k = m.kind[i];
    if (!k) continue;
    const col = k < 3 ? RANGE_DARK : RANGE_LIGHT;
    d[4 * i] = col[0]; d[4 * i + 1] = col[1]; d[4 * i + 2] = col[2];
    d[4 * i + 3] = k % 2 ? 170 : 55;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

const rangeShare = v => v < 1 ? '<1%' : Math.round(v) + '%';

// What the map says, in the medium's own ladder: its darkest step and its paper.
function rangeVerdict(m, medium = mainMaterial()) {
  const darkest = medium.tones[medium.tones.length - 1], paper = medium.tones[0];
  const out = [];
  if (m.darkLost >= 1)
    out.push(`<b class="range-d">${rangeShare(m.darkLost)}</b> is shadow with detail that ${esc(medium.label.toLowerCase())} cannot hold - it all becomes one dark (${esc(darkest)}). Paint it as one shape, or lighten it in your mind first.`);
  if (m.lightLost >= 1)
    out.push(`<b class="range-l">${rangeShare(m.lightLost)}</b> is light with detail that the paper is too grey to keep apart - leave it bare (${esc(paper)}), or cover the small ones.`);
  if (!out.length) out.push('Nothing here the paper cannot say: the darks and the lights stay inside the range, or are flat masses that lose nothing.');
  return out.join('<br>');
}

/* ---- in a session: the map over the picture, as a layer. */
let rangeRun = 0;

function clearRange() {
  rangeRun++;
  el('rangeOverlay').classList.add('hidden');
  overlayNote('range', state.rangeOn ? 'Measuring the range...' : '');
}

function toggleRange() {
  state.rangeOn = !state.rangeOn;
  el('btnRange').setAttribute('aria-pressed', String(state.rangeOn));
  clearRange();
  if (state.rangeOn) runRange();
}

// A moment's work, so after a frame: the button shows pressed first.
function runRange() {
  const img = el('img'), run = ++rangeRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== rangeRun || !state.rangeOn) return;
    let m;
    const medium = mainMaterial();
    try { m = rangeMap(stepsRead(img), medium.floor); }
    catch (err) { console.error('range:', err); overlayNote('range', '<i>Could not read the range of this picture.</i>'); return; }
    rangeDraw(m, el('rangeOverlay')).classList.remove('hidden');
    overlayNote('range', `<b>${esc(medium.label)}</b> goes from L* ${medium.floor} to the paper's ${m.paper}. ` +
      `<b class="range-d">Violet</b> - darker than that. <b class="range-l">Amber</b> - lighter. Strong where something is lost, faint where it is flat.<br>${rangeVerdict(m, medium)}`);
  }, 30);
}

el('btnRange').addEventListener('click', toggleRange);
// Another medium is another range.
document.addEventListener('refboard:materials', () => { if (state.rangeOn) runRange(); });
