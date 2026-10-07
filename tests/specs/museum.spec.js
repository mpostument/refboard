// Museums (js/museum.js): the Met and the Rijksmuseum searched from the app,
// a result opened in the workspace. The museums' hosts are answered here,
// so the test needs no network - and can say which requests were made.
const { test, expect, openApp, quadrantsPng, makePng } = require('../helpers');

const EN = 'http://vocab.getty.edu/aat/300388277';
const png = quadrantsPng();

// One Met object. `pd: false` is one under copyright: no picture.
const metObject = (id, title, pd = true) => ({
  objectID: id, title, artistDisplayName: 'John Singer Sargent', objectDate: '1914', medium: 'Watercolor',
  isPublicDomain: pd, primaryImage: pd ? `https://images.metmuseum.org/full/${id}.jpg` : '',
  primaryImageSmall: pd ? `https://images.metmuseum.org/large/${id}.jpg` : '',
  objectURL: `https://www.metmuseum.org/art/collection/search/${id}`, creditLine: 'Gift, 1915',
});

// The three Linked Art documents behind one Rijksmuseum id.
const rijksDocs = (n, title, artist) => ({
  [`/20000000${n}`]: {
    identified_by: [{ type: 'Name', content: title, language: [{ id: EN }] }],
    produced_by: { referred_to_by: [{ content: artist, language: [{ id: EN }] }],
      timespan: { identified_by: [{ content: '1650', language: [{ id: EN }] }] } },
    made_of: [{ notation: [{ '@language': 'en', '@value': 'paper' }] }],
    shows: [{ id: `https://id.rijksmuseum.nl/20200000${n}` }],
    subject_of: [
      { subject_to: [{ classified_as: [{ id: 'https://creativecommons.org/publicdomain/zero/1.0/' }] }] },
      { digitally_carried_by: [{ format: 'text/html', access_point: [{ id: `https://www.rijksmuseum.nl/nl/collectie/object/R${n}` }] }] },
    ],
  },
  [`/20200000${n}`]: { digitally_shown_by: [{ id: `https://id.rijksmuseum.nl/50000000${n}` }] },
  [`/50000000${n}`]: { access_point: [{ id: `https://iiif.micr.io/IMG${n}/full/max/0/default.jpg` }] },
});

/* Both museums, in memory. Met: 3 ids on the first page (one of them
   under copyright) and 1 on the second. Rijksmuseum: the title search finds
   R1 and R2, the maker search R2 and R3 - three pictures, not four. */
async function fakeMuseums(page, { metFails = false } = {}) {
  const seen = [];
  const json = (route, body, status = 200) => route.fulfill({ status, json: body, headers: { 'access-control-allow-origin': '*' } });
  const docs = { ...rijksDocs(1, 'Ruiter', 'Hokusai'), ...rijksDocs(2, 'Storm', 'Hokusai'), ...rijksDocs(3, 'Golf', 'Hokusai') };
  const ld = ids => ({ orderedItems: ids.map(n => ({ id: `https://id.rijksmuseum.nl/20000000${n}` })) });

  await page.route(u => u.hostname === 'collectionapi.metmuseum.org', route => {
    const url = new URL(route.request().url());
    seen.push(url.pathname + url.search);
    if (metFails) return json(route, { message: 'down' }, 500);
    if (url.pathname.endsWith('/v1.1/search')) {
      const offset = Number(url.searchParams.get('offset'));
      return json(route, offset ? { total: 4, objectIDs: [4] } : { total: 4, objectIDs: [1, 2, 3] });
    }
    const id = Number(url.pathname.split('/').pop());
    return json(route, metObject(id, `Met ${id}`, id !== 2));
  });
  await page.route(u => u.hostname === 'data.rijksmuseum.nl', route => {
    const url = new URL(route.request().url());
    seen.push(url.pathname + url.search);
    return json(route, url.searchParams.has('creator') ? ld([2, 3]) : ld([1, 2]));
  });
  await page.route(u => u.hostname === 'id.rijksmuseum.nl', route => {
    const doc = docs[new URL(route.request().url()).pathname];
    return doc ? json(route, doc) : json(route, {}, 404);
  });
  await page.route(u => ['images.metmuseum.org', 'iiif.micr.io'].includes(u.hostname), route => {
    seen.push(route.request().url());
    return route.fulfill({ body: png, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } });
  });
  return seen;
}

const open = async page => {
  await page.click('.nav-item[data-view="museum"]');
  await expect(page.locator('#muQuery')).toBeVisible();
};
const search = async (page, q) => {
  await page.fill('#muQuery', q);
  await page.press('#muQuery', 'Enter');
};
const cards = page => page.locator('#muGrid .mu-card');

test('a search lists both museums, drops what has no public-domain picture, and More goes on', async ({ page }) => {
  await openApp(page);
  const seen = await fakeMuseums(page);
  await open(page);
  await expect(page.locator('#viewTitle')).toHaveText('Museums');
  await expect(page.locator('#muEmpty')).toBeVisible();

  await search(page, 'sargent watercolour');
  // Met: 2 of its 3 ids (one is under copyright). Rijksmuseum: 3, the shared one once.
  await expect(cards(page)).toHaveCount(5);
  await expect(page.locator('#muStatus')).toContainText('5 pictures');
  await expect(page.locator('#muEmpty')).toBeHidden();
  expect(seen.some(s => s.includes('/v1.1/search') && s.includes('hasImages=true') && s.includes('q=sargent%20watercolour'))).toBe(true);
  expect(seen.some(s => s.includes('title=sargent'))).toBe(true);
  expect(seen.some(s => s.includes('creator=sargent'))).toBe(true);

  // The Met has one more id on its next page; the Rijksmuseum has nothing more.
  await page.click('#muMore');
  await expect(cards(page)).toHaveCount(6);
  await expect(page.locator('#muMore')).toBeHidden();
  expect(seen.some(s => s.includes('offset=3'))).toBe(true);
});

test('a picture shows its credit and licence, and opens in the workspace', async ({ page }) => {
  await openApp(page);
  const seen = await fakeMuseums(page);
  await open(page);
  await search(page, 'sargent');
  await expect(cards(page)).toHaveCount(5);

  await cards(page).filter({ hasText: 'Met 1' }).click();
  await expect(page.locator('#muTitle')).toHaveText('Met 1');
  await expect(page.locator('#muSource')).toContainText('Licence: CC0');
  await expect(page.locator('#muPage')).toHaveAttribute('href', 'https://www.metmuseum.org/art/collection/search/1');

  // A Rijksmuseum picture: its page is the English one, its original is the IIIF "max".
  await cards(page).filter({ hasText: 'Storm' }).click();
  await expect(page.locator('#muMedium')).toHaveText('paper');
  await expect(page.locator('#muPage')).toHaveAttribute('href', 'https://www.rijksmuseum.nl/en/collection/object/R2');

  await cards(page).filter({ hasText: 'Met 3' }).click();
  await page.click('#muOpen');
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#wsPanel')).toBeVisible();
  // The Met's smaller copies carry no CORS header, so the original is what is read.
  expect(seen.some(s => s.includes('/full/3.jpg'))).toBe(true);
});

test('a big picture opens no larger than 1600 on its longest side; Full size keeps it whole', async ({ page }) => {
  await openApp(page);
  // A 3200 x 1200 picture for the "museum" to send.
  const big = makePng(3200, 1200, (x, y) => [x % 256, y % 256, 90]);
  await fakeMuseums(page);
  await page.route('https://images.metmuseum.org/full/1.jpg', r => r.fulfill({ body: big, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
  await open(page);
  await search(page, 'sargent');
  await cards(page).filter({ hasText: 'Met 1' }).click();
  await page.click('#muOpen');
  await expect(page.locator('#session')).toBeVisible();
  const size = () => page.evaluate(async () => {
    const img = document.querySelector('#img');
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(await size()).toEqual([1600, 600]);
});

test('Full size fetches the original', async ({ page }) => {
  await openApp(page);
  const seen = await fakeMuseums(page);
  await open(page);
  await search(page, 'sargent');
  await cards(page).filter({ hasText: 'Met 1' }).click();
  await page.click('#muFull');
  await expect(page.locator('#session')).toBeVisible();
  expect(seen.some(s => s.includes('/full/1.jpg'))).toBe(true);
});

test('a museum can be switched off - but not the last one - and the choice is kept', async ({ page }) => {
  await openApp(page);
  const seen = await fakeMuseums(page);
  await open(page);
  await page.click('#muSources [data-source="met"]');
  await expect(page.locator('#muSources [data-source="met"]')).toHaveAttribute('aria-pressed', 'false');
  // Rijksmuseum is the last one on: it stays.
  await page.click('#muSources [data-source="rijks"]');
  await expect(page.locator('#muSources [data-source="rijks"]')).toHaveAttribute('aria-pressed', 'true');

  await search(page, 'storm');
  await expect(cards(page)).toHaveCount(3);
  expect(seen.some(s => s.includes('collection/v1'))).toBe(false);

  await page.reload();
  await open(page);
  await expect(page.locator('#muSources [data-source="met"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#muQuery')).toHaveValue('storm');
});

test.describe('a museum that is down', () => {
  test.use({ allowErrors: /collectionapi\.metmuseum\.org/ });
  test('is named, and the other one still answers', async ({ page }) => {
    await openApp(page);
    await fakeMuseums(page, { metFails: true });
    await open(page);
    await search(page, 'sargent');
    await expect(cards(page)).toHaveCount(3);
    await expect(page.locator('#muStatus')).toContainText('The Met could not be reached');
  });
});

test('an example search fills the box and runs; an empty search asks for words', async ({ page }) => {
  await openApp(page);
  await fakeMuseums(page);
  await open(page);
  await page.click('#muSearch');
  await expect(page.locator('#muStatus')).toContainText('Type what to look for');
  await page.locator('#muExamples [data-example]').first().click();
  await expect(page.locator('#muQuery')).not.toHaveValue('');
  await expect(cards(page).first()).toBeVisible();
});
