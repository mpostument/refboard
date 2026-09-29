// Generate's Clothes (js/generate.js): what the character wears, each as her
// Setting would have it, in place of the Setting's own clothes - and the
// new Settings, Modern, Steampunk and Post-apocalyptic.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('clothes are the Setting\'s own kind, and stand in for its clothes', async ({ page }) => {
  await openApp(page);
  const p = (c) => page.evaluate(c => genPrompt({ ...GEN_DEFAULTS, ...c }), c);
  // The Setting's, the default: the Setting's clothes, as before.
  expect(await page.evaluate(() => GEN_DEFAULTS.clothes)).toBe('setting');
  expect((await p({ setting: 'slavic' })).prompt).toContain('embroidered linen tunic');
  // Festive, per Setting - and the Setting's everyday tunic is gone, its word kept.
  const slavic = await p({ setting: 'slavic', clothes: 'festive' });
  expect(slavic.prompt).toContain('red embroidery');
  expect(slavic.prompt).not.toContain('embroidered linen tunic');
  expect(slavic.tags).toEqual(expect.arrayContaining(['slavic', 'festive clothes']));
  expect((await p({ setting: 'east', clothes: 'festive' })).prompt).toContain('furisode');
  // A boy is not put in a ball gown.
  const west = await p({ setting: 'west', clothes: 'festive', who: 'boy' });
  expect(west.prompt).toContain('prince');
  expect(west.prompt).not.toContain('ball gown');
  expect((await p({ setting: 'west', clothes: 'festive' })).prompt).toContain('ball gown');
  // A setting without its own takes the common one.
  expect((await p({ setting: 'nordic', clothes: 'uniform' })).prompt).toContain('staff');
  expect((await p({ clothes: 'armour' })).prompt).toContain('breastplate');
  expect((await p({ setting: 'nordic', clothes: 'armour' })).prompt).toContain('chainmail');
  // Every Setting is dressed by every kind of clothes.
  const bare = await page.evaluate(() => {
    const settings = GEN_CHOICES.find(c => c.id === 'setting').options.map(o => o.id);
    const clothes = GEN_CHOICES.find(c => c.id === 'clothes').options.filter(o => o.id !== 'setting').map(o => o.id);
    return settings.flatMap(setting => clothes.filter(clothes =>
      genPrompt({ ...GEN_DEFAULTS, setting, clothes }).prompt === genPrompt({ ...GEN_DEFAULTS, setting }).prompt).map(c => setting + ':' + c));
  });
  expect(bare).toEqual([]);
});

test('figure study: close-fitting, never revealing', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => Object.fromEntries(['sport', 'tight', 'swimsuit', 'leotard'].map(clothes =>
    [clothes, genPrompt({ ...GEN_DEFAULTS, clothes, framing: 'full' })])));
  expect(r.tight.prompt).toContain('bodysuit');
  expect(r.swimsuit.prompt).toContain('one-piece swimsuit');
  expect(r.leotard.prompt).toContain('leotard');
  for (const k in r) for (const t of ['cleavage', 'lingerie', 'see-through', 'bikini', 'highleg']) expect(r[k].avoid).toContain(t);
  // Nothing in the row asks for less.
  const all = await page.evaluate(() => JSON.stringify(GEN_CHOICES.find(c => c.id === 'clothes').options.map(o =>
    typeof o.tags === 'object' ? Object.values(o.tags).map(v => typeof v === 'function' ? v({ who: 'girl' }) + v({ who: 'boy' }) : v) : o.tags)));
  for (const w of ['bikini', 'lingerie', 'underwear', 'nude', 'revealing', 'cleavage']) expect(all).not.toContain(w);
  // A boy swims in trunks and a rash guard.
  expect(await page.evaluate(() => genPrompt({ ...GEN_DEFAULTS, clothes: 'swimsuit', who: 'boy' }).prompt)).toContain('swim trunks, rash guard');
});

test('Beginner\'s t-shirt only when nothing else dresses her', async ({ page }) => {
  await openApp(page);
  const [plain, festive] = await page.evaluate(() => ['setting', 'festive'].map(clothes =>
    genPrompt({ ...GEN_DEFAULTS, detail: 'beginner', clothes }).prompt));
  expect(plain).toContain('t-shirt');
  expect(festive).not.toContain('t-shirt');
  expect(festive).toContain('long dress, long sleeves');
});

test('Modern, Steampunk and Post-apocalyptic: clothes, streets, land and a temple each', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => Object.fromEntries(['modern', 'steampunk', 'postapoc'].map(setting => [setting, {
    character: genPrompt({ ...GEN_DEFAULTS, setting }).prompt,
    street: genPrompt({ ...GEN_DEFAULTS, subject: 'building', setting }).prompt,
    temple: genPrompt({ ...GEN_DEFAULTS, subject: 'building', building: 'shrine', setting }),
  }])));
  expect(r.modern.character).toContain('hoodie');
  expect(r.steampunk.street).toContain('clock tower');
  expect(r.postapoc.street).toContain('ruins');
  // On a character it is her clothes, not the scene: "post-apocalypse"
  // drew the ruins behind her, whatever the background.
  expect(r.postapoc.character).toContain('survivor');
  expect(r.postapoc.character).not.toContain('post-apocalypse');
  for (const s in r) {
    expect(r[s].temple.prompt).not.toContain('torii');
    expect(r[s].temple.avoid).toContain('torii');
  }
  expect(r.postapoc.temple.prompt).toContain('ruined church');
});

test('the page: Clothes with the character, long rows captioned in kinds', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: true } }));
  await openApp(page);
  await page.evaluate(() => setView({ kind: 'generate' }));
  const row = page.locator('[data-row="clothes"]');
  await expect(page.locator('.gen-group[data-group="who"] [data-row="clothes"]')).toBeVisible();
  await expect(row.locator('.chip[aria-pressed="true"]')).toHaveText("Setting's");
  await expect(row.locator('.chips-group')).toHaveText('Figure study');
  await expect(page.locator('[data-row="setting"] .chips-group')).toHaveText(['The world', 'Genre']);
  // The caption comes just before the chips it names.
  await expect(row.locator('.chips-group + .chip')).toHaveText('Sportswear');
  await row.locator('[data-opt="swimsuit"]').click();
  await expect(row.locator('[data-opt="swimsuit"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => genChoices.clothes)).toBe('swimsuit');
  // Not asked of a landscape.
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(row).toBeHidden();
  // Generate still at the bottom of the view.
  await page.click('[data-gen="subject"][data-opt="character"]');
  const go = await page.locator('#genGo').boundingBox();
  expect(go.y + go.height).toBeLessThanOrEqual(page.viewportSize().height);
});
