// Game assets, phase 2 (js/assets.js, and assetSolo / assetOrient / assetIcon in js/assetsfx.js):
// the recipe a prop, a weapon or an item is asked for with, what is done to each picture after
// the model, and the view that runs it. The model is not involved: pictures are drawn here.
const { openSection, test, expect, openApp, fakeServer, makePng } = require('../helpers');

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

// Found by a real run (2026-10-17, 4 seeds each): the sword's words ("vertical, pointing up, full length")
// made a ribbon on a stick of "bow" and a framed card of "shield".
test('a bow is an archery bow, not a ribbon, and is not told to point up', async ({ page }) => {
  await openApp(page);
  for (const thing of ['bow', 'wooden longbow', 'Recurve Bow']) {
    const r = await ask(page, settings({ kind: 'weapon', thing }));
    expect(r.prompt, thing).toContain('archery bow');
    expect(r.prompt, thing).toContain('bowstring');
    expect(r.prompt, thing).not.toContain('pointing up');
    expect(r.avoid, thing).toContain('ribbon');
    expect(r.avoid, thing).toContain('hair bow');
  }
  // A crossbow, and a bow tie, are not a bow.
  expect((await ask(page, settings({ kind: 'weapon', thing: 'crossbow' }))).prompt).toContain('pointing up');
});

test('a shield is drawn square, from the front, and is not asked to be a tall vertical card', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings({ kind: 'weapon', thing: 'round shield', material: 'iron' }));
  expect(r.prompt).toContain('(single iron round shield:1.3)');
  expect(r.prompt).toContain('front view');
  for (const w of ['pointing up', 'vertical', 'full length']) expect(r.prompt, w).not.toContain(w);
  expect([r.width, r.height]).toEqual([1024, 1024]);
  expect(r.tags).toContain('1024x1024');
  // The sword keeps the tall shape and its words.
  const sword = await ask(page, settings({ kind: 'weapon', thing: 'sword' }));
  expect([sword.width, sword.height]).toEqual([768, 1152]);
  expect(sword.prompt).toContain('pointing up');
});

test('a weapon and an item keep out the frame, card or plaque the model draws behind them', async ({ page }) => {
  await openApp(page);
  for (const kind of ['weapon', 'item']) {
    const r = await ask(page, settings({ kind, thing: kind === 'weapon' ? 'mace' : 'potion' }));
    for (const w of ['border', 'frame', 'card', 'plaque', 'backdrop']) expect(r.avoid, `${kind} ${w}`).toContain(w);
  }
});

test('a bow is cut with its holes cleared, a sword is not', async ({ page }) => {
  await openApp(page);
  // The gap between the limbs and the string is background; the white of a blade is the blade.
  const r = await page.evaluate(() => ({ bow: !!weaponRecipe('wooden bow').holes, sword: !!(weaponRecipe('sword') || {}).holes }));
  expect(r).toEqual({ bow: true, sword: false });
});

// Found by a real run (2026-10-17, 4 seeds each, 7 items): a row of three bottles, a key on a slab, a scroll or
// an apple in a stone frame, a coin on a rounded card, a ring filled with white.
test('an item the table knows is drawn by words of its own; one it does not keeps the general ones', async ({ page }) => {
  await openApp(page);
  const potion = await ask(page, settings({ kind: 'item', thing: 'Health Potion' }));
  expect(potion.prompt).toContain('(single health potion:1.3)');
  expect(potion.prompt).toContain('one glass bottle');
  expect(potion.avoid).toContain('row of bottles');
  expect(potion.avoid).toContain('frame');          // the backdrop words stay
  expect(potion.tags[0]).toBe('health potion');
  const coin = await ask(page, settings({ kind: 'item', thing: 'coin' }));
  expect(coin.prompt).toContain('close-up');
  expect(coin.avoid).toContain('rounded square');
  expect(coin.avoid).toContain('pixel art');        // made afterwards (phase 6), not drawn coarse by the model
  // "bow" of a key is a ribbon bow to the model, as a bow was (real run 2026-10-17): the key is asked for by other words.
  const key = await ask(page, settings({ kind: 'item', thing: 'key' }));
  expect(key.prompt).not.toMatch(/\bbow\b/);
  expect(key.prompt).toContain('skeleton key');
  // Not in the table: the old words, and no "single" weight.
  const feather = await ask(page, settings({ kind: 'item', thing: 'feather' }));
  expect(feather.prompt).toContain('solo, centered, object focus');
  expect(feather.prompt).not.toContain(':1.3)');
  expect(feather.avoid).toContain('plaque');
});

test('every item idea in the list has a recipe, and only a ring or a key is cut with its holes cleared', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ({
    ideas: assetKind('item').things.map(t => [t, !!itemRecipe(t)]),
    holes: ITEM_RECIPES.filter(x => x.holes).map(x => x.name),
    // An earring and a "bring" are not a ring; a bookmark is not a book
    near: ['earring', 'bookmark', 'keyboard'].map(t => !!itemRecipe(t)),
  }));
  for (const [t, has] of r.ideas) expect(has, t).toBe(true);
  expect(r.holes.sort()).toEqual(['key', 'ring']);
  expect(r.near).toEqual([false, false, false]);
});

test('the interface says which names of a weapon and an item have words of their own', async ({ page }) => {
  await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="item"]');
  const note = page.locator('#assetChoices .gen-note');
  await expect(note).toContainText('potion');
  await expect(note).toContainText('mushroom');
  await page.click('#assetChoices [data-as="kind"][data-opt="weapon"]');
  await expect(note).toContainText('bow');
  await expect(note).toContainText('shield');
  // A prop has none
  await page.click('#assetChoices [data-as="kind"][data-opt="prop"]');
  await expect(note).toHaveCount(0);
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

// ---- Tiles. What phase 0 found per ground, and what a tile is not told that a sprite is.
test('a tile is asked for as a texture: no sprite style, no outline, no "floor" kept out', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings({ kind: 'tile', thing: 'grass', material: 'iron' }));
  for (const w of ['grass', 'seamless texture', 'tileable', 'flat color', 'from above', 'no humans']) expect(r.prompt, w).toContain(w);
  for (const w of ['white background', 'thick outline', 'game sprite', 'iron']) expect(r.prompt, w).not.toContain(w);
  // A sprite keeps "floor, ground, texture" out; a tile is those.
  for (const w of ['floor', 'ground', 'texture', 'patterns']) expect(r.avoid, w).not.toContain(w);
  expect(r.avoid).toContain('horizon');
  expect([r.width, r.height, r.asset]).toEqual([1024, 1024, 'tile']);
  expect(r.tags.slice(0, 2)).toEqual(['grass', 'tile']);
});

test('water has no "tile" word, soil keeps bricks out, an unknown ground gets the general recipe', async ({ page }) => {
  await openApp(page);
  const water = await ask(page, settings({ kind: 'tile', thing: 'water' })), dirt = await ask(page, settings({ kind: 'tile', thing: 'dirt' }));
  expect(water.prompt).toContain('wavy lines');
  expect(water.prompt).not.toMatch(/tile/);
  expect(dirt.avoid).toContain('bricks');
  // A real run: "waves, ripples" drew a whirlpool.
  expect(water.avoid).toContain('whirlpool');
  const moss = await ask(page, settings({ kind: 'tile', thing: 'Moss' }));
  expect(moss.prompt).toContain('moss, seamless texture, tileable');
});

// ---- Tiles, the half that needs no model.
const PIX = `(c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data)`;

test('rolling by half puts the old edges in the middle, and what left one side comes in on the other', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(pix => {
    const px = eval(pix);
    const c = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }), g = c.getContext('2d');
    g.fillStyle = '#888'; g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#f00'; g.fillRect(0, 0, 1, 8);        // a red first column
    g.fillStyle = '#00f'; g.fillRect(7, 0, 1, 8);        // a blue last column
    const o = tileRoll(c, 4, 4);
    return { red: px(o, 4, 0), blue: px(o, 3, 0), edges: [px(o, 0, 0), px(o, 7, 0)], back: px(tileRoll(o, -4, -4), 0, 3) };
  }, PIX);
  expect(r.red.slice(0, 3)).toEqual([255, 0, 0]);   // the first column is now the middle one
  expect(r.blue.slice(0, 3)).toEqual([0, 0, 255]);
  expect(r.edges.map(e => e[3])).toEqual([255, 255]);   // nothing was lost: no gap at an edge
  expect(r.back.slice(0, 3)).toEqual([255, 0, 0]);   // and it goes back
});

// A real run: the model drew the mended cross a shade lighter than the rest, a grid of lines at 3 x 3.
test('the mended cross is moved to the tone of the rest, and the rest is not touched', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(pix => {
    const px = eval(pix);
    const c = Object.assign(document.createElement('canvas'), { width: 20, height: 20 }), g = c.getContext('2d');
    g.fillStyle = 'rgb(100,150,50)'; g.fillRect(0, 0, 20, 20);
    g.fillStyle = 'rgb(130,180,80)'; g.fillRect(8, 0, 4, 20); g.fillRect(0, 8, 20, 4);   // the cross, 30 lighter
    const o = tileMatch(c, tileCross(20, 20, 4));
    return { cross: px(o, 9, 0), rest: px(o, 2, 2), source: px(c, 9, 0) };
  }, PIX);
  expect(r.cross.slice(0, 3)).toEqual([100, 150, 50]);
  expect(r.rest.slice(0, 3)).toEqual([100, 150, 50]);
  expect(r.source.slice(0, 3)).toEqual([130, 180, 80]);   // a new canvas: the model's own is left as it was
});

test('the seam score is 1 for a picture that wraps, far over for one that does not, and rolling moves a seam inside', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const make = f => {
      const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), g = c.getContext('2d');
      const d = g.createImageData(128, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = f(x, y), i = (y * 128 + x) * 4; d.data.set([v, v * 0.8, 255 - v, 255], i); }
      g.putImageData(d, 0, 0);
      return c;
    };
    const ramp = make((x, y) => Math.round(x * 2 + y * 0.5));            // 0 .. 255 and then back to 0: a seam
    const wave = make((x, y) => Math.round(128 + 100 * Math.sin(2 * Math.PI * x / 128) * Math.cos(2 * Math.PI * y / 128)));   // wraps by itself
    return { ramp: tileSeam(ramp), wave: tileSeam(wave), rolled: tileSeam(tileRoll(ramp, 64, 64)) };
  });
  expect(r.ramp, 'a ramp has a seam').toBeGreaterThan(5);
  expect(r.wave, 'a wave wraps').toBeLessThan(1.4);
  // Rolled by half, the ramp's jump is in the middle and its edges meet: this is what mending starts from.
  expect(r.rolled).toBeLessThan(1.4);
});

test('the cross is white through the middle and black in the corners; the grid and the shrink are the size they say', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(pix => {
    const px = eval(pix);
    const m = tileCross(100, 100, 20);
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = c.getContext('2d');
    g.fillStyle = '#c33'; g.fillRect(0, 0, 64, 64);
    const small = tileShrink(c, 16);
    return { mid: px(m, 50, 5), side: px(m, 5, 50), corner: px(m, 5, 5), grid: [tileGrid(c).width, tileGrid(c, 2).height], small: [small.width, small.height, px(small, 8, 8)] };
  }, PIX);
  expect(r.mid.slice(0, 3)).toEqual([255, 255, 255]);
  expect(r.side.slice(0, 3)).toEqual([255, 255, 255]);
  expect(r.corner.slice(0, 3)).toEqual([0, 0, 0]);
  expect(r.grid).toEqual([192, 128]);
  expect(r.small).toEqual([16, 16, [204, 51, 51, 255]]);
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
  await openSection(page, 'assets');
  return { server, posted };
}

test('the view is in the rail only with a ComfyUI, and says what it is', async ({ page }) => {
  await fakeServer(page);
  await openApp(page);
  await expect(page.locator('.nav-item[data-view="assets"]')).toBeHidden();
  const s = await setup(page);
  await expect(page.locator('#viewTitle')).toHaveText('Game assets');
  await expect(page.locator('#assetChoices [data-as="kind"]')).toHaveCount(5);
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
  await openSection(page, 'assets');
  await expect(page.locator('#assetThing')).toHaveValue('key');
});

test('a ComfyUI that is not answering disables Make and says why', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: false, configured: true, reason: 'ComfyUI is not answering.' } }));
  await openApp(page);
  await openSection(page, 'assets');
  await expect(page.locator('#assetOffline')).toContainText('not answering');
  await expect(page.locator('#assetGo')).toBeDisabled();
});

test('a tile: asked of the model whole, the cross drawn again, one mended tile kept - and shown laid 3 x 3', async ({ page }) => {
  const { posted, server } = await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="tile"]');
  await expect(page.locator('#assetThing')).toHaveValue('grass');
  // A tile has a size, and none of the rows that are for a sprite.
  await expect(page.locator('#assetChoices [data-as="size"]')).toHaveCount(4);
  await expect(page.locator('#assetChoices [data-as="material"]')).toHaveCount(0);
  await expect(page.locator('#assetChoices [data-as="view"]')).toHaveCount(0);
  await expect(page.locator('#assetIconRow')).toBeHidden();
  await page.click('#assetChoices [data-as="size"][data-opt="256"]');
  await page.selectOption('#assetCount', '1');
  const uploads = [];
  page.on('request', r => { if (r.method() === 'POST' && /api\/uploads$/.test(r.url())) uploads.push(r.url()); });
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('Made - in Uploads, Assets.');
  // Two jobs: the tile at the model's size, then the rolled tile with the cross as the mask.
  expect(posted).toHaveLength(2);
  expect(posted[0]).toMatchObject({ width: 1024, height: 1024, asset: 'tile' });
  expect(posted[0].image).toBeUndefined();
  expect(posted[1]).toMatchObject({ shape: 'square', asset: 'tile', denoise: 0.6 });
  expect(posted[1].image).toBeTruthy();
  expect(posted[1].mask).toBeTruthy();
  expect(posted[1].width).toBeUndefined();
  expect(posted[1].prompt).toBe(posted[0].prompt);
  // One tile kept, at the size chosen, and listed laid 3 x 3.
  expect(uploads).toHaveLength(1);
  const docs = [...server.items].filter(([k]) => k.startsWith('uploads/')).map(([, v]) => v);
  const kept = docs.find(d => (d.tags || []).includes('256x256'));
  expect(kept).toBeTruthy();
  expect(kept.tags).not.toContain('1024x1024');
  expect(kept.tags.some(t => t === 'seamless' || t === 'seam visible')).toBe(true);
  await expect(page.locator('#assetResults .asset-3x3')).toHaveCount(1);
});

// ---- Characters (phase 4). The recipe, and the half that needs no model: setting the directions on one line.
test('a character is asked for solo, whole, facing the way its direction says, and no chibi', async ({ page }) => {
  await openApp(page);
  const front = await ask(page, settings({ kind: 'character', thing: 'girl knight', dir: 'front' }));
  const left = await ask(page, settings({ kind: 'character', thing: 'girl knight', dir: 'left' }));
  for (const w of ['solo', 'girl knight', 'full body', 'standing', 'facing viewer', 'anime style', 'soft shading', 'thin outline', 'magenta background']) expect(front.prompt, w).toContain(w);
  // A white cloak is lost on a white background: the background is a colour she does not wear.
  const key = async thing => (await ask(page, settings({ kind: 'character', thing }))).prompt.match(/solid (\w+) background/)[1];
  expect([await key('girl knight, silver armor'), await key('girl mage, pink dress'), await key('boy, red hair, green coat'), await key('girl, purple dress, green boots')])
    .toEqual(['magenta', 'green', 'cyan', 'cyan']);
  // Not the sprite recipe's flat shapes with a thick outline: the user asked for ordinary anime.
  for (const w of ['thick outline', 'flat color', 'cel shading']) expect(front.prompt, w).not.toContain(w);
  // Soft shading is what the sprite recipe keeps out as "gradient".
  for (const w of ['gradient', 'glossy']) expect(front.avoid, w).not.toContain(w);
  expect(front.prompt).not.toContain('no humans');
  expect(left.prompt).toContain('facing left');
  expect(left.prompt).not.toContain('facing viewer');
  // Not a human-free recipe: the sprite recipe's "human, 1girl" is not kept out here, but a chibi and a sheet are.
  for (const w of ['chibi', 'character sheet', 'turnaround', 'mannequin']) expect(front.avoid, w).toContain(w);
  expect(front.avoid).not.toMatch(/\b1girl\b/);
  // Told apart only by the direction: the same words otherwise, so the seed means the same thing.
  expect(front.avoid).toBe(left.avoid);
  expect([front.shape, front.asset, front.width, front.tags.slice(0, 3)]).toEqual(['portrait', 'character', undefined, ['girl knight', 'character', 'front']]);
});

test('the top-down view of a character is from above; material is not part of one', async ({ page }) => {
  await openApp(page);
  const r = await ask(page, settings({ kind: 'character', thing: 'mage', view: 'top', material: 'iron' }));
  expect(r.prompt).toContain('from above');
  expect(r.prompt).not.toContain('iron');
});

test('4 directions go round the figure by quarters and 8 by eighths, the front first', async ({ page }) => {
  await openApp(page);
  const d = await page.evaluate(() => ({ four: CHAR_DIRS[4].map(([, a]) => a), eight: CHAR_DIRS[8].map(([, a]) => a),
    faces: [...CHAR_DIRS[4], ...CHAR_DIRS[8]].every(([id]) => !!CHAR_FACE[id]) }));
  expect(d.four).toEqual([0, 90, 180, 270]);
  expect(d.eight).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  expect(d.faces).toBe(true);
});

test('aligning sets every direction to one height, on one floor line, in one frame', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // Three cut-outs: a tall front, a narrow shorter side, a back as tall as the front. Each a solid block.
    const make = (w, h) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, w, h); return c; };
    const a = assetAlign([make(40, 100), make(24, 90), make(40, 100)]);
    // The lowest and the highest opaque row, and the opaque columns, of each result.
    const rows = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let top = c.height, bot = -1, l = c.width, rr = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { top = Math.min(top, y); bot = Math.max(bot, y); l = Math.min(l, x); rr = Math.max(rr, x); }
      return { top, bot, l, r: rr }; };
    return { size: [a.width, a.height], boxes: a.canvases.map(c => ({ size: [c.width, c.height], ...rows(c) })), none: assetAlign([]) };
  });
  // The median height of 100, 90, 100 is 100: the shorter picture is scaled up to it, not the others down.
  expect(r.size[1]).toBe(100 + 2 * 4);
  expect(new Set(r.boxes.map(b => b.size.join('x'))).size).toBe(1);
  for (const b of r.boxes) { expect(b.bot, 'feet on one line').toBe(r.size[1] - 4 - 1); expect(b.top, 'one height').toBe(4); }
  // Centred: the margin left and right of the narrow one is the same (within a pixel).
  const narrow = r.boxes[1];
  expect(Math.abs(narrow.l - (r.size[0] - 1 - narrow.r))).toBeLessThanOrEqual(1);
  expect(r.none).toBeNull();
});

test('a bow held out to one side does not move the body in the frame', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // A body 20 wide and 100 tall; the second also has a bow: 30 more pixels out to the right over 8 rows at arm height.
    const make = bow => { const c = Object.assign(document.createElement('canvas'), { width: bow ? 50 : 20, height: 100 }), g = c.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 20, 100); if (bow) g.fillRect(20, 40, 30, 8); return c; };
    const a = assetAlign([make(false), make(true)]);
    // The columns the body (rows 20..30, above the bow) covers in each result.
    const body = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const y = Math.round(c.height * 0.25); let l = c.width, rr = -1;
      for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { l = Math.min(l, x); rr = Math.max(rr, x); }
      return [l, rr]; };
    return { size: [a.width, a.height], bodies: a.canvases.map(body) };
  });
  // The same columns in both frames: the body stays put, and the bow takes room on the right only.
  expect(r.bodies[1]).toEqual(r.bodies[0]);
  // The frame holds the whole bow: 20 of body + 30 of bow + the padding.
  expect(r.size[0]).toBe(50 + 2 * 4);
  // And the body is not in the middle of that frame - it is on the left, where the bow leaves room.
  expect(r.bodies[0][0]).toBe(4);
});

test('a character is named by its whole look, so the colours reach the model; the picture is named by the first part', async ({ page }) => {
  await openApp(page);
  const look = 'Girl knight, short brown hair, silver armor, blue skirt, blue boots';
  const r = await ask(page, settings({ kind: 'character', thing: look }));
  // Not cut to 40 characters like the name of a prop: "silver ar" was what the first real run sent.
  for (const w of ['short brown hair', 'silver armor', 'blue skirt', 'blue boots']) expect(r.prompt, w).toContain(w);
  expect(r.tags.slice(0, 2)).toEqual(['girl knight', 'character']);
  // Still a limit.
  expect((await ask(page, settings({ kind: 'character', thing: 'x, ' + 'y'.repeat(300) }))).prompt.length).toBeLessThan(700);
});

test('turned to several directions the colours in the look are weighted, so the trousers hold from one direction to the next', async ({ page }) => {
  await openApp(page);
  const look = 'Girl knight, short brown hair, silver armor, blue skirt, hood, brown trousers';
  const four = await ask(page, settings({ kind: 'character', thing: look, dirs: '4' }));
  // Each part that names a colour; the name and a part with no colour are left as they are.
  for (const part of ['(short brown hair:1.2)', '(silver armor:1.2)', '(blue skirt:1.2)', '(brown trousers:1.2)']) expect(four.prompt, part).toContain(part);
  expect(four.prompt).toContain('girl knight, ');
  expect(four.prompt).not.toContain('(girl knight');
  expect(four.prompt).not.toContain('(hood');
  // One side view is one picture: nothing to agree with, so the words go as they were.
  const one = await ask(page, settings({ kind: 'character', thing: look, dirs: '1' }));
  expect(one.prompt).not.toContain('(silver armor');
  expect(one.prompt).toContain('silver armor');
});

test('a character request fits what the server accepts (Program.cs: prompt and avoid up to 800), whatever the settings', async ({ page }) => {
  await openApp(page);
  // The avoid list grew past the old limit of 400 and the server answered 400 to every Character - a unit test
  // never saw it, because the server was not in it. So the longest the settings can make is held to the limit.
  const longest = await page.evaluate(() => {
    let prompt = 0, avoid = 0;
    const look = 'girl knight, short brown hair, silver armor, blue skirt, blue boots, white cloak, gold belt, red scarf'.padEnd(ASSET_LOOK_MAX, ' ');
    for (const simple of ASSET_SIMPLE.map(x => x.id)) for (const dirs of ['1', '4', '8']) for (const view of ['side', 'top']) {
      const r = assetRequest({ ...ASSET_DEFAULTS, kind: 'character', thing: look, simple, dirs, view, theme: 'steampunk', dir: 'frontLeft' });
      prompt = Math.max(prompt, r.prompt.length); avoid = Math.max(avoid, r.avoid.length);
    }
    return { prompt, avoid };
  });
  expect(longest.prompt).toBeLessThanOrEqual(800);
  expect(longest.avoid).toBeLessThanOrEqual(800);
});

test('a character with no figure in 3D forms takes you there, with the Figure button in focus', async ({ page }) => {
  const s = await setup(page);
  // A server with a ControlNet (the last route registered wins).
  await page.route('**/api/generate', r => r.request().method() === 'GET' ? r.fulfill({ json: { available: true, control: true, checkpoint: 'test.safetensors', quality: 'masterpiece' } }) : r.fallback());
  await page.reload();
  await openSection(page, 'assets');
  await page.click('#assetChoices [data-as="kind"][data-opt="character"]');
  // Only the turned kinds need the figure: the one side view is the next test.
  await page.click('#assetChoices [data-as="dirs"][data-opt="4"]');
  await page.click('#assetGo');
  await expect(page.locator('#viewTitle')).toHaveText(/3D forms/i);
  await expect(page.locator('#formShapes [data-shape="figure"]')).toBeFocused();
  expect(s.posted).toEqual([]);
});

test('a character drawn from one side needs no 3D figure: free poses, one request per candidate, no depth map', async ({ page }) => {
  const s = await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="character"]');
  // The count row is the candidates here, and goes away for the turned kinds.
  await expect(page.locator('#assetCountRow')).toBeVisible();
  await page.selectOption('#assetCount', '2');
  await page.click('#assetGo');
  await expect(page.locator('#assetGo')).toHaveText('Make');
  expect(s.posted).toHaveLength(2);
  for (const p of s.posted) {
    expect(p).toMatchObject({ asset: 'character', shape: 'portrait' });
    expect(p.image).toBeUndefined();
    expect(p.control).toBeFalsy();
    expect(p.prompt).toContain('facing right');
  }
  await expect(page.locator('#viewTitle')).toHaveText(/Game assets/i);
  await page.click('#assetChoices [data-as="dirs"][data-opt="4"]');
  await expect(page.locator('#assetCountRow')).toBeHidden();
});

test('the white border the model draws round a figure is taken off, down to the figure\'s own dark outline', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    // A 40 x 40 canvas: a 3 px white border, then a 2 px black outline, then a red body; transparent outside.
    const c = Object.assign(document.createElement('canvas'), { width: 40, height: 40 }), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(6, 6, 28, 28);
    g.fillStyle = '#000'; g.fillRect(9, 9, 22, 22);
    g.fillStyle = '#c00'; g.fillRect(11, 11, 18, 18);
    const o = assetDefringe(c), a = (x, y) => o.getContext('2d').getImageData(x, y, 1, 1).data[3];
    // A white garment with no outline: it loses only what the passes take (here 2), not all of it.
    const w = Object.assign(document.createElement('canvas'), { width: 30, height: 30 }), wg = w.getContext('2d');
    wg.fillStyle = '#fff'; wg.fillRect(5, 5, 20, 20);
    const ow = assetDefringe(w, 2), aw = (x, y) => ow.getContext('2d').getImageData(x, y, 1, 1).data[3];
    return { border: [a(7, 20), a(20, 7), a(33, 20)], outline: a(9, 20), body: a(20, 20), garmentEdge: aw(5, 15), garmentDeep: aw(8, 15), garmentMid: aw(15, 15) };
  });
  expect(r.border).toEqual([0, 0, 0]);
  expect(r.outline).toBe(255);
  expect(r.body).toBe(255);
  expect([r.garmentEdge, r.garmentDeep, r.garmentMid]).toEqual([0, 255, 255]);
});

test('one direction is the default and faces right, for the game to mirror', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => ({ dirs: ASSET_DEFAULTS.dirs, one: CHAR_DIRS[1], choices: CHAR_CHOICES.map(c => c.id) }));
  expect(r.dirs).toBe('1');
  expect(r.one).toEqual([['right', 270]]);
  expect(r.choices).toEqual(['1', '4', '8']);
});

test('a figure on a cream gradient (soft-shaded anime comes so) is cut out whole; the plain cut leaves the corners', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 200, height: 300 }), g = c.getContext('2d');
    // Cream at the top, a tan about 200 steps (R+G+B) darker at the bottom, as a model's vignette is:
    // the border is not one colour.
    const grad = g.createLinearGradient(0, 0, 0, 300);
    grad.addColorStop(0, 'rgb(250,246,232)'); grad.addColorStop(1, 'rgb(190,182,160)');
    g.fillStyle = grad; g.fillRect(0, 0, 200, 300);
    g.fillStyle = '#111'; g.fillRect(70, 60, 60, 180);        // the outline
    g.fillStyle = '#3a6ea5'; g.fillRect(74, 64, 52, 172);     // the figure
    const alpha = (cv, x, y) => cv.getContext('2d').getImageData(x, y, 1, 1).data[3];
    const plain = cutOut(c, { trim: false });
    const fig = assetCutFigure(c);
    return { plainCorner: plain.found ? alpha(plain.canvas, 3, 3) : 'not found', found: fig.found, tolerance: fig.tolerance,
      size: fig.found ? [fig.canvas.width, fig.canvas.height] : null,
      middle: fig.found ? alpha(fig.canvas, fig.canvas.width >> 1, fig.canvas.height >> 1) : null,
      borderClear: assetBorderClear(c) };
  });
  // The plain cut did not clear the corner (or gave up) - that is what the raised tolerance is for.
  expect(r.plainCorner === 'not found' || r.plainCorner > 8).toBe(true);
  expect(r.found).toBe(true);
  expect(r.tolerance).toBeGreaterThan(48);
  // Trimmed to the figure (60 x 180) and the pad, not the picture's 200 x 300.
  expect(r.size[0]).toBeLessThan(80);
  expect(r.size[1]).toBeLessThan(200);
  expect(r.middle).toBe(255);
  // An uncut picture's border is not clear: the test cannot be passed by doing nothing.
  expect(r.borderClear).toBeLessThan(0.5);
});

test('on a flat colour key a white cloak with no outline stays, and the gap between the legs goes', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 200, height: 300 }), g = c.getContext('2d');
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 200, 300);
    g.fillStyle = '#ffffff'; g.fillRect(60, 50, 80, 150);     // a white cloak, no outline round it
    g.fillStyle = '#334'; g.fillRect(70, 200, 20, 80); g.fillRect(110, 200, 20, 80);   // two legs, the key between them
    const a = (cv, x, y) => cv.getContext('2d').getImageData(x, y, 1, 1).data[3];
    const fig = assetCutFigure(c);
    // Trimmed with a 4 px pad, so the crop starts at x = 56: the left leg is at 14-34, the gap at 34-54.
    const canvas = assetFigureCanvas(fig);
    return { found: fig.found, keyed: fig.keyed, cloak: a(canvas, 40, 40), gap: a(canvas, 44, canvas.height - 20), leg: a(canvas, 24, canvas.height - 20) };
  });
  expect(r).toEqual({ found: true, keyed: true, cloak: 255, gap: 0, leg: 255 });
});

test('a pale sheet left round a figure is peeled off, up to the figure\'s own outline; a clean figure is left alone', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const px = (c, x, y) => c.getContext('2d').getImageData(x, y, 1, 1).data[3];
    const mk = withSheet => {
      const c = Object.assign(document.createElement('canvas'), { width: 120, height: 200 }), g = c.getContext('2d');
      if (withSheet) { g.fillStyle = 'rgb(240,232,210)'; g.fillRect(10, 10, 100, 180); }   // the paper the frame was cut from
      g.fillStyle = '#111'; g.fillRect(40, 40, 40, 120);                                   // the outline
      g.fillStyle = '#c33'; g.fillRect(43, 43, 34, 114);                                   // the figure
      return c;
    };
    const sheet = assetPeel(mk(true)), clean = mk(false);
    return { corner: px(sheet, 15, 15), nearFigure: px(sheet, 35, 100), outline: px(sheet, 41, 100), body: px(sheet, 60, 100),
      sameObject: assetPeel(clean) === clean, cleanBody: px(clean, 60, 100) };
  });
  expect([r.corner, r.nearFigure]).toEqual([0, 0]);
  expect([r.outline, r.body]).toEqual([255, 255]);
  // After a clean cut the rim is the dark outline, not a pale colour: nothing is peeled.
  expect(r.sameObject).toBe(true);
  expect(r.cleanBody).toBe(255);
});

// ---- The pixel look (assetPixelate in js/assetsfx.js; the choices in js/assets.js).
// A disc that fades from red to blue on a transparent canvas: many colours, one soft edge.
const DISC = `(w, h, from, to) => {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
  const k = g.createLinearGradient(0, 0, w, 0); k.addColorStop(0, from); k.addColorStop(1, to);
  g.fillStyle = k; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.4, h * 0.4, 0, 0, 7); g.fill();
  return c;
}`;
const COUNT = `(c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set(), alphas = new Set();
  for (let i = 0; i < d.length; i += 4) { alphas.add(d[i + 3]); if (d[i + 3]) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
  return { colours: seen.size, alphas: [...alphas].sort((a, b) => a - b) };
}`;

test('a sprite is put on the grid, cut to its colours, hard-edged and outlined in the palette\'s darkest', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(([disc, count, pix]) => {
    const mk = eval(disc), cnt = eval(count), px = eval(pix);
    const out = assetPixelate(mk(200, 300, '#e33', '#33e'), { grid: 32, colours: 8, outline: true });
    const plain = assetPixelate(mk(200, 300, '#e33', '#33e'), { grid: 32, colours: 8, outline: false });
    const dark = out.palette.reduce((a, c) => (c[0] + c[1] + c[2] < a[0] + a[1] + a[2] ? c : a));
    // Left of the disc's left edge, in the column that touches it: the outline.
    let edge = null;
    for (let x = 0; x < out.canvas.width && !edge; x++) { const p = px(out.canvas, x, out.canvas.height >> 1); if (p[3]) edge = p; }
    return { size: [out.canvas.width, out.canvas.height], plain: [plain.canvas.width, plain.canvas.height], ...cnt(out.canvas), palette: out.palette.length,
      corner: px(out.canvas, 0, 0)[3], edge: edge.slice(0, 3), dark };
  }, [DISC, COUNT, PIX]);
  // Longest side = the grid, the outline included (30 + 2); the short side in proportion.
  expect(r.size).toEqual([22, 32]);
  expect(r.plain, 'no outline: the shape takes the whole grid').toEqual([21, 32]);
  expect(r.colours, 'no more than the colours asked').toBeLessThanOrEqual(8);
  expect(r.palette).toBeLessThanOrEqual(8);
  expect(r.alphas, 'on or off, never half').toEqual([0, 255]);
  expect(r.corner).toBe(0);
  expect(r.edge).toEqual(r.dark);
});

test('a game\'s palette is handed on: kept colours are used, only the new ones are added, and never past the number', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(([disc]) => {
    const mk = eval(disc), rgb = a => a.map(c => c.join());
    const a = assetPixelate(mk(120, 120, '#e33', '#33e'), { grid: 16, colours: 16, outline: false, palette: [], shared: true });
    const b = assetPixelate(mk(120, 120, '#2a4', '#3ce'), { grid: 16, colours: 16, outline: false, palette: a.palette, shared: true });
    const again = assetPixelate(mk(120, 120, '#e33', '#33e'), { grid: 16, colours: 16, outline: false, palette: b.palette, shared: true });
    const alone = assetPixelate(mk(120, 120, '#e33', '#33e'), { grid: 16, colours: 16, outline: false });
    return { a: a.palette.length, b: b.palette.length, again: again.palette.length, alone: alone.palette.length,
      kept: rgb(a.palette).every((c, i) => rgb(b.palette)[i] === c) };
  }, [DISC]);
  expect(r.a, 'the first takes only a third of the room, so a tile after it finds some').toBeLessThanOrEqual(6);
  expect(r.b).toBeGreaterThan(r.a);
  expect(r.b).toBeLessThanOrEqual(16);
  expect(r.kept, 'what was in the palette stays, in its place').toBe(true);
  expect(r.again, 'a picture of colours the palette has adds nothing').toBe(r.b);
  expect(r.alone, 'its own palette is not limited by a game\'s').toBeGreaterThan(r.a);
});

test('a tile is shrunk and cut to colours, filled to the edge, with no outline', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(([count]) => {
    const cnt = eval(count);
    const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), g = c.getContext('2d');
    const k = g.createLinearGradient(0, 0, 256, 256); k.addColorStop(0, '#3a3'); k.addColorStop(1, '#8c4');
    g.fillStyle = k; g.fillRect(0, 0, 256, 256);
    const t = assetPixelate(c, { grid: 16, colours: 8, outline: false });
    return { size: [t.canvas.width, t.canvas.height], ...cnt(t.canvas) };
  }, [COUNT]);
  expect(r.size).toEqual([16, 16]);
  expect(r.alphas).toEqual([255]);
  expect(r.colours).toBeLessThanOrEqual(8);
});

test('the pixel look: choices appear when it is on, the tile size is the grid, and the palette can be started again', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { assetState.kind = 'tile'; assetState.thing = 'grass'; assetState.pix = 'off'; renderAssets(); });
  expect(await page.locator('#assetChoices [data-as="size"]').count(), 'tile size while off').toBeGreaterThan(0);
  expect(await page.locator('#assetChoices [data-as="pixColours"]').count()).toBe(0);
  await page.evaluate(() => document.querySelector('#assetChoices [data-as="pix"][data-opt="32"]').click());
  expect(await page.locator('#assetChoices [data-as="size"]').count(), 'the grid is the size').toBe(0);
  expect(await page.locator('#assetChoices [data-as="pixColours"]').count()).toBe(4);
  expect(await page.locator('#assetChoices [data-as="pixOutline"]').count(), 'a tile has no outline').toBe(0);
  await page.evaluate(() => { assetState.kind = 'prop'; assetState.pixShared = 'game'; assetState.pixPalette = ['#112233', '#445566']; renderAssets(); });
  expect(await page.locator('#assetChoices [data-as="pixOutline"]').count()).toBe(2);
  expect(await page.locator('#assetChoices .pix-palette span').count()).toBe(2);
  await page.locator('#assetChoices [data-pixforget]').click();
  expect(await page.evaluate(() => assetState.pixPalette)).toEqual([]);
  expect(await page.locator('#assetChoices .pix-palette').count()).toBe(0);
});

test('an item made with the pixel look on is kept on the grid, with its icon, tagged pixel, and the palette of the game is kept', async ({ page }) => {
  await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="item"]');
  await page.click('#assetChoices [data-as="pix"][data-opt="32"]');
  await page.click('#assetChoices [data-as="pixColours"][data-opt="8"]');
  await page.click('#assetChoices [data-as="pixShared"][data-opt="game"]');
  await page.selectOption('#assetCount', '1');
  // What is kept, as it is kept (the stand-in server gives every upload one id, so its list cannot tell the two apart).
  await page.evaluate(() => {
    window.__kept = [];
    const keep = assetKeep;
    assetKeep = (doc, canvas, extra, over) => { window.__kept.push({ w: canvas.width, h: canvas.height, extra }); return keep(doc, canvas, extra, over); };
  });
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('Made - in Uploads, Assets.');
  const kept = await page.evaluate(() => window.__kept);
  expect(kept).toHaveLength(2);
  const [sprite, icon] = kept;
  expect(sprite.extra).toContain('pixel');
  expect(Math.max(sprite.w, sprite.h), 'the sprite is on the grid').toBe(32);
  expect(icon.extra).toEqual(expect.arrayContaining(['icon', 'pixel']));
  expect([icon.w, icon.h], 'the icon is a square of the grid').toEqual([32, 32]);
  // The palette is the game's, and is kept for the next picture: swatches under the choice.
  const palette = await page.evaluate(() => assetState.pixPalette);
  expect(palette.length).toBeGreaterThan(1);
  expect(palette.length).toBeLessThanOrEqual(8);
  await expect(page.locator('#assetChoices .pix-palette span')).toHaveCount(palette.length);
});

test('a tile made with the pixel look on is the size of the grid, in the colours of the game', async ({ page }) => {
  const { server } = await setup(page);
  await page.click('#assetChoices [data-as="kind"][data-opt="tile"]');
  await page.click('#assetChoices [data-as="pix"][data-opt="16"]');
  await page.selectOption('#assetCount', '1');
  await page.click('#assetGo');
  await expect(page.locator('#assetStatus')).toHaveText('Made - in Uploads, Assets.');
  const docs = [...server.items].filter(([k]) => k.startsWith('uploads/')).map(([, v]) => v);
  const kept = docs.find(d => (d.tags || []).includes('16x16'));
  expect(kept, 'a 16 x 16 tile').toBeTruthy();
  expect(kept.tags).toContain('pixel');
  expect([kept.width, kept.height]).toEqual([16, 16]);
});

// ---- Phase 7: what a game loads.
test('pictures are packed on a power-of-two sheet, inside it, apart, and none on another', async ({ page }) => {
  await openApp(page);
  const sizes = [{ w: 32, h: 32 }, { w: 48, h: 96 }, { w: 16, h: 16 }, { w: 64, h: 32 }, { w: 30, h: 50 }, { w: 32, h: 32 }];
  const r = await page.evaluate(s => ({ ...packRects(s), sizes: s }), sizes);
  expect([r.w, r.h].map(n => (n & (n - 1)) === 0)).toEqual([true, true]);
  r.at.forEach((p, i) => {
    expect(p.x, `x of ${i}`).toBeGreaterThanOrEqual(2);
    expect(p.x + sizes[i].w + 2, `right of ${i}`).toBeLessThanOrEqual(r.w);
    expect(p.y + sizes[i].h + 2, `bottom of ${i}`).toBeLessThanOrEqual(r.h);
    r.at.forEach((q, j) => {
      if (j <= i) return;
      const apart = p.x + sizes[i].w + 2 <= q.x || q.x + sizes[j].w + 2 <= p.x || p.y + sizes[i].h + 2 <= q.y || q.y + sizes[j].h + 2 <= p.y;
      expect(apart, `${i} and ${j}`).toBe(true);
    });
  });
  expect(await page.evaluate(() => packRects([]))).toEqual({ w: 0, h: 0, at: [] });
});

test('the same name twice is kept apart, and a name is safe for a file', async ({ page }) => {
  await openApp(page);
  const names = await page.evaluate(() => packNames(['Chest, prop, side', 'chest, prop, side', 'Sword', '???']));
  expect(names).toEqual(['chest-prop-side', 'chest-prop-side-2', 'sword', 'asset']);
});

test('Pack for a game gives one zip: a sheet of the sprites and every picture, sprite or tile, a file', async ({ page }) => {
  const s = await setup(page);
  const doc = (id, name, tags) => ({ file: id.repeat(64) + '.png', name, type: 'image/png', from: 'generate', bytes: 100, t: Date.now(), folder: 'assets', asset: tags[1], tags, width: 200, height: 200 });
  s.server.items.set('uploads/' + 'd'.repeat(64), doc('d', 'chest, prop, side', ['chest', 'prop', 'side']));
  s.server.items.set('uploads/' + 'e'.repeat(64), doc('e', 'chest, prop, side', ['chest', 'prop', 'side']));
  s.server.items.set('uploads/' + 'f'.repeat(64), doc('f', 'grass, tile', ['grass', 'tile']));
  await page.evaluate(() => showAssets(false));
  await expect(page.locator('#assetPack')).toBeVisible();
  // makeZip is in the backup section's script: wait for it to load, then watch it.
  await page.evaluate(() => loadSection('backup'));
  const watched = page.evaluate(() => new Promise(res => { const was = makeZip; makeZip = e => { makeZip = was; res(e.map(x => x.name)); return was(e); }; }));
  const download = page.waitForEvent('download');
  await page.click('#assetPack');
  expect((await download).suggestedFilename()).toMatch(/^game-assets-\d{4}-\d{2}-\d{2}\.zip$/);
  const got = await watched;
  expect(got).toEqual(expect.arrayContaining(['sheet.png', 'sprites/chest-prop-side.png', 'sprites/chest-prop-side-2.png', 'tiles/grass-tile.png']));
  expect(got).toHaveLength(4);   // no atlas and no tile set: Unity reads neither
  await expect(page.locator('#assetStatus')).toContainText('Packed 2 sprites and 1 tile');
});
