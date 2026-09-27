// The theme editor (js/theme-editor.js): live preview, save, export and
// import - and an imported file never getting more than six colours in.
const fs = require('fs');
const { test, expect, openApp } = require('../helpers');

const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
async function openEditor(page) {
  await page.click('#btnTheme');
  await page.click('#themeMenu [data-theme-edit]');
  await expect(page.locator('#themeEditor')).toBeVisible();
}

test('changes show live, and Close without saving puts the theme back', async ({ page }) => {
  await openApp(page);
  await openEditor(page);
  await page.locator('#themeRows input[data-k="bg"]').fill('#224466');
  expect(await bodyBg(page)).toBe('rgb(34, 68, 102)');

  // Text the same as the background is flagged.
  await page.locator('#themeRows input[data-k="ink"]').fill('#224466');
  await expect(page.locator('#themeContrast .te-ratio').first()).toContainText('too faint');

  await page.keyboard.press('Escape');
  await expect(page.locator('#themeEditor')).toBeHidden();
  expect(await bodyBg(page)).toBe('rgb(30, 30, 46)'); // Mocha again
});

test('a saved theme is kept, listed and exported; the file imports again', async ({ page }) => {
  await openApp(page);
  await openEditor(page);
  await page.fill('#themeName', 'Night paper');
  await page.locator('#themeRows input[data-k="bg"]').fill('#20242c');
  await page.locator('#themeRows input[data-k="accent"]').fill('#e0a060');

  const download = page.waitForEvent('download');
  await page.click('#themeExport');
  const file = await (await download).path();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(data).toMatchObject({ refboardTheme: 1, name: 'Night paper', colours: { background: '#20242c', accent: '#e0a060' } });

  await page.click('#themeSave');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom-night-paper');
  await page.reload();
  expect(await bodyBg(page)).toBe('rgb(32, 36, 44)');
  await page.click('#btnTheme');
  await expect(page.locator('#themeMenu [aria-checked="true"]')).toHaveText('Night paper');
  await page.keyboard.press('Escape');

  // Import into a browser that has never seen it.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openEditor(page);
  await page.setInputFiles('#themeImportInput', file);
  await expect(page.locator('#themeEditorMsg')).toContainText('Night paper');
  expect(await bodyBg(page)).toBe('rgb(32, 36, 44)');
});

test('an imported file cannot inject markup or styles', async ({ page }) => {
  await openApp(page);
  await openEditor(page);
  // A colour that is not a plain #rrggbb is refused outright.
  const bad = { refboardTheme: 1, name: 'x', colours: { background: 'red;background:url(//evil)', panels: '#000000', controls: '#000000', text: '#ffffff', quietText: '#cccccc', accent: '#ff0000' } };
  await page.setInputFiles('#themeImportInput', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#themeEditorMsg')).toContainText('not a Refboard theme');

  // A name is only ever text.
  const sneaky = { ...bad, name: '<img src=x onerror="window.hit=1">', colours: { ...bad.colours, background: '#101010' } };
  await page.setInputFiles('#themeImportInput', { name: 'n.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sneaky)) });
  await page.click('#themeSave');
  await page.click('#btnTheme');
  await expect(page.locator('#themeMenu [aria-checked="true"]')).toHaveText('<img src=x onerror="window.hit=1">');
  expect(await page.locator('#themeMenu img').count()).toBe(0);
  expect(await page.evaluate(() => window.hit)).toBeUndefined();
});
