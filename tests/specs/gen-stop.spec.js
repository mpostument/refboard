// Stop in Generate (js/generate.js genStop, Services/ComfyClient.cs Cancel):
// the button is Stop while pictures are being made; it cancels the one in
// hand and starts none of the rest.
const { test, expect, openApp, fakeServer } = require('../helpers');

test('Stop cancels the picture in hand, starts none of the rest, and the button comes back', async ({ page }) => {
  await fakeServer(page);
  const posts = [], cancels = [];
  let cancelled = false;
  await page.route('**/api/generate**', r => {
    const req = r.request(), url = req.url();
    if (req.method() === 'POST' && url.endsWith('/cancel')) { cancels.push(url); cancelled = true; return r.fulfill({ status: 202 }); }
    if (req.method() === 'POST') { posts.push(1); return r.fulfill({ status: 202, json: { id: 'job1' } }); }
    if (url.endsWith('/api/generate')) return r.fulfill({ json: { available: true, configured: true, quality: 'q', negative: 'n' } });
    // The job: running until it is cancelled.
    return r.fulfill({ json: cancelled ? { state: 'cancelled', error: 'Stopped.' } : { state: 'running' } });
  });
  await openApp(page);
  await page.locator('.nav-item[data-view="generate"]').click();
  await page.selectOption('#genCount', '4');
  const go = page.locator('#genGo');
  await expect(go).toHaveText('Generate');
  await go.click();
  // Working: the same button is Stop, and enabled.
  await expect(go).toHaveText('Stop');
  await expect(go).toBeEnabled();
  await expect(page.locator('#genStatus')).toContainText('Making 1 of 4');
  await go.click();
  await expect(page.locator('#genStatus')).toHaveText('Stopped.');
  await expect(go).toHaveText('Generate');
  await expect(go).toBeEnabled();
  // One picture was started, one cancelled, and the other three never were.
  expect(posts).toHaveLength(1);
  expect(cancels).toHaveLength(1);
  expect(cancels[0]).toContain('/api/generate/job1/cancel');
  // Not taken for ComfyUI being down: no offline banner.
  await expect(page.locator('#genOffline')).toBeHidden();
});
