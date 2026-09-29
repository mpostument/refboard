// A photo's pose in the 3D figure's builds (rebuildPose() in js/vision.js).
// The pose model is not run here - drawPose() is given the landmarks of a
// figure standing straight, as the model reports them: fractions of the image.
const { test, expect, quadrantsPng, openApp } = require('../helpers');

// BlazePose's indices for the points the skeleton reads, of a figure
// facing you, standing on both feet.
const STANDING = {
  0: [0.5, 0.12], 7: [0.46, 0.13], 8: [0.54, 0.13], 11: [0.42, 0.25], 12: [0.58, 0.25],
  13: [0.4, 0.4], 14: [0.6, 0.4], 15: [0.39, 0.52], 16: [0.61, 0.52], 23: [0.45, 0.52], 24: [0.55, 0.52],
  25: [0.45, 0.72], 26: [0.55, 0.72], 27: [0.45, 0.9], 28: [0.55, 0.9], 31: [0.44, 0.94], 32: [0.56, 0.94],
};
const landmarks = () => [Array.from({ length: 33 }, (_, i) =>
  STANDING[i] ? { x: STANDING[i][0], y: STANDING[i][1], z: 0, visibility: 0.99 } : { x: 0.5, y: 0.5, z: 0, visibility: 0 })];

async function poseOn(page) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.evaluate(poses => { state.poseOn = true; drawPose(poses); }, landmarks());
}

test('the photo by default; Anime from the note redraws it over a faint ghost, and is kept', async ({ page }) => {
  await poseOn(page);
  const svg = page.locator('#poseOverlay');
  await expect(svg.locator('.action')).toHaveCount(1);
  await expect(svg.locator('.rebuilt')).toHaveCount(0);
  await expect(page.locator('#poseNote [data-pose-build="real"]')).toHaveAttribute('aria-pressed', 'true');

  await page.click('#poseNote [data-pose-build="anime"]');
  await expect(svg.locator('line.rebuilt').first()).toBeAttached();
  await expect(svg.locator('circle.rebuilt-head')).toHaveCount(1);
  await expect(svg.locator('circle.head0')).toHaveCount(1);
  await expect(svg.locator('line.ghost').first()).toBeAttached();
  // The teacher's lines are about the photo's body: left out here.
  await expect(svg.locator('.action')).toHaveCount(0);
  await expect(svg.locator('.plumb')).toHaveCount(0);
  await expect(page.locator('#poseNote')).toContainText('Anime: the same pose');
  await expect(page.locator('#poseNote [data-pose-build="anime"]')).toHaveAttribute('title', /seven heads/);
  await expect(page.locator('#poseNote')).toContainText(/\d\.\d heads/);

  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  expect(await page.evaluate(() => poseBuild)).toBe('anime');
});

test('bones keep their angle, the lowest foot stays put, and the heads count follows the build', async ({ page }) => {
  await poseOn(page);
  const r = await page.evaluate(() => {
    const P = {};
    // As drawPose() reads them, in the 200 x 200 test image's pixels.
    const S = { lSh: [0.42, 0.25], rSh: [0.58, 0.25], lEl: [0.4, 0.4], rEl: [0.6, 0.4], lWr: [0.39, 0.52], rWr: [0.61, 0.52],
      lHip: [0.45, 0.52], rHip: [0.55, 0.52], lKn: [0.45, 0.72], rKn: [0.55, 0.72], lAn: [0.45, 0.9], rAn: [0.55, 0.9],
      lToe: [0.44, 0.94], rToe: [0.56, 0.94], nose: [0.5, 0.12], lEar: [0.46, 0.13], rEar: [0.54, 0.13] };
    for (const [k, [x, y]] of Object.entries(S)) P[k] = [x * 200, y * 200];
    const out = {};
    for (const b of Object.keys(FIGURE_BUILDS)) out[b] = rebuildPose(P, b, 54);
    return { P, out };
  });
  const { P, out } = r;
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (const b of ['anime', 'tall', 'chibi']) {
    const Q = out[b].Q;
    // Same forearm angle as the photo's; the lowest point (a toe) unmoved.
    expect(ang(Q.lEl, Q.lWr)).toBeCloseTo(ang(P.lEl, P.lWr), 5);
    expect(Q.lToe[1]).toBeCloseTo(P.lToe[1], 5);
  }
  // Anime: the shin longer than the photo's by the build's length.
  expect(len(out.anime.Q.lKn, out.anime.Q.lAn) / len(P.lKn, P.lAn)).toBeCloseTo(1.1, 5);
  // Measured off the redrawn figure, the counts come out in the builds' order.
  const h = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.heads]));
  expect(h.chibi).toBeLessThan(h.anime);
  expect(h.anime).toBeLessThan(h.real);
  expect(h.real).toBeLessThan(h.tall);
  expect(h.chibi).toBeLessThan(4);
});

test('Ctrl+K "pose chibi" turns the skeleton on in Chibi', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  // The model itself is not fetched in a test: a pose run draws these points.
  await page.evaluate(poses => { window.runPose = () => drawPose(poses); }, landmarks());
  await page.keyboard.press('Control+k');
  await page.keyboard.type('pose chibi');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Pose skeleton: Chibi proportions');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => [state.poseOn, poseBuild])).toEqual([true, 'chibi']);
  await expect(page.locator('#poseNote [data-pose-build="chibi"]')).toHaveAttribute('aria-pressed', 'true');
});
