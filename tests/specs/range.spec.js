// What the paper can do (js/range.js): where a photo goes beyond the range of
// the medium - darker than its darkest mix, lighter than the paper - and
// where something is lost there, worked out from the picture; over it in a
// session, as a layer, in the workspace.
const { test, expect, makePng, openApp } = require('../helpers');

// A checker of two near-black values: something to lose in the dark.
const checker = (x, y, a, b) => ((x >> 1) + (y >> 1)) % 2 ? a : b;
const grey = v => [v, v, v];

test('a dark with detail is lost, a flat dark is only a mass', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    // Quadrants: textured dark, flat black, white blocks between greys, a mid grey.
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 200, 200);
    for (let y = 0; y < 100; y += 4) for (let x = 0; x < 100; x += 4) {
      g.fillStyle = ((x + y) / 4) % 2 ? '#000' : '#2a2a2a'; g.fillRect(x, y, 4, 4);
    }
    g.fillStyle = '#000'; g.fillRect(100, 0, 100, 100);
    for (let y = 100; y < 200; y += 4) for (let x = 100; x < 200; x += 4) {
      g.fillStyle = ((x + y) / 4) % 2 ? '#fff' : '#e4e4e4'; g.fillRect(x, y, 4, 4);
    }
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = rangeMap(stepsRead(img), 18);
    const at = (x, y) => m.kind[Math.round(y * m.h / 200) * m.w + Math.round(x * m.w / 200)];
    return { textured: at(50, 50), flat: at(150, 50), light: at(106, 102), // in a white block: its grey neighbours (L* 90) are inside the range, so the edge is detail
       mid: at(50, 150),
      share: [m.dark, m.darkLost, m.light, m.lightLost], text: rangeVerdict(m), paper: RANGE_PAPER, floors: Object.values(MATERIALS).map(x => x.floor) };
  });
  expect(r.textured).toBe(1); // a dark that will merge
  expect(r.flat).toBe(2);     // a dark mass, nothing lost
  expect(r.light).toBe(3);    // a light that will go bare
  expect(r.mid).toBe(0);
  // A quarter each, but only the textured ones are a loss.
  expect(r.share[0]).toBeGreaterThan(45); // both darks (a half)
  expect(r.share[1]).toBeGreaterThan(20);
  expect(r.share[1]).toBeLessThan(r.share[0] - 15);
  expect(r.text).toContain('one dark');
  expect(r.text).toContain('leave it bare');
  // Every medium has a darkest, darker than the paper.
  expect(r.floors.every(f => f > 0 && f < r.paper - 40)).toBe(true);
});

test('a picture inside the range has nothing to say, and says so', async ({ page }) => {
  await openApp(page);
  const text = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 120, 0); grad.addColorStop(0, '#303030'); grad.addColorStop(1, '#d0d0d0');
    g.fillStyle = grad; g.fillRect(0, 0, 120, 120);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = rangeMap(stepsRead(img), 18);
    return { lost: m.darkLost + m.lightLost, text: rangeVerdict(m) };
  });
  expect(text.lost).toBeLessThan(1);
  expect(text.text).toContain('Nothing here the paper cannot say');
});

test('in a session: over the picture, with a note, a layer, a workspace row, and the medium sets it', async ({ page }) => {
  await openApp(page);
  // Left half: near-black texture. Right half: a mid grey.
  const png = makePng(200, 200, (x, y) => x < 100 ? grey(checker(x, y, 0, 26)) : grey(128));
  await page.setInputFiles('#dropInput', { name: 'dark.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  const map = page.locator('#rangeOverlay');
  await expect(map).toBeHidden();
  await page.keyboard.press('b');
  await expect(page.locator('#btnRange')).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toBeVisible();
  await expect(page.locator('#poseNote')).toContainText('Watercolour goes from L* 18');
  await expect(page.locator('#poseNote')).toContainText('cannot hold');
  // Laid over the picture's own box.
  const [a, b] = await Promise.all([map.boundingBox(), page.locator('#img').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  // The medium's own range: a liner goes darker, so the same picture says its own.
  await page.evaluate(() => setMainMaterial('liner'));
  await expect(page.locator('#poseNote')).toContainText('Liners goes from L* 10');
  // A layer like the others, and a row in the workspace's Value tab.
  await page.click('#btnLayers');
  const row = page.locator('#layersList [data-layer="range"]');
  await expect(row).toBeVisible();
  await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="value"]');
  await expect(page.locator('#wsList .ws-tool', { hasText: "Paper's range" })).toHaveAttribute('aria-pressed', 'true');
  // Off again from the key.
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  await expect(map).toBeHidden();
  await expect(page.locator('#poseNote')).toBeHidden();
});
