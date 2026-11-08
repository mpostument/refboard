// Your own tags and Draw these with a number (js/tags.js), Generate recipes (js/recipes.js)
// and the ComfyUI line on the Generate view (js/generate.js renderGenLink).
const { test, expect, openApp, fakeServer } = require('../helpers');

test('tags: put on a cell, shown as a chip, the chip shows only that tag', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(6);
  await page.locator('#thumbGrid .cell').nth(2).hover();
  await page.locator('#thumbGrid .cell').nth(2).locator('.cell-tagbtn').click();
  await page.fill('#tagInput', 'Hands');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tagBar [data-tag="hands"]')).toBeVisible();
  await expect(page.locator('#thumbGrid .cell').nth(2).locator('.cell-tagbtn')).toHaveText('# 1');
  await page.click('#tagBar [data-tag="hands"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(1);
  // The tag is also a search word.
  await page.click('#tagBar [data-tag="hands"]');
  await page.fill('#imgFilter', 'hands');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(1);
});

test('Draw these takes a number, and the session has that many poses', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(6);
  await expect(page.locator('#drawCount option[value="10"]')).toBeHidden();
  await page.selectOption('#drawCount', '0');
  await expect(page.locator('#drawFresh')).toBeHidden();
  // Six pictures: nothing smaller to pick but the number is allowed through code.
  const n = await page.evaluate(() => {
    drawPrefs.n = 3; drawPrefs.fresh = true;
    return pickForSession(gridItems, 3, true).length;
  });
  expect(n).toBe(3);
});

test('a fresh pick leaves out what was drawn a moment ago', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(6);
  const ok = await page.evaluate(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const i of gridItems.slice(0, 3)) seenMap[i.src] = now;
    const kept = new Set(gridItems.slice(3).map(i => i.src));
    return Array.from({ length: 20 }, () => pickForSession(gridItems, 3, true)).every(p => p.every(i => kept.has(i.src)));
  });
  expect(ok).toBe(true);
});

test('recipes: save the choices, change them, put them back, and the same in other light', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: true, configured: true, checkpoint: 'animagine.safetensors', queue: 2, quality: 'q', negative: 'n' } }));
  await openApp(page);
  await page.click('.nav-item[data-view="generate"]');
  await page.click('[data-gen="medium"][data-opt="ink"]');
  await page.click('#genRecipeNew');
  await page.fill('#genRecipeName', 'Ink girl');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-recipe="0"]')).toHaveText('Ink girl');
  await page.click('[data-gen="medium"][data-opt="watercolour"]');
  await page.click('[data-recipe="0"]');
  await expect(page.locator('[data-gen="medium"][data-opt="ink"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-recipe-light="back"]');
  await expect(page.locator('[data-gen="light"][data-opt="back"]')).toHaveAttribute('aria-pressed', 'true');
  // The recipe itself is left as it was.
  expect(await page.evaluate(() => genRecipes[0].choices.light || 'any')).toBe('any');
  await page.click('[data-recipe-del="0"]');
  await expect(page.locator('[data-recipe]')).toHaveCount(0);
});

test('Generate says ComfyUI is ready, with its model and queue', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.fulfill({ json: { available: true, configured: true, host: 'gpu:8188', checkpoint: 'animagine.safetensors', queue: 2, quality: 'q', negative: 'n' } }));
  await openApp(page);
  await page.click('.nav-item[data-view="generate"]');
  await expect(page.locator('#genLink')).toBeVisible();
  await expect(page.locator('#genLink')).toContainText('animagine');
  await expect(page.locator('#genLink')).toContainText('2 in its queue');
});
