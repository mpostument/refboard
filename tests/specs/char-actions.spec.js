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
test('Make with Walk draws one request per frame, each with its own pose and one seed, and keeps a strip', async ({ page }) => {
  const server = await fakeServer(page);
  const id = 'c'.repeat(64), posted = [], poses = [];
  let made = 0;
  // A red figure on cream, 200 x 300, for the cut-out to find.
  const disc = makePng(200, 300, (x, y) => Math.abs(x - 100) < 40 && y > 40 && y < 280 ? [200, 0, 0] : [255, 250, 230]);
  await page.route(/api\/uploads\/c{64}\.png/, r => r.fulfill({ contentType: 'image/png', body: disc }));
  await page.route('**/api/generate**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname.endsWith('/api/generate')) { posted.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job' + ++made } }); }
    if (url.pathname.endsWith('/api/generate')) return r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } });
    const doc = { file: id + '.png', name: 'girl knight, character, right', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(), folder: 'assets',
      asset: 'character', tags: posted.at(-1).tags, prompt: posted.at(-1).prompt, avoid: posted.at(-1).avoid, shape: 'portrait', seed: posted.at(-1).seed };
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
    window.genFrameImage = async () => ({ b64: 'AAAA' });
    // Every upload gets one id from the fake server and overwrites the last: what is kept is watched here.
    window.__kept = [];
    const keep = window.assetKeep;
    window.assetKeep = async (doc, canvas, extra, over) => { window.__kept.push({ extra, size: [canvas.width, canvas.height], over }); return keep(doc, canvas, extra, over); };
  });
  await page.click('#assetChoices [data-as="kind"][data-opt="character"]');
  await page.click('#assetChoices [data-as="act"][data-opt="walk"]');
  await page.locator('#assetFrames').fill('4');
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('4 frames made - in Uploads, Assets.', { timeout: 40000 });
  expect(posted).toHaveLength(4);
  expect(new Set(posted.map(p => p.seed)).size).toBe(1);
  for (const p of posted) {
    expect(p).toMatchObject({ asset: 'character', control: true });
    expect(p.prompt).toContain('walking');
    expect(p.prompt).toContain('facing right');
  }
  const seen = await page.evaluate(() => window.__poses);
  expect(seen).toHaveLength(4);
  // 270 degrees round is -90 once wrapped: the camera on the figure's right.
  expect(seen.every(s => s.yaw === -90)).toBe(true);
  // Four different poses, and the figure the user set is as it was.
  expect(new Set(seen.map(s => JSON.stringify(s.pose))).size).toBe(4);
  expect(await page.evaluate(() => window.__figure.pose)).toEqual({ head: [1, 2, 3] });
  // The player is up, with the frames; the strip is kept beside them.
  await expect(page.locator('#assetAnim')).toBeVisible();
  expect(await page.evaluate(() => assetAnim.frames.length)).toBe(4);
  const kept = await page.evaluate(() => window.__kept);
  const strip = kept.filter(k => k.extra.includes('animation strip'));
  expect(strip).toHaveLength(1);
  expect(strip[0].extra).toEqual(expect.arrayContaining(['walk', '4 frames']));
  // The strip is the four lined-up frames in a row.
  const aligned = kept.filter(k => k.extra.includes('aligned') && !k.extra.includes('animation strip'));
  expect(aligned.map(k => k.extra.find(t => /^frame [0-9] of 4$/.test(t)))).toEqual(['frame 1 of 4', 'frame 2 of 4', 'frame 3 of 4', 'frame 4 of 4']);
  expect(strip[0].size).toEqual([aligned[0].size[0] * 4, aligned[0].size[1]]);
  await page.click('#assetAnimClose');
  await expect(page.locator('#assetAnim')).toBeHidden();
});

// ---- The border the model draws round a figure on a key colour (found by a real run, 2026-10-18: a frame of a walk
// came with a pink-white halo the others had not, and a loop of them would flicker).
test('on a key colour, the pink-white border over her outline goes, and a white garment with no outline stays', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const make = (w, h, draw) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d'); draw(g); return c; };
    const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
    // From the left: 4 px of a pink white (230 204 226 - blended with a magenta key), 2 px of dark outline, then blue.
    const bordered = make(60, 40, g => {
      g.fillStyle = 'rgb(236,210,230)'; g.fillRect(10, 5, 40, 30);
      g.fillStyle = 'rgb(10,10,16)'; g.fillRect(14, 9, 32, 22);
      g.fillStyle = 'rgb(40,90,200)'; g.fillRect(16, 11, 28, 18);
    });
    const a = assetFigureCanvas({ keyed: true, canvas: bordered });
    // A white cloak, nothing dark anywhere near: all of it is hers.
    const cloak = make(60, 40, g => { g.fillStyle = 'rgb(245,245,245)'; g.fillRect(10, 5, 40, 30); });
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
