/* refboard - Studying anime frames: what a favourite film does with colour, read off a handful
   of its frames. Three things, each learned from the frames and not told to you:

   The cel scheme. How a shadow is made - how much darker than the base it is, which way its
   hue turns (toward blue-violet, or not), whether it keeps its colour or goes grey - and how
   flat the frame is. Found with the same shapes as the Anime view of Simplify (js/simplify.js,
   js/animecolour.js): inside each shape the pixels darker than the shape's average are its
   shadow, the lighter ones its highlight, and what is measured is the real mean colour of
   each, against the base's, in OKLab. Weighted by how many pixels each shape has, so a
   sleeve counts for less than a wall; the middle value (the weighted median) is kept, so one
   odd shape does not decide it.
   The character's palette. The largest shapes of a frame by share, the way Simplify lists them.
   The colour script. One strip of the frames in order, a column of colour for each, with the
   value and the colourfulness of each frame as a line - where the film brightens, where it
   goes cold, where it cuts.

   Frames are taken evenly through a video (the middle of each slice, so the same video gives the
   same frames), or are the pictures you give, in the order you give them. Read at a small size:
   a colour scheme is not in the detail. Nothing leaves the page.
   Loaded with the section (loadSection('anime')). */
"use strict";

const AF_SIDE = 320;             // the long side a frame is read at
const AF_MIN_LEVEL = 40;         // fewest pixels of a shape's shadow (or light) that count
const AF_CHROMATIC = 0.04;       // OKLab chroma above which a base has a hue worth turning
const AF_PALETTE = 5;            // colours kept for a frame's palette
// How flat a frame is: the share of pixels within AF_FLAT_DE of the tone their shape and level give.
const AF_FLAT_DE = 0.018;

const afDeg = r => (r * 180 / Math.PI + 360) % 360;
// The angle from a to b in degrees, the short way round (-180..180).
const afTurn = (a, b) => ((b - a + 540) % 360) - 180;

// The weighted median of [value, weight] pairs; null with none.
function afMedian(pairs) {
  const p = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((a, b) => a[0] - b[0]);
  if (!p.length) return null;
  const half = p.reduce((s, [, w]) => s + w, 0) / 2;
  let acc = 0;
  for (const [v, w] of p) { acc += w; if (acc >= half) return v; }
  return p[p.length - 1][0];
}

/* One frame: p is { w, h, rgba } (stepsRead). Gives
   { palette: [{ rgb, share }], L, C, warm, flat, shadows: [{ dL, turn, chroma, w }], lights: [...] }
   L is the mean value (OKLab L, 0..1), C the mean chroma, warm how far the mean colour lies toward
   orange (positive) or blue (negative), flat the share of flat pixels, and shadows / lights what
   was measured in each shape of enough shading: how much darker (dL, OKLab L, positive darker) or
   lighter, how many degrees the hue turned toward blue-violet (positive) or toward yellow for a
   light, the chroma ratio against the base, and the number of pixels it rests on. */
function afFrame(p) {
  const f = simplifyOf(p, { n: 8, detail: 'medium', view: 'anime' });
  const { w, h, labels, shapes } = f, n = w * h;
  const lev = animeLevels(labels, f.tone, w, h, shapes.length);
  // The real colour of each pixel in OKLab, and the mean of each (shape, level).
  const lab = new Float32Array(n * 3);
  const sum = shapes.map(() => [0, 1, 2].map(() => new Float64Array(4)));   // [level][L, a, b, count]
  const mean = Float64Array.of(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = compositionOklab(p.rgba[4 * i], p.rgba[4 * i + 1], p.rgba[4 * i + 2]);
    lab[3 * i] = L; lab[3 * i + 1] = a; lab[3 * i + 2] = b;
    const s = sum[labels[i]][lev[i]];
    s[0] += L; s[1] += a; s[2] += b; s[3]++;
    mean[0] += L; mean[1] += a; mean[2] += b;
  }
  const at = (k, l) => { const s = sum[k][l]; return s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3]] : null; };
  let flatN = 0;
  for (let i = 0; i < n; i++) {
    const m = at(labels[i], lev[i]);
    if (m && Math.hypot(lab[3 * i] - m[0], lab[3 * i + 1] - m[1], lab[3 * i + 2] - m[2]) < AF_FLAT_DE) flatN++;
  }
  const hueOf = (a, b) => afDeg(Math.atan2(b, a));
  const shadows = [], lights = [];
  shapes.forEach((_, k) => {
    const base = at(k, 1);
    if (!base || base[3] < AF_MIN_LEVEL) return;
    const Cb = Math.hypot(base[1], base[2]), Hb = hueOf(base[1], base[2]);
    for (const [lvl, list, target] of [[0, shadows, 285], [2, lights, 85]]) {
      const t = at(k, lvl);
      if (!t || t[3] < AF_MIN_LEVEL) continue;
      const Ct = Math.hypot(t[1], t[2]);
      const d = lvl === 0 ? base[0] - t[0] : t[0] - base[0];
      if (d < 0.015) continue;                                    // no real step
      // Hue: for a coloured base the turn of the hue toward the target; for a grey, the push along b
      // (blue is negative b) is all there is to say, so the chroma ratio is left out.
      let turn = null, chroma = null;
      if (Cb >= AF_CHROMATIC && Ct >= 0.02) {
        const raw = afTurn(Hb, hueOf(t[1], t[2])), want = afTurn(Hb, target);
        // Only the movement along the way to the target counts: the same sign as the way there.
        turn = Math.sign(want) * raw;
        chroma = Ct / Cb;
      }
      list.push({ dL: d, turn, chroma, w: t[3] });
    }
  });
  // In a cel frame the shadow is usually a shape of its own, next to the base it shades: two shapes
  // that touch along a long border, of nearly one hue, the smaller the darker (a shadow) or the lighter
  // (a highlight). Found by the border the labels share; the weight is the pixels of the smaller one.
  const border = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = labels[y * w + x];
    for (const b of [x < w - 1 ? labels[y * w + x + 1] : a, y < h - 1 ? labels[(y + 1) * w + x] : a]) {
      if (a === b) continue;
      const key = a < b ? a * 64 + b : b * 64 + a;
      border.set(key, (border.get(key) || 0) + 1);
    }
  }
  const col = shapes.map(s => compositionOklab(...s.rgb));
  for (const [key, len] of border) {
    const i = Math.floor(key / 64), j = key % 64;
    if (len < Math.max(10, n * 0.0015)) continue;
    const [big, small] = shapes[i].share >= shapes[j].share ? [i, j] : [j, i];
    const B = col[big], S = col[small], d = S[0] - B[0], px = shapes[small].share / 100 * n;
    if (Math.abs(d) < 0.04 || Math.abs(d) > 0.35 || px < AF_MIN_LEVEL) continue;
    const Cb = Math.hypot(B[1], B[2]), Cs = Math.hypot(S[1], S[2]);
    const chromatic = Cb >= AF_CHROMATIC && Cs >= 0.02;
    const hb = hueOf(B[1], B[2]), hs = hueOf(S[1], S[2]);
    if (chromatic && Math.abs(afTurn(hb, hs)) > 60) continue;          // a different colour, not a different tone
    if (!chromatic && Math.max(Cb, Cs) > 0.06) continue;               // a grey beside a colour is not a tone of it
    const dark = d < 0, target = dark ? 285 : 85;
    (dark ? shadows : lights).push({ dL: Math.abs(d), turn: chromatic ? Math.sign(afTurn(hb, target)) * afTurn(hb, hs) : null, chroma: chromatic ? Cs / Cb : null, w: px });
  }
  const share = shapes.map((s, k) => ({ rgb: s.rgb, share: s.share })).sort((a, b) => b.share - a.share).slice(0, AF_PALETTE);
  const warmAxis = [0.5, 0.866];
  return {
    palette: share,
    L: mean[0] / n,
    C: (() => { let c = 0; for (let i = 0; i < n; i++) c += Math.hypot(lab[3 * i + 1], lab[3 * i + 2]); return c / n; })(),
    warm: (warmAxis[0] * mean[1] + warmAxis[1] * mean[2]) / n,
    flat: flatN / n,
    shadows, lights,
  };
}

// How a frame set reads: "flat cel" / "mostly flat" / "painted".
function afFlatWord(flat) { return flat >= 0.85 ? 'flat cel' : flat >= 0.65 ? 'mostly flat' : 'painted, with gradients'; }

/* The scheme of a set of frames (the results of afFrame): the medians of each measure, over all the
   shapes of all the frames, weighted by pixels. null with no frames; a part is null where nothing
   in the frames had a shadow (or a light). */
function afScheme(frames) {
  if (!frames.length) return null;
  const all = key => frames.flatMap(fr => fr[key]);
  const med = (list, prop) => afMedian(list.filter(o => o[prop] != null).map(o => [o[prop], o.w]));
  const sh = all('shadows'), li = all('lights');
  const pick = list => list.length ? { dL: med(list, 'dL'), turn: med(list, 'turn'), chroma: med(list, 'chroma'), shapes: list.length } : null;
  const flat = frames.reduce((a, fr) => a + fr.flat, 0) / frames.length;
  return { flat, flatWord: afFlatWord(flat), shadow: pick(sh), light: pick(li), frames: frames.length };
}

// The scheme in plain words, for the note and for copying.
function afSchemeText(sc) {
  if (!sc) return 'No frames yet.';
  const out = [`Over ${sc.frames} frame${sc.frames === 1 ? '' : 's'}: ${sc.flatWord} (${Math.round(sc.flat * 100)}% of the picture is one flat tone).`];
  const s = sc.shadow;
  if (!s) out.push('No shadow tone found: the shapes are not shaded, or the shading is a gradient.');
  else {
    const dl = Math.round(s.dL * 100);
    let t = `Shadow: ${dl} steps of 100 darker than the base`;
    if (s.turn != null) {
      const deg = Math.round(Math.abs(s.turn));
      t += deg < 4 ? ', its hue held' : `, its hue turned ${deg} degrees ${s.turn > 0 ? 'toward blue-violet' : 'away from blue-violet (toward warm)'}`;
      if (s.chroma != null) t += s.chroma > 1.08 ? ', the colour kept richer' : s.chroma < 0.85 ? ', the colour greyed' : ', the colour kept';
    }
    out.push(t + '.');
  }
  const l = sc.light;
  if (l) {
    let t = `Highlight: ${Math.round(l.dL * 100)} steps lighter`;
    if (l.turn != null) { const deg = Math.round(Math.abs(l.turn)); t += deg < 4 ? ', its hue held' : `, turned ${deg} degrees ${l.turn > 0 ? 'toward yellow' : 'away from yellow'}`; }
    out.push(t + '.');
  }
  return out.join(' ');
}

/* The colour script of a set of frames: for each, its value and colourfulness, and the notable ones.
   cuts are the (up to two) largest jumps between neighbours in mean OKLab colour, with the pair's
   indexes (the frame before, the frame after). */
function afScript(frames) {
  const n = frames.length;
  if (!n) return null;
  const idx = fn => frames.map(fn).reduce((best, v, i, a) => v > a[best] ? i : best, 0);
  const darkest = idx(fr => -fr.L), lightest = idx(fr => fr.L), richest = idx(fr => fr.C), coolest = idx(fr => -fr.warm);
  const jumps = [];
  for (let i = 1; i < n; i++) {
    const a = frames[i - 1], b = frames[i];
    // The distance between two frames' mean value and warmth, with chroma - not their pixels, which a cut changes anyway.
    jumps.push({ at: i, d: Math.hypot(a.L - b.L, (a.warm - b.warm) * 1.4, a.C - b.C) });
  }
  const cuts = jumps.sort((a, b) => b.d - a.d).slice(0, 2).filter(j => j.d > 0.05).sort((a, b) => a.at - b.at);
  return { darkest, lightest, richest, coolest, cuts, range: frames[lightest].L - frames[darkest].L };
}

function afScriptText(sc) {
  if (!sc) return '';
  const n = i => `frame ${i + 1}`;
  const out = [`Darkest ${n(sc.darkest)}, lightest ${n(sc.lightest)} (${Math.round(sc.range * 100)} steps of 100 apart); most colour at ${n(sc.richest)}, coolest at ${n(sc.coolest)}.`];
  if (sc.cuts.length) out.push('Biggest change of colour: ' + sc.cuts.map(c => `between ${n(c.at - 1)} and ${n(c.at)}`).join(', and ') + '.');
  else out.push('The colour holds steady from frame to frame - one scene, one light.');
  return out.join(' ');
}

/* Frames from a video, evenly through it: the middle of each of n slices, at AF_SIDE. Gives canvases.
   Decoded by the browser's own player. */
async function afVideoFrames(file, n, progress) {
  const src = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = src;
  try {
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('unsupported format')); });
    if (v.duration === Infinity) {
      v.currentTime = 1e9;
      await new Promise(res => { v.addEventListener('seeked', res, { once: true }); setTimeout(res, 4000); });
    }
    const dur = v.duration;
    if (!Number.isFinite(dur) || dur <= 0) throw new Error('no length');
    const out = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = (i + 0.5) * dur / n;
      await new Promise(res => v.addEventListener('seeked', res, { once: true }));
      out.push(afCanvas(v, v.videoWidth, v.videoHeight));
      progress(i + 1);
    }
    return out;
  } finally {
    v.removeAttribute('src'); v.load();
    URL.revokeObjectURL(src);
  }
}

// A picture (an image, a video element) drawn onto a canvas at AF_SIDE.
function afCanvas(source, sw, sh) {
  const s = Math.min(1, AF_SIDE / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s)); c.height = Math.max(1, Math.round(sh * s));
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}

// A File that is a picture, as a canvas at AF_SIDE.
async function afImageCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return afCanvas(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(url); }
}

/* The colour script as a picture: each frame a column of its palette (stacked by share), then the
   value of each frame as a line over the top. Returns a canvas of w x h. */
function afScriptCanvas(frames, w = 720, h = 140) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), n = frames.length || 1, cw = w / n;
  frames.forEach((fr, i) => {
    let y = 0;
    for (const p of fr.palette) {
      const ph = Math.max(1, Math.round(h * p.share / fr.palette.reduce((a, q) => a + q.share, 0)));
      g.fillStyle = rgbCss(p.rgb); g.fillRect(Math.floor(i * cw), y, Math.ceil(cw), ph); y += ph;
    }
    if (y < h) { g.fillStyle = rgbCss(fr.palette[fr.palette.length - 1].rgb); g.fillRect(Math.floor(i * cw), y, Math.ceil(cw), h - y); }
  });
  g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3;
  g.beginPath();
  frames.forEach((fr, i) => { const x = (i + 0.5) * cw, y = h - fr.L * h; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  return c;
}

/* The colours of all the frames as one palette of up to n: every frame's palette entries by share,
   the biggest first, each kept only if it is not near one already kept (OKLab distance 0.07). */
function afMerged(frames, n) {
  const all = frames.flatMap(fr => fr.palette).sort((a, b) => b.share - a.share);
  const kept = [], labs = [];
  for (const p of all) {
    const l = compositionOklab(...p.rgb);
    if (labs.some(k => Math.hypot(k[0] - l[0], k[1] - l[1], k[2] - l[2]) < 0.07)) continue;
    labs.push(l); kept.push(p.rgb);
    if (kept.length >= n) break;
  }
  return kept;
}
