/* refboard - Seasons and times of day: ready palettes for a landscape.
   Spring, summer, autumn, winter, and morning, noon, dusk, fog - six colours
   each, in the palette generator (Prepare > Palette), to start a landscape
   from rather than from a blank row of colours.

   What makes a season or an hour is not a hue but the pair of value range and
   colour: noon has the widest range and the bluest sky; fog the narrowest and
   the least colour; dusk is dark almost everywhere with one warm band at the
   horizon; winter is cool and quiet with one warm thing (bark, a roof) to
   make the cold read. Each scene's colours are hand-chosen to say that and
   no more, and each comes with what to do with it.

   A scene is taken like a picture's palette (palgenTake): the colours replace
   the row, Undo brings the row back, and the mixing recipes under each colour
   are for the paints chosen below. With "Only what my paints mix" on, the
   colours are first pulled in to what those paints can reach, their value kept.
   Loaded with palette.js (loadSection('palette')). */
"use strict";

const SEASONS = [
  { id: 'spring', label: 'Spring', hex: ['#3f7a46', '#8fc46a', '#cfe58f', '#f3c4cf', '#9cc7e6', '#f1f3dc'],
    how: 'Fresh yellow-greens, a high key, and one soft pink or white for blossom. Keep the greens yellow and light - a dark, blue green says summer - and leave the paper for the blossom.' },
  { id: 'summer', label: 'Summer', hex: ['#2f6a3a', '#6fa84a', '#e8c94a', '#4a90c8', '#b9dff2', '#7a5a3a'],
    how: 'Deep, full greens against a blue sky, with strong value contrast: sunlit leaves against dark shade. Vary the greens - a warm yellow-green in light, a cool blue-green in shadow - or they go flat.' },
  { id: 'autumn', label: 'Autumn', hex: ['#4a3a22', '#7a2e17', '#c8561e', '#e5a23a', '#8a6a2a', '#f0dcae'],
    how: 'Warm throughout: rust, orange and gold, in a low, golden light. The darks are brown, not black. Keep a little green or blue somewhere, so the oranges have something to glow against.' },
  { id: 'winter', label: 'Winter', hex: ['#2c3a52', '#5f7390', '#a9b8cc', '#e3e9f0', '#f7f9fb', '#6b4f3f'],
    how: 'Snow is not white: in shadow it is blue-violet, in sun a warm cream. The whole palette is cool and close in value; one warm note - a bark, a roof, a coat - makes the cold read.' },
  { id: 'morning', label: 'Morning', hex: ['#4f6f8f', '#7fa8c9', '#b9a6c9', '#f0a98a', '#f6d6b0', '#fdf1d8'],
    how: 'Low sun and a hazy, rosy light: warm lights, cool lilac shadows, and distant hills fading to blue. Wet-in-wet suits it - the edges are soft until the sun is up.' },
  { id: 'noon', label: 'Noon', hex: ['#2a4f33', '#5aa05a', '#d8b45a', '#2c7bbf', '#9fd0ee', '#f5f0d8'],
    how: 'The sun overhead: the widest range of the day, short, dark shadows, saturated colour, and a deep blue sky that pales toward the horizon. Contrast does the work - keep the lights clean.' },
  { id: 'dusk', label: 'Dusk', hex: ['#1a1d36', '#2a2f5e', '#5a4a85', '#b8527a', '#f08a5a', '#f6c06a'],
    how: 'Dark almost everywhere, with the colour in one band at the horizon, fading up through magenta and violet to indigo. Silhouettes against the glow: keep their edges simple and their insides dark.' },
  { id: 'fog', label: 'Fog', hex: ['#66767b', '#6f7a80', '#9aa5aa', '#bcc5c8', '#d8dedf', '#eef1f1'],
    how: 'Almost no colour and a narrow range: the nearest thing is darkest and each layer behind it is lighter and greyer. The lightest light is not white. Paint wet-in-wet, and lose the edges as the distance grows.' },
];

const seasonRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// The scene's colours, ready to give to the palette: pulled in to the paints' reach if that is switched on.
function seasonColours(id, fit) {
  const s = SEASONS.find(x => x.id === id);
  if (!s) return null;
  return s.hex.map(h => fit ? palgenFit(seasonRgb(h)) : seasonRgb(h));
}

/* How a scene's colours spread: the value range (L*) and the mean chroma
   (OKLCH) - the two numbers a season or an hour is made of. */
function seasonSpread(id) {
  const rgbs = SEASONS.find(x => x.id === id).hex.map(seasonRgb), L = rgbs.map(lstar);
  return { range: Math.max(...L) - Math.min(...L), chroma: rgbs.reduce((a, c) => a + rgbOklch(c)[1], 0) / rgbs.length };
}

function seasonsRender() {
  el('pgSeasons').innerHTML = SEASONS.map(s =>
    `<button type="button" class="chip pg-season" data-season="${s.id}" aria-pressed="false" title="${esc(s.how)}">` +
    `<span class="pg-dots">${s.hex.map(h => `<i style="background:${h}"></i>`).join('')}</span>${s.label}</button>`).join('');
}

// Which scene is in the row (palgenSet clears pg.scene, a change of any kind), and its advice.
function seasonsSync() {
  const id = pg && pg.scene, s = SEASONS.find(x => x.id === id);
  for (const b of el('pgSeasons').children) b.setAttribute('aria-pressed', String(b.dataset.season === id));
  el('pgSeasonHint').textContent = s ? s.how : 'Six colours to start a landscape from. Undo brings your own back.';
}

function seasonsTake(id) {
  if (!pg) initPalette();
  palgenTake(seasonColours(id, pg.fit));
  pg.scene = id;
  seasonsSync();
}

seasonsRender();
el('pgSeasons').addEventListener('click', e => {
  const b = e.target.closest('[data-season]');
  if (b) seasonsTake(b.dataset.season);
});
seasonsSync();
