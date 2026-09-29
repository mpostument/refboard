// Edge map (js/edges.js): which edges of a picture are hard and which soft,
// worked out from the picture - over it in a session, as a layer, and as a
// step of How to draw it in watercolour.
const { test, expect, quadrantsPng, openApp } = require('../helpers');

test('hard is how quickly the change happens, not how big it is', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    // On paper: a sharp disc of little contrast on the left, a blurred one
    // of a lot on the right - the trainer's trick - and a thin line under
    // them, as in line art: drawn, not painted, so left out.
    const c = document.createElement('canvas'); c.width = 480; c.height = 260;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 480, 260);
    g.fillStyle = '#c8c8c8'; g.beginPath(); g.arc(120, 110, 70, 0, 7); g.fill();
    g.filter = 'blur(7px)'; g.fillStyle = '#202020'; g.beginPath(); g.arc(360, 110, 70, 0, 7); g.fill(); g.filter = 'none';
    g.fillStyle = '#303030'; g.fillRect(40, 228, 400, 2);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = edgeMap(stepsRead(img));
    const count = (x0, x1, y0, y1) => {
      const n = [0, 0, 0];
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) n[m.kind[y * m.w + x]]++;
      return { hard: n[1], soft: n[2] };
    };
    // A flat grey card: nothing to map.
    g.fillStyle = '#888'; g.fillRect(0, 0, 480, 260);
    const flat = new Image(); flat.src = c.toDataURL(); await flat.decode();
    const none = edgeMap(stepsRead(flat));
    return { left: count(0, 240, 0, 210), right: count(240, 480, 0, 210), line: count(0, 480, 215, 245),
      none: none.hard + none.soft, noneText: edgeVerdict(none), words: [edgeWords('water'), edgeWords(null)] };
  });
  expect(r.left.hard).toBeGreaterThan(200);
  expect(r.left.soft).toBeLessThan(r.left.hard / 10);
  expect(r.right.soft).toBeGreaterThan(200);
  expect(r.right.hard).toBeLessThan(r.right.soft / 10);
  expect(r.line.hard + r.line.soft).toBe(0);
  expect(r.none).toBe(0);
  expect(r.noneText).toContain('No edge here');
  expect(r.words[0].soft).toContain('wet-in-wet');
  expect(r.words[1].soft).toContain('hatching');
});

test('in a session: over the picture, with a note, a layer and a row in the workspace', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  const map = page.locator('#edgeOverlay');
  await expect(map).toBeHidden();
  // Four flat colours meeting: every edge hard.
  await page.keyboard.press('x');
  await expect(page.locator('#btnEdges')).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toBeVisible();
  await expect(page.locator('#poseNote')).toContainText('Nearly every edge is hard');
  await expect(page.locator('#poseNote .edge-s')).toHaveText('Soft');
  // Laid over the picture's own box.
  const [a, b] = await Promise.all([map.boundingBox(), page.locator('#img').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  // A layer like the others: listed, and turned off from there.
  await page.click('#btnLayers');
  const row = page.locator('#layersList [data-layer="edges"]');
  await expect(row.locator('input[type=checkbox]')).toBeChecked();
  await row.locator('input[type=checkbox]').uncheck();
  await expect(map).toBeHidden();
  await expect(page.locator('#poseNote')).toBeHidden();
  // In the workspace's Value tab, pressed when it is on.
  await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="value"]');
  const ws = page.locator('#wsList button', { hasText: 'Edge map' });
  await ws.click();
  await expect(ws).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toBeVisible();
});

test('How to draw it in watercolour: the edges as a step, with a key', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  await page.evaluate(() => openSteps(state.current));
  await page.click('#stepsMedia [data-medium="watercolour"]');
  await page.locator('#stepsStrip [data-step="5"]').click();
  await expect(page.locator('#stepsStepTitle')).toHaveText('Hard and soft edges');
  await expect(page.locator('#stepsKey li')).toHaveText(['Hard - on dry paper', 'Soft - wet-in-wet']);
  await expect(page.locator('#stepsStepText')).toContainText('wet-in-wet');
});
