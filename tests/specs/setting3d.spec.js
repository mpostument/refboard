// Japanese settings in the 3D view (js/forms-settings.js): a classroom, a
// train carriage, a lane and a shrine built of simple volumes round the forms.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await page.click('[data-ftab="view"]');
  await expect(page.locator('#formSettings [data-setting="classroom"]')).toBeVisible();
}

// Renders the scene as it is and counts the pixels that are not the background.
const painted = page => page.evaluate(() => {
  formsRender(formScene, 320, 240, true);
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d');
  g.drawImage(el('formsCanvas'), 0, 0);
  const d = g.getImageData(0, 0, 320, 240).data, bg = [d[0], d[1], d[2]], colours = new Set();
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 12) n++;
    colours.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3);
  }
  return { n, colours: colours.size };
});

test('every setting builds, draws something and comes out again', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await openForms(page);
  await page.evaluate(() => { formScene.lightMarker = false; formScene.ground = false; formsChanged(); });
  const bare = await painted(page);
  for (const id of ['classroom', 'train', 'street', 'shrine']) {
    await page.click(`#formSettings [data-setting="${id}"]`);
    await expect(page.locator(`#formSettings [data-setting="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
    const p = await painted(page);
    // More of the frame is painted than by the form alone, in more colours.
    expect(p.n, id).toBeGreaterThan(bare.n * 1.5);
    expect(p.colours, id).toBeGreaterThan(bare.colours);
    expect(await page.evaluate(() => forms.scene.children.includes(forms.settingGroup))).toBe(true);
  }
  await page.click('#formSettings [data-setting="none"]');
  // The render that follows the click takes the group out of the scene.
  expect((await painted(page)).n).toBe(bare.n);
  expect(await page.evaluate(() => forms.settingGroup)).toBe(null);
  expect(errors).toEqual([]);
});

test('the walls between you and the room fall away as you turn', async ({ page }) => {
  await openForms(page);
  await page.click('#formSettings [data-setting="classroom"]');
  // From the front, the back wall faces the camera and fills the frame behind
  // the forms; turned to look from behind it, its back is to us and is gone.
  const wall = async yaw => {
    await page.evaluate(yaw => { Object.assign(formScene, { yaw, pitch: 10, ground: false }); formsRender(formScene, 320, 240, true); }, yaw);
    return page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 320; c.height = 240;
      const g = c.getContext('2d');
      g.drawImage(el('formsCanvas'), 0, 0);
      const d = g.getImageData(0, 0, 320, 240).data, bg = [d[0], d[1], d[2]];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 12) n++;
      return n / (320 * 240);
    });
  };
  const inside = await wall(0), behind = await wall(180);
  expect(inside).toBeGreaterThan(0.6);
  expect(behind).toBeLessThan(inside);
});

test('a setting suggests its sky, and None gives the studio back', async ({ page }) => {
  await openForms(page);
  const def = await page.evaluate(() => [formScene.bg, formScene.groundColor]);
  await page.click('#formSettings [data-setting="street"]');
  const sky = await page.evaluate(() => [formScene.bg, formScene.groundColor]);
  expect(sky).not.toEqual(def);
  await page.click('#formSettings [data-setting="none"]');
  expect(await page.evaluate(() => [formScene.bg, formScene.groundColor])).toEqual(def);
  // A background you chose is not touched.
  await page.evaluate(() => { formScene.bg = '#123456'; });
  await page.click('#formSettings [data-setting="shrine"]');
  expect(await page.evaluate(() => formScene.bg)).toBe('#123456');
});

test('an unknown setting in a saved scene or a link falls back to none', async ({ page }) => {
  await openForms(page);
  const got = await page.evaluate(() => [
    normalizeFormScene({ setting: 'castle' }).setting, normalizeFormScene({ setting: 'train' }).setting,
    formSceneDropped({ setting: 'castle' }, normalizeFormScene({ setting: 'castle' })).length]);
  expect(got).toEqual(['none', 'train', 1]);
});
