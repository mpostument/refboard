// Reference check (js/quality.js): is a picture a good one to work from -
// highlights and shadows lost, flat light, focus, size. Over it in a session,
// as a layer, with the verdict in the note.
const { test, expect, makePng, openApp } = require('../helpers');

// Paints a picture in the page from the source of a drawing (`g`, `w`, `h` in
// scope) and reads it as the app does.
const run = (page, w, h, draw) => page.evaluate(async ([w, h, src]) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), w, h);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const q = qualityOf(stepsRead(img));
  return { levels: Object.fromEntries(q.checks.map(k => [k.id, k.level])), text: Object.fromEntries(q.checks.map(k => [k.id, k.text])),
    verdict: q.verdict, blown: q.blown, crushed: q.crushed, backWhite: q.backWhite, spread: q.spread, sharp: q.sharp };
}, [w, h, draw]);

// Light and dark stripes, 28 px wide: lots of crisp edges and a fair spread of values.
const STRIPES = `for (let x = 0; x < w; x += 28) { g.fillStyle = (x / 28) % 2 ? '#d0d0d0' : '#383838'; g.fillRect(x, 0, 28, h); }`;

test('a sharp, well-lit, large picture passes every check', async ({ page }) => {
  await openApp(page);
  const r = await run(page, 1400, 1000, STRIPES);
  expect(Object.values(r.levels)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
  expect(r.verdict).toBe('A good picture to work from.');
  expect(r.sharp).toBeGreaterThan(10);
  expect(r.spread).toBeGreaterThan(45);
});

test('a white patch inside the picture is a lost highlight; a white backdrop round the picture is not', async ({ page }) => {
  await openApp(page);
  // A white block in the middle: 12% of the picture, not touching the edge.
  const blown = await run(page, 1400, 1000, STRIPES + `g.fillStyle = '#fff'; g.fillRect(w * 0.3, h * 0.25, w * 0.4, h * 0.3);`);
  expect(blown.levels.highlights).toBe('bad');
  expect(blown.blown).toBeGreaterThan(10);
  expect(blown.text.highlights).toContain('pure white');
  // The stripes on a white ground: the white that the edge reaches is a backdrop, counted apart.
  const backdrop = await run(page, 1400, 1000, `g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);` +
    `for (let x = 210; x < w - 210; x += 28) { g.fillStyle = (x / 28) % 2 ? '#d0d0d0' : '#383838'; g.fillRect(x, 150, 28, h - 300); }`);
  expect(backdrop.levels.highlights).toBe('ok');
  expect(backdrop.blown).toBeLessThan(1.5);
  expect(backdrop.backWhite).toBeGreaterThan(30);
  expect(backdrop.text.highlights).toContain('not counted');
});

test('black shadows, flat light, a soft focus and a small file each fail their own check', async ({ page }) => {
  await openApp(page);
  const crushed = await run(page, 1400, 1000, STRIPES + `g.fillStyle = '#000'; g.fillRect(w * 0.3, h * 0.25, w * 0.4, h * 0.3);`);
  expect(crushed.levels).toMatchObject({ shadows: 'bad', highlights: 'ok', size: 'ok' });
  // Two near greys only: flat light, though the stripes keep the edges crisp.
  const flat = await run(page, 1400, 1000, `for (let x = 0; x < w; x += 28) { g.fillStyle = (x / 28) % 2 ? '#8a8a8a' : '#7c7c7c'; g.fillRect(x, 0, 28, h); }`);
  expect(flat.levels.light).toBe('bad');
  expect(flat.levels.highlights).toBe('ok');
  expect(flat.verdict).toContain('light');
  // Wide bands, blurred: no crisp edge is left, though the values still span plenty. (Narrow bands would blur to grey, which is flat
  // light, not soft focus; and they run past the picture, or the blur would fade its own edge, a crisp edge of its own.)
  const blurred = px => run(page, 1400, 1000, `g.filter = 'blur(${px}px)'; for (let x = -250; x < w + 250; x += 250) { g.fillStyle = (x / 250) % 2 ? '#d0d0d0' : '#383838'; g.fillRect(x, -100, 250, h + 200); }`);
  const little = await blurred(16), soft = await blurred(40);
  expect(little.levels.sharpness).toBe('warn');
  expect(soft.levels.sharpness).toBe('bad');
  expect(soft.levels.light).not.toBe('bad');
  // The stripes in a file of 320 x 200: too small, but sharp.
  const small = await run(page, 320, 200, STRIPES);
  expect(small.levels.size).toBe('bad');
  expect(small.levels.sharpness).toBe('ok');
});

test('in a session: a layer and a workspace row; the note gives a verdict and a line per check; pink marks the lost highlight', async ({ page }) => {
  await openApp(page);
  // 200 x 200 (small), a white block inside, the rest light and dark stripes.
  const png = makePng(200, 200, (x, y) => (x > 60 && x < 140 && y > 60 && y < 140) ? [255, 255, 255] : (Math.floor(x / 10) % 2 ? [208, 208, 208] : [56, 56, 56]));
  await page.setInputFiles('#dropInput', { name: 'ref.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="value"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Reference check' }).click();
  await expect(page.locator('#btnQuality')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#qualityOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="quality"]');
  await expect(part.locator('.qc-row')).toHaveCount(5);
  await expect(part.locator('.qc-verdict')).toContainText('poor reference');
  await expect(part.locator('.qc-row', { hasText: 'Highlights' })).toContainText('pure white');
  await expect(part.locator('.qc-row', { hasText: 'Size' })).toContainText('too small');
  // The overlay is pink where the block is and clear elsewhere.
  const px = await page.evaluate(() => {
    const c = el('qualityOverlay'), d = c.getContext('2d');
    const at = (fx, fy) => Array.from(d.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data);
    return { inside: at(0.5, 0.5), outside: at(0.1, 0.1) };
  });
  expect(px.inside[0]).toBe(255);
  expect(px.inside[3]).toBeGreaterThan(100);
  expect(px.outside[3]).toBe(0);

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="quality"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#qualityOverlay')).toBeHidden();
});
