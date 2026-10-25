// Anime study's Hands, Eyes, Hair, Shading, Expressions and Perspective (js/animedraw.js, js/animedrawui.js).
const { openSection, test, expect, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('every hand gesture draws three turns; a fist is not an open palm', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    keys: Object.keys(AD_HANDS), open: adHandSvg('open'), fist: adHandSvg('fist'),
    bad: Object.keys(AD_HANDS).filter(k => !/^<svg/.test(adHandSvg(k)) || /NaN|undefined/.test(adHandSvg(k))),
  }));
  expect(r.keys).toHaveLength(12);
  expect(r.bad).toEqual([]);
  expect(r.open).not.toBe(r.fist);
  expect(r.open).toContain('Three-quarter');
});

test('an eye differs by shape and by manner, and the iris takes the colour it is given', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const e = o => adEyeSvg({ shape: 'tsurime', era: 'modern', tall: 1, iris: 1, hl: 'two', colour: '#3f7fb8', lash: 3, key: 'x', ...o });
    return { base: e({}), tareme: e({ shape: 'tareme' }), old: e({ era: '90s' }), none: e({ hl: 'none' }), red: e({ colour: '#cc2222' }), junk: e({ shape: 'x', era: 'y', tall: 'abc', hl: 'z' }) };
  });
  expect(new Set([r.base, r.tareme, r.old, r.none, r.red]).size).toBe(5);
  expect(r.junk).toBe(r.base);
  expect(r.red).toContain('rgb(');
  expect(r.base).not.toMatch(/NaN|undefined/);
});

test('hair: the wind bends the tips more than the roots; clumps and flow are different pictures', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const calm = adHairClumps('long', 'none', 2), windy = adHairClumps('long', 'right', 3);
    const dTip = windy.back[3].t[0] - calm.back[3].t[0], dRoot = windy.back[3].r[0] - calm.back[3].r[0];
    const pic = look => adHairSvg({ style: 'twintails', wind: 'left', strength: 2, colour: '#6b4a2f', look, key: 'k' }).svg;
    return { dTip, dRoot, twin: adHairClumps('twintails', 'none', 1).back.length, pony: adHairClumps('ponytail', 'none', 1).ties.length, colour: pic('colour'), clumps: pic('clumps'), flow: pic('flow') };
  });
  expect(r.dRoot).toBe(0);
  expect(r.dTip).toBeGreaterThan(20);
  expect(r.twin).toBe(2);
  expect(r.pony).toBe(1);
  expect(new Set([r.colour, r.clumps, r.flow]).size).toBe(3);
  expect(r.clumps).toContain('>1</text>');
});

test('shading: shadows turn cool and lights warm, and the four manners differ', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const base = [232, 185, 154], T = adTones(base), hue = rgb => adToHsl(rgb)[0];
    const pics = Object.keys(AD_SHADE).map(k => adShadeSvg(k, base, 'ul', 'q' + k).svg);
    return { base: hue(base), light: hue(T.light), shadow: hue(T.shadow), lL: adToHsl(T.light)[2], lB: adToHsl(base)[2], lS: adToHsl(T.shadow)[2], pics, n: new Set(pics).size, flip: adShadeSvg('cel', base, 'ur', 'z').svg !== adShadeSvg('cel', base, 'ul', 'z').svg };
  });
  expect(r.lL).toBeGreaterThan(r.lB);
  expect(r.lS).toBeLessThan(r.lB);
  // The shadow's hue moves towards blue-violet (around 265 degrees), by the short way round the hue circle.
  const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  expect(gap(r.shadow, 265)).toBeLessThan(gap(r.base, 265));
  expect(r.n).toBe(4);
  expect(r.flip).toBe(true);
  for (const p of r.pics) expect(p).not.toMatch(/NaN|undefined/);
});

test('expressions: twelve faces; an angry brow drops at the inner end and the neutral face has no arrows', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const keys = Object.keys(AD_EXPR);
    return { keys, svgs: new Set(keys.map(k => adExprSvg(k))).size, bad: keys.filter(k => /NaN|undefined/.test(adExprSvg(k))),
      angry: adExprSvg('angry'), plain: adExprSvg('angry', false, false), arrows: (adExprSvg('angry').match(/marker-end/g) || []).length, noArrows: (adExprSvg('angry', true, false).match(/marker-end/g) || []).length,
      notes: adExprNotes('angry', true) };
  });
  expect(r.keys).toHaveLength(12);
  expect(r.svgs).toBe(12);
  expect(r.bad).toEqual([]);
  expect(r.arrows).toBeGreaterThan(3);
  expect(r.noArrows).toBe(0);
  expect(r.plain).not.toContain('vein');
  expect(r.notes.join(' ')).toContain('anger vein');
});

test('perspective: one point has the vanishing point on the horizon; the roof shows only when the horizon is above the box', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const one = adPerspSvg({ kind: 1, horizon: 0.4, point: 0.5 });
    const above = adPerspSvg({ kind: 2, horizon: 0.1, point: 0.6 }), below = adPerspSvg({ kind: 2, horizon: 0.7, point: 0.6 });
    const up = adPerspSvg({ kind: 3, horizon: 0.7, point: 0.6, dist: 700, up: true }), down = adPerspSvg({ kind: 3, horizon: 0.12, point: 0.6, dist: 700, up: false });
    return { one: one.svg, hz: one.hy, roofAbove: (above.svg.match(/fill="#f3efe6"/g) || []).length, roofBelow: (below.svg.match(/fill="#f3efe6"/g) || []).length, up: up.svg, down: down.svg, vp: (up.svg.match(/VP3/g) || []).length, clamp: adPerspSvg({ kind: 1, horizon: 7 }).hy };
  });
  expect(r.one).toContain('>VP<');
  expect(r.hz).toBeCloseTo(0.4, 5);
  expect(r.roofAbove).toBe(1);
  expect(r.roofBelow).toBe(0);
  expect(r.vp).toBeGreaterThan(0);
  expect(r.up).not.toBe(r.down);
  expect(r.clamp).toBeCloseTo(0.9, 5);
  for (const s of [r.one, r.up, r.down]) expect(s).not.toMatch(/NaN|undefined/);
});

test('the Anime study switch is in three groups and the six drawing panes open, change with a click and keep their choice', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await expect(page.locator('#asMode button')).toHaveCount(28);
  await expect(page.locator('#asMode .am-group')).toHaveCount(3);

  await page.locator('#asMode [data-mode=hands]').click();
  await expect(page.locator('#ahdStage svg')).toHaveCount(1);
  await page.locator('#ahdGesture [data-v=fist]').click();
  await expect(page.locator('#ahdNote')).toContainText('Held-in force');

  await page.locator('#asMode [data-mode=eyes]').click();
  await expect(page.locator('#aeyStage svg')).toHaveCount(1 + 2);   // the combined picture and the two eyes inside it
  await page.locator('#aeyEra [data-v=modern]').click();
  await expect(page.locator('#aeyStage svg')).toHaveCount(1);
  await page.locator('#aeyShape [data-v=tareme]').click();
  await expect(page.locator('#aeyNote')).toContainText('droops');

  await page.locator('#asMode [data-mode=hair]').click();
  await page.locator('#ahrWind [data-v=left]').click();
  await expect(page.locator('#ahrNote')).toContainText('Wind from the right');
  await page.locator('#ahrLook [data-v=clumps]').click();
  await expect(page.locator('#ahrStage svg text').first()).toHaveText('1');

  await page.locator('#asMode [data-mode=shading]').click();
  await expect(page.locator('#ashCards .ad-card')).toHaveCount(4);
  await page.locator('#ashCards [data-v=painted]').click();
  await expect(page.locator('#ashNote')).toContainText('cooler');

  await page.locator('#asMode [data-mode=expressions]').click();
  await expect(page.locator('#axGrid .ad-thumb')).toHaveCount(12);
  await page.locator('#axGrid [data-v=sad]').click();
  await expect(page.locator('#axNote')).toContainText('tears');
  await page.locator('#axFx').click();
  await expect(page.locator('#axNote')).not.toContainText('tears');

  await page.locator('#asMode [data-mode=perspective]').click();
  await page.locator('#avKind [data-v="3"]').click();
  await expect(page.locator('#avRow3')).toBeVisible();
  await page.locator('#avUp [data-v=down]').click();
  await expect(page.locator('#avNote')).toContainText('below');
  await page.locator('#avKind [data-v="1"]').click();
  await expect(page.locator('#avRow3')).toBeHidden();

  // The choices are kept.
  await page.reload();
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=hands]').click();
  await expect(page.locator('#ahdGesture [data-v=fist]')).toHaveAttribute('aria-pressed', 'true');
});

test('the horizon in the perspective picture can be dragged', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=perspective]').click();
  const before = +(await page.locator('#avHorizon').inputValue());
  const hit = page.locator('#avStage .av-hit');
  const box = await hit.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 4 });
  await page.mouse.up();
  const after = +(await page.locator('#avHorizon').inputValue());
  expect(after).toBeLessThan(before);
});
