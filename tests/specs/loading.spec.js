// Fast loading: a section's code comes the first time it is opened, not
// with the page.
const { test, expect, openApp } = require('../helpers');

const LAZY = /js\/(forms|forms-models|colour)\.js/;

test('the 3D view and the Colour studio load only when opened', async ({ page }) => {
  const loaded = [];
  page.on('request', r => { const m = r.url().match(LAZY); if (m) loaded.push(m[1]); });
  await openApp(page);
  expect(loaded).toEqual([]);
  // What the session's Compare needs from the 3D code is there without it.
  expect(await page.evaluate(() => wrap180(190))).toBe(-170);

  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colEmpty')).toBeVisible();
  await expect.poll(() => loaded).toEqual(['colour']);

  await page.click('.nav-item[data-view="forms"]');
  await expect.poll(() => [...loaded].sort()).toEqual(['colour', 'forms', 'forms-models']);
});

test('the code starts coming as the pointer reaches the button', async ({ page }) => {
  await openApp(page);
  const req = page.waitForRequest(LAZY);
  await page.hover('.nav-item[data-view="forms"]');
  await req;
});

test.describe('offline', () => {
  test.use({ allowErrors: /colour\.js/ });
  test('a section that could not load says so, and loads on the next try', async ({ page }) => {
    await openApp(page);
    await page.route('**/js/colour.js*', r => r.abort());
    await page.click('.nav-item[data-view="colour"]');
    await expect(page.locator('#viewMeta')).toContainText('could not load');
    await page.unroute('**/js/colour.js*');
    await page.click('.nav-item[data-view="dashboard"]');
    await page.click('.nav-item[data-view="colour"]');
    await expect(page.locator('#colEmpty')).toBeVisible();
    await expect(page.locator('#viewMeta')).not.toContainText('could not load');
  });
});
