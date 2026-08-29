#!/usr/bin/env node
// Guards against the exact bug fixed in v0.4.2: a replaced element (<svg>,
// <canvas>, <img>, <video>) positioned via `position:absolute`/`inset` with
// no explicit width/height. A <div> in that spot stretches to fill its
// positioned ancestor; a replaced element does not - without an intrinsic
// size of its own (a decoded image, a viewBox) it falls back to the CSS
// spec's default 300x150 box instead, which is exactly how #grid and
// #angleOverlay silently clipped to a corner for months. See the CSS
// comment above #grid/#angleOverlay in index.html for the full story.
//
// This is a static, single-file heuristic (regex over the flat CSS in
// index.html's one <style> block), not a real browser layout check - good
// enough to catch the same class of mistake creeping back in without adding
// a headless-browser dependency to a project whose whole point is "no build
// step, no framework."
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'src', 'Refboard', 'wwwroot', 'index.html');
const html = fs.readFileSync(file, 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error(`No <style> block found in ${file}`);
  process.exit(1);
}
// Comments stripped first - otherwise a /* ... */ block sitting between two
// rules (there are several, right above #grid/#angleOverlay themselves) gets
// swallowed into the *next* rule's captured selector text along with it,
// and "<comment text>\n  #grid" fails the exact `#id` selector match below.
const css = styleMatch[1].replace(/\/\*[\s\S]*?\*\//g, '');

// Every #id { ... } rule, keyed by each id in its (possibly comma-separated)
// selector list. Flat only - this file has no nested/media-query CSS around
// these elements, and this check isn't meant to be a general CSS parser.
const rulesById = new Map();
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, selectorList, body] = m;
  for (const sel of selectorList.split(',')) {
    const idMatch = sel.trim().match(/^#([\w-]+)$/);
    if (idMatch) rulesById.set(idMatch[1], (rulesById.get(idMatch[1]) || '') + body);
  }
}

// <img>/<video> are deliberately excluded: once loaded, they carry a real
// intrinsic size from the decoded resource, which is exactly why #img/
// #imgValue's own inset:0 + max-width/max-height:100% + object-fit:contain
// is fine as-is and never showed this bug. The 300x150 default is a real,
// permanent trap only for <svg> (no viewBox = no intrinsic size, ever) and
// <canvas> (sized only by its width/height attributes, no viewBox concept).
const failures = [];
const tagPattern = /<(svg|canvas)\b([^>]*)\bid="([\w-]+)"([^>]*)>/g;
for (const m of html.matchAll(tagPattern)) {
  const [, tag, before, id, after] = m;
  const attrs = before + after;
  const hasIntrinsicSize = /\bviewBox=/.test(attrs) || /\bwidth="[^0"]/.test(attrs) || /\bheight="[^0"]/.test(attrs);
  if (hasIntrinsicSize) continue; // has its own real size - inset:0 stretching it or not doesn't matter

  const rule = rulesById.get(id);
  if (!rule) continue; // not positioned via CSS at all
  const isReplacedSize = /position\s*:\s*absolute/.test(rule) || /\binset\s*:/.test(rule);
  if (!isReplacedSize) continue;

  const hasWidth = /(?<!max-)width\s*:/.test(rule);
  const hasHeight = /(?<!max-)height\s*:/.test(rule);
  if (!hasWidth || !hasHeight) {
    failures.push(`<${tag} id="${id}"> is positioned via inset/position:absolute with no viewBox/width/height ` +
      `attribute of its own, and its CSS rule doesn't set explicit width/height either - it will silently ` +
      `collapse to the browser's 300x150 replaced-element default instead of filling its container.`);
  }
}

if (failures.length) {
  console.error(`check-replaced-element-sizing: ${failures.length} problem(s) found in ${file}:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-replaced-element-sizing: OK (${file})`);
