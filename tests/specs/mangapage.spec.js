// The manga page (js/mangapage.js): panels for a page of three to six, numbered in the order they
// are read, with gutters, a slant and places for balloons - the third mode of the Perspective view.
const { test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgSheet svg')).toBeVisible();
  await page.click('#pgMode [data-mode="manga"]');
  await expect(page.locator('#mpSheet svg')).toBeVisible();
};
// The page's numbers, from the code that draws it: state in, geometry out.
const geo = (page, patch = {}) => page.evaluate(async p => {
  await loadSection('perspective');
  const s = { ...MP_DEFAULTS, ...p }, g = mpGeometry(s);
  return { W: g.W, H: g.H, rect: g.rect, words: g.words, largest: g.largest.n, note: mpNote(s, g),
    panels: g.panels.map(q => ({ n: q.n, c: q.c, area: q.area, quad: q.quad, balloons: q.balloons })) };
}, patch);
const box = q => ({ x0: Math.min(...q.map(p => p.x)), x1: Math.max(...q.map(p => p.x)), y0: Math.min(...q.map(p => p.y)), y1: Math.max(...q.map(p => p.y)) });

test('every layout has as many panels as it says, three to six of them, inside the margin', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('perspective');
    return MP_LAYOUTS.map(l => { const g = mpGeometry({ ...MP_DEFAULTS, layout: l.id }); return { id: l.id, n: l.n, got: g.panels.length, rect: g.rect, boxes: g.panels.map(p => p.quad) }; });
  });
  expect(new Set(r.map(l => l.n))).toEqual(new Set([3, 4, 5, 6]));
  for (const n of [3, 4, 5, 6]) expect(r.filter(l => l.n === n).length).toBeGreaterThanOrEqual(2);
  for (const l of r) {
    expect(l.got, l.id).toBe(l.n);
    for (const q of l.boxes) { const b = box(q); expect(b.x0, l.id).toBeGreaterThanOrEqual(l.rect.x0 - 1e-6); expect(b.x1, l.id).toBeLessThanOrEqual(l.rect.x1 + 1e-6); expect(b.y0, l.id).toBeGreaterThanOrEqual(l.rect.y0 - 1e-6); expect(b.y1, l.id).toBeLessThanOrEqual(l.rect.y1 + 1e-6); }
  }
});

test('read right to left: the first panel is the top right, the next to its left, then the row below', async ({ page }) => {
  await openApp(page);
  const rtl = await geo(page, { layout: 'grid-4', rtl: true }), ltr = await geo(page, { layout: 'grid-4', rtl: false });
  const [p1, p2, p3, p4] = rtl.panels;
  expect(p1.c.x).toBeGreaterThan(p2.c.x);
  expect(p1.c.y).toBeCloseTo(p2.c.y, 3);
  expect(p3.c.y).toBeGreaterThan(p1.c.y);
  expect(p3.c.x).toBeGreaterThan(p4.c.x);
  expect(ltr.panels[0].c.x).toBeLessThan(ltr.panels[1].c.x);
  expect(ltr.panels[0].c.y).toBeCloseTo(ltr.panels[1].c.y, 3);
});

test('a tall panel on the right is read first, then the two beside it from the top down', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { layout: 'tall-right' });
  const [a, b, c] = g.panels;
  expect(a.area).toBeGreaterThan(b.area * 1.5);
  expect(a.c.x).toBeGreaterThan(b.c.x);
  expect(b.c.y).toBeLessThan(c.c.y);
  expect(g.largest).toBe(1);
  expect(g.note).toContain('Panel 1 is the largest');
});

test('the white between two panels is the gutter, and a slant leans the gutters between rows only', async ({ page }) => {
  await openApp(page);
  const flat = await geo(page, { layout: 'grid-4', gutter: 6, slant: 0 });
  const [a, b, c] = flat.panels;
  expect(box(a.quad).x0 - box(b.quad).x1).toBeCloseTo(6, 3);
  expect(box(c.quad).y0 - box(a.quad).y1).toBeCloseTo(6, 3);
  const lean = await geo(page, { layout: 'bands-3', gutter: 4, slant: 10 });
  const top = lean.panels[0].quad;                           // its bottom edge is the first gutter
  expect(Math.abs(top[2].y - top[3].y)).toBeGreaterThan(5);
  const level = await geo(page, { layout: 'bands-3', gutter: 4, slant: 0 });
  expect(Math.abs(level.panels[0].quad[2].y - level.panels[0].quad[3].y)).toBeLessThan(1e-6);
  expect(lean.note).toContain('lean 10');
  // a slant is only as much as the panels can take
  const squeezed = await geo(page, { layout: 'koma-4', gutter: 4, slant: 12, format: 'b6' });
  for (const p of squeezed.panels) expect(mpAreaOf(p.quad)).toBeGreaterThan(0);
  function mpAreaOf(q) { return Math.abs(q.reduce((s, p, i) => s + p.x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * p.y, 0)) / 2; }
});

test('balloons: as many as asked, each lower and further along the reading than the last, inside their panel', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { layout: 'bands-3', balloons: 3 });
  expect(g.words).toBe(9);
  for (const p of g.panels) {
    expect(p.balloons).toHaveLength(3);
    for (let i = 1; i < 3; i++) { expect(p.balloons[i].y).toBeGreaterThan(p.balloons[i - 1].y); expect(p.balloons[i].x).toBeLessThan(p.balloons[i - 1].x); }
    const b = box(p.quad);
    for (const o of p.balloons) { expect(o.x - o.rx).toBeGreaterThan(b.x0); expect(o.x + o.rx).toBeLessThan(b.x1); expect(o.y - o.ry).toBeGreaterThan(b.y0); expect(o.y + o.ry).toBeLessThan(b.y1); }
  }
  const west = await geo(page, { layout: 'bands-3', balloons: 2, rtl: false });
  expect(west.panels[0].balloons[1].x).toBeGreaterThan(west.panels[0].balloons[0].x);
  expect((await geo(page, { balloons: 0 })).words).toBe(0);
});

test('the view: a row of layouts for the number of panels, a page that follows the choices and is remembered', async ({ page }) => {
  await open(page);
  await expect(page.locator('#mpCount button')).toHaveCount(4);
  const first = await page.locator('#mpSheet polygon[stroke-width="0.5"]').count();
  expect(first).toBe(4);
  await page.click('#mpCount [data-count="6"]');
  await expect(page.locator('#mpLayouts [data-layout]')).toHaveCount(3);
  await expect(page.locator('#mpSheet polygon[stroke-width="0.5"]')).toHaveCount(6);
  await page.click('#mpLayouts [data-layout="columns-6"]');
  await expect(page.locator('#mpLayouts [data-layout="columns-6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mpNote')).toContainText('6 panels, read right to left');
  await page.click('#mpDir [data-dir="ltr"]');
  await expect(page.locator('#mpNote')).toContainText('left to right');
  await page.selectOption('#mpFormat', 'b4');
  await expect(page.locator('#mpSize')).toHaveText('257 × 364 mm');
  await page.fill('#mpBalloons', '2'); await page.dispatchEvent('#mpBalloons', 'input');
  await expect(page.locator('#mpSheet ellipse')).toHaveCount(12);
  await page.uncheck('#mpNumbers');
  await expect(page.locator('#mpSheet text[font-weight="700"]')).toHaveCount(0);
  await page.reload();
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#mpSheet svg')).toBeVisible();      // the mode is remembered too
  await expect(page.locator('#mpLayouts [data-layout="columns-6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mpSize')).toHaveText('257 × 364 mm');
});

test('the print and the file are at the paper\'s own size, and Keep puts a picture in My work', async ({ page }) => {
  await open(page);
  const svg = await page.evaluate(() => mpSvg(mp, mpGeometry(mp), 'mm'));
  expect(svg).toContain('width="182mm" height="257mm"');
  await page.click('#mpKeep');
  await expect(page.locator('#mpKept')).toHaveText('Kept in My work as a manga page.');
});
