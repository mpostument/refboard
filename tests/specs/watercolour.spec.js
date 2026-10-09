// Preview as watercolour (js/watercolour.js): the picture as washes - flat
// areas, a darker rim along hard edges, grain, the whites left as paper -
// as a layer, with Detail, Grain and Colours chosen in the note.
const { test, expect, makePng, openApp } = require('../helpers');

const url = buf => 'data:image/png;base64,' + buf.toString('base64');
// Left: a deep blue, with a little noise. Right: white paper. The edge is hard.
const BLUE = [40, 60, 140];
const noisy = (x, y) => { const n = ((x * 7 + y * 13) % 11) - 5; return BLUE.map(v => v + n); };
const sheet = () => makePng(240, 160, (x, y) => x < 120 ? noisy(x, y) : [255, 255, 255]);
// A pale peach (skin) beside a mid green: neither is paper, nor is the green a palette's colour.
const tints = () => makePng(240, 160, x => x < 120 ? [255, 232, 220] : [60, 190, 60]);

// A picture rendered, with the pixels at the places asked for.
const render = (page, src, c, at = []) => page.evaluate(async ([src, c, at]) => {
  const img = new Image(); img.src = src; await img.decode();
  const p = stepsRead(img), m = wcRender(p, edgeMap(p), c);
  const px = ([x, y]) => Array.from(m.rgba.slice(4 * (y * m.w + x), 4 * (y * m.w + x) + 3));
  return { w: m.w, h: m.h, white: m.white, moved: m.moved, hard: m.hard, soft: m.soft, at: at.map(px) };
}, [src, c, at]);
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const BASE = { detail: 'medium', grain: 'light', mine: false };

test('the filter flattens noise inside a shape and keeps the edge where it was', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const w = 80, h = 40, ch = [0, 1, 2].map(k => Float32Array.from({ length: w * h }, (_, i) => {
      const x = i % w, y = (i / w) | 0, noise = ((x * 7 + y * 13) % 11) - 5;
      return (x < 40 ? [40, 60, 140][k] : 250) + noise * 3;
    }));
    const out = wcKuwahara(ch, w, h, 5), spread = (x0, x1) => {
      let lo = Infinity, hi = -Infinity;
      for (let y = 8; y < 32; y++) for (let x = x0; x < x1; x++) { const v = out[0][y * w + x]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
      return hi - lo;
    };
    return { before: 30, left: spread(8, 32), right: spread(48, 72), edgeL: out[0][20 * w + 38], edgeR: out[0][20 * w + 41] };
  });
  // The input swings +-15 in each half; the output barely moves.
  expect(r.left).toBeLessThan(6); expect(r.right).toBeLessThan(6);
  // Two pixels either side of the edge are still the two sides' own colours.
  expect(r.edgeL).toBeLessThan(80); expect(r.edgeR).toBeGreaterThan(200);
});

test('paper stays paper, a wash is paler than the photo and never black, and a pale tint is not paper', async ({ page }) => {
  await openApp(page);
  // The wash is judged on 40 places, not one: its grain varies from spot to spot.
  const inside = []; for (let i = 0; i < 40; i++) inside.push([10 + 2 * i, 40 + (i * 7) % 80]);
  const r = await render(page, url(sheet()), BASE, [[200, 80], [100, 80], ...inside]);
  // Half the picture is white: about half is left as paper.
  expect(r.white).toBeGreaterThan(40); expect(r.white).toBeLessThan(60);
  const [paper, nearEdge, ...washes] = r.at;
  const blue = [0, 1, 2].map(k => washes.reduce((a, p) => a + p[k], 0) / washes.length);
  expect(Math.min(...paper)).toBeGreaterThan(215);                   // the paper's own cream, with its tooth
  expect(lum(blue)).toBeGreaterThan(lum(BLUE) + 5);                  // paler than the photo's own blue
  expect(lum(blue)).toBeGreaterThan(18);                              // and not black
  expect(blue[2]).toBeGreaterThan(blue[0] + 30);                      // still a blue
  // The pooled rim: on the dark side, at the edge, darker than well inside.
  expect(lum(nearEdge)).toBeLessThan(lum(blue) - 2);
  const t = await render(page, url(tints()), BASE, [[40, 80]]);
  expect(t.white).toBeLessThan(5);                                    // peach is a pale wash, not bare paper
  expect(t.at[0][2]).toBeLessThan(t.at[0][0] - 3);                    // warmer than the paper (blue below red)
});

test('grain: a granulating pigment varies inside one wash, a smooth one does not, and it is the same each time', async ({ page }) => {
  await openApp(page);
  const spread = async grain => {
    const pts = []; for (let i = 0; i < 40; i++) pts.push([10 + i, 60 + (i * 7) % 40]);
    const r = await render(page, url(sheet()), { ...BASE, grain }, pts);
    const v = r.at.map(lum), mean = v.reduce((a, b) => a + b, 0) / v.length;
    return { sd: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length), at: r.at };
  };
  const smooth = await spread('smooth'), strong = await spread('strong'), again = await spread('strong');
  expect(strong.sd).toBeGreaterThan(smooth.sd * 1.5);
  expect(strong.at).toEqual(again.at);
});

test('within my paints: colours the palette cannot mix are pulled in, the others are left', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => setPaintPaletteKey('zorn'));
  const off = await render(page, url(tints()), BASE, [[200, 80]]);
  const on = await render(page, url(tints()), { ...BASE, mine: true }, [[200, 80]]);
  expect(off.moved).toBeNull();
  expect(on.moved).toBeGreaterThan(0.3);                              // the bright green is out of Zorn's reach
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  expect(chroma(on.at[0])).toBeLessThan(chroma(off.at[0]) - 20);
  await page.evaluate(() => setPaintPaletteKey('full'));
});

test('in a session: a layer and a Colour row; Detail, Grain and Colours kept; how to paint it opens the steps', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'sheet.png', mimeType: 'image/png', buffer: sheet() });
  await expect(page.locator('#session')).toBeVisible();
  await page.locator('#wsTabs [data-tab="colour"]').click();
  await page.locator('#wsList .ws-tool', { hasText: 'Watercolour preview' }).click();
  await expect(page.locator('#btnWatercolour')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#watercolourOverlay')).toBeVisible();
  await page.click('#wsClose');
  const note = page.locator('#poseNote [data-note="watercolour"]');
  await expect(note).toContainText('left as bare paper');
  await expect(note.locator('[data-wc="detail:medium"]')).toHaveAttribute('aria-pressed', 'true');
  await note.locator('[data-wc="detail:loose"]').click();
  await expect(note.locator('[data-wc="detail:loose"]')).toHaveAttribute('aria-pressed', 'true');
  await note.locator('[data-wc="grain:strong"]').click();
  await note.locator('[data-wc="mine:on"]').click();
  await expect(note.locator('[data-wc="mine:on"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(WC_KEY)))).toEqual({ detail: 'loose', grain: 'strong', mine: true });
  // A layer of its own, with the others.
  await page.click('#btnLayers');
  await expect(page.locator('#layersList [data-layer="watercolour"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await note.locator('[data-wc-steps]').click();
  await expect(page.locator('#stepsSheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('#poseNote [data-note="watercolour"] .note-off').click();
  await expect(page.locator('#watercolourOverlay')).toBeHidden();
});
