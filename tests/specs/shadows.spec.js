// Soft shadows in the 3D forms (formSoftShadowChunk in js/forms.js): the
// penumbra grows with the gap between a shadow and what throws it - hard at
// the foot of a form, soft far from it - and lit surfaces stay clean.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* A tall pillar on the floor, seen from straight above with the light from
   its left, throws a long strip of shadow to the right. Its long sides are
   cast by the pillar's vertical edges: by the foot of the pillar where the
   strip starts, by its top where the strip ends - so a shadow that softens
   with the gap is sharp at the start and soft at the end, in one picture.
   Returns the width in pixels of the strip's lower edge - 10% to 90% of the
   way from lit floor to full shadow - a sixth and five sixths along it.
   Where the strip ends is worked out from the light: for the sun, the
   pillar's height over the tangent of the light's elevation; for a lamp,
   where the line from the lamp over the pillar's top meets the floor. */
const stripEdges = (page, set) => page.evaluate(set => {
  const W = 900, H = 560, HEIGHT = 6, FOOT = -4;
  Object.assign(formScene, { bg: '#2a2a30', lightMarker: false, fillOn: false, floorGrid: false, ground: true,
    yaw: 0, pitch: 88, zoom: 1.2, lightAz: -90, lightEl: 40, lightDist: LIGHT_SUN, softness: 0.3, ...set });
  formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, finish: 'matte', shape: 'cube', x: FOOT, z: 0, y: 0, sx: 0.4, sy: 3, sz: 0.4, ...(set.object || {}) }];
  formScene.active = 0;
  formsRender(formScene, W, H, true);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(el('formsCanvas'), 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const L = (x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
  const lit = L(W - 6, 10);
  const F = forms, T = F.T, sun = formScene.lightDist >= LIGHT_SUN;
  let reach;
  if (sun) reach = HEIGHT / Math.tan(formScene.lightEl * Math.PI / 180);
  else { const b = F.bulb.position; reach = HEIGHT * (FOOT - b.x) / (b.y - HEIGHT); }
  const px = x => { const v = new T.Vector3(x, 0, 0).project(F.camera); return [(v.x * 0.5 + 0.5) * W, (0.5 - v.y * 0.5) * H]; };
  const [xa, row0] = px(FOOT), [xb] = px(FOOT + reach), row = Math.round(row0);
  const edge = x => {
    // Down from the middle of the strip to the lit floor below it.
    let lo = Infinity;
    for (let y = row - 2; y <= row + 2; y++) lo = Math.min(lo, L(x, y));
    let p10 = -1, p90 = -1;
    for (let y = H - 1; y > row; y--) {
      const t = (lit - L(x, y)) / (lit - lo);
      if (p10 < 0 && t > 0.1) p10 = y;
      if (p90 < 0 && t > 0.9) p90 = y;
    }
    return p10 - p90;
  };
  const at = f => Math.round(xa + (xb - xa) * f);
  return { xa: Math.round(xa), xb: Math.round(xb), near: edge(at(1 / 6)), far: edge(at(5 / 6)) };
}, set);

test('the sun: a long shadow is hard at the foot of a form and soft at its end', async ({ page }) => {
  await openForms(page);
  const hard = await stripEdges(page, { softness: 0 });
  const some = await stripEdges(page, { softness: 0.15 });
  const more = await stripEdges(page, { softness: 0.3 });
  expect(hard.xb, 'the whole strip is in the picture').toBeLessThan(900);
  // No softness: a hard edge all along. With some, the end is several times
  // as soft as the foot - the penumbra grows with the gap, which a blur of
  // one width cannot do - and the end softens with the slider.
  expect(hard.far).toBeLessThanOrEqual(6);
  for (const s of [some, more]) {
    expect(s.far).toBeGreaterThan(2.5 * s.near);
    expect(s.near).toBeLessThan(15);
  }
  expect(more.far).toBeGreaterThan(some.far);
  expect(some.far).toBeGreaterThan(hard.far * 2);
});

test('the lamp: the same, from a point that is near', async ({ page }) => {
  await openForms(page);
  const hard = await stripEdges(page, { softness: 0, lightDist: 8, lightEl: 50 });
  const soft = await stripEdges(page, { softness: 0.4, lightDist: 8, lightEl: 50 });
  expect(soft.xb, 'the whole strip is in the picture').toBeLessThan(900);
  expect(hard.far).toBeLessThanOrEqual(8);
  expect(soft.far).toBeGreaterThan(2.5 * soft.near);
  expect(soft.far).toBeGreaterThan(hard.far * 2);
});

test('an Anime form keeps its shadows hard whatever the softness says', async ({ page }) => {
  await openForms(page);
  const r = await stripEdges(page, { softness: 1, object: { finish: 'anime', gloss: 0 } });
  expect(r.far).toBeLessThanOrEqual(8);
  expect(r.far).toBeLessThanOrEqual(r.near + 4);
});

test("the chunk is rebuilt only if three's has the shape it expects", async ({ page }) => {
  await openForms(page);
  const r = await page.evaluate(() => {
    const stock = forms.T.ShaderChunk.shadowmap_pars_fragment;
    return { odd: formSoftShadowChunk('not a shadow chunk'), noBasic: formSoftShadowChunk('float getSunShadow( float getPointShadow('),
      type: forms.renderer.shadowMap.type, basic: forms.T.BasicShadowMap, stock: stock.includes('getShadowStock') && stock.includes('getPointShadowStock'),
      // The original lookups are renamed, never left to be called by mistake.
      calls: (stock.match(/float getShadow\(/g) || []).length + (stock.match(/float getPointShadow\(/g) || []).length };
  });
  expect(r.odd).toBeNull();
  expect(r.noBasic).toBeNull();
  expect(r.type).toBe(r.basic);
  expect(r.stock).toBe(true);
  // One of each is ours: three's own are renamed, so nothing is defined twice.
  expect(r.calls).toBe(2);
});

/* A sphere on its own, lit from the side by a lamp, and how much of its lit
   face is speckled: the share of pixels that differ from the average of
   their neighbours by more than four levels. A smooth gradient has none.
   Shadow acne - a surface in its own shadow where it should be lit - is
   that speckle. */
const speckle = (page, set) => page.evaluate(set => {
  const W = 600, H = 420;
  Object.assign(formScene, { bg: '#000000', lightMarker: false, fillOn: false, ground: false,
    yaw: 0, pitch: 20, zoom: 1, lightAz: -50, lightEl: 35, lightDist: 5, softness: 0.4, ...set });
  formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'sphere', finish: 'matte', color: '#c9d4e6' }];
  formScene.active = 0;
  formsRender(formScene, W, H, true);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(el('formsCanvas'), 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const L = (x, y) => { const i = (y * W + x) * 4; return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; };
  let seen = 0, rough = 0;
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const v = L(x, y);
    if (v < 40) continue;                        // the background and the dark side
    let sum = 0;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) sum += L(x + i, y + j);
    if (L(x - 3, y) < 40 || L(x + 3, y) < 40 || L(x, y - 3) < 40 || L(x, y + 3) < 40) continue;  // not at the edge
    seen++;
    if (Math.abs(v - sum / 25) > 4) rough++;
  }
  return { seen, share: rough / seen };
}, set);

test('lit surfaces are smooth: no shadow acne from the lamp or the sun', async ({ page }) => {
  await openForms(page);
  const lamp = await speckle(page, {});
  const sun = await speckle(page, { lightDist: 12, lightEl: 25 });
  console.log('SPECKLE', JSON.stringify({ lamp, sun }));
  expect(lamp.seen).toBeGreaterThan(5000);
  expect(sun.seen).toBeGreaterThan(5000);
  expect(lamp.share).toBeLessThan(0.01);
  expect(sun.share).toBeLessThan(0.01);
});
