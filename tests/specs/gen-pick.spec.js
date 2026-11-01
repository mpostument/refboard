// Generate's palette from a picture, colours from your own set, and what changed between two pictures (js/genpick.js).
const { test, expect, openApp, fakeServer, makePng } = require('../helpers');

async function setup(page, extra = []) {
  const server = await fakeServer(page);
  const make = (n, over) => {
    const id = n.repeat(64).slice(0, 64);
    const doc = { file: id + '.png', name: 'girl', type: 'image/png', from: 'generate', bytes: 100, t: Date.now() - (n === 'b' ? 5000 : 0),
      folder: 'generated', tags: ['anime', 'girl'], prompt: '1girl, solo, red hair', avoid: 'sepia', shape: 'portrait', seed: 77, ...over };
    server.items.set('uploads/' + id, doc);
  };
  make('b', {}); make('c', { prompt: '1girl, solo, blue hair, rain', avoid: 'sepia, blur', seed: 78 });
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(2);
  await page.locator('#genMore summary').click();
  return server;
}

test('a palette from a picture: the colours of the picture become Your palette', async ({ page }) => {
  await setup(page);
  await page.locator('#gpPalBlock summary').click();
  await expect(page.locator('#gpPalUse')).toBeDisabled();
  await page.locator('#gpPalInput').setInputFiles({ name: 'red.png', mimeType: 'image/png', buffer: makePng(40, 40, () => [200, 40, 40]) });
  await expect(page.locator('#gpPalSw .gp-sw')).toHaveCount(1);
  await expect(page.locator('#gpPalNote')).toContainText('1 colours');
  await page.locator('#gpPalLock').check();
  await page.locator('#gpPalUse').click();
  const ch = await page.evaluate(() => ({ colours: genChoices.colours, lock: genChoices.lock, palette: genChoices.palette }));
  expect(ch.colours).toBe('palette'); expect(ch.lock).toBe('on');
  expect(ch.palette.length).toBe(1);
  expect(ch.palette[0][0]).toBeGreaterThan(150); expect(ch.palette[0][1]).toBeLessThan(90);
});

test('colours from my set: the markers marked as yours, and the Holbein box for watercolour', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { genChoices.medium = 'watercolour'; saveGenChoices(); });
  await page.locator('#gpSetBlock summary').click();
  await page.locator('#gpSetGo').click();
  expect(await page.evaluate(() => [genChoices.colours, genChoices.lock])).toEqual(['box', 'on']);
  await page.evaluate(() => { genChoices.medium = 'copic'; localStorage.setItem('refboard.fewpaints.v1', JSON.stringify({ own: { copic: ['R29', 'B29', 'nothing-here'] } })); });
  await page.locator('#gpSetGo').click();
  await expect(page.locator('#genStatus')).toContainText('markers');
  const ch = await page.evaluate(() => ({ colours: genChoices.colours, lock: genChoices.lock, n: genChoices.palette.length, total: COPIC_COLOURS.length, codes: COPIC_COLOURS.filter(m => ['R29', 'B29'].includes(m.code)).length }));
  expect(ch.colours).toBe('palette'); expect(ch.lock).toBe('on');
  expect(ch.n).toBe(ch.codes);
  expect(ch.n).toBeLessThan(ch.total);
  await page.evaluate(() => { genChoices.medium = 'ink'; });
  await page.locator('#gpSetGo').click();
  await expect(page.locator('#genStatus')).toContainText('grey');
});
