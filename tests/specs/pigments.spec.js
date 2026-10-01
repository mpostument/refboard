// Pigment guide (js/pigments.js): what each paint does on the paper - the
// Colour studio's Pigments tab - and the tags it gives the recipes.
const { test, expect, openApp } = require('../helpers');

test('the data: every paint rated, and recipes tagged where it matters', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof pigmentsRender === 'function');
  const r = await page.evaluate(() => {
    const bad = Object.entries(PIGMENTS).filter(([, p]) => !((p.ci || p.tube) && p.op >= 0 && p.op <= 1 && [0, 1, 2].includes(p.stain) &&
      [0, 1, 2].includes(p.gran) && PIGMENT_LF[p.lf] && p.note)).map(([k]) => k);
    const tags = (rgb, pal, med) => paintRecipes(rgb, pal, 3, med).map(x => ({ t: paintRecipeTags(x).map(t => t.word), smooth: !!x.smooth, set: x.set }));
    return { bad, glaze: GZ_OPACITY.ultramarine, word: gzOpacityWord('cadRed'),
      // A dull blue: ultramarine's, and it granulates.
      blue: tags([70, 80, 150], 'full', 'water'),
      blueOil: tags([70, 80, 150], 'full', 'opaque'),
      crimson: tags([140, 30, 50], 'split', 'water') };
  });
  expect(r.bad).toEqual([]);
  // Glazing reads its opacity from the same table.
  expect(r.glaze).toBe(0.1);
  expect(r.word).toBe('opaque');
  expect(r.blue.some(x => x.t.includes('granulates'))).toBe(true);
  // In oil neither granulation nor staining shows.
  expect(r.blueOil.every(x => !x.t.includes('granulates') && !x.t.includes('stains'))).toBe(true);
  // Alizarin crimson stains, and fades.
  const aliz = r.crimson.find(x => x.set.includes('alizarin'));
  expect(aliz.t).toEqual(expect.arrayContaining(['stains', 'fades']));
});

test('the Pigments tab: swatches, a question, one paint explained, and the way in from a recipe', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="pigments"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  // Watercolour, the full palette: every paint but white, each a swatch.
  await expect(page.locator('.pig-row')).toHaveCount(12);
  await expect(page.locator('.pig-row canvas')).toHaveCount(12);
  await expect(page.locator('.pig-row.on')).toHaveCount(1);
  // A swatch is painted: rich on the left, pale on the right.
  const lum = await page.evaluate(() => {
    const c = document.querySelector('.pig-row[data-k="ultramarine"] canvas'), d = c.getContext('2d');
    const at = x => { const p = d.getImageData(x, 5, 1, 1).data; return p[0] + p[1] + p[2]; };
    return [at(2), at(c.width - 3)];
  });
  expect(lum[0]).toBeLessThan(lum[1] - 200);
  // A question: which lift off. The others dim.
  await page.click('#pigFilters [data-pig="lift"]');
  await expect(page.locator('#pigHint')).toContainText('of these 12');
  await expect(page.locator('.pig-row[data-k="phthaloBlue"]')).toHaveClass(/off/);
  await expect(page.locator('.pig-row[data-k="ultramarine"]')).not.toHaveClass(/off/);
  // One paint: its code, and what each property means.
  await page.click('.pig-row[data-k="ultramarine"]');
  await expect(page.locator('#pigOne')).toContainText('PB29');
  await expect(page.locator('#pigOne')).toContainText('granulates');
  await expect(page.locator('#pigOne dt')).toHaveCount(4);
  // In oil: a tint strip, and only what shows in oil.
  await page.click('#colMedium [data-paint-medium="opaque"]');
  await expect(page.locator('#pigOne dt')).toHaveCount(2);
  await expect(page.locator('#pigFilters [data-pig="lift"]')).toBeHidden();
  await expect(page.locator('#pigFilters [data-pig="all"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#colMedium [data-paint-medium="water"]');
  // Kept.
  await page.click('#pigFilters [data-pig="fade"]');
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="pigments"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pigFilters [data-pig="fade"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pig-row.on')).toHaveAttribute('data-k', 'ultramarine');
  // On to the Glazing tab, with this paint as the glaze.
  await page.click('[data-pig-go="glazing"]');
  await expect(page.locator('#colTabs [data-tab="glazing"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#gzPair .gz-title')).toContainText('Ultramarine blue');
  // A recipe's tag opens its paint here: the Light tab's recipes.
  await page.click('#colTabs [data-tab="light"]');
  await page.locator('#ltOwn').fill('#9a1a3a');
  const tag = page.locator('#ltOne .mix-tag[data-pigment]').first();
  await expect(tag).toBeVisible();
  const k = await tag.getAttribute('data-pigment');
  await tag.click();
  await expect(page.locator('#colTabs [data-tab="pigments"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.pig-row.on')).toHaveAttribute('data-k', k);
  // And by Ctrl+K.
  await page.click('#colTabs [data-tab="picture"]');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('pigment guide');
  await page.keyboard.press('Enter');
  await expect(page.locator('#colTabs [data-tab="pigments"]')).toHaveAttribute('aria-selected', 'true');
});

test('my Holbein box: the pans as they sit, the tubes in the words on them, recipes from them', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="pigments"]');
  // The general palettes have no box.
  await expect(page.locator('#pigBox')).toBeHidden();
  await page.click('#colPaints [data-paint-palette="box"]');
  // Four rows of seven pans, every one a tube; the white is a pan but no row to mix with.
  await expect(page.locator('#pigBox .pig-pan[data-k]')).toHaveCount(28);
  await expect(page.locator('.pig-row')).toHaveCount(27);
  await expect(page.locator('.pig-row[data-k="hChineseWhite"]')).toHaveCount(0);
  // One pan: where it sits, its code, what it was bought for - and the fading ones light up.
  await page.click('#pigBox .pig-pan[data-k="hOpera"]');
  await expect(page.locator('#pigOne')).toContainText('2.6 · W013');
  await expect(page.locator('#pigOne')).toContainText('Bought for: glow, accents');
  await page.click('#pigFilters [data-pig="fade"]');
  await expect(page.locator('#pigBox .pig-pan[data-k="hOpera"]')).not.toHaveClass(/off/);
  await expect(page.locator('#pigBox .pig-pan[data-k="hUltraDeep"]')).toHaveClass(/off/);
  // The white can be looked at, and says what it is for.
  await page.click('#pigBox .pig-pan[data-k="hChineseWhite"]');
  await expect(page.locator('#pigOne')).toContainText('Chinese White');
  await expect(page.locator('#pigOne')).toContainText('Body colour');
  // Recipes use only the box, in its own names, and never the white.
  const r = await page.evaluate(() => {
    const rec = paintRecipes([240, 196, 180], 'box', 3, 'water');
    const parts = rec.flatMap(x => x.parts.map(q => q[0]));
    return { mixing: paintKeys('box', 'water').length, n: parts.length, onlyTubes: parts.every(k => PIGMENTS[k].tube && !PIGMENTS[k].body), text: rec.map(paintRecipeText) };
  });
  expect(r.mixing).toBe(27);
  expect(r.n).toBeGreaterThan(0);
  expect(r.onlyTubes).toBe(true);
  // Its tubes' names, not a general pigment's.
  expect(r.text.join(' ')).not.toMatch(/Cadmium|Titanium|Ivory black/);
});
