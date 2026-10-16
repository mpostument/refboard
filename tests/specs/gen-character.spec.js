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

test('Who: Hers leaves her sex to the name; with no name it is Girl again', async ({ page }) => {
  await openApp(page);
  const her = await prompt(page, { who: 'her', character: 'Gojo Satoru (Jujutsu Kaisen)', setting: 'original', detail: 'normal' });
  expect(her.prompt.startsWith('solo, (gojo satoru, jujutsu kaisen:1.2), ')).toBe(true);
  expect(her.prompt).not.toContain('1girl');
  expect(her.prompt).not.toContain('1boy');
  // Hers is for a named character: with none, it is the row's default.
  expect((await prompt(page, { who: 'her', character: '' })).prompt.startsWith('1girl, solo')).toBe(true);
  // Girl and Boy still say so, named or not.
  expect((await prompt(page, { who: 'boy', character: 'Gojo Satoru (Jujutsu Kaisen)' })).prompt.startsWith('1boy, solo, (gojo')).toBe(true);
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
  await expect(page.locator('#genPromptBody')).toContainText('solo, (frieren:1.2),');
  await expect(page.locator('#genPromptBody')).not.toContainText('1girl');
  // Naming her handed her sex to her; Girl is one click back, and kept.
  await expect(page.locator('[data-gen="who"][data-opt="her"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-gen="who"][data-opt="girl"]');
  await expect(page.locator('#genPromptBody')).toContainText('1girl, solo, (frieren:1.2),');
  await field.fill('Frieren (Sousou no Frieren)');
  await expect(page.locator('[data-gen="who"][data-opt="girl"]')).toHaveAttribute('aria-pressed', 'true');
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

test('clearing the name takes Hers away and Who back to Girl', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, quality: 'masterpiece', negative: 'lowres' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  const hers = page.locator('[data-gen="who"][data-opt="her"]');
  await expect(hers).toBeHidden();                      // no name: not offered
  await page.locator('#genCharacter').fill('Gojo Satoru (Jujutsu Kaisen)');
  await expect(hers).toBeVisible();
  await expect(hers).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#genCharacter').fill('');
  await expect(hers).toBeHidden();
  await expect(page.locator('[data-gen="who"][data-opt="girl"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a variation takes a Setting or Clothes chosen now, on top of its own words - and nothing when none is', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const vary = choices => {
      Object.assign(genChoices, GEN_DEFAULTS, choices);
      genSource = { mode: 'vary', prompt: '1girl, solo, frieren, sousou no frieren', avoid: 'lowres', tags: ['frieren'], b64: 'x', shape: 'portrait', level: 0.6, preview: '' };
      el('genExtra').value = 'smile';
      return genRequest();
    };
    return { none: vary({}), original: vary({ setting: 'original', character: 'frieren' }), steam: vary({ setting: 'steampunk', character: 'frieren' }),
      armour: vary({ clothes: 'armour' }) };
  });
  // Nothing chosen: its own words and More tags only, as before.
  expect(r.none.prompt).toBe('1girl, solo, frieren, sousou no frieren, smile');
  expect(r.original.prompt).toBe('1girl, solo, frieren, sousou no frieren, smile');
  // Steampunk, for a named character: added and weighted, with "alternate costume"; More tags last.
  expect(r.steam.prompt).toBe('1girl, solo, frieren, sousou no frieren, (steampunk, victorian, goggles on head, brass, gears, corset, gloves:1.4), alternate costume, smile');
  // Clothes alone, no name: its tags, no costume to be alternate to.
  expect(r.armour.prompt).toContain('(armor, breastplate, gauntlets:1.4)');
  expect(r.armour.prompt).not.toContain('alternate costume');
  // The server is told nothing of it, and keeps the original's avoid.
  expect(r.steam.outfit).toBeUndefined();
  expect(r.steam.avoid).toBe('lowres');
});

test('her hair and eyes, in her words: right after the name, and the rows set above win over them', async ({ page }) => {
  await openApp(page);
  const named = { character: 'Frieren (Sousou no Frieren)', look: 'Silver hair,  green eyes, pointed ears' };
  const r = await prompt(page, named);
  // Each part weighted like the name, lower case, in the order given - before the first row's tags.
  expect(r.prompt.startsWith('1girl, solo, (frieren, sousou no frieren:1.2), (silver hair:1.2), (green eyes:1.2), (pointed ears:1.2), ')).toBe(true);
  // Hair colour set: her hair is left out (the colour now is the ask), her eyes and ears stay.
  const red = (await prompt(page, { ...named, colour: 'red' })).prompt;
  expect(red).toContain('red hair');
  expect(red).not.toContain('silver hair');
  expect(red).toContain('(green eyes:1.2)');
  // Eyes set: the other way round.
  const blue = (await prompt(page, { ...named, eyes: 'blue' })).prompt;
  expect(blue).not.toContain('green eyes');
  expect(blue).toContain('(silver hair:1.2)');
  expect(blue).toContain('(pointed ears:1.2)');
  // The hair style row (Long) says length, not colour: it does not take her colour away.
  expect((await prompt(page, { ...named, hair: 'long' })).prompt).toContain('(silver hair:1.2)');
  // No name, no look; and at most six parts, so a long list is not a wall of weights.
  expect((await prompt(page, { look: 'silver hair' })).prompt).not.toContain('silver hair');
  const many = (await prompt(page, { character: 'x', look: 'a, b, c, d, e, f, g, h' })).prompt;
  expect(many).toContain('(f:1.2)');
  expect(many).not.toContain('(g:1.2)');
});

test('her hair and eyes: asked for once she is named, kept with her, back with her chip', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, quality: 'masterpiece', negative: 'lowres' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  const look = page.locator('#genLook'), name = page.locator('#genCharacter');
  await expect(look).toBeHidden();                       // no name: nothing to describe
  await page.locator('#genPrompt summary').click();
  await name.fill('Frieren (Sousou no Frieren)');
  await expect(look).toBeVisible();
  await look.fill('silver hair, green eyes');
  await expect(page.locator('#genPromptBody')).toContainText('(silver hair:1.2), (green eyes:1.2)');
  // Kept with her, as the characters drawn lately are - and with her only.
  await page.evaluate(() => {
    genCharsRemember(genChoices.character); genLooksRemember(genChoices.character, genChoices.look);
    genCharsRemember('Ayanami Rei (Evangelion)'); genLooksRemember('Ayanami Rei (Evangelion)', 'blue hair, red eyes');
    renderGenRecent();
  });
  const chips = page.locator('#genRecent .chip');
  await chips.nth(1).click();                            // Frieren: her own back
  await expect(look).toHaveValue('silver hair, green eyes');
  await chips.nth(0).click();                            // Rei: hers, not Frieren's
  await expect(look).toHaveValue('blue hair, red eyes');
  await expect(page.locator('#genPromptBody')).not.toContainText('silver hair');
  // A name with none kept: the field is emptied, so another one's does not follow her.
  await name.fill('Gojo Satoru (Jujutsu Kaisen)');
  await expect(look).toHaveValue('');
  // The same one with her series added (the hint asks for it) keeps what was written; it is not wiped.
  await look.fill('white hair');
  await name.fill('Gojo Satoru');
  await name.fill('Gojo Satoru (Jujutsu Kaisen)');
  await expect(look).toHaveValue('white hair');
  // Kept across a reload with the other choices, and a landscape has none of it.
  await look.fill('white hair');
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(look).toHaveValue('white hair');
  await page.click('[data-gen="subject"][data-opt="landscape"]');
  await expect(look).toBeHidden();
});
