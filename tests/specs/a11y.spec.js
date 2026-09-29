// Accessibility: every control has a name a screen reader can say, focus
// can be seen, and a modal dialog keeps the keyboard inside it.
const { test, expect, openApp, quadrantsPng } = require('../helpers');

// The name a screen reader would read, near enough: aria-label, the
// element aria-labelledby points at, a <label>, the text inside, the title.
const unnamed = page => page.evaluate(() => {
  const visible = n => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
  const name = n => (n.getAttribute('aria-label') || '').trim()
    || (n.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join('').trim()
    || [...(n.labels || [])].map(l => l.textContent).join('').trim()
    || (n.tagName !== 'SELECT' && n.textContent.trim())
    || (n.getAttribute('title') || '').trim();
  return [...document.querySelectorAll('button, select, input:not([type=hidden]), textarea, [role=button], [tabindex="0"]')]
    .filter(n => visible(n) && !name(n))
    .map(n => n.outerHTML.slice(0, 120));
});

test('every control on every screen has a name', async ({ page }) => {
  await openApp(page);
  for (const view of ['dashboard', 'colour', 'palette', 'train', 'forms']) {
    await page.click(`.nav-item[data-view="${view}"]`);
    if (view === 'forms') await expect(page.locator('#formsPanel button').first()).toBeVisible();
    expect(await unnamed(page), view).toEqual([]);
  }
  await page.click('.nav-item[data-view="dashboard"]');
  for (const tab of ['timing', 'filter', 'display']) {
    await page.click(`#inspTabs [data-tab="${tab}"]`);
    expect(await unnamed(page), tab).toEqual([]);
  }
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
  expect(await unnamed(page), 'session').toEqual([]);
});

test('focus can be seen', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
  });
  expect(ring).toBe(true);
});

test('the first Tab offers to skip to the content', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('help takes the focus, keeps Tab inside, and gives it back', async ({ page }) => {
  await openApp(page);
  await page.focus('#btnHelpSetup');
  await page.keyboard.press('Enter');
  await expect(page.locator('#helpOverlay')).toBeVisible();
  const inHelp = () => page.evaluate(() => el('helpOverlay').contains(document.activeElement));
  expect(await inHelp()).toBe(true);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await inHelp()).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#btnHelpSetup')).toBeFocused();
});

test('arrow keys walk the rail', async ({ page }) => {
  await openApp(page);
  await page.focus('.nav-item[data-view="dashboard"]');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#btnLibrary')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.nav-item[data-view="dashboard"]')).toBeFocused();
});

test('a screen reader hears where you went', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="train"]');
  await expect(page.locator('#announce')).toHaveText('Train');
});
