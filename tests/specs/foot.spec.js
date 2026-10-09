// The mannequin foot (forms-models.js FORM_FOOT_*, FORM_RIGS.foot): a right
// foot, posable toe by toe, on the same rig machinery as the hand.
const { test, expect, openApp } = require('../helpers');

async function openFoot(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formShapes [data-shape="foot"]')).toBeVisible();
  await page.click('#formShapes [data-shape="foot"]');
  await expect(page.locator('#formPoses')).toBeVisible();
}

// Where each joint's parts are in the world after posing: a box per joint.
const boxes = (page, pose) => page.evaluate(pose => {
  const o = activeFormObject();
  Object.assign(o, { pose: pose || {}, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 });
  formsRender(formScene, 320, 240, true);
  const m = forms.meshes[formScene.active], T = forms.T, out = {};
  for (const [pm] of m.userData.rig.parts) {
    const b = new T.Box3().setFromObject(pm, true), k = pm.userData.joint || 'root';
    out[k] = out[k] ? { min: out[k].min.map((v, i) => Math.min(v, b.min.toArray()[i])), max: out[k].max.map((v, i) => Math.max(v, b.max.toArray()[i])) }
      : { min: b.min.toArray(), max: b.max.toArray() };
  }
  return out;
}, pose);

test('the foot has an ankle, a forefoot and fourteen toe joints, each with limits', async ({ page }) => {
  await openFoot(page);
  const r = await page.evaluate(() => {
    const rig = FORM_RIGS.foot;
    return { n: rig.joints.length, parents: rig.joints.every(j => !j[1] || rig.jointMap.has(j[1])),
      limits: rig.joints.every(j => { const l = rig.limits(j[0]); return l && l.length === 3 && l.every(a => a[0] <= a[1]); }),
      schema: formSceneSchema().rigs.foot.joints.length };
  });
  expect(r).toEqual({ n: 16, parents: true, limits: true, schema: 16 });
  await expect(page.locator('#formBuildWrap')).toBeHidden();
  await expect(page.locator('#formJointHint')).toContainText('foot');
});

test('at rest it is a foot: a long sole, the big toe inside and longest, the others shortening', async ({ page }) => {
  await openFoot(page);
  const b = await boxes(page);
  const tip = k => b[k].max[2];
  // Heel to the big toe's tip is about one unit, and the sole is flat on the floor.
  const len = tip('big2') - b.ankle.min[2];
  expect(len).toBeGreaterThan(0.95); expect(len).toBeLessThan(1.15);
  expect(b.ankle.min[1]).toBeCloseTo(b.fore.min[1], 1);
  // The big toe is on the +x side and the little one on the other.
  expect((b.big1.min[0] + b.big1.max[0]) / 2).toBeGreaterThan((b.little1.min[0] + b.little1.max[0]) / 2 + 0.2);
  const tips = [tip('big2'), tip('second3'), tip('third3'), tip('fourth3'), tip('little3')];
  for (let i = 1; i < tips.length; i++) expect(tips[i], `toe ${i}`).toBeLessThan(tips[i - 1]);
});

test('a pose moves the right parts: tiptoe lifts the heel, curling pulls the toes under', async ({ page }) => {
  await openFoot(page);
  const flat = await boxes(page);
  const preset = async k => { await page.click(`[data-pose-preset="${k}"]`); await page.waitForTimeout(150); return boxes(page, await page.evaluate(() => activeFormObject().pose)); };
  const tip = await preset('tiptoe');
  // The foot rests on its lowest part - the toes - and the heel is well above them.
  expect(tip.ankle.min[1] - tip.big2.min[1]).toBeGreaterThan(0.3);
  expect(flat.ankle.min[1] - flat.big2.min[1]).toBeLessThan(0.05);
  const curl = await preset('curl');
  // Curled toes end nearer the heel and lower than flat ones (heights from each pose's own floor).
  expect(curl.big2.max[2]).toBeLessThan(flat.big2.max[2] - 0.1);
  const point = await preset('point');
  // Pointed: the toes' tips fall below the heel's.
  expect(point.big2.min[1]).toBeLessThan(point.ankle.min[1] - 0.2);
});

test('random poses keep to the limits, and a turned figure starts the foot at rest', async ({ page }) => {
  await openFoot(page);
  const bad = await page.evaluate(() => {
    const rig = FORM_RIGS.foot, out = [];
    for (let n = 0; n < 40; n++) {
      const p = randomFormPose(rig);
      for (const [j, v] of Object.entries(p)) {
        const lim = rig.limits(j);
        if (v.some((a, k) => a < lim[k][0] || a > lim[k][1])) out.push(j);
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
  // A foot's joints mean nothing to a figure: picking one starts it at rest.
  await page.click('[data-pose-preset="tiptoe"]');
  await page.click('#formShapes [data-shape="figure"]');
  expect(await page.evaluate(() => activeFormObject().pose)).toEqual({});
});
