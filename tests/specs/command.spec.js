// Find a tool (js/command.js): Ctrl+K from anywhere, type, Enter.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

const options = page => page.locator('#cmdkList [role="option"]');

test('Ctrl+K finds a section, by its name or another word for it', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await expect(page.locator('#cmdk')).toBeVisible();
  await expect(page.locator('#cmdkInput')).toBeFocused();

  // "green" is nowhere in the name - it is one of the Colour studio's words.
  await page.keyboard.type('green');
  await expect(options(page).first()).toContainText('Colour studio');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cmdk')).toBeHidden();
  await expect(page.locator('.nav-item[data-view="colour"]')).toHaveAttribute('aria-current', 'true');

  // The last one used comes first next time.
  await page.keyboard.press('Control+k');
  await expect(options(page).first()).toContainText('Colour studio');
});

test('works on a Ukrainian keyboard layout', async ({ page }) => {
  await openApp(page);
  // What Ctrl+K sends there: the same physical key, a different letter.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'л', code: 'KeyK', ctrlKey: true, bubbles: true })));
  await expect(page.locator('#cmdk')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdk')).toBeHidden();
});

test('opens a trainer', async ({ page }) => {
  await openApp(page);
  await page.click('#btnFind');
  await page.keyboard.type('perspective');
  await page.keyboard.press('Enter');
  await expect(page.locator('#viewTrain .train-run')).toBeVisible();
  await expect(page.locator('#viewTrain .train-head b')).toHaveText('Perspective');
});

test("in a session it finds the toolbar's tools, and typing does not trigger them", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();

  // The toolbar's own button, for a tablet with no keyboard.
  await page.click('#btnFindHud');
  await expect(page.locator('#cmdk')).toBeVisible();
  // f, l, i, p would each toggle something in the session if they got out.
  await page.keyboard.type('flip');
  await expect(page.locator('#btnFlip')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#btnInfo')).not.toHaveAttribute('aria-pressed', 'true');
  await expect(options(page).first()).toContainText('Flip');
  await expect(options(page).first().locator('kbd')).toHaveText('f');
  await page.keyboard.press('Enter');
  await expect(page.locator('#btnFlip')).toHaveAttribute('aria-pressed', 'true');

  // A choice from one of the toolbar's menus.
  await page.keyboard.press('Control+k');
  await page.keyboard.type('vanishing');
  await page.keyboard.press('Enter');
  await expect(page.locator('#constructSelect')).toHaveValue('vp');

  // Escape closes the box, not the session under it.
  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdk')).toBeHidden();
  await expect(page.locator('#session')).toBeVisible();
});
