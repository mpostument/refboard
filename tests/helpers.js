const zlib = require('zlib');
const base = require('@playwright/test');

/* A PNG made here rather than a binary fixture in git: `pixel(x, y)` returns
   [r, g, b] for each pixel, so a test says exactly which colour is where. */
function makePng(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = buf => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Four flat quadrants - skin, sky blue, leaf green, a dark shadow - so a
// palette has distinct colours to find and the eyedropper a known one.
const QUADS = { skin: [224, 172, 140], sky: [110, 160, 215], leaf: [70, 120, 60], shadow: [45, 35, 40] };
const quadrantsPng = () => makePng(200, 200, (x, y) =>
  x < 100 ? (y < 100 ? QUADS.skin : QUADS.leaf) : (y < 100 ? QUADS.sky : QUADS.shadow));

/* Failing on any uncaught error or console.error is the point of these
   tests: a broken load order or a typo in one file shows up as exactly
   that. Missing backend files are expected - these run as GitHub Pages
   does, with no server behind the page. */
const EXPECTED_404 = /index\.json|features\.json|healthz|state\.js/;

const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const url = m.location().url || '';
      if (/Failed to load resource/.test(m.text()) && EXPECTED_404.test(url)) return;
      errors.push('console.error: ' + m.text() + (url ? ` (${url})` : ''));
    });
    await use(page);
    base.expect(errors, 'errors in the page').toEqual([]);
  },
});

// Open the app and wait until boot() has drawn the dashboard.
async function openApp(page) {
  await page.goto('/index.html');
  await base.expect(page.locator('#summary')).not.toBeEmpty();
}

module.exports = { test, expect: base.expect, makePng, quadrantsPng, QUADS, openApp };
