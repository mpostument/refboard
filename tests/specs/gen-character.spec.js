// Generate's Character and Original setting (js/generate.js genCharacterTags,
// the Setting's Original): any character by name, in her own clothes or in
// another setting's.
const { test, expect, openApp, fakeServer } = require('../helpers');

const prompt = (page, choices, extra = '') =>
  page.evaluate(([c, e]) => genPrompt({ ...GEN_DEFAULTS, ...c }, e), [choices, extra]);

test('the name becomes tags, name then series, right after 1girl, solo', async ({ page }) => {
  await openApp(page);
  const tags = await page.evaluate(() => ['Frieren', 'Frieren (Sousou no Frieren)', 'frieren, sousou no frieren', 'ayanami_rei', '  ']
    .map(genCharacterTags));
  expect(tags).toEqual(['frieren', 'frieren, sousou no frieren', 'frieren, sousou no frieren', 'ayanami rei', '']);
  const r = await prompt(page, { character: 'Frieren (Sousou no Frieren)', setting: 'original', detail: 'normal' });
  expect(r.prompt.startsWith('1girl, solo, (frieren, sousou no frieren:1.2), ')).toBe(true);
  // Filed under her name, so the library's search finds her.
  expect(r.tags[0]).toBe('frieren');
  // No name: nothing added.
  expect((await prompt(page, { character: '' })).prompt).not.toContain('frieren');
});

test('Original draws her at Normal detail whatever Detail says: her clothes are not left out', async ({ page }) => {
  await openApp(page);
  const normal = await prompt(page, { character: 'frieren', setting: 'original', detail: 'normal' });
  for (const detail of ['simple', 'beginner']) {
    const own = await prompt(page, { character: 'frieren', setting: 'original', detail });
    // The same as Normal: no minimalist, no t-shirt, nothing kept out about
    // ribbons or detail.
    expect(own.prompt).toBe(normal.prompt);
    expect(own.avoid).toBe(normal.avoid);
    expect(own.prompt).not.toContain('minimalist');
    expect(own.prompt).not.toContain('t-shirt');
  }
  expect(normal.tags).toContain('original outfit');
  // Any still follows Detail: Beginner dresses her plainly, as before.
  const any = await prompt(page, { character: 'frieren', setting: 'any', detail: 'beginner' });
  expect(any.prompt).toContain('casual, t-shirt, pants');
  expect(any.avoid).toContain('jewelry');
});

test('another outfit says "alternate costume"; her own does not', async ({ page }) => {
  await openApp(page);
  const steam = await prompt(page, { character: 'frieren, sousou no frieren', setting: 'steampunk', detail: 'normal' });
  expect(steam.prompt).toContain('(frieren, sousou no frieren:1.2), alternate costume');
  expect(steam.prompt).toContain('goggles on head');
  const armour = await prompt(page, { character: 'frieren', setting: 'any', clothes: 'armour', detail: 'normal' });
  expect(armour.prompt).toContain('(frieren:1.2), alternate costume');
  for (const setting of ['original', 'any']) {
    const r = await prompt(page, { character: 'frieren', setting, detail: 'normal' });
    expect(r.prompt).not.toContain('alternate costume');
  }
  // Without a name there is no costume to be alternate to.
  expect((await prompt(page, { character: '', setting: 'steampunk' })).prompt).not.toContain('alternate costume');
});

test('Original is for a character: a landscape ignores it', async ({ page }) => {
  await openApp(page);
  const r = await prompt(page, { subject: 'landscape', setting: 'original', character: 'frieren' });
  expect(r.tags).not.toContain('original outfit');
  expect(r.prompt).not.toContain('frieren');
});

test('the field, its hint, and Original in the page: typed, kept, hidden for a landscape', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, quality: 'masterpiece', negative: 'lowres' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  const field = page.locator('#genCharacter'), hint = page.locator('#genCharHint');
  await expect(field).toBeVisible();
  await page.locator('#genPrompt summary').click();
  await field.fill('Frieren');
  await expect(hint).toContainText('Add her series');
  await expect(page.locator('#genPromptBody')).toContainText('1girl, solo, (frieren:1.2),');
  await field.fill('Frieren (Sousou no Frieren)');
  await expect(page.locator('#genPromptBody')).toContainText('(frieren, sousou no frieren:1.2)');
  // The series is there; Detail's default (Simple) is the next thing to say.
  await expect(hint).toContainText('Detail is not Normal');
  // Under Original it says what Original does about it.
  await page.click('[data-gen="setting"][data-opt="original"]');
  await expect(hint).toContainText('Original draws her at Normal detail');
  await page.click('[data-gen="detail"][data-opt="normal"]');
  await expect(hint).toHaveText('');
  // Original, kept across a reload.
  await expect(page.locator('[data-gen="setting"][data-opt="original"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(field).toHaveValue('Frieren (Sousou no Frieren)');
  await expect(page.locator('[data-gen="setting"][data-opt="original"]')).toHaveAttribute('aria-pressed', 'true');
  // A landscape has no character and no own outfit: both gone, Setting back to Any.
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(page.locator('[data-row="character"]')).toBeHidden();
  await expect(page.locator('[data-gen="setting"][data-opt="original"]')).toBeHidden();
  await expect(page.locator('[data-gen="setting"][data-opt="any"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the characters drawn lately: newest first, the same one once, a click fills the field', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, quality: 'masterpiece', negative: 'lowres' } }));
  await openApp(page);
  await page.evaluate(() => {
    genCharsRemember('Frieren (Sousou no Frieren)');
    genCharsRemember('Ayanami Rei (Evangelion)');
    genCharsRemember('frieren, sousou no frieren');       // the first again, by its tags
    genCharsRemember('   ');                                // nothing
  });
  await page.locator('.nav-item[data-view="generate"]').click();
  const chips = page.locator('#genRecent .chip');
  await expect(chips).toHaveText(['frieren, sousou no frieren', 'Ayanami Rei (Evangelion)']);
  await page.locator('#genPrompt summary').click();
  await chips.nth(1).click();
  await expect(page.locator('#genCharacter')).toHaveValue('Ayanami Rei (Evangelion)');
  await expect(page.locator('#genPromptBody')).toContainText('ayanami rei, evangelion');
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false');
  // Not offered for a landscape, with the field.
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(page.locator('#genRecent')).toBeHidden();
});
