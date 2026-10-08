// Pencil grade map (js/grades.js): the picture split into the grades of
// graphite pencil, 2H to 8B, each area with its grade; the splitting itself is
// the grey markers' (markersOf). In a session, a layer with the pencil case
// chosen in the note - and never together with the grey markers.
const { test, expect, makePng, openApp } = require('../helpers');

const grey = v => [v, v, v];
// Five vertical bands, 60 px each, white to near-black.
const BANDS = [250, 190, 130, 70, 15];
const bands = (v = BANDS) => makePng(300, 120, x => grey(v[Math.floor(x / 60)]));
const url = buf => 'data:image/png;base64,' + buf.toString('base64');

test('the ladder: lightest first, 2H to 8B, ending where the graphite medium does; every case a part of it', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ({
    codes: GRADES.map(g => g.code), ls: GRADES.map(g => g.L), floor: MATERIALS.graphite.floor,
    sets: Object.fromEntries(Object.keys(GRADE_SETS).map(k => [k, gradePicks(k).map(g => g.code)])),
    declared: Object.fromEntries(Object.entries(GRADE_SETS).map(([k, s]) => [k, s.codes])),
  }));
  expect(r.codes[0]).toBe('2H');
  expect(r.codes[r.codes.length - 1]).toBe('8B');
  expect([...r.ls].sort((a, b) => b - a)).toEqual(r.ls);
  expect(new Set(r.ls).size).toBe(r.ls.length);
  // One darkest for graphite in the app, not two.
  expect(r.ls[r.ls.length - 1]).toBe(r.floor);
  // A case gives its grades back lightest first, and as many as it names.
  for (const [k, codes] of Object.entries(r.declared)) {
    expect(r.sets[k]).toHaveLength(codes.length);
    expect(r.sets[k].every(c => codes.includes(c))).toBe(true);
    expect(r.sets[k].map(c => r.codes.indexOf(c))).toEqual([...r.sets[k].map(c => r.codes.indexOf(c))].sort((a, b) => a - b));
  }
});

test('a picture in five bands: paper stays white, each band takes a grade, never a lighter one as it darkens', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const m = gradesOf(stepsRead(img), { set: 'all' });
    const at = x => m.area[(m.h >> 1) * m.w + Math.round(x * m.w / 300)];
    return { bands: [30, 90, 150, 210, 270].map(at), picks: m.picks.map(k => k.code), spots: m.spots.map(s => m.picks[s.i].code),
      note: gradesNote(m, { set: 'all' }) };
  }, url(bands()));
  expect(r.picks).toHaveLength(12);
  expect(r.bands[0]).toBe(-1);                               // white: the paper
  for (let i = 1; i < 5; i++) expect(r.bands[i]).toBeGreaterThanOrEqual(r.bands[i - 1]);
  expect(r.picks[r.bands[4]]).toBe('8B');                    // near-black: the softest
  expect(r.picks[r.bands[1]]).not.toBe('8B');                // a light grey is not
  expect(r.spots).toContain('8B');
  expect(r.note).toContain('left white');
  // Darker than graphite goes: said, once the darks are darker than 8B.
  expect(r.note).toContain('Darker than graphite goes');
});

test('a picture with no deep darks gets no warning, and a smaller case uses only its own pencils', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async src => {
    const img = new Image(); img.src = src; await img.decode();
    const m = gradesOf(stepsRead(img), { set: 'three' });
    return { picks: m.picks.map(k => k.code), used: [...new Set(Array.from(m.area).filter(v => v >= 0))].map(i => m.picks[i].code),
      note: gradesNote(m, { set: 'three' }) };
  }, url(bands([250, 215, 185, 160, 140])));
  expect(r.picks).toEqual(['HB', '3B', '6B']);
  expect(r.used.every(c => r.picks.includes(c))).toBe(true);
  expect(r.note).not.toContain('Darker than graphite goes');
});

test('in a session: a layer and a workspace row; the note changes the case and keeps it; markers and grades are never both on', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'bands.png', mimeType: 'image/png', buffer: bands() });
  await expect(page.locator('#session')).toBeVisible();
  // Grey markers first, then the pencils: the pencils take their place.
  await page.evaluate(() => toggleMarkers());
  await expect(page.locator('#btnMarkers')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#wsTabs [data-tab="value"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Pencil grades' }).click();
  await expect(page.locator('#btnGrades')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#btnMarkers')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#markerOverlay')).toBeHidden();
  await expect(page.locator('#gradeOverlay')).toBeVisible();
  await page.click('#wsClose');
  const part = page.locator('#poseNote [data-note="grades"]');
  await expect(part).toContainText('hardest grade to the softest');
  await expect(part.locator('.mk-row')).toHaveCount(7);        // the six and the paper
  await part.locator('[data-gr-set="three"]').click();
  await expect(part.locator('.mk-row')).toHaveCount(4);
  await part.locator('[data-gr-set="all"]').click();
  await expect(part.locator('.mk-row')).toHaveCount(13);       // all twelve and the paper
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(GRADE_KEY)))).toEqual({ set: 'all' });
  // And back: the markers push the pencils off.
  await page.evaluate(() => toggleMarkers());
  await expect(page.locator('#btnGrades')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#poseNote [data-note="grades"]')).toHaveCount(0);

  await page.evaluate(() => toggleGrades());
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="grades"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#poseNote [data-note="grades"] .note-off').click();
  await expect(page.locator('#gradeOverlay')).toBeHidden();
});
