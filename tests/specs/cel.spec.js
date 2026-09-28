// Cel shading in the 3D view: the Anime finish colours a form in a few flat
// tones, where every other finish shades it in a gradient.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* A form (a sphere unless told) alone on a flat background, rendered with `finish`, and how much
   of it the three commonest colours cover. Colours are bucketed by 4 per
   channel so dithering does not split one tone into many. */
const topThreeShare = (page, finish, shape = 'sphere') => page.evaluate(([finish, shape]) => {
  Object.assign(formScene, { ground: false, bg: '#000000', lightMarker: false, fillOn: false });
  formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape, finish, color: '#e8b89a', gloss: FORM_FINISHES[finish].gloss }];
  formScene.active = 0;
  formsRender(formScene, 320, 240, true);
  const c = document.createElement('canvas');
  c.width = 320; c.height = 240;
  const g = c.getContext('2d');
  g.drawImage(el('formsCanvas'), 0, 0);
  const d = g.getImageData(0, 0, 320, 240).data, counts = new Map();
  let form = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] + d[i + 1] + d[i + 2] < 12) continue; // the background
    form++;
    const k = (d[i] >> 2) << 16 | (d[i + 1] >> 2) << 8 | d[i + 2] >> 2;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const top = [...counts.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  return { form, share: top / form };
}, [finish, shape]);

test('the Anime finish shades in flat tones, matte in a gradient', async ({ page }) => {
  await openForms(page);
  const matte = await topThreeShare(page, 'matte');
  const anime = await topThreeShare(page, 'anime');
  expect(anime.form, 'the sphere is on screen').toBeGreaterThan(3000);
  expect(matte.share).toBeLessThan(0.5);
  // Light, shadow, highlight - and a thin line of blended pixels between.
  expect(anime.share).toBeGreaterThan(0.85);
});

// A flat face (the figure's feet are boxes) has no change of light across
// it, so an edge worked out from that change (fwidth) is zero wide - which
// must not turn it to speckle. Counted as changes of colour along each row
// of the feet: a clean foot has only its outline and its one shadow edge.
test('flat faces are clean, not speckled', async ({ page }) => {
  await openForms(page);
  await page.evaluate(() => {
    Object.assign(formScene, { ground: false, bg: '#000000', lightMarker: false, fillOn: false });
    formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'figure', finish: 'anime', color: '#e8b89a', gloss: 0 }];
    formScene.active = 0;
    formsChanged();
  });
  await page.waitForTimeout(500);
  const perRow = await page.evaluate(() => {
    const src = el('formsCanvas'), w = src.width, h = src.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const on = i => d[i] + d[i + 1] + d[i + 2] > 12;
    let bottom = 0, top = h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on((y * w + x) * 4)) { top = Math.min(top, y); bottom = y; }
    // The feet: the lowest 5% of the figure.
    const from = Math.round(bottom - (bottom - top) * 0.05);
    let changes = 0;
    for (let y = from; y <= bottom; y++) for (let x = 1; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.abs(d[i] - d[i - 4]) + Math.abs(d[i + 1] - d[i - 3]) + Math.abs(d[i + 2] - d[i - 2]) > 40) changes++;
    }
    return changes / (bottom - from + 1);
  });
  // Clean: about 8 (two feet, each an outline and a shadow edge); speckled: 15 and up.
  expect(perRow).toBeLessThan(12);
});

test('picking Anime renames Shine and points to the rim', async ({ page }) => {
  await openForms(page);
  const shine = page.locator('#formsPanel [data-k="gloss"]').locator('xpath=preceding-sibling::span');
  await expect(shine).toHaveText('Shine');
  await expect(page.locator('#formCelNote')).toBeHidden();
  await page.click('#formFinishes [data-finish="anime"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(shine).toHaveText('Highlight');
  await expect(page.locator('#formCelNote')).toBeVisible();
  // Anime cast shadows are hard: Softness has nothing to do meanwhile.
  await expect(page.locator('#formsPanel [data-k="softness"]')).toBeDisabled();
  // A reload keeps it: the finish is saved with the scene.
  await page.waitForTimeout(400);
  await page.reload();
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a cel shadow is its own colour, darker than the base', async ({ page }) => {
  await openForms(page);
  // Skin, hair, a school uniform's navy and red, a white shirt, leaf green.
  const colours = [[232, 184, 154], [250, 214, 120], [40, 50, 90], [200, 40, 50], [245, 245, 245], [90, 150, 70]];
  const out = await page.evaluate(cs => cs.map(c => ({ base: lstar(c), shade: lstar(celShadow(c)), rgb: celShadow(c) })), colours);
  for (const [i, o] of out.entries()) {
    const what = `base ${colours[i]} -> ${o.rgb}`;
    expect(o.shade, what).toBeLessThan(o.base - 5);
    for (const v of o.rgb) expect(Number.isInteger(v) && v >= 0 && v <= 255, what).toBe(true);
  }
});
