const { test, expect, quadrantsPng, openApp } = require('../helpers');

async function openSession(page) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
}
const chip = (page, id) => page.locator(`#hudPinList [data-pin="${id}"]`);

test('the toolbar holds the pinned tools, More the rest', async ({ page }) => {
  await openSession(page);
  // The first set: flip is pinned, the pose skeleton is under More.
  await expect(page.locator('#btnFlip')).toBeVisible();
  await expect(page.locator('#btnPose')).toBeHidden();

  await page.click('#btnMoreTools');
  await expect(page.locator('#hudMore')).toBeVisible();
  await expect(page.locator('#hudMoreList #btnPose')).toBeVisible();
  await expect(chip(page, 'flip')).toHaveAttribute('aria-pressed', 'true');

  // Pinning moves the very same button - it still works.
  await chip(page, 'pose').click();
  await expect(page.locator('#hudTools #btnPose')).toBeVisible();
  await chip(page, 'flip').click();
  await expect(page.locator('#hudMoreList #btnFlip')).toBeAttached();
  await page.locator('#hudMoreList #btnFlip').click();
  await expect(page.locator('#hudMore')).toBeHidden();       // a tool used from More closes it
  await expect(page.locator('#img')).toHaveClass(/flip/);

  // An unpinned tool keeps its key, and Ctrl+K still finds it.
  await page.keyboard.press('f');
  await expect(page.locator('#img')).not.toHaveClass(/flip/);
  await page.keyboard.press('Control+k');
  await page.fill('#cmdkInput', 'flip');
  await expect(page.locator('#cmdkList li').first()).toContainText('Flip');
  await page.keyboard.press('Escape');

  // Kept for the next session.
  await page.keyboard.press('Escape');
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#hudTools #btnPose')).toBeVisible();
  await expect(page.locator('#btnFlip')).toBeHidden();

  // Reset puts back the first set; Escape closes More, not the session.
  await page.click('#btnMoreTools');
  await page.click('#hudPinReset');
  await expect(page.locator('#hudTools #btnFlip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hudMore')).toBeHidden();
  await expect(page.locator('#session')).toBeVisible();
});

test('a separator only between groups that have something pinned', async ({ page }) => {
  await openSession(page);
  const groups = await page.locator('#hudTools .hud-group').count();
  await page.click('#btnMoreTools');
  // Unpin the whole zoom group: one group fewer, no empty one left.
  await chip(page, 'zoom').click();
  await expect(page.locator('#hudTools .hud-group')).toHaveCount(groups - 1);
  await expect(page.locator('#hudTools .hud-group:empty')).toHaveCount(0);
});
