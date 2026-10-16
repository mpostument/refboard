// Cut out (js/assetsfx.js cutOut(), the sheet in js/genedit.js): a figure on a plain
// background becomes a PNG with nothing behind it. The pictures are made here, pixel by pixel,
// so a test says exactly what is where; the model is not involved.
const { test, expect, openApp, fakeServer, makePng } = require('../helpers');

const CREAM = [250, 248, 244], GREEN = [0, 177, 64], RED = [200, 30, 40];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// A disc of radius r at (100, 100) on a 200 x 200 ground, one pixel of antialiasing on its rim.
const disc = (bg, fg, r = 60) => makePng(200, 200, (x, y) => mix(bg, fg, Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - 100, y - 100)))));
// A white disc with a black ring round it, on white: the gap inside is the background's colour.
const donut = () => makePng(200, 200, (x, y) => {
  const d = Math.hypot(x - 100, y - 100);
  return d > 60 ? [255, 255, 255] : d > 54 ? [20, 20, 20] : [255, 255, 255];
});
const gradient = () => makePng(200, 200, x => { const v = Math.round(x / 199 * 255); return [v, v, v]; });

// Runs cutOut in the page on a PNG, and reports what a test wants to know of the result.
async function cutIn(page, png, options = {}) {
  return page.evaluate(async ([b64, options]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    c.getContext('2d').drawImage(img, 0, 0);
    const r = cutOut(c, options);
    if (!r.found) return { found: false, bgShare: r.bgShare };
    const d = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data;
    const at = (x, y) => Array.from(d.slice((y * r.canvas.width + x) * 4, (y * r.canvas.width + x) * 4 + 4));
    const rim = [];       // every pixel that is not fully transparent: [r, g, b, a]
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) rim.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
    return { found: true, w: r.canvas.width, h: r.canvas.height, x: r.x, y: r.y, corner: at(0, 0), middle: at(r.canvas.width >> 1, r.canvas.height >> 1), rim };
  }, [png.toString('base64'), options]);
}
const far = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

for (const [name, bg] of [['cream', CREAM], ['green', GREEN]]) {
  test(`a disc on ${name} is cut out whole, with no halo`, async ({ page }) => {
    await openApp(page);
    const r = await cutIn(page, disc(bg, RED), { trim: false });
    expect(r.found).toBe(true);
    expect(r.corner[3]).toBe(0);
    expect(r.middle).toEqual([...RED, 255]);
    // The area that is left is the disc's, give or take its rim.
    expect(Math.abs(r.rim.length - Math.PI * 60 * 60)).toBeLessThan(400);
    // The halo is the background's colour in the rim: every pixel that is left must be the
    // figure's own, not a mix with the ground it was on.
    const worst = Math.max(...r.rim.map(p => far(p, RED)));
    expect(worst).toBeLessThanOrEqual(30);
  });
}

test('trimmed, the cut-out is the figure with a little room, and says where it was', async ({ page }) => {
  await openApp(page);
  const r = await cutIn(page, disc(CREAM, RED));
  expect(r.w).toBeGreaterThanOrEqual(121);
  expect(r.w).toBeLessThanOrEqual(130);
  expect(r.h).toBe(r.w);
  expect(r.x).toBeGreaterThanOrEqual(34);
  expect(r.x).toBeLessThanOrEqual(40);
});

test('the gaps inside are kept unless asked for - a white plate is the colour of the background too', async ({ page }) => {
  await openApp(page);
  const kept = await cutIn(page, donut(), { trim: false });
  expect(kept.found).toBe(true);
  expect(kept.corner[3]).toBe(0);
  expect(kept.middle[3]).toBe(255);
  const cut = await cutIn(page, donut(), { trim: false, holes: true });
  expect(cut.middle[3]).toBe(0);
  // The black ring stays either way.
  expect(cut.rim.filter(p => p[0] < 60 && p[3] === 255).length).toBeGreaterThan(1500);
});

test('specks - small loose pieces - go, and stay when asked to', async ({ page }) => {
  await openApp(page);
  // A disc and, far from it, a 4 x 4 dot.
  const withDot = makePng(200, 200, (x, y) => {
    const d = Math.hypot(x - 100, y - 100), dot = x >= 10 && x < 14 && y >= 10 && y < 14;
    return d <= 60 || dot ? RED : CREAM;
  });
  const gone = await cutIn(page, withDot, { trim: false });
  expect(gone.rim.length).toBeGreaterThan(10000);
  expect(gone.rim.length).toBeLessThan(11600);   // the disc alone, not the disc and 16 pixels
  const kept = await cutIn(page, withDot, { trim: false, specks: false });
  expect(kept.rim.length - gone.rim.length).toBe(16);
  // A loose piece that is a real part - a sword the figure let go of, 40 x 4 beside a disc of 40 -
  // is three per cent of the biggest piece, far over a speck: it stays.
  const apart = makePng(200, 200, (x, y) => Math.hypot(x - 100, y - 100) <= 40 || (x >= 150 && x < 190 && y >= 98 && y < 102) ? RED : CREAM);
  const sword = await cutIn(page, apart, { trim: false });
  expect(sword.rim.length).toBeGreaterThan(Math.PI * 40 * 40 + 100);
});

test('a picture with no plain background says so', async ({ page }) => {
  await openApp(page);
  expect((await cutIn(page, gradient())).found).toBe(false);
  // Nothing counts as background at the lowest setting of a flat picture with a faint shade: the
  // setting is said, not a crash.
  const r = await cutIn(page, disc(CREAM, RED), { tolerance: -1 });
  expect(r.found).toBe(false);
});

// ---- The sheet, through the More menu.
async function setup(page, png) {
  const server = await fakeServer(page);
  const id = 'b'.repeat(64);
  const doc = { file: id + '.png', name: 'knight, white background', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(),
    folder: 'generated', tags: ['character', 'side'], prompt: '1girl, knight', avoid: '', shape: 'portrait', seed: 5 };
  server.items.set('uploads/' + id, doc);
  if (png) await page.route(/api\/uploads\/b{64}\.png/, r => r.fulfill({ contentType: 'image/png', body: png }));
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(1);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-cut').first().click();
  return server;
}

test('Cut out: the sheet shows the figure, and Keep the PNG files a picture with a transparent corner', async ({ page }) => {
  const server = await setup(page, disc(CREAM, RED));
  await expect(page.locator('#cutSheet')).toBeVisible();
  await expect(page.locator('#cutHint')).toContainText('with a transparent background');
  // What is behind it is only how it is looked at.
  await page.click('#cutBehind [data-behind="dark"]');
  await expect(page.locator('#cutStage')).toHaveAttribute('data-behind', 'dark');
  await page.click('#cutZoom [data-zoom="3"]');
  await expect(page.locator('#cutStage')).toHaveClass(/zoomed/);
  // The slider cuts again: at the lowest almost nothing counts as background, at the highest the
  // disc's own rim does not leak into it.
  await page.locator('#cutTol').fill('120');
  await expect(page.locator('#cutSave')).toBeEnabled();
  await page.locator('#cutTol').fill('48');
  const post = page.waitForRequest(r => r.method() === 'POST' && /api\/uploads$/.test(r.url()));
  await page.click('#cutSave');
  const sent = (await post).postDataBuffer();
  await expect(page.locator('#genStatus')).toHaveText('Cut out - in Uploads, Generated.');
  await expect(page.locator('#cutSheet')).toBeHidden();
  const alpha = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return [g.getImageData(0, 0, 1, 1).data[3], g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data[3]];
  }, sent.toString('base64'));
  expect(alpha).toEqual([0, 255]);
  // Kept under the picture it was cut from, tagged, and still in Generated.
  const kept = [...server.items].find(([k, v]) => k.startsWith('uploads/') && v.tags?.includes('cut out'))?.[1];
  expect(kept.parent).toBe('b'.repeat(64) + '.png');
  expect(kept.tags).toEqual(expect.arrayContaining(['character', 'side', 'cut out']));
  expect(kept.type).toBe('image/png');
});

test('Cut out on a picture with no plain background says so instead of opening a sheet', async ({ page }) => {
  // The default test picture is four flat quadrants: no colour is most of its edge.
  await setup(page, null);
  await expect(page.locator('#genStatus')).toContainText('no plain background');
  await expect(page.locator('#cutSheet')).toBeHidden();
});

test('Esc closes the Cut out sheet and nothing is kept', async ({ page }) => {
  const server = await setup(page, disc(CREAM, RED));
  await expect(page.locator('#cutSheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cutSheet')).toBeHidden();
  expect([...server.items.values()].filter(v => v.tags?.includes('cut out'))).toHaveLength(0);
});
