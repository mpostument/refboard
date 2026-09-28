// How to draw it (js/steps.js): any picture in the workspace taken back to
// the steps it is drawn in, worked out from the picture itself - so it runs
// here, as on GitHub Pages, with no server and no model.
const { test, expect, quadrantsPng, openApp } = require('../helpers');

test('the thresholds, the block-in and the frames', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    // Otsu splits two clusters between them.
    const vals = [...Array(500).fill(20), ...Array(500).fill(80)];
    const t = stepsOtsu(vals);
    // A noisy straight run is one stroke; a corner keeps its corner.
    const run = Array.from({ length: 50 }, (_, i) => [i, i % 2]);
    const corner = [...Array.from({ length: 20 }, (_, i) => [i, 0]), ...Array.from({ length: 20 }, (_, i) => [19, i + 1])];
    // Every medium's frames, for one picture: all the same size.
    const c = document.createElement('canvas'); c.width = 300; c.height = 200;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 200);
    g.fillStyle = '#555'; g.beginPath(); g.arc(150, 100, 60, 0, 7); g.fill();
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const p = stepsRead(img);
    const frames = Object.fromEntries(Object.keys(STEPS).map(m => [m, stepsFrames(p, m).map(f => `${f.canvas.width}x${f.canvas.height}`)]));
    const a = stepsAnalyse(p);
    return { t, run: stepsSimplify(run, 2).length, corner: stepsSimplify(corner, 2).length, frames, blocks: a.blocks.length,
      vertices: a.blocks[0] && a.blocks[0].length };
  });
  expect(r.t).toBeGreaterThan(20);
  expect(r.t).toBeLessThan(80);
  expect(r.run).toBe(2);
  expect(r.corner).toBe(3);
  expect(r.frames.watercolour).toHaveLength(5);
  expect(r.frames.ink).toHaveLength(4);
  for (const sizes of Object.values(r.frames)) expect(new Set(sizes)).toEqual(new Set(['300x200']));
  // The disc on paper: one shape, blocked in with a few straight lines.
  expect(r.blocks).toBe(1);
  expect(r.vertices).toBeGreaterThan(4);
  expect(r.vertices).toBeLessThan(30);
});

test('a generated picture\'s medium comes from its tags', async ({ page }) => {
  await openApp(page);
  const m = await page.evaluate(() => [['anime', 'ink', 'simple'], ['pencil'], ['flat colour'], ['watercolour'], []].map(stepsMedium));
  expect(m).toEqual(['ink', 'pencil', 'flat', 'watercolour', 'watercolour']);
});

test('from the workspace: step by step, and the medium kept', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="drop"]');
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  if (await page.locator('#wsPanel').isHidden()) await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="learn"]');
  await page.click('#wsList button[data-row="0"]');
  const sheet = page.locator('#stepsSheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('#stepsCount')).toHaveText('Step 1 of 5');
  await expect(page.locator('#stepsPrev')).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stepsStepTitle')).toHaveText('Lines');
  await page.locator('#stepsStrip [data-step="4"]').click();
  await expect(page.locator('#stepsNext')).toBeDisabled();
  // Another medium: its own steps, from the first, and remembered.
  await page.click('#stepsMedia [data-medium="ink"]');
  await expect(page.locator('#stepsCount')).toHaveText('Step 1 of 4');
  await expect(page.locator('#stepsStrip li')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await page.click('#wsList button[data-row="0"]');
  await expect(page.locator('#stepsMedia [data-medium="ink"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Ctrl+K finds it in a session', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="drop"]');
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.keyboard.type('how to draw');
  await page.keyboard.press('Enter');
  await expect(page.locator('#stepsSheet')).toBeVisible();
});
