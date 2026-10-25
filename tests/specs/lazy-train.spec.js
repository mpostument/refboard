// The trainers (js/train.js) load when Train is first opened; the colour
// helpers they shared with the rest of the app live in js/colourmath.js.
const { test, expect, openApp } = require('../helpers');

test('the trainers load when Train is opened, the shared helpers with the page', async ({ page }) => {
  await openApp(page);
  const before = await page.evaluate(() => ({
    helpers: typeof lchRgb === 'function' && typeof lstar === 'function' && typeof loadImg === 'function',
    trainers: typeof TRAINERS,
    script: [...document.scripts].some(s => /js\/train\.js/.test(s.src)),
  }));
  expect(before).toEqual({ helpers: true, trainers: 'undefined', script: false });

  await page.click('.nav-item[data-view="train"]');
  await expect(page.locator('#viewTrain .train-card').first()).toBeVisible();
  expect(await page.evaluate(() => typeof TRAINERS)).toBe('object');

  // Ctrl+K lists the trainers before their code is there, so it keeps its own
  // list: it must say what the trainers say.
  const same = await page.evaluate(() => JSON.stringify(TRAINER_COMMANDS) === JSON.stringify(TRAINERS.map(t => [t.id, t.title, t.blurb])));
  expect(same).toBe(true);
});

test('Ctrl+K opens a trainer on a page that has not loaded them yet', async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => typeof startTrainer)).toBe('undefined');
  await page.click('#btnFind');
  await page.keyboard.type('negative space');
  await page.keyboard.press('Enter');
  await expect(page.locator('#viewTrain .train-head b')).toHaveText('Negative space');
});
