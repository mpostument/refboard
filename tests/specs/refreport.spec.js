// Reference report (js/refreport.js): every check on one picture, on one page.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

async function openReport(page) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  // A dropped photo may already have the panel open.
  if (await page.locator('#wsPanel').isHidden()) await page.click('#btnWorkspace');
  await page.click('#wsReport');
  await expect(page.locator('#reportBody .rr h1')).toHaveText('Reference report');
}

test('the workspace\'s Report gives a section for each kind of check, loaded only then', async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => typeof openReport)).toBe('undefined');
  await openReport(page);
  const heads = await page.locator('#reportBody .rr h2').allTextContents();
  expect(heads).toEqual(['Is it a good picture to work from?', 'Value', 'Colour', 'Where the eye goes', 'Shapes and edges']);
  // Each section's map is a picture, carried in the page.
  const maps = await page.locator('#reportBody .rr-map img').evaluateAll(l => l.map(i => i.src.startsWith('data:image/jpeg') && i.naturalWidth > 0));
  expect(maps).toEqual([true, true, true, true, true]);
});

test('the colours are the picture\'s, each with how to mix it in the chosen medium', async ({ page }) => {
  await openReport(page);
  const cols = page.locator('#reportBody .rr-col');
  expect(await cols.count()).toBe(4);
  // The four flat quadrants: skin, sky, leaf and shadow are in it.
  const hexes = await cols.locator('small').allTextContents();
  expect(hexes.every(t => /^#[0-9a-f]{6} · \d+%$/.test(t))).toBe(true);
  for (const t of await cols.locator('span:not(.rr-sw)').allTextContents()) expect(t.length).toBeGreaterThan(5);
});

test('the words are the tools\' own: the same verdicts as the picture\'s notes', async ({ page }) => {
  await openReport(page);
  const same = await page.evaluate(async () => {
    const img = new Image(); img.src = state.current; await img.decode();
    const p = stepsRead(img), body = document.getElementById('reportBody').textContent;
    return [qualityOf(p).verdict, compositionSay(compositionOf(p))].every(s => body.includes(s));
  });
  expect(same).toBe(true);
});

test('Esc closes it, Keep puts a picture in My work, Print sends the page', async ({ page }) => {
  await openReport(page);
  await page.click('#reportKeep');
  await expect(page.locator('#reportKept')).toHaveText('Kept in My work as a reference report.');
  await page.keyboard.press('Escape');
  await expect(page.locator('#reportSheet')).toBeHidden();

  await page.click('#wsReport');
  await expect(page.locator('#reportBody .rr h1')).toBeVisible();
  const printed = await page.evaluate(() => { let h = null; window.printHtml = x => { h = x; }; document.getElementById('reportPrint').click(); return h; });
  expect(printed).toContain('Reference report');
  expect(printed).toContain('<style>');
});

test('Ctrl+K finds it from a session', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#btnFindHud');
  await page.keyboard.type('reference report');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Reference report');
  await page.keyboard.press('Enter');
  await expect(page.locator('#reportBody .rr h1')).toHaveText('Reference report');
});
