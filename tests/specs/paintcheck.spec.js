// Painting check (js/paintcheck.js, the last three choices of Compare): where a photo of a painting
// parts from the reference in value, warmth and strength of colour - after the photo's overall light
// and cast are taken out.
const { test, expect, makePng, quadrantsPng, QUADS, openApp } = require('../helpers');

// Two w x h RGBA fields made in the page: `ref(x, y)` and `paint(x, y)` return [r, g, b] (or [r, g, b, a]).
async function diffOf(page, ref, paint, channel) {
  return page.evaluate(([ref, paint, channel]) => {
    const w = 60, h = 60, fill = f => {
      const fn = new Function('x', 'y', 'return ' + f), d = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); d.set([c[0], c[1], c[2], c[3] ?? 255], (y * w + x) * 4); }
      return d;
    };
    const diff = paintingDiff(fill(ref), fill(paint), w, h);
    if (!diff) return null;
    const map = paintingMap(diff, channel), at = (x, y) => [...map.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
    return { note: paintingNote(diff, channel), corner: at(50, 50), top: at(10, 10), share: diff.share };
  }, [ref, paint, channel]);
}
const GREY = '[120, 120, 120]';

test('a photo that is only dimmer overall is not marked: the light is matched first, and the note says so', async ({ page }) => {
  await openApp(page);
  const r = await diffOf(page, `[60 + x * 2, 100, 140 - y]`, `[(60 + x * 2) * 0.8, 80, (140 - y) * 0.8]`, 'tones');
  expect(r.note).toContain('within a hair');
  expect(r.note).toContain('darker overall');
  expect(r.corner[3], 'nothing is drawn').toBe(0);
});

test('one passage darker than the reference is named and drawn blue, the rest left clear', async ({ page }) => {
  await openApp(page);
  const r = await diffOf(page, GREY, `x > 40 && y > 40 ? [50, 50, 50] : [120, 120, 120]`, 'tones');
  expect(r.note).toContain('darker at bottom right');
  expect(r.corner.slice(0, 3)).toEqual([50, 110, 255]);
  expect(r.corner[3]).toBeGreaterThan(100);
  expect(r.top[3], 'the untouched part is clear').toBe(0);
});

test('warmer and greyer are told apart from darker and lighter', async ({ page }) => {
  await openApp(page);
  // The same value (a grey and an orange of about one lightness), so only colour moves.
  const warm = await diffOf(page, GREY, `x > 40 && y > 40 ? [170, 110, 80] : [120, 120, 120]`, 'warmth');
  expect(warm.note).toContain('warmer at bottom right');
  const grey = await diffOf(page, `x > 40 && y > 40 ? [200, 60, 60] : [120, 120, 120]`, `[120, 120, 120]`, 'colour');
  expect(grey.note).toContain('greyer');
  const same = await diffOf(page, GREY, `x > 40 && y > 40 ? [170, 110, 80] : [120, 120, 120]`, 'tones');
  expect(same.note, 'value barely moves').toContain('within a hair');
});

test('where the photo does not reach is not compared; a photo that shares no ground gives nothing', async ({ page }) => {
  await openApp(page);
  const half = await diffOf(page, GREY, `x < 30 ? [120, 120, 120, 255] : [0, 0, 0, 0]`, 'tones');
  expect(half.share).toBeCloseTo(0.5, 1);
  expect(half.corner[3]).toBe(0);
  expect(await diffOf(page, GREY, `[0, 0, 0, 0]`, 'tones')).toBeNull();
});

test('in a session, Where it parts reads the photo laid over the reference and says where it is lighter', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'ref.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  // The same picture, but the leaf quadrant (bottom left) painted much lighter.
  const photo = makePng(200, 200, (x, y) => x < 100 && y >= 100 ? [150, 200, 130]
    : x < 100 ? QUADS.skin : y < 100 ? QUADS.sky : QUADS.shadow);
  await page.setInputFiles('#cmpInput', { name: 'painting.png', mimeType: 'image/png', buffer: photo });
  await expect(page.locator('#cmpMode')).toBeVisible();
  await page.selectOption('#cmpMode', 'tones');
  await expect(page.locator('#cmpHint')).toContainText('lighter at bottom left');
  expect(await page.locator('#cmpMode optgroup option').count()).toBe(3);
  // The map is drawn over the reference, not the photo; going back to the lines puts the photo back.
  expect(await page.evaluate(() => el('drawImg').src.startsWith('data:image/png'))).toBe(true);
  await page.selectOption('#cmpMode', 'lines');
  expect(await page.evaluate(() => el('drawImg').src.startsWith('blob:'))).toBe(true);
});
