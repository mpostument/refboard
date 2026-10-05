// Sky occlusion on the floor of the 3D forms (formOcclusionRender in
// js/forms.js): the floor beside a form is darker than the floor far from
// it, in the sky's light and only the sky's.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* The floor seen from straight above, lit by the sky alone (the key at
   nothing), once with the occlusion at `occlusion` and once with it off.
   `at` are distances from the form's middle, in its own radii, along the
   floor to the right of it; returns, for each, the light left in the first
   picture as a share of the second - 1 - the occlusion - read from the
   pixels. The floor is the same pixel in both, so fog and colour cancel. */
const floorShare = (page, objects, at, set = {}) => page.evaluate(([objects, at, set]) => {
  const W = 900, H = 560;
  const shoot = occlusion => {
    Object.assign(formScene, { bg: '#2a2a30', lightMarker: false, fillOn: false, floorGrid: false, ground: true, groundColor: '#8a8a8a',
      yaw: 0, pitch: 88, zoom: 1, lightAz: -50, lightEl: 40, lightDist: LIGHT_SUN, intensity: 0, ambient: 0.6, bounce: 0,
      zones: false, occlusion, ...set });
    formScene.objects = objects.map(o => ({ ...FORM_OBJECT_DEFAULTS, finish: 'matte', ...o }));
    formScene.active = 0;
    formsRender(formScene, W, H, true);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.drawImage(el('formsCanvas'), 0, 0);
    return g.getImageData(0, 0, W, H).data;
  };
  const lin = v => Math.pow((v / 255 + 0.055) / 1.055, 2.4);
  const on = shoot(1), off = shoot(0);
  const T = forms.T, box = new T.Box3().setFromObject(forms.meshes[0]);
  const c = box.getCenter(new T.Vector3()), r = (box.max.x - box.min.x) / 2;
  return at.map(d => {
    const v = new T.Vector3(c.x + d * r, 0, c.z).project(forms.camera);
    const x = Math.round((v.x * 0.5 + 0.5) * W), y = Math.round((0.5 - v.y * 0.5) * H);
    let a = 0, b = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const k = ((y + j) * W + x + i) * 4; a += lin(on[k]); b += lin(off[k]); }
    return { d, x, y, share: a / b };
  });
}, [objects, at, set]);

test('a ball shuts out the sky as the physics says: (1 + (d/r)^2)^-1.5 from the foot', async ({ page }) => {
  await openForms(page);
  const at = [1.3, 1.7, 2.2, 3.0];
  const got = await floorShare(page, [{ shape: 'sphere' }], at);
  console.log('BALL', JSON.stringify(got.map(g => [g.d, +(1 - g.share).toFixed(3), +Math.pow(1 + g.d * g.d, -1.5).toFixed(3)])));
  for (const g of got) {
    expect(g.x, 'the sample is in the picture').toBeGreaterThan(0);
    expect(g.x).toBeLessThan(900);
    const exact = Math.pow(1 + g.d * g.d, -1.5);
    expect(Math.abs((1 - g.share) - exact), `at ${g.d} radii`).toBeLessThan(0.05);
  }
  // Darkest at the foot, fading with distance.
  for (let i = 1; i < got.length; i++) expect(got[i].share).toBeGreaterThan(got[i - 1].share);
});

test('a ball held up shuts out less of the floor than one that rests on it', async ({ page }) => {
  await openForms(page);
  const rests = await floorShare(page, [{ shape: 'sphere' }], [1.5]);
  const held = await floorShare(page, [{ shape: 'sphere', y: 2.5 }], [1.5]);
  console.log('HELD', JSON.stringify({ rests: rests[0].share, held: held[0].share }));
  expect(1 - rests[0].share).toBeGreaterThan(0.12);
  expect(1 - held[0].share).toBeLessThan((1 - rests[0].share) * 0.6);
});

test('the foot of a wall is shut out by about a third of the sky, and no more than half', async ({ page }) => {
  await openForms(page);
  // A cube as tall as it is wide: its wall would shut out half the sky if it
  // were endless, so rather less - and nowhere near all, as a ball's foot.
  const got = await floorShare(page, [{ shape: 'cube' }], [1.5, 1.9, 2.6]);
  console.log('WALL', JSON.stringify(got.map(g => [g.d, +(1 - g.share).toFixed(3)])));
  expect(1 - got[0].share).toBeGreaterThan(0.2);
  expect(1 - got[0].share).toBeLessThan(0.5);
  expect(got[1].share).toBeGreaterThan(got[0].share);
  expect(got[2].share).toBeGreaterThan(got[1].share);
});

test('only the sky is dimmed: the sun reaching the floor is not', async ({ page }) => {
  await openForms(page);
  const sky = await floorShare(page, [{ shape: 'sphere' }], [1.4]);
  // The same, with the sun on and the floor beside the ball lit by it (the
  // light is from the left, so the floor on the right is in the shadow: look
  // to the left, d negative).
  const sun = await floorShare(page, [{ shape: 'sphere' }], [-1.4], { intensity: 1, ambient: 0.18, lightAz: -90, lightEl: 60 });
  console.log('SUN', JSON.stringify({ sky: sky[0].share, sun: sun[0].share }));
  expect(1 - sky[0].share).toBeGreaterThan(0.15);
  expect(sun[0].share).toBeGreaterThan(0.93);
});

test('left out where it would not show: Anime, the zones view, no floor, none asked for', async ({ page }) => {
  await openForms(page);
  const state = set => page.evaluate(set => {
    Object.assign(formScene, { ground: true, zones: false, ambient: 0.4, occlusion: 1, ...set });
    formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'sphere', finish: set.finish || 'matte' }];
    formsRender(formScene, 300, 200, false);
    return forms.ground.material.userData.u.uFloorAO.value;
  }, set);
  expect(await state({})).toBe(1);
  expect(await state({ finish: 'anime' })).toBe(0);
  expect(await state({ zones: true })).toBe(0);
  expect(await state({ ground: false })).toBe(0);
  expect(await state({ occlusion: 0 })).toBe(0);
  expect(await state({ ambient: 0 })).toBe(0);
  expect(await state({ occlusion: 0.5 })).toBe(0.5);
});

test('Sky occlusion is a slider under Ambient, and old scenes get it at full', async ({ page }) => {
  await openForms(page);
  const slider = page.locator('#formsPanel [data-k="occlusion"]');
  await expect(slider).toHaveCount(1);
  await expect(slider.locator('xpath=ancestor::label/span')).toHaveText('Sky occlusion');
  const v = await page.evaluate(() => {
    const old = { ...formScene };
    delete old.occlusion;
    return normalizeFormScene(old).occlusion;
  });
  expect(v).toBe(1);
});
