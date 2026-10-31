// Anime study's Sitting and Ages (js/animebody.js, js/animenewui.js).
const { openSection, test, expect, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('sitting: six poses, each a different drawing with the hip line, and a two-bone reach that stops at its length', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const reach = anReach([0, 0], [10, 20], 44, 42, 1), far = anReach([0, 0], [500, 0], 44, 42, 1);
    return {
      keys: Object.keys(AN_SITS), svgs: Object.keys(AN_SITS).map(k => anSitSvg({ sit: k })),
      bone: [Math.hypot(reach[1][0] - reach[0][0], reach[1][1] - reach[0][1]), Math.hypot(reach[2][0] - reach[1][0], reach[2][1] - reach[1][1])],
      reached: reach[2], span: Math.hypot(far[2][0], far[2][1]),
      // The seat of a chair: the hip is a shin's length up and the foot lands on the floor.
      foot: anSitFigure(AN_SITS.chair, 330, 190).legA[2][1],
    };
  });
  expect(r.keys.length).toBe(6);
  expect(new Set(r.svgs).size).toBe(6);
  for (const s of r.svgs) expect(s).toContain('stroke-dasharray="3 4"');
  expect(r.bone[0]).toBeCloseTo(44, 3); expect(r.bone[1]).toBeCloseTo(42, 3);
  expect(r.reached[0]).toBeCloseTo(10, 3); expect(r.reached[1]).toBeCloseTo(20, 3);
  expect(r.span).toBeLessThan(86);
  expect(r.foot).toBeGreaterThan(325); expect(r.foot).toBeLessThan(335);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=sit]').click();
  await expect(page.locator('#aseStage svg')).toBeVisible();
  await expect(page.locator('#aseNote li')).toHaveCount(3);
  await page.locator('#aseSit [data-v=seiza]').click();
  await expect(page.locator('#aseNote')).toContainText('heels');
  await page.reload();
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=sit]').click();
  await expect(page.locator('#aseSit [data-v=seiza]')).toHaveAttribute('aria-pressed', 'true');
});

test('ages: five figures that grow in heads and legs, and a face where the eye line moves up', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    keys: Object.keys(AN_AGES), heads: Object.values(AN_AGES).map(a => a.heads), eye: Object.values(AN_AGES).map(a => a.eyeLine),
    figure: anAgesSvg({ view: 'figure' }), face: anAgesSvg({ view: 'face' }),
  }));
  expect(r.keys.length).toBe(5);
  expect(r.heads).toEqual([...r.heads].sort((a, b) => a - b));
  expect(r.eye).toEqual([...r.eye].sort((a, b) => b - a));
  expect((r.figure.match(/<ellipse /g) || []).length).toBe(5);
  expect((r.face.match(/<ellipse /g) || []).length).toBe(20);
  expect(r.figure).not.toBe(r.face);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=ages]').click();
  await expect(page.locator('#aagStage svg')).toBeVisible();
  await expect(page.locator('#aagNote li')).toHaveCount(6);
  await expect(page.locator('#aagStage text').first()).toContainText('Small child');
  await page.locator('#aagView [data-v=face]').click();
  await expect(page.locator('#aagStage')).toContainText('eyes 60% down');
  await expect(page.locator('#aagToGenerate')).toHaveCount(0);
});
