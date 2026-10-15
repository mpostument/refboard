// Generate when a ComfyUI is set up and not answering (js/generate.js
// genCheck): the button stays, the view says why and asks again; with none set
// up, or on a server too old to say, there is nothing to show.
const { test, expect, openApp, fakeServer } = require('../helpers');

const NAV = '.nav-item[data-view="generate"]';
const DOWN = { available: false, configured: true, reason: 'ComfyUI is not answering - is the machine it runs on awake, and reachable from this server?' };
const UP = { available: true, configured: true, quality: 'masterpiece', negative: 'lowres' };

test('set up and not answering: the button stays, the reason shows, Generate is off; asking again finds it up', async ({ page }) => {
  await fakeServer(page);
  let answer = DOWN;
  await page.route('**/api/generate', r => r.request().method() === 'GET' ? r.fulfill({ json: answer }) : r.fulfill({ status: 202, json: { id: 'j' } }));
  await openApp(page);
  await expect(page.locator(NAV)).toBeVisible();
  await page.locator(NAV).click();
  await expect(page.locator('#genOffline')).toBeVisible();
  await expect(page.locator('#genOfflineText')).toContainText('not answering');
  await expect(page.locator('#genGo')).toBeDisabled();
  // Other views do not offer Generate while it is down.
  expect(await page.evaluate(() => genAvailable())).toBe(false);
  // It comes back: Check again.
  answer = UP;
  await page.click('#genRetry');
  await expect(page.locator('#genOffline')).toBeHidden();
  await expect(page.locator('#genGo')).toBeEnabled();
  expect(await page.evaluate(() => genAvailable())).toBe(true);
});

test('none set up, or a server too old to say: no button at all', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: false, configured: false, reason: 'No ComfyUI is set up (COMFY_URL).' } }));
  await openApp(page);
  await expect(page.locator(NAV)).toBeHidden();
  expect(await page.evaluate(() => genAvailable())).toBe(false);
});

test('an older server that says only "available: false" is not taken for a ComfyUI that is down', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: false, reason: 'No ComfyUI is set up (COMFY_URL).' } }));
  await openApp(page);
  await expect(page.locator(NAV)).toBeHidden();
});
