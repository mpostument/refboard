// Sections that belong together share one rail button, and are tabs in the view (VIEW_GROUPS in
// js/stages.js): Colour (studio, Palettes) and Images (and Museums). The rail had a button for each.
const { test, expect, openApp, fakeServer } = require('../helpers');

const tabs = page => page.locator('#viewTabs [data-view]');
const comfy = (page, on = true) => page.route('**/api/generate', r => r.request().method() === 'GET'
  ? r.fulfill({ json: on ? { available: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } : { available: false, reason: 'No ComfyUI.' } })
  : r.fallback());

test('the rail has one button for each group, not one for each section', async ({ page }) => {
  await fakeServer(page);
  await comfy(page);
  await openApp(page);
  for (const leader of ['generate', 'colour', 'all']) await expect(page.locator(`#rail .nav-item[data-view="${leader}"]`)).toBeVisible();
  for (const sub of ['palette', 'museum']) await expect(page.locator(`#rail .nav-item[data-view="${sub}"]`)).toBeHidden();
  await expect(page.locator('#rail .nav-item[data-view="generate"]')).toHaveAttribute('aria-label', 'Gen AI');
  // The dashboard's cards still list every section: the hidden ones are tabs, not gone.
  await expect(page.locator('#stages .stage-card[data-stage="Colours"]').getByRole('button', { name: /Palettes/ })).toHaveCount(1);
  await expect(page.locator('#stages .stage-card[data-stage="References"]').getByRole('button', { name: /Museums/ })).toHaveCount(1);
});

test('without a ComfyUI Gen AI is still on the rail', async ({ page }) => {
  await fakeServer(page);
  await comfy(page, false);
  await openApp(page);
  await expect(page.locator('#rail .nav-item[data-view="generate"]')).toBeVisible();
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
  await page.locator('#stages .stage-card[data-stage="Colours"]').getByRole('button', { name: /Palettes/ }).click();
  await expect(page.locator('#viewTitle')).toHaveText(/Palettes/);
});

test('a section that is in no group has no tabs, and the tabs are gone when you leave the group', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#viewTabs')).toBeHidden();
  await page.click('.nav-item[data-view="dashboard"]');
  await expect(page.locator('#viewTabs')).toBeHidden();
});
