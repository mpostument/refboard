// Generate's Setting (js/generate.js): where and when in the world the
// picture is - one choice, different tags for a character, a landscape and
// buildings - and the page's rows in groups, with Generate always in reach.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('a setting is clothes on a character, buildings on a street, what grows in a landscape', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => Object.fromEntries(['character', 'landscape', 'building', 'nature', 'animal'].map(subject =>
    [subject, genPrompt({ ...GEN_DEFAULTS, subject, setting: 'slavic' })])));
  expect(r.character.prompt).toContain('embroidered linen tunic');
  expect(r.landscape.prompt).toContain('birch');
  expect(r.building.prompt).toContain('wooden palisade');
  // Nature and animals have no setting.
  expect(r.nature.prompt).not.toContain('birch');
  expect(r.animal.prompt).not.toContain('birch');
  expect(r.character.tags).toContain('slavic');
  // After the character and the shot: an anime model reads "1girl, solo" best first.
  expect(r.character.prompt.startsWith('1girl, solo')).toBe(true);
  // Slavic is before Christianity - no churches, onion domes or sunflowers,
  // which came from America much later.
  const all = await page.evaluate(() => JSON.stringify(GEN_CHOICES.find(c => c.id === 'setting').options.find(o => o.id === 'slavic').tags));
  for (const w of ['church', 'orthodox', 'onion dome', 'sunflower', 'cross']) expect(all).not.toContain(w);
  // Every setting has tags for all three subjects it is asked for.
  const missing = await page.evaluate(() => GEN_CHOICES.find(c => c.id === 'setting').options.filter(o => o.id !== 'any')
    .flatMap(o => ['character', 'landscape', 'building'].filter(s => !o.tags[s]).map(s => o.id + ':' + s)));
  expect(missing).toEqual([]);
});

test('the page: every row in one group, groups hidden with their rows, Generate at the bottom of the view', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: true } }));
  await openApp(page);
  const grouped = await page.evaluate(() => {
    const ids = GEN_GROUPS.flatMap(g => g[2]);
    return { missing: GEN_CHOICES.map(c => c.id).filter(id => !ids.includes(id)), twice: ids.length - new Set(ids).size };
  });
  expect(grouped).toEqual({ missing: [], twice: 0 });
  await page.evaluate(() => setView({ kind: 'generate' }));
  const who = page.locator('.gen-group[data-group="who"]');
  await expect(who).toBeVisible();
  await expect(page.locator('[data-row="setting"]')).toBeVisible();
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(who).toBeHidden();
  await expect(page.locator('[data-row="setting"]')).toBeVisible();
  await page.click('[data-gen="subject"][data-opt="nature"]');
  await expect(page.locator('[data-row="setting"]')).toBeHidden();
  // The Generate button is on screen without scrolling, however long the page.
  await page.click('[data-gen="subject"][data-opt="character"]');
  const go = await page.locator('#genGo').boundingBox();
  expect(go.y + go.height).toBeLessThanOrEqual(page.viewportSize().height);
});
