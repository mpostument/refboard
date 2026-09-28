// Head construction (js/vision.js): Loomis's, or the anime face, turned to
// the head in the picture. The face model is not run here - drawHead() is
// given landmarks made from a known head, turned a known way.
const { test, expect, quadrantsPng, openApp } = require('../helpers');

/* The face-mesh points drawHead() reads, for a head turned `yaw` degrees
   (to its own left) and tipped `pitch` up - built in the construction's own
   units (the ball's radius, y up, z out of the face) and projected the way
   the model reports them: fractions of the image, depth away from you. */
function headLandmarks(yaw = 0, pitch = 0) {
  const U = 2 / 3, k = 0.12;
  const pts = { 9: [0, 0, 1], 2: [0, -U, 1], 152: [0, -2 * U, 0.88], 33: [-0.45, -0.2, 0.85], 263: [0.45, -0.2, 0.85], 10: [0, 0.9, 0.88] }; // top at the chin's depth: "up" is then straight up
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const [i, [x, y, z]] of Object.entries(pts)) {
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    const y2 = y * Math.cos(b) + z1 * Math.sin(b), z2 = -y * Math.sin(b) + z1 * Math.cos(b);
    lm[i] = { x: 0.5 + x1 * k, y: 0.5 - y2 * k, z: -z2 * k };
  }
  return [lm];
}

async function headOn(page, yaw, pitch) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.evaluate(faces => { state.headOn = true; drawHead(faces); }, headLandmarks(yaw, pitch));
}

test('Loomis by default; Anime from the note, redrawn at once and kept', async ({ page }) => {
  await headOn(page, 0, 0);
  const svg = page.locator('#headOverlay');
  await expect(svg.locator('.third').first()).toBeAttached();
  await expect(svg.locator('.lash')).toHaveCount(0);
  await expect(page.locator('#poseNote [data-head-style="loomis"]')).toHaveAttribute('aria-pressed', 'true');

  await page.click('#poseNote [data-head-style="anime"]');
  await expect(svg.locator('.third')).toHaveCount(0);
  // Both eyes' lash lines, the iris of each, the gleams; the frame kept.
  await expect(svg.locator('path.lash').first()).toBeAttached();
  await expect(svg.locator('circle.gleam')).toHaveCount(2);
  await expect(svg.locator('.side').first()).toBeAttached();
  await expect(page.locator('#poseNote')).toContainText('Pink');
  await expect(page.locator('#poseNote [data-head-style="anime"]')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  expect(await page.evaluate(() => headStyle)).toBe('anime');
});

test('Ctrl+K "anime" switches the head to the anime face', async ({ page }) => {
  await headOn(page, 0, 0);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('anime');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Head construction: Anime');
  await page.keyboard.press('Enter');
  await expect(page.locator('#headOverlay path.lash').first()).toBeAttached();
});

test('anime eyes sit lower than the brow, and the far one narrows as the head turns', async ({ page }) => {
  await headOn(page, 0, 0);
  await page.click('#poseNote [data-head-style="anime"]');
  // Each eye's iris: its box on screen, left to right.
  const irises = () => page.evaluate(() => [...document.querySelectorAll('#headOverlay path.iris:not(.hid)')]
    .map(p => p.getBBox()).sort((a, b) => a.x - b.x).map(b => ({ x: b.x, y: b.y + b.height / 2, w: b.width })));
  const front = await irises();
  expect(front).toHaveLength(2);
  // Facing you: the two alike, and below the brow (image y 0.5 = 100px).
  expect(Math.abs(front[0].w - front[1].w)).toBeLessThan(0.5);
  for (const e of front) expect(e.y).toBeGreaterThan(100);

  // Turned toward its own left (your right): the eye on your right is the
  // far one, and narrower.
  await page.evaluate(faces => drawHead(faces), headLandmarks(35, 0));
  const turned = await irises();
  expect(turned).toHaveLength(2);
  expect(turned[1].w).toBeLessThan(turned[0].w * 0.85);
  // ...and the note says so.
  await expect(page.locator('#poseNote')).toContainText('far eye is narrower');
});
