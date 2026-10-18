// The anime hand: the same gestures as the full hand, in fewer joints.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formShapes [data-shape="handAnime"]')).toBeVisible();
}

test('the anime hand has eleven joints, the full hand sixteen', async ({ page }) => {
  await openForms(page);
  const n = await page.evaluate(() => ({ anime: FORM_RIGS.handAnime.joints.length, full: FORM_RIGS.hand.joints.length }));
  expect(n).toEqual({ anime: 11, full: 16 });
});

test('every pose of the full hand is a pose of the anime hand, and stays within its limits', async ({ page }) => {
  await openForms(page);
  const bad = await page.evaluate(() => {
    const rig = FORM_RIGS.handAnime, out = [];
    if (Object.keys(rig.poses).join() !== Object.keys(FORM_RIGS.hand.poses).join()) out.push('pose names differ');
    for (const [id, { pose }] of Object.entries(rig.poses)) {
      for (const [j, a] of Object.entries(pose)) {
        if (!rig.jointMap.has(j)) { out.push(`${id}: no joint ${j}`); continue; }
        const lim = rig.limits(j);
        a.forEach((v, k) => { if (v < lim[k][0] - 1e-6 || v > lim[k][1] + 1e-6) out.push(`${id}.${j}[${k}]=${v}`); });
      }
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test('a fist closes the fingers: the tips come down towards the palm', async ({ page }) => {
  await openForms(page);
  await page.click('#formShapes [data-shape="handAnime"]');
  const tipY = await page.evaluate(() => {
    const o = activeFormObject(), T = forms.T, out = {};
    for (const pose of ['spread', 'fist']) {
      o.pose = JSON.parse(JSON.stringify(FORM_RIGS.handAnime.poses[pose].pose));
      Object.assign(o, { rx: 0, ry: 0, rz: 0 });
      formsRender(formScene, 320, 240);
      const m = forms.meshes[formScene.active];
      m.updateMatrixWorld(true);
      out[pose] = new T.Box3().setFromObject(m, true).getSize(new T.Vector3()).y;
    }
    return out;
  });
  expect(tipY.fist).toBeLessThan(tipY.spread * 0.75);
});

test('choosing it offers the hand poses and no proportions', async ({ page }) => {
  await openForms(page);
  await page.click('#formShapes [data-shape="handAnime"]');
  await expect(page.locator('#formPoses')).toBeVisible();
  await expect(page.locator('#formBuildWrap')).toBeHidden();
  expect(await page.evaluate(() => activeFormObject().shape)).toBe('handAnime');
});
