// Working on a picture Generate made (js/genedit.js): the menu on it, Finish it,
// Redraw a part, and drafts. The server's side is played by page.route, as in
// generate.spec.js; what is checked is what the page asks of it.
const { test, expect, openApp, fakeServer } = require('../helpers');

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
  return asked;
}

test('a picture has one button; its menu holds the rest and closes on Esc', async ({ page }) => {
  await setup(page);
  const more = page.locator('#genResults .gen-more').first();
  await expect(page.locator('#genResults .gen-menu').first()).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  for (const c of ['gen-vary', 'gen-redraw', 'gen-finish', 'gen-steps', 'gen-colours']) await expect(page.locator(`#genResults .${c}`).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#genResults .gen-menu').first()).toBeHidden();
  await expect(more).toBeFocused();
});

test('Finish it asks for the picture 1.5 times the size, with a little freedom, and the same seed', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-finish').first().click();
  await expect(page.locator('#genStatus')).toHaveText('Finished - in Uploads, Generated.');
  expect(asked[0].scale).toBe(1.5);
  expect(asked[0].denoise).toBe(0.4);
  expect(asked[0].seed).toBe(77);
  expect(asked[0].prompt).toBe('1girl, solo, red hair');
  expect(asked[0].image.length).toBeGreaterThan(100);
  expect(asked[0].mask).toBeUndefined();
  expect(asked[0].tags).toContain('finished');
  expect(asked[0].parent).toBe('b'.repeat(64) + '.png');
});

test('Redraw a part sends the picture and a mask that is white only where it was brushed', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-redraw').first().click();
  await expect(page.locator('#redrawSheet')).toBeVisible();
  // Nothing brushed, nothing to redraw.
  await expect(page.locator('#redrawGo')).toBeDisabled();
  const box = await page.locator('#redrawMask').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#redrawGo')).toBeEnabled();
  // Undo takes the stroke off; brushing again puts it back.
  await page.click('#redrawUndo');
  await expect(page.locator('#redrawGo')).toBeDisabled();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await page.fill('#redrawText', 'open hand');
  await page.click('#redrawLevels [data-level="0.95"]');
  await page.click('#redrawGo');
  await expect(page.locator('#redrawSheet')).toBeHidden();
  await expect(page.locator('#genStatus')).toHaveText('Redrawn - in Uploads, Generated.');
  const req = asked[0];
  expect(req.denoise).toBe(0.95);
  expect(req.prompt).toBe('1girl, solo, red hair, (open hand:1.3)');
  expect(req.tags).toEqual(expect.arrayContaining(['red hair', 'open hand', 'redrawn']));
  expect(req.seed).toBeUndefined();
  expect(req.parent).toBe('b'.repeat(64) + '.png');
  // The mask: black where nothing was brushed (a corner), white on the stroke's start.
  const px = await page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { corner: [...g.getImageData(2, 2, 1, 1).data], stroke: [...g.getImageData(Math.round(img.width * 0.3), Math.round(img.height * 0.3), 1, 1).data] };
  }, req.mask);
  expect(px.corner[0]).toBe(0);
  expect(px.stroke[0]).toBeGreaterThan(200);
});

test('Drafts are the choices in fewer steps, tagged, to be finished later', async ({ page }) => {
  const asked = await setup(page);
  await page.selectOption('#genCount', '1');
  await page.click('#genGo');
  await expect(page.locator('#genStatus')).toHaveText('Made - in Uploads, Generated.');
  expect(asked[0].steps).toBeUndefined();
  await page.selectOption('#genQuality', 'draft');
  await page.click('#genGo');
  await expect(page.locator('#genStatus')).toHaveText('Made - in Uploads, Generated.');
  expect(asked[1].steps).toBe(14);
  expect(asked[1].tags).toContain('draft');
});

test('Light it four ways: four requests, each with its own light weighted and the old one gone', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-lights').first().click();
  await expect(page.locator('#genStatus')).toHaveText('Four lights - in Uploads, Generated.');
  expect(asked).toHaveLength(4);
  expect(asked[0].prompt).toBe('1girl, solo, red hair, (soft lighting:1.3)');
  expect(asked[2].prompt).toContain('(backlighting:1.3), (rim lighting:1.3)');
  expect(asked.every(a => a.denoise === 0.55 && a.seed === 77 && a.image.length > 100)).toBe(true);
  expect(asked[1].tags).toContain('side light');
  expect(asked.every(a => a.parent === 'b'.repeat(64) + '.png')).toBe(true);
});

test('Before and after: only on a picture made from another; a slider shows more of one or the other', async ({ page }) => {
  await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await expect(page.locator('#genResults .gen-compare')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const u = (await genMade())[0];
    u.parent = 'a'.repeat(64) + '.png';
    await storePutItem('uploads', uploadKey(u.file), u);
  });
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-compare').first().click();
  await expect(page.locator('#compareSheet')).toBeVisible();
  await expect(page.locator('#compareBefore')).toHaveAttribute('src', /api\/uploads\/a{64}\.png/);
  await expect(page.locator('#compareAfter')).toHaveAttribute('src', /api\/uploads\/b{64}\.png/);
  await expect(page.locator('#compareBefore')).toHaveCSS('clip-path', /50%/);
  await page.locator('#compareSlider').fill('80');
  await expect(page.locator('#compareBefore')).toHaveCSS('clip-path', /20%/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#compareSheet')).toBeHidden();
});

test('In other media: the old medium\'s words are swapped for each new one, not piled up', async ({ page }) => {
  const asked = await setup(page);
  // Seed a picture in watercolour, with the tags the page itself writes.
  await page.evaluate(async () => {
    const all = await genMade(), u = all[0];
    u.prompt = '1girl, solo, red hair, watercolor \\(medium\\), traditional media, lineart'; u.avoid = 'solid black, sepia';
    u.tags = ['anime', 'girl', 'watercolour'];
    await storePutItem('uploads', uploadKey(u.file), u);
  });
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-media').first().click();
  await expect(page.locator('#genStatus')).toHaveText('3 media - in Uploads, Generated.');
  expect(asked).toHaveLength(3);          // not watercolour again
  const ink = asked.find(a => a.tags.includes('ink'));
  expect(ink.prompt).toContain('ink \\(medium\\)');
  expect(ink.prompt).not.toContain('watercolor');
  expect(ink.avoid).toContain('solid black');
  const copic = asked.find(a => a.tags.includes('copic markers'));
  expect(copic.avoid).not.toContain('solid black');
  expect(copic.denoise).toBe(0.65);
});

test('New background: the mask starts on the plain background, and the plain one\'s words are dropped', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-bg').first().click();
  await expect(page.locator('#redrawTitle')).toHaveText('New background');
  // The test picture is four flat quadrants touching the edge: all of it is "background" -
  // enough to say that something was found, and that Redraw is on without a stroke.
  await expect(page.locator('#redrawGo')).toBeEnabled();
  await page.fill('#redrawText', 'a beach at sunset');
  await page.click('#redrawGo');
  await expect(page.locator('#genStatus')).toHaveText('New background - in Uploads, Generated.');
  expect(asked[0].mask.length).toBeGreaterThan(100);
  expect(asked[0].prompt).toBe('1girl, solo, red hair, (a beach at sunset:1.3)');
  expect(asked[0].tags).toContain('new background');
  expect(asked[0].denoise).toBe(0.95);
});

test('Extend: the picture goes on a bigger canvas, the mask is white only over the new part', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-extend').first().click();
  await expect(page.locator('#extendSheet')).toBeVisible();
  // Right, a quarter: the default. Nothing picked, nothing to draw.
  await expect(page.locator('#extendGo')).toBeEnabled();
  await page.click('#extendSides [data-side="right"]');
  await expect(page.locator('#extendGo')).toBeDisabled();
  await page.click('#extendSides [data-side="right"]');
  await page.fill('#extendText', 'a forest path');
  const wide = await page.evaluate(() => ({ ...extendBox(extend), W0: extend.pic.width }));
  expect(wide.l).toBe(0);
  expect(wide.r).toBeGreaterThan(0);
  expect(wide.W).toBe(wide.W0 + wide.r);
  await page.click('#extendGo');
  await expect(page.locator('#genStatus')).toHaveText('Extended - in Uploads, Generated.');
  const req = asked[0];
  expect(req.denoise).toBe(1);
  // The scenery only: her words are out, "no humans" is in, and she is kept out by name.
  expect(req.prompt).toBe('no humans, (a forest path:1.3)');
  expect(req.avoid).toContain('1girl');
  expect(req.tags).toEqual(expect.arrayContaining(['red hair', 'a forest path', 'extended']));
  expect(req.parent).toBe('b'.repeat(64) + '.png');
  const px = await page.evaluate(async ([b64, W0]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const at = (x, y) => g.getImageData(x, y, 1, 1).data[0];
    return { w: img.width, h: img.height, inside: at(2, 2), outside: at(img.width - 2, 2), edgeIn: at(W0 - 2, 5), edgeOut: at(W0 + 2, 5) };
  }, [req.mask, wide.W - wide.r]);
  expect(px.w).toBe(wide.W);
  expect(px.inside).toBe(0);
  expect(px.outside).toBe(255);
  expect(px.edgeIn).toBe(0);
  expect(px.edgeOut).toBe(255);
});

test('Extend: Continue the character keeps her words, for a picture whose body goes on past the edge', async ({ page }) => {
  const asked = await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-extend').first().click();
  await expect(page.locator('#extendSheet')).toBeVisible();
  await page.click('#extendSides [data-side="right"]');
  await page.click('#extendSides [data-side="bottom"]');
  await page.check('#extendPerson');
  await page.click('#extendGo');
  await expect(page.locator('#genStatus')).toHaveText('Extended - in Uploads, Generated.');
  expect(asked[0].prompt).toBe('1girl, solo, red hair');
  expect(asked[0].avoid).toBe('sepia');
});

test('Extend: a canvas too big to draw in one go says so and cannot be sent', async ({ page }) => {
  await setup(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-extend').first().click();
  await expect(page.locator('#extendSheet')).toBeVisible();
  await page.evaluate(() => { extend.pic = Object.assign(document.createElement('canvas'), { width: 1200, height: 1216 }); });
  await page.click('#extendAmount [data-frac="0.5"]');
  await expect(page.locator('#extendHint')).toContainText('too big');
  await expect(page.locator('#extendGo')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#extendSheet')).toBeHidden();
});

// A picture of a real size to brush a small part of: half of 832 x 1216, so the test is quick.
async function bigPicture(page) {
  const { makePng } = require('../helpers');
  const png = makePng(416, 608, (x, y) => [x % 256, y % 256, 128]);
  await page.route(/api\/uploads\/b{64}\.png/, r => r.fulfill({ contentType: 'image/png', body: png }));
}
async function brush(page, from, to) {
  const box = await page.locator('#redrawMask').boundingBox();
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 4 });
  await page.mouse.up();
}
const sizeOf = (page, b64, type) => page.evaluate(async ([s, t]) => {
  const img = new Image(); img.src = `data:image/${t};base64,${s}`; await img.decode();
  return [img.width, img.height];
}, [b64, type]);

test('Redraw in detail: a small part is cut out with room round it and drawn at about 1024 px', async ({ page }) => {
  const asked = await setup(page);
  await bigPicture(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-redraw').first().click();
  await expect(page.locator('#redrawDetail')).toBeChecked();
  await brush(page, [0.5, 0.5], [0.58, 0.5]);
  await page.click('#redrawGo');
  await expect(page.locator('#genStatus')).toHaveText('Redrawn - in Uploads, Generated.');
  const [w, h] = await sizeOf(page, asked[0].image, 'jpeg');
  expect(Math.max(w, h)).toBe(1024);               // a small part: the long side is made 1024
  expect(w % 8 + h % 8).toBe(0);
  expect(await sizeOf(page, asked[0].mask, 'png')).toEqual([w, h]);
  expect(asked[0].parent).toBe('b'.repeat(64) + '.png');
});

test('Redraw in detail off: the whole picture goes, as before', async ({ page }) => {
  const asked = await setup(page);
  await bigPicture(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-redraw').first().click();
  await page.uncheck('#redrawDetail');
  await brush(page, [0.5, 0.5], [0.58, 0.5]);
  await page.click('#redrawGo');
  await expect(page.locator('#genStatus')).toHaveText('Redrawn - in Uploads, Generated.');
  expect(await sizeOf(page, asked[0].image, 'jpeg')).toEqual([416, 608]);
});

test('Redraw in detail: where the cut is - centred on the brush, inside the picture, none for a big part', async ({ page }) => {
  await setup(page);
  await bigPicture(page);
  await page.locator('#genResults .gen-more').first().click();
  await page.locator('#genResults .gen-redraw').first().click();
  const cut = await page.evaluate(() => {
    // The sheet holds a 416 x 608 picture; paint boxes straight onto the brush layer.
    const out = [], g = redrawInk(), box = (x, y, w, h) => { g.clearRect(0, 0, redraw.w, redraw.h); g.fillStyle = '#f00'; g.fillRect(x, y, w, h); return redrawCrop(); };
    out.push(box(200, 300, 40, 40));       // small, in the middle
    out.push(box(0, 0, 20, 20));            // in the corner: moved in, not cut
    out.push(box(50, 50, 330, 400));        // over a third of the picture
    g.clearRect(0, 0, redraw.w, redraw.h);
    out.push(redrawCrop());                 // nothing brushed
    return out;
  });
  const [mid, corner, big, none] = cut;
  expect(mid.w).toBe(256);                  // 40 + 2 x 24 = 88, widened to 256
  expect(Math.abs(mid.x + mid.w / 2 - 220)).toBeLessThanOrEqual(1);
  expect(Math.abs(mid.y + mid.h / 2 - 320)).toBeLessThanOrEqual(1);
  expect(mid.k).toBe(4);
  expect(corner.x).toBe(0);
  expect(corner.y).toBe(0);
  expect(corner.w).toBe(256);
  expect(big).toBeNull();
  expect(none).toBeNull();
});
