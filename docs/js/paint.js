/* refboard - Paint: real pigments, how they mix, and recipes for a colour.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---- mixing real paint. A colour on screen is light added up; paint is
   light taken away - every pigment absorbs some of every wavelength, and a
   mixture absorbs what all of its pigments do. That is why blue and yellow
   paint make green although blue and yellow light make grey: yellow keeps
   the greens and reds, blue keeps the greens and blues, and green is the one
   band both let through. Three RGB numbers cannot know that; a spectrum can.

   So each pigment is a reflectance curve over 38 bands of the visible
   spectrum, rebuilt from its colour by spectral.js (js/vendor/, MIT - Ronald
   van Wijnen), and mixed with Kubelka-Munk theory: per band, K/S (absorption
   over scattering) of the mixture is the concentration-weighted average of
   the pigments' K/S, and K/S back to reflectance is 1 + KS - sqrt(KS² + 2KS).

   Concentration is parts x tinting strength x sqrt(luminance). Tinting
   strength is the pigment's own (phthalos are famously strong - a speck
   turns a pile of white blue); the luminance term is spectral.js's own
   correction, softened to its square root, that stops a dark pigment's
   enormous K/S swamping everything: without it one part ultramarine to
   three of lemon comes out blue-grey rather than green, with all of it six
   parts white to one of ultramarine comes out nearly white. The square root
   was checked against mixtures every painter knows (lemon + ultramarine
   green, burnt sienna + ultramarine neutral, ochre + black olive, white +
   cadmium red salmon).

   Watercolour is another medium, and another model. There is no white: a
   wash is a transparent film on white paper, and light goes through it,
   off the paper, and back through it. That is the Beer-Lambert law -
   absorbances add - so per band R = paper x exp(-s x sum(w_i x A_i)), where
   A_i is how much pigment i absorbs at full strength (worked out from its
   colour on the paper, -ln(masstone / paper)), w_i its share of the mix,
   and s the strength of the wash: 1 barely diluted, 0.1 a pale tint.
   Lighter means more water, never white paint; white means the paper.

   It is still a model. Real tubes differ by brand, and screens by
   calibration: what this gives is the right pigments in about the right
   proportions - a place to start mixing, then judge by eye. */

// Masstone colours (straight from the tube, thinly spread), and tinting
// strength relative to an average pigment.
//
// Then what the Pigment guide (js/pigments.js) and the recipes' notes say
// of each - for the usual pigment sold under the name, its Colour Index
// code (ci) being what to look for on a tube, since names are marketing:
//   op     opacity, 0 transparent, 1 hides the layer under it at full
//          strength - from manufacturers' transparency ratings; the Glazing
//          tab's veil is worked out from it;
//   stain  0 lifts off with a damp brush, 1 partly, 2 stains - the paper
//          keeps it;
//   gran   0 a smooth wash, 1 a little texture, 2 granulates - the
//          particles settle into the paper's grain;
//   lf     lightfastness, the ASTM grade: I excellent, II very good, III
//          fades - in pale washes first, which is how skin and sky use it;
//   body   an opaque white: in watercolour it is not mixed with, only laid
//          on last, so the mixing tools leave it out.
// Staining and granulation are watercolour's business: in oil the paint
// sits on top and neither shows.
const PIGMENTS = {
  white:        { name: 'Titanium white',   hex: '#f4f4f0', ts: 1,   ci: 'PW6',    op: 0.9,  stain: 0, gran: 0, lf: 'I', body: true,
    note: "In oil, the paint every light mix needs. In watercolour it is body colour - it turns any colour chalky and opaque; the watercolourist's white is the paper." },
  lemon:        { name: 'Lemon yellow',     hex: '#f3e23a', ts: 0.9, ci: 'PY3',    op: 0.3,  stain: 1, gran: 0, lf: 'II',
    note: 'A cool, clean yellow: with ultramarine or phthalo blue, the brightest greens. The classic Hansa lemon fades a little in pale washes - one sold as PY175 or PY154 keeps better.' },
  cadYellow:    { name: 'Cadmium yellow',   hex: '#f7b50a', ts: 1,   ci: 'PY35',   op: 0.55, stain: 0, gran: 0, lf: 'I',
    note: 'Warm and opaque: a bright, flat wash that covers. Lay it early - glazed over a dark it goes chalky.' },
  ochre:        { name: 'Yellow ochre',     hex: '#c28d31', ts: 0.6, ci: 'PY43',   op: 0.45, stain: 0, gran: 1, lf: 'I',
    note: 'A natural earth, soft and semi-opaque, and easy to lift. With a red, most of skin; with a blue, quiet greens that go chalky if overworked.' },
  cadRed:       { name: 'Cadmium red',      hex: '#d2331f', ts: 1,   ci: 'PR108',  op: 0.55, stain: 0, gran: 1, lf: 'I',
    note: 'An opaque warm red: bright on its own, heavy in a glaze. For a transparent red to glaze with, a pyrrole (PR254) or a quinacridone.' },
  alizarin:     { name: 'Alizarin crimson', hex: '#7b1b2d', ts: 1,   ci: 'PR83',   op: 0.05, stain: 2, gran: 0, lf: 'III',
    note: 'Deep, cool, transparent - and it stains. The traditional pigment fades in pale washes, just the way skin and sky use it: permanent alizarin (PR177) or quinacridone rose (PV19) mixes the same and keeps.' },
  sienna:       { name: 'Burnt sienna',     hex: '#8a3d20', ts: 0.8, ci: 'PBr7',   op: 0.12, stain: 1, gran: 1, lf: 'I',
    note: 'A transparent earth that glows in a glaze. With ultramarine, the painters\' greys and darks; with ochre, warm skin shadows.' },
  umber:        { name: 'Burnt umber',      hex: '#4b3224', ts: 0.9, ci: 'PBr7',   op: 0.2,  stain: 0, gran: 1, lf: 'I',
    note: 'A dark, semi-transparent earth with a little texture: wood, earth, dark hair. A dark with more life in it is sienna and ultramarine.' },
  ultramarine:  { name: 'Ultramarine blue', hex: '#27318c', ts: 1,   ci: 'PB29',   op: 0.1,  stain: 0, gran: 2, lf: 'I',
    note: "The watercolourist's blue: skies, and with burnt sienna the classic greys and darks. A cloud is a damp tissue pressed into a wet wash of it." },
  phthaloBlue:  { name: 'Phthalo blue',     hex: '#10295f', ts: 3,   ci: 'PB15',   op: 0.03, stain: 2, gran: 0, lf: 'I',
    note: 'A touch goes a long way - mix it pale. With lemon, clean bright greens; with burnt sienna, deep greens and near-blacks. The clear blue of an anime sky.' },
  phthaloGreen: { name: 'Phthalo green',    hex: '#0b4a3d', ts: 2.5, ci: 'PG7',    op: 0.03, stain: 2, gran: 0, lf: 'I',
    note: 'As strong and staining as phthalo blue. Alone a harsh green - knock it back with a red or burnt sienna for leaves.' },
  violet:       { name: 'Dioxazine violet', hex: '#36205a', ts: 1.5, ci: 'PV23',   op: 0.06, stain: 2, gran: 0, lf: 'II',
    note: 'Strong, transparent and staining: a glaze of it cools and deepens a shadow. Lightfastness varies by brand - sound in a rich wash, weaker in a pale one.' },
  black:        { name: 'Ivory black',      hex: '#1e1d1c', ts: 1.2, ci: 'PBk9',   op: 0.4,  stain: 0, gran: 1, lf: 'I',
    note: 'Semi-opaque, a little grainy; it greys a colour flat. In Zorn\'s palette it plays the blue. For watercolour shadows a mixed dark - sienna and ultramarine - stays alive.' },
};

/* The tubes of one real box - Holbein Artists' Watercolor, the anime set - each
   its own entry, so recipes read in the words on the tube ("Ultramarine
   Deep", not "Ultramarine blue"). `tube` is where it sits in the box (pos,
   row.column), its Holbein code, and what the painter bought it for. Only
   the paints Holbein's own chart confirmed carry a Colour Index code (`ci`);
   the colours and ratings are estimates from the usual pigment under each
   name - painted swatches from the real tubes will correct them. */
const PIG_BOX_ROWS = 4, PIG_BOX_COLS = 7;
Object.assign(PIGMENTS, {
  hLemon:      { name: 'Permanent Yellow Lemon', hex: '#f3e63f', ts: 0.9, ci: '',          op: 0.2,  stain: 1, gran: 0, lf: 'II',
    tube: { pos: '1.1', code: 'W035', role: 'Cool light, fresh greens' },
    note: 'A cool, clean yellow: the light end of the box, and the base of fresh greens with a blue.' },
  hYellowDeep: { name: 'Permanent Yellow Deep', hex: '#f5b01c', ts: 1,   ci: 'PY74+PY83', op: 0.1,  stain: 1, gran: 0, lf: 'II',
    tube: { pos: '1.2', code: 'W037', role: 'Warm light, sunset' },
    note: 'A warm, transparent yellow that hard-lifts: sunsets and golden light in a glaze.' },
  hYellowOrange: { name: 'Permanent Yellow Orange', hex: '#f08a1c', ts: 1, ci: '',        op: 0.15, stain: 1, gran: 0, lf: 'II',
    tube: { pos: '1.3', code: 'W038', role: 'Lanterns, autumn' },
    note: 'Between yellow and orange: lantern glow and autumn leaves without mixing.' },
  hJaune1:     { name: 'Jaune Brilliant No.1', hex: '#f3d9a8', ts: 0.7, ci: '',          op: 0.5,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '1.4', code: 'W031', role: 'Skin base', note: 'Semi-opaque' },
    note: 'A pale, warm, semi-opaque yellow - the base of a skin wash. Lay it first: over a dark it veils.' },
  hJaune2:     { name: 'Jaune Brilliant No.2', hex: '#f1c488', ts: 0.7, ci: '',          op: 0.5,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '1.5', code: 'W032', role: 'Warmer skin, tan', note: 'Semi-opaque' },
    note: 'The warmer sister of No.1: tanned skin. Semi-opaque, so lay it first.' },
  hOchre:      { name: 'Yellow Ochre', hex: '#c28d31', ts: 0.6, ci: 'PY43',              op: 0.45, stain: 0, gran: 1, lf: 'I',
    tube: { pos: '1.6', code: 'W034', role: 'Wood, walls, roof tiles' },
    note: 'A natural earth, soft and semi-opaque, easy to lift: wood, walls, tiles.' },
  hVermilion:  { name: 'Vermilion Hue', hex: '#e24b26', ts: 1,   ci: '',                  op: 0.3,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '1.7', code: 'W019', role: 'Red clothes, maple' },
    note: 'A warm orange-red: clothes and maple leaves, brighter than a mix of yellow and red.' },
  hSienna:     { name: 'Burnt Sienna', hex: '#8a3d20', ts: 0.8, ci: 'PBr7',              op: 0.12, stain: 1, gran: 1, lf: 'I',
    tube: { pos: '2.1', code: 'W134', role: 'Brick, chestnut hair' },
    note: 'A transparent earth that glows in a glaze. With ultramarine, the painters\' greys and darks.' },
  hCrimsonLake: { name: 'Crimson Lake', hex: '#a01b36', ts: 1,  ci: '',                  op: 0.1,  stain: 1, gran: 0, lf: 'II',
    tube: { pos: '2.2', code: 'W010', role: 'Deep red' },
    note: 'A deep, cool, transparent red for glazing over a lighter red.' },
  hMaroon:     { name: 'Perylene Maroon', hex: '#5a1a22', ts: 1.2, ci: 'PR179',           op: 0.1,  stain: 1, gran: 0, lf: 'I',
    tube: { pos: '2.3', code: 'W008', role: 'Burgundy shadows, chromatic black', note: 'Dark' },
    note: 'A very dark transparent red: with a deep blue, a black that still has colour in it.' },
  hShellPink:  { name: 'Shell Pink', hex: '#f4c8bc', ts: 0.5, ci: '',                    op: 0.4,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '2.4', code: 'W026', role: 'Blush', note: 'Semi-opaque' },
    note: 'A pale, semi-opaque pink straight from the tube: blush on a cheek.' },
  hBrightRose: { name: 'Bright Rose', hex: '#e8387f', ts: 1.2, ci: '',                   op: 0.1,  stain: 2, gran: 0, lf: 'III',
    tube: { pos: '2.5', code: 'W170', role: 'Bright pink', note: 'Luminous, fades' },
    note: 'A luminous pink no ordinary mix reaches. It fades - for work that is scanned, not hung in the sun.' },
  hOpera:      { name: 'Opera', hex: '#ea1f82', ts: 1.2, ci: 'PR122+BV10',                op: 0.05, stain: 2, gran: 0, lf: 'III',
    tube: { pos: '2.6', code: 'W013', role: 'Glow, accents', note: 'Fades' },
    note: 'A fluorescent-looking pink for glow and accents. The dye in it is not lightfast: scan the painting.' },
  hQuinViolet: { name: 'Quinacridone Violet', hex: '#7a2a66', ts: 1.2, ci: 'PV19',        op: 0.08, stain: 2, gran: 0, lf: 'I',
    tube: { pos: '2.7', code: 'W120', role: 'Dark violet shadows', note: 'Dark' },
    note: 'A deep, transparent, staining magenta-violet: shadows that stay clear.' },
  hBrightViolet: { name: 'Bright Violet', hex: '#7a38c8', ts: 1.3, ci: '',                op: 0.1,  stain: 2, gran: 0, lf: 'III',
    tube: { pos: '3.1', code: 'W175', role: 'Shadows on skin and hair', note: 'Luminous, fades' },
    note: 'A luminous violet for shadows on skin and hair. It fades - scan the painting.' },
  hLavender:   { name: 'Lavender', hex: '#b9a8d8', ts: 0.6, ci: '',                      op: 0.4,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '3.2', code: 'W116', role: 'Shadows on white', note: 'Semi-opaque' },
    note: 'A soft, semi-opaque violet: the cool shadow on a white shirt.' },
  hPrussian:   { name: 'Prussian Blue', hex: '#0f3050', ts: 2.2, ci: 'PB27',              op: 0.05, stain: 2, gran: 0, lf: 'II',
    tube: { pos: '3.3', code: 'W097', role: 'Night sky', note: 'Dark, strong' },
    note: 'A dark, strong, staining blue: night skies. A little goes a long way.' },
  hUltraDeep:  { name: 'Ultramarine Deep', hex: '#27318c', ts: 1,  ci: 'PB29',            op: 0.1,  stain: 0, gran: 1, lf: 'I',
    tube: { pos: '3.4', code: 'W094', role: 'Evening, deep shadows', note: 'Slightly granulates' },
    note: 'The watercolourist\'s blue: evening and deep shadows; with burnt sienna, the classic greys.' },
  hCobalt:     { name: 'Cobalt Blue', hex: '#2c64b0', ts: 0.8, ci: 'PB28',               op: 0.35, stain: 0, gran: 1, lf: 'I',
    tube: { pos: '3.5', code: 'W090', role: 'Sky in depth', note: 'Slightly granulates' },
    note: 'A calm, slightly granulating blue for the depths of a sky.' },
  hPhthaloYS:  { name: 'Phthalo Blue Yellow Shade', hex: '#0b4b78', ts: 3, ci: '',       op: 0.03, stain: 2, gran: 0, lf: 'I',
    tube: { pos: '3.6', code: 'W107', role: 'Even sky, dark mixes', note: 'Dark' },
    note: 'A strong, greenish, staining blue: an even sky wash, and dark mixes. Mix it pale.' },
  hHorizon:    { name: 'Horizon Blue', hex: '#6bb8e0', ts: 0.7, ci: '',                   op: 0.4,  stain: 0, gran: 0, lf: 'I',
    tube: { pos: '3.7', code: 'W104', role: 'Anime sky', note: 'Semi-opaque' },
    note: 'The light, clear blue of an anime sky, straight from the tube. Semi-opaque: put it down first.' },
  hPeacock:    { name: 'Peacock Blue', hex: '#0a8aa6', ts: 1.5, ci: '',                   op: 0.1,  stain: 1, gran: 0, lf: 'II',
    tube: { pos: '4.1', code: 'W101', role: 'Water, glass, metal' },
    note: 'A blue-green: water, glass and metal.' },
  hViridian:   { name: 'Viridian Hue', hex: '#0d6b52', ts: 1.2, ci: '',                  op: 0.08, stain: 1, gran: 0, lf: 'I',
    tube: { pos: '4.2', code: 'W061', role: 'Depth of leaves' },
    note: 'A deep, cool, transparent green: the shade inside foliage.' },
  hSap:        { name: 'Sap Green', hex: '#5a7a1a', ts: 0.9, ci: '',                     op: 0.2,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '4.3', code: 'W075', role: 'Grass' },
    note: 'A warm, natural green: grass and leaves.' },
  hLeaf:       { name: 'Leaf Green', hex: '#6aa82a', ts: 1,  ci: '',                     op: 0.2,  stain: 0, gran: 0, lf: 'II',
    tube: { pos: '4.4', code: 'W077', role: 'Bright summer green' },
    note: 'A bright, yellower green: summer.' },
  hPaynes:     { name: "Payne's Grey", hex: '#3a4552', ts: 1.2, ci: '',                  op: 0.2,  stain: 1, gran: 0, lf: 'I',
    tube: { pos: '4.5', code: 'W156', role: 'Concrete, asphalt, glass' },
    note: 'A cool blue-grey: concrete, asphalt and glass.' },
  hChineseWhite: { name: 'Chinese White', hex: '#f6f4ee', ts: 1, ci: 'PW4',               op: 0.5,  stain: 0, gran: 0, lf: 'I', body: true,
    tube: { pos: '4.6', code: 'W001', role: 'Highlights in the eyes, glints, stars' },
    note: 'Body colour: opaque, put on last over a dry wash for the glint in an eye, a star, a highlight on hair. It is not for mixing - the paper is the watercolourist\'s white.' },
  hUmber:      { name: 'Burnt Umber', hex: '#4b3224', ts: 0.9, ci: 'PBr7',                op: 0.2,  stain: 0, gran: 1, lf: 'I',
    tube: { pos: '4.7', code: 'W133', role: 'Brown hair, pupils, wood' },
    note: 'A dark, quiet brown: hair, pupils and wood with no mixing.' },
});
const PIGMENT_LF = { I: 'lightfast', II: 'fairly lightfast', III: 'fades' };
const PIGMENT_STAIN = ['lifts off', 'stains a little', 'stains'];
const PIGMENT_GRAN = ['smooth', 'a little grainy', 'granulates'];
function pigmentOpacityWord(k) {
  const o = PIGMENTS[k].op;
  return o < 0.12 ? 'transparent' : o < 0.3 ? 'semi-transparent' : o < 0.5 ? 'semi-opaque' : 'opaque';
}

// Palettes painters actually set out - each a choice about what is left out.
const PAINT_PALETTES = {
  full:    { label: 'Full palette', keys: Object.keys(PIGMENTS).filter(k => !PIGMENTS[k].tube),
    hint: 'Every general pigment here - the closest mixes, not necessarily the simplest.' },
  split:   { label: 'Split primary', keys: ['white', 'lemon', 'cadYellow', 'cadRed', 'alizarin', 'ultramarine', 'phthaloBlue'],
    hint: 'A warm and a cool of each primary: clean mixes of almost any hue.' },
  primary: { label: 'Primaries', keys: ['white', 'cadYellow', 'alizarin', 'phthaloBlue'],
    hint: 'One yellow, one red, one blue - everything is mixed, so everything is related.' },
  zorn:    { label: 'Zorn', keys: ['white', 'ochre', 'cadRed', 'black'],
    hint: "Anders Zorn's: ochre, red and black (and white, in oil) - flesh and warm greys, and a black that passes for blue next to them." },
  earth:   { label: 'Earth', keys: ['white', 'ochre', 'sienna', 'umber', 'ultramarine', 'black'],
    hint: 'Earth colours and ultramarine - the old masters\' portrait palette: rich darks, nothing that shouts.' },
  box:     { label: 'My Holbein box', keys: Object.keys(PIGMENTS).filter(k => PIGMENTS[k].tube),
    hint: 'The tubes of the anime box, in the names on them - the Pigments tab lays them out as the pans sit.' },
};
const PAINT_KEY = 'refboard.paints.v1';
const PAINT_MEDIUM_KEY = 'refboard.paintMedium.v1';
const PAINT_MEDIA = { water: 'Watercolour', opaque: 'Oil / acrylic' };
// Watercolour paper: not quite white, a touch warm.
const PAINT_PAPER = '#f5f3ec';
// Wash strengths tried, from barely diluted to a pale tint.
const PAINT_WASH = [1, 0.7, 0.5, 0.35, 0.25, 0.17, 0.11, 0.07, 0.04];
function paintMedium() {
  try { const k = localStorage.getItem(PAINT_MEDIUM_KEY); if (PAINT_MEDIA[k]) return k; } catch {}
  return 'water';
}
function setPaintMedium(k) {
  if (!PAINT_MEDIA[k]) return;
  try { localStorage.setItem(PAINT_MEDIUM_KEY, k); } catch {}
}
// A palette's pigments in a medium - watercolour has no white.
const paintKeys = (paletteKey, medium) => PAINT_PALETTES[paletteKey].keys.filter(k => medium !== 'water' || !PIGMENTS[k].body);
function paintPaletteKey() {
  try { const k = localStorage.getItem(PAINT_KEY); if (PAINT_PALETTES[k]) return k; } catch {}
  return 'full';
}
function setPaintPaletteKey(k) {
  if (!PAINT_PALETTES[k]) return;
  try { localStorage.setItem(PAINT_KEY, k); } catch {}
}

// Each pigment's spectrum and weight, worked out once, when first needed.
let paintData = null;
function paintInit() {
  if (paintData) return paintData;
  if (typeof spectral === 'undefined') return null;
  paintData = {};
  const paper = new spectral.Color(PAINT_PAPER).R;
  for (const [k, p] of Object.entries(PIGMENTS)) {
    const c = new spectral.Color(p.hex);
    paintData[k] = { KS: c.KS, w: p.ts * Math.sqrt(c.luminance),
      A: c.R.map((r, i) => Math.max(0, -Math.log(Math.max(r, 1e-4) / paper[i]))) };
  }
  paintData.paper = paper;
  // The CIE curves spectral.js turns a spectrum into XYZ with: a spectrum
  // that is 1 in one band and 0 elsewhere gives that band's column.
  paintData.cmf = [0, 1, 2].map(() => new Float64Array(38));
  for (let i = 0; i < 38; i++) {
    const u = new Array(38).fill(0); u[i] = 1;
    new spectral.Color(u).XYZ.forEach((v, j) => paintData.cmf[j][i] = v);
  }
  return paintData;
}

/* A spectrum's OKLab, as spectral.js's Color(R).OKLab gives it - the same
   sums in the same order, so the same numbers to the last bit - without
   the sRGB the Color works out too. The recipe search scores a few hundred
   thousand mixtures and needs only this; sRGB is for the few it shows. */
const PAINT_XYZ_LMS = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309]];
const PAINT_LMS_LAB = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]];
function paintLab(R, out = new Array(3)) {
  const [c0, c1, c2] = paintData.cmf, M = PAINT_XYZ_LMS, N = PAINT_LMS_LAB;
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < 38; i++) { const r = R[i]; X += c0[i] * r; Y += c1[i] * r; Z += c2[i] * r; }
  const l = Math.cbrt(M[0][0] * X + M[0][1] * Y + M[0][2] * Z);
  const m = Math.cbrt(M[1][0] * X + M[1][1] * Y + M[1][2] * Z);
  const s = Math.cbrt(M[2][0] * X + M[2][1] * Y + M[2][2] * Z);
  for (let j = 0; j < 3; j++) out[j] = N[j][0] * l + N[j][1] * m + N[j][2] * s;
  return out;
}

// A mixture - [[pigmentKey, parts], ...] - as a spectral.js Color.
function paintMix(parts) {
  return new spectral.Color(paintMixR(parts, new Array(38)));
}
// Its spectrum, into R.
function paintMixR(parts, R) {
  const D = paintInit(), KS = parts.map(([k]) => D[k].KS), c = parts.map(([k, n]) => n * D[k].w);
  let t = 0;
  for (let j = 0; j < c.length; j++) t += c[j];
  for (let i = 0; i < 38; i++) {
    let ks = 0;
    for (let j = 0; j < c.length; j++) ks += KS[j][i] * c[j];
    ks /= t;
    R[i] = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  }
  return R;
}
// What a mixture absorbs at full strength, per band - the same at every
// strength of wash, so a search over strengths works it out once.
function paintAbsorbance(parts, a = new Array(38)) {
  const D = paintInit();
  let t = 0;
  for (const [k, n] of parts) t += n * PIGMENTS[k].ts;
  a.fill(0);
  for (const [k, n] of parts) {
    const w = n * PIGMENTS[k].ts / t, A = D[k].A;
    for (let i = 0; i < 38; i++) a[i] += w * A[i];
  }
  return a;
}
// That absorbance as a wash of strength s, on the paper.
function paintWashOf(a, s) {
  const D = paintInit(), R = new Array(38);
  for (let i = 0; i < 38; i++) R[i] = D.paper[i] * Math.exp(-s * a[i]);
  return new spectral.Color(R);
}
/* That absorbance at the strengths of PAINT_WASH from w0 up to w1, as
   spectra - into buffers the next call reuses. Math.exp was more than half
   the search; but every strength is a whole number of hundredths, so
   exp(-s a) is exp(-a/100) to a whole power, and one exp per band and its
   squarings (e, e^2, e^4 ... e^64) build all nine by multiplying. */
const paintWashBufs = PAINT_WASH.map(() => new Float64Array(38));
const paintWashBits = PAINT_WASH.map(s => {
  const n = Math.round(s * 100), bits = [];
  for (let b = 0; 1 << b <= n; b++) if (n & 1 << b) bits.push(b);
  return bits;
});
const paintPow2 = new Float64Array(7);
function paintWashesR(a, w0, w1) {
  const paper = paintData.paper, P = paintPow2;
  for (let i = 0; i < 38; i++) {
    let e = Math.exp(-a[i] / 100);
    for (let b = 0; b < 7; b++) { P[b] = e; e *= e; }
    for (let k = w0; k < w1; k++) {
      const bits = paintWashBits[k];
      let r = paper[i];
      for (let j = 0; j < bits.length; j++) r *= P[bits[j]];
      paintWashBufs[k][i] = r;
    }
  }
  return paintWashBufs;
}
// A watercolour wash of a mixture at strength s, on the paper.
const paintWash = (parts, s) => paintWashOf(paintAbsorbance(parts), s);
const paintRgb = c => c.sRGB.map(v => Math.round(Math.max(0, Math.min(255, v))));
const gcd = (a, b) => b ? gcd(b, a % b) : a;

/* Recipes for a colour: a handful of different ways to mix it from the
   palette, best first. Every single pigment, every pair in whole-number
   parts, then a third pigment added to the most promising pairs - each
   scored by how far its colour lands from the target (OKLab distance x 100,
   roughly "just noticeable" at 2), plus 2.5 for every pigment beyond the
   first: a simpler mix that is nearly as close is the better advice - a
   third tube that buys half a shade is not worth the mud it risks.
   Then only one recipe per set of pigments, so the variants are genuinely
   different routes to the colour - not the same two tubes in 3:1 and 4:1 -
   and only ones that land within reach of the best: for white, "white" is
   the answer, and a yellowish tint is not a second way to mix it. */
const PAINT_PARTS = [1, 2, 3, 4, 6, 8, 12, 16, 24];
function paintRecipes(rgb, paletteKey = paintPaletteKey(), count = 4, medium = paintMedium()) {
  if (!paintInit()) return [];
  const keys = paintKeys(paletteKey, medium), water = medium === 'water';
  const target = new spectral.Color(rgb).OKLab;
  const dist = lab => 100 * Math.hypot(lab[0] - target[0], lab[1] - target[1], lab[2] - target[2]);
  // Only the best mixture of each set of pigments is ever offered, so only
  // that is kept - the first to reach the lowest score, in the order sets
  // were first tried.
  const best = new Map(), R = new Float64Array(38), A = new Float64Array(38), lab = new Array(3);
  // In watercolour each mixture is tried at every strength of wash - the
  // ones from w0 up to w1 - and only its best kept. `set` names its
  // pigments, sorted and joined by +.
  const add = (parts, set, w0 = 0, w1 = PAINT_WASH.length) => {
    const g = parts.reduce((a, [, n]) => gcd(a, n), 0);
    // Most parts first, equal ones in palette order - the same mixture
    // found by two routes reads the same whichever won by a rounding.
    const p = parts.map(([k, n]) => [k, n / g]).sort((a, b) => b[1] - a[1] || keys.indexOf(a[0]) - keys.indexOf(b[0]));
    let dE = Infinity, wash = null;
    if (water) {
      const washes = paintWashesR(paintAbsorbance(p, A), w0, w1);
      for (let k = w0; k < w1; k++) {
        const d = dist(paintLab(washes[k], lab));
        if (d < dE) { dE = d; wash = PAINT_WASH[k]; }
      }
    } else dE = dist(paintLab(paintMixR(p, R), lab));
    const score = dE + 2.5 * (p.length - 1), o = best.get(set);
    if (!o || o.score > score) best.set(set, { parts: p, wash, dE, score, set });
  };
  const ranking = sets => sets.sort((a, b) => a.score - b.score);
  // The paper itself - the watercolourist's white.
  if (water) {
    const c = new spectral.Color(paintInit().paper), dE = dist(c.OKLab);
    best.set('paper', { parts: [], wash: 0, dE, score: dE, set: 'paper', rgb: paintRgb(c) });
  }
  for (const k of keys) add([[k, 1]], k);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const set = [keys[i], keys[j]].sort().join('+');
    for (const a of PAINT_PARTS) for (const b of PAINT_PARTS) if (gcd(a, b) === 1) add([[keys[i], a], [keys[j], b]], set);
  }
  // The best few pairs, each with every third pigment.
  const T = water ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 6, 8, 12];
  for (const pr of ranking([...best.values()].filter(r => r.parts.length === 2)).slice(0, 8)) {
    const [a, b] = pr.parts.map(q => q[0]);
    // Washes near the pair's own: a third pigment shifts the hue more than
    // how much water the colour wants.
    const wi = PAINT_WASH.indexOf(pr.wash), w0 = Math.max(0, wi - 2), w1 = Math.min(PAINT_WASH.length, wi + 3);
    for (const c of keys) {
      if (c === a || c === b) continue;
      const set = [a, b, c].sort().join('+');
      for (const x of T) for (const y of T) for (const z of T) add([[a, x], [b, y], [c, z]], set, w0, w1);
    }
  }
  const ranked = ranking([...best.values()]), out = [];
  const within = Math.max(ranked[0].dE + 6, 8);
  for (const r of ranked) {
    if (out.length && r.dE > within) continue;
    // A recipe that only adds a pigment to one already chosen has to earn it.
    if (out.some(o => r.set.split('+').filter(k => !o.set.split('+').includes(k)).length <= 1 &&
      o.set.split('+').every(k => r.set.split('+').includes(k)) && r.dE > o.dE - 2)) continue;
    out.push(r);
    if (out.length >= count) break;
  }
  // Always a choice. Near a single paint (white, in oil) every other recipe
  // is that paint plus a touch of something, and the rule above drops them
  // all - but "white and a touch of ochre" is a real alternative to offer.
  for (const r of ranked) {
    if (out.length >= Math.min(3, count)) break;
    if (!out.includes(r)) out.push(r);
  }
  // Chosen with simplicity in the scales; shown closest first, each with
  // the colour it gives.
  out.sort((a, b) => a.dE - b.dE);
  for (const r of out) r.rgb ??= paintRgb(water ? paintWash(r.parts, r.wash) : paintMix(r.parts));
  // A granulating recipe points at the smooth one beside it, when there is
  // one about as close - for skin, which wants a smooth wash.
  if (water) for (const r of out) {
    if (!r.parts.some(([k]) => PIGMENTS[k].gran >= 2)) continue;
    r.smooth = out.find(o => o.parts.length && o.parts.every(([k]) => PIGMENTS[k].gran < 2) && o.dE < r.dE + 4) || null;
  }
  return out;
}

/* What a recipe's paints do on the paper, as tags beside it - only the
   strong cases, or every recipe would carry one: granulates and stains in
   watercolour (in oil the paint sits on top, and neither shows), fades in
   any medium. Each names the paint, and its title says what to do. */
function paintRecipeTags(r) {
  const water = r.wash !== null, tags = [];
  const of = test => r.parts.map(([k]) => k).filter(k => test(PIGMENTS[k]));
  const name = ks => ks.map(k => PIGMENTS[k].name.toLowerCase()).join(' and ');
  if (water) {
    const g = of(p => p.gran >= 2);
    if (g.length) tags.push({ k: g[0], word: 'granulates', title: `${name(g)} granulates - a grainy texture in the wash` +
      (r.smooth ? `. For a smooth one: ${paintRecipeText(r.smooth)}` : '') });
    const s = of(p => p.stain >= 2);
    if (s.length) tags.push({ k: s[0], word: 'stains', title: `${name(s)} stains - it will not lift, so leave the lights before it goes on` });
  }
  const f = of(p => p.lf === 'III');
  if (f.length) tags.push({ k: f[0], word: 'fades', title: `${name(f)} fades in light, pale washes first - see the Pigment guide for a lasting paint` });
  return tags;
}

function paintMatchWord(dE) {
  return dE < 2 ? 'spot on' : dE < 4 ? 'close' : dE < 8 ? 'near' : 'as near as this palette gets';
}
// How much water, in the words a watercolourist uses.
function paintWashWord(s) {
  return s >= 0.85 ? 'rich - barely any water' : s >= 0.5 ? 'strong wash' : s >= 0.3 ? 'medium wash'
    : s >= 0.15 ? 'light wash' : 'pale tint - mostly water';
}
function paintRecipeText(r) {
  if (!r.parts.length) return 'Leave the paper white (or mask it)';
  const mix = r.parts.length === 1
    ? PIGMENTS[r.parts[0][0]].name + (r.wash === null ? ', straight' : '')
    : r.parts.map(([k, n]) => `${n} ${PIGMENTS[k].name.toLowerCase()}`).join(' + ');
  return r.wash === null ? mix : `${mix} · ${paintWashWord(r.wash)} (~${Math.round(r.wash * 100)}%)`;
}
// One recipe as a row: the mixture's colour beside the recipe and its match.
// Its tags go on a line of their own under it, so a narrow column keeps
// the recipe readable.
function paintRecipeHtml(r) {
  const tags = paintRecipeTags(r);
  return `<span class="mix-row${tags.length ? ' tagged' : ''}"><i style="background:${rgbCss(r.rgb)}" title="What this mix gives"></i>` +
    `<span>${esc(paintRecipeText(r))}</span> <em>${paintMatchWord(r.dE)}</em>` +
    (tags.length ? '<span class="mix-tags">' + tags.map(t => `<em class="mix-tag" data-pigment="${t.k}" title="${esc(t.title)}">${t.word}</em>`).join('') + '</span>' : '') + '</span>';
}

/* Every colour the palette can reach, as a shape on the colour wheel: the
   hull of every pigment and every pair mixed in steps, in OKLab a/b. White
   and black only pull colours toward the middle, so the outline is what
   the coloured pigments can do between them. */
function paintReach(paletteKey = paintPaletteKey(), medium = paintMedium()) {
  if (!paintInit()) return null;
  const keys = paintKeys(paletteKey, medium), pts = [], water = medium === 'water';
  // A dark pigment is at its most colourful let down - with water in
  // watercolour, with white in oil - so each mix is tried at a few strengths.
  const push = parts => {
    for (const w of water ? [1, 0.6, 0.35, 0.2] : [null]) {
      const l = (water ? paintWash(parts, w) : paintMix(parts)).OKLab;
      pts.push([l[1], l[2]]);
    }
  };
  for (const k of keys) push([[k, 1]]);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    for (let s = 1; s < 10; s++) push([[keys[i], s], [keys[j], 10 - s]]);
  if (!water) for (const k of keys) if (k !== 'white') for (const w of [1, 3, 8]) push([[k, 1], ['white', w]]);
  return convexHull(pts);
}

// Andrew's monotone chain.
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/* ---- shapes on the colour wheel, in OKLab a/b (or any scaling of it - the
   grey centre is the origin either way): is a colour inside, and where does
   it go when it is not. */
function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function nearestOnPolygon([x, y], poly) {
  let best = null, bd = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    const px = ax + t * dx, py = ay + t * dy, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return best;
}

/* Where a colour outside a shape on the wheel goes - the Colour studio's
   gamut mask, when the picture is repainted inside it, or what your paints
   can mix, when the palette generator keeps to them. Called only for points already known to be outside `poly`; must return
   a point inside it or on its edge. Lightness is not this function's
   business - it stays exactly as it was, which is what keeps the drawing.

   The nearest point on the mask's edge is the smallest possible change, but
   it will happily trade hue for chroma: a red just outside a mask that
   stops short of red comes back orange. The alternative is to walk the
   colour in toward grey along its own hue until it meets the mask - it
   keeps its hue and loses intensity, which is closer to how a painter
   "knocks a colour back" - but a hue the mask does not reach at all has no
   such point, so it still needs a fallback.

   So: along its own hue first. The segment from grey (the origin) out to the
   colour crosses the mask's edge wherever the mask covers that hue; of those
   crossings the one furthest out (largest t) is the most intense version of
   this exact hue the mask allows. Only a hue the mask misses entirely falls
   back to the nearest point - there, changing hue is the only way in. */
function mapIntoGamut(pt, poly) {
  const [px, py] = pt;
  let best = -1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], ex = poly[i][0] - ax, ey = poly[i][1] - ay;
    // origin + t*pt = a + s*e, solved by cross products.
    const den = px * ey - py * ex;
    if (Math.abs(den) < 1e-12) continue;          // parallel to this edge
    const t = (ax * ey - ay * ex) / den, s = (ax * py - ay * px) / den;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best >= 0 ? [px * best, py * best] : nearestOnPolygon(pt, poly);
}

/* The two choices every mixing tool asks - which medium, which tubes - as
   rows of chips, the same in the Colour studio and the palette generator.
   One pair of settings for the whole app: chosen here, they are the
   eyedropper's too. */
function paintChips(mediumHost, paintsHost, onChange) {
  mediumHost.innerHTML = Object.entries(PAINT_MEDIA)
    .map(([k, label]) => `<button class="chip" type="button" data-paint-medium="${k}">${label}</button>`).join('');
  paintsHost.innerHTML = Object.entries(PAINT_PALETTES)
    .map(([k, p]) => `<button class="chip" type="button" data-paint-palette="${k}" title="${esc(p.hint)}">${p.label}</button>`).join('');
  mediumHost.addEventListener('click', e => {
    const b = e.target.closest('[data-paint-medium]');
    if (!b) return;
    setPaintMedium(b.dataset.paintMedium);
    paintChipsSync(); onChange();
  });
  paintsHost.addEventListener('click', e => {
    const b = e.target.closest('[data-paint-palette]');
    if (!b) return;
    setPaintPaletteKey(b.dataset.paintPalette);
    el('paintSelect').value = b.dataset.paintPalette;
    paintChipsSync(); onChange();
  });
  paintChipsSync();
}
// Every such row on the page, lit for the current choice - set in one view,
// the other shows it when it opens.
function paintChipsSync() {
  const m = paintMedium(), k = paintPaletteKey();
  for (const b of document.querySelectorAll('[data-paint-medium]')) b.setAttribute('aria-pressed', String(b.dataset.paintMedium === m));
  for (const b of document.querySelectorAll('[data-paint-palette]')) b.setAttribute('aria-pressed', String(b.dataset.paintPalette === k));
}
