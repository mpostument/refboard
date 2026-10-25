// A photo as anime colouring (js/animecolour.js): each Simplify shape in a base, a shadow
// and a highlight, the shadow turned toward blue-violet, hard edges between the tones.
const { test, expect, openApp } = require('../helpers');

// A shaded red ball on a flat green ground: lit upper left, in shade lower right.
const BALL = `g.fillStyle = '#3a9a48'; g.fillRect(0, 0, w, h);
  const gr = g.createRadialGradient(220, 140, 10, 280, 200, 170);
  gr.addColorStop(0, '#f08070'); gr.addColorStop(0.45, '#c8302a'); gr.addColorStop(1, '#5a1010');
  g.fillStyle = gr; g.beginPath(); g.arc(280, 200, 150, 0, 7); g.fill();`;

const run = (page, draw) => page.evaluate(async src => {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  new Function('g', 'w', 'h', src)(c.getContext('2d'), 560, 400);
  const img = new Image(); img.src = c.toDataURL(); await img.decode();
  const f = simplifyOf(stepsRead(img), { n: 5, detail: 'medium', view: 'anime' });
  const out = document.createElement('canvas');
  simplifyDraw(f, out, { n: 5, detail: 'medium', view: 'anime' });
  const a = out.animeResult, ids = new Set();
  const d = out.getContext('2d').getImageData(0, 0, f.w, f.h).data;
  for (let i = 0; i < f.w * f.h; i++) ids.add(d[4 * i] << 16 | d[4 * i + 1] << 8 | d[4 * i + 2]);
  return { colours: ids.size, shapes: f.shapes.map(s => s.rgb), tones: a.tones, shaded: a.shaded, png: out.toDataURL() };
}, draw);

test('each shape gets a shadow that is darker and bluer than its base, and a highlight that is lighter; the picture has only those flat tones', async ({ page }) => {
  await openApp(page);
  const r = await run(page, BALL);
  expect(r.colours).toBeLessThanOrEqual(r.shapes.length * 3);
  const red = r.tones.find(t => t.base[0] > 150 && t.base[1] < 100);
  expect(red).toBeTruthy();
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  expect(lum(red.shadow)).toBeLessThan(lum(red.base));
  expect(lum(red.light)).toBeGreaterThan(lum(red.base));
  // Blue-violet: the shadow has more blue relative to red than its base has.
  expect(red.shadow[2] / (red.shadow[0] + 1)).toBeGreaterThan(red.base[2] / (red.base[0] + 1));
  // The shaded ball has real shadow and light.
  const ball = r.shaded[r.tones.indexOf(red)];
  expect(ball.shadow).toBeGreaterThan(300);
  expect(ball.light).toBeGreaterThan(100);
  require('fs').writeFileSync(process.env.ANIME_PNG || require('os').tmpdir() + '/anime-ball.png', Buffer.from(r.png.split(',')[1], 'base64'));
});

test('a flat shape stays one tone; a grey shape takes a blue-grey shadow', async ({ page }) => {
  await openApp(page);
  const r = await run(page, `g.fillStyle = '#3a9a48'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e8e8'; g.fillRect(100, 100, 200, 150);`);
  expect(r.shaded.every(s => s.shadow + s.light < (s.shadow + s.base + s.light) * 0.01)).toBe(true);
  const grey = r.tones.find(t => Math.abs(t.base[0] - t.base[2]) < 6 && t.base[0] > 200);
  expect(grey.shadow[2]).toBeGreaterThan(grey.shadow[0]);
});

test('Anime is a choice in the Simplify note and is remembered', async ({ page }) => {
  await openApp(page);
  const note = await page.evaluate(async () => {
    return simplifyNote({ w: 1, h: 1, labels: new Uint8Array(1), shapes: [{ rgb: [200, 40, 40], share: 100, L: 50 }], tone: new Float32Array([0.5]) }, { n: 5, detail: 'medium', view: 'anime' });
  });
  expect(note).toContain('data-simp-v="anime"');
  expect(note).toContain('blue-violet');
  await page.evaluate(() => { simplifySave({ n: 5, detail: 'medium', view: 'anime' }); });
  expect(await page.evaluate(() => simplifyLoad().view)).toBe('anime');
});
