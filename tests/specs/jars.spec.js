// Ink wash jars (js/jars.js): the picture reduced to 3-5 jars of thinned ink and
// the paper, with how to thin each. Over a picture in a session, as a layer.
const { test, expect, makePng, openApp } = require('../helpers');

test('the jars: lighter jars are thinner, equal steps of L*, the last is neat ink', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const ink of Object.keys(JARS_INKS)) for (const n of JARS_COUNTS) {
      const set = jarsOf(ink, n);
      out[ink + n] = { L: set.jars.map(j => lstar(j.rgb)), share: set.jars.map(j => j.share), water: set.jars.map(j => j.water), paperL: set.paperL, targets: set.jars.map(j => j.target), ratio: jarsRatio(set.jars[0].water), neat: jarsRatio(set.jars[n - 1].water) };
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) {
    // Each jar lands on its step (an sRGB round-trip allows a point or two), darker as the jars go up.
    v.L.forEach((l, i) => expect(Math.abs(l - v.targets[i]), k).toBeLessThan(2.5));
    for (let i = 1; i < v.L.length; i++) { expect(v.L[i], k).toBeLessThan(v.L[i - 1]); expect(v.share[i], k).toBeGreaterThan(v.share[i - 1]); expect(v.water[i], k).toBeLessThan(v.water[i - 1]); }
    expect(v.share[v.share.length - 1], k).toBeCloseTo(1, 2);
    expect(v.neat, k).toBe('neat ink');
    expect(v.ratio, k).toMatch(/^1 part ink : [\d.]+ of water$/);
  }
});

test('a ramp climbs from paper to the darkest jar; a flat picture has one jar and the paper', async ({ page }) => {
  await openApp(page);
  const read = (src, count) => page.evaluate(async ([src, count]) => {
    const c = document.createElement('canvas'); c.width = 560; c.height = 400;
    new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const f = jarsPlan(stepsRead(img), count), at = x => f.level[200 * f.w + x];
    return { left: at(10), right: at(550), share: f.share, flat: f.flat, note: jarsNote(f, jarsOf('black', count), { count, ink: 'black' }) };
  }, [src, count]);
  const ramp = await read(`const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, w, h);`, 4);
  expect(ramp.left).toBe(0);
  expect(ramp.right).toBe(4);
  expect(ramp.share).toHaveLength(5);
  expect(ramp.share.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 3);
  expect(ramp.note).toContain('neat ink');
  const flat = await read(`g.fillStyle = '#909090'; g.fillRect(0, 0, w, h);`, 3);
  expect(flat.flat).toBe(true);
  expect(flat.share[0]).toBe(100);
  expect(flat.note).toContain('hardly differ');
});

test('in a session: a layer and a workspace row; the number of jars and the ink are chosen in the note and kept', async ({ page }) => {
  await openApp(page);
  const png = makePng(240, 240, x => { const v = Math.round(255 - x * 255 / 239); return [v, v, v]; });
  await page.setInputFiles('#dropInput', { name: 'ramp.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="value"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'jars of thinned ink' }).click();
  await expect(page.locator('#btnJars')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#jarsOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="jars"]');
  await expect(part).toContainText('neat ink');
  await part.locator('[data-jars-n="5"]').click();
  await part.locator('[data-jars-i="sepia"]').click();
  await expect(part.locator('[data-jars-i="sepia"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(JARS_KEY)))).toEqual({ count: 5, ink: 'sepia' });
  await expect(part.locator('.hm-key span')).toHaveCount(6);

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="jars"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#jarsOverlay')).toBeHidden();
});
