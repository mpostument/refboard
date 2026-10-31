// Generate's Simple forms and History (js/genpick.js).
const { test, expect, openApp, fakeServer } = require('../helpers');

async function setup(page) {
  const server = await fakeServer(page);
  for (const [n, t, prompt] of [['b', 5000, '1girl, red hair'], ['c', 0, '1girl, blue hair, rain']]) {
    const id = n.repeat(64);
    server.items.set('uploads/' + id, { file: id + '.png', name: 'girl', type: 'image/png', from: 'generate', bytes: 100, t: Date.now() - t,
      folder: 'generated', tags: ['anime'], prompt, avoid: 'sepia', shape: 'portrait', seed: 77 });
  }
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(2);
  await page.locator('#genMore summary').click();
}

test('simple forms: one job for each way, one seed, and the colour kept out', async ({ page }) => {
  await setup(page);
  await page.locator('#gpFormsBlock summary').click();
  const r = await page.evaluate(() => {
    const base = { prompt: '1girl, red hair', avoid: 'blur', tags: ['anime'] };
    return { jobs: gpFormsJobs(base, GP_FORMS, 5), picked: gpFormsPicked() };
  });
  expect(r.jobs.length).toBe(3);
  expect(new Set(r.jobs.map(j => j.seed))).toEqual(new Set([5]));
  expect(new Set(r.jobs.map(j => j.prompt)).size).toBe(3);
  for (const j of r.jobs) { expect(j.prompt).toContain('1girl'); expect(j.avoid).toContain('blur'); expect(j.avoid).toContain('colour'); expect(j.tags).toContain('simple forms'); }
  expect(r.picked).toEqual(['mannequin', 'blocks']);
  await page.locator('#gpForms [data-v=blocks]').click();
  await expect(page.locator('#gpForms [data-v=blocks]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => gpFormsPicked())).toEqual(['mannequin']);
  await page.locator('#gpForms [data-v=mannequin]').click();
  await page.locator('#gpFormsGo').click();
  await expect(page.locator('#genStatus')).toContainText('at least one');
});

test('history: the latest first, a pin that stays, and a picture drawn again with a new seed', async ({ page }) => {
  await setup(page);
  await page.locator('#gpHisBlock summary').click();
  await page.locator('#gpHisGo').click();
  await expect(page.locator('#hisSheet')).toBeVisible();
  const rows = page.locator('#hisList .gp-his-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('blue hair');
  await rows.nth(1).locator('[data-act=pin]').click();
  await page.locator('#hisFilter [data-v=pinned]').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('red hair');
  await page.keyboard.press('Escape');
  await expect(page.locator('#hisSheet')).toBeHidden();
  expect(await page.evaluate(() => gpPins().length)).toBe(1);
  await page.evaluate(() => { window.__jobs = null; runGenerate = jobs => { window.__jobs = jobs; }; });
  await page.locator('#gpHisGo').click();
  await page.locator('#hisList .gp-his-row').first().locator('[data-act=again]').click();
  const job = await page.evaluate(() => window.__jobs[0]);
  expect(job.prompt).toBe('1girl, blue hair, rain');
  expect(job.seed).not.toBe(77);
  expect(job.tags).toContain('again');
  await expect(page.locator('#hisSheet')).toBeHidden();
});
