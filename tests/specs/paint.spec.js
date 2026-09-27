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
