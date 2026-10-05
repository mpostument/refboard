/* refboard - 3D forms: the shapes, drapery, the figure and the hand.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* --------------------------------------------------------------- 3D forms
   Simple forms under a light you control - the exercise every drawing course
   starts shading with, since a cube or a sphere is where light, halftone,
   core shadow, reflected light and cast shadow are easiest to see apart. A
   photo of a real one has the light wherever it was; this puts the light, the
   forms and the lens under your hand.

   THREE.JS, FROM A CDN, LOADED ON FIRST USE. It is the one part of the board
   that fetches anything at runtime, so it is imported only when this view is
   first opened (see the import map in <head> for where from): every other
   view keeps working offline and never pays for ~700 KB it did not use.

   What makes it a drawing tool rather than a viewer:
   - Real cast shadows with self-shadowing, from a sun or a lamp you can
     place by clicking and move nearer or further - a near lamp shows falloff
     across the form and a shadow that fans out.
   - Fill and bounce kept separate: bounce comes up off the floor in the
     floor's colour, which is where reflected light in a core shadow comes
     from. A second light for key-and-rim setups.
   - A zones view that paints the academic light families straight onto the
     forms, computed from the actual light and shadow map, not guessed.
   - Construction: vanishing points of the box around a form, cross-section
     ellipses and their axis, cross-contour lines, a floor grid, eye level.
   - Snapshots go straight into the same viewer a session uses, so the Notan
     split, grid, angle tool and eyedropper all work on a render with no new
     code - and "Draw random forms" builds a whole timed session of them.

   No tone mapping: three's renderer lights in linear space and converts to
   sRGB once at the end, and a filmic curve on top would quietly compress the
   very value range this view exists to show. */

const FORMS_KEY = 'refboard.forms.v1';
const FORM_SCENES_KEY = 'refboard.formScenes.v1';
// Exports match the stage's own proportions, at the same long edge as the
// server's display copies (MAX_PX) - 4:3 when there is no stage to measure.
const FORM_EXPORT_EDGE = 1600;
function formExportSize() {
  const st = el('formsStage'), w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return [FORM_EXPORT_EDGE, FORM_EXPORT_EDGE * 3 / 4];
  return w >= h ? [FORM_EXPORT_EDGE, Math.round(FORM_EXPORT_EDGE * h / w)]
                : [Math.round(FORM_EXPORT_EDGE * w / h), FORM_EXPORT_EDGE];
}
const FORM_MAX_OBJECTS = 6;

/* Light distance is in multiples of the scene's radius, so "close" means the
   same thing for a pebble-sized sphere and a tall box. At LIGHT_SUN it stops
   being a lamp at all: a directional light, every ray parallel - the sun, or
   a window far away. Below it a point light, which is where the two things
   distance actually changes appear: falloff across the form (the side nearer
   the lamp visibly brighter than the far side) and a cast shadow that fans
   out wider than the form instead of running parallel. */
const LIGHT_SUN = 12;

/* One form. x/z place it on the floor (in the same units the forms are
   built in, about 1 = a form's half-width), y lifts it off - 0 is resting
   on it; everything else poses and finishes it. */
const FORM_OBJECT_DEFAULTS = {
  shape: 'cube', sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0,
  color: '#d4cec4', finish: 'matte', gloss: 0.05,
  // The anime head's hair (HAIR_STYLES) and its colour - brown, from HAIR_COLOURS.
  hair: 'bob', hairColor: '#6e4a37',
  // Its eyes: a style from ANIME_EYES (js/vision.js), and a colour from EYE_COLOURS.
  eyes: 'tv', eyeColor: '#3f6fb5',
  // And its expression, from ANIME_EXPRESSIONS - at rest.
  expression: 'calm',
  // The figure's proportions, from FIGURE_BUILDS - a real body's by default.
  build: 'real',
  // The figure's joints, { joint: [bend, twist, lean] } in degrees - see
  // FORM_RIG. Frozen, and only ever replaced, never edited in place: objects
  // are copied with a plain spread, which would share it.
  pose: Object.freeze({}),
};
const FORM_OBJ_KEYS = Object.keys(FORM_OBJECT_DEFAULTS);
// How far a form can be moved and how far stretched - by slider, handle or key.
const FORM_PLACE_LIMIT = 10;
const FORM_SCALE_MIN = 0.2, FORM_SCALE_MAX = 4;

// Light directions read relative to where you stand: 0° is light from behind
// your shoulder, +90° from your right - so "3/4 from upper left" means the
// same thing from any angle. The lights themselves stay put in the world:
// orbiting walks you around lamps that do not move, and the sliders update
// to say where they now are (see bindFormsOrbit). Lights that orbited with the
// camera made every turn around a sphere render the identical frame.
const FORM_DEFAULTS = {
  objects: [FORM_OBJECT_DEFAULTS], active: 0, lightOn: 0,
  lightAz: -45, lightEl: 40, lightDist: LIGHT_SUN, intensity: 1, softness: 0.25, lightColor: '#fff4e6',
  fillOn: false, fillAz: 60, fillEl: 15, fillStrength: 0.35, fillColor: '#d6e4ff',
  ambient: 0.18, bounce: 0.3, occlusion: 1,
  bg: '#2a2a30', groundColor: '#7a746a', ground: true,
  focal: 50, yaw: 35, pitch: 22, zoom: 1,
  // The camera's roll (a Dutch angle) in degrees, and the fisheye lens -
  // see ANIME_SHOTS and renderFisheye().
  roll: 0, fisheye: false,
  lines: false, horizon: false, lightMarker: true, vp: false, ellipses: false, floorGrid: false, zones: false,
  count: 10, anyShape: true, memorySecs: 15,
  // A figure's height in heads, drawn across it - see drawFormHeads().
  heads: false,
  // Atmospheric perspective - see formsRender(). 0 is the clean studio.
  haze: 0, hazeColor: '#b9c6d6',
};
const defaultFormScene = () => structuredClone(FORM_DEFAULTS);

// [azimuth, elevation]. The names are the ones a drawing book uses; "Front"
// is here to show what flat light does to form, not because it is useful.
/* The lights a portrait photographer or painter names, relative to the FACE,
   not to you: Rembrandt is Rembrandt whichever way the head is turned and
   wherever you stand. az/el as the Light sliders read them, but measured
   from the direction the face points; fill is the second light's strength
   (0 = off), from the other side unless fillAz says where. */
const PORTRAIT_LIGHTS = {
  rembrandt: { label: 'Rembrandt', az: -45, el: 42, fill: 0.12,
    hint: 'High and to one side: a small triangle of light on the shadow cheek, under the eye' },
  loop: { label: 'Loop', az: -30, el: 32, fill: 0.3,
    hint: 'A little round from the front: the nose shadow loops down toward the corner of the mouth' },
  butterfly: { label: 'Butterfly', az: 0, el: 55, fill: 0.25, fillAz: 0, fillEl: 5,
    hint: 'High and straight on: a small butterfly of shadow under the nose, the cheekbones carved' },
  split: { label: 'Split', az: -90, el: 8, fill: 0,
    hint: 'Straight from the side: the face cut in two down the ridge of the nose' },
  rim: { label: 'Rim', az: -150, el: 25, fill: 0.3, fillAz: 30, fillEl: 10,
    hint: 'From behind: a line of light round the edge of the head, the face in soft fill' },
};
/* A portrait light in the scene's own terms. The Light sliders read
   relative to the viewer (world azimuth = lightAz + yaw - see
   setLightFromVector()), and a form turned by ry faces world azimuth ry, so
   face-relative a is scene lightAz = a + ry - yaw. */
function portraitLight(sc, o, p) {
  const off = (o.ry || 0) - sc.yaw;
  const t = { lightAz: Math.round(wrap180(p.az + off)), lightEl: Math.round(p.el), fillOn: p.fill > 0 };
  if (p.fill > 0) {
    t.fillStrength = p.fill;
    t.fillAz = Math.round(wrap180((p.fillAz !== undefined ? p.fillAz : (p.az <= 0 ? 60 : -60)) + off));
    t.fillEl = p.fillEl || 15;
  }
  return t;
}

const LIGHT_PRESETS = {
  classic: { label: '3/4',   az: -45,  el: 40 },
  side:    { label: 'Side',  az: -90,  el: 12 },
  top:     { label: 'Top',   az: -10,  el: 85 },
  rim:     { label: 'Back',  az: -150, el: 30 },
  front:   { label: 'Front', az: 0,    el: 15 },
};

/* How many vanishing points a box has is decided by which of its three edge
   directions are parallel to the picture plane - those converge nowhere. So
   each preset squares the forms up (no tilt, turn or roll) and sets only the
   camera: facing a side dead-on at eye level leaves just depth converging;
   turning to look at a corner adds the widths; looking down on it as well
   finally makes the verticals converge too. The lens, not the preset, sets
   how hard they converge. */
const PERSPECTIVE_PRESETS = {
  one:   { label: '1-point', yaw: 0,  pitch: 0,  hint: 'Face-on at eye level - only the depth edges converge' },
  two:   { label: '2-point', yaw: 35, pitch: 0,  hint: 'Corner-on at eye level - verticals stay vertical' },
  three: { label: '3-point', yaw: 35, pitch: 38, hint: 'Corner-on from above - the verticals converge too' },
};

/* The shots anime keeps coming back to, each a height, a lens, a distance
   and a roll - never a turn: which side of the figure you see stays yours.
   A pitch of -40 means "as low as the floor allows": formsRender() keeps the
   camera above the floor, so the worm's eye ends up at the figure's feet.
   `zoom` is the distance against the framed one, so Wide is close as well
   as wide - a wide lens from far off only makes everything smaller. `gen`
   is Generate's Lens row for the same shot (see formShotToGenerate()). */
const ANIME_SHOTS = {
  worm:  { label: "Worm's eye", pitch: -40, focal: 24, zoom: 0.85, roll: 0, fisheye: false, gen: 'any',
    hint: 'From the floor, looking up - the figure towers, the legs run long, the chin and the underside of the chest show. For power, or a threat' },
  bird:  { label: "Bird's eye", pitch: 65, focal: 28, zoom: 1, roll: 0, fisheye: false, gen: 'any',
    hint: 'From high above - the figure small and exposed, the head big and the feet tiny. For loneliness, or to map out a scene' },
  wide:  { label: 'Wide, close', pitch: 4, focal: 18, zoom: 0.72, roll: 0, fisheye: false, gen: 'wide',
    hint: "A wide lens pushed in close - whatever is nearest comes out huge: the fist or the foot thrust at you, anime's action shot" },
  dutch: { label: 'Dutch angle', pitch: 10, focal: 35, zoom: 1, roll: 18, fisheye: false, gen: 'dutch',
    hint: 'The camera rolled - the horizon runs downhill. For unease, a fight, a world off balance' },
  tele:  { label: 'Telephoto', pitch: 6, focal: 135, zoom: 1, roll: 0, fisheye: false, gen: 'any',
    hint: "A long lens from far off - depth flattened, near and far nearly one size: the key visual's figure against a huge moon" },
  fish:  { label: 'Fisheye', pitch: 15, focal: 50, zoom: 0.5, roll: 0, fisheye: true, gen: 'fisheye',
    hint: 'Straight lines bow out round the middle - the face pushed into the lens, for comedy and for action' },
};
// Which shot the camera is at now, or '' - the worm's eye by being below the
// forms' middle rather than at one pitch, since the floor decides where it
// stops. A fisheye ignores the Lens slider, so its focal does not count.
function animeShotOf(sc) {
  return Object.keys(ANIME_SHOTS).find(k => {
    const p = ANIME_SHOTS[k];
    return (p.fisheye || sc.focal === p.focal) && sc.roll === p.roll && sc.fisheye === p.fisheye &&
      Math.abs(sc.zoom - p.zoom) < 0.01 && (p.pitch < 0 ? sc.pitch < 0 : Math.round(sc.pitch) === p.pitch);
  }) || '';
}

/* Surface finishes - each one a different way light behaves, not a different
   number on the same slider. `gloss` is where each preset puts the Shine
   slider, which stays free to fine-tune afterwards. */
const FORM_FINISHES = {
  matte:  { label: 'Matte',  gloss: 0.05, hint: 'Plaster or chalk - no highlight, the purest light-to-shadow study' },
  satin:  { label: 'Satin',  gloss: 0.45, hint: 'Clay or eggshell - a broad, soft highlight' },
  glossy: { label: 'Glossy', gloss: 0.85, clearcoat: 1, hint: 'Glazed ceramic - a small sharp highlight sitting on top of the colour' },
  metal:  { label: 'Metal',  gloss: 0.75, metal: 1, env: true, hint: 'Metal - mirrors its surroundings; almost no colour of its own in shadow' },
  glass:  { label: 'Glass',  gloss: 0.97, transmission: 1, env: true, hint: 'Glass - see-through, bending what is behind it. Its cast shadow stays solid here: shadow maps have no transparency' },
  velvet: { label: 'Velvet', gloss: 0.02, sheen: 1, hint: 'Cloth - brightest at the edges, the reverse of a matte form' },
  // Not a material but a way of colouring one - see celTones() and the cel
  // block in injectFormGuides(). Shine sets the highlight's size here.
  anime:  { label: 'Anime',  gloss: 0.35, cel: true, hint: 'Cel shading - a flat colour, one hard-edged shadow tone and a sharp highlight; the Second light becomes a rim' },
};

/* ---- cel shading. Anime colours a form with a few flat tones, not a
   gradient: the base colour in the light, one shadow colour, a highlight -
   and a rim of light on the edge turned away. The tones are worked out here,
   once per form, in sRGB 0-255; the shader only decides where each goes. */

// A colour as OKLCH - [lightness 0-1, chroma, hue in degrees] - the space
// where "a bit darker, a bit bluer" means the same for every colour.
function rgbToOklch([r, g, b]) {
  const [L, a, bb] = linToOklab(srgbToLin(r / 255), srgbToLin(g / 255), srgbToLin(b / 255));
  return [L, Math.hypot(a, bb), (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360];
}

/* The shadow tone for a base colour, as anime colours it: not the base with
   black in it (that is what makes shadows muddy) but its own colour, usually
   pulled toward blue-purple - the cool of the sky that fills a shadow.
   `rgb` is sRGB 0-255; returns the same. lchRgb(L, C, h) builds a colour
   back from OKLCH and keeps it inside the screen's gamut. */
function celShadow(rgb) {
  const [L, C, h] = rgbToOklch(rgb);
  const COOL = 285; // blue-violet
  // A third of the way to it, the short way round the circle - skin goes
  // toward rose-violet, not through green; a navy already there stays put.
  const dh = ((COOL - h + 540) % 360) - 180;
  // A near-grey has no hue of its own to keep: a white shirt's shadow is a
  // pale lavender, the commonest shadow in anime.
  const grey = C < 0.03;
  // Light colours fall further than dark ones, which have little room left.
  // Chroma rises a touch: a shadow greyer than its light reads as dirt.
  return lchRgb(L - (0.1 + 0.1 * L), grey ? 0.035 : C * 1.1, grey ? COOL : h + dh / 3);
}

// All the tones one form needs: its base in the key light's colour, the
// shadow, a highlight and the rim (in the second light's colour).
function celTones(color, lightColor, rimColor) {
  const base = hexToRgb(color), light = hexToRgb(lightColor);
  // The light's colour tints what it touches - a warm lamp warms the base -
  // but not the shadow, which by definition it does not reach.
  const lit = base.map((c, i) => Math.round(c * light[i] / 255));
  const toward = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
  return {
    base: lit,
    shade: celShadow(base),
    hi: toward(lit, light, 0.75),
    rim: toward(lit, hexToRgb(rimColor), 0.8),
  };
}

/* Each geometry is built around the origin at roughly unit radius; the
   renderer lifts whatever rotation and scale produce so it rests on the
   floor. `lines` is how many contour divisions to draw along each UV axis -
   three's own UVs already run along each form's structure. `flat` shades
   faceted solids with hard edges; a four-sided cone with smoothed normals
   reads as a melted pyramid. `sections` are [y, radius] circles around the
   form's own axis, in its own units, for the ellipse guide; `axis` is how far
   that axis runs. Forms with no single axis of revolution have neither. */
const FORM_SHAPES = {
  cube:     { label: 'Cube',     lines: [4, 4],  build: T => new T.BoxGeometry(2, 2, 2) },
  sphere:   { label: 'Sphere',   lines: [16, 8], build: T => new T.SphereGeometry(1, 96, 48),
              sections: [[-0.7, 0.714], [0, 1], [0.7, 0.714]], axis: [-1, 1] },
  cylinder: { label: 'Cylinder', lines: [16, 4], build: T => new T.CylinderGeometry(1, 1, 2, 96),
              sections: [[-1, 1], [0, 1], [1, 1]], axis: [-1, 1] },
  cone:     { label: 'Cone',     lines: [16, 4], build: T => new T.ConeGeometry(1, 2, 96),
              sections: [[-1, 1], [-0.33, 0.667], [0.33, 0.333]], axis: [-1, 1] },
  pyramid:  { label: 'Pyramid',  lines: [8, 4], flat: true,
              build: T => new T.ConeGeometry(Math.SQRT2, 2, 4).rotateY(Math.PI / 4) },
  prism:    { label: 'Prism',    lines: [6, 4], flat: true,
              build: T => new T.CylinderGeometry(1, 1, 2, 3).rotateZ(Math.PI / 2) },
  torus:    { label: 'Torus',    lines: [24, 8],
              build: T => new T.TorusGeometry(0.7, 0.3, 48, 128).rotateX(Math.PI / 2),
              sections: [[0, 1], [0, 0.4], [0.3, 0.7], [-0.3, 0.7]], axis: [-0.3, 0.3] },
  capsule:  { label: 'Capsule',  lines: [16, 8], build: T => new T.CapsuleGeometry(0.6, 1.2, 24, 96),
              sections: [[-0.6, 0.6], [0, 0.6], [0.6, 0.6]], axis: [-1.2, 1.2] },
  egg:      { label: 'Egg',      lines: [16, 8], build: T => {
    // Wider below the equator than above - the asymmetry is the whole reason
    // an egg is a harder form to shade than a stretched sphere.
    const pts = [];
    for (let j = 0; j <= 64; j++) {
      const ph = -Math.PI / 2 + Math.PI * j / 64;
      pts.push(new T.Vector2(Math.max(0.8 * Math.cos(ph) * (1 - 0.16 * Math.sin(ph)), 0), Math.sin(ph)));
    }
    return new T.LatheGeometry(pts, 96);
  }, sections: [[-0.5, 0.748], [0, 0.8], [0.5, 0.637]], axis: [-1, 1] },
  // An artist's wooden mannequin: its body is FORM_RIG, hung off this tiny
  // ball at the pelvis (hidden inside it) - see buildFormRig().
  figure:   { label: 'Figure',   lines: [8, 6], rig: 'figure', build: T => new T.SphereGeometry(0.04, 8, 6) },
  // The head, twice from one real head scan (formHeadScan()): as it is, and
  // cut into planes the way the Asaro planes head is - large flat facets, so
  // each turn of the form is one value. Until the scan has arrived (and if
  // it cannot), the sculpted head stands in (formHeadGeometry()).
  // `subject`: like the figure, a thing to draw in its own right, never dealt
  // out as one more random shape.
  head:     { label: 'Head',     lines: [12, 8], subject: true, build: T => formHeadGeometry(T, 128, 96) },
  planes:   { label: 'Head planes', lines: [12, 8], subject: true, flat: true, build: T => formHeadGeometry(T, 30, 22) },
  // Sculpted the anime way, with its face drawn on (formAnimeFace()) - `face`.
  anime:    { label: 'Anime head', lines: [12, 8], subject: true, face: true, build: T => formAnimeHeadGeometry(T, 128, 96) },
  // Drapery - a cloth simulated once, when first picked (formClothGeometry()),
  // for each of the fold types a drawing book names. `cloth`: seen from both
  // sides, and never dealt out as a random shape.
  drape:    { label: 'Cloth over a ball', lines: [14, 14], cloth: true, build: T => formClothGeometry(T, 'drape') },
  swag:     { label: 'Hanging cloth', lines: [14, 14], cloth: true, build: T => formClothGeometry(T, 'swag') },
  curtain:  { label: 'Curtain', lines: [14, 14], cloth: true, build: T => formClothGeometry(T, 'curtain') },
  // A mannequin hand, posable finger by finger - FORM_HAND_JOINTS.
  hand:     { label: 'Hand',     lines: [8, 6], rig: 'hand', build: T => new T.SphereGeometry(0.04, 8, 6) },
};

/* ---- drapery. Folds are what cloth does under gravity against whatever
   holds it up, so rather than sculpt them this lets a cloth fall: a grid of
   particles, Verlet-integrated (each step moves a point by its last step,
   damped, plus gravity - velocity is never stored), then pulled back toward
   the right distance from its neighbours a few times per step. Three kinds of
   link: to the next point (holds the weave's length), across the diagonal
   (resists shearing), and to the point after next, weaker (resists bending -
   weak, so it folds sooner than it stretches, which is what makes folds).

   The three set-ups are Hogarth's fold types, the ones drawing books teach:
   - drape:   a cloth dropped over a ball - drop folds, radiating from what
              holds it and falling straight down from its edge.
   - swag:    a cloth hung from two points closer together than it is wide -
              diaper folds, the sagging V's and U's between two supports.
   - curtain: a cloth hung from a gathered top edge - pipe folds, tubes
              running down from each gather.
   Seeded, so each is always the same cloth. Run once per page, when first
   picked (a few hundred milliseconds), and cached like any geometry. */
function formClothGeometry(T, kind) {
  const N = 46, S = 3.2, d = S / (N - 1);
  const g = new T.PlaneGeometry(S, S, N - 1, N - 1);
  const pos = g.attributes.position, n = pos.count;
  const p = new Float32Array(n * 3), q = new Float32Array(n * 3), pin = new Uint8Array(n);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  // PlaneGeometry's points run row by row from the top, left to right.
  const at = (i, j) => j * N + i;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = at(i, j) * 3, u = i / (N - 1), v = j / (N - 1);
    if (kind === 'drape') {
      p[k] = (u - 0.5) * S; p[k + 1] = 1.1 + rnd() * 0.01; p[k + 2] = (v - 0.5) * S;
    } else if (kind === 'swag') {
      p[k] = (u - 0.5) * S; p[k + 1] = 1.6 - v * S; p[k + 2] = rnd() * 0.01;
      // The two top corners, pinned closer together than the cloth is wide.
      if (j === 0 && (i === 0 || i === N - 1)) { pin[at(i, j)] = 1; p[k] = (u - 0.5) * S * 0.55; }
    } else {
      // Gathered: the whole top edge pinned into half its width, zig-zagging
      // in and out - each gather starts a pipe.
      p[k] = (u - 0.5) * S * (j === 0 ? 0.5 : 1); p[k + 1] = 1.6 - v * S;
      p[k + 2] = j === 0 ? 0.1 * Math.sin(u * Math.PI * 14) : rnd() * 0.01;
      if (j === 0) pin[at(i, j)] = 1;
    }
  }
  q.set(p);
  const links = [];
  const link = (a, b, rest, stiff) => links.push(a, b, rest, stiff);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = at(i, j);
    if (i + 1 < N) link(a, at(i + 1, j), d, 1);
    if (j + 1 < N) link(a, at(i, j + 1), d, 1);
    if (i + 1 < N && j + 1 < N) { link(a, at(i + 1, j + 1), d * Math.SQRT2, 0.7); link(at(i + 1, j), at(i, j + 1), d * Math.SQRT2, 0.7); }
    if (i + 2 < N) link(a, at(i + 2, j), 2 * d, 0.15);
    if (j + 2 < N) link(a, at(i, j + 2), 2 * d, 0.15);
  }
  const L = new Float32Array(links);
  const ball = { x: 0.06, y: 0, z: -0.04, r: 0.85 }, floor = kind === 'drape' ? -1 : -40;
  const dt = 0.016, grav = -9.8 * dt * dt;
  for (let step = 0; step < 320; step++) {
    for (let a = 0; a < n; a++) {
      if (pin[a]) continue;
      const k = a * 3;
      for (let c = 0; c < 3; c++) {
        const cur = p[k + c], vel = (cur - q[k + c]) * 0.985;
        q[k + c] = cur; p[k + c] = cur + vel + (c === 1 ? grav : 0);
      }
    }
    for (let it = 0; it < 6; it++) {
      for (let l = 0; l < L.length; l += 4) {
        const a = L[l] * 3, b = L[l + 1] * 3;
        const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
        const len = Math.hypot(dx, dy, dz) || 1e-9, diff = (len - L[l + 2]) / len * 0.5 * L[l + 3];
        const wa = pin[L[l]] ? 0 : 1, wb = pin[L[l + 1]] ? 0 : 1, share = wa + wb;
        if (!share) continue;
        const fa = diff * 2 * wa / share, fb = diff * 2 * wb / share;
        p[a] += dx * fa; p[a + 1] += dy * fa; p[a + 2] += dz * fa;
        p[b] -= dx * fb; p[b + 1] -= dy * fb; p[b + 2] -= dz * fb;
      }
      for (let a = 0; a < n; a++) {
        if (pin[a]) continue;
        const k = a * 3;
        if (kind === 'drape') {
          const ex = p[k] - ball.x, ey = p[k + 1] - ball.y, ez = p[k + 2] - ball.z, r = Math.hypot(ex, ey, ez), R = ball.r + 0.025;
          // A touching point sticks where it touched - friction. Without it
          // every step's fall-then-push-out turns into a slide down the curve,
          // and the whole cloth slips off the ball onto the floor.
          if (r < R) { const s = R / r; p[k] = ball.x + ex * s; p[k + 1] = ball.y + ey * s; p[k + 2] = ball.z + ez * s; pin[a] = 1; }
        }
        // The floor, with friction: a point that touches it stops sliding.
        if (p[k + 1] < floor) { p[k + 1] = floor; p[k] = q[k]; p[k + 2] = q[k + 2]; }
      }
    }
  }
  for (let a = 0; a < n; a++) pos.setXYZ(a, p[a * 3], p[a * 3 + 1], p[a * 3 + 2]);
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

/* A head sculpted out of a sphere by moving its points - no model to fetch,
   and the same function gives the smooth head and the planes head by being
   asked for more or fewer of them. It faces +z, crown up, about the size of
   the other forms. What it follows is the Loomis construction: a ball for
   the cranium with its sides planed off, the face hung below the front of
   it in three equal parts - hairline to brow, brow to the base of the nose,
   nose to chin - and the features as masses on that, not details: a brow
   ridge, the sockets under it, a nose wedge, cheekbones, the barrel of the
   mouth, a chin, an ear behind the middle of each side. Every move is a
   smooth falloff, so neighbouring points never cross and the surface stays
   whole at any resolution. */
function formHeadGeometry(T, wSeg, hSeg) {
  // phiStart at -90° puts the sphere's UV seam down the back of the skull,
  // where the one line of split normals it leaves is least in the way.
  const g = new T.SphereGeometry(1, wSeg, hSeg, -Math.PI / 2);
  const pos = g.attributes.position;
  const ss = (a, b, t) => { t = Math.min(Math.max((t - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const bump = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const front = ss(-0.15, 0.75, z);      // 0 round the back, 1 on the face
    const low = ss(0.1, -0.9, y);          // 0 above the brow, 1 underneath
    // Cranium: narrower than it is deep, and the sides planed flat.
    x *= 0.8;
    const ax = Math.abs(x);
    if (ax > 0.6) x = Math.sign(x) * (0.6 + (ax - 0.6) * 0.3);
    // The jaw: the lower front of the ball drawn down and in to the chin,
    // and the back tucked in over where the neck would go.
    y -= low * front * 0.45;
    x *= 1 - 0.4 * low * front;
    z *= 1 - 0.22 * low * (1 - front);
    // ...and brought forward: left where the ball puts it, the lower face
    // would curve back under the brow like the underside of a sphere, and a
    // profile would have no chin.
    z += front * low * 0.3;
    // The face is a plane, flatter than the ball behind it.
    if (z > 0.76) z = 0.76 + (z - 0.76) * 0.35;
    const fx = Math.abs(x);
    // Brow ridge, and the sockets under it.
    z += front * 0.08 * bump(0, y - 0.02, 1, 0.07) * (1 - ss(0.4, 0.58, fx));
    z -= front * 0.12 * bump(fx - 0.26, y + 0.13, 0.12, 0.08);
    // The nose: a wedge from between the brows out to its tip, widening
    // as it goes, undercut at its base.
    const ny = ss(0, -0.44, y) * (1 - ss(-0.46, -0.58, y));
    z += front * 0.32 * ny * bump(x, 0, 0.06 + 0.07 * ss(-0.05, -0.5, y), 1);
    // Cheekbones, the barrel of the mouth, the chin.
    x += Math.sign(x) * front * 0.04 * bump(fx - 0.45, y + 0.25, 0.1, 0.12);
    z += front * 0.05 * bump(fx - 0.38, y + 0.22, 0.1, 0.1);
    z += front * 0.06 * bump(x, y + 0.78, 0.26, 0.16);
    z += front * 0.07 * bump(x, y + 1.02, 0.13, 0.08);
    // Ears: on the side planes, behind the middle, from brow to nose base.
    x += Math.sign(x) * 0.07 * bump(z + 0.08, y + 0.25, 0.1, 0.19) * ss(0.5, 0.6, fx);
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* ---- the head scan. A real head, not a sculpt: Lee Perry-Smith's 3D scan
   (Infinite-Realities, CC BY 3.0 - credited in the help), the one three.js
   ships with its examples, fetched from jsDelivr the first time a head is
   picked - 400 KB, once, and cached by the browser after that. Pinned to a
   release tag like three.js itself, so it cannot change under the page.

   From it, two geometries:
   - Head: the scan as it is, smooth.
   - Head planes: the scan simplified to a few hundred flat facets - what
     John Asaro did by hand for his planes head, here done by meshoptimizer
     (three's SimplifyModifier), which merges the faces whose collapse changes
     the shape least. Big, gently turning areas (forehead, cheek, side of the
     skull) melt into one plane each; the turns that matter - brow ridge,
     sides of the nose, cheekbone, the corner of the jaw - survive as edges,
     because collapsing them would move the surface most.

   Both get their UVs replaced: the scan's own are a texture unwrap, which
   would make the cross-contour lines (drawn from UVs) wander across the face
   in pieces. Instead u goes round the head and v up it, so the lines are
   true cross-contours - meridians and level slices, like a sculptor's
   calliper lines. */
const FORM_HEAD_SCAN = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';
// Facets on the planes head: enough for the eye sockets and the nose to read
// as planes, few enough that each one is a shape you could paint.
const FORM_HEAD_PLANES = 900;
let formHeadScanLoading = null;

function formHeadScan() {
  if (formHeadScanLoading) return;
  const F = forms, T = F.T;
  formHeadScanLoading = (async () => {
    const [{ GLTFLoader }, { mergeVertices }, { SimplifyModifier }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/utils/BufferGeometryUtils.js'),
      import('three/addons/modifiers/SimplifyModifier.js'),
    ]);
    const root = (await new GLTFLoader().loadAsync(FORM_HEAD_SCAN)).scene;
    root.updateMatrixWorld(true);
    let src = null;
    root.traverse(o => { if (o.isMesh && !src) src = o.geometry.clone().applyMatrix4(o.matrixWorld); });
    if (!src) throw new Error('no mesh in the head scan');
    // Positions only, welded: the scan's UV seams otherwise split the
    // surface into pieces the simplifier would keep apart.
    let g = new T.BufferGeometry();
    g.setAttribute('position', src.getAttribute('position'));
    if (src.index) g.setIndex(src.index);
    g = mergeVertices(g, 1e-4);
    // The same size and place as the sculpted head, so the framing, the
    // floor and the proportion sliders treat it the same.
    const ref = formHeadGeometry(T, 32, 24);
    ref.computeBoundingBox(); g.computeBoundingBox();
    const rb = ref.boundingBox, gb = g.boundingBox;
    const k = (rb.max.y - rb.min.y) / (gb.max.y - gb.min.y);
    g.translate(-(gb.min.x + gb.max.x) / 2, -(gb.min.y + gb.max.y) / 2, -(gb.min.z + gb.max.z) / 2);
    g.scale(k, k, k);
    g.translate((rb.min.x + rb.max.x) / 2, (rb.min.y + rb.max.y) / 2, (rb.min.z + rb.max.z) / 2);

    const smooth = g.clone();
    smooth.computeVertexNormals();
    const verts = g.getAttribute('position').count;
    // Target by faces: a closed-ish mesh has about twice as many faces as
    // vertices, so FORM_HEAD_PLANES faces is about half as many vertices.
    const planes = await new SimplifyModifier().modify(g, Math.max(0, verts - FORM_HEAD_PLANES / 2));
    planes.computeVertexNormals();
    for (const geo of [smooth, planes]) { formHeadUv(geo); geo.computeBoundingBox(); geo.computeBoundingSphere(); }
    F.geometries.head = smooth;
    F.geometries.planes = planes;
    formsChanged();
  })();
  formHeadScanLoading.catch(err => console.error('head scan (the sculpted head stays):', err));
}

// Cross-contour UVs for a head: u round the vertical axis (the seam down the
// back of the skull), v up its height.
function formHeadUv(g) {
  const pos = g.getAttribute('position'), n = pos.count, uv = new Float32Array(n * 2);
  g.computeBoundingBox();
  const b = g.boundingBox, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, h = b.max.y - b.min.y;
  for (let i = 0; i < n; i++) {
    uv[i * 2] = Math.atan2(pos.getX(i) - cx, pos.getZ(i) - cz) / (2 * Math.PI) + 0.5;
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / h;
  }
  g.setAttribute('uv', new forms.T.BufferAttribute(uv, 2));
}

/* ---- the anime head. The same construction as the anime face drawn on a
   photo (ANIME_HEAD in js/vision.js, in the same units: the ball's radius,
   y up from the brow, z out of the face), made solid: a big round cranium,
   the jaw running almost straight to a pointed chin, a nose that is barely
   there - and the face a flat mask, not the front of a ball. That flatness
   is the whole lesson: features on a ball wrap round it as it turns, and the
   far eye all but disappears; on the mask both eyes narrow together, the far
   one only a little more - which is how anime draws a turned head. */
function formAnimeHeadGeometry(T, wSeg, hSeg) {
  const g = new T.SphereGeometry(1, wSeg, hSeg, -Math.PI / 2);
  const pos = g.attributes.position, A = ANIME_HEAD;
  const ss = (a, b, t) => { t = Math.min(Math.max((t - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  const bump = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (2 * sx * sx) - (dy * dy) / (2 * sy * sy));
  const chinY = A.jaw[A.jaw.length - 1][1], cheekY = A.eyeY - 0.12;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r0 = Math.sqrt(Math.max(1e-6, 1 - y * y));
    const front = ss(-0.25, 0.55, z), low = ss(0.05, -0.95, y);
    // The cranium: big and round, only a touch narrower than it is deep.
    x *= 0.9;
    // The lower face drawn down and forward to the chin...
    y -= low * front * 0.5;
    z += low * front * 0.32;
    // ...and in, to a jaw that is nearly a straight line from the cheek to
    // the chin: its half-width falls evenly with the height.
    if (y < cheekY) {
      const w = 0.12 + 0.73 * (y - chinY) / (cheekY - chinY);
      const k = Math.min(1, Math.max(w, 0.12) / (0.9 * r0));
      x *= 1 - front * (1 - k);
    }
    // The back tucked in over where the neck would go.
    z *= 1 - 0.18 * low * (1 - front);
    // The mask: the front of the face flattened to nearly a plane - eased in
    // (tanh has slope 1 at the knee), so no crease shows where it starts.
    if (z > 0.55) z = 0.55 + 0.2 * Math.tanh((z - 0.55) / 0.2);
    // The nose: a small ridge to a point, no more.
    z += front * (0.025 * ss(A.eyeY, A.nose, y) * (1 - ss(A.nose, A.nose - 0.06, y)) * bump(x, 0, 0.05, 1)
      + 0.05 * bump(x, y - A.nose, 0.035, 0.05));
    // Ears, level with the eyes and the nose.
    const fx = Math.abs(x);
    x += Math.sign(x) * 0.06 * bump(z + 0.1, y - (A.eyeY + A.nose) / 2, 0.1, 0.17) * ss(0.55, 0.65, fx);
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* The face, drawn: the part of the head that looks forward, given UVs that
   are a straight view from the front, and a picture of the features laid on
   it (drawAnimeFace()). Two layers - the features, lit like the head, and
   the gleams, which are the light itself and stay bright in any shadow. */
const ANIME_FACE_BOX = { x0: -0.75, x1: 0.75, y0: -1.3, y1: 0.12 };
function formAnimeFaceGeometry(T, head) {
  const B = ANIME_FACE_BOX, pos = head.getAttribute('position'), nor = head.getAttribute('normal');
  const idx = head.index ? head.index.array : null, n = idx ? idx.length : pos.count;
  const inBox = v => nor.getZ(v) > 0.2 && pos.getX(v) > B.x0 && pos.getX(v) < B.x1 && pos.getY(v) > B.y0 && pos.getY(v) < B.y1;
  const P = [], N = [], U = [];
  for (let t = 0; t < n; t += 3) {
    const vs = [0, 1, 2].map(k => idx ? idx[t + k] : t + k);
    if (!vs.every(inBox)) continue;
    for (const v of vs) {
      // Just off the surface, so the two never fight over which is in front.
      const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v), x = pos.getX(v), y = pos.getY(v);
      P.push(x + nx * 0.004, y + ny * 0.004, pos.getZ(v) + nz * 0.004);
      N.push(nx, ny, nz);
      U.push((x - B.x0) / (B.x1 - B.x0), (y - B.y0) / (B.y1 - B.y0));
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
  return g;
}

// Where a point of the face drawing (x, y) is on the head: the surface
// straight behind it, from the nearest point of the head that faces forward.
function formFacePoint(head, x, y) {
  const pos = head.getAttribute('position'), nor = head.getAttribute('normal');
  let best = Infinity, z = 0;
  for (let v = 0; v < pos.count; v++) {
    if (nor.getZ(v) < 0.2) continue;
    const d = (pos.getX(v) - x) ** 2 + (pos.getY(v) - y) ** 2;
    if (d < best) { best = d; z = pos.getZ(v); }
  }
  return [x, y, z];
}

/* The features, drawn onto a canvas that covers ANIME_FACE_BOX, in an eye
   style (ANIME_EYES, animeEyeShape() in js/vision.js), an eye colour and an
   expression (ANIME_EXPRESSIONS). `gleams`: draw only the gleams, on the
   side the light comes from (side -1 is the face's right, the viewer's
   left), and leave everything else clear. */
const ANIME_FACE_PX = 700;
function drawAnimeFace(c, style, eyeColor, expression, gleams, side = -1) {
  const B = ANIME_FACE_BOX, A = ANIME_HEAD, k = ANIME_FACE_PX;
  c.width = Math.round((B.x1 - B.x0) * k); c.height = Math.round((B.y1 - B.y0) * k);
  const g = c.getContext('2d');
  const X = x => (x - B.x0) * k, Y = y => (B.y1 - y) * k, P = ([x, y]) => [X(x), Y(y)];
  const ink = '#2b1d24';
  // The iris from its one colour: dark under the lashes, which shade it,
  // light at the bottom where the light comes through; the pupil darker still.
  const rgb = hexToRgb(eyeColor), mix = (to, t) => `rgb(${rgb.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
  const dark = mix([12, 10, 24], 0.6), pale = mix([255, 255, 255], 0.45);
  g.lineCap = g.lineJoin = 'round';
  for (const sx of [-1, 1]) {
    const e = animeEyeShape(style, sx, expression), E = e.E;
    const path = (f, t0, t1, n, move = true) => {
      for (let i = 0; i <= n; i++) g[i || !move ? 'lineTo' : 'moveTo'](...P(f(t0 + (t1 - t0) * i / n)));
    };
    const opening = () => { g.beginPath(); path(e.upper, 0, Math.PI, 24); path(e.lower, Math.PI, 0, 24, false); g.closePath(); };
    if (gleams) {
      // One light, so the gleams are on the same side in both eyes: the big
      // one high toward the light, the small ones low on the other side -
      // inside the eye, which a smile or a frown may have narrowed.
      g.save(); opening(); g.clip();
      g.fillStyle = '#fff';
      E.gleams.forEach((gl, i) => {
        const [x, y] = P(e.gleam(gl, side)), r = gl[2];
        g.beginPath(); g.ellipse(x, y, r * (i ? 1 : 0.9) * k, r * (i ? 1 : 1.1) * k, 0, 0, 7); g.fill();
      });
      g.restore();
      continue;
    }
    // The white, and inside it the iris - tall, its top under the lash line -
    // and the pupil.
    g.save();
    opening();
    g.fillStyle = '#fbf8f6'; g.fill(); g.clip();
    const grad = g.createLinearGradient(0, Y(e.ey + E.irisB), 0, Y(e.ey - E.irisB));
    grad.addColorStop(0, dark); grad.addColorStop(0.55, eyeColor); grad.addColorStop(1, pale);
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(X(e.ex), Y(e.ey - 0.01), E.irisA * k, E.irisB * k, 0, 0, 7); g.fill();
    g.fillStyle = mix([8, 6, 16], 0.85);
    g.beginPath(); g.ellipse(X(e.ex), Y(e.ey - 0.005), E.irisA * 0.45 * k, E.irisB * 0.5 * k, 0, 0, 7); g.fill();
    g.strokeStyle = dark; g.lineWidth = 0.008 * k;
    g.beginPath(); g.ellipse(X(e.ex), Y(e.ey - 0.01), E.irisA * k, E.irisB * k, 0, 0, 7); g.stroke();
    g.restore();
    // The upper lash line - the heaviest line of the face: its weight from
    // the style, thick at the outer corner and thinning to the inner, pushed
    // outward from the eye's middle.
    g.fillStyle = ink;
    g.beginPath();
    const ts = Array.from({ length: 25 }, (_, i) => Math.PI * i / 24);
    ts.forEach(t => g.lineTo(...P(e.upper(t))));
    for (const t of [...ts].reverse()) {
      const [px, py] = e.upper(t), nx = px - e.ex, ny = py - e.ey + 0.02, l = Math.hypot(nx, ny) || 1;
      g.lineTo(...P([px + nx / l * e.weight(t), py + ny / l * e.weight(t)]));
    }
    g.closePath(); g.fill();
    // Its flick past the outer corner - a wedge from the line's thick end.
    const [cx, cy] = e.corner, w = e.weight(0);
    g.beginPath(); g.moveTo(...P([cx, cy + w * 0.9])); g.lineTo(...P(e.flick)); g.lineTo(...P([cx, cy - w * 0.15])); g.closePath(); g.fill();
    // Separate lashes past the corner, where the style has them.
    for (let i = 0; i < (E.lashes || 0); i++) {
      const t = (0.1 + 0.13 * i) * Math.PI, [bx, by] = e.upper(t), len = 0.055 - 0.01 * i;
      const ox = sx * (0.6 - 0.15 * i), oy = 0.8, l = Math.hypot(ox, oy);
      g.beginPath();
      g.moveTo(...P([bx - sx * 0.012, by])); g.lineTo(...P([bx + ox / l * len, by + oy / l * len])); g.lineTo(...P([bx + sx * 0.012, by]));
      g.closePath(); g.fill();
    }
    // The lower lid: a short, light stroke on the outer part.
    g.strokeStyle = ink; g.lineWidth = 0.009 * k * Math.max(0.7, E.lash); g.globalAlpha = 0.7;
    g.beginPath(); path(e.lower, E.lower[0] * Math.PI, E.lower[1] * Math.PI, 10); g.stroke(); g.globalAlpha = 1;
    // The brow (animeEyeShape()'s): the style's height, the expression's tilt.
    g.lineWidth = 0.014 * k * e.X.brow[3];
    g.beginPath(); path(e.brow, 0, 1, 12); g.stroke();
    // Tears well along the lower lid and one runs from its outer end.
    if (e.X.mark === 'tears') {
      const [tx, ty] = e.lower(0.3 * Math.PI);
      g.strokeStyle = 'rgba(150, 205, 240, 0.9)'; g.lineWidth = 0.02 * k;
      g.beginPath(); path(e.lower, 0.12 * Math.PI, 0.7 * Math.PI, 10); g.stroke();
      g.fillStyle = 'rgba(150, 205, 240, 0.95)';
      g.beginPath(); g.moveTo(...P([tx, ty - 0.02]));
      g.quadraticCurveTo(...P([tx + sx * 0.035, ty - 0.1]), ...P([tx, ty - 0.12]));
      g.quadraticCurveTo(...P([tx - sx * 0.035, ty - 0.1]), ...P([tx, ty - 0.02]));
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(X(tx - sx * 0.008), Y(ty - 0.09), 0.007 * k, 0.012 * k, 0, 0, 7); g.fill();
    }
    // The blush: a soft pink patch under the eye, hatched across.
    if (e.X.mark === 'blush') {
      const bx = e.ex + sx * 0.03, by = e.ey - 0.21;
      g.fillStyle = 'rgba(236, 120, 140, 0.35)';
      g.beginPath(); g.ellipse(X(bx), Y(by), 0.12 * k, 0.045 * k, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(214, 84, 110, 0.8)'; g.lineWidth = 0.008 * k;
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(X(bx + i * 0.05 - 0.015), Y(by - 0.02)); g.lineTo(X(bx + i * 0.05 + 0.015), Y(by + 0.02)); g.stroke();
      }
    }
    g.strokeStyle = ink;
  }
  if (!gleams) {
    // The nose: a small mark under its tip.
    g.strokeStyle = ink; g.lineWidth = 0.011 * k;
    g.beginPath(); g.moveTo(X(-0.02), Y(A.nose - 0.02)); g.lineTo(X(0.015), Y(A.nose - 0.035)); g.stroke();
    drawAnimeMouth(g, X, Y, k, animeExpression(expression), ink);
    // Anger's vein: four curved brackets round a cross, at the temple.
    if (animeExpression(expression).mark === 'vein') {
      const vx = X(0.47), vy = Y(-0.1), r = 0.05 * k;
      g.strokeStyle = '#c63a45'; g.lineWidth = 0.014 * k;
      for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2 + Math.PI / 4, cx = vx + Math.cos(a) * r, cy = vy + Math.sin(a) * r;
        g.beginPath(); g.arc(cx, cy, r * 0.7, a + Math.PI * 0.75, a + Math.PI * 1.25); g.stroke();
      }
    }
  }
  return c;
}

/* The mouth an expression (ANIME_EXPRESSIONS) makes, under the nose: anime
   draws it as one shape - a line, or an opening filled dark - not as lips. */
function drawAnimeMouth(g, X, Y, k, x, ink) {
  const m = ANIME_HEAD.mouth, P = ([a, b]) => [X(a), Y(b)];
  const inside = '#6e2a35', tongue = '#d9747f';
  const open = (edge, fill = true) => {
    g.beginPath(); edge.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(p))); g.closePath();
    if (fill) { g.fillStyle = inside; g.fill(); }
    g.strokeStyle = ink; g.lineWidth = 0.01 * k; g.stroke();
  };
  const arc = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
  g.lineWidth = 0.013 * k; g.strokeStyle = ink;
  if (x.mouth === 'line' || x.mouth === 'frown') {
    // The line at rest curves up a touch; the frown down, shorter.
    const [w, bend] = x.mouth === 'frown' ? [0.075, -0.35] : [0.1, 0.25];
    g.beginPath();
    arc(10, u => { const t = w * (2 * u - 1); return [t, m + bend * t * t]; }).forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(p)));
    g.stroke();
  } else if (x.mouth === 'smile') {
    // Wide open, the upper edge curving up at the corners, the lower a deep
    // round - and the tongue in the bottom of it.
    const edge = [...arc(10, u => { const t = -0.12 + 0.24 * u; return [t, m + 0.02 + 1.4 * t * t]; }),
      ...arc(12, u => [0.12 * Math.cos(Math.PI * u), m + 0.04 - 0.11 * Math.sin(Math.PI * u) - 0.02 * (1 - Math.abs(Math.cos(Math.PI * u)))])];
    open(edge);
    g.save(); g.clip();
    g.fillStyle = tongue; g.beginPath(); g.ellipse(X(0), Y(m - 0.075), 0.07 * k, 0.04 * k, 0, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = ink; g.lineWidth = 0.01 * k; g.stroke();
  } else if (x.mouth === 'shout') {
    // Squared open, corners pulled down, the upper teeth a white band.
    const edge = [[-0.1, m - 0.005], [-0.05, m + 0.015], [0.05, m + 0.015], [0.1, m - 0.005], [0.07, m - 0.1], [-0.07, m - 0.1]];
    open(edge);
    g.save(); g.clip();
    g.fillStyle = '#fbf8f6'; g.fillRect(X(-0.12), Y(m + 0.02), 0.24 * k, 0.035 * k);
    g.restore();
    open(edge, false);
  } else if (x.mouth === 'o') {
    g.beginPath(); g.ellipse(X(0), Y(m - 0.03), 0.035 * k, 0.048 * k, 0, 0, 7);
    g.fillStyle = inside; g.fill(); g.lineWidth = 0.01 * k; g.stroke();
  }
}

/* Shared by every anime head in the scene: the face's geometry, and the
   points the angle note measures - each eye's corners, for each eye style,
   on the head and on Loomis's ball for the comparison. */
function formAnimeFace() {
  const F = forms, T = F.T;
  if (F.animeFace) return F.animeFace;
  const head = formGeometry('anime'), cache = {};
  const marks = style => {
    if (cache[style]) return cache[style];
    const m = {};
    for (const [name, sx] of [['right', -1], ['left', 1]]) {
      const e = animeEyeShape(style, sx), outer = e.upper(0), inner = e.upper(Math.PI);
      m[name] = [formFacePoint(head, ...outer), formFacePoint(head, ...inner)];
      const ball = ([x, y]) => [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
      m[name + 'Ball'] = [ball(outer), ball(inner)];
    }
    return (cache[style] = m);
  };
  return (F.animeFace = { geo: formAnimeFaceGeometry(T, head), marks });
}

/* One head's face materials: the features, lit like the head, and the
   gleams - the light itself, bright in any shadow - drawn for each side a
   light can come from. Each head has its own, since each has its own eyes;
   drawn again in place when they change. */
function formFaceMaterials(T) {
  const tex = () => { const t = new T.CanvasTexture(document.createElement('canvas')); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const mat = lit => new (lit ? T.MeshStandardMaterial : T.MeshBasicMaterial)({
    map: tex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    ...(lit ? { roughness: 0.85, metalness: 0 } : {}) });
  const fm = { key: '', features: mat(true), gleam: { '-1': mat(false), '1': mat(false) } };
  const all = () => [fm.features, fm.gleam['-1'], fm.gleam['1']];
  fm.draw = (style, eyeColor, expression) => {
    const key = [style, eyeColor, expression].join();
    if (fm.key === key) return;
    fm.key = key;
    drawAnimeFace(fm.features.map.image, style, eyeColor, expression, false);
    for (const side of [-1, 1]) drawAnimeFace(fm.gleam[side].map.image, style, eyeColor, expression, true, side);
    for (const m of all()) m.map.needsUpdate = true;
  };
  fm.dispose = () => { for (const m of all()) { m.map.dispose(); m.dispose(); } };
  return fm;
}

/* ---- the anime head's hair, in clumps. Anime draws hair as a few big
   locks, each a pointed ribbon with some thickness, over a mass that hides
   the scalp - not as strands. Each lock is swept down a path: from its root
   near the crown it lies on the skull, and past the widest point it has
   met (the back of the head, an ear, a cheek) it hangs straight, the way
   hair drapes. Its highlight is the ring anime paints - see the ring in
   formHairMaterial() (js/forms.js), which reads `hairT` and `hairShift`. */
const HAIR_STYLES = {
  none:  { label: 'None' },
  short: { label: 'Short', side: -0.5, back: -0.55, flare: 0.04, under: 0, ahoge: true },
  bob:   { label: 'Bob', side: -1.1, back: -1.05, flare: 0.1, under: 0.14 },
  long:  { label: 'Long', side: -1.95, back: -2.15, flare: 0.16, under: 0.05 },
};
// Named as Generate's Hair colour row names them, so the head's hair can be
// asked for there by name.
const HAIR_COLOURS = {
  black: '#2d2a36', brown: '#6e4a37', blonde: '#ecc87e', red: '#b9453b', orange: '#e38a45', pink: '#f2a7c0',
  purple: '#8b6cc2', silver: '#c8ccd8', white: '#f2efe8', blue: '#5073c6', green: '#62a172',
};
// The anime head's eyes, named as Generate's Eyes row names them - blue,
// as the face was first drawn.
const EYE_COLOURS = {
  blue: '#3f6fb5', aqua: '#3fb0c0', green: '#4f9a5c', brown: '#7a4b2f', red: '#b8333a', purple: '#7b55b8',
  yellow: '#d9a82e', pink: '#e07aa6', grey: '#8a8f99', black: '#2e2a33',
};
// The named colour nearest to any other - from a character sheet, say - in
// OKLab, where near means looks near.
const hairColourName = hex => nearestColourName(hex, HAIR_COLOURS);
const eyeColourName = hex => nearestColourName(hex, EYE_COLOURS);
function nearestColourName(hex, table) {
  const lab = rgb => { const [L, C, h] = rgbToOklch(rgb); return [L, C * Math.cos(h * THREE_DEG), C * Math.sin(h * THREE_DEG)]; };
  const a = lab(hexToRgb(hex));
  let best = Object.keys(table)[0], d = Infinity;
  for (const [name, h] of Object.entries(table)) {
    const b = lab(hexToRgb(h)), e = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (e < d) { d = e; best = name; }
  }
  return best;
}

/* How far the head reaches from its upright axis, at any angle round it
   and height: the most of any of its points in each of a grid of cells,
   looked up between cells. Gaps in the grid (where the jaw stretched the
   sphere's rows apart) are filled from the cells above and below. */
function formHeadReach(head) {
  const NA = 72, NY = 64, Y0 = -1.5, Y1 = 1.02, pos = head.getAttribute('position');
  const R = new Float32Array(NA * NY).fill(-1);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const i = Math.round((Math.atan2(x, z) + Math.PI) / (2 * Math.PI) * NA) % NA;
    const j = Math.round((y - Y0) / (Y1 - Y0) * (NY - 1));
    if (j >= 0 && j < NY) R[j * NA + i] = Math.max(R[j * NA + i], Math.hypot(x, z));
  }
  for (let i = 0; i < NA; i++) {
    for (let j = 0; j < NY; j++) {
      if (R[j * NA + i] >= 0) continue;
      let a = j - 1, b = j + 1;
      while (a >= 0 && R[a * NA + i] < 0) a--;
      while (b < NY && R[b * NA + i] < 0) b++;
      const ra = a >= 0 ? R[a * NA + i] : 0, rb = b < NY ? R[b * NA + i] : 0;
      R[j * NA + i] = a < 0 ? rb : b >= NY ? ra : ra + (rb - ra) * (j - a) / (b - a);
    }
  }
  return (az, y) => {
    const fi = ((az + Math.PI) / (2 * Math.PI) * NA % NA + NA) % NA;
    const fj = Math.min(Math.max((y - Y0) / (Y1 - Y0) * (NY - 1), 0), NY - 1);
    const i0 = Math.floor(fi), i1 = (i0 + 1) % NA, j0 = Math.floor(fj), j1 = Math.min(j0 + 1, NY - 1);
    const u = fi - i0, t = fj - j0, at = (i, j) => R[j * NA + i];
    return (at(i0, j0) * (1 - u) + at(i1, j0) * u) * (1 - t) + (at(i0, j1) * (1 - u) + at(i1, j1) * u) * t;
  };
}

// Out from the head at a point on or over it: from its middle above the
// ears, straight out sideways below - where the hair hangs.
const hairOut = (T, p) => new T.Vector3(p.x, Math.max(p.y, 0), p.z).normalize();

/* The locks of one style, as { az (degrees round from the face, + to the
   head's left), root, tip (heights), w (half-width), curl (how far the tip
   swings round, degrees), layer (how far over the others it lies) } - or,
   for the one that stands up, `path`: the points it runs through. */
function hairLocks(style) {
  const S = HAIR_STYLES[style], locks = [];
  // Seeded, so a style is always the same hair.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // The fringe, from the crown over the forehead. The tips stop above the
  // eyes where the eyes are, reach between them in the middle, and the two
  // outermost frame the face down to the cheek.
  const fringe = [[-62, -0.62], [-46, -0.14], [-32, -0.1], [-19, -0.16], [-7, -0.3], [6, -0.24], [18, -0.12],
    [31, -0.16], [45, -0.08], [62, -0.62]];
  for (const [az, tip] of fringe) {
    locks.push({ az, root: 0.97, tip: style === 'short' && Math.abs(az) > 55 ? -0.3 : tip, w: 0.16 + rnd() * 0.04,
      curl: -Math.sign(az) * (4 + rnd() * 6), layer: 0.085 + rnd() * 0.012, under: 0.05 });
  }
  // The sides, over the ears.
  for (const sx of [-1, 1]) {
    for (const [az, dy] of [[72, 0], [86, -0.1], [100, 0.02]]) {
      locks.push({ az: sx * az, root: 0.9, tip: S.side + dy + rnd() * 0.1, w: 0.23, curl: sx * (6 + rnd() * 6),
        layer: 0.065 + rnd() * 0.012, flare: S.flare, under: S.under });
    }
  }
  // The back, fanned from the crown.
  for (let k = 0; k < 13; k++) {
    const az = 112 + k * 136 / 12;
    locks.push({ az, root: 0.92, tip: S.back + (rnd() - 0.5) * 0.18 - (k % 2) * 0.08, w: 0.25, curl: (rnd() - 0.5) * 16,
      layer: 0.06 + (k % 2) * 0.014, flare: S.flare, under: S.under });
  }
  // The crown: short locks all round the top, over the roots of the rest -
  // what gives the top of the head its layered, pointed outline.
  for (let k = 0; k < 10; k++) {
    const az = -162 + k * 36;
    locks.push({ az, root: 1, tip: 0.3 + rnd() * 0.25, w: 0.25, curl: (rnd() - 0.5) * 20, layer: 0.1 });
  }
  // The ahoge: the one lock that stands up off the crown.
  if (S.ahoge) locks.push({ path: [[0, 0.98, -0.05], [0.02, 1.18, 0.02], [0.08, 1.3, 0.2], [0.16, 1.24, 0.38]], w: 0.06 });
  return locks;
}

function formAnimeHairGeometry(T, style) {
  const head = formGeometry('anime'), reach = formHeadReach(head);
  const P = [], N = [], TA = [], SH = [], U = [], I = [];
  const K = 9, M = 30; // round each lock, and along it
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* One lock swept along `pts` (root to tip): a lens-shaped cross-section,
     flatter against the head, narrowing to a point at each end. hairShift
     is the ring's offset: a little per lock, more toward its edges - which
     breaks the ring into the sawtooth anime draws. */
  const sweep = (pts, w0, shift0) => {
    const base = P.length / 3, n = pts.length;
    for (let s = 0; s < n; s++) {
      const t = s / (n - 1), p = pts[s];
      const tan = pts[Math.min(s + 1, n - 1)].clone().sub(pts[Math.max(s - 1, 0)]).normalize();
      const side = new T.Vector3().crossVectors(tan, hairOut(T, p)).normalize();
      const out = new T.Vector3().crossVectors(side, tan).normalize();
      const w = Math.max(w0 * Math.min(1, t / 0.12) * (1 - t ** 1.8), 0.002), h = w * 0.42;
      for (let k = 0; k < K; k++) {
        const a = 2 * Math.PI * k / K, c = Math.cos(a), sn = Math.sin(a);
        // The side against the head is flatter than the side away from it.
        const q = p.clone().addScaledVector(side, w * c).addScaledVector(out, h * sn * (sn < 0 ? 0.5 : 1));
        P.push(q.x, q.y, q.z);
        TA.push(tan.x, tan.y, tan.z);
        SH.push(shift0 + 0.22 * Math.abs(c));
        U.push(k / K, t);
      }
    }
    for (let s = 0; s < n - 1; s++) for (let k = 0; k < K; k++) {
      const a = base + s * K + k, b = base + s * K + (k + 1) % K, c = a + K, d = b + K;
      I.push(a, c, b, b, c, d);
    }
  };

  /* A lock's path: down from its root, lying on the head until it passes
     the widest point so far, then hanging - flaring out a little and, for
     a bob, turning under at the ends. Worked out finely, then spaced evenly
     along its length so the crown's steep start gets as many rings as the
     long fall. */
  const path = L => {
    const raw = [];
    let most = 0;
    for (let k = 0; k <= 200; k++) {
      const t = k / 200, y = L.root + (L.tip - L.root) * t;
      const az = (L.az + (L.curl || 0) * t * t) * THREE_DEG;
      const r = reach(az, y);
      most = Math.max(most, r);
      // Below the cheek the hair is off the head: it flares, then turns under.
      const hang = Math.max(0, -0.35 - y);
      const off = L.layer + (L.flare || 0) * Math.min(hang, 0.8) - (L.under || 0) * t ** 6;
      const p0 = new T.Vector3(most * Math.sin(az), y, most * Math.cos(az));
      raw.push(p0.addScaledVector(hairOut(T, p0), Math.max(off, 0.012)));
    }
    return spaced(raw);
  };
  const spaced = raw => {
    const len = [0];
    for (let k = 1; k < raw.length; k++) len.push(len[k - 1] + raw[k].distanceTo(raw[k - 1]));
    const out = [];
    for (let s = 0, k = 0; s < M; s++) {
      const want = len[len.length - 1] * s / (M - 1);
      while (k < raw.length - 2 && len[k + 1] < want) k++;
      const f = (want - len[k]) / Math.max(len[k + 1] - len[k], 1e-9);
      out.push(raw[k].clone().lerp(raw[k + 1], Math.min(Math.max(f, 0), 1)));
    }
    return out;
  };

  for (const L of hairLocks(style)) {
    const pts = L.path
      ? spaced(new T.CatmullRomCurve3(L.path.map(q => new T.Vector3(...q))).getPoints(200))
      : path(L);
    sweep(pts, L.w, (rnd() - 0.5) * 0.16);
  }

  /* The mass under the locks: the scalp, a little out from the head, down
     to the hairline - high on the forehead, over the ears at the sides,
     the nape at the back. Its "strands" run down it, like the locks'. */
  const A = 96, J = 30, base = P.length / 3, S = HAIR_STYLES[style];
  const line = az => {
    const c = Math.cos(az);
    return c > 0 ? -0.32 + 0.82 * c ** 1.5 : -0.32 + (S.back < -1 ? -0.5 : -0.3) * -c;
  };
  for (let i = 0; i < A; i++) {
    const az = 2 * Math.PI * i / A - Math.PI, bottom = Math.acos(Math.max(-1, line(az)));
    let most = 0;
    const col = [];
    for (let j = 0; j < J; j++) {
      const y = Math.cos(bottom * j / (J - 1));
      most = Math.max(most, reach(az, y));
      const p0 = new T.Vector3(most * Math.sin(az), y, most * Math.cos(az));
      col.push(p0.addScaledVector(hairOut(T, p0), 0.05));
    }
    col.forEach((q, j) => {
      const d = col[Math.min(j + 1, J - 1)].clone().sub(col[Math.max(j - 1, 0)]).normalize();
      P.push(q.x, q.y, q.z);
      TA.push(d.x, d.y, d.z);
      SH.push(0);
      U.push(i / A, j / (J - 1));
    });
  }
  for (let i = 0; i < A; i++) for (let j = 0; j < J - 1; j++) {
    const a = base + i * J + j, b = base + ((i + 1) % A) * J + j;
    I.push(a, a + 1, b, b, a + 1, b + 1);
  }

  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(U, 2));
  g.setAttribute('hairT', new T.Float32BufferAttribute(TA, 3));
  g.setAttribute('hairShift', new T.Float32BufferAttribute(SH, 1));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/* ---- the figure. A wooden mannequin, about eight heads tall (4 units -
   twice a cube), jointed where a real one is. Each row is a joint: its
   parent (null: the pelvis, which is the figure itself), where it sits in
   the parent's frame standing straight, and the parts that hang off it.
   Its own frame is the parent's at rest, so every joint bends the same way:
   bend is about its X (forward and back), twist about its length, lean
   about Z (out to the side). Left is the figure's own left - +x, since it
   faces the camera's default side. */
const rigEll = (at, size) => ({ geo: 'sphere', at, size });
const rigBall = (at, r) => ({ geo: 'sphere', at, size: [r, r, r] });
const rigBox = (at, size) => ({ geo: 'box', at, size });
// A limb: a capsule running `len` down from the joint (up when dir is 1).
const rigLimb = (len, r, dir = -1) => ({ geo: `limb:${len}:${r}`, at: [0, dir * len / 2, 0], size: [1, 1, 1] });
const FORM_RIG_PELVIS = [rigEll([0, 0.02, 0], [0.33, 0.2, 0.2])];
const FORM_RIG = [
  ['spine', null, [0, 0.12, 0], 'Waist', [rigEll([0, 0.2, 0], [0.27, 0.24, 0.18])]],
  ['chest', 'spine', [0, 0.38, 0], 'Chest', [rigEll([0, 0.32, 0], [0.36, 0.38, 0.22])]],
  ['neck', 'chest', [0, 0.72, 0], 'Neck', [rigLimb(0.2, 0.075, 1)]],
  // The nose says which way the face points - on an egg of a head, nothing
  // else does.
  ['head', 'neck', [0, 0.17, 0], 'Head', [rigEll([0, 0.25, 0.02], [0.19, 0.25, 0.22]), rigBall([0, 0.2, 0.22], 0.045)]],
  ...['L', 'R'].flatMap(side => {
    const x = side === 'L' ? 1 : -1, n = side === 'L' ? 'Left' : 'Right';
    return [
      [`upperArm.${side}`, 'chest', [0.42 * x, 0.6, 0], `${n} upper arm`, [rigBall([0, 0, 0], 0.11), rigLimb(0.62, 0.085)]],
      [`forearm.${side}`, `upperArm.${side}`, [0, -0.64, 0], `${n} forearm`, [rigBall([0, 0, 0], 0.075), rigLimb(0.56, 0.07)]],
      [`hand.${side}`, `forearm.${side}`, [0, -0.58, 0], `${n} hand`, [rigEll([0, -0.17, 0.01], [0.05, 0.17, 0.09])]],
      [`thigh.${side}`, null, [0.18 * x, -0.05, 0], `${n} thigh`, [rigBall([0, 0, 0], 0.13), rigLimb(0.9, 0.12)]],
      [`shin.${side}`, `thigh.${side}`, [0, -0.95, 0], `${n} shin`, [rigBall([0, 0, 0], 0.1), rigLimb(0.86, 0.095)]],
      [`foot.${side}`, `shin.${side}`, [0, -0.9, 0], `${n} foot`, [rigBall([0, 0, 0], 0.07), rigBox([0, -0.06, 0.09], [0.14, 0.1, 0.34])]],
    ];
  }),
];
// The builds themselves (FIGURE_BUILDS) are in js/vision.js, which loads
// first: a photo's pose is redrawn in them too (rebuildPose()).
// Which part of the body a joint is: its row in a build. The pelvis (null) is the torso's.
const FIGURE_PART = { spine: 'torso', chest: 'torso', neck: 'neck', head: 'head', upperArm: 'arm', forearm: 'arm', hand: 'hand', thigh: 'leg', shin: 'leg', foot: 'foot' };
// A joint's scale, [x, y, z], in a build and under the Proportions sliders.
function figureScale(build, joint, sc) {
  const [g, l] = (FIGURE_BUILDS[build] || FIGURE_BUILDS.real)[joint ? FIGURE_PART[joint.split('.')[0]] : 'torso'] || [1, 1];
  return [g * sc[0], l * sc[1], g * sc[2]];
}
/* Standing straight, in the figure's own frame: the top of the head, the
   soles, a head's height and how many heads the whole is. The Height slider
   stretches the head with the rest, so it never changes the count. */
function figureHeights(build, sy = 1) {
  const row = j => FORM_RIG.find(r => r[0] === j), up = (j, parent) => row(j)[2][1] * figureScale(build, parent, [1, sy, 1])[1];
  const head = row('head')[4][0], foot = row('foot.L')[4][1], hs = figureScale(build, 'head', [1, sy, 1])[1];
  const top = up('spine', null) + up('chest', 'spine') + up('neck', 'chest') + up('head', 'neck') + (head.at[1] + head.size[1]) * hs;
  const bottom = up('thigh.L', null) + up('shin.L', 'thigh.L') + up('foot.L', 'shin.L') +
    (foot.at[1] - foot.size[1] / 2) * figureScale(build, 'foot', [1, sy, 1])[1];
  const unit = 2 * head.size[1] * hs;
  return { top, bottom, unit, heads: (top - bottom) / unit };
}
// Of the joint being named, on the rig being posed - see FORM_RIGS.
const formJointLabel = (j, rig = activeFormRig() || FORM_RIGS.figure) => j ? rig.jointMap.get(j)[3] : rig.whole;

/* How far each joint goes, [min, max] per axis, for the figure's left side;
   the right mirrors it. Only random poses keep to these - your own hand is
   free to go past them, as it is in Blender. */
const FORM_RIG_LIMITS = {
  spine: [[-25, 45], [-30, 30], [-25, 25]],
  chest: [[-20, 30], [-30, 30], [-20, 20]],
  neck: [[-30, 40], [-45, 45], [-25, 25]],
  head: [[-25, 25], [-40, 40], [-20, 20]],
  upperArm: [[-170, 50], [-70, 70], [-10, 170]],
  forearm: [[-145, 0], [-80, 80], [0, 0]],
  hand: [[-60, 60], [-10, 10], [-30, 30]],
  thigh: [[-110, 30], [-35, 35], [-15, 60]],
  shin: [[0, 140], [0, 0], [0, 0]],
  foot: [[-25, 40], [-15, 15], [-15, 15]],
};
function formJointLimits(j, rig = FORM_RIGS.figure) { return rig.limits(j); }
function formFigureLimits(j) {
  const [kind, side] = j.split('.'), l = FORM_RIG_LIMITS[kind];
  // Mirrored in x: bend stays, twist and lean change sign.
  return side === 'R' ? [l[0], [-l[1][1], -l[1][0]], [-l[2][1], -l[2][0]]] : l;
}

// The poses a drawing class starts from. Random poses are these, shaken.
const FORM_POSES = {
  stand: { label: 'Stand', pose: { 'upperArm.L': [0, 0, 8], 'upperArm.R': [0, 0, -8], 'forearm.L': [-12, 0, 0], 'forearm.R': [-12, 0, 0] } },
  contra: { label: 'Contrapposto', pose: {
    spine: [0, 0, 5], chest: [0, -6, 5], neck: [0, 0, -5], head: [3, 12, -4],
    'thigh.L': [-14, 0, 5], 'shin.L': [26, 0, 0], 'foot.L': [8, 0, 0], 'thigh.R': [0, 0, -2],
    'upperArm.L': [4, 0, 10], 'forearm.L': [-18, 0, 0], 'upperArm.R': [0, 0, -6], 'forearm.R': [-20, 0, 0] } },
  walk: { label: 'Walk', pose: {
    spine: [4, 0, 0], chest: [0, 10, 0], head: [0, -8, 0],
    'thigh.L': [-28, 0, 0], 'shin.L': [12, 0, 0], 'foot.L': [-10, 0, 0],
    'thigh.R': [16, 0, 0], 'shin.R': [34, 0, 0], 'foot.R': [18, 0, 0],
    'upperArm.L': [24, 0, 6], 'forearm.L': [-12, 0, 0], 'upperArm.R': [-26, 0, -6], 'forearm.R': [-34, 0, 0] } },
  kneel: { label: 'Kneel', pose: {
    spine: [8, 0, 0], head: [10, 0, 0],
    'thigh.L': [-88, 0, 4], 'shin.L': [88, 0, 0], 'thigh.R': [5, 0, -2], 'shin.R': [95, 0, 0], 'foot.R': [35, 0, 0],
    'upperArm.L': [-30, 0, 10], 'forearm.L': [-60, 0, 0], 'upperArm.R': [0, 0, -8], 'forearm.R': [-15, 0, 0] } },
  sit: { label: 'Sit', pose: {
    spine: [-6, 0, 0], head: [8, 0, 0],
    'thigh.L': [-88, 0, 6], 'foot.L': [-20, 0, 0], 'thigh.R': [-88, 0, -6], 'shin.R': [30, 0, 0], 'foot.R': [-10, 0, 0],
    'upperArm.L': [28, 0, 12], 'upperArm.R': [28, 0, -12], 'forearm.L': [-6, 0, 0], 'forearm.R': [-6, 0, 0] } },
  reach: { label: 'Reach', pose: {
    spine: [-6, 0, -8], chest: [-8, -10, -10], neck: [-10, 0, 0], head: [-15, 0, 0],
    'upperArm.R': [-165, 0, -8], 'forearm.R': [-8, 0, 0], 'upperArm.L': [0, 0, 18], 'forearm.L': [-20, 0, 0],
    'thigh.L': [0, 0, 8], 'thigh.R': [-4, 0, 0], 'foot.L': [30, 0, 0] } },
};

// Anything that claims to be a pose comes out as one: known joints, three
// finite angles each, nothing else.
function cleanFormPose(p, rig = FORM_RIGS.figure) {
  const out = {};
  if (p && typeof p === 'object') {
    for (const j of rig.jointMap.keys()) {
      const v = p[j];
      if (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) {
        out[j] = v.map(a => Math.min(Math.max(Math.round(a * 10) / 10, -180), 180));
      }
    }
  }
  return out;
}

// The figure seen in a mirror: left and right trade places, and every turn
// runs the other way (bend is about the x axis, which the mirror keeps).
function mirrorFormPose(o) {
  const pose = {};
  for (const [j, [b, t, l]] of Object.entries(o.pose)) {
    const [kind, side] = j.split('.');
    pose[side ? `${kind}.${side === 'L' ? 'R' : 'L'}` : j] = [b, -t || 0, -l || 0];
  }
  o.pose = pose;
  o.ry = wrap180(-o.ry) || 0; o.rz = -o.rz || 0;
}

// One of the class poses, shaken - every joint moved a little, inside what
// it can do - and as often as not seen in a mirror.
function randomFormPose(rig = FORM_RIGS.figure) {
  const keys = rig.random;
  const base = rig.poses[keys[Math.floor(Math.random() * keys.length)]].pose;
  const pose = {};
  for (const j of rig.jointMap.keys()) {
    const v = base[j] || [0, 0, 0], lim = formJointLimits(j, rig);
    pose[j] = v.map((a, k) => {
      const shake = (Math.random() * 2 - 1) * rig.shake[k];
      return Math.round(Math.min(Math.max(a + shake, lim[k][0]), lim[k][1]));
    });
  }
  const o = { pose, ry: 0, rz: 0 };
  if (rig.mirror && Math.random() < 0.5) mirrorFormPose(o);
  return o.pose;
}

/* ---- the hand. A mannequin hand, a right one, palm facing +z and fingers
   up - the hand held up to show its palm. Built the way a drawing book
   constructs one: the palm a box (a hand drawn as a flat paddle never turns
   convincingly), the ball of the thumb a mass of its own, each finger three
   cylinders that shorten toward the tip, and the knuckles on an arc, not a
   line - the middle finger's highest. Bend closes a joint toward the palm,
   lean spreads a finger sideways.

   The thumb is the one joint that does not sit straight in its parent: it
   comes off the side of the palm at an angle and turned to face across it.
   That is the sixth entry of its row, a rest pose held by the fixed pivot
   buildFormRig() puts above every joint - so a zero pose is a relaxed
   thumb, not one standing straight up beside the fingers, and bending it
   runs across the palm the way a real one does. */
const FORM_HAND_ROOT = [rigEll([0, -0.5, 0], [0.3, 0.62, 0.18])]; // the wrist end of the forearm
const FORM_HAND_JOINTS = [
  ['wrist', null, [0, 0.02, 0], 'Wrist', [rigBox([0, 0.5, 0], [0.84, 0.92, 0.26]), rigEll([0.2, 0.3, 0.07], [0.22, 0.3, 0.14])]],
  ['thumb1', 'wrist', [0.3, 0.18, 0.08], 'Thumb base', [rigBall([0, 0, 0], 0.11), rigLimb(0.44, 0.11, 1)], [20, -35, -38]],
  ['thumb2', 'thumb1', [0, 0.44, 0], 'Thumb middle', [rigLimb(0.32, 0.092, 1)]],
  ['thumb3', 'thumb2', [0, 0.32, 0], 'Thumb tip', [rigLimb(0.27, 0.082, 1)]],
  ...[['index', 'Index', 0.3, 0.95, [0.5, 0.3, 0.24], 0.085],
      ['middle', 'Middle', 0.1, 0.98, [0.56, 0.34, 0.26], 0.088],
      ['ring', 'Ring', -0.1, 0.96, [0.52, 0.32, 0.25], 0.083],
      ['little', 'Little', -0.3, 0.9, [0.4, 0.25, 0.21], 0.074]].flatMap(([k, n, x, y, [a, b, c], r]) => [
    [`${k}1`, 'wrist', [x, y, 0], `${n} knuckle`, [rigBall([0, 0, 0], r * 1.12), rigLimb(a, r, 1)]],
    [`${k}2`, `${k}1`, [0, a, 0], `${n} middle joint`, [rigLimb(b, r * 0.93, 1)]],
    [`${k}3`, `${k}2`, [0, b, 0], `${n} tip joint`, [rigLimb(c, r * 0.86, 1)]],
  ]),
];
const FORM_HAND_LIMITS = {
  wrist: [[-70, 70], [-80, 80], [-25, 25]],
  thumb1: [[-20, 50], [-20, 20], [-20, 45]], thumb2: [[0, 60], [0, 0], [0, 0]], thumb3: [[-10, 80], [0, 0], [0, 0]],
  finger1: [[-20, 90], [-5, 5], [-18, 18]], finger2: [[0, 105], [0, 0], [0, 0]], finger3: [[0, 80], [0, 0], [0, 0]],
};
// { finger: [knuckle, middle, tip, spread] }, thumb [base, middle, tip] as
// full [bend, twist, lean] triples, and the wrist.
function handPose(fingers, thumb, wrist) {
  const p = {};
  for (const [k, [a, b, c, s = 0]] of Object.entries(fingers)) {
    p[k + '1'] = [a, 0, s]; p[k + '2'] = [b, 0, 0]; p[k + '3'] = [c, 0, 0];
  }
  if (thumb) [p.thumb1, p.thumb2, p.thumb3] = thumb;
  if (wrist) p.wrist = wrist;
  return p;
}
const FORM_HAND_POSES = {
  relaxed: { label: 'Relaxed', pose: handPose({ index: [12, 18, 10, -3], middle: [18, 24, 12], ring: [24, 30, 14, 3], little: [30, 34, 16, 6] },
    [[8, 0, 0], [10, 0, 0], [10, 0, 0]]) },
  spread: { label: 'Spread', pose: handPose({ index: [-5, 0, 0, -14], middle: [-5, 0, 0, -2], ring: [-5, 0, 0, 10], little: [-5, 0, 0, 20] },
    [[-10, 0, -20], [0, 0, 0], [0, 0, 0]], [-15, 0, 0]) },
  fist: { label: 'Fist', pose: handPose({ index: [85, 100, 65], middle: [88, 100, 65], ring: [90, 100, 65], little: [90, 100, 65] },
    [[40, 0, 42], [30, 0, 0], [30, 0, 0]]) },
  point: { label: 'Point', pose: handPose({ index: [0, 0, 0], middle: [88, 100, 65], ring: [90, 100, 65], little: [90, 100, 65] },
    [[38, 0, 40], [30, 0, 0], [25, 0, 0]]) },
  pinch: { label: 'Pinch', pose: handPose({ index: [40, 55, 35], middle: [30, 40, 20], ring: [28, 36, 18], little: [26, 34, 16] },
    [[30, 0, 12], [20, 0, 0], [15, 0, 0]]) },
  grip: { label: 'Grip', pose: handPose({ index: [50, 60, 40], middle: [55, 62, 40], ring: [58, 64, 40], little: [60, 66, 40] },
    [[30, 0, 20], [15, 0, 0], [10, 0, 0]]) },
};

/* Every posable form, by the key its FORM_SHAPES entry names in `rig`.
   root: the parts on the form itself; joints: FORM_RIG-style rows; limits:
   a joint's [min, max] per axis, for random poses; random: the poses those
   start from; shake: how far each axis is shaken; mirror: whether a mirror
   image is still the same thing (a figure yes - a right hand mirrored is a
   left one this model cannot be). */
const FORM_RIGS = {
  figure: { root: FORM_RIG_PELVIS, joints: FORM_RIG, limits: formFigureLimits, poses: FORM_POSES,
            random: ['stand', 'contra', 'walk', 'kneel', 'reach'], shake: [14, 10, 14],
            whole: 'Whole figure', mirror: true, reset: 'Standing straight, arms down' },
  hand:   { root: FORM_HAND_ROOT, joints: FORM_HAND_JOINTS, poses: FORM_HAND_POSES,
            limits: j => FORM_HAND_LIMITS[j.replace(/^(index|middle|ring|little)(\d)$/, 'finger$2')],
            random: Object.keys(FORM_HAND_POSES), shake: [14, 4, 5],
            whole: 'Whole hand', mirror: false, reset: 'Open and flat' },
};
for (const r of Object.values(FORM_RIGS)) r.jointMap = new Map(r.joints.map(j => [j[0], j]));
const formRigOf = shape => FORM_RIGS[formShapeDef(shape).rig] || null;

/* The zones view. Colours are arbitrary but ordered warm-to-cool the way the
   families run from the light round to the shadow side; the thresholds are
   on the cosine between surface and light, with the terminator a narrow band
   either side of zero - where the form turns away from the light. Cast
   shadow is separate from all of them: a surface that faces the light but is
   blocked from it, which is the one thing a dot product alone cannot see. */
const FORM_ZONES = [
  ['Highlight',       '#ffffff'],
  ['Light',           '#f5dd8c'],
  ['Halftone',        '#e09a52'],
  ['Terminator',      '#8c3328'],
  ['Core shadow',     '#482e5a'],
  ['Reflected light', '#5580b8'],
  ['Cast shadow',     '#18181f'],
];
