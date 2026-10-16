// Seasons and times of day (js/seasons.js): ready landscape palettes in the palette
// generator, six colours each, with what to do with them.
const { openSection, test, expect, openApp } = require('../helpers');

const hexes = page => page.locator('#pgRow .pg-hex').allTextContents();
const open = async page => {
  await openSection(page, 'palette');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(5);
};

test('eight scenes of six colours: each spans a range of values, and fog has the least colour and a narrow range', async ({ page }) => {
  await openApp(page);
  await open(page);
  const r = await page.evaluate(() => SEASONS.map(s => ({ id: s.id, n: s.hex.length, ok: s.hex.every(h => /^#[0-9a-f]{6}$/.test(h)), how: s.how.length, ...seasonSpread(s.id) })));
  expect(r.map(s => s.id)).toEqual(['spring', 'summer', 'autumn', 'winter', 'morning', 'noon', 'dusk', 'fog']);
  for (const s of r) { expect(s.n, s.id).toBe(6); expect(s.ok, s.id).toBe(true); expect(s.range, s.id).toBeGreaterThan(40); expect(s.how, s.id).toBeGreaterThan(80); }
  const fog = r.find(s => s.id === 'fog');
  for (const s of r.filter(s => s.id !== 'fog')) expect(s.chroma, s.id).toBeGreaterThan(fog.chroma);
  expect(fog.range).toBeLessThan(50);
  expect(r.find(s => s.id === 'noon').range).toBeGreaterThan(60);
});

test('a scene replaces the row, says what to do, and Undo brings the old row back; any change drops the scene', async ({ page }) => {
  await openApp(page);
  await open(page);
  const before = await hexes(page);
  await page.click('#pgSeasons [data-season="fog"]');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(6);
  expect(await hexes(page)).toEqual(await page.evaluate(() => SEASONS.find(s => s.id === 'fog').hex));
  await expect(page.locator('#pgSeasons [data-season="fog"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pgSeasonHint')).toContainText('wet-in-wet');
  // Every colour already has its recipe from the paints below.
  await expect(page.locator('#pgRow .pg-mix').first()).not.toHaveAttribute('aria-busy', 'true');
  await page.click('#pgUndo');
  expect(await hexes(page)).toEqual(before);
  await expect(page.locator('#pgSeasons [data-season="fog"]')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#pgSeasons [data-season="dusk"]');
  await page.click('#pgGenerate');
  await expect(page.locator('#pgSeasons [data-season="dusk"]')).toHaveAttribute('aria-pressed', 'false');
});

test('with "only what my paints mix", a scene is pulled in to what the paints can reach', async ({ page }) => {
  await openApp(page);
  await open(page);
  await page.click('#pgPaints [data-paint-palette="zorn"]');
  await page.click('#pgFit');
  await page.click('#pgSeasons [data-season="spring"]');
  const r = await page.evaluate(() => {
    const reach = paintReach('zorn', paintMedium()), raw = SEASONS.find(s => s.id === 'spring').hex;
    const out = pg.swatches.filter(s => {
      const [, a, b] = linToOklab(...s.rgb.map(c => srgbToLin(c / 255)));
      return !pointInPolygon([a, b], reach) && Math.hypot(...[a, b].map((v, i) => v - nearestOnPolygon([a, b], reach)[i])) > 0.01;
    }).length;
    return { outside: out, moved: pg.swatches.filter((s, i) => colHexOf(s.rgb) !== raw[i]).length };
  });
  expect(r.outside).toBe(0);
  expect(r.moved).toBeGreaterThan(0);
});
