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
  { id: '32', label: '32', hint: 'Shrunk to 32 px, for a small game' },
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
/* Turned to 4 or 8 directions, each is drawn on its own, and what the words say once is dropped first:
   the trousers were one colour in the front and another in the three-quarter back view. So every part
   of the look that names a colour ("blue skirt", "dark hooded cloak") is given weight, and the model holds
   to it a little harder in every direction. The first part is the character's name, and is left as it is.
   Only parts that say a colour: a weight on "hood" alone would be only a louder hood. */
const CHAR_COLOUR = /\b(red|blue|green|yellow|orange|purple|violet|pink|white|black|brown|grey|gray|silver|golden|gold|beige|cream|teal|cyan|magenta|crimson|navy|dark|light|blonde)\b/;
const CHAR_LOOK_WEIGHT = 1.2;   // a little above 1: 1.3 and up starts to tint the rest of the picture with that colour
function charLook(look) {
  const [name, ...parts] = look.split(',').map(p => p.trim()).filter(Boolean);
  return [name, ...parts.map(p => CHAR_COLOUR.test(p) ? `(${p}:${CHAR_LOOK_WEIGHT})` : p)].join(', ');
}
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

/* The words a sword was found by ("vertical, pointing up, full length") make a *different* thing of some
   weapons, so a weapon the table knows is drawn with its own. A "bow" was read as a ribbon bow on a stick,
   and a shield asked to be tall and vertical came as a framed card or a window. Matched on the typed name,
   so "wooden longbow" and "round shield" are found; a weapon not in the table keeps the sword's words. */
const WEAPON_RECIPES = [
  // holes: the gap between the limbs and the string is background, and a bow has no white blade to lose with it
  { re: /\b(long|short|recurve|composite)?bow\b/i, name: 'bow', holes: true, tags: ['archery bow', 'curved limbs', 'bowstring', 'vertical', 'centered', 'object focus'],
    avoid: 'ribbon, hair bow, bow tie, gift bow, arrow, arrows, quiver, hand, holding' },
  { re: /\b(shield|buckler)\b/i, name: 'shield', size: [1024, 1024], tags: ['front view', 'emblem', 'centered', 'object focus'],
    avoid: 'pointing up, vertical, sword, spear, weapon' },
];
const weaponRecipe = thing => WEAPON_RECIPES.find(r => r.re.test(thing));

/* The same for what is picked up. Every item had one set of words ("solo, centered, object focus"), and the model
   answered with what a game icon usually is: a row of three bottles, a key lying on a slab, a scroll or an apple
   inside a stone frame, a coin on a rounded card. `holes`: the ring's and the key's bow are background too. A white
   or cream item (a pearl, a bone) would lose its own enclosed white to it, so only a thing with a hole in it has it.
   "close-up" is for the small things (coin, gem), which came a speck in the middle of the picture and blurred when
   the trim scaled them up. */
const ITEM_RECIPES = [
  { re: /\bpotions?\b|\bflask\b|\belixir\b/i, name: 'potion', tags: ['one glass bottle', 'cork stopper', 'liquid inside', 'centered', 'object focus'],
    avoid: 'bottles, two bottles, three bottles, row of bottles, shelf, candle, lamp' },
  { re: /\bkeys?\b/i, name: 'key', holes: true, tags: ['skeleton key', 'ring head', 'long shaft', 'teeth', 'vertical', 'centered', 'object focus'],
    avoid: 'key ring, keychain, bunch of keys, keys, lock, padlock, keyhole, chest, slab, plate, ribbon, bow, magnifying glass, handle' },
  { re: /\bscrolls?\b/i, name: 'scroll', tags: ['old parchment scroll', 'partly unrolled', 'curled ends', 'ribbon tie', 'centered', 'object focus'],
    avoid: 'banner, flag, sign, tablet, pillar, column, ornate border, text, cup, mug, tube, pipe, cylinder, toilet paper' },
  { re: /\bcoins?\b/i, name: 'coin', tags: ['round gold coin', 'close-up', 'centered', 'object focus'],
    avoid: 'square, rounded square, slot, medal, badge, pile of coins, coins, stack, clock, dial, plate' },
  { re: /\b(gems?|gemstones?|crystal|jewel)\b/i, name: 'gem', tags: ['cut gemstone', 'faceted', 'close-up', 'centered', 'object focus'],
    avoid: 'ring, jewelry setting, multiple gems, gems, dark background, grey background' },
  { re: /\brings?\b/i, name: 'ring', holes: true, tags: ['plain band ring', 'jewelry', 'tilted view', 'centered', 'object focus'],
    avoid: 'finger, hand, ring box, pillow, display, necklace, bracelet, chain, multiple rings' },
  { re: /\bapples?\b/i, name: 'apple', tags: ['whole apple', 'stem and leaf', 'centered', 'object focus'],
    avoid: 'frame, stone, bitten, slice, cut, tree, basket, bowl, cube' },
  { re: /\bbooks?\b|\btome\b|\bgrimoire\b/i, name: 'book', tags: ['closed hardcover book', 'cover', 'centered', 'object focus'],
    avoid: 'open book, spread pages, bookshelf, library, stack of books, multiple books' },
  { re: /\bhearts?\b/i, name: 'heart', tags: ['red love heart', 'symmetrical', 'glossy highlight', 'centered', 'object focus'],
    avoid: 'anatomical, organ, blood, hands, multiple hearts, frame, badge, emblem, gauge, machine, outline only' },
  { re: /\bmushrooms?\b/i, name: 'mushroom', tags: ['one mushroom', 'cap and stem', 'centered', 'object focus'],
    avoid: 'cluster, multiple mushrooms, forest, grass, ground, soil, logs' },
];
const itemRecipe = thing => ITEM_RECIPES.find(r => r.re.test(thing));
// The recipe a kind's thing is drawn by, if it has one.
const assetRecipe = (kindId, thing) => kindId === 'weapon' ? weaponRecipe(thing) : kindId === 'item' ? itemRecipe(thing) : null;
const WEAPON_SWORD_WORDS = ['full length', 'centered', 'vertical', 'pointing up', 'object focus'];
// What a cut-out weapon or item is never: the model draws a sheet of paper behind it (a frame, a card, a plaque) that
// is not the background and so is not cut away.
const ASSET_BACKDROP = 'border, frame, card, plaque, panel, backdrop, background pattern';

const ASSET_LOOK_MAX = 120;   // the longest look a character is named by
const ASSET_DEFAULTS = { kind: 'prop', view: 'side', thing: 'treasure chest', theme: 'fantasy', material: 'any', simple: 'simple', size: '512', count: '4', draft: '', icon: true, dirs: '1',
  // The pixel look: the grid ('off' = the picture as it is), colours, outline, and the game's palette (#rrggbb list, kept).
  pix: 'off', pixColours: '16', pixOutline: 'yes', pixShared: 'own', pixPalette: [] };
let assetState = { ...ASSET_DEFAULTS };

const PIX_GRIDS = [
  { id: 'off', label: 'Off', hint: 'The picture as the model drew it' },
  { id: '16', label: '16', hint: 'A grid of 16 cells on the longest side' },
  { id: '32', label: '32', hint: 'A grid of 32 cells on the longest side' },
  { id: '48', label: '48', hint: 'A grid of 48 cells on the longest side' },
  { id: '64', label: '64', hint: 'A grid of 64 cells on the longest side' },
];
const PIX_COLOURS = [
  { id: '8', label: '8', hint: 'Eight colours - very flat' },
  { id: '16', label: '16', hint: 'Sixteen colours' },
  { id: '32', label: '32', hint: 'Thirty-two colours - room for shading' },
  { id: '64', label: '64', hint: 'Sixty-four colours - for a game that wants many hues in one palette' },
];
const PIX_OUTLINE = [
  { id: 'yes', label: 'Outline', hint: 'One pixel of the palette\'s darkest colour round the shape (not on a tile)' },
  { id: 'no', label: 'None', hint: 'No outline' },
];
const PIX_SHARED = [
  { id: 'own', label: 'Its own', hint: 'Each picture gets the colours it needs' },
  { id: 'game', label: 'One for the game', hint: 'Every picture draws from one palette that grows as you make things - a sprite, a tile and an icon then look like one game' },
];
const hexOf = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const rgbOfHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/* The canvas as the pixel look asks (or as it is, when it is off). The game's palette, when
   one is kept for the game, is read from and written back to assetState: a batch of pictures
   is finished one after another, each growing it. Returns the canvas. */
function assetPixel(canvas, s, { outline = true, split } = {}) {
  if (s.pix === 'off') return canvas;
  const shared = s.pixShared === 'game';
  const r = assetPixelate(canvas, { grid: Number(s.pix), colours: Number(s.pixColours), outline: outline && s.pixOutline === 'yes',
    palette: shared ? (assetState.pixPalette || []).map(rgbOfHex) : [], shared, ...(split ? { split } : {}) });
  if (shared) { assetState.pixPalette = r.palette.map(hexOf); assetsSave(); renderAssetPixel(); }
  return r.canvas;
}

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
  // Several directions are several pictures that must agree, so the colours in the look are weighted (charLook).
  const named = [kind.tile || kind.character ? '' : material.word, kind.character && Number(s.dirs) > 1 ? charLook(thing) : thing].filter(Boolean).join(' ');
  const box = ASSET_CONTAINER.test(thing);
  const own = assetRecipe(kind.id, thing);
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
    tags.push('solo', `(single ${named}:1.3)`, ...(own ? own.tags : WEAPON_SWORD_WORDS));
    avoid.push('multiple, set, collection, rack, weapon rack, display, sheath', ASSET_BACKDROP, ...(own ? [own.avoid] : []));
  } else if (kind.id === 'item') {
    if (own) tags.push('solo', `(single ${named}:1.3)`, ...own.tags);
    else tags.push(named, 'solo', 'centered', 'object focus');
    // The pixel look is made afterwards from a smooth picture (ROADMAP phase 6); the model drew it, coarse and
    // blurred when enlarged, for a key, a coin, a heart and a mushroom.
    avoid.push('multiple, set, collection', ASSET_BACKDROP, 'pixel art, pixelated, low resolution', ...(own ? [own.avoid] : []));
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
  const [width, height] = (own && own.size) || kind.size;
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

// Which names of a kind are drawn by words of their own, so that a name outside the list is not a surprise.
function assetRecipeNote(kind) {
  const list = kind.id === 'weapon' ? WEAPON_RECIPES : kind.id === 'item' ? ITEM_RECIPES : null;
  return list ? `<p class="gen-note">Words of their own for: ${esc(list.map(r => r.name).join(', '))}. Any other name is drawn by the general words for a ${esc(kind.id)} - the Prompt below shows which.</p>` : '';
}

function renderAssets() {
  const s = assetState, kind = assetKind(s.kind);
  el('assetChoices').innerHTML =
    `<section class="gen-group">${assetChips('kind', 'What', ASSET_KINDS, s.kind)}` +
    `<div class="gen-row"><label class="gen-extra" for="assetThing">${kind.character ? 'Describe the look, in English - hair, clothes and their colours: it is what keeps the directions alike' : 'Name it, in English'} ` +
    `<input type="text" id="assetThing" maxlength="${kind.character ? ASSET_LOOK_MAX : 40}" autocomplete="off" spellcheck="false" value="${esc(s.thing)}" placeholder="e.g. ${esc(kind.things[0])}"></label>` +
    `<div class="chips" id="assetThings" role="group" aria-label="Ideas">` +
    kind.things.map(t => `<button type="button" class="chip" data-thing="${esc(t)}" aria-pressed="${s.thing.trim().toLowerCase() === t}">${esc(t)}</button>`).join('') + '</div></div>' +
    assetRecipeNote(kind) +
    (kind.views ? assetChips('view', 'View', ASSET_VIEWS, s.view, () => '') : '') +
    (kind.character ? assetChips('dirs', 'Turned to', CHAR_CHOICES, s.dirs) +
      (s.dirs === '1'
        ? '<p class="gen-note">One side view, drawn freely from the words - no 3D figure, so the pose and build are the model\'s own. Make several and keep the one you like.</p>'
        : '<p class="gen-note">Drawn from the figure and pose set in Forms (3D forms): the figure is turned round and each turn drawn with the same words and seed. Name every garment and its colour, trousers and boots too: what the look leaves out the model invents again in each direction. Whether the faces match is for you to judge.</p>') : '') + '</section>' +
    `<section class="gen-group">${assetChips('theme', 'Theme', ASSET_THEMES, s.theme, () => '')}` +
    (kind.tile || kind.character ? '' : assetChips('material', 'Material', ASSET_MATERIALS, s.material, () => '')) +
    assetChips('simple', 'How simple', ASSET_SIMPLE, s.simple) +
    (kind.tile && s.pix === 'off' ? assetChips('size', 'Tile size, px', TILE_SIZES, s.size) : '') + '</section>' +
    `<section class="gen-group" id="assetPixel">${assetPixelHtml(kind)}</section>`;
  el('assetIconRow').classList.toggle('hidden', !kind.icon);
  // The directions are the count of a character - except the one-sided kind, drawn free: there the
  // count is how many candidates to choose from.
  el('assetCountRow').classList.toggle('hidden', !!kind.character && s.dirs !== '1');
  el('assetIcon').checked = !!s.icon;
  el('assetCount').value = s.count;
  el('assetDraft').value = s.draft;
  renderAssetPrompt();
}

/* The pixel look's choices. The colours, outline and palette only when it is on; a tile has no
   outline; the game's palette is shown as swatches, with a way to start it again. */
function assetPixelHtml(kind) {
  const s = assetState, on = s.pix !== 'off';
  let h = assetChips('pix', 'Pixel look - grid', PIX_GRIDS, s.pix);
  if (!on) return h;
  h += assetChips('pixColours', 'Colours', PIX_COLOURS, s.pixColours) +
    (kind.tile ? '' : assetChips('pixOutline', 'Outline', PIX_OUTLINE, s.pixOutline)) +
    assetChips('pixShared', 'Palette', PIX_SHARED, s.pixShared);
  if (kind.tile) h += '<p class="gen-note">The grid is the size of the tile.</p>';
  if (s.pixShared === 'game') {
    const pal = s.pixPalette || [];
    h += pal.length
      ? `<div class="pix-palette" aria-label="The game's palette, ${pal.length} colours">${pal.map(c => `<span style="background:${c}" title="${c}"></span>`).join('')}` +
        `<button type="button" class="chip" data-pixforget title="Forget these colours - the next picture starts a new palette">Start again</button></div>`
      : '<p class="gen-note">The first picture you make starts the palette; each after it keeps those colours and adds only the ones it lacks, up to the number chosen.</p>';
  }
  return h;
}
function renderAssetPixel() { const host = el('assetPixel'); if (host) host.innerHTML = assetPixelHtml(assetKind(assetState.kind)); }

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
  const doc = made.doc, status = el(ASSET_UI.status), size = s.pix === 'off' ? Number(assetPick(TILE_SIZES, s.size).id) : Number(s.pix);
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
  const seam = tileSeam(fixed), canvas = s.pix === 'off' ? tileShrink(fixed, size) : assetPixel(fixed, s, { outline: false, split: PIX_SPLIT_TILE });
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const f = await storeFile(blob);
  if (storeMode === 'server') await storeSortFile(f.id, 'assets');
  const tags = [...(doc.tags || []).filter(t => t !== 'seamless' && !/^\d+x\d+$/.test(t)), seam < TILE_SEAM_BAD ? 'seamless' : 'seam visible', `${size}x${size}`, ...(s.pix === 'off' ? [] : ['pixel'])].slice(0, 24);
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
  // The thing is the picture's first tag (assetRequest).
  const own = assetRecipe(kind.id, (doc.tags || [])[0] || '');
  const cut = cutOut(pic, own && own.holes ? { holes: true } : {});
  if (!cut.found) {
    await storePutItem('uploads', uploadKey(doc.file), { ...doc, tags: [...(doc.tags || []), 'not cut out'].slice(0, 24) });
    return;
  }
  let canvas = cut.canvas;
  const notes = ['cut out'];
  if (kind.id !== 'prop') {
    // The white edge the model draws round a thing (a sticker's border) shows as a bright outline on a dark slot.
    // Not drawn on a key colour: the model paints the thing itself in it (a shield half magenta, cut away with the
    // background), which a white blade on cream never costs.
    canvas = assetTrim(assetDefringe(canvas)) || canvas;
    const solo = assetSolo(canvas);
    if (solo) { canvas = solo.canvas; if (solo.pieces > 1) notes.push('one of ' + solo.pieces); }
  }
  if (kind.id === 'weapon') {
    const o = assetOrient(canvas);
    if (o) { canvas = o.canvas; if (o.turned) notes.push('upright'); }
  }
  const flat = canvas;
  canvas = assetPixel(canvas, s);
  if (s.pix !== 'off') notes.push('pixel');
  const main = await keep(canvas, notes, { width: canvas.width, height: canvas.height });
  await forgetUpload(doc);
  if (kind.icon && s.icon) {
    // Pixelled from the smooth icon, not from the sprite: the frame is drawn at 128 and shares the palette.
    const icon = assetPixel(assetIcon(flat, { size: 128, diagonal: kind.id === 'weapon' }), s, { outline: false });
    await keep(icon, ['icon', `${icon.width}x${icon.height}`, ...(s.pix === 'off' ? [] : ['pixel'])],
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
    const sprite = assetPixel(lined.canvases[i], s);
    await assetKeep(cuts[i].doc, sprite, ['cut out', 'aligned', `${sprite.width}x${sprite.height}`, ...(s.pix === 'off' ? [] : ['pixel'])]);
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
      const canvas = assetPixel(assetFigureCanvas(cut), s);
      await assetKeep(made.doc, canvas, ['cut out', ...(s.pix === 'off' ? [] : ['pixel'])]);
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
      } else {
        const img = li.querySelector('img');
        img.src = url;
        // A sprite of a few dozen pixels is enlarged without smoothing, or it is a blur.
        img.classList.toggle('pixel', (u.tags || []).includes('pixel'));
      }
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
    if (e.target.closest('[data-pixforget]')) { assetState.pixPalette = []; assetsSave(); renderAssetPixel(); return; }
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
      // The pixel look has more to choose once it is on, and a tile has its size from the grid.
      if (b.dataset.as.startsWith('pix')) { assetsSave(); renderAssets(); return; }
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
