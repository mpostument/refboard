// The workspace panel (js/workspace.js): the session's tools by question.
const { test, expect, quadrantsPng, openApp } = require('../helpers');

async function openSession(page) {
  await openApp(page);
  await page.setInputFiles('#dropInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await expect(page.locator('#session')).toBeVisible();
}
const tool = (page, name) => page.locator('#wsList .ws-tool', { hasText: name });

test('tabs by question; each row is the toolbar tool itself', async ({ page }) => {
  // A dropped photo opens with the panel, at Value - it is split already.
  await openSession(page);
  await expect(page.locator('#wsPanel')).toBeVisible();
  await expect(page.locator('#wsTabs [role=tab]')).toHaveText(['Value', 'Colour', 'Construction', 'Figure', 'My work', 'Learn']);
  await expect(page.locator('#wsQuestion')).toHaveText('How light or dark is each part?');

  // While the value split is on, Grayscale is off - here as in the toolbar.
  await page.locator('#wsList select').selectOption('3');
  await expect(tool(page, 'Grayscale')).toBeDisabled();
  await page.locator('#wsList select').selectOption('0');
  await expect(page.locator('#valueSelect')).toHaveValue('0');

  // A row presses the real button, and shows its state.
  await tool(page, 'Grayscale').click();
  await expect(page.locator('#img')).toHaveClass(/gray/);
  await expect(tool(page, 'Grayscale')).toHaveAttribute('aria-pressed', 'true');

  // Arrows move between tabs; a layer row turns the layer on; the tab is kept.
  await page.locator('#wsTabs [aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#wsQuestion')).toHaveText('Where are things, and at what angle?');
  await tool(page, 'Grid').click();
  await expect(page.locator('#optGrid')).toBeChecked();

  // A tool turned on from its key lights up here too.
  await page.locator('#wsTabs [data-tab="mywork"]').click();
  await page.evaluate(() => toggleFlip());
  await expect(tool(page, 'Flip')).toHaveAttribute('aria-pressed', 'true');

  // Escape closes the panel, not the session; the tab is there next time.
  await page.locator('#wsTabs [aria-selected="true"]').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wsPanel')).toBeHidden();
  await expect(page.locator('#session')).toBeVisible();
  await page.keyboard.press('w');
  await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('My work');
});

test('the workspace and the layers take turns in the corner', async ({ page }) => {
  await openSession(page);
  await page.click('#btnLayers');
  await expect(page.locator('#layersPanel')).toBeVisible();
  await expect(page.locator('#wsPanel')).toBeHidden();
  await page.click('#btnWorkspace');
  await expect(page.locator('#layersPanel')).toBeHidden();
});

test('the Colour studio opens its picture in the workspace', async ({ page }) => {
  await openApp(page);
  await page.click('.nav-item[data-view="colour"]');
  await expect(page.locator('#colWorkspace')).toBeHidden();
  await page.setInputFiles('#colInput', { name: 'q.png', mimeType: 'image/png', buffer: quadrantsPng() });
  await page.click('#colWorkspace');
  await expect(page.locator('#session')).toBeVisible();
  await expect(page.locator('#wsTabs [aria-selected="true"]')).toHaveText('Colour');
  // No clock: it is looking, not a timed pose.
  await expect(page.locator('#session')).toHaveClass(/browse/);
  // Closing the session goes back to the studio, the picture still there.
  await page.evaluate(() => stopSession());
  await expect(page.locator('#viewColour')).toBeVisible();
  await expect(page.locator('#colImg')).toBeVisible();
});
