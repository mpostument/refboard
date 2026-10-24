#!/usr/bin/env node
/* Builds src/Refboard/wwwroot/models/human.glb - the MakeHuman base body,
   straightened and skinned to the figure's own 17 joints - and writes those
   joints' rows into js/forms-models.js (between the human-rig markers).

   Run once, only when the body itself should change (the results are committed):
     node scripts/make-human.js <dir with base.obj, default.mhskel, default_weights.mhw>

   The three inputs are MakeHuman's own, from
   github.com/makehumancommunity/makehuman, makehuman/data/3dobjs/base.obj and
   makehuman/data/rigs/. All three are CC0 (the files say so in their headers;
   see LICENSE.ASSETS.md there), so the .glb is too.

   What is done to it, and why:
   - Only the `body` group is kept: the rest of base.obj is helper geometry.
   - MakeHuman's rest pose is a relaxed A: arms out at ~40 degrees, forearms
     forward, legs apart. The figure's zero pose is standing straight, arms
     down, and every angle, limit and rotate handle is measured from it. So
     the body is straightened here, once: each arm and leg bone is turned to
     point down, and the mesh follows by MakeHuman's own 163-bone weights.
   - Then the 163 bones are folded into the figure's 17 joints (the 59 facial
     ones into the head; fingers and toes rigidly into the hand and the foot),
     four per vertex at most. The fingers are there to be seen, not bent.
   - Scaled to 4 units tall, as the mannequin is, with the origin at the hips.
   - A joint is a node with a translation and no rotation: its frame is the
     world's axes, as FORM_RIG's joints are. Smooth normals are written in:
     without them GLTFLoader shades the body flat. */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/make-human.js <dir with base.obj, default.mhskel, default_weights.mhw>'); process.exit(1); }
const ROOT = path.resolve(__dirname, '../src/Refboard/wwwroot');
const OUT = path.join(ROOT, 'models/human.glb'), MODELS_JS = path.join(ROOT, 'js/forms-models.js');
const HEIGHT = 4;

// ---- the mesh: every vertex (the joint markers are vertices too), the body's faces
const V = [], tris = [];
let group = '';
for (const line of fs.readFileSync(path.join(dir, 'base.obj'), 'utf8').split('\n')) {
  if (line.startsWith('v ')) { const p = line.split(' '); V.push([+p[1], +p[2], +p[3]]); }
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ') && group === 'body') {
    const q = line.trim().split(/\s+/).slice(1).map(t => +t.split('/')[0] - 1);
    for (let i = 1; i < q.length - 1; i++) tris.push(q[0], q[i], q[i + 1]);   // a fan: quads become two triangles
  }
}
const N = 1 + tris.reduce((m, i) => Math.max(m, i), 0);   // the body's vertices are the first N
if (N > 65535) throw new Error('indices no longer fit 16 bits');

// ---- MakeHuman's skeleton: a bone's head is the mean of the marker vertices it names
const skel = JSON.parse(fs.readFileSync(path.join(dir, 'default.mhskel'), 'utf8'));
const mean = ids => ids.reduce((s, i) => [s[0] + V[i][0], s[1] + V[i][1], s[2] + V[i][2]], [0, 0, 0]).map(x => x / ids.length);
const bones = skel.bones;
const H = {};   // bone -> head, in MakeHuman's own units
for (const b of Object.keys(bones)) H[b] = mean(skel.joints[bones[b].head]);

// ---- the figure's joints: name, parent, label, and the MakeHuman bones that move with it.
// MakeHuman numbers the spine from the bottom up: spine05 is at the hips, spine01 under the neck.
const SIDE = { L: 'Left', R: 'Right' };
const JOINTS = [
  ['pelvis', null, 'Whole figure', ['root', 'pelvis.L', 'pelvis.R'], 'root'],
  ['spine', 'pelvis', 'Waist', ['spine05', 'spine04'], 'spine05'],
  ['chest', 'spine', 'Chest', ['spine03', 'spine02', 'spine01', 'breast.L', 'breast.R', 'clavicle.L', 'clavicle.R', 'shoulder01.L', 'shoulder01.R'], 'spine03'],
  ['neck', 'chest', 'Neck', ['neck01', 'neck02', 'neck03'], 'neck01'],
  ['head', 'neck', 'Head', ['head'], 'head'],
  ...['L', 'R'].flatMap(s => [
    [`upperArm.${s}`, 'chest', `${SIDE[s]} upper arm`, [`upperarm01.${s}`, `upperarm02.${s}`], `upperarm01.${s}`],
    [`forearm.${s}`, `upperArm.${s}`, `${SIDE[s]} forearm`, [`lowerarm01.${s}`, `lowerarm02.${s}`], `lowerarm01.${s}`],
    [`hand.${s}`, `forearm.${s}`, `${SIDE[s]} hand`, [`wrist.${s}`], `wrist.${s}`],
    [`thigh.${s}`, 'pelvis', `${SIDE[s]} thigh`, [`upperleg01.${s}`, `upperleg02.${s}`], `upperleg01.${s}`],
    [`shin.${s}`, `thigh.${s}`, `${SIDE[s]} shin`, [`lowerleg01.${s}`, `lowerleg02.${s}`], `lowerleg01.${s}`],
    [`foot.${s}`, `shin.${s}`, `${SIDE[s]} foot`, [`foot.${s}`], `foot.${s}`],
  ]),
];
const jointOfBone = {};
for (const [j, , , list] of JOINTS) for (const b of list) jointOfBone[b] = j;
// Everything not named goes to the nearest named ancestor: the face to the head,
// the fingers to the hand, the toes to the foot.
const driver = b => { while (!(b in jointOfBone)) { if (!bones[b].parent) throw new Error('bone ' + b + ' has no joint'); b = bones[b].parent; } return jointOfBone[b]; };

// ---- straighten: turn each limb bone to point down, move its head under the one before
const sub = (a, b) => a.map((x, i) => x - b[i]), add = (a, b) => a.map((x, i) => x + b[i]), len = a => Math.hypot(...a);
const unit = a => a.map(x => x / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// The shortest turn from direction a to direction b, as a 3x3 matrix (Rodrigues).
function arc(a, b) {
  a = unit(a); b = unit(b);
  const v = cross(a, b), c = dot(a, b);
  if (c < -0.999999) throw new Error('a limb points straight up');
  const k = 1 / (1 + c);
  return [[1 - k * (v[1] ** 2 + v[2] ** 2), -v[2] + k * v[0] * v[1], v[1] + k * v[0] * v[2]],
          [v[2] + k * v[0] * v[1], 1 - k * (v[0] ** 2 + v[2] ** 2), -v[0] + k * v[1] * v[2]],
          [-v[1] + k * v[0] * v[2], v[0] + k * v[1] * v[2], 1 - k * (v[0] ** 2 + v[1] ** 2)]];
}
const apply = (R, v) => R.map(r => dot(r, v));
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const DOWN = [0, -1, 0];

const NH = {}, TR = {};   // a bone's new head; its turn (and what it follows rigidly: bone -> [matrix, from, to])
for (const b of Object.keys(bones)) { NH[b] = H[b].slice(); TR[b] = [I3, H[b], H[b]]; }
function straighten(chain, tipOf) {
  // chain: bones from the top of the limb down; tipOf: the point the last one points at
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i], next = chain[i + 1];
    const toward = next ? H[next] : tipOf;
    if (i) NH[b] = add(NH[chain[i - 1]], [0, -len(sub(H[b], H[chain[i - 1]])), 0]);
    TR[b] = [arc(sub(toward, H[b]), DOWN), H[b], NH[b]];
  }
  return NH[chain[chain.length - 1]];
}
const rigidly = (list, bone) => { for (const b of Object.keys(bones)) if (list.test(b)) TR[b] = TR[bone]; };
for (const s of ['L', 'R']) {
  const wrist = straighten([`upperarm01.${s}`, `upperarm02.${s}`, `lowerarm01.${s}`, `lowerarm02.${s}`, `wrist.${s}`], H[`finger3-1.${s}`]);
  // The wrist is in the chain only for its position: the hand turns as a whole, fingers with it.
  NH[`wrist.${s}`] = wrist;
  rigidly(new RegExp(`^(metacarpal|finger)\\d.*\\.${s}$`), `wrist.${s}`);
  const ankle = straighten([`upperleg01.${s}`, `upperleg02.${s}`, `lowerleg01.${s}`, `lowerleg02.${s}`, `foot.${s}`], H[`toe3-1.${s}`]);
  // The foot is not turned - its sole is level in MakeHuman already - only carried down.
  NH[`foot.${s}`] = ankle;
  TR[`foot.${s}`] = [I3, H[`foot.${s}`], ankle];
  rigidly(new RegExp(`^toe\\d.*\\.${s}$`), `foot.${s}`);
}

// ---- the weights, folded; then the body, moved by them
const mhw = JSON.parse(fs.readFileSync(path.join(dir, 'default_weights.mhw'), 'utf8')).weights;
const W = Array.from({ length: N }, () => []);   // per vertex: [bone, weight]
for (const [bone, list] of Object.entries(mhw)) for (const [v, w] of list) if (v < N) W[v].push([bone, w]);
const P = V.slice(0, N).map((p, v) => {
  let out = [0, 0, 0], total = 0;
  for (const [bone, w] of W[v]) {
    const [R, from, to] = TR[bone];
    out = add(out, apply(R, sub(p, from)).map((x, i) => w * (x + to[i])));
    total += w;
  }
  return out.map(x => x / total);
});

// ---- scale and place: 4 units tall, the origin at the hips
const ys = P.map(p => p[1]);
const S = HEIGHT / (Math.max(...ys) - Math.min(...ys));
const O = [0, NH['upperleg01.L'][1], NH['upperleg01.L'][2]];   // MakeHuman units; the origin
const at = h => sub(h, O).map(x => x * S);
const POS = new Float32Array(N * 3);
P.forEach((p, i) => at(p).forEach((x, k) => { POS[i * 3 + k] = x; }));

// ---- the weights per joint: four strongest, as bytes that add to 255
const index = new Map(JOINTS.map(([j], i) => [j, i]));
const JOINT_IDX = new Uint8Array(N * 4), WEIGHT_B = new Uint8Array(N * 4);
let worst = 0, headW = new Float32Array(N);
W.forEach((list, v) => {
  const per = new Map();
  for (const [bone, w] of list) { const j = index.get(driver(bone)); per.set(j, (per.get(j) || 0) + w); }
  const all = [...per].sort((a, b) => b[1] - a[1]), top = all.slice(0, 4);
  const whole = all.reduce((s, t) => s + t[1], 0), kept = top.reduce((s, t) => s + t[1], 0);
  worst = Math.max(worst, 1 - kept / whole);
  const q = top.map(t => Math.round(255 * t[1] / kept));
  q[0] += 255 - q.reduce((s, x) => s + x, 0);
  top.forEach((t, k) => { JOINT_IDX[v * 4 + k] = t[0]; WEIGHT_B[v * 4 + k] = q[k]; });
  headW[v] = (per.get(index.get('head')) || 0) / whole;
});

// ---- smooth normals: the area-weighted sum of the faces round each vertex
const NOR = new Float32Array(N * 3);
for (let t = 0; t < tris.length; t += 3) {
  const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
  const u = [0, 1, 2].map(k => POS[b * 3 + k] - POS[a * 3 + k]), w = [0, 1, 2].map(k => POS[c * 3 + k] - POS[a * 3 + k]);
  const n = cross(u, w);
  for (const v of [a, b, c]) for (let k = 0; k < 3; k++) NOR[v * 3 + k] += n[k];
}
for (let i = 0; i < N; i++) {
  const l = Math.hypot(NOR[i * 3], NOR[i * 3 + 1], NOR[i * 3 + 2]) || 1;
  for (let k = 0; k < 3; k++) NOR[i * 3 + k] /= l;
}

// ---- the joints: where each pivots (its pivot bone's new head), relative to its parent
const pivot = Object.fromEntries(JOINTS.map(([j, , , , b]) => [j, at(NH[b])]));
pivot.pelvis = [0, 0, 0];
const rel = (j, parent) => parent ? sub(pivot[j], pivot[parent]) : pivot[j];
// GLTFLoader strips dots from node names ('upperArm.L' -> 'upperArmL'), so the real name rides in extras.
const nodes = JOINTS.map(([j, parent]) => ({ name: j, extras: { joint: j }, translation: rel(j, parent).map(x => +x.toFixed(5)), children: [] }));
JOINTS.forEach(([, parent], i) => { if (parent) nodes[index.get(parent)].children.push(i); });
nodes.forEach(n => { if (!n.children.length) delete n.children; });
const IBM = new Float32Array(JOINTS.length * 16);
JOINTS.forEach(([j], i) => IBM.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pivot[j][0], -pivot[j][1], -pivot[j][2], 1], i * 16));

// ---- the glTF
const IDX = Uint16Array.from(tris);
const pad4 = b => b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - b.length % 4)]) : b;
const parts = [
  [Buffer.from(POS.buffer), 34962], [Buffer.from(NOR.buffer), 34962],
  [Buffer.from(JOINT_IDX.buffer), 34962], [Buffer.from(WEIGHT_B.buffer), 34962],
  [Buffer.from(IDX.buffer), 34963], [Buffer.from(IBM.buffer), undefined],
].map(([b, target]) => ({ b: pad4(b), len: b.length, target }));
let off = 0;
const bufferViews = parts.map(p => { const v = { buffer: 0, byteOffset: off, byteLength: p.len, ...(p.target ? { target: p.target } : {}) }; off += p.b.length; return v; });
const minmax = [0, 1, 2].map(k => [Math.min(...Array.from({ length: N }, (_, i) => POS[i * 3 + k])), Math.max(...Array.from({ length: N }, (_, i) => POS[i * 3 + k]))]);
const gltf = {
  asset: { version: '2.0', generator: 'refboard scripts/make-human.js', copyright: 'MakeHuman base mesh, skeleton and weights, CC0 1.0 (Data Collection AB, Joel Palmius, Jonas Hauquier)' },
  scene: 0, scenes: [{ nodes: [0, JOINTS.length] }],   // the pelvis, and the mesh beside it
  nodes: [...nodes, { name: 'human', mesh: 0, skin: 0 }],
  skins: [{ joints: JOINTS.map((_, i) => i), inverseBindMatrices: 5, skeleton: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, JOINTS_0: 2, WEIGHTS_0: 3 }, indices: 4, mode: 4 }] }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: N, type: 'VEC3', min: minmax.map(m => m[0]), max: minmax.map(m => m[1]) },
    { bufferView: 1, componentType: 5126, count: N, type: 'VEC3' },
    { bufferView: 2, componentType: 5121, count: N, type: 'VEC4' },
    { bufferView: 3, componentType: 5121, count: N, type: 'VEC4', normalized: true },
    { bufferView: 4, componentType: 5123, count: IDX.length, type: 'SCALAR' },
    { bufferView: 5, componentType: 5126, count: JOINTS.length, type: 'MAT4' },
  ],
  bufferViews, buffers: [{ byteLength: off }],
};
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(parts.map(p => p.b));
const head12 = Buffer.alloc(12), c1 = Buffer.alloc(8), c2 = Buffer.alloc(8);
head12.write('glTF'); head12.writeUInt32LE(2, 4); head12.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
c1.writeUInt32LE(json.length, 0); c1.write('JSON', 4);
c2.writeUInt32LE(bin.length, 0); c2.write('BIN\0', 4);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head12, c1, json, c2, bin]));

// ---- the rows, into forms-models.js. Heights: the crown above the head's pivot,
// the sole below the foot's, and a head's height (crown to chin) for "N heads".
let chin = Infinity;
for (let i = 0; i < N; i++) if (headW[i] > 0.5) chin = Math.min(chin, POS[i * 3 + 1]);
const f = x => +x.toFixed(3);
const rows = JOINTS.filter(([j]) => j !== 'pelvis')   // the pelvis is the figure itself, not a row
  .map(([j, parent, label]) => `  ['${j}', ${parent === 'pelvis' ? 'null' : `'${parent}'`}, [${rel(j, parent).map(f).join(', ')}], '${label}', []],`);
const extent = { crown: f(minmax[1][1] - pivot.head[1]), sole: f(pivot['foot.L'][1] - minmax[1][0]), unit: f(minmax[1][1] - chin) };
const block = `/* human-rig:begin */\nconst FORM_HUMAN_RIG = [\n${rows.join('\n')}\n];\n` +
  `// From the head's pivot up to the crown, from the foot's pivot down to the sole, and a head's height.\n` +
  `const FORM_HUMAN_EXTENT = ${JSON.stringify(extent).replace(/"/g, '').replace(/:/g, ': ').replace(/,/g, ', ').replace('{', '{ ').replace('}', ' }')};\n/* human-rig:end */`;
const src = fs.readFileSync(MODELS_JS, 'utf8');
const crlf = src.includes('\r\n');
const next = src.replace(/\/\* human-rig:begin \*\/[\s\S]*?\/\* human-rig:end \*\//, block.replace(/\n/g, crlf ? '\r\n' : '\n'));
if (next === src && !src.includes(block)) throw new Error('human-rig markers not found in forms-models.js');
fs.writeFileSync(MODELS_JS, next);

console.log(`${path.relative(process.cwd(), OUT)}: ${fs.statSync(OUT).size} bytes, ${N} vertices, ${tris.length / 3} triangles, ${JOINTS.length} joints, scale ${S.toFixed(4)}`);
console.log(`worst vertex lost ${(worst * 100).toFixed(1)}% of its weight to the four-joint limit; heads: ${(HEIGHT / extent.unit).toFixed(2)}`);
console.log(extent);
