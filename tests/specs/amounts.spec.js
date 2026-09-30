// Amounts (js/amounts.js): how much of a picture is light, middle and dark,
// warm and cool, hard and soft, and whether one of each leads; in a session
// as a part of the shared note, with Where? opening the map it counts.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from canvas code, in the page, and counts it.
async function count(page, size, paint) {
  return page.evaluate(async ([size, src]) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    new Function('g', 'size', src)(c.getContext('2d'), size);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const a = amountsOf(stepsRead(img));
    return { ...a, say: amountsVerdict(a), lead: amountsLead(a.value) };
  }, [size, paint]);
}

test('a dark picture: the dark leads, and the verdict says low-key', async ({ page }) => {
  await openApp(page);
  // 70% dark, 20% middle, 10% light, in stripes.
  const r = await count(page, 200, "g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 140, 200); g.fillStyle = '#808080'; g.fillRect(140, 0, 40, 200); g.fillStyle = '#f0f0f0'; g.fillRect(180, 0, 20, 200);");
  expect(r.value[0]).toBeGreaterThan(65);
  expect(r.value[2]).toBeLessThan(15);
  expect(r.lead).toMatchObject({ i: 0, kind: 'lead' });
  expect(r.say.value).toContain('low-key');
  // Greys: neither warm nor cool.
  expect(r.temp[1]).toBeGreaterThan(95);
  expect(r.say.temp).toContain('Mostly neutral');
  // Flat stripes: every edge is hard.
  expect(r.edges[0]).toBeGreaterThan(90);
  expect(r.say.edges).toContain('Hard edges dominate');
});

test('equal thirds read as undecided; warm against cool is counted', async ({ page }) => {
  await openApp(page);
  const eq = await count(page, 210, "g.fillStyle = '#262626'; g.fillRect(0, 0, 70, 210); g.fillStyle = '#808080'; g.fillRect(70, 0, 70, 210); g.fillStyle = '#e0e0e0'; g.fillRect(140, 0, 70, 210);");
  for (const v of eq.value) expect(Math.abs(v - 33.3)).toBeLessThan(5);
  expect(eq.lead.kind).toBe('tie');
  expect(eq.say.value).toContain('undecided');
  // Three quarters orange, a quarter blue: warm dominates, cool is the accent.
  const wc = await count(page, 200, "g.fillStyle = '#e08a3a'; g.fillRect(0, 0, 150, 200); g.fillStyle = '#3a6ee0'; g.fillRect(150, 0, 50, 200);");
  expect(wc.temp[0]).toBeGreaterThan(65);
  expect(wc.temp[2]).toBeGreaterThan(18);
  expect(wc.say.temp).toContain('Warm dominates');
});

test('in a session: the bars in the note, Where? opens the map, a workspace row, and its x', async ({ page }) => {
  await openApp(page);
  const png = makePng(200, 200, x => x < 150 ? [224, 138, 58] : [58, 110, 224]);
  await page.setInputFiles('#dropInput', { name: 'warmcool.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  await page.keyboard.press('u');
  await expect(page.locator('#btnAmounts')).toHaveAttribute('aria-pressed', 'true');
  const part = page.locator('#poseNote [data-note="amounts"]');
  await expect(part.locator('.amt-row')).toHaveCount(3);
  await expect(part).toContainText('Warm dominates');
  // Where? on Temperature turns the temperature map on - and a second
  // press leaves it on, rather than toggling it off again.
  await part.locator('[data-amt-where="temp"]').click();
  await expect(page.locator('#tempOverlay')).toBeVisible();
  await part.locator('[data-amt-where="temp"]').click();
  await expect(page.locator('#btnTemp')).toHaveAttribute('aria-pressed', 'true');
  // A row in the workspace's Value tab, pressed.
  await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="value"]');
  await expect(page.locator('#wsList .ws-tool', { hasText: 'Amounts' })).toHaveAttribute('aria-pressed', 'true');
  await page.click('#wsClose');
  // Its x turns just the counting off; the temperature map stays.
  await page.click('#poseNote [data-note-off="amounts"]');
  await expect(page.locator('#btnAmounts')).toHaveAttribute('aria-pressed', 'false');
  await expect(part).toHaveCount(0);
  await expect(page.locator('#tempOverlay')).toBeVisible();
});
