// My set (js/myset.js): the whole Copic range to mark from, named sets, and a palette
// matched to the markers you have.
const { test, expect, openApp } = require('../helpers');

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

async function palette(page, hexes) {
  await openApp(page);
  await page.evaluate(() => setView({ kind: 'palette' }));
  await expect(page.locator('#pgRow .pg-sw').first()).toBeVisible();
  await page.evaluate(rgbs => palgenTake(rgbs), hexes.map(rgb));
  await page.click('#pgFewFor [data-few-for="copic"]');
}

test('the whole Copic range is there, in families, and the find box narrows it', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.locator('#pgFewMine summary').click();
  expect(await page.evaluate(() => COPIC_COLOURS.length)).toBeGreaterThan(340);
  expect(await page.locator('#pgFewMineList [data-few-own]').count()).toBeGreaterThan(340);
  await expect(page.locator('#pgFewMineList [data-few-fam="RV"]')).toBeVisible();
  await page.fill('#pgFewMineFind', 'sepia');
  const n = await page.locator('#pgFewMineList [data-few-own]').count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(10);
  // A family button marks all of it, and again clears it.
  await page.fill('#pgFewMineFind', '');
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-fam="B"]');
  const marked = await page.evaluate(() => fewMine('copic').length);
  expect(marked).toBeGreaterThan(20);
  expect(await page.evaluate(() => fewMine('copic').every(c => FEW_COPIC[c].family === 'B'))).toBe(true);
  await page.click('#pgFewMineList [data-few-fam="B"]');
  expect(await page.evaluate(() => fewMine('copic').length)).toBe(0);
});

test('a set is named, kept, and comes back with one click', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-own="B29"]');
  await page.click('#pgFewMineList [data-few-own="R29"]');
  await page.fill('#pgSetName', 'Travel');
  await page.click('#pgSetSave');
  await expect(page.locator('#pgSets [data-my-set]')).toContainText('Travel');
  await page.click('#pgFewMineAll');
  expect(await page.evaluate(() => fewMine('copic').length)).toBeGreaterThan(340);
  await page.click('#pgSets [data-my-set="0"]');
  expect(await page.evaluate(() => fewMine('copic'))).toEqual(expect.arrayContaining(['B29', 'R29']));
  expect(await page.evaluate(() => fewMine('copic').length)).toBe(2);
  // Kept in this browser.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(MY_KEY)).sets[0].name)).toBe('Travel');
  await page.click('#pgSets [data-my-del="0"]');
  await expect(page.locator('#pgSets [data-my-set]')).toHaveCount(0);
});

test('Match shows each colour as a marker of the set, far ones are said, and Use these colours takes them', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b', '#2faa4a']);
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-own="B29"]');
  await page.click('#pgFewMineList [data-few-own="R29"]');
  await page.click('#pgMatch');
  await expect(page.locator('#pgMatchOut .pg-few-row')).toHaveCount(3);
  // Green is nothing the two have: it is far, and a marker to get next is named.
  await expect(page.locator('#pgMatchOut .pg-few-row').nth(2).locator('.pg-dE')).toHaveClass(/far/);
  await expect(page.locator('#pgMatchOut')).toContainText('Worth getting next');
  await page.click('#pgMatchUse');
  const swatches = await page.evaluate(() => pg.swatches.map(s => colHexOf(s.rgb)));
  const owned = await page.evaluate(() => myItems('copic').map(m => m.hex));
  for (const h of swatches) expect(owned).toContain(h);
  await page.click('#pgUndo');
  expect(await page.evaluate(() => colHexOf(pg.swatches[0].rgb))).toBe('#2f6fc0');
});

test('New palettes only from my set are made of the set\'s colours', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  for (const c of ['B29', 'R29', 'Y15', 'G17', 'V09', 'N5']) await page.click(`#pgFewMineList [data-few-own="${c}"]`);
  await page.click('#pgOnlyMine');
  await page.click('#pgGenerate');
  const swatches = await page.evaluate(() => pg.swatches.map(s => colHexOf(s.rgb)));
  const owned = await page.evaluate(() => myItems('copic').map(m => m.hex));
  expect(swatches.length).toBeGreaterThan(1);
  for (const h of swatches) expect(owned).toContain(h);
  expect(new Set(swatches).size).toBe(swatches.length);
});

test('the whole pencil range is there, in hue groups', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.click('#pgFewFor [data-few-for="pencils"]');
  await page.locator('#pgFewMine summary').click();
  expect(await page.evaluate(() => PENCIL_COLOURS.length)).toBeGreaterThan(110);
  expect(await page.locator('#pgFewMineList [data-few-own]').count()).toBeGreaterThan(110);
  const groups = await page.locator('#pgFewMineList [data-few-fam]').allTextContents();
  expect(groups.length).toBeGreaterThanOrEqual(7);
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-fam="Blue"]');
  expect(await page.evaluate(() => fewMine('pencils').every(c => FEW_PENCIL[c].family === 'Blue'))).toBe(true);
  expect(await page.evaluate(() => fewMine('pencils').length)).toBeGreaterThan(5);
});

test('Worth getting next names up to three, one after another, and a far colour offers near ones', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b', '#2faa4a', '#e8c030']);
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-own="N5"]');
  await page.click('#pgFewMineList [data-few-own="N7"]');
  await page.click('#pgMatch');
  const n = await page.locator('#pgMatchOut .pg-buy li').count();
  expect(n).toBeGreaterThanOrEqual(2);
  expect(n).toBeLessThanOrEqual(3);
  const codes = await page.locator('#pgMatchOut .pg-buy li .pg-few-paint').allTextContents();
  expect(new Set(codes).size).toBe(codes.length);
  await expect(page.locator('#pgMatchOut .pg-alt').first()).toBeVisible();
  await page.locator('#pgMatchOut .pg-alt summary').first().click();
  await expect(page.locator('#pgMatchOut .pg-alt').first()).toContainText('Nothing you have is near');
});

test('paints: a set of tubes is named, becomes a palette everywhere, and goes', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.click('#pgFewFor [data-few-for="paints"]');
  await page.locator('#pgPaintSet summary').click();
  const first = await page.locator('#pgPaintSetList [data-my-pig][aria-pressed="true"]').count();
  expect(first).toBeGreaterThan(2);
  await page.fill('#pgPaintSetName', 'Tin');
  await page.click('#pgPaintSetSave');
  await expect(page.locator('#pgPaints [data-paint-palette="my:Tin"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => paintPaletteKey())).toBe('my:Tin');
  expect(await page.evaluate(() => [...document.querySelectorAll('#paintSelect option')].some(o => o.value === 'my:Tin'))).toBe(true);
  await page.click('#pgPaintSets [data-my-pdel="0"]');
  await expect(page.locator('#pgPaints [data-paint-palette="my:Tin"]')).toHaveCount(0);
  expect(await page.evaluate(() => paintPaletteKey())).not.toBe('my:Tin');
});

test('a file of my set round-trips, and a wrong file is refused without harm', async ({ page }) => {
  await palette(page, ['#2f6fc0', '#e0383b']);
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  await page.click('#pgFewMineList [data-few-own="B29"]');
  await page.click('#pgFewMineList [data-few-own="R29"]');
  await page.fill('#pgSetName', 'Desk');
  await page.click('#pgSetSave');
  const file = await page.evaluate(() => JSON.stringify(myExport()));
  // wipe, then load back
  await page.evaluate(() => { my.sets.length = 0; few.own.copic = null; });
  const res = await page.evaluate(f => myImport(JSON.parse(f)), file);
  expect(res.ok).toBe(true);
  expect(await page.evaluate(() => fewMine('copic').sort())).toEqual(['B29', 'R29']);
  expect(await page.evaluate(() => my.sets.map(s => s.name))).toEqual(['Desk']);
  // not our file; hostile content
  expect((await page.evaluate(() => myImport({ hello: 1 }))).ok).toBe(false);
  expect((await page.evaluate(() => myImport(null))).ok).toBe(false);
  const bad = await page.evaluate(() => myImport({ app: 'refboard-myset', v: 1, own: { copic: ['<img>', 5, 'ZZZ'] }, sets: [{ name: '  ', kind: 'copic', codes: [] }, { name: 'x'.repeat(200), kind: 'nope', codes: [] }], paintSets: [{ name: 'p', keys: ['nonsense'] }] }));
  expect(bad.ok).toBe(true);
  expect(await page.evaluate(() => fewMine('copic').sort())).toEqual(['B29', 'R29']);
  expect(await page.evaluate(() => my.sets.length)).toBe(1);
});

test('edge cases: broken storage starts fresh, duplicate names collapse, an empty set is not saved', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('refboard.myset.v1', '{not json'));
  await page.reload();
  await page.evaluate(() => setView({ kind: 'palette' }));
  await expect(page.locator('#pgRow .pg-sw').first()).toBeVisible();
  expect(await page.evaluate(() => my.sets.length)).toBe(0);
  const clean = await page.evaluate(() => mySanitiseSets([
    { name: 'A', kind: 'copic', codes: ['B29', 'B29', 7] }, { name: ' A ', kind: 'copic', codes: ['R29'] },
    { name: 'A', kind: 'pencils', codes: [] }, null, 'x', { name: 5, kind: 'copic', codes: [] }]));
  expect(clean.map(s => s.kind + ':' + s.name)).toEqual(['copic:A', 'pencils:A']);
  expect(clean[0].codes).toEqual(['B29']);
  await page.click('#pgFewFor [data-few-for="copic"]');
  await page.locator('#pgFewMine summary').click();
  await page.click('#pgFewMineNone');
  await page.fill('#pgSetName', 'Empty');
  await page.click('#pgSetSave');
  expect(await page.evaluate(() => my.sets.length)).toBe(0);
});
