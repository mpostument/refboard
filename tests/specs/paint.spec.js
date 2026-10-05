// The paint mixing engine (js/paint.js) called directly in the page: the
// rules a recipe must keep, and mixes a painter knows to be right.
const { test, expect, openApp } = require('../helpers');

// Recipes for `rgb`, as plain data out of the page.
const recipes = (page, rgb, palette, medium) => page.evaluate(
  ([rgb, palette, medium]) => paintRecipes(rgb, palette, 4, medium)
    .map(r => ({ pigments: r.parts.map(p => p[0]), wash: r.wash, dE: r.dE, set: r.set })),
  [rgb, palette, medium]);

test('recipes keep their rules', async ({ page }) => {
  await openApp(page);
  const colours = [[224, 172, 140], [110, 160, 215], [70, 120, 60], [45, 35, 40], [240, 238, 230]];
  for (const rgb of colours) {
    for (const medium of ['water', 'opaque']) {
      const list = await recipes(page, rgb, 'full', medium);
      const what = `${medium} ${rgb}`;
      expect(list.length, what).toBeGreaterThanOrEqual(2);          // always a choice
      for (const r of list) expect(r.pigments.length, what).toBeLessThanOrEqual(3);
      const dEs = list.map(r => r.dE);
      expect(dEs, what).toEqual([...dEs].sort((a, b) => a - b));     // best first
      if (medium === 'water') {
        for (const r of list) expect(r.pigments, what).not.toContain('white');
      }
    }
  }
});

test('a palette only uses its own paints', async ({ page }) => {
  await openApp(page);
  const zorn = await page.evaluate(() => PAINT_PALETTES.zorn.keys);
  const list = await recipes(page, [110, 160, 215], 'zorn', 'opaque');
  for (const r of list) for (const k of r.pigments) expect(zorn).toContain(k);
});

/* Mixes a painter knows. Each: the colour, the palette (a key of
   PAINT_PALETTES: full, split, primary, zorn, earth), the medium, and
   pigments that must appear together in at least one recipe offered. Keys are
   those of PIGMENTS in js/paint.js: white, lemon, cadYellow, ochre,
   cadRed, alizarin, sienna, umber, ultramarine, phthaloBlue,
   phthaloGreen, violet, black. */
const KNOWN_MIXES = [
  { name: 'cool neutral dark', rgb: [60, 58, 66], palette: 'full', medium: 'water', uses: ['umber', 'ultramarine'] },
  // TODO(you): add mixes from your own watercolour practice - see below.
];

for (const m of KNOWN_MIXES) {
  test(`known mix: ${m.name}`, async ({ page }) => {
    await openApp(page);
    const list = await recipes(page, m.rgb, m.palette, m.medium);
    const found = list.some(r => m.uses.every(k => r.pigments.includes(k)));
    expect(found, `${m.uses.join(' + ')} among: ${list.map(r => r.set).join(' | ')}`).toBe(true);
  });
}

/* The search scores a few hundred thousand mixtures, so it skips
   spectral.js's Color for its own sums. These keep it honest: the OKLab is
   spectral.js's to the last bit, a wash built by multiplying is exp's to
   rounding, and the recipes are those the slower search gave - the fixture
   was written by the search as it was before (paint-recipes.json). */
test('the fast sums are spectral.js\'s', async ({ page }) => {
  await openApp(page);
  const out = await page.evaluate(() => {
    paintInit();
    let seed = 3, labOff = 0, washOff = 0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 200; n++) {
      const R = Array.from({ length: 38 }, () => rnd());
      const a = paintLab(R), b = new spectral.Color(R).OKLab;
      if (a.some((v, i) => v !== b[i])) labOff++;
      const abs = R.map(r => 4 * r), washes = paintWashesR(abs, 0, PAINT_WASH.length);
      PAINT_WASH.forEach((s, k) => abs.forEach((x, i) => {
        const want = paintData.paper[i] * Math.exp(-s * x);
        washOff = Math.max(washOff, Math.abs(washes[k][i] - want) / want);
      }));
    }
    return { labOff, washOff };
  });
  expect(out.labOff).toBe(0);
  expect(out.washOff).toBeLessThan(1e-12);
});

test('the recipes are the ones the slower search gave', async ({ page }) => {
  await openApp(page);
  const cases = require('./paint-recipes.json');
  const got = await page.evaluate(cases => cases.map(c => paintRecipes(c.rgb, c.palette, 4, c.medium)
    .map(r => `${r.parts.map(p => p.join(':')).join(' ')} | ${r.wash} | ${r.rgb}`)), cases);
  // Paints in equal parts may be listed either way round: the old search
  // took whichever of two routes to the mixture won by a rounding.
  const same = s => s.replace(/^[^|]+/, m => m.trim().split(' ').sort((a, b) =>
    b.split(':')[1] - a.split(':')[1] || a.localeCompare(b)).join(' ') + ' ');
  cases.forEach((c, i) => expect(got[i].map(same), `${c.palette} ${c.medium} ${c.rgb}`).toEqual(c.recipes.map(same)));
});
