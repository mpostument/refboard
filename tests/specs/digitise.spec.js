// Digitise your work (js/digitise.js, Compare's "Clean scan..."): a photo of a page straightened from its
// four corners, the shadow and the tint divided out with the paper, kept as a scan.
const { test, expect, makePng, quadrantsPng, openApp } = require('../helpers');

test('a quadrilateral is stretched back to a rectangle: its four corners land on the output corners', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const w = 200, h = 160, data = new Uint8ClampedArray(w * h * 4).fill(255);
    const dot = (cx, cy, c) => { for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) data.set([...c, 255], ((cy + y) * w + cx + x) * 4); };
    // A trapezoid, as a sheet seen at an angle: wider at the bottom than at the top.
    const quad = [[50, 20], [150, 30], [185, 140], [15, 130]];
    const colours = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [0, 0, 0]];
    quad.forEach((q, i) => dot(q[0], q[1], colours[i]));
    const [ow, oh] = scanSize(quad), out = scanWarp({ data, width: w, height: h }, quad, ow, oh);
    const at = (x, y) => [...out.slice((y * ow + x) * 4, (y * ow + x) * 4 + 3)];
    return { size: [ow, oh], tl: at(2, 2), tr: at(ow - 3, 2), br: at(ow - 3, oh - 3), bl: at(2, oh - 3), mid: at(ow >> 1, oh >> 1) };
  });
  expect(r.tl).toEqual([255, 0, 0]);
  expect(r.tr).toEqual([0, 255, 0]);
  expect(r.br).toEqual([0, 0, 255]);
  expect(r.bl).toEqual([0, 0, 0]);
  expect(r.mid, 'between the corners it is the page').toEqual([255, 255, 255]);
  // Edges 100 / 170 wide, 110 / 110 tall: the mean of each pair.
  expect(Math.abs(r.size[0] - 135)).toBeLessThan(6);
});

// A page lit unevenly and yellow: dim to the right, a line down the middle, a wash in the lower left.
const PAGE = `
  const w = 200, h = 200, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const light = 1 - 0.4 * x / w;
    let c = [250, 245, 235];                       // paper
    if (Math.abs(x - 100) < 2) c = [20, 20, 20];   // a pencil line
    if (x >= 20 && x < 90 && y >= 100 && y < 190) c = [90, 110, 150];   // a wash, 70 x 90
    data.set([c[0] * light, c[1] * light * 0.95, c[2] * light * 0.75, 255], (y * w + x) * 4);
  }`;

test('the shadow and the tint go with the paper: it comes out white and even, the line stays dark', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(src => {
    const data = new Function(src + '; return data;')();
    scanFlatten(data, 200, 200, 'drawing');
    const at = (x, y) => [...data.slice((y * 200 + x) * 4, (y * 200 + x) * 4 + 3)];
    return { left: at(10, 20), right: at(190, 20), line: at(100, 20) };
  }, PAGE);
  for (const p of [r.left, r.right]) for (const c of p) expect(Math.abs(c - 252), `paper ${p}`).toBeLessThan(8);
  expect(Math.max(...r.line), 'the line is still dark').toBeLessThan(60);
});

test('a painting keeps its wash; a line drawing takes a wide patch for shadow', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(src => {
    const run = kind => { const data = new Function(src + '; return data;')(); scanFlatten(data, 200, 200, kind); const o = (60 * 1 + 150 * 200) * 4; return [...data.slice(o, o + 3)]; };
    return { drawing: run('drawing'), painting: run('painting') };
  }, PAGE);
  expect(Math.min(...r.painting), 'the wash is still a wash').toBeLessThan(170);
  expect(Math.max(...r.drawing) - Math.min(...r.drawing), 'a drawing page: the wash is bleached toward the paper').toBeLessThan(
    Math.max(...r.painting) - Math.min(...r.painting) + 1);
  expect(Math.min(...r.drawing)).toBeGreaterThan(Math.min(...r.painting));
});

test('in a session: four clicks on the corners replace the photo with the page straight, and keep it as a digitised scan', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'ref.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  // A 400 x 300 photo: the page (a pale rectangle, 300 x 220) on a dark table.
  const photo = makePng(400, 300, (x, y) => x >= 50 && x < 350 && y >= 40 && y < 260 ? [230, 225, 200] : [40, 40, 40]);
  await page.setInputFiles('#cmpInput', { name: 'page.png', mimeType: 'image/png', buffer: photo });
  await expect(page.locator('#cmpScan')).toBeVisible();
  await page.waitForFunction(() => drawing && drawing.img);
  await page.click('#cmpScan');
  await expect(page.locator('#cmpHint')).toContainText('top-left');
  // Where a point of the photo is on screen.
  const corners = await page.evaluate(() => [[50, 40], [350, 40], [350, 260], [50, 260]].map(p => {
    const r = drawingToRef(p), im = el('img').getBoundingClientRect();
    return [im.left + r[0] / el('img').naturalWidth * im.width, im.top + r[1] / el('img').naturalHeight * im.height];
  }));
  for (const [x, y] of corners) await page.mouse.click(x, y);
  await expect(page.locator('#cmpHint')).toContainText('Clean scan');
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = drawing.w; c.height = drawing.h;
    const g = c.getContext('2d'); g.drawImage(drawing.img, 0, 0);
    const px = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
    const ups = await listUploads();
    return { w: drawing.w, h: drawing.h, corner: px(1, 1), centre: px(drawing.w >> 1, drawing.h >> 1), scan: ups.find(u => (u.tags || []).includes('digitised')) };
  });
  expect(Math.abs(r.w - 300)).toBeLessThan(8);
  expect(Math.abs(r.h - 220)).toBeLessThan(8);
  expect(Math.min(...r.corner), 'no table left in the corner').toBeGreaterThan(200);
  expect(Math.min(...r.centre)).toBeGreaterThan(200);
  expect(r.scan, 'kept').toBeTruthy();
  expect(r.scan.from).toBe('work');
  expect(r.scan.reference, 'with the reference it was drawn from').toBeTruthy();
});
