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

function themeId() {
  try { const id = localStorage.getItem(THEME_KEY); return THEMES[id] ? id : THEME_DEFAULT; }
  catch { return THEME_DEFAULT; }
}

function applyTheme(id) {
  const t = THEMES[id] || THEMES[THEME_DEFAULT], root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty('--' + k, v);
  // Native controls - a <select>'s open list above all - follow this.
  root.style.colorScheme = t.light ? 'light' : 'dark';
  root.dataset.theme = THEMES[id] ? id : THEME_DEFAULT;
  document.dispatchEvent(new CustomEvent('refboard:theme'));
}

function setTheme(id) {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* private mode: this visit only */ }
  applyTheme(id);
}

// A variable's current value, for what is drawn on a canvas.
const themeVar = name => getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();

applyTheme(themeId());
