// Generate's Beginner detail, a temple for each Setting, the watercolour
// markers and pencils, the tags as ComfyUI reads them - and deleting what
// was generated (js/generate.js).
const { test, expect, openApp, fakeServer } = require('../helpers');

test('Beginner: the fewest shapes, told per subject', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ['character', 'building', 'landscape'].map(subject =>
    genPrompt({ ...GEN_DEFAULTS, subject, detail: 'beginner' })));
  // Weighted - Simple alone still drew a hundred strands of hair.
  expect(r[0].prompt).toContain('(minimalist:1.4), (simple drawing:1.3), flat color');
  expect(r[0].prompt).toContain('straight hair');
  expect(r[0].avoid).toContain('flyaway hair');
  expect(r[0].tags).toContain('beginner');
  // One building on white, not a street of a thousand windows.
  expect(r[1].prompt).toContain('(few buildings:1.3), simple background, white background');
  expect(r[1].avoid).toContain('(many windows:1.2)');
  expect(r[1].avoid).not.toContain('flyaway hair');
  expect(r[2].prompt).toContain('(few details:1.2)');
  // Beginner comes first, Simple stays the default; each says what it does.
  await page.locator('.nav-item[data-view="generate"]').evaluate(b => b.classList.remove('hidden'));
  await page.evaluate(() => { renderGenerate(); });
  const chips = page.locator('[data-row="detail"] .chip');
  await expect(chips).toHaveText(['Beginner', 'Simple', 'Normal']);
  await expect(chips.first()).toHaveAttribute('title', /fewest shapes/);
  expect(await page.evaluate(() => GEN_DEFAULTS.detail)).toBe('simple');
});

test('a temple is the Setting\'s own, never a torii by default', async ({ page }) => {
  await openApp(page);
  const t = await page.evaluate(() => Object.fromEntries(['any', 'east', 'slavic', 'west', 'nordic', 'mideast', 'southasia'].map(setting =>
    [setting, genPrompt({ ...GEN_DEFAULTS, subject: 'building', building: 'shrine', setting })])));
  expect(t.east.prompt).toContain('torii');
  for (const s of ['any', 'slavic', 'west', 'nordic', 'mideast', 'southasia']) {
    expect(t[s].prompt).not.toContain('torii');
    expect(t[s].prompt).not.toMatch(/\bshrine, torii/);
  }
  for (const s of ['slavic', 'west', 'mideast']) expect(t[s].avoid).toContain('torii');
  expect(t.slavic.prompt).toContain('(wooden idol:1.4)');
  // Pre-Christian still (see setting.spec.js) - and the idols, not a hut:
  // the Setting's own street tags (log house, thatched roof) are left out.
  expect(t.slavic.avoid).toContain('church');
  expect(t.slavic.prompt).not.toContain('thatched roof');
  expect(t.slavic.tags).toEqual(expect.arrayContaining(['temple', 'slavic']));
  expect(t.west.prompt).toContain('cathedral');
  expect(t.mideast.prompt).toContain('mosque');
  expect(t.southasia.prompt).toContain('(hindu temple:1.4)');
  // A Slavic street keeps them.
  const street = await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, subject: 'building', building: 'street', setting: 'slavic' }));
  expect(street.prompt).toContain('thatched roof');
});

test('watercolour markers and pencils: in colour, with no tool drawn in', async ({ page }) => {
  await openApp(page);
  const [m, p] = await page.evaluate(() => ['wmarker', 'wpencil'].map(medium => genPrompt({ ...GEN_DEFAULTS, medium })));
  expect(m.prompt).toContain('marker \\(medium\\)');
  expect(m.avoid).toContain('monochrome');
  expect(m.avoid).toContain('holding marker');
  expect(m.tags).toContain('watercolour markers');
  expect(p.prompt).toContain('watercolor pencil \\(medium\\)');
  expect(p.avoid).toContain('holding pencil');
  // Wet-in-wet is plain watercolour's question.
  expect(m.prompt).not.toContain('soft edges');
});

test('a Danbooru tag reaches ComfyUI whole; a weight stays a weight', async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => comfyTags('watercolor (medium), (hatching (texture):1.3), (red:1.2), dress (red)')))
    .toBe('watercolor \\(medium\\), (hatching \\(texture\\):1.3), (red:1.2), dress \\(red\\)');
  // What was typed under More tags too.
  expect((await page.evaluate(() => genPrompt(GEN_DEFAULTS, 'sword (weapon)'))).prompt).toContain('sword \\(weapon\\)');
});

test('generated pictures deleted one at a time, or all at once', async ({ page }) => {
  const server = await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: true } }));
  // Three made earlier, and one dropped picture that must stay.
  for (const [i, from] of ['generate', 'generate', 'generate', 'drop'].entries()) {
    const id = String(i).repeat(64);
    server.files.set(id + '.png', 'generated');
    server.items.set('uploads/' + id, { file: id + '.png', name: 'pic ' + i, type: 'image/png', from, t: 1000 + i, tags: [] });
  }
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults li')).toHaveCount(3);
  await expect(page.locator('#genMadeCount')).toHaveText('3');

  await page.locator('#genResults li').first().hover();
  await page.getByRole('button', { name: 'Delete pic 2' }).click();
  await expect(page.locator('#genResults li')).toHaveCount(2);
  expect(server.items.has('uploads/' + '2'.repeat(64))).toBe(false);
  expect(server.files.has('2'.repeat(64) + '.png')).toBe(false);

  // All: asked twice, no browser dialog.
  const clear = page.locator('#genClear');
  await clear.click();
  await expect(clear).toHaveText('Delete all 2? Click again');
  await expect(page.locator('#genResults li')).toHaveCount(2);
  await clear.click();
  await expect(page.locator('#genResults li')).toHaveCount(0);
  await expect(page.locator('#genStatus')).toHaveText('2 deleted.');
  await expect(clear).toBeHidden();
  await expect(page.locator('#genEmpty')).toBeVisible();
  expect(server.items.has('uploads/' + '3'.repeat(64))).toBe(true);
});
