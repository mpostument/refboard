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
      const f = forms.meshes[0].userData.face, g = f.userData.mats.gleam;
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

test('hair in locks: on the anime head only, in styles, round the head and down past it', async ({ page }) => {
  await openForms(page);
  const r = await page.evaluate(() => {
    const T = forms.T, look = (hair, shape = 'anime') => {
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape, hair }];
      formScene.active = 0;
      formsRender(formScene, 320, 240);
      const m = forms.meshes[0], h = m.userData.hair;
      if (!h) return null;
      const box = new T.Box3().setFromBufferAttribute(h.geometry.attributes.position);
      return { style: h.userData.style, top: box.max.y, low: box.min.y, verts: h.geometry.attributes.position.count,
        ring: !!h.geometry.attributes.hairT && !!h.geometry.attributes.hairShift };
    };
    const head = new T.Box3().setFromBufferAttribute(formGeometry('anime').attributes.position);
    return { head: { top: head.max.y, chin: head.min.y }, short: look('short'), bob: look('bob'), long: look('long'),
      none: look('none'), sphere: look('bob', 'sphere') };
  });
  // Over the top of the head, with room: hair has volume.
  for (const s of ['short', 'bob', 'long']) {
    expect(r[s].style).toBe(s);
    expect(r[s].ring).toBe(true);
    expect(r[s].top).toBeGreaterThan(r.head.top + 0.05);
  }
  // Short stops above the jaw, a bob at it, long well past the chin.
  expect(r.short.low).toBeGreaterThan(r.bob.low);
  expect(r.bob.low).toBeGreaterThan(r.long.low);
  expect(r.long.low).toBeLessThan(r.head.chin - 0.4);
  expect(r.none).toBeNull();
  expect(r.sphere).toBeNull();
});

test('the hair panel: styles, named colours, a character sheet\'s colour, and Skin', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => storePutItem('characters', 'c1', { name: 'Mika', t: 1, parts: { hair: { base: [96, 150, 200] } } }));
  await page.click('.nav-item[data-view="forms"]');
  const hair = page.locator('.fgroup:has([data-group="Face"])'), faceTab = page.locator('[data-ftab="face"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
  await page.click('#formShapes [data-shape="sphere"]');
  // No face, no Face tab.
  await expect(faceTab).toBeHidden();
  await expect(page.locator('.frow:has([data-k="color"]) > span')).toHaveText('Colour');
  await page.click('#formShapes [data-shape="anime"]');
  await expect(page.locator('.frow:has([data-k="color"]) > span')).toHaveText('Skin');
  await faceTab.click();
  await expect(hair).toBeVisible();
  await expect(hair.locator('[data-hair="bob"]')).toHaveAttribute('aria-pressed', 'true');
  await hair.locator('[data-hair="long"]').click();
  await expect(hair.locator('[data-hair="long"]')).toHaveAttribute('aria-pressed', 'true');
  await hair.locator('[aria-label="pink hair"]').click();
  await expect(hair.locator('[aria-label="pink hair"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [activeFormObject().hairColor, hairColourName(activeFormObject().hairColor)])).toEqual(['#f2a7c0', 'pink']);
  // Her hair, from her sheet - and named by the nearest colour Generate knows.
  const mika = hair.locator('[data-hair-char]', { hasText: 'Mika' });
  await mika.click();
  await expect(mika).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => hairColourName(activeFormObject().hairColor))).toBe('blue');
  // No hair: no colours to pick.
  await hair.locator('[data-hair="none"]').click();
  await expect(page.locator('#formHairColours')).toBeHidden();
  expect(await page.evaluate(() => { formsRender(formScene, 64, 64); return !forms.meshes[formScene.active].userData.hair; })).toBe(true);
});

test('with a ComfyUI: the head drawn with its hair', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true } }));
  await openForms(page);
  await page.evaluate(() => showAnimeHead());
  await page.evaluate(() => { Object.assign(activeFormObject(), { hair: 'long', hairColor: HAIR_COLOURS.silver }); formScene.yaw = 0; formScene.pitch = 0; formsChanged(); });
  await expect(page.locator('#formAnimeNote')).toContainText('Hair:');
  await page.locator('#formAnimeGen').click();
  await expect(page.locator('#genStatus')).toContainText('silver hair, long');
  await expect(page.locator('[data-gen="hair"][data-opt="long"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gen="colour"][data-opt="silver"]')).toHaveAttribute('aria-pressed', 'true');
});
