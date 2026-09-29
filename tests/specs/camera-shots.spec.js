// The 3D camera's anime shots: a worm's eye that stops at the floor, a Dutch
// angle's roll, a fisheye whose overlay and picking follow its bent picture,
// and the shot sent to Generate.
const { test, expect, openApp, fakeServer } = require('../helpers');

async function openCamera(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formShapes [data-shape="figure"]')).toBeVisible();
  await page.click('#formShapes [data-shape="figure"]');
  await page.click('[data-ftab="view"]');
  await expect(page.locator('#formShots')).toBeVisible();
}

test("worm's eye: below the figure's middle, but never under the floor", async ({ page }) => {
  await openCamera(page);
  await page.click('#formShots [data-shot="worm"]');
  await expect(page.locator('#formShots [data-shot="worm"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#formShotNote')).toContainText('looking up');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    formsRender(formScene, 400, 300);
    return { y: forms.camera.position.y, aim: forms.frame.target.y, pitch: formScene.pitch, floor: forms.frame.minPitch };
  });
  expect(r.y).toBeGreaterThan(0);
  expect(r.y).toBeLessThan(r.aim * 0.2);
  // The -40 asked for was lower than the floor allows: the slider says where it stopped.
  expect(r.pitch).toBeGreaterThan(-40);
  expect(r.pitch).toBeLessThan(0);
  expect(Math.abs(r.pitch - Math.ceil(r.floor))).toBeLessThan(1);

  // Without the floor the camera goes as low as it was asked.
  const free = await page.evaluate(() => {
    formScene.ground = false; formScene.pitch = -40; formsRender(formScene, 400, 300);
    return forms.camera.position.y;
  });
  expect(free).toBeLessThan(0);
});

test('a Dutch angle rolls the camera, and the eye-level line tilts with it', async ({ page }) => {
  await openCamera(page);
  await page.click('#formShots [data-shot="dutch"]');
  await expect(page.locator('.fgroup [data-k="roll"]')).toHaveValue('18');
  const tilt = await page.evaluate(() => {
    formsRender(formScene, 400, 300);
    // How far the camera's own left-right has turned out of level.
    const side = new forms.T.Vector3(1, 0, 0).applyQuaternion(forms.camera.quaternion);
    return Math.asin(side.y) * 180 / Math.PI;
  });
  expect(Math.abs(Math.abs(tilt) - 18)).toBeLessThan(0.5);

  // The eye-level line's two ends, read off the overlay, are not level.
  await page.evaluate(() => { formScene.horizon = true; formScene.pitch = 0; formsChanged(); });
  await page.waitForTimeout(200);
  const ends = await page.evaluate(() => {
    const c = el('formsOverlay'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    const blueIn = x => {
      for (let y = 0; y < c.height; y++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3] > 100 && d[i + 2] > 200 && d[i] < 120 && d[i + 1] > 150) return y;
      }
      return -1;
    };
    // Scanned a few columns each side: the line is dashed.
    const at = x0 => { for (let x = x0; x < x0 + 20; x++) { const y = blueIn(x); if (y >= 0) return y; } return -1; };
    return [at(Math.round(c.width * 0.25)), at(Math.round(c.width * 0.7)), c.width];
  });
  expect(ends[0]).toBeGreaterThanOrEqual(0);
  expect(ends[1]).toBeGreaterThanOrEqual(0);
  expect(Math.abs(ends[0] - ends[1])).toBeGreaterThan(ends[2] * 0.45 * Math.tan(10 * Math.PI / 180));
});

test('the fisheye bends the picture, and the overlay and clicks follow it', async ({ page }) => {
  await openCamera(page);
  await page.click('#formShots [data-shot="fish"]');
  await expect(page.locator('.fgroup [data-k="fisheye"]')).toBeChecked();
  await expect(page.locator('.fgroup [data-k="focal"]')).toBeDisabled();
  await expect(page.locator('#formShotNote')).toContainText('180°');
  await page.waitForTimeout(200);

  const r = await page.evaluate(() => {
    const T = forms.T, stage = el('formsStage');
    formsRender(formScene, stage.clientWidth, stage.clientHeight);
    // The figure is drawn: the middle of the frame is not the background.
    const c = document.createElement('canvas');
    c.width = forms.renderer.domElement.width; c.height = forms.renderer.domElement.height;
    const g = c.getContext('2d');
    g.drawImage(forms.renderer.domElement, 0, 0);
    const px = g.getImageData(c.width / 2 - 20, c.height / 2 - 20, 40, 40).data;
    let differs = 0;
    const want = [0x2a, 0x2a, 0x30]; // the default background
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - want[0]) + Math.abs(px[i + 1] - want[1]) + Math.abs(px[i + 2] - want[2]) > 30) differs++;
    // A point well off the axis, 45° to the left.
    const P = forms.camera.position.clone().add(new T.Vector3(-1, 0, -1).normalize().applyQuaternion(forms.camera.quaternion).multiplyScalar(5));
    const fish = formProject(P);
    // The way back: a ray through where the point was drawn passes through it.
    const rect = forms.renderer.domElement.getBoundingClientRect();
    const ray = formsRay(rect.left + (fish.x + 1) / 2 * rect.width, rect.top + (1 - fish.y) / 2 * rect.height);
    return { differs, miss: ray.ray.distanceToPoint(P) };
  });
  expect(r.differs).toBeGreaterThan(400);
  expect(r.miss).toBeLessThan(0.05);

  // Clicking the figure where the fisheye drew it still finds it.
  const hit = await page.evaluate(() => {
    const m = forms.meshes[formScene.active], T = forms.T;
    const P = new T.Box3().setFromObject(m).getCenter(new T.Vector3());
    const p = formProject(P), rect = forms.renderer.domElement.getBoundingClientRect();
    return formAt(rect.left + (p.x + 1) / 2 * rect.width, rect.top + (1 - p.y) / 2 * rect.height);
  });
  expect(hit).toBe(0);

  // Off again: the Lens slider is back, and projection is the ordinary one.
  await page.locator('.fgroup [data-k="fisheye"]').uncheck();
  await expect(page.locator('.fgroup [data-k="focal"]')).toBeEnabled();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => forms.fishK)).toBe(0);
});

test('with a ComfyUI: Draw this shot sends the angle and the lens to Generate', async ({ page }) => {
  await fakeServer(page);
  await page.route('**/api/generate**', r => r.fulfill({ json: { available: true } }));
  await openCamera(page);
  await page.click('#formShots [data-shot="fish"]');
  await page.locator('#formShotGen').click();
  await expect(page.locator('#genStatus')).toContainText('whole figure');
  await expect(page.locator('#genStatus')).toContainText('fisheye');
  await expect(page.locator('[data-gen="lens"][data-opt="fisheye"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-gen="framing"][data-opt="full"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => genPrompt(genChoices).prompt)).toContain('fisheye');
});

test("Ctrl+K opens the 3D view at a worm's eye", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type("worm's eye");
  await page.keyboard.press('Enter');
  await expect(page.locator('#formShots [data-shot="worm"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#formShots')).toBeVisible();
});

// Fog is measured by distance now, per pixel: done per corner, the floor -
// one huge square with every corner far off - went into the fog whole.
test('the floor under the figure is not lost in the fog', async ({ page }) => {
  await openCamera(page);
  const floor = await page.evaluate(() => {
    Object.assign(formScene, { pitch: 10, focal: 24, zoom: 1, fisheye: false, roll: 0 });
    formsRender(formScene, 400, 300);
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const g = c.getContext('2d');
    g.drawImage(forms.renderer.domElement, 0, 0);
    return [...g.getImageData(40, 280, 1, 1).data].slice(0, 3);
  });
  // The ground's colour (#7a746a, lit) rather than the background's (#2a2a30).
  expect(floor[0]).toBeGreaterThan(70);
});
