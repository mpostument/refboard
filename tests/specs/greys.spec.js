// Grey ladder (js/greys.js): warm, neutral and cool greys from the chosen
// paints, each one mixture taken light to dark - the Colour studio's Greys tab.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

test('one mix per temperature: neutral is grey, warm is warmer, cool cooler, steps go dark', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof greyLadder === 'function');
  const r = await page.evaluate(() => {
    const lean = (c, hue) => { const h = hue * Math.PI / 180, s = c.steps.filter(x => x.reached);
      return s.reduce((a, x) => a + x.lab[1] * Math.cos(h) + x.lab[2] * Math.sin(h), 0) / s.length; };
    const one = (pk, m) => {
      const g = greyLadder(pk, m), [w, n, c] = g.cols;
      return { none: g.cols.map(x => !!x.none), n: n.dev, nL: n.steps.map(s => s.reached ? s.lab[0] : null),
        warm: w.none ? null : lean(w, 65) - lean(n, 65), cool: c.none ? null : lean(c, 250) - lean(n, 250),
        sets: g.cols.filter(x => !x.none).map(x => glSet(x.parts)), white: g.cols.filter(x => !x.none).map(x => x.steps.map(s => s.white)) };
    };
    return { earthW: one('earth', 'water'), earthO: one('earth', 'opaque'), zorn: one('zorn', 'water'), prim: one('primary', 'water') };
  });
  // Earth in watercolour: every column from umber and ultramarine, only the
  // ratio changes; the neutral a clean grey; the steps darken in order.
  expect(r.earthW.none).toEqual([false, false, false]);
  expect(new Set(r.earthW.sets)).toEqual(new Set(['ultramarine+umber']));
  expect(r.earthW.n).toBeLessThan(2);
  expect(r.earthW.warm).toBeGreaterThan(0.009);
  expect(r.earthW.cool).toBeGreaterThan(0.009);
  const L = r.earthW.nL.filter(v => v !== null);
  expect(L.length).toBe(7);
  for (let i = 1; i < L.length; i++) expect(L[i]).toBeLessThan(L[i - 1]);
  // In oil each step is white, measured - none in the darkest.
  expect(r.earthO.white[1][0]).toBeGreaterThan(8);
  expect(r.earthO.white[1][6]).toBe(0);
  // Zorn's palette has no blue: no cooler grey than black, and it says so.
  expect(r.zorn.none).toEqual([false, false, true]);
  expect(r.zorn.warm).toBeGreaterThan(0.009);
  // Three primaries: no pair cancels, so the neutral takes all three.
  expect(r.prim.sets[1].split('+').length).toBe(3);
});

test('the Greys tab: cells with water, a recipe per column, the picture\'s greys marked', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="greys"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  await expect(page.locator('.gl-cell[data-t="neutral"]')).toHaveCount(7);
  await expect(page.locator('.gl-cell[data-t="warm"]').first()).toContainText('%');
  await expect(page.locator('#glMixes')).toContainText('Neutral');
  await page.locator('.gl-cell[data-t="cool"][data-j="3"]').hover();
  await expect(page.locator('#glReadout')).toContainText(/Cool, value 57: .* wash/);
  // Oil: the same cells say how much white.
  await page.click('#colMedium [data-paint-medium="opaque"]');
  await expect(page.locator('.gl-cell[data-t="neutral"][data-j="0"]')).toContainText('white');
  // Zorn: the cool column is empty, and says why.
  await page.click('#colPaints [data-paint-palette="zorn"]');
  await expect(page.locator('.gl-cell[data-t="cool"]')).toHaveCount(0);
  await expect(page.locator('#glMixes')).toContainText('passes for blue');
  // A picture: its greys are marked on the ladder.
  await page.setInputFiles('#colInput', { name: 'quads.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#glNote')).toContainText("This picture's");
  // The tab is remembered, and arrows move between the three.
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="greys"]')).toHaveAttribute('aria-selected', 'true');
  await page.focus('#colTabs [data-tab="greys"]');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#colTabs [data-tab="picture"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#colTabs [data-tab="greys"]')).toHaveAttribute('aria-selected', 'true');
});
