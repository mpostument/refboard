// Glazing (js/glazing.js): one paint glazed over another, against the other
// order and the palette mix - the Colour studio's Glazing tab.
const { test, expect, openApp } = require('../helpers');

test('the model: transparent glazes equal a mix, an opaque one veils, two layers go past one wash', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof glazePair === 'function');
  const r = await page.evaluate(() => {
    const f = (u, o, s, m = 'water') => { const p = glazePair(u, o, s, m); return { order: p.order, vsMix: p.vsMix, tooDark: p.tooDark, parts: p.mixParts, L: p.rgb }; };
    return { redOverBlue: f('ultramarine', 'cadRed', 0.5), blueOverRed: f('cadRed', 'ultramarine', 0.5),
      lemonPhthalo: f('lemon', 'phthaloBlue', 0.25), strong: f('sienna', 'ultramarine', 0.8), medium: f('sienna', 'ultramarine', 0.5) };
  });
  // Cadmium red is opaque: on top it veils, so the order shows...
  expect(r.redOverBlue.order).toBeGreaterThan(5);
  expect(r.redOverBlue.vsMix).toBeGreaterThan(5);
  // ...while ultramarine over it only filters - the same as the mix.
  expect(r.blueOverRed.vsMix).toBeLessThan(2);
  // Two transparent paints: the glaze is a mix, in parts by tinting strength.
  expect(r.lemonPhthalo.vsMix).toBeLessThan(2);
  expect(r.lemonPhthalo.parts).toEqual([['lemon', 7], ['phthaloBlue', 2]]);
  // Two strong layers are more paint than one wash can hold.
  expect(r.medium.tooDark).toBe(false);
  expect(r.strong.tooDark).toBe(true);
});

test('the Glazing tab: a chart of the palette, a crossing compared, strength and choice kept', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="glazing"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  // Watercolour, full palette: every paint but white, each over each.
  await expect(page.locator('.gz-cell')).toHaveCount(12 * 12);
  await expect(page.locator('#gzPair')).toContainText('Ultramarine blue over burnt sienna');
  await expect(page.locator('#gzNote')).toContainText('Order hardly matters');
  await page.locator('.gz-cell[data-u="ultramarine"][data-o="cadRed"]').hover();
  await expect(page.locator('#gzReadout')).toContainText('Cadmium red (opaque) over ultramarine');
  await page.click('.gz-cell[data-u="ultramarine"][data-o="cadRed"]');
  await expect(page.locator('.gz-cell.on')).toHaveCount(1);
  await expect(page.locator('#gzNote')).toContainText(/Order matters.*Cadmium red is opaque/);
  // Strong: two layers darker than any single wash.
  await page.click('#gzStrength [data-gz-s="strong"]');
  await page.click('.gz-cell[data-u="sienna"][data-o="ultramarine"]');
  await expect(page.locator('#gzNote')).toContainText('cannot get this dark');
  // A smaller palette: a smaller chart; oil speaks of the underpainting.
  await page.click('#colPaints [data-paint-palette="earth"]');
  await expect(page.locator('.gz-cell')).toHaveCount(5 * 5);
  await page.click('#colMedium [data-paint-medium="opaque"]');
  await expect(page.locator('.gz-cell')).toHaveCount(5 * 5);
  await expect(page.locator('#gzPair')).toContainText('Underpainting');
  await expect(page.locator('#gzNote')).toContainText("underpainting's white");
  // Kept: the tab, the strength and the crossing.
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="glazing"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#gzStrength [data-gz-s="strong"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.gz-cell.on')).toHaveAttribute('data-o', 'ultramarine');
  // Ctrl+K finds it from anywhere outside a session.
  await page.click('#colTabs [data-tab="picture"]');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('glazing');
  await page.keyboard.press('Enter');
  await expect(page.locator('#colTabs [data-tab="glazing"]')).toHaveAttribute('aria-selected', 'true');
});
