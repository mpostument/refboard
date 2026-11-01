// Generate's Keep to the palette (js/genlock.js): the finished picture
// recoloured so every colour in it is one of a palette's.
const { test, expect, openApp } = require('../helpers');

test('a coloured pixel takes the nearest palette hue and keeps its lightness; grey stays', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // A teal and an orange; pixels: a red, a blue, a mid grey, white.
    const pal = [[0, 150, 160], [240, 140, 30]];
    const px = [[220, 60, 50], [40, 70, 200], [128, 128, 128], [255, 255, 255]];
    const data = new Uint8ClampedArray(px.flatMap(p => [...p, 255]));
    const before = px.map(p => rgbOklch(p));
    const changed = genLockPixels(data, pal);
    const after = px.map((_, i) => rgbOklch([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]));
    return { changed, before, after, grey: [...data.slice(8, 11)], white: [...data.slice(12, 15)],
      palH: pal.map(c => rgbOklch(c)[2]), none: genLockPixels(new Uint8ClampedArray([200, 50, 50, 255]), [[128, 128, 128]]) };
  });
  expect(r.changed).toBe(2);
  expect(r.grey).toEqual([128, 128, 128]);
  expect(r.white).toEqual([255, 255, 255]);
  const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  // Red -> the orange (index 1), blue -> the teal (index 0), and nothing else is left.
  expect(hueGap(r.after[0][2], r.palH[1])).toBeLessThan(6);
  expect(hueGap(r.after[1][2], r.palH[0])).toBeLessThan(6);
  // The shading stays near the picture's own (a pull of 20% toward the palette's tone).
  for (const i of [0, 1]) expect(Math.abs(r.after[i][0] - r.before[i][0])).toBeLessThan(0.15);
  // An all-grey palette has nothing to give: -1, nothing changed.
  expect(r.none).toBe(-1);
});

test('the Lock row appears only with a palette or the Holbein box, and the box has 28 tubes', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const ch = c => ({ ...GEN_DEFAULTS, ...c });
    const lock = GEN_CHOICES.find(c => c.id === 'lock');
    return {
      any: genApplies(lock, ch({ colours: 'any' })),
      box: genApplies(lock, ch({ colours: 'box' })),
      pal: genApplies(lock, ch({ colours: 'palette' })),
      ink: genApplies(lock, ch({ colours: 'box', medium: 'ink' })),
      tubes: genBoxRgbs().length,
      prompt: genPrompt(ch({ colours: 'box', lock: 'on' })).tags,
      locked: genLockPalette(ch({ colours: 'box' })).length, none: genLockPalette(ch({ colours: 'any' })).length };
  });
  expect(r).toMatchObject({ any: false, box: true, pal: true, ink: false, tubes: 28, locked: 28, none: 0 });
  expect(r.prompt).toContain('holbein box');
  expect(r.prompt).toContain('palette locked');
});
