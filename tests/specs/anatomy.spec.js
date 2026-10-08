// Anatomy on the figure (forms-models.js FORM_ANATOMY_*, forms.js
// drawFormAnatomy): bony landmarks and muscle groups drawn over the view.
const { test, expect, openApp } = require('../helpers');

async function openFigure(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await page.click('#formShapes [data-shape="figure"]');
  await expect(page.locator('#formBuildWrap')).toBeVisible();
  await page.evaluate(() => { forms.joint = null; });
}

// Pixels of the overlay in a colour: ivory for bones, a dull red for muscles.
const overlayPixels = (page, kind) => page.evaluate(kind => {
  const c = el('formsOverlay'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (kind === 'bone' ? d[i + 3] > 200 && d[i] > 225 && d[i + 1] > 215 && d[i + 2] > 190 && d[i + 2] < 235
      : d[i + 3] > 60 && d[i + 3] < 130 && d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 100) n++;
  }
  return n;
}, kind);
const show = async (page, patch) => {
  await page.evaluate(p => { Object.assign(formScene, p); formsChanged(); }, patch);
  await page.waitForTimeout(250);
};

test('a landmark is on the surface of its form, and its normal points out', async ({ page }) => {
  await openFigure(page);
  const r = await page.evaluate(() => {
    const out = [];
    for (const [c, R, d] of [[[0, 0.32, 0], [0.36, 0.38, 0.22], [0.3, 1, 0.55]], [[0, -0.2, 0], 0.085, [0, 0, 1]], [[0, 0, 0], 0.11, [-1, 0.2, 0.1]]]) {
      const { p, n } = anatomySurface(c, R, d), RR = typeof R === 'number' ? [R, R, R] : R;
      out.push({ on: p.reduce((s, v, i) => s + ((v - c[i]) / RR[i]) ** 2, 0), len: Math.hypot(...n),
        out: n.reduce((s, v, i) => s + v * (p[i] - c[i]), 0) });
    }
    return out;
  });
  for (const q of r) { expect(q.on).toBeCloseTo(1, 6); expect(q.len).toBeCloseTo(1, 6); expect(q.out).toBeGreaterThan(0); }
});

test('every place is on a joint the figure has, and a name for both sides is the same text', async ({ page }) => {
  await openFigure(page);
  const bad = await page.evaluate(() => {
    const joints = new Set([null, ...FORM_RIGS.figure.joints.map(j => j[0])]), missing = [];
    const specs = [...FORM_ANATOMY_BONES.map(b => b[1]), ...FORM_ANATOMY_LINES.flatMap(l => l[1]),
      ...FORM_ANATOMY_MUSCLES.flatMap(m => [m[1], m[2]])];
    for (const s of specs) if (!joints.has(s[0])) missing.push(s[0]);
    return { missing, sided: FORM_ANATOMY_MUSCLES.filter(m => m[0] === 'Biceps').length };
  });
  expect(bad.missing).toEqual([]);
  expect(bad.sided).toBe(2);
});

test('the checks are with the figure, drawn only when asked, and not on a form that is not a figure', async ({ page }) => {
  await openFigure(page);
  const bone0 = await overlayPixels(page, 'bone'), red0 = await overlayPixels(page, 'muscle');
  await page.locator('#formBuildWrap [data-k="bones"]').check();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => formScene.bones)).toBe(true);
  expect(await overlayPixels(page, 'bone')).toBeGreaterThan(bone0 + 100);
  expect(await overlayPixels(page, 'muscle')).toBeLessThan(red0 + 50);
  await page.locator('#formBuildWrap [data-k="muscles"]').check();
  await page.waitForTimeout(250);
  expect(await overlayPixels(page, 'muscle')).toBeGreaterThan(red0 + 500);
  // A cube has no anatomy: the checks go with the Body block.
  await page.click('#formShapes [data-shape="cube"]');
  await expect(page.locator('#formBuildWrap')).toBeHidden();
});

test('only what faces you is drawn: the notch of the neck from the front, C7 from behind', async ({ page }) => {
  await openFigure(page);
  // Which labels the figure was asked to write - the text sits in the overlay
  // as pixels, so look at what the drawing would place instead: the facing.
  const facing = yaw => page.evaluate(yaw => {
    formScene.yaw = yaw; formsChanged();
    formsRender(formScene, 320, 240, true);
    const m = forms.meshes[formScene.active], rig = m.userData.rig, T = forms.T, cam = forms.camera;
    const of = ([j, c, r, d]) => {
      const node = j ? rig.nodes[j] : m, s = anatomySurface(c, r, d);
      node.updateWorldMatrix(true, false);
      const P = new T.Vector3(...s.p).applyMatrix4(node.matrixWorld), N = new T.Vector3(...s.n).transformDirection(node.matrixWorld);
      return N.dot(cam.position.clone().sub(P).normalize());
    };
    const pick = t => of(FORM_ANATOMY_BONES.find(b => b[0].startsWith(t))[1]);
    return { jugular: pick('Jugular'), c7: pick('C7') };
  }, yaw);
  const front = await facing(0), back = await facing(180);
  expect(front.jugular).toBeGreaterThan(0.05);
  expect(front.c7).toBeLessThan(0.05);
  expect(back.c7).toBeGreaterThan(0.05);
  expect(back.jugular).toBeLessThan(0.05);
});
