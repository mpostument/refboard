// Search the library by colour (js/colourfind.js): the Colour button, named
// colours and moods, "like this picture", and what a page does without the
// server's palettes.json.
const { test, expect, openApp, makePng } = require('../helpers');

// Four pictures, as the server's palettes.json would describe them.
const PICS = {
  red:      ['c8372d:80', 'f2f2f2:20'],
  green:    ['4c9a48:70', '161616:30'],
  greenred: ['4c9a48:55', 'c8372d:10', '161616:35'],
  dark:     ['161616:90', '3d4f8a:10'],
};

async function library(page, { palettes = true } = {}) {
  const names = Object.keys(PICS);
  await page.route('**/index.json', r => r.fulfill({ json: {
    generated: 1, generatedIso: '', source: '/x', totalImages: names.length, totalBytes: 1000, packCount: 1, sizeHuman: '1 KB',
    packs: [{ name: 'Refs', count: names.length, groups: [{ name: 'Refs', rotation: false,
      images: names.map(n => ({ src: `/refs/${n}.jpg`, bytes: 100 })) }] }],
  } }));
  await page.route('**/features.json', r => r.fulfill({ status: 404, body: '' }));
  await page.route('**/palettes.json', r => palettes
    ? r.fulfill({ json: { generated: 1, images: Object.fromEntries(names.map(n => [`/refs/${n}.jpg`, { p: PICS[n], m: 1, b: 100 }])) } })
    : r.fulfill({ status: 404, body: '' }));
  const thumb = makePng(8, 8, () => [128, 128, 128]);
  await page.route('**/refs/**', r => r.fulfill({ contentType: 'image/png', body: thumb }));
  await openApp(page);
  await page.evaluate(() => { try { localStorage.setItem('refboard.news.v1', JSON.stringify(typeof NEWS_IDS === 'undefined' ? [] : NEWS_IDS)); } catch {} });
  await page.click('.nav-item[data-view="all"]');
  await expect(page.locator('#thumbGrid .cell')).toHaveCount(names.length);
}

const shown = page => page.locator('#thumbGrid .cell-name').allTextContents();

test('a named colour keeps the pictures that have it, the one with most of it first', async ({ page }) => {
  await library(page);
  await expect(page.locator('#btnColour')).toBeVisible();
  await page.click('#btnColour');
  await expect(page.locator('#colourPanel')).toBeVisible();
  await page.click('#colourPanel .cf-name[title="Green"]');
  expect(await shown(page)).toEqual(['green.jpg', 'greenred.jpg']);
  // The strip of colours is on every cell while a search is on.
  await expect(page.locator('#thumbGrid.colour-on .cell-pal').first()).toBeVisible();
});

test('two colours: every one has to be there, an accent may be small', async ({ page }) => {
  await library(page);
  await page.click('#btnColour');
  await page.click('#colourPanel .cf-name[title="Green"]');
  await page.click('#colourPanel .cf-name[title="Red"]');
  expect(await shown(page)).toEqual(['greenred.jpg']);
  // Taking the first away leaves red alone: the red picture first (80%), then the one with a little.
  await page.click('#colourPanel .cf-pick [data-cf="drop"][data-i="0"]');
  expect(await shown(page)).toEqual(['red.jpg', 'greenred.jpg']);
  await page.click('#colourPanel [data-cf="clear"]');
  expect((await shown(page)).length).toBe(4);
});

test('a colour from the picker, and a mood', async ({ page }) => {
  await library(page);
  await page.click('#btnColour');
  await page.locator('#cfPicker').evaluate(el => { el.value = '#161616'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  // Near-black: the dark picture has 90% of it, the others 30-35%.
  expect((await shown(page))[0]).toBe('dark.jpg');
  await page.click('#colourPanel [data-cf="mood"][data-i="2"]'); // Forest: deep green and nearly black green
  expect(await page.locator('#colourPanel .cf-pick').count()).toBe(2);
});

test('"Like this" finds the pictures closest in colour, itself first', async ({ page }) => {
  await library(page);
  await page.locator('#thumbGrid .cell', { hasText: 'green.jpg' }).hover();
  await page.locator('#thumbGrid .cell', { hasText: 'green.jpg' }).locator('.cell-like').click();
  await expect(page.locator('#colourPanel .cf-like')).toContainText('green.jpg');
  const names = await shown(page);
  expect(names[0]).toBe('green.jpg');
  expect(names[1]).toBe('greenred.jpg');
  expect(names).not.toContain('red.jpg');
  await page.click('#colourPanel [data-cf="unlike"]');
  expect((await shown(page)).length).toBe(4);
});

test('without palettes.json there is no Colour button and the grid is as it was', async ({ page }) => {
  await library(page, { palettes: false });
  await expect(page.locator('#btnColour')).toBeHidden();
  await expect(page.locator('#thumbGrid .cell-pal')).toHaveCount(0);
  await expect(page.locator('#thumbGrid .cell-like')).toHaveCount(0);
});
