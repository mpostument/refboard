// Simplify into shapes (js/simplify.js): the picture reduced to a few flat shapes
// of colour and value, as broad or as fine as the detail asked for. Over a
// picture in a session, as a layer.
const { test, expect, makePng, openApp } = require('../helpers');

// Paints a picture in the page from the source of a drawing and simplifies it as the app does.
const read = (page, draw, cfg) => page.evaluate(async ([src, cfg]) => {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const f = simplifyOf(stepsRead(img), cfg);
  const out = document.createElement('canvas');
  simplifyDraw(f, out, { ...cfg, view: cfg.view || 'colour' });
  const g = out.getContext('2d'), at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
  return { shapes: f.shapes.map(s => ({ rgb: s.rgb, share: s.share, L: s.L })), at00: at(10, 10), atLast: at(550, 390),
    sum: f.shapes.reduce((a, s) => a + s.share, 0), note: simplifyNote(f, { ...cfg, view: cfg.view || 'colour' }) };
}, [draw, cfg]);

const near = (a, b, tol = 10) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
// Four flat quarters: red, green, blue, yellow.
const QUARTERS = `[['#c8302a', 0, 0], ['#3a9a48', 280, 0], ['#2d54b8', 0, 200], ['#e8c840', 280, 200]].forEach(([c, x, y]) => { g.fillStyle = c; g.fillRect(x, y, 280, 200); });`;

test('four flat colours come back as four shapes of those colours, each a quarter; asking for more says there are no more', async ({ page }) => {
  await openApp(page);
  const r = await read(page, QUARTERS, { n: 8, detail: 'medium' });
  expect(r.shapes.length).toBe(4);
  for (const s of r.shapes) expect(s.share).toBeGreaterThan(22);
  expect(r.sum).toBeCloseTo(100, 3);
  for (const want of [[200, 48, 42], [58, 154, 72], [45, 84, 184], [232, 200, 64]]) expect(r.shapes.some(s => near(s.rgb, want))).toBe(true);
  expect(near(r.at00, [200, 48, 42])).toBe(true);
  expect(r.note).toContain('fewer than the 8 asked for');
});

test('the detail asked for decides whether a small patch is a shape of its own or is given to its neighbour', async ({ page }) => {
  await openApp(page);
  // Three broad bands, and three small bright specks (12 x 12) on them.
  const draw = `[['#6a5a4a', 0, 187], ['#a89a7a', 187, 187], ['#d8d0b8', 374, 186]].forEach(([c, x, wd]) => { g.fillStyle = c; g.fillRect(x, 0, wd, h); });` +
    `g.fillStyle = '#f0d020'; [[60, 80], [250, 300], [450, 150]].forEach(([x, y]) => g.fillRect(x, y, 12, 12));`;
  const broad = await read(page, draw, { n: 8, detail: 'broad' });
  const fine = await read(page, draw, { n: 8, detail: 'fine' });
  expect(broad.shapes.length).toBe(3);
  expect(broad.shapes.some(s => s.rgb[2] < 90 && s.rgb[0] > 220)).toBe(false);
  expect(fine.shapes.length).toBeGreaterThan(broad.shapes.length);
  expect(fine.shapes.some(s => s.rgb[0] > 200 && s.rgb[1] > 180 && s.rgb[2] < 90)).toBe(true);
});

test('value view paints each shape in the grey of its value; the largest shapes are what the note leads with', async ({ page }) => {
  await openApp(page);
  const r = await read(page, QUARTERS, { n: 5, detail: 'medium', view: 'value' });
  expect(r.at00[0]).toBe(r.at00[1]);
  expect(r.at00[1]).toBe(r.at00[2]);
  expect(Math.abs(r.at00[0] - r.atLast[0])).toBeGreaterThan(20);   // red and yellow are different values
  expect(r.note).toContain('listed darkest first');
  expect(r.note).toContain('The values run from L*');
});

test('in a session: a layer and a workspace row; shapes, detail and view chosen in the note are kept', async ({ page }) => {
  await openApp(page);
  const png = makePng(240, 240, (x, y) => (x < 120 ? (y < 120 ? [200, 48, 42] : [58, 154, 72]) : (y < 120 ? [45, 84, 184] : [232, 200, 64])));
  await page.setInputFiles('#dropInput', { name: 'quarters.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="value"]').click();
  await page.locator('#wsList .ws-tool', { hasText: '5 to 12 flat shapes' }).click();
  await expect(page.locator('#btnSimplify')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simplifyOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="simplify"]');
  await expect(part).toContainText('4 shapes');
  await part.locator('[data-simp-n="12"]').click();
  await part.locator('[data-simp-d="broad"]').click();
  await part.locator('[data-simp-v="value"]').click();
  await expect(part.locator('[data-simp-v="value"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(SIMPLIFY_KEY)))).toEqual({ n: 12, detail: 'broad', view: 'value' });

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="simplify"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#simplifyOverlay')).toBeHidden();
});
