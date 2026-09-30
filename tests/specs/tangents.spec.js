// Tangents (js/tangents.js): where two shapes just touch or nearly do, and
// where a shape just touches the paper's edge; in a session as a layer with
// its part of the shared note.
const { test, expect, makePng, openApp } = require('../helpers');

// Draws a picture from canvas code, in the page, and finds its tangents.
async function find(page, w, h, paint) {
  return page.evaluate(async ([w, h, src]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    new Function('g', src)(g);
    const img = new Image(); img.src = c.toDataURL(); await img.decode();
    const m = tangentsOf(stepsRead(img));
    return { all: m.all, say: tangentsVerdict(m) };
  }, [w, h, paint]);
}
const disc = (x, y, r, col = '#222') => `g.fillStyle = '${col}'; g.beginPath(); g.arc(${x}, ${y}, ${r}, 0, 7); g.fill();`;

test('two discs that kiss, and two that nearly do, are tangents - where they meet', async ({ page }) => {
  await openApp(page);
  // Touching at (200, 150).
  const kiss = await find(page, 400, 300, disc(140, 150, 60) + disc(260, 150, 60));
  const s = kiss.all.filter(t => t.kind === 'shapes');
  expect(s).toHaveLength(1);
  expect(Math.abs(s[0].x - 200)).toBeLessThan(8);
  expect(Math.abs(s[0].y - 150)).toBeLessThan(8);
  expect(kiss.say).toContain('1 pink');
  // A hair apart: the same.
  const near = await find(page, 400, 300, disc(138, 150, 60) + disc(264, 150, 60));
  expect(near.all.filter(t => t.kind === 'shapes')).toHaveLength(1);
});

test('overlapping, clearly apart, or sharing a long edge: no tangent', async ({ page }) => {
  await openApp(page);
  const overlap = await find(page, 400, 300, disc(160, 150, 60) + disc(240, 150, 60));
  expect(overlap.all).toHaveLength(0);
  expect(overlap.say).toContain('No tangents');
  const apart = await find(page, 400, 300, disc(110, 150, 55) + disc(290, 150, 55));
  expect(apart.all).toHaveLength(0);
  // A dark block beside a mid-grey one: they share an edge, which is fine.
  const edge = await find(page, 400, 300, "g.fillStyle = '#222'; g.fillRect(80, 80, 120, 140); g.fillStyle = '#888'; g.fillRect(200, 80, 120, 140);");
  expect(edge.all).toHaveLength(0);
  // A head on a neck on shoulders, all one dark silhouette: the neck is
  // narrow, but the ground beside it is open - not a kiss.
  const figure = await find(page, 400, 300, disc(200, 80, 42) + "g.fillRect(182, 110, 36, 50); g.fillRect(110, 150, 180, 150);");
  expect(figure.all.filter(t => t.kind === 'shapes')).toHaveLength(0);
});

test('a disc just touching the top edge is a tangent with the paper; one cut clearly by it is not', async ({ page }) => {
  await openApp(page);
  const touch = await find(page, 400, 300, disc(200, 62, 60));
  const f = touch.all.filter(t => t.kind === 'frame');
  expect(f).toHaveLength(1);
  expect(f[0].side).toBe('top');
  expect(Math.abs(f[0].x - 200)).toBeLessThan(10);
  expect(touch.say).toContain("paper's edge");
  // Half of it off the top: clearly cropped, not a tangent.
  const cut = await find(page, 400, 300, disc(200, 10, 70));
  expect(cut.all.filter(t => t.kind === 'frame')).toHaveLength(0);
});

test('in a session: n marks them over the picture, a layer and a workspace row, and the note x turns it off', async ({ page }) => {
  await openApp(page);
  // Two dark discs touching at (100, 100), on light paper.
  const png = makePng(200, 200, (x, y) => Math.hypot(x - 70, y - 100) < 30 || Math.hypot(x - 130, y - 100) < 30 ? [30, 30, 30] : [240, 240, 240]);
  await page.setInputFiles('#dropInput', { name: 'kiss.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#session')).toBeVisible();
  await page.click('#wsClose');
  await page.keyboard.press('n');
  await expect(page.locator('#btnTangents')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tanOverlay')).toBeVisible();
  const part = page.locator('#poseNote [data-note="tangents"]');
  await expect(part).toContainText('two shapes just touch');

  // The workspace's Composition tab shows it on.
  await page.keyboard.press('w');
  await page.locator('#wsTabs [data-tab="composition"]').click();
  await expect(page.locator('#wsList')).toContainText('Tangents');
  await page.click('#wsClose');

  await part.locator('.note-off').click();
  await expect(page.locator('#btnTangents')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#tanOverlay')).toBeHidden();
  await expect(page.locator('#poseNote [data-note="tangents"]')).toHaveCount(0);
});
