// More ways to make in Generate (js/genmore.js): a series with one seed, a movement in words,
// colours pulled to a palette, and four lights from a photo. The server is played by page.route.
const { test, expect, openApp, fakeServer, makePng } = require('../helpers');

async function setup(page) {
  const server = await fakeServer(page);
  const asked = [], id = 'b'.repeat(64);
  const doc = { file: id + '.png', name: 'girl, red hair', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(),
    folder: 'generated', tags: ['anime', 'girl', 'red hair'], prompt: '1girl, solo, red hair', avoid: 'sepia', shape: 'portrait', seed: 77 };
  server.items.set('uploads/' + id, doc);
  await page.route('**/api/generate**', async r => {
    const req = r.request();
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } });
    const made = { ...doc, tags: asked.at(-1).tags, t: Date.now() };
    server.items.set('uploads/' + 'c'.repeat(64), { ...made, file: 'c'.repeat(64) + '.png' });
    return r.fulfill({ json: { state: 'done', upload: { doc: made, url: 'uploads/Generated/x.png' } } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(1);
  return { asked, server };
}

test('a series: one seed for every view, the views weighted, the framing of the choices gone', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await expect(page.locator('#gmViews [data-view]')).toHaveCount(6);
  await page.locator('#gmViews [data-view=below]').click();
  await page.locator('#gmSeries').click();
  await expect(page.locator('#genStatus')).toContainText('4 views of one scene');
  expect(asked).toHaveLength(4);
  expect(new Set(asked.map(a => a.seed)).size).toBe(1);
  expect(asked[0].seed).toBeGreaterThan(0);
  expect(asked[0].prompt).toContain('(wide shot, full scene:1.3)'.replace('wide shot, full scene', 'wide shot'));
  expect(asked[1].prompt).toContain('(close-up:1.3)');
  expect(asked.every(a => !a.prompt.includes('full body') && a.tags.includes('series'))).toBe(true);
  expect(new Set(asked.map(a => a.prompt)).size).toBe(4);
});

test('a series needs two views', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  for (const v of ['wide', 'close']) await page.locator(`#gmViews [data-view=${v}]`).click();
  await page.locator('#gmSeries').click();
  await expect(page.locator('#genStatus')).toHaveText('Choose at least two views.');
  expect(asked).toHaveLength(0);
});

test('a movement in Ukrainian or English becomes tags in More tags, kept as they are typed', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => { await loadSection('genmore'); return { a: genMoveTags('біжить, озирається'), b: genMoveTags('jumping and waving'), c: genMoveTags('щось дивне') }; });
  expect(r.a.tags).toEqual(expect.arrayContaining(['running', 'looking back', 'over shoulder']));
  expect(r.b.tags).toEqual(expect.arrayContaining(['jumping', 'waving']));
  expect(r.c.tags).toHaveLength(0);
  expect(r.c.unknown).toEqual(['щось дивне']);
  await page.locator('#genMore summary').click();
  await page.fill('#genExtra', 'hat');
  await page.fill('#genMoveText', 'біжить');
  await page.click('#gmMove');
  await expect(page.locator('#genExtra')).toHaveValue(/^hat, running/);
  await expect(page.locator('#genStatus')).toContainText('Added to More tags');
});

test('Colours to a palette: the picture and the pulled one, what moved, and a new picture kept', async ({ page }) => {
  const { server } = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-pull').first().click();
  await expect(page.locator('#pullSheet')).toBeVisible();
  await expect(page.locator('#pullSource [data-source=box]')).toHaveAttribute('aria-pressed', 'true');
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 40;
    const g = c.getContext('2d'); g.fillStyle = '#d83030'; g.fillRect(0, 0, 40, 40);
    const out = genPullCanvas(c, [[40, 90, 200]], 1);
    const px = out.getContext('2d').getImageData(5, 5, 1, 1).data;
    return { px: [...px], changes: genPullChanges(c, out), none: genPullCanvas(c, [[128, 128, 128]], 1) };
  });
  expect(r.px[2]).toBeGreaterThan(r.px[0]);         // red became blue
  expect(r.changes[0].share).toBeCloseTo(100, 0);
  expect(r.none).toBeNull();
  await page.locator('#pullAmount [data-amount="0.35"]').click();
  await expect(page.locator('#pullAmount [data-amount="0.35"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pullSource [data-source=palette]').click();
  await expect(page.locator('#pullNote')).toContainText('no palette yet');
  await expect(page.locator('#pullKeep')).toBeDisabled();
  await page.locator('#pullSource [data-source=box]').click();
  await expect(page.locator('#pullKeep')).toBeEnabled();
  const before = server.items.size;
  await page.locator('#pullKeep').click();
  await expect(page.locator('#pullNote')).toContainText('Kept in Made here');
  expect(server.items.size).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pullSheet')).toBeHidden();
});

test('Four lights from a photo: four requests from the photo, each with its own light', async ({ page }) => {
  const { asked } = await setup(page);
  await expect(page.locator('#genSourceLights')).toHaveCount(0);
  await page.locator('#genPickInput').setInputFiles({ name: 'cup.png', mimeType: 'image/png', buffer: makePng(64, 64, () => [200, 160, 120]) });
  await expect(page.locator('#genSourceLights')).toBeVisible();
  await page.locator('#genSourceLights').click();
  await expect(page.locator('#genStatus')).toHaveText('Four lights from the photo - in Uploads, Generated.');
  expect(asked).toHaveLength(4);
  expect(asked.every(a => a.image && a.image.length > 100 && a.denoise >= 0.55)).toBe(true);
  expect(asked[0].prompt).toContain('(soft lighting:1.3)');
  expect(asked[2].prompt).toContain('(backlighting:1.3)');
  expect(asked[3].tags).toContain('low key');
});
