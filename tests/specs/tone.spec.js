// Toned paper (js/tone.js): on grey, tan or black paper, which parts of a
// picture are left as the paper, which take the darks, which the white -
// worked out from the picture's values against the paper's; over it in a
// session, as a layer, with the paper chosen in the note.
const { test, expect, makePng, openApp } = require('../helpers');

const grey = v => [v, v, v];

test('the zones follow the paper: what matches it is left, darker and lighter are added', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    // Four vertical bands: near-black, the grey paper's own value, a light grey, white.
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    const g = c.getContext('2d');
    ['#101010', '#8f8f8f', '#d4d4d4', '#ffffff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 50, 0, 50, 100); });
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const p = stepsRead(img);
    const at = (m, x) => m.kind[50 * m.w + Math.round(x * m.w / 200)];
    const grey = toneMap(p, toneLOf(TONE_PAPERS.grey.hex)), black = toneMap(p, toneLOf(TONE_PAPERS.black.hex));
    return {
      L: Object.fromEntries(Object.entries(TONE_PAPERS).map(([k, v]) => [k, Math.round(toneLOf(v.hex))])),
      grey: [25, 75, 125, 175].map(x => at(grey, x)), black: [25, 75, 125, 175].map(x => at(black, x)),
      share: grey.share, text: toneVerdict(grey, { paper: 'grey' }), blackText: toneVerdict(black, { paper: 'black' }),
      best: toneBestPaper(grey.median),
    };
  });
  // The papers are ordered by value: black < grey < tan.
  expect(r.L.black).toBeLessThan(r.L.grey);
  expect(r.L.grey).toBeLessThan(r.L.tan);
  // On grey: the dark band is dark, the grey band is the paper, then light, then the brightest.
  expect(r.grey).toEqual([1, 0, 2, 3]);
  // On black nothing is darker than the paper: the black band is the paper, all the rest is light.
  expect(r.black[0]).toBe(0);
  expect(r.black.slice(1).every(k => k >= 2)).toBe(true);
  expect(r.share.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
  expect(r.text).toContain('leave it bare');
  expect(r.blackText).toContain('nothing to darken');
});

test('in a session: over the picture, the paper chosen in the note, a layer, a workspace row', async ({ page }) => {
  await openApp(page);
  const png = makePng(200, 200, (x, y) => x < 100 ? grey(20) : grey(143));
  await page.setInputFiles('#dropInput', { name: 'tone.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  const map = page.locator('#toneOverlay');
  await expect(map).toBeHidden();
  await page.keyboard.press('j');
  await expect(page.locator('#btnTone')).toHaveAttribute('aria-pressed', 'true');
  await expect(map).toBeVisible();
  await expect(page.locator('#poseNote')).toContainText("the paper's own tone");
  // Half of it matches the grey paper.
  await expect(page.locator('#poseNote')).toContainText(/50% is the paper's own tone/);
  // Laid over the picture's own box.
  const [a, b] = await Promise.all([map.boundingBox(), page.locator('#img').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(Math.abs(a.x - b.x)).toBeLessThan(2);
  // Another paper, from its chip: black paper leaves the black half, and the grey half is light.
  await page.click('#poseNote .chip[data-tone-paper="black"]');
  await expect(page.locator('#poseNote .chip[data-tone-paper="black"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#poseNote')).toContainText('nothing to darken');
  // The choice is kept.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(TONE_KEY)).paper)).toBe('black');
  // The medium says its own white.
  await page.evaluate(() => setMainMaterial('graphite'));
  await expect(page.locator('#poseNote')).toContainText('white pencil');
  // A layer like the others, and a row in the workspace's Value tab.
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="tone"]')).toBeVisible();
  await page.click('#btnWorkspace');
  await page.click('#wsTabs [data-tab="value"]');
  await expect(page.locator('#wsList .ws-tool', { hasText: 'Toned paper' })).toHaveAttribute('aria-pressed', 'true');
  // Off again from the key.
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  await expect(map).toBeHidden();
  await expect(page.locator('#poseNote')).toBeHidden();
});
