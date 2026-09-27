/* refboard - My materials: what you draw and paint with, kept once and read
   by every tool, so each one's advice is in the terms of what is on your
   table.

   Each medium gets darker in its own way - watercolour by less water,
   liners by more layers of hatching, ballpoint by pressure, graphite by a
   softer grade - so the same value in a picture is a different instruction
   in each. That instruction is a medium's tone ladder below: the value
   split's legend and the eyedropper both read it. */
"use strict";

/* tones: lightest to darkest, six steps; fewer are picked evenly from them,
   always keeping both ends (two steps - notan - is the paper and the
   darkest). paint: which of paint.js's mixing models its colours follow,
   or null for a medium that has one colour - value is all it has to say. */
const MATERIALS = {
  watercolour: { label: 'Watercolour', group: 'Paint', paint: 'water',
    tones: ['the paper - leave it white', 'a pale tint, mostly water', 'a light wash', 'a middle wash',
      'a strong wash', 'the darkest - thick paint, little water'] },
  opaque: { label: 'Oil, acrylic or gouache', group: 'Paint', paint: 'opaque',
    tones: ['white with a touch of colour', 'light - a lot of white', 'light middle', 'middle',
      'dark - little or no white', 'the darkest - no white'] },
  inkWash: { label: 'Bottle ink, in washes', group: 'Ink', paint: null,
    tones: ['the paper', 'jar 1 - a drop of ink in a lot of water', 'jar 2', 'jar 3',
      'jar 4 - about half ink', 'ink straight from the bottle'] },
  liner: { label: 'Liners', group: 'Ink', paint: null,
    tones: ['the paper - no lines', 'a few lines, far apart', 'one layer of hatching', 'cross-hatching',
      'three layers, close', 'solid black'] },
  ballpoint: { label: 'Ballpoint pen', group: 'Ink', paint: null,
    tones: ['the paper - ballpoint cannot be erased', 'the lightest touch', 'light pressure, one layer',
      'medium pressure, layered', 'firm pressure, many layers', 'firm and dense - the darkest'] },
  wcPencil: { label: 'Watercolour pencils', group: 'Pencils and markers', paint: 'water',
    tones: ['the paper', 'one light layer', 'two light layers', 'firm pressure, layered',
      'layered, then wetted', 'layered, wetted, dry, layered again'] },
  wcMarker: { label: 'Watercolour markers', group: 'Pencils and markers', paint: 'water',
    tones: ['the paper', 'picked up from the tip with water - pale', 'a stroke thinned with water',
      'one stroke of the marker', 'two strokes, blended', 'the darkest marker, layered'] },
  graphite: { label: 'Graphite pencil', group: 'Pencils and markers', paint: null,
    tones: ['the paper', '2H', 'HB', '2B', '4B', '8B'] },
};
const MATERIALS_KEY = 'refboard.materials.v1';

// Without a saved profile: what the eyedropper's old medium switch said.
function materialsProfile() {
  try {
    const v = JSON.parse(localStorage.getItem(MATERIALS_KEY));
    const have = Array.isArray(v?.have) ? v.have.filter(k => MATERIALS[k]) : [];
    if (have.length) return { have, main: have.includes(v.main) ? v.main : have[0] };
  } catch { /* fall through */ }
  const main = paintMedium() === 'opaque' ? 'opaque' : 'watercolour';
  return { have: [main], main };
}
function saveMaterialsProfile(p) {
  try { localStorage.setItem(MATERIALS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
const mainMaterial = () => MATERIALS[materialsProfile().main];

// The medium you are using now. A paint medium also sets which way
// recipes are mixed - with white paint, or with water and the paper.
function setMainMaterial(k) {
  const p = materialsProfile();
  if (!MATERIALS[k]) return;
  if (!p.have.includes(k)) p.have.push(k);
  p.main = k;
  saveMaterialsProfile(p);
  if (MATERIALS[k].paint) setPaintMedium(MATERIALS[k].paint);
  renderMaterialSelect();
  drawLegend();
  if (lastMixRgb) renderMixGuide(lastMixRgb);
  document.dispatchEvent(new CustomEvent('refboard:materials'));
}

// n steps of a medium's ladder, lightest first.
function materialTones(n, m = mainMaterial()) {
  const t = m.tones;
  if (n >= t.length) return [...t];
  return Array.from({ length: n }, (_, i) => t[Math.round(i * (t.length - 1) / (n - 1))]);
}

// What a sampled value means in the medium: its step on the ladder - the
// value split's steps while it is on, all six otherwise.
function materialToneFor(pct, m = mainMaterial()) {
  const n = state.valueSteps || m.tones.length;
  const tones = materialTones(n, m);
  return tones[Math.round((1 - pct / 100) * (n - 1))];
}

/* ---- the medium select in the info drawer: your materials, and a way to
   the rest. */
function renderMaterialSelect() {
  const sel = el('mediumSelect'), p = materialsProfile();
  sel.innerHTML = p.have.map(k => `<option value="${k}">${MATERIALS[k].label}</option>`).join('') +
    '<option value="edit">My materials...</option>';
  sel.value = p.main;
}

/* ---- the My materials dialog. Ticks are what you have; the dot is what
   you are using now. */
let materialsReturn = null;
function openMaterials() {
  materialsReturn = document.activeElement;
  renderMaterialsDialog();
  el('materials').classList.remove('hidden');
  el('materialsList').querySelector('input')?.focus();
}
function closeMaterials() {
  el('materials').classList.add('hidden');
  materialsReturn?.focus?.();
}

function renderMaterialsDialog() {
  const p = materialsProfile();
  const groups = [...new Set(Object.values(MATERIALS).map(m => m.group))];
  el('materialsList').innerHTML = groups.map(g => `<fieldset><legend>${g}</legend>` +
    Object.entries(MATERIALS).filter(([, m]) => m.group === g).map(([k, m]) => {
      const have = p.have.includes(k);
      return `<div class="mat-row${have ? '' : ' off'}">` +
        `<label class="mat-have"><input type="checkbox" data-have="${k}"${have ? ' checked' : ''}> ${m.label}</label>` +
        `<label class="mat-main" title="Using it now"><input type="radio" name="matMain" data-main="${k}"` +
        `${p.main === k ? ' checked' : ''}${have ? '' : ' disabled'}> now</label></div>`;
    }).join('') + '</fieldset>').join('');
  const m = MATERIALS[p.main];
  el('materialsNow').innerHTML = `Using <b>${m.label}</b> now - the value steps read as: ` +
    materialTones(4, m).map(t => `<span>${esc(t)}</span>`).join(' → ');
}

function initMaterials() {
  el('materialsList').addEventListener('change', e => {
    const p = materialsProfile(), k = e.target.dataset.have || e.target.dataset.main;
    if (e.target.dataset.have) {
      if (e.target.checked) p.have.push(k);
      else if (p.have.length > 1) p.have = p.have.filter(h => h !== k);
      // The last one stays: advice needs a medium to be in.
      else { e.target.checked = true; return; }
      if (!p.have.includes(p.main)) p.main = p.have[0];
      p.have = Object.keys(MATERIALS).filter(h => p.have.includes(h));
      saveMaterialsProfile(p);
      setMainMaterial(p.main);
    } else {
      setMainMaterial(k);
    }
    renderMaterialsDialog();
    el('materialsList').querySelector(`[data-${e.target.dataset.have ? 'have' : 'main'}="${k}"]`)?.focus();
  });
  el('materialsClose').addEventListener('click', closeMaterials);
  el('btnMaterials').addEventListener('click', openMaterials);
  el('materials').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeMaterials(); }
  });
  el('materials').addEventListener('pointerdown', e => { if (e.target === el('materials')) closeMaterials(); });
  const sel = el('mediumSelect');
  sel.addEventListener('change', () => {
    if (sel.value === 'edit') { sel.value = materialsProfile().main; openMaterials(); return; }
    setMainMaterial(sel.value);
  });
  renderMaterialSelect();
}
initMaterials();
