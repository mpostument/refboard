// Generate's sketch pad, line art to trace, details, other conditions, the grid, the character cards and the challenge
// (js/gennew.js). The server is played by page.route.
const { test, expect, openApp, fakeServer } = require('../helpers');

async function setup(page) {
  const server = await fakeServer(page);
  const asked = [], id = 'b'.repeat(64);
  const doc = { file: id + '.png', name: 'girl, red hair', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(),
    folder: 'generated', tags: ['anime', 'girl', 'red hair', 'sunset'], prompt: '1girl, solo, red hair, sunset, orange sky', avoid: 'sepia', shape: 'portrait', seed: 77 };
  server.items.set('uploads/' + id, doc);
  let n = 0;
  await page.route('**/api/generate**', async r => {
    const req = r.request();
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (req.url().endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors' } });
    const key = String(++n).padStart(2, '0').repeat(32), made = { ...doc, file: key + '.png', tags: asked.at(-1).tags, t: Date.now() + n };
    server.items.set('uploads/' + key, made);
    return r.fulfill({ json: { state: 'done', upload: { doc: made, url: 'uploads/Generated/x.png' } } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(page.locator('#genResults .gen-open')).toHaveCount(1);
  return { asked, server };
}

test('a sketch: drawn on the pad, it is the start of the picture, freely', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genSketch').click();
  await expect(page.locator('#sketchSheet')).toBeVisible();
  await expect(page.locator('#skUse')).toBeDisabled();
  const cv = page.locator('#skCanvas'), box = await cv.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('#skUse')).toBeEnabled();
  await expect(page.locator('#skUndo')).toBeEnabled();
  await page.locator('#skUndo').click();
  await expect(page.locator('#skUse')).toBeDisabled();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 160, { steps: 5 }); await page.mouse.up();
  await page.locator('#skShape [data-v=landscape]').click();
  await expect(page.locator('#skUse')).toBeDisabled();
  const size = await cv.evaluate(c => [c.width, c.height]);
  expect(size[0]).toBeGreaterThan(size[1]);
  const box2 = await cv.boundingBox();
  await page.mouse.move(box2.x + 40, box2.y + 40);
  await page.mouse.down(); await page.mouse.move(box2.x + 120, box2.y + 100, { steps: 5 }); await page.mouse.up();
  await page.locator('#skUse').click();
  await expect(page.locator('#sketchSheet')).toBeHidden();
  await expect(page.locator('#genSourceBody')).toContainText('Your sketch');
  await expect(page.locator('#genSourceBody [data-level="0.8"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#genCount').selectOption('1');
  await page.locator('#genGo').click();
  await expect(page.locator('#genStatus')).toContainText('Made');
  expect(asked).toHaveLength(1);
  expect(asked[0].image.length).toBeGreaterThan(100);
  expect(asked[0].denoise).toBe(0.8);
  expect(asked[0].shape).toBe('landscape');
  expect(asked[0].tags).toContain('from a sketch');
  expect(asked[0].prompt).not.toContain('thick outlines');   // a study's beginner tags are not added
});

test('line art to trace: the lines pale on white, and the shapes numbered by tone', async ({ page }) => {
  await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-line').first().click();
  await expect(page.locator('#lineSheet')).toBeVisible();
  await expect(page.locator('#lnDetail [data-v=some]')).toHaveAttribute('aria-pressed', 'true');
  const dark = await page.locator('#lnCanvas').evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 60) n++; return n; });
  expect(dark).toBe(0);
  await page.locator('#lnColour [data-v=black]').click();
  await expect(page.locator('#lnColour [data-v=black]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#lnTones [data-v="4"]').click();
  await expect(page.locator('#lnBands .gn-band')).toHaveCount(4);
  await expect(page.locator('#lnNote')).toContainText('shapes are numbered');
  await expect(page.locator('#lnDetail')).toBeHidden();
  await page.locator('#lnKeep').click();
  await expect(page.locator('#lnNote')).toContainText('Kept in Made here');
  await page.locator('#lineSheetClose').click();
  await expect(page.locator('#lineSheet')).toBeHidden();
});

test('details: parts cut out on a sheet, and a part drawn again four ways with four seeds', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-detail').first().click();
  await expect(page.locator('#detailSheet')).toBeVisible();
  await expect(page.locator('#dtAdd')).toBeDisabled();
  const cv = page.locator('#dtPic');
  const drag = async (a, b) => { const box = await cv.boundingBox(); await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]); await page.mouse.down(); await page.mouse.move(box.x + box.width * b[0], box.y + box.height * b[1], { steps: 5 }); await page.mouse.up(); };
  await drag([0.1, 0.1], [0.4, 0.3]);
  await expect(page.locator('#dtAdd')).toBeEnabled();
  await page.locator('#dtAdd').click();
  await drag([0.5, 0.5], [0.9, 0.9]);
  await page.locator('#dtAdd').click();
  await expect(page.locator('#dtParts .gn-part')).toHaveCount(2);
  await expect(page.locator('#dtSheetPic')).toBeVisible();
  await page.locator('#dtParts [data-rm="0"]').click();
  await expect(page.locator('#dtParts .gn-part')).toHaveCount(1);
  await page.locator('#dtKeep').click();
  await expect(page.locator('#dtHint')).toContainText('Kept in Made here');
  await page.locator('#dtRedraw').click();
  await expect(page.locator('#redrawSheet')).toBeVisible();
  await expect(page.locator('#redrawFour')).toBeChecked();
  await page.locator('#redrawGo').click();
  await expect(page.locator('#genStatus')).toContainText('Four tries');
  expect(asked).toHaveLength(4);
  expect(new Set(asked.map(a => a.seed)).size).toBe(4);
  expect(asked.every(a => a.mask && a.image && a.tags.includes('redrawn'))).toBe(true);
});

test('other conditions: one picture for each, its old condition gone and the new one weighted', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-cond').first().click();
  await expect(page.locator('#condSheet')).toBeVisible();
  await expect(page.locator('#cdPick [aria-pressed=true]')).toHaveCount(4);
  await page.locator('#cdPick [data-v=fog]').click();
  await page.locator('#cdLevel [data-v="0.7"]').click();
  await page.locator('#cdGo').click();
  await expect(page.locator('#genStatus')).toContainText('5 conditions');
  expect(asked).toHaveLength(5);
  expect(asked.every(a => a.denoise === 0.7 && a.image && a.parent && !/(^|, )(orange sky|sunset)(,|$)/.test(a.prompt) && a.prompt.includes('red hair'))).toBe(true);
  expect(asked.some(a => a.prompt.includes('(night:1.3)'))).toBe(true);
  expect(asked.some(a => a.prompt.includes('(fog:1.3)'))).toBe(true);
  expect(new Set(asked.map(a => a.prompt)).size).toBe(5);
});

test('a grid: one thing changed nine ways at most, with one seed, then seen on one sheet', async ({ page }) => {
  const { asked } = await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gnGridBlock summary').click();
  const rows = await page.locator('#gnGridRow option').evaluateAll(o => o.map(x => x.value));
  expect(rows).toContain('hair');
  expect(rows).not.toContain('subject');
  await page.locator('#gnGridRow').selectOption('hair');
  await page.locator('#gnGridGo').click();
  await expect(page.locator('#gridSheet')).toBeVisible();
  const n = asked.length;
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(9);
  expect(new Set(asked.map(a => a.seed)).size).toBe(1);
  expect(new Set(asked.map(a => a.prompt)).size).toBe(n);
  expect(asked.every(a => a.tags.includes('grid') && !('label' in a))).toBe(true);
  await page.locator('#grKeep').click();
  await expect(page.locator('#grNote')).toContainText('Kept in Made here');
  // The choices are as they were.
  expect(await page.evaluate(() => genChoices.hair)).toBe('any');
});

test('character cards: kept under a name, put back by a click, forgotten', async ({ page }) => {
  await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gnCardBlock summary').click();
  await page.locator('#genCharacter').fill('Frieren, Sousou no Frieren');
  await page.locator('#genChoices [data-gen=hair][data-opt=short]').click();
  await page.locator('#gnCardName').fill('Elf');
  await page.locator('#gnCardSave').click();
  await expect(page.locator('#gnCards .gn-card')).toHaveCount(1);
  await page.locator('#genChoices [data-gen=hair][data-opt=bob]').click();
  await page.locator('#genCharacter').fill('');
  await page.locator('#gnCards [data-act=use]').click();
  await expect(page.locator('#genCharacter')).toHaveValue('Frieren, Sousou no Frieren');
  await expect(page.locator('#genChoices [data-gen=hair][data-opt=short]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#gnCardName').fill('elf');
  await page.locator('#gnCardSave').click();
  await expect(page.locator('#gnCards .gn-card')).toHaveCount(1);
  await page.locator('#gnCards [data-act=drop]').click();
  await expect(page.locator('#gnCards')).toContainText('No cards yet');
});

test('the challenge: a pose, an outfit, a light and a mood go into More tags in place of the last; the day gives the same', async ({ page }) => {
  await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gnChalBlock summary').click();
  await page.locator('#genExtra').fill('smile');
  await page.locator('#gnChalRoll').click();
  await expect(page.locator('#gnChal .gn-chal')).toHaveCount(4);
  const first = await page.locator('#genExtra').inputValue();
  expect(first.startsWith('smile, ')).toBe(true);
  expect(first.split(', ').length).toBe(5);
  await page.locator('#gnChalRoll').click();
  const second = await page.locator('#genExtra').inputValue();
  expect(second.split(', ').length).toBe(5);
  await page.locator('#gnChalToday').click();
  const a = await page.locator('#gnChal').innerText();
  await page.locator('#gnChalToday').click();
  expect(await page.locator('#gnChal').innerText()).toBe(a);
  await page.locator('#gnChalMin [data-v="10"]').click();
  await page.locator('#gnChalTimer').click();
  await expect(page.locator('#gnChalClock')).toHaveText(/^(10:00|9:5\d)$/);
  await page.locator('#gnChalTimer').click();
  await expect(page.locator('#gnChalClock')).toHaveText('');
});

test('the choices: the start strip is at the top, rare rows are folded, and the clothes line says what Setting and Era dress her in', async ({ page }) => {
  await setup(page);
  const order = await page.evaluate(() => { const a = document.getElementById('genSource').getBoundingClientRect().top, b = document.getElementById('genChoices').getBoundingClientRect().top; return a < b; });
  expect(order).toBe(true);
  await expect(page.locator('#genSource')).not.toHaveClass(/gen-bar/);
  const fold = page.locator('.gen-rare').first();
  await expect(fold).toBeVisible();
  await expect(fold).not.toHaveJSProperty('open', true);
  await expect(page.locator('[data-gen=who][data-opt=her]')).toHaveText('By name');
  await expect(page.locator('#genDress')).toContainText('the model picks her clothes');
  await page.locator('[data-gen=setting][data-opt=slavic]').click();
  await page.locator('[data-gen=era][data-opt=medieval]').click();
  await expect(page.locator('#genDress')).toContainText('Dressed as:');
  await expect(page.locator('#genDress')).toContainText('embroidered');
  await expect(page.locator('#genDress')).toContainText('medieval');
  await page.locator('[data-gen=setting][data-opt=original]').click();
  await expect(page.locator('[data-row=era]')).toBeHidden();
  await expect(page.locator('#genDress')).toContainText('nothing is added');
  // A rare row that is set opens its fold and counts itself.
  await page.evaluate(() => { genChoices.hair = 'short'; genChoices.parting = 'side'; syncGenRows(); });
  await expect(page.locator('.gen-rare[data-seen]').first()).toHaveJSProperty('open', true);
  await expect(page.locator('.gen-rare summary .count').first()).toHaveText('(1 set)');
});

test('paper: rough, smooth and toned say their words; toned paper takes the white background away', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const p = o => genPrompt({ ...GEN_DEFAULTS, detail: 'normal', ...o }).prompt;
    return { any: p({}), rough: p({ paper: 'rough' }), toned: p({ paper: 'toned' }), flat: p({ medium: 'flat', paper: 'toned' }), ink: p({ medium: 'ink', paper: 'smooth' }) };
  });
  expect(r.any).toContain('white background');
  expect(r.any).not.toContain('paper grain');
  expect(r.rough).toContain('rough paper, textured paper, paper grain');
  expect(r.toned).toContain('beige paper');
  expect(r.toned).not.toContain('white background');
  expect(r.toned).toContain('simple background');
  expect(r.flat).not.toContain('beige paper');          // no paper under flat colour
  expect(r.ink).toContain('smooth paper');
  await expect(page.locator('[data-row=paper]')).toBeVisible();
  await page.locator('[data-gen=medium][data-opt=flat]').click();
  await expect(page.locator('[data-row=paper]')).toBeHidden();
});

test('saved settings: every choice and the More tags come back under a name', async ({ page }) => {
  await setup(page);
  await page.locator('#genMore summary').click();
  await page.locator('#gnSetBlock summary').click();
  await page.locator('[data-gen=medium][data-opt=ink]').click();
  await page.locator('[data-gen=hair][data-opt=long]').click();
  await page.locator('#genExtra').fill('hat, rain');
  await page.locator('#gnSetName').fill('Ink girl');
  await page.locator('#gnSetSave').click();
  await expect(page.locator('#gnSets .gn-card')).toHaveCount(1);
  await page.locator('[data-gen=medium][data-opt=watercolour]').click();
  await page.locator('[data-gen=hair][data-opt=short]').click();
  await page.locator('#genExtra').fill('');
  await page.locator('#gnSets [data-act=use]').click();
  await expect(page.locator('[data-gen=medium][data-opt=ink]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gen=hair][data-opt=long]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#genExtra')).toHaveValue('hat, rain');
  await page.locator('#gnSetName').fill('ink GIRL');
  await page.locator('#gnSetSave').click();
  await expect(page.locator('#gnSets .gn-card')).toHaveCount(1);
  await page.locator('#gnSets [data-act=drop]').click();
  await expect(page.locator('#gnSets')).toContainText('None yet');
});

test('describe it: Ukrainian words become tags - a colour goes with the thing it colours', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    await loadSection('genmore');
    return { a: genDescribeTags('червона сукня, зелені очі, біля вікна'), b: genDescribeTags('стоїть під дощем, біла парасолька'), c: genDescribeTags('fantasy castle, блакитні квіти'), d: genDescribeTags('щось незрозуміле') };
  });
  expect(r.a.tags).toEqual(['red dress', 'green eyes', 'window']);
  expect(r.b.tags).toEqual(expect.arrayContaining(['standing', 'rain', 'white umbrella']));
  expect(r.c.tags).toEqual(['fantasy castle', 'blue flowers']);
  expect(r.d.tags).toHaveLength(0);
  expect(r.d.unknown).toEqual(['щось', 'незрозуміле']);
  await page.locator('#genMore summary').click();
  await page.locator('#gnDescBlock summary').click();
  await page.locator('#genExtra').fill('smile');
  await page.locator('#gnDescText').fill('червона сукня, біля вікна');
  await page.locator('#gnDescAdd').click();
  await expect(page.locator('#genExtra')).toHaveValue('smile, red dress, window');
  await page.locator('#gnDescText').fill('щось незрозуміле');
  await page.locator('#gnDescAdd').click();
  await expect(page.locator('#genStatus')).toContainText('Not known yet');
});

test('anime of: a decade says its style tags, and Any says nothing', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const p = o => genPrompt({ ...GEN_DEFAULTS, detail: 'normal', ...o }).prompt;
    return { any: p({}), s90: p({ decade: '90s' }), s20: p({ decade: '20s' }) };
  });
  expect(r.any).not.toContain('(style)');
  expect(r.s90).toContain('1990s \\(style\\), retro artstyle');
  expect(r.s20).toContain('2020s \\(style\\)');
  await expect(page.locator('[data-row=decade] h4')).toHaveText('Anime of');
  await page.locator('[data-gen=decade][data-opt="80s"]').click();
  await expect(page.locator('[data-gen=decade][data-opt="80s"]')).toHaveAttribute('aria-pressed', 'true');
});
