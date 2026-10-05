// Light thrown from one form onto another in the 3D forms (the rays in
// injectFormGuides, the colour picture in formOcclusionRender, js/forms.js):
// a white ball beside a red wall picks up red on the side that faces it.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* How much redder than blue the white ball is, at a spot on its side toward
   the wall (world x = 0.44, on the surface), for each set of overrides. Seen
   from above, the floor grey so its own bounce adds the same to every
   channel. The same pixel each time, so fog and light cancel. */
const redness = (page, wallX, sets, wallColor = '#d01010') => page.evaluate(([wallX, sets, wallColor]) => {
  const W = 900, H = 560;
  const lin = v => Math.pow((v / 255 + 0.055) / 1.055, 2.4);
  return sets.map(set => {
    Object.assign(formScene, { bg: '#2a2a30', lightMarker: false, fillOn: false, floorGrid: false, ground: true, groundColor: '#8a8a8a',
      yaw: 0, pitch: 88, zoom: 1.4, lightAz: -50, lightEl: 40, lightDist: LIGHT_SUN, softness: 0.3, intensity: 0.6,
      ambient: 0.5, bounce: 0.6, occlusion: 0, zones: false, ...set });
    formScene.objects = [
      { ...FORM_OBJECT_DEFAULTS, finish: 'matte', shape: 'sphere', color: '#f4f4f4', x: 0, z: 0 },
      { ...FORM_OBJECT_DEFAULTS, finish: 'matte', shape: 'cube', color: wallColor, sx: 0.2, sy: 1, sz: 2, x: wallX, z: 0 },
    ];
    formScene.active = 0;
    formsRender(formScene, W, H, true);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(el('formsCanvas'), 0, 0);
    const v = new forms.T.Vector3(0.44, 0.24, 0).project(forms.camera);
    const x = Math.round((v.x * 0.5 + 0.5) * W), y = Math.round((0.5 - v.y * 0.5) * H);
    const d = g.getImageData(x - 1, y - 1, 3, 3).data;
    let r = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); b += lin(d[i + 2]); }
    return (r - b) / 9;
  });
}, [wallX, sets, wallColor]);

test.describe('light thrown between forms', () => {
  test('a red wall beside a white ball tints its near side red', async ({ page }) => {
    await openForms(page);
    const [on, off] = await redness(page, 0.7, [{}, { bounce: 0 }]);
    expect(on).toBeGreaterThan(off + 0.02);
  });

  test('is gone when the wall is far, and when the wall is white', async ({ page }) => {
    await openForms(page);
    const [off] = await redness(page, 0.7, [{ bounce: 0 }]);
    const [far] = await redness(page, 6, [{}]);
    const [white] = await redness(page, 0.7, [{}], '#f4f4f4');
    expect(Math.abs(far - off)).toBeLessThan(0.01);
    expect(Math.abs(white - off)).toBeLessThan(0.01);
  });

  test('is not drawn in Anime', async ({ page }) => {
    await openForms(page);
    const out = await page.evaluate(() => {
      formScene.bounce = 0.6;
      formScene.objects = [0, 1].map(i => ({ ...FORM_OBJECT_DEFAULTS, finish: 'anime', x: i * 2 }));
      formsRender(formScene, 300, 200, true);
      return forms.meshes.map(m => m.material.userData.u.uNbr.value);
    });
    expect(out).toEqual([0, 0]);
  });
});
