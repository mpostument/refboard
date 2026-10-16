// Skies (js/sky.js): a sky painted on the spot - a time of day, a kind of cloud,
// how much, what is under it - from noise, lit by a cheap rule, in perspective;
// the first half of the Sky and weather section.
const { openSection, test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await openSection(page, 'sky');
  await expect(page.locator('#skyNote')).toContainText('The colours are measured');
};
// Draws a sky from a state in the page and gives back what the tests ask of it.
const render = (page, patch, read) => page.evaluate(async ([patch, read]) => {
  await loadSection('sky');
  const s = { ...SKY_DEFAULTS, ...patch }, c = document.createElement('canvas');
  const t0 = performance.now(), r = skyRender(s, c), ms = performance.now() - t0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 97) sum = (sum * 31 + d[i]) | 0;      // a checksum of the picture
  return new Function('r', 'd', 'c', 'sum', 'ms', 'return (' + read + ')')(r, d, c, sum, ms);
}, [patch, read]);

const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('the same seed makes the same sky, another seed another; the picture is 960 x 540', async ({ page }) => {
  await openApp(page);
  const a = await render(page, { seed: 5 }, '[sum, c.width, c.height]');
  const b = await render(page, { seed: 5 }, '[sum, c.width, c.height]');
  const c = await render(page, { seed: 6 }, '[sum, c.width, c.height]');
  expect(a).toEqual(b);
  expect(c[0]).not.toBe(a[0]);
  expect([a[1], a[2]]).toEqual([960, 540]);
});

test('the cover sets how much of the sky is cloud: none for clear or 0, more as it grows, near all for an overcast', async ({ page }) => {
  await openApp(page);
  const share = (patch) => render(page, { time: 'noon', ground: 'none', ...patch }, 'r.cloudShare');
  expect(await share({ cloud: 'clear', cover: 100 })).toBe(0);
  expect(await share({ cloud: 'cumulus', cover: 0 })).toBeLessThan(2);
  const lo = await share({ cloud: 'cumulus', cover: 25 }), mid = await share({ cloud: 'cumulus', cover: 55 }), hi = await share({ cloud: 'cumulus', cover: 100 });
  expect(lo).toBeLessThan(mid);
  expect(mid).toBeLessThan(hi);
  expect(hi).toBeGreaterThan(55);
  expect(await share({ cloud: 'stratus', cover: 95 })).toBeGreaterThan(85);
  // Clear has no cloud colours to measure; a cumulus sky has.
  expect(await render(page, { time: 'noon', cloud: 'clear' }, 'r.palette.lit === null && r.palette.shade === null')).toBe(true);
  const lit = await render(page, { time: 'noon', cloud: 'cumulus', cover: 70 }, '[r.palette.lit, r.palette.shade]');
  expect(lit[0]).toBeTruthy(); expect(lit[1]).toBeTruthy();
  expect(lum(lit[0])).toBeGreaterThan(lum(lit[1]) + 25);           // the sunny side is lighter than the shadow side
});

test('the times of day: noon is a bright blue, night dark with stars, golden hour and dawn warm at the horizon, dusk dark above and red below', async ({ page }) => {
  await openApp(page);
  const p = {};
  for (const t of ['dawn', 'morning', 'noon', 'golden', 'dusk', 'night'])
    p[t] = await render(page, { time: t, cloud: 'clear', ground: 'none' }, '({ z: r.palette.zenith, h: r.palette.horizon })');
  expect(p.noon.z[2]).toBeGreaterThan(p.noon.z[0] + 60);           // blue
  expect(lum(p.night.z)).toBeLessThan(25);
  expect(lum(p.noon.z)).toBeGreaterThan(lum(p.dusk.z));
  expect(lum(p.dusk.z)).toBeGreaterThan(lum(p.night.z));
  for (const t of ['dawn', 'golden', 'dusk']) expect(p[t].h[0]).toBeGreaterThan(p[t].h[2] + 25);    // warm by the horizon
  expect(p.morning.h[2]).toBeGreaterThanOrEqual(p.morning.h[0]);   // a morning horizon is pale blue, not orange
  // Every sky is darker at the top than at the horizon except noon's, which is the deepest blue there.
  expect(lum(p.golden.h)).toBeGreaterThan(lum(p.golden.z));
  // Stars at night, none by day.
  const stars = t => render(page, { time: t, cloud: 'clear', ground: 'none' },
    '(() => { let n = 0; for (let y = 0; y < 300; y++) for (let x = 0; x < 300; x++) { const i = 4 * (y * c.width + x); if (d[i] > 150 && d[i + 1] > 150 && d[i + 2] > 150) n++; } return n; })()');
  expect(await stars('night')).toBeGreaterThan(30);        // over the left third of the top, away from the moon
  expect(await stars('noon')).toBe(0);
});

test('clouds crowd and flatten toward the horizon, as a deck seen in perspective does', async ({ page }) => {
  await openApp(page);
  // How much the cloud field changes from one pixel to the next along a row: more where the deck runs away.
  const busy = y => render(page, { time: 'noon', cloud: 'cumulus', cover: 60, ground: 'none' },
    `(() => { const P = SKY_CLOUDS.cumulus, hy = skyHorizon('none') * SKY_H; let s = 0, n = 0; for (let x = 0; x < SKY_W - 1; x += 2) { s += Math.abs(skyField(P, x + 1, ${y}, hy, 7) - skyField(P, x, ${y}, hy, 7)); n++; } return s / n; })()`);
  const top = await busy(40), near = await busy(500);
  expect(near).toBeGreaterThan(top * 2);
});

test('the sea carries the sun\'s path; hills rise above the horizon; sky only runs to the bottom edge', async ({ page }) => {
  await openApp(page);
  // Under the horizon, below the sun: lighter in the sun's path than far to one side.
  const sea = await render(page, { time: 'golden', cloud: 'clear', ground: 'sea' },
    '(() => { const T = SKY_TIMES.golden, y = Math.round(c.height * 0.8) + 10, k = x => { const i = 4 * (y * c.width + Math.round(x)); return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; }; return [k(T.sun.x * c.width), k(0.1 * c.width)]; })()');
  expect(sea[0]).toBeGreaterThan(sea[1] + 15);
  // Hills: the ridge is above the horizon line, so a pixel there is dark ground where 'sea' has sky.
  const ridge = await render(page, { time: 'noon', cloud: 'clear', ground: 'hills', seed: 3 },
    '(() => { let dark = 0; const y = Math.round(c.height * 0.8) - 4; for (let x = 0; x < c.width; x++) { const i = 4 * (y * c.width + x); if (d[i + 2] < 120) dark++; } return dark; })()');
  const flat = await render(page, { time: 'noon', cloud: 'clear', ground: 'sea', seed: 3 },
    '(() => { let dark = 0; const y = Math.round(c.height * 0.8) - 4; for (let x = 0; x < c.width; x++) { const i = 4 * (y * c.width + x); if (d[i + 2] < 120) dark++; } return dark; })()');
  expect(ridge).toBeGreaterThan(flat + 100);
  expect(await render(page, { ground: 'none' }, 'skyHorizon("none")')).toBe(1);
});

test('the view: chips for the time, cloud and ground; cover hidden for clear; Another sky; kept; saved as a PNG; opened in the workspace', async ({ page }) => {
  await open(page);
  await expect(page.locator('#skyCanvas')).toHaveJSProperty('width', 960);
  await expect(page.locator('#skyTime [aria-pressed="true"]')).toHaveText('Golden hour');
  await expect(page.locator('#skyNote')).toContainText('Golden hour: warm first');
  await expect(page.locator('#skyNote .sky-sw')).toHaveCount(4);       // top, horizon, lit and shaded cloud
  const before = await page.evaluate(() => skyLast && el('skyCanvas').toDataURL().length);
  await page.click('#skyTime [data-time="night"]');
  await expect(page.locator('#skyNote')).toContainText('Night: a deep graded wash');
  await expect(page.locator('#skyCanvas')).toHaveAttribute('aria-label', 'A night sky, cumulus');
  await page.click('#skyCloud [data-cloud="clear"]');
  await expect(page.locator('#skyCoverRow')).toBeHidden();
  await expect(page.locator('#skyNote .sky-sw')).toHaveCount(2);       // no cloud to measure
  await page.click('#skyCloud [data-cloud="storm"]');
  await expect(page.locator('#skyCoverRow')).toBeVisible();
  await page.locator('#skyCover').fill('80');
  await expect(page.locator('#skyCoverOut')).toHaveText('80% of the sky');
  expect(before).toBeGreaterThan(1000);
  // Kept for next time.
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(SKY_KEY)));
  expect(kept).toMatchObject({ time: 'night', cloud: 'storm', cover: 80 });
  // Another sky: another seed, a different picture.
  const seed0 = kept.seed, pic0 = await page.evaluate(() => el('skyCanvas').toDataURL());
  await page.click('#skyAnother');
  await expect.poll(() => page.evaluate(() => skyState.seed)).not.toBe(seed0);
  await expect.poll(() => page.evaluate(() => el('skyCanvas').toDataURL())).not.toBe(pic0);
  // Saved as a PNG named for it.
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#skySave')]);
  expect(dl.suggestedFilename()).toMatch(/^sky-night-storm-\d+\.png$/);
  // Opened in the workspace: a session on a 960 x 540 picture.
  await page.click('#skyOpen');
  await expect(page.locator('#session')).toBeVisible();
  await expect.poll(() => page.evaluate(() => [el('img').naturalWidth, el('img').naturalHeight])).toEqual([960, 540]);
});

test('it is on the rail under Prepare, found by Ctrl+K, and the weather half opens from What\'s new', async ({ page }) => {
  await openApp(page);
  // A tab of the Perspective grid's group, not a rail button of its own; still on the dashboard's Prepare card.
  await expect(page.locator('#rail .nav-item[data-view="sky"]')).toBeHidden();
  await expect(page.locator('#stages .stage-card[data-stage="Prepare"]').getByRole('button', { name: /Sky and weather/ })).toHaveCount(1);
  await page.keyboard.press('Control+k');
  await page.locator('#cmdkInput').fill('clouds');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Sky and weather');
  await page.keyboard.press('Enter');
  await expect(page.locator('#viewTitle')).toHaveText('Sky and weather');
  await expect(page.locator('#skyPane')).toBeVisible();
  await expect(page.locator('#wxPane')).toBeHidden();
});
