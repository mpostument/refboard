// Themes (js/theme.js): Catppuccin Mocha by default, picked from the rail,
// kept across visits - and never reaching the session's stage.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

const cssVar = (page, name) => page.evaluate(n =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('Catppuccin Mocha is the default', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mocha');
  expect(await bodyBg(page)).toBe('rgb(30, 30, 46)'); // Mocha's Base
});

test('a theme picked from the rail applies at once and is kept', async ({ page }) => {
  await openApp(page);
  await page.click('#btnTheme');
  const menu = page.locator('#themeMenu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[role="menuitemradio"]')).toHaveCount(6);
  await expect(menu.locator('[aria-checked="true"]')).toHaveText('Catppuccin Mocha');

  await menu.locator('[data-theme="latte"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'latte');
  expect(await bodyBg(page)).toBe('rgb(239, 241, 245)'); // Latte's Base
  expect(await cssVar(page, 'color-scheme')).toBe('light');

  // Escape closes the menu and gives focus back to its button.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.locator('#btnTheme')).toBeFocused();

  // Already on the first paint of the next visit - no flash of Mocha.
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('latte');
});

test('the session stage stays black in a light theme', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => setTheme('daylight'));
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  const stageBg = await page.evaluate(() => getComputedStyle(document.getElementById('session')).backgroundColor);
  expect(stageBg).toBe('rgb(0, 0, 0)');
});
