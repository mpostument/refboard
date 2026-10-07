// Line and wash (js/linewash.js): line weight's own heavy and middle
// contours inked, the thin ones left bare over a wash of the picture's
// colour - in a session as a layer with its part of the shared note.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from canvas code, in the page, and plans its line and wash.
async function plan(page, w, h, paint) {
  return page.evaluate(async ([w, h, src]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    new Function('g', src)(g);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const p = stepsRead(img), m = lineWeightOf(p), plan = lineWashPlan(m);
    return {
      inkPts: plan.inkIdx.map(a => ({ x: m.pts[a] % m.w, y: Math.floor(m.pts[a] / m.w) })),
      washPts: plan.washIdx.map(a => ({ x: m.pts[a] % m.w, y: Math.floor(m.pts[a] / m.w) })),
      inkShare: plan.inkShare, washShare: plan.washShare, say: lineWashVerdict(plan),
    };
  }, [w, h, paint]);
}

test('a strong rim is inked; shares add up to the picture\'s whole contour', async ({ page }) => {
  await openApp(page);
  const r = await plan(page, 400, 400, `
    g.fillStyle = '#2a2530'; g.beginPath(); g.arc(200, 200, 120, 0, 7); g.fill();`);
  const rim = r.inkPts.filter(p => Math.abs(Math.hypot(p.x - 200, p.y - 200) - 120) < 8);
  // A plain dark disc on a light ground is one strong, long contour -
  // nothing here is a small inner line, so it is inked, not left to wash.
  expect(rim.length).toBeGreaterThan(200);
  expect(r.washPts.length).toBe(0);
  expect(r.inkShare + r.washShare).toBeCloseTo(100, 0);
  expect(r.say).toContain('Line');
  expect(r.say).toContain('100%');
});

test('a big outer shape is inked; a small inner mark of the same contrast is left to the wash', async ({ page }) => {
  await openApp(page);
  const r = await plan(page, 400, 400, `
    g.fillStyle = '#8a8a8a'; g.fillRect(60, 60, 280, 280);
    g.fillStyle = '#383838'; g.fillRect(190, 190, 22, 6);`);
  const outerInked = r.inkPts.some(p => p.x < 70 || p.x > 330 || p.y < 70 || p.y > 330);
  const innerInked = r.inkPts.some(p => p.x > 170 && p.x < 230 && p.y > 170 && p.y < 230);
  const innerWashed = r.washPts.some(p => p.x > 170 && p.x < 230 && p.y > 170 && p.y < 230);
  expect(outerInked).toBe(true);
  expect(innerInked).toBe(false);
  expect(innerWashed).toBe(true);
  expect(r.washShare).toBeGreaterThan(0);
  expect(r.say).toContain('Wash');
});

test('a flat picture has nothing to plan', async ({ page }) => {
  await openApp(page);
  const r = await plan(page, 200, 200, '');
  expect(r.inkPts).toHaveLength(0);
  expect(r.washPts).toHaveLength(0);
  expect(r.say).toContain('No clear contours');
});

test('in a session: a layer and a workspace row, with a wash under the ink; the note x turns it off', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('refboard.materials.v1', JSON.stringify({ have: ['watercolour', 'liner'], main: 'watercolour' })));
  const png = makePng(200, 200, (x, y) => Math.hypot(x - 100, y - 100) < 60 ? [60, 60, 70] : [240, 240, 240]);
  await page.setInputFiles('#dropInput', { name: 'ball.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  // No key of its own: from the Line tab.
  await page.locator('#wsTabs [data-tab="line"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Line and wash' }).click();
  await expect(page.locator('#btnLineWash')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lineWashOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="linewash"]');
  await expect(part).toContainText('Line');
  await expect(part).toContainText('Wash');

  await part.locator('.note-off').click();
  await expect(page.locator('#btnLineWash')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lineWashOverlay')).toBeHidden();
  await expect(page.locator('#poseNote [data-note="linewash"]')).toHaveCount(0);
});
