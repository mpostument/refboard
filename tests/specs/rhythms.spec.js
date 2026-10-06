// Reilly rhythms (js/rhythms.js): the long curves through a figure from the
// pose model's points; in a session as a layer. The model itself is not
// loaded in these tests - it comes from a CDN - so its answer is made up.
const { test, expect, makePng, openApp } = require('../helpers');

// A standing figure, in a 400 x 600 picture: points by name, in pixels.
const FIGURE = {
  nose: [200, 60], lEar: [185, 62], rEar: [215, 62],
  lSh: [160, 130], rSh: [240, 130], lEl: [140, 200], rEl: [270, 190], lWr: [135, 270], rWr: [300, 240],
  lHip: [175, 290], rHip: [225, 290], lKn: [170, 400], rKn: [235, 395], lAn: [160, 520], rAn: [250, 515],
};

test('a standing figure gets its five rhythms; each crosses to the opposite side, and says how much it bends', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(P => {
    const rs = rhythmsOf(P);
    // Standing square, every rhythm is nearly a straight line - said so. A figure with the weight
    // thrown onto one leg swings.
    const swung = { ...P, rHip: [250, 290], rKn: [300, 395], rAn: [215, 515], lKn: [150, 400] };
    return { ids: rs.map(x => x.id), bend: Object.fromEntries(rs.map(x => [x.id, x.bend])),
      diagL: rs.find(x => x.id === 'diagL').pts, stiff: rhythmsVerdict(rs), say: rhythmsVerdict(rhythmsOf(swung)), svg: rhythmsSvg(rs, 400) };
  }, FIGURE);
  expect(r.ids).toEqual(['diagL', 'diagR', 'spine', 'armL', 'armR']);
  // The left shoulder to the right foot: it starts at one and ends at the other side.
  expect(r.diagL[0]).toEqual(FIGURE.lSh);
  expect(r.diagL[r.diagL.length - 1]).toEqual(FIGURE.rAn);
  // Through the middle of the torso, between the shoulders and the hips.
  expect(r.diagL[1]).toEqual([200, 210]);
  for (const b of Object.values(r.bend)) expect(b).toBeGreaterThanOrEqual(1);
  expect(r.stiff).toContain('Nearly straight');
  expect(r.say).toContain('Cyan');
  expect(r.say).toContain('Most swing');
  expect(r.svg).toContain('class="r-a"');
});

test('a straight line is called stiff, and a rhythm that lost an end is left out', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(P => {
    // Arms made straight, and no left ankle: the right-shoulder diagonal ends there.
    const straight = { ...P, lEl: [150, 200], lWr: [140, 270], lAn: null };
    straight.lSh = [160, 130];
    const arm = { ...P, lSh: [160, 130], lEl: [160, 200], lWr: [160, 270] };
    const rs = rhythmsOf(straight), ar = rhythmsOf(arm);
    return { ids: rs.map(x => x.id), say: rhythmsVerdict(ar), none: rhythmsOf({ lSh: [1, 1] }).length, noneSay: rhythmsVerdict([]) };
  }, FIGURE);
  expect(r.ids).not.toContain('diagR');
  expect(r.ids).toContain('diagL');
  expect(r.say).toContain('Nearly straight');
  expect(r.say).toContain('left arm');
  expect(r.none).toBe(0);
  expect(r.noneSay).toContain('No rhythms');
});

test('in a session: z draws them over the picture, a layer and a workspace row, the note x turns it off', async ({ page }) => {
  await openApp(page);
  const png = makePng(400, 600, () => [220, 220, 220]);
  await page.setInputFiles('#dropInput', { name: 'figure.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  // The pose model is not fetched: it answers with the figure above, normalised.
  await page.evaluate(P => {
    const idx = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28 };
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    for (const [k, i] of Object.entries(idx)) lm[i] = { x: P[k][0] / 400, y: P[k][1] / 600, visibility: 1 };
    window.loadVision = async () => ({ detect: () => ({ landmarks: [lm] }) });
  }, FIGURE);
  await page.keyboard.press('z');
  await expect(page.locator('#btnRhythms')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rhythmOverlay')).toBeVisible();
  await expect(page.locator('#rhythmOverlay path.r-a')).toHaveCount(1);
  await expect(page.locator('#rhythmOverlay path.r-c')).toHaveCount(2);
  const part = page.locator('#poseNote [data-note="rhythms"]');
  await expect(part).toContainText('cross the chest');

  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="rhythms"]')).toBeVisible();
  await page.click('#btnWorkspace');
  await page.locator('#wsTabs [data-tab="figure"]').click();
  await expect(page.locator('#wsList .ws-tool', { hasText: 'Reilly rhythms' })).toHaveAttribute('aria-pressed', 'true');
  await page.click('#wsClose');

  await part.locator('.note-off').click();
  await expect(page.locator('#btnRhythms')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#rhythmOverlay')).toBeHidden();
});
