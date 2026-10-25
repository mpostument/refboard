/* refboard - Four things for drawing anime, as plain data and pictures (the view is js/animetools.js):

   Outfits. A character's hair and eyes are fixed; the outfits are not. For each outfit (a picture
   of it, or its colours) the largest colours are set against the hair and the eyes in OKLab:
   one that is nearly the hair's colour swallows the hair; one in the eyes' hue joins the
   outfit to the face; one opposite the hair sets it off; an outfit as light as the hair
   merges with it in a value study. Then the outfits against each other: two that read alike
   are said to.
   Proportions. Where the crown, chin, shoulders, crotch, knees and soles of a drawn figure
   are, in head-heights from the crown, against a build (about seven heads for anime, eight for
   a real body, nine long-legged): how many heads tall it is, and which mark is off, by how much.
   Faces. Three manners of an anime face - soft, sharp, retro - as the numbers that make
   them (eye size, spacing, height of the eye line, nose, mouth, chin) drawn as one front face,
   and as words for Generate.
   Storyboard. A strip of frames, each with a shot (how much of the figure), a camera angle and
   where she looks, drawn as a plain diagram of the frame, with what each does.

   Everything is worked out here as data; the pictures are SVG strings. Loaded with the section
   (loadSection('anime')). */
"use strict";

/* ---- outfits */

const AC_NEAR = 0.07;        // OKLab distance under which two colours read as one
const AC_CHROMA = 0.04;      // chroma under which a colour has no hue worth comparing
const AC_SAME_L = 0.1;       // lightness difference under which two merge in a value study
const AC_BIG = 20;           // share (%) from which a colour is a large part of the outfit

const acLab = rgb => compositionOklab(rgb[0], rgb[1], rgb[2]);
const acDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const acChroma = l => Math.hypot(l[1], l[2]);
const acHue = l => (Math.atan2(l[2], l[1]) * 180 / Math.PI + 360) % 360;
const acHueGap = (a, b) => Math.abs(((acHue(a) - acHue(b) + 540) % 360) - 180);

// How one colour stands to another by hue.
function acRelation(a, b) {
  if (acChroma(a) < AC_CHROMA || acChroma(b) < AC_CHROMA) return 'neutral';
  const g = acHueGap(a, b);
  return g <= 25 ? 'same' : g <= 60 ? 'near' : g >= 140 ? 'opposite' : 'apart';
}

/* hair, eyes: [r, g, b]. outfits: [{ name, palette: [{ rgb, share }] }] (share in percent).
   Gives { outfits: [{ name, main, notes, verdict }], pairs: [text] }; verdict is 'good',
   'check' or 'plain'. */
function acOutfits(hair, eyes, outfits) {
  const H = acLab(hair), E = acLab(eyes);
  const out = outfits.map(o => {
    const main = o.palette.slice().sort((a, b) => b.share - a.share).slice(0, 3).map(p => {
      const lab = acLab(p.rgb);
      return { rgb: p.rgb, share: p.share, lab, deHair: acDist(lab, H), deEyes: acDist(lab, E),
        hair: acRelation(lab, H), eyes: acRelation(lab, E) };
    });
    const notes = [];
    let bad = 0, good = 0;
    for (const m of main) {
      if (m.share >= AC_BIG && m.deHair < AC_NEAR) {
        notes.push(`${colHexOf(m.rgb)} is ${Math.round(m.share)}% of the outfit and nearly the hair's colour: the hair will not stand out from it.`);
        bad++;
      }
    }
    const lead = main[0];
    if (lead && Math.abs(lead.lab[0] - H[0]) < AC_SAME_L && lead.deHair >= AC_NEAR) {
      notes.push(`The main colour is as light as the hair, so they merge in a value study - the hair needs a darker or lighter edge.`);
      bad++;
    }
    const echo = main.find(m => m.eyes === 'same' && m.share >= 5 && m.deHair >= AC_NEAR);
    if (echo) { notes.push(`${colHexOf(echo.rgb)} is in the eyes' hue: it ties the outfit to the face.`); good++; }
    const set = main.find(m => m.hair === 'opposite' && m.share >= AC_BIG);
    if (set) { notes.push(`${colHexOf(set.rgb)} lies opposite the hair on the colour wheel, so it sets the hair off.`); good++; }
    if (main.length && main.every(m => m.hair === 'neutral' || acChroma(m.lab) < AC_CHROMA)) {
      notes.push('Every large colour is neutral: a quiet outfit. One small accent in the eyes\' hue would join it to the face.');
    }
    if (!notes.length) notes.push('Nothing clashes and nothing ties it to the hair or eyes: it reads as a separate thing worn by her.');
    return { name: o.name, main, notes, verdict: bad ? 'check' : good ? 'good' : 'plain' };
  });
  const pairs = [];
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i].main[0], b = out[j].main[0];
    if (a && b && acDist(a.lab, b.lab) < AC_NEAR) pairs.push(`${out[i].name} and ${out[j].name} have nearly the same main colour: in a sequence of pages they will read as one outfit.`);
  }
  return { outfits: out, pairs };
}

/* ---- proportions */

// Head-heights from the crown. Every build has the chin at 1; the others are where a drawn figure
// of that build puts them. (A real body's crotch is about halfway; anime legs are a little over half.)
const AC_BUILDS = {
  anime: { label: 'Anime, about seven heads', heads: 7, shoulder: 1.3, crotch: 3.3, knee: 5.0 },
  female: { label: 'Female, about seven and a half', heads: 7.5, shoulder: 1.3, crotch: 3.6, knee: 5.4 },
  real: { label: 'Realistic, eight heads', heads: 8, shoulder: 1.4, crotch: 4.0, knee: 5.7 },
  tall: { label: 'Long-legged, about nine', heads: 9, shoulder: 1.4, crotch: 4.1, knee: 6.4 },
};
const AC_MARKS = [
  ['crown', 'the top of the head'], ['chin', 'the chin'], ['shoulder', 'the top of the shoulders'],
  ['crotch', 'the crotch'], ['knee', 'the knees'], ['sole', 'the soles of the feet'],
];
const AC_ON_MARK = 0.2;      // head-heights within which a mark is "on the mark"

/* ys: { crown, chin, shoulder?, crotch?, knee?, sole? } (any numbers, one scale). Gives null until
   crown, chin and sole are given; else { heads, closest, rows, text }. */
function acProportions(ys, build) {
  if (ys.crown == null || ys.chin == null || ys.sole == null) return null;
  const head = ys.chin - ys.crown;
  if (!(head > 0) || !(ys.sole > ys.chin)) return null;
  const heads = (ys.sole - ys.crown) / head;
  const closest = Object.keys(AC_BUILDS).reduce((b, k) => Math.abs(AC_BUILDS[k].heads - heads) < Math.abs(AC_BUILDS[b].heads - heads) ? k : b, 'anime');
  const B = AC_BUILDS[build] || AC_BUILDS.anime;
  const rows = [];
  for (const [key, label] of AC_MARKS) {
    if (ys[key] == null || key === 'crown' || key === 'chin') continue;
    const at = key === 'sole' ? heads : (ys[key] - ys.crown) / head;
    const expect = key === 'sole' ? B.heads : B[key];
    const off = at - expect;
    rows.push({ key, label, at, expect, off, word: Math.abs(off) <= AC_ON_MARK ? 'on the mark'
      : off > 0 ? `${Math.abs(off).toFixed(1)} heads lower than ${B.heads} heads wants` : `${Math.abs(off).toFixed(1)} heads higher than ${B.heads} heads wants` });
  }
  const parts = [`The figure is ${heads.toFixed(1)} heads tall - closest to ${AC_BUILDS[closest].label.toLowerCase()}.`];
  if (closest !== build) parts.push(`Against ${B.label.toLowerCase()} it is ${heads > B.heads ? 'taller' : 'shorter'} by ${Math.abs(heads - B.heads).toFixed(1)} heads.`);
  const crotch = rows.find(r => r.key === 'crotch');
  if (crotch) parts.push(`The legs are ${Math.round((1 - crotch.at / heads) * 100)}% of the height (the crotch is at ${Math.round(crotch.at / heads * 100)}%).`);
  for (const r of rows) if (r.word !== 'on the mark' && r.key !== 'sole') parts.push(`${r.label[0].toUpperCase() + r.label.slice(1)} is ${r.word}.`);
  return { heads, closest, rows, text: parts.join(' ') };
}

/* ---- faces */

/* Sizes are fractions of the face's width (eyeW, nose, mouth) or of its height, crown to chin
   (eyeLine, mouthY, noseY); gap is the space between the eyes in eye-widths; eyeH is the eye's
   height over its width; slant the outer corner's rise, in degrees; chin the width of the chin
   as a share of the jaw's. */
const AC_FACES = {
  soft: { label: 'Soft', eyeW: 0.26, eyeH: 0.85, gap: 0.9, eyeLine: 0.6, slant: 0, noseY: 0.76, noseLen: 0.03, mouthY: 0.86, mouthW: 0.1, chin: 0.5, brow: 0.2,
    about: 'Round and young: big eyes set low, the eye line well under halfway down the head, the nose a dot, the mouth small, a short round chin.',
    words: 'soft round face, large low-set eyes, small nose, small mouth, rounded chin' },
  sharp: { label: 'Sharp', eyeW: 0.25, eyeH: 0.5, gap: 1.05, eyeLine: 0.54, slant: 9, noseY: 0.72, noseLen: 0.09, mouthY: 0.82, mouthW: 0.14, chin: 0.2, brow: 0.12,
    about: 'Cool and adult: narrower eyes tilted up at the outer corner, a defined nose, a wider mouth and a pointed chin with a longer jaw.',
    words: 'sharp face, narrow upturned eyes, defined nose, pointed chin, mature look' },
  retro: { label: 'Retro', eyeW: 0.21, eyeH: 1.1, gap: 1.35, eyeLine: 0.5, slant: -2, noseY: 0.74, noseLen: 0.06, mouthY: 0.84, mouthW: 0.09, chin: 0.3, brow: 0.16,
    about: 'Eighties-nineties: tall narrow eyes with big highlights and heavy lashes, set wide apart, a small mouth and a long narrow face.',
    words: '1990s anime style face, tall narrow eyes with large highlights, long lashes, small mouth, long narrow face' },
};

// One front face as an SVG of 200 x 260. `ink` is the line colour.
function acFaceSvg(key, ink = '#2a2a33') {
  const F = AC_FACES[key] || AC_FACES.soft, W = 200, Hh = 260, cx = W / 2;
  const jawW = 62 * (key === 'retro' ? 0.88 : 1), chinW = jawW * F.chin;
  const top = 20, bot = 240, eyeY = top + (bot - top) * F.eyeLine;
  const ew = W * F.eyeW * 0.62, eh = ew * F.eyeH, gap = ew * F.gap;
  const eye = side => {
    const x = cx + side * (gap / 2 + ew / 2), rise = Math.tan(F.slant * Math.PI / 180) * ew / 2;
    const inX = x - side * ew / 2, outX = x + side * ew / 2;
    const d = `M${inX} ${eyeY} Q${x} ${eyeY - eh - rise} ${outX} ${eyeY - rise} Q${x} ${eyeY + eh * 0.55 - rise / 2} ${inX} ${eyeY}Z`;
    const cy = eyeY - eh * 0.2 - rise / 2, ir = Math.min(ew * 0.34, eh * 0.9), cid = `acc-${key}-${side}`;
    return `<clipPath id="${cid}"><path d="${d}"/></clipPath><path d="${d}" fill="#fff" stroke="${ink}" stroke-width="2.2"/>` +
      `<g clip-path="url(#${cid})"><ellipse cx="${x}" cy="${cy}" rx="${ir}" ry="${Math.max(ir, eh * 0.95)}" fill="${ink}"/>` +
      `<circle cx="${x - side * ir * 0.3}" cy="${cy - eh * 0.35}" r="${Math.max(2, ir * 0.3)}" fill="#fff"/></g>` +
      `<path d="M${inX - side * 2} ${eyeY - eh * 0.3} Q${x} ${eyeY - eh * 1.5 - rise} ${outX + side * 3} ${eyeY - rise - 2}" fill="none" stroke="${ink}" stroke-width="${key === 'retro' ? 3.4 : 2.4}" stroke-linecap="round"/>` +
      `<path d="M${inX} ${eyeY - eh * 1.9} Q${x} ${eyeY - eh * (1.9 + F.brow * 4) - rise} ${outX} ${eyeY - eh * 1.9 - rise * 1.6}" fill="none" stroke="${ink}" stroke-width="1.6" opacity="0.7"/>`;
  };
  const noseY = top + (bot - top) * F.noseY, mouthY = top + (bot - top) * F.mouthY, mw = W * F.mouthW;
  const face = `M${cx - 78} ${top + 70} C${cx - 80} ${top + 14} ${cx + 80} ${top + 14} ${cx + 78} ${top + 70}` +
    ` C${cx + 78} ${top + 120} ${cx + jawW} ${bot - 40} ${cx + chinW} ${bot - 4} Q${cx} ${bot + 6} ${cx - chinW} ${bot - 4}` +
    ` C${cx - jawW} ${bot - 40} ${cx - 78} ${top + 120} ${cx - 78} ${top + 70}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="A front face in the ${esc(F.label.toLowerCase())} manner">` +
    `<path d="${face}" fill="#fbe9dc" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<line x1="${cx - W * 0.4}" y1="${eyeY}" x2="${cx + W * 0.4}" y2="${eyeY}" stroke="#d05050" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.6"/>` +
    eye(-1) + eye(1) +
    `<path d="M${cx - 2} ${noseY - F.noseLen * 120} L${cx - 3} ${noseY} Q${cx} ${noseY + 3} ${cx + 4} ${noseY}" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M${cx - mw / 2} ${mouthY} Q${cx} ${mouthY + 6} ${cx + mw / 2} ${mouthY}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}

// The same numbers as sentences, for the note under the face.
function acFaceNotes(key) {
  const F = AC_FACES[key] || AC_FACES.soft;
  return [
    `Eyes ${Math.round(F.eyeW * 100)}% of the face's width each, ${F.eyeH >= 0.9 ? 'tall' : F.eyeH <= 0.55 ? 'narrow' : 'medium'} (${F.eyeH.toFixed(2)} high for each wide), ${F.gap.toFixed(2)} of an eye apart${F.slant > 3 ? `, the outer corner tilted up ${F.slant}°` : ''}.`,
    `The eye line ${Math.round(F.eyeLine * 100)}% of the way down the head (a real face: 50%).`,
    `Nose at ${Math.round(F.noseY * 100)}%, mouth at ${Math.round(F.mouthY * 100)}%, ${Math.round(F.mouthW * 100)}% of the face wide; the chin ${F.chin <= 0.25 ? 'pointed' : F.chin >= 0.45 ? 'round' : 'narrow'}.`,
  ];
}

/* ---- storyboard */

// fig: the figure's whole height as a multiple of the frame's height (over 1: cropped).
const AC_SHOTS = {
  xls: { label: 'Extreme long', fig: 0.1, does: 'She is a speck in a place: the scene is the subject. Use it to open, or to make her small and alone.' },
  ls: { label: 'Long', fig: 0.5, does: 'All of her and the ground she is on: where she stands, how she moves.' },
  ms: { label: 'Medium', fig: 1.7, does: 'Waist up: the shot for talking, and for hands that do something.' },
  mcu: { label: 'Medium close-up', fig: 2.6, does: 'Chest up: a face you can read, with a little of the body\'s turn.' },
  cu: { label: 'Close-up', fig: 4.6, does: 'The face fills the frame: what she feels. Keep it for the moment that matters.' },
  xcu: { label: 'Extreme close-up', fig: 9, does: 'The eyes, or a hand: one detail made to carry a whole beat.' },
};
const AC_ANGLES = {
  bird: { label: 'Bird\'s-eye', does: 'From straight above: she is a pattern on the ground, small and without power.' },
  high: { label: 'High', does: 'From above: she looks smaller, weaker or watched.' },
  eye: { label: 'Eye level', does: 'The camera at her height: plain, equal, how we see a person.' },
  low: { label: 'Low', does: 'From below: she looks tall, strong, or a threat; the sky or ceiling is behind her.' },
  worm: { label: 'Worm\'s-eye', does: 'From the ground: she towers; the strongest, most distorted way to make her large.' },
};
const AC_GAZE = { away: 'Looks away', camera: 'Looks at us', left: 'Looks left', right: 'Looks right', down: 'Looks down' };
const AC_SEQUENCES = {
  open: { label: 'Opening a scene', frames: [['xls', 'bird', 'away'], ['ls', 'high', 'left'], ['ms', 'eye', 'right'], ['cu', 'eye', 'camera']] },
  reveal: { label: 'A reveal', frames: [['ms', 'eye', 'right'], ['cu', 'eye', 'down'], ['xcu', 'eye', 'camera'], ['ls', 'low', 'away']] },
  talk: { label: 'A conversation', frames: [['ms', 'eye', 'right'], ['ms', 'eye', 'left'], ['cu', 'eye', 'right'], ['cu', 'eye', 'left']] },
  threat: { label: 'A threat', frames: [['ls', 'low', 'camera'], ['mcu', 'low', 'camera'], ['cu', 'low', 'camera'], ['ms', 'high', 'down']] },
};
const AC_MAX_FRAMES = 6;

// A frame as an SVG group-free picture of w x h at (x, y): horizon, a plain figure, the gaze arrow.
function acFrameSvg(shot, angle, gaze, x, y, w, h, ink = '#2a2a33') {
  const S = AC_SHOTS[shot] || AC_SHOTS.ms, A = AC_ANGLES[angle] || AC_ANGLES.eye;
  const id = `acf${Math.round(x)}_${Math.round(y)}`;
  let H = S.fig * h;
  const headK = angle === 'high' || angle === 'bird' ? 1.18 : angle === 'low' || angle === 'worm' ? 0.88 : 1;
  const bodyK = angle === 'high' || angle === 'bird' ? 0.8 : angle === 'low' || angle === 'worm' ? 1.12 : 1;
  if (angle === 'bird') H *= 0.7;
  const r = H / 14 * headK;
  const hy = S.fig <= 1 ? y + h * 0.9 - H + r : y + h * 0.36;
  const hx = x + w / 2;
  const bodyTop = hy + r, bodyLen = H * 6 / 7 * bodyK;
  const horizon = angle === 'eye' ? hy : angle === 'high' ? hy - h * 0.35 : angle === 'low' ? hy + h * 0.55 : angle === 'worm' ? hy + h * 0.9 : null;
  const sh = r * 2.1;
  let g = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4f1ea"/>`;
  if (horizon == null) {
    for (let i = 1; i < 6; i++) g += `<line x1="${x}" y1="${y + h * i / 6}" x2="${x + w}" y2="${y + h * i / 6}" stroke="#c9c4b8" stroke-width="1"/><line x1="${x + w * i / 6}" y1="${y}" x2="${x + w * i / 6}" y2="${y + h}" stroke="#c9c4b8" stroke-width="1"/>`;
  } else {
    g += `<rect x="${x}" y="${Math.max(y, horizon)}" width="${w}" height="${Math.max(0, y + h - Math.max(y, horizon))}" fill="#e3ddcf"/>` +
      `<line x1="${x}" y1="${horizon}" x2="${x + w}" y2="${horizon}" stroke="#7a766b" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  }
  g += `<path d="M${hx - sh} ${bodyTop + r * 0.4} Q${hx} ${bodyTop - r * 0.2} ${hx + sh} ${bodyTop + r * 0.4} L${hx + sh * 0.8} ${bodyTop + bodyLen * 0.55} L${hx - sh * 0.8} ${bodyTop + bodyLen * 0.55}Z" fill="#9aa7c4" stroke="${ink}" stroke-width="1.6"/>` +
    `<path d="M${hx - sh * 0.8} ${bodyTop + bodyLen * 0.55} L${hx - sh * 0.45} ${bodyTop + bodyLen} M${hx + sh * 0.8} ${bodyTop + bodyLen * 0.55} L${hx + sh * 0.45} ${bodyTop + bodyLen}" stroke="${ink}" stroke-width="${Math.max(2, r * 0.5)}" fill="none"/>` +
    `<circle cx="${hx}" cy="${hy}" r="${r}" fill="#fbe9dc" stroke="${ink}" stroke-width="1.6"/>`;
  const a = Math.max(r * 1.5, 14);
  if (gaze === 'camera') g += `<circle cx="${hx}" cy="${hy}" r="${r * 0.28}" fill="${ink}"/>`;
  else {
    const dx = gaze === 'left' ? -1 : gaze === 'right' ? 1 : 0, dy = gaze === 'down' ? 1 : 0, ax = gaze === 'away' ? 1 : dx;
    g += `<path d="M${hx} ${hy} l${ax * a * 1.6} ${dy * a * 1.6}" stroke="#c8412f" stroke-width="2" marker-end="url(#acArrow)"/>`;
  }
  return g + `</g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${ink}" stroke-width="1.6"/>`;
}

// Words, to wrap a caption in an SVG.
function acWrap(text, n) {
  const out = []; let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if ((line + ' ' + word).trim().length > n && line) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

/* frames: [{ shot, angle, gaze, text }]. One SVG, three frames to a row, each numbered and
   captioned, with the note for the strip after it. */
function acStripSvg(frames, ink = '#2a2a33') {
  const cols = Math.min(3, frames.length), cw = 260, ch = 146, gx = 20, rows = Math.ceil(frames.length / cols), capH = 78;
  const W = cols * cw + (cols + 1) * gx, H = rows * (ch + capH) + (rows + 1) * gx;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif">` +
    `<defs><marker id="acArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#c8412f"/></marker></defs>` +
    `<rect width="${W}" height="${H}" fill="#fff"/>`;
  frames.forEach((f, i) => {
    const x = gx + (i % cols) * (cw + gx), y = gx + Math.floor(i / cols) * (ch + capH + gx);
    s += acFrameSvg(f.shot, f.angle, f.gaze, x, y, cw, ch, ink);
    s += `<text x="${x + 6}" y="${y + 16}" font-size="14" font-weight="700" fill="#c8412f">${i + 1}</text>`;
    s += `<text x="${x}" y="${y + ch + 16}" font-size="12" font-weight="600" fill="${ink}">${esc((AC_SHOTS[f.shot] || {}).label || '')} · ${esc((AC_ANGLES[f.angle] || {}).label || '')} · ${esc(AC_GAZE[f.gaze] || '')}</text>`;
    acWrap(f.text || '', 44).forEach((ln, k) => { s += `<text x="${x}" y="${y + ch + 34 + k * 15}" font-size="11.5" fill="#444">${esc(ln)}</text>`; });
  });
  return s + '</svg>';
}

// What the strip does, in a few sentences: the shots in order, a jump of two sizes or more, a run of the same.
function acStripNote(frames) {
  if (!frames.length) return '';
  const order = Object.keys(AC_SHOTS), notes = [];
  for (let i = 1; i < frames.length; i++) {
    const a = order.indexOf(frames[i - 1].shot), b = order.indexOf(frames[i].shot);
    if (Math.abs(a - b) >= 3) notes.push(`From frame ${i} to ${i + 1} the shot jumps ${Math.abs(a - b)} sizes: a hard cut that startles - good for a shock, rough for a calm scene.`);
    if (frames[i].shot === frames[i - 1].shot && frames[i].angle === frames[i - 1].angle && frames[i].gaze === frames[i - 1].gaze)
      notes.push(`Frames ${i} and ${i + 1} are the same shot, angle and look: change one, or they will read as a mistake.`);
  }
  const cu = frames.findIndex(f => f.shot === 'cu' || f.shot === 'xcu');
  if (cu === 0) notes.push('The strip starts on a close-up: the reader does not yet know where she is.');
  if (frames.length >= 3 && frames.every(f => f.shot === 'cu' || f.shot === 'xcu' || f.shot === 'mcu')) notes.push('Every frame is close: add one wide frame so the reader knows the place.');
  if (!notes.length) notes.push('The sizes step in and out without jumps, and no two frames repeat.');
  return notes.join(' ');
}
