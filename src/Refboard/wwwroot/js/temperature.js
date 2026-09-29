/* refboard - Temperature map: over the picture, which areas are warm and
   which cool, and the lines where the temperature turns - most often
   between the light and the shadow. A painter mixes a shadow cooler (or
   warmer) than its light, not only darker; this shows which way the
   reference does it.

   Temperature here is the colour projected onto the orange-blue axis of
   OKLab (hue 60 degrees warm, 240 cool): an orange is far to the warm end,
   a sky blue far to the cool one, a grey on neither. Green and violet fall
   near the middle - they are warm or cool by their neighbours, which is
   how painters see them too.

   And it is relative: a picture under lamplight is warm all over, which
   says little about how to mix it. So each area is measured against the
   picture's own middle - the map is the warm and cool within its light -
   and the overall cast goes in the note, as a sentence.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const TEMP_WARM = [255, 150, 40], TEMP_COOL = [60, 150, 255];
const TEMP_AXIS = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
// In OKLab x 100 along the axis: less than this from the median is neutral;
// this much or more is drawn at full strength. A strong orange is about 15.
const TEMP_MIN = 1.5, TEMP_FULL = 10;
// The whole picture leaning more than this is a warm or a cool light.
const TEMP_CAST = 3;

// sRGB 0-255 to linear, once for every value.
const TEMP_LIN = Float32Array.from({ length: 256 }, (_, v) => srgbToLin(v / 255));

/* p: stepsRead(). rel: per pixel, the temperature against the middle, over
   areas rather than pixels; turn: 1 on a line where warm meets cool. The
   shares are of the whole picture, in percent; light and shadow are the
   mean temperature of each side of the value split. */
function tempMap(p) {
  const { w, h, rgba, L } = p, n = w * h;
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [, a, b] = linToOklab(TEMP_LIN[rgba[4 * i]], TEMP_LIN[rgba[4 * i + 1]], TEMP_LIN[rgba[4 * i + 2]]);
    t[i] = (a * TEMP_AXIS[0] + b * TEMP_AXIS[1]) * 100;
  }
  // The middle half's mean, not the median: as deaf to a small bright patch,
  // but a picture half warm and half cool gets the point between the two -
  // its median would be one of them, and that half would read as neutral.
  const sorted = Float32Array.from(t).sort();
  let cast = 0;
  for (let i = n >> 2; i < n - (n >> 2); i++) cast += sorted[i];
  cast /= n - 2 * (n >> 2);
  // Areas, not pixels: a painter reads the temperature of a patch.
  const r = Math.max(1, Math.max(w, h) / 100);
  const rel = stepsBlur(t, w, h, r);
  for (let i = 0; i < n; i++) rel[i] -= cast;

  // A turn is where the sign changes with a warm area on one side and a
  // cool one on the other, a short way off - not a grey wobbling round
  // nothing. Not how steep the change is: a soft terminator is a slow turn,
  // and the one most worth seeing.
  const R = Math.max(4, Math.round(Math.max(w, h) / 25)), turn = new Uint8Array(n);
  const around = [-R, 0, R].flatMap(dy => [-R, 0, R].filter(dx => dx || dy).map(dx => dy * w + dx));
  for (let y = R; y < h - R; y++) {
    for (let x = R; x < w - R; x++) {
      const i = y * w + x, v = rel[i];
      if ((v > 0) === (rel[i + 1] > 0) && (v > 0) === (rel[i + w] > 0)) continue;
      let hi = -Infinity, lo = Infinity;
      for (const o of around) { const u = rel[i + o]; if (u > hi) hi = u; if (u < lo) lo = u; }
      if (hi >= TEMP_MIN && lo <= -TEMP_MIN) turn[i] = 1;
    }
  }

  // Light and shadow: the value split a painter makes first.
  const split = stepsOtsu(L);
  let warm = 0, cool = 0, sl = 0, nl = 0, ss = 0, ns = 0;
  for (let i = 0; i < n; i++) {
    if (rel[i] >= TEMP_MIN) warm++; else if (rel[i] <= -TEMP_MIN) cool++;
    if (L[i] >= split) { sl += rel[i]; nl++; } else { ss += rel[i]; ns++; }
  }
  return { w, h, rel, turn, cast, warm: warm / n * 100, cool: cool / n * 100,
    light: nl ? sl / nl : 0, shadow: ns ? ss / ns : 0, lightShare: nl / n * 100 };
}

// The map onto a canvas of the picture's size (the page scales it): a tint
// as strong as the temperature, and the turns as white lines, two pixels
// thick so they read when the picture is shown larger.
function tempDraw(m, c) {
  c.width = m.w; c.height = m.h;
  const img = new ImageData(m.w, m.h), d = img.data, t = m.turn;
  for (let i = 0; i < m.rel.length; i++) {
    const v = m.rel[i];
    if (t[i] || (i % m.w && t[i - 1]) || t[i - m.w]) { d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = 255; d[4 * i + 3] = 230; continue; }
    const a = Math.abs(v);
    if (a < TEMP_MIN) continue;
    const col = v > 0 ? TEMP_WARM : TEMP_COOL;
    d[4 * i] = col[0]; d[4 * i + 1] = col[1]; d[4 * i + 2] = col[2];
    d[4 * i + 3] = Math.round(40 + 130 * Math.min(1, (a - TEMP_MIN) / (TEMP_FULL - TEMP_MIN)));
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

/* What the map says: the light's cast, then light against shadow - the
   thing to decide before mixing - in the medium's own terms. paint:
   MATERIALS' paint ('water', 'opaque', or null for ink and graphite). */
function tempVerdict(m, paint = 'water') {
  const out = [];
  if (m.cast >= TEMP_CAST) out.push('The whole picture leans <b class="temp-w">warm</b> - a warm light (sun low, a lamp). The map shows the warm and cool within it.');
  else if (m.cast <= -TEMP_CAST) out.push('The whole picture leans <b class="temp-c">cool</b> - a cool light (sky, shade, a window). The map shows the warm and cool within it.');

  const diff = m.light - m.shadow;
  const how = {
    water: ['a thin warm wash (a yellow or an orange) under the lights', 'the shadows glazed cooler, with a blue, once the first wash is dry'],
    opaque: ['the lights mixed warmer', 'the shadows mixed cooler, with a blue - not with black'],
  }[paint];
  if (diff >= TEMP_MIN) {
    out.push('<b class="temp-w">Warm light</b>, <b class="temp-c">cool shadow</b> - the sunlit look. For cel shading: the shadow tone shifts toward blue or violet, not only darker.' +
      (how ? ` In paint: ${how[0]}, ${how[1]}.` : ''));
  } else if (diff <= -TEMP_MIN) {
    out.push('<b class="temp-c">Cool light</b>, <b class="temp-w">warm shadow</b> - sky or window light, with warm light bounced into the shadows. For cel shading: the shadow tone shifts toward red or orange.' +
      (how ? ` In paint: the reverse - lights cooled, shadows warmed.` : ''));
  } else {
    out.push('Light and shadow are about the same temperature - the form turns by value alone. Pushing the shadows a little cooler (or warmer) would make it turn more.');
  }
  if (!how) out.push('Your medium is one colour, so the temperature is not painted - but the white lines are where a form turns: worth a change of line or hatching there.');
  return out.join('<br>');
}

/* ---- in a session: the map over the picture, as a layer. */
let tempRun = 0;

function clearTemp() {
  tempRun++;
  el('tempOverlay').classList.add('hidden');
  overlayNote('temp', state.tempOn ? 'Reading the temperature...' : '');
}

function toggleTemp() {
  state.tempOn = !state.tempOn;
  el('btnTemp').setAttribute('aria-pressed', String(state.tempOn));
  clearTemp();
  if (state.tempOn) runTemp();
}

// A moment's work, so after a frame: the button shows pressed first.
function runTemp() {
  const img = el('img'), run = ++tempRun;
  if (!img.naturalWidth) return;
  setTimeout(() => {
    if (run !== tempRun || !state.tempOn) return;
    let m;
    try { m = tempMap(stepsRead(img)); }
    catch (err) { console.error('temperature:', err); overlayNote('temp', '<i>Could not read the temperature of this picture.</i>'); return; }
    tempDraw(m, el('tempOverlay')).classList.remove('hidden');
    overlayNote('temp', `<b class="temp-w">Orange</b> - warmer than the picture as a whole. <b class="temp-c">Blue</b> - cooler. ` +
      `<b class="temp-t">White lines</b> - where it turns.<br>${tempVerdict(m, mainMaterial()?.paint ?? 'water')}`);
  }, 30);
}

el('btnTemp').addEventListener('click', toggleTemp);
// The advice is in the medium's terms.
document.addEventListener('refboard:materials', () => { if (state.tempOn) runTemp(); });
