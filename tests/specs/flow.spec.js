// Stroke direction (js/flow.js): short strokes laid the way the form goes, read
// from the picture's tone with a structure tensor; over it in a session, as a
// layer, with the density chosen in the note.
const { test, expect, makePng, openApp } = require('../helpers');

// Paints a picture in the page from the source of a drawing and reads its strokes.
const read = (page, draw, density = 'medium') => page.evaluate(async ([src, density]) => {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const f = flowOf(stepsRead(img), { density });
  // Each stroke's angle as a line (a stroke and its turned half are one), in degrees [0, 180).
  const deg = f.strokes.map(s => ((s.a * 180 / Math.PI) % 180 + 180) % 180);
  return { n: f.strokes.length, readable: f.readable, lean: f.lean, one: f.one, deg, word: flowWord(f.lean), note: flowNote(f, { density }) };
}, [draw, density]);

// Distance from an angle to a target, round the half turn.
const off = (d, target) => Math.min(Math.abs(d - target), 180 - Math.abs(d - target));

test('horizontal bands give horizontal strokes, vertical bands vertical ones, rising bands rising ones', async ({ page }) => {
  await openApp(page);
  const bands = f => `for (let i = 0; i < 80; i++) { g.fillStyle = i % 2 ? '#e0e0e0' : '#303030'; ${f} }`;
  const horizontal = await read(page, bands(`g.fillRect(0, i * 12, w, 12);`));
  const vertical = await read(page, bands(`g.fillRect(i * 12, 0, 12, h);`));
  // Bands along x + y = const run from lower left to upper right: rising to the right (135 degrees, y down).
  const rising = await read(page, `g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h); g.fillStyle = '#303030'; g.lineWidth = 12;` +
    `for (let k = -400; k < 1000; k += 24) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k - 400, 400); g.stroke(); }`);
  for (const [r, target] of [[horizontal, 0], [vertical, 90], [rising, 135]]) {
    expect(r.n).toBeGreaterThan(40);
    expect(r.readable).toBeGreaterThan(60);
    // Nearly every stroke on the bands' own line, and the picture one-sided.
    expect(r.deg.filter(d => off(d, target) < 12).length / r.n).toBeGreaterThan(0.9);
    expect(off(r.lean, target)).toBeLessThan(8);
    expect(r.one).toBeGreaterThan(0.9);
  }
  expect(horizontal.word).toBe('horizontal');
  expect(vertical.word).toBe('vertical');
  expect(rising.word).toBe('rising to the right');
  expect(horizontal.note).toContain('Most strokes run horizontal');
});

test('a flat picture has no direction; a shaded ball has every direction and the note says the form turns', async ({ page }) => {
  await openApp(page);
  const flat = await read(page, `g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);`);
  expect(flat.n).toBe(0);
  expect(flat.readable).toBe(0);
  expect(flat.note).toContain('No direction to read');
  // A ball lit from the top left: the tone's contours are curves round the highlight, so the strokes go every way.
  const ball = await read(page, `g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);` +
    `const r = g.createRadialGradient(240, 150, 10, 280, 200, 170); r.addColorStop(0, '#fff'); r.addColorStop(1, '#202020');` +
    `g.fillStyle = r; g.beginPath(); g.arc(280, 200, 170, 0, 7); g.fill();`);
  expect(ball.n).toBeGreaterThan(20);
  expect(ball.one).toBeLessThan(0.5);
  expect(ball.note).toContain('the form turns');
  // A spread of angles, not one: the horizontal-ish and the vertical-ish both appear.
  expect(ball.deg.some(d => off(d, 0) < 25)).toBe(true);
  expect(ball.deg.some(d => off(d, 90) < 25)).toBe(true);
});

test('finer density gives more strokes', async ({ page }) => {
  await openApp(page);
  const draw = `for (let i = 0; i < 80; i++) { g.fillStyle = i % 2 ? '#e0e0e0' : '#303030'; g.fillRect(0, i * 12, w, 12); }`;
  const [coarse, medium, fine] = [await read(page, draw, 'coarse'), await read(page, draw, 'medium'), await read(page, draw, 'fine')];
  expect(coarse.n).toBeLessThan(medium.n);
  expect(medium.n).toBeLessThan(fine.n);
});

test('in a session: a layer and a workspace row; the density chosen in the note is kept', async ({ page }) => {
  await openApp(page);
  const png = makePng(240, 240, (x, y) => (Math.floor(y / 12) % 2 ? [224, 224, 224] : [48, 48, 48]));
  await page.setInputFiles('#dropInput', { name: 'stripes.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="line"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Stroke direction' }).click();
  await expect(page.locator('#btnFlow')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#flowOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="flow"]');
  await expect(part).toContainText('Most strokes run horizontal');
  await part.locator('[data-flow-d="fine"]').click();
  await expect(part.locator('[data-flow-d="fine"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(FLOW_KEY)))).toEqual({ density: 'fine' });

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="flow"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#flowOverlay')).toBeHidden();
});
