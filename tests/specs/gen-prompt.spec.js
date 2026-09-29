// Generate's Prompt box (js/generate.js renderGenPrompt): the tags as sent,
// hidden until asked; what the choices keep out, each one a switch; the
// server's own negative shown, with no switch.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('the prompt shown on asking, and a tag to keep out switched off', async ({ page }) => {
  await fakeServer(page);
  const asked = [];
  await page.route('**/api/generate**', r => {
    const req = r.request();
    if (req.method() === 'POST') { asked.push(JSON.parse(req.postData())); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (!req.url().endsWith('/api/generate')) return r.fulfill({ json: { state: 'error', error: 'stopped' } });
    return r.fulfill({ json: { available: true, quality: 'masterpiece, absurdres', negative: 'lowres, bad hands, nsfw' } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  const box = page.locator('#genPrompt');
  // Closed by default.
  await expect(box).not.toHaveAttribute('open', '');
  await expect(page.locator('#genPromptBody')).toBeHidden();

  await page.click('[data-gen="medium"][data-opt="ink"]');
  await box.locator('summary').click();
  const body = page.locator('#genPromptBody');
  await expect(body).toContainText('ink \\(medium\\)');
  await expect(body).toContainText('masterpiece, absurdres');
  // The server's own: shown, never a switch.
  await expect(body).toContainText('lowres, bad hands, nsfw');
  await expect(page.locator('[data-avoid="nsfw"]')).toHaveCount(0);

  const sepia = page.locator('[data-avoid="sepia"]');
  await expect(sepia).toHaveAttribute('aria-pressed', 'true');
  await sepia.click();
  await expect(sepia).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#genAvoidReset')).toBeVisible();
  // Typed tags show as they are typed.
  await page.fill('#genExtra', 'umbrella');
  await expect(body).toContainText('umbrella');

  await page.selectOption('#genCount', '1');
  await page.click('#genGo');
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0].avoid).not.toContain('sepia');
  expect(asked[0].avoid).toContain('holding pen');

  // Kept: the box open, sepia still off - and back on in one click.
  await page.reload();
  await page.locator('.nav-item[data-view="generate"]').click();
  await expect(box).toHaveAttribute('open', '');
  await expect(page.locator('[data-avoid="sepia"]')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#genAvoidReset');
  await expect(page.locator('[data-avoid="sepia"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#genAvoidReset')).toHaveCount(0);
});
