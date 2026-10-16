// Sections that belong together share one rail button, and are tabs in the view (VIEW_GROUPS in
// js/stages.js): Gen AI (References, Game assets), Colour (studio, Palettes), Perspective grid (and
// Sky and weather), Images (and Museums). The rail had a button for each of them.
const { test, expect, openApp, fakeServer } = require('../helpers');

const tabs = page => page.locator('#viewTabs [data-view]');
const comfy = (page, on = true) => page.route('**/api/generate', r => r.request().method() === 'GET'
  ? r.fulfill({ json: on ? { available: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } : { available: false, reason: 'No ComfyUI.' } })
  : r.fallback());

test('the rail has one button for each group, not one for each section', async ({ page }) => {
  await fakeServer(page);
  await comfy(page);
  await openApp(page);
  for (const leader of ['generate', 'colour', 'perspective', 'all']) await expect(page.locator(`#rail .nav-item[data-view="${leader}"]`)).toBeVisible();
  for (const sub of ['assets', 'palette', 'sky', 'museum']) await expect(page.locator(`#rail .nav-item[data-view="${sub}"]`)).toBeHidden();
  await expect(page.locator('#rail .nav-item[data-view="generate"]')).toHaveAttribute('aria-label', 'Gen AI');
  // The dashboard's cards still list every section: the hidden ones are tabs, not gone.
  const prepare = page.locator('#stages .stage-card[data-stage="Prepare"]');
  for (const name of [/Game assets/, /Palettes/, /Sky and weather/, /Museums/]) await expect(prepare.getByRole('button', { name })).toHaveCount(1);
});

test('Gen AI: References and Game assets are its tabs, and the rail button stays current in both', async ({ page }) => {
  await fakeServer(page);
  await comfy(page);
  await openApp(page);
  await page.click('.nav-item[data-view="generate"]');
  await expect(page.locator('#viewTitle')).toHaveText('Generate references');
  await expect(tabs(page)).toHaveText(['References', 'Game assets']);
  await expect(page.locator('#viewTabs [data-view="generate"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#viewTabs [data-view="assets"]');
  await expect(page.locator('#viewTitle')).toHaveText('Game assets');
  await expect(page.locator('#viewTabs [data-view="assets"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewTabs [data-view="generate"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#rail .nav-item[data-view="generate"]')).toHaveAttribute('aria-current', 'true');
  // Back by the tab.
  await page.click('#viewTabs [data-view="generate"]');
  await expect(page.locator('#viewTitle')).toHaveText('Generate references');
});

test('without a ComfyUI there is no Gen AI, and no tab for it', async ({ page }) => {
  await fakeServer(page);
  await comfy(page, false);
  await openApp(page);
  await expect(page.locator('#rail .nav-item[data-view="generate"]')).toBeHidden();
  await page.click('.nav-item[data-view="colour"]');
  await expect(tabs(page)).toHaveText(['Colour studio', 'Palettes']);
});

test('Colour: the studio and Palettes; Palettes is not a rail button but its card and Ctrl+K still open it', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#viewTabs [data-view="palette"]');
  await expect(page.locator('#viewTitle')).toHaveText(/Palettes/);
  await expect(page.locator('.nav-item[data-view="colour"]')).toHaveAttribute('aria-current', 'true');
  await page.click('.nav-item[data-view="dashboard"]');
  await page.locator('#stages .stage-card[data-stage="Prepare"]').getByRole('button', { name: /Palettes/ }).click();
  await expect(page.locator('#viewTitle')).toHaveText(/Palettes/);
});

test('a section that is in no group has no tabs, and the tabs are gone when you leave the group', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="perspective"]');
  await expect(tabs(page)).toHaveText(['Perspective grid', 'Sky and weather']);
  await page.click('.nav-item[data-view="train"]');
  await expect(page.locator('#viewTabs')).toBeHidden();
  await page.click('.nav-item[data-view="dashboard"]');
  await expect(page.locator('#viewTabs')).toBeHidden();
});
