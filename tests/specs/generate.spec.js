// Generate references (js/generate.js): pictures made to order by a ComfyUI
// the server knows about. No ComfyUI here - the server's side is played by
// page.route (see fakeServer in helpers.js), and it answers each job with a
// stored picture, as Services/ComfyClient.cs does.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('the choices become the model\'s tags and the words it is filed under', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, hair: 'twintails', colour: 'pink', view: 'three', light: 'back' }, 'hat, rain'));
  expect(r.prompt).toBe('1girl, solo, twintails, pink hair, upper body, three quarter view, backlighting, rim lighting, ' +
    'watercolor \\(medium\\), traditional media, lineart, minimalist, simple drawing, simple background, white background, hat, rain');
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
    'autumn, autumn leaves, watercolor \\(medium\\), traditional media, lineart, minimalist, simple drawing');
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
  expect(ink.prompt).toContain('(hatching \\(texture\\):1.3), (cross-hatching:1.2), ink \\(medium\\)');
  expect(ink.avoid).toContain('solid black');
  // Black, not the reddish lines on warm paper it gave; and no pen drawn in.
  expect(ink.avoid).toContain('sepia');
  expect(ink.prompt).not.toContain('pen');
  expect(ink.avoid).toContain('holding pen');
  const pencil = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, medium: 'sketch' }));
  expect(pencil.prompt).toContain('(hatching \\(texture\\):1.2)');
  expect(pencil.avoid).toContain('holding pencil');
});

test('watercolour asks for soft or hard edges; other media do not', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => [
    genPrompt({ ...GEN_DEFAULTS, edges: 'soft' }), genPrompt({ ...GEN_DEFAULTS, edges: 'hard' }),
    genPrompt({ ...GEN_DEFAULTS, medium: 'ink', edges: 'soft' })]);
  expect(r[0].prompt).toContain('wet-on-wet, color bleeding, soft edges');
  expect(r[0].tags).toContain('soft edges');
  expect(r[1].prompt).toContain('hard edges');
  expect(r[1].avoid).toContain('color bleeding');
  expect(r[2].prompt).not.toContain('soft edges');
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
  // Wet-in-wet is watercolour's question: not asked for ink.
  await expect(page.locator('[data-row="edges"]')).toBeVisible();
  await page.click('[data-gen="medium"][data-opt="ink"]');
  await expect(page.locator('[data-row="edges"]')).toBeHidden();
  await page.click('[data-gen="medium"][data-opt="watercolour"]');
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

test('a palette as a few tags for the whole of it', async ({ page }) => {
  await openApp(page);
  const t = rgbs => page.evaluate(r => genPaletteTags(r), rgbs);
  // Muted blues, grey-ish, light to dark.
  expect(await t([[138, 180, 217], [70, 90, 120], [30, 40, 60], [150, 155, 165], [200, 210, 225]]))
    .toEqual(['limited palette', 'blue theme', 'muted color', 'high contrast']);
  // Light and soft: pastel.
  expect(await t([[250, 215, 225], [240, 225, 245], [220, 235, 250], [250, 240, 215]])).toContain('pastel colors');
  // Mostly dark, one orange accent; a dark ochre is brown.
  const dark = await t([[20, 25, 35], [60, 40, 30], [200, 110, 30], [40, 45, 60]]);
  expect(dark).toEqual(expect.arrayContaining(['orange theme', 'dark']));
  expect(await page.evaluate(() => genHueTag(0.4, 75))).toBe('brown');
  // Peach, orange and browns are one warm family - orange, not split in two.
  expect(await t([[250, 215, 180], [220, 120, 50], [150, 70, 40], [90, 50, 40], [240, 190, 120]])).toContain('orange theme');
  // All of it dark ochre and umber: brown.
  expect(await t([[110, 80, 40], [80, 55, 30], [140, 100, 50]])).toContain('brown theme');
  // Two opposites, as strong: no one hue leads. The stronger of them does.
  const even = await page.evaluate(() => genPaletteTags([lchRgb(0.6, 0.12, 25), lchRgb(0.6, 0.12, 205)]));
  expect(even.some(x => x.endsWith('theme'))).toBe(false);
  expect(await t([[200, 60, 60], [40, 160, 160]])).toContain('red theme');
  // A grey palette, and none at all.
  expect((await t([[40, 40, 40], [128, 128, 128], [220, 220, 220]])).some(x => x.endsWith('theme'))).toBe(false);
  expect(await t([])).toEqual([]);
});
