// Anime study (js/animeframes.js, js/animebg.js, js/animestudy.js): the shadow scheme, the
// palette and the colour script read off frames; and a background with its palette.
const { openSection, test, expect, makePng, openApp } = require('../helpers');

// Reads a frame drawn from the source of a drawing and gives back what the tests ask of it.
const frame = (page, draw) => page.evaluate(async src => {
  await loadSection('anime');
  const c = document.createElement('canvas'); c.width = 320; c.height = 200;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 320, 200);
  return afFrame(stepsRead(c));
}, draw);

// A cel frame: a sky-coloured wall, a girl in orange with her shadow side a darker, violet-turned orange.
const CEL = `g.fillStyle = '#9ec4e6'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8883c'; g.fillRect(100, 40, 120, 140);
  g.fillStyle = '#c0605a'; g.fillRect(170, 40, 50, 140);`;

test('a cel frame is flat, and its shadow is found darker and turned toward blue-violet', async ({ page }) => {
  await openApp(page);
  const f = await frame(page, CEL);
  expect(f.flat).toBeGreaterThan(0.85);
  const sc = await page.evaluate(f => afScheme([f]), f);
  expect(sc.flatWord).toBe('flat cel');
  expect(sc.shadow).toBeTruthy();
  expect(sc.shadow.dL).toBeGreaterThan(0.08);
  expect(sc.shadow.turn).toBeGreaterThan(8);
  const text = await page.evaluate(s => afSchemeText(s), sc);
  expect(text).toContain('toward blue-violet');
  expect(text).toContain('flat cel');
});

test('a gradient frame is not flat; a flat grey one has no shadow', async ({ page }) => {
  await openApp(page);
  const grad = await frame(page, `const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#203060'); gr.addColorStop(1, '#f0b080'); g.fillStyle = gr; g.fillRect(0, 0, w, h);`);
  expect(grad.flat).toBeLessThan(0.7);
  const plain = await frame(page, `g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);`);
  expect(plain.shadows.length).toBe(0);
  expect(await page.evaluate(f => afSchemeText(afScheme([f])), plain)).toContain('No shadow tone found');
});

test('the colour script names the darkest, the lightest and the biggest change of colour', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('anime');
    const fr = (rgb) => { const c = document.createElement('canvas'); c.width = 80; c.height = 50; const g = c.getContext('2d'); g.fillStyle = rgb; g.fillRect(0, 0, 80, 50); return afFrame(stepsRead(c)); };
    // Dark, dark, dark, a hard cut to light and warm, light.
    const frames = ['#202838', '#222a3a', '#242c3c', '#f0c890', '#f2cc94'].map(fr);
    return { script: afScript(frames), text: afScriptText(afScript(frames)), canvas: afScriptCanvas(frames).width, merged: afMerged(frames, 8).length };
  });
  expect(r.script.darkest).toBe(0);
  expect(r.script.lightest).toBe(4);
  expect(r.script.cuts[0].at).toBe(3);
  expect(r.text).toContain('between frame 3 and frame 4');
  expect(r.canvas).toBe(720);
  expect(r.merged).toBe(2);
});

test('frames dropped on the section are studied in the order given, with a note and a colour script', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await expect(page.locator('#viewAnime')).toBeVisible();
  await expect(page.locator('#afCount [data-n]')).toHaveCount(3);      // the section has loaded
  const tone = (a, b) => makePng(120, 80, (x, y) => x < 60 ? a : b);
  await page.setInputFiles('#afInput', [
    { name: 'a.png', mimeType: 'image/png', buffer: tone([32, 40, 56], [60, 70, 100]) },
    { name: 'b.png', mimeType: 'image/png', buffer: tone([240, 200, 140], [250, 235, 200]) },
  ]);
  await expect(page.locator('#afThumbs .af-frame')).toHaveCount(2);
  await expect(page.locator('#afNote')).toContainText('Darkest frame 1, lightest frame 2');
  await expect(page.locator('#afScript')).toBeVisible();
});

test('a background has nine colours, the luminous manner stronger than the soft, and recipes for each', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('anime');
    const chroma = rgb => { const [, a, b] = compositionOklab(...rgb); return Math.hypot(a, b); };
    const hue = rgb => { const [, a, b] = compositionOklab(...rgb); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
    const soft = abPalette('soft', 'day'), lum = abPalette('luminous', 'day'), night = abPalette('luminous', 'night');
    const get = (p, role) => p.find(q => q.role === role).rgb;
    const c = document.createElement('canvas'); abDraw(c, soft, 'day', 3);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0; for (let i = 0; i < d.length; i += 97) sum = (sum * 31 + d[i]) | 0;
    const c2 = document.createElement('canvas'); abDraw(c2, soft, 'day', 4);
    const d2 = c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data;
    let sum2 = 0; for (let i = 0; i < d2.length; i += 97) sum2 = (sum2 * 31 + d2[i]) | 0;
    return { n: soft.length, softSky: chroma(get(soft, 'sky')), lumSky: chroma(get(lum, 'sky')),
      lumShadeHue: hue(get(lum, 'shade')), softShadeHue: hue(get(soft, 'shade')), skyL: compositionOklab(...get(lum, 'sky'))[0], nightL: compositionOklab(...get(night, 'sky'))[0],
      sum, sum2, size: [c.width, c.height] };
  });
  expect(r.n).toBe(9);
  expect(r.lumSky).toBeGreaterThan(r.softSky);
  // The luminous shade is turned further toward blue-violet (hue 285).
  expect(Math.abs(r.lumShadeHue - 285)).toBeLessThan(Math.abs(r.softShadeHue - 285));
  expect(r.nightL).toBeLessThan(r.skyL);
  expect(r.sum).not.toBe(r.sum2);
  expect(r.size).toEqual([960, 540]);
});

test('the Backgrounds half shows the palette with recipes, the manner and hour are kept, and the colours go to Palettes', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await expect(page.locator('#afCount [data-n]')).toHaveCount(3);
  await page.click('#asMode [data-mode="background"]');
  await expect(page.locator('#abColours .ab-colour')).toHaveCount(9);
  await expect(page.locator('#abColours .ab-colour .mix-row').first()).toBeVisible({ timeout: 15000 });
  await page.click('#abManner [data-manner="luminous"]');
  await page.click('#abHour [data-hour="dusk"]');
  expect(await page.evaluate(() => abLoad())).toMatchObject({ manner: 'luminous', hour: 'dusk' });
  await page.click('#abPalette');
  await expect(page.locator('#viewPalette')).toBeVisible();
  await expect(page.locator('#viewPalette .pg-sw').first()).toBeVisible();
});

test('Anime study is a tab with Colour studio and Palettes, and Ctrl+K finds it', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#viewTabs [data-view="anime"]')).toHaveText('Anime study');
  await page.keyboard.press('Control+k');
  await page.fill('#cmdkInput', 'shinkai');
  await expect(page.locator('#cmdkList')).toContainText('Anime study');
});
