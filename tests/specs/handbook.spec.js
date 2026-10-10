// The handbook (js/handbook.js): four short lessons, each with a
// demonstration to move - Practise > Handbook.
const { test, expect, openApp } = require('./../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="handbook"]');
  await expect(page.locator('#hbLesson h3')).toBeVisible();
};

test('the first lesson opens with its theory, a demonstration, things to try and an answer folded away', async ({ page }) => {
  await open(page);
  await expect(page.locator('#hbLesson h3')).toHaveText('Light on a form');
  await expect(page.locator('#hbDemo canvas')).toBeVisible();
  await expect(page.locator('.hb-try li')).toHaveCount(3);
  await expect(page.locator('.hb-see p')).toBeHidden();
  await page.click('.hb-see summary');
  await expect(page.locator('.hb-see p')).toBeVisible();
});

test('the lit ball: more reflected light lifts the shadow side, and past the halftone it says the form has gone flat', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = HB_SW; cv.height = HB_SH;
    const base = { az: 55, el: 35 };
    return { none: hbSphere(cv, { ...base, bounce: 0 }), some: hbSphere(cv, { ...base, bounce: 0.5 }), lots: hbSphere(cv, { ...base, bounce: 1 }),
      low: hbSphere(cv, { az: 55, el: 10, bounce: 0.5 }), high: hbSphere(cv, { az: 55, el: 70, bounce: 0.5 }) };
  });
  expect(r.some.refl).toBeGreaterThan(r.none.refl);
  expect(r.lots.refl).toBeGreaterThan(r.some.refl);
  expect(r.some.light).toBeGreaterThan(r.some.half);       // light, then halftone, then the shadow
  expect(r.some.half).toBeGreaterThan(r.some.core);
  expect(r.some.refl).toBeLessThan(r.some.half);           // the reflected light stays darker than the halftone
  expect(r.low.reach).toBeGreaterThan(r.high.reach);       // a low light throws a long shadow
  // The slider moves the numbers in the page.
  await page.fill('#hbBounce', '0');
  await page.dispatchEvent('#hbBounce', 'input');
  await expect(page.locator('#hbRead')).toContainText('reflected light');
});

test('aerial perspective: no air is one flat value, more air spreads the ridges out', async ({ page }) => {
  await open(page);
  await page.click('[data-hb-lesson="air"]');
  await page.fill('#hbAir', '0');
  await page.dispatchEvent('#hbAir', 'input');
  await expect(page.locator('#hbRead')).toContainText('No air');
  await page.fill('#hbAir', '0.8');
  await page.dispatchEvent('#hbAir', 'input');
  await expect(page.locator('#hbRead')).toContainText('enough to read as distance');
});

test('mixing: paint is not the average of the colours, and a colour gets recipes', async ({ page }) => {
  await open(page);
  await page.click('[data-hb-lesson="mixing"]');
  await expect(page.locator('#hbRecipes .mix-row').first()).toBeVisible();
  const [paint, avg] = await page.evaluate(() => [document.getElementById('hbPaint').style.background, document.getElementById('hbAvg').style.background]);
  expect(paint).not.toBe(avg);
  await page.click('[data-hb-target="#5a8a3c"]');
  await expect(page.locator('.hb-want')).toContainText('#5a8a3c');
});

test('value against colour: some lightness of green is the same value as the red, and grey shows it', async ({ page }) => {
  await open(page);
  await page.click('[data-hb-lesson="value"]');
  // Slide the second colour until the difference is under 4.
  const found = await page.evaluate(() => {
    for (let L = 30; L <= 95; L++) {
      const d = Math.abs(lstar(lchRgb(0.62, 0.17, 25)) - lstar(lchRgb(L / 100, 0.15, 145)));
      if (d < 4) return L;
    }
    return null;
  });
  expect(found).not.toBeNull();
  await page.fill('#hbL', String(found));
  await page.dispatchEvent('#hbL', 'input');
  await expect(page.locator('#hbRead')).toContainText('The same value');
  await page.check('#hbGrey');
  const [l, r] = await page.evaluate(() => [document.getElementById('hbLeft').style.background, document.getElementById('hbRight').style.background]);
  const num = s => s.match(/\d+/g).map(Number);
  expect(Math.abs(num(l)[0] - num(r)[0])).toBeLessThan(12);   // in grey the patches are nearly one
});

test('lessons are marked done, in order, and remembered', async ({ page }) => {
  await open(page);
  await page.click('#hbDone');
  await expect(page.locator('#viewMeta')).toContainText('1 of 4');
  await page.click('#hbNext');
  await expect(page.locator('#hbLesson h3')).toHaveText('Aerial perspective');
  await page.reload();
  await page.click('.nav-item[data-view="handbook"]');
  await expect(page.locator('#hbLesson h3')).toHaveText('Aerial perspective');
  await expect(page.locator('[data-hb-lesson="light"] .hb-n')).toHaveText('✓');
});
