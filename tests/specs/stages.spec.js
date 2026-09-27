// The stages of the work (js/stages.js): the rail grouped by them, and the
// dashboard's cards built from those groups.
const { test, expect, openApp } = require('../helpers');

const card = (page, stage) => page.locator(`#stages .stage-card[data-stage="${stage}"]`);

test('the dashboard has the four stages, each with what the rail has in it', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#stages .stage-card h2')).toHaveText(['Prepare', 'Practise', 'Paint', 'Check']);
  // One card button for each rail button in the group - not All images,
  // which the rail hides with no library behind it, as here.
  await expect(card(page, 'Prepare').getByRole('button', { name: /All images/ })).toHaveCount(0);
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
