// Light and shadow (js/light.js): a colour under a chosen light, in the
// light and in its shadow - the Colour studio's Light tab.
const { test, expect, openApp } = require('../helpers');

test('the model: daylight leaves a colour alone, the sun leaves a blue shadow, a window a warm one', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.waitForFunction(() => typeof ltIllum === 'function');
  const r = await page.evaluate(() => {
    const on = k => { const L = LT_LIGHTS[k], il = ltIllum(L.T, L.fill, L.r, L.dim || 1);
      return { split: ltSplit(il), lit: ltUnder(CHAR_PAPER, il.lit), shade: ltUnder(CHAR_PAPER, il.shade) }; };
    return { same: ltUnder([184, 38, 58], ltIllum(6504, { T: 6504 }, 0.0001).lit),
      noon: on('noon'), golden: on('golden'), window: on('window'), lamp: on('lamp'), overcast: on('overcast') };
  });
  // Daylight on its own is the colour as it is.
  expect(r.same).toEqual([184, 38, 58]);
  // The sun: paper in shadow is lit by the sky alone - bluer than it is red.
  expect(r.noon.split).toBeGreaterThan(0.02);
  expect(r.noon.shade[2]).toBeGreaterThan(r.noon.shade[0] + 15);
  // Golden hour splits wider than noon; the lit paper goes warm.
  expect(r.golden.split).toBeGreaterThan(r.noon.split);
  expect(r.golden.lit[0]).toBeGreaterThan(r.golden.lit[2] + 20);
  // By a north window it turns round: the shadow is the warm one.
  expect(r.window.split).toBeLessThan(-0.02);
  expect(r.window.shade[0]).toBeGreaterThan(r.window.shade[2] + 15);
  // Under a lamp, or an overcast sky, the shadow is only darker.
  expect(Math.abs(r.lamp.split)).toBeLessThan(0.02);
  expect(Math.abs(r.overcast.split)).toBeLessThan(0.02);
  // A shadow is darker than the light, and the deeper the less fill.
  for (const k of ['noon', 'window', 'lamp', 'overcast']) expect(r[k].shade[1]).toBeLessThan(r[k].lit[1]);
  expect(r.lamp.shade[1]).toBeLessThan(r.overcast.shade[1]);
});

test('the Light tab: a light, each colour in it, one explained, your own colour, kept', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await page.click('#colTabs [data-tab="light"]');
  await expect(page.locator('#colWheel')).toBeHidden();
  // Golden hour and the samples to start with.
  await expect(page.locator('#ltLights [data-lt="golden"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lt-row')).toHaveCount(6);
  await expect(page.locator('#ltHint')).toContainText('Warm light, cool shadow');
  await expect(page.locator('#ltOne svg.lt-ball')).toBeVisible();
  // A window turns it round.
  await page.click('#ltLights [data-lt="window"]');
  await expect(page.locator('#ltHint')).toContainText('Cool light, warm shadow');
  await expect(page.locator('#ltT')).toHaveValue('8000');
  // One colour: a recipe for each side, and in watercolour a glaze.
  await page.click('.lt-row[data-id="red"]');
  await expect(page.locator('.lt-row.on')).toHaveAttribute('data-id', 'red');
  await expect(page.locator('#ltOne')).toContainText('Light');
  await expect(page.locator('#ltOne')).toContainText('Shadow');
  await expect(page.locator('#ltOne')).toContainText('Or glaze');
  await expect(page.locator('#ltNote')).toContainText('L* darker than in the light');
  // Oil: no glaze offered.
  await page.click('#colMedium [data-paint-medium="opaque"]');
  await expect(page.locator('#ltOne')).not.toContainText('Or glaze');
  // A slider makes the light your own.
  await page.locator('#ltT').fill('3000');
  await expect(page.locator('#ltLights [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#ltTOut')).toHaveText('3000 K');
  // Your own colour joins the list, first and chosen.
  await page.locator('#ltOwn').fill('#3366cc');
  await expect(page.locator('.lt-row')).toHaveCount(7);
  await expect(page.locator('.lt-row.on')).toHaveAttribute('data-id', 'own');
  // The Character tab's colours: none on a fresh sheet, and it says so.
  await page.click('#ltSource [data-lt-src="character"]');
  await expect(page.locator('.lt-row')).toHaveCount(1);
  await expect(page.locator('#ltRows')).toContainText('no colours yet');
  // Kept: the tab, the light, your colour, the source.
  await page.reload();
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colTabs [data-tab="light"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#ltTOut')).toHaveText('3000 K');
  await expect(page.locator('.lt-row[data-id="own"]')).toHaveCount(1);
  await expect(page.locator('#ltSource [data-lt-src="character"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#ltOwnClear');
  await expect(page.locator('.lt-row')).toHaveCount(0);
  // From the Character tab, and by Ctrl+K; Home and End on the tabs.
  await page.click('#colTabs [data-tab="character"]');
  await page.click('#charToLight');
  await expect(page.locator('#colTabs [data-tab="light"]')).toHaveAttribute('aria-selected', 'true');
  await page.focus('#colTabs [data-tab="light"]');
  await page.keyboard.press('Home');
  await expect(page.locator('#colTabs [data-tab="picture"]')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.locator('#colTabs [data-tab="light"]')).toHaveAttribute('aria-selected', 'true');
  await page.click('#colTabs [data-tab="picture"]');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('shadow colours');
  await page.keyboard.press('Enter');
  await expect(page.locator('#colTabs [data-tab="light"]')).toHaveAttribute('aria-selected', 'true');
});
