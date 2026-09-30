// Lightbox (js/lightbox.js): a photo of a sketch unbent from its four
// corners, the paper made white, shown full screen - as big as it was - to
// trace from; locked against touches while you do.
const { test, expect, makePng, quadrantsPng, openApp } = require('../helpers');

// A sheet photographed at a slant on a dark table, lit from the left (the
// paper greyer on the right), with a black line and a blue one across it.
const SHEET = [[60, 40], [330, 55], [350, 260], [45, 250]];
function inside(q, x, y) {
  let c = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const sketchPng = () => makePng(400, 300, (x, y) => {
  if (!inside(SHEET, x, y)) return [55, 48, 44];
  if (Math.abs(y - 120) < 2 && x > 90 && x < 300) return [30, 30, 34];
  if (Math.abs(x - 200) < 2 && y > 150 && y < 230) return [110, 140, 215];
  const v = 238 - 45 * (x - 50) / 300;   // lit from the left
  return [v, v - 4, v - 12];
});

test('the sheet is found, unbent, and its paper made white however it was lit', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const q = lbDetectCorners(img);
    lb.fromFile = true; lb.opts.paper = 'a4';
    const mm = lbPaperMm(q);
    const flat = lbFlatten(img, q, mm), W = flat.width, H = flat.height;
    const ratio = lbRatio(flat, lbPaper(flat.getContext('2d').getImageData(0, 0, W, H).data, W, H));
    const clean = lbRender(flat, ratio, 'clean', 0.5).data, dark = lbRender(flat, ratio, 'dark', 0.5).data;
    const photo = lbRender(flat, ratio, 'photo', 0.5).data;
    // Where the sheet's points land on the flat sheet: through its own corners.
    const at = (d, u, v) => { const i = 4 * (Math.round(v * (H - 1)) * W + Math.round(u * (W - 1))); return [d[i], d[i + 1], d[i + 2]]; };
    // Darkest in a small window - a line one pixel off still counts.
    const darkest = (d, u, v) => {
      let m = [255, 255, 255];
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const p = at(d, u + dx / W, v + dy / H);
        if (p[0] + p[1] + p[2] < m[0] + m[1] + m[2]) m = p;
      }
      return m;
    };
    // The black line is at y 120 of the photo: about 0.35 down the sheet.
    // The blue one at x 200: about 0.5 across, 0.6 to 0.8 down.
    return { q, mm, W, H,
      paperLeft: at(clean, 0.15, 0.15), paperRight: at(clean, 0.85, 0.85), photoRight: at(photo, 0.85, 0.85),
      line: darkest(clean, 0.5, 0.35), blueClean: darkest(clean, 0.5, 0.7), blueDark: darkest(dark, 0.5, 0.7) };
  }, sketchPng().toString('base64'));
  // The corners found are the sheet's, to within the detection's grid.
  r.q.forEach((p, i) => { expect(Math.abs(p[0] - SHEET[i][0])).toBeLessThan(6); expect(Math.abs(p[1] - SHEET[i][1])).toBeLessThan(6); });
  // Wider than tall: A4 landscape, and the flat sheet that shape.
  expect(r.mm).toEqual([297, 210]);
  expect(Math.abs(r.W / r.H - 297 / 210)).toBeLessThan(0.01);
  // The paper white at both ends, though the photo's right end is grey.
  expect(r.photoRight[0]).toBeLessThan(215);
  for (const p of [r.paperLeft, r.paperRight]) for (const c of p) expect(c).toBeGreaterThan(245);
  // The black line stays black; the blue stays blue in Clean, dark grey in Dark lines.
  for (const c of r.line) expect(c).toBeLessThan(80);
  expect(r.blueClean[2] - r.blueClean[0]).toBeGreaterThan(60);
  expect(Math.max(...r.blueDark) - Math.min(...r.blueDark)).toBeLessThan(3);
  expect(r.blueDark[0]).toBeLessThan(140);
});

test('from the rail: a photo, its corners, the sheet at real size, locked while tracing', async ({ page }) => {
  await openApp(page);
  await page.locator('#btnLightbox').click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('#lbEmpty')).toBeVisible();
  await page.setInputFiles('#lbInput', { name: 'sketch.png', mimeType: 'image/png', buffer: sketchPng() });

  // Corners first, found already; A4 by default, turned to the photo.
  await expect(page.locator('#lbCornersBar')).toBeVisible();
  await expect(page.locator('#lbHandles button')).toHaveCount(4);
  await expect(page.locator('#lbCornersNote')).toHaveText('A4, landscape');
  // A corner moves with the arrow keys.
  const before = await page.evaluate(() => lb.corners[0].slice());
  await page.locator('#lbHandles button').first().focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => lb.corners[0][0])).toBeGreaterThan(before[0]);
  await page.locator('#lbCornersDone').click();

  // The sheet, on white, cleaned.
  await expect(page.locator('#lbViewBar')).toBeVisible();
  await expect(page.locator('#lbCanvas')).toBeVisible();
  await expect(page.locator('#lightbox')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('#lbMode [data-mode="clean"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#lbMirror').click();
  await expect(page.locator('#lbMirror')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#lbCanvas').evaluate(c => c.style.transform)).toContain('scaleX(-1)');

  // Real size wants the screen measured first: a card's outline, made as
  // wide as a card. At 96 dpi a card is 323.5 px wide.
  await page.locator('#lbSize [data-size="real"]').click();
  await expect(page.locator('#lbCalBar')).toBeVisible();
  await expect(page.locator('#lbCard')).toBeVisible();
  await page.locator('#lbCardW').fill('324');
  await page.locator('#lbCalSave').click();
  await expect(page.locator('#lbSize [data-size="real"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lbSizeNote')).toContainText('29.7 x 21 cm, as on the paper');
  // 297 mm at 324 px to 85.6 mm.
  const w = await page.locator('#lbCanvas').evaluate(c => parseFloat(c.style.width));
  expect(Math.abs(w - 297 * 324 / 85.6)).toBeLessThan(1);
  // Kept for next time.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('refboard.lightbox.v1')).pxPerMm)).toBeCloseTo(324 / 85.6, 3);

  // Locked: the bar gone, a tap on the lock does nothing, holding it unlocks.
  await page.locator('#lbLock').click();
  await expect(page.locator('#lbViewBar')).toBeHidden();
  await expect(page.locator('#lbUnlock')).toBeVisible();
  await page.locator('#lbUnlock').click();
  await expect(page.locator('#lbViewBar')).toBeHidden();
  const box = await page.locator('#lbUnlock').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('#lbViewBar')).toBeVisible({ timeout: 3000 });
  await page.mouse.up();

  // Esc closes it.
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).toBeHidden();
});

test('from the workspace: the picture straight onto the lightbox, its own shape kept', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="learn"]').click();
  await expect(page.locator('#wsQuestion')).toHaveText('How do I get it onto the paper?');
  await page.locator('#wsList .ws-tool', { hasText: 'Lightbox' }).click();
  await expect(page.locator('#lbViewBar')).toBeVisible();
  // A square picture stays square, fitted in the paper.
  const mm = await page.evaluate(() => lb.mm);
  expect(Math.abs(mm[0] - mm[1])).toBeLessThan(0.01);
  expect(mm[0]).toBeCloseTo(210, 5);
  // Keys stay in it: Esc closes the lightbox, not the session.
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).toBeHidden();
  await expect(page.locator('#session')).toBeVisible();
});
