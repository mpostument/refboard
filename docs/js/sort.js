/* refboard - Sorting what is uploaded. Behind the container, every picture
   kept is looked at - who and what is in it, how it is lit, its colour -
   tagged, and moved into a folder by subject (Figure, Portrait, Landscape...),
   which is its group in the library's Uploads pack; the library's search
   finds it by its tags. On the web page there are no folders, and nothing
   here runs.

   The looking is done here, in the browser, by the models the session's
   tools already use - the pose and face models, and a classifier naming
   what the picture is of (ImageNet's 1000 classes) - the backend has no way
   to see a figure in a photo. The server only moves the file, into a folder
   from its own fixed list (UserStore.Folders).

   A picture is kept first and sorted after: whatever goes wrong in between
   (no connection for the models, the tab closed) it is kept, in Unsorted,
   and sorted the next time the app opens - as is every upload from before
   there was sorting.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

// The folders - their keys as UserStore.Folders has them, their names as
// the library shows them.
const SORT_FOLDERS = {
  figure: 'Figure', portrait: 'Portrait', animals: 'Animals', landscape: 'Landscape', city: 'City',
  plants: 'Plants', 'still-life': 'Still life', illustration: 'Illustration', 'my-work': 'My work', other: 'Other',
  generated: 'Generated',
};

/* Which classifier labels (lower-case) mean which folder, when there is no
   person in the picture. ImageNet's first 398 classes are all animals, so
   those need no list. */
const SORT_LABELS = {
  illustration: ['comic book'],
  landscape: ['alp', 'cliff', 'valley', 'volcano', 'seashore', 'lakeside', 'promontory', 'sandbar', 'coral reef',
    'geyser', 'breakwater', 'dam', 'hay', 'worm fence', 'stone wall', 'canoe', 'gondola', 'schooner', 'yawl',
    'catamaran', 'trimaran', 'speedboat', 'lifeboat', 'fireboat', 'paddlewheel', 'wreck', 'liner', 'container ship'],
  city: ['church', 'mosque', 'palace', 'monastery', 'castle', 'library', 'bell cote', 'dome', 'triumphal arch',
    'suspension bridge', 'steel arch bridge', 'viaduct', 'pier', 'dock', 'boathouse', 'barn', 'water tower',
    'beacon', 'tile roof', 'thatch', 'fountain', 'patio', 'prison', 'cinema', 'planetarium', 'obelisk', 'stupa',
    'greenhouse', 'grocery store', 'bakery', 'restaurant', 'bookshop', 'barbershop', 'toyshop', 'tobacco shop',
    'shoe shop', 'butcher shop', 'confectionery', 'streetcar', 'trolleybus', 'cab', 'minibus', 'school bus',
    'passenger car', 'traffic light', 'street sign', 'parking meter', 'picket fence', 'sliding door'],
  plants: ['daisy', "yellow lady's slipper", 'corn', 'acorn', 'hip', 'buckeye', 'rapeseed', 'coral fungus',
    'agaric', 'gyromitra', 'stinkhorn', 'earthstar', 'hen-of-the-woods', 'bolete', 'ear', 'pot'],
  'still-life': ['vase', 'pitcher', 'teapot', 'cup', 'coffee mug', 'water jug', 'whiskey jug', 'wine bottle',
    'beer bottle', 'water bottle', 'pop bottle', 'goblet', 'beer glass', 'red wine', 'espresso', 'mixing bowl',
    'soup bowl', 'plate', 'tray', 'candle', 'granny smith', 'strawberry', 'orange', 'lemon', 'fig', 'pineapple',
    'banana', 'jackfruit', 'custard apple', 'pomegranate', 'bell pepper', 'cucumber', 'head cabbage', 'broccoli',
    'cauliflower', 'zucchini', 'acorn squash', 'butternut squash', 'artichoke', 'mushroom', 'bagel', 'french loaf',
    'pretzel', 'wooden spoon', 'ladle', 'dutch oven', 'frying pan', 'caldron', 'coffeepot', 'saltshaker',
    'measuring cup', 'perfume', 'hourglass', 'lampshade', 'table lamp', 'teddy'],
};

/* The folder for a picture, from what was found in it (see pictureFacts()).
   People first - this is a figure-drawing library, and a person in a street
   is a figure reference before it is a street. A named subject after; and
   Other rather than a guess when the classifier is unsure. */
function categorise(f) {
  if (f.from === 'work') return 'my-work';
  const has = (names, min) => f.labels.some(l => l.score >= min && names.includes(l.name));
  // Before people: the pose model finds figures in drawings too.
  if (has(SORT_LABELS.illustration, 0.2)) return 'illustration';
  if (f.people.some(p => p.full)) return 'figure';
  // A face that fills a good part of the frame is a portrait, even with the
  // shoulders (and so a half figure) found too.
  if (f.faces.some(x => x.share > 0.03)) return 'portrait';
  if (f.people.length) return 'figure';
  if (f.faces.length) return 'portrait';
  const top = f.labels[0];
  if (!top || top.score < 0.12) return 'other';
  if (top.index < 398) return 'animals';
  for (const [folder, names] of Object.entries(SORT_LABELS)) if (names.includes(top.name)) return folder;
  return 'other';
}

/* Tags - the words the library's search will find the picture by: "sitting",
   "three-quarter view", "lit from the left", "low key", "warm"... */
function pictureTags(f, folder) {
  const t = [];
  const n = Math.max(f.people.length, f.faces.length);
  if (n) t.push(n === 1 ? 'one person' : n === 2 ? 'two people' : 'group');
  const p = f.people[0];
  if (p) {
    if (p.pose) t.push(p.pose);
    t.push(p.full ? 'full figure' : 'half figure');
    if (p.armsUp) t.push('arms raised');
  }
  const face = f.faces[0];
  if (face) {
    const yaw = Math.abs(face.yaw);
    t.push(yaw < 15 ? 'front view' : yaw < 55 ? 'three-quarter view' : 'profile');
    if (face.pitch >= 12) t.push('from below');
    else if (face.pitch <= -12) t.push('from above');
    if (face.lit) t.push('lit from the ' + face.lit);
  }
  const { mean, spread } = f.tone;
  if (mean > 62) t.push('high key'); else if (mean < 38) t.push('low key');
  if (spread > 24) t.push('high contrast'); else if (spread < 12) t.push('low contrast');
  const { chroma, warm } = f.colour;
  if (chroma < 0.015) t.push('black and white');
  else {
    if (chroma < 0.04) t.push('muted'); else if (chroma > 0.1) t.push('colourful');
    if (warm > 0.02) t.push('warm'); else if (warm < -0.015) t.push('cool');
  }
  const r = f.w / f.h;
  t.push(r > 1.15 ? 'horizontal' : r < 0.87 ? 'vertical' : 'square');
  // What the classifier saw, when it is sure - except for people, where it
  // names their clothes ("jersey", "suit"), which is not what they are of.
  const top = f.labels[0];
  if (top && top.score >= 0.3 && !['figure', 'portrait', 'my-work'].includes(folder)) t.push(top.name);
  return [...new Set(t)];
}

/* ---- looking at the picture. Everything pictureTags() and categorise()
   read: its size; its tone (L*, 0-100) and colour (OKLab, the mean chroma
   and yellow-blue); each person's pose; each face's size, angle and which
   side the light is on; the classifier's labels, best first. */
async function pictureFacts(img, from) {
  const W = img.naturalWidth, H = img.naturalHeight;
  // A small copy for the pixels - tone and colour need no more.
  const k = Math.min(1, 160 / Math.max(W, H));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, sq = 0, cs = 0, bs = 0;
  const px = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const L = lstar([d[i], d[i + 1], d[i + 2]]);
    sum += L; sq += L * L;
    const [, a, b] = linToOklab(srgbToLin(d[i] / 255), srgbToLin(d[i + 1] / 255), srgbToLin(d[i + 2] / 255));
    cs += Math.hypot(a, b); bs += b;
  }
  const mean = sum / px;
  const facts = {
    w: W, h: H, from,
    tone: { mean, spread: Math.sqrt(Math.max(0, sq / px - mean * mean)) },
    colour: { chroma: cs / px, warm: bs / px },
    people: [], faces: [], labels: [],
  };
  // Mean L* of a small square of the small copy, at image fractions x, y.
  const patch = (x, y) => {
    const cx = Math.round(x * c.width), cy = Math.round(y * c.height), r = Math.max(1, Math.round(c.width / 60));
    let s = 0, m = 0;
    for (let yy = cy - r; yy <= cy + r; yy++) for (let xx = cx - r; xx <= cx + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= c.width || yy >= c.height) continue;
      const i = (yy * c.width + xx) * 4;
      s += lstar([d[i], d[i + 1], d[i + 2]]); m++;
    }
    return m ? s / m : 0;
  };

  // The three models one after another - each is its own download the
  // first time, and one failing (no connection) leaves the others' answers.
  try {
    const pose = await loadVision('pose');
    facts.people = (pose.detect(img).landmarks || []).map(lm => poseFacts(lm, W, H));
  } catch (err) { console.warn('sort, pose:', err); }
  try {
    const face = await loadVision('face');
    facts.faces = detectFaces(face, img).map(lm => faceFacts(lm, W, H, patch));
  } catch (err) { console.warn('sort, face:', err); }
  try {
    const cls = await loadVision('classify');
    facts.labels = (cls.classify(img).classifications?.[0]?.categories || [])
      .map(x => ({ name: (x.categoryName || '').toLowerCase(), index: x.index, score: x.score }));
  } catch (err) { console.warn('sort, classify:', err); }
  return facts;
}

// A person, from the pose model's 33 points (fractions of the image).
function poseFacts(lm, W, H) {
  const seen = i => lm[i] && (lm[i].visibility ?? 1) > 0.5;
  const at = i => [lm[i].x * W, lm[i].y * H];
  const mid = (a, b) => { const p = at(a), q = at(b); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  const knees = seen(PL.lKn) || seen(PL.rKn), ankles = seen(PL.lAn) || seen(PL.rAn);
  const out = { full: knees && ankles, pose: null, armsUp: false };
  if (!(seen(PL.lSh) && seen(PL.rSh) && seen(PL.lHip) && seen(PL.rHip))) return out;
  const sh = mid(PL.lSh, PL.rSh), hip = mid(PL.lHip, PL.rHip);
  // The torso's lean from upright; a figure lying down has it near level.
  const lean = Math.abs(Math.atan2(hip[0] - sh[0], hip[1] - sh[1])) * 180 / Math.PI;
  if (lean > 55 && lean < 125) out.pose = 'lying';
  else if (knees) {
    const kn = seen(PL.lKn) && seen(PL.rKn) ? mid(PL.lKn, PL.rKn) : at(seen(PL.lKn) ? PL.lKn : PL.rKn);
    // Seated: the thighs run out from the hips rather than down from them.
    // Standing only with the whole figure in view - the model guesses at
    // knees below the frame, and a half figure's guess is no pose.
    const dx = kn[0] - hip[0], dy = kn[1] - hip[1];
    if (Math.abs(dy) / (Math.hypot(dx, dy) || 1) < 0.55) out.pose = 'sitting';
    else if (out.full) out.pose = 'standing';
  }
  out.armsUp = seen(PL.nose) && [PL.lWr, PL.rWr].some(i => seen(i) && lm[i].y < lm[PL.nose].y);
  return out;
}

// A face, from the face model's points: how much of the frame it fills,
// which way it is turned (as the head construction reads it), and which
// cheek is lighter - the side the light comes from.
function faceFacts(lm, W, H, patch) {
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  for (const p of lm) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const f = headFrame(lm, W, H);
  const yaw = Math.atan2(f.Z[0], -f.Z[2]) * 180 / Math.PI;
  const pitch = Math.atan2(-f.Z[1], Math.hypot(f.Z[0], f.Z[2])) * 180 / Math.PI;
  // Halfway from the nose tip (1) to each side of the face (234 on the
  // image's left, 454 on its right): the middle of each cheek.
  const cheek = i => patch((lm[1].x + lm[i].x) / 2, (lm[1].y + lm[i].y) / 2);
  const left = cheek(234), right = cheek(454);
  return { share: (x1 - x0) * (y1 - y0), yaw, pitch, lit: Math.abs(left - right) < 12 ? null : left > right ? 'left' : 'right' };
}

/* ---- the queue: one picture at a time, in the background. */
const sortQueue = [];
let sortBusy = false;

function sortStatus() {
  const n = sortQueue.length + (sortBusy ? 1 : 0), s = el('uploadsSorting');
  s.textContent = n ? `Sorting ${n} picture${n === 1 ? '' : 's'} into folders - looking at who and what is in ${n === 1 ? 'it' : 'them'}...` : '';
  s.classList.toggle('hidden', !n);
}

function queueSort(doc) {
  if (storeMode !== 'server' || !doc.type.startsWith('image/') || doc.folder) return;
  if (sortQueue.some(d => d.file === doc.file)) return;
  sortQueue.push(doc);
  sortStatus();
  if (!sortBusy) sortNext();
}

async function sortNext() {
  const doc = sortQueue.shift();
  if (!doc) { sortBusy = false; sortStatus(); return; }
  sortBusy = true;
  sortStatus();
  try {
    const result = await analysePicture(await storeFileUrl(doc.file), doc.from);
    await storeSortFile(doc.file, result.folder);
    // The document read again: it may have been renamed since it was queued.
    const now = (await storeItem('uploads', uploadKey(doc.file))) || doc;
    await storePutItem('uploads', uploadKey(doc.file), { ...now, folder: result.folder, tags: result.tags });
    storeChanged();
  } catch (err) {
    // Left in Unsorted, and tried again the next time the app opens.
    console.warn('not sorted:', doc.name, err);
  }
  sortNext();
}

// The folder and tags for the picture at `url`.
async function analysePicture(url, from) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const facts = await pictureFacts(img, from);
  const folder = categorise(facts);
  return { folder, tags: pictureTags(facts, folder), facts };
}

// Everything kept before sorting existed, or not sorted last time: queued
// once the page has settled, so it never slows the first screen.
async function resumeSorting() {
  await initStore();
  if (storeMode !== 'server') return;
  let list = [];
  try { list = await listUploads(); } catch { return; }
  for (const doc of list.reverse()) queueSort(doc);
}
setTimeout(resumeSorting, 4000);
