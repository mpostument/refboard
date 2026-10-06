// A portfolio site from the archive (js/portfolio.js): the pictures kept as
// your own work, as one static page and its images in a .zip. References
// are left out.
const fs = require('fs');
const { test, expect, openApp, makePng } = require('../helpers');

// The zip's files by name - a reader written here, not the app's own.
function unzip(buf) {
  const out = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const size = buf.readUInt32LE(p + 18), n = buf.readUInt16LE(p + 26), x = buf.readUInt16LE(p + 28);
    out[buf.subarray(p + 30, p + 30 + n).toString('utf8')] = buf.subarray(p + 30 + n + x, p + 30 + n + x + size);
    p += 30 + n + x + size;
  }
  return out;
}

test('captions and file names are tidied, and nothing from outside reaches the page unescaped', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => loadSection('backup'));
  const r = await page.evaluate(() => ({
    caption: portfolioCaption('study_of-the-lake  3.jpg'),
    slug: portfolioSlug('Étude — "Lake" <3>.png'),
    empty: [portfolioCaption('.png'), portfolioSlug('???.png')],
    html: portfolioHtml('Me & <b>my</b> work', [{ src: 'images/01-x.png', caption: '"><script>alert(1)</script>', date: '2026-10-06' }]),
  }));
  expect(r.caption).toBe('study of the lake 3');
  expect(r.slug).toMatch(/^[a-z0-9-]+$/);
  expect(r.empty).toEqual(['Untitled', 'work']);
  expect(r.html).toContain('<title>Me &amp; &lt;b&gt;my&lt;/b&gt; work</title>');
  expect(r.html).not.toContain('<script>alert');
  expect(r.html).toContain('&lt;script&gt;');
  // No script of its own, nothing fetched from elsewhere.
  expect(r.html).not.toMatch(/<script|https?:\/\//);
});

test('Your data makes a site of the work kept, not of the references', async ({ page }) => {
  await openApp(page);
  await page.check('#optKeep');
  // One reference, dropped; two photos of work, kept as Compare keeps them.
  await page.setInputFiles('#dropInput', { name: 'reference.png', mimeType: 'image/png', buffer: makePng(16, 16, () => [30, 60, 200]) });
  await page.keyboard.press('Escape');
  await expect(page.locator('#uploadsList .up-tile')).toHaveCount(1);
  await page.click('#btnData');
  // Nothing of one's own yet: the button says so, and is off.
  await expect(page.locator('#portfolioCount')).toContainText('No photos of your work');
  await expect(page.locator('#dataPortfolio')).toBeDisabled();
  await page.click('#dataClose');

  await page.evaluate(async () => {
    const png = async (r, g, b) => {
      const c = document.createElement('canvas'); c.width = c.height = 12;
      const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 12, 12);
      return new Promise(res => c.toBlob(res, 'image/png'));
    };
    await keepUpload(await png(200, 40, 40), { name: 'red_lake-study.png', from: 'work' });
    await new Promise(r => setTimeout(r, 5));
    await keepUpload(await png(40, 200, 40), { name: 'green "tree".png', from: 'work' });
  });
  await page.click('#btnData');
  await expect(page.locator('#portfolioCount')).toContainText('2 pictures');
  await expect(page.locator('#dataPortfolio')).toBeEnabled();
  await page.fill('#portfolioTitle', 'Maksym & friends');

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#dataPortfolio')]);
  expect(download.suggestedFilename()).toMatch(/^portfolio-site-\d{4}-\d\d-\d\d\.zip$/);
  const zip = unzip(fs.readFileSync(await download.path()));
  const names = Object.keys(zip);
  expect(names).toContain('index.html');
  expect(names).toContain('README.txt');
  expect(names).toContain('.nojekyll');
  const images = names.filter(n => n.startsWith('images/'));
  expect(images).toHaveLength(2);              // the reference is not among them
  for (const n of images) expect(zip[n].subarray(0, 4).toString('latin1')).toBe('\x89PNG');
  const html = zip['index.html'].toString('utf8');
  expect(html).toContain('<title>Maksym &amp; friends</title>');
  // Newest first: the green one was kept last.
  // (and the quotes in its name are escaped, not dropped)
  const green = html.indexOf('green &quot;tree&quot;');
  expect(green).toBeGreaterThan(-1);
  expect(green).toBeLessThan(html.indexOf('red lake study'));
  for (const n of images) expect(html).toContain(`href="${n}"`);
  expect(html).not.toContain('reference');
  await expect(page.locator('#dataMsg')).toContainText('2 pictures');
  // The title is remembered.
  expect(await page.evaluate(() => localStorage.getItem(PORTFOLIO_KEY))).toBe('Maksym & friends');
});
