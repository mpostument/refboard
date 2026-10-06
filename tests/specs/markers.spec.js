// Grey markers for value studies (js/markers.js): the picture split into the
// greys of a marker set, each area with its marker's number; in a session as
// a layer with the set and the number of greys chosen in the note.
const { test, expect, makePng, openApp } = require('../helpers');

const grey = v => [v, v, v];
// Five vertical bands, 60 px each, white to near-black.
const BANDS = [250, 190, 130, 70, 15];
const bands = () => makePng(300, 120, x => grey(BANDS[Math.floor(x / 60)]));

test('five greys of a set of ten: spread over the picture, lightest first, never the same marker twice', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const sets = Object.fromEntries(Object.entries(MARKER_SETS).map(([k, s]) => [k, s.markers.map(m => m.L)]));
    return { sets, three: markersPick('tombow10', 3, 12, 90).map(m => m.code), all: markersPick('tombow10', 0, 12, 90).length,
      seven: markersPick('tombow12', 7, 12, 90).map(m => m.code), hex: [markerHex(0), markerHex(100)] };
  });
  // Lightest first in every set.
  for (const ls of Object.values(r.sets)) expect([...ls].sort((a, b) => b - a)).toEqual(ls);
  // The two ends of the range, and one in the middle.
  expect(r.three[0]).toBe('N95');
  expect(r.three[2]).toBe('N15');
  expect(r.three).toHaveLength(3);
  expect(r.all).toBe(10);
  expect(new Set(r.seven).size).toBe(7);
  expect(r.hex).toEqual(['#000000', '#ffffff']);
});

test('a picture in five bands: each band its own marker, the lightest left as paper, every area labelled', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const m = markersOf(stepsRead(img), { set: 'tombow10', n: 3 });
    const at = x => m.area[(m.h >> 1) * m.w + Math.round(x * m.w / 300)];
    return { picks: m.picks.map(k => k.code), bands: [30, 90, 150, 210, 270].map(at), share: m.share,
      spots: m.spots.map(s => m.picks[s.i].code).sort(), key: markersKey(m) };
  }, 'data:image/png;base64,' + bands().toString('base64'));
  expect(r.picks).toHaveLength(3);
  // The white band is the paper (-1); the rest go darker band by band, never lighter.
  expect(r.bands[0]).toBe(-1);
  for (let i = 1; i < 5; i++) expect(r.bands[i]).toBeGreaterThanOrEqual(r.bands[i - 1]);
  expect(r.bands[4]).toBe(2);
  // Shares add up, and the paper takes about a fifth.
  expect(r.share.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 4);
  expect(r.share[0]).toBeGreaterThan(15);
  expect(r.share[0]).toBeLessThan(25);
  // Each marker used has its number on at least one area.
  expect(new Set(r.spots).size).toBe(3);
  expect(r.key).toContain('N15');
  expect(r.key).toContain('left white');
});

test('in a session: a layer and a workspace row; the note changes the set and the number of greys, and keeps the choice', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'bands.png', mimeType: 'image/png', buffer: bands() });
  await expect(page.locator('#session')).toBeVisible();
  // No key of its own: from the workspace's Value tab.
  await page.locator('#wsTabs [data-tab="value"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Grey markers' }).click();
  await expect(page.locator('#btnMarkers')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#markerOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="markers"]');
  await expect(part).toContainText('left white');
  await expect(part.locator('.mk-row')).toHaveCount(6);        // 5 greys and the paper
  await part.locator('[data-mk-n="3"]').click();
  await expect(part.locator('.mk-row')).toHaveCount(4);
  await part.locator('[data-mk-n="0"]').click();
  await expect(part.locator('.mk-row')).toHaveCount(11);       // all ten and the paper
  await part.locator('[data-mk-set="tombow12"]').click();
  await expect(part.locator('.mk-row')).toHaveCount(12);       // all eleven of the ABT set and the paper
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(MARKER_KEY)));
  expect(kept).toEqual({ set: 'tombow12', n: 0 });

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="markers"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#markerOverlay')).toBeHidden();
});
