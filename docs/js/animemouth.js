/* refboard - The mouth in speech, as plain data and a picture (the view is in js/animenewui.js): the five vowels, the closed mouth,
   the teeth on the lip and the tongue tip, and the three drawings most anime flaps a line with.
   Loaded with the section (loadSection('anime')) after js/animedraw.js, whose SVG helpers it uses. */
"use strict";

const AN_MOUTHS = {
  a: { label: 'A', says: 'Ah: the widest mouth, the jaw dropped. Upper teeth as a white strip, the tongue low and flat.' },
  i: { label: 'I', says: 'Ee: wide and flat, the corners pulled back, both rows of teeth showing as one band.' },
  u: { label: 'U', says: 'Oo: small and round, the lips pushed forward. The smallest open mouth.' },
  e: { label: 'E', says: 'Eh: half open and wide, the upper teeth showing a little. The mouth of most words.' },
  o: { label: 'O', says: 'Oh: round and medium, taller than it is wide. Bigger than U, rounder than A.' },
  m: { label: 'M, B, P', says: 'Closed: the lips pressed in one line, the corners a little down. The mouth between words, and before a P or a B.' },
  f: { label: 'F, V', says: 'The upper teeth rest on the lower lip: draw the two teeth, and the lip tucked under them.' },
  l: { label: 'L, TH, N', says: 'The tongue tip lifts to the upper teeth: a half-open mouth with a pink tongue seen at the top.' },
};
const AN_MOUTH_SIMPLE = ['m', 'e', 'a'];
const AN_MOUTH_TIPS = [
  'Most anime animates speech with three drawings: closed, half open and open, flapped in the rhythm of the syllables, not of the letters.',
  'For a close-up with a clear line, use the five vowels A I U E O, and the closed mouth for M, B and P.',
  'Keep the mouth small and low on the face; it opens by dropping the jaw, so the chin moves and the cheeks do not.',
  'Hold the mouth still on the last word of a line for two or three frames: the viewer needs it to land.',
];

// One mouth, drawn at the point (ox, oy) in a cell 140 wide: the ink outline, the dark inside, the teeth and the tongue.
function anMouthShape(k, ox, oy) {
  const ink = AD_INK, dark = '#6e2434', tongue = '#e88a96', P = (x, y) => `${ox + x} ${oy + y}`;
  const open = (d, teeth, tg) => `<path d="${d}" fill="${dark}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>` + (teeth || '') + (tg || '');
  const teeth = (x, y, w, h) => `<rect x="${ox + x}" y="${oy + y}" width="${w}" height="${h}" rx="3" fill="#fff" stroke="${ink}" stroke-width="1"/>`;
  const tg = (x, y, rx, ry) => `<ellipse cx="${ox + x}" cy="${oy + y}" rx="${rx}" ry="${ry}" fill="${tongue}"/>`;
  switch (k) {
    case 'a': return open(`M${P(25, 40)} Q${P(70, 24)} ${P(115, 40)} Q${P(112, 92)} ${P(70, 96)} Q${P(28, 92)} ${P(25, 40)}Z`, teeth(36, 38, 68, 11), tg(70, 80, 26, 10));
    case 'i': return open(`M${P(18, 50)} Q${P(70, 40)} ${P(122, 50)} Q${P(118, 72)} ${P(70, 74)} Q${P(22, 72)} ${P(18, 50)}Z`, teeth(26, 47, 88, 14));
    case 'u': return open(`M${P(70, 38)} Q${P(88, 38)} ${P(88, 56)} Q${P(88, 74)} ${P(70, 74)} Q${P(52, 74)} ${P(52, 56)} Q${P(52, 38)} ${P(70, 38)}Z`);
    case 'e': return open(`M${P(30, 46)} Q${P(70, 34)} ${P(110, 46)} Q${P(108, 80)} ${P(70, 82)} Q${P(32, 80)} ${P(30, 46)}Z`, teeth(38, 43, 64, 9), tg(70, 72, 20, 7));
    case 'o': return open(`M${P(70, 28)} Q${P(98, 28)} ${P(98, 58)} Q${P(98, 90)} ${P(70, 90)} Q${P(42, 90)} ${P(42, 58)} Q${P(42, 28)} ${P(70, 28)}Z`, '', tg(70, 78, 16, 8));
    case 'm': return `<path d="M${P(30, 56)} Q${P(70, 64)} ${P(110, 56)}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/><path d="M${P(26, 52)} L${P(31, 58)} M${P(114, 52)} L${P(109, 58)}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'f': return `<path d="M${P(30, 50)} Q${P(70, 42)} ${P(110, 50)}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M${P(40, 58)} Q${P(70, 78)} ${P(100, 58)} Q${P(70, 64)} ${P(40, 58)}Z" fill="${tongue}" stroke="${ink}" stroke-width="2.4"/>` + teeth(58, 49, 24, 10);
    default: return open(`M${P(32, 46)} Q${P(70, 36)} ${P(108, 46)} Q${P(106, 76)} ${P(70, 78)} Q${P(34, 76)} ${P(32, 46)}Z`, teeth(40, 43, 60, 8), tg(70, 53, 12, 8));
  }
}

/* o: { full (all eight; false for the three of the simple set) }. The sheet of mouth shapes, each labelled. */
function anMouthSheet(o) {
  const keys = o.full === false ? AN_MOUTH_SIMPLE : Object.keys(AN_MOUTHS), cols = keys.length > 4 ? 4 : keys.length, rows = Math.ceil(keys.length / cols), W = cols * 150 + 10, H = rows * 140 + 10;
  let s = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  keys.forEach((k, i) => {
    const ox = 10 + (i % cols) * 150, oy = 6 + Math.floor(i / cols) * 140;
    s += `<rect x="${ox}" y="${oy}" width="140" height="112" rx="8" fill="#f8f2ec" stroke="#ddd"/>` + anMouthShape(k, ox, oy) + `<text x="${ox + 70}" y="${oy + 128}" text-anchor="middle" font-size="13" font-weight="600" fill="#333">${esc(AN_MOUTHS[k].label)}</text>`;
  });
  return adSvgOpen([0, 0, W, H], 'Mouth shapes for speech') + s + '</svg>';
}
