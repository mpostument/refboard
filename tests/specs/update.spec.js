// Asset stamps (scripts/stamp-assets.js) and the "new version ready" notice
// they make possible.
const { execFileSync } = require('child_process');
const path = require('path');
const { test, expect, openApp, quadrantsPng } = require('../helpers');

test('every script and stylesheet carries an up-to-date stamp', async ({ page }) => {
  // The same check CI runs - here so a local test run catches it too.
  execFileSync(process.execPath, [path.join(__dirname, '../../scripts/stamp-assets.js'), '--check']);
  // And the page really loads the stamped URLs.
  const loaded = [];
  page.on('request', r => { if (/\/(js|css)\//.test(r.url())) loaded.push(r.url()); });
  await openApp(page);
  expect(loaded.length).toBeGreaterThan(10);
  for (const u of loaded) expect(u).toMatch(/\?v=[0-9a-f]{8}$/);
});

// What a tab does on coming back into view, minus the ten-minute wait.
const cameBack = page => page.evaluate(() => {
  lastUpdateCheck = 0;
  document.dispatchEvent(new Event('visibilitychange'));
});

test('no notice while the deployed page is the same', async ({ page }) => {
  await openApp(page);
  await cameBack(page);
  await page.waitForTimeout(300);
  await expect(page.locator('#updateReady')).toBeHidden();
});

test('a tab that outlived a deploy offers to reload', async ({ page }) => {
  await openApp(page);
  // From now on the server "has" a new paint.js.
  await page.route('**/index.html', async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/js\/paint\.js\?v=[0-9a-f]+/, 'js/paint.js?v=00000000');
    await route.fulfill({ response: res, body });
  });
  await cameBack(page);
  await expect(page.locator('#updateReady')).toBeVisible();

  // Never over a running session: reloading would lose it.
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#updateReady')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#updateReady')).toBeVisible();

  await page.unroute('**/index.html');
  await page.click('#updateReady');
  await page.waitForLoadState('load');
  await expect(page.locator('#updateReady')).toBeHidden();
});
