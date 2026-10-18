/* refboard - the Game assets view (ROADMAP.md, "Game assets", phase 2): pictures to *use* in
   a 2D game, not to draw from - a prop, a weapon, an item - cut out, one to a picture, in a
   file with a transparent background. It shares the run (runGenerate), the client and the
   server with Generate; what is its own is the recipe (assetRequest: the words that turn an
   anime illustration into a game asset, found in phase 0) and what is done to each picture
   after the model (assetFinish: cut out, one piece, turned upright, an icon).
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const ASSET_KEY = 'refboard.assets.v1';

/* What phase 0 found turns the model's lit, glossy illustration into a flat asset on white,
   for every kind; and what it must keep out. */
const ASSET_STYLE = 'game sprite, 2d game asset, flat color, cel shading, thick outline, simple background, white background';
const ASSET_AVOID = 'shadow, cast shadow, gradient, glossy, shiny, depth of field, 3d, realistic, floor, ground, lighting';
// An anime model makes a girl holding the thing, and a landscape behind a tree.
const ASSET_ALONE = 'human, 1girl, 1boy, person, hands, holding, character, scenery, landscape, sky';

/* How simple, a setting of its own: without it the output is far too busy for a game.
   A tile is a texture, so what it keeps out (tileAvoid) is not "texture, patterns". */
const ASSET_SIMPLE = [
  { id: 'simple', label: 'Simple', tags: 'minimalist, simple design, limited color palette', avoid: 'detailed, intricate, ornate, complex, texture, patterns', tileAvoid: 'detailed, intricate, ornate, complex', hint: 'A few flat colours - what a small sprite can show' },
  { id: 'medium', label: 'Medium', tags: '', avoid: 'intricate, ornate', tileAvoid: 'intricate, ornate', hint: 'Some detail, no ornament' },
  { id: 'detailed', label: 'Detailed', tags: 'detailed', avoid: '', tileAvoid: '', hint: 'Fine detail - for a big picture, not a small sprite' },
];

/* A tile is a flat piece of ground, not a sprite on white: no outline, no background to cut
   away, and none of the "floor, ground" that a sprite is told to keep out. */
const TILE_STYLE = 'flat color, cel shading, 2d game texture, from above';
const TILE_AVOID = 'shadow, cast shadow, gradient, glossy, shiny, depth of field, 3d, realistic, lighting, border, frame, horizon, perspective, vignette, object';
/* What phase 0 found per ground. Water fails with the word "tile" in it, and soil turns into
   bricks at "simple" unless bricks are kept out. */
const TILE_WORDS = {
  grass: { tags: 'grass, lawn, seamless texture, tileable' },
  dirt: { tags: 'dirt, bare soil, brown, seamless texture, tileable', avoid: 'brick, bricks, mosaic, pavement, tiles' },
  stone: { tags: 'stone floor, cobblestone, seamless texture, tileable', avoid: 'gaps, white gaps' },
  water: { tags: 'water, waves, ripples, blue', avoid: 'circles, mosaic, squares' },
  wood: { tags: 'wood planks, wooden floor, seamless texture, tileable' },
  sand: { tags: 'sand, desert sand, seamless texture, tileable' },
  snow: { tags: 'snow, snowfield, seamless texture, tileable' },
  lava: { tags: 'lava, molten rock, glowing cracks, seamless texture, tileable' },
};
// The tile is asked of the model whole, then mended at this size and shrunk to the one chosen.
/* Real runs (grass, stone, water, one model, 2026-10-16): a denoise of 0.9 or more makes the server
   erase the cross and draw it from nothing - a different green, less texture, the cross itself
   visible at 1x; 0.6 keeps what is under it and only heals the join. tileSeam of the model's own
   tile was 2.2 - 5.7, of the mended 1.3 - 3.5: the ranges overlap (a noisy texture scores high
   whole), so the score marks only what is plainly bad, over TILE_SEAM_BAD. */
const TILE_MODEL = 1024, TILE_BAND = 0.14, TILE_DENOISE = 0.6, TILE_SEAM_BAD = 4;
const TILE_SIZES = [
  { id: '512', label: '512', hint: 'A big tile - for a game drawn large' },
  { id: '256', label: '256', hint: 'A tile for a game drawn at 256 px a square' },
  { id: '32', label: '32', hint: 'Shrunk to 32 px, for a small game (colours not yet cut - that is phase 6)' },
  { id: '16', label: '16', hint: 'Shrunk to 16 px' },
];

/* A character is drawn once per direction, from one figure: the 3D figure of Forms turned
   round (the camera goes round it by `deg`, 0 = the figure's front), each turn a depth map
   the ControlNet holds the picture to, all with the same seed and the same words but the one
   that says which way she faces. Which way she faces on the screen: the camera 90 degrees round
   sees her turned to the screen's left. `words` is what the model is told for that turn. */
const CHAR_FACE = {
  front: 'facing viewer', left: 'from side, profile, facing left', right: 'from side, profile, facing right',
  back: 'from behind, back view', frontLeft: 'three-quarter view, facing front left',
  frontRight: 'three-quarter view, facing front right', backLeft: 'from behind, three-quarter back view, facing back left',
  backRight: 'from behind, three-quarter back view, facing back right',
};
const CHAR_DIRS = {
  // A side-on game needs one: it faces right, and the game flips it for left.
  1: [['right', 270]],
  4: [['front', 0], ['left', 90], ['back', 180], ['right', 270]],
  8: [['front', 0], ['frontLeft', 45], ['left', 90], ['backLeft', 135], ['back', 180], ['backRight', 225], ['right', 270], ['frontRight', 315]],
};
const CHAR_CHOICES = [
  { id: '1', label: '1 - side', hint: 'One picture, facing right - a game mirrors it for left' },
  { id: '4', label: '4 directions', hint: 'Front, left, back, right - for most games' },
  { id: '8', label: '8 directions', hint: 'Adds the four diagonals - for a game with free movement' },
];
// The camera's height for the two views: level with her for a side-on game, above for a top-down one.
const CHAR_PITCH = { side: 4, top: 25 };
// What the model draws unless told not: a chibi (not wanted), and a sheet of several figures.
const CHAR_AVOID = 'chibi, super deformed, multiple views, character sheet, reference sheet, turnaround, multiple girls, multiple boys';
const CHAR_STRENGTH = 0.5;
/* A character is an anime illustration, not a sprite's flat shapes (the user, 2026-10-16, of the
   first runs: "I do not like the style"; "ordinary anime"): a thin outline and soft shading. What it
   keeps out is only what would not cut out or would not stand on its own - shadow, floor - and not
   "gradient, glossy, lighting", which the sprite recipe keeps out and which is what soft shading is. */
const CHAR_STYLE = 'anime style, anime illustration, soft shading, thin outline, 2d game character';
const CHAR_NOT = 'shadow, cast shadow, ground shadow, drop shadow, contact shadow, depth of field, 3d, realistic, floor, ground, vignette, scenery, glow, rim light, colored outline';
/* The background a character is drawn on: one flat colour that is not in her look, so the cut-out can
   take every pixel of it and none of her (the user, 2026-10-16: "the cutting works badly" - a white cloak
   went with the white background, and gaps between the legs stayed). The first colour whose family the
   look does not mention. */
const CHAR_KEYS = [
  { word: 'magenta', clash: /pink|magenta|purple|violet|red|rose|crimson|lilac/ },
  { word: 'green', clash: /green|emerald|olive|lime|mint/ },
  { word: 'cyan', clash: /blue|cyan|teal|turquoise|aqua|azure/ },
];
const charKey = look => (CHAR_KEYS.find(k => !k.clash.test(look)) || CHAR_KEYS[0]).word;
// What a cut-out character is: the cut, trimmed, and (on a pale background only) the white border taken off.
const assetFigureCanvas = cut => assetTrim(cut.keyed ? cut.canvas : assetDefringe(cut.canvas)) || cut.canvas;

const ASSET_THEMES = [
  { id: 'any', label: 'Any', tags: '' },
  { id: 'fantasy', label: 'Fantasy', tags: 'fantasy' },
  { id: 'medieval', label: 'Medieval', tags: 'medieval' },
  { id: 'slavic', label: 'Slavic', tags: 'slavic folklore, folk art' },
  { id: 'scifi', label: 'Sci-fi', tags: 'sci-fi, futuristic' },
  { id: 'steampunk', label: 'Steampunk', tags: 'steampunk' },
  { id: 'modern', label: 'Modern', tags: 'modern' },
];

const ASSET_MATERIALS = [
  { id: 'any', label: 'Any', word: '' }, { id: 'wooden', label: 'Wood', word: 'wooden' }, { id: 'iron', label: 'Iron', word: 'iron' },
  { id: 'steel', label: 'Steel', word: 'steel' }, { id: 'golden', label: 'Gold', word: 'golden' },
  { id: 'stone', label: 'Stone', word: 'stone' }, { id: 'crystal', label: 'Crystal', word: 'crystal' },
];

/* size: what is asked of the model (multiples of 64 - the server's free Width and Height).
   A weapon is tall so that it fits whole; the rest are square. */
const ASSET_KINDS = [
  { id: 'prop', label: 'Prop', size: [1024, 1024], views: true, icon: false, hint: 'Something in the world - a chest, a barrel, a tree',
    things: ['treasure chest', 'barrel', 'crate', 'tree', 'lamp', 'signpost', 'well', 'tent', 'rock', 'bush', 'fence', 'door'] },
  { id: 'weapon', label: 'Weapon', size: [768, 1152], views: false, icon: true, hint: 'Held, one to a picture, turned upright with its working end up',
    things: ['sword', 'axe', 'bow', 'staff', 'spear', 'dagger', 'mace', 'hammer', 'shield'] },
  { id: 'item', label: 'Item', size: [768, 768], views: false, icon: true, hint: 'Something picked up - a potion, a key, a coin',
    things: ['potion', 'key', 'scroll', 'coin', 'gem', 'ring', 'apple', 'book', 'heart', 'mushroom'] },
  { id: 'tile', label: 'Tile', size: [TILE_MODEL, TILE_MODEL], views: false, icon: false, tile: true, hint: 'A square of ground that repeats with no seam - 3 x 3 shown',
    things: Object.keys(TILE_WORDS) },
  // Its size is the figure's: the shape (portrait) is named, not a free width and height, as every picture
  // started from another one is.
  { id: 'character', label: 'Character', size: null, views: true, icon: false, character: true, hint: 'One side view drawn freely, or the 3D figure from Forms turned to 4 or 8 directions - cut out',
    things: ['girl knight, short brown hair, silver armor, blue skirt', 'boy mage, black hair, dark blue robe, hood',
      'girl archer, blonde ponytail, green tunic, brown boots', 'boy villager, brown hair, white shirt, brown trousers',
      'girl rogue, black hair, dark hooded cloak, leather armor', 'boy warrior, red hair, leather armor, fur cape'] },
];

// What a view says to the model; a prop is drawn from the front or from the 3/4 view above it.
const ASSET_VIEWS = [
  { id: 'side', label: 'Side', tags: 'front view' },
  { id: 'top', label: 'Top-down', tags: 'from above, 3/4 view' },
];

// A chest opens its lid and fills with gold unless told it is closed (phase 0); a bare "chest" is
// also read as a body part, so the first idea is "treasure chest" - and the treasure kept inside.
const ASSET_CONTAINER = /\b(chest|box|crate|barrel|door|jar|bag|coffin|basket|pot|book|casket)\b/i;

const ASSET_LOOK_MAX = 120;   // the longest look a character is named by
const ASSET_DEFAULTS = { kind: 'prop', view: 'side', thing: 'treasure chest', theme: 'fantasy', material: 'any', simple: 'simple', size: '512', count: '4', draft: '', icon: true, dirs: '1' };
let assetState = { ...ASSET_DEFAULTS };

const assetKind = id => ASSET_KINDS.find(k => k.id === id) || ASSET_KINDS[0];
const assetPick = (list, id) => list.find(x => x.id === id) || list[0];

/* The request for one picture from the settings s (the shape of ASSET_DEFAULTS). Pure: the
   words, what to keep out, the tags it is filed under, its size and its kind. */
function assetRequest(s) {
  const kind = assetKind(s.kind), simple = assetPick(ASSET_SIMPLE, s.simple), theme = assetPick(ASSET_THEMES, s.theme);
  const material = assetPick(ASSET_MATERIALS, s.material), view = assetPick(ASSET_VIEWS, s.view);
  // A character's name is its whole look - hair, clothes and their colours: nothing else holds them
  // from one direction to the next - so it may be long; the picture is named by what is before the first comma.
  const thing = (s.thing || '').trim().toLowerCase().slice(0, kind.character ? ASSET_LOOK_MAX : 40) || kind.things[0];
  const short = kind.character ? thing.split(',')[0].trim().slice(0, 40) : thing;
  const named = [kind.tile || kind.character ? '' : material.word, thing].filter(Boolean).join(' ');
  const box = ASSET_CONTAINER.test(thing);
  const tags = kind.character ? [] : ['no humans'], avoid = [kind.tile ? TILE_AVOID : kind.character ? CHAR_NOT : ASSET_AVOID, kind.character ? `${CHAR_AVOID}, ${GEN_POSE_AVOID}` : ASSET_ALONE];
  const dir = s.dir && CHAR_FACE[s.dir] ? s.dir : 'front';
  if (kind.tile) {
    const ground = TILE_WORDS[thing] || { tags: `${thing}, seamless texture, tileable` };
    tags.push(ground.tags);
    if (ground.avoid) avoid.push(ground.avoid);
  } else if (kind.character) {
    const key = charKey(thing);
    tags.push('solo', named, 'full body', 'standing', CHAR_FACE[dir], ...(view.id === 'top' ? ['from above'] : []), `(${key} background:1.2)`, `solid ${key} background`, 'simple background');
  } else if (kind.id === 'weapon') {
    // The model draws a set of four to six, or a rack on a panel: ask for one, and keep the set out.
    tags.push('solo', `(single ${named}:1.3)`, 'full length', 'centered', 'vertical', 'pointing up', 'object focus');
    avoid.push('multiple, set, collection, rack, weapon rack, panel, display, sheath');
  } else if (kind.id === 'item') {
    tags.push(named, 'solo', 'centered', 'object focus');
    avoid.push('multiple, set, collection');
  } else {
    tags.push(named, ...(box ? ['closed', 'closed lid'] : []), view.tags, 'object focus');
    if (box) avoid.push('open, open lid, gold, coins, jewels, gems, overflowing');
  }
  const prompt = [...tags, theme.tags, simple.tags, kind.tile ? TILE_STYLE : kind.character ? CHAR_STYLE : ASSET_STYLE].filter(Boolean).join(', ');
  if (kind.character) return {
    prompt: comfyTags(prompt),
    avoid: comfyTags([...avoid, simple.avoid].filter(Boolean).join(', ')),
    tags: [short, 'character', dir, view.id, ...(theme.tags ? [theme.id] : []), 'asset'].slice(0, 24).map(t => t.slice(0, 40)),
    shape: 'portrait', asset: 'character', dir,
  };
  const [width, height] = kind.size;
  return {
    prompt: comfyTags(prompt),
    avoid: comfyTags([...avoid, kind.tile ? simple.tileAvoid : simple.avoid].filter(Boolean).join(', ')),
    // The thing first: a picture is named from its first three tags.
    tags: [thing, kind.id, ...(kind.views ? [view.id] : []), ...(theme.tags ? [theme.id] : []), ...(kind.tile ? ['seamless'] : []), `${width}x${height}`, 'asset']
      .slice(0, 24).map(t => t.slice(0, 40)),
    width, height, asset: kind.id,
  };
}

function assetsLoad() {
  try { Object.assign(assetState, JSON.parse(localStorage.getItem(ASSET_KEY)) || {}); } catch { /* defaults */ }
  if (!ASSET_KINDS.some(k => k.id === assetState.kind)) assetState.kind = ASSET_DEFAULTS.kind;
  if (typeof assetState.thing !== 'string' || !assetState.thing) assetState.thing = assetKind(assetState.kind).things[0];
}
function assetsSave() {
  try { localStorage.setItem(ASSET_KEY, JSON.stringify(assetState)); } catch { /* private mode */ }
}

function assetChips(group, label, list, current, hintOf = o => o.hint) {
  return `<div class="gen-row" data-row="${group}"><h4 id="asL-${group}">${esc(label)}</h4>` +
    `<div class="chips" role="group" aria-labelledby="asL-${group}">` +
    list.map(o => `<button type="button" class="chip" data-as="${group}" data-opt="${o.id}" aria-pressed="${current === o.id}"` +
      `${hintOf(o) ? ` title="${esc(hintOf(o))}"` : ''}>${esc(o.label)}</button>`).join('') + '</div></div>';
}

function renderAssets() {
  const s = assetState, kind = assetKind(s.kind);
  el('assetChoices').innerHTML =
    `<section class="gen-group">${assetChips('kind', 'What', ASSET_KINDS, s.kind)}` +
    `<div class="gen-row"><label class="gen-extra" for="assetThing">${kind.character ? 'Describe the look, in English - hair, clothes and their colours: it is what keeps the directions alike' : 'Name it, in English'} ` +
    `<input type="text" id="assetThing" maxlength="${kind.character ? ASSET_LOOK_MAX : 40}" autocomplete="off" spellcheck="false" value="${esc(s.thing)}" placeholder="e.g. ${esc(kind.things[0])}"></label>` +
    `<div class="chips" id="assetThings" role="group" aria-label="Ideas">` +
    kind.things.map(t => `<button type="button" class="chip" data-thing="${esc(t)}" aria-pressed="${s.thing.trim().toLowerCase() === t}">${esc(t)}</button>`).join('') + '</div></div>' +
    (kind.views ? assetChips('view', 'View', ASSET_VIEWS, s.view, () => '') : '') +
    (kind.character ? assetChips('dirs', 'Turned to', CHAR_CHOICES, s.dirs) +
      (s.dirs === '1'
        ? '<p class="gen-note">One side view, drawn freely from the words - no 3D figure, so the pose and build are the model\'s own. Make several and keep the one you like.</p>'
        : '<p class="gen-note">Drawn from the figure and pose set in Forms (3D forms): the figure is turned round and each turn drawn with the same words and seed. Whether the faces match is for you to judge.</p>') : '') + '</section>' +
    `<section class="gen-group">${assetChips('theme', 'Theme', ASSET_THEMES, s.theme, () => '')}` +
    (kind.tile || kind.character ? '' : assetChips('material', 'Material', ASSET_MATERIALS, s.material, () => '')) +
    assetChips('simple', 'How simple', ASSET_SIMPLE, s.simple) +
    (kind.tile ? assetChips('size', 'Tile size, px', TILE_SIZES, s.size) : '') + '</section>';
  el('assetIconRow').classList.toggle('hidden', !kind.icon);
  // The directions are the count of a character - except the one-sided kind, drawn free: there the
  // count is how many candidates to choose from.
  el('assetCountRow').classList.toggle('hidden', !!kind.character && s.dirs !== '1');
  el('assetIcon').checked = !!s.icon;
  el('assetCount').value = s.count;
  el('assetDraft').value = s.draft;
  renderAssetPrompt();
}

// The words as they go to the model, for the curious - and for checking a recipe by eye.
function renderAssetPrompt() {
  if (!el('assetPrompt').open) return;
  const r = assetRequest(assetState);
  el('assetPromptBody').innerHTML =
    `<div><h5>Tags</h5><div class="gen-tags">${esc(r.prompt)}${genServer.quality ? `<span class="fixed">, ${esc(genServer.quality)}</span>` : ''}</div></div>` +
    `<div><h5>Kept out</h5><div class="gen-tags">${esc(r.avoid)}</div></div>` +
    `<div><h5>Size asked of the model</h5><div class="gen-tags">${r.width} x ${r.height}</div></div>`;
}

/* A tile: not cut out - mended. The picture is shifted by half so that its seams lie in the
   middle as a cross, the cross is drawn again by the model from the tile's own words (a second
   job, `generateOne`, the Redraw path), and the result - whose edges now meet - is shrunk to the
   size chosen. The model's own picture and its second pass are forgotten; what is kept is the
   mended tile, tagged by how well its edges meet (tileSeam, 1 = no seam at all). */
async function assetFinishTile(made, s) {
  const doc = made.doc, status = el(ASSET_UI.status), size = Number(assetPick(TILE_SIZES, s.size).id);
  let pic;
  try { pic = await genLoadPicture(doc); } catch { return; }
  const rolled = tileRoll(pic, pic.width >> 1, pic.height >> 1);
  const cross = tileCross(pic.width, pic.height, Math.round(pic.width * TILE_BAND)).toDataURL('image/png').split(',')[1];
  status.textContent = 'Mending the seams...';
  const mended = await generateOne({ prompt: doc.prompt, avoid: doc.avoid || '', tags: (doc.tags || []).slice(0, 24), shape: 'square', seed: doc.seed,
    image: genEncode(rolled), mask: cross, denoise: TILE_DENOISE, parent: doc.file, asset: 'tile',
    ...(s.draft === 'draft' ? { steps: GEN_DRAFT_STEPS } : {}) });
  let fixed;
  try { fixed = await genLoadPicture(mended.doc); } catch { return; }
  const seam = tileSeam(fixed), canvas = tileShrink(fixed, size);
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const f = await storeFile(blob);
  if (storeMode === 'server') await storeSortFile(f.id, 'assets');
  const tags = [...(doc.tags || []).filter(t => t !== 'seamless' && !/^\d+x\d+$/.test(t)), seam < TILE_SEAM_BAD ? 'seamless' : 'seam visible', `${size}x${size}`].slice(0, 24);
  await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png',
    width: size, height: size, tags, t: Date.now() });
  await forgetUpload(mended.doc);
  await forgetUpload(doc);
}

/* A canvas kept as a PNG in Uploads, Assets, as the document `doc` made it (its words, seed and tags
   carried over, `extra` tags added, `over` laid on top). */
async function assetKeep(doc, canvas, extra, over = {}) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const f = await storeFile(blob);
  if (storeMode === 'server') await storeSortFile(f.id, 'assets');
  await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png',
    width: canvas.width, height: canvas.height, tags: [...(doc.tags || []), ...extra].slice(0, 24), t: Date.now(), ...over });
  return f;
}

/* One finished picture: cut out, and for a weapon or an item reduced to one piece, a
   weapon turned upright - kept in Uploads, Assets, in the place of the model's own, which
   is forgotten. A picture with no plain background is kept as it came, tagged so. */
async function assetFinish(made, s) {
  if (assetKind(s.kind).tile) return assetFinishTile(made, s);
  const doc = made.doc, kind = assetKind(s.kind);
  const keep = (canvas, extra, over) => assetKeep(doc, canvas, extra, over);
  let pic;
  try { pic = await genLoadPicture(doc); } catch { return; }
  const cut = cutOut(pic);
  if (!cut.found) {
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...(doc.tags || []), 'not cut out'].slice(0, 24) });
    return;
  }
  let canvas = cut.canvas;
  const notes = ['cut out'];
  if (kind.id !== 'prop') {
    const solo = assetSolo(canvas);
    if (solo) { canvas = solo.canvas; if (solo.pieces > 1) notes.push('one of ' + solo.pieces); }
  }
  if (kind.id === 'weapon') {
    const o = assetOrient(canvas);
    if (o) { canvas = o.canvas; if (o.turned) notes.push('upright'); }
  }
  const main = await keep(canvas, notes, { width: canvas.width, height: canvas.height });
  await forgetUpload(doc);
  if (kind.icon && s.icon) {
    await keep(assetIcon(canvas, { size: 128, diagonal: kind.id === 'weapon' }), ['icon', '128x128'],
      { parent: main.id, name: `${(doc.tags || [])[0] || kind.id}, icon` });
  }
}

const assetsMade = async () => (await listUploads()).filter(u => u.asset && u.folder === 'assets');
const ASSET_UI = { go: 'assetGo', status: 'assetStatus', goText: 'Make', refresh: () => showAssets(false) };

/* A character: one figure, turned. The depth map of the figure in Forms (the one Draw this pose
   uses) is taken once per direction with the camera sent round it; the maps are framed alike
   (round the union of their boxes, or the narrow side view would be drawn bigger than the front),
   and each is drawn with the same seed and the same words but the one that says which way she
   faces. SDXL does not keep a face between pictures, so the result is shown as candidates to look
   at, not promised as one person: what is done to them is only what is certain - cut out, scaled to
   one height, the feet set on one line (assetAlign). */
async function assetsCharacterGo(s) {
  const status = el(ASSET_UI.status);
  if (s.dirs === '1') { await assetsCharacterFree(s); return; }
  if (!genControlAvailable()) { status.textContent = 'A character is drawn through a depth ControlNet, and this server has none (COMFY_CONTROLNET).'; return; }
  status.textContent = 'Opening the 3D figure...';
  // The 3D view is a lazy section and starts its engine on first use; it is brought up here
  // without leaving this view - the depth maps are drawn off screen.
  try { await loadSection('forms'); showForms(); await formsReady(); } catch (err) { status.textContent = err.message; return; }
  const o = formShotSubject();
  if (!o) {
    status.textContent = 'There is no figure to turn: add one in 3D forms (Figure) and set its pose, then come back and press Make.';
    // Taken there, with the button that adds it in focus - one click from done.
    await openForms(() => { const b = document.querySelector('#formShapes [data-shape="figure"]'); if (b) b.focus(); });
    return;
  }
  const dirs = CHAR_DIRS[s.dirs] || CHAR_DIRS[1], seed = Math.floor(Math.random() * 2 ** 31);
  const scene = { ...formScene, fisheye: false, roll: 0, pitch: CHAR_PITCH[s.view] ?? CHAR_PITCH.side };
  status.textContent = 'Turning the figure...';
  const blobs = [];
  for (const [, deg] of dirs) blobs.push(await formsDepthSnapshot({ ...scene, yaw: wrap180((o.ry || 0) + deg) }));
  const boxes = (await Promise.all(blobs.map(genBoxOf))).filter(Boolean);
  if (!boxes.length) { status.textContent = 'The figure is not in view - the depth map is empty.'; return; }
  const x0 = Math.min(...boxes.map(b => b.x)), y0 = Math.min(...boxes.map(b => b.y));
  const union = { x: x0, y: y0, w: Math.max(...boxes.map(b => b.x + b.w)) - x0, h: Math.max(...boxes.map(b => b.y + b.h)) - y0 };
  const draft = s.draft === 'draft';
  const jobs = [];
  for (let i = 0; i < dirs.length; i++) {
    const frame = await genFrameImage(blobs[i], 'pose', { shape: 'portrait' }, union);
    const { dir, ...r } = assetRequest({ ...s, dir: dirs[i][0] });
    jobs.push({ ...r, image: frame.b64, control: true, strength: CHAR_STRENGTH, seed, tags: [...r.tags, 'pose'].slice(0, 24), ...(draft ? { steps: GEN_DRAFT_STEPS } : {}) });
  }
  const cuts = [];
  await runGenerate(jobs, (i, total) => `Drawing ${dirs[i - 1][0]} (${i} of ${total})...`, `${dirs.length} directions made - in Uploads, Assets.`, async made => {
    let pic;
    try { pic = await genLoadPicture(made.doc); } catch { return; }
    const cut = assetCutFigure(pic);
    if (cut.found) {
      // Kept at once, cut out and with the white border off: stopping, or a closed page, leaves
      // usable pictures, not the model's own. Lining up needs them all, so it is a second pass.
      const canvas = assetFigureCanvas(cut);
      const f = await assetKeep(made.doc, canvas, ['cut out']);
      await forgetUpload(made.doc);
      cuts.push({ doc: made.doc, file: f.id, canvas });
    } else await storePutItem('uploads', uploadKey(made.doc.file), { ...made.doc, tags: [...(made.doc.tags || []), 'not cut out'].slice(0, 24) });
  }, ASSET_UI);
  // Whatever was drawn is lined up, even if it was stopped or one failed.
  const lined = assetAlign(cuts.map(c => c.canvas));
  if (!lined) return;
  for (let i = 0; i < cuts.length; i++) {
    await assetKeep(cuts[i].doc, lined.canvases[i], ['cut out', 'aligned', `${lined.width}x${lined.height}`]);
    await forgetUpload({ ...cuts[i].doc, file: cuts[i].file });
  }
  storeChanged();
  await ASSET_UI.refresh();
}

/* One side view needs no turning, so it needs no figure: the depth map made every hero the mannequin's
   silhouette (the user, 2026-10-16: "I do not like how the heroes look"). It is drawn from the words
   alone, `count` times with a new seed each, as candidates - they are alternatives, so they are cut
   out and kept but not lined up to one height. */
async function assetsCharacterFree(s) {
  const r = assetRequest({ ...s, dir: CHAR_DIRS[1][0][0] }), n = Number(s.count) || 1;
  const draft = s.draft === 'draft';
  const jobs = Array.from({ length: n }, () => ({ ...r, ...(draft ? { steps: GEN_DRAFT_STEPS } : {}) }));
  await runGenerate(jobs, (i, total) => total > 1 ? `Drawing ${i} of ${total}...` : 'Drawing...',
    n > 1 ? `${n} made - in Uploads, Assets.` : 'Made - in Uploads, Assets.', async made => {
      let pic;
      try { pic = await genLoadPicture(made.doc); } catch { return; }
      const cut = assetCutFigure(pic);
      if (!cut.found) { await storePutItem('uploads', uploadKey(made.doc.file), { ...made.doc, tags: [...(made.doc.tags || []), 'not cut out'].slice(0, 24) }); return; }
      const canvas = assetFigureCanvas(cut);
      await assetKeep(made.doc, canvas, ['cut out']);
      await forgetUpload(made.doc);
    }, ASSET_UI);
  storeChanged();
  await ASSET_UI.refresh();
}

async function assetsGo() {
  if (genBusy) { genStop(); return; }
  if (assetKind(assetState.kind).character) { await assetsCharacterGo({ ...assetState }); return; }
  const s = { ...assetState }, r = assetRequest(s), n = Number(s.count) || 1;
  const draft = s.draft === 'draft';
  const jobs = Array.from({ length: n }, () => ({ ...r, ...(draft ? { steps: GEN_DRAFT_STEPS } : {}) }));
  await runGenerate(jobs, (i, total) => total > 1 ? `Making ${i} of ${total}...` : 'Making it...',
    n > 1 ? `${n} made - in Uploads, Assets.` : 'Made - in Uploads, Assets.', made => assetFinish(made, s), ASSET_UI);
}

function assetsOffline() {
  const p = el('assetOffline');
  if (!p) return;
  p.textContent = genOffline;
  p.classList.toggle('hidden', !genOffline);
  el('assetGo').disabled = !!genOffline;
}

async function showAssets(check = true) {
  if (!el('assetChoices').children.length) { assetsLoad(); renderAssets(); }
  if (check) await genCheck();
  assetsOffline();
  const all = await assetsMade();
  const host = el('assetResults');
  host.innerHTML = '';
  el('assetMadeCount').textContent = all.length ? String(all.length) : '';
  el('assetEmpty').classList.toggle('hidden', all.length > 0);
  for (const u of all.slice(0, 48)) {
    const li = document.createElement('li');
    const tile = (u.tags || []).includes('tile');
    li.innerHTML = `<button type="button" class="asset-open${tile ? ' asset-tile' : ''}" title="${esc((u.tags || []).join(', '))}" aria-label="Open ${esc(u.name)}">${tile ? '<span class="asset-3x3"></span>' : '<img alt="" loading="lazy">'}</button>` +
      `<button type="button" class="gen-del" aria-label="Delete ${esc(u.name)}" title="Delete it - from Uploads too">${iconSvg('close')}</button>` +
      `<span class="asset-name">${esc(u.name)}</span>`;
    storeFileUrl(u.file).then(url => {
      if (!url) return;
      if (tile) {
        const three = li.querySelector('.asset-3x3');
        three.style.backgroundImage = `url("${url}")`;
        // A tile shrunk to a few pixels is enlarged without smoothing, or it is a blur.
        three.classList.toggle('pixel', (u.width || 512) <= 64);
      } else li.querySelector('img').src = url;
    });
    li.querySelector('.asset-open').addEventListener('click', () => openUpload(u));
    li.querySelector('.gen-del').addEventListener('click', async () => {
      await forgetUpload(u);
      storeChanged();
      await showAssets(false);
    });
    host.appendChild(li);
  }
}

function initAssets() {
  el('assetChoices').addEventListener('click', e => {
    const t = e.target.closest('[data-thing]');
    if (t) { assetState.thing = t.dataset.thing; el('assetThing').value = t.dataset.thing; }
    const b = e.target.closest('[data-as]');
    if (b) {
      assetState[b.dataset.as] = b.dataset.opt;
      // A different kind has different things to name, and may or may not have views and an icon.
      if (b.dataset.as === 'kind') {
        assetState.thing = assetKind(b.dataset.opt).things[0];
        // A character is an illustration with some shading; "Simple" asks for the flat shapes of a sprite.
        if (assetKind(b.dataset.opt).character && assetState.simple === 'simple') assetState.simple = 'medium';
        assetsSave(); renderAssets(); return;
      }
      // The note and the count row depend on whether the figure is turned (4, 8) or not (1).
      if (b.dataset.as === 'dirs') { assetsSave(); renderAssets(); return; }
    } else if (!t) return;
    assetsSave();
    for (const x of el('assetChoices').querySelectorAll('[data-as],[data-thing]'))
      x.setAttribute('aria-pressed', String(x.dataset.thing ? x.dataset.thing === assetState.thing.trim().toLowerCase() : assetState[x.dataset.as] === x.dataset.opt));
    renderAssetPrompt();
  });
  el('assetChoices').addEventListener('input', e => {
    if (e.target.id !== 'assetThing') return;
    assetState.thing = e.target.value;
    assetsSave();
    for (const x of el('assetThings').querySelectorAll('[data-thing]')) x.setAttribute('aria-pressed', String(x.dataset.thing === assetState.thing.trim().toLowerCase()));
    renderAssetPrompt();
  });
  el('assetChoices').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'assetThing') assetsGo(); });
  el('assetPrompt').addEventListener('toggle', renderAssetPrompt);
  el('assetCount').addEventListener('change', e => { assetState.count = e.target.value; assetsSave(); });
  el('assetDraft').addEventListener('change', e => { assetState.draft = e.target.value; assetsSave(); });
  el('assetIcon').addEventListener('change', e => { assetState.icon = e.target.checked; assetsSave(); });
  el('assetGo').addEventListener('click', assetsGo);
}

initAssets();
