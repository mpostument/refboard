// Presets by medium (js/presets.js): a kind of session in one press. It moves the
// controls that were already there, follows them, and switches on its overlays
// when the session starts.
const { test, expect, makePng, openApp } = require('../helpers');

const chip = (page, id) => page.locator(`#sessionPresets [data-preset="${id}"]`);
const pressed = page => page.locator('#sessionPresets [aria-pressed="true"]');
const png = () => makePng(200, 200, (x, y) => Math.hypot(x - 100, y - 100) < 60 ? [60, 60, 70] : [240, 240, 240]);

test('six kinds of session, each with its length; pressing one sets the interval, the schedule and the checkboxes', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#sessionPresets .chip')).toHaveCount(6);
  await expect(pressed(page)).toHaveCount(0);

  await chip(page, 'liner').click();
  await expect(chip(page, 'liner')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => ({ secs: state.secs, stages: el('optStages').checked, gray: el('optGray').checked }))).toEqual({ secs: 300, stages: false, gray: false });
  await expect(page.locator('#intervals .chip', { hasText: '5:00' }).or(page.locator('#intervals .chip[aria-pressed="true"]'))).toBeVisible();
  await expect(page.locator('#presetHint')).toContainText('heavy on the shadow side');
  await expect(page.locator('#presetHint')).toContainText('line weight');
  await expect(page.locator('#presetHint')).not.toContainText('Grayscale is on');
  await chip(page, 'pencil').click();
  await expect(page.locator('#presetHint')).toContainText('Grayscale is on');
  await chip(page, 'liner').click();

  await chip(page, 'watercolour').click();
  expect(await page.evaluate(() => ({ secs: state.secs, stages: el('optStages').checked, gray: el('optGray').checked, custom: el('customSecs').value }))).toEqual({ secs: 2700, stages: true, gray: false, custom: '2700' });

  await chip(page, 'pencil').click();
  expect(await page.evaluate(() => ({ secs: state.secs, stages: el('optStages').checked, gray: el('optGray').checked }))).toEqual({ secs: 1200, stages: false, gray: true });

  await chip(page, 'gesture').click();
  await expect(page.locator('#schedules .chip[data-key="warmup"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => state.secs)).toBe(60);
  await expect(pressed(page)).toHaveCount(1);
});

test('the chip follows the controls: a hand on them moves it off, and putting them back moves it on', async ({ page }) => {
  await openApp(page);
  await chip(page, 'liner').click();
  await page.locator('#intervals .chip', { hasText: '0:30' }).click();
  await expect(pressed(page)).toHaveCount(0);
  await expect(page.locator('#presetHint')).toContainText('Pick a kind of session');
  await page.locator('#customSecs').fill('300');
  await expect(chip(page, 'liner')).toHaveAttribute('aria-pressed', 'true');
  // The checkbox too: grey on makes it another kind, or none.
  // (Grayscale lives on the Display tab, out of sight: set it the way its own listener hears it.)
  const gray = on => page.evaluate(on => { el('optGray').checked = on; el('optGray').dispatchEvent(new Event('change', { bubbles: true })); }, on);
  await gray(true);
  await expect(pressed(page)).toHaveCount(0);
  await page.check('#optStages');
  await page.uncheck('#optStages');
  await gray(false);
  await expect(chip(page, 'liner')).toHaveAttribute('aria-pressed', 'true');
});

test('every kind is told from the others by its controls alone, and names layers that exist', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ({
    keys: SESSION_PRESETS.map(p => [p.secs, p.schedule, p.stages, p.gray].join('|')),
    missing: SESSION_PRESETS.flatMap(p => p.layers.filter(id => !LAYERS.some(l => l.id === id))),
    each: SESSION_PRESETS.map(p => { presetApply(p); return presetMatching()?.id; }),
    ids: SESSION_PRESETS.map(p => p.id),
  }));
  expect(new Set(r.keys).size).toBe(r.keys.length);
  expect(r.missing).toEqual([]);
  expect(r.each).toEqual(r.ids);
});

test('a session starts with the overlays of the kind chosen; with none chosen, with none', async ({ page }) => {
  await openApp(page);
  await chip(page, 'liner').click();
  await page.setInputFiles('#dropInput', { name: 'ball.png', mimeType: 'image/png', buffer: png() });
  await expect(page.locator('#session')).toBeVisible();
  expect(await page.evaluate(() => state.lineWeightOn)).toBe(true);
  await expect(page.locator('#btnLineWeight')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lineOverlay')).toBeVisible();
  expect(await page.evaluate(() => state.rangeOn || state.hatchOn || state.jarsOn)).toBeFalsy();

  // And a session with the controls changed by hand: no preset, no overlay.
  await page.reload();
  await page.locator('#intervals .chip', { hasText: '0:30' }).click();
  await page.setInputFiles('#dropInput', { name: 'ball.png', mimeType: 'image/png', buffer: png() });
  await expect(page.locator('#session')).toBeVisible();
  expect(await page.evaluate(() => state.lineWeightOn || state.rangeOn)).toBeFalsy();
});

test('the watercolour study: stages on, the paper\'s range on, and the settings are kept over a reload', async ({ page }) => {
  await openApp(page);
  await chip(page, 'watercolour').click();
  await page.reload();
  await expect(chip(page, 'watercolour')).toHaveAttribute('aria-pressed', 'true');
  await page.setInputFiles('#dropInput', { name: 'ball.png', mimeType: 'image/png', buffer: png() });
  await expect(page.locator('#session')).toBeVisible();
  expect(await page.evaluate(() => ({ range: state.rangeOn, stage: state.stage !== null && state.stage !== undefined }))).toEqual({ range: true, stage: true });
});
