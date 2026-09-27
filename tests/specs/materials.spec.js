const { test, expect, quadrantsPng, openApp } = require('../helpers');

async function openSession(page) {
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
}
// The eyedropper on the dark bottom-right quadrant.
async function sampleShadow(page) {
  await page.click('#btnEyedropper');
  const box = await page.locator('#img').boundingBox();
  await page.mouse.click(box.x + box.width * 3 / 4, box.y + box.height * 3 / 4);
}

test('the profile is kept, and the last material cannot be unticked', async ({ page }) => {
  await openApp(page);
  await page.click('#btnMaterials');
  await expect(page.locator('#materials')).toBeVisible();
  // Before any choice: watercolour, as the eyedropper's old switch was.
  await expect(page.locator('[data-main="watercolour"]')).toBeChecked();

  await page.click('[data-have="watercolour"]');
  await expect(page.locator('[data-have="watercolour"]')).toBeChecked();

  await page.check('[data-have="liner"]');
  await page.check('[data-have="ballpoint"]');
  await page.check('[data-main="liner"]');
  await expect(page.locator('#materialsNow')).toContainText('Liners');
  // Unticking the one in use moves "now" to another you have.
  await page.uncheck('[data-have="liner"]');
  await expect(page.locator('[data-main="watercolour"]')).toBeChecked();
  await expect(page.locator('[data-main="liner"]')).toBeDisabled();

  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('refboard.materials.v1')));
  expect(saved).toEqual({ have: ['watercolour', 'ballpoint'], main: 'watercolour' });
});

test('value steps and the eyedropper speak in the medium in use', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('refboard.materials.v1',
    JSON.stringify({ have: ['watercolour', 'liner'], main: 'liner' })));
  await page.reload();
  await openSession(page);

  // Notan in liner: the paper, and solid black.
  await page.selectOption('#valueSelect', '2');
  await expect(page.locator('#paneLegend')).toContainText('the paper - no lines');
  await expect(page.locator('#paneLegend')).toContainText('solid black');

  // A liner has one colour: the eyedropper gives a step, not a recipe.
  await sampleShadow(page);
  await expect(page.locator('#mixGuide .mix-step')).toContainText('Liners: solid black');
  await expect(page.locator('#mixGuide .mix-row')).toHaveCount(0);

  // Switched to watercolour from the drawer: recipes, whose wash is the
  // exact answer - no ladder step beside them to disagree with it.
  await page.selectOption('#mediumSelect', 'watercolour');
  expect(await page.locator('#mixGuide .mix-row').count()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#mixGuide .mix-step')).toHaveCount(0);
  await expect(page.locator('#paneLegend')).toContainText('the paper - leave it white');
});
