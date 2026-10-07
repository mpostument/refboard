// Amounts (js/amounts.js): how much of a picture is light, middle and dark,
// warm and cool, hard and soft, and whether one of each leads; in a session
// as a part of the shared note, with Where? opening the map it counts.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from canvas code, in the page, and counts it (and, with
// crops, looks for the window where each tie has a leader).
async function count(page, size, paint) {
  return page.evaluate(async ([size, src]) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    new Function('g', 'size', src)(c.getContext('2d'), size);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const a = amountsOf(stepsRead(img));
    return { ...a, say: amountsVerdict(a), lead: amountsLead(a.value), crops: amountsCrops(a) };
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
  await expect(part.locator('.amt-row')).toHaveCount(5);
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

test('colour: bright against greyed - grey leading with a little bright sings, all bright shouts', async ({ page }) => {
  await openApp(page);
  // Mostly a paper grey, a band of muted tan, a small patch of bright orange.
  const calm = await count(page, 200, "g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#b09a78'; g.fillRect(0, 150, 200, 30); g.fillStyle = '#e8801a'; g.fillRect(70, 50, 60, 60);");
  expect(calm.colour[2]).toBeGreaterThan(55);
  expect(calm.colour[0]).toBeGreaterThan(5);
  expect(calm.colour[0]).toBeLessThan(20);
  expect(calm.say.colour).toContain('Grey leads');
  expect(calm.say.colour).toContain('sings');
  // Everywhere bright.
  const loud = await count(page, 200, "g.fillStyle = '#e8801a'; g.fillRect(0, 0, 100, 200); g.fillStyle = '#1a6ee8'; g.fillRect(100, 0, 100, 200);");
  expect(loud.colour[0]).toBeGreaterThan(85);
  expect(loud.say.colour).toContain('shouting');
  // A grey picture is not about colour at all.
  const grey = await count(page, 200, "g.fillStyle = '#777777'; g.fillRect(0, 0, 200, 200);");
  expect(grey.say.colour).toContain('Nearly all grey');
});

test('shapes: a few big ones lead a clear picture; a crowd of small ones is told to squint', async ({ page }) => {
  await openApp(page);
  // Two big halves of different value.
  const big = await count(page, 200, "g.fillStyle = '#202020'; g.fillRect(0, 0, 100, 200); g.fillStyle = '#e8e8e8'; g.fillRect(100, 0, 100, 200);");
  expect(big.size[0]).toBeGreaterThan(90);
  expect(big.say.size).toContain('A few big shapes carry');
  // A checkerboard of ten-pixel squares: each is a shape of its own.
  const crowd = await count(page, 200, "for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { g.fillStyle = (x + y) % 2 ? '#202020' : '#e8e8e8'; g.fillRect(x * 10, y * 10, 10, 10); }");
  expect(crowd.size[2]).toBeGreaterThan(80);
  expect(crowd.say.size).toContain('A crowd of small shapes');
});

test('crops: where the whole is a toss-up, the window that has a leader is found', async ({ page }) => {
  await openApp(page);
  // 40% dark, then 30% middle and 30% light: no clear leader over the whole -
  // but the left half is nearly all dark.
  const r = await count(page, 200, "g.fillStyle = '#202020'; g.fillRect(0, 0, 80, 200); g.fillStyle = '#808080'; g.fillRect(80, 0, 60, 200); g.fillStyle = '#e8e8e8'; g.fillRect(140, 0, 60, 200);");
  expect(r.lead.kind).not.toBe('lead');
  expect(r.crops.value.name).toBe('left half');
  expect(r.crops.value.i).toBe(0);
  expect(r.crops.value.vals[0]).toBeGreaterThan(70);
  // A picture that already has its leader is not offered a crop for it.
  const dark = await count(page, 200, "g.fillStyle = '#202020'; g.fillRect(0, 0, 200, 200); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 30, 30);");
  expect(dark.crops.value).toBeUndefined();
});

test('in a session: Where? on Colour and Shapes draws a map, Try it opens the viewfinder, and off takes the map away', async ({ page }) => {
  await openApp(page);
  // The same toss-up as above, as a file.
  const png = makePng(200, 200, x => x < 80 ? [32, 32, 32] : x < 140 ? [128, 128, 128] : [232, 232, 232]);
  await page.setInputFiles('#dropInput', { name: 'tossup.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  await page.keyboard.press('u');
  const part = page.locator('#poseNote [data-note="amounts"]');
  await expect(part.locator('.amt-row')).toHaveCount(5);
  await part.locator('[data-amt-where="colour"]').click();
  await expect(page.locator('#amtOverlay')).toBeVisible();
  expect(await page.evaluate(() => state.amtMap)).toBe('colour');
  await part.locator('[data-amt-where="size"]').click();
  expect(await page.evaluate(() => state.amtMap)).toBe('size');
  // The crop where the dark leads, drawn as the viewfinder: Frame mode, a window on the left.
  const crop = part.locator('.amt-crop', { hasText: 'left half' });
  await expect(crop).toContainText('the dark leads');
  await crop.locator('[data-amt-crop]').click();
  const f = await page.evaluate(() => ({ mode: state.constructMode, frame: state.frame }));
  expect(f.mode).toBe('frame');
  expect(f.frame.x2).toBeGreaterThan(f.frame.x1);
  expect(f.frame.y2).toBeGreaterThan(f.frame.y1);
  // Turning the counting off takes its map with it.
  await page.click('#poseNote [data-note-off="amounts"]');
  await expect(page.locator('#amtOverlay')).toBeHidden();
  expect(await page.evaluate(() => state.amtMap)).toBe(null);
});
