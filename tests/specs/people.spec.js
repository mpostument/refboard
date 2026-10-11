// People in perspective (js/people.js): the second half of the Perspective
// section. The horizon is the eye level; a white reference figure fixes the
// eye's height, and anyone standing anywhere on the ground then has a height
// on the page. Everything in fractions of the picture's height.
const { test, expect, makePng, openApp } = require('../helpers');

const open = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgSheet svg')).toBeVisible();
  await page.click('#pgMode [data-mode="people"]');
  await expect(page.locator('#ppSvg .pp-handle').first()).toBeVisible();
};
// A point on the stage, as fractions of the picture, in page pixels.
const at = async (page, fx, fy) => {
  const b = await page.locator('#ppSvg').boundingBox();
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};
const state = page => page.evaluate(() => ({ ...ppl, people: ppl.people.map(p => ({ ...p })) }));

test('the maths: the eye\'s height from the figure, a person\'s height from their feet, where the horizon falls on a body', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('perspective');
    const s = { hor: 0.4, feet: 0.8, high: 0.4, refM: 1.7, people: [] };
    const high = { ...s, high: 0.2 };
    return {
      eye: ppEye(s), eyeHigh: ppEye(high),
      adultNear: ppTall(s, 0.8, 1.7), adultFar: ppTall(s, 0.6, 1.7), child: ppTall(s, 0.8, 1.2), tall: ppTall(s, 0.8, 1.9),
      atHorizon: ppTall(s, 0.4, 1.7), above: ppTall(s, 0.3, 1.7), highAdult: ppTall(high, 0.6, 1.7),
      at: [1.2, 1.0, 0.85, 0.7, 0.55, 0.45, 0.3, 0.1].map(ppAt),
    };
  });
  expect(r.eye).toBeCloseTo(1.7, 9);                  // the horizon at the head of a 1.7 m figure: the eye is 1.7 m up
  expect(r.adultNear).toBeCloseTo(0.4, 9);            // the figure itself
  expect(r.adultFar).toBeCloseTo(0.2, 9);             // half as far below the horizon: half as tall
  expect(0.6 - r.adultFar).toBeCloseTo(0.4, 9);       // ... and the head is on the horizon
  expect(r.child).toBeCloseTo(0.4 * 1.2 / 1.7, 9);
  expect(0.8 - r.tall).toBeLessThan(0.4);             // someone taller has their head above the horizon
  expect(r.atHorizon).toBe(0);                        // at the horizon: nothing, however tall
  expect(r.above).toBe(0);                            // above it is sky: no height
  expect(r.eyeHigh).toBeCloseTo(3.4, 9);              // the same feet, half the height on the page: the eye twice as high
  expect(r.highAdult).toBeCloseTo(0.1, 9);
  expect(r.at).toEqual(['above the head', 'at the eyes', 'at the shoulders', 'at the chest', 'at the waist', 'at the hips', 'at the knees', 'at the ankles']);
});

test('the Perspective section has two halves: the grid sheet by default, People by a switch that is remembered', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgSheet svg')).toBeVisible();
  await expect(page.locator('#pgMode [data-mode="sheet"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pgPeopleMode')).toBeHidden();
  await page.click('#pgMode [data-mode="people"]');
  await expect(page.locator('#pgPeopleMode')).toBeVisible();
  await expect(page.locator('#pgSheetMode')).toBeHidden();
  await expect(page.locator('#pgMode [data-mode="people"]')).toHaveAttribute('aria-pressed', 'true');
  // The street, the white figure's two handles and the horizon to drag.
  await expect(page.locator('#ppSvg .pp-handle')).toHaveCount(2);
  await expect(page.locator('#ppSvg [data-h="hor"]')).toHaveCount(1);
  await expect(page.locator('#ppNote')).toContainText('The horizon is at the eyes of the white figure');
  // Away and back: People is still the half that opens.
  await page.click('.nav-item[data-view="dashboard"]');
  await page.click('.nav-item[data-view="perspective"]');
  await expect(page.locator('#pgPeopleMode')).toBeVisible();
  await page.click('#pgMode [data-mode="sheet"]');
  await expect(page.locator('#pgSheet svg')).toBeVisible();
  await expect(page.locator('#pgPeopleMode')).toBeHidden();
});

test('the sliders move the horizon and the figure, and the note says what that means for the eye', async ({ page }) => {
  await open(page);
  await page.locator('#ppHigh').fill('20');                  // the same feet, much shorter on the page: the eye is up high
  expect((await state(page)).high).toBeCloseTo(0.2, 6);
  await expect(page.locator('#ppNote')).toContainText('above the head of the white figure');
  await expect(page.locator('#ppNote')).toContainText('3.9 m');
  await expect(page.locator('#ppNote')).toContainText('A high view');
  await page.locator('#ppHigh').fill('80');                  // taller than the horizon allows ... a low view
  await page.locator('#ppHor').fill('70');
  const s = await state(page);
  expect(s.hor).toBeCloseTo(0.7, 6);
  expect(s.feet).toBeGreaterThanOrEqual(s.hor + 0.03 - 1e-9);   // the figure still stands on the ground
  await page.locator('#ppRefM').fill('1.2');
  await page.locator('#ppRefM').press('Tab');
  expect((await state(page)).refM).toBe(1.2);
  // The state is kept for next time.
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem(PP_KEY)));
  expect(kept).toMatchObject({ refM: 1.2 });
  expect(kept.hor).toBeCloseTo(0.7, 6);
});

test('clicking the ground stands a person of the chosen kind at the height the rule gives; the sky takes none', async ({ page }) => {
  await open(page);
  // The defaults put the horizon at the white figure's head: an adult's head is on it wherever they stand.
  const before = await state(page);
  expect(before.hor).toBeCloseTo(before.feet - before.high, 9);
  await page.mouse.click(...Object.values(await at(page, 0.3, 0.7)));
  let s = await state(page);
  expect(s.people).toHaveLength(1);
  expect(s.people[0].kind).toBe('adult');
  expect(s.people[0].y).toBeCloseTo(0.7, 1);
  const tall = await page.evaluate(() => ppTall(ppl, ppl.people[0].y, ppl.people[0].m));
  expect(s.people[0].y - tall).toBeCloseTo(s.hor, 6);      // the adult's head is on the horizon
  await expect(page.locator('#ppSvg .pp-fig')).toHaveCount(2);   // the white figure and the one just stood
  // A child, further away: shorter, and the horizon is above the head.
  await page.click('#ppKind [data-kind="child"]');
  await page.mouse.click(...Object.values(await at(page, 0.7, 0.7)));
  s = await state(page);
  expect(s.people).toHaveLength(2);
  const kid = await page.evaluate(() => ppTall(ppl, ppl.people[1].y, ppl.people[1].m));
  const adult = await page.evaluate(() => ppTall(ppl, ppl.people[1].y, 1.7));
  expect(kid).toBeCloseTo(adult * 1.2 / 1.7, 6);
  expect(s.people[1].y - kid).toBeGreaterThan(s.hor);       // the child's head is under the horizon
  // The sky: nobody stands there.
  await page.mouse.click(...Object.values(await at(page, 0.5, 0.1)));
  expect((await state(page)).people).toHaveLength(2);
  await expect(page.locator('#ppNote')).toContainText('Above the horizon is sky');
  // Clear takes them all off.
  await page.click('#ppClear');
  expect((await state(page)).people).toHaveLength(0);
});

test('people along the ground: five at different distances, near big and far small, every adult\'s head on the horizon, the guides meeting there', async ({ page }) => {
  await open(page);
  await page.click('#ppAlong');
  const s = await state(page);
  expect(s.people).toHaveLength(5);
  const h = await page.evaluate(() => ppl.people.map(p => ({ y: p.y, t: ppTall(ppl, p.y, p.m) })));
  const byY = [...h].sort((a, b) => a.y - b.y);
  for (let i = 1; i < byY.length; i++) expect(byY[i].t).toBeGreaterThan(byY[i - 1].t);    // lower on the page: taller
  for (const p of h) expect(p.y - p.t).toBeCloseTo(s.hor, 6);
  // The dashed guides, feet to feet and head to head of the white figure and the last person, and the point where they meet.
  await expect(page.locator('#ppSvg line[stroke-dasharray="6 5"]')).toHaveCount(2);
  const vp = await page.evaluate(() => {
    const ls = [...document.querySelectorAll('#ppSvg line[stroke-dasharray="6 5"]')].map(l => [+l.getAttribute('x2'), +l.getAttribute('y2')]);
    return { a: ls[0], b: ls[1], hy: ppl.hor * ppView().H };
  });
  expect(vp.a[0]).toBeCloseTo(vp.b[0], 0);
  expect(vp.a[1]).toBeCloseTo(vp.hy, 0);
  await expect(page.locator('#ppNote')).toContainText('5 standing on the ground');
});

test('dragging: the horizon, the white figure\'s head, a person; two quick presses take a person away', async ({ page }) => {
  await open(page);
  const s0 = await state(page);
  // The horizon: from its line, up.
  const from = await at(page, 0.12, s0.hor), to = await at(page, 0.12, 0.2);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  expect((await state(page)).hor).toBeCloseTo(0.2, 1);
  // The white figure's head: up by a tenth of the picture makes it that much taller on the page.
  const s1 = await state(page);
  const head = await at(page, s1.refX, s1.feet - s1.high), up = await at(page, s1.refX, s1.feet - s1.high - 0.1);
  await page.mouse.move(head.x, head.y); await page.mouse.down(); await page.mouse.move(up.x, up.y, { steps: 6 }); await page.mouse.up();
  expect((await state(page)).high).toBeCloseTo(s1.high + 0.1, 1);
  // A person, stood and then moved.
  await page.mouse.click(...Object.values(await at(page, 0.25, 0.8)));
  let s = await state(page);
  expect(s.people).toHaveLength(1);
  const pf = await at(page, s.people[0].x, s.people[0].y), pt = await at(page, 0.8, 0.9);
  await page.mouse.move(pf.x, pf.y); await page.mouse.down(); await page.mouse.move(pt.x, pt.y, { steps: 6 }); await page.mouse.up();
  s = await state(page);
  expect(s.people).toHaveLength(1);
  expect(s.people[0].x).toBeCloseTo(0.8, 1);
  expect(s.people[0].y).toBeCloseTo(0.9, 1);
  // A drag that ended on a person is not the first of two presses: one click straight after it takes no one away
  // (the first version of this removed the person at the click and stood a new one with the second press).
  const pg = await at(page, s.people[0].x, s.people[0].y);
  await page.mouse.click(pg.x, pg.y);
  expect((await state(page)).people).toHaveLength(1);
  await page.waitForTimeout(600);
  // Two quick presses on the person's handle take it off.
  await page.mouse.dblclick(pg.x, pg.y);
  expect((await state(page)).people).toHaveLength(0);
  // None of that stood anyone by mistake.
  expect((await state(page)).people).toHaveLength(0);
});

test('a picture of your own is held in the page and takes the picture\'s shape; the street comes back; Reset puts the figure back', async ({ page }) => {
  await open(page);
  await expect(page.locator('#ppSvg')).toHaveAttribute('viewBox', '0 0 1000 640');
  await page.setInputFiles('#ppFile', { name: 'street.png', mimeType: 'image/png', buffer: makePng(300, 150, (x, y) => y < 60 ? [150, 190, 230] : [120, 120, 120]) });
  await expect(page.locator('#ppSvg')).toHaveAttribute('viewBox', '0 0 1000 500');
  await expect(page.locator('#ppBase image')).toHaveCount(1);
  await page.click('#ppAlong');
  expect((await state(page)).people).toHaveLength(5);
  await page.click('#ppSample');
  await expect(page.locator('#ppSvg')).toHaveAttribute('viewBox', '0 0 1000 640');
  await expect(page.locator('#ppBase image')).toHaveCount(0);
  expect((await state(page)).people).toHaveLength(0);
  // The sample street runs to the horizon wherever it is put: the road's two sides meet on it.
  await page.locator('#ppHor').fill('25');
  const meet = await page.evaluate(() => {
    const road = [...document.querySelectorAll('#ppBase polygon')][0].getAttribute('points').split(' ')[0].split(',').map(Number);
    return { y: road[1], hy: ppl.hor * ppView().H };
  });
  expect(meet.y).toBeCloseTo(meet.hy, 0);
  await page.click('#ppReset');
  const s = await state(page);
  expect(s).toMatchObject({ hor: 0.42, feet: 0.88, high: 0.46, refM: 1.7 });
});
