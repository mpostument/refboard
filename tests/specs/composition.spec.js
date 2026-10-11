// Composition analysis (js/composition.js): where contrast pulls the eye, where
// the weight sits, the strongest straight lines, the best crops. Over a picture
// in a session, as a layer.
const { test, expect, makePng, openApp } = require('../helpers');

// Paints a picture in the page from the source of a drawing and analyses it as the app does.
const read = (page, draw) => page.evaluate(async src => {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const f = compositionOf(stepsRead(img));
  return { cx: f.cx, cy: f.cy, left: f.left, top: f.top, lines: f.lines.map(l => ({ deg: l.deg, len: l.len })), leading: f.leading,
    crops: f.crops.map(k => ({ x: k.x, y: k.y, cw: k.cw, ch: k.ch, name: k.name, kept: k.kept })), note: compositionNote(f, { crop: 1, heat: true }) };
}, draw);

const GREY = `g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);`;
const DISC = (x, y, r, colour = '#d4231f') => `g.fillStyle = '${colour}'; g.beginPath(); g.arc(${x}, ${y}, ${r}, 0, 7); g.fill();`;

test('one bright disc low on the left: the weight is there, the note says which side is heavy, and the best crop keeps it', async ({ page }) => {
  await openApp(page);
  const r = await read(page, GREY + DISC(130, 290, 60));
  expect(r.cx).toBeLessThan(0.35);
  expect(r.cy).toBeGreaterThan(0.6);
  expect(r.left).toBeGreaterThan(75);
  expect(r.note).toContain('The weight sits lower left');
  expect(r.crops.length).toBeGreaterThan(0);
  // A crop is smaller than the picture and holds nearly all of what pulls the eye.
  const best = r.crops[0];
  expect(best.cw * best.ch).toBeLessThan(0.92 * 560 * 400);
  expect(best.kept).toBeGreaterThan(80);
  // It contains the disc.
  expect(best.x).toBeLessThanOrEqual(70);
  expect(best.x + best.cw).toBeGreaterThanOrEqual(190);
  expect(best.y).toBeLessThanOrEqual(230);
  expect(best.y + best.ch).toBeGreaterThanOrEqual(350);
  expect(r.note).toContain('Best crop');
});

test('a disc in the middle is calm; a flat picture has nothing to pull the eye and no lines', async ({ page }) => {
  await openApp(page);
  const centred = await read(page, GREY + DISC(280, 200, 70));
  expect(Math.abs(centred.cx - 0.5)).toBeLessThan(0.05);
  expect(Math.abs(centred.cy - 0.5)).toBeLessThan(0.05);
  expect(centred.note).toContain('near the middle');
  const flat = await read(page, GREY);
  expect(flat.lines).toEqual([]);
  expect(flat.note).toContain('No strong straight line');
});

test('a long diagonal aimed at the disc is found as a line and leads the eye there; a horizon is a line but does not lead', async ({ page }) => {
  await openApp(page);
  const lead = await read(page, `g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#202020'; g.lineWidth = 8;` +
    `g.beginPath(); g.moveTo(0, 400); g.lineTo(400, 160); g.stroke();` + DISC(400, 160, 28, '#d4231f'));
  // The line runs up to the right: 149 degrees in screen terms (y down).
  expect(lead.lines.some(l => Math.abs(l.deg - 149) < 8 && l.len > 250)).toBe(true);
  expect(lead.leading).toBeGreaterThanOrEqual(1);
  expect(lead.note).toContain('lead');
  const horizon = await read(page, `g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); g.fillStyle = '#303030'; g.fillRect(0, 300, w, h - 300);` + DISC(400, 120, 28));
  expect(horizon.lines.some(l => l.deg < 6 || l.deg > 174)).toBe(true);
  expect(horizon.leading).toBe(0);
});

test('in a session: a layer and a workspace row; the crop and the eye map chosen in the note are kept', async ({ page }) => {
  await openApp(page);
  const png = makePng(240, 240, (x, y) => (Math.hypot(x - 60, y - 180) < 28 ? [212, 35, 31] : [154, 154, 154]));
  await page.setInputFiles('#dropInput', { name: 'disc.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="composition"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Composition analysis' }).click();
  await expect(page.locator('#btnComposition')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compositionOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="composition"]');
  await expect(part).toContainText('The weight sits lower left');
  await part.locator('[data-comp-crop="0"]').click();
  await part.locator('[data-comp-heat="off"]').click();
  await expect(part.locator('[data-comp-heat="off"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(COMPOSITION_KEY)))).toEqual({ crop: 0, heat: false });

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="composition"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#compositionOverlay')).toBeHidden();
});
