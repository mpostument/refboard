// The stages of the work (js/stages.js): the rail grouped by them, and the
// dashboard's cards built from those groups.
const { test, expect, openApp } = require('../helpers');

const card = (page, stage) => page.locator(`#stages .stage-card[data-stage="${stage}"]`);

test('the dashboard has the four stages, each with what the rail has in it', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#stages .stage-card h2')).toHaveText(['Prepare', 'Practise', 'Paint', 'Check']);
  // One card button for each rail button in the group - All images too,
  // with the sample pack standing in for a library, as here.
  await expect(card(page, 'Prepare').getByRole('button', { name: /All images/ })).toHaveCount(1);
  for (const stage of ['Prepare', 'Practise', 'Paint', 'Check']) {
    const onRail = await page.locator(`#rail .rail-stage[data-stage="${stage}"] button:visible`).count();
    await expect(card(page, stage).locator('.stage-tool')).toHaveCount(onRail);
  }

  // A card button is the rail button: the view opens, and its stage is lit.
  await card(page, 'Prepare').getByRole('button', { name: /Colour studio/ }).click();
  await expect(page.locator('.nav-item[data-view="colour"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#rail .rail-stage[data-stage="Prepare"] .rail-stage-name'))
    .toHaveCSS('opacity', '1');
});

test('Start drawing with no pack ticked opens the Library, and says so', async ({ page }) => {
  await openApp(page);
  await page.click('#btnPacksNone');
  await expect(card(page, 'Paint').locator('.stage-note')).toContainText('Tick a pack in the Library first');
  await page.click('#btnPaint');
  await expect(page.locator('#btnLibrary')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#session')).toBeHidden();
});

test('Ctrl+K finds a stage by its name', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('paint');
  const opts = page.locator('#cmdkList [role="option"]');
  await expect(opts.filter({ hasText: 'Start drawing' })).toHaveCount(1);
  await expect(opts.filter({ hasText: 'My materials' })).toHaveCount(1);
});

test('a section you never open can be hidden - off the rail and its card, not out of Ctrl+K', async ({ page }) => {
  await openApp(page);
  await page.locator('#sectionsEdit summary').click();
  await page.locator('#sectionsList').getByLabel('3D forms').uncheck();
  await expect(page.locator('.nav-item[data-view="forms"]')).toBeHidden();
  await expect(card(page, 'Practise').getByRole('button', { name: /3D forms/ })).toHaveCount(0);

  // A stage with nothing left goes, name and card.
  await page.locator('#sectionsList').getByLabel('Handbook', { exact: true }).uncheck();
  await page.locator('#sectionsList').getByLabel('Train', { exact: true }).uncheck();
  await expect(page.locator('#rail .rail-stage[data-stage="Practise"]')).toBeHidden();
  await expect(card(page, 'Practise')).toHaveCount(0);

  // Still findable, marked as hidden; and still hidden after a reload.
  await page.keyboard.press('Control+k');
  await page.locator('#cmdkInput').fill('3d forms');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('hidden');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.nav-item[data-view="forms"]')).toBeHidden();
  await page.locator('#sectionsEdit summary').click();
  await page.locator('#sectionsList').getByLabel('Train', { exact: true }).check();
  await expect(page.locator('#rail .rail-stage[data-stage="Practise"]')).toBeVisible();
});
