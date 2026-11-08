/* refboard - Generate recipes: the choices of a picture you liked, kept under a name.

   A recipe is everything Generate is set to - every row, the character, the palette, More tags, how many and
   as what - so "the same, in other light" is one press and not a rebuild from nothing. Kept in this browser
   (refboard.generate.recipes.v1, so the backup carries it). Apply puts the choices back; Same, but... then
   changes only the light, and the recipe itself is left as it was. */
"use strict";

const GEN_RECIPES_KEY = 'refboard.generate.recipes.v1';
const GEN_RECIPES_MAX = 24;
let genRecipes = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(GEN_RECIPES_KEY));
    return Array.isArray(v) ? v.filter(r => r && typeof r.name === 'string' && r.choices && typeof r.choices === 'object') : [];
  } catch { return []; }
})();
let genRecipeNow = -1;      // the recipe applied last, while the choices still are its own
let genRecipeSaving = false;

function genRecipesSave() {
  try { localStorage.setItem(GEN_RECIPES_KEY, JSON.stringify(genRecipes)); } catch { /* private mode */ }
}

// A short name from what is set: "Frieren · watercolour", "Mountains · ink".
function genRecipeName() {
  const subject = genChoices.subject;
  const what = subject === 'character' ? (genChoices.character || 'Character')
    : genChoices[{ landscape: 'place', buildings: 'building', nature: 'thing', animal: 'animal' }[subject]] || subject;
  const medium = GEN_CHOICES.find(c => c.id === 'medium')?.options.find(o => o.id === genChoices.medium)?.label || genChoices.medium;
  return `${String(what).replace(/^./, c => c.toUpperCase())} · ${medium}`.slice(0, 40);
}

function genRecipeApply(i) {
  const r = genRecipes[i];
  if (!r) return;
  genChoices = { ...GEN_DEFAULTS, ...JSON.parse(JSON.stringify(r.choices)) };
  saveGenChoices();
  el('genExtra').value = r.extra || '';
  if (['1', '2', '4'].includes(String(r.count))) el('genCount').value = String(r.count);
  el('genQuality').value = r.quality === 'draft' ? 'draft' : '';
  genRecipeNow = i;
  renderGenerate();
  renderGenPrompt();
  renderGenRecipes();
}

function genRecipeAdd(name) {
  name = (name || '').trim().slice(0, 40) || genRecipeName();
  const rec = { name, choices: JSON.parse(JSON.stringify(genChoices)), extra: el('genExtra').value.trim(),
    count: Number(el('genCount').value) || 1, quality: el('genQuality').value, t: Date.now() };
  const same = genRecipes.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
  if (same >= 0) genRecipes[same] = rec;           // the same name again: it is changed, not doubled
  else if (genRecipes.length < GEN_RECIPES_MAX) genRecipes.push(rec);
  else { el('genStatus').textContent = `Up to ${GEN_RECIPES_MAX} recipes - delete one first.`; return; }
  genRecipesSave();
  genRecipeNow = same >= 0 ? same : genRecipes.length - 1;
  genRecipeSaving = false;
  renderGenRecipes();
}

function genRecipeDelete(i) {
  genRecipes.splice(i, 1);
  genRecipesSave();
  genRecipeNow = genRecipeNow === i ? -1 : (genRecipeNow > i ? genRecipeNow - 1 : genRecipeNow);
  renderGenRecipes();
}

function renderGenRecipes() {
  const box = el('genRecipes');
  if (!box) return;
  const chips = genRecipes.map((r, i) =>
    `<span class="recipe"><button type="button" class="chip" data-recipe="${i}" aria-pressed="${i === genRecipeNow}" title="Put these choices back">${esc(r.name)}</button>` +
    `<button type="button" class="recipe-x" data-recipe-del="${i}" aria-label="Delete ${esc(r.name)}" title="Delete this recipe">×</button></span>`).join('');
  const lights = genRecipeNow >= 0
    ? `<div class="recipe-same"><span class="count">Same, but light:</span>` +
      GEN_CHOICES.find(c => c.id === 'light').options.map(o =>
        `<button type="button" class="chip" data-recipe-light="${o.id}" aria-pressed="${genChoices.light === o.id}">${esc(o.label)}</button>`).join('') + `</div>`
    : '';
  box.innerHTML =
    `<div class="recipe-row"><h4>Recipes</h4>${chips}` +
    (genRecipeSaving
      ? `<input type="text" id="genRecipeName" maxlength="40" value="${esc(genRecipeName())}" aria-label="Recipe name">` +
        `<button type="button" class="ghost" id="genRecipeOk">Save</button><button type="button" class="ghost" id="genRecipeNo">Cancel</button>`
      : `<button type="button" class="ghost" id="genRecipeNew" title="Keep everything set here - the choices, More tags, how many - under a name">Save these choices...</button>`) +
    `</div>` + lights;
  if (genRecipeSaving) { const n = el('genRecipeName'); n.focus(); n.select(); }
}

function initGenRecipes() {
  const box = el('genRecipes');
  if (!box) return;
  box.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.recipe != null) genRecipeApply(Number(t.dataset.recipe));
    else if (t.dataset.recipeDel != null) genRecipeDelete(Number(t.dataset.recipeDel));
    else if (t.dataset.recipeLight) {
      genChoices.light = t.dataset.recipeLight;
      saveGenChoices();
      renderGenerate(); renderGenPrompt(); renderGenRecipes();
    } else if (t.id === 'genRecipeNew') { genRecipeSaving = true; renderGenRecipes(); }
    else if (t.id === 'genRecipeOk') genRecipeAdd(el('genRecipeName').value);
    else if (t.id === 'genRecipeNo') { genRecipeSaving = false; renderGenRecipes(); }
  });
  box.addEventListener('keydown', e => {
    if (e.target.id !== 'genRecipeName') return;
    if (e.key === 'Enter') { e.preventDefault(); genRecipeAdd(e.target.value); }
    if (e.key === 'Escape') { genRecipeSaving = false; renderGenRecipes(); }
  });
  renderGenRecipes();
}
initGenRecipes();
