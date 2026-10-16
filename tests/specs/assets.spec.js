// Game assets, phase 2 (js/assets.js, and assetSolo / assetOrient / assetIcon in js/assetsfx.js):
// the recipe a prop, a weapon or an item is asked for with, what is done to each picture after
// the model, and the view that runs it. The model is not involved: pictures are drawn here.
const { test, expect, openApp, fakeServer, makePng } = require('../helpers');

const settings = over => ({ kind: 'prop', view: 'side', thing: 'chest', theme: 'fantasy', material: 'any', simple: 'simple', ...over });
const ask = (page, s) => page.evaluate(s => assetRequest(s), s);

// ---- The recipe: found in phase 0, so these are the facts that were found.
test('a chest is asked for closed, alone, flat, and without gold', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings());
  for (const w of ['no humans', 'chest', 'closed', 'front view', 'game sprite', 'flat color', 'white background', 'fantasy', 'minimalist'])
    expect(r.prompt, w).toContain(w);
  for (const w of ['open lid', 'gold, coins', 'shadow', 'gradient', 'floor', '1girl', 'detailed'])
    expect(r.avoid, w).toContain(w);
  expect(r.asset).toBe('prop');
  // The thing is named first among the tags, so the picture is named after it.
  expect(r.tags.slice(0, 3)).toEqual(['chest', 'prop', 'side']);
});

test('a tree is not told to be closed, and top-down says from above', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings({ thing: 'tree', view: 'top' }));
  expect(r.prompt).not.toContain('closed');
  expect(r.avoid).not.toContain('gold, coins');
  expect(r.avoid).not.toContain('open lid');
  expect(r.prompt).toContain('from above, 3/4 view');
});

test('a weapon is asked for one, whole, and the set it tends to draw is kept out', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings({ kind: 'weapon', thing: 'Sword', material: 'steel' }));
  expect(r.prompt).toContain('(single steel sword:1.3)');
  expect(r.prompt).toContain('full length');
  expect(r.avoid).toContain('weapon rack');
  expect(r.tags[0]).toBe('sword');
  expect(r.asset).toBe('weapon');
  // No view for a weapon.
  expect(r.tags).not.toContain('side');
});

test('simplicity is its own setting', async ({ page }) => {
  await openApp(page);
  const simple = await ask(page, settings({ simple: 'simple' })), detailed = await ask(page, settings({ simple: 'detailed' }));
  expect(simple.prompt).toContain('limited color palette');
  expect(simple.avoid).toContain('intricate');
  expect(detailed.prompt).not.toContain('minimalist');
  expect(detailed.avoid).not.toContain('intricate');
});

test('every size asked for is one the server takes: a multiple of 64, at most 1.6 megapixels', async ({ page }) => {
  await openApp(page);
  for (const kind of ['prop', 'weapon', 'item']) {
    const { width, height } = await ask(page, settings({ kind }));
    expect(width % 64 + height % 64).toBe(0);
    expect(width * height).toBeLessThanOrEqual(1_600_000);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(256);
  }
});

test('an empty name falls back to the kind\'s first idea, and a long one is cut', async ({ page }) => {
  await openApp(page);
  expect((await ask(page, settings({ kind: 'item', thing: '  ' }))).tags[0]).toBe('potion');
  expect((await ask(page, settings({ thing: 'x'.repeat(100) }))).tags[0].length).toBe(40);
});

// ---- After the model. Shapes are drawn on a transparent canvas in the page.
// A sword stood upright: a long blade, a wide guard near the foot, a thin grip below. The blade
// is the heavy part, so the mass lies toward the tip.
const SWORD = `(() => {
  const c = Object.assign(document.createElement('canvas'), { width: 200, height: 320 });
  const g = c.getContext('2d'); g.fillStyle = '#c33';
  g.fillRect(85, 50, 30, 170);    // blade
  g.beginPath(); g.moveTo(85, 50); g.lineTo(100, 10); g.lineTo(115, 50); g.fill();   // its point
  g.fillRect(70, 220, 60, 12);    // guard
  g.fillRect(97, 232, 6, 50);     // grip
  g.beginPath(); g.arc(100, 290, 8, 0, 7); g.fill();   // pommel
  return c;
})()`;
// An axe stood upright: a long haft and a heavy head at the top.
const AXE = `(() => {
  const c = Object.assign(document.createElement('canvas'), { width: 200, height: 320 });
  const g = c.getContext('2d'); g.fillStyle = '#c33';
  g.fillRect(96, 20, 8, 280);     // haft
  g.fillRect(60, 20, 80, 60);     // head
  return c;
})()`;
// The row of the widest part, as a share of the height - 0 at the top, 1 at the bottom.
const WIDEST = `(c => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let best = 0, row = 0;
  for (let y = 0; y < c.height; y++) { let n = 0; for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) n++; if (n > best) { best = n; row = y; } }
  return row / c.height;
})`;

test('a sword drawn crooked is stood upright, tip still up', async ({ page }) => {
  await openApp(page);
  for (const deg of [0, 35, -50, 20]) {
    const r = await page.evaluate(([sword, widest, deg]) => {
      const crooked = assetRotate(eval(sword), deg * Math.PI / 180);
      const o = assetOrient(crooked);
      return { w: o.canvas.width, h: o.canvas.height, guard: eval(widest)(o.canvas) };
    }, [SWORD, WIDEST, deg]);
    expect(r.h, `${deg} deg: taller than wide`).toBeGreaterThan(r.w * 2);
    // The guard is below the middle: the tip is up.
    expect(r.guard, `${deg} deg: tip up`).toBeGreaterThan(0.6);
  }
});

test('an axe hanging head down is turned over: its mass is the head, which goes up', async ({ page }) => {
  await openApp(page);
  for (const deg of [0, 180, 150, -140]) {
    const r = await page.evaluate(([axe, widest, deg]) => {
      const o = assetOrient(assetRotate(eval(axe), deg * Math.PI / 180));
      return { w: o.canvas.width, h: o.canvas.height, head: eval(widest)(o.canvas) };
    }, [AXE, WIDEST, deg]);
    expect(r.h, `${deg} deg: taller than wide`).toBeGreaterThan(r.w * 2);
    expect(r.head, `${deg} deg: head up`).toBeLessThan(0.4);
  }
});

test('a round piece has no up and is left as it is', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 100 });
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.beginPath(); g.arc(50, 50, 40, 0, 7); g.fill();
    const o = assetOrient(c);
    return { same: o.canvas === c, turned: o.turned };
  });
  expect(r).toEqual({ same: true, turned: 0 });
});

test('of a set of swords only the biggest is kept, trimmed to itself', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 300, height: 200 });
    const g = c.getContext('2d'); g.fillStyle = '#c33';
    g.fillRect(20, 20, 30, 150);     // the big one
    g.fillRect(120, 40, 20, 60);     // two small ones
    g.fillRect(200, 60, 20, 60);
    const s = assetSolo(c);
    const d = s.canvas.getContext('2d').getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    let opaque = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) opaque++;
    return { w: s.canvas.width, h: s.canvas.height, pieces: s.pieces, opaque };
  });
  expect(r.pieces).toBe(3);
  // 30 x 150 and the pad all round (CUT_PAD = 4); nothing of the others in it.
  expect([r.w, r.h]).toEqual([38, 158]);
  expect(r.opaque).toBe(30 * 150);
});

test('pieces two pixels apart are one: a guard the outline parts from the blade stays', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 200 });
    const g = c.getContext('2d'); g.fillStyle = '#c33';
    g.fillRect(45, 10, 10, 120);
    g.fillRect(20, 132, 60, 8);      // a 1-px gap above it
    return assetSolo(c).pieces;
  });
  expect(r).toBe(1);
});

test('an icon is a framed square with the piece in the middle, and a weapon lies diagonally', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(sword => {
    const icon = assetIcon(eval(sword), { size: 128, diagonal: true });
    const g = icon.getContext('2d'), px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
    return { w: icon.width, h: icon.height, corner: px(0, 0), frame: px(10, 64), middle: px(64, 64), above: px(64, 20), tipSide: [px(100, 28)[3], px(28, 28)[3]] };
  }, SWORD);
  expect([r.w, r.h]).toEqual([128, 128]);
  expect(r.corner[3]).toBe(0);                 // outside the rounded corner: nothing
  expect(r.frame[3]).toBe(255);                // the frame fills the rest
  expect(r.middle).not.toEqual(r.frame);       // the piece is over it
});

// ---- The view, with a server that has a ComfyUI. A white-backed disc stands in for what it makes.
const CREAM = [250, 248, 244], RED = [200, 30, 40];
const disc = makePng(200, 200, (x, y) => Math.hypot(x - 100, y - 100) < 60 ? RED : CREAM);

async function setup(page) {
  const server = await fakeServer(page);
  const id = 'c'.repeat(64);
  const posted = [];
  let made = 0;
  await page.route(/api\/uploads\/c{64}\.png/, r => r.fulfill({ contentType: 'image/png', body: disc }));
  await page.route('**/api/generate**', async r => {
    const req = r.request(), url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname.endsWith('/api/generate')) {
      posted.push(JSON.parse(req.postData()));
      return r.fulfill({ status: 202, json: { id: 'job' + ++made } });
    }
    if (url.pathname.endsWith('/api/generate')) return r.fulfill({ json: { available: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } });
    const doc = { file: id + '.png', name: 'chest, prop, side', type: 'image/png', from: 'generate', bytes: 100, t: Date.now(), folder: 'assets',
      asset: posted.at(-1).asset, tags: posted.at(-1).tags, prompt: posted.at(-1).prompt, avoid: posted.at(-1).avoid, shape: 'square', seed: made };
    server.items.set('uploads/' + id, doc);
    return r.fulfill({ json: { state: 'done', upload: { doc, url: 'uploads/' + id + '.png' } } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="assets"]').click();
  return { server, posted };
}

test('the view is in the rail only with a ComfyUI, and says what it is', async ({ page }) => {
  await fakeServer(page);
  await openApp(page);
  await expect(page.locator('.nav-item[data-view="assets"]')).toBeHidden();
  const s = await setup(page);
  await expect(page.locator('#viewTitle')).toHaveText('Game assets');
  await expect(page.locator('#assetChoices [data-as="kind"]')).toHaveCount(3);
  expect(s.posted).toEqual([]);
});

test('Make sends one request per picture with a free size and the kind, and keeps the cut-outs', async ({ page }) => {
  const { posted } = await setup(page);
  await page.selectOption('#assetCount', '2');
  const uploads = [];
  page.on('request', r => { if (r.method() === 'POST' && /api\/uploads$/.test(r.url())) uploads.push(r.url()); });
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('2 made - in Uploads, Assets.');
  expect(posted).toHaveLength(2);
  expect(posted[0]).toMatchObject({ width: 1024, height: 1024, asset: 'prop' });
  expect(posted[0].prompt).toContain('chest');
  expect(posted[0].shape).toBeUndefined();
  // A prop: the cut-out only, no icon.
  expect(uploads).toHaveLength(2);
  await expect(page.locator('#assetGo')).toHaveText('Make');
});

test('a weapon is asked tall, and keeps an icon beside the cut-out', async ({ page }) => {
  const { posted, server } = await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="weapon"]');
  await expect(page.locator('#assetThing')).toHaveValue('sword');
  await expect(page.locator('#assetIconRow')).toBeVisible();
  await page.selectOption('#assetCount', '1');
  const uploads = [];
  page.on('request', r => { if (r.method() === 'POST' && /api\/uploads$/.test(r.url())) uploads.push(r.url()); });
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('Made - in Uploads, Assets.');
  expect(posted[0]).toMatchObject({ width: 768, height: 1152, asset: 'weapon' });
  expect(uploads).toHaveLength(2);   // the cut-out and its icon
  const docs = [...server.items].filter(([k]) => k.startsWith('uploads/')).map(([, v]) => v);
  const icon = docs.find(d => (d.tags || []).includes('icon'));
  expect(icon).toBeTruthy();
  expect(icon.tags).toContain('128x128');
});

test('switching the kind swaps the ideas, and the choice is remembered', async ({ page }) => {
  await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="item"]');
  await expect(page.locator('#assetThings [data-thing="potion"]')).toBeVisible();
  await expect(page.locator('#assetChoices [data-as="view"]')).toHaveCount(0);   // an item has no view
  await page.click('#assetThings [data-thing="key"]');
  await expect(page.locator('#assetThing')).toHaveValue('key');
  await page.reload();
  await page.locator('.nav-item[data-view="assets"]').click();
  await expect(page.locator('#assetThing')).toHaveValue('key');
});

test('a ComfyUI that is not answering disables Make and says why', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: false, configured: true, reason: 'ComfyUI is not answering.' } }));
  await openApp(page);
  await page.locator('.nav-item[data-view="assets"]').click();
  await expect(page.locator('#assetOffline')).toContainText('not answering');
  await expect(page.locator('#assetGo')).toBeDisabled();
});
