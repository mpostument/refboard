// Generate references (js/generate.js): pictures made to order by a ComfyUI
// the server knows about. No ComfyUI here - the server's side is played by
// page.route (see fakeServer in helpers.js), and it answers each job with a
// stored picture, as Services/ComfyClient.cs does.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('the choices become the model\'s tags and the words it is filed under', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, hair: 'twintails', colour: 'pink', view: 'three', light: 'back' }, 'hat, rain'));
  expect(r.prompt).toBe('1girl, solo, twintails, pink hair, upper body, three quarter view, backlighting, rim lighting, ' +
    'watercolor (medium), traditional media, lineart, minimalist, simple drawing, simple background, white background, hat, rain');
  expect(r.tags).toEqual(['anime', 'girl', 'twin tails', 'pink hair', 'bust', 'three-quarter', 'backlit', 'watercolour',
    'simple', 'hat', 'rain']);
  expect(r.shape).toBe('portrait');
  // Simple, the default, keeps the intricate out.
  expect(r.avoid).toContain('intricate details');
  expect((await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, detail: 'normal' }))).avoid).toBe('');
  // A head is square; "any" adds nothing.
  const head = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, framing: 'head' }));
  expect(head.shape).toBe('square');
  expect(head.prompt.startsWith('1girl, solo, portrait, close-up, straight-on')).toBe(true);
});

test('a character sheet made again: her eyes, and a turnaround, wide', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, colour: 'purple', eyes: 'aqua', framing: 'sheet' }));
  expect(r.prompt).toContain('purple hair, aqua eyes, reference sheet, multiple views, turnaround, full body');
  expect(r.tags).toEqual(expect.arrayContaining(['purple hair', 'aqua eyes', 'turnaround']));
  expect(r.shape).toBe('landscape');
});

test('a landscape or an animal: no one in it, and only its own choices', async ({ page }) => {
  await openApp(page);
  // The character's choices are still set - and left out.
  const land = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, subject: 'landscape', hair: 'long',
    place: 'lake', time: 'sunset', weather: 'fog', season: 'autumn' }));
  expect(land.prompt).toBe('no humans, scenery, landscape, lake, reflection, sunset, orange sky, evening, fog, mist, ' +
    'autumn, autumn leaves, watercolor (medium), traditional media, lineart, minimalist, simple drawing');
  expect(land.tags).toEqual(['anime', 'landscape', 'lake', 'sunset', 'fog', 'autumn', 'watercolour', 'simple']);
  expect(land.shape).toBe('landscape');
  const fox = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, subject: 'animal', animal: 'fox', size: 'close' }));
  expect(fox.prompt).toContain('no humans, animal focus, solo, fox, portrait, close-up');
  expect(fox.prompt).not.toContain('1girl');
  expect(fox.shape).toBe('square');
});

test('ink is lines and hatching, never filled black', async ({ page }) => {
  await openApp(page);
  const ink = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, subject: 'nature', thing: 'mushrooms', medium: 'ink' }));
  expect(ink.prompt).toContain('hatching (texture), cross-hatching, ink (medium)');
  expect(ink.prompt).not.toContain('greyscale');
  expect(ink.avoid).toContain('solid black');
  const pencil = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, medium: 'sketch' }));
  expect(pencil.prompt).toContain('graphite (medium), hatching (texture)');
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
  // A landscape asks nothing about hair; back to a character, it does.
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(page.locator('[data-row="hair"]')).toBeHidden();
  await expect(page.locator('[data-row="place"]')).toBeVisible();
  await page.click('[data-gen="subject"][data-opt="character"]');
  await expect(page.locator('[data-row="place"]')).toBeHidden();
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
