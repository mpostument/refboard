/* refboard - Museums: search the open collections from the app.
   The Met and the Rijksmuseum both publish their public-domain pictures
   with an open API and send CORS headers, so this runs in the browser like
   the rest of the app - nothing goes through a server of ours, and it works
   on GitHub Pages too. A result opens in the workspace (js/workspace.js)
   like any picture of your own: the file is fetched here and handed over as
   a blob URL, as a dropped photo is, so every tool that reads pixels can.

   Each source is one function, search(query, cursor) -> { items, cursor },
   cursor null when there is no more. An item is
   { key, source, museum, title, artist, date, medium, thumb, full, page,
     licence, credit }: `thumb` is for the grid, `full` the original - often
   many megapixels, so a picture opens at MU_WORK_EDGE (muShrink()) and the
   original is a second button. The Met's smaller copies (web-large) are
   served from a cache that sends no CORS header, so a file the tools can
   read has to come from its original, which does.
   The Art Institute of Chicago is not here: its image server answers
   third-party pages with a bot check (Cloudflare), so its pictures cannot
   be shown or read from a browser.

   Loaded the first time the view opens (loadSection('museum')). */
"use strict";

const MUSEUM_KEY = 'refboard.museum.v1';
const MU_MET_PAGE = 24;    // object ids per Met page; each is one more request
const MU_RIJKS_PAGE = 12;  // a Rijksmuseum object is three requests deep
const MU_WORK_EDGE = 1600; // the longest side a picture opens at
const MU_EXAMPLES = ['Sargent watercolour', 'Hokusai', 'Rembrandt drawing', 'storm clouds', 'folds of cloth', 'hands'];

const MET_API = 'https://collectionapi.metmuseum.org/public/collection';
const RIJKS_DATA = 'https://data.rijksmuseum.nl';
// Getty AAT ids the Rijksmuseum's Linked Art uses for the English language.
const AAT_EN = 'http://vocab.getty.edu/aat/300388277';

async function muJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* ---- the Met. Its search returns ids only, one more request each, and
   cannot filter by licence: hasImages narrows it, and a page of ids still
   holds some under copyright (no picture) that are dropped here. The page
   is the ids asked for, not the pictures kept, so a page can be short. */
async function muMetSearch(q, cursor) {
  const offset = cursor || 0;
  const s = await muJson(`${MET_API}/v1.1/search?hasImages=true&limit=${MU_MET_PAGE}&offset=${offset}&q=${encodeURIComponent(q)}`);
  const ids = s.objectIDs || [];
  const objs = await Promise.all(ids.map(id => muJson(`${MET_API}/v1/objects/${id}`).catch(() => null)));
  const items = objs.filter(o => o && o.isPublicDomain && o.primaryImageSmall).map(o => ({
    key: 'met:' + o.objectID, source: 'met', museum: 'The Metropolitan Museum of Art',
    title: o.title || 'Untitled', artist: o.artistDisplayName || o.culture || '', date: o.objectDate || '',
    medium: o.medium || '', thumb: o.primaryImageSmall, full: o.primaryImage || o.primaryImageSmall, page: o.objectURL, licence: 'CC0', credit: o.creditLine || '',
  }));
  const next = offset + ids.length;
  return { items, cursor: ids.length && next < (s.total || 0) ? next : null };
}

/* ---- the Rijksmuseum. Linked Art: search has no free-text field, only
   title, creator and so on, so the words are tried as a title and as a
   maker and the two lists interleaved. A hit is an id; the object holds
   title, maker and date, its picture is two links further (visual item,
   then digital object, whose access point is an IIIF image URL). */
const muLang = (list, lang) => (list || []).find(x => (x.language || []).some(l => l.id === lang));

async function muRijksItem(id) {
  const o = await muJson(id);
  const vi = await muJson(o.shows[0].id);
  const dobj = await muJson(vi.digitally_shown_by[0].id);
  const iiif = dobj.access_point[0].id; // .../full/max/0/default.jpg
  const sized = px => iiif.replace('/full/max/', `/full/!${px},${px}/`);
  const names = (o.identified_by || []).filter(n => n.type === 'Name');
  const brief = (o.produced_by?.referred_to_by || []);
  const when = o.produced_by?.timespan?.identified_by || [];
  const rights = JSON.stringify(o.subject_of || []);
  const html = (o.subject_of || []).flatMap(s => s.digitally_carried_by || []).find(d => d.format === 'text/html');
  const made = (o.made_of || []).map(m => (m.notation || []).find(n => n['@language'] === 'en')?.['@value']).filter(Boolean);
  return {
    key: 'rijks:' + id.split('/').pop(), source: 'rijks', museum: 'Rijksmuseum',
    title: (muLang(names, AAT_EN) || names[0])?.content || 'Untitled',
    artist: (muLang(brief, AAT_EN) || brief[0])?.content || '',
    date: (muLang(when, AAT_EN) || when[0])?.content || '',
    medium: made.join(', '), thumb: sized(400), full: iiif,
    page: (html?.access_point?.[0]?.id || '').replace('/nl/collectie/', '/en/collection/'),
    licence: /publicdomain\/zero/.test(rights) ? 'CC0' : /publicdomain\/mark/.test(rights) ? 'Public domain' : '',
    credit: '',
  };
}

async function muRijksSearch(q, cur) {
  const start = k => `${RIJKS_DATA}/search/collection?${k}=${encodeURIComponent(q)}&imageAvailable=true`;
  let queue = cur ? cur.queue.slice() : [], next = cur ? cur.next.slice() : [start('title'), start('creator')];
  const seen = new Set(cur ? cur.seen : []);
  while (queue.length < MU_RIJKS_PAGE && next.some(Boolean)) {
    const pages = await Promise.all(next.map(u => u ? muJson(u).catch(() => null) : null));
    const lists = pages.map(p => (p?.orderedItems || []).map(i => i.id));
    next = pages.map(p => p?.next?.id || null);
    for (let i = 0; lists.some(l => i < l.length); i++) {
      for (const l of lists) if (i < l.length && !seen.has(l[i])) { seen.add(l[i]); queue.push(l[i]); }
    }
  }
  const now = queue.slice(0, MU_RIJKS_PAGE), rest = queue.slice(MU_RIJKS_PAGE);
  const items = (await Promise.all(now.map(id => muRijksItem(id).catch(() => null)))).filter(Boolean);
  return { items, cursor: rest.length || next.some(Boolean) ? { queue: rest, next, seen: [...seen] } : null };
}

const MU_SOURCES = {
  met: { label: 'The Met', search: muMetSearch },
  rijks: { label: 'Rijksmuseum', search: muRijksSearch },
};

/* ---- the view */

let mu = null; // state; null until first opened

function muLoadPrefs() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(MUSEUM_KEY)) || {}; } catch { /* a fresh start */ }
  const on = Array.isArray(v.sources) ? v.sources.filter(k => MU_SOURCES[k]) : [];
  return { query: typeof v.query === 'string' ? v.query : '', sources: on.length ? on : Object.keys(MU_SOURCES) };
}
function muSavePrefs() {
  try { localStorage.setItem(MUSEUM_KEY, JSON.stringify({ query: mu.query, sources: mu.sources })); } catch { /* private mode */ }
}

function muStatus(text, bad = false) {
  const s = el('muStatus');
  s.textContent = text;
  s.classList.toggle('mu-bad', bad);
}

function muSourceChips() {
  el('muSources').innerHTML = Object.entries(MU_SOURCES).map(([k, s]) =>
    `<button type="button" class="chip" data-source="${k}" aria-pressed="${mu.sources.includes(k)}">${esc(s.label)}</button>`).join('');
}

function muCardHtml(it) {
  const by = [it.artist, it.date].filter(Boolean).join(' · ');
  return `<button type="button" class="mu-card" data-key="${esc(it.key)}" aria-pressed="${mu.picked === it.key}">` +
    `<img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async">` +
    `<span class="mu-cap"><b>${esc(it.title)}</b><small>${esc(by)}</small></span></button>`;
}

function muRenderGrid() {
  el('muGrid').innerHTML = mu.items.map(muCardHtml).join('');
  el('muMore').classList.toggle('hidden', !Object.values(mu.cursors).some(c => c != null));
  el('muEmpty').classList.toggle('hidden', !!mu.items.length || mu.searched);
}

function muCredit(it) {
  return [it.artist, it.title, it.date].filter(Boolean).join(', ') +
    `. ${it.museum}${it.licence ? ', ' + it.licence : ''}.${it.page ? ' ' + it.page : ''}`;
}

function muRenderDetail() {
  const it = mu.items.find(i => i.key === mu.picked);
  el('muDetail').classList.toggle('hidden', !it);
  if (!it) return;
  el('muPreview').src = it.thumb;
  el('muTitle').textContent = it.title;
  el('muBy').textContent = [it.artist, it.date].filter(Boolean).join(' · ');
  el('muMedium').textContent = it.medium;
  el('muSource').textContent = `${it.museum} · ${it.licence ? 'Licence: ' + it.licence : "Licence: see the museum's page"}`;
  el('muCredit').textContent = it.credit;
  el('muPage').classList.toggle('hidden', !it.page);
  el('muPage').href = it.page || '#';
}

// Search again from the first page, or on from where the last one stopped.
async function muSearch(more = false) {
  const q = (more ? mu.query : el('muQuery').value).trim();
  if (!q) { muStatus('Type what to look for - an artist, a subject, a medium.'); return; }
  const token = ++mu.token;
  if (!more) {
    mu.query = q;
    mu.items = []; mu.picked = null; mu.searched = true;
    mu.cursors = Object.fromEntries(mu.sources.map(k => [k, undefined]));
    muSavePrefs();
    muRenderGrid(); muRenderDetail();
  }
  const live = mu.sources.filter(k => mu.cursors[k] !== null);
  el('muSearch').disabled = true; el('muMore').disabled = true;
  muStatus(`Searching ${live.map(k => MU_SOURCES[k].label).join(' and ')}…`);
  const results = await Promise.all(live.map(k => MU_SOURCES[k].search(q, mu.cursors[k]).then(r => ({ k, r }), e => ({ k, e }))));
  if (token !== mu.token) return; // a newer search has taken over
  const failed = [];
  for (const { k, r, e } of results) {
    if (e) { failed.push(MU_SOURCES[k].label); continue; }
    mu.cursors[k] = r.cursor;
    mu.items.push(...r.items.filter(i => !mu.items.some(x => x.key === i.key)));
  }
  el('muSearch').disabled = false; el('muMore').disabled = false;
  muRenderGrid();
  const n = mu.items.length;
  muStatus((n ? `${n} picture${n === 1 ? '' : 's'} for "${q}".` : `Nothing found for "${q}" in the public domain.`) +
    (failed.length ? ` ${failed.join(' and ')} could not be reached - check the connection.` : ''), !!failed.length);
}

// The same picture no longer than `max` on its longest side; one already
// smaller, or that cannot be decoded, comes back as it was.
async function muShrink(blob, max) {
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch { return blob; }
  const k = max / Math.max(bmp.width, bmp.height);
  if (k >= 1) { bmp.close(); return blob; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise(res => c.toBlob(b => res(b || blob), 'image/jpeg', 0.92));
}

// The picture itself, then the workspace: a blob, so the tools can read it.
async function muOpen(size) {
  const it = mu.items.find(i => i.key === mu.picked);
  if (!it) return;
  muStatus(`Fetching ${size === 'full' ? 'the full-size picture' : 'the picture'}…`);
  let blob;
  try {
    const r = await fetch(it.full, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error(String(r.status));
    blob = await r.blob();
  } catch {
    muStatus("The picture could not be read from the museum's server - check the connection, or open its page.", true);
    return;
  }
  if (size !== 'full') blob = await muShrink(blob, MU_WORK_EDGE);
  const label = [it.artist, it.title].filter(Boolean).join(' - ').slice(0, 70);
  openInWorkspace(URL.createObjectURL(blob), { label, tab: 'value' });
  muStatus('');
}

function initMuseum() {
  const p = muLoadPrefs();
  mu = { query: p.query, sources: p.sources, items: [], cursors: {}, picked: null, searched: false, token: 0 };
  el('muQuery').value = mu.query;
  muSourceChips();
  el('muExamples').innerHTML = MU_EXAMPLES.map(t => `<button type="button" class="chip" data-example="${esc(t)}">${esc(t)}</button>`).join('');

  el('muForm').addEventListener('submit', e => { e.preventDefault(); muSearch(); });
  el('muMore').addEventListener('click', () => muSearch(true));
  el('muSources').addEventListener('click', e => {
    const b = e.target.closest('[data-source]');
    if (!b) return;
    const on = mu.sources.includes(b.dataset.source);
    // At least one source stays on: with none, a search would do nothing.
    if (on && mu.sources.length === 1) return;
    mu.sources = Object.keys(MU_SOURCES).filter(k => (k === b.dataset.source ? !on : mu.sources.includes(k)));
    muSourceChips(); muSavePrefs();
  });
  el('muExamples').addEventListener('click', e => {
    const b = e.target.closest('[data-example]');
    if (!b) return;
    el('muQuery').value = b.dataset.example;
    muSearch();
  });
  el('muGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    mu.picked = b.dataset.key;
    for (const c of el('muGrid').children) c.setAttribute('aria-pressed', String(c.dataset.key === mu.picked));
    muRenderDetail();
  });
  el('muOpen').addEventListener('click', () => muOpen('mid'));
  el('muFull').addEventListener('click', () => muOpen('full'));
  el('muCopy').addEventListener('click', async () => {
    const it = mu.items.find(i => i.key === mu.picked);
    if (!it) return;
    try { await navigator.clipboard.writeText(muCredit(it)); muStatus('Credit copied.'); }
    catch { muStatus(muCredit(it)); }
  });
  muRenderGrid();
}

function showMuseum() {
  if (!mu) initMuseum();
  el('muQuery').focus();
}
