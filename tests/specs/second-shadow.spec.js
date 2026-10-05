// The second light's own shadow in the 3D forms (aimSunShadow in js/forms.js):
// a pillar seen from straight above, the key light from its left and the
// second from its right. Each throws a strip of shadow to the other side, and
// the second's is only there when "Casts a shadow" is on.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* The brightness of the floor at world x = `at` (z = 0), for each set of
   scene overrides in `sets`. Same pixel every time, so fog and colour cancel. */
const floorAt = (page, at, sets) => page.evaluate(([at, sets]) => {
  const W = 900, H = 560;
  return sets.map(set => {
    Object.assign(formScene, { bg: '#2a2a30', lightMarker: false, floorGrid: false, ground: true, groundColor: '#8a8a8a',
      yaw: 0, pitch: 88, zoom: 1.2, lightAz: -90, lightEl: 40, lightDist: LIGHT_SUN, softness: 0.3, intensity: 1,
      ambient: 0.2, bounce: 0, occlusion: 0, zones: false,
      fillOn: true, fillAz: 90, fillEl: 40, fillStrength: 0.8, fillColor: '#ffffff', fillShadow: true, ...set });
    formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, finish: set.finish || 'matte', shape: 'cube', x: 0, z: 0, y: 0, sx: 0.4, sy: 3, sz: 0.4 }];
    formScene.active = 0;
    formsRender(formScene, W, H, true);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(el('formsCanvas'), 0, 0);
    const v = new forms.T.Vector3(at, 0, 0).project(forms.camera);
    const x = Math.round((v.x * 0.5 + 0.5) * W), y = Math.round((0.5 - v.y * 0.5) * H);
    const d = g.getImageData(x - 1, y - 1, 3, 3).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / 9;
  });
}, [at, sets]);

test.describe('the second light casts a shadow', () => {
  test('a strip on the far side from it, only while it is switched on', async ({ page }) => {
    await openForms(page);
    // The pillar is 6 high and the light 40 degrees up: its shadow reaches 7 out.
    const [on, off, none] = await floorAt(page, -3.5, [{}, { fillShadow: false }, { fillOn: false }]);
    // The key lights this spot. With the second light's shadow off, the
    // second light adds its own on top; with it on, that share is shadowed,
    // and what is left is what the key and the sky give without it.
    expect(off).toBeGreaterThan(none * 1.1);
    expect(on).toBeLessThan(off * 0.9);
    expect(Math.abs(on - none)).toBeLessThan(none * 0.03);
  });

  test('leaves the floor on its own side alone', async ({ page }) => {
    await openForms(page);
    // The key's shadow falls here, the second light's does not.
    const [on, off] = await floorAt(page, 3.5, [{}, { fillShadow: false }]);
    expect(Math.abs(on - off)).toBeLessThan(2);
  });

  test('is not drawn in Anime, which only uses it as a rim', async ({ page }) => {
    await openForms(page);
    const out = await page.evaluate(() => {
      formScene.fillOn = true; formScene.fillShadow = true;
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, finish: 'anime' }];
      formsRender(formScene, 300, 200, true);
      return forms.fill.castShadow;
    });
    expect(out).toBe(false);
  });
});
