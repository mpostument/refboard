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
  expect(r.frames.watercolour).toHaveLength(6);
  expect(r.frames.ink).toHaveLength(4);
  for (const sizes of Object.values(r.frames)) expect(new Set(sizes)).toEqual(new Set(['300x200']));
  // The disc on paper: one shape, blocked in with a few straight lines.
  expect(r.blocks).toBe(1);
  expect(r.vertices).toBeGreaterThan(4);
  expect(r.vertices).toBeLessThan(30);
});

test('the whites to save: a catchlight masked, a big white painted round', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    // On paper, a dark-haired head: in it a catchlight (small), a streak
    // of shine (thin) and a white collar (big). The paper round it is not
    // a white to save.
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300);
    g.fillStyle = '#35304a'; g.fillRect(100, 50, 200, 200);
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(150, 100, 4, 0, 7); g.fill();
    g.fillRect(200, 70, 70, 3);
    g.fillRect(130, 160, 110, 60);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const p = stepsRead(img);
    const a = stepsAnalyse(p);
    const at = (x, y) => a.whites.label[y * p.w + x];
    // A pale face: whites among whites, cut up by its lines - no highlights.
    g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300);
    g.strokeStyle = '#999'; g.lineWidth = 2;
    for (let x = 120; x < 300; x += 25) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x + 10, 240); g.stroke(); }
    g.strokeRect(100, 50, 200, 200);
    const img2 = new Image(); img2.src = c.toDataURL(); await img2.decode();
    const b = stepsAnalyse(stepsRead(img2)).whites;
    return { fluid: a.whites.fluid, around: a.whites.around, dot: at(150, 100), streak: at(230, 71), collar: at(180, 190),
      paper: at(20, 20), text: stepsWhitesText(a), pale: b.fluid + b.around, paleText: stepsWhitesText({ whites: b }) };
  });
  expect(r).toMatchObject({ fluid: 2, around: 1, dot: 1, streak: 1, collar: 2, paper: 0, pale: 0 });
  expect(r.text).toContain('Yellow: 2 small whites');
  expect(r.text).toContain('Blue outline: 1 white big enough');
  expect(r.paleText).toContain('Nothing here is left pure white');
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
  await expect(page.locator('#stepsCount')).toHaveText('Step 1 of 6');
  await expect(page.locator('#stepsKey')).toBeHidden();
  await expect(page.locator('#stepsPrev')).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stepsStepTitle')).toHaveText('Lines');
  // The whites: the only step whose frame marks things, so the only one
  // with a key to them.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stepsStepTitle')).toHaveText('Save the whites');
  await expect(page.locator('#stepsKey li')).toHaveText(['Masking fluid', 'Paint round it']);
  await page.locator('#stepsStrip [data-step="5"]').click();
  await expect(page.locator('#stepsKey')).toBeHidden();
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
