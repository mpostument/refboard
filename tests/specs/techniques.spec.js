// Techniques guide (js/techniques.js): salt, spatter, dry brush, lifting and
// masking fluid - the Handbook's second chapter, each a demonstration drawn from
// a few numbers.
const { test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="handbook"]');
  await expect(page.locator('#hbLesson h3')).toBeVisible();
  await page.waitForFunction(() => typeof tkSalt === 'function');
  // A canvas of the lesson's size, to draw a demonstration into and read back.
  await page.evaluate(() => { window.mkCanvas = () => { const c = document.createElement('canvas'); c.width = HB_SW; c.height = HB_SH; return c; }; });
};

test('salt: it works only in a window of wetness - dry and glossy show nothing, damp shows stars', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    // How many pixels inside the wash are pale (paper showing through the blue).
    const run = (wet, grain = 2) => {
      const c = mkCanvas(), res = tkSalt(c, { wet, grain }), d = c.getContext('2d').getImageData(20, 20, 280, 170).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 150) n++;
      return { ...res, pale: n };
    };
    return { dry: run(0), damp: run(0.5), glossy: run(1), coarse: run(0.5, 3) };
  });
  expect(r.damp.strength).toBeGreaterThan(0.95);
  expect(r.dry.strength).toBeLessThan(0.05);
  expect(r.glossy.strength).toBeLessThan(0.05);
  expect(r.damp.stars).toBeGreaterThan(0);
  expect(r.dry.stars).toBe(0);
  expect(r.glossy.stars).toBe(0);
  expect(r.damp.pale).toBeGreaterThan(r.dry.pale + 200);
  expect(r.damp.pale).toBeGreaterThan(r.glossy.pale + 200);
  expect(r.coarse.pale).toBeGreaterThan(r.damp.pale);
  expect(r.damp.word).toContain('best stars');
  expect(r.glossy.word).toContain('floods back');
});

test('spatter: a wetter brush throws bigger drops, more flicks more drops, the far drops are finer, a covered shape stays clean', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => tkSpatter(mkCanvas(), o);
    const base = { load: 0.5, distance: 0.5, amount: 0.5 };
    // Dark pixels inside the covered shape and outside it, with the cover on.
    const c = mkCanvas(), cover = tkSpatter(c, { ...base, mask: true }), g = c.getContext('2d');
    const dark = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 150) n++; return n; };
    return { wet: run({ ...base, load: 0.9 }), dry: run({ ...base, load: 0.1 }), few: run({ ...base, amount: 0.1 }), many: run({ ...base, amount: 0.9 }), mid: run(base), cover,
      inside: dark(120, 74, 80, 62), around: dark(0, 0, 320, 60) };
  });
  expect(r.wet.meanR).toBeGreaterThan(r.dry.meanR * 1.5);
  expect(r.many.drops).toBeGreaterThan(r.few.drops * 2);
  expect(r.mid.nearR).toBeGreaterThan(r.mid.farR);
  expect(r.cover.skipped).toBeGreaterThan(0);
  expect(r.inside).toBe(0);
  expect(r.around).toBeGreaterThan(0);
});

test('dry brush: less paint breaks the stroke up, more pressure fills it, the stroke runs out along its length, smooth paper is all or nothing', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => tkDryBrush(mkCanvas(), { load: 0.5, pressure: 0.4, tooth: 0.6, ...o });
    return { base: run({}), light: run({ load: 0.2 }), heavy: run({ load: 0.95 }), soft: run({ pressure: 0.05 }), hard: run({ pressure: 0.9 }),
      smooth: [run({ tooth: 0, load: 0.9 }), run({ tooth: 0, load: 0.2 })] };
  });
  expect(r.light.coverage).toBeLessThan(r.base.coverage);
  expect(r.base.coverage).toBeLessThan(r.heavy.coverage);
  expect(r.soft.coverage).toBeLessThan(r.hard.coverage);
  expect(r.base.left).toBeGreaterThan(r.base.right + 10);
  // A full brush starts mostly solid (bristle gaps aside) and still runs out toward the end.
  expect(r.heavy.left).toBeGreaterThan(55);
  expect(r.heavy.right).toBeLessThan(r.heavy.left);
  // Smooth paper: a loaded brush lays a solid line that then stops, instead of breaking up; a dry one hardly marks it.
  expect(r.smooth[0].left).toBeGreaterThan(60);   // the soft top and bottom of the stroke, and the bristle gaps, are not solid
  expect(r.smooth[0].right).toBeLessThan(5);
  expect(r.smooth[1].coverage).toBeLessThan(10);
});

test('lifting: a paint that lifts goes back to nearly paper and one that stains keeps its colour; the older the wash the more stays', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => typeof paintInit === 'function' && paintInit());
  const r = await page.evaluate(() => {
    const run = (k, age) => tkLift(mkCanvas(), { k, age });
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const out = {};
    for (const k of ['cadYellow', 'ochre', 'alizarin']) { const a = run(k, 0), b = run(k, 1); out[k] = { keep0: a.keep, keep1: b.keep, stain: a.stain, gran: a.gran, gap: dist(a.band, TK_PAPER), wash: dist(a.wash, TK_PAPER) }; }
    // The band as painted on the canvas: its middle against the paper at the edge, for a staining paint.
    const c = mkCanvas(); tkLift(c, { k: 'alizarin', age: 0 });
    const g = c.getContext('2d'), mid = Array.from(g.getImageData(160, 105, 1, 1).data), wash = Array.from(g.getImageData(160, 50, 1, 1).data);
    return { ...out, mid, wash };
  });
  expect(r.cadYellow.stain).toBe(0);
  expect(r.alizarin.stain).toBe(2);
  expect(r.cadYellow.keep0).toBeLessThan(0.2);
  expect(r.alizarin.keep0).toBeGreaterThan(0.75);
  expect(r.cadYellow.keep1).toBeGreaterThan(r.cadYellow.keep0 + 0.3);
  expect(r.cadYellow.gap).toBeLessThan(r.alizarin.gap);
  expect(r.alizarin.gap).toBeGreaterThan(0.6 * r.alizarin.wash);
  // On the canvas the lifted band of a staining paint is still dark; the unlifted wash is darker only a little.
  expect(r.mid[1]).toBeLessThan(200);
});

test('masking: the whites are pure paper under any wash; softening lightens the edge on one side only', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3));
    const mk = o => { const c = mkCanvas(); const res = tkMask(c, o); return { c, res }; };
    const strong = mk({ wash: 1, peeled: true }), on = mk({ wash: 1, peeled: false }), soft = mk({ wash: 1, peeled: true, soften: true });
    return { sparkle: px(strong.c, 204, 150), wash: px(strong.c, 20, 100), mask: px(on.c, 204, 150), hard: strong.res, onRes: on.res,
      // Just off the sparkle's left tip (4 px out), and just off its right tip, hard against softened.
      leftHard: px(strong.c, 186, 150), leftSoft: px(soft.c, 186, 150), rightHard: px(strong.c, 222, 150), rightSoft: px(soft.c, 222, 150), soft: soft.res };
  });
  // Peeled, a sparkle is the paper's white; the wash round it is dark.
  expect(r.sparkle[0]).toBeGreaterThan(225);
  expect(r.wash[0]).toBeLessThan(120);
  // With the mask on, the film shows over the wash.
  expect(r.mask[2]).toBeLessThan(r.mask[0]);
  expect(r.onRes.peeled).toBe(false);
  expect(r.hard.hard).toBe(true);
  expect(r.soft.hard).toBe(false);
  // Softened: the upper-left side is lighter than hard; the lower-right is not as much.
  expect(r.leftSoft[0] - r.leftHard[0]).toBeGreaterThan(10);
  expect(r.leftSoft[0] - r.leftHard[0]).toBeGreaterThan(r.rightSoft[0] - r.rightHard[0] + 5);
});

test('the lessons: a second chapter under its own heading, numbered on, each with a demonstration that moves and a note that says so', async ({ page }) => {
  await open(page);
  await expect(page.locator('#hbList .hb-group')).toHaveText(['The basics', 'Watercolour techniques', 'Pen textures', 'Light and weather']);
  await expect(page.locator('#hbList .hb-item')).toHaveCount(21);
  await expect(page.locator('#hbList .hb-item .hb-n').nth(4)).toHaveText('5');
  await expect(page.locator('#viewMeta')).toContainText('0 of 21');

  await page.click('[data-hb-lesson="salt"]');
  await expect(page.locator('#hbLesson h3')).toHaveText('Salt');
  await expect(page.locator('#hbRead')).toContainText('best stars');
  await page.fill('#hbWet', '100'); await page.dispatchEvent('#hbWet', 'input');
  await expect(page.locator('#hbRead')).toContainText('floods back');

  await page.click('[data-hb-lesson="spatter"]');
  await expect(page.locator('#hbRead')).toContainText('drops');
  await page.check('#hbCover');
  await expect(page.locator('#hbRead')).toContainText('The covered shape kept');

  await page.click('[data-hb-lesson="drybrush"]');
  await expect(page.locator('#hbRead')).toContainText('The top stroke is');

  await page.click('[data-hb-lesson="lifting"]');
  await page.waitForFunction(() => typeof paintInit === 'function' && paintInit());
  await expect(page.locator('#hbRead')).toContainText('of the wash');
  await page.selectOption('#hbLiftPaint', 'alizarin');
  await expect(page.locator('#hbRead')).toContainText('stains');

  await page.click('[data-hb-lesson="masking"]');
  await expect(page.locator('#hbSoft')).toBeDisabled();
  await page.check('#hbPeel');
  await expect(page.locator('#hbSoft')).toBeEnabled();
  await expect(page.locator('#hbRead')).toContainText('hard edges');
  await page.check('#hbSoft');
  await expect(page.locator('#hbRead')).toContainText('Softened');
  // The next chapters (pen textures, light and weather) follow; the last lesson of all has no "next".
  await expect(page.locator('#hbNext')).toHaveText('Next: Wood');
  await page.click('[data-hb-lesson="street"]');
  await expect(page.locator('#hbNext')).toHaveCount(0);
});
