const { test, expect, quadrantsPng, openApp } = require('../helpers');

async function openSession(page) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
}
const row = (page, id) => page.locator(`#layersList [data-layer="${id}"]`);

test('every overlay is a layer: on/off is the tool itself, opacity is kept', async ({ page }) => {
  await openSession(page);
  await page.click('#btnLayers');
  await expect(page.locator('#layersPanel')).toBeVisible();
  await expect(page.locator('#layersList .layer-row')).toHaveCount(12);
  await expect(page.locator('#layersCount')).toHaveText('none on');

  // The grid's checkbox is the same thing as "r" and the setup checkbox.
  await row(page, 'grid').locator('input[type=checkbox]').check();
  await expect(page.locator('#grid')).toBeVisible();
  await expect(page.locator('#optGrid')).toBeChecked();
  await expect(page.locator('#btnLayers')).toHaveAttribute('data-count', '1');

  // Its stylesheet opacity until the slider moves; then the slider's, kept.
  await expect(row(page, 'grid').locator('output')).toHaveText('30%');
  await row(page, 'grid').locator('input[type=range]').fill('0.8');
  await expect(page.locator('#grid')).toHaveCSS('opacity', '0.8');
  await expect(row(page, 'grid').locator('output')).toHaveText('80%');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('refboard.layers.v1')).grid)).toBe(0.8);

  // Keys on a slider stay there: "f" would flip the picture.
  await page.keyboard.press('f');
  await expect(page.locator('#img')).not.toHaveClass(/flip/);

  // A guide turned off and on again comes back as the one it was.
  await page.selectOption('#constructSelect', 'plumb');
  await expect(row(page, 'guides').locator('input[type=checkbox]')).toBeChecked();
  await expect(row(page, 'guides').locator('small')).toHaveText('Plumb line');
  await row(page, 'guides').locator('input[type=checkbox]').uncheck();
  await expect(page.locator('#constructSelect')).toHaveValue('off');
  await row(page, 'guides').locator('input[type=checkbox]').check();
  await expect(page.locator('#constructSelect')).toHaveValue('plumb');

  // A tool turned on from its own key shows up in the list.
  await page.locator('#layersClose').click();
  await page.keyboard.press('a');
  await page.click('#btnLayers');
  await expect(row(page, 'angle').locator('input[type=checkbox]')).toBeChecked();

  // Escape closes the panel, not the session.
  await page.keyboard.press('Escape');
  await expect(page.locator('#layersPanel')).toBeHidden();
  await expect(page.locator('#session')).toBeVisible();
});

test('"o" hides every overlay without turning any off', async ({ page }) => {
  await openSession(page);
  await page.keyboard.press('r');
  await expect(page.locator('#grid')).toBeVisible();

  await page.keyboard.press('o');
  await expect(page.locator('#grid')).toBeHidden();
  await expect(page.locator('#peekBadge')).toBeVisible();
  await expect(page.locator('#optGrid')).toBeChecked();

  await page.keyboard.press('o');
  await expect(page.locator('#grid')).toBeVisible();
  await expect(page.locator('#peekBadge')).toBeHidden();

  // Left on when the session ends, it is off in the next one.
  await page.keyboard.press('o');
  await page.keyboard.press('Escape');
  await expect(page.locator('#session')).toBeHidden();
  await expect(page.locator('#stage')).not.toHaveClass(/overlays-off/);
});

test('the ghost and focal point, once setup-only, are reachable in a session', async ({ page }) => {
  await openSession(page);
  await page.keyboard.press('Control+k');
  await page.fill('#cmdkInput', 'ghost');
  await expect(page.locator('#cmdkList li').first()).toContainText('Show ghost of the last pose');
  await page.keyboard.press('Enter');
  await expect(page.locator('#optGhost')).toBeChecked();

  await page.click('#btnLayers');
  // There is no last pose yet in a one-image session.
  await expect(row(page, 'ghost').locator('small')).toHaveText('from the next pose');
  await row(page, 'focal').locator('input[type=checkbox]').check();
  await expect(page.locator('#focalMarker')).toBeVisible();
});
