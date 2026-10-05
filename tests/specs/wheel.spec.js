// The colour wheel (js/wheel.js): a base colour, a harmony laid out round it,
// each colour mixed from the chosen paints - the Colour studio's Wheel tab.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

async function openWheel(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof wheelRender === 'function');
  await page.click('#colTabs [data-tab="wheel"]');
  await expect(page.locator('#whWheel')).toBeVisible();
}

test("the painter's wheel puts yellow opposite violet, red opposite green, blue opposite orange", async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof whPainterHue === 'function');
  const r = await page.evaluate(() => {
    // The OKLCH hue of the base and of the colour half a turn round, and how
    // grey their mixture is next to either - opposites cancel.
    const pair = angle => {
      const [a, b] = whColours({ mode: 'painter', harmony: 'comp', angle, r: 0.6, lstar: 60 });
      const ab = k => [k.lch[1] * Math.cos(k.lch[2] * Math.PI / 180), k.lch[1] * Math.sin(k.lch[2] * Math.PI / 180)];
      const [x, y] = ab(a), [u, v] = ab(b);
      return { h: [a.lch[2], b.lch[2]], mixChroma: Math.hypot((x + u) / 2, (y + v) / 2) / Math.min(a.lch[1], b.lch[1]) };
    };
    const hue = a => whPainterHue(a);
    // Painter's angles: yellow 0, orange 60, red 120, violet 180, blue 240, green 300.
    return { yellow: hue(0), orange: hue(60), red: hue(120), violet: hue(180), blue: hue(240), green: hue(300),
      yv: pair(90), rg: pair(90 - 120), bo: pair(90 - 240) };
  });
  const near = (h, want, tol) => Math.abs(((h - want + 540) % 360) - 180) <= tol;
  expect(near(r.yellow, 105, 8)).toBe(true);
  expect(near(r.orange, 55, 10)).toBe(true);
  expect(near(r.red, 25, 10)).toBe(true);
  expect(near(r.violet, 305, 15)).toBe(true);
  expect(near(r.blue, 255, 12)).toBe(true);
  expect(near(r.green, 150, 15)).toBe(true);
  // Each opposite pair, mixed, is much greyer than either colour is.
  for (const p of [r.yv, r.rg, r.bo]) expect(p.mixChroma).toBeLessThan(0.55);
  // And the pairs are the right ones: base yellow -> violet, base red -> green, base blue -> orange.
  expect(near(r.yv.h[1], r.violet, 1)).toBe(true);
  expect(near(r.rg.h[1], r.green, 1)).toBe(true);
  expect(near(r.bo.h[1], r.orange, 1)).toBe(true);
});

test('a hue goes round the wheel and back: on the painter\'s wheel and the perceptual one', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof whTheta === 'function');
  const worst = await page.evaluate(() => {
    let w = 0, down = true, last = Infinity;
    for (const mode of ['painter', 'perceptual']) {
      for (let t = 0; t < 360; t += 7) {
        const back = whTheta(whHue(t, mode), mode);
        w = Math.max(w, Math.abs(((back - t + 540) % 360) - 180));
      }
    }
    // The painter's hue changes the same way all the way round: no fold, no jump.
    for (let a = 0; a <= 360; a += 3) {
      const h = whPainterHue(a);
      const step = a === 0 ? 0 : ((h - last + 540) % 360) - 180;
      if (a && step >= 0) down = false;
      last = h;
    }
    return { w, down };
  });
  expect(worst.w).toBeLessThan(0.01);
  expect(worst.down).toBe(true);
});

test('the Wheel tab: a swatch per colour of the harmony, the base moved by pointer and keys', async ({ page }) => {
  await openWheel(page);
  const counts = { comp: 2, split: 3, analogous: 3, triad: 3, tetrad: 4, square: 4, shades: 5 };
  for (const [h, n] of Object.entries(counts)) {
    await page.click(`#whHarmonies [data-harmony="${h}"]`);
    await expect(page.locator('#whSwatches .wh-sw'), h).toHaveCount(n);
  }
  await page.click('#whHarmonies [data-harmony="comp"]');
  // The wheel is drawn, and a click on it moves the base there.
  const box = await page.locator('#whWheel').boundingBox();
  expect(box.width).toBeGreaterThan(200);
  const before = await page.locator('#whSwatches .wh-sw').first().locator('span').textContent();
  // The right-hand edge, a little in from the rim: strong, near the wheel's red-orange.
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.5);
  // (Just under 360 is as good as 0: the angle goes round.)
  await expect.poll(() => page.evaluate(() => Math.min(wh.angle, 360 - wh.angle))).toBeLessThan(3);
  const after = await page.locator('#whSwatches .wh-sw').first().locator('span').textContent();
  expect(after).not.toBe(before);
  // Arrow keys turn it by 3 degrees, Shift by 15; up and down change the strength.
  const a0 = await page.evaluate(() => wh.angle), r0 = await page.evaluate(() => wh.r);
  await page.focus('#whWheel');
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => wh.angle)).toBeCloseTo((a0 + 3 + 360) % 360, 5);
  await page.keyboard.press('Shift+ArrowRight');
  expect(await page.evaluate(() => wh.angle)).toBeCloseTo((a0 + 3 - 15 + 360) % 360, 5);
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => wh.r)).toBeCloseTo(r0 - 0.03, 5);
  // The choice is remembered across a reload.
  await page.click('#whHarmonies [data-harmony="square"]');
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="wheel"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#whHarmonies [data-harmony="square"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the other wheel keeps the same colour: switching wheels carries the hue across', async ({ page }) => {
  await openWheel(page);
  const hexOf = () => page.locator('#whSwatches .wh-sw').first().locator('span').textContent();
  const painter = await hexOf();
  await page.click('#whModes [data-mode="perceptual"]');
  expect(await hexOf()).toBe(painter);
  await page.click('#whModes [data-mode="painter"]');
  expect(await hexOf()).toBe(painter);
});

test('a colour the paints cannot reach is marked; the recipe is found on request', async ({ page }) => {
  await openWheel(page);
  // A strong blue: the Zorn palette (ochre, red, black) has nothing like it.
  await page.evaluate(() => { wh.angle = 90 - 240; wh.r = 0.8; wh.lstar = 55; saveWheelPrefs(); wheelRender(); });
  await page.click('#colPaints [data-paint-palette="zorn"]');
  await expect(page.locator('#whSwatches .wh-sw').first()).toHaveClass(/out/);
  await expect(page.locator('#whOne')).toContainText('cannot quite mix');
  await expect(page.locator('#whNote')).toContainText('past the dashed line');
  // The full palette reaches a muted blue; a recipe is searched for, and kept.
  await page.click('#colPaints [data-paint-palette="full"]');
  await page.evaluate(() => { wh.r = 0.15; wheelRender(); });
  await expect(page.locator('#whSwatches .wh-sw').first()).not.toHaveClass(/out/);
  await page.click('#whMix');
  await expect(page.locator('#whOne .mix-row')).toHaveCount(3);
  await expect(page.locator('#whMix')).toHaveCount(0);
  // Another colour is not mixed until asked; the first is still there when it returns.
  await page.click('#whSwatches .wh-sw >> nth=1');
  await expect(page.locator('#whMix')).toHaveCount(1);
  await page.click('#whSwatches .wh-sw >> nth=0');
  await expect(page.locator('#whOne .mix-row')).toHaveCount(3);
});

test("a picture's colours start the wheel; the harmony goes on to the palette generator", async ({ page }) => {
  await openWheel(page);
  await expect(page.locator('#whPicture')).toBeHidden();
  await page.setInputFiles('#colInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#whPictureChips .wh-pick').first()).toBeVisible();
  // The picture's first colour becomes the base, as near as the screen shows it.
  const want = await page.evaluate(() => colHex(col.palette[1].rgb));
  await page.locator('#whPictureChips .wh-pick').nth(1).click();
  const got = await page.locator('#whSwatches .wh-sw').first().locator('span').textContent();
  const ch = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  ch(want).forEach((v, i) => expect(Math.abs(v - ch(got)[i])).toBeLessThanOrEqual(8));
  // The same colours, in the palette generator.
  await page.click('#whHarmonies [data-harmony="triad"]');
  const hexes = await page.evaluate(() => whColours().map(k => colHex(k.rgb)));
  await page.click('#whToPalette');
  await expect(page.locator('#viewPalette')).toBeVisible();
  await expect(page.locator('#viewPalette .pg-sw')).toHaveCount(hexes.length);
  const kept = (await page.locator('#viewPalette .pg-hex').allTextContents()).map(h => h.toLowerCase());
  expect(kept).toEqual(hexes.map(h => h.toLowerCase()));
});
