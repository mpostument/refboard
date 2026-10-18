// A character's actions (js/charpose.js; the Pose row, the frames slider and the player in js/assets.js):
// the poses of a walk, a run and an attack, the strip they are laid out in, and the view that runs them.
// The model is not involved, and neither is the 3D engine: the figure and its depth map are stood in for.
const { openSection, test, expect, openApp, fakeServer, makePng } = require('../helpers');

test('a cycle is n frames that do not end on a copy of the first, with the legs and arms opposite', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const a of ['walk', 'run', 'attack']) for (const n of CHAR_FRAMES) out[`${a}${n}`] = charActionPoses(a, n).length;
    const w = charActionPoses('walk', 8);
    return { out, idle: charActionPoses('idle', 8).length, hurt: charActionPoses('hurt', 4).length, own: charActionPoses('own', 6), odd: charActionPoses('walk', 5).length,
      frames: w.map(p => p['thigh.L'][0]), half: [w[0]['thigh.L'][0], w[4]['thigh.R'][0]], arm: [w[0]['upperArm.L'][0], w[0]['thigh.L'][0]],
      first: JSON.stringify(w[0]), last: JSON.stringify(w[7]) };
  });
  for (const a of ['walk', 'run', 'attack']) for (const n of [4, 6, 8]) expect(r.out[`${a}${n}`], a + n).toBe(n);
  expect([r.idle, r.hurt, r.odd]).toEqual([1, 1, 6]);   // one picture each; 5 frames is not a stop of the slider, so 6
  expect(r.own).toBeNull();
  // Half a cycle on, the legs have traded places: the loop's seam is the last frame leading to the first.
  expect(r.half[0]).toBeCloseTo(r.half[1], 5);
  expect(r.first).not.toBe(r.last);
  // The leg furthest forward (a negative bend) is the left one at frame 0, and its arm is back (positive).
  expect(r.arm[1]).toBeLessThan(0);
  expect(r.arm[0]).toBeGreaterThan(0);
});

test('a run swings further than a walk, and every pose stays inside what the figure can do', async ({ page }) => {
  await openApp(page);
  // The joints and their limits are the 3D forms' own, loaded with that section.
  await page.evaluate(() => loadSection('forms'));
  const r = await page.evaluate(() => {
    const reach = a => Math.max(...charActionPoses(a, 8).map(p => p['thigh.L'][0])) - Math.min(...charActionPoses(a, 8).map(p => p['thigh.L'][0]));
    const bad = [];
    for (const a of CHAR_ACTIONS.map(x => x.id)) for (const pose of charActionPoses(a, 8) || []) {
      const clean = cleanFormPose(pose);
      for (const j of Object.keys(pose)) {
        if (!clean[j]) { bad.push(`${a}: ${j} is not a joint`); continue; }
        const lim = formJointLimits(j);
        clean[j].forEach((v, k) => { if (v < lim[k][0] - 0.5 || v > lim[k][1] + 0.5) bad.push(`${a}: ${j}[${k}] = ${v} outside ${lim[k]}`); });
      }
    }
    return { walk: reach('walk'), run: reach('run'), bad };
  });
  expect(r.run).toBeGreaterThan(r.walk);
  expect(r.bad).toEqual([]);
});

test('an attack starts at its ready pose, ends at its follow-through, and the wind-up lifts the sword arm', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const p = charActionPoses('attack', 8);
    return { first: p[0]['upperArm.R'][0], last: p[7]['upperArm.R'][0], key: CHAR_ATTACK[0]['upperArm.R'][0], end: CHAR_ATTACK[3]['upperArm.R'][0],
      high: Math.min(...p.map(x => x['upperArm.R'][0])), four: charActionPoses('attack', 4).map(x => x['upperArm.R'][0]), keys: CHAR_ATTACK.map(x => x['upperArm.R'][0]) };
  });
  expect([r.first, r.last]).toEqual([r.key, r.end]);
  expect(r.high).toBeLessThan(-100);   // the arm goes back over the shoulder
  expect(r.four).toEqual(r.keys);      // at 4 frames the frames are the four keys
});

test('the strip is the frames side by side in cells of one size, feet on one line', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const make = (w, h, c) => { const k = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h); return k; };
    const s = charStrip([make(20, 40, '#f00'), make(16, 40, '#0f0'), make(20, 36, '#00f')]);
    const px = (x, y) => Array.from(s.getContext('2d').getImageData(x, y, 1, 1).data);
    return { size: [s.width, s.height], first: px(10, 20), second: px(20 + 10, 20), narrowEdge: px(20 + 1, 20), shortTop: px(40 + 10, 1), shortFeet: px(40 + 10, 39), none: charStrip([]) };
  });
  expect(r.size).toEqual([60, 40]);
  expect(r.first).toEqual([255, 0, 0, 255]);
  expect(r.second).toEqual([0, 255, 0, 255]);
  expect(r.narrowEdge[3]).toBe(0);   // a narrower frame is centred in its cell, not stretched
  expect(r.shortTop[3]).toBe(0);     // a shorter one stands on the bottom line
  expect(r.shortFeet).toEqual([0, 0, 255, 255]);
  expect(r.none).toBeNull();
});

test.describe.configure({ timeout: 60000 });
test('an action replaces the turn: the frames slider has three stops, the idle has none, and the words say what she does', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } }) : r.fallback());
  await openApp(page);
  await openSection(page, 'assets');
  await page.click('#assetChoices [data-as="kind"][data-opt="character"]');
  await expect(page.locator('#assetChoices [data-as="dirs"]').first()).toBeVisible();
  await expect(page.locator('#assetFrames')).toHaveCount(0);
  await page.click('#assetChoices [data-as="act"][data-opt="walk"]');
  await expect(page.locator('#assetChoices [data-as="dirs"]')).toHaveCount(0);
  await expect(page.locator('#assetCountRow')).toBeHidden();
  const slider = page.locator('#assetFrames');
  expect(await slider.evaluate(e => [e.min, e.max, e.step, e.value])).toEqual(['4', '8', '2', '6']);
  await slider.fill('8');
  await expect(page.locator('#assetFramesOut')).toHaveText('8 frames');
  expect(await page.evaluate(() => assetState.frames)).toBe('8');
  const words = await page.evaluate(() => assetRequest({ ...assetState, dir: 'right' }).prompt);
  expect(words).toContain('walking');
  expect(words).not.toContain('standing');
  expect(words).toContain('facing right');
  await page.click('#assetChoices [data-as="act"][data-opt="idle"]');
  await expect(page.locator('#assetFrames')).toHaveCount(0);
  await page.click('#assetChoices [data-as="act"][data-opt="own"]');
  await expect(page.locator('#assetChoices [data-as="dirs"]').first()).toBeVisible();
  expect(await page.evaluate(() => assetRequest({ ...assetState, dir: 'front' }).prompt)).toContain('standing');
});

test('a bad saved action or frame count falls back to the defaults', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    localStorage.setItem(ASSET_KEY, JSON.stringify({ act: 'moonwalk', frames: '5' }));
    assetState.act = 'x'; assetState.frames = '99';
    assetsLoad();
    return [assetState.act, assetState.frames];
  });
  expect(r).toEqual(['own', '6']);
});

// The whole run with the 3D figure stood in for: each frame is drawn with its own pose, the same seed, the
// facing right; the frames come back lined up, with a strip, and the player shows them.
test('Make with Walk draws one request, a sheet of the four poses with one seed, cuts it into frames and keeps a strip', async ({ page }) => {
  const server = await fakeServer(page);
  const id = 'c'.repeat(64), posted = [];
  let made = 0;
  // The sheet the model would send back: 1216 x 832, four cells of 608 x 416, a red figure on cream in each.
  const sheet = makePng(1216, 832, (x, y) => { const cx = x % 608, cy = y % 416; return Math.abs(cx - 304) < 40 && cy > 50 && cy < 380 ? [200, 0, 0] : [255, 250, 230]; });
  await page.route(/api\/uploads\/c{64}\.png/, r => r.fulfill({ contentType: 'image/png', body: sheet }));
  await page.route('**/api/generate**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname.endsWith('/api/generate')) { posted.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job' + ++made } }); }
    if (url.pathname.endsWith('/api/generate')) return r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } });
    const doc = { file: id + '.png', name: 'girl knight, character, right', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(), folder: 'assets',
      asset: 'character', tags: posted.at(-1).tags, prompt: posted.at(-1).prompt, avoid: posted.at(-1).avoid, shape: 'landscape', seed: posted.at(-1).seed };
    server.items.set('uploads/' + id, doc);
    return r.fulfill({ json: { state: 'done', upload: { doc, url: 'uploads/' + id + '.png' } } });
  });
  await openApp(page);
  await openSection(page, 'assets');
  await page.evaluate(() => {
    const fig = { shape: 'figure', ry: 0, pose: { head: [1, 2, 3] } };
    window.__figure = fig;
    window.formScene = { objects: [fig], active: 0, yaw: 0, pitch: 0, fisheye: false, roll: 0 };
    window.loadSection = async () => {};
    window.showForms = () => {};
    window.formsReady = async () => {};
    window.formShotSubject = () => fig;
    window.cleanFormPose = p => p;
    window.formRigOf = () => undefined;
    window.__poses = [];
    window.formsDepthSnapshot = async sc => { window.__poses.push({ pose: sc.objects[0].pose, yaw: sc.yaw }); return new Blob(['x'], { type: 'image/png' }); };
    window.genBoxOf = async () => ({ x: 0, y: 0, w: 10, h: 20 });
    // A depth map as the page would frame it: a picture the sheet can draw (a real 64 px JPEG), the shape asked for noted.
    window.__shapes = [];
    window.genFrameImage = async (blob, mode, extra) => {
      window.__shapes.push(extra.shape);
      // Black with a white figure in the middle: its corner is black, its average a dark grey.
      const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff'; g.fillRect(22, 22, 20, 20);
      return { b64: c.toDataURL('image/jpeg').split(',')[1] };
    };
    // Every upload gets one id from the fake server and overwrites the last: what is kept is watched here.
    window.__kept = [];
    const keep = window.assetKeep;
    window.assetKeep = async (doc, canvas, extra, over) => { window.__kept.push({ extra, size: [canvas.width, canvas.height], over, prompt: doc.prompt, shape: doc.shape }); return keep(doc, canvas, extra, over); };
  });
  await page.click('#assetChoices [data-as="kind"][data-opt="character"]');
  await page.click('#assetChoices [data-as="act"][data-opt="walk"]');
  await page.locator('#assetFrames').fill('4');
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('4 frames made - in Uploads, Assets.', { timeout: 40000 });
  // One request for the whole cycle: a sheet, one picture, the control drawn from the four depth maps.
  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ asset: 'character', control: true, shape: 'landscape' });
  expect(posted[0].prompt).toContain('walking');
  expect(posted[0].prompt).toContain('facing right');
  expect(posted[0].prompt).toContain('4 poses of the same character');
  expect(posted[0].width, 'the server refuses a free size together with a picture').toBeUndefined();
  expect(posted[0].avoid, 'a sheet is not to be drawn as panels: the cut-out took a panel for the figure').toContain('panel');
  // The control sheet is one flat colour between the figures - the frames' own background (their corner), not their average:
  // a lighter band between the cells was drawn as white gutters, and every panel was cut out whole (real run, 2026-10-18).
  const gap = await page.evaluate(async b64 => {
    const img = await loadImg('data:image/jpeg;base64,' + b64);
    const c = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight }), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return { size: [c.width, c.height], bars: [[10, 10], [608, 410], [1200, 820]].map(([x, y]) => g.getImageData(x, y, 1, 1).data[0]) };
  }, posted[0].image);
  expect(gap.size).toEqual([1216, 832]);
  expect(Math.max(...gap.bars), 'the sheet between the figures is as dark as the depth map around them').toBeLessThan(8);
  const seen = await page.evaluate(() => window.__poses);
  expect(seen).toHaveLength(4);
  // 270 degrees round is -90 once wrapped: the camera on the figure's right.
  expect(seen.every(s => s.yaw === -90)).toBe(true);
  // Four different poses, and the figure the user set is as it was.
  expect(new Set(seen.map(s => JSON.stringify(s.pose))).size).toBe(4);
  expect(await page.evaluate(() => window.__figure.pose)).toEqual({ head: [1, 2, 3] });
  // 2 x 2 cells of 608 x 416 are landscape: the depth maps are framed for that.
  expect(await page.evaluate(() => window.__shapes)).toEqual(['landscape', 'landscape', 'landscape', 'landscape']);
  // The player is up, with the four frames cut from the sheet; the strip is kept beside them.
  await expect(page.locator('#assetAnim')).toBeVisible();
  expect(await page.evaluate(() => assetAnim.frames.length)).toBe(4);
  const kept = await page.evaluate(() => window.__kept);
  const strip = kept.filter(k => k.extra.includes('animation strip'));
  expect(strip).toHaveLength(1);
  expect(strip[0].extra).toEqual(expect.arrayContaining(['walk', '4 frames']));
  const aligned = kept.filter(k => k.extra.includes('aligned') && !k.extra.includes('animation strip'));
  expect(aligned.map(k => k.extra.find(t => /^frame [0-9] of 4$/.test(t)))).toEqual(['frame 1 of 4', 'frame 2 of 4', 'frame 3 of 4', 'frame 4 of 4']);
  expect(strip[0].size).toEqual([aligned[0].size[0] * 4, aligned[0].size[1]]);
  // A frame is kept with the words of one frame, not the sheet's, and as a portrait: redrawn later it is one girl, not a sheet.
  expect(aligned.every(k => !k.prompt.includes('poses of the same character') && k.shape === 'portrait')).toBe(true);
  await page.click('#assetAnimClose');
  await expect(page.locator('#assetAnim')).toBeHidden();
});

test('a cycle on one sheet: 4 frames are 2 x 2, 6 are 3 x 2, 8 are 4 x 2, and the sheet is cut back into cells in reading order', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const lay = [4, 6, 8].map(n => charSheetLayout(n));
    // A 1216 x 832 sheet whose 6 cells are each a flat colour: the cells must come back whole and in order.
    const sheet = Object.assign(document.createElement('canvas'), { width: 1216, height: 832 }), g = sheet.getContext('2d');
    const lay6 = charSheetLayout(6);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgb(' + (i * 40) + ',10,10)'; g.fillRect(Math.round((i % 3) * lay6.w), Math.round(Math.floor(i / 3) * lay6.h), Math.ceil(lay6.w), Math.ceil(lay6.h)); }
    const cells = charSheetCells(sheet, 6);
    return { lay, sizes: cells.map(c => [c.width, c.height]), reds: cells.map(c => c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data[0]),
      widths: cells.slice(0, 3).reduce((a, c) => a + c.width, 0) };
  });
  expect(r.lay.map(l => [l.cols, l.rows])).toEqual([[2, 2], [3, 2], [4, 2]]);
  expect(r.lay.map(l => [l.w, l.h])).toEqual([[608, 416], [1216 / 3, 416], [304, 416]]);
  expect(r.reds, 'reading order: left to right, then the next row').toEqual([0, 40, 80, 120, 160, 200]);
  expect(r.widths, 'a row of cells is the whole width of the sheet: no pixel lost or doubled').toBe(1216);
  expect(r.sizes).toHaveLength(6);
});

test('cells are cut in from their edges when asked, so a border or gutter the model drew there is not in the frame', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // A sheet of 4 cells (2 x 2), each with a white 6 px rim and a red middle.
    const sheet = Object.assign(document.createElement('canvas'), { width: 1216, height: 832 }), g = sheet.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1216, 832);
    g.fillStyle = '#c00';
    for (let i = 0; i < 4; i++) g.fillRect((i % 2) * 608 + 6, Math.floor(i / 2) * 416 + 6, 596, 404);
    const plain = charSheetCells(sheet, 4)[0], cut = charSheetCells(sheet, 4, CHAR_CELL_INSET)[0];
    const edge = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, 1).data; return [d[0], d[1], d[2]]; };
    return { plain: [plain.width, plain.height, edge(plain)], cut: [cut.width, cut.height, edge(cut)], inset: CHAR_CELL_INSET };
  });
  expect(r.plain).toEqual([608, 416, [255, 255, 255]]);   // as it was: the white rim is in the cell
  // 3% of the shorter side (416) is 12 px, off every side: 584 x 392, and its edge is the red middle.
  expect(r.cut).toEqual([584, 392, [204, 0, 0]]);
});

// ---- The border the model draws round a figure on a key colour (found by a real run, 2026-10-18: a frame of a walk
// came with a pink-white halo the others had not, and a loop of them would flicker).
test('on a key colour, the pink-white border over her outline goes, and a white garment with no outline stays', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const make = (w, h, draw) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d'); draw(g); return c; };
    const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
    // From the left: 4 px of a pink white (230 204 226 - blended with a magenta key), 2 px of dark outline, then blue.
    // A figure 520 px tall: the border is about 1 px in 125 of that (assetFringePasses), so 4 px of it come off.
    const bordered = make(400, 560, g => {
      g.fillStyle = 'rgb(236,210,230)'; g.fillRect(20, 20, 360, 520);
      g.fillStyle = 'rgb(10,10,16)'; g.fillRect(24, 24, 352, 512);
      g.fillStyle = 'rgb(40,90,200)'; g.fillRect(26, 26, 348, 508);
    });
    const a = assetFigureCanvas({ keyed: true, canvas: bordered });
    // A white cloak, nothing dark anywhere near: all of it is hers.
    const cloak = make(400, 560, g => { g.fillStyle = 'rgb(245,245,245)'; g.fillRect(20, 20, 360, 520); });
    const b = assetFigureCanvas({ keyed: true, canvas: cloak });
    // Trimmed: the first column that is on is the edge of what is left.
    const edge = c => { const d = c.getContext('2d').getImageData(0, c.height >> 1, c.width, 1).data; for (let x = 0; x < c.width; x++) if (d[x * 4 + 3] > 8) return [x, Array.from(d.slice(x * 4, x * 4 + 3))]; return null; };
    const plain = assetTrim(cloak);   // the cloak trimmed and nothing taken off: the size to keep
    return { bordered: [assetTrim(bordered).width, a.width, edge(a)], cloak: [b.width, b.height], plain: [plain.width, plain.height] };
  });
  // Trimmed with the border on it is wider than once the 4 px each side of the outline are gone.
  expect(r.bordered[1]).toBeLessThan(r.bordered[0]);
  expect(r.bordered[2][1]).toEqual([10, 10, 16]);   // the first pixel left is her outline
  expect(r.cloak).toEqual(r.plain);   // the cloak is as it was
});

// A walk's frame came with a flat dark ellipse of floor shadow under it, 360 px wide under feet 160 px wide (real run, 2026-10-18).
test('a dark ellipse on the floor, wider than her feet, is taken off; a boot\'s toe and sole are not', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const make = (w, h, draw) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d'); draw(g); return c; };
    const alpha = (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data[3];
    // A 100 x 400 figure in blue standing on a dark ellipse 300 wide and 14 high.
    const shadowed = make(300, 420, g => {
      g.fillStyle = 'rgb(40,90,200)'; g.fillRect(100, 10, 100, 396);
      g.fillStyle = 'rgb(5,5,8)'; g.beginPath(); g.ellipse(150, 411, 150, 7, 0, 0, 2 * Math.PI); g.fill();
    });
    const a = assetDropShadow(shadowed);
    // The same figure with only a boot's toe: a dark tip 22 wide and 8 high, past her foot.
    const toed = make(140, 420, g => {
      g.fillStyle = 'rgb(40,90,200)'; g.fillRect(20, 10, 60, 396);
      g.fillStyle = 'rgb(5,5,8)'; g.fillRect(20, 398, 82, 8);
    });
    const b = assetDropShadow(toed);
    return { shadowEdge: [alpha(shadowed, 10, 411), alpha(a, 10, 411)], underFoot: alpha(a, 150, 404), body: alpha(a, 150, 100),
      toeTip: [alpha(toed, 95, 402), alpha(b, 95, 402)], same: b === toed };
  });
  expect(r.shadowEdge).toEqual([255, 0]);   // the ellipse beyond her feet is gone
  expect(r.body).toBe(255);
  expect(r.toeTip).toEqual([255, 255]);     // a toe is a few pixels wide: not a shadow
  expect(r.same).toBe(true);                // nothing to take off: the same canvas comes back
});

test('the pixel look cuts the colours once for all the frames of a cycle, so the loop does not flicker', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // Four frames of one figure whose shades drift a little from frame to frame, as the model's do.
    const frame = i => {
      const c = Object.assign(document.createElement('canvas'), { width: 120, height: 160 }), g = c.getContext('2d');
      const k = g.createLinearGradient(0, 0, 120, 0); k.addColorStop(0, `rgb(${220 + i * 5},50,50)`); k.addColorStop(1, `rgb(40,${60 + i * 6},${210 - i * 7})`);
      g.fillStyle = k; g.beginPath(); g.ellipse(60, 80, 48, 64, 0, 0, 7); g.fill();
      return c;
    };
    const colours = cs => {
      const seen = new Set();
      for (const c of cs) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
      return seen.size;
    };
    const frames = [0, 1, 2, 3].map(frame);
    const s = { pix: '32', pixColours: '8', pixOutline: 'no', pixShared: 'own', pixPalette: [] };
    return { each: colours(frames.map(c => assetPixel(c, s))), together: colours(assetPixelFrames(frames, s)),
      off: assetPixelFrames(frames, { ...s, pix: 'off' })[0] === frames[0] };
  });
  expect(r.together, 'one palette of at most the colours asked, over every frame').toBeLessThanOrEqual(8);
  expect(r.each, 'cut frame by frame, the palettes drift apart').toBeGreaterThan(8);
  expect(r.off, 'pixel look off: the frames are as they were').toBe(true);
});

// ---- The GIF (js/gif.js). Chromium decodes a GIF itself, so the encoder is checked by what the browser sees.
test('a GIF made of canvases is read back by the browser: same size, same colours, see-through where it was', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    const mk = (fill) => { const c = Object.assign(document.createElement('canvas'), { width: 40, height: 30 }), g = c.getContext('2d'); fill(g); return c; };
    const few = mk(g => { g.fillStyle = '#e03030'; g.fillRect(4, 4, 10, 10); g.fillStyle = '#3050e0'; g.fillRect(20, 10, 12, 12); });
    // A noisy frame: far more than 255 colours and a long stream, so the dictionary fills and is cleared.
    const noisy = mk(g => { for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) { g.fillStyle = `rgb(${(x * 37 + y * 11) % 256},${(x * 5 + y * 53) % 256},${(x * y) % 256})`; g.fillRect(x, y, 1, 1); } });
    const bytes = gifEncode([few, few], 100);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/gif' }));
    const out = mk(g => g.drawImage(bmp, 0, 0)).getContext('2d').getImageData(0, 0, 40, 30).data;
    const at = (x, y) => [...out.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 4)];
    const nb = await createImageBitmap(new Blob([gifEncode([noisy], 100)], { type: 'image/gif' }));
    const want = noisy.getContext('2d').getImageData(0, 0, 40, 30).data, got = mk(g => g.drawImage(nb, 0, 0)).getContext('2d').getImageData(0, 0, 40, 30).data;
    let far = 0;
    for (let i = 0; i < want.length; i += 4) far = Math.max(far, Math.abs(want[i] - got[i]), Math.abs(want[i + 1] - got[i + 1]), Math.abs(want[i + 2] - got[i + 2]));
    return { head: String.fromCharCode(...bytes.slice(0, 6)), tail: bytes.at(-1), size: [bmp.width, bmp.height], red: at(8, 8), blue: at(25, 15), clear: at(0, 0), noisy: [nb.width, nb.height], far };
  });
  expect(r.head).toBe('GIF89a');
  expect(r.tail).toBe(0x3B);
  expect(r.size).toEqual([40, 30]);
  expect(r.red).toEqual([224, 48, 48, 255]);
  expect(r.blue).toEqual([48, 80, 224, 255]);
  expect(r.clear[3], 'where nothing was drawn, the GIF is see-through').toBe(0);
  expect(r.noisy).toEqual([40, 30]);
  expect(r.far, 'a frame of many colours is cut to 255 and still near the original').toBeLessThan(60);
});

test('Save GIF in the player downloads the frames as one file; a small pixel sprite is enlarged by whole pixels', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } }));
  await openApp(page);
  await openSection(page, 'assets');
  await page.evaluate(() => {
    const frames = [0, 1, 2].map(i => { const c = Object.assign(document.createElement('canvas'), { width: 16, height: 24 }), g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(2 + i, 2, 6, 20); return c; });
    assetAnimShow(frames, 'walk', true);
  });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#assetAnimGif')]);
  expect(dl.suggestedFilename()).toBe('walk.gif');
  const bytes = require('fs').readFileSync(await dl.path());
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  // 24 px tall -> x11 (256 / 24 rounded): 16 x 11 wide, 24 x 11 tall.
  expect([bytes.readUInt16LE(6), bytes.readUInt16LE(8)]).toEqual([176, 264]);
});

test('Onion skin shows the frames before and after faintly behind this one, and only while it is on', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } }));
  await openApp(page);
  await openSection(page, 'assets');
  await page.evaluate(() => {
    // Three frames, a 6 px square each, 10 px further along: x 2, 12, 22.
    const frames = [0, 1, 2].map(i => { const c = Object.assign(document.createElement('canvas'), { width: 30, height: 10 }), g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(2 + i * 10, 2, 6, 6); return c; });
    assetAnimShow(frames, 'walk', true);
  });
  await page.click('#assetAnimPlay');   // paused
  const alphas = () => page.evaluate(() => {
    assetAnim.i = 1; assetAnim.draw();
    const g = el('assetAnimCanvas').getContext('2d');
    return [4, 14, 24].map(x => g.getImageData(x, 5, 1, 1).data[3]);
  });
  expect(await alphas(), 'off: only the frame itself').toEqual([0, 255, 0]);
  await page.check('#assetAnimOnion');
  const on = await alphas();
  expect(on[1]).toBe(255);
  expect(on[0], 'the frame before').toBeGreaterThan(40); expect(on[0]).toBeLessThan(100);
  expect(on[2], 'the frame after').toBeGreaterThan(40); expect(on[2]).toBeLessThan(100);
  await page.uncheck('#assetAnimOnion');
  expect(await alphas()).toEqual([0, 255, 0]);
});

// A standing figure (idle) came with a floor LINE, not an ellipse: 4 dark rows with a grey row above and two pale rows
// under, all from the model's soft edge. Only the dark rows were taken off and the grey ones stayed (real run, 2026-10-18).
test('a thin floor line with a soft edge goes whole, grey rows and all, and what is under the foot stays', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 300, height: 420 }), g = c.getContext('2d');
    g.fillStyle = 'rgb(40,90,200)'; g.fillRect(100, 10, 100, 396);        // the figure
    g.fillStyle = 'rgb(140,140,150)'; g.fillRect(0, 406, 300, 1);          // grey row above the line
    g.fillStyle = 'rgb(15,12,16)'; g.fillRect(0, 407, 300, 4);             // the line, 4 rows
    g.fillStyle = 'rgba(160,150,160,0.5)'; g.fillRect(0, 411, 300, 2);     // pale rows under it
    const out = assetDropShadow(c);
    const a = (x, y) => out.getContext('2d').getImageData(x, y, 1, 1).data[3];
    return { left: [406, 407, 410, 411, 412].map(y => a(10, y)), right: [406, 409, 412].map(y => a(290, y)), foot: [a(150, 300), a(150, 409)] };
  });
  expect(r.left, 'every row of the line, the grey one above and the pale ones under, is gone left of the foot').toEqual([0, 0, 0, 0, 0]);
  expect(r.right).toEqual([0, 0, 0]);
  expect(r.foot[0], 'the body stays').toBe(255);
  expect(r.foot[1], 'the line under the foot is joined to it and stays').toBe(255);
});

// A sheet's cells came back with a paler magenta (196 118 210: 92 between its channels) than a lone picture's (232 72 181: 160): under the
// old limit of 100 it was not taken for a key, so the gaps between the legs stayed and skin was cut away (real run, 2026-10-18).
test('a paler key colour is still a key; a cream or a grey is not; and the white border comes off less on a smaller figure', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const on = (rgb, w = 200, h = 300) => {
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
      g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgb(40,90,200)'; g.fillRect(70, 40, 60, 220);
      return assetCutFigure(c);
    };
    const tall = h => Object.assign(document.createElement('canvas'), { width: 10, height: h });
    return { lavender: on('196,118,210').keyed, pink: on('232,72,181').keyed, cream: on('255,250,230').keyed, grey: on('200,200,200').keyed,
      passes: [1000, 330, 100, 2000].map(h => assetFringePasses(tall(h))) };
  });
  expect(r.lavender, 'the paler magenta of a sheet\'s cell').toBe(true);
  expect(r.pink).toBe(true);
  expect(r.cream, 'a cream is a plain background, not a key').toBe(false);
  expect(r.grey).toBe(false);
  expect(r.passes, '8 px on a figure of 1000, 3 on 330, never fewer than 2 or more than 8').toEqual([8, 3, 2, 8]);
});
