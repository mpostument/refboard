/* refboard - Generate references: pictures made to order by a ComfyUI the
   server knows about (COMFY_URL; see Services/ComfyClient.cs) - who, the
   hair, how much of them, from where - or a landscape, buildings, nature,
   an animal - the light, the medium. Only behind a
   server that has one: the rail button stays hidden otherwise.

   Each picture is kept like a dropped one - in Uploads, in its own Generated
   folder, tagged with the choices in plain words ("three-quarter",
   "backlit", "watercolour") - so the library's search finds it later.

   The prompt is Danbooru tags, which the anime models learnt from:
   genPrompt() turns the choices into them. The server adds the model's
   quality tags and what never to make.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

const GEN_KEY = 'refboard.generate.v1';

// Each choice: its label, the words it files the picture under, its tags for
// the model, and what it keeps out (avoid - the negative prompt); 'any'
// leaves it to the model. A row with `for` is shown, and used, only for
// those subjects; one with `when`, only when the other choices say so.
const ANY = { id: 'any', label: 'Any', tags: '' };
const PERSON = ['character'], OUTDOORS = ['landscape', 'building'];
// The media drawn in grey, which a palette has nothing to say to.
const GEN_GREY = ['ink', 'sketch'];
// Detail's Beginner, whatever the subject.
const BEGIN = '(minimalist:1.4), (simple drawing:1.3), flat color, simple coloring, thick outlines';
// A figure takes less: at 1.4, with flat colour and thick outlines, the
// medium went (a vector drawing, whatever was picked) and the legs went to
// sticks. What makes a figure hard is the clothes as much as the hair - left
// alone the model dressed her in a gown with a train - so, with no Setting
// to dress her, a t-shirt and trousers.
const BEGIN_FIGURE = '(minimalist:1.2), simple drawing, simple coloring, clean lineart, straight hair';

const BEGIN_AVOID = '(detailed:1.3), intricate details, complex background, gradient, shiny skin, shiny hair';
// Clothes that differ for a girl and a boy: a ball gown or a prince's cape.
const wear = (girl, boy) => ch => ch.who === 'boy' ? boy : girl;
// Close-fitting clothes are for seeing the figure's shape, as in a life
// class - never revealing ones.
const MODEST = 'cleavage, underwear, lingerie, see-through, bikini, highleg, midriff';
const GEN_CHOICES = [
  // One style for now - the models behind this are anime models. A second
  // one is a row here, and its tags.
  { id: 'style', label: 'Style', options: [
    { id: 'anime', label: 'Anime', tags: '', words: 'anime' },
  ] },
  // Anything but a character says "no humans": an anime model draws a girl
  // into a landscape unless told not to - most of what it learnt from has one.
  { id: 'subject', label: 'Subject', options: [
    { id: 'character', label: 'Character', tags: '', words: '' },
    { id: 'landscape', label: 'Landscape', tags: 'no humans, scenery, landscape' },
    { id: 'building', label: 'Buildings', tags: 'no humans, scenery, building, architecture', words: 'buildings' },
    { id: 'nature', label: 'Nature', tags: 'no humans, nature, still life, close-up' },
    { id: 'animal', label: 'Animal', tags: 'no humans, animal focus, solo' },
  ] },

  { id: 'who', label: 'Who', for: PERSON, options: [
    { id: 'girl', label: 'Girl', tags: '1girl, solo' },
    { id: 'boy', label: 'Boy', tags: '1boy, solo' },
    // A named character's own sex: "1girl" on Gojo Satoru drew a woman, so
    // naming her hands it to the name (the Character field switches to this).
    { id: 'her', label: 'Hers', tags: 'solo', words: '', when: ch => !!genCharacterTags(ch.character),
      hint: 'Her own sex and look - nothing says girl or boy, the character does' },
  ] },
  { id: 'hair', label: 'Hair', for: PERSON, options: [
    ANY,
    { id: 'short', label: 'Short', tags: 'short hair' },
    { id: 'bob', label: 'Bob', tags: 'short hair, bob cut' },
    { id: 'long', label: 'Long', tags: 'long hair' },
    { id: 'ponytail', label: 'Ponytail', tags: 'ponytail' },
    { id: 'twintails', label: 'Twin tails', tags: 'twintails' },
  ] },
  { id: 'colour', label: 'Hair colour', for: PERSON, options: [
    ANY,
    ...['black', 'brown', 'blonde', 'red', 'orange', 'pink', 'purple', 'silver', 'white', 'blue', 'green']
      .map(c => ({ id: c, label: c[0].toUpperCase() + c.slice(1), tags: c + ' hair', words: c + ' hair' })),
  ] },
  { id: 'eyes', label: 'Eyes', for: PERSON, options: [
    ANY,
    ...['blue', 'green', 'brown', 'red', 'purple', 'yellow', 'pink', 'aqua', 'grey', 'black']
      .map(c => ({ id: c, label: c[0].toUpperCase() + c.slice(1), tags: c + ' eyes', words: c + ' eyes' })),
  ] },
  // The eye's style as anime draws it (ANIME_EYES in js/vision.js): tsurime,
  // the outer corner up; tareme, down. Not "sparkling eyes" for shojo: to the
  // model that is star shapes in the iris - a gimmick, not an eye to learn.
  { id: 'eyeShape', label: 'Eye shape', for: PERSON, options: [
    ANY,
    { id: 'shojo', label: 'Shōjo', tags: 'large eyes, long eyelashes, eyelashes', avoid: 'sparkling eyes, star-shaped pupils', words: 'shojo eyes' },
    { id: 'sharp', label: 'Sharp', tags: 'tsurime, narrowed eyes', words: 'sharp eyes' },
    { id: 'soft', label: 'Soft', tags: 'tareme, round eyes', words: 'soft eyes' },
  ] },
  // The four the 3D head's Expression has (ANIME_EXPRESSIONS in js/vision.js),
  // with anime's signs for them. Not on an expression sheet, which has them all.
  { id: 'expression', label: 'Expression', for: PERSON, when: ch => ch.framing !== 'expressions', options: [
    ANY,
    { id: 'joy', label: 'Joy', tags: 'happy, smile, open mouth, blush', words: 'joy' },
    { id: 'anger', label: 'Anger', tags: 'angry, v-shaped eyebrows, open mouth, teeth, anger vein', words: 'anger' },
    { id: 'surprise', label: 'Surprise', tags: 'surprised, wide-eyed, open mouth, :o', words: 'surprise' },
    { id: 'sadness', label: 'Sadness', tags: 'sad, frown, tears, tearing up', words: 'sadness' },
  ] },
  // What she wears, as her Setting would have it: festive is a wreath and
  // embroidery in a Slavic one, a furisode in an East Asian one. Any choice
  // but the first stands in for the Setting's own clothes (`owns`) - a
  // kimono under armour made neither. The last four show the figure's shape,
  // to study it as in a life class: close-fitting, never revealing.
  { id: 'clothes', label: 'Clothes', for: PERSON, options: [
    { id: 'setting', label: "Setting's", words: '', hint: "What the Setting dresses her in; with Any, what the model picks" },
    { id: 'casual', label: 'Everyday', words: 'everyday clothes', owns: 'setting', tags: {
      _: 'casual, shirt, pants, shoes',
      modern: 'casual, hoodie, jeans, sneakers',
      slavic: 'simple clothes, white tunic, linen, sash, braid',
      east: 'yukata, sandals',
      west: wear('peasant, blouse, long skirt, apron', 'peasant, tunic, pants, boots'),
      nordic: wear('apron dress, tunic, brooch, belt', 'tunic, belt, pants, boots'),
      mideast: 'arabian clothes, loose clothes, shawl, sandals',
      southasia: 'kurta, indian clothes, sandals',
      fantasy: 'fantasy, tunic, cloak, boots, satchel',
      scifi: 'science fiction, jacket, cargo pants, headphones',
      steampunk: 'steampunk, vest, white shirt, goggles on head, boots',
      postapoc: 'survivor, dirty clothes, torn clothes, hooded jacket, scarf, backpack' } },
    { id: 'festive', label: 'Festive', words: 'festive clothes', owns: 'setting', tags: {
      _: wear('formal, long dress, long sleeves', 'formal, suit, necktie'),
      slavic: wear('embroidered dress, white dress, red embroidery, (flower wreath:1.2), ribbon, necklace, ancient',
        'embroidered shirt, red embroidery, sash, belt, ancient'),
      east: wear('furisode, kimono, obi, hair flower', 'formal kimono, hakama, haori'),
      west: wear('royal, ball gown, gold trim, tiara', 'prince, royal, cape, gold trim'),
      nordic: 'fur cloak, brooch, gold jewelry, circlet, embroidered',
      mideast: 'arabian clothes, gold jewelry, veil, silk, embroidered',
      southasia: wear('sari, gold jewelry, bangle, bindi, embroidered', 'sherwani, turban, embroidered'),
      fantasy: wear('fantasy, elegant dress, circlet, cape', 'fantasy, noble, cape, gold trim'),
      scifi: 'science fiction, sleek, formal, high collar, glowing',
      steampunk: wear('steampunk, victorian, corset, bustle, top hat', 'steampunk, victorian, tailcoat, top hat, monocle'),
      postapoc: 'survivor, patchwork clothes, feathers, beads, cape' },
      avoid: 'cleavage' },
    { id: 'uniform', label: 'Uniform', words: 'uniform', owns: 'setting',
      hint: "The dress of a calling - a school uniform, a mage's robe, a pilot's suit", tags: {
      _: wear('school uniform, blazer, pleated skirt', 'school uniform, blazer, necktie'),
      east: wear('serafuku, pleated skirt', 'gakuran'),
      // A priest before Christianity: the volkhv's white robe, the völva's staff.
      slavic: 'white robe, long sleeves, belt, staff, head wreath, ancient',
      nordic: 'robe, staff, fur trim, runes',
      west: wear('maid, apron, long dress', 'butler, tailcoat'),
      fantasy: 'fantasy, mage, robe, cloak, staff',
      scifi: 'science fiction, pilot suit, military uniform, jacket',
      steampunk: 'steampunk, aviator cap, goggles, leather jacket, military uniform',
      postapoc: 'survivor, military jacket, cargo pants, gas mask around neck' } },
    { id: 'armour', label: 'Armour', words: 'armour', owns: 'setting', tags: {
      _: 'armor, breastplate, gauntlets',
      slavic: 'chainmail, round shield, spear, ancient',
      east: 'japanese armor, samurai',
      west: 'knight, plate armor, cape',
      nordic: 'viking, chainmail, round shield, fur cloak',
      mideast: 'arabian clothes, chainmail, scimitar, shawl',
      southasia: 'armor, indian clothes, gold trim',
      fantasy: 'fantasy, armor, cape, sword',
      scifi: 'power armor, science fiction',
      modern: 'tactical clothes, bulletproof vest, helmet',
      steampunk: 'steampunk, armor, brass, gears',
      postapoc: 'survivor, makeshift armor, shoulder pads, gas mask' },
      avoid: 'bikini armor, cleavage' },
    { id: 'winter', label: 'Winter', words: 'winter clothes', owns: 'setting', tags: {
      _: 'winter clothes, coat, scarf, gloves',
      modern: 'winter coat, scarf, beanie, gloves',
      slavic: 'fur coat, fur hat, sheepskin, mittens, ancient',
      east: 'winter clothes, kimono, haori, scarf',
      west: 'cloak, fur-trimmed cloak, hood',
      nordic: 'fur cloak, fur hat, fur boots, winter clothes',
      mideast: 'cloak, shawl, hood, layered clothes',
      southasia: 'shawl, long sleeves, indian clothes',
      fantasy: 'fantasy, fur-trimmed cloak, hood',
      scifi: 'science fiction, parka, glowing',
      steampunk: 'steampunk, greatcoat, goggles, scarf',
      postapoc: 'survivor, tattered coat, hood, scarf, gloves' } },
    { id: 'sport', label: 'Sportswear', group: 'Figure study', words: 'sportswear', owns: 'setting',
      tags: 'sportswear, track jacket, shorts, sneakers', avoid: MODEST },
    { id: 'tight', label: 'Close-fitting', words: 'close-fitting', owns: 'setting', hint: 'A bodysuit or leggings - the shape of the figure',
      tags: 'bodysuit, long sleeves, leggings, plain clothes', avoid: MODEST },
    { id: 'swimsuit', label: 'Swimsuit', words: 'swimsuit', owns: 'setting', hint: 'A one-piece swimsuit',
      tags: wear('one-piece swimsuit, sporty', 'swim trunks, rash guard'), avoid: MODEST },
    { id: 'leotard', label: 'Leotard', words: 'leotard', owns: 'setting', hint: "A dancer's or a gymnast's",
      tags: wear('leotard, long sleeves, tights, ballet', 'leotard, gymnastics, tights'), avoid: MODEST },
  ] },
  { id: 'framing', label: 'How much', for: PERSON, options: [
    { id: 'head', label: 'Head', tags: 'portrait, close-up', words: 'head' },
    { id: 'bust', label: 'Bust', tags: 'upper body', words: 'bust' },
    { id: 'half', label: 'Half figure', tags: 'cowboy shot', words: 'half figure' },
    { id: 'full', label: 'Whole figure', tags: 'full body', words: 'whole figure' },
    // The model sheet an animator draws from: one character, turned round.
    { id: 'sheet', label: 'Turnaround', tags: 'reference sheet, multiple views, turnaround, full body, standing', words: 'turnaround' },
    // Its other half: the one head, again and again, in its expressions.
    // Named one by one: "expressions" alone drew the same calm face ten times,
    // each over a caption in made-up script.
    { id: 'expressions', label: 'Expression sheet', words: 'expression sheet',
      tags: 'expression chart, multiple views, reference sheet, portrait, smile, angry, surprised, sad, crying, blush',
      avoid: 'text, speech bubble, english text, japanese text' },
  ] },
  { id: 'view', label: 'From', for: PERSON, options: [
    { id: 'front', label: 'Front', tags: 'straight-on, looking at viewer', words: 'front' },
    { id: 'three', label: 'Three-quarter', tags: 'three quarter view', words: 'three-quarter' },
    { id: 'profile', label: 'Profile', tags: 'profile, from side', words: 'profile' },
    { id: 'below', label: 'Below', tags: 'from below', words: 'from below' },
    { id: 'above', label: 'Above', tags: 'from above', words: 'from above' },
    { id: 'back', label: 'Behind', tags: 'from behind, looking back', words: 'from behind' },
  ] },
  // The anime shots the 3D view's camera sets (ANIME_SHOTS) that have a tag
  // of their own - the worm's and bird's eye are From's Below and Above.
  { id: 'lens', label: 'Lens', for: PERSON, options: [
    ANY,
    { id: 'wide', label: 'Wide, close', tags: 'foreshortening, perspective', words: 'wide and close', hint: 'What is nearest comes out huge - a hand or a foot thrust at you' },
    { id: 'dutch', label: 'Dutch angle', tags: 'dutch angle', words: 'dutch angle', hint: 'The picture tilted' },
    { id: 'fisheye', label: 'Fisheye', tags: 'fisheye', words: 'fisheye', hint: 'Straight lines bent round the middle' },
  ] },
  { id: 'pose', label: 'Pose', for: PERSON, options: [
    ANY,
    { id: 'standing', label: 'Standing', tags: 'standing' },
    { id: 'sitting', label: 'Sitting', tags: 'sitting' },
    { id: 'walking', label: 'Walking', tags: 'walking' },
    { id: 'arms', label: 'Arms up', tags: 'arms up', words: 'arms raised' },
    { id: 'lying', label: 'Lying', tags: 'lying', words: 'lying' },
  ] },

  { id: 'place', label: 'Where', for: ['landscape'], options: [
    { id: 'mountains', label: 'Mountains', tags: 'mountain, valley' },
    { id: 'sea', label: 'Sea', tags: 'ocean, beach, horizon' },
    { id: 'lake', label: 'Lake', tags: 'lake, reflection' },
    { id: 'fields', label: 'Fields', tags: 'field, grass, rural, path' },
    { id: 'forest', label: 'Forest', tags: 'forest, tree, path' },
    { id: 'river', label: 'River', tags: 'river, rock, tree' },
    { id: 'sky', label: 'Sky', tags: 'sky, cloud, horizon, wide shot' },
  ] },
  { id: 'building', label: 'What', for: ['building'], options: [
    { id: 'street', label: 'Street', tags: 'street, city, road, building' },
    { id: 'town', label: 'Old town', tags: 'town, old building, stone floor' },
    { id: 'house', label: 'House', tags: 'house, garden, fence' },
    // A temple is a different building in each Setting: to the model
    // "shrine" alone is a Japanese one, torii and all, whatever was chosen.
    // Its tags stand in for the Setting's (`owns`) - a Slavic street's log
    // houses drew a hut, not the idols.
    { id: 'shrine', label: 'Temple', words: 'temple', owns: 'setting',
      hint: 'Its own in each Setting - a pagan grove, a cathedral, a mosque...',
      tags: {
        _: 'temple, stairs, pillar',
        east: 'shrine, torii, stairs',
        // Before Christianity (see Setting): the idols in an oak grove.
        slavic: '(pagan shrine:1.3), (wooden idol:1.4), (wooden statue:1.2), sacred grove, oak tree, stone circle, wooden palisade, ancient',
        west: 'cathedral, church, gothic architecture, spire, stained glass',
        nordic: 'stave church, wooden church, runestone, dragon carving',
        mideast: 'mosque, minaret, dome, arch, courtyard',
        southasia: '(hindu temple:1.4), gopuram, stone carving, tiered tower, stairs, indian architecture',
        fantasy: 'temple, ruins, pillar, magic circle',
        scifi: 'futuristic temple, monolith, pillar, glowing',
        modern: 'church, modern architecture, concrete, glass, plaza',
        steampunk: 'steampunk, cathedral, clock tower, gears, brass, stained glass',
        postapoc: 'post-apocalypse, ruined church, overgrown, broken stained glass, rubble',
      },
      avoid: { east: '', any: '', slavic: 'torii, japanese architecture, pagoda, church, cross, onion dome, house, hut, thatched roof',
        southasia: 'torii, japanese architecture, pagoda, dome, onion dome, palace',
        _: 'torii, japanese architecture, pagoda' } },
    { id: 'castle', label: 'Castle', tags: 'castle, tower' },
    { id: 'cafe', label: 'Cafe inside', tags: 'cafe, indoors, table, window', words: 'interior' },
    { id: 'station', label: 'Station', tags: 'train station, railroad tracks' },
  ] },
  { id: 'seen', label: 'Seen from', for: ['building'], options: [
    { id: 'street', label: 'The street', tags: 'eye level', words: 'eye level' },
    { id: 'above', label: 'Above', tags: 'from above, cityscape', words: 'from above' },
    { id: 'below', label: 'Below', tags: 'from below', words: 'from below' },
  ] },
  { id: 'thing', label: 'What', for: ['nature'], options: [
    { id: 'flowers', label: 'Flowers', tags: 'flower, petals' },
    { id: 'tree', label: 'A tree', tags: 'tree, branch, leaf', words: 'tree' },
    { id: 'leaves', label: 'Leaves', tags: 'leaf, branch' },
    { id: 'mushrooms', label: 'Mushrooms', tags: 'mushroom, moss' },
    { id: 'fruit', label: 'Fruit', tags: 'fruit, food focus' },
    { id: 'water', label: 'Water and stones', tags: 'water, stone, stream', words: 'water' },
  ] },
  { id: 'animal', label: 'Animal', for: ['animal'], options: [
    ...['cat', 'dog', 'fox', 'rabbit', 'bird', 'horse', 'deer', 'owl']
      .map(a => ({ id: a, label: a[0].toUpperCase() + a.slice(1), tags: a })),
    { id: 'koi', label: 'Koi', tags: 'koi, fish, water' },
  ] },
  { id: 'size', label: 'How much', for: ['animal'], options: [
    { id: 'close', label: 'Head', tags: 'portrait, close-up', words: 'head' },
    { id: 'whole', label: 'Whole', tags: 'full body', words: 'whole' },
  ] },

  // Where and when in the world it is: what a character wears, how the
  // buildings are built, what grows in the land. Tags per subject - a
  // Slavic character is her embroidered shirt and wreath, a Slavic street
  // its wooden houses. Nature and animals are much the same anywhere.
  { id: 'setting', label: 'Setting', for: ['character', 'landscape', 'building'], options: [
    ANY,
    // A character named under Character, as she is drawn: nothing is added to
    // her clothes, and Detail is left out (owns): Simple and Beginner's
    // "minimalist, simple drawing" drew her bare-shouldered - the clothes
    // nothing here names went with the detail (2026-10-15). Only a character
    // has an own outfit, so only she is offered it.
    { id: 'original', label: 'Original', words: 'original outfit', owns: 'detail', when: ch => ch.subject === 'character',
      hint: "The character's own clothes and world - nothing is added, and Detail is ignored. Name her under Character." },
    { id: 'modern', label: 'Modern', words: 'modern', tags: {
      character: 'casual, hoodie, jeans, sneakers, contemporary',
      landscape: 'suburb, park, road, power lines, contemporary',
      building: 'modern, city, street, glass, storefront, contemporary' } },
    // Before Christianity: the gord behind its palisade, log houses, the
    // wooden idols of a shrine in an oak grove - no churches, no onion
    // domes, and no sunflowers (they came from America in the 1700s).
    { id: 'slavic', label: 'Slavic', group: 'The world', words: 'slavic', tags: {
      character: 'embroidered linen tunic, white tunic, flower wreath, head wreath, braid, amber necklace, sash, ancient',
      landscape: 'birch, oak tree, primeval forest, river, wooden idol, log house, thatched roof, mist',
      building: 'log house, thatched roof, wooden palisade, wooden fortress, wooden idol, pagan shrine, ancient village' } },
    { id: 'east', label: 'East Asian', words: 'east asian', tags: {
      character: 'kimono, japanese clothes, hair ornament, hair stick',
      landscape: 'bamboo forest, rice paddy, pagoda, east asian architecture',
      building: 'east asian architecture, pagoda, tiled roof, paper lantern, wooden building' } },
    { id: 'west', label: 'Western Europe', words: 'european', tags: {
      character: 'european clothes, long dress, corset, cape, medieval',
      landscape: 'european countryside, rolling hills, stone wall, windmill',
      building: 'european architecture, half-timbered house, cobblestone, gothic architecture' } },
    { id: 'nordic', label: 'Nordic', words: 'nordic', tags: {
      character: 'viking, fur trim, fur cloak, braid, celtic knot',
      landscape: 'fjord, pine forest, snowy mountain, rocky shore',
      building: 'viking, longhouse, wooden building, stave church, fjord' } },
    { id: 'mideast', label: 'Middle East', words: 'middle eastern', tags: {
      character: 'arabian clothes, veil, gold jewelry, long dress, shawl',
      landscape: 'desert, oasis, sand dune, palm tree',
      building: 'arabian architecture, mosque, dome, bazaar, arch' } },
    { id: 'southasia', label: 'South Asian', words: 'south asian', tags: {
      character: 'sari, indian clothes, bindi, bangle',
      landscape: 'jungle, river, palm tree, temple ruins',
      building: 'indian architecture, hindu temple, palace, arch' } },
    { id: 'fantasy', label: 'Fantasy', group: 'Genre', words: 'fantasy', tags: {
      character: 'fantasy, adventurer, cloak, leather armor, satchel',
      landscape: 'fantasy, floating island, crystal, waterfall, magic',
      building: 'fantasy, castle, tower, magic, bridge' } },
    { id: 'scifi', label: 'Sci-fi', words: 'sci-fi', tags: {
      character: 'science fiction, cyberpunk, bodysuit, jacket, headphones',
      landscape: 'science fiction, alien planet, futuristic, ringed planet',
      building: 'science fiction, cyberpunk, futuristic city, neon lights, skyscraper' } },
    { id: 'steampunk', label: 'Steampunk', words: 'steampunk', tags: {
      character: 'steampunk, victorian, goggles on head, brass, gears, corset, gloves',
      landscape: 'steampunk, airship, smokestack, gears, industrial, smoke',
      building: 'steampunk, victorian architecture, clock tower, gears, brass, airship, smoke' } },
    { id: 'postapoc', label: 'Post-apocalyptic', words: 'post-apocalyptic', tags: {
      character: 'survivor, dirty clothes, torn clothes, hooded jacket, scarf, backpack, bandages',
      landscape: 'post-apocalypse, ruins, overgrown, abandoned, rubble, wasteland',
      building: 'post-apocalypse, ruins, abandoned building, overgrown, broken window, rubble' } },
  ] },

  // When, apart from where: Setting says the place (a Slavic character is her embroidered tunic), Era the
  // time, so "Kyivan Rus" and "Victorian" can be asked of any place. Added after Setting's tags, not swapped
  // for them. Hidden while Setting is Original, which adds nothing to a named character - an Era would be
  // the one thing that did. Kyivan Rus is Christian (988) but is before the onion dome (the 1500s): a
  // church there is a cube with a helmet dome, so the onion dome and the sunflower (America, 1700s) are kept out.
  { id: 'era', label: 'Era', for: ['character', 'landscape', 'building'], when: ch => ch.setting !== 'original', options: [
    ANY,
    { id: 'ancient', label: 'Ancient', words: 'ancient', tags: {
      character: 'ancient, tunic, sandals, bronze jewelry, linen, leather belt',
      landscape: 'ancient, primeval, unspoiled, dirt path, standing stones',
      building: 'ancient, stone building, columns, ruins, temple' } },
    { id: 'medieval', label: 'Medieval', words: 'medieval', tags: {
      character: wear('medieval, long dress, belt, hooded cloak, leather boots', 'medieval, tunic, belt, hooded cloak, leather boots'),
      landscape: 'medieval, dirt road, farmland, castle in the distance, wooden fence',
      building: 'medieval, stone castle, half-timbered house, cobblestone, thatched roof' } },
    { id: 'kyivanrus', label: 'Kyivan Rus', words: 'kyivan rus', avoid: 'onion dome, sunflower, modern, gothic architecture, spire', tags: {
      character: wear('medieval, long tunic, embroidered hem, fur-trimmed cloak, head veil, temple rings, belt', 'medieval, long tunic, embroidered hem, fur-trimmed cloak, fur hat, sash, boots'),
      landscape: 'medieval, steppe, wide river, oak forest, wooden fortress on a hill',
      building: 'medieval, wooden fortress, palisade, log house, small stone church, helmet dome, thatched roof' } },
    { id: 'victorian', label: 'Victorian', words: 'victorian', tags: {
      character: wear('victorian, long dress, bustle, bonnet, lace gloves, lace collar', 'victorian, tailcoat, waistcoat, top hat, cravat, pocket watch'),
      landscape: 'victorian, gas lamp, cobblestone street, fog, 19th century',
      building: 'victorian architecture, red brick, chimney, gas lamp, row houses, cobblestone' } },
  ] },

  { id: 'time', label: 'Time of day', for: OUTDOORS, options: [
    ANY,
    { id: 'day', label: 'Day', tags: 'day, blue sky' },
    { id: 'dawn', label: 'Morning', tags: 'morning, dawn' },
    { id: 'sunset', label: 'Sunset', tags: 'sunset, orange sky, evening' },
    { id: 'night', label: 'Night', tags: 'night, night sky, starry sky' },
  ] },
  { id: 'weather', label: 'Weather', for: OUTDOORS, options: [
    ANY,
    { id: 'clear', label: 'Clear', tags: 'clear sky' },
    { id: 'cloudy', label: 'Cloudy', tags: 'cloudy sky, overcast' },
    { id: 'rain', label: 'Rain', tags: 'rain, wet' },
    { id: 'snow', label: 'Snow', tags: 'snow, snowing' },
    { id: 'fog', label: 'Fog', tags: 'fog, mist' },
  ] },
  { id: 'season', label: 'Season', for: ['landscape', 'nature'], options: [
    ANY,
    { id: 'spring', label: 'Spring', tags: 'spring (season), cherry blossoms' },
    { id: 'summer', label: 'Summer', tags: 'summer' },
    { id: 'autumn', label: 'Autumn', tags: 'autumn, autumn leaves' },
    { id: 'winter', label: 'Winter', tags: 'winter, snow' },
  ] },

  { id: 'light', label: 'Light', options: [
    ANY,
    { id: 'soft', label: 'Soft', tags: 'soft lighting', words: 'soft light' },
    { id: 'side', label: 'From the side', tags: 'sidelighting', words: 'side light' },
    { id: 'back', label: 'Backlit', tags: 'backlighting, rim lighting', words: 'backlit' },
    { id: 'dramatic', label: 'Dramatic', tags: 'dramatic lighting, chiaroscuro', words: 'low key' },
  ] },
  // Ink is lines and hatching - "greyscale" alone had it fill the shadows
  // solid black, like oil paint - and pencil is hatched graphite: both are
  // the marks a beginner copies stroke by stroke.
  // No "pen (medium)" or "graphite (medium)": the model drew the pen into
  // the picture, and a pencil beside it - hence the tools in what to avoid.
  { id: 'medium', label: 'Medium', options: [
    { id: 'watercolour', label: 'Watercolour', tags: 'watercolor (medium), traditional media, lineart', words: 'watercolour' },
    { id: 'ink', label: 'Ink and hatching', words: 'ink',
      tags: 'monochrome, greyscale, lineart, (hatching (texture):1.3), (cross-hatching:1.2), ink (medium), traditional media',
      // Red, sepia: without them the lines came out reddish on warm paper.
      avoid: 'color, gradient, screentone, solid black, black fill, grey wash, greyscale shading, (color:1.2), red, sepia, brown, orange, pen, holding pen, art tools' },
    { id: 'flat', label: 'Flat colour', tags: 'flat color, cel shading', words: 'flat colour' },
    { id: 'sketch', label: 'Pencil and hatching', words: 'pencil',
      tags: 'monochrome, greyscale, sketch, (hatching (texture):1.2), traditional media',
      avoid: 'color, digital, sepia, pencil, holding pencil, art tools' },
    // Watercolour's two cousins: the alcohol marker's even strokes side by
    // side (Copic's, though the model knows only "marker (medium)"), the
    // pencil's grain with a wash over it. Not watercolour: no wet-on-wet.
    // No "visible strokes" or "vibrant colors": alcohol blends smooth, and with
    // those two the model drew red and blue streaks (2026-10-15).
    { id: 'copic', label: 'Copic markers', words: 'copic markers',
      tags: 'marker (medium), traditional media, lineart, colored',
      avoid: 'marker, holding marker, pen, art tools, digital, paint splatter, splashes, monochrome, greyscale, watercolor (medium), wet-on-wet, color bleeding' },
    { id: 'wpencil', label: 'Watercolour pencils', words: 'watercolour pencils',
      tags: 'watercolor pencil (medium), colored pencil (medium), watercolor (medium), traditional media, sketch, visible strokes',
      avoid: 'pencil, holding pencil, art tools, digital' },
  ] },
  // Watercolour's own question - are the colours run together wet, or laid
  // crisp on dry paper: a reference to practise the one or the other from.
  { id: 'edges', label: 'Edges', when: ch => ch.medium === 'watercolour', options: [
    ANY,
    { id: 'soft', label: 'Soft - wet-in-wet', tags: 'wet-on-wet, color bleeding, soft edges, blurry edges', words: 'soft edges' },
    { id: 'hard', label: 'Hard - on dry paper', tags: 'hard edges, sharp edges, layered glazing, flat wash', words: 'hard edges',
      avoid: 'blurry, color bleeding' },
  ] },
  // A palette from Palettes (js/palette.js), sent with its Use in Generate.
  // The model knows no hex, only the words it learnt from - so the palette
  // goes as those (genPaletteTags). Not for ink or pencil: they are grey.
  { id: 'colours', label: 'Colours', when: ch => !GEN_GREY.includes(ch.medium), options: [
    ANY,
    { id: 'palette', label: 'Your palette', words: 'palette', hint: 'The colours sent from Palettes, as words the model knows',
      tags: ch => genPaletteTags(ch.palette || []).join(', ') },
    // The tubes of the Holbein box (PIGMENTS in js/paint.js). Words cannot name 28
    // paints, so this is for Keep to the palette below; on its own it adds no tags.
    { id: 'box', label: 'Holbein box', words: 'holbein box', hint: 'The 28 tubes of the Holbein box - use Keep to the palette to make the picture of them', tags: '' },
  ] },
  // Words only nudge a model; this recolours the finished picture (js/genlock.js).
  { id: 'lock', label: 'Keep to the palette', when: ch => !GEN_GREY.includes(ch.medium) && (ch.colours === 'palette' || ch.colours === 'box'), options: [
    { id: 'off', label: 'Words only', words: '', hint: 'The model is told the colours and paints what it likes', tags: '' },
    { id: 'on', label: 'Recolour to it', words: 'palette locked', hint: 'Every colour in the picture becomes the nearest one of the palette; the shading stays', tags: '' },
  ] },
  // Simple, the default: a few big shapes to copy, not a finished
  // illustration to be daunted by. Beginner goes further, with weights
  // ("(tag:1.3)"): Simple still gave hair of a hundred strands, and a
  // street of a thousand windows. Tags per subject, as Setting's are.
  { id: 'detail', label: 'Detail', options: [
    { id: 'beginner', label: 'Beginner', words: 'beginner', hint: 'The fewest shapes - straight hair, plain clothes, clean lines; one building on white',
      tags: {
        character: ch => BEGIN_FIGURE + (ch.setting === 'any' && ch.clothes === 'setting' ? ', casual, t-shirt, pants' : ''),
        landscape: BEGIN + ', simple shapes, (few details:1.2)',
        building: BEGIN + ', simple shapes, (few buildings:1.3), simple background, white background',
        nature: BEGIN + ', simple shapes',
        animal: BEGIN + ', simple shapes' },
      avoid: {
        character: BEGIN_AVOID + ', hair strand, flyaway hair, messy hair, ahoge, hair ornament, ribbon, frills, lace, jewelry, pattern, train (clothing), skinny',
        landscape: BEGIN_AVOID + ', clutter, (detailed foliage:1.2)',
        building: BEGIN_AVOID + ', (many windows:1.2), crowd, ornament, sign, text, power lines, clutter, cityscape, skyscraper, car',
        nature: BEGIN_AVOID + ', clutter',
        animal: BEGIN_AVOID + ', detailed fur' } },
    { id: 'simple', label: 'Simple', tags: 'minimalist, simple drawing', words: 'simple', hint: 'A few big shapes, no fine detail',
      avoid: 'detailed, intricate details, complex background, gradient, shiny skin, shiny hair' },
    { id: 'normal', label: 'Normal', tags: '', words: '', hint: 'As the model draws it - a finished illustration' },
  ] },
  // A landscape or a street is its own background.
  { id: 'ground', label: 'Background', for: ['character', 'nature', 'animal'], options: [
    { id: 'plain', label: 'Plain', tags: 'simple background, white background', words: '' },
    { id: 'scene', label: 'A place', tags: 'outdoors, scenery', words: 'scene' },
  ] },
];

/* The rows in groups on the page - what it is, the character, the shot,
   the light and time, the picture - in two columns, so the whole panel
   and the Generate button fit on a screen. Only the page's order: the
   prompt keeps GEN_CHOICES' own, which puts "1girl, solo" first. */
const GEN_GROUPS = [
  ['what', 'What', ['style', 'subject', 'setting', 'era']],
  ['who', 'The character', ['who', 'hair', 'colour', 'eyes', 'eyeShape', 'expression', 'clothes']],
  ['shot', 'The shot', ['framing', 'view', 'lens', 'pose', 'place', 'building', 'seen', 'thing', 'animal', 'size']],
  ['light', 'Light and time', ['time', 'weather', 'season', 'light']],
  ['picture', 'The picture', ['medium', 'edges', 'colours', 'lock', 'detail', 'ground']],
];

const GEN_DEFAULTS = { style: 'anime', subject: 'character', character: '', setting: 'any', era: 'any', who: 'girl', hair: 'any', colour: 'any', eyes: 'any', eyeShape: 'any', expression: 'any', clothes: 'setting', framing: 'bust',
  view: 'front', lens: 'any', pose: 'any', place: 'mountains', building: 'street', seen: 'street', thing: 'flowers', animal: 'cat',
  size: 'whole', time: 'any', weather: 'any', season: 'any', light: 'any', medium: 'watercolour', edges: 'any', colours: 'any', lock: 'off', detail: 'simple',
  ground: 'plain' };

// Whether a row is asked, and used, with these choices.
const genApplies = (c, ch) => (!c.for || c.for.includes(ch.subject)) && (!c.when || c.when(ch));

/* A palette ([[r, g, b], ...]) as Danbooru tags - the only colour words
   the model learnt. Not one tag per colour: five colour names and the model
   spreads all five over hair, eyes and dress at random. What the palette
   is as a whole says more - its leading hue, how intense, how light.
   Tags the anime models know: "limited palette", "<hue> theme" (red, orange,
   yellow, green, aqua, blue, purple, pink, brown), "muted color",
   "pastel colors", "high contrast", "dark". rgbOklch() (train.js) gives
   [L 0..1, C 0..~0.37, h degrees]; hueName(h) a painter's hue word - but
   a painter's, not Danbooru's: its cyan, violet, magenta are aqua, purple,
   pink there. */
function genPaletteTags(rgbs) {
  if (!rgbs.length) return [];
  const cs = rgbs.map(rgbOklch), n = cs.length;
  const meanL = cs.reduce((s, c) => s + c[0], 0) / n, meanC = cs.reduce((s, c) => s + c[1], 0) / n;
  const spread = Math.max(...cs.map(c => c[0])) - Math.min(...cs.map(c => c[0]));
  const tags = ['limited palette'];
  // The leading hue: the one holding most of the palette's intensity - a
  // grey adds nothing, the accent adds most. It leads with clearly more
  // than half (60%: two opposites alike are never exactly even in sRGB);
  // none does in two opposites as strong, or a palette near grey.
  // Weighed by hue family, not by name: a peach, an orange and a dark
  // orange are one warm palette, though the dark one is "brown" by name.
  const fam = {};
  for (const [L, C, h] of cs) if (C >= 0.03) {
    const k = genHueTag(0.6, h), f = fam[k] ||= { w: 0, wl: 0 };
    f.w += C; f.wl += C * L;
  }
  const total = Object.values(fam).reduce((s, f) => s + f.w, 0);
  const [lead, f] = Object.entries(fam).sort((a, b) => b[1].w - a[1].w)[0] || [];
  // Named as the family is on the whole - dark orange or yellow, brown.
  if (lead && f.w >= 0.6 * total) tags.push((['orange', 'yellow'].includes(lead) && f.wl / f.w < 0.55 ? 'brown' : lead) + ' theme');
  // How intense, as a whole: light and soft is pastel, otherwise soft is muted.
  if (meanL > 0.75 && meanC < 0.12) tags.push('pastel colors');
  else if (meanC < 0.07) tags.push('muted color');
  // The values: mostly dark, or light against dark.
  if (meanL < 0.42) tags.push('dark');
  else if (spread > 0.55) tags.push('high contrast');
  return tags.slice(0, 4);
}
// An OKLCH hue as Danbooru names it: a dark orange or yellow is brown there.
function genHueTag(L, h) {
  if (h >= 40 && h < 110 && L < 0.55) return 'brown';
  return h < 40 || h >= 350 ? 'red' : h < 70 ? 'orange' : h < 110 ? 'yellow' : h < 170 ? 'green'
    : h < 220 ? 'aqua' : h < 275 ? 'blue' : h < 320 ? 'purple' : 'pink';
}

/* The choices as the model's prompt, what to keep out of it, the plain words
   the picture is filed under, and its shape: tall for a figure, wide for a landscape or a
   street, square for a head or a close look at something. extra is what was
   typed under More tags, passed on as it is. */
/* The Character field as the tags the model learnt: the name, then the series,
   lower case as Danbooru writes them. "Frieren (Sousou no Frieren)" and
   "frieren, sousou no frieren" are the same; "ayanami_rei" is "ayanami rei".
   An empty field is no character. */
// How hard the name pulls, as a ComfyUI weight. Unweighted, Frieren came out
// without her pointed ears in 6 pictures of 8 (same seeds, Animagine XL 4.0,
// bust, Original); at 1.2 in 2 of 8 - her clothes were there either way.
const GEN_POSE_AVOID = 'mannequin, wooden mannequin, art mannequin, doll, jointed doll, ball joints, faceless, 3d render';
const GEN_CHAR_WEIGHT = 1.2, GEN_VARY_OUTFIT_WEIGHT = 1.4;
function genCharacterTags(text) {
  const t = String(text || '').trim().slice(0, 80);
  if (!t) return '';
  const m = t.match(/^([^()]+?)\s*\(([^()]+)\)\s*$/);
  const parts = (m ? [m[1], m[2]] : t.split(','))
    .map(x => x.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
  return [...new Set(parts)].join(', ');
}

// The characters drawn lately, newest first, kept to pick from again: typing
// "Frieren (Sousou no Frieren)" once is enough. The same one twice (by its
// tags - "Frieren (Sousou no Frieren)" is "frieren, sousou no frieren") is one.
const GEN_CHARS_KEY = 'refboard.generate.characters.v1', GEN_CHARS_MAX = 8;
function genCharsLoad() {
  try {
    const v = JSON.parse(localStorage.getItem(GEN_CHARS_KEY));
    return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, GEN_CHARS_MAX) : [];
  } catch { return []; }
}
function genCharsRemember(text) {
  const t = String(text || '').trim().slice(0, 80), key = genCharacterTags(t);
  if (!key) return;
  const list = [t, ...genCharsLoad().filter(x => genCharacterTags(x) !== key)].slice(0, GEN_CHARS_MAX);
  try { localStorage.setItem(GEN_CHARS_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

function genPrompt(choices, extra = '') {
  const subjects = GEN_CHOICES.find(c => c.id === 'subject').options;
  const subject = subjects.some(o => o.id === choices.subject) ? choices.subject : GEN_DEFAULTS.subject;
  const setting = choices.setting || GEN_DEFAULTS.setting;
  // Tags, and what to keep out, may differ by subject (Setting's and
  // Beginner's do) or by setting (a temple's); _ is every other one. Any of
  // them may be a function of all the choices.
  const ch = { ...GEN_DEFAULTS, ...choices, subject, setting };
  const pick = v => {
    const x = v && typeof v === 'object' ? v[subject] ?? v[setting] ?? v._ ?? '' : v;
    return typeof x === 'function' ? x(ch) : x;
  };
  // An option with a `when` that does not hold (Original, for a landscape)
  // is the row's default instead.
  const rows = GEN_CHOICES.filter(c => genApplies(c, { ...GEN_DEFAULTS, ...choices, subject })).map(c => {
    const o = c.options.find(x => x.id === choices[c.id]);
    return [c, o && (!o.when || o.when(ch)) ? o : c.options.find(x => x.id === GEN_DEFAULTS[c.id])];
  });
  // Her tags come right after "1girl, solo", as the model's own sheet orders
  // them. When something other than her own clothes is asked for, "alternate
  // costume" says the outfit is not hers: the Armour of a named character
  // kept her mantle without it.
  const who = genCharacterTags(choices.character);
  const outfitAsked = (c, o) => (c.id === 'setting' && !['any', 'original'].includes(o.id)) || (c.id === 'clothes' && o.id !== 'setting') || (c.id === 'era' && o.id !== 'any');
  const outfit = rows.some(([c, o]) => outfitAsked(c, o));
  // A row whose tags another choice has taken over (a temple, Setting's).
  const owned = new Set(rows.map(([, o]) => o.owns).filter(Boolean));
  const tags = [], words = [], avoid = [], outfitTags = [];
  for (const [c, o] of rows) {
    const t = owned.has(c.id) ? '' : pick(o.tags), a = owned.has(c.id) ? '' : pick(o.avoid);
    if (t) tags.push(t);
    if (t && (c.id === 'setting' || c.id === 'clothes' || c.id === 'era')) outfitTags.push(t);
    if (c.id === 'who' && who) tags.push(`(${who}:${GEN_CHAR_WEIGHT})`, ...(outfit ? ['alternate costume'] : []));
    if (a) avoid.push(a);
    const w = o.words ?? (o.id === 'any' ? '' : o.label.toLowerCase());
    if (w) words.push(w);
  }
  const more = extra.split(',').map(s => s.trim()).filter(Boolean);
  const shape = subject === 'character' ? (choices.framing === 'head' ? 'square' : choices.framing === 'sheet' || choices.framing === 'expressions' ? 'landscape' : 'portrait')
    : subject === 'landscape' || subject === 'building' ? 'landscape' : 'square';
  // outfit: what Setting and Clothes alone say, for a variation, which keeps its
  // own tags and takes only these from the choices (genRequest).
  return { outfit: outfitTags.join(', '), prompt: comfyTags([...tags, ...more].join(', ')), avoid: comfyTags(avoid.join(', ')), tags: [...(who ? [who.split(', ')[0]] : []), ...words, ...more].slice(0, 24).map(w => w.slice(0, 40)), shape };
}

/* "watercolor (medium)" is the Danbooru tag, but to ComfyUI bare brackets
   are emphasis: "watercolor" and a louder "medium" - "pen (medium)" drew a
   pen into every ink picture. Escaped, the tag reaches the model whole;
   a weight, "(tag:1.3)", stays one. */
const comfyTags = s => s.replace(/(\S) \(([^():]+)\)/g, '$1 \\($2\\)');

let genChoices = { ...GEN_DEFAULTS };
// The Prompt box: whether it is open, and the tags to keep out that were
// switched off - kept as ComfyUI gets them, so "sepia" stays off from one
// medium to the next. The server's own (genServer) have no switch.
const GEN_VIEW_KEY = 'refboard.generate.prompt.v1';
let genView = { open: false, off: [] }, genServer = { quality: '', negative: '' };
const genSplit = s => [...new Set(s.split(/,\s*/).map(t => t.trim()).filter(Boolean))];
// Whether this server has a ComfyUI to ask - its rail button shows once it
// has (initGenerate()), so the other views offer a button for it or not.
// Why it cannot be used now, when a ComfyUI is set up and not answering (the
// view shows it, with a way to ask again); '' when it can, or none is set up.
// The other views offer their Generate buttons only when it can.
let genOffline = '';
const genAvailable = () => !genOffline && !document.querySelector('.nav-item[data-view="generate"]').classList.contains('hidden');
let genBusy = false;
// Whether the server has a ControlNet for "Draw this pose" (forms.js).
let genControl = false;
const genControlAvailable = () => genControl;

function loadGenChoices() {
  try { Object.assign(genChoices, JSON.parse(localStorage.getItem(GEN_KEY)) || {}); } catch { /* defaults */ }
  if (typeof genChoices.character !== 'string') genChoices.character = '';
  const p = genChoices.palette;
  if (!(Array.isArray(p) && p.length && p.every(c => Array.isArray(c) && c.length === 3 && c.every(n => Number.isInteger(n) && n >= 0 && n <= 255)))) {
    delete genChoices.palette;
    if (genChoices.colours === 'palette') genChoices.colours = 'any';
  }
}

// A palette sent from Palettes: Colours is Your palette from here on.
function genUsePalette(rgbs) {
  genChoices.palette = rgbs.map(c => c.slice());
  genChoices.colours = 'palette';
  saveGenChoices();
  if (el('genChoices').children.length) { renderGenerate(); renderGenPrompt(); }
  setView({ kind: 'generate' });
}
function saveGenChoices() {
  try { localStorage.setItem(GEN_KEY, JSON.stringify(genChoices)); } catch { /* private mode */ }
}
function saveGenView() {
  try { localStorage.setItem(GEN_VIEW_KEY, JSON.stringify(genView)); } catch { /* private mode */ }
}

// The request as it is sent: the choices, and what to keep out less the
// switched-off tags.
function genRequest() {
  const req = genPrompt(genChoices, el('genExtra').value);
  const off = new Set(genView.off);
  const outfit = req.outfit, who = genCharacterTags(genChoices.character);
  const out = { ...req, avoid: genSplit(req.avoid).filter(t => !off.has(t)).join(', ') };
  delete out.outfit;
  const src = genSource;
  if (!src) return out;
  out.image = src.b64;
  out.shape = src.shape;
  if (src.mode === 'pose') {
    out.control = true; out.strength = src.level; out.tags = [...out.tags, 'pose'].slice(0, 24);
    // The ControlNet reads a wooden mannequin; without this the model drew the mannequin
    // itself, in watercolour, faceless (first run on a real ComfyUI).
    out.avoid = [out.avoid, GEN_POSE_AVOID].filter(Boolean).join(', ');
    // And clothes, when nothing chosen says what she wears: a bare list of tags
    // on the mannequin's volumes drew the mannequin (strength 0.8, seed 7), while
    // t-shirt, jeans, hair and a face at 0.5 drew a girl in the same pose.
    if (genChoices.setting === 'any' && genChoices.clothes === 'setting' && !genCharacterTags(genChoices.character))
      out.prompt = [out.prompt, 'casual, t-shirt, pants, detailed face'].join(', ');
    return out;
  }
  out.denoise = src.level;
  if (src.mode === 'study') {
    // A photo has no tags of its own: the beginner's, so what comes out is
    // a few flat shapes, then the choices above for what it is and its medium.
    const tags = genSplit(out.prompt);
    out.prompt = [...genSplit(BEGIN), ...tags.filter(t => !BEGIN.includes(t))].join(', ');
    out.tags = [...out.tags, 'study', 'simplified'].slice(0, 24);
  } else {
    // A variation: the original's own words, then whatever is typed now.
    const more = genSplit(el('genExtra').value);
    // Its own words, then a Setting or Clothes chosen now (added, not swapped:
    // what it was made in stays in its words), then what is typed. The outfit
    // is weighted: the picture is the sampler's starting point and the name in
    // its words pulls back to her own clothes - plain, steampunk added only
    // gears in the background; weighted 1.3-1.5 at "Very" it was goggles, a
    // corset and gloves on the same face (Frieren, seed 9).
    const wear = outfit ? `(${outfit}:${GEN_VARY_OUTFIT_WEIGHT})` : '';
    out.prompt = comfyTags([src.prompt, wear, outfit && who ? 'alternate costume' : '', ...more].filter(Boolean).join(', '));
    out.avoid = src.avoid || '';
    out.tags = [...(src.tags || []), ...more, 'variation'].slice(0, 24).map(w => w.slice(0, 40));
  }
  return out;
}

/* Starting from a picture. Three ways in, one strip:
   - a study: a photo (or any picture) redrawn as a few flat shapes, in the
     style the choices say - img2img, the picture encoded as the sampler's
     starting point;
   - a variation of a generated picture, from its Vary button;
   - a pose: the 3D figure's render, which a ControlNet holds the picture to.
   `level` is the one slider that matters for each: how far from the picture
   it may wander (img2img's denoise), or how strictly it keeps to the figure
   (the ControlNet's strength). The picture goes to the server already the
   size of the shape - the page does the cropping, so the server only passes
   it on. */
const GEN_SHAPE_PX = { portrait: [832, 1216], square: [1024, 1024], landscape: [1216, 832] };
const GEN_LEVELS = {
  study: { title: 'How far from it', start: 1, options: [['Close', 0.45, 'Repaints the picture in the style, keeping its drawing'], ['Simplified', 0.62, 'Keeps the big shapes, drops the detail'], ['Loose', 0.8, 'Only its layout and colours']] },
  vary: { title: 'How different', start: 1, options: [['Slightly', 0.4, 'The same picture, a little changed'], ['Somewhat', 0.6, 'Same idea, new details'], ['Very', 0.8, 'Only the layout stays']] },
  pose: { title: 'How strictly', start: 1, options: [['Loose', 0.35, 'The pose is a suggestion'], ['Firm', 0.5, 'The pose, with some give'], ['Exact', 0.7, 'Follows the figure closely - and may keep something of the mannequin']] },
};
const GEN_WHAT = {
  study: 'A study: this picture simplified into flat shapes, in the style chosen above.',
  vary: 'A variation of this picture - its own tags, a Setting or Clothes you pick now, and any More tags added.',
  pose: 'This pose, drawn as the character chosen above.',
};
let genSource = null;

/* The frame as the base64 the server takes. A JPEG, not a PNG: a PNG of an
   832x1216 frame is 2 MB as base64, and nginx in front of the container
   refuses a request body over 1 MB (HTTP 413) - so Vary, a study and Draw this
   pose never worked through it. The quality steps down until it is under 700 kB,
   which leaves the prompt and the rest of the request room under that 1 MB. */
const GEN_IMAGE_MAX = 700_000;
function genEncode(canvas) {
  let b64 = '';
  for (const q of [0.92, 0.85, 0.75, 0.6, 0.45]) {
    b64 = canvas.toDataURL('image/jpeg', q).split(',')[1];
    if (b64.length <= GEN_IMAGE_MAX) break;
  }
  return b64;
}

/* Where the figure is in a pose picture (the 3D view's depth map): its box, a
   margin round it, in the picture's pixels. The 3D view is wide and the figure
   stands in the middle of it, a sixth of the frame - drawn as it came, the model
   made a small figure on a big sheet. Looked for on a 160-px copy: whatever is not
   the colour of the corner. */
function genFigureBox(img) {
  const k = 160 / Math.max(img.naturalWidth, img.naturalHeight), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const g = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 36) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const m = 0.08 * Math.max(x1 - x0, y1 - y0) + 2;
  const L = Math.max(0, x0 - m) / k, T = Math.max(0, y0 - m) / k, R = Math.min(w, x1 + 1 + m) / k, B = Math.min(h, y1 + 1 + m) / k;
  return { x: L, y: T, w: R - L, h: B - T };
}

/* A picture made ready for the server: fitted to the frame its shape names. A photo fills the
   frame (its edges may go); a figure (mode 'pose') is fitted whole round its own box - or round
   `box`, when the caller wants several pictures framed alike (the directions of one character:
   each one cropped to its own box would draw the narrow side view bigger than the front). */
async function genFrameImage(blob, mode, extra = {}, box = null) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImg(url);
    box = box || (mode === 'pose' ? genFigureBox(img) : null);
    const crop = box || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    const ar = crop.w / crop.h;
    const shape = extra.shape || (ar > 1.15 ? 'landscape' : ar < 0.87 ? 'portrait' : 'square');
    const [W, H] = GEN_SHAPE_PX[shape] || GEN_SHAPE_PX.portrait;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    // A figure must not lose a hand, so it is fitted whole, on the colour of its own background.
    if (mode === 'pose') {
      const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      px.canvas.width = px.canvas.height = 1;
      px.drawImage(img, 0, 0, 1, 1);
      const [r, gg, b] = px.getImageData(0, 0, 1, 1).data;
      g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, W, H);
    }
    if (box) {
      // The frame is the figure's box widened to the frame's own proportions, round
      // the figure's middle: bars of the background colour at the sides made the
      // model draw a dark edge there. Where the widened box leaves the picture, the
      // background colour fills.
      const t = W / H, cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
      let cw = crop.w, ch = crop.h;
      if (cw / ch < t) cw = ch * t; else ch = cw / t;
      const x0 = cx - cw / 2, y0 = cy - ch / 2, k = W / cw;
      const sx = Math.max(0, x0), sy = Math.max(0, y0), ex = Math.min(img.naturalWidth, x0 + cw), ey = Math.min(img.naturalHeight, y0 + ch);
      g.drawImage(img, sx, sy, ex - sx, ey - sy, (sx - x0) * k, (sy - y0) * k, (ex - sx) * k, (ey - sy) * k);
    } else {
      const k = (mode === 'pose' ? Math.min : Math.max)(W / crop.w, H / crop.h);
      const w = crop.w * k, h = crop.h * k;
      g.drawImage(img, crop.x, crop.y, crop.w, crop.h, (W - w) / 2, (H - h) / 2, w, h);
    }
    return { mode, shape, b64: genEncode(c), preview: c.toDataURL('image/jpeg', 0.6),
      level: GEN_LEVELS[mode].options[GEN_LEVELS[mode].start][1], ...extra };
  } finally { URL.revokeObjectURL(url); }
}

/* Where the figure is in a depth picture, as genFigureBox finds it - for a caller that frames
   several pictures round the union of their boxes. */
async function genBoxOf(blob) {
  const url = URL.createObjectURL(blob);
  try { return genFigureBox(await loadImg(url)); } finally { URL.revokeObjectURL(url); }
}

async function genSetSource(blob, mode, extra = {}) {
  genSource = await genFrameImage(blob, mode, extra);
  renderGenSource();
  setView({ kind: 'generate' });
  el('genStatus').textContent = GEN_WHAT[mode] + ' Change anything, then Generate.';
}

function clearGenSource() {
  genSource = null;
  renderGenSource();
}

function renderGenSource() {
  const host = el('genSourceBody'), src = genSource;
  host.classList.toggle('hidden', !src);
  el('genPick').textContent = src ? 'Another picture...' : 'Start from a picture...';
  if (!src) { host.innerHTML = ''; return; }
  const L = GEN_LEVELS[src.mode];
  host.innerHTML = `<img alt="" src="${src.preview}">` +
    `<span class="gen-source-what">${esc(GEN_WHAT[src.mode])}</span>` +
    `<div class="chips" role="group" aria-label="${esc(L.title)}">` +
    L.options.map(([label, v, hint]) => `<button type="button" class="chip" data-level="${v}" title="${esc(hint)}" aria-pressed="${v === src.level}">${esc(label)}</button>`).join('') + '</div>' +
    `<button type="button" class="ghost" id="genSourceClear" title="Back to making a picture from the choices alone">Drop it</button>`;
}

async function genPicked(file) {
  if (file && file.type.startsWith('image/')) await genSetSource(file, 'study');
}

function renderGenPrompt() {
  if (!el('genPrompt').open) return; // drawn when opened
  const req = genPrompt(genChoices, el('genExtra').value), off = new Set(genView.off);
  const avoid = genSplit(req.avoid);
  const offHere = avoid.filter(t => off.has(t)).length;
  el('genPromptBody').innerHTML =
    `<div><h5>Tags</h5><div class="gen-tags">${esc(req.prompt)}${genServer.quality ? `<span class="fixed">, ${esc(genServer.quality)}</span>` : ''}</div></div>` +
    `<div><h5>Kept out by your choices - click one to let it in ` +
    (offHere ? `<button type="button" id="genAvoidReset">Turn all back on</button>` : '') + `</h5>` +
    (avoid.length ? `<div class="gen-avoid" role="group" aria-label="Kept out by your choices">` +
      avoid.map(t => `<button type="button" data-avoid="${esc(t)}" aria-pressed="${!off.has(t)}">${esc(t)}</button>`).join('') + '</div>'
      : '<div class="gen-tags fixed">Nothing - Normal detail and this medium keep nothing out.</div>') + '</div>' +
    (genServer.negative ? `<div><h5>Always kept out, by the server</h5><div class="gen-tags fixed">${esc(genServer.negative)}</div></div>` : '');
}

function renderGenerate() {
  // Your palette shows its colours - or, none sent yet, waits for some.
  const pal = genChoices.palette;
  const label = o => o.id === 'palette' && pal
    ? `<span class="gen-strip" aria-hidden="true">${pal.map(c => `<i style="background:${colHexOf(c)}"></i>`).join('')}</span>${esc(o.label)}`
    : esc(o.label);
  const off = o => o.id === 'palette' && !pal ? ' disabled title="None yet - send one from Palettes with Use in Generate"' : '';
  const row = c => `<div class="gen-row" data-row="${c.id}"><h4 id="genL-${c.id}">${esc(c.label)}</h4>` +
    `<div class="chips" role="group" aria-labelledby="genL-${c.id}">` +
    c.options.map(o => (o.group ? `<span class="chips-break"></span><span class="chips-group">${esc(o.group)}</span>` : '') + `<button type="button" class="chip" data-gen="${c.id}" data-opt="${o.id}" ` +
      `aria-pressed="${genChoices[c.id] === o.id}"${off(o) || (o.hint ? ` title="${esc(o.hint)}"` : '')}>${label(o)}</button>`).join('') +
    (c.id === 'colours' ? `<button type="button" class="ghost" id="genToPalettes" title="Make or change a palette">Palettes</button>` : '') +
    '</div></div>';
  // Who she is, in words - not a chip: any character there is. Hidden but
  // for a character picture (syncGenRows).
  const charRow = `<div class="gen-row gen-char" data-row="character"><label class="gen-extra" for="genCharacter">Character ` +
    `<input type="text" id="genCharacter" maxlength="80" autocomplete="off" spellcheck="false" value="${esc(genChoices.character || '')}" ` +
    `placeholder="e.g. Frieren, Sousou no Frieren"></label><p class="count" id="genCharHint" role="status"></p>` +
    `<div class="chips gen-recent hidden" id="genRecent" role="group" aria-label="Characters drawn lately"></div></div>`;
  el('genChoices').innerHTML = GEN_GROUPS.map(([k, title, ids]) =>
    `<section class="gen-group" data-group="${k}"><h3>${esc(title)}</h3>` + (k === 'who' ? charRow : '') +
    ids.map(id => row(GEN_CHOICES.find(c => c.id === id))).join('') + '</section>').join('');
  syncGenRows();
  renderGenRecent();
  renderGenWhere();
}
let genControlMissing = '';
function renderGenWhere() {
  el('genWhere').textContent = 'Made by the ComfyUI your server is set up with, and kept in Uploads - ' +
    'the Generated group of the Uploads pack in the library, tagged with these choices.' +
    (genControlMissing ? ` COMFY_CONTROLNET names ${genControlMissing}, but ComfyUI has no such file in models/controlnet - ` +
      'put it there and Draw this pose (3D forms) will show up.' : '');
}

// Only the rows the choices ask: a landscape has no hair colour, ink no
// wet-in-wet.
function syncGenRows() {
  const box = el('genChoices');
  for (const c of GEN_CHOICES) {
    box.querySelector(`[data-row="${c.id}"]`).classList.toggle('hidden', !genApplies(c, genChoices));
    // An option offered only when() (Original: a character only): hidden
    // when not, and a choice that was it goes back to the row's default.
    for (const o of c.options) if (o.when)
      box.querySelector(`[data-gen="${c.id}"][data-opt="${o.id}"]`)?.classList.toggle('hidden', !o.when(genChoices));
    const cur = c.options.find(o => o.id === genChoices[c.id]);
    if (cur?.when && !cur.when(genChoices)) {
      genChoices[c.id] = GEN_DEFAULTS[c.id];
      saveGenChoices();
      for (const b of box.querySelectorAll(`[data-gen="${c.id}"]`)) b.setAttribute('aria-pressed', String(b.dataset.opt === genChoices[c.id]));
    }
  }
  box.querySelector('[data-row="character"]')?.classList.toggle('hidden', genChoices.subject !== 'character');
  syncGenCharHint();
  // A group with none of its rows asked (a landscape has no character) goes too.
  for (const g of el('genChoices').querySelectorAll('.gen-group'))
    g.classList.toggle('hidden', !g.querySelector('.gen-row:not(.hidden)'));
}

// Marks the chips of a row after its choice was changed in code.
function genPressed(id) {
  for (const b of el('genChoices').querySelectorAll(`[data-gen="${id}"]`)) b.setAttribute('aria-pressed', String(b.dataset.opt === genChoices[id]));
}

// The Character field's new text, from typing or a click on a recent one.
// Naming her hands her sex to the name (Who: Hers, if it was still the
// default Girl); clearing the name takes Who back to Girl (syncGenRows).
function genSetCharacter(text) {
  const was = !!genCharacterTags(genChoices.character);
  genChoices.character = text.slice(0, 80);
  if (!was && genCharacterTags(genChoices.character) && genChoices.who === 'girl') genChoices.who = 'her';
  saveGenChoices();
  syncGenRows();
  genPressed('who');
  renderGenRecent();
  renderGenPrompt();
}

// The characters drawn lately as chips under the field; none, none shown.
function renderGenRecent() {
  const box = el('genRecent'), list = genCharsLoad(), now = genCharacterTags(genChoices.character);
  if (!box) return;
  box.classList.toggle('hidden', !list.length);
  box.innerHTML = list.length ? `<span class="chips-group">Lately</span>` + list.map(t =>
    `<button type="button" class="chip" data-char="${esc(t)}" aria-pressed="${genCharacterTags(t) === now}">${esc(t)}</button>`).join('') : '';
}

// What the Character field says to do next: the series (the model draws her
// less like herself on a bare name), or Normal detail (Simple and Beginner
// leave out clothes nothing names).
function syncGenCharHint() {
  const h = el('genCharHint'), who = genCharacterTags(genChoices.character);
  if (!h) return;
  h.textContent = !who ? '' : !who.includes(',')
    ? 'Add her series after the name - without it she is drawn less like herself.'
    : genChoices.detail === 'normal' ? ''
    : genChoices.setting === 'original' ? 'Original draws her at Normal detail: Simple and Beginner would leave her clothes out.'
    : 'Detail is not Normal: her clothes may be left out.';
}

const genMade = async () => (await listUploads()).filter(u => u.from === 'generate');

async function showGenerate(check = true) {
  if (!el('genChoices').children.length) renderGenerate();
  if (check) genCheck();     // not awaited: the view does not wait on a slow answer
  const all = await genMade();
  renderGenResults(all.slice(0, 24), all.length);
}

/* A picture's menu: one open at a time, placed by the button that opened it and
   kept inside the window (the pictures are in a narrow grid, the menu is wider
   than one). Closed by a click elsewhere, Esc, or choosing something. */
function genMenuClose() {
  for (const li of document.querySelectorAll('#genResults li.menu-open')) {
    li.classList.remove('menu-open');
    li.querySelector('.gen-menu').classList.add('hidden');
    li.querySelector('.gen-more').setAttribute('aria-expanded', 'false');
  }
}
function genMenuToggle(li) {
  const was = li.classList.contains('menu-open');
  genMenuClose();
  if (was) return;
  const btn = li.querySelector('.gen-more'), menu = li.querySelector('.gen-menu');
  li.classList.add('menu-open');
  menu.classList.remove('hidden');
  btn.setAttribute('aria-expanded', 'true');
  const b = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(b.left, innerWidth - m.width - 8)) + 'px';
  menu.style.top = (b.top - m.height - 4 < 8 ? b.bottom + 4 : b.top - m.height - 4) + 'px';
  menu.querySelector('button').focus();
}
document.addEventListener('click', e => { if (!e.target.closest('.gen-menu')) genMenuClose(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('#genResults li.menu-open .gen-more');
  if (open) { e.stopPropagation(); genMenuClose(); open.focus(); }
}, true);

function renderGenResults(list, total = list.length) {
  const host = el('genResults');
  host.innerHTML = '';
  el('genMadeCount').textContent = total ? String(total) : '';
  el('genClear').classList.toggle('hidden', !total);
  disarmGenClear();
  for (const u of list) {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="gen-open" title="${esc((u.tags || []).join(', '))}" ` +
      `aria-label="Open ${esc(u.name)}"><img alt="" loading="lazy"></button>` +
      `<button type="button" class="gen-del" aria-label="Delete ${esc(u.name)}" title="Delete it - from Uploads too">${iconSvg('close')}</button>` +
      `<button type="button" class="gen-more" aria-label="Do more with ${esc(u.name)}" aria-haspopup="true" aria-expanded="false" title="Vary it, redraw a part, finish it, how to draw it...">More</button>` +
      `<div class="gen-menu hidden" role="menu">` +
      `<div class="gen-menu-h" aria-hidden="true">Change it</div>` +
      `<button type="button" class="gen-redraw" title="Brush over a part - a hand, an eye - and only that is drawn again">Redraw a part...</button>` +
      `<button type="button" class="gen-bg" title="Draw the background again - found from the picture's edges, and yours to correct with the brush">New background...</button>` +
      `<button type="button" class="gen-extend" title="More canvas on the sides you choose, drawn to match - the picture itself is not changed">Extend...</button>` +
      `<button type="button" class="gen-cut" title="Cut the figure out of a plain background - a PNG with nothing behind it, for a game">Cut out...</button>` +
      `<button type="button" class="gen-finish" title="The same picture 1.5 times the size, with the detail that size has room for - what a draft becomes">Finish it</button>` +
      (u.parent ? `<button type="button" class="gen-compare" title="It beside the picture it was made from - a slider between them">Before and after</button>` : '') +
      `<hr>` +
      `<div class="gen-menu-h" aria-hidden="true">Try it another way</div>` +
      `<button type="button" class="gen-vary" title="More like it - the same picture, a little or a lot changed">Vary</button>` +
      `<button type="button" class="gen-lights" title="Four pictures of it: soft, from the side, backlit, dramatic">Light it four ways</button>` +
      `<button type="button" class="gen-media" title="It drawn in your other media - watercolour, ink, Copic markers, pencil - to put side by side">In other media</button>` +
      `<hr>` +
      `<div class="gen-menu-h" aria-hidden="true">Learn from it</div>` +
      `<button type="button" class="gen-steps" title="How to draw it - step by step">How to draw it</button>` +
      `<button type="button" class="gen-colours" title="Her colours, with how to mix them - the Colour studio's Character sheet">Her colours</button>` +
      `</div>`;
    storeFileUrl(u.file).then(url => { if (url) li.querySelector('img').src = url; });
    li.querySelector('.gen-open').addEventListener('click', () => openUpload(u));
    li.querySelector('.gen-del').addEventListener('click', async () => {
      await forgetUpload(u);
      await showGenerate(false);
      el('genResults').querySelector('.gen-open')?.focus();
    });
    li.querySelector('.gen-more').addEventListener('click', e => { e.stopPropagation(); genMenuToggle(li); });
    li.querySelector('.gen-menu').addEventListener('click', () => genMenuClose());
    li.querySelector('.gen-redraw').addEventListener('click', () => genRedrawOpen(u));
    li.querySelector('.gen-cut').addEventListener('click', () => genCutOpen(u));
    li.querySelector('.gen-finish').addEventListener('click', () => genFinish(u));
    li.querySelector('.gen-extend').addEventListener('click', () => genExtendOpen(u));
    li.querySelector('.gen-bg').addEventListener('click', () => genRedrawOpen(u, true));
    li.querySelector('.gen-compare')?.addEventListener('click', () => genCompare(u));
    li.querySelector('.gen-lights').addEventListener('click', () => genLights(u));
    li.querySelector('.gen-media').addEventListener('click', () => genMedia(u));
    li.querySelector('.gen-vary').addEventListener('click', async () => {
      const url = await storeFileUrl(u.file);
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      await genSetSource(blob, 'vary', { prompt: u.prompt || '', avoid: u.avoid || '', tags: u.tags || [], shape: u.shape || undefined });
    });
    li.querySelector('.gen-steps').addEventListener('click', async () => {
      const url = await storeFileUrl(u.file);
      if (!url) return;
      stepsKnown.set(url, u.tags || []);
      openSteps(url);
    });
    li.querySelector('.gen-colours').addEventListener('click', async () => {
      const url = await storeFileUrl(u.file);
      if (url) openColour('character', url);
    });
    host.appendChild(li);
  }
  el('genEmpty').classList.toggle('hidden', list.length > 0);
}

/* Delete all: every generated picture, not only the 24 shown. Asked twice
   - the first click only says how many, for a few seconds - rather than
   in a browser dialog, which would stop the page. */
let genClearTimer = 0;
function disarmGenClear() {
  clearTimeout(genClearTimer);
  const b = el('genClear');
  delete b.dataset.armed;
  b.textContent = 'Delete all';
}
async function clearGenerated() {
  const b = el('genClear');
  const all = await genMade();
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = `Delete all ${all.length}? Click again`;
    genClearTimer = setTimeout(disarmGenClear, 4000);
    return;
  }
  disarmGenClear();
  b.disabled = true;
  try {
    for (const u of all) {
      await storeDeleteItem('uploads', uploadKey(u.file));
      await storeDeleteFile(u.file);
    }
  } finally {
    b.disabled = false;
    storeChanged();
    await showGenerate(false);
    el('genStatus').textContent = `${all.length} deleted.`;
  }
}

// What is being made, so Stop can say which: the job's id, and whether it was asked for.
let genJob = '', genStopped = false;

// Keep to the palette: the picture just made is recoloured (js/genlock.js) and
// kept in its place - the same document, with "palette locked" among its tags.
const genLockWanted = () => genChoices.lock === 'on' && genLockPalette(genChoices).length > 0;
async function genLockMade(made, status) {
  const doc = made.doc;
  status.textContent = 'Recolouring to the palette...';
  const blob = await genLockBlob(await (await fetch(await storeFileUrl(doc.file))).blob(), genLockPalette(genChoices));
  if (!blob) { status.textContent = 'The palette has no colour to keep to - only greys.'; return; }
  const f = await storeFile(blob);
  if (storeMode === 'server') await storeSortFile(f.id, doc.folder || 'generated');
  await storePutItem('uploads', uploadKey(f.id), { ...doc, file: f.id, bytes: blob.size, type: 'image/png',
    tags: [...(doc.tags || []), 'palette locked'].slice(0, 24), t: Date.now() });
  await forgetUpload(doc);
}

// One picture: start the job, then ask after it once a second.
async function generateOne(req) {
  const r = await fetch('api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
  if (!r.ok) throw new Error(r.status === 404 ? 'This server has no ComfyUI set up.' : 'The server refused it (HTTP ' + r.status + ').');
  const { id } = await r.json();
  genJob = id;
  // Stop was clicked while the job was being started: it has an id now to stop.
  if (genStopped) genCancel();
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    const s = await (await fetch('api/generate/' + id)).json();
    if (s.state === 'done') return s.upload;
    if (s.state === 'cancelled') throw new Error('Stopped.');
    if (s.state === 'error') throw new Error(s.error || 'ComfyUI could not make it.');
  }
}

// Stop: the picture in hand is cancelled (ComfyUI is told, and drops it from
// its queue or interrupts it), and the ones still to come are not started.
function genCancel() {
  if (genJob) fetch(`api/generate/${genJob}/cancel`, { method: 'POST' }).catch(() => { /* gone: nothing to stop */ });
}
function genStop() {
  genStopped = true;
  el(genUi.go).disabled = true;
  el(genUi.status).textContent = 'Stopping...';
  genCancel();
}

// jobs: requests built elsewhere (Finish it, Redraw a part) instead of the choices'.
// Drafts are the choices drawn in fewer steps: quick to look through, and Finish it
// makes the one worth keeping into the picture.
const GEN_DRAFT_STEPS = 14;
// The controls a run drives: this view's own, or - ui - another view's that shares the run
// (Game assets: js/assets.js). refresh() redraws that view's list of what was made.
const GEN_UI = { go: 'genGo', status: 'genStatus', goText: 'Generate', refresh: () => showGenerate(false) };
let genUi = GEN_UI;
// after(made): something to do to each picture made from jobs, before it is listed (In detail
// puts the part back into the picture it was cut from).
// doing may be a function of (i, n) - "Making 2 of 4" - when jobs are several.
async function runGenerate(jobs = null, doing = '', done = '', after = null, ui = GEN_UI) {
  if (genBusy) return;
  genBusy = true;
  genStopped = false;
  genUi = ui;
  const go = el(ui.go);
  // While it works the button is Stop.
  go.textContent = 'Stop';
  go.title = 'Stop making pictures - the one in hand is cancelled, the rest are not started';
  const n = jobs ? jobs.length : Number(el('genCount').value) || 1;
  const req = jobs ? null : genRequest();
  if (req && el('genQuality').value === 'draft') { req.steps = GEN_DRAFT_STEPS; req.tags = [...req.tags, 'draft'].slice(0, 24); }
  const status = el(ui.status);
  try {
    for (let i = 1; i <= n; i++) {
      if (genStopped) break;
      status.textContent = jobs ? (typeof doing === 'function' ? doing(i, n) : doing) : n > 1 ? `Making ${i} of ${n}...` : 'Making it...';
      const made = await generateOne(jobs ? jobs[i - 1] : req);
      if (!jobs && genLockWanted()) await genLockMade(made, status);
      if (jobs && after) await after(made);
      storeChanged();
      await ui.refresh();
    }
    status.textContent = genStopped ? 'Stopped.' : jobs ? done : n > 1 ? `${n} made - in Uploads, Generated.` : 'Made - in Uploads, Generated.';
    if (!jobs && genChoices.subject === 'character') { genCharsRemember(genChoices.character); renderGenRecent(); }
  } catch (err) {
    status.textContent = err.message;
    // It may have stopped answering: say so, with a way to ask again. Not
    // after a Stop, which is no sign of that.
    if (!genStopped) genCheck();
  } finally {
    genBusy = false;
    genJob = '';
    go.textContent = ui.goText;
    go.removeAttribute('title');
    go.disabled = !!genOffline;
  }
}

async function initGenerate() {
  loadGenChoices();
  el('genChoices').addEventListener('click', e => {
    if (e.target.closest('#genToPalettes')) { setView({ kind: 'palette' }); return; }
    const who = e.target.closest('[data-char]');
    if (who) {
      el('genCharacter').value = who.dataset.char;
      genSetCharacter(who.dataset.char);
      return;
    }
    const b = e.target.closest('[data-gen]');
    if (!b) return;
    genChoices[b.dataset.gen] = b.dataset.opt;
    saveGenChoices();
    for (const x of el('genChoices').querySelectorAll(`[data-gen="${b.dataset.gen}"]`))
      x.setAttribute('aria-pressed', String(x === b));
    if (['subject', 'setting', 'medium', 'framing', 'detail', 'colours'].includes(b.dataset.gen)) syncGenRows();
    renderGenPrompt();
  });
  el('genChoices').addEventListener('input', e => {
    if (e.target.id === 'genCharacter') genSetCharacter(e.target.value);
  });
  el('genChoices').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'genCharacter') runGenerate(); });
  try { Object.assign(genView, JSON.parse(localStorage.getItem(GEN_VIEW_KEY)) || {}); } catch { /* defaults */ }
  el('genPrompt').open = !!genView.open;
  el('genPrompt').addEventListener('toggle', () => {
    genView.open = el('genPrompt').open;
    saveGenView();
    renderGenPrompt();
  });
  el('genPromptBody').addEventListener('click', e => {
    const t = e.target.closest('[data-avoid]');
    if (e.target.closest('#genAvoidReset')) genView.off = [];
    else if (t) {
      const tag = t.dataset.avoid;
      genView.off = genView.off.includes(tag) ? genView.off.filter(x => x !== tag) : [...genView.off, tag];
    } else return;
    saveGenView();
    renderGenPrompt();
    el('genPromptBody').querySelector(t ? `[data-avoid="${CSS.escape(t.dataset.avoid)}"]` : '.gen-avoid button')?.focus();
  });
  el('genExtra').addEventListener('input', renderGenPrompt);
  el('genGo').addEventListener('click', () => genBusy ? genStop() : runGenerate());
  el('genPick').addEventListener('click', () => el('genPickInput').click());
  el('genPickInput').addEventListener('change', async e => { await genPicked(e.target.files[0]); e.target.value = ''; });
  el('genSource').addEventListener('click', e => {
    if (e.target.closest('#genSourceClear')) { clearGenSource(); el('genPick').focus(); return; }
    const b = e.target.closest('[data-level]');
    if (!b || !genSource) return;
    genSource.level = Number(b.dataset.level);
    for (const x of el('genSource').querySelectorAll('[data-level]')) x.setAttribute('aria-pressed', String(x === b));
  });
  // A picture dropped on the strip.
  const strip = el('genSource');
  strip.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); strip.classList.add('over'); } });
  strip.addEventListener('dragleave', () => strip.classList.remove('over'));
  strip.addEventListener('drop', async e => { e.preventDefault(); strip.classList.remove('over'); await genPicked(e.dataTransfer.files[0]); });
  el('genClear').addEventListener('click', clearGenerated);
  el('genExtra').addEventListener('keydown', e => { if (e.key === 'Enter') runGenerate(); });

  el('genRetry').addEventListener('click', async () => {
    el('genRetry').disabled = true;
    el('genOfflineText').textContent = 'Asking ComfyUI...';
    try { await genCheck(); } finally { el('genRetry').disabled = false; }
  });

  // Offered only where it can work: a server, with a ComfyUI it can reach.
  await initStore();
  if (storeMode !== 'server') return;
  await genCheck();
}

/* Asks the server whether generating can work now, and shows what it says:
   the rail button and the view when it can; when a ComfyUI is set up and not
   answering (a laptop asleep, a tunnel down), the button and the view too, with
   the reason and a button to ask again - a feature that vanishes without a word
   looks like one that was never there. Nothing at all with no ComfyUI set up,
   or on a server too old to say. */
async function genCheck() {
  let info = null;
  try { info = await (await fetch('api/generate')).json(); } catch { /* an older server: no such route */ }
  if (!info) return;
  genOffline = !info.available && info.configured === true ? (info.reason || 'ComfyUI is not answering.') : '';
  if (info.available) genServer = { quality: info.quality || '', negative: info.negative || '' };
  genControl = !!info.available && !!info.control;
  // A ControlNet named in COMFY_CONTROLNET that ComfyUI does not have: Draw this pose is
  // missing for that reason, and nothing else on the page would say so.
  genControlMissing = (info.available && info.controlMissing) || '';
  if (el('genWhere')) renderGenWhere();
  document.getElementById('formPoseGen')?.classList.toggle('hidden', !genControl);
  document.querySelector('.nav-item[data-view="generate"]').classList.toggle('hidden', !info.available && !genOffline);
  // Game assets is made by the same ComfyUI: shown, and offline, with it (js/assets.js).
  document.querySelector('.nav-item[data-view="assets"]').classList.toggle('hidden', !info.available && !genOffline);
  assetsOffline();
  el('genOffline').classList.toggle('hidden', !genOffline);
  el('genOfflineText').textContent = genOffline;
  el('genGo').disabled = !!genOffline;
  renderGenPrompt();
  renderStages();
}
initGenerate();
