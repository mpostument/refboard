// The anime eye (ANIME_EYES, animeEyeShape() in js/vision.js): its styles,
// drawn on a photo's head and on the 3D anime head, with its colour, what it
// does at each angle, and Generate asked for it.
const { test, expect, quadrantsPng, openApp, fakeServer } = require('../helpers');

test('the styles are different eyes: tall shojo, narrow tsurime, drooping tareme - the iris always under the lash line', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => Object.fromEntries(Object.keys(ANIME_EYES).map(k => {
    const e = animeEyeShape(k, 1), top = e.upper(Math.PI / 2)[1], bottom = e.lower(Math.PI / 2)[1];
    // How far the iris ever pokes above the lash line (should be none).
    let over = 0;
    for (let i = 0; i <= 64; i++) {
      const [x, y] = e.iris(2 * Math.PI * i / 64), c = (x - e.ex) / e.E.a;
      if (Math.abs(c) < 1) over = Math.max(over, y - (e.ey + e.E.up * Math.sqrt(1 - c * c) + e.E.tilt * (1 + c) / 2));
    }
    return [k, { height: top - bottom, corner: e.upper(0)[1] - e.upper(Math.PI)[1], over, gleams: e.E.gleams.length }];
  })));
  expect(r.shojo.height).toBeGreaterThan(r.tv.height * 1.2);
  expect(r.sharp.height).toBeLessThan(r.tv.height * 0.7);
  // Tsurime: the outer corner higher than the inner. Tareme: lower.
  expect(r.sharp.corner).toBeGreaterThan(0.03);
  expect(r.soft.corner).toBeLessThan(-0.01);
  expect(r.tv.corner).toBe(0);
  for (const k of Object.keys(r)) expect(r[k].over).toBeLessThan(1e-9);
  expect(r.shojo.gleams).toBeGreaterThan(r.tv.gleams);
});

test('on a photo: the eye style beside Loomis / Anime, redrawn at once and kept', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  // A head facing you, from landmarks (head.spec.js has how they are built).
  await page.evaluate(() => {
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const pts = { 9: [0, 0, 1], 2: [0, -2 / 3, 1], 152: [0, -4 / 3, 0.88], 33: [-0.45, -0.2, 0.85], 263: [0.45, -0.2, 0.85], 10: [0, 0.9, 0.88] };
    for (const [i, [x, y, z]] of Object.entries(pts)) lm[i] = { x: 0.5 + x * 0.12, y: 0.5 - y * 0.12, z: -z * 0.12 };
    state.headOn = true; drawHead([lm]);
  });
  // Loomis: no eye styles to pick.
  await expect(page.locator('#poseNote [data-head-eyes]')).toHaveCount(0);
  await page.click('#poseNote [data-head-style="anime"]');
  await expect(page.locator('#poseNote [data-head-eyes="tv"]')).toHaveAttribute('aria-pressed', 'true');
  const eyeHeight = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('#headOverlay path.lash:not(.hid)')]
    .map(p => p.getBBox().height)));
  const tv = await eyeHeight();
  await page.click('#poseNote [data-head-eyes="shojo"]');
  await expect(page.locator('#poseNote [data-head-eyes="shojo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#poseNote')).toContainText('Shōjo eyes');
  await expect(page.locator('#headOverlay circle.gleam')).toHaveCount(6);
  expect(await eyeHeight()).toBeGreaterThan(tv);
  await page.reload();
  await expect(page.locator('#summary')).not.toBeEmpty();
  expect(await page.evaluate(() => headEyes)).toBe('shojo');
});

test('Ctrl+K "shojo" draws the anime face with shojo eyes', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.keyboard.type('shojo');
  await expect(page.locator('#cmdkList [role="option"]').first()).toContainText('Head construction: Anime, Shōjo eyes');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => [headStyle, headEyes, state.headOn])).toEqual(['anime', 'shojo', true]);
});

async function openForms(page) {
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

test('in 3D: each head its own eyes - a style and a colour, drawn again when they change', async ({ page }) => {
  await openApp(page);
  await openForms(page);
  const r = await page.evaluate(() => {
    formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'anime', ry: 40 }, { ...FORM_OBJECT_DEFAULTS, shape: 'anime', x: 3, eyes: 'sharp', eyeColor: EYE_COLOURS.green }];
    formScene.active = 0;
    formsRender(formScene, 320, 240);
    const mats = i => forms.meshes[i].userData.face.userData.mats;
    const before = { a: mats(0).key, b: mats(1).key, same: mats(0).features === mats(1).features };
    // The iris's colour, sampled at the eye's centre just below it.
    const irisAt = i => {
      const c = mats(i).features.map.image, e = animeEyeShape(formScene.objects[i].eyes, 1), B = ANIME_FACE_BOX, k = ANIME_FACE_PX;
      return [...c.getContext('2d').getImageData(Math.round((e.ex - B.x0) * k), Math.round((B.y1 - e.ey + 0.06) * k), 1, 1).data].slice(0, 3);
    };
    const green = irisAt(1);
    formScene.objects[0].eyes = 'shojo';
    formsRender(formScene, 320, 240);
    // A scene with nonsense in it comes back with the defaults.
    const n = normalizeFormScene({ objects: [{ shape: 'anime', eyes: 'huge', eyeColor: 'teal' }] }).objects[0];
    return { before, after: mats(0).key, green, reading: animeHeadReading().eyes, n: [n.eyes, n.eyeColor] };
  });
  expect(r.before.same).toBe(false);
  expect(r.before.a).toBe('tv#3f6fb5');
  expect(r.before.b).toBe('sharp#4f9a5c');
  expect(r.after).toBe('shojo#3f6fb5');
  // Green shows in the iris: more green than red or blue.
  expect(r.green[1]).toBeGreaterThan(r.green[0]);
  expect(r.green[1]).toBeGreaterThan(r.green[2]);
  expect(r.reading).toEqual({ style: 'shojo', colour: 'blue' });
  expect(r.n).toEqual(['tv', '#3f6fb5']);
});

test('the Hair and eyes panel: eye styles and colours, and a character gives both', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => storePutItem('characters', 'c1',
    { name: 'Aoi', t: 1, parts: { hair: { base: [236, 200, 126] }, eyes: { base: [200, 50, 60] } } }));
  await openForms(page);
  await page.click('#formShapes [data-shape="anime"]');
  const group = page.locator('.fgroup:has([data-group="Hair and eyes"])');
  await expect(group).toBeVisible();
  await expect(group.locator('h4')).toHaveText(['Hair', 'Eyes']);
  await expect(group.locator('[data-eyes="tv"]')).toHaveAttribute('aria-pressed', 'true');
  await group.locator('[data-eyes="sharp"]').click();
  await expect(group.locator('[data-eyes="sharp"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#formEyeNote')).toContainText('tsurime');
  await group.locator('[aria-label="green eyes"]').click();
  await expect(group.locator('[aria-label="green eyes"]')).toHaveAttribute('aria-pressed', 'true');
  // The note under the view says what the eyes do at this angle.
  await expect(page.locator('#formAnimeNote')).toContainText('Eyes:');
  // Aoi: her hair and her eyes in one click - even with no hair on.
  await group.locator('[data-hair="none"]').click();
  const aoi = group.locator('[data-hair-char]', { hasText: 'Aoi' });
  await expect(aoi).toBeVisible();
  await expect(aoi.locator('.dot')).toHaveCount(2);
  await aoi.click();
  await expect(aoi).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => { const o = activeFormObject(); return [o.hair, hairColourName(o.hairColor), eyeColourName(o.eyeColor)]; }))
    .toEqual(['bob', 'blonde', 'red']);
});

test('with a ComfyUI: the head drawn with its eyes - their colour and shape as Danbooru tags', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true } }));
  await openApp(page);
  await openForms(page);
  await page.evaluate(() => showAnimeHead());
  await page.evaluate(() => {
    Object.assign(activeFormObject(), { eyes: 'sharp', eyeColor: EYE_COLOURS.red });
    formScene.yaw = 0; formScene.pitch = 0; formsChanged();
  });
  await page.locator('#formAnimeGen').click();
  await expect(page.locator('#genStatus')).toContainText('red eyes, sharp');
  await expect(page.locator('[data-gen="eyes"][data-opt="red"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gen="eyeShape"][data-opt="sharp"]')).toHaveAttribute('aria-pressed', 'true');
  const prompt = await page.evaluate(() => genPrompt(genChoices).prompt);
  expect(prompt).toContain('red eyes');
  expect(prompt).toContain('tsurime');
  // A landscape has no eyes to ask for.
  expect(await page.evaluate(() => genPrompt({ ...genChoices, subject: 'landscape' }).prompt)).not.toContain('tsurime');
});
