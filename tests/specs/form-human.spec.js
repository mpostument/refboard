// The Human form in the 3D forms: MakeHuman's body (models/human.glb, built by
// scripts/make-human.js) skinned to the figure's own joints, so the figure's
// poses and builds work on it exactly as on the mannequin.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

test.describe('the human body', () => {
  test('is one skinned mesh on the figure\'s joints, and the pose moves it', async ({ page }) => {
    await openForms(page);
    const r = await page.evaluate(async () => {
      const draw = () => formsRender(formScene, 400, 300, true);
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'human', pose: {}, ry: 0 }];
      formScene.active = 0;
      formsChanged();
      const m = forms.meshes[0], skinned = () => m.userData.rig && m.userData.rig.skin && m.userData.rig.skin.mesh;
      for (let i = 0; i < 150 && !skinned(); i++) await new Promise(res => setTimeout(res, 100));
      if (!skinned()) return null;
      const skin = m.userData.rig.skin;
      // The top of the body as drawn (skinning included), and how wide it is.
      const box = () => { draw(); m.updateMatrixWorld(true); return new forms.T.Box3().setFromObject(skin.mesh, true); };
      const standing = box();
      formScene.objects[0].pose = { 'upperArm.L': [-170, 0, 0] };
      const raised = box();
      formScene.objects[0].pose = {};
      formScene.objects[0].build = 'elderly';
      const older = box();
      // A stylised build is not taken by a real body: Chibi comes out as Realistic.
      formScene.objects[0].build = 'chibi';
      const chibi = box();
      return {
        skinned: skin.mesh.isSkinnedMesh, bones: skin.bones.length, joints: skin.joints,
        rigJoints: FORM_RIGS.human.joints.map(j => j[0]), vertices: skin.mesh.geometry.getAttribute('position').count,
        standingTop: standing.max.y, standingBottom: standing.min.y, raisedTop: raised.max.y, olderTop: older.max.y, chibiTop: chibi.max.y,
        heads: figureHeights('real', 1, FORM_RIGS.human).heads, mannequinHeads: figureHeights('real', 1).heads,
        floor: formScene.objects[0].y,
      };
    });
    expect(r, 'the body never loaded').not.toBeNull();
    expect(r.skinned).toBe(true);
    expect(r.vertices).toBeGreaterThan(10000);   // a real body, not the ball at the pelvis
    // The pelvis, then every joint of the figure's rig, by its own name.
    expect(r.joints[0]).toBe('pelvis');
    expect(r.joints.slice(1).sort()).toEqual(r.rigJoints.slice().sort());
    expect(r.bones).toBe(r.rigJoints.length + 1);
    // Standing, about four units tall, and a raised arm goes above the head.
    expect(r.standingTop - r.standingBottom).toBeGreaterThan(3.6);
    expect(r.standingTop - r.standingBottom).toBeLessThan(4.4);
    expect(r.raisedTop).toBeGreaterThan(r.standingTop + 0.2);
    // The build scales the body: an older one is shorter. Chibi, which is for the Figure only, is not applied.
    expect(r.olderTop).toBeLessThan(r.standingTop - 0.08);
    expect(r.chibiTop).toBeCloseTo(r.standingTop, 2);
    // A real body is about seven and a half heads; the mannequin's is its own.
    expect(r.heads).toBeGreaterThan(6.8);
    expect(r.heads).toBeLessThan(7.8);
    expect(r.mannequinHeads).not.toBeCloseTo(r.heads, 1);
  });

  test('the bony landmarks and muscle groups wait for a Figure, and say why', async ({ page }) => {
    await openForms(page);
    const scene = shapes => page.evaluate(shapes => {
      formScene.objects = shapes.map(shape => ({ ...FORM_OBJECT_DEFAULTS, shape }));
      formScene.active = 0;
      formsChanged();
    }, shapes);
    const bones = page.locator('[data-k="bones"]'), muscles = page.locator('[data-k="muscles"]');
    await scene(['human']);
    await expect(bones).toBeDisabled();
    await expect(muscles).toBeDisabled();
    await expect(page.locator('label.opt:has([data-k="bones"])')).toHaveAttribute('title', /Add a Figure/);
    await scene(['human', 'figure']);
    await expect(bones).toBeEnabled();
    await expect(muscles).toBeEnabled();
  });

  test('the stylised builds are offered on the Figure only', async ({ page }) => {
    await openForms(page);
    const chips = shape => page.evaluate(shape => {
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape, build: 'chibi' }];
      formScene.active = 0;
      formsChanged();
      return [...document.querySelectorAll('[data-build]')].filter(b => !b.classList.contains('hidden')).map(b => b.dataset.build);
    }, shape);
    const human = await chips('human'), figure = await chips('figure');
    for (const b of ['anime', 'tall', 'chibi', 'child']) {
      expect(human).not.toContain(b);
      expect(figure).toContain(b);
    }
    for (const b of ['real', 'elderly', 'heavy', 'muscular', 'female', 'male']) expect(human).toContain(b);
  });

  test('a click on the body names the joint under it', async ({ page }) => {
    await openForms(page);
    const joint = await page.evaluate(async () => {
      formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, shape: 'human', pose: {}, ry: 0 }];
      formScene.active = 0;
      formsChanged();
      const m = forms.meshes[0];
      for (let i = 0; i < 150 && !(m.userData.rig && m.userData.rig.skin); i++) await new Promise(res => setTimeout(res, 100));
      formsRender(formScene, 900, 560, true);
      // The middle of the left shin, in the picture.
      const shin = m.userData.rig.nodes['shin.L'], v = new forms.T.Vector3();
      shin.updateWorldMatrix(true, false);
      v.setFromMatrixPosition(shin.matrixWorld).y -= 0.45;
      const p = v.project(forms.camera), r = el('formsCanvas').getBoundingClientRect();
      const hit = formHit(r.left + (p.x * 0.5 + 0.5) * r.width, r.top + (0.5 - p.y * 0.5) * r.height);
      return hit && hit.joint;
    });
    expect(joint).toBe('shin.L');
  });
});
