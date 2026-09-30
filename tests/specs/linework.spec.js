// Line weight (js/linework.js): the contours as ink, heavy on the shadow
// side and along the big contours, light on the lit side and for small
// inner lines; in a session as a layer with its part of the shared note.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from canvas code, in the page, and weighs its lines.
// Returns, per point, x, y and its class (0 thin, 1 middle, 2 heavy).
async function weigh(page, w, h, paint) {
  return page.evaluate(async ([w, h, src]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    new Function('g', src)(g);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = lineWeightOf(stepsRead(img));
    return { pts: Array.from(m.pts, (i, k) => ({ x: i % m.w, y: Math.floor(i / m.w), c: m.cls[k], t: m.taper[k] })),
      share: m.share, say: lineWeightVerdict(m, null) };
  }, [w, h, paint]);
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

test('a ball lit from the upper left: heavy lines on its shadow side, light on its lit side', async ({ page }) => {
  await openApp(page);
  // Light from the upper left: the ball's lower right is dark.
  const m = await weigh(page, 400, 400, `
    const r = g.createRadialGradient(150, 150, 10, 200, 200, 130);
    r.addColorStop(0, '#e8e2d8'); r.addColorStop(1, '#2a2530');
    g.fillStyle = r; g.beginPath(); g.arc(200, 200, 120, 0, 7); g.fill();`);
  const rim = m.pts.filter(p => Math.abs(Math.hypot(p.x - 200, p.y - 200) - 120) < 8);
  expect(rim.length).toBeGreaterThan(200);
  const lit = rim.filter(p => p.x < 170 && p.y < 170), shade = rim.filter(p => p.x > 230 && p.y > 230);
  expect(mean(shade.map(p => p.c))).toBeGreaterThan(1.5);
  expect(mean(lit.map(p => p.c))).toBeLessThan(0.7);
  // Every class is used: the weight is relative.
  for (const s of m.share) expect(s).toBeGreaterThan(10);
  expect(m.say).toContain('Heavy');
});

test('a big outer contour is heavier than a small line inside it', async ({ page }) => {
  await openApp(page);
  // A mid-grey block, and inside it a small dark mark of the same contrast
  // against the block as the block has against the paper.
  const m = await weigh(page, 400, 400, `
    g.fillStyle = '#8a8a8a'; g.fillRect(60, 60, 280, 280);
    g.fillStyle = '#383838'; g.fillRect(190, 190, 22, 6);`);
  const outer = m.pts.filter(p => p.x < 70 || p.x > 330 || p.y < 70 || p.y > 330);
  const inner = m.pts.filter(p => p.x > 170 && p.x < 230 && p.y > 170 && p.y < 230);
  expect(inner.length).toBeGreaterThan(0);
  expect(mean(outer.map(p => p.c))).toBeGreaterThan(mean(inner.map(p => p.c)));
});

test('an open line tapers toward its ends; a flat picture has no lines', async ({ page }) => {
  await openApp(page);
  const m = await weigh(page, 400, 300, "g.fillStyle = '#333'; g.fillRect(60, 100, 280, 100);");
  // A closed contour has no ends, so nothing tapers on the rectangle...
  expect(Math.min(...m.pts.map(p => p.t))).toBeGreaterThan(0.99);
  // ...but a stroke cut by the picture's edge ends there.
  const cut = await weigh(page, 400, 300, "g.fillStyle = '#333'; g.fillRect(-10, 100, 250, 100);");
  const ends = cut.pts.filter(p => p.x < 20);
  expect(ends.length).toBeGreaterThan(0);
  expect(Math.min(...ends.map(p => p.t))).toBeLessThan(0.6);
  const flat = await weigh(page, 200, 200, '');
  expect(flat.pts).toHaveLength(0);
  expect(flat.say).toContain('No clear contours');
});

test('in a session: k draws the lines as a layer, with a liner size in the note; the note x turns it off', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('refboard.materials.v1', JSON.stringify({ have: ['watercolour', 'liner'], main: 'watercolour' })));
  const png = makePng(200, 200, (x, y) => Math.hypot(x - 100, y - 100) < 60 ? [60, 60, 70] : [240, 240, 240]);
  await page.setInputFiles('#dropInput', { name: 'ball.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  await page.keyboard.press('k');
  await expect(page.locator('#btnLineWeight')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#lineOverlay')).toBeVisible();
  const part = page.locator('#poseNote [data-note="lineweight"]');
  await expect(part).toContainText('Heavy');
  await expect(part).toContainText('0.5-0.8');

  // The new Line tab has it on.
  await page.keyboard.press('w');
  await page.locator('#wsTabs [data-tab="line"]').click();
  await expect(page.locator('#wsQuestion')).toHaveText('How do I draw the lines?');
  await expect(page.locator('#wsList')).toContainText('Line weight');
  await page.click('#wsClose');

  await part.locator('.note-off').click();
  await expect(page.locator('#btnLineWeight')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#lineOverlay')).toBeHidden();
  await expect(page.locator('#poseNote [data-note="lineweight"]')).toHaveCount(0);
});
