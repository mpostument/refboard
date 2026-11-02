// Stars on pictures, "come back to this" with the card after a session, and a
// palette taken out as a file (js/marks.js, js/palette.js).
const { openSection, test, expect, quadrantsPng, openApp } = require('../helpers');

test('stars: on a grid cell, kept, and the grid can show only the starred', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(6);
  await page.locator('#thumbGrid .cell').nth(1).hover();
  await page.locator('#thumbGrid .cell').nth(1).locator('.cell-star').click();
  await expect(page.locator('#btnStarred')).toHaveText('★ 1');
  await page.click('#btnStarred');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(1);
  await expect(page.locator('#thumbGrid .cell .cell-star')).toHaveText('★');
  // Un-starring it leaves nothing to show.
  await page.locator('#thumbGrid .cell').first().hover();
  await page.locator('#thumbGrid .cell .cell-star').click();
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(0);
});

test('B marks a frame to come back to; the card after the session draws it again', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.locator('#markToast')).toContainText('come back');
  await page.keyboard.press('l');
  await expect(page.locator('#markToast')).toContainText('Starred');
  await page.keyboard.press('Escape');
  await expect(page.locator('#doneCard')).toBeVisible();
  await expect(page.locator('#doneCard')).toContainText('1 pose');
  await expect(page.locator('#doneAgain')).toBeVisible();
  await page.click('#doneAgain');
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#doneCard')).toBeHidden();
});

test('a palette downloads as .gpl and as a PNG strip', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'palette');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(5);
  const [gpl] = await Promise.all([page.waitForEvent('download'), page.click('#pgGpl')]);
  expect(gpl.suggestedFilename()).toBe('refboard-palette.gpl');
  const text = require('fs').readFileSync(await gpl.path(), 'utf8');
  expect(text.startsWith('GIMP Palette\n')).toBe(true);
  expect(text.trim().split('\n').length).toBe(4 + 5);
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#pgPng')]);
  expect(png.suggestedFilename()).toBe('refboard-palette.png');
});
