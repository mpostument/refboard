// Generate references (js/generate.js): pictures made to order by a ComfyUI
// the server knows about. No ComfyUI here - the server's side is played by
// page.route (see fakeServer in helpers.js), and it answers each job with a
// stored picture, as Services/ComfyClient.cs does.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('the choices become the model\'s tags and the words it is filed under', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, hair: 'twintails', colour: 'pink', view: 'three', light: 'back' }, 'hat, rain'));
  expect(r.prompt).toBe('1girl, solo, twintails, pink hair, upper body, three quarter view, backlighting, rim lighting, ' +
    'watercolor (medium), traditional media, lineart, simple background, white background, hat, rain');
  expect(r.tags).toEqual(['girl', 'twin tails', 'pink hair', 'bust', 'three-quarter', 'backlit', 'watercolour', 'hat', 'rain']);
  expect(r.shape).toBe('portrait');
  // A head is square; "any" adds nothing.
  const head = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, framing: 'head' }));
  expect(head.shape).toBe('square');
  expect(head.prompt.startsWith('1girl, solo, portrait, close-up, straight-on')).toBe(true);
});

test('not offered without a server, or with one that has no ComfyUI', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.nav-item[data-view="generate"]')).toBeHidden();
});

test('with a ComfyUI behind the server: made, kept, shown, opened', async ({ page }) => {
  const server = await fakeServer(page);
  const asked = [];
  const id = 'b'.repeat(64);
  await page.route('**/api/generate**', async r => {
    const req = r.request();
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } });
    // The job: done at once, and kept as the server keeps it.
    const doc = { file: id + '.png', name: 'girl, long hair', type: 'image/png', from: 'generate', bytes: 100,
      t: Date.now(), folder: 'generated', tags: asked.at(-1).tags };
    server.items.set('uploads/' + id, doc);
    return r.fulfill({ json: { state: 'done', upload: { doc, url: 'uploads/Generated/' + id + '.png' } } });
  });
  await openApp(page);
  const nav = page.locator('.nav-item[data-view="generate"]');
  await expect(nav).toBeVisible();
  // On the dashboard's Prepare card too.
  await expect(page.locator('#stages .stage-card[data-stage="Prepare"]').getByRole('button', { name: /Generate references/ })).toHaveCount(1);

  await nav.click();
  await page.click('[data-gen="hair"][data-opt="long"]');
  await page.fill('#genExtra', 'hat');
  await page.selectOption('#genCount', '2');
  await page.click('#genGo');
  await expect(page.locator('#genStatus')).toHaveText('2 made - in Uploads, Generated.');
  expect(asked).toHaveLength(2);
  expect(asked[0].prompt).toContain('long hair');
  expect(asked[0].tags).toContain('hat');
  await expect(page.locator('#genResults .gen-open')).toHaveCount(1);

  // The choice is remembered.
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('[data-gen="hair"][data-opt="long"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('#genResults .gen-open').first().click();
  await expect(page.locator('#session')).toBeVisible();
});

test('an error from the server is said, and the button comes back', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => {
    const req = r.request();
    if (req.method() === 'POST') return r.fulfill({ status: 202, json: { id: 'job1' } });
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true } });
    return r.fulfill({ json: { state: 'error', error: 'ComfyUI stopped answering.' } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.click('#genGo');
  await expect(page.locator('#genStatus')).toHaveText('ComfyUI stopped answering.');
  await expect(page.locator('#genGo')).toBeEnabled();
});
