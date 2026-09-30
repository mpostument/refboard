// The whole app as GitHub Pages serves it: every section opens, and the
// main paths work end to end. Any uncaught error or console.error fails the
// test (see helpers.js).
const { test, expect, quadrantsPng, openApp } = require('../helpers');

test('with no library, the sample pack stands in, and draws', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#summary')).toContainText('sample pack');
  await expect(page.locator('#appVersion')).toHaveText(/^v\d+\.\d+\.\d+/);
  await expect(page.locator('#packsSection')).toContainText('Samples');
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(6);
  // Every picture in it is there, and decodes.
  await expect.poll(() => page.$$eval('#thumbGrid .cell img', is => is.filter(i => i.naturalWidth > 0).length)).toBe(6);
  await page.locator('#thumbGrid .cell').first().click();
  await expect(page.locator('#img')).toHaveAttribute('src', /samples\/.+\.jpg$/);
});

test('with neither a library nor the samples, the library parts stay hidden', async ({ page }) => {
  await page.route('**/samples/index.json', r => r.fulfill({ status: 404, body: '' }));
  await openApp(page);
  await expect(page.locator('#summary')).toContainText('No image library connected');
  await expect(page.locator('.nav-item[data-view="all"]')).toBeHidden();
});

const SECTIONS = [
  { view: 'drop', shows: '#dropZone' },
  { view: 'colour', shows: '#viewColour' },
  { view: 'train', shows: '#viewTrain .train-card' },
  { view: 'forms', shows: '#viewForms canvas' },
  { view: 'dashboard', shows: '#viewDashboard' },
];

test('every section opens', async ({ page }) => {
  await openApp(page);
  for (const s of SECTIONS) {
    await page.click(`.nav-item[data-view="${s.view}"]`);
    await expect(page.locator(`.nav-item[data-view="${s.view}"]`)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator(s.shows).first()).toBeVisible();
  }
});

test('help opens with ? and closes with Escape', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('?');
  await expect(page.locator('#helpOverlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpOverlay')).toBeHidden();
});

test('a dropped image opens a session, and the eyedropper gives recipes', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#img')).toBeVisible();

  // Top-left quadrant: skin. A quarter in from the corner, well inside it.
  await page.click('#btnEyedropper');
  const box = await page.locator('#img').boundingBox();
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 4);
  await expect(page.locator('#eyedropperReadout')).toContainText('#e0ac8c');

  // Watercolour is the default medium: several ways to mix it, none with white.
  const guide = page.locator('#mixGuide');
  expect(await guide.locator('.mix-row').count()).toBeGreaterThanOrEqual(2);
  // (Rows only: the note under them says "white is the paper".)
  const rows = guide.locator('.mix-row');
  await expect(rows.filter({ hasText: /white/i })).toHaveCount(0);

  // In oil or acrylic a light skin tone needs white.
  // Not one of the materials yet: added from the select's My materials...
  await page.selectOption('#mediumSelect', 'edit');
  await page.check('#materialsList [data-have="opaque"]');
  await page.check('#materialsList [data-main="opaque"]');
  await page.keyboard.press('Escape');
  await expect(page.locator('#materials')).toBeHidden();
  await expect(page.locator('#mediumSelect')).toHaveValue('opaque');
  await expect(rows.filter({ hasText: /white/i }).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#session')).toBeHidden();
});

test('the colour studio finds a palette and shows where each colour is', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  // The studio's scripts load on first open: a file chosen before its
  // input has a listener is dropped.
  await page.waitForFunction(() => typeof col !== 'undefined' && col);
  await page.setInputFiles('#colInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  const swatches = page.locator('#colPalette .col-sw');
  await expect(swatches.first()).toBeVisible();
  expect(await swatches.count()).toBeGreaterThanOrEqual(4);

  // Clicking a swatch pins it, and the picture dims everything else.
  await swatches.first().click();
  await expect(swatches.first()).toHaveClass(/pinned/);
});
