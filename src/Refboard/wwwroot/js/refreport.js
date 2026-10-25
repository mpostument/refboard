/* refboard - Reference report: everything the session's checks say about one
   picture, on one page - is it a good picture to work from, how its values
   lie against your medium's range, its main colours and how to mix them, the
   temperature, where the eye goes, the crops, the tangents. Each check is the
   session tool's own (qualityOf, amountsOf, rangeMap, tempMap, compositionOf,
   tangentsOf); the report only runs them together on one read of the picture
   and sets the words and a small map of each side by side.

   The page is one piece of HTML with its own style and its pictures inline, so
   the same string is shown in the sheet, sent to the printer, and drawn to a
   picture (an SVG foreignObject) to keep in My work. The checks are the
   tools' guesses from pixels - the report says nothing they do not.
   Loaded when first needed (loadSection('report')); see the note in index.html. */
"use strict";

const RR_MAP_SIDE = 340;
// The bars' colours: the ones the picture's note uses, written out, because the page has to stand alone.
const RR_BAR = {
  'amt-d': '#2a2a2e', 'amt-m': '#8a8a8e', 'amt-l': '#eeeeee', 'amt-w': '#ffa94d', 'amt-n': '#8a8a8e', 'amt-c': '#6fb6ff',
  'amt-h': '#ff5470', 'amt-s': '#50beff', 'amt-v': '#ff5fa2', 'amt-u': '#c9a66b', 'amt-g': '#8a8a8e',
  'amt-b': '#9b7bff', 'amt-y': '#5fd0b0', 'amt-z': '#ffd23f',
};

const RR_CSS = `.rr{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#26262b;background:#fffefb;padding:22px 26px;max-width:820px;box-sizing:border-box}
.rr h1{font-size:22px;margin:0 0 2px;text-transform:none;color:#26262b}.rr h2{font-size:15px;font-weight:600;text-transform:none;color:#26262b;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #d9d6cc;letter-spacing:.02em}
.rr p{margin:0 0 8px}.rr small,.rr .rr-sub{color:#6b6a66;font-size:12.5px}
.rr .rr-head{display:flex;gap:18px;align-items:flex-start}.rr .rr-head img{width:220px;height:auto;border-radius:6px;border:1px solid #d9d6cc}
.rr .rr-row{display:flex;gap:16px;align-items:flex-start;margin-bottom:10px}.rr .rr-row>div{flex:1 1 0;min-width:0}
.rr .rr-map{flex:0 0 ${RR_MAP_SIDE / 2}px!important}.rr .rr-map img{width:100%;height:auto;border-radius:6px;border:1px solid #d9d6cc;display:block}
.rr .rr-map small{display:block;margin-top:3px}
.rr .rr-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#3da35d}.rr .rr-warn{background:#e0a100}.rr .rr-bad{background:#d64545}
.rr .rr-bar{display:flex;height:11px;border-radius:3px;overflow:hidden;background:#e8e6de;margin:3px 0}.rr .rr-bar i{display:block;height:100%}
.rr .rr-amt{margin-bottom:9px}.rr .rr-amt b{display:inline-block;min-width:6.5em}
.rr .rr-cols{display:flex;flex-wrap:wrap;gap:10px}.rr .rr-col{flex:1 1 150px;min-width:150px}
.rr .rr-sw{height:34px;border-radius:5px;border:1px solid rgba(0,0,0,.18)}
.rr .range-d{color:#6e50ff}.rr .range-l{color:#c98a00}.rr .temp-w{color:#d9730d}.rr .temp-c{color:#2f7fd1}.rr .temp-t{color:#555}.rr .tan-s{color:#d6249f}.rr .tan-f{color:#c98a00}
.rr .rr-foot{margin-top:18px;color:#6b6a66;font-size:12px}`;

/* The checks, each tried alone: one that fails leaves its section out, not the report. */
function reportOf(p, medium = mainMaterial()) {
  const out = { w: p.w, h: p.h, medium };
  const run = (key, fn) => { try { out[key] = fn(); } catch (err) { console.error('report ' + key + ':', err); out[key] = null; } };
  run('quality', () => qualityOf(p));
  run('amounts', () => amountsOf(p));
  run('temp', () => tempMap(p));
  run('range', () => rangeMap(p, medium.floor));
  run('comp', () => compositionOf(p));
  run('tan', () => tangentsOf(p));
  run('colours', () => reportColours(p));
  return out;
}

/* The picture's five biggest colours: its pixels in 3 bits a channel (the info
   drawer's own), each bucket as the mean of what fell in it. */
function reportColours(p, n = 5) {
  const buckets = new Map(), total = p.w * p.h;
  for (let i = 0; i < total; i++) {
    const r = p.rgba[4 * i], g = p.rgba[4 * i + 1], b = p.rgba[4 * i + 2], key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const e = buckets.get(key) || [0, 0, 0, 0];
    e[0] += r; e[1] += g; e[2] += b; e[3]++;
    buckets.set(key, e);
  }
  return [...buckets.values()].sort((a, b) => b[3] - a[3]).slice(0, n)
    .map(e => ({ rgb: [0, 1, 2].map(k => Math.round(e[k] / e[3])), share: e[3] / total * 100 }));
}

// How to make a colour in the medium: its step on the ladder, and a recipe where it mixes paint.
function reportMix(rgb) {
  const main = materialsProfile().main, m = MATERIALS[main], out = [];
  if (!['watercolour', 'opaque'].includes(main)) {
    out.push(`${m.label}: ${materialToneFor(Math.round((0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 * 100), m)}`);
  }
  if (m.paint) {
    const r = paintRecipes(rgb, undefined, 1)[0];
    if (r) out.push(`${paintRecipeText(r)} - ${paintMatchWord(r.dE)}`);
  }
  return out.join('. ');
}

// A small map: the picture with a check's marks over it, as a JPEG for the page to carry.
function reportMap(p, draw) {
  const over = document.createElement('canvas');
  if (draw) draw(over);
  const k = Math.min(1, RR_MAP_SIDE / Math.max(p.w, p.h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(p.w * k)); c.height = Math.max(1, Math.round(p.h * k));
  const g = c.getContext('2d');
  g.drawImage(p.img, 0, 0, c.width, c.height);
  if (draw) g.drawImage(over, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function reportHtml(r, p, name) {
  const bar = (vals, cls) => `<div class="rr-bar">${vals.map((v, i) => `<i style="width:${v.toFixed(1)}%;background:${RR_BAR[cls[i]]}"></i>`).join('')}</div>`;
  const amt = id => {
    const row = AMT_ROWS.find(x => x.id === id), vals = r.amounts[id];
    if (!vals) return '';
    return `<div class="rr-amt"><b>${row.label}</b> <small>${row.parts.map((q, i) => `${q} ${Math.round(vals[i])}%`).join(' · ')}</small>` +
      `${bar(vals, row.cls)}<span>${esc(r.say[id])}</span></div>`;
  };
  const map = (draw, caption) => `<div class="rr-map"><img alt="" src="${reportMap(p, draw)}"><small>${caption}</small></div>`;
  const sections = [];

  if (r.quality) {
    const q = r.quality;
    sections.push(`<h2>Is it a good picture to work from?</h2><div class="rr-row"><div><p><b>${esc(q.verdict)}</b></p>` +
      q.checks.map(c => `<p><span class="rr-dot rr-${c.level === 'ok' ? 'ok' : c.level}"></span><b>${esc(c.label)}</b> ${esc(c.text)}</p>`).join('') +
      '<small>The limits are estimates. A plain white or black background is not counted.</small></div>' +
      map(c => qualityDraw(q, c), 'Pink: highlight lost. Blue: shadow lost.') + '</div>');
  }

  const value = [];
  if (r.amounts) value.push(amt('value'));
  if (r.range) {
    const m = r.medium;
    value.push(`<p><b>${esc(m.label)}</b> goes from L* ${m.floor} to the paper's ${r.range.paper}.</p><p>${rangeVerdict(r.range, m)}</p>`);
  }
  if (value.length) {
    sections.push(`<h2>Value</h2><div class="rr-row"><div>${value.join('')}</div>` +
      (r.range ? map(c => rangeDraw(r.range, c), 'Violet: darker than the medium goes. Amber: lighter than the paper.') : '') + '</div>');
  }

  const colourBits = [];
  if (r.colours) {
    colourBits.push('<div class="rr-cols">' + r.colours.map(c => `<div class="rr-col"><div class="rr-sw" style="background:${rgbCss(c.rgb)}"></div>` +
      `<small>${colHexOf(c.rgb)} · ${Math.round(c.share)}%</small><br><span>${esc(reportMix(c.rgb))}</span></div>`).join('') + '</div>');
  }
  if (r.amounts) colourBits.push(amt('temp'), amt('colour'));
  if (r.temp) colourBits.push(`<p>${tempVerdict(r.temp, r.medium.paint ?? 'water')}</p>`);
  if (colourBits.length) {
    sections.push(`<h2>Colour</h2><div class="rr-row"><div>${colourBits.join('')}</div>` +
      (r.temp ? map(c => tempDraw(r.temp, c), 'Orange: warmer than the picture. Blue: cooler. White: where it turns.') : '') + '</div>');
  }

  if (r.comp) {
    const f = r.comp;
    sections.push(`<h2>Where the eye goes</h2><div class="rr-row"><div><p>${esc(compositionSay(f))}</p>` +
      '<small>Red-yellow is where contrast and colour pull the eye: a guess, not a reading of faces or words.</small></div>' +
      map(c => compositionDraw(f, c, { crop: 1, heat: true }), 'The eye map, the middle of its weight, the best crop.') + '</div>');
  }
  const shapes = [];
  if (r.amounts) shapes.push(amt('size'), amt('edges'));
  if (r.tan) shapes.push(`<p>${tangentsVerdict(r.tan)}</p>`);
  if (shapes.length) {
    sections.push(`<h2>Shapes and edges</h2><div class="rr-row"><div>${shapes.join('')}</div>` +
      (r.tan ? map(c => tangentsDraw(r.tan, c), 'Pink: two shapes just touch. Amber: a shape touches the edge.') : '') + '</div>');
  }

  return `<div class="rr"><style>${RR_CSS}</style><div class="rr-head"><img alt="" src="${reportMap(p, null)}"><div>` +
    `<h1>Reference report</h1><p class="rr-sub">${esc(name)} · ${r.w} × ${r.h} px as read · ${esc(r.medium.label)}</p>` +
    '<p class="rr-sub">Every check the session has, on one page. Each is a guess from the pixels, set in the words of your medium.</p></div></div>' +
    sections.join('') + '<p class="rr-foot">refboard · the advice is for the medium chosen in My materials when the report was made.</p></div>';
}

/* ---- the sheet. */
let reportNow = null;   // { html, name }

async function openReport(src) {
  if (!src) return;
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { announce('That picture could not be read.'); return; }
  el('reportBody').innerHTML = '<p class="count">Reading the picture...</p>';
  el('reportKept').textContent = '';
  el('reportSheet').classList.remove('hidden');
  dialogOpened(el('reportSheet'), el('reportClose'));
  // A moment's work: the sheet shows first.
  await new Promise(res => setTimeout(res, 30));
  if (el('reportSheet').classList.contains('hidden')) return;
  try {
    const p = stepsRead(img), r = reportOf(p);
    r.say = r.amounts ? amountsVerdict(r.amounts) : {};
    const name = decodeURIComponent(src.split('?')[0].split('/').pop() || 'picture');
    reportNow = { html: reportHtml(r, p, name), name };
    el('reportBody').innerHTML = reportNow.html;
  } catch (err) {
    console.error('report:', err);
    el('reportBody').innerHTML = '<p class="count">Could not read this picture.</p>';
  }
  for (const id of ['reportPrint', 'reportKeep']) el(id).disabled = !reportNow;
}

function closeReport() {
  el('reportSheet').classList.add('hidden');
  reportNow = null;
  dialogClosed(el('reportSheet'));
}

// The page drawn to a picture: its HTML in an SVG, which the browser paints like a page.
async function reportPng() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:820px';
  host.innerHTML = reportNow.html;
  document.body.appendChild(host);
  try {
    const box = host.firstElementChild, w = 820, h = Math.ceil(box.scrollHeight);
    const xml = new XMLSerializer().serializeToString(box);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const k = 2, c = document.createElement('canvas');
    c.width = w * k; c.height = h * k;
    const g = c.getContext('2d');
    g.fillStyle = '#fffefb';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/png'));
  } finally { host.remove(); }
}

async function reportKeep() {
  const note = el('reportKept');
  note.textContent = 'Keeping...';
  try {
    const kept = await keepUpload(await reportPng(), { name: `reference-report-${reportNow.name.replace(/\.[a-z0-9]+$/i, '')}.png`, from: 'work' });
    const { url, ...doc } = kept;
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...new Set([...(doc.tags || []), 'reference report'])] });
    storeChanged();
    note.textContent = 'Kept in My work as a reference report.';
  } catch (err) { note.textContent = 'Not kept: ' + (err.message || err); }
}

function initReport() {
  el('reportClose').addEventListener('click', closeReport);
  initSheet(el('reportSheet'), closeReport);
  el('reportPrint').addEventListener('click', () => {
    if (reportNow) printHtml(`<!doctype html><meta charset="utf-8"><title>Reference report</title><style>body{margin:0}@page{margin:12mm}</style>${reportNow.html}`);
  });
  el('reportKeep').addEventListener('click', () => { if (reportNow) reportKeep(); });
}
initReport();
