/* refboard - Themes. Loaded in <head>, ahead of every other script and
   before anything is drawn, so a saved theme is on the first paint rather
   than flashing the default first.

   A theme is the app's frame - panels, controls, text - and nothing else.
   The session's stage, the picture's surround, value scales and paint
   swatches keep their own colours in every theme (see #session and
   #colStage in app.css): a theme must never change what a grey reads as. */
"use strict";

// The four Catppuccin flavours, from its published palettes, on the app's
// own tokens: the page is Base, the panels beside it Mantle, controls
// Surface 0, and Mauve is what is on.
function catppuccin(p, light) {
  return {
    light,
    vars: {
      bg: p.base, panel: p.mantle, 'panel-2': p.s0, line: p.s0, 'line-hi': p.s1,
      ink: p.text, dim: p.sub, accent: p.mauve,
      'accent-dim': `color-mix(in srgb, ${p.mauve} 38%, ${p.base})`,
      'on-accent': p.crust, 'btn-off': p.s0, bad: p.red,
      hover: light ? 'rgba(76, 79, 105, .08)' : 'rgba(205, 214, 244, .06)',
    },
  };
}

const THEMES = {
  mocha: { label: 'Catppuccin Mocha', ...catppuccin({ base: '#1e1e2e', mantle: '#181825', crust: '#11111b', s0: '#313244', s1: '#45475a', text: '#cdd6f4', sub: '#a6adc8', mauve: '#cba6f7', red: '#f38ba8' }, false) },
  macchiato: { label: 'Catppuccin Macchiato', ...catppuccin({ base: '#24273a', mantle: '#1e2030', crust: '#181926', s0: '#363a4f', s1: '#494d64', text: '#cad3f5', sub: '#a5adcb', mauve: '#c6a0f6', red: '#ed8796' }, false) },
  frappe: { label: 'Catppuccin Frappé', ...catppuccin({ base: '#303446', mantle: '#292c3c', crust: '#232634', s0: '#414559', s1: '#51576d', text: '#c6d0f5', sub: '#a5adce', mauve: '#ca9ee6', red: '#e78284' }, false) },
  // Latte's Subtext 1 rather than Subtext 0 for quiet text: 0 falls under
  // 4.5:1 on the Mantle panels.
  latte: { label: 'Catppuccin Latte', ...catppuccin({ base: '#eff1f5', mantle: '#e6e9ef', crust: '#dce0e8', s0: '#ccd0da', s1: '#bcc0cc', text: '#4c4f69', sub: '#5c5f77', mauve: '#8839ef', red: '#d20f39' }, true) },
  // The app's own studio greys and amber, as they were before themes.
  studio: { label: 'Studio dark', light: false, vars: {
    bg: '#1b1b1d', panel: '#242427', 'panel-2': '#2f2f33', line: '#353539', 'line-hi': '#4b4b52',
    ink: '#e6e6ea', dim: '#9696a0', accent: '#e3a043', 'accent-dim': '#6b5223',
    'on-accent': '#1a1206', 'btn-off': '#333338', bad: '#e0705f', hover: 'rgba(255, 255, 255, .05)',
  } },
  // For a tablet in sunlight, plein air: black on white, nothing faint.
  daylight: { label: 'Daylight', light: true, vars: {
    bg: '#ffffff', panel: '#f2f2f2', 'panel-2': '#e4e4e4', line: '#cfcfcf', 'line-hi': '#9a9a9a',
    ink: '#000000', dim: '#3d3d3d', accent: '#0b57d0', 'accent-dim': '#b3c9f0',
    'on-accent': '#ffffff', 'btn-off': '#d6d6d6', bad: '#b3261e', hover: 'rgba(0, 0, 0, .06)',
  } },
};
const THEME_KEY = 'refboard.theme.v1';
const THEME_DEFAULT = 'mocha';

/* ---- your own themes, from the theme editor (js/theme-editor.js). Kept
   as the six colours the editor shows; every other variable is worked out
   from them by themeFromColours(). */
const THEME_CUSTOM_KEY = 'refboard.customThemes.v1';
const THEME_COLOURS = ['bg', 'panel', 'panel-2', 'ink', 'dim', 'accent'];
const HEX = /^#[0-9a-f]{6}$/i;

function hexLuminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastRatio = (a, b) => {
  const [x, y] = [hexLuminance(a), hexLuminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Only well-formed colours ever get through: they end up in style
// attributes, and an imported file is someone else's.
function validColours(c) {
  return c && typeof c === 'object' && THEME_COLOURS.every(k => HEX.test(c[k]));
}

function themeFromColours(label, c) {
  const light = hexLuminance(c.bg) > 0.4;
  return {
    label, light, custom: true, colours: { ...c },
    vars: {
      bg: c.bg, panel: c.panel, 'panel-2': c['panel-2'], line: c['panel-2'],
      'line-hi': `color-mix(in srgb, ${c['panel-2']} 80%, ${c.ink})`,
      ink: c.ink, dim: c.dim, accent: c.accent,
      'accent-dim': `color-mix(in srgb, ${c.accent} 38%, ${c.bg})`,
      // Whichever of black and white reads better on the accent.
      'on-accent': contrastRatio(c.accent, '#000000') >= contrastRatio(c.accent, '#ffffff') ? '#11111b' : '#ffffff',
      'btn-off': c['panel-2'], bad: light ? '#d20f39' : '#f38ba8',
      hover: `color-mix(in srgb, ${c.ink} 7%, transparent)`,
    },
  };
}

function customThemes() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(THEME_CUSTOM_KEY)) || {}; } catch { raw = {}; }
  const out = {};
  for (const [id, t] of Object.entries(raw)) {
    if (/^custom-[a-z0-9-]{1,40}$/.test(id) && t && typeof t.label === 'string' && validColours(t.colours)) {
      out[id] = themeFromColours(t.label.slice(0, 40), t.colours);
    }
  }
  return out;
}
function saveCustomThemes(themes) {
  const raw = {};
  for (const [id, t] of Object.entries(themes)) raw[id] = { label: t.label, colours: t.colours };
  try { localStorage.setItem(THEME_CUSTOM_KEY, JSON.stringify(raw)); } catch { /* private mode */ }
}
const allThemes = () => ({ ...THEMES, ...customThemes() });

// The six editable colours of any theme, built in or your own.
function themeColours(t) {
  return t.colours || Object.fromEntries(THEME_COLOURS.map(k => [k, t.vars[k]]));
}

function themeId() {
  try { const id = localStorage.getItem(THEME_KEY); return allThemes()[id] ? id : THEME_DEFAULT; }
  catch { return THEME_DEFAULT; }
}

// Paints the page with a theme without choosing it - the editor's live
// preview uses this directly.
function paintTheme(t) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty('--' + k, v);
  // Native controls - a <select>'s open list above all - follow this.
  root.style.colorScheme = t.light ? 'light' : 'dark';
  document.dispatchEvent(new CustomEvent('refboard:theme'));
}

function applyTheme(id) {
  const all = allThemes(), known = all[id] ? id : THEME_DEFAULT;
  document.documentElement.dataset.theme = known;
  paintTheme(all[known]);
}

function setTheme(id) {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* private mode: this visit only */ }
  applyTheme(id);
}

// A variable's current value, for what is drawn on a canvas.
const themeVar = name => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();

applyTheme(themeId());
