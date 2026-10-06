/* refboard - A portfolio site from what you have kept: your own work, as a
   small static gallery to publish on GitHub Pages, as refboard itself is.
   Loaded with the backup (loadSection('backup')) - it needs the same zip
   writer - the first time Your data is opened.

   What goes in: the pictures kept as your work - the photos Compare takes of
   your drawing, and anything sorted into the My work folder (js/sort.js) -
   newest first. References are not: they are other people's.

   What comes out is one .zip with index.html (one file, its style inside it, no
   script, no tracking, nothing fetched from anywhere), the pictures beside it
   under images/, a .nojekyll file and a README that says how to publish it.
   A picture's caption is its file's name, tidied; it is the place to edit the
   page afterwards, in any text editor. */
"use strict";

// A file's name as a caption: no extension, no dashes and underscores.
const portfolioCaption = name => name.replace(/\.[^./\\]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';

// A file's name as a path part: plain letters and digits, at most 40.
function portfolioSlug(name) {
  return portfolioCaption(name).normalize('NFKD').replace(/[^\w ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'work';
}

/* The page. items: [{ src: 'images/01-name.jpg', caption, date: '2026-10-06' }].
   Everything that comes from outside is escaped; the page has no script. */
function portfolioHtml(title, items) {
  const cards = items.map(it =>
    `<figure><a href="${esc(it.src)}"><img src="${esc(it.src)}" alt="${esc(it.caption)}" loading="lazy"></a>` +
    `<figcaption>${esc(it.caption)}<time datetime="${esc(it.date)}">${esc(it.date)}</time></figcaption></figure>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { --bg: #fff; --ink: #1d1d1f; --dim: #6b6b72; --line: #e3e3e6; }
@media (prefers-color-scheme: dark) { :root { --bg: #17171a; --ink: #ececf0; --dim: #9a9aa4; --line: #2c2c32; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
header, main, footer { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
header { padding-top: 40px; padding-bottom: 8px; }
h1 { margin: 0; font-size: 28px; font-weight: 600; }
header p { margin: 4px 0 0; color: var(--dim); }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; padding-top: 24px; padding-bottom: 24px; }
figure { margin: 0; }
figure a { display: block; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: var(--line); }
figure img { display: block; width: 100%; height: auto; }
figcaption { display: flex; justify-content: space-between; gap: 8px; padding-top: 6px; font-size: 14px; }
time { color: var(--dim); white-space: nowrap; }
footer { padding-bottom: 40px; font-size: 13px; color: var(--dim); }
</style>
</head>
<body>
<header><h1>${esc(title)}</h1><p>${items.length} piece${items.length === 1 ? '' : 's'}</p></header>
<main>
${cards}
</main>
<footer>Made with refboard.</footer>
</body>
</html>
`;
}

const PORTFOLIO_README = `This folder is a static website: index.html and the pictures in images/.

To put it on the web with GitHub Pages:
  1. Make a repository on GitHub (it can be called anything) and add these files to it.
  2. In the repository's Settings > Pages, choose "Deploy from a branch", the main branch, the root folder.
  3. A minute later the page is at https://<your name>.github.io/<repository>/.

Or open index.html here, in any browser, to see it as it is.

To change a caption or the order, open index.html in a text editor: each picture is one
<figure> block, and the blocks can be moved, edited or deleted.
`;

// The pictures kept as work, newest first, as { src, caption, date, file, ... }.
function portfolioItems(list) {
  return list.filter(isWork).map((u, i) => {
    const ext = FILE_EXT[u.type] || '.' + (u.file.split('.').pop() || 'jpg');
    const src = `images/${String(i + 1).padStart(2, '0')}-${portfolioSlug(u.name)}${ext}`;
    return { u, src, caption: portfolioCaption(u.name), date: new Date(u.t || Date.now()).toISOString().slice(0, 10) };
  });
}

async function makePortfolio() {
  const btn = el('dataPortfolio');
  btn.disabled = true;
  try {
    const title = (el('portfolioTitle').value.trim() || 'My work').slice(0, 80);
    try { localStorage.setItem(PORTFOLIO_KEY, title); } catch { /* private mode */ }
    const items = portfolioItems(await listUploads());
    if (!items.length) { dataMessage('Nothing to publish yet: no photos of your work are kept.', true); return; }
    const entries = [];
    for (const [i, it] of items.entries()) {
      dataMessage(`Adding picture ${i + 1} of ${items.length}...`);
      const blob = await storeFileBlob(it.u.file);
      if (!blob) { it.gone = true; continue; }
      entries.push({ name: it.src, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const kept = items.filter(it => !it.gone), enc = new TextEncoder();
    entries.unshift(
      { name: 'index.html', data: enc.encode(portfolioHtml(title, kept)) },
      { name: '.nojekyll', data: new Uint8Array(0) },
      { name: 'README.txt', data: enc.encode(PORTFOLIO_README) });
    const zip = makeZip(entries), a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = `portfolio-site-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    dataMessage(`Portfolio site made: ${kept.length} picture${kept.length === 1 ? '' : 's'}, ${fmtBytes(zip.size)}. Its README says how to publish it.`);
  } catch (err) {
    dataMessage('The portfolio could not be made - ' + err.message, true);
  } finally {
    btn.disabled = false;
  }
}
