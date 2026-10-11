// Hatching map (js/hatch.js): how many layers of hatching each area wants, as a
// map of levels or the picture drawn in strokes. (hatch.spec.js is the 3D
// forms' hatching.) Over a picture in a session, as a layer.
const { test, expect, makePng, openApp } = require('../helpers');

// Paints a picture in the page from the source of a drawing and reads its levels.
const read = (page, draw) => page.evaluate(async src => {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const f = hatchOf(stepsRead(img));
  const at = x => f.level[200 * f.w + x];
  return { share: f.share, flat: f.flat, left: at(10), mid: at(280), right: at(550), labels: hatchLabels(f).length, note: hatchNote(f, { view: 'map', lines: 'open' }) };
}, draw);

// Light to dark, left to right.
const RAMP = `const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, w, h);`;

test('a ramp from white to black climbs the ladder from paper to four layers, each level a share of it', async ({ page }) => {
  await openApp(page);
  const r = await read(page, RAMP);
  expect(r.flat).toBe(false);
  expect(r.left).toBe(0);
  expect(r.right).toBe(4);
  expect(r.mid).toBeGreaterThanOrEqual(2);
  expect(r.mid).toBeLessThanOrEqual(3);
  expect(r.share.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 3);
  // Every rung of the ladder has a fair slice of an even ramp.
  for (const s of r.share) { expect(s).toBeGreaterThan(8); expect(s).toBeLessThan(35); }
  expect(r.labels).toBeGreaterThan(2);
  expect(r.note).toContain('bare paper');
});

test('measured against its own range: a pale picture still climbs the whole ladder; a flat one has no ladder', async ({ page }) => {
  await openApp(page);
  // Only the light half of the range, white to mid grey.
  const pale = await read(page, `const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, '#fff'); r.addColorStop(1, '#aaa'); g.fillStyle = r; g.fillRect(0, 0, w, h);`);
  expect(pale.right).toBe(4);
  expect(pale.left).toBe(0);
  const flat = await read(page, `g.fillStyle = '#909090'; g.fillRect(0, 0, w, h); g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, w / 2, h);`);
  expect(flat.flat).toBe(true);
  expect(flat.share[0]).toBe(100);
  expect(flat.note).toContain('no ladder');
});

test('the strokes: more ink where more layers are wanted, none on the paper, crossed lines only in the dark', async ({ page }) => {
  await openApp(page);
  const ink = await page.evaluate(async src => {
    const c = document.createElement('canvas'); c.width = 560; c.height = 400;
    new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const f = hatchOf(stepsRead(img)), out = document.createElement('canvas');
    hatchDraw(f, out, { view: 'strokes', lines: 'open' });
    const g = out.getContext('2d'), dark = x0 => {
      const d = g.getImageData(x0, 0, 60, f.h).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 120) n++;
      return n / (60 * f.h);
    };
    return { paper: dark(5), light: dark(130), mid: dark(280), black: dark(495) };
  }, RAMP);
  expect(ink.paper).toBe(0);
  expect(ink.light).toBeGreaterThan(0);
  expect(ink.mid).toBeGreaterThan(ink.light);
  expect(ink.black).toBeGreaterThan(ink.mid);
});

test('in a session: a layer and a workspace row; map or strokes and the line spacing are chosen in the note and kept', async ({ page }) => {
  await openApp(page);
  const png = makePng(240, 240, x => { const v = Math.round(255 - x * 255 / 239); return [v, v, v]; });
  await page.setInputFiles('#dropInput', { name: 'ramp.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="line"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'how many layers of hatching' }).click();
  await expect(page.locator('#btnHatch')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#hatchOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="hatch"]');
  await expect(part).toContainText('bare paper');
  await expect(part).toContainText('four layers');
  await part.locator('[data-hatch-v="strokes"]').click();
  await expect(part.locator('[data-hatch-v="strokes"]')).toHaveAttribute('aria-pressed', 'true');
  await part.locator('[data-hatch-l="close"]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(HATCH_KEY)))).toEqual({ view: 'strokes', lines: 'close' });

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="hatch"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await part.locator('.note-off').click();
  await expect(page.locator('#hatchOverlay')).toBeHidden();
});
