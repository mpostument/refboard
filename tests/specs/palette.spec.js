// The palette generator (js/palette.js): Space for a new palette, locks,
// Undo, harmonies, values spread out, only what your paints mix, recipes,
// reordering, saved palettes, and a picture's palette from the Colour studio.
const { test, expect, openApp, quadrantsPng, QUADS } = require('../helpers');

const hexes = page => page.locator('#pgRow .pg-hex').allTextContents();
const open = async page => {
  await page.click('.nav-item[data-view="palette"]');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(5);
};

test('Space makes a new palette; a locked colour stays; Undo goes back', async ({ page }) => {
  await openApp(page);
  await open(page);
  await expect(page.locator('#viewTitle')).toHaveText('Palettes');
  const first = await hexes(page);
  await page.click('#pgRow .pg-sw[data-i="1"] [data-pg="lock"]');
  await expect(page.locator('#pgRow .pg-sw[data-i="1"] [data-pg="lock"]')).toHaveAttribute('aria-pressed', 'true');
  // The mouse click let go of the focus, so Space is a new palette, not the lock again.
  await page.keyboard.press(' ');
  const second = await hexes(page);
  expect(second[1]).toBe(first[1]);
  expect(second.filter((h, i) => h !== first[i]).length).toBeGreaterThanOrEqual(3);
  await page.click('#pgUndo');
  expect(await hexes(page)).toEqual(first);
  // Kept over a reload, lock and all.
  await page.reload();
  await open(page);
  expect(await hexes(page)).toEqual(first);
});

test('a harmony is followed, and the values are spread out', async ({ page }) => {
  await openApp(page);
  await open(page);
  for (const [harmony, gaps] of [['complementary', [180]], ['triadic', [120]], ['mono', [0]]]) {
    await page.click(`[data-pg-harmony="${harmony}"]`);
    const r = await page.evaluate(() => pg.swatches.map(s => ({ L: lstar(s.rgb), C: rgbOklch(s.rgb)[1], h: rgbOklch(s.rgb)[2] })));
    // A light and a dark, whatever the hues.
    const L = r.map(c => c.L);
    expect(Math.max(...L) - Math.min(...L), harmony).toBeGreaterThan(40);
    // Every colour with a hue is near one of the harmony's hues from the first.
    const withHue = r.filter(c => c.C > 0.04);
    const key = withHue[0].h, d = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
    for (const c of withHue) {
      const off = d(c.h, key);
      expect(Math.min(off, ...gaps.map(g => Math.abs(off - g))), harmony).toBeLessThan(35);
    }
  }
});

test('only what my paints mix: every colour inside what Zorn can reach', async ({ page }) => {
  await openApp(page);
  await open(page);
  await page.click('#pgPaints [data-paint-palette="zorn"]');
  await page.click('#pgFit');
  await expect(page.locator('#pgFit')).toHaveAttribute('aria-pressed', 'true');
  for (let k = 0; k < 4; k++) {
    await page.click('#pgGenerate');
    const outside = await page.evaluate(() => {
      const reach = paintReach('zorn', paintMedium());
      return pg.swatches.filter(s => {
        const [, a, b] = linToOklab(...s.rgb.map(c => srgbToLin(c / 255)));
        // On the edge counts as in: rounding to whole sRGB steps.
        return !pointInPolygon([a, b], reach) && Math.hypot(...[a, b].map((v, i) => v - mapIntoGamut([a, b], reach)[i])) > 0.01;
      }).length;
    });
    expect(outside).toBe(0);
  }
  // The same paints chosen in the Colour studio - one setting for the app.
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colPaints [data-paint-palette="zorn"]')).toHaveAttribute('aria-pressed', 'true');
});

test('each colour gets a recipe for your paints', async ({ page }) => {
  await openApp(page);
  await open(page);
  await expect(page.locator('#pgRow .pg-mix[aria-busy]')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('#pgRow .pg-mix .mix-row')).not.toHaveCount(0);
  // Oil paint, then back to watercolour - whose recipes never use white.
  await page.click('#pgMedium [data-paint-medium="opaque"]');
  await expect(page.locator('#pgMedium [data-paint-medium="opaque"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pgRow .pg-mix[aria-busy]')).toHaveCount(0, { timeout: 15000 });
  await page.click('#pgMedium [data-paint-medium="water"]');
  await expect(page.locator('#pgRow .pg-mix[aria-busy]')).toHaveCount(0, { timeout: 15000 });
  expect((await page.locator('#pgRow .pg-mix').allTextContents()).join(' ')).not.toContain('itanium white');
});

test('tints and shades, reordering, adding and removing', async ({ page }) => {
  await openApp(page);
  await open(page);
  const before = await hexes(page);
  // A darker one of the first colour.
  await page.click('#pgRow .pg-sw[data-i="0"] [data-pg="shades"]');
  await expect(page.locator('#pgRow .pg-shade')).toHaveCount(9);
  const dark = await page.locator('#pgRow .pg-shade').nth(7).getAttribute('data-pg-shade');
  await page.locator('#pgRow .pg-shade').nth(7).click();
  expect((await hexes(page))[0].toLowerCase()).toBe(dark);
  // The move handle from the keyboard: the first colour to second place.
  const now = await hexes(page);
  await page.focus('#pgRow .pg-sw[data-i="0"] [data-pg="move"]');
  await page.keyboard.press('ArrowRight');
  expect(await hexes(page)).toEqual([now[1], now[0], ...now.slice(2)]);
  await expect(page.locator('#pgRow .pg-sw[data-i="1"] [data-pg="move"]')).toBeFocused();
  // And by dragging: the last colour to the front.
  await page.dragAndDrop('#pgRow .pg-sw[data-i="4"] .pg-colour', '#pgRow .pg-sw[data-i="0"] .pg-colour');
  const dragged = await hexes(page);
  expect(dragged[0]).toBe(now[4]);
  await page.click('#pgAdd');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(6);
  await page.click('#pgRow .pg-sw[data-i="5"] [data-pg="remove"]');
  expect(await hexes(page)).toEqual(dragged);
  expect(before.length).toBe(5);
});

test('a palette is saved, and opened again', async ({ page }) => {
  await openApp(page);
  await open(page);
  const kept = await hexes(page);
  await page.click('#pgSave');
  await expect(page.locator('#pgSaved .pg-strip')).toHaveCount(1);
  await page.click('#pgGenerate');
  expect(await hexes(page)).not.toEqual(kept);
  await page.click('#pgSaved .pg-strip');
  expect(await hexes(page)).toEqual(kept);
  // Saving it again does not make two.
  await page.click('#pgSave');
  await expect(page.locator('#pgSaved .pg-strip')).toHaveCount(1);
  await page.click('#pgSaved [data-pg-del="0"]');
  await expect(page.locator('#pgSaved .pg-strip')).toHaveCount(0);
});

test("a picture's palette goes from the Colour studio to the generator", async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.setInputFiles('#colInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#colToPalette')).toBeVisible();
  await page.click('#colToPalette');
  await expect(page.locator('.nav-item[data-view="palette"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#pgRow .pg-sw')).toHaveCount(4);
  // Each of the picture's four colours is there, to a step of rounding.
  const got = await page.evaluate(() => pg.swatches.map(s => s.rgb));
  for (const want of Object.values(QUADS)) {
    expect(got.some(c => c.every((v, i) => Math.abs(v - want[i]) <= 2)), String(want)).toBe(true);
  }
});
