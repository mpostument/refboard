// Classic composition schemes (GRID_STYLES in js/session.js): Carlson's and
// Loomis's S-curve, L, steelyard, radiating and triangle, chosen in the same
// picker as the thirds and drawn over the picture by the same grid overlay.
const { test, expect, openApp } = require('../helpers');

const SCHEMES = ['scurve', 'ell', 'steelyard', 'radiating', 'triangle'];

test('each scheme draws something inside the frame, on a wide, square and tall picture alike', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(schemes => schemes.map(k => [0.5, 1, 1.78, 2.5].map(W => {
    const box = document.createElement('div');
    box.innerHTML = `<svg>${GRID_STYLES[k](W)}</svg>`;
    // Every number in the drawing is a position in the 0..100 viewBox.
    const nums = [...box.innerHTML.matchAll(/(?:d|x1|x2|y1|y2|cx|cy)="([^"]+)"/g)]
      .flatMap(m => m[1].match(/-?\d+(\.\d+)?(e-?\d+)?/g).map(Number));
    return { k, W, parts: box.querySelectorAll('path, line, ellipse').length, min: Math.min(...nums), max: Math.max(...nums) };
  })).flat(), SCHEMES);
  for (const s of r) {
    expect(s.parts, `${s.k} at ${s.W}`).toBeGreaterThan(0);
    expect(s.min, `${s.k} at ${s.W}`).toBeGreaterThanOrEqual(-0.01);
    expect(s.max, `${s.k} at ${s.W}`).toBeLessThanOrEqual(100.01);
  }
});

test('a ring stays a circle once the picture stretches the box: its radii agree in pixels', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => [0.6, 1, 2].map(W => {
    const box = document.createElement('div');
    box.innerHTML = `<svg>${GRID_STYLES.radiating(W)}</svg>`;
    const e = box.querySelector('ellipse');
    // The viewBox is stretched over a picture W times as wide as it is tall.
    return { W, rx: +e.getAttribute('rx') / 100 * W, ry: +e.getAttribute('ry') / 100 };
  }));
  for (const c of r) expect(c.rx).toBeCloseTo(c.ry, 6);
});

test('the steelyard balances: the big ring is four times the small one in area, a quarter of its distance from the fulcrum', async ({ page }) => {
  await openApp(page);
  const b = await page.evaluate(() => {
    const W = 1.5, box = document.createElement('div');
    box.innerHTML = `<svg>${GRID_STYLES.steelyard(W)}</svg>`;
    const rings = [...box.querySelectorAll('ellipse')].map(e => ({ x: +e.getAttribute('cx') / 100 * W, r: +e.getAttribute('ry') / 100 }));
    const tri = box.querySelector('path').getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
    return { rings, fulcrum: tri[2] / 100 * W };           // the triangle's apex
  });
  const [big, small] = b.rings;
  expect((big.r / small.r) ** 2).toBeCloseTo(4, 3);
  const torque = (big.r ** 2) * (b.fulcrum - big.x), other = (small.r ** 2) * (small.x - b.fulcrum);
  expect(Math.abs(torque - other) / torque).toBeLessThan(0.02);
});

test('the picker groups the schemes apart from the divisions and says in a line what the chosen one is for', async ({ page }) => {
  await openApp(page);
  await page.locator('[data-tab="display"]').first().click();
  const groups = await page.locator('#gridStyle optgroup').evaluateAll(gs => gs.map(g => [g.label, g.querySelectorAll('option').length]));
  expect(groups).toEqual([['Divide the frame', 7], ['Lay a shape (Carlson, Loomis)', 5]]);
  const note = page.locator('#gridStyleNote');
  await expect(note).toContainText('focus on a crossing');
  await page.selectOption('#gridStyle', 'steelyard');
  await expect(note).toContainText('big mass near the fulcrum');
  // Kept, and read back on the next visit.
  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  await page.locator('[data-tab="display"]').first().click();
  await expect(page.locator('#gridStyle')).toHaveValue('steelyard');
  await expect(note).toContainText('big mass near the fulcrum');
});

test('drawGrid lays the chosen scheme over the picture', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const k of ['thirds', 'scurve', 'triangle']) {
      state.gridStyle = k; drawGrid();
      out[k] = { paths: document.querySelectorAll('#grid path').length, note: document.getElementById('gridStyleNote').textContent };
    }
    return out;
  });
  expect(r.thirds.paths).toBe(0);
  expect(r.scurve.paths).toBe(1);
  expect(r.triangle.paths).toBe(1);
  expect(r.scurve.note).toContain('Hogarth');
});
