// The whole app as GitHub Pages serves it: every section opens, and the
// main paths work end to end. Any uncaught error or console.error fails the
// test (see helpers.js).
const { test, expect, quadrantsPng, openApp } = require('../helpers');

test('boots with no library and shows the version', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#summary')).toContainText('No image library connected');
  await expect(page.locator('#appVersion')).toHaveText(/^v\d+\.\d+\.\d+/);
  // No backend, so the library-only parts stay out of the way.
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
  await page.selectOption('#mediumSelect', 'opaque');
  await expect(rows.filter({ hasText: /white/i }).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#session')).toBeHidden();
});

test('the colour studio finds a palette and shows where each colour is', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.setInputFiles('#colInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  const swatches = page.locator('#colPalette .col-sw');
  await expect(swatches.first()).toBeVisible();
  expect(await swatches.count()).toBeGreaterThanOrEqual(4);

  // Clicking a swatch pins it, and the picture dims everything else.
  await swatches.first().click();
  await expect(swatches.first()).toHaveClass(/pinned/);
});
