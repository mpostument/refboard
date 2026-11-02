/* refboard - 3D forms: the plain solids and their light.
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
  fillOn: false, fillShadow: true, fillAz: 60, fillEl: 15, fillStrength: 0.35, fillColor: '#d6e4ff',
  ambient: 0.18, bounce: 0.3, occlusion: 1,
  bg: '#2a2a30', groundColor: '#7a746a', ground: true,
  focal: 50, yaw: 35, pitch: 22, zoom: 1,
  // The camera's roll (a Dutch angle) in degrees, and the fisheye lens -
  // see ANIME_SHOTS and renderFisheye().
  roll: 0, fisheye: false,
  lines: false, horizon: false, lightMarker: true, vp: false, ellipses: false, floorGrid: false, zones: false, hatch: false,
  count: 10, anyShape: true, memorySecs: 15,
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
};

// The rigs (figure, hand, foot) are gone: the forms are the plain solids.
const FORM_RIGS = {};

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
