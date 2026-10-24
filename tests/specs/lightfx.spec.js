// Light and weather effects (js/lightfx.js): glow, light rays, sparkles, rain, snow
// and a wet street - the Handbook's third chapter, each drawn from a few numbers.
const { test, expect, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="handbook"]');
  await expect(page.locator('#hbLesson h3')).toBeVisible();
  await page.waitForFunction(() => typeof lxGlow === 'function');
  await page.evaluate(() => { window.mkCanvas = () => { const c = document.createElement('canvas'); c.width = HB_SW; c.height = HB_SH; return c; }; });
};

test('the chapter lists six lessons under Light and weather', async ({ page }) => {
  await open(page);
  const ids = await page.evaluate(() => HB_LESSONS.filter(l => l.group === LX_GROUP).map(l => l.id));
  expect(ids).toEqual(['glow', 'rays', 'sparkles', 'rain', 'snow', 'street']);
});

test('glow: brightest at the core, falling off with distance; more spread reaches farther, more strength adds washes', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxGlow(mkCanvas(), o);
    return { mid: run({ strength: 0.6, spread: 0.5 }), wide: run({ strength: 0.6, spread: 1 }), strong: run({ strength: 1, spread: 0.5 }), weak: run({ strength: 0.1, spread: 0.5 }), fall: [lxFalloff(0, 10), lxFalloff(10, 10), lxFalloff(40, 10)] };
  });
  expect(r.mid.core).toBeGreaterThan(r.mid.near);
  expect(r.mid.near).toBeGreaterThan(r.mid.far);
  expect(r.wide.reach).toBeGreaterThan(r.mid.reach);
  expect(r.wide.far).toBeGreaterThan(r.mid.far);
  expect(r.strong.rings).toBeGreaterThan(r.weak.rings);
  expect(r.strong.near).toBeGreaterThan(r.weak.near);
  expect(r.fall[0]).toBe(1);
  expect(r.fall[1]).toBeCloseTo(0.5);
  expect(r.fall[2]).toBeLessThan(0.1);
});

test('rays: the number asked for, all from one point, a wider softness gives wider beams', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxRays(mkCanvas(), o);
    return { three: run({ beams: 3 }), nine: run({ beams: 9 }), hard: run({ beams: 4, soft: 0 }), soft: run({ beams: 4, soft: 1 }) };
  });
  expect(r.three.beams).toBe(3);
  expect(r.nine.beams).toBe(9);
  const w = x => x.lit.reduce((a, b) => a + b.width, 0);
  expect(w(r.soft)).toBeGreaterThan(w(r.hard));
  expect(r.three.contrast).toBeGreaterThan(5);
});

test('sparkles: rougher water gives a wider path, bigger bars near the viewer, more marks when asked', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxSparkles(mkCanvas(), o);
    return { calm: run({ rough: 0, amount: 0.5 }), rough: run({ rough: 1, amount: 0.5 }), few: run({ rough: 0.5, amount: 0 }), many: run({ rough: 0.5, amount: 1 }) };
  });
  expect(r.rough.width).toBeGreaterThan(r.calm.width);
  expect(r.rough.big).toBeGreaterThan(r.calm.big);
  expect(r.many.marks).toBeGreaterThan(r.few.marks);
  expect(r.many.big + r.many.fine).toBe(r.many.marks);
});

test('rain: wind leans the streaks, heavier rain has more, the far ones outnumber nothing without distance', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxRain(mkCanvas(), o);
    return { still: run({ wind: 0.5 }), right: run({ wind: 1 }), left: run({ wind: 0 }), light: run({ amount: 0 }), heavy: run({ amount: 1 }), short: run({ length: 0 }), long: run({ length: 1 }) };
  });
  expect(Math.abs(r.still.slant)).toBeLessThan(1);
  expect(r.right.slant).toBeGreaterThan(10);
  expect(r.left.slant).toBeLessThan(-10);
  expect(r.heavy.streaks).toBeGreaterThan(r.light.streaks * 3);
  expect(r.long.long).toBeGreaterThan(r.short.long);
  expect(r.heavy.near + r.heavy.far).toBe(r.heavy.streaks);
});

test('snow: three depths, the near ones soft; more snow, more flakes', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxSnow(mkCanvas(), o);
    return { sharp: run({ blur: 0 }), soft: run({ blur: 1 }), light: run({ amount: 0 }), heavy: run({ amount: 1 }) };
  });
  expect(r.soft.widest).toBeGreaterThan(r.sharp.widest);
  expect(r.heavy.flakes).toBeGreaterThan(r.light.flakes);
  expect(r.heavy.near + r.heavy.mid + r.heavy.far).toBe(r.heavy.flakes);
  expect(r.heavy.far).toBeGreaterThan(r.heavy.near);
});

test('street: a dry road has no reflection, a wet one is dimmer than its sign, never brighter', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const run = o => lxStreet(mkCanvas(), o);
    return { dry: run({ wet: 0 }), wet: run({ wet: 1 }), mid: run({ wet: 0.5 }) };
  });
  expect(r.dry.keeps).toBe(0);
  expect(r.wet.mirror).toBeGreaterThan(r.dry.mirror);
  expect(r.wet.mirror).toBeLessThan(r.wet.source);
  expect(r.wet.mirror).toBeGreaterThan(r.mid.mirror);
});

test('each lesson draws, moves and says what it drew', async ({ page }) => {
  await open(page);
  for (const [id, slider, word] of [['glow', 'hbGSpread', 'washes'], ['rays', 'hbRBeams', 'beam'], ['sparkles', 'hbSRough', 'marks'], ['rain', 'hbNWind', 'streaks'], ['snow', 'hbWAmt', 'flakes'], ['street', 'hbTWet', 'reflection']]) {
    await page.click(`[data-hb-lesson="${id}"]`);
    const before = await page.locator('#hbRead').textContent();
    expect(before).toContain(word);
    await page.fill('#' + slider, await page.locator('#' + slider).getAttribute('max'));
    await page.dispatchEvent('#' + slider, 'input');
    await expect(page.locator('#hbRead')).not.toHaveText(before);
  }
  await expect(page.locator('#hbNext')).toHaveCount(0);
});
