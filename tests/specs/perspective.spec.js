// Perspective grid (js/perspective.js): one, two or three vanishing points on
// a horizon, on the paper you draw on at its real size - a sheet to print.
const { test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgSheet svg')).toBeVisible();
};
// The sheet's numbers, from the code that draws it: state in, geometry out.
// The code loads when the view first opens (loadSection), so the maths tests ask for it.
const geo = (page, patch = {}) => page.evaluate(async p => {
  await loadSection('perspective');
  const s = { ...pgLoad(), ...p }, g = pgGeometry(s);
  return { W: g.W, H: g.H, hy: g.horizonY, vps: g.vps, view: g.view, rect: g.rect,
    lines: g.lines.map(l => ({ f: l.family, s: l.seg })), note: pgNote(s, g) };
}, patch);
// How far a segment's line passes from a point (0 when it runs through it).
const miss = (p, [x1, y1, x2, y2]) => Math.abs((x2 - x1) * (y1 - p.y) - (x1 - p.x) * (y2 - y1)) / Math.hypot(x2 - x1, y2 - y1);

test('the paper is its real size in mm, turned either way', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('perspective');
    return [
    pgPaper({ ...pgLoad(), format: 'a4', landscape: true }), pgPaper({ ...pgLoad(), format: 'a4', landscape: false }),
    pgPaper({ ...pgLoad(), format: 'letter', landscape: true }), pgPaper({ ...pgLoad(), format: 'square', landscape: true }),
    pgPaper({ ...pgLoad(), format: 'custom', customW: 120, customH: 300 })];
  });
  expect(r).toEqual([[297, 210], [210, 297], [279.4, 215.9], [200, 200], [120, 300]]);
});

test('two points: both on the horizon, level and either side of the middle, every line runs through its own point', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { points: 2, upright: false, margin: 10, spread: 90, horizon: 40 });
  expect(g.vps).toHaveLength(2);
  expect(g.vps[0].y).toBeCloseTo(g.hy, 6); expect(g.vps[1].y).toBeCloseTo(g.hy, 6);
  expect(g.hy).toBeCloseTo(g.H * 0.4, 6);
  expect(g.vps[0].x + g.vps[1].x).toBeCloseTo(g.W, 6);             // symmetric about the middle
  expect(g.vps[0].x).toBeLessThan(0);                               // 90% of the width out: off the sheet
  for (const l of g.lines) {
    expect(miss(g.vps[l.f], l.s)).toBeLessThan(1e-6);
    const [x1, y1, x2, y2] = l.s;                                  // and stays inside the margin
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      expect(x).toBeGreaterThanOrEqual(g.rect.x0 - 1e-6); expect(x).toBeLessThanOrEqual(g.rect.x1 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(g.rect.y0 - 1e-6); expect(y).toBeLessThanOrEqual(g.rect.y1 + 1e-6);
    }
  }
  // A point off the sheet still fills it: all 18 lines of each fan reach the paper.
  expect(g.lines.filter(l => l.f === 0)).toHaveLength(18);
  expect(g.lines.filter(l => l.f === 1)).toHaveLength(18);
});

test('a point on the sheet fans both ways, none of its lines along the horizon', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { points: 1, upright: false, vp1x: 50, horizon: 40, lines: 12 });
  expect(g.vps).toHaveLength(1);
  expect(g.vps[0].x).toBeCloseTo(g.W / 2, 6);
  expect(g.lines).toHaveLength(12);
  for (const l of g.lines) {
    expect(miss(g.vps[0], l.s)).toBeLessThan(1e-6);
    expect(Math.abs(l.s[1] - l.s[3])).toBeGreaterThan(1e-3);        // not flat: the horizon is drawn apart
  }
  // One line runs each way through the point: ends on opposite sides of it.
  const sides = new Set(g.lines.map(l => Math.sign(l.s[0] - g.vps[0].x) + '' + Math.sign(l.s[2] - g.vps[0].x)));
  expect([...sides].some(s => s === '-11' || s === '1-1')).toBe(true);
});

test('one point: the plumb lines are upright and the level ones are squares counted from the horizon', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { points: 1, upright: true, margin: 10, lines: 16, horizon: 40 });
  const ups = g.lines.filter(l => l.f === 'up').map(l => l.s);
  const plumb = ups.filter(s => s[0] === s[2]), level = ups.filter(s => s[1] === s[3]);
  expect(plumb.length).toBeGreaterThan(5);
  expect(level.length).toBeGreaterThan(3);
  expect(plumb.length + level.length).toBe(ups.length);
  const step = plumb[1][0] - plumb[0][0];                          // the cell is square
  const ys = level.map(s => s[1]).sort((a, b) => a - b), onH = ys.map(y => (y - g.hy) / step);
  for (const k of onH) expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
  expect(onH.some(k => Math.round(k) === 0)).toBe(false);          // the horizon itself is drawn apart
});

test('three points: the third is under (or over) the middle, and its lines make the verticals converge', async ({ page }) => {
  await openApp(page);
  const down = await geo(page, { points: 3, third: 'down', thirdDist: 150, upright: true });
  const up = await geo(page, { points: 3, third: 'up', thirdDist: 150, upright: true });
  expect(down.vps).toHaveLength(3);
  expect(down.vps[2].x).toBeCloseTo(down.W / 2, 6);
  expect(down.vps[2].y).toBeCloseTo(down.hy + 1.5 * down.H, 6);    // below the horizon
  expect(up.vps[2].y).toBeCloseTo(up.hy - 1.5 * up.H, 6);          // above it
  expect(down.lines.some(l => l.f === 'up')).toBe(false);          // no parallel plumb lines: they converge
  const third = down.lines.filter(l => l.f === 2);
  expect(third.length).toBeGreaterThan(5);
  for (const l of third) expect(miss(down.vps[2], l.s)).toBeLessThan(1e-4);
});

test('the view the sheet shows: 59 degrees for the default, a right angle when the points are close', async ({ page }) => {
  await openApp(page);
  const wide = await geo(page, { points: 2, spread: 90 }), close = await geo(page, { points: 2, spread: 50 });
  expect(wide.view).toBeCloseTo(2 * Math.atan(1 / 1.8) * 180 / Math.PI, 3);     // 58.7
  expect(close.view).toBeCloseTo(90, 3);
  expect(wide.note).toContain('inside the 60');
  expect(close.note).toContain('far too wide');
  expect((await geo(page, { points: 2, spread: 74 })).note).toContain('wider than the eye is easy with');
});

test('the note says which points are off the paper, and how far', async ({ page }) => {
  await openApp(page);
  const g = await geo(page, { points: 2, format: 'a4', landscape: true, spread: 90 });
  // 297 mm wide, the points 0.9 x 297 = 267 mm from the middle: 118.5 mm beyond each edge.
  expect(g.note).toContain('VP 1 is 119 mm left of the sheet');
  expect(g.note).toContain('VP 2 is 119 mm right of the sheet');
  expect(g.note).toContain('tape a strip');
  const near = await geo(page, { points: 2, spread: 40 });
  expect(near.note).not.toContain('tape a strip');
  const eye = await geo(page, { points: 1, horizon: 20 }), low = await geo(page, { points: 1, horizon: 80 });
  expect(eye.note).toContain('high viewpoint'); expect(low.note).toContain('low viewpoint');
});

test('the view opens from the rail, the controls follow the number of points and are kept', async ({ page }) => {
  await open(page);
  await expect(page.locator('#viewTitle')).toHaveText('Perspective grid');
  await expect(page.locator('#pgSpread')).toBeVisible();
  await expect(page.locator('#pgVp1x')).toBeHidden();
  await expect(page.locator('#pgThirdDist')).toBeHidden();
  await expect(page.locator('#pgSize')).toHaveText('297 × 210 mm');
  await page.click('#pgPoints [data-points="1"]');
  await expect(page.locator('#pgVp1x')).toBeVisible();
  await expect(page.locator('#pgSpread')).toBeHidden();
  await page.click('#pgPoints [data-points="3"]');
  await expect(page.locator('#pgThirdDist')).toBeVisible();
  await expect(page.locator('#pgUpright')).toBeHidden();           // no plumb lines when verticals converge
  await page.selectOption('#pgFormat', 'a5');
  await page.click('#pgOrient [data-orient="portrait"]');
  await expect(page.locator('#pgSize')).toHaveText('148 × 210 mm');
  await expect(page.locator('#pgSheet')).toHaveAttribute('aria-label', 'A 3-point perspective grid on 148 by 210 mm paper');
  await page.reload();
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgSize')).toHaveText('148 × 210 mm');
  await expect(page.locator('#pgPoints [data-points="3"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the preview is one SVG at the paper\'s proportions, one colour per point or one grey', async ({ page }) => {
  await open(page);
  const box = await page.locator('#pgSheet svg').getAttribute('viewBox');
  expect(box).toBe('0 0 297 210');
  const strokes = () => page.locator('#pgSheet svg').evaluate(s => [...new Set([...s.querySelectorAll('line')].map(l => l.getAttribute('stroke')))]);
  expect((await strokes()).length).toBeGreaterThan(2);
  await page.selectOption('#pgInk', 'one');
  const one = await strokes();
  expect(one).not.toContain('#c8412f');
  await page.locator('#pgLines').fill('30');
  await expect(page.locator('#pgLinesOut')).toHaveText('30');
  expect(await page.locator('#pgSheet svg line').count()).toBeGreaterThan(60);
});

test('a custom size shows its two boxes and is used as typed', async ({ page }) => {
  await open(page);
  await expect(page.locator('#pgCustom')).toBeHidden();
  await page.selectOption('#pgFormat', 'custom');
  await expect(page.locator('#pgCustom')).toBeVisible();
  await expect(page.locator('#pgOrient')).toBeHidden();
  await page.fill('#pgCustomW', '250'); await page.fill('#pgCustomH', '120');
  await page.locator('#pgCustomH').blur();
  await expect(page.locator('#pgSize')).toHaveText('250 × 120 mm');
  await page.fill('#pgCustomW', '5'); await page.locator('#pgCustomW').blur();
  await expect(page.locator('#pgSize')).toHaveText('50 × 120 mm');   // kept to a sheet that can exist
});

test('printing hands the browser the sheet at its real size, and Save gives an SVG of it', async ({ page }) => {
  await open(page);
  const html = await page.evaluate(() => pgPrintHtml({ ...persp, format: 'a4', landscape: true }));
  expect(html).toContain('@page{size:297mm 210mm;margin:0}');
  expect(html).toContain('width="297mm" height="210mm"');
  // The button builds the hidden frame; the print dialog itself is the browser's.
  // The frame removes itself once printing is over, so catch it as it is added.
  await page.evaluate(() => {
    window.__frames = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.tagName === 'IFRAME' && window.__frames.push(n.srcdoc))))
      .observe(document.body, { childList: true });
  });
  await page.click('#pgPrint');
  await expect.poll(() => page.evaluate(() => window.__frames.length)).toBe(1);
  expect(await page.evaluate(() => window.__frames[0])).toContain('@page{size:297mm 210mm;margin:0}');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pgSavefile')]);
  expect(dl.suggestedFilename()).toBe('perspective-2-point-297x210mm.svg');
  const text = await require('fs').promises.readFile(await dl.path(), 'utf8');
  expect(text).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 297 210" width="297mm" height="210mm">/);
});

test('Reset puts the sliders back and keeps the paper and the points', async ({ page }) => {
  await open(page);
  await page.click('#pgPoints [data-points="1"]');
  await page.selectOption('#pgFormat', 'a3');
  await page.locator('#pgHorizon').fill('80');
  await expect(page.locator('#pgHorizonOut')).toHaveText('80% from the top');
  await page.click('#pgReset');
  await expect(page.locator('#pgHorizonOut')).toHaveText('40% from the top');
  await expect(page.locator('#pgSize')).toHaveText('420 × 297 mm');
  await expect(page.locator('#pgPoints [data-points="1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('it is on the rail under Prepare and found by Ctrl+K', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.rail-stage[data-stage="Prepare"] [data-view="perspective"]')).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('vanishing');
  await page.keyboard.press('Enter');
  await expect(page.locator('#viewTitle')).toHaveText('Perspective grid');
});
