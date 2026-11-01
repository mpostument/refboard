// Sorting uploads (js/sort.js): behind the container, a kept picture is
// tagged and moved into a folder by subject. These run with no container -
// the server's API is played here by page.route - and without the models:
// what they find is given as facts, or the whole analysis is stood in for.
const { test, expect, quadrantsPng, openApp, fakeServer } = require('../helpers');

// Facts as pictureFacts() would find them: a plain, mid-grey, horizontal
// picture with nothing found in it - each case changes what it needs.
const facts = over => ({
  w: 1200, h: 800, from: 'drop', tone: { mean: 50, spread: 18 }, colour: { chroma: 0.06, warm: 0 },
  people: [], faces: [], labels: [], ...over,
});

test('a picture goes in the folder for what is in it', async ({ page }) => {
  await openApp(page);
  const cases = [
    ['figure', facts({ people: [{ full: true, pose: 'standing', armsUp: false }] })],
    ['portrait', facts({ people: [{ full: false, pose: null }], faces: [{ share: 0.12, yaw: 30, pitch: 0, lit: 'left' }] })],
    ['landscape', facts({ labels: [{ name: 'seashore', index: 978, score: 0.7 }] })],
    ['animals', facts({ labels: [{ name: 'tabby', index: 281, score: 0.5 }] })],
    ['city', facts({ labels: [{ name: 'church', index: 497, score: 0.4 }] })],
    ['still-life', facts({ labels: [{ name: 'vase', index: 883, score: 0.4 }] })],
    // A drawing with a figure in it is an illustration first.
    ['illustration', facts({ people: [{ full: true, pose: 'standing' }], labels: [{ name: 'comic book', index: 917, score: 0.5 }] })],
    // A photo of your own drawing, whatever is in it.
    ['my-work', facts({ from: 'work', people: [{ full: true, pose: 'sitting' }] })],
    // Unsure is Other, not a guess.
    ['other', facts({ labels: [{ name: 'vase', index: 883, score: 0.05 }] })],
  ];
  const got = await page.evaluate(cs => cs.map(([, f]) => categorise(f)), cases);
  expect(got).toEqual(cases.map(c => c[0]));
});

test('tags say what a search would ask for', async ({ page }) => {
  await openApp(page);
  const tags = f => page.evaluate(([f]) => pictureTags(f, categorise(f)), [f]);
  expect(await tags(facts({ people: [{ full: true, pose: 'sitting', armsUp: true }],
    faces: [{ share: 0.01, yaw: -40, pitch: 20, lit: 'left' }], tone: { mean: 30, spread: 30 }, colour: { chroma: 0.08, warm: 0.03 } })))
    .toEqual(['one person', 'sitting', 'full figure', 'arms raised', 'three-quarter view', 'from below', 'lit from the left',
      'low key', 'high contrast', 'warm', 'horizontal']);
  // What the classifier saw is a tag - but not the clothes of a person.
  expect(await tags(facts({ labels: [{ name: 'seashore', index: 978, score: 0.7 }], colour: { chroma: 0.01, warm: 0 } })))
    .toEqual(['black and white', 'horizontal', 'seashore']);
  expect(await tags(facts({ people: [{ full: true, pose: 'standing' }], labels: [{ name: 'jersey', index: 610, score: 0.6 }] })))
    .not.toContain('jersey');
});

test('behind a server, a dropped picture is kept, sorted and tagged', async ({ page }) => {
  const server = await fakeServer(page);
  await openApp(page);
  // The models stood in for: this is about what happens with their answer.
  await page.evaluate(() => {
    window.analysePicture = async () => ({ folder: 'landscape', tags: ['warm', 'horizontal', 'seashore'] });
  });
  await page.click('.nav-item[data-view="drop"]');
  await page.setInputFiles('#dropInput', { name: 'beach.png', mimeType: 'image/png', buffer: quadrantsPng() });

  await expect.poll(() => server.moves).toEqual([{ id: 'a'.repeat(64) + '.png', folder: 'landscape' }]);
  await expect.poll(() => server.items.get('uploads/' + 'a'.repeat(64))?.tags).toEqual(['warm', 'horizontal', 'seashore']);
  expect(server.items.get('uploads/' + 'a'.repeat(64))).toMatchObject({ name: 'beach.png', folder: 'landscape' });
  // Said where it went, under the drop zone; the status line gone once done.
  await page.keyboard.press('Escape');
  await page.click('.nav-item[data-view="drop"]');
  await expect(page.locator('#uploadsList .up-folder')).toHaveText('Landscape');
  await expect(page.locator('#uploadsSorting')).toBeHidden();
  await expect(page.locator('#uploadsWhere')).toContainText('sorted');
});

test('without a server nothing is sorted', async ({ page }) => {
  await openApp(page);
  const queued = await page.evaluate(() => {
    queueSort({ file: 'x.png', type: 'image/png', name: 'x' });
    return sortQueue.length + (sortBusy ? 1 : 0);
  });
  expect(queued).toBe(0);
});

test('the library search finds a sorted upload by its tags, word by word', async ({ page }) => {
  await openApp(page);
  const found = await page.evaluate(() => {
    const list = [
      { name: 'a.jpg', group: 'Figure', pack: 'Uploads', tags: ['sitting', 'lit from the left', 'low key'] },
      { name: 'b.jpg', group: 'Figure', pack: 'Uploads', tags: ['standing', 'lit from the left'] },
      { name: 'c.jpg', group: 'Landscape', pack: 'Uploads', tags: ['seashore'] },
      { name: 'sitting 01.jpg', group: 'Poses', pack: 'Studio', tags: [] },
    ];
    const q = s => { el('imgFilter').value = s; return filterImages(list).map(i => i.name); };
    return { both: q('sitting left'), one: q('seashore'), plain: q('sitting') };
  });
  expect(found.both).toEqual(['a.jpg']);
  expect(found.one).toEqual(['c.jpg']);
  expect(found.plain).toEqual(['a.jpg', 'sitting 01.jpg']);
});
