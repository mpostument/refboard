// A photo's pose onto the figure (js/posefit.js): the joints it finds, put back
// through the rig's own turns, point every bone where the photo's bone points.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../helpers');

vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../../src/Refboard/wwwroot/js/posefit.js'), 'utf8'));

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / Math.PI * 180;

// A skeleton in the figure's own frame (x to its left, y up, z the way it faces),
// as the pose model writes it: x right, y DOWN, z away from the camera.
function landmarks(joints) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  const set = (i, [x, y, z]) => { lm[i] = { x, y: -y, z: -z, visibility: 1 }; };
  for (const [i, v] of Object.entries(joints)) set(Number(i), v);
  return lm;
}
function person({ lArm, lFore, rArm, rFore, lThigh, lShin, rThigh, rShin }) {
  const sh = [[0.18, 0.5, 0], [-0.18, 0.5, 0]], hip = [[0.1, 0, 0], [-0.1, 0, 0]];
  const j = { 7: [0.08, 0.72, 0], 8: [-0.08, 0.72, 0], 11: sh[0], 12: sh[1], 23: hip[0], 24: hip[1] };
  const chain = (i, from, d1, d2, len1, len2) => { j[i] = add(from, unit(d1), len1); j[i + 2] = add(j[i], unit(d2), len2); };
  chain(13, sh[0], lArm, lFore, 0.3, 0.25);
  chain(14, sh[1], rArm, rFore, 0.3, 0.25);
  chain(25, hip[0], lThigh, lShin, 0.4, 0.4);
  chain(26, hip[1], rThigh, rShin, 0.4, 0.4);
  j[31] = add(j[27], [0, -0.1, 1], 0.12); j[32] = add(j[28], [0, -0.1, 1], 0.12);
  return landmarks(j);
}
const BONES = { 'upperArm.L': [13, 11], 'forearm.L': [15, 13], 'upperArm.R': [14, 12], 'forearm.R': [16, 14], 'thigh.L': [25, 23], 'shin.L': [27, 25], 'thigh.R': [26, 24], 'shin.R': [28, 26] };
const photoBone = (lm, [to, from]) => unit([lm[to].x - lm[from].x, -(lm[to].y - lm[from].y), -(lm[to].z - lm[from].z)]);

test('every bone of a fitted figure points where the photo\'s bone points', () => {
  const lm = person({
    lArm: [1, 0, 0], lFore: [0, 1, 0],                       // out to the side, forearm up
    rArm: [-0.3, -1, 0.3], rFore: [0, -0.5, 0.8],            // down a little forward, forearm forward
    lThigh: [0, -1, 0], lShin: [0, -1, -0.1],                // standing
    rThigh: [-0.1, -0.6, 0.8], rShin: [0, -1, -0.1] });      // knee raised forward
  const fit = fitFigurePose(lm), got = figureBones(fit);
  for (const [name, idx] of Object.entries(BONES)) {
    const want = photoBone(lm, idx);
    expect(deg(got[name], want), name).toBeLessThan(3);
  }
  // Sides and signs, as the rig reads them: left is +x, lean out is positive on the left.
  expect(fit.pose['upperArm.L'][2]).toBeCloseTo(90, 0);
  expect(fit.pose['upperArm.R'][2]).toBeLessThan(0);
  // An elbow folds forward (bend below 0), a knee backward (above 0).
  expect(fit.pose['forearm.R'][0]).toBeLessThan(0);
  expect(fit.pose['shin.R'][0]).toBeGreaterThan(0);
  // Facing the camera: the figure is not turned.
  expect(Math.abs(fit.ry)).toBeLessThan(1);
});

test('a person turned to the side is a figure turned to the side', () => {
  // The same standing skeleton turned 90 degrees about the vertical: left toward +z.
  const turn = ([x, y, z]) => [z, y, -x];
  const lm = landmarks(Object.fromEntries(Object.entries({ 7: [0.08, 0.72, 0], 8: [-0.08, 0.72, 0], 11: [0.18, 0.5, 0], 12: [-0.18, 0.5, 0], 23: [0.1, 0, 0], 24: [-0.1, 0, 0] })
    .map(([i, v]) => [i, turn(v)])));
  const fit = fitFigurePose(lm);
  expect(Math.abs(Math.abs(fit.ry) - 90)).toBeLessThan(1);
  // Standing straight: the torso has no bend of its own.
  for (const j of ['spine', 'chest']) expect(Math.hypot(...fit.pose[j])).toBeLessThan(1);
});

test('a leaning torso is shared by the spine and the chest; one the model cannot see is left at rest', () => {
  const lean = ([x, y, z]) => { const a = 0.5; return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; };
  const lm = landmarks({ 11: lean([0.18, 0.5, 0]), 12: lean([-0.18, 0.5, 0]), 23: [0.1, 0, 0], 24: [-0.1, 0, 0] });
  const fit = fitFigurePose(lm);
  // Bent forward 28.6 degrees in all: 14.3 each (bend is about x, forward is negative... either way, half each).
  expect(Math.abs(fit.pose.spine[0])).toBeCloseTo(14.3, 0);
  expect(fit.pose.chest).toEqual(fit.pose.spine);
  // No ears, arms or legs were seen: only the torso is set.
  expect(Object.keys(fit.pose).sort()).toEqual(['chest', 'spine']);
  // Without the hips and shoulders there is no figure to fit.
  expect(fitFigurePose(landmarks({}))).toBeNull();
});

// The button in the figure's Pose: a photo in, the pose model (stubbed - it is a download),
// the joints and the turn set on the figure, and the way back with Undo.
const { openApp, quadrantsPng } = require('../helpers');
test('From a photo sets the figure\'s joints and turn; no figure found says so', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await page.click('#formShapes [data-shape="figure"]');
  await expect(page.locator('#formPosePhoto')).toBeVisible();
  const lm = person({ lArm: [1, 0, 0], lFore: [0, 1, 0], rArm: [0, -1, 0], rFore: [0, -1, 0], lThigh: [0, -1, 0], lShin: [0, -1, 0], rThigh: [0, -1, 0], rShin: [0, -1, 0] });
  await page.evaluate(lm => { window.loadVision = async () => ({ detect: () => ({ worldLandmarks: [lm] }) }); }, lm);
  await page.setInputFiles('#formPosePhotoInput', { name: 'p.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#formPhotoNote')).toContainText('Pose taken from the photo: 14 of 14 joints seen');
  const o = await page.evaluate(() => { const f = activeFormObject(); return { pose: f.pose, ry: f.ry }; });
  expect(o.pose['upperArm.L'][2]).toBeCloseTo(90, 0);   // the raised left arm, out to the side
  expect(Math.abs(o.ry)).toBeLessThan(1);
  // A photo with nobody in it: said, and the pose is left as it is.
  await page.evaluate(() => { window.loadVision = async () => ({ detect: () => ({ worldLandmarks: [] }) }); });
  await page.setInputFiles('#formPosePhotoInput', { name: 'p.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#formPhotoNote')).toContainText('No figure found');
  expect(await page.evaluate(() => activeFormObject().pose['upperArm.L'][2])).toBeCloseTo(90, 0);
  // Hands and feet have no such button.
  await page.click('#formShapes [data-shape="hand"]');
  await expect(page.locator('#formPosePhoto')).toBeHidden();
});
