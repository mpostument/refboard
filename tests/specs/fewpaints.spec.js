// Fewest paints (js/fewpaints.js): in the Palette view, which few of the
// paints are enough for the palette - in watercolour, the paper the white.
const { test, expect, openApp } = require('../helpers');

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

async function palette(page, hexes, paints = 'primary') {
  await openApp(page);
  await page.evaluate(() => setView({ kind: 'palette' }));
  await expect(page.locator('#pgRow .pg-sw').first()).toBeVisible();
  await page.evaluate(([hexes, paints, rgbs]) => {
    setPaintPaletteKey(paints); setPaintMedium('water');
    palgenTake(rgbs);
  }, [hexes, paints, hexes.map(rgb)]);
}

test('tints of one blue need one paint, however many are allowed', async ({ page }) => {
  await palette(page, ['#9fb4e8', '#6f8bd6', '#3b57b0']);
  await page.click('#pgFewN [data-few="3"]');
  await page.click('#pgFewGo');
  await expect(page.locator('#pgFew h4')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#pgFew h4')).toHaveText('One paint for this palette');
  await expect(page.locator('#pgFew .pg-few-paint')).toHaveCount(1);
  await expect(page.locator('#pgFew .pg-few-paint')).toContainText('Phthalo blue');
  await expect(page.locator('#pgFew .pg-few-row')).toHaveCount(3);
  await expect(page.locator('#pgFew')).toContainText('enough');
});

test('a green and an orange need more than one, and each colour gets a recipe from them', async ({ page }) => {
  await palette(page, ['#6aa84f', '#e07a2e']);
  await page.click('#pgFewN [data-few="3"]');
  await page.click('#pgFewGo');
  await expect(page.locator('#pgFew h4')).toBeVisible({ timeout: 30_000 });
  const n = await page.locator('#pgFew .pg-few-paint').count();
  expect(n).toBeGreaterThanOrEqual(2);
  // Every recipe names only chosen paints.
  const chosen = await page.evaluate(() => few.result.keys.map(k => PIGMENTS[k].name.toLowerCase()));
  const text = await page.locator('#pgFew .pg-few-row').allTextContents();
  for (const t of text) expect(chosen.some(c => t.toLowerCase().includes(c))).toBe(true);
});

test('the count is kept; a changed palette clears the answer, which no longer fits', async ({ page }) => {
  await palette(page, ['#9fb4e8', '#3b57b0']);
  await page.click('#pgFewN [data-few="4"]');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(FEW_KEY)).n)).toBe(4);
  await page.click('#pgFewGo');
  await expect(page.locator('#pgFew h4')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => palgenTake([[200, 40, 40], [250, 200, 60]]));
  await expect(page.locator('#pgFew')).toBeHidden();
  await expect(page.locator('#pgFewGo')).toBeEnabled();
});
