// The expression sheet (ANIME_EXPRESSIONS in js/vision.js): anime
// expressions on the 3D anime head - the brows, the eyes and the mouth -
// set on its Face tab, shown at three angles as one sheet, and asked of the
// ComfyUI one by one or as a sheet of its own.
const { test, expect, openApp, fakeServer } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

test('each expression changes the eye as anime does - the corners stay, the iris stays under the lashes', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const k of Object.keys(ANIME_EXPRESSIONS)) {
      const e = animeEyeShape('tv', 1, k), c = animeEyeShape('tv', 1, 'calm');
      // How far the iris ever pokes above the lash line or below the lid, in any style.
      let over = 0;
      for (const style of Object.keys(ANIME_EYES)) {
        const s = animeEyeShape(style, 1, k);
        for (let i = 0; i <= 64; i++) {
          const [x, y] = s.iris(2 * Math.PI * i / 64);
          let lash = -Infinity, lid = Infinity;
          for (let j = 0; j <= 400; j++) {
            const t = Math.PI * j / 400, u = s.upper(t), l = s.lower(t);
            if (Math.abs(u[0] - x) < 0.002) lash = Math.max(lash, u[1]);
            if (Math.abs(l[0] - x) < 0.002) lid = Math.min(lid, l[1]);
          }
          if (lash > -Infinity) over = Math.max(over, y - lash - 1e-3);
        }
      }
      out[k] = {
        over,
        corners: Math.hypot(e.upper(0)[0] - c.upper(0)[0], e.upper(0)[1] - c.upper(0)[1]) +
          Math.hypot(e.upper(Math.PI)[0] - c.upper(Math.PI)[0], e.upper(Math.PI)[1] - c.upper(Math.PI)[1]),
        // Mid-lower lid against the eye's centre: above it is the smile's crescent.
        lowerMid: e.lower(Math.PI / 2)[1] - e.ey,
        height: e.upper(Math.PI / 2)[1] - e.lower(Math.PI / 2)[1],
        iris: e.E.irisB,
        // The lash line near the inner corner and near the outer, against calm's.
        innerDrop: c.upper(0.75 * Math.PI)[1] - e.upper(0.75 * Math.PI)[1],
        outerDrop: c.upper(0.25 * Math.PI)[1] - e.upper(0.25 * Math.PI)[1],
        // The brow's inner end against its outer - and against calm's.
        browTilt: e.brow(0)[1] - e.brow(1)[1], browInner: e.brow(0)[1] - c.brow(0)[1],
      };
    }
    return out;
  });
  for (const k of Object.keys(r)) {
    expect(r[k].over, k).toBeLessThan(1e-3);
    expect(r[k].corners, k).toBeLessThan(1e-9);
  }
  // Joy: the lower lid pushed up past the middle - a crescent.
  expect(r.joy.lowerMid).toBeGreaterThan(0);
  expect(r.calm.lowerMid).toBeLessThan(0);
  // Surprise: a taller eye round a smaller iris.
  expect(r.surprise.height).toBeGreaterThan(r.calm.height * 1.15);
  expect(r.surprise.iris).toBeLessThan(r.calm.iris * 0.8);
  // Anger: the lid down over the inner corner, the brow's inner end down - a V.
  expect(r.anger.innerDrop).toBeGreaterThan(r.anger.outerDrop + 0.02);
  expect(r.anger.browInner).toBeLessThan(-0.1);
  expect(r.anger.browTilt).toBeLessThan(r.calm.browTilt - 0.1);
  // Sadness: the lid heavy at the outer corner, the brow's inner end up.
  expect(r.sadness.outerDrop).toBeGreaterThan(r.sadness.innerDrop + 0.02);
  expect(r.sadness.browInner).toBeGreaterThan(0.05);
});

test('the Face tab: an expression redraws the face, says how to draw it, and is kept', async ({ page }) => {
  await openForms(page);
  const faceTab = page.locator('[data-ftab="face"]');
  await expect(faceTab).toBeHidden();
  await page.click('#formShapes [data-shape="anime"]');
  await faceTab.click();
  const group = page.locator('.fgroup:has([data-group="Face"])');
  await expect(group.locator('[data-expression="calm"]')).toHaveAttribute('aria-pressed', 'true');
  const faceKey = () => page.evaluate(() => { formsRender(formScene, 64, 64); return forms.meshes[formScene.active].userData.face.userData.mats.key; });
  const calm = await faceKey();
  await group.locator('[data-expression="sadness"]').click();
  await expect(group.locator('[data-expression="sadness"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#formFaceNote')).toContainText('Sadness:');
  await expect(page.locator('#formAnimeNote')).toContainText('Sadness:');
  expect(await faceKey()).not.toBe(calm);
  // Kept with the scene - and a stale or made-up one is calm.
  await page.waitForTimeout(400);
  await page.reload();
  await page.click('.nav-item[data-view="forms"]');
  // Back on the Face tab, which is kept too.
  await expect(group.locator('[data-expression="sadness"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(faceTab).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => normalizeFormScene({ objects: [{ shape: 'anime', expression: 'smug' }] }).objects[0].expression)).toBe('calm');
  // A form with no face: back to the Object tab.
  await page.click('[data-ftab="object"]');
  await page.click('#formShapes [data-shape="cube"]');
  await expect(faceTab).toBeHidden();
});

test('the expression sheet: every expression at three angles, in one picture, opened in the viewer', async ({ page }) => {
  await openForms(page);
  await page.evaluate(() => showAnimeHead());
  const size = await page.evaluate(async () => {
    const blob = await animeExpressionSheet(formScene, activeFormObject());
    const img = await createImageBitmap(blob);
    return [img.width, img.height, activeFormObject().expression];
  });
  // Three columns of 360 beside the labels, a row per expression under the header.
  expect(size).toEqual([120 + 3 * 360, 40 + Object.keys(await page.evaluate(() => ANIME_EXPRESSIONS)).length * 360, 'calm']);
  await page.click('#formExprSheet');
  await expect(page.locator('#session')).toBeVisible();
});

test('Ctrl+K "sad" opens the anime head in 3D, sad, on its Face tab', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('sad');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Anime head in 3D: Sadness');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-ftab="face"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-expression="sadness"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [activeFormObject().shape, activeFormObject().expression])).toEqual(['anime', 'sadness']);
});

test('with a ComfyUI: the head drawn with its expression, and a sheet of them', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true } }));
  await openForms(page);
  await page.evaluate(() => showAnimeHead(undefined, 'anger'));
  await page.evaluate(() => { formScene.yaw = 0; formScene.pitch = 0; formsChanged(); });
  await page.locator('#formAnimeGen').click();
  await expect(page.locator('#genStatus')).toContainText('anger');
  await expect(page.locator('[data-gen="expression"][data-opt="anger"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => genPrompt(genChoices).prompt)).toContain('v-shaped eyebrows');
  // The sheet: the Expression row goes - the sheet has them all - and the
  // picture is wide.
  await page.click('.nav-item[data-view="forms"]');
  await page.click('[data-ftab="face"]');
  await page.click('#formExprGen');
  await expect(page.locator('[data-gen="framing"][data-opt="expressions"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-row="expression"]')).toBeHidden();
  const req = await page.evaluate(() => genPrompt(genChoices));
  expect(req.shape).toBe('landscape');
  expect(req.prompt).toContain('expression chart');
  expect(req.prompt).not.toContain('v-shaped eyebrows');
  expect(req.avoid).toContain('text');
  // Back to one head: the row is back.
  await page.click('[data-gen="framing"][data-opt="head"]');
  await expect(page.locator('[data-row="expression"]')).toBeVisible();
});
