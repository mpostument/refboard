// Gesture warm-up (js/warmup.js): figures made for you, shown on a clock.
const { test, expect, openApp, fakeServer } = require('../helpers');

// A ComfyUI that makes a picture at once, each its own document.
async function comfy(page, asked, cancelled = []) {
  const server = await fakeServer(page);
  await page.route('**/api/generate**', async r => {
    const req = r.request();
    if (req.method() === 'POST' && req.url().endsWith('/cancel')) { cancelled.push(req.url()); return r.fulfill({ status: 204 }); }
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job' + asked.length } }); }
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } });
    const n = asked.length, id = String(n).repeat(64).slice(0, 64);
    const doc = { file: id + '.png', name: 'pose ' + n, type: 'image/png', from: 'generate', bytes: 100, t: Date.now(), folder: 'generated', tags: asked[n - 1].tags };
    server.items.set('uploads/' + id, doc);
    return r.fulfill({ json: { state: 'done', upload: { doc, url: 'uploads/Generated/' + id + '.png' } } });
  });
  return server;
}

test('a figure is made whole, from a side, in a pose of its own; a run has no pose twice', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const req = warmRequest('running', { ...GEN_DEFAULTS, character: 'frieren, sousou no frieren', framing: 'head', view: 'front' }, 'profile');
    const poses = warmPoses(10);
    return { req, unique: new Set(poses).size, long: warmPoses(WARM_POSES.length + 3).length };
  });
  expect(r.req.prompt).toContain('full body');
  expect(r.req.prompt).toContain('running');
  expect(r.req.prompt).toContain('profile');
  expect(r.req.prompt).toContain('frieren');
  expect(r.req.prompt).not.toContain('portrait, close-up');
  expect(r.req.tags).toContain('gesture warm-up');
  expect(r.unique).toBe(10);
  // More poses than there are in the list: it goes round again.
  expect(r.long).toBe(33);
});

test('a run: the first shows when made, each stays its time, then the end says what was done', async ({ page }) => {
  const asked = [];
  await comfy(page, asked);
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genWarmN option')).toHaveCount(3);
  await expect(page.locator('#genWarmT option')).toHaveText(['30 seconds each', '1 minute each', '2 minutes each']);
  // The button path starts it (30 s each - too long to wait here), then a quick run by hand.
  await page.locator('#genWarmGo').click();
  await expect(page.locator('#warmup')).toBeVisible();
  await expect(page.locator('#genGo')).toHaveText('Stop');
  await page.keyboard.press('Escape');
  await expect(page.locator('#warmup')).toBeHidden();
  await expect(page.locator('#genGo')).toHaveText('Generate');

  await page.evaluate(() => { warmStart({ n: 3, secs: 1 }); });
  await expect(page.locator('#warmup')).toBeVisible();
  await expect(page.locator('#warmup .warm-count')).toHaveText('1 / 3');
  await expect(page.locator('#warmup img')).toBeVisible();
  await expect(page.locator('#warmup .warm-say')).toContainText('Done - 3 poses', { timeout: 15_000 });
  await expect(page.locator('#warmup [data-warm="stop"]')).toHaveText('Close');
  // Each figure had its own request, whole and tagged.
  const mine = asked.slice(-3);
  expect(mine).toHaveLength(3);
  for (const q of mine) { expect(q.prompt).toContain('full body'); expect(q.tags).toContain('gesture warm-up'); }
  expect(new Set(mine.map(q => q.prompt)).size).toBe(3);
  await page.locator('#warmup [data-warm="stop"]').click();
  await expect(page.locator('#warmup')).toBeHidden();
});

test('Stop cancels the figure in hand and the rest are not made; Space pauses the clock', async ({ page }) => {
  const asked = [], cancelled = [];
  await comfy(page, asked, cancelled);
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.evaluate(() => { warmStart({ n: 5, secs: 30 }); });
  await expect(page.locator('#warmup img')).toBeVisible();
  const clock = () => page.locator('#warmup .warm-clock').textContent();
  await page.keyboard.press(' ');
  await expect(page.locator('#warmup .warm-say')).toHaveText('Paused');
  const was = await clock();
  await page.waitForTimeout(1300);
  expect(await clock()).toBe(was);
  await page.keyboard.press(' ');
  await page.locator('#warmup [data-warm="stop"]').click();
  await expect(page.locator('#warmup')).toBeHidden();
  const made = asked.length;
  await page.waitForTimeout(800);
  expect(asked.length).toBe(made);   // none started after the Stop
  expect(made).toBeLessThan(5);
});
