// Profiles: whose settings and uploads the page shows.
const { test, expect, openApp, makePng, fakeServer } = require('../helpers');

const png = () => ({ name: 'blue.png', mimeType: 'image/png', buffer: makePng(16, 16, () => [30, 60, 200]) });

// Adds a profile in Your data and waits for the page that comes back.
async function addProfile(page, name) {
  await page.click('#btnData');
  await page.fill('#profileName', name);
  await Promise.all([page.waitForEvent('load'), page.click('#profileAdd')]);
  await expect(page.locator('#summary')).not.toBeEmpty();
}

test('a setting made in one profile is not seen in another, and the main one is untouched', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => setMainMaterial('graphite'));
  const main = await page.evaluate(() => localStorage.getItem('refboard.materials.v1'));
  expect(JSON.parse(main).main).toBe('graphite');

  await addProfile(page, 'Ann');
  expect(await page.evaluate(() => profileId)).toBe('ann');
  // A fresh profile starts from the defaults, not from Main's graphite.
  expect(await page.evaluate(() => localStorage.getItem('refboard.materials.v1'))).toBeNull();
  await page.evaluate(() => setMainMaterial('liner'));
  // Stored apart: Main's key still says graphite, Ann's has its own name.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('materials')));
  expect(keys.sort()).toEqual(['refboard.materials.v1', 'refboard.p.ann.materials.v1']);
  expect(JSON.parse(await page.evaluate(() => profileRaw.get.call(localStorage, 'refboard.materials.v1'))).main).toBe('graphite');

  // Back to Main: graphite, as it was.
  await page.click('#btnData');
  await expect(page.locator('#btnData')).toHaveText('Your data (Ann)...');
  await Promise.all([page.waitForEvent('load'), page.selectOption('#profileSelect', 'default')]);
  await expect(page.locator('#summary')).not.toBeEmpty();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('refboard.materials.v1'))).main).toBe('graphite');
  await expect(page.locator('#btnData')).toHaveText('Your data...');
});

test('uploads are listed per profile, and a profile removed from the list comes back with its things', async ({ page }) => {
  await openApp(page);
  await page.check('#optKeep');
  await page.setInputFiles('#dropInput', png());
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);

  await addProfile(page, 'Ann');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(0);
  await page.setInputFiles('#dropInput', { name: 'red.png', mimeType: 'image/png', buffer: makePng(16, 16, () => [200, 40, 40]) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  // The browser's own store holds both lists, under different kinds.
  const kinds = await page.evaluate(async () => (await idbAll('items')).map(i => i.key.split('/')[0]).sort());
  expect(kinds).toEqual(['u-ann-uploads', 'uploads']);

  // Removed from the list: back in Main with its one picture ...
  await page.click('#btnData');
  await Promise.all([page.waitForEvent('load'), page.click('#profileForget')]);
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  expect(await page.evaluate(() => profiles().map(p => p.id))).toEqual(['default']);
  // ... and adding the same name again finds Ann's picture where she left it.
  await addProfile(page, 'Ann');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  expect(await page.evaluate(() => profileName())).toBe('Ann');
});

test('on a server a profile keeps its documents under its own kind, and the scene API channels stay shared', async ({ page }) => {
  const srv = await fakeServer(page);
  await openApp(page);
  await addProfile(page, 'Ann');
  await page.setInputFiles('#dropInput', png());
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  expect([...srv.items.keys()].filter(k => k.includes('uploads')).map(k => k.split('/')[0])).toEqual(['u-ann-uploads']);
  // The same profile code, asked for the API's channels, does not rename them.
  expect(await page.evaluate(() => [profileKind('uploads'), profileKind('scene-in'), profileKind('scene-out')]))
    .toEqual(['u-ann-uploads', 'scene-in', 'scene-out']);
});

test('a name with no Latin letters still makes a stable id, and "default" is refused', async ({ page }) => {
  await openApp(page);
  const [a, b, bad, empty] = await page.evaluate(() => [
    profileSlug('Оля'), profileSlug('Оля'), profileAdd('Default'), profileAdd('   ')]);
  expect(a).toMatch(/^p[a-z0-9]{1,8}$/);
  expect(b).toBe(a);
  expect(bad.error).toMatch(/taken/);
  expect(empty.error).toMatch(/name/);
});

test('a backup takes the profile in use by its usual key names, and never the choice of profile', async ({ page }) => {
  await openApp(page);
  await addProfile(page, 'Ann');
  await page.evaluate(() => setMainMaterial('liner'));
  const keys = await page.evaluate(() => localKeys());
  expect(keys).toContain('refboard.materials.v1');
  expect(keys).not.toContain('refboard.profile.v1');
  expect(keys).not.toContain('refboard.profiles.v1');
  expect(keys.some(k => k.startsWith('refboard.p.'))).toBe(false);
});

test('Ctrl+K offers the other profiles', async ({ page }) => {
  await openApp(page);
  await addProfile(page, 'Ann');
  await page.keyboard.press('Control+k');
  await page.fill('#cmdkInput', 'paint as');
  await expect(page.locator('#cmdkList')).toContainText('Paint as Main');
  await expect(page.locator('#cmdkList')).not.toContainText('Paint as Ann');
});
