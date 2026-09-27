const { test, expect, openApp } = require('../helpers');

// A first visit: nothing in localStorage says the tour has been seen.
test.use({ seenTour: false });

test('the first visit gets a short tour, once - ringing the real controls', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#tour')).toBeVisible();
  await expect(page.locator('#tourText')).toContainText('grouped by the stage');
  await expect(page.locator('#tourCount')).toHaveText('1 of 6');
  await expect(page.locator('#tourBack')).toBeDisabled();

  // The ring is round the control the note is about.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tourText')).toContainText('Find a tool');
  // Polled: the ring slides there (a .2s transition).
  const find = await page.locator('#btnFind').boundingBox();
  await expect.poll(async () => Math.abs((await page.locator('#tourRing').boundingBox()).y + 4 - find.y)).toBeLessThan(2);

  // Keys stay in it: "?" does not open Help underneath.
  await page.keyboard.press('?');
  await expect(page.locator('#helpOverlay')).toBeHidden();

  for (let i = 0; i < 4; i++) await page.locator('#tourNext').click();
  await expect(page.locator('#tourCount')).toHaveText('6 of 6');
  await expect(page.locator('#tourSkip')).toBeHidden();
  await page.locator('#tourNext').click(); // Done
  await expect(page.locator('#tour')).toBeHidden();

  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  await expect(page.locator('#tour')).toBeHidden();
});

test('the tour again from Help or Ctrl+K, without the sections you hid', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tour')).toBeHidden();

  await page.keyboard.press('?');
  await page.locator('#btnTour').click();
  await expect(page.locator('#helpOverlay')).toBeHidden();
  await expect(page.locator('#tourCount')).toHaveText('1 of 6');
  await page.locator('#tourSkip').click();

  await page.locator('#sectionsEdit summary').click();
  await page.locator('#sectionsList').getByLabel('Start drawing').uncheck();
  await page.keyboard.press('Control+k');
  await page.locator('#cmdkInput').fill('tour');
  await page.keyboard.press('Enter');
  await expect(page.locator('#tourCount')).toHaveText('1 of 5');
});
