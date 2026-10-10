// Hatching along the form (the uHatch branch of injectFormGuides in
// js/forms.js): the forms drawn as a pen drawing - strokes that follow the
// surface, ink where the light leaves it dark.
const { test, expect, openApp } = require('../helpers');

async function openForms(page) {
  await openApp(page);
  await page.click('.nav-item[data-view="forms"]');
  await expect(page.locator('#formFinishes [data-finish="anime"]')).toBeVisible();
}

/* A sphere lit from the camera's left, drawn at 700 x 500: the luminance of
   the pixels in a column of its lit side and one of its shadow side. */
const sphere = (page, set) => page.evaluate(set => {
  const W = 700, H = 500;
  Object.assign(formScene, { bg: '#2a2a30', lightMarker: false, fillOn: false, floorGrid: false, ground: false, ambient: 0.12,
    yaw: 0, pitch: 0, zoom: 1, lightAz: -70, lightEl: 25, lightDist: LIGHT_SUN, softness: 0.1, lines: false, zones: false, hatch: false, ...set });
  formScene.objects = [{ ...FORM_OBJECT_DEFAULTS, finish: 'matte', shape: 'sphere', x: 0, z: 0, y: 0 }];
  formScene.active = 0;
  formsRender(formScene, W, H, true);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(el('formsCanvas'), 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const T = forms.T, box = new T.Box3().setFromObject(forms.meshes[0], true);
  const pts = [box.min, box.max].map(v => v.clone().project(forms.camera));
  const x0 = (pts[0].x * 0.5 + 0.5) * W, x1 = (pts[1].x * 0.5 + 0.5) * W, cy = Math.round(H / 2), cx = (x0 + x1) / 2, r = (x1 - x0) / 2;
  const col = fx => {
    const x = Math.round(cx + fx * r), out = [];
    for (let y = cy - Math.round(r * 0.3); y <= cy + Math.round(r * 0.3); y++) { const i = (y * W + x) * 4; out.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); }
    return out;
  };
  const rowL = [];
  for (let x = Math.round(cx - r * 0.7); x <= Math.round(cx + r * 0.7); x++) { const i = (cy * W + x) * 4; rowL.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); }
  return { lit: col(-0.5), shade: col(0.55), rowL };
}, set);
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

test('hatching: pale paper on the lit side, ink strokes crossing the paper in the shadow', async ({ page }) => {
  await openForms(page);
  const r = await sphere(page, { hatch: true });
  expect(mean(r.lit)).toBeGreaterThan(mean(r.shade) + 40);   // the light side is paper, the dark side inked
  // In the shadow the strokes are separate: ink and paper both, not a grey wash.
  expect(Math.min(...r.shade)).toBeLessThan(70);
  expect(Math.max(...r.shade)).toBeGreaterThan(190);
  // Down the shadow the ink comes and goes - the rings round the ball, one stroke each time.
  let swings = 0;
  for (let i = 1; i < r.shade.length; i++) if ((r.shade[i - 1] > 130) !== (r.shade[i] > 130)) swings++;
  expect(swings).toBeGreaterThan(4);
});

test('without hatching the same form shades smoothly', async ({ page }) => {
  await openForms(page);
  const r = await sphere(page, { hatch: false });
  expect(Math.max(...r.lit.map((v, i) => i ? Math.abs(v - r.lit[i - 1]) : 0))).toBeLessThan(25);
});

test('the zones view takes over from hatching; the setting is kept in a scene', async ({ page }) => {
  await openForms(page);
  const r = await page.evaluate(() => ({ kept: normalizeFormScene({ hatch: true }).hatch, dropped: normalizeFormScene({ hatch: 'yes' }).hatch }));
  expect(r.kept).toBe(true);
  expect(r.dropped).toBe(false);
  const zones = await sphere(page, { zones: true, hatch: false }), both = await sphere(page, { zones: true, hatch: true });
  expect(both.rowL).toEqual(zones.rowL);
  await page.evaluate(() => { formScene.zones = true; syncFormsPanel(); });
  await expect(page.locator('[data-k="hatch"]')).toBeDisabled();
});
