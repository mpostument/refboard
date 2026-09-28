/* refboard - The theme editor: six colours, seen live on the whole app as
   they change, kept as your own theme, and shared as a small .json file.

   Six, not all fourteen variables: the borders, the hover tint, the dimmed
   accent and the text on the accent all follow from these
   (themeFromColours() in js/theme.js), so a theme cannot come out with a
   border that disappears or unreadable text on a button. */
"use strict";

const THEME_EDIT_ROWS = [
  ['bg', 'Background', 'The page behind everything'],
  ['panel', 'Panels', 'The rail and the side panels'],
  ['panel-2', 'Controls', 'Buttons, fields, chips'],
  ['ink', 'Text', ''],
  ['dim', 'Quiet text', 'Hints and labels'],
  ['accent', 'Accent', 'What is on or chosen'],
];
// The names these colours have in an exported file - words, not variables.
const THEME_FILE_KEYS = { bg: 'background', panel: 'panels', 'panel-2': 'controls', ink: 'text', dim: 'quietText', accent: 'accent' };

let themeDraft = null; // { id: an own theme's id, or null for a new one, name, colours }
let themeEditorReturn = null;

function openThemeEditor() {
  const id = themeId(), t = allThemes()[id];
  themeDraft = { id: t.custom ? id : null, name: t.custom ? t.label : `${t.label} - mine`, colours: { ...themeColours(t) } };
  themeEditorReturn = document.activeElement;
  el('themeName').value = themeDraft.name;
  el('themeEditorMsg').textContent = '';
  el('themeDelete').classList.toggle('hidden', !themeDraft.id);
  el('themeDelete').textContent = 'Delete';
  el('themeEditor').classList.remove('hidden');
  renderThemeEditor();
  el('themeRows').querySelector('input').focus();
}

// Close without saving puts back the theme that was chosen.
function closeThemeEditor() {
  el('themeEditor').classList.add('hidden');
  applyTheme(themeId());
  themeDraft = null;
  themeEditorReturn?.focus?.();
}

function themeRatioLine(label, a, b, need) {
  const r = contrastRatio(a, b);
  const word = r >= need * 1.5 ? 'easy to read' : r >= need ? 'readable' : 'too faint';
  return `<div class="te-ratio${r < need ? ' bad' : ''}"><span>${label}</span><b>${r.toFixed(1)}:1</b><i>${word}</i></div>`;
}

function renderThemeEditor() {
  const c = themeDraft.colours;
  el('themeRows').innerHTML = THEME_EDIT_ROWS.map(([k, label, hint]) =>
    `<label class="te-row"><input type="color" value="${c[k]}" data-k="${k}">` +
    `<span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span><code>${c[k]}</code></label>`).join('');
  renderThemeContrast();
  paintTheme(themeFromColours(themeDraft.name, c));
}

// Text needs 4.5:1 against what it sits on; the accent, a shape rather
// than words, 3:1 (WCAG's two thresholds).
function renderThemeContrast() {
  const c = themeDraft.colours;
  el('themeContrast').innerHTML =
    themeRatioLine('Text on the background', c.ink, c.bg, 4.5) +
    themeRatioLine('Quiet text on panels', c.dim, c.panel, 4.5) +
    themeRatioLine('Accent on the background', c.accent, c.bg, 3);
}

const themeSlug = name => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';

function saveThemeDraft() {
  const name = el('themeName').value.trim().slice(0, 40) || 'My theme';
  const all = customThemes();
  const id = themeDraft.id || 'custom-' + themeSlug(name);
  all[id] = themeFromColours(name, themeDraft.colours);
  saveCustomThemes(all);
  setTheme(id);
  themeDraft = null;
  el('themeEditor').classList.add('hidden');
  themeEditorReturn?.focus?.();
}

function exportThemeDraft() {
  const name = el('themeName').value.trim() || 'My theme';
  const colours = Object.fromEntries(Object.entries(THEME_FILE_KEYS).map(([k, f]) => [f, themeDraft.colours[k]]));
  const blob = new Blob([JSON.stringify({ refboardTheme: 1, name, colours }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `refboard-theme-${themeSlug(name)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// A file in, as the draft - nothing is kept until Save.
async function importThemeFile(file) {
  const msg = el('themeEditorMsg');
  try {
    const data = JSON.parse(await file.text());
    const colours = {};
    for (const [k, f] of Object.entries(THEME_FILE_KEYS)) colours[k] = data?.colours?.[f];
    if (data?.refboardTheme !== 1 || !validColours(colours)) throw new Error('not a Refboard theme');
    themeDraft = { id: null, name: String(data.name || 'Imported theme').slice(0, 40), colours };
    el('themeName').value = themeDraft.name;
    el('themeDelete').classList.add('hidden');
    msg.textContent = `Loaded "${themeDraft.name}" - Save to keep it.`;
    renderThemeEditor();
  } catch {
    msg.textContent = 'That file is not a Refboard theme - export one from here to see the format.';
  }
}

function initThemeEditor() {
  el('themeRows').addEventListener('input', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    themeDraft.colours[k] = e.target.value;
    e.target.closest('.te-row').querySelector('code').textContent = e.target.value;
    renderThemeContrast();
    paintTheme(themeFromColours(themeDraft.name, themeDraft.colours));
  });
  el('themeName').addEventListener('input', e => { themeDraft.name = e.target.value; });
  el('themeSave').addEventListener('click', saveThemeDraft);
  el('themeEditorClose').addEventListener('click', closeThemeEditor);
  el('themeExport').addEventListener('click', exportThemeDraft);
  el('themeImport').addEventListener('click', () => el('themeImportInput').click());
  el('themeImportInput').addEventListener('change', e => {
    if (e.target.files[0]) importThemeFile(e.target.files[0]);
    e.target.value = '';
  });
  // Deleting asks twice, on the button itself.
  el('themeDelete').addEventListener('click', e => {
    if (e.target.textContent !== 'Delete - sure?') { e.target.textContent = 'Delete - sure?'; return; }
    const all = customThemes();
    delete all[themeDraft.id];
    saveCustomThemes(all);
    setTheme(THEME_DEFAULT);
    themeDraft = null;
    el('themeEditor').classList.add('hidden');
    themeEditorReturn?.focus?.();
  });
  // Keys stay in the editor - the session and the 3D view listen for
  // single letters on the document, and a name is typed here.
  initSheet(el('themeEditor'), closeThemeEditor);
}
initThemeEditor();
