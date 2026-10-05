// A scene as text, and the door for Claude (js/forms-api.js): the panel's
// "Scene as text" box, and - with a server - scene-in/next picked up while
// the 3D forms are open, with scene-out/{schema,current,result} written back.
const { test, expect, openApp, fakeServer } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

test('a pasted scene is applied, and what had to change is said', async ({ page }) => {
  await openForms(page);
  await page.click('[data-ftab="use"]');
  await page.locator('.scene-text summary').click();
  await page.fill('#formSceneText', JSON.stringify({ lightAz: -80, objects: [{ shape: 'sphere', finish: 'shiny', x: 2 }] }));
  await page.click('#formSceneLoad');
  await expect(page.locator('#formSceneMsg')).toContainText("objects[0].finish");
  const s = await page.evaluate(() => formScene);
  expect(s.lightAz).toBe(-80);
  expect(s.objects[0]).toMatchObject({ shape: 'sphere', finish: 'matte', x: 2 });
  // Not JSON: the scene is left alone and the box says why.
  await page.fill('#formSceneText', 'not a scene');
  await page.click('#formSceneLoad');
  await expect(page.locator('#formSceneMsg')).toContainText('neither JSON');
  expect((await page.evaluate(() => formScene)).lightAz).toBe(-80);
});

test('with a server: the schema and the scene go out, scene-in/next comes in', async ({ page }) => {
  const srv = await fakeServer(page);
  await openForms(page);
  await expect.poll(() => srv.items.has('scene-out/schema'), { timeout: 8000 }).toBe(true);
  const schema = srv.items.get('scene-out/schema');
  expect(schema.enums.finish.map(f => f.id)).toContain('anime');
  expect(schema.enums.shape.map(f => f.id)).toContain('sphere');
  expect(schema.rigs.figure.joints.length).toBeGreaterThan(10);
  await expect.poll(() => srv.items.has('scene-out/current'), { timeout: 8000 }).toBe(true);

  srv.items.set('scene-in/next', { mode: 'patch', scene: { yaw: 120, ambient: 0.4, bogus: 1 } });
  await expect.poll(() => page.evaluate(() => formScene.yaw), { timeout: 8000 }).toBe(120);
  expect(await page.evaluate(() => formScene.ambient)).toBe(0.4);
  expect(srv.items.has('scene-in/next')).toBe(false);
  await expect.poll(() => srv.items.get('scene-out/result')?.dropped, { timeout: 8000 }).toEqual(['bogus: unknown scene key']);
  await expect.poll(() => srv.items.get('scene-out/current')?.scene.yaw, { timeout: 8000 }).toBe(120);
});

test('a scene can be saved by name and loaded back, over the same door', async ({ page }) => {
  const srv = await fakeServer(page);
  await openForms(page);
  await expect.poll(() => srv.items.has('scene-out/schema'), { timeout: 8000 }).toBe(true);

  srv.items.set('scene-in/next', { scene: { yaw: 70, objects: [{ shape: 'cone', x: 3 }] }, save: 'Cone right' });
  await expect.poll(() => srv.items.get('scene-out/result')?.saved, { timeout: 8000 }).toBe('Cone right');
  await expect.poll(() => srv.items.get('scene-out/saved')?.names, { timeout: 8000 }).toEqual(['Cone right']);
  // It is the panel's own chip, too.
  await page.click('[data-ftab="use"]');
  await expect(page.locator('#formScenes [data-scene]')).toHaveText(['Cone right']);

  // Another scene, then back to the saved one and a patch on it.
  srv.items.set('scene-in/next', { scene: { yaw: 10 } });
  await expect.poll(() => page.evaluate(() => formScene.yaw), { timeout: 8000 }).toBe(10);
  srv.items.set('scene-in/next', { load: 'cone RIGHT', mode: 'patch', scene: { lightAz: 33 } });
  await expect.poll(() => page.evaluate(() => formScene.yaw), { timeout: 8000 }).toBe(70);
  expect(await page.evaluate(() => [formScene.lightAz, formScene.objects[0].shape])).toEqual([33, 'cone']);

  // An unknown name is an error that says what exists, and the scene stays.
  srv.items.set('scene-in/next', { load: 'nope' });
  await expect.poll(() => srv.items.get('scene-out/result')?.ok, { timeout: 8000 }).toBe(false);
  expect(srv.items.get('scene-out/result').error).toContain('Cone right');
  expect(await page.evaluate(() => formScene.yaw)).toBe(70);
});
