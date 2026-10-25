// More ways to make in Generate (js/genmore.js): a series with one seed, a movement in words,
// colours pulled to a palette, and four lights from a photo. The server is played by page.route.
const { test, expect, openApp, fakeServer, makePng } = require('../helpers');

async function setup(page) {
  const server = await fakeServer(page);
  const asked = [], id = 'b'.repeat(64);
  const doc = { file: id + '.png', name: 'girl, red hair', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(),
    folder: 'generated', tags: ['anime', 'girl', 'red hair'], prompt: '1girl, solo, red hair', avoid: 'sepia', shape: 'portrait', seed: 77 };
  server.items.set('uploads/' + id, doc);
  await page.route('**/api/generate**', async r => {
    const req = r.request();
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } });
    const made = { ...doc, tags: asked.at(-1).tags, t: Date.now() };
    server.items.set('uploads/' + 'c'.repeat(64), { ...made, file: 'c'.repeat(64) + '.png' });
    return r.fulfill({ json: { state: 'done', upload: { doc: made, url: 'uploads/Generated/x.png' } } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(1);
  return { asked, server };
}

test('a series: one seed for every view, the views weighted, the framing of the choices gone', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gmSeriesBlock summary').click();
  await expect(page.locator('#gmViews [data-view]')).toHaveCount(6);
  await page.locator('#gmViews [data-view=below]').click();
  await page.locator('#gmSeries').click();
  await expect(page.locator('#genStatus')).toContainText('4 views of one scene');
  expect(asked).toHaveLength(4);
  expect(new Set(asked.map(a => a.seed)).size).toBe(1);
  expect(asked[0].seed).toBeGreaterThan(0);
  expect(asked[0].prompt).toContain('(wide shot, full scene:1.3)'.replace('wide shot, full scene', 'wide shot'));
  expect(asked[1].prompt).toContain('(close-up:1.3)');
  expect(asked.every(a => !a.prompt.includes('full body') && a.tags.includes('series'))).toBe(true);
  expect(new Set(asked.map(a => a.prompt)).size).toBe(4);
});

test('a series needs two views', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gmSeriesBlock summary').click();
  for (const v of ['wide', 'close']) await page.locator(`#gmViews [data-view=${v}]`).click();
  await page.locator('#gmSeries').click();
  await expect(page.locator('#genStatus')).toHaveText('Choose at least two views.');
  expect(asked).toHaveLength(0);
});

test('a movement in Ukrainian or English becomes tags in More tags, kept as they are typed', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => { await loadSection('genmore'); return { a: genMoveTags('біжить, озирається'), b: genMoveTags('jumping and waving'), c: genMoveTags('щось дивне') }; });
  expect(r.a.tags).toEqual(expect.arrayContaining(['running', 'looking back', 'over shoulder']));
  expect(r.b.tags).toEqual(expect.arrayContaining(['jumping', 'waving']));
  expect(r.c.tags).toHaveLength(0);
  expect(r.c.unknown).toEqual(['щось дивне']);
  await page.locator('#genMore summary').click();
  await page.locator('#gmMoveBlock summary').click();
  await page.fill('#genExtra', 'hat');
  await page.fill('#genMoveText', 'біжить');
  await page.click('#gmMove');
  await expect(page.locator('#genExtra')).toHaveValue(/^hat, running/);
  await expect(page.locator('#genStatus')).toContainText('Added to More tags');
});

test('Colours to a palette: the picture and the pulled one, what moved, and a new picture kept', async ({ page }) => {
  const { server } = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-pull').first().click();
  await expect(page.locator('#pullSheet')).toBeVisible();
  await expect(page.locator('#pullSource [data-source=box]')).toHaveAttribute('aria-pressed', 'true');
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 40;
    const g = c.getContext('2d'); g.fillStyle = '#d83030'; g.fillRect(0, 0, 40, 40);
    const out = genPullCanvas(c, [[40, 90, 200]], 1);
    const px = out.getContext('2d').getImageData(5, 5, 1, 1).data;
    return { px: [...px], changes: genPullChanges(c, out), none: genPullCanvas(c, [[128, 128, 128]], 1) };
  });
  expect(r.px[2]).toBeGreaterThan(r.px[0]);         // red became blue
  expect(r.changes[0].share).toBeCloseTo(100, 0);
  expect(r.none).toBeNull();
  await page.locator('#pullAmount [data-amount="0.35"]').click();
  await expect(page.locator('#pullAmount [data-amount="0.35"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pullSource [data-source=palette]').click();
  await expect(page.locator('#pullNote')).toContainText('no palette yet');
  await expect(page.locator('#pullKeep')).toBeDisabled();
  await page.locator('#pullSource [data-source=box]').click();
  await expect(page.locator('#pullKeep')).toBeEnabled();
  const before = server.items.size;
  await page.locator('#pullKeep').click();
  await expect(page.locator('#pullNote')).toContainText('Kept in Made here');
  expect(server.items.size).toBeGreaterThan(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pullSheet')).toBeHidden();
});

test('Four lights from a photo: four requests from the photo, each with its own light', async ({ page }) => {
  const { asked } = await setup(page);
  await expect(page.locator('#genSourceLights')).toHaveCount(0);
  await page.locator('#genPickInput').setInputFiles({ name: 'cup.png', mimeType: 'image/png', buffer: makePng(64, 64, () => [200, 160, 120]) });
  await expect(page.locator('#genSourceLights')).toBeVisible();
  await page.locator('#genSourceLights').click();
  await expect(page.locator('#genStatus')).toHaveText('Four lights from the photo - in Uploads, Generated.');
  expect(asked).toHaveLength(4);
  expect(asked.every(a => a.image && a.image.length > 100 && a.denoise >= 0.55)).toBe(true);
  expect(asked[0].prompt).toContain('(soft lighting:1.3)');
  expect(asked[2].prompt).toContain('(backlighting:1.3)');
  expect(asked[3].tags).toContain('low key');
});

test('composition sketches: small drafts with one seed, each its own composition, kept as drafts', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gmCompBlock summary').click();
  await expect(page.locator('#gmComps [data-comp]')).toHaveCount(6);
  await page.locator('#gmCompGo').click();
  await expect(page.locator('#genStatus')).toContainText('6 composition sketches');
  expect(asked).toHaveLength(6);
  expect(new Set(asked.map(a => a.seed)).size).toBe(1);
  expect(asked.every(a => a.width % 64 === 0 && a.height % 64 === 0 && a.width * a.height < 700_000 && a.steps === 14)).toBe(true);
  expect(asked.every(a => a.tags.includes('draft') && a.tags.includes('composition sketch'))).toBe(true);
  expect(new Set(asked.map(a => a.prompt)).size).toBe(6);
  expect(asked[1].prompt).toContain('(subject on the left:1.3)');
});

test('composition sketches need two compositions', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gmCompBlock summary').click();
  for (const c of ['centre', 'left', 'right', 'diagonal', 'frame']) await page.locator(`#gmComps [data-comp=${c}]`).click();
  await page.locator('#gmCompGo').click();
  await expect(page.locator('#genStatus')).toHaveText('Choose at least two compositions.');
  expect(asked).toHaveLength(0);
});

test('A or B counts the words one picture has and the other has not, and says what keeps winning', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    await loadSection('genmore');
    const red = { file: 'a.png', prompt: '1girl, solo, (red hair:1.2), smile' }, blue = { file: 'b.png', prompt: '1girl, solo, blue hair, smile' };
    let t = { tags: {}, n: 0 };
    t = genTasteCount(t, red, blue);
    const once = genTasteLean(t);
    t = genTasteCount(t, red, blue);
    let q = 0; const walk = () => [0.1, 0.9][q++ % 2];
    const pairs = [genTastePair([red, blue], new Set(), walk), genTastePair([red, blue], new Set(['a.png|b.png'])), genTastePair([red, { ...red, file: 'c.png' }], new Set())];
    return { tags: t.tags, n: t.n, once, twice: genTasteLean(t), pair: !!pairs[0], seen: pairs[1], same: pairs[2] };
  });
  expect(r.tags).toEqual({ 'red hair': 2, 'blue hair': -2 });
  expect(r.n).toBe(2);
  expect(r.once.toward).toEqual([]);
  expect(r.twice.toward).toEqual(['red hair']);
  expect(r.twice.away).toEqual(['blue hair']);
  expect(r.pair).toBe(true);
  expect(r.seen).toBeNull();
  expect(r.same).toBeNull();
});

test('A or B: two pictures are shown, a click is counted, and what wins can go into More tags', async ({ page }) => {
  const { server } = await setup(page);
  const id = 'd'.repeat(64);
  server.items.set('uploads/' + id, { file: id + '.png', name: 'girl, blue hair', type: 'image/png', from: 'generate', bytes: 100, t: Date.now() - 1000,
    folder: 'generated', tags: ['anime', 'girl', 'blue hair'], prompt: '1girl, solo, blue hair', avoid: 'sepia', shape: 'portrait', seed: 78 });
  await page.evaluate(() => localStorage.setItem('refboard.generate.taste.v1', JSON.stringify({ tags: { 'red hair': 1, 'blue hair': -1 }, n: 1 })));
  await page.locator('.nav-item[data-view="drop"]').click();
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(2);
  await page.locator('#genMore summary').click();
  await page.locator('#gmTasteBlock summary').click();
  await page.locator('#gmDuel').click();
  await expect(page.locator('#duelSheet')).toBeVisible();
  await expect(page.locator('#duelA img')).toHaveAttribute('src', /.+/);
  await expect(page.locator('#duelAdd')).toBeDisabled();
  // whichever picture is A, choose the one with red hair
  const redIsA = await page.evaluate(() => duel.pair.a.prompt.includes('red hair'));
  await page.locator(redIsA ? '#duelA' : '#duelB').click();
  await expect(page.locator('#duelLean')).toContainText('2 chosen');
  await expect(page.locator('#duelLean')).toContainText('You lean toward: red hair');
  await expect(page.locator('#duelLean')).toContainText('every pair');
  await page.locator('#duelAdd').click();
  await expect(page.locator('#genExtra')).toHaveValue(/red hair/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#duelSheet')).toBeHidden();
  await expect(page.locator('#gmTaste')).toContainText('2 chosen');
});

test('A or B with one picture says it needs two', async ({ page }) => {
  await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gmTasteBlock summary').click();
  await page.locator('#gmDuel').click();
  await expect(page.locator('#genStatus')).toContainText('needs two pictures');
  await expect(page.locator('#duelSheet')).toHaveCount(0);
});

test('from the storyboard: one request for each frame, its shot, angle, gaze and what she does, one seed', async ({ page }) => {
  const { asked } = await setup(page);
  await page.evaluate(() => localStorage.setItem('refboard.animeTools.v1', JSON.stringify({ frames: [
    { shot: 'ms', angle: 'low', gaze: 'camera', text: 'біжить' }, { shot: 'cu', angle: 'eye', gaze: 'down', text: '' }, { shot: 'xls', angle: 'bird', gaze: 'away', text: '' }] })));
  await page.locator('.nav-item[data-view="drop"]').click();
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.locator('#genMore summary').click();
  await page.locator('#gmStoryBlock summary').click();
  await expect(page.locator('#gmStoryCount')).toHaveText('3');
  await page.locator('#gmStoryGo').click();
  await expect(page.locator('#genStatus')).toContainText('3 frames of the storyboard');
  expect(asked).toHaveLength(3);
  expect(new Set(asked.map(a => a.seed)).size).toBe(1);
  expect(asked[0].prompt).toContain('(cowboy shot:1.3)');
  expect(asked[0].prompt).toContain('(from below:1.3)');
  expect(asked[0].prompt).toContain('(looking at viewer:1.3)');
  expect(asked[0].prompt).toContain('running');
  expect(asked[1].prompt).toContain('(close-up:1.3)');
  expect(asked[1].prompt).toContain('(looking down:1.3)');
  expect(asked[2].prompt).toContain('(from above:1.3)');
  expect(asked.every((a, i) => a.tags.includes('storyboard') && a.tags.includes(`frame ${i + 1}`))).toBe(true);
});

test('paint-ready: the lightest part becomes bare paper, the rest is held to a few tones, hue kept', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    await loadSection('genmore');
    const mk = () => { const d = new Uint8ClampedArray(200 * 4); for (let i = 0; i < 200; i++) { const v = Math.round(i / 199 * 255); d.set([v, Math.round(v * 0.8), Math.round(v * 0.6), 255], i * 4); } return d; };
    const a = mk(), found = genPaintReady(a, { paper: 0.2, steps: 0 });
    const bare = [...Array(200).keys()].filter(i => a[i * 4] === 245 && a[i * 4 + 1] === 243).length;
    const b = mk(), got = genPaintReady(b, { paper: 0, steps: 3 });
    const tones = new Set([...Array(200).keys()].map(i => Math.round((0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2]) / 40)));
    const off = mk(), same = mk(); genPaintReady(off, {});
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; const g = c.getContext('2d'); g.fillStyle = '#d83030'; g.fillRect(0, 0, 20, 20);
    const pulled = genPullCanvas(c, [[200, 60, 60]], 1, { paper: 0, steps: 3 });
    return { bare, paper: found.paper, bands: got.bands, tones: tones.size, off: off.every((v, i) => v === same[i]), pulled: !!pulled.ready, plain: genPullCanvas(c, [[200, 60, 60]], 1).ready };
  });
  expect(r.bare).toBeGreaterThanOrEqual(38);
  expect(r.bare).toBeLessThanOrEqual(44);
  expect(r.paper).toBeCloseTo(r.bare / 200, 2);
  expect(r.bands).toHaveLength(3);
  expect(r.bands.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  expect(r.tones).toBeLessThanOrEqual(4);
  expect(r.off).toBe(true);
  expect(r.pulled).toBe(true);
  expect(r.plain).toBeUndefined();
});

test('Colours to a palette: Bare paper and Tones say what they did, and a kept picture is tagged paint ready', async ({ page }) => {
  const { server } = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-pull').first().click();
  await expect(page.locator('#pullSheet')).toBeVisible();
  await expect(page.locator('#pullPaper [data-v="0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#pullPaper [data-v="0.12"]').click();
  await page.locator('#pullSteps [data-v="4"]').click();
  await expect(page.locator('#pullPaper [data-v="0.12"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pullNote')).toContainText('Tones, darkest first');
  await page.locator('#pullKeep').click();
  await expect(page.locator('#pullNote')).toContainText('Kept in Made here');
  expect([...server.items.values()].some(d => (d.tags || []).includes('paint ready'))).toBe(true);
  await page.keyboard.press('Escape');
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-pull').first().click();
  await expect(page.locator('#pullSteps [data-v="4"]')).toHaveAttribute('aria-pressed', 'true');
});
