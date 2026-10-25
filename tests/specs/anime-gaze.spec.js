// Anime study's Gaze look in Eyes, and the Mouth shapes of speech (js/animedraw.js, js/animemouth.js, js/animenewui.js).
const { openSection, test, expect, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('gaze: the iris moves inside the lid, the kind of look is named, and near turns the eyes in', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const eye = (gx, gy) => adEyeSvg({ shape: 'tsurime', era: 'modern', tall: 1, iris: 1, hl: 'two', lash: 3, colour: '#3f7fb8', gx, gy, key: 'g' });
    const pair = (gx, gy, near) => adGazeSvg({ shape: 'tsurime', era: 'modern', tall: 1, iris: 1, hl: 'two', lash: 3, colour: '#3f7fb8', gx, gy, near });
    return {
      centre: eye(0, 0) === eye(), moved: eye(1, 0) !== eye(0, 0), up: eye(0, -1) !== eye(0, 0),
      kinds: [adGazeKind(0, 0), adGazeKind(-0.8, 0), adGazeKind(0.8, 0.1), adGazeKind(0, -0.7), adGazeKind(0.1, 0.9)],
      words: [adGazeWords(0, 0), adGazeWords(0.8, 0), adGazeWords(0, -1)],
      far: pair(0, 0, 0) !== pair(0, 0, 1), svgs: (pair(0.5, 0, 0).match(/<svg /g) || []).length,
    };
  });
  expect(r.centre).toBe(true); expect(r.moved).toBe(true); expect(r.up).toBe(true);
  expect(r.kinds).toEqual(['centre', 'left', 'right', 'up', 'down']);
  expect(r.words).toEqual(['looking at viewer', 'looking to the side, facing right', 'looking up']);
  expect(r.far).toBe(true);
  expect(r.svgs).toBe(3);                // the pair, and the two eyes in it
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=eyes]').click();
  await expect(page.locator('#aeyGazeRow')).toBeHidden();
  await page.locator('#aeyLook [data-v=gaze]').click();
  await expect(page.locator('#aeyGazeRow')).toBeVisible();
  await expect(page.locator('#aeyNote')).toContainText('Looking to the');
  await page.locator('#aeyGy').fill('-1');
  await page.locator('#aeyGx').fill('0');
  await expect(page.locator('#aeyNote')).toContainText('Looking up');
  await page.locator('#aeyNear').fill('0.8');
  await expect(page.locator('#aeyNote')).toContainText('something close');
  await page.locator('#aeyLook [data-v=final]').click();
  await expect(page.locator('#aeyGazeRow')).toBeHidden();
});

test('mouth: eight shapes on a sheet, three in the simple set, and each says what it is for', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    shapes: Object.keys(AN_MOUTHS).map(k => anMouthShape(k, 0, 0)), full: anMouthSheet({ full: true }), simple: anMouthSheet({ full: false }),
  }));
  expect(new Set(r.shapes).size).toBe(8);
  expect(r.shapes.every(s => s.includes('<path') || s.includes('<rect'))).toBe(true);
  expect((r.full.match(/<text /g) || []).length).toBe(8);
  expect((r.simple.match(/<text /g) || []).length).toBe(3);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=mouth]').click();
  await expect(page.locator('#amtStage svg')).toBeVisible();
  await expect(page.locator('#amtNote li')).toHaveCount(8 + 4);
  await page.locator('#amtSet [data-v=simple]').click();
  await expect(page.locator('#amtNote li')).toHaveCount(3 + 4);
  await expect(page.locator('#amtNote')).toContainText('three drawings');
  await expect(page.locator('#amtSave')).toBeVisible();
});
