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
  ambient: 0.18, bounce: 0.3,
  bg: '#2a2a30', groundColor: '#7a746a', ground: true,
  focal: 50, yaw: 35, pitch: 22, zoom: 1,
  lines: false, horizon: false, lightMarker: true, vp: false, ellipses: false, floorGrid: false, zones: false,
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
