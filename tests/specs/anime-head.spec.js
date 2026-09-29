// The anime head in 3D (FORM_SHAPES.anime, formAnimeFace() in
// js/forms-models.js; the angle note in js/forms.js): a head built the anime
// way with its face drawn on, and what its angle does to the eyes.
const { test, expect, openApp, fakeServer } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

// The anime head alone, turned `ry` and seen level from the front.
const pose = (page, ry, extra = {}) => page.evaluate(([ry, extra]) => {
  Object.assign(formScene, { yaw: 0, pitch: 0, zoom: 1, lightAz: -45, lightEl: 35, ...extra });
  formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'anime', color: '#f1d2bf', ry }];
  formScene.active = 0;
  formsRender(formScene, 640, 480);
  return { ...animeHeadReading(), view: animeHeadView(animeHeadReading()) };
}, [ry, extra]);

test('the face is a flat mask: turned, the far eye narrows far less than on a round head', async ({ page }) => {
  await openForms(page);
  const front = await pose(page, 0);
  expect(front.view).toBe('front');
  expect(front.mask).toBeGreaterThan(0.95);
  const three = await pose(page, 40);
  expect(three.view).toBe('three');
  expect(Math.abs(three.turn - 40)).toBeLessThan(3);
  // Narrower, but not by much - and much less than the same eyes on a ball.
  expect(three.mask).toBeLessThan(0.97);
  expect(three.mask).toBeGreaterThan(0.6);
  expect(three.mask - three.ball).toBeGreaterThan(0.1);
  expect((await pose(page, 90)).view).toBe('profile');
  expect((await pose(page, 180)).view).toBe('back');
  // Looked at from above, the face points up the screen less: "above".
  expect((await pose(page, 10, { pitch: 40 })).view).toBe('above');
});

test('its face is drawn on, and the gleam follows the light', async ({ page }) => {
  await openForms(page);
  const side = await page.evaluate(() => {
    const gleamFor = lightAz => {
      Object.assign(formScene, { yaw: 0, pitch: 0, lightAz, lightEl: 30 });
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'anime' }];
      formScene.active = 0;
      formsRender(formScene, 320, 240);
      const f = forms.meshes[0].userData.face, g = formAnimeFace().gleam;
      return f.userData.gleam.material === g['-1'] ? -1 : f.userData.gleam.material === g['1'] ? 1 : 0;
    };
    const out = [gleamFor(-60), gleamFor(60)];
    // Another shape takes the face off again.
    formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'sphere' }];
    formsRender(formScene, 320, 240);
    return { out, gone: !forms.meshes[0].userData.face && forms.meshes[0].children.length === 0 };
  });
  // Light from the viewer's left is the face's right: the gleams go there.
  expect(side.out).toEqual([-1, 1]);
  expect(side.gone).toBe(true);
});

test('the shapes in kinds, and the note under the view', async ({ page }) => {
  await openForms(page);
  const kinds = page.locator('#formShapes .shape-kind > span');
  await expect(kinds).toHaveText(['Forms', 'Figure and head', 'Cloth']);
  const heads = page.locator('#formShapes .shape-kind', { hasText: 'Figure and head' });
  await heads.locator('[data-shape="anime"]').click();
  await expect(heads.locator('[data-shape="anime"]')).toHaveAttribute('aria-pressed', 'true');
  const note = page.locator('#formAnimeNote');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Three-quarter');
  await expect(note).toContainText('on a real, round head');
  // No ComfyUI here: nothing to generate with.
  await expect(page.locator('#formAnimeGen')).toHaveCount(0);
  // Clean shows the scene alone.
  await page.click('#formsTools [data-clean]');
  await expect(note).toBeHidden();
  await page.click('#formsTools [data-clean]');
  await expect(note).toBeVisible();
  // Another shape: no note.
  await page.click('#formShapes [data-shape="sphere"]');
  await expect(note).toBeHidden();
});

test('with a ComfyUI: anime heads drawn from the angle it is seen at', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true } }));
  await openForms(page);
  await page.evaluate(() => showAnimeHead());
  await page.evaluate(() => { formScene.yaw = 0; formScene.pitch = 0; formsChanged(); });
  const go = page.locator('#formAnimeGen');
  await expect(go).toHaveText('Draw it at this angle');
  await go.click();
  await expect(page.locator('#genStatus')).toContainText('a head at three-quarters');
  await expect(page.locator('[data-gen="view"][data-opt="three"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gen="framing"][data-opt="head"]')).toHaveAttribute('aria-pressed', 'true');
});
