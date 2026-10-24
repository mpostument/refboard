// Pen textures (js/pentextures.js): wood, stone, foliage, fur, water and brick -
// the Handbook's third chapter, each a rule for the hand drawn from a few numbers,
// with a practice sheet to print.
const { test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="handbook"]');
  await expect(page.locator('#hbLesson h3')).toBeVisible();
  await page.waitForFunction(() => typeof ptWood === 'function');
  await page.evaluate(() => {
    window.mkCanvas = () => { const c = document.createElement('canvas'); c.width = HB_SW; c.height = HB_SH; return c; };
    // Dark pixels in a band of a canvas.
    window.ink = (c, y0 = 0, y1 = c.height) => { const d = c.getContext('2d').getImageData(0, y0, c.width, y1 - y0).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++; return n; };
  });
};

test('wood: lines part round a knot and stop at its rings; close lines touch; a heavier pen inks more', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => { const c = mkCanvas(); return { ...ptWood(c, o), ink: ink(c) }; };
    return { plain: run({ lines: 22, knots: 0 }), knot: run({ lines: 22, knots: 1 }), many: run({ lines: 22, knots: 3 }), dense: run({ lines: 40, knots: 0, mm: 0.8 }), denseFine: run({ lines: 40, knots: 0, mm: 0.1 }),
      fine: run({ lines: 22, knots: 1, mm: 0.05 }), bold: run({ lines: 22, knots: 1, mm: 0.8 }) };
  });
  expect(r.plain.crossings).toBe(0);
  expect(r.knot.crossings).toBe(0);
  expect(r.dense.crossings).toBeGreaterThan(0);
  expect(r.denseFine.crossings).toBe(0);
  expect(r.knot.strokes).toBeGreaterThan(r.plain.strokes);
  expect(r.many.strokes).toBeGreaterThan(r.knot.strokes);
  expect(r.bold.ink).toBeGreaterThan(r.fine.ink * 2);
});

test('stone: three planes, the shading is the planes turned from the light, a rougher block has more chips', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => { const c = mkCanvas(); return { ...ptStone(c, o), ink: ink(c) }; };
    return { light: run({ shade: 0.1 }), heavy: run({ shade: 1 }), smooth: run({ rough: 0 }), rough: run({ rough: 1 }) };
  });
  expect(r.heavy.facets).toBe(3);
  expect(r.heavy.dark).toBeGreaterThan(r.light.dark);
  expect(r.heavy.strokes).toBeGreaterThan(r.light.strokes);
  expect(r.heavy.ink).toBeGreaterThan(r.light.ink);
  expect(r.rough.ink).toBeGreaterThan(r.smooth.ink * 0.9);
});

test('foliage: denser on the shadow side, more marks with the density, bigger marks with the size', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => ptFoliage(mkCanvas(), o);
    return { base: run({}), thin: run({ density: 0.1 }), thick: run({ density: 1 }), small: run({ leaf: 0 }), big: run({ leaf: 1 }) };
  });
  expect(r.base.shadowShare).toBeGreaterThan(0.5);
  expect(r.thick.marks).toBeGreaterThan(r.thin.marks * 2);
  expect(r.big.size).toBeGreaterThan(r.small.size * 2);
});

test('fur: longer hair gives longer flicks, more density more of them, and they thicken toward the shadow', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => ptFur(mkCanvas(), o);
    const c = mkCanvas(); ptFur(c, { density: 1 });
    return { short: run({ length: 0 }), long: run({ length: 1 }), few: run({ density: 0.1 }), many: run({ density: 1 }), top: ink(c, 20, 70), bottom: ink(c, 140, 190) };
  });
  expect(r.long.meanLength).toBeGreaterThan(r.short.meanLength * 1.8);
  expect(r.many.strokes).toBeGreaterThan(r.few.strokes * 2);
  expect(r.bottom).toBeGreaterThan(r.top);
});

test('water: the far rows are closer together and inked more; the reflection adds dark under the post only when it is on', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const c = mkCanvas(), calm = ptWater(c, { ripple: 0, reflection: false });
    const far = ink(c, 44, 84), near = ink(c, 150, 200);
    const on = ptWater(mkCanvas(), { reflection: true }), off = ptWater(mkCanvas(), { reflection: false });
    return { calm, far, near, on, off };
  });
  expect(r.calm.rows).toBeGreaterThan(8);
  expect(r.far / 40).toBeGreaterThan(r.near / 50);
  expect(r.calm.inkShare).toBeGreaterThan(0);
  expect(r.calm.inkShare).toBeLessThan(0.5);
  expect(r.on.reflection).toBeGreaterThan(0);
  expect(r.off.reflection).toBe(0);
});

test('brick: some drawn all round, the rest hinted, and more weathering means more bricks shaded and fewer drawn', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => ptBrick(mkCanvas(), o);
    return { fresh: run({ weathering: 0 }), worn: run({ weathering: 1 }), small: run({ size: 0 }), big: run({ size: 1 }) };
  });
  expect(r.fresh.bricks).toBeGreaterThan(20);
  expect(r.fresh.drawn).toBeLessThan(r.fresh.bricks);
  expect(r.worn.shaded).toBeGreaterThan(r.fresh.shaded);
  expect(r.worn.drawn).toBeLessThan(r.fresh.drawn);
  expect(r.small.bricks).toBeGreaterThan(r.big.bricks * 2);
});

test('the chapter: six lessons under "Pen textures", each moves a demonstration and prints a practice sheet', async ({ page }) => {
  await open(page);
  await expect(page.locator('#hbList .hb-group', { hasText: 'Pen textures' })).toBeVisible();
  const titles = await page.evaluate(() => HB_LESSONS.filter(l => l.group === PT_GROUP).map(l => l.title));
  expect(titles).toEqual(['Wood', 'Stone', 'Foliage', 'Fur', 'Water', 'Brick']);
  await page.evaluate(() => { window.__printed = null; window.printHtml = html => { window.__printed = html; }; });
  await page.locator('[data-hb-lesson="pen-water"]').click();
  await expect(page.locator('#hbLesson h3')).toHaveText('Water');
  const before = await page.locator('#hbRead').textContent();
  await page.locator('#hbRip').fill('100');
  await expect(page.locator('#hbRead')).not.toHaveText(before);
  await page.selectOption('#hbPen', '0.8');
  await page.click('#hbSheet');
  const html = await page.evaluate(() => window.__printed);
  expect(html).toContain('<img src="data:image/png;base64,');
  expect(html.match(/class="box"/g)).toHaveLength(6);
  expect(html).toContain('Water - a practice sheet');
});
