// Skin tones (js/skin.js): a complexion in a light, in four zones - the light,
// the halftone, the shadow and the reflected light - with a recipe for each.
// The Colour studio's Skin tab.
const { test, expect, openApp } = require('../helpers');

test('the model: in every light every complexion steps light > halftone > reflected > shadow, and the halftone has the most colour', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof skinZones === 'function');
  const all = await page.evaluate(() => {
    const out = [];
    for (const k of Object.keys(LT_LIGHTS)) {
      const L = LT_LIGHTS[k], il = ltIllum(L.T, L.fill, L.r, L.dim || 1);
      for (const b of SK_BOUNCES) for (const c of SK_COMPLEXIONS) {
        const z = skinZones(c.rgb, il, b.rgb);
        out.push({ light: k, bounce: b.id, c: c.id, L: Object.fromEntries(Object.entries(z).map(([n, rgb]) => [n, lstar(rgb)])),
          C: Object.fromEntries(Object.entries(z).map(([n, rgb]) => [n, rgbOklch(rgb)[1]])) });
      }
    }
    return out;
  });
  expect(all.length).toBe(6 * 4 * 9);
  for (const r of all) {
    const tag = `${r.c} in ${r.light}, bounce ${r.bounce}`;
    expect(r.L.light, tag).toBeGreaterThan(r.L.half);
    expect(r.L.half, tag).toBeGreaterThan(r.L.refl);
    expect(r.L.refl, tag).toBeGreaterThan(r.L.shadow);
    expect(r.C.half, tag).toBeGreaterThanOrEqual(r.C.light);
  }
});

test('the model: the complexions run from pale to deep, a green bounce is greener than a warm one, a lamp is warmer than the sun', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof skinZones === 'function');
  const r = await page.evaluate(() => {
    const il = k => { const L = LT_LIGHTS[k]; return ltIllum(L.T, L.fill, L.r, L.dim || 1); };
    const base = SK_COMPLEXIONS.find(c => c.id === 'light').rgb, bounce = id => SK_BOUNCES.find(b => b.id === id).rgb;
    return {
      lights: SK_COMPLEXIONS.map(c => lstar(skinZones(c.rgb, il('noon'), bounce('earth')).light)),
      grass: skinZones(base, il('noon'), bounce('grass')).refl, earth: skinZones(base, il('noon'), bounce('earth')).refl,
      lamp: skinZones(base, il('lamp'), bounce('earth')).light, noon: skinZones(base, il('noon'), bounce('earth')).light,
    };
  });
  for (let i = 1; i < r.lights.length; i++) expect(r.lights[i]).toBeLessThan(r.lights[i - 1]);
  expect(r.grass[1] / r.grass[0]).toBeGreaterThan(r.earth[1] / r.earth[0]);
  // Under a lamp the lit skin has more red against its blue than in the midday sun.
  expect(r.lamp[0] / r.lamp[2]).toBeGreaterThan(r.noon[0] / r.noon[2]);
});

test('the Skin tab: a grid of complexions in the chosen light, one explained with a ball and a recipe for each zone, kept', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="skin"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  await expect(page.locator('#skLights [data-sk-light="noon"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#skGrid .lt-row')).toHaveCount(9);
  await expect(page.locator('#skGrid .lt-row.on')).toHaveAttribute('data-sk-c', 'light');
  await expect(page.locator('#skZones .sk-zone')).toHaveCount(4);
  await expect(page.locator('#skBall')).toBeVisible();
  // The ball is painted: its middle is not the paper.
  const ball = await page.evaluate(() => { const g = el('skBall').getContext('2d'); return [Array.from(g.getImageData(100, 75, 1, 1).data), Array.from(g.getImageData(2, 2, 1, 1).data)]; });
  expect(ball[0].slice(0, 3)).not.toEqual(ball[1].slice(0, 3));
  expect(ball[0][3]).toBe(255);
  // Recipes arrive a zone at a time.
  await expect(page.locator('#skZones .sk-zone .mix-row')).not.toHaveCount(0);
  await expect(page.locator('#skZones [data-sk-zone="refl"] .mix-row').first()).toBeVisible();
  await expect(page.locator('#skNote')).toContainText('the reflected light stands');

  const before = await page.locator('#skZones [data-sk-zone="shadow"] small').textContent();
  await page.click('#skGrid [data-sk-c="deep"]');
  await expect(page.locator('#skGrid .lt-row.on')).toHaveAttribute('data-sk-c', 'deep');
  await expect(page.locator('#skNote')).toContainText('On deep skin');
  expect(await page.locator('#skZones [data-sk-zone="shadow"] small').textContent()).not.toBe(before);
  await page.click('#skLights [data-sk-light="window"]');
  await expect(page.locator('#skLightHint')).toContainText('Cool light, warm shadow');
  await page.click('#skBounce [data-sk-bounce="grass"]');
  // Your own colour is a tenth row, chosen.
  await page.locator('#skOwn').fill('#c08060');
  await expect(page.locator('#skGrid .lt-row')).toHaveCount(10);
  await expect(page.locator('#skGrid .lt-row.on')).toHaveAttribute('data-sk-c', 'own');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(SK_KEY)))).toEqual({ c: 'own', own: [192, 128, 96], light: 'window', bounce: 'grass' });

  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="skin"]');
  await expect(page.locator('#skGrid .lt-row.on')).toHaveAttribute('data-sk-c', 'own');
  await expect(page.locator('#skLights [data-sk-light="window"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#skBounce [data-sk-bounce="grass"]')).toHaveAttribute('aria-pressed', 'true');
});

test('in watercolour the shadow also gets a glaze; in oil it does not', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="skin"]');
  await expect(page.locator('#skZones [data-sk-zone="refl"] .mix-row').first()).toBeVisible();
  const medium = await page.evaluate(() => col.medium);
  const glaze = page.locator('#skZones [data-sk-zone="shadow"]', { hasText: 'Or glaze' });
  if (medium === 'water') await expect(glaze).toHaveCount(1);
  else await expect(glaze).toHaveCount(0);
});
