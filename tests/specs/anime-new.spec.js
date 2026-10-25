// Anime study's Gesture, Tones, Effects, Shots, Legs, Silhouettes and Compare, and the eye's Steps
// (js/animenew.js, js/animenewui.js, js/animedraw.js).
const { openSection, test, expect, makePng, openApp } = require('../helpers');

const run = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => { await loadSection('anime'); return new Function('a', 'return (' + fn + ')(a)')(arg); }, { fn: fn.toString(), arg });

test('gesture: an S, a C and a straight line are told apart, and the tilts of the shoulders and hips are read', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const P = (x, y) => ({ x, y });
    const read = (chestX, hipX, sl, sr, hl, hr) => anGestureRead([P(200, 0), P(chestX, 120), P(hipX, 260), P(200, 500), sl, sr, hl, hr]);
    const level = [P(150, 100), P(250, 100), P(160, 250), P(240, 250)];
    return {
      s: read(235, 165, ...level).kind, c: read(240, 245, ...level).kind, i: read(201, 200, ...level).kind,
      against: read(235, 165, P(150, 90), P(250, 110), P(160, 262), P(240, 238)),
      stiff: read(235, 165, ...level),
    };
  });
  expect(r.s).toBe('S');
  expect(r.c).toBe('C');
  expect(r.i).toBe('I');
  expect(r.against.against).toBeGreaterThanOrEqual(8);
  expect(r.against.notes.join(' ')).toContain('contrapposto');
  expect(r.stiff.notes.join(' ')).toContain('stiff');
});

test('gesture: eight marks on a picture read the line, and a mark is taken back', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=gesture]').click();
  await expect(page.locator('#agtPane')).toBeVisible();
  await page.locator('#agtInput').setInputFiles({ name: 'fig.png', mimeType: 'image/png', buffer: makePng(200, 300, () => [240, 240, 240]) });
  const cv = page.locator('#agtCanvas');
  await expect(cv).toBeVisible();
  const box = await cv.boundingBox();
  const at = (fx, fy) => ({ position: { x: box.width * fx, y: box.height * fy } });
  const marks = [[0.5, 0.05], [0.6, 0.3], [0.4, 0.55], [0.5, 0.95], [0.35, 0.28], [0.65, 0.3], [0.38, 0.57], [0.62, 0.52]];
  for (const [fx, fy] of marks.slice(0, 7)) await cv.click(at(fx, fy));
  await expect(page.locator('#agtStatus')).toContainText('mark 8 of 8');
  await page.locator('#agtUndo').click();
  await expect(page.locator('#agtStatus')).toContainText('mark 7 of 8');
  await cv.click(at(...marks[6])); await cv.click(at(...marks[7]));
  await expect(page.locator('#agtNote')).toContainText('curve');
  await page.locator('#agtNext').click();
  await expect(page.locator('#agtPose')).not.toHaveText('Press Next pose');
  await expect(page.locator('#agtTimer')).toHaveText('1:00');
});

test('tones: a pattern for each tone, the paper bare and the darkest solid', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const out = {};
    for (const kind of Object.keys(AN_TONE_KINDS)) {
      const share = lv => { let c = 0; for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (anToneInk(kind, lv, x, y, 5)) c++; return c / 3600; };
      out[kind] = [0, 1, 2, 3, 4].map(share);
    }
    // A ramp from white to black gives all five tones.
    const w = 100, h = 10, gray = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = 255 - Math.round(x * 2.55);
    const res = anToneLevels(gray, w, h, 5);
    return { out, shares: res.shares };
  });
  for (const k of Object.keys(r.out)) {
    expect(r.out[k][0]).toBe(0);
    expect(r.out[k][4]).toBe(1);
    expect(r.out[k][1]).toBeGreaterThan(0);
    for (let i = 1; i < 5; i++) expect(r.out[k][i]).toBeGreaterThanOrEqual(r.out[k][i - 1]);
  }
  expect(r.shares.every(s => s > 0.1)).toBe(true);
});

test('tones: a picture is inked, and the table follows the pen', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=tones]').click();
  await expect(page.locator('#atoKey')).toContainText('about 2 mm apart');
  await page.locator('#atoKind [data-v=dots]').click();
  await expect(page.locator('#atoKey')).toContainText('A few dots');
  await page.locator('#atoInput').setInputFiles({ name: 'ramp.png', mimeType: 'image/png', buffer: makePng(120, 80, x => [255 - x * 2, 255 - x * 2, 255 - x * 2]) });
  await expect(page.locator('#atoPair')).toBeVisible();
  await expect(page.locator('#atoNote')).toContainText('stays paper');
  await expect(page.locator('#atoSave')).toBeVisible();
});

test('effects: four kinds, each a different picture; a seed gives the same one again', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const svgs = Object.keys(AN_FX).map(k => anEffectSvg({ kind: k, seed: 5, density: 2 }));
    return { svgs, same: anEffectSvg({ kind: 'speed', seed: 9, density: 2 }) === anEffectSvg({ kind: 'speed', seed: 9, density: 2 }), other: anEffectSvg({ kind: 'speed', seed: 10, density: 2 }) !== anEffectSvg({ kind: 'speed', seed: 9, density: 2 }),
      many: anEffectSvg({ kind: 'focus', seed: 3, density: 3 }).length > anEffectSvg({ kind: 'focus', seed: 3, density: 1 }).length };
  });
  expect(new Set(r.svgs).size).toBe(4);
  expect(r.same).toBe(true); expect(r.other).toBe(true); expect(r.many).toBe(true);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=effects]').click();
  await expect(page.locator('#afxStage svg')).toBeVisible();
  await page.locator('#afxKind [data-v=burst]').click();
  await expect(page.locator('#afxNote')).toContainText('spiked star');
  await expect(page.locator('#afxDirRow')).toBeHidden();
  await page.locator('#afxKind [data-v=speed]').click();
  await expect(page.locator('#afxDirRow')).toBeVisible();
});

test('shots: the cuts get tighter, and an extreme close-up is the strip of the eyes', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => anShotRects({ x: 100, y: 20 }, { x: 100, y: 720 }, 16 / 9).map(s => ({ key: s.key, h: Math.round(s.h), w: Math.round(s.w), y: Math.round(s.y) })));
  const hs = r.map(s => s.h);
  expect(hs[0]).toBeGreaterThan(hs[1]);
  expect(hs[1]).toBeLessThan(hs[2]);          // medium (waist) is tighter than cowboy
  expect(hs[3]).toBeGreaterThan(hs[4]);
  expect(hs[4]).toBeGreaterThan(hs[5]);
  expect(r.find(s => s.key === 'xcu').w / r.find(s => s.key === 'xcu').h).toBeCloseTo(16 / 9, 1);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=shots]').click();
  await page.locator('#astInput').setInputFiles({ name: 'fig.png', mimeType: 'image/png', buffer: makePng(200, 320, (x, y) => (Math.abs(x - 100) < 25 ? [60, 60, 90] : [235, 235, 235])) });
  const cv = page.locator('#astCanvas');
  await expect(cv).toBeVisible();
  const box = await cv.boundingBox();
  await cv.click({ position: { x: box.width / 2, y: box.height * 0.08 } });
  await cv.click({ position: { x: box.width / 2, y: box.height * 0.95 } });
  await expect(page.locator('#astGrid canvas')).toHaveCount(6);
  await page.locator('#astAspect [data-v="1:1"]').click();
  await expect(page.locator('#astGrid canvas').first()).toBeVisible();
  await expect(page.locator('#astSave')).toBeVisible();
});

test('legs: every legwear and shoe is a different picture with a front and a side', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const svgs = [];
    for (const wear of Object.keys(AN_LEGWEAR)) for (const shoe of Object.keys(AN_SHOES)) svgs.push(anLegsSvg({ wear, shoe, skin: '#f1c9a5' }));
    return { n: svgs.length, distinct: new Set(svgs).size, ok: svgs.every(s => s.includes('Front') && s.includes('Side') && s.startsWith('<svg')) };
  });
  expect(r.n).toBe(16);
  expect(r.distinct).toBe(16);
  expect(r.ok).toBe(true);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=legs]').click();
  await expect(page.locator('#algStage svg')).toBeVisible();
  await page.locator('#algWear [data-v=knee]').click();
  await expect(page.locator('#algNote')).toContainText('Knee socks');
  await page.locator('#algShoe [data-v=boot]').click();
  await expect(page.locator('#algNote')).toContainText('shaft');
});

test('silhouettes: the same shape overlaps fully, another does not, and a busy background is said', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const mk = (draw) => {
      const w = 120, h = 160, rgba = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, on = draw(x, y); rgba[i] = on ? 40 : 250; rgba[i + 1] = on ? 40 : 250; rgba[i + 2] = on ? 60 : 250; rgba[i + 3] = 255; }
      const m = anSilhouette(rgba, w, h);
      return { ...anSilScale(m.mask, w, h), found: m.found };
    };
    const tall = mk((x, y) => Math.abs(x - 60) < 18 && y > 20 && y < 150);
    const tall2 = mk((x, y) => Math.abs(x - 60) < 18 && y > 20 && y < 150);
    const wide = mk((x, y) => Math.abs(x - 60) < 50 && y > 60 && y < 100);
    const blank = mk(() => false);
    return { same: anSilOverlap(tall, tall2), diff: anSilOverlap(tall, wide), found: tall.found, blank: blank.found, note: anSilNote([tall, wide]).join(' ') };
  });
  expect(r.same).toBeGreaterThan(0.95);
  expect(r.diff).toBeLessThan(0.5);
  expect(r.found).toBe(true);
  expect(r.blank).toBe(false);
  expect(r.note).toContain('read apart');
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=silhouette]').click();
  const disc = (c) => makePng(120, 160, (x, y) => (Math.hypot(x - 60, y - 80) < c ? [30, 30, 40] : [250, 250, 250]));
  await page.locator('#asiInput').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: disc(40) }, { name: 'b.png', mimeType: 'image/png', buffer: disc(40) }]);
  await expect(page.locator('#asiCanvas')).toBeVisible();
  await expect(page.locator('#asiNote')).toContainText('almost one person');
});

test('compare: the same picture agrees fully, a darker drawing is red, and the grid and the timer work', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const mk = v => { const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, 80, 60); return c; };
    const same = anCmpDiff(mk(200), mk(200)), dark = anCmpDiff(mk(200), mk(60)), light = anCmpDiff(mk(100), mk(240));
    return { same: same.score, dark: dark.score, darker: dark.darker, lighter: light.lighter, note: anCmpNote(dark).join(' ') };
  });
  expect(r.same).toBeGreaterThanOrEqual(99);
  expect(r.dark).toBeLessThan(r.same);
  expect(r.darker).toBeGreaterThan(0.9);
  expect(r.lighter).toBeGreaterThan(0.9);
  expect(r.note).toContain('darker');
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=compare]').click();
  const png = v => makePng(80, 60, () => [v, v, v]);
  await page.locator('#acpRefInput').setInputFiles({ name: 'ref.png', mimeType: 'image/png', buffer: png(200) });
  await expect(page.locator('#acpCanvas')).toBeVisible();
  await page.locator('#acpGrid [data-v="4"]').click();
  await expect(page.locator('#acpNote')).toContainText('4 x 4');
  await page.locator('#acpMineInput').setInputFiles({ name: 'mine.png', mimeType: 'image/png', buffer: png(60) });
  await expect(page.locator('#acpNote')).toContainText('darker');
  await page.locator('#acpMode [data-v=diff]').click();
  await expect(page.locator('#acpOpacity')).toBeDisabled();
  await page.locator('#acpMinutes [data-v="1"]').click();
  await page.locator('#acpTimer').click();
  await expect(page.locator('#acpClock')).toHaveText(/^(1:00|0:5\d)$/);
  await page.locator('#acpTimer').click();
  await expect(page.locator('#acpClock')).toHaveText('');
});

test('eyes: the six stages build up and the Steps look gives the layers for the material', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const at = stage => adEyeSvg({ shape: 'tsurime', era: 'modern', tall: 1, iris: 1, hl: 'two', lash: 3, colour: '#3f7fb8', stage, key: 's' });
    return { len: [1, 2, 3, 4, 5, 6].map(s => at(s).length), whole: at(undefined).length === at(6).length, sheet: adEyeStepsSvg({ shape: 'tsurime', era: 'modern', tall: 1, iris: 1, hl: 'two', lash: 3, colour: '#3f7fb8' }) };
  });
  for (let i = 1; i < 6; i++) expect(r.len[i]).toBeGreaterThan(r.len[i - 1]);
  expect(r.whole).toBe(true);
  expect((r.sheet.match(/<svg /g) || []).length).toBe(7);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=eyes]').click();
  await expect(page.locator('#aeyMatRow')).toBeHidden();
  await page.locator('#aeyLook [data-v=steps]').click();
  await expect(page.locator('#aeyMatRow')).toBeVisible();
  await expect(page.locator('#aeyNote li')).toHaveCount(6);
  await expect(page.locator('#aeyNote')).toContainText('bare paper');
  await page.locator('#aeyMat [data-v=ink]').click();
  await expect(page.locator('#aeyNote')).toContainText('lashes flicked');
  await page.locator('#aeyLook [data-v=final]').click();
  await expect(page.locator('#aeyMatRow')).toBeHidden();
});

test('the switch is in three groups and every mode shows only its own pane', async ({ page }) => {
  await openApp(page);
  await openSection(page, 'anime');
  await expect(page.locator('#asMode .am-group')).toHaveText(['Colour', 'Drawing', 'Scene and pose']);
  const modes = await page.locator('#asMode [data-mode]').evaluateAll(bs => bs.map(b => b.dataset.mode));
  expect(modes.length).toBe(26);
  for (const m of modes) {
    await page.locator(`#asMode [data-mode="${m}"]`).click();
    await expect(page.locator('#viewAnime .pg-body:not(.hidden)')).toHaveCount(1);
  }
});

test('construction: the weight is on the higher hip, its foot under the balance line, and the notes follow the tilts', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const a = anConstruct({ shoulders: 8, hips: -10, shift: 12 }), b = anConstruct({ shoulders: 8, hips: 10, shift: 0 });
    const level = anConstruct({ shoulders: 0, hips: 0, shift: 0 });
    return {
      // Hips -10: the right side of the picture goes up, so the weight is on the right leg.
      aLeft: a.weightLeft, bLeft: b.weightLeft, onLine: Math.abs(a.wAnkle[0] - a.balance) < 0.01, floor: a.wAnkle[1] === a.floor,
      free: a.fAnkle[0] !== a.wAnkle[0], levelSame: level.LH[1] === level.RH[1],
      relaxed: anConstructNotes({ shoulders: 8, hips: -10, shift: 0 }).join(' '), plank: anConstructNotes({ shoulders: 12, hips: 12, shift: 0 }).join(' '), stiff: anConstructNotes({ shoulders: 0, hips: 0, shift: 0 }).join(' '),
      far: anConstructNotes({ shoulders: 8, hips: -10, shift: 35 }).join(' '), svg: anConstructSvg({ shoulders: 8, hips: -10, shift: 12 }),
    };
  });
  expect(r.aLeft).toBe(false);
  expect(r.bLeft).toBe(true);
  expect(r.onLine).toBe(true); expect(r.floor).toBe(true); expect(r.free).toBe(true); expect(r.levelSame).toBe(true);
  expect(r.relaxed).toContain('contrapposto');
  expect(r.plank).toContain('plank');
  expect(r.stiff).toContain('attention');
  expect(r.far).toContain('far over the pelvis');
  expect(r.svg).toContain('balance');
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=construct]').click();
  await expect(page.locator('#acnStage svg')).toBeVisible();
  await page.locator('#acnLevel').click();
  await expect(page.locator('#acnNote')).toContainText('attention');
  await page.locator('#acnRelaxed').click();
  await expect(page.locator('#acnNote')).toContainText('contrapposto');
  await page.locator('#acnSh').fill('-20');
  await expect(page.locator('#acnStage svg')).toContainText('shoulders -20');
});

test('the light on a face: eight lights are eight pictures, from the front it has the least shadow', async ({ page }) => {
  await openApp(page);
  const r = await run(page, () => {
    const svgs = Object.keys(AN_FACE_LIGHTS).map(k => anFaceLightSvg({ light: k, skin: '#f1c9a5' }));
    return { n: svgs.length, distinct: new Set(svgs).size, ok: svgs.every(s => s.startsWith('<svg') && s.includes('clipPath')) };
  });
  expect(r.n).toBe(8); expect(r.distinct).toBe(8); expect(r.ok).toBe(true);
  await openSection(page, 'anime');
  await page.locator('#asMode [data-mode=facelight]').click();
  await expect(page.locator('#alfStage svg')).toBeVisible();
  await page.locator('#alfLight [data-v=below]').click();
  await expect(page.locator('#alfNote')).toContainText('ghost story');
  await page.locator('#alfLight [data-v=back]').click();
  await expect(page.locator('#alfNote')).toContainText('rim light');
});
