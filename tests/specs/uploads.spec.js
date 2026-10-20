// Saving what is uploaded, as GitHub Pages runs it: no backend, so kept
// until a reload - or, with "Keep in this browser", in IndexedDB.
const { test, expect, openApp, quadrantsPng, makePng, fakeServer } = require('../helpers');

test.use({ dropStudy: false });

const drop = (page, name, png = quadrantsPng()) =>
  page.setInputFiles('#dropInput', { name, mimeType: 'image/png', buffer: png });

test('a dropped picture is listed, says it is not saved, and opens again', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#uploadsWhere')).toContainText('Not saved in this version');
  await drop(page, 'quads.png');
  await expect(page.locator('#session')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  await expect(page.locator('#uploadsList .up-open')).toHaveAttribute('aria-label', 'Open quads.png');

  await page.click('#uploadsList .up-open');
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#wsPanel')).toBeVisible();
});

test('kept in this browser, it survives a reload - and can be forgotten', async ({ page }) => {
  await openApp(page);
  await page.check('#optKeep');
  await expect(page.locator('#uploadsWhere')).toContainText('Kept in this browser');
  await drop(page, 'red.png', makePng(20, 20, () => [200, 30, 30]));
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  await expect(page.locator('#optKeep')).toBeChecked();
  // The same picture twice is kept once.
  await drop(page, 'red again.png', makePng(20, 20, () => [200, 30, 30]));
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);

  await page.locator('#uploadsList .up-tile').hover();
  await page.click('#uploadsList .up-forget');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(0);
});

test('a photo of your drawing in Compare is kept too', async ({ page }) => {
  await openApp(page);
  await drop(page, 'ref.png');
  await page.setInputFiles('#cmpInput', { name: 'my drawing.png', mimeType: 'image/png', buffer: makePng(30, 30, () => [240, 240, 240]) });
  await expect(page.locator('#compareBar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList [aria-label="Open my drawing.png"]')).toHaveCount(1);
});

test('one dropped image opens whole; as a value study only when asked, and that is remembered', async ({ page }) => {
  await openApp(page);
  await drop(page, 'plain.png');
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#wsPanel')).toBeHidden();
  await page.keyboard.press('Escape');

  await page.check('#optDropStudy');
  await drop(page, 'study.png', makePng(20, 20, () => [10, 200, 90]));
  await expect(page.locator('#wsPanel')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.locator('#optDropStudy')).toBeChecked();
});

test('what the app drew is listed apart from uploads, and a file deleted by hand is not listed', async ({ page }) => {
  const server = await fakeServer(page);
  const doc = (n, extra) => ({ file: n.repeat(64) + '.png', name: n, type: 'image/png', bytes: 1, t: Date.now(), ...extra });
  server.items.set('uploads/' + 'a'.repeat(64), doc('a', { from: 'drop' }));
  server.items.set('uploads/' + 'b'.repeat(64), doc('b', { from: 'generate', folder: 'generated' }));
  server.items.set('uploads/' + 'c'.repeat(64), doc('c', { from: 'drop', orphan: true }));
  await openApp(page);
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  await expect(page.locator('#uploadsList .up-open')).toHaveAttribute('aria-label', 'Open a');
  await expect(page.locator('#generatedList .up-open')).toHaveAttribute('aria-label', /^Open b/);
  // The orphan's document went with it.
  await expect.poll(() => server.items.has('uploads/' + 'c'.repeat(64))).toBe(false);

  await page.locator('#generatedList .up-tile').hover();
  await page.click('#generatedList .up-forget');
  await expect(page.locator('#generated')).toBeHidden();
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
});
