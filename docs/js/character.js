/* refboard - Character sheet: one character's colours in one place - hair,
   skin, eyes, clothes and an accent, each as a base, a shadow and a light,
   with how to mix each from your paints. Kept like everything else
   (store.js, kind "characters"), so the next picture of her matches the
   last one.

   It is the Colour studio's Character tab: choose a part, click the
   picture where its colour is plain and in the light. The shadow and the
   light are worked out from it - charShade() - or clicked too, where the
   picture has them. With a ComfyUI behind the server, the sheet makes the
   character again: her hair and eyes, as a turnaround.
   Loaded with colour.js - see lazy-colour in index.html. */
"use strict";

const CHAR_KEY = 'refboard.character.v1'; // the sheet last open
const CHAR_PARTS = [
  { id: 'hair', label: 'Hair' },
  { id: 'skin', label: 'Skin' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'clothes', label: 'Clothes' },
  { id: 'accent', label: 'Accent', hint: 'a ribbon, a bow, the lining - the one colour that is not like the rest' },
];
const CHAR_TONES = [['base', 'Base'], ['shadow', 'Shadow'], ['light', 'Light']];

// Turns hue h toward `to`, by at most `max` degrees - less if it is nearer.
function charTurn(h, to, max) {
  const d = ((to - h + 540) % 360) - 180;
  return (h + Math.sign(d) * Math.min(Math.abs(d), max) + 360) % 360;
}

/* A base colour's shadow and light, the way anime cel shading paints them -
   in OKLCH, where lightness, chroma and hue are three separate knobs:
     shadow - one clear value step darker (0.14 of OKLab L, about 15 L*),
       and turned toward violet: under a warm key light the shadow side is
       lit by the cool sky. Skin is the exception - light goes into it and
       comes back out red - so its shadow turns toward red, with more
       colour rather than less - even the palest skin, which is never a
       grey. A grey takes a touch of the cool.
     light - lighter by a share of what is left above it (so black hair
       gets a clear shine and pale skin does not burn out), paler - the
       light's own colour washes over it - and a little toward yellow.
       An eye's light is its catchlight: the paper, left white. */
const CHAR_PAPER = [245, 243, 236];
function charShade(rgb, part) {
  const [L, C, h] = rgbOklch(rgb);
  const skin = part === 'skin', grey = C < 0.025 && !skin;
  const shadow = lchRgb(Math.max(0.12, L - 0.14),
    grey ? 0.025 : skin ? Math.max(0.045, C * 1.25) : C * 1.05,
    grey ? 285 : charTurn(skin && C < 0.01 ? 50 : h, skin ? 25 : 290, skin ? 12 : 18));
  const light = part === 'eyes' ? CHAR_PAPER
    : lchRgb(Math.min(0.97, L + (1 - L) * 0.45), C * 0.7, grey ? h : charTurn(h, 95, 10));
  return { shadow, light };
}

/* The plain name of a colour, as a prompt (and a painter) would say it -
   by OKLCH hue, with the dark warm hues called brown, whatever the angle. */
function charColourName(rgb) {
  const [L, C, h] = rgbOklch(rgb);
  if (L < 0.28 && C < 0.06) return 'black';
  if (C < 0.03) return L > 0.88 ? 'white' : L < 0.35 ? 'black' : 'grey';
  if (h >= 20 && h < 110 && L < 0.55) return C > 0.11 && h < 45 ? 'red' : 'brown';
  if (h >= 330 || h < 20) return L > 0.6 || h < 350 && h >= 330 ? 'pink' : 'red';
  if (h < 45) return L > 0.8 ? 'pink' : 'red';
  return h < 75 ? 'orange' : h < 115 ? 'yellow' : h < 175 ? 'green' : h < 225 ? 'aqua' : h < 285 ? 'blue' : 'purple';
}

let chars = null; // { list: {id: doc}, cur, armed: {part, tone} | null }

const charDoc = () => chars && chars.cur ? chars.list[chars.cur] : null;
// A tone of a part: what was clicked, else what is worked out from the base.
function charTone(doc, part, tone) {
  const p = doc && doc.parts[part];
  if (!p || !p.base) return null;
  if (tone === 'base') return { rgb: p.base, picked: true };
  if (p[tone]) return { rgb: p[tone], picked: true };
  return { rgb: charShade(p.base, part)[tone], picked: false };
}

// A recipe per colour, kept: the search behind one is a few thousand mixes.
const charRecipeCache = new Map();
function charRecipe(rgb) {
  const key = rgb.join(',') + '|' + col.paints + '|' + col.medium;
  if (!charRecipeCache.has(key)) charRecipeCache.set(key, paintRecipes(rgb, col.paints, 1, col.medium)[0] || null);
  return charRecipeCache.get(key);
}

async function charLoad() {
  chars = { list: {}, cur: null, armed: { part: 'hair', tone: 'base' } };
  try { chars.list = await storeItems('characters') || {}; } catch { /* nothing kept yet */ }
  let last = null;
  try { last = localStorage.getItem(CHAR_KEY); } catch {}
  const ids = charIds();
  chars.cur = chars.list[last] ? last : ids[0] || null;
}
const charIds = () => Object.keys(chars.list).sort((a, b) => (chars.list[b].t || 0) - (chars.list[a].t || 0));

function charNew() {
  const id = 'c' + Date.now().toString(36);
  const n = Object.keys(chars.list).length + 1;
  chars.list[id] = { name: 'Character ' + n, t: Date.now(), parts: {} };
  chars.cur = id;
  chars.armed = { part: 'hair', tone: 'base' };
  charSave();
  return chars.list[id];
}

let charSaveTimer = 0;
function charSave() {
  const id = chars.cur, doc = charDoc();
  try { localStorage.setItem(CHAR_KEY, id || ''); } catch {}
  if (!doc) return;
  doc.t = Date.now();
  clearTimeout(charSaveTimer);
  charSaveTimer = setTimeout(() => storePutItem('characters', id, doc).catch(err => console.warn('not kept:', err)), 300);
}

// The picture as a small thumbnail, so a sheet is known by who it is.
function charThumb() {
  if (!col.data) return null;
  const s = 96 / Math.max(col.w, col.h), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(col.w * s)); c.height = Math.max(1, Math.round(col.h * s));
  const src = document.createElement('canvas');
  src.width = col.w; src.height = col.h;
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(col.data), col.w, col.h), 0, 0);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

/* A click on the picture: the colour under it - the median of a 5x5 patch
   per channel, so a line or a speck of noise beside the point does not
   decide it - into the chosen part and tone. Then on to the next part's
   base, since a sheet is filled in one go. */
function charPickAt(x, y) {
  if (!chars || !chars.armed || !col.data) return;
  const doc = charDoc() || charNew();
  const ch = [[], [], []];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const px = Math.min(col.w - 1, Math.max(0, x + dx)), py = Math.min(col.h - 1, Math.max(0, y + dy)), i = (py * col.w + px) * 4;
    for (let k = 0; k < 3; k++) ch[k].push(col.data[i + k]);
  }
  const rgb = ch.map(v => v.sort((a, b) => a - b)[12]);
  const { part, tone } = chars.armed;
  doc.parts[part] = doc.parts[part] || {};
  doc.parts[part][tone] = rgb;
  if (!doc.thumb) doc.thumb = charThumb();
  const i = CHAR_PARTS.findIndex(p => p.id === part);
  const next = CHAR_PARTS.slice(i + 1).find(p => !(doc.parts[p.id] && doc.parts[p.id].base));
  chars.armed = tone === 'base' && next ? { part: next.id, tone: 'base' } : null;
  charSave();
  charRender();
}

// What a click on the picture will do now - for the readout.
function charArmedText() {
  if (!chars || !chars.armed) return '';
  const p = CHAR_PARTS.find(q => q.id === chars.armed.part), t = CHAR_TONES.find(q => q[0] === chars.armed.tone)[1];
  return `click to take it for ${p.label.toLowerCase()} - ${t.toLowerCase()}`;
}

function charRender() {
  if (!chars) return;
  const ids = charIds(), doc = charDoc();
  el('charSelect').innerHTML = ids.length
    ? ids.map(id => `<option value="${id}"${id === chars.cur ? ' selected' : ''}>${esc(chars.list[id].name || 'Untitled')}</option>`).join('')
    : '<option value="">No characters yet</option>';
  // Only a choice once there is more than one.
  el('charSelect').classList.toggle('hidden', ids.length < 2);
  el('charName').value = doc ? doc.name || '' : '';
  el('charName').disabled = !doc;
  el('charName').placeholder = doc ? 'Name' : 'No sheet yet - take a colour to start one';
  el('charDelete').disabled = !doc;
  el('charThumb').src = doc && doc.thumb || '';
  el('charThumb').classList.toggle('hidden', !(doc && doc.thumb));

  const armed = chars.armed;
  el('charHint').textContent = !col.data ? 'Open a picture of the character first - then choose a part and click the picture where its colour is plain, in the light.'
    : armed ? `Click the picture on the ${CHAR_PARTS.find(p => p.id === armed.part).label.toLowerCase()} - ${armed.tone === 'base' ? 'a plain patch in the light, not a shadow or a shine' : 'where the picture has its ' + armed.tone}.`
    : 'Choose a colour below to take it from the picture again.';

  el('charParts').innerHTML = CHAR_PARTS.map(part => {
    const has = !!(doc && doc.parts[part.id] && doc.parts[part.id].base);
    const cells = CHAR_TONES.map(([tone, label]) => {
      const t = charTone(doc, part.id, tone), on = !!armed && armed.part === part.id && armed.tone === tone;
      const r = t && charRecipe(t.rgb);
      const how = t ? (t.picked ? 'from the picture' : 'worked out') : '';
      return `<div class="char-cell"><button type="button" class="char-sw${t ? '' : ' empty'}" data-part="${part.id}" data-tone="${tone}" aria-pressed="${on}" ` +
        `title="${t ? `${colHex(t.rgb)} · L* ${Math.round(lstar(t.rgb))} · ${how} - click, then the picture, to take it from there` : 'Click, then the picture'}" ` +
        `aria-label="${part.label} ${label.toLowerCase()}${t ? ', ' + how : ', not set'}"><i${t ? ` style="background:${rgbCss(t.rgb)}"` : ''}></i><span>${label}</span></button>` +
        (t && t.picked && tone !== 'base' ? `<button type="button" class="char-auto" data-reset="${part.id}:${tone}" title="Work it out from the base again">auto</button>` : '') +
        (r ? `<small>${esc(paintRecipeText(r))}</small>` : '') + '</div>';
    }).join('');
    return `<div class="char-part${has ? '' : ' unset'}"><h5>${part.label}` +
      (has ? ` <button type="button" class="char-clear" data-clear="${part.id}" aria-label="Clear ${part.label.toLowerCase()}" title="Clear">×</button>` : '') +
      (part.hint && !has ? ` <span>${part.hint}</span>` : '') + `</h5><div class="char-tones">${cells}</div></div>`;
  }).join('');

  const set = doc ? CHAR_PARTS.filter(p => doc.parts[p.id] && doc.parts[p.id].base).length : 0;
  el('charCopy').disabled = !set;
  const gen = genAvailable();
  el('charGenerate').classList.toggle('hidden', !gen);
  el('charGenerate').disabled = !(doc && doc.parts.hair && doc.parts.hair.base);
  el('charWhere').textContent = {
    server: 'Sheets are kept on this server - and in a backup.',
    browser: 'Sheets are kept in this browser, on this device only.',
    memory: 'Not kept in this version - gone when the page is reloaded. Keep in this browser is under Your data.',
  }[storeMode];
}

// The sheet as text, to paste beside the drawing or into your notes.
function charText(doc) {
  const lines = [`${doc.name} - ${PAINT_MEDIA[col.medium]}, ${PAINT_PALETTES[col.paints].label.toLowerCase()}`];
  for (const part of CHAR_PARTS) {
    if (!(doc.parts[part.id] && doc.parts[part.id].base)) continue;
    lines.push('', part.label);
    for (const [tone, label] of CHAR_TONES) {
      const t = charTone(doc, part.id, tone), r = charRecipe(t.rgb);
      lines.push(`  ${label.padEnd(7)} ${colHex(t.rgb)}  ${r ? paintRecipeText(r) : ''}`);
    }
  }
  return lines.join('\n');
}

/* The sheet to the Generate view: her hair and eyes as the choices there,
   drawn as a turnaround - front, side and back on one page, the model
   sheet an animator draws from. */
function charToGenerate() {
  const doc = charDoc();
  if (!doc || !doc.parts.hair) return;
  const hair = { grey: 'silver', yellow: 'blonde', aqua: 'blue' }[charColourName(doc.parts.hair.base)] || charColourName(doc.parts.hair.base);
  const eyes = doc.parts.eyes && doc.parts.eyes.base ? charColourName(doc.parts.eyes.base) : 'any';
  Object.assign(genChoices, { subject: 'character', colour: hair, eyes, framing: 'sheet', view: 'front' });
  saveGenChoices();
  renderGenerate();
  setView({ kind: 'generate' });
  el('genStatus').textContent = `${doc.name}: ${hair} hair${eyes !== 'any' ? ', ' + eyes + ' eyes' : ''}, as a turnaround. Change anything, then Generate.`;
}

async function initCharacter() {
  await charLoad();
  el('charSelect').addEventListener('change', e => { chars.cur = e.target.value || null; chars.armed = null; charSave(); charRender(); });
  el('charNew').addEventListener('click', () => { charNew(); charRender(); el('charName').select(); });
  el('charName').addEventListener('input', e => {
    const doc = charDoc();
    if (!doc) return;
    doc.name = e.target.value.trim().slice(0, 60) || 'Untitled';
    charSave();
    const o = el('charSelect').querySelector(`option[value="${chars.cur}"]`);
    if (o) o.textContent = doc.name;
  });
  el('charDelete').addEventListener('click', () => {
    const id = chars.cur;
    if (!id) return;
    delete chars.list[id];
    storeDeleteItem('characters', id).catch(() => {});
    chars.cur = charIds()[0] || null;
    charSave();
    charRender();
    announce('Character sheet deleted');
  });
  el('charParts').addEventListener('click', e => {
    const doc = charDoc();
    const sw = e.target.closest('.char-sw'), reset = e.target.closest('[data-reset]'), clear = e.target.closest('[data-clear]');
    if (reset && doc) {
      const [part, tone] = reset.dataset.reset.split(':');
      delete doc.parts[part][tone];
      charSave();
    } else if (clear && doc) {
      delete doc.parts[clear.dataset.clear];
      chars.armed = { part: clear.dataset.clear, tone: 'base' };
      charSave();
    } else if (sw) {
      const { part, tone } = sw.dataset, a = chars.armed;
      // The shadow and light of a part with no base yet: its base first.
      const t = tone !== 'base' && !(doc && doc.parts[part] && doc.parts[part].base) ? 'base' : tone;
      chars.armed = a && a.part === part && a.tone === t ? null : { part, tone: t };
    } else return;
    charRender();
  });
  el('charCopy').addEventListener('click', async () => {
    const doc = charDoc();
    if (!doc) return;
    try { await navigator.clipboard.writeText(charText(doc)); announce('Copied'); el('charCopy').textContent = 'Copied'; }
    catch { el('charCopy').textContent = 'Could not copy'; }
    setTimeout(() => { el('charCopy').textContent = 'Copy as text'; }, 1500);
  });
  el('charGenerate').addEventListener('click', charToGenerate);
  charRender();
}
