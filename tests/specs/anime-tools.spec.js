// Anime study's Outfits, Proportions, Faces and Storyboard (js/animecheck.js, js/animetools.js).
const { openSection, test, expect, makePng, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('an outfit the colour of the hair is said to swallow it; one in the eyes\' hue ties to the face', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => acOutfits([107, 74, 47], [63, 127, 184], [
    { name: 'brown', palette: [{ rgb: [110, 78, 50], share: 70 }, { rgb: [240, 240, 240], share: 30 }] },
    { name: 'blue', palette: [{ rgb: [60, 125, 190], share: 15 }, { rgb: [235, 235, 235], share: 85 }] },
    { name: 'brown too', palette: [{ rgb: [112, 80, 52], share: 60 }, { rgb: [20, 20, 20], share: 40 }] },
  ]));
  expect(r.outfits[0].verdict).toBe('check');
  expect(r.outfits[0].notes.join(' ')).toContain("nearly the hair's colour");
  expect(r.outfits[1].notes.join(' ')).toContain("eyes' hue");
  expect(r.outfits[1].verdict).toBe('good');
  expect(r.pairs.join(' ')).toContain('brown and brown too');
});

test('proportions: heads tall, the nearest build, and a crotch that is off the mark', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({
    seven: acProportions({ crown: 0, chin: 100, shoulder: 130, crotch: 330, knee: 500, sole: 700 }, 'anime'),
    low: acProportions({ crown: 0, chin: 100, crotch: 450, sole: 700 }, 'anime'),
    none: acProportions({ crown: 0, chin: 100 }, 'anime'),
    backwards: acProportions({ crown: 100, chin: 50, sole: 700 }, 'anime'),
  }));
  expect(r.seven.heads).toBeCloseTo(7, 5);
  expect(r.seven.closest).toBe('anime');
  expect(r.seven.rows.every(x => x.word === 'on the mark')).toBe(true);
  expect(r.low.rows.find(x => x.key === 'crotch').word).toContain('lower than 7 heads');
  expect(r.low.text).toContain('7.0 heads tall');
  expect(r.none).toBeNull();
  expect(r.backwards).toBeNull();
});

test('the three face manners are drawn from their numbers and differ', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => ({ soft: acFaceSvg('soft'), sharp: acFaceSvg('sharp'), retro: acFaceSvg('retro'), notes: acFaceNotes('sharp') }));
  expect(new Set([r.soft, r.sharp, r.retro]).size).toBe(3);
  expect(r.soft.startsWith('<svg')).toBe(true);
  expect(r.notes.join(' ')).toContain('pointed');
});

test('a storyboard strip is an SVG with a frame for each; a jump of sizes and a repeat are said', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const f = (shot, angle = 'eye', gaze = 'right') => ({ shot, angle, gaze, text: 'She turns' });
    return { svg: acStripSvg([f('ls'), f('cu')]), jump: acStripNote([f('xls'), f('xcu')]), same: acStripNote([f('ms'), f('ms')]), calm: acStripNote([f('ls'), f('ms'), f('mcu')]) };
  });
  expect((r.svg.match(/<clipPath/g) || []).length).toBe(2);
  expect(r.jump).toContain('jumps');
  expect(r.same).toContain('same shot');
  expect(r.calm).toContain('without jumps');
});

test('the Anime study has the four modes; Faces shows three faces and Storyboard a strip you can edit', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=faces]').click();
  await expect(page.locator('#acFaces svg')).toHaveCount(3);
  await page.locator('#acFaces [data-manner=sharp]').click();
  await expect(page.locator('#acNote')).toContainText('pointed');
  await page.locator('#asMode [data-mode=storyboard]').click();
  await expect(page.locator('#asbStrip svg')).toHaveCount(1);
  await expect(page.locator('#asbEdit .asb-row')).toHaveCount(4);
  await page.locator('#asbSeq [data-seq=talk]').click();
  await page.locator('#asbEdit .asb-row').first().locator('select[data-k=shot]').selectOption('cu');
  await page.locator('#asbEdit .asb-row').first().locator('input[data-k=text]').fill('She looks up');
  await expect(page.locator('#asbStrip')).toContainText('She looks up');
  await page.locator('#asbAdd').click();
  await expect(page.locator('#asbEdit .asb-row')).toHaveCount(5);
});

test('outfits: pictures are read, and the hair and eye colours change the answer', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=outfits]').click();
  await page.locator('#aoInput').setInputFiles({ name: 'blue-dress.png', mimeType: 'image/png', buffer: makePng(64, 64, () => [60, 125, 190]) });
  await expect(page.locator('#aoList .ao-card')).toHaveCount(1);
  await page.locator('#aoEyes').fill('#3c7dbe');
  await expect(page.locator('#aoList')).toContainText("eyes' hue");
  await page.locator('#aoClear').click();
  await expect(page.locator('#aoList .ao-card')).toHaveCount(0);
});

test('proportions: clicking the marks on a drawing gives the height in heads', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=proportions]').click();
  await page.locator('#apInput').setInputFiles({ name: 'fig.png', mimeType: 'image/png', buffer: makePng(100, 350, () => [200, 200, 200]) });
  const cv = page.locator('#apCanvas');
  await expect(cv).toBeVisible();
  const box = await cv.boundingBox();
  const at = f => cv.click({ position: { x: box.width / 2, y: Math.min(box.height - 3, box.height * f) } });
  await at(0.0); await at(1 / 7); await page.locator('#apSkip').click(); await page.locator('#apSkip').click(); await page.locator('#apSkip').click(); await at(0.999);
  // The canvas has a 1px border, so the clicks land a pixel or two off: 6.8 to 7.0 is the seven heads that were drawn.
  await expect(page.locator('#apNote')).toContainText(/(6\.[89]|7\.0) heads tall/);
});
