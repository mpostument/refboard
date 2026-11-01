// A backup of everything as one .zip, and restoring it into an empty
// browser.
const fs = require('fs');
const { test, expect, openApp, makePng, NEWS_IDS } = require('../helpers');

// The zip's files by name - enough of a reader to check what the app wrote
// without trusting its own reader.
function unzip(buf) {
  const out = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18), n = buf.readUInt16LE(p + 26), x = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + n).toString('utf8');
    out[name] = buf.subarray(p + 30 + n + x, p + 30 + n + x + size);
    p += 30 + n + x + size;
  }
  return out;
}

test('a backup holds the settings and the uploads, and restores them into an empty browser', async ({ page, context }) => {
  await openApp(page);
  await page.check('#optKeep');
  await page.setInputFiles('#dropInput', { name: 'blue.png', mimeType: 'image/png', buffer: makePng(16, 16, () => [30, 60, 200]) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  await page.evaluate(() => setMainMaterial('graphite'));

  await page.click('#btnData');
  await expect(page.locator('#dataSheet')).toBeVisible();
  await expect(page.locator('#dataCounts')).toContainText('1 upload');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dataBackup')]);
  expect(download.suggestedFilename()).toMatch(/^refboard-backup-\d{4}-\d\d-\d\d\.zip$/);
  const file = await download.path();
  const zip = unzip(fs.readFileSync(file));
  const manifest = JSON.parse(zip['refboard-backup.json']);
  expect(manifest.app).toBe('refboard');
  expect(JSON.parse(manifest.local['refboard.materials.v1']).main).toBe('graphite');
  expect(manifest.files).toHaveLength(1);
  expect(zip[manifest.files[0].path].subarray(0, 4).toString('latin1')).toBe('\x89PNG');
  await expect(page.locator('#dataMsg')).toContainText('1 upload');

  // A new, empty browser - nothing kept, nothing chosen.
  const fresh = await context.browser().newContext();
  const p2 = await fresh.newPage();
  await p2.addInitScript(ids => {
    localStorage.setItem('refboard.tour.v1', 'seen');
    localStorage.setItem('refboard.news.v1', JSON.stringify(ids));
  }, NEWS_IDS);
  await p2.goto('/index.html');
  await expect(p2.locator('#summary')).not.toBeEmpty();
  await p2.click('#btnData');
  await p2.setInputFiles('#dataRestoreInput', file);
  await expect(p2.locator('#dataConfirm')).toBeVisible();
  await expect(p2.locator('#dataConfirmText')).toContainText('1 upload');
  await p2.click('#dataConfirmYes');
  await p2.waitForEvent('load');
  await expect(p2.locator('#summary')).not.toBeEmpty();
  await expect(p2.locator('#uploadsList [aria-label="Open blue.png"]')).toHaveCount(1);
  await expect(p2.locator('#optKeep')).toBeChecked();
  expect(await p2.evaluate(() => materialsProfile().main)).toBe('graphite');
  await fresh.close();
});

test.describe('a file that is not a backup', () => {
  test('is refused, and nothing changes', async ({ page }) => {
    await openApp(page);
    await page.click('#btnData');
    await page.setInputFiles('#dataRestoreInput', { name: 'x.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip at all') });
    await expect(page.locator('#dataMsg')).toContainText('not a zip');
    await expect(page.locator('#dataConfirm')).toBeHidden();
  });
});

test('Your data keeps the keyboard, and gives the focus back', async ({ page }) => {
  await openApp(page);
  await page.focus('#btnData');
  await page.keyboard.press('Enter');
  await expect(page.locator('#dataBackup')).toBeFocused();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => el('dataSheet').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnData')).toBeFocused();
});
