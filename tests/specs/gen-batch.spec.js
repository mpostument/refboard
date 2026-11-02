// A batch made in one go is shown side by side (js/generate.js genBatchShow).
const { test, expect, openApp, fakeServer } = require('../helpers');

test('two pictures made together are offered side by side; Keep all closes the strip', async ({ page }) => {
  await fakeServer(page);
  let n = 0;
  await page.route('**/api/generate**', r => {
    const req = r.request(), url = req.url();
    if (req.method() === 'POST') { n++; return r.fulfill({ status: 202, json: { id: 'job' + n } }); }
    if (url.endsWith('/api/generate')) return r.fulfill({ json: { available: true, configured: true, quality: 'q', negative: 'n' } });
    const id = url.split('/').pop();
    return r.fulfill({ json: { state: 'done', upload: { file: id + '.png', name: id, type: 'image/png', t: n, tags: [] } } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.selectOption('#genCount', '2');
  await page.click('#genGo');
  await expect(page.locator('#genBatch .gen-batch-cell')).toHaveCount(2);
  await page.click('#genBatchAll');
  await expect(page.locator('#genBatch')).toBeHidden();
});
