// Temperature map (js/temperature.js): which areas of a picture are warm and
// which cool against the picture as a whole, where it turns, and whether the
// light is warmer than the shadow; over it in a session, as a layer, in the
// workspace, with an x on its note.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from a function of (x, y) -> CSS colour, in the page.
async function mapOf(page, size, paint) {
  return page.evaluate(async ([size, src]) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    new Function('g', 'size', src)(g, size);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = tempMap(stepsRead(img));
    const at = (x, y) => m.rel[Math.round(y * m.h / size) * m.w + Math.round(x * m.w / size)];
    let turns = 0; for (const t of m.turn) turns += t;
    return { left: at(size * 0.2, size / 2), right: at(size * 0.8, size / 2), cast: m.cast, light: m.light, shadow: m.shadow,
      warm: m.warm, cool: m.cool, turns, text: tempVerdict(m, 'water'), dry: tempVerdict(m, null) };
  }, [size, paint]);
}

test('warm light and cool shadow: which side is which, the turn, and what it means', async ({ page }) => {
  await openApp(page);
  // A light peach on the left, a darker blue-violet on the right.
  const r = await mapOf(page, 200, "g.fillStyle = '#f2c79a'; g.fillRect(0, 0, 100, 200); g.fillStyle = '#4a4f80'; g.fillRect(100, 0, 100, 200);");
  expect(r.left).toBeGreaterThan(3);
  expect(r.right).toBeLessThan(-3);
  expect(r.light).toBeGreaterThan(r.shadow);
  expect(r.turns).toBeGreaterThan(50); // a line down the middle
  expect(r.text).toContain('Warm light');
  expect(r.text).toContain('glazed cooler');
  expect(r.dry).toContain('one colour');
});

test('the reverse, a warm cast, and a grey picture with nothing to turn', async ({ page }) => {
  await openApp(page);
  // Cool sky light on the lit side, warm bounce in the shadow.
  const rev = await mapOf(page, 160, "g.fillStyle = '#bcd6f0'; g.fillRect(0, 0, 80, 160); g.fillStyle = '#7a4a30'; g.fillRect(80, 0, 80, 160);");
  expect(rev.text).toContain('Cool light');
  // Everything orange: the cast says so, and the map is only what differs within it.
  const cast = await mapOf(page, 160, "g.fillStyle = '#e08a3a'; g.fillRect(0, 0, 160, 160); g.fillStyle = '#c86a20'; g.fillRect(0, 0, 80, 160);");
  expect(cast.cast).toBeGreaterThan(3);
  expect(cast.text).toContain('leans <b class="temp-w">warm</b>');
  // A grey gradient: neither warm nor cool, no turns, one temperature.
  const grey = await mapOf(page, 160, "const q = g.createLinearGradient(0, 0, 160, 0); q.addColorStop(0, '#333'); q.addColorStop(1, '#ddd'); g.fillStyle = q; g.fillRect(0, 0, 160, 160);");
  expect(grey.warm + grey.cool).toBeLessThan(1);
  expect(grey.turns).toBe(0);
  expect(grey.text).toContain('same temperature');
});

test('in a session: over the picture, a layer, a Colour row, and its note has an x', async ({ page }) => {
  await openApp(page);
  const png = makePng(200, 200, x => x < 100 ? [242, 199, 154] : [74, 79, 128]);
  await page.setInputFiles('#dropInput', { name: 'warmcool.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  const map = page.locator('#tempOverlay');
  await expect(map).toBeHidden();
  await page.keyboard.press('t');
  await expect(page.locator('#btnTemp')).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toBeVisible();
  await expect(page.locator('#poseNote')).toContainText('Warm light');
  const [a, b] = await Promise.all([map.boundingBox(), page.locator('#img').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  // A layer, and a row in the workspace's Colour tab.
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="temp"]')).toBeVisible();
  await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="colour"]');
  await expect(page.locator('#wsList .ws-tool', { hasText: 'Temperature map' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  // Two maps on: two parts to the note, and each x closes only its own.
  await page.keyboard.press('x');
  await expect(page.locator('#poseNote .note-part')).toHaveCount(2);
  await page.click('#poseNote [data-note-off="temp"]');
  await expect(map).toBeHidden();
  await expect(page.locator('#btnTemp')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#poseNote .note-part')).toHaveCount(1);
  await expect(page.locator('#edgeOverlay')).toBeVisible();
});
