/* refboard - Toned paper: on grey, tan or black paper the paper is the
   middle tone, so a drawing is not built from white up but from the paper
   outwards: darks go on, lights go on, and what sits at the paper's own
   value is simply left. The map shows which is which.

   Four zones, by the picture's L* (0-100, what stepsRead() gives) against the
   paper's:
     - paper    within a few steps of the paper's own value: leave it bare;
     - dark     below that: the pencil, ink or dark paint;
     - light    above it: white pencil, white gouache, white pastel;
     - highlight  the top of the light, where it is brightest: a gel pen or a
                dot of gouache, the one touch of white that makes the picture
                sparkle.
   On a black paper there is no dark to add - the paper is the darkest - so
   everything is light or highlight; on a pale paper the light zone is thin.

   The picture is blurred a little first (a box of a few pixels): a grain of
   noise or a hair-thin line must not turn a whole area into confetti.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const TONE_KEY = 'refboard.tonedPaper.v1';
// Papers as sold: a mid grey, a warm tan, a black. `hex` is a typical sheet.
const TONE_PAPERS = {
  grey:  { label: 'Grey',  hex: '#8f8f8f' },
  tan:   { label: 'Tan',   hex: '#b9a487' },
  black: { label: 'Black', hex: '#1c1c1c' },
};
// How far from the paper's value still counts as the paper: a few steps of L*
// either way, since a pencil cannot tell two values that close apart anyway.
const TONE_BAND = 9;
// Below this a paper has no room for a dark to be added; above this, no
// room for a light - a toned paper outside it is a white or black paper.
const TONE_MIN = 6, TONE_MAX = 88;
// Overlay colours, [r, g, b]: the dark violet of the paper's range, a faint
// green where the paper is left alone, amber for the white pencil and pink for
// the one white dot - strong where it is small.
const TONE_COLORS = [[60, 200, 120], [90, 70, 230], [255, 200, 60], [255, 70, 190]];
const TONE_ALPHA = [40, 150, 130, 190];

const TONE_NAMES = ['paper', 'dark', 'light', 'highlight'];

// L* of a #rrggbb: the same sums stepsRead() does for a pixel.
function toneLOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const Y = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}

// The chosen paper: a name from TONE_PAPERS, or 'custom' with its own colour.
function toneLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(TONE_KEY));
    if (v && (TONE_PAPERS[v.paper] || (v.paper === 'custom' && /^#[0-9a-f]{6}$/i.test(v.hex))))
      return { paper: v.paper, hex: v.paper === 'custom' ? v.hex.toLowerCase() : TONE_PAPERS[v.paper].hex };
  } catch { /* fall through */ }
  return { paper: 'grey', hex: TONE_PAPERS.grey.hex };
}
function toneSave(t) {
  try { localStorage.setItem(TONE_KEY, JSON.stringify(t)); } catch { /* private mode */ }
}

/* p: stepsRead(). paperL: the paper's L*. kind, per pixel: 0 paper, 1 dark,
   2 light, 3 highlight. share: the four, in percent of the picture. median is
   the picture's middle value - which paper would leave most of it alone. */
function toneMap(p, paperL) {
  const { w, h } = p, n = w * h, paper = Math.max(TONE_MIN, Math.min(TONE_MAX, paperL));
  // A box blur from the integral image: no per-pixel window loop.
  const W = w + 1, s = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let a = 0;
    for (let x = 0; x < w; x++) { a += p.L[y * w + x]; s[(y + 1) * W + x + 1] = s[y * W + x + 1] + a; }
  }
  const r = Math.max(1, Math.round(Math.max(w, h) / 160));
  // The top of the light: 70% of the way from the paper's band to white.
  const hi = paper + TONE_BAND + (100 - paper - TONE_BAND) * 0.7;
  const kind = new Uint8Array(n), count = [0, 0, 0, 0], hist = new Uint32Array(101);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const v = (s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
      const k = v < paper - TONE_BAND ? 1 : v <= paper + TONE_BAND ? 0 : v < hi ? 2 : 3;
      kind[y * w + x] = k; count[k]++;
      hist[Math.max(0, Math.min(100, Math.round(v)))]++;
    }
  }
  let acc = 0, median = 0;
  while (median < 100 && (acc += hist[median]) < n / 2) median++;
  return { w, h, kind, paper, median, share: count.map(c => c / n * 100) };
}

// The map onto a canvas of the picture's size (the page scales it).
function toneDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const img = new ImageData(m.w, m.h), d = img.data;
  for (let i = 0; i < m.kind.length; i++) {
    const k = m.kind[i], col = TONE_COLORS[k];
    d[4 * i] = col[0]; d[4 * i + 1] = col[1]; d[4 * i + 2] = col[2]; d[4 * i + 3] = TONE_ALPHA[k];
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

const toneShare = v => v < 1 ? '<1%' : Math.round(v) + '%';

// What goes on for the white, in the medium you use - watercolour is transparent
// and cannot go lighter than its paper, so its white is body colour.
function toneWhite(key = materialsProfile().main) {
  return { watercolour: 'white gouache', opaque: 'white paint', inkWash: 'white gouache or a white gel pen',
    wcPencil: 'a white pencil', wcMarker: 'a white gel pen or gouache' }[key] || 'a white pencil or gel pen';
}
function toneDarkest(key = materialsProfile().main) {
  return { watercolour: 'a strong wash', opaque: 'dark paint', inkWash: 'ink', liner: 'hatching',
    ballpoint: 'firm pressure', graphite: 'a soft pencil, 4B-8B' }[key] || 'the darkest layers';
}

// Of the papers, the one nearest the picture's middle value: the one that
// leaves the most of it to do nothing.
function toneBestPaper(median) {
  return Object.entries(TONE_PAPERS).map(([k, v]) => [k, Math.abs(toneLOf(v.hex) - median)]).sort((a, b) => a[1] - b[1])[0][0];
}

function toneVerdict(m, t) {
  const [paper, dark, light, hl] = m.share, out = [], white = toneWhite();
  out.push(`<b class="tone-p">${toneShare(paper)}</b> is the paper's own tone - leave it bare. Resist filling it: it is what holds the picture together.`);
  if (dark >= 1) out.push(`<b class="tone-d">${toneShare(dark)}</b> is darker: ${esc(toneDarkest())}.`);
  else if (m.paper < 20) out.push('The paper is the darkest of the picture: there is nothing to darken - only lights to add.');
  if (light >= 1) out.push(`<b class="tone-l">${toneShare(light)}</b> is lighter: ${esc(white)}.`);
  if (hl >= 1) out.push(`<b class="tone-h">${toneShare(hl)}</b> is the brightest: a few touches of ${esc(white)} - fewer than it feels like.`);
  const best = toneBestPaper(m.median);
  if (best !== t.paper && t.paper !== 'custom')
    out.push(`This picture sits around L* ${Math.round(m.median)}: <button type="button" class="linkish" data-tone-paper="${best}">${TONE_PAPERS[best].label.toLowerCase()} paper</button> would leave more of it alone.`);
  return out.join('<br>');
}

// The paper chips and the colour input, then the verdict.
function toneNote(m, t) {
  const chips = Object.entries(TONE_PAPERS).map(([k, v]) =>
    `<button type="button" class="chip" data-tone-paper="${k}" aria-pressed="${t.paper === k}"><i class="tone-sw" style="background:${v.hex}"></i>${v.label}</button>`).join('');
  return `<div class="tone-bar"><span>Paper</span>${chips}` +
    `<label class="tone-own" title="A paper of your own, as it looks in daylight"><input type="color" data-tone-own value="${t.hex}" aria-label="Your paper's colour"></label></div>` +
    `<b class="tone-p">Green</b> - the paper, left. <b class="range-d">Violet</b> - darker. <b class="tone-l">Amber</b> - lighter. <b class="tone-h">Pink</b> - the brightest.<br>` +
    toneVerdict(m, t);
}

/* ---- in a session: the map over the picture, as a layer. */
let toneRun = 0;

function clearTone() {
  toneRun++;
  el('toneOverlay').classList.add('hidden');
  overlayNote('tone', state.toneOn ? 'Reading the paper...' : '');
}

function toggleTone() {
  state.toneOn = !state.toneOn;
  el('btnTone').setAttribute('aria-pressed', String(state.toneOn));
  clearTone();
  if (state.toneOn) runTone();
}

// A moment's work, so after a frame: the button shows pressed first.
function runTone() {
  const img = el('img'), run = ++toneRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== toneRun || !state.toneOn) return;
    let m;
    const t = toneLoad();
    try { m = toneMap(stepsRead(img), toneLOf(t.hex)); }
    catch (err) { console.error('tone:', err); overlayNote('tone', '<i>Could not read the tones of this picture.</i>'); return; }
    toneDraw(m, el('toneOverlay')).classList.remove('hidden');
    overlayNote('tone', toneNote(m, t));
  }, 30);
}

el('btnTone').addEventListener('click', toggleTone);
// The note holds the controls: a paper chip, or the colour input. The stage
// under it pans on a press (vision.js stops that for buttons) - the colour
// input's press is its own too, or its picker never opens.
el('poseNote').addEventListener('pointerdown', e => { if (e.target.closest('[data-tone-own]')) e.stopPropagation(); });
el('poseNote').addEventListener('click', e => {
  const b = e.target.closest('[data-tone-paper]');
  if (!b || !TONE_PAPERS[b.dataset.tonePaper]) return;
  toneSave({ paper: b.dataset.tonePaper, hex: TONE_PAPERS[b.dataset.tonePaper].hex });
  runTone();
});
el('poseNote').addEventListener('change', e => {
  if (!e.target.matches('[data-tone-own]')) return;
  toneSave({ paper: 'custom', hex: e.target.value });
  runTone();
});
// The advice is for the medium you have.
document.addEventListener('refboard:materials', () => { if (state.toneOn) runTone(); });
