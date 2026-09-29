// The 3D figure's proportions: Realistic, Anime, Long-legged, Chibi - and the
// heads grid, which must agree with the figure it is drawn over.
const { test, expect, openApp } = require('../helpers');

async function openFigure(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formShapes [data-shape="figure"]')).toBeVisible();
  await page.click('#formShapes [data-shape="figure"]');
  await expect(page.locator('#formBuilds')).toBeVisible();
}

// The figure as rendered, standing straight: its height over its head's.
const measuredHeads = (page, build) => page.evaluate(build => {
  const o = activeFormObject();
  Object.assign(o, { build, pose: {}, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1.3, sz: 1 });
  formsRender(formScene, 320, 240, true);
  const m = forms.meshes[formScene.active], T = forms.T;
  const head = m.userData.rig.parts.find(([pm]) => pm.userData.joint === 'head')[0];
  const size = obj => new T.Box3().setFromObject(obj, true).getSize(new T.Vector3()).y;
  return { measured: size(m) / size(head), worked: figureHeights(build, o.sy).heads };
}, build);

test('each build is as many heads tall as it says, on the figure itself', async ({ page }) => {
  await openFigure(page);
  const want = { real: 7.8, anime: 7, tall: 9, chibi: 2.5 };
  for (const [build, heads] of Object.entries(want)) {
    const { measured, worked } = await measuredHeads(page, build);
    // The Height slider (1.3 here) stretches the head with the rest.
    expect(measured, build).toBeCloseTo(worked, 1);
    expect(Math.abs(worked - heads), build).toBeLessThan(0.1);
  }
});

test('a build keeps the pose, says its heads, and undoes', async ({ page }) => {
  await openFigure(page);
  await page.click('#formPoses [data-pose-preset="contra"]');
  const pose = await page.evaluate(() => JSON.stringify(activeFormObject().pose));
  await expect(page.locator('#formBuilds [data-build="real"]')).toHaveAttribute('aria-pressed', 'true');

  await page.click('#formBuilds [data-build="chibi"]');
  await expect(page.locator('#formBuilds [data-build="chibi"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#formBuildNote')).toContainText('2.5 heads');
  expect(await page.evaluate(() => JSON.stringify(activeFormObject().pose))).toBe(pose);
  // Standing on the floor still: a shorter figure is not left in the air.
  const low = await page.evaluate(() => {
    const T = forms.T;
    return new T.Box3().setFromObject(forms.meshes[formScene.active], true).min.y;
  });
  expect(Math.abs(low)).toBeLessThan(0.01);

  await page.keyboard.press('Control+z');
  await expect(page.locator('#formBuilds [data-build="real"]')).toHaveAttribute('aria-pressed', 'true');

  // A saved scene with a build it does not know comes back realistic.
  const back = await page.evaluate(() => normalizeFormScene({ objects: [{ shape: 'figure', build: 'giant' }] }).objects[0].build);
  expect(back).toBe('real');
});

test('the heads grid is drawn over a figure, and only when asked', async ({ page }) => {
  await openFigure(page);
  // Amber pixels in the overlay: the grid's colour, which nothing else there uses.
  const amber = () => page.evaluate(() => {
    const c = el('formsOverlay'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && d[i] > 180 && d[i + 1] > 130 && d[i + 1] < 190 && d[i + 2] < 110) n++;
    return n;
  });
  // The selected joint is drawn in amber too - none picked.
  await page.evaluate(() => { forms.joint = null; formsChanged(); });
  await page.waitForTimeout(200);
  const off = await amber();
  await page.locator('#formBuildWrap [data-k="heads"]').check();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => formScene.heads)).toBe(true);
  expect(await amber()).toBeGreaterThan(off + 200);
});

test('a hand has no proportions to choose', async ({ page }) => {
  await openFigure(page);
  await page.click('#formShapes [data-shape="hand"]');
  await expect(page.locator('#formPoses')).toBeVisible();
  await expect(page.locator('#formBuildWrap')).toBeHidden();
});

test('Ctrl+K shows the figure in chibi proportions', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('chibi');
  await page.keyboard.press('Enter');
  await expect(page.locator('#formBuilds [data-build="chibi"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => formScene.heads)).toBe(true);
});
