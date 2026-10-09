// Vignette (js/vignette.js): where a watercolour study could end and dissolve
// into bare paper - an island of the picture's interest, as a layer, with
// Amount and Edge chosen in the note.
const { test, expect, makePng, openApp } = require('../helpers');

const url = buf => 'data:image/png;base64,' + buf.toString('base64');
// A white sheet with a striped deep-blue disc off to the right, and nothing else.
const disc = () => makePng(300, 200, (x, y) => {
  const d = Math.hypot(x - 210, y - 80);
  return d < 40 ? ((x + y) % 8 < 4 ? [30, 50, 140] : [70, 100, 190]) : [255, 255, 255];
});

const shape = (page, c) => page.evaluate(async ([src, c]) => {
  const img = new Image(); img.src = src; await img.decode();
  const m = vgShape(stepsRead(img), c), at = (x, y) => m.keep[Math.round(y * m.h / 200) * m.w + Math.round(x * m.w / 300)];
  return { area: m.area, cx: m.cx / m.w * 300, cy: m.cy / m.h * 200, centre: at(210, 80), corner: at(5, 195), far: at(30, 100),
    inside: m.dark.inside, touches: m.touches, softMid: Array.from(m.keep).filter(v => v > 0.2 && v < 0.8).length,
    sum: Array.from(m.keep).reduce((a, b) => a + b, 0) };
}, [url(disc()), c]);
const BASE = { amount: 'medium', edge: 'soft' };

test('the island is round the picture, not the paper: the disc stays, the far corner goes', async ({ page }) => {
  await openApp(page);
  const r = await shape(page, BASE);
  expect(r.centre).toBeGreaterThan(0.95);
  expect(r.corner).toBeLessThan(0.05);
  expect(r.far).toBeLessThan(0.05);
  expect(r.area).toBeGreaterThan(4); expect(r.area).toBeLessThan(45);
  expect(Math.abs(r.cx - 210)).toBeLessThan(25); expect(Math.abs(r.cy - 80)).toBeLessThan(25);
  expect(r.inside).toBe(true);                                 // its darkest accent is kept
  expect(r.touches).toEqual([]);                               // paper all round it
});

test('Tight keeps less than Medium, and Medium less than Loose; a ragged edge is not a soft one', async ({ page }) => {
  await openApp(page);
  const [tight, medium, loose] = [await shape(page, { ...BASE, amount: 'tight' }), await shape(page, BASE), await shape(page, { ...BASE, amount: 'loose' })];
  expect(tight.area).toBeLessThan(medium.area); expect(medium.area).toBeLessThanOrEqual(loose.area);
  const ragged = await shape(page, { ...BASE, edge: 'ragged' });
  expect(Math.abs(ragged.sum - medium.sum)).toBeGreaterThan(5);   // the noise moved the edge
  expect(ragged.softMid).toBeGreaterThan(0);
  const again = await shape(page, { ...BASE, edge: 'ragged' });
  expect(again.sum).toBe(ragged.sum);                              // and the same each time
});

test('the note says what the island is, and warns when the darkest accent would be faded away', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const m = { w: 300, h: 200, area: 22, cx: 210, cy: 80, aspect: 1.1, angle: 0, touches: ['right'], dark: { inside: true } };
    const a = vgNote(m, { amount: 'medium', edge: 'soft' });
    m.dark.inside = false; m.touches = []; m.aspect = 2; m.angle = -45;
    return { a, b: vgNote(m, { amount: 'tight', edge: 'ragged' }), name: vgName(m), where: vgWhere({ ...m, cx: 250, cy: 40 }) };
  });
  expect(r.a).toContain('22% of the sheet is picture');
  expect(r.a).toContain('reaches the right');
  expect(r.a).not.toContain('falls outside');
  expect(r.b).toContain('falls outside it');
  expect(r.b).toContain('paper all round it');
  expect(r.name).toBe('an oval rising to the right');
  expect(r.where).toBe('upper right');
});

test('in a session: a layer and a Composition row; Amount and Edge kept; off from the note', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'disc.png', mimeType: 'image/png', buffer: disc() });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="composition"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Vignette' }).click();
  await expect(page.locator('#btnVignette')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#vignetteOverlay')).toBeVisible();
  await page.click('#wsClose');
  const note = page.locator('#poseNote [data-note="vignette"]');
  await expect(note).toContainText('of the sheet is picture');
  await expect(note.locator('[data-vg="amount:medium"]')).toHaveAttribute('aria-pressed', 'true');
  await note.locator('[data-vg="amount:tight"]').click();
  await expect(note.locator('[data-vg="amount:tight"]')).toHaveAttribute('aria-pressed', 'true');
  await note.locator('[data-vg="edge:ragged"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(VG_KEY)))).toEqual({ amount: 'tight', edge: 'ragged' });
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="vignette"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#poseNote [data-note="vignette"] .note-off').click();
  await expect(page.locator('#vignetteOverlay')).toBeHidden();
});
