#!/usr/bin/env node
/* Stamps every local script and stylesheet in index.html with a hash of its
   contents - js/paint.js?v=1a2b3c4d - so a browser can never run a new
   index.html with an old paint.js from its cache, or the other way round:
   a changed file is a new URL, an unchanged one keeps its cached copy. The
   hash rather than APP_VERSION because GitHub Pages redeploys on every push
   to main, not only on a release.

   Run after changing anything under js/ or css/:
     node scripts/stamp-assets.js
   CI runs it with --check, which changes nothing and fails if a stamp is
   out of date. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../src/Refboard/wwwroot');
const INDEX = path.join(ROOT, 'index.html');
const check = process.argv.includes('--check');

const html = fs.readFileSync(INDEX, 'utf8');
const stale = [];
const out = html.replace(/((?:src|href)=")((?:js|css)\/[^"?]+)(?:\?v=([0-9a-f]+))?"/g, (all, attr, file, old) => {
  // Line endings normalised first: git stores these files with LF, but a
  // Windows checkout (core.autocrlf) has CRLF on disk - the same file must
  // get the same stamp on every machine, CI and the Docker build included.
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 8);
  if (hash !== old) stale.push(`${file}: ${old || 'none'} -> ${hash}`);
  return `${attr}${file}?v=${hash}"`;
});

if (check) {
  if (stale.length) {
    console.error('index.html has out-of-date asset stamps - run: node scripts/stamp-assets.js\n  ' + stale.join('\n  '));
    process.exit(1);
  }
  console.log('asset stamps up to date');
} else {
  if (stale.length) fs.writeFileSync(INDEX, out);
  console.log(stale.length ? 'stamped:\n  ' + stale.join('\n  ') : 'nothing to stamp');
}
