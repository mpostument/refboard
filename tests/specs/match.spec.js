// Mix this colour (js/match.js): a colour to hit with your own mix - the
// Colour studio's Match tab.
const { test, expect, openApp } = require('../helpers');

const match = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof mtMix === 'function' && typeof paintInit === 'function' && paintInit());
  await page.click('#colTabs [data-tab="match"]');
};

test('the model: a target made from a recipe is hit exactly by that recipe, and missed by another', async ({ page }) => {
  await match(page);
  const r = await page.evaluate(() => {
    const parts = [['ultramarine', 2], ['sienna', 1]], target = mtMix(parts, 0.5, 'water');
    return { same: mtDelta(mtMix(parts, 0.5, 'water'), target), other: mtDelta(mtMix([['cadRed', 1]], 0.5, 'water'), target),
      paper: mtMix([], 0.5, 'water'), oilNone: mtMix([], 0.5, 'opaque'),
      random: Array.from({ length: 5 }, () => mtRandomTarget(paintKeys('split', 'water'), 'water')) };
  });
  expect(r.same).toBe(0);
  expect(r.other).toBeGreaterThan(8);
  expect(r.paper.every(v => v > 200)).toBe(true);   // bare paper: the watercolourist's white
  expect(r.oilNone).toBeNull();                      // oil with no paint chosen is nothing
  for (const c of r.random) expect(c).toHaveLength(3);
});

test('the advice names what is wrong: lighter, darker, and a hue to go toward', async ({ page }) => {
  await match(page);
  const r = await page.evaluate(() => ({
    lighter: mtAdvice([240, 220, 200], [120, 90, 70], 'water'),
    darker: mtAdvice([120, 90, 70], [240, 220, 200], 'opaque'),
    hue: mtAdvice([200, 40, 40], [40, 160, 60], 'water'),
    same: mtAdvice([120, 90, 70], [120, 90, 70], 'water'),
  }));
  expect(r.lighter).toContain('lighter: less water');
  expect(r.darker).toContain('darker: more white');
  expect(r.hue).toContain('toward green');
  expect(r.same).toBe('');
});

test('choosing paints moves the verdict; hitting the target lets you remember it; the list stays and a click restores it', async ({ page }) => {
  await match(page);
  await page.evaluate(() => {
    mt.recipes = [];
    mtNewTarget(mtMix([['ultramarine', 2], ['sienna', 1]], 0.5, 'water'));
  });
  await expect(page.locator('#mtVerdict')).toContainText('distance');   // watercolour with nothing chosen is the bare paper
  await expect(page.locator('#mtKeep')).toBeDisabled();
  await page.selectOption('[data-mt-k="0"]', 'ultramarine');
  await page.selectOption('[data-mt-k="1"]', 'sienna');
  await page.fill('#mtWater', '50');
  await page.evaluate(() => { mt.slots[0].n = 2; mt.slots[1].n = 1; mtUpdate(); });
  await expect(page.locator('#mtVerdict')).toContainText('You have hit it');
  await expect(page.locator('#mtKeep')).toBeEnabled();
  await page.click('#mtKeep');
  await expect(page.locator('.mt-mem')).toHaveCount(1);
  // Remembered again for the same colour replaces it, not adds.
  await page.click('#mtKeep');
  await expect(page.locator('.mt-mem')).toHaveCount(1);
  await page.reload();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('refboard.matchColour.v1')).recipes.length);
  expect(stored).toBe(1);
  // Walk away from the target, then come back by the list.
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof mtMix === 'function' && paintInit());
  await page.click('#colTabs [data-tab="match"]');
  await page.click('#mtNew');
  await page.click('.mt-mem-pick');
  await expect(page.locator('#mtVerdict')).toContainText('You have hit it');
  await page.click('.mt-mem-del');
  await expect(page.locator('.mt-mem')).toHaveCount(0);
});

test('Show a recipe offers the palette\'s best and puts it on the bench', async ({ page }) => {
  await match(page);
  await page.evaluate(() => { mt.slots.forEach(s => { s.k = ''; }); mtNewTarget(mtMix([['cadRed', 1], ['cadYellow', 1]], 0.7, 'water')); mtUpdate(); });
  await page.click('#mtShow');
  await expect(page.locator('#mtAnswer .mix-row')).toHaveCount(1);
  await page.click('#mtUse');
  await expect(page.locator('#mtVerdict')).toContainText(/spot on|close/i);
});
