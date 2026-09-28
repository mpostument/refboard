// What's new: after an update, what came with it - once, never over the
// first visit's tour.
const { test, expect, openApp, NEWS_IDS } = require('../helpers');

test.describe('a returning visitor', () => {
  test.use({ seenNews: false });

  test('sees what is new once, the newest first and the rest folded', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#whatsNew')).toBeVisible();
    await expect(page.locator('#whatsNewList .news')).toHaveCount(4);
    await expect(page.locator('#whatsNewList .news').first()).toHaveAttribute('data-news', NEWS_IDS[0]);
    await expect(page.locator('#whatsNewEarlier')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#whatsNew')).toBeHidden();
    await page.reload();
    await expect(page.locator('#summary')).not.toBeEmpty();
    await expect(page.locator('#whatsNew')).toBeHidden();
  });

  test('"try it" closes the panel and does the thing', async ({ page }) => {
    await openApp(page);
    await page.locator('#whatsNewEarlier summary').click();
    await page.click('[data-try="find"]');
    await expect(page.locator('#whatsNew')).toBeHidden();
    await expect(page.locator('#cmdk')).toBeVisible();
  });
});

test.describe('someone who has seen all but the newest', () => {
  test.use({ seenNews: false });
  test('sees only that one', async ({ page }) => {
    await page.addInitScript(ids => {
      if (!localStorage.getItem('refboard.news.v1')) localStorage.setItem('refboard.news.v1', JSON.stringify(ids));
    }, NEWS_IDS.slice(1));
    await openApp(page);
    await expect(page.locator('#whatsNew .news')).toHaveCount(1);
    await expect(page.locator('#whatsNew .news')).toHaveAttribute('data-news', NEWS_IDS[0]);
    await expect(page.locator('#whatsNewEarlier')).toBeHidden();
  });
});

test.describe('a first visit', () => {
  test.use({ seenNews: false, seenTour: false });
  test('gets the tour, not the news - and no news after it either', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#tour')).toBeVisible();
    await expect(page.locator('#whatsNew')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('#summary')).not.toBeEmpty();
    await expect(page.locator('#whatsNew')).toBeHidden();
  });
});

test('again from the footer, from Help and from Ctrl+K', async ({ page }) => {
  await openApp(page);
  await page.click('#btnNewsFooter');
  await expect(page.locator('#whatsNew .news')).toHaveCount(NEWS_IDS.length);
  await page.click('#whatsNewClose');
  await expect(page.locator('#btnNewsFooter')).toBeFocused();

  await page.click('#btnHelpSetup');
  await page.click('#btnNewsHelp');
  await expect(page.locator('#helpOverlay')).toBeHidden();
  await expect(page.locator('#whatsNew')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+k');
  await page.keyboard.type('news');
  await page.keyboard.press('Enter');
  await expect(page.locator('#whatsNew')).toBeVisible();
});
