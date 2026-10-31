// Anime study's Shoes, Ears and neck, and the run of ten in the gesture drill (js/animebody.js, js/animenewui.js).
const { openSection, test, expect, openApp } = require('../helpers');

const run = (page, fn) => page.evaluate(async fn => { await loadSection('anime'); return new Function('return (' + fn + ')()')(); }, fn.toString());

test('shoes: six kinds, each a different drawing from the side and from the front', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    keys: Object.keys(AN_FOOTWEAR),
    side: Object.keys(AN_FOOTWEAR).map(k => anFootwearSvg({ shoe: k, view: 'side' })),
    front: Object.keys(AN_FOOTWEAR).map(k => anFootwearSvg({ shoe: k, view: 'front' })),
    notes: anFootwearNotes({ shoe: 'boot' }).length,
  }));
  expect(r.keys.length).toBe(6);
  expect(new Set(r.side).size).toBe(6);
  expect(new Set(r.front).size).toBe(6);
  expect(r.side[0]).not.toBe(r.front[0]);
  expect(r.notes).toBe(3);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=footwear]').click();
  await expect(page.locator('#afwStage svg')).toBeVisible();
  await page.locator('#afwShoe [data-v=boot]').click();
  await page.locator('#afwView [data-v=front]').click();
  await expect(page.locator('#afwNote')).toContainText('shaft');
  await page.reload();
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=footwear]').click();
  await expect(page.locator('#afwShoe [data-v=boot]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#afwView [data-v=front]')).toHaveAttribute('aria-pressed', 'true');
});

test('ears and neck: the ear between the brow and nose lines on three heads, four ears, and the neck three ways', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({ ear: anEarNeckSvg({ view: 'ear' }), neck: anEarNeckSvg({ view: 'neck' }) }));
  expect(r.ear).not.toBe(r.neck);
  expect((r.ear.match(/<ellipse /g) || []).length).toBe(4);
  expect((r.ear.match(/stroke-dasharray="3 4"/g) || []).length).toBeGreaterThanOrEqual(2);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=earneck]').click();
  await expect(page.locator('#aenStage svg')).toBeVisible();
  await expect(page.locator('#aenNote li')).toHaveCount(3);
  await page.locator('#aenView [data-v=neck]').click();
  await expect(page.locator('#aenNote')).toContainText('collarbones');
});

test('the drill: 15 seconds, and a run of ten that counts the poses', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=gesture]').click();
  await expect(page.locator('#agtSecs [data-v="15"]')).toBeVisible();
  await page.locator('#agtSecs [data-v="15"]').click();
  await page.locator('#agtRun [data-v=ten]').click();
  await page.locator('#agtNext').click();
  await expect(page.locator('#agtPose')).toContainText('(1 of 10)');
  await expect(page.locator('#agtTimer')).toHaveText('0:15');
  await page.locator('#agtNext').click();
  await expect(page.locator('#agtPose')).toContainText('(2 of 10)');
  await page.evaluate(() => { ann.drill = { n: 10 }; annDrillNext(); });
  await expect(page.locator('#agtPose')).toContainText('(1 of 10)');
  await page.locator('#agtRun [data-v=one]').click();
  await page.locator('#agtNext').click();
  await expect(page.locator('#agtPose')).not.toContainText('of 10');
});
