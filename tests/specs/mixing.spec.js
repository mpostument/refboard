// The mixing chart (js/mixing.js): every paint with every other - the Colour
// studio's Mixing tab - and the sheet to print and paint.
const { test, expect, openApp } = require('../helpers');

const colour = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof mcSheet === 'function' && typeof paintInit === 'function' && paintInit());
};
const L = rgb => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

test('the model: equal parts are the same either way round, two to one are not, the diagonal is the paint alone', async ({ page }) => {
  await colour(page);
  const r = await page.evaluate(() => {
    const f = (a, b, ratio, level = 'medium', m = 'water') => mcColour(a, b, ratio, level, m);
    return {
      ab: f('ultramarine', 'sienna', 'equal'), ba: f('sienna', 'ultramarine', 'equal'),
      twoAb: f('ultramarine', 'sienna', 'two'), twoBa: f('sienna', 'ultramarine', 'two'),
      alone: f('sienna', 'sienna', 'equal'), washed: paintRgb(paintWash([['sienna', 1]], MC_LEVELS.medium.s)),
      light: f('sienna', 'sienna', 'equal', 'light'), strong: f('sienna', 'sienna', 'equal', 'strong'),
      oilStrong: f('ultramarine', 'sienna', 'equal', 'strong', 'opaque'), oilLight: f('ultramarine', 'sienna', 'equal', 'light', 'opaque'),
    };
  });
  expect(r.ab).toEqual(r.ba);
  expect(r.twoAb).not.toEqual(r.twoBa);
  // Two parts of ultramarine to one sienna is bluer than the other way round.
  expect(r.twoAb[2] - r.twoAb[0]).toBeGreaterThan(r.twoBa[2] - r.twoBa[0]);
  expect(r.alone).toEqual(r.washed);                                 // a paint with itself is one wash of it
  expect(L(r.light)).toBeGreaterThan(L(r.strong));                   // more water, paler
  expect(L(r.oilLight)).toBeGreaterThan(L(r.oilStrong) + 30);        // more white, paler
});

test('the sheet: squares as big as the paper allows, up to 16 mm, the paper turned to give the bigger ones', async ({ page }) => {
  await colour(page);
  const r = await page.evaluate(() => ({
    four: mcSheet(4, 'a4', 'equal'), ten: mcSheet(10, 'a4', 'equal'),
    box: mcSheet(28, 'a4', 'equal'), boxA3: mcSheet(28, 'a3', 'equal'), boxFull: mcSheet(28, 'a3', 'two'),
    // 30 down a long thin sheet would want portrait: here the shorter side binds either way.
    tall: mcSheet(12, 'letter', 'two'),
  }));
  expect(r.four.cell).toBe(16);                                      // never bigger than needed
  expect(r.four.squares).toBe(10);                                   // 4 x 5 / 2: a triangle
  expect(r.ten.cell).toBeGreaterThan(14); expect(r.ten.cell).toBeLessThanOrEqual(16);
  expect(r.box.tooSmall).toBe(true);                                 // 28 tubes do not fit an A4 to paint
  expect(r.boxA3.tooSmall).toBe(false);
  expect(r.boxA3.W).toBe(420);
  expect(r.boxA3.squares).toBe(406); expect(r.boxFull.squares).toBe(784);
  // Whatever the size, the whole grid is inside the paper, clear of the margin.
  for (const s of Object.values(r)) {
    expect(s.gx + s.n * s.cell).toBeLessThanOrEqual(s.W - 10 + 1e-6);
    expect(s.gy + s.n * s.cell).toBeLessThanOrEqual(s.H - 12 + 1e-6);
  }
});

test('the printed sheet: empty squares by default, the predicted colours only on request, the paper at its real size', async ({ page }) => {
  await colour(page);
  const r = await page.evaluate(() => {
    const keys = mcKeys('earth', 'water'), chart = mcChart('earth', 'water', 'medium', 'equal'), sheet = mcSheet(keys.length, 'a4', 'equal');
    const base = { paletteLabel: 'Earth', medium: 'water', level: 'medium', ratio: 'equal' };
    const squares = svg => [...new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('rect')].filter(e => e.getAttribute('width') !== '297');
    const empty = mcSvg(chart, sheet, { ...base, show: false }, true), painted = mcSvg(chart, sheet, { ...base, show: true }, false);
    return { n: keys.length, empty, sq: squares(empty).map(e => [e.getAttribute('fill'), e.getAttribute('stroke-width')]),
      sqPainted: squares(painted).map(e => e.getAttribute('fill')), painted: painted.slice(0, 80) };
  });
  expect(r.n).toBe(5);
  expect(r.sq).toHaveLength(15);                                      // the triangle of five
  expect(r.sq.every(([fill]) => fill === 'none')).toBe(true);        // empty: paint goes on paper, not on a printed colour
  expect(r.sq.filter(([, w]) => w === '0.5')).toHaveLength(5);       // the diagonal, drawn heavier
  expect(r.sqPainted.every(f => /^rgb\(\d+,\d+,\d+\)$/.test(f))).toBe(true);
  expect(r.empty).toMatch(/viewBox="0 0 297 210" width="297mm" height="210mm"/);
  expect(r.painted).not.toContain('mm"');                             // the preview fills its box instead
  expect(r.empty).toContain('Mixing chart');
  expect(r.empty).toContain('The same water in every square');
  expect(r.empty).toContain('1  Yellow ochre');                      // the paints numbered down the side
});

test('the tab: a triangle of the palette, a square marked, the pair explained, kept', async ({ page }) => {
  await colour(page);
  await page.click('#colTabs [data-tab="mixing"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  // Watercolour, the full palette: 12 paints without white, equal parts is a triangle.
  await expect(page.locator('#mcChart .gz-cell')).toHaveCount(12 * 13 / 2);
  await page.click('#colPaints [data-paint-palette="earth"]');
  await expect(page.locator('#mcChart .gz-cell')).toHaveCount(5 * 6 / 2);
  await expect(page.locator('#mcSheetNote')).toContainText('A4 landscape: 5 paints, 15 squares of 16 mm');
  await page.click('#mcRatio [data-mc-ratio="two"]');
  await expect(page.locator('#mcChart .gz-cell')).toHaveCount(25);
  await expect(page.locator('#mcRatioNote')).toContainText("two parts of the row's paint");
  // One square: the pair, in words.
  await page.click('#mcChart .gz-cell >> nth=7');
  await expect(page.locator('#mcChart .gz-cell.on')).toHaveCount(1);
  await expect(page.locator('#mcPair')).toContainText('2 parts');
  await page.locator('#mcChart .gz-cell').nth(10).hover();
  await expect(page.locator('#mcReadout')).toContainText('click for the colour');
  // Ultramarine with burnt sienna cancel: the classic grey.
  await page.evaluate(() => { mc.pick = ['ultramarine', 'sienna']; mixingRender(); });
  await expect(page.locator('#mcPair')).toContainText('take each other');
  // A paint with itself: that paint's own note.
  await page.evaluate(() => { mc.pick = ['sienna', 'sienna']; mixingRender(); });
  await expect(page.locator('#mcPair')).toContainText('transparent earth');
  // Oil speaks in parts of white.
  await page.click('#colMedium [data-paint-medium="opaque"]');
  await expect(page.locator('#mcChart .gz-cell')).toHaveCount(25);
  await expect(page.locator('#mcPair')).toContainText('white');
  // Kept: the tab, the water, the proportions, the paper.
  await page.click('#mcLevel [data-mc-level="light"]');
  await page.selectOption('#mcPaper', 'a3');
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="mixing"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#mcLevel [data-mc-level="light"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mcRatio [data-mc-ratio="two"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mcPaper')).toHaveValue('a3');
});

test('a box of 28 tubes says it is too small on A4 and fits an A3', async ({ page }) => {
  await colour(page);
  await page.click('#colTabs [data-tab="mixing"]');
  await page.click('#colPaints [data-paint-palette="box"]');
  await expect(page.locator('#mcSheetNote')).toContainText('small to fill with a brush');
  await page.selectOption('#mcPaper', 'a3');
  await expect(page.locator('#mcSheetNote')).not.toContainText('small to fill');
  await expect(page.locator('#mcSheetNote')).toContainText('A3 landscape');
});

test('Print hands the browser the sheet at its real size, Save gives the SVG', async ({ page }) => {
  await colour(page);
  await page.click('#colTabs [data-tab="mixing"]');
  await page.click('#colPaints [data-paint-palette="earth"]');
  await page.evaluate(() => {
    window.__frames = [];
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.tagName === 'IFRAME' && window.__frames.push(n.srcdoc))))
      .observe(document.body, { childList: true });
  });
  await page.click('#mcPrint');
  await expect.poll(() => page.evaluate(() => window.__frames.length)).toBe(1);
  const html = await page.evaluate(() => window.__frames[0]);
  expect(html).toContain('@page{size:297mm 210mm;margin:0}');
  expect(html).toContain('width="297mm" height="210mm"');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#mcSave')]);
  expect(dl.suggestedFilename()).toBe('mixing-chart-earth-medium-equal.svg');
  expect(await require('fs').promises.readFile(await dl.path(), 'utf8')).toContain('Mixing chart');
});

test('Ctrl+K finds it', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('mixing chart');
  await page.keyboard.press('Enter');
  await expect(page.locator('#colTabs [data-tab="mixing"]')).toHaveAttribute('aria-selected', 'true');
});
