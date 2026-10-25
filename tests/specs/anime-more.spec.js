// Anime study's Inking, Folds, Layers and Angles, and the hair's Steps (js/animemore.js, js/animemoreui.js).
const { openSection, test, expect, makePng, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('inking: the outline against the paper and the side away from the light are heavier than the inside', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    // A dark disc on white, lit from the upper left: its edge goes from light to dark going lower right.
    const w = 120, h = 120, gray = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - 60, dy = y - 60, d = Math.hypot(dx, dy);
      gray[y * w + x] = d > 40 ? 255 : Math.round(150 + (dx + dy) * 1.1);
    }
    const res = amInkWeights(gray, w, h, [-0.62, -0.78]);
    const meanAt = (px, py) => { let s = 0, n = 0; for (let y = py - 6; y <= py + 6; y++) for (let x = px - 6; x <= px + 6; x++) { const q = res.weights[y * w + x]; if (q) { s += q; n++; } } return n ? s / n : 0; };
    return { ul: meanAt(60 - 28, 60 - 28), lr: meanAt(60 + 28, 60 + 28), paper: res.paper, counts: res.counts };
  });
  expect(r.lr).toBeGreaterThan(r.ul);
  expect(r.paper).toBeGreaterThan(0.4);
  expect(r.counts[3] + r.counts[2]).toBeGreaterThan(0);
});

test('inking: a plain picture has nothing to ink; a drawing gives a map and the pen table follows the pen', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=inking]').click();
  await expect(page.locator('#ainPens')).toContainText('0.1 - 0.2 mm');
  await page.locator('#ainPen [data-v=ballpoint]').click();
  await expect(page.locator('#ainPens')).toContainText('cannot change its width');
  await page.locator('#ainInput').setInputFiles({ name: 'ball.png', mimeType: 'image/png', buffer: makePng(120, 120, (x, y) => (Math.hypot(x - 60, y - 60) < 35 ? [60, 60, 70] : [250, 250, 250])) });
  await expect(page.locator('#ainPair')).toBeVisible();
  await expect(page.locator('#ainNote')).toContainText('should be heavy');
  await page.locator('#ainLight [data-v=ur]').click();
  await expect(page.locator('#ainLight [data-v=ur]')).toHaveAttribute('aria-pressed', 'true');
});

test('folds: six kinds, each a different picture; a place gives the kinds that form there', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    svgs: Object.keys(AM_FOLDS).map(k => amFoldSvg(k)),
    elbow: AM_FOLD_SPOTS.elbow.types, sheet: amFoldSheetSvg('sit'),
    every: Object.values(AM_FOLD_SPOTS).every(s => s.types.every(k => AM_FOLDS[k])),
  }));
  expect(new Set(r.svgs).size).toBe(6);
  expect(r.svgs.every(s => s.startsWith('<svg'))).toBe(true);
  expect(r.elbow).toContain('zigzag');
  expect((r.sheet.match(/<svg /g) || []).length).toBe(3);
  expect(r.every).toBe(true);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=folds]').click();
  await expect(page.locator('#aflStage svg').first()).toBeVisible();
  await page.locator('#aflSpot [data-v=sit]').click();
  await expect(page.locator('#aflNote')).toContainText('Diaper');
  await expect(page.locator('#aflNote')).toContainText('two to four fold lines');
});

test('layers: each material gives its own order; the background colour changes the reflected light', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const base = [241, 201, 165];
    const mat = m => amLayers({ material: m, part: 'skin', base, bg: null });
    return {
      water: mat('water').map(s => s.tone), copic: mat('copic').map(s => s.tone), pencil: mat('pencil').map(s => s.tone), ink: mat('ink').map(s => s.tone),
      plain: amLayers({ material: 'water', part: 'skin', base, bg: null }).find(s => s.tone === 'reflect'),
      blue: amLayers({ material: 'water', part: 'skin', base, bg: [40, 90, 200] }).find(s => s.tone === 'reflect'),
      copicText: mat('copic')[0].text, eyes: amLayers({ material: 'water', part: 'eyes', base: [63, 127, 184] }).map(s => s.text).join(' '),
    };
  });
  expect(r.water.slice(0, 3)).toEqual(['line', 'light', 'base']);
  expect(r.pencil).toContain('water');
  expect(r.ink).not.toContain('reflect');
  expect(r.copicText).toContain('Copic-safe');
  expect(r.blue.rgb[2]).toBeGreaterThan(r.plain.rgb[2]);
  expect(r.blue.text).toContain('background');
  expect(r.eyes).toContain('highlight');
  // a part's extra layer comes before the last one
  const last = await run(page, () => amLayers({ material: 'water', part: 'hair', base: [107, 74, 47] }).map(s => s.tone));
  expect(last.at(-2)).toBe('part');
  expect(last.at(-1)).toBe('reflect');
});

test('layers: the page lists the steps with swatches and a mix for each; markers and pencils name the nearest', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=layers]').click();
  await expect(page.locator('#alySteps li')).toHaveCount(7);
  await expect(page.locator('#alySteps .aly-mix').nth(1)).not.toBeEmpty();
  await page.locator('#alyMaterial [data-v=copic]').click();
  await expect(page.locator('#alySteps li').first()).toContainText('Copic-safe');
  await expect(page.locator('#alySteps .aly-mix').nth(1)).toContainText(/nearest of your markers|close/, { timeout: 20000 });
  await page.locator('#alyMaterial [data-v=pencil]').click();
  await expect(page.locator('#alySteps .aly-mix').nth(1)).toContainText(/\(light\)|\(firm\)/, { timeout: 20000 });
  await page.locator('#alyBgOn').check();
  await expect(page.locator('#alySteps')).toContainText('background');
  await page.locator('#alyMaterial [data-v=ink]').click();
  await expect(page.locator('#alyNote')).toContainText('nothing to mix');
});

test('angles: from above the eye line smiles, from below it frowns; the forehead grows from above', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({ up: amAngleFacts(40), down: amAngleFacts(-40), level: amAngleFacts(0), notes: amAngleNotes(-40), levelNotes: amAngleNotes(0),
    low: amAngleSvg({ pitch: -40, roll: 0, near: 0.5 }), high: amAngleSvg({ pitch: 40, roll: 10, near: 0.5 }), words: [amAngleWords(55), amAngleWords(-25), amAngleWords(0)] }));
  expect(r.up.bend).toBeGreaterThan(0);
  expect(r.down.bend).toBeLessThan(0);
  expect(r.level.bend).toBe(0);
  expect(r.up.forehead).toBeGreaterThan(0);
  expect(r.down.forehead).toBeLessThan(0);
  expect(r.up.jaw).toBeLessThan(0);
  expect(r.notes.join(' ')).toContain('frown');
  expect(r.levelNotes.join(' ')).toContain('Level');
  expect(r.low).not.toBe(r.high);
  expect(r.high).toContain('rotate(10');
  expect(r.words[0]).toContain('bird');
  expect(r.words[1]).toContain('low angle');
  expect(r.words[2]).toBe('');
});

test('angles: the page follows the camera chips and the sliders', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=angles]').click();
  await expect(page.locator('#aanStage svg')).toBeVisible();
  await page.locator('#aanKind [data-v=worm]').click();
  await expect(page.locator('#aanPitch')).toHaveValue('-55');
  await expect(page.locator('#aanNote')).toContainText('frown');
  await page.locator('#aanPitch').fill('0');
  await expect(page.locator('#aanNote')).toContainText('Level');
});

test('hair has Steps: six panels, from the bare head to the shaded hair', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const o = { style: 'long', wind: 'none', strength: 2, colour: '#6b4a2f' };
    return { steps: adHairStepsSvg(o), stages: AD_HAIR_STAGES.map(st => adHairSvg({ ...o, look: st, key: 'x' }).svg), full: adHairSvg({ ...o, look: 'colour', key: 'x' }).svg };
  });
  expect((r.steps.match(/<svg /g) || []).length).toBe(7);
  expect(new Set(r.stages).size).toBe(6);
  expect(r.stages[5]).toBe(r.full.replace(/x/g, 'x'));
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=hair]').click();
  await page.locator('#ahrLook [data-v=steps]').click();
  await expect(page.locator('#ahrStage svg svg')).toHaveCount(6);
  await expect(page.locator('#ahrNote')).toContainText('The mass');
});
