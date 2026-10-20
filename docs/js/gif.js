/* An animated GIF from canvases (ROADMAP Game assets, phase 5: the walk as one file).
   A GIF has one palette of at most 256 colours and one of them can be "see-through" - no half
   transparency - so the frames are cut to 255 colours together (exact when they already have
   that few, as a pixel sprite does) and alpha is on or off at 128, as the pixel look does. Each
   frame is wiped before the next (disposal 2), or a see-through frame would pile on the last. */

const GIF_ALPHA = 128;

/* The LZW stream of `indices` (palette numbers): a dictionary of runs seen so far, each written as
   one code that is `size` bits wide, `size` growing with the dictionary up to 12; at 4096 entries
   a "clear" code empties it. Returns the bytes. */
function gifLzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let cur = 0, bits = 0, size = minCode + 1, next = eoi + 1, dict = new Map();
  const put = code => {
    cur |= code << bits; bits += size;
    while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  put(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    put(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { put(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
    prefix = k;
  }
  put(prefix); put(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}

/* `frames` (canvases of one size) as an animated GIF that loops, `delayMs` between frames.
   Returns a Uint8Array. */
function gifEncode(frames, delayMs) {
  const w = frames[0].width, h = frames[0].height;
  const datas = frames.map(c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data);
  const seen = new Map();   // the opaque colours (r, g, b packed) and how many pixels have each
  for (const d of datas) for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= GIF_ALPHA) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; seen.set(k, (seen.get(k) || 0) + 1); }
  const unpack = k => [k >> 16, (k >> 8) & 255, k & 255];
  let pal;
  if (seen.size <= 255) pal = [...seen.keys()].map(unpack);
  else {
    // Every pixel counts, not every colour, or the one big flat area would get as few as a speck.
    const px = []; for (const [k, n] of seen) { const c = unpack(k); for (let j = 0; j < Math.min(n, 64); j++) px.push(c); }
    pal = pixelMedianCut(px, 255);
  }
  const at = new Map(pal.map((c, i) => [(c[0] << 16) | (c[1] << 8) | c[2], i]));
  const near = k => {
    let i = at.get(k);
    if (i !== undefined) return i;
    const c = unpack(k); let d = Infinity; i = 0;
    for (let j = 0; j < pal.length; j++) { const e = pixDist(c, pal[j]); if (e < d) { d = e; i = j; } }
    at.set(k, i);
    return i;
  };
  const clear = pal.length;   // the see-through colour is the one after the last
  let bitsPal = 1; while ((1 << bitsPal) < pal.length + 1) bitsPal++;
  const minCode = Math.max(2, bitsPal), out = [];
  const u16 = n => out.push(n & 255, n >> 8 & 255), str = s => { for (const ch of s) out.push(ch.charCodeAt(0)); };
  str('GIF89a'); u16(w); u16(h);
  out.push(0x80 | 0x70 | (bitsPal - 1), 0, 0);   // a global palette of 2^bitsPal colours; background and aspect unused
  for (let i = 0; i < 1 << bitsPal; i++) out.push(...(pal[i] || [0, 0, 0]));
  out.push(0x21, 0xFF, 11); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0);   // loop forever
  for (const d of datas) {
    const idx = new Uint8Array(w * h);
    for (let i = 0; i < idx.length; i++) idx[i] = d[i * 4 + 3] < GIF_ALPHA ? clear : near((d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2]);
    out.push(0x21, 0xF9, 4, (2 << 2) | 1); u16(Math.max(2, Math.round(delayMs / 10))); out.push(clear, 0);
    out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0, minCode);
    const lzw = gifLzw(idx, minCode);
    for (let i = 0; i < lzw.length; i += 255) { const n = Math.min(255, lzw.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(lzw[i + j]); }
    out.push(0);
  }
  out.push(0x3B);
  return Uint8Array.from(out);
}
