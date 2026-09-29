// Character sheet (js/character.js): a character's colours - base, shadow
// and light for hair, skin, eyes, clothes - taken from a picture in the
// Colour studio, each with how to mix it, and kept.
const { test, expect, openApp, quadrantsPng, QUADS } = require('../helpers');

test('shadows turn cool, skin\'s turn red, lights go pale; colours get their plain names', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof charShade === 'function');
  const r = await page.evaluate(() => {
    const lch = rgb => rgbOklch(rgb);
    const hair = [240, 160, 190], skin = [250, 222, 205];
    const h = charShade(hair, 'hair'), s = charShade(skin, 'skin'), e = charShade([60, 110, 200], 'eyes');
    return {
      hair: lch(hair), hairShadow: lch(h.shadow), hairLight: lch(h.light),
      skin: lch(skin), skinShadow: lch(s.shadow), eyeLight: e.light, paleShadow: lch(charShade([252, 244, 240], 'skin').shadow),
      names: [[32, 32, 40], [184, 184, 200], [122, 74, 42], [240, 208, 112], [244, 160, 192], [208, 48, 48],
        [64, 192, 192], [48, 80, 192], [128, 64, 176], [64, 160, 80], [240, 128, 48]].map(charColourName),
    };
  });
  // A value step darker, the hue turned toward violet (pink at ~355 turns
  // up past 0 toward 290 - that is, down).
  expect(r.hair[0] - r.hairShadow[0]).toBeCloseTo(0.14, 2);
  expect(((r.hair[2] - r.hairShadow[2] + 360) % 360)).toBeGreaterThan(10);
  expect(r.hairLight[0]).toBeGreaterThan(r.hair[0]);
  expect(r.hairLight[1]).toBeLessThan(r.hair[1]);
  // Skin's shadow toward red, and more colourful.
  expect(r.skinShadow[2]).toBeLessThan(r.skin[2]);
  expect(r.skinShadow[1]).toBeGreaterThan(r.skin[1]);
  // The palest skin is still skin: a warm shadow, never a grey one.
  expect(r.paleShadow[2]).toBeLessThan(60);
  expect(r.paleShadow[1]).toBeGreaterThan(0.04);
  // An eye's light is the paper.
  expect(r.eyeLight).toEqual([245, 243, 236]);
  expect(r.names).toEqual(['black', 'grey', 'brown', 'yellow', 'pink', 'red', 'aqua', 'blue', 'purple', 'green', 'orange']);
});

test('picked from a picture, part by part, mixed, kept and reopened', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="character"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  await expect(page.locator('#charName')).toBeDisabled();
  await page.setInputFiles('#colInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  // The first part waits for a click; the readout says what it will do.
  await expect(page.locator('.char-sw[data-part="hair"][data-tone="base"]')).toHaveAttribute('aria-pressed', 'true');
  const img = page.locator('#colImg');
  await img.hover({ position: { x: 150, y: 50 } });
  await expect(page.locator('#colReadout')).toContainText('click to take it for hair - base');
  // Hair from the dark quadrant, then on by itself to skin.
  await img.click({ position: { x: 150, y: 150 } });
  await expect(page.locator('.char-sw[data-part="skin"][data-tone="base"]')).toHaveAttribute('aria-pressed', 'true');
  await img.click({ position: { x: 40, y: 40 } });
  await expect(page.locator('#charName')).toHaveValue('Character 1');
  // One sheet: nothing to choose between.
  await expect(page.locator('#charSelect')).toBeHidden();
  const base = await page.evaluate(() => charDoc().parts);
  expect(base.hair.base).toEqual(QUADS.shadow);
  expect(base.skin.base).toEqual(QUADS.skin);
  // Worked out: a shadow and light, each with a recipe.
  const hair = page.locator('.char-part').first();
  await expect(hair.locator('.char-cell small')).toHaveCount(3);
  await expect(hair.locator('.char-sw[data-tone="shadow"]')).toHaveAttribute('aria-label', 'Hair shadow, worked out');
  // A shadow taken from the picture instead, and back to worked out.
  await hair.locator('.char-sw[data-tone="shadow"]').click();
  await img.click({ position: { x: 150, y: 40 } });
  await expect(hair.locator('.char-sw[data-tone="shadow"]')).toHaveAttribute('aria-label', 'Hair shadow, from the picture');
  await hair.locator('.char-auto').click();
  await expect(hair.locator('.char-sw[data-tone="shadow"]')).toHaveAttribute('aria-label', 'Hair shadow, worked out');
  // Named, and as text.
  await page.fill('#charName', 'Aiko');
  const text = await page.evaluate(() => charText(charDoc()));
  expect(text).toMatch(/^Aiko - Watercolour/);
  expect(text).toContain('Hair\n  Base    #2d2328');
  // Kept: the tab and the sheet come back after a reload (browser keeping on).
  await page.evaluate(() => setKeepInBrowser(true));
  await page.waitForTimeout(400);
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#charName')).toHaveValue('Aiko');
  // A second sheet: now there is a choice, and the first is in it.
  await page.click('#charNew');
  await expect(page.locator('#charName')).toHaveValue('Character 2');
  await expect(page.locator('#charSelect option')).toHaveText(['Character 2', 'Aiko']);
  await page.selectOption('#charSelect', { label: 'Aiko' });
  await expect(page.locator('#charName')).toHaveValue('Aiko');
  await expect(page.locator('.char-part').nth(1).locator('.char-sw[data-tone="base"]')).toHaveAttribute('aria-label', 'Skin base, from the picture');
  // No ComfyUI here: nothing offers to generate her.
  await expect(page.locator('#charGenerate')).toBeHidden();
});

test('Ctrl+K opens it', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('character sheet');
  await page.keyboard.press('Enter');
  await expect(page.locator('#colTabs [data-tab="character"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#charParts .char-part')).toHaveCount(5);
});
