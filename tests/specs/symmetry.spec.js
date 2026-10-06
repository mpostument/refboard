// Symmetry check (js/symmetry.js): a picture folded on a vertical line, and
// where its two halves part; in a session as a layer with the fold's chips.
const { test, expect, makePng, openApp } = require('../helpers');

// A drawing made in the page, then folded. `axis`: a fraction, or null to find it.
async function fold(page, paint, axis = null) {
  return page.evaluate(async ([src, axis]) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 400, 300);
    new Function('g', src)(g);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = symmetryOf(stepsRead(img), axis);
    return { axis: m.axis, found: m.found, parting: m.parting, thirds: m.thirds, say: symmetryVerdict(m) };
  }, [paint, axis]);
}
const disc = (x, y, r, col) => `g.fillStyle = '${col}'; g.beginPath(); g.arc(${x}, ${y}, ${r}, 0, 7); g.fill();`;
// A face: an oval with two eyes, standing on x = 150 - not the middle of the sheet.
const face = (eyeRightY = 120) =>
  "g.fillStyle = '#555'; g.beginPath(); g.ellipse(150, 150, 70, 110, 0, 0, 7); g.fill();" +
  disc(120, 120, 14, '#eee') + disc(180, eyeRightY, 14, '#eee') + disc(150, 200, 18, '#222');

test('a symmetrical drawing, off the middle of the sheet: the fold is found on its own axis, and the halves agree', async ({ page }) => {
  await openApp(page);
  const r = await fold(page, face());
  expect(r.found).toBe(true);
  expect(Math.abs(r.axis - 150 / 400)).toBeLessThan(0.02);
  expect(r.parting).toBeLessThan(0.04);
  expect(r.say).toContain('The halves agree');
});

test('one eye lower than the other: the halves part, and the note says where', async ({ page }) => {
  await openApp(page);
  const r = await fold(page, face(185));
  // The fold still lands on the face's own axis.
  expect(Math.abs(r.axis - 150 / 400)).toBeLessThan(0.03);
  expect(r.parting).toBeGreaterThan(0.06);
  expect(r.say).toContain('of the drawing differs');
  // Both eyes (the real and the mirrored one) sit in the top and middle thirds, not the bottom.
  expect(r.thirds[2]).toBeLessThan(Math.max(r.thirds[0], r.thirds[1]));
});

test('a fold set by hand is the fold used, however good another would be', async ({ page }) => {
  await openApp(page);
  const mid = await fold(page, face(), 0.5);
  expect(mid.found).toBe(false);
  expect(mid.axis).toBeCloseTo(0.5, 2);
  // Folded on the sheet's middle, a face standing at 150 does not match itself.
  expect(mid.parting).toBeGreaterThan(0.06);
});

test('in a session: y folds the picture, the chips move the fold, a layer and a workspace row, the note x turns it off', async ({ page }) => {
  await openApp(page);
  // Dark bar on the left third, mirrored on the right: symmetric about x = 100 of 300... made lopsided by one bar.
  const png = makePng(300, 200, (x, y) => (x > 40 && x < 80) || (x > 120 && x < 160 && y < 100) ? [30, 30, 30] : [235, 235, 235]);
  await page.setInputFiles('#dropInput', { name: 'fold.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  await page.keyboard.press('y');
  await expect(page.locator('#btnSymmetry')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#symOverlay')).toBeVisible();
  const part = page.locator('#poseNote [data-note="symmetry"]');
  await expect(part).toContainText('Fold');
  const at = part.locator('.sym-at');
  const before = await at.textContent();
  // Nudging moves the fold by a percent of the width; Find it goes back to the searched one.
  await part.locator('[data-sym-nudge="1"]').click();
  await expect(at).not.toHaveText(before);
  await part.locator('[data-sym-mid]').click();
  await expect(at).toHaveText('50%');
  await part.locator('[data-sym-find]').click();
  await expect(part.locator('[data-sym-find]')).toHaveAttribute('aria-pressed', 'true');

  // Laid over the picture's own box.
  const [a, b] = await Promise.all([page.locator('#symOverlay').boundingBox(), page.locator('#img').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);

  // A layer, and a row in the workspace's Construction and My work tabs.
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="symmetry"]')).toBeVisible();
  await page.click('#btnWorkspace');
  for (const tab of ['construction', 'mywork']) {
    await page.locator(`#wsTabs [data-tab="${tab}"]`).click();
    await expect(page.locator('#wsList .ws-tool', { hasText: 'Symmetry check' })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.click('#wsClose');

  await part.locator('.note-off').click();
  await expect(page.locator('#btnSymmetry')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#symOverlay')).toBeHidden();
});
