/* refboard - 3D forms: the scene, saving and sharing, the overlay, handles, gizmo, drills, panel.
   One of the classic scripts index.html loads in order; see the note there. */
"use strict";

/* ---- state */
let forms = null;        // three.js objects; null until the view is first opened
let formsLoading = null; // the in-flight import, so two quick clicks load once
let formScene = null;    // the scene being edited, persisted to FORMS_KEY
let formUrls = [];       // blob: URLs handed to the last session, revoked on the next

const activeFormObject = () => formScene.objects[formScene.active];
const activeFormRig = () => formScene ? formRigOf(activeFormObject().shape) : null;
// Panel keys are either the scene's own or the selected object's.
const formVal = k => FORM_OBJ_KEYS.includes(k) ? activeFormObject()[k] : formScene[k];
function setFormVal(k, v) {
  if (FORM_OBJ_KEYS.includes(k)) activeFormObject()[k] = v; else formScene[k] = v;
}

const isFormShape = shape => !!FORM_SHAPES[shape] || !!(forms && forms.models[shape]);

/* Anything that might be a scene - localStorage, a saved scene, a share link -
   comes through here, so a stale or hand-edited one can only ever produce a
   valid scene. The first version saved a single form's fields at the top
   level; those become the one object they described. */
function normalizeFormScene(raw) {
  const s = defaultFormScene();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of Object.keys(s)) if (k !== 'objects' && typeof raw[k] === typeof s[k]) s[k] = raw[k];
  const list = Array.isArray(raw.objects) ? raw.objects : ('shape' in raw ? [raw] : []);
  const objs = list.slice(0, FORM_MAX_OBJECTS).map(o => {
    const n = { ...FORM_OBJECT_DEFAULTS };
    for (const k of FORM_OBJ_KEYS) if (o && typeof o[k] === typeof n[k]) n[k] = o[k];
    // A loaded model lives only in memory; after a reload its object falls
    // back to a cube rather than vanishing and shifting every index after it.
    if (!isFormShape(n.shape)) n.shape = 'cube';
    if (!FORM_FINISHES[n.finish]) n.finish = 'matte';
    if (!HAIR_STYLES[n.hair]) n.hair = FORM_OBJECT_DEFAULTS.hair;
    if (!/^#[0-9a-f]{6}$/i.test(n.hairColor)) n.hairColor = FORM_OBJECT_DEFAULTS.hairColor;
    if (!ANIME_EYES[n.eyes]) n.eyes = FORM_OBJECT_DEFAULTS.eyes;
    if (!/^#[0-9a-f]{6}$/i.test(n.eyeColor)) n.eyeColor = FORM_OBJECT_DEFAULTS.eyeColor;
    if (!ANIME_EXPRESSIONS[n.expression]) n.expression = FORM_OBJECT_DEFAULTS.expression;
    if (!FIGURE_BUILDS[n.build]) n.build = FORM_OBJECT_DEFAULTS.build;
    n.pose = cleanFormPose(n.pose, FORM_RIGS[(FORM_SHAPES[n.shape] || {}).rig] || FORM_RIGS.figure);
    return n;
  });
  if (objs.length) s.objects = objs;
  s.roll = Math.min(Math.max(Math.round(s.roll) || 0, -45), 45);
  s.active = Math.min(Math.max(s.active | 0, 0), s.objects.length - 1);
  s.lightOn = Math.min(Math.max(s.lightOn | 0, 0), s.objects.length - 1);
  return s;
}

function loadFormScene() {
  try { return normalizeFormScene(JSON.parse(localStorage.getItem(FORMS_KEY))); }
  catch { return defaultFormScene(); }
}
let formSaveTimer = null;
function saveFormScene() {
  clearTimeout(formSaveTimer);
  // A slider fires input dozens of times a second; storage only needs the end.
  formSaveTimer = setTimeout(() => {
    try { localStorage.setItem(FORMS_KEY, JSON.stringify(formScene)); } catch {}
  }, 300);
}

/* ---- share links: the whole scene in the URL fragment. Base64 of the JSON
   rather than query parameters: a scene is a nested object, and the fragment
   never reaches the server, so nothing about it is logged anywhere. Loaded
   models are left out - a link cannot carry a file. */
function formSceneLink() {
  const s = structuredClone(formScene);
  s.objects = s.objects.filter(o => FORM_SHAPES[o.shape]);
  if (!s.objects.length) s.objects = [{ ...FORM_OBJECT_DEFAULTS }];
  s.active = 0;
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(s))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.href.split('#')[0] + '#forms=' + b64;
}
function formSceneFromHash() {
  const m = /^#forms=([\w-]+)/.exec(location.hash);
  if (!m) return null;
  // Read once, then dropped from the address bar - otherwise every reload
  // would throw away what you have changed since and restore the link.
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
    return normalizeFormScene(JSON.parse(json));
  } catch { return null; }
}

/* ---- saved scenes: named copies of the whole scene, local to this browser. */
function loadSavedFormScenes() {
  try { const a = JSON.parse(localStorage.getItem(FORM_SCENES_KEY)); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function storeSavedFormScenes(a) {
  try { localStorage.setItem(FORM_SCENES_KEY, JSON.stringify(a.slice(0, 30))); } catch {}
}

async function formsInitThree() {
  const [T, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
  ]);
  // Fog (the Air) by the distance from the eye, not the depth along the line
  // of sight: the fisheye renders six views with six lines of sight, and fog
  // by depth would step where two of them meet. Distance is what air does
  // anyway. Worked out per pixel from the interpolated position: distance
  // does not interpolate straight across a triangle the way depth does, and
  // the floor is one huge square whose corners are all far away - fog from
  // them alone made the whole floor vanish into the background.
  const C = T.ShaderChunk, pos = 'varying vec3 vFogPos;';
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', pos);
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogPos = mvPosition.xyz;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', pos);
  C.fog_fragment = C.fog_fragment.replaceAll('vFogDepth', 'length( vFogPos )');
  const canvas = el('formsCanvas');
  // preserveDrawingBuffer so toBlob() always reads the frame just drawn, not a
  // buffer the compositor may already have cleared.
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  // Soft shadows that soften the way a real one does - sharp where a form
  // touches what it shadows, wider the further the shadow is thrown (see
  // formSoftShadowChunk) - need the shadow map's raw depths, to find what
  // blocks the light. Three's own PCF compares them in hardware and never
  // shows them, so the plain map is used and the filtering is ours. VSM
  // would blur more smoothly, but smears the edge of the shadow camera's
  // frustum into a faint line across the floor. Should the chunk no longer
  // have the shape this expects (a newer three), the stock PCF stays.
  const soft = formSoftShadowChunk(C.shadowmap_pars_fragment);
  if (soft) C.shadowmap_pars_fragment = soft;
  renderer.shadowMap.type = soft ? T.BasicShadowMap : T.PCFShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 4 / 3, 0.1, 1000);

  const key = new T.DirectionalLight(0xffffff, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key, key.target);
  const bulb = new T.PointLight(0xffffff, 1, 0, 2); // decay 2: physical inverse-square
  bulb.castShadow = true;
  bulb.shadow.mapSize.set(1024, 1024);
  scene.add(bulb);
  // The second light casts no shadow of its own. A fill or rim light's
  // shadow is faint in life and mostly lost in the key's, and two shadow maps
  // would be twice the cost for something a drawing rarely shows.
  const fill = new T.DirectionalLight(0xffffff, 1);
  fill.shadow.mapSize.set(1024, 1024); // half the key's: a fainter shadow, switched on only with the light
  scene.add(fill, fill.target);
  const hemi = new T.HemisphereLight(0xffffff, 0x000000, Math.PI);
  scene.add(hemi);

  // Metal and glass need something to reflect and refract, or they render
  // black. A neutral studio room, used only by those two finishes - as
  // scene.environment it would also light every matte form and quietly undo
  // what the Fill and Bounce sliders say.
  const pmrem = new T.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const ground = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new T.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  ground.receiveShadow = true;
  // Merged, never replaced: three's own defines (STANDARD) live in the same
  // object. The shared guide code reads vUv.
  ground.material.defines = { ...ground.material.defines, USE_UV: '' };
  ground.material.userData.u = formGuideUniforms(T, 1);
  ground.material.onBeforeCompile = injectFormGuides;
  scene.add(ground);
  // The floor dissolves into the background with distance - a photographer's
  // infinity cove - so it never ends in a hard edge that reads as a table.
  scene.fog = new T.Fog(0x000000, 10, 100);

  const grid = new T.GridHelper(1, 16, 0xb0a48e, 0x8a816f);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; // the forms stay centred; panning only loses them

  return { T, renderer, scene, camera, key, bulb, fill, hemi, env, ground, grid, controls,
    meshes: [], geometries: {}, models: {}, modelCount: 0, frame: null, marker: null, badges: [] };
}

/* Contour lines and the zones view, mixed in at the very end of three's own
   physical shader - after its sRGB conversion, so the line colour is plain
   sRGB and nothing about the lighting itself is touched. One function shared
   by every material (three keys compiled programs by its source, so they all
   share one program); `this` is the material, whose own uniforms it wires in.
   USE_UV makes three pass vUv through even though there is no texture. */
/* The uniforms injectFormGuides() wires in - the same set on every material,
   the floor's included, since they all compile to the one program. */
function formGuideUniforms(T, lines) {
  return {
    uLineCount: { value: new T.Vector2(lines, lines) }, uLines: { value: 0 }, uZones: { value: 0 },
    // Cel shading: the tones from celTones(), the highlight's size (0 is
    // none), and the rim - its direction in view space and how strong.
    uCel: { value: 0 }, uCelBase: { value: new T.Color() }, uCelShade: { value: new T.Color() },
    uCelHi: { value: new T.Color() }, uCelHiSize: { value: 0 },
    uCelRim: { value: new T.Color() }, uRimDir: { value: new T.Vector3(0, 0, 1) }, uRim: { value: 0 },
    uSoft: formSoftUniform(T), uBounce: formBounceUniform(T),
    // The sky's occlusion on the floor: how much of the floor's ambient light
    // it takes away (0 on every form; the floor's own is set in formsRender),
    // and the map it comes from (formOcclusionUniform).
    uFloorAO: { value: 0 }, uAOTex: formOcclusionUniform(T).tex, uAOBox: formOcclusionUniform(T).box,
    // The same for the forms: their own strength (0 where it is off), the
    // two height pictures, and how far a form looks (x), whether a floor lies
    // under them (y).
    uFormAO: { value: 0 }, uAOBot: formOcclusionUniform(T).bot, uAOTop: formOcclusionUniform(T).top,
    uAOForm: formOcclusionUniform(T).form,
    // Light thrown from one form onto another: its strength (the Bounce
    // slider's, 0 where off) and the picture of the forms' colours from above.
    uNbr: { value: 0 }, uAOTint: formOcclusionUniform(T).tint,
  };
}
// The occlusion map and where it lies on the floor: x, z of its centre and
// the width it covers. One for the whole scene, like the soft shadow's.
let formAOU = null;
const formOcclusionUniform = T => formAOU || (formAOU = {
  tex: { value: null }, box: { value: new T.Vector3(0, 0, 1) },
  bot: { value: null }, top: { value: null }, form: { value: new T.Vector2(1, 1) },
  tint: { value: null },
});

/* ---- sky occlusion. Under a ball the sky is shut out, and for some way
   around it the floor sees only part of it: the floor there is darker than
   the floor far off, in the sky's own light - a soft dark halo, darkest where
   the form touches. The key light's shadow cannot show it (a lit patch of
   floor beside the ball is as bright as one a mile off), so the sky gets a
   map of its own, and only the sky: the sun reaching the floor is not
   dimmed by what is above the floor beside it.
   The map is worked out on a square of floor round the forms, from two
   pictures of them - from below the floor, the lowest height of anything
   above each spot, and from above, the highest. From each spot of floor the
   shader then looks out in sixteen directions, a step at a time, and notes
   the highest and the lowest angle (above the horizon) at which a form is in
   the way. The share of the sky that blocks, seen as a floor sees it (light
   from straight above counts most), is sin^2(highest) - sin^2(lowest); the
   map is the average over the directions. That is exact for a ball resting
   on the floor - (1 + (d/r)^2)^-1.5 at a distance d from where it touches,
   all the way from shut at the foot to a long faint tail - and it is a wall
   for a box: half the sky at its foot. A form held up in the air shuts out
   less, since the lowest angle is not the floor. */
const FORM_AO_SIZE = 512, FORM_AO_MAP = 192;
// How far the floor looks out, in units of the forms' size u (see formsRender).
const FORM_AO_REACH = 3.5;
// And how far a form looks for another one touching it, in the same units.
const FORM_AO_FORM_REACH = 0.6;
/* The targets the pictures and the map are drawn into, and the camera that
   looks at the forms from below or from above; made once, on first use. */
function formOcclusionKit() {
  const F = forms, T = F.T;
  if (F.ao) return F.ao;
  // Only the pictures of the forms need a depth buffer: it is what keeps the
  // lowest (or the highest) surface above a spot, and not whichever was
  // drawn last. They are read at exact texels - a filter would blend a form's
  // edge with the empty floor beside it.
  const target = (size, depthBuffer, filter) => new T.WebGLRenderTarget(size, size,
    { type: T.HalfFloatType, minFilter: filter, magFilter: filter, depthBuffer });
  const quadVert = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // Height, in the red channel; alpha says whether anything is there at all.
  // gl_FragCoord.z is linear in an orthographic view: 0 at the camera, 1 at
  // its far plane; uH turns it into a height above the floor.
  const heightMat = () => new T.ShaderMaterial({
    uniforms: { uH: { value: new T.Vector2() } }, side: T.DoubleSide,
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec2 uH; void main() { gl_FragColor = vec4(gl_FragCoord.z * uH.x + uH.y, 0.0, 0.0, 1.0); }',
  });
  const ao = {
    cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    below: heightMat(), above: heightMat(),
    map: new T.ShaderMaterial({
      uniforms: { uTop: { value: null }, uBot: { value: null }, uWidth: { value: 1 }, uReach: { value: 1 } }, vertexShader: quadVert,
      fragmentShader: `uniform sampler2D uTop, uBot; uniform float uWidth, uReach; varying vec2 vUv;
        void main() {
          // The picture from above is the floor mirrored front to back: it is read flipped.
          // Where each spot starts round its circle, so sixteen directions
          // do not show as sixteen rays; the blur after takes the grain out.
          float turn = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) * 0.3926991;
          float sum = 0.0;
          for ( int k = 0; k < 16; k ++ ) {
            float a = turn + 0.3926991 * float( k );
            vec2 dir = vec2( cos( a ), sin( a ) );
            float hi = 0.0, lo = 1.5707963, seen = 0.0;
            for ( int j = 1; j <= 16; j ++ ) {
              float t = float( j ) / 16.0, s = uReach * t * t;
              vec2 uv = vUv + dir * ( s / uWidth );
              vec4 top = textureLod( uTop, vec2( uv.x, 1.0 - uv.y ), 0.0 );
              if ( top.a > 0.5 ) {
                hi = max( hi, atan( top.r, s ) );
                lo = min( lo, atan( textureLod( uBot, uv, 0.0 ).r, s ) );
                seen = 1.0;
              }
            }
            sum += seen * max( 0.0, sin( hi ) * sin( hi ) - sin( lo ) * sin( lo ) );
          }
          gl_FragColor = vec4( sum / 16.0, 0.0, 0.0, 1.0 );
        }`,
    }),
    // One pass of a nine-tap Gaussian along uStep (a uv step; tap spacing).
    blur: new T.ShaderMaterial({
      uniforms: { uTex: { value: null }, uStep: { value: new T.Vector2() } }, vertexShader: quadVert,
      fragmentShader: `uniform sampler2D uTex; uniform vec2 uStep; varying vec2 vUv;
        void main() {
          float w[5] = float[5]( 0.2042, 0.1802, 0.1238, 0.0663, 0.0276 );
          float s = w[0] * texture2D( uTex, vUv ).r;
          for ( int i = 1; i < 5; i ++ ) s += w[i] * ( texture2D( uTex, vUv + uStep * float( i ) ).r + texture2D( uTex, vUv - uStep * float( i ) ).r );
          gl_FragColor = vec4( s, 0.0, 0.0, 1.0 );
        }`,
    }),
    quadScene: new T.Scene(), quadCam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    bot: target(FORM_AO_SIZE, true, T.NearestFilter), top: target(FORM_AO_SIZE, true, T.NearestFilter),
    // The forms' own colours, seen from above (a form's flat colour, not lit).
    tint: target(FORM_AO_SIZE, true, T.NearestFilter),
    tintMats: new WeakMap(),
    raw: target(FORM_AO_MAP, false, T.LinearFilter), out: target(FORM_AO_MAP, false, T.LinearFilter),
  };
  ao.quad = new T.Mesh(new T.PlaneGeometry(2, 2), ao.map);
  ao.quad.frustumCulled = false;
  ao.quadScene.add(ao.quad);
  return (F.ao = ao);
}
/* Work out the occlusion map for the forms now in the scene: a square of
   floor centred at (cx, cz), 2 * half wide, the forms no taller than `top`,
   the floor looking out `reach` far. The result lands in ao.out and the
   floor's uniforms. Everything but the forms is hidden for the two pictures,
   the sun and lamp included: their shadow maps are not needed and would be
   drawn twice. */
function formOcclusionRender(cx, cz, half, top, reach) {
  const F = forms, T = F.T, r = F.renderer, ao = formOcclusionKit();
  // Looking from just past the floor, so a form resting on it (height 0) is
  // not clipped away by the near plane.
  const lift = Math.max(top, 0.1) * 0.02, span = top + 2 * lift;
  const shown = new Map(), keep = new Set(F.meshes);
  for (const c of F.scene.children) { shown.set(c, c.visible); c.visible = c.visible && keep.has(c); }
  const bg = F.scene.background, fog = F.scene.fog, clear = r.getClearColor(new T.Color()), clearA = r.getClearAlpha();
  F.scene.background = null; F.scene.fog = null;
  r.setClearColor(0x000000, 0);
  const look = (mat, target, y, upSign) => {
    Object.assign(ao.cam, { left: -half, right: half, top: half, bottom: -half, near: 0, far: span });
    ao.cam.position.set(cx, y, cz);
    ao.cam.up.set(0, 0, upSign);          // from below: image right is +x, up is +z; from above, up is -z
    ao.cam.lookAt(cx, y + upSign, cz);
    ao.cam.updateProjectionMatrix();
    ao.cam.updateMatrixWorld();
    F.scene.overrideMaterial = mat;
    r.setRenderTarget(target);
    r.clear();
    r.render(F.scene, ao.cam);
  };
  ao.below.uniforms.uH.value.set(span, -lift);               // height grows with the distance up from below
  look(ao.below, ao.bot, -lift, 1);
  ao.above.uniforms.uH.value.set(-span, top + lift);         // and falls with the distance down from above
  look(ao.above, ao.top, top + lift, -1);
  // The same view again in the forms' colours, for the light they throw on
  // one another: each part is drawn flat in its material's colour, and the
  // depth buffer keeps the one on top, the one the height picture holds.
  const worn = [];
  for (const root of F.meshes) root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let tm = ao.tintMats.get(o);
    if (!tm) ao.tintMats.set(o, tm = new T.ShaderMaterial({ uniforms: { uC: { value: new T.Color() } }, side: T.DoubleSide,
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uC; void main() { gl_FragColor = vec4(uC, 1.0); }' }));
    tm.uniforms.uC.value.copy(o.material.color || new T.Color(0.5, 0.5, 0.5));
    worn.push([o, o.material]);
    o.material = tm;
  });
  look(null, ao.tint, top + lift, -1);
  for (const [o, mat] of worn) o.material = mat;
  F.scene.overrideMaterial = null;
  F.scene.background = bg; F.scene.fog = fog;
  for (const [c, v] of shown) c.visible = v;
  r.setClearColor(clear, clearA);

  ao.quad.material = ao.map;
  ao.map.uniforms.uTop.value = ao.top.texture;
  ao.map.uniforms.uBot.value = ao.bot.texture;
  ao.map.uniforms.uWidth.value = half * 2;
  ao.map.uniforms.uReach.value = reach;
  r.setRenderTarget(ao.raw);
  r.render(ao.quadScene, ao.quadCam);
  // The grain of the starting angles, and the steps between samples, blurred
  // out: a nine-tap Gaussian a texel and a half apart, across then down.
  const pass = (src, dst, dx, dy) => {
    ao.quad.material = ao.blur;
    ao.blur.uniforms.uTex.value = src.texture;
    ao.blur.uniforms.uStep.value.set(dx * 1.5 / FORM_AO_MAP, dy * 1.5 / FORM_AO_MAP);
    r.setRenderTarget(dst);
    r.render(ao.quadScene, ao.quadCam);
  };
  pass(ao.raw, ao.out, 1, 0);
  pass(ao.out, ao.raw, 0, 1);
  r.setRenderTarget(null);

  const U = formOcclusionUniform(T);
  U.tex.value = ao.raw.texture;
  U.bot.value = ao.bot.texture; U.top.value = ao.top.texture; U.tint.value = ao.tint.texture;
  U.box.value.set(cx, cz, half * 2);
}
// The floor's reflected light: rgb, in linear colour, is the floor's colour
// times the Bounce slider times the light's strength; w is how high above the
// floor it fades by a factor of e. One for the whole scene, set in formsRender.
let formBounceU = null;
const formBounceUniform = T => formBounceU || (formBounceU = { value: new T.Vector4(0, 0, 0, 1) });

/* ---- soft shadows. A real shadow is sharp where the form touches what it
   shadows and spreads as it is thrown, because a light is not a point: from
   each spot of the floor, the light is a disc, and a form near the floor
   hides all of it while one high above hides only part. That is the
   penumbra, and it is why a shadow from a lamp looks soft at the far end
   and hard at the foot. Three's PCF blurs every edge by the same amount,
   with five samples, which reads as a drop shadow and shows its noise; this
   is "percentage-closer soft shadows":
     1. look around the point for what blocks the light, and how far above
        the point it is on average (the gap);
     2. the penumbra's radius is that gap times the light's apparent size;
     3. average thirty-two samples over a disc that wide.
   The receiver is treated as the plane it lies in - read off how its
   position changes from one pixel to the next - so a sample beside the
   point is compared with the plane's depth there, not the point's own.
   Without that, any tilted lit surface shadows itself the wider the disc
   gets (acne).
   How fast a sun's penumbra grows with the gap, in shadow-map uv per unit
   of its depth, is the light's own shadow.radius (see aimSunShadow): the key
   and the second light each have a camera of their own.
   uSoft: y, the widest penumbra, in texels; z, the lamp's radius, in world
   units; w, the narrowest, in texels - what keeps a hard shadow from
   stair-stepping; x is unused. One for the whole scene, set in formsRender:
   only one of the sun and the lamp is ever on. */
let formSoftU = null;
const formSoftUniform = T => formSoftU || (formSoftU = { value: new T.Vector4(0.1, 48, 0.05, 1.2) });

const FORM_SOFT_COMMON_GLSL = `
	uniform vec4 uSoft;
	float rbNoise( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
	vec2 rbDisk( int i, int n, float phi ) {
		float r = sqrt( ( float( i ) + 0.5 ) / float( n ) );
		float a = float( i ) * 2.399963229728653 + phi;
		return vec2( cos( a ), sin( a ) ) * r;
	}
`;
const FORM_SOFT_SUN_GLSL = `
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		// The receiver's plane: depth change per unit of uv. Taken before any
		// branch - derivatives are only defined where every pixel of the quad agrees.
		vec3 dx = dFdx( shadowCoord.xyz ), dy = dFdy( shadowCoord.xyz );
		float det = dx.x * dy.y - dx.y * dy.x;
		vec2 slope = abs( det ) > 1e-14 ? vec2( dx.z * dy.y - dy.z * dx.y, dy.z * dx.x - dx.z * dy.x ) / det : vec2( 0.0 );
		float shadow = 1.0;
		if ( shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 && shadowCoord.z <= 1.0 ) {
			float texel = 1.0 / shadowMapSize.x;
			float rMin = max( uSoft.w, 1.0 ) * texel, rMax = max( uSoft.y, uSoft.w ) * texel;
			float phi = rbNoise( gl_FragCoord.xy ) * 6.2831853;
			float gap = 0.0, found = 0.0;
			for ( int i = 0; i < 12; i ++ ) {
				vec2 o = rbDisk( i, 12, phi ) * rMax;
				float zr = shadowCoord.z + clamp( dot( o, slope ), - 0.02, 0.02 ) - 0.0004;
				float d = textureLod( shadowMap, shadowCoord.xy + o, 0.0 ).r;
				if ( d < zr ) { gap += zr - d; found += 1.0; }
			}
			if ( found > 0.0 ) {
				float radius = clamp( gap / found * shadowRadius, rMin, rMax );
				float lit = 0.0;
				for ( int i = 0; i < 32; i ++ ) {
					vec2 o = rbDisk( i, 32, phi + 1.0 ) * radius;
					float zr = shadowCoord.z + clamp( dot( o, slope ), - 0.02, 0.02 ) - 0.0004;
					lit += step( zr, textureLod( shadowMap, shadowCoord.xy + o, 0.0 ).r );
				}
				shadow = lit / 32.0;
			}
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
`;
// The lamp: a cube map, whose depth is stored along the major axis and not
// linearly - so each lookup is turned back into a distance before it is
// compared, and the plane is intersected along each sample's own direction.
const FORM_SOFT_LAMP_GLSL = `
	#if NUM_POINT_LIGHT_SHADOWS > 0
	float rbLinear( float d, float n, float f ) { return f * n / ( f - d * ( f - n ) ); }
	// How far along its major axis the receiver's plane is in direction d.
	float rbPlane( vec3 d, vec3 pn, float planeD, float dist ) {
		float c = dot( pn, d );
		float t = abs( c ) > 1e-5 ? clamp( planeD / c, 0.0, dist * 3.0 ) : dist;
		vec3 a = abs( d );
		return t * max( max( a.x, a.y ), a.z );
	}
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		vec3 toP = shadowCoord.xyz;
		vec3 pn = cross( dFdx( toP ), dFdy( toP ) );
		float shadow = 1.0;
		vec3 ab = abs( toP );
		float vz = max( max( ab.x, ab.y ), ab.z );
		float n = shadowCameraNear, f = shadowCameraFar;
		if ( vz - f <= 0.0 && vz - n >= 0.0 ) {
			float dist = length( toP );
			vec3 dir = toP / dist;
			vec3 tn = normalize( cross( dir, abs( dir.x ) > abs( dir.z ) ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
			vec3 bn = cross( dir, tn );
			float pl = length( pn );
			pn = pl > 1e-20 ? pn / pl : dir;
			float planeD = dot( pn, toP );
			float texelA = 2.0 / shadowMapSize.x;
			float rMin = max( uSoft.w, 1.0 ) * texelA;
			float rMax = clamp( uSoft.z / dist * 2.0, rMin, max( uSoft.y, uSoft.w ) * texelA );
			float phi = rbNoise( gl_FragCoord.xy ) * 6.2831853;
			float ratio = 0.0, found = 0.0;
			for ( int i = 0; i < 12; i ++ ) {
				vec2 o = rbDisk( i, 12, phi ) * rMax;
				vec3 d3 = normalize( dir + tn * o.x + bn * o.y );
				float zr = rbPlane( d3, pn, planeD, dist );
				float zb = rbLinear( textureLod( shadowMap, d3, 0.0 ).r, n, f );
				if ( zb < zr * 0.996 - shadowBias ) { ratio += ( zr - zb ) / zb; found += 1.0; }
			}
			if ( found > 0.0 ) {
				float radius = clamp( uSoft.z * ratio / found / dist, rMin, rMax );
				float lit = 0.0;
				for ( int i = 0; i < 32; i ++ ) {
					vec2 o = rbDisk( i, 32, phi + 1.0 ) * radius;
					vec3 d3 = normalize( dir + tn * o.x + bn * o.y );
					float zr = rbPlane( d3, pn, planeD, dist );
					lit += step( zr * 0.996 - shadowBias, rbLinear( textureLod( shadowMap, d3, 0.0 ).r, n, f ) );
				}
				shadow = lit / 32.0;
			}
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
`;

/* Three's shadow chunk with its two lookups replaced by the above: its own
   (renamed, so nothing in it can call them by mistake) stay for the types
   that are not in use. The sun's goes in front of the cascade function that
   calls getShadow, the lamp's in front of its own - the two places the
   chunk is split on. null when it is not shaped as expected. */
function formSoftShadowChunk(src) {
  const sun = src.indexOf('float getSunShadow('), lamp = src.indexOf('float getPointShadow(');
  if (sun < 0 || lamp < 0 || !src.includes('SHADOWMAP_TYPE_BASIC')) return null;
  const sunIf = src.lastIndexOf('#if NUM_SUN_LIGHT_SHADOWS > 0', sun), lampIf = src.lastIndexOf('#if NUM_POINT_LIGHT_SHADOWS > 0', lamp);
  if (sunIf < 0 || lampIf < sunIf) return null;
  return src.slice(0, sunIf).replaceAll('float getShadow(', 'float getShadowStock(') +
    FORM_SOFT_COMMON_GLSL + FORM_SOFT_SUN_GLSL + src.slice(sunIf, lampIf) +
    FORM_SOFT_LAMP_GLSL + src.slice(lampIf).replaceAll('float getPointShadow(', 'float getPointShadowStock(');
}

// The key light is whichever light casts a shadow - the fill never does.
// Its direction toward the surface (view space) and how lit it leaves this
// point (0 in its shadow, 1 out of it). Used by the zones and by cel shading.
const FORM_KEY_LIGHT_GLSL = `
      vec3 kL = vec3(0.0, 1.0, 0.0);
      float kSh = 1.0;
      #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
        kL = normalize(pointLights[0].position - geometryPosition);
        kSh = getPointShadow(pointShadowMap[0], pointLightShadows[0].shadowMapSize,
          pointLightShadows[0].shadowIntensity, pointLightShadows[0].shadowBias,
          pointLightShadows[0].shadowRadius, vPointShadowCoord[0],
          pointLightShadows[0].shadowCameraNear, pointLightShadows[0].shadowCameraFar);
      #elif defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
        kL = directionalLights[0].direction;
        kSh = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize,
          directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias,
          directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
      #endif`;

function injectFormGuides(sh) {
  Object.assign(sh.uniforms, this.userData.u);
  const zones = FORM_ZONES.map(([, hex]) => {
    const [r, g, b] = hexToRgb(hex).map(c => (c / 255).toFixed(3));
    return `vec3(${r}, ${g}, ${b})`;
  });
  const frag = sh.fragmentShader;
  sh.fragmentShader = `uniform vec2 uLineCount;
uniform float uLines;
uniform float uZones;
uniform float uCel;
uniform vec3 uCelBase;
uniform vec3 uCelShade;
uniform vec3 uCelHi;
uniform float uCelHiSize;
uniform vec3 uCelRim;
uniform vec3 uRimDir;
uniform float uRim;
uniform vec4 uBounce;
uniform float uFloorAO;
uniform sampler2D uAOTex;
uniform vec3 uAOBox;
uniform float uFormAO;
uniform sampler2D uAOBot;
uniform sampler2D uAOTop;
uniform vec2 uAOForm;
uniform float uNbr;
uniform sampler2D uAOTint;
` +
    frag.replace('#include <opaque_fragment>', `
    // Cel shading replaces the light three worked out, while it is still
    // linear - so the colour space and the fog (the Air) apply to it after,
    // as they do to any finish. Every edge is a hard one, blended across a
    // single pixel (fwidth) so it stays crisp without stair-steps.
    if (uCel > 0.5) {${FORM_KEY_LIGHT_GLSL}
      vec3 n = normalize(geometryNormal);
      float ndl = dot(n, kL);
      // Each edge's width is how fast its value changes across one pixel -
      // never quite zero: on a flat face it is, and smoothstep with its two
      // edges equal is undefined in GLSL (noise, on some GPUs).
      float aa = max(fwidth(ndl), 1e-4);
      // Lit: facing the key light and outside any cast shadow. The shadow
      // map's soft edge is cut at its middle, so a cast shadow is as hard
      // edged as the form's own. Near the terminator the map is left out:
      // seen edge-on it wobbles and speckles, which a gradient hides and a
      // hard edge shows - and the form's own shadow needs no map there.
      float unshadowed = 1.0 - (1.0 - smoothstep(0.4, 0.6, kSh)) * smoothstep(0.15 - aa, 0.15 + aa, ndl);
      float lit = smoothstep(-aa, aa, ndl) * unshadowed;
      vec3 c = mix(uCelShade, uCelBase, lit);
      // The highlight: a hard-edged spot where the surface mirrors the key
      // light toward you. Shine sets its size.
      float sp = dot(n, normalize(kL + geometryViewDir));
      float edge = 1.0 - uCelHiSize, sw = max(fwidth(sp), 1e-4);
      c = mix(c, uCelHi, smoothstep(edge - sw, edge + sw, sp) * lit * step(0.0005, uCelHiSize));
      // The rim: a band along the silhouette (where the surface turns away
      // from you) on the side the second light comes from.
      float fr = 1.0 - max(dot(n, geometryViewDir), 0.0), fw = max(fwidth(fr), 1e-4);
      float rd = dot(n, uRimDir), rw = max(fwidth(rd), 1e-4);
      c = mix(c, uCelRim, uRim * smoothstep(0.6 - fw, 0.6 + fw, fr) * smoothstep(-rw, rw, rd));
      outgoingLight = c;
    } else {
      // Reflected light: the floor is lit, and sends some of it back up
      // into whatever faces it. It is the floor's own colour, strongest on a
      // surface turned down and close to the floor, and gone a little way
      // up - which is why it shows as a band along the shadow side's lower
      // edge, and why a ball on a red floor has a red underside. Added to the
      // light three worked out, in linear colour, before the tone mapping.
      vec3 wN = normalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);
      float wy = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).y;
      float facing = clamp(0.5 - 0.5 * wN.y, 0.0, 1.0);
      // On the shadow side it is not even: the core shadow (turned square to
      // the dark) gets less of it, and it rises toward the silhouette, where
      // the surface turns edge-on and sees the lit floor and the room beside
      // it - the reflex, a lighter strip between the core shadow and the
      // edge. Where the key lights the surface it stays as it was.
      float reflex;
      {${FORM_KEY_LIGHT_GLSL}
        vec3 rn = normalize(geometryNormal);
        float edge = 1.0 - max(dot(rn, geometryViewDir), 0.0);
        reflex = mix(1.0, 0.45 + 9.0 * edge * edge * edge, 1.0 - smoothstep(0.0, 0.5, dot(rn, kL)));
      }
      outgoingLight += diffuseColor.rgb * uBounce.rgb * facing * reflex * exp(-max(wy, 0.0) / uBounce.w);
      // Sky occlusion on the floor: the sky's light (three's indirect
      // diffuse) less what the forms shut out, from the map above. The
      // key's light is not touched.
      if (uFloorAO > 0.0) {
        vec3 wP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
        float occ = texture2D(uAOTex, (wP.xz - uAOBox.xy) / uAOBox.z + 0.5).r;
        outgoingLight -= reflectedLight.indirectDiffuse * occ * uFloorAO;
      }
      // The same on the forms, where one meets another: sixteen rays out of
      // the surface, thicker toward its normal (the sky counts most from
      // straight out), each stopping at a point. A point is shut if it lies
      // between the lowest and the highest height of some form above that
      // spot of floor - the two pictures already drawn for the floor - or
      // under the floor itself. The share that is shut, the nearer the more,
      // takes away that much of the sky's light. A convex form never shuts
      // itself: every ray leaves it. The start is lifted off the surface by a
      // few texels, or the picture's coarse edge would shut it. The rays are
      // the same at every pixel: starting them at a random angle each trades
      // the faint steps this leaves for grain, which is far worse in a crease.
      // The same rays carry colour: what they hit sends the form's own colour
      // back (uNbr), weighted like the occlusion, so a red ball beside a white
      // one tints the white one's near side red.
      if (uFormAO > 0.0 || uNbr > 0.0) {
        vec3 wP = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).xyz;
        float texel = uAOBox.z / ${FORM_AO_SIZE}.0;
        vec3 o = wP + wN * (3.0 * texel);
        vec3 tA = normalize(abs(wN.y) < 0.99 ? cross(wN, vec3(0.0, 1.0, 0.0)) : vec3(1.0, 0.0, 0.0));
        vec3 tB = cross(wN, tA);
        float shut = 0.0, all = 0.0;
        vec3 thrown = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          float f = (float(i) + 0.5) / 16.0, a = 2.3999632 * float(i);
          vec3 d = (tA * cos(a) + tB * sin(a)) * sqrt(f) + wN * sqrt(1.0 - f);
          float k = 0.1 + 0.9 * fract(float(i) * 0.618034 + 0.3);
          vec3 q = o + d * (uAOForm.x * k);
          float w = (1.0 - k) * (1.0 - k);
          vec2 uv = (q.xz - uAOBox.xy) / uAOBox.z + 0.5;
          vec4 top = textureLod(uAOTop, vec2(uv.x, 1.0 - uv.y), 0.0);
          float hit = (uAOForm.y > 0.5 && q.y < 0.0) ? 1.0 : 0.0;
          if (top.a > 0.5 && q.y < top.r - 0.5 * texel && q.y > textureLod(uAOBot, uv, 0.0).r + 0.5 * texel) {
            hit = 1.0;
            thrown += w * textureLod(uAOTint, vec2(uv.x, 1.0 - uv.y), 0.0).rgb;
          }
          shut += w * hit; all += w;
        }
        outgoingLight -= reflectedLight.indirectDiffuse * (shut / all) * uFormAO;
        outgoingLight += diffuseColor.rgb * thrown / all * uNbr;
      }
    }
    #include <opaque_fragment>`).replace('#include <dithering_fragment>', `#include <dithering_fragment>
    if (uZones > 0.5) {${FORM_KEY_LIGHT_GLSL}
      float ndl = dot(normalize(geometryNormal), kL);
      float spec = dot(reflectedLight.directSpecular, vec3(0.3333));
      vec3 zc = gl_FragColor.rgb;
      // The floor (uZones 2) only ever shows its cast shadow. Painted as
      // "light" everywhere else it would swallow every lit face resting on
      // it, and the fog that dissolves it into the background with it.
      if (uZones > 1.5) { if (ndl > 0.0 && kSh < 0.5) zc = ${zones[6]}; }
      else if (ndl > 0.0 && kSh < 0.5) zc = ${zones[6]};
      else if (spec > 0.25)       zc = ${zones[0]};
      else if (ndl > 0.5)         zc = ${zones[1]};
      else if (ndl > 0.12)        zc = ${zones[2]};
      else if (ndl > -0.12)       zc = ${zones[3]};
      else if (ndl > -0.5)        zc = ${zones[4]};
      else                        zc = ${zones[5]};
      gl_FragColor.rgb = zc;
    }
    if (uLines > 0.5) {
      vec2 g = vUv * uLineCount;
      vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.75, 0.18, 0.08), (1.0 - min(min(f.x, f.y), 1.0)) * 0.85);
    }`);
}

function newFormMesh() {
  const T = forms.T;
  const mat = new T.MeshPhysicalMaterial({ metalness: 0 });
  // Merged into three's own { STANDARD, PHYSICAL }, not replacing them -
  // without PHYSICAL the shader silently drops to the standard model, and
  // glass (which needs its IOR) does not compile at all.
  mat.defines = { ...mat.defines, USE_UV: '' };
  mat.userData.u = formGuideUniforms(T, 4);
  mat.onBeforeCompile = injectFormGuides;
  // Front faces into the shadow map, not three's default of back faces. Back
  // faces record the far side of a form, which near the point where it
  // touches the floor sits right on the floor itself - so any bias at all lit
  // a sliver of floor under a sphere, exactly where the occlusion shadow must
  // be darkest. Front faces sit well above it there; the acne they would
  // cause on lit surfaces is what normalBias below is for.
  mat.shadowSide = T.FrontSide;
  const m = new T.Mesh(undefined, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  // 'YXZ' applies turn last, so "Turn" always spins the form about the
  // vertical however it has been tilted - the way you turn a real object on a
  // table - rather than about its own tilted axis.
  m.rotation.order = 'YXZ';
  forms.scene.add(m);
  return m;
}

/* The figure's body: groups at the joints, capsules and balls hanging off
   them, all sharing the form's one material - so finish, colour, contour
   lines and zones are the figure's as a whole. Built once per mesh when it
   becomes a figure, torn down when it stops being one. */
function formRigPartGeometry(geo) {
  const F = forms, T = F.T, key = 'rig:' + geo;
  if (F.geometries[key]) return F.geometries[key];
  let g;
  if (geo === 'sphere') g = new T.SphereGeometry(1, 32, 20);
  else if (geo === 'box') g = new T.BoxGeometry(1, 1, 1);
  else { const [, len, r] = geo.split(':').map(Number); g = new T.CapsuleGeometry(r, Math.max(len - 2 * r, 0.01), 12, 24); }
  return (F.geometries[key] = g);
}
/* Every joint hangs from a pivot of its own: the pivot sits where the joint
   is and holds its rest pose (a row's sixth entry - the thumb's angle off
   the palm), and the joint turns inside it. So a pose is always relative to
   rest, and the rotate handles, which read a joint's angles in the frame of
   whatever it hangs from, get that for free. */
function buildFormRig(m, kind) {
  const T = forms.T, def = FORM_RIGS[kind], rig = { nodes: {}, pivots: {}, parts: [], def, kind };
  const addParts = (node, joint, parts) => parts.forEach(part => {
    const pm = new T.Mesh(formRigPartGeometry(part.geo), m.material);
    pm.castShadow = pm.receiveShadow = true;
    pm.userData.joint = joint; // null: the pelvis, which is the whole figure
    node.add(pm);
    rig.parts.push([pm, part]);
  });
  addParts(m, null, def.root);
  for (const [name, parent, , , parts, rest] of def.joints) {
    const pivot = new T.Group(), node = new T.Group();
    if (rest) pivot.rotation.set(rest[0] * THREE_DEG, rest[1] * THREE_DEG, rest[2] * THREE_DEG);
    (parent ? rig.nodes[parent] : m).add(pivot);
    pivot.add(node);
    rig.pivots[name] = pivot;
    rig.nodes[name] = node;
    addParts(node, name, parts);
  }
  m.userData.rig = rig;
}
function dropFormRig(m) {
  for (const c of [...m.children]) m.remove(c);
  m.userData.rig = null;
}

/* The anime head's drawn face (formAnimeFace()): the features and the
   gleams, hung on the head so they turn and stretch with it, in its own eye
   style and colour (formFaceMaterials()). Clicks go through them to the head. */
function syncFormFace(m, def, o) {
  let face = m.userData.face;
  if (!def.face) {
    if (face) { m.remove(face); face.userData.mats.dispose(); m.userData.face = null; }
    return;
  }
  if (!face) {
    const T = forms.T, f = formAnimeFace(), mats = formFaceMaterials(T);
    face = new T.Group();
    const features = new T.Mesh(f.geo, mats.features), gleam = new T.Mesh(f.geo, mats.gleam['-1']);
    features.receiveShadow = true;
    features.renderOrder = 1; gleam.renderOrder = 2;
    for (const x of [features, gleam]) x.raycast = () => {};
    face.add(features, gleam);
    Object.assign(face.userData, { gleam, mats });
    m.add(face);
    m.userData.face = face;
  }
  face.userData.mats.draw(o.eyes, o.eyeColor, o.expression);
}
/* The anime head's hair (formAnimeHairGeometry()): a mesh of its own on the
   head, so it turns with it, with a material of its own - its colour, and
   the ring. It shades like the head it is on: cel tones on an Anime head,
   a soft sheen on any other finish. Clicks on it pick the head. */
function formHairMaterial() {
  const T = forms.T, mat = new T.MeshPhysicalMaterial({ metalness: 0 });
  mat.defines = { ...mat.defines, USE_UV: '' };
  mat.userData.u = { ...formGuideUniforms(T, 4), uRingColor: { value: new T.Color() }, uRingEdge: { value: 0.988 } };
  mat.onBeforeCompile = injectHairRing;
  mat.shadowSide = T.FrontSide;
  return mat;
}

/* The ring - the band of light anime paints round a head of hair. A hair is
   a line, not a surface, and a line shines wherever it lies square to the
   halfway direction between the light and the eye (Kajiya and Kay): all
   along the hair, that is a band round the head, not a spot. Each lock's
   hairs are tipped a little toward its normal (hairShift - more toward its
   edges), which moves its piece of the band up or down: the sawtooth. */
function injectHairRing(sh) {
  injectFormGuides.call(this, sh);
  sh.vertexShader = 'attribute vec3 hairT;\nattribute float hairShift;\nvarying vec3 vHairT;\nvarying float vHairShift;\n' +
    sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
    vHairT = normalize((modelViewMatrix * vec4(hairT, 0.0)).xyz);
    vHairShift = hairShift;`);
  sh.fragmentShader = 'varying vec3 vHairT;\nvarying float vHairShift;\nuniform vec3 uRingColor;\nuniform float uRingEdge;\n' +
    sh.fragmentShader.replace('#include <opaque_fragment>', `{${FORM_KEY_LIGHT_GLSL}
      vec3 n = normalize(geometryNormal);
      vec3 t = normalize(vHairT + n * vHairShift);
      float th = dot(t, normalize(kL + geometryViewDir));
      float across = sqrt(max(0.0, 1.0 - th * th));
      float ndl = dot(n, kL), lit = smoothstep(0.0, 0.08, ndl) * smoothstep(0.4, 0.6, kSh);
      float sw = max(fwidth(across), 1e-4);
      // Cel: a hard-edged band. Otherwise a soft sheen along it.
      float ring = uCel > 0.5 ? smoothstep(uRingEdge - sw, uRingEdge + sw, across) * lit
        : pow(across, 40.0) * lit * 0.55;
      outgoingLight = mix(outgoingLight, uRingColor, ring);
    }
    #include <opaque_fragment>`);
}

function syncFormHair(m, def, o) {
  const has = m.userData.hair, want = def.face && o.hair !== 'none' ? o.hair : null;
  if (has && has.userData.style === want) return;
  if (has) { m.remove(has); m.userData.hair = null; }
  if (!want) return;
  const F = forms, key = 'hair:' + want;
  const geo = F.geometries[key] || (F.geometries[key] = formAnimeHairGeometry(F.T, want));
  const hair = new F.T.Mesh(geo, m.userData.hairMat || (m.userData.hairMat = formHairMaterial()));
  hair.castShadow = hair.receiveShadow = true;
  hair.userData.style = want;
  m.add(hair);
  m.userData.hair = hair;
}

// The cel shading uniforms of one material: its tones for `color`, the
// highlight's size, the rim.
function formCelUniforms(u, color, gloss, sc, rimDir) {
  const t = celTones(color, sc.lightColor, sc.fillColor);
  for (const [k, rgb] of [['uCelBase', t.base], ['uCelShade', t.shade], ['uCelHi', t.hi], ['uCelRim', t.rim]]) {
    u[k].value.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, forms.T.SRGBColorSpace);
  }
  // Shine 0 is no highlight; at 1 it covers about a third of the lit side.
  u.uCelHiSize.value = gloss * gloss * 0.12;
  u.uRimDir.value.copy(rimDir);
  u.uRim.value = sc.fillOn ? Math.min(1, sc.fillStrength * 2) : 0;
  return t;
}

/* Proportions stretch each part in its own frame - Height makes limbs
   longer, Width and Depth thicker - rather than stretching the figure as a
   whole: a stretched parent shears whatever is turned inside it, so a
   raised arm would come out wide instead of long. A figure's build
   (FIGURE_BUILDS) scales each part the same way: a joint sits where its
   parent's scale puts it, its own parts take its own. */
function poseFormRig(m, o) {
  const rig = m.userData.rig, base = [o.sx, o.sy, o.sz];
  const scaleOf = rig.kind === 'figure' ? j => figureScale(o.build, j, base) : () => base;
  for (const [name, parent, at] of rig.def.joints) {
    const node = rig.nodes[name], r = o.pose[name] || [0, 0, 0], sc = scaleOf(parent);
    rig.pivots[name].position.set(at[0] * sc[0], at[1] * sc[1], at[2] * sc[2]);
    node.rotation.set(r[0] * THREE_DEG, r[1] * THREE_DEG, r[2] * THREE_DEG);
  }
  for (const [pm, { at, size }] of rig.parts) {
    const sc = scaleOf(pm.userData.joint);
    pm.position.set(at[0] * sc[0], at[1] * sc[1], at[2] * sc[2]);
    pm.scale.set(size[0] * sc[0], size[1] * sc[1], size[2] * sc[2]);
  }
}

// Which joint of the selected figure is being posed: a name, or null for
// the figure as a whole. Kept off the scene - it is a selection, not a pose -
// and only good for the form it was picked on.
function activeFormJoint() {
  const j = forms && forms.joint;
  return j && j.i === formScene.active && formShapeDef(activeFormObject().shape).rig ? j.name : null;
}
function selectFormJoint(name) {
  forms.joint = name ? { i: formScene.active, name } : null;
  formsChanged();
}

function formShapeDef(shape) {
  const model = forms && forms.models[shape];
  return FORM_SHAPES[shape] || (model ? { label: model.name, lines: [8, 8] } : FORM_SHAPES.cube);
}
function formGeometry(shape) {
  const F = forms;
  if (F.models[shape]) return F.models[shape].geometry;
  const key = FORM_SHAPES[shape] ? shape : 'cube';
  // The heads come from a scan, fetched the first time one is wanted; the
  // sculpted stand-in below shows until it arrives.
  if (key === 'head' || key === 'planes') formHeadScan();
  return F.geometries[key] || (F.geometries[key] = FORM_SHAPES[key].build(F.T));
}

function applyFormFinish(mat, o, def) {
  const f = FORM_FINISHES[o.finish] || FORM_FINISHES.matte;
  // These switch whole features of the shader on or off (clearcoat,
  // transmission, sheen...), so only touch them - and pay for a recompile -
  // when the finish itself changed, not on every Shine slider tick.
  const key = o.finish + (def.flat ? '|flat' : '') + (def.cloth ? '|both' : '');
  if (mat.userData.key !== key) {
    mat.metalness = f.metal || 0;
    mat.clearcoat = f.clearcoat || 0;
    mat.clearcoatRoughness = 0.06;
    mat.transmission = f.transmission || 0;
    mat.thickness = f.transmission ? 1.2 : 0;
    mat.ior = 1.5;
    mat.sheen = f.sheen || 0;
    mat.sheenRoughness = 0.4;
    mat.envMap = f.env ? forms.env : null;
    mat.flatShading = !!def.flat;
    // Cloth is seen from both sides - inside every fold is its back.
    mat.side = def.cloth ? forms.T.DoubleSide : forms.T.FrontSide;
    mat.userData.key = key;
    mat.needsUpdate = true;
  }
  mat.color.set(o.color);
  if (f.sheen) mat.sheenColor.set(o.color).offsetHSL(0, 0, 0.25);
  mat.roughness = 1 - o.gloss * 0.95;
}

/* Aims a directional light's shadow camera at the scene: `L` is the direction
   toward the light, `elev` its height in radians, `rad` the scene's radius
   and `h3` its height. Used for the key and for the second light, which each
   have a map of their own. */
function aimSunShadow(light, target, L, elev, rad, h3, softness) {
  // The camera must reach the tip of the cast shadow, which a low light
  // stretches out to height / tan(elevation) - capped, or a grazing light
  // would spread the map over so much floor it went blocky.
  const s = rad * 1.1 + Math.min(h3 / Math.tan(Math.max(elev, THREE_DEG * 5)), rad * 7);
  const cam = light.shadow.camera;
  light.position.copy(target).addScaledVector(L, s * 3);
  Object.assign(cam, { left: -s, right: s, top: s, bottom: -s, near: 0.01, far: s * 6 });
  cam.updateProjectionMatrix();
  // Softness is how big the light looks. The sun's half-width as a tangent -
  // the real sun's is 0.005 - which the shader multiplies by the gap between
  // a shadow and what throws it, so a form on the floor has a hard foot and
  // one in the air a soft shadow. Out in the shadow map's own units that is
  // the gap's share of the depth the map covers, per share of its width.
  // Handed to the shader as the light's own `shadow.radius` (three passes it
  // to getShadow), so each light has the growth its own camera needs.
  light.shadow.radius = (cam.far - cam.near) / (cam.right - cam.left) * (0.006 + 0.2 * softness);
  // Along the surface normal, in world units: enough to lift a lit face clear
  // of its own recorded depth (the speckle of shadow acne). The wide
  // penumbra needs no more - the shader compares the plane a surface lies in,
  // not the point - and it is still far too little to open a gap where a
  // form meets the floor.
  light.shadow.bias = 0;
  light.shadow.normalBias = (2 * s / light.shadow.mapSize.x) * 2;
}

/* Poses the forms, the lights and the camera for `sc` and draws it at w x h.
   The same call serves the live view and every export - a snapshot is this
   at formExportSize(), so it cannot drift from what the preview showed. `clean`
   leaves out what is drawn on the forms as a guide (contour lines, zones,
   floor grid): an export is a reference to draw from, not a diagram. */
const formSceneIsCel = sc => sc.objects.some(o => (FORM_FINISHES[o.finish] || {}).cel);

function formsRender(sc, w, h, clean = false) {
  const F = forms, T = F.T;
  while (F.meshes.length < sc.objects.length) F.meshes.push(newFormMesh());
  while (F.meshes.length > sc.objects.length) {
    const m = F.meshes.pop();
    F.scene.remove(m);
    m.material.dispose();
    m.userData.hairMat?.dispose();
    m.userData.face?.userData.mats.dispose();
  }

  // Each form rests on the floor at its own x/z: a form floating above its
  // own shadow reads as a mistake, and "which rotation leaves it touching the
  // ground" is not a sum anyone should have to do with sliders. `precise`
  // measures actual vertices, not the rotated box around them.
  const union = new T.Box3();
  let sizeSum = 0;
  sc.objects.forEach((o, i) => {
    const m = F.meshes[i], def = formShapeDef(o.shape);
    m.geometry = formGeometry(o.shape);
    // A figure turned into a hand is a different rig, not a re-pose.
    if (m.userData.rig && m.userData.rig.kind !== def.rig) dropFormRig(m);
    syncFormFace(m, def, o);
    syncFormHair(m, def, o);
    if (def.rig && !m.userData.rig) buildFormRig(m, def.rig);
    applyFormFinish(m.material, o, def);
    const u = m.material.userData.u;
    u.uLines.value = sc.lines && !clean ? 1 : 0;
    u.uZones.value = sc.zones && !clean ? 1 : 0;
    u.uLineCount.value.set(def.lines[0], def.lines[1]);
    m.position.set(0, 0, 0);
    m.userData.localBox = null;
    if (def.rig) {
      m.scale.set(1, 1, 1);
      poseFormRig(m, o);
      // Its box in its own frame, for the vanishing-point guide - a figure's
      // own geometry is only the ball at its pelvis.
      m.rotation.set(0, 0, 0);
      m.updateMatrixWorld(true);
      m.userData.localBox = new T.Box3().setFromObject(m, true);
    } else m.scale.set(o.sx, o.sy, o.sz);
    m.rotation.set(THREE_DEG * o.rx, THREE_DEG * o.ry, THREE_DEG * o.rz);
    m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m, true);
    const c = box.getCenter(new T.Vector3());
    // A figure stands where its pelvis is, not where the middle of its box
    // is: raising an arm moves the box, and the figure must not slide
    // sideways under the arm being raised. It still rests on whatever part
    // of it is lowest - a foot, or a knee when it kneels.
    m.position.set(def.rig ? o.x : o.x - c.x, o.y - box.min.y, def.rig ? o.z : o.z - c.z);
    m.updateMatrixWorld(true);
    // The form's size for the sky occlusion: the side of the cube of the same
    // volume as its box, halved - a ball's radius, a standing figure's much
    // less than its height, since it is its feet the sky is shut out by.
    const bs = box.getSize(new T.Vector3());
    sizeSum += Math.cbrt(Math.max(bs.x * bs.y * bs.z, 1e-6)) / 2;
    union.union(box.translate(m.position));
    // The middle of the posed form, where its handles sit and what it turns
    // about - the same point x/z place, so a rotation never walks it away.
    // A figure's is its pelvis, which is what it turns about.
    m.userData.center = def.rig ? m.position.clone() : box.getCenter(new T.Vector3());
    m.userData.top = box.max.y;
  });
  F.ground.material.userData.u.uZones.value = sc.zones && !clean ? 2 : 0;

  // The floor is part of the picture even under a lifted form: framing from
  // it keeps the form, its cast shadow and the gap between them in view.
  union.min.y = 0;
  const center = union.getCenter(new T.Vector3());
  let h3 = union.max.y - union.min.y;
  let rad = union.getSize(new T.Vector3()).length() / 2;
  let target = new T.Vector3(center.x, h3 / 2, center.z);
  // While a form is being moved, turned or stretched, the framing holds still.
  // Left to follow the forms it would chase the very thing being dragged -
  // scale a form up and the camera backs off until it looks no bigger - and
  // the pointer would no longer be over the point it grabbed. It catches up
  // once the change is confirmed.
  if (F.lockFrame && !clean) ({ target, rad, height: h3 } = F.lockFrame);

  // Camera distance follows the lens, so the forms stay the same size on
  // screen and only the perspective changes - a dolly zoom.
  const cam = F.camera;
  // The fisheye is stereographic: a direction θ off the axis lands at
  // k·tan(θ/2) from the centre, in units of half the frame's height, with k
  // putting 90° at the corners - 180° across the diagonal. The camera's own
  // fov is then only what the rest of the code measures by (pixels per unit
  // at the centre - formPixelSize()), set to the fisheye's scale there.
  const fishK = sc.fisheye ? Math.hypot(1, w / h) : 0;
  F.fishK = fishK;
  const fov = fishK ? 2 * Math.atan(2 / fishK) : 2 * Math.atan(12 / sc.focal);
  // Framed on whichever of the two angles of view is narrower, so a tall,
  // narrow window fits the forms side to side instead of cutting them off.
  const half = fishK ? 2 * Math.atan(Math.min(1, w / h) / fishK)
    : Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * w / h));
  const framed = rad / Math.sin(half) * 1.1;
  const dist = framed * sc.zoom;
  // As low as the floor allows: below the forms' middle the camera looks up
  // at them (a worm's eye), but never from under the floor, where the ground
  // would be the underside of a plane. How low that is depends on how far
  // off the camera is - close in, it can look up more steeply.
  const minPitch = sc.ground ? -Math.asin(Math.min(1, Math.max(0, target.y - rad * 0.03) / dist)) / THREE_DEG : -89;
  const yaw = THREE_DEG * sc.yaw, pitch = THREE_DEG * Math.max(sc.pitch, minPitch);
  cam.fov = fov / THREE_DEG;
  cam.aspect = w / h;
  cam.near = dist * 0.05; cam.far = dist * 4 + rad * 80;
  cam.position.set(target.x + dist * Math.cos(pitch) * Math.sin(yaw), target.y + dist * Math.sin(pitch),
    target.z + dist * Math.cos(pitch) * Math.cos(yaw));
  cam.lookAt(target);
  // The Dutch angle: rolled about its own line of sight, after aiming, so
  // it tilts the picture and not what the camera looks at. OrbitControls
  // aims with lookAt too and drops the roll, but it only moves the camera -
  // the next render puts the roll back before anything is drawn.
  if (sc.roll) cam.rotateZ(sc.roll * THREE_DEG);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  // Both lights are aimed relative to the camera's heading.
  const dirFrom = (az, el) => {
    const a = yaw + THREE_DEG * az, e = THREE_DEG * el;
    return new T.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  };
  const L = dirFrom(sc.lightAz, sc.lightEl), elev = THREE_DEG * sc.lightEl;
  // Softness is the size of the light (see formSoftShadowChunk). Anime's cast
  // shadows are hard - a cel's edge is a cut, and a penumbra under it would
  // only be the speckle of its dither - and the map is the light's, so it is
  // the scene's: one Anime form makes every shadow in it hard.
  const softness = formSceneIsCel(sc) ? 0 : sc.softness;

  // The sun. Its shadow camera must reach the tip of the cast shadow, which
  // a low light stretches out to height / tan(elevation) - capped, or a
  // grazing light would spread the map over so much floor it went blocky.
  const k = F.key;
  k.color.set(sc.lightColor);
  k.intensity = sc.intensity * Math.PI; // three's units: π is "albedo at full light"
  aimSunShadow(k, target, L, elev, rad, h3, softness);

  // The lamp. Only one of the two is ever on; an invisible light is left out
  // of both shading and shadow passes entirely, not just dimmed.
  const sun = sc.lightDist >= LIGHT_SUN, bulb = F.bulb;
  k.visible = sun; bulb.visible = !sun;
  // The lamp belongs to a form, not to the middle of the scene: the one it
  // was last aimed at (sc.lightOn - see placeLightAt). It stands off that
  // form at the set direction and distance and follows it when it moves.
  // Selecting another form leaves it where it is: picking which form to
  // edit must not relight the scene.
  // Distance still counts in scene radii, so ×3 means the same whichever
  // form it is on. (The sun has no position - only its direction matters -
  // and its shadow camera above stays on the whole scene, since it has to
  // take in every form's shadow.)
  const am = F.meshes[Math.min(sc.lightOn | 0, sc.objects.length - 1)];
  const anchor = am && am.userData.center ? am.userData.center.clone() : target.clone();
  const anchorTop = am && am.userData.top !== undefined ? am.userData.top : h3;
  const bulbDist = sc.lightDist * rad;
  bulb.color.set(sc.lightColor);
  bulb.position.copy(anchor).addScaledVector(L, bulbDist);
  // Inverse-square, so scale by distance squared: the selected form gets the
  // same light whatever the distance, and moving the lamp changes the falloff
  // and the shadow's spread rather than just the exposure.
  bulb.intensity = sc.intensity * Math.PI * bulbDist * bulbDist;
  bulb.shadow.camera.near = rad * 0.1;
  bulb.shadow.camera.far = bulbDist + rad * 30;
  bulb.shadow.camera.updateProjectionMatrix();
  // The lamp's radius, in world units - a bare bulb is small, a softbox big.
  // Squared, so the low half of the slider stays a bulb; at 0.4 the lamp's
  // penumbra matches the sun's at the same setting when it stands 3 radii off.
  formSoftUniform(T).value.z = rad * (0.015 + 1.2 * softness * softness);
  // Normal offset in world units, not a depth bias: a cube shadow map stores
  // perspective depth, where a fixed bias near the far plane spans a large
  // real distance - enough to light the floor right under the form, the one
  // spot (the occlusion shadow) that must be darkest.
  bulb.shadow.bias = 0;
  bulb.shadow.normalBias = rad * 0.02;

  // An anime eye's gleam is on the side the light comes from, in both eyes.
  for (const m of F.meshes) {
    const face = m.userData.face;
    if (!face) continue;
    const d = L.clone().applyQuaternion(m.getWorldQuaternion(new T.Quaternion()).invert());
    face.userData.gleam.material = face.userData.mats.gleam[d.x > 0 ? '1' : '-1'];
  }

  const Lf = dirFrom(sc.fillAz, sc.fillEl);
  F.fill.visible = sc.fillOn;
  F.fill.color.set(sc.fillColor);
  F.fill.intensity = sc.fillStrength * sc.intensity * Math.PI;
  F.fill.target.position.copy(target);
  F.fill.position.copy(target).addScaledVector(Lf, rad * 10);
  // Its shadow - a second map, so only while it will be seen: the light is on,
  // the scene is not Anime (a cel ignores this light's shading, it is only the
  // rim there), and the shadow is not switched off.
  F.fill.castShadow = sc.fillOn && sc.fillShadow !== false && !formSceneIsCel(sc);
  if (F.fill.castShadow) aimSunShadow(F.fill, target, Lf, THREE_DEG * sc.fillEl, rad, h3, softness);

  // Cel shading. Its tones are flat colours, so it ignores the lights'
  // strength and the ambient; the second light turns into its rim - given in
  // view space, as the shader's normals are.
  cam.updateMatrixWorld();
  const rimDir = Lf.clone().transformDirection(cam.matrixWorldInverse);
  sc.objects.forEach((o, i) => {
    const m = F.meshes[i], u = m.material.userData.u;
    const cel = !!(FORM_FINISHES[o.finish] || {}).cel;
    u.uCel.value = cel ? 1 : 0;
    if (cel) formCelUniforms(u, o.color, o.gloss, sc, rimDir);
    // The hair: cel on an Anime head, else a sheen of its own - hair is not
    // glass or metal whatever the head is. No highlight spot: its highlight
    // is the ring, in its own colour made paler toward the light's.
    const hair = m.userData.hair;
    if (!hair) return;
    const hu = hair.material.userData.u;
    applyFormFinish(hair.material, { finish: cel ? 'anime' : 'satin', color: o.hairColor, gloss: 0.35 }, {});
    hu.uCel.value = cel ? 1 : 0;
    hu.uZones.value = u.uZones.value;
    const t = formCelUniforms(hu, o.hairColor, 0, sc, rimDir);
    // The ring's colour: the hair's own, lighter and a touch less strong -
    // never white, or the hair reads as wet.
    const [L, C, h] = rgbToOklch(t.base), ring = lchRgb(L + (1 - L) * 0.4, C * 0.85, h);
    hu.uRingColor.value.setRGB(ring[0] / 255, ring[1] / 255, ring[2] / 255, T.SRGBColorSpace);
  });

  // Hemisphere: fill from above in neutral light, bounce from below in the
  // floor's colour - the split that puts reflected light, of the right hue,
  // inside a core shadow.
  F.hemi.color.setRGB(1, 1, 1).multiplyScalar(sc.ambient);
  // The ground half of the hemisphere is off: a bounce that does not depend on
  // how high a point is, or how strong the light that reaches the floor, is
  // what hid it. The floor's reflected light is the shader's (uBounce).
  F.hemi.groundColor.setRGB(0, 0, 0);
  const bounceCol = new T.Color(sc.ground ? sc.groundColor : sc.bg), bounceK = sc.bounce * 1.8 * Math.min(1.5, sc.intensity);
  formBounceUniform(T).value.set(bounceCol.r * bounceK, bounceCol.g * bounceK, bounceCol.b * bounceK, rad * 0.9);

  // With no haze, the fog only dissolves the far floor into the background.
  // With it, the fog IS the air: it starts just in front of the nearest form
  // and thickens toward the far one, in the air's colour - which the sky
  // behind takes too, since a far form fades into exactly that.
  const air = sc.haze > 0;
  F.scene.background = new T.Color(air ? sc.hazeColor : sc.bg);
  F.scene.fog.color.set(air ? sc.hazeColor : sc.bg);
  // The scene is about 2 radii deep from its front to its back, so at full
  // haze the far side is nearly lost and at half it is roughly half gone.
  F.scene.fog.near = air ? Math.max(0.1, dist - rad) : dist + rad * 1.5;
  F.scene.fog.far = air ? F.scene.fog.near + rad * (1.5 + 12 * (1 - sc.haze) ** 2) : dist + rad * 9;
  F.ground.visible = sc.ground;
  F.ground.material.color.set(sc.groundColor);
  F.ground.scale.setScalar(rad * 200);
  // One cell per scene radius, so the grid reads at the same density however
  // big the arrangement is. Lifted a hair off the floor so it never z-fights.
  F.grid.visible = sc.floorGrid && sc.ground && !clean;
  F.grid.scale.setScalar(rad * 16);
  F.grid.position.set(0, rad * 0.002, 0);

  F.frame = { target, framed, rad, height: h3, anchor, anchorTop, L, Lf, sun, minPitch, markerDist: sun ? rad * 1.35 : bulbDist };

  // The sky's occlusion on the floor (see formOcclusionRender). Left out
  // where it would not show: no floor, Anime (a cel's floor is flat), the
  // zones view, and when the sky gives the floor nothing to take away.
  const shaded = !formSceneIsCel(sc) && !(sc.zones && !clean);
  const aoOn = shaded && sc.ambient > 0 && sc.occlusion > 0;
  const aoK = aoOn ? Math.min(sc.occlusion, 1) : 0;
  // Light thrown between forms: as strong as the floor's (Bounce), and only
  // worth the pictures when there is a second form to receive it.
  const nbrOn = shaded && sc.bounce > 0 && sc.objects.length > 1;
  F.ground.material.userData.u.uFloorAO.value = sc.ground ? aoK : 0;
  for (const m of F.meshes) { const u = m.material.userData.u; u.uFormAO.value = aoK; u.uNbr.value = nbrOn ? bounceK : 0; }
  if (aoOn || nbrOn) {
    const u = sizeSum / sc.objects.length, c = union.getCenter(new T.Vector3()), ext = union.getSize(new T.Vector3());
    formOcclusionUniform(T).form.value.set(FORM_AO_FORM_REACH * u, sc.ground ? 1 : 0);
    // The footprint of the forms and as far round it as the floor looks.
    formOcclusionRender(c.x, c.z, Math.max(ext.x, ext.z) / 2 + FORM_AO_REACH * u, union.max.y, FORM_AO_REACH * u);
  }

  F.renderer.setPixelRatio(1);
  F.renderer.setSize(w, h, false);
  if (fishK) renderFisheye(cam, fishK);
  else F.renderer.render(F.scene, cam);
}

/* The fisheye. No flat picture reaches 180°, so the scene is rendered all
   round the camera - six faces of a cube (CubeCamera) - and the frame is
   then drawn by looking each pixel's direction up in that cube. Tone and
   colour are applied here, on the way to the screen: the cube keeps the
   scene's light unconverted (half floats), as a flat render target would.
   Four looks a pixel, a quarter-pixel apart - a cube has no antialiasing. */
function renderFisheye(cam, k) {
  const F = forms, T = F.T, r = F.renderer;
  if (!F.fish) {
    const size = Math.min(1024, r.capabilities.maxCubemapSize);
    const rt = new T.WebGLCubeRenderTarget(size, { type: T.HalfFloatType, generateMipmaps: false });
    const mat = new T.ShaderMaterial({
      uniforms: { env: { value: rt.texture }, rot: { value: new T.Matrix3() }, k: { value: 1 }, aspect: { value: 1 }, px: { value: new T.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform samplerCube env; uniform mat3 rot; uniform float k, aspect; uniform vec2 px;
        varying vec2 vUv;
        vec3 look(vec2 ndc) {
          vec2 p = vec2(ndc.x * aspect, ndc.y);
          float r = length(p), th = 2.0 * atan(r / k);
          vec2 s = r > 0.0 ? p / r * sin(th) : vec2(0.0);
          return textureCube(env, rot * vec3(s, -cos(th))).rgb;
        }
        void main() {
          vec2 ndc = vUv * 2.0 - 1.0;
          gl_FragColor = vec4((look(ndc + px * vec2(-0.25, -0.25)) + look(ndc + px * vec2(0.25, -0.25)) +
            look(ndc + px * vec2(-0.25, 0.25)) + look(ndc + px * vec2(0.25, 0.25))) * 0.25, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const scene = new T.Scene();
    scene.add(quad);
    F.fish = { cube: new T.CubeCamera(0.1, 100, rt), mat, scene, view: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }
  const { cube, mat, scene, view } = F.fish;
  cube.position.copy(cam.position);
  for (const c of cube.children) { c.near = cam.near; c.far = cam.far; c.updateProjectionMatrix(); }
  cube.update(r, F.scene);
  const size = r.getSize(new T.Vector2());
  mat.uniforms.k.value = k;
  mat.uniforms.aspect.value = cam.aspect;
  mat.uniforms.rot.value.setFromMatrix4(cam.matrixWorld);
  mat.uniforms.px.value.set(2 / size.x, 2 / size.y);
  r.render(scene, view);
}

/* A world point on screen, as NDC (x, y in -1..1 across the frame), the way
   the view draws it - through the fisheye when that is on. z is only "in
   front" (< 1) or "behind" (2): every caller asks just that. */
function formProject(v, cam = forms.camera) {
  const k = forms.fishK;
  if (!k) return v.clone().project(cam);
  const d = v.clone().applyMatrix4(cam.matrixWorldInverse), len = d.length() || 1;
  const th = Math.acos(Math.min(1, Math.max(-1, -d.z / len)));
  const r = k * Math.tan(Math.min(th, 3) / 2), q = Math.hypot(d.x, d.y) || 1;
  return new forms.T.Vector3(r * d.x / q / cam.aspect, r * d.y / q, th < THREE_DEG * 100 ? 0.5 : 2);
}

/* ---- overlay: everything drawn over the view rather than into it - light
   handles, object numbers, construction, the zones key. Never part of an
   export. */
function drawFormsOverlay() {
  const c = el('formsOverlay'), stage = el('formsStage'), F = forms;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(stage.clientWidth * dpr), h = Math.round(stage.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  F.marker = null;
  F.badges = [];
  F.gizmo = [];
  F.jointDots = [];
  F.navHits = [];
  // Clean: nothing over the scene at all - and with nothing drawn there is
  // nothing to grab either, since every handle is found by what was drawn.
  if (!F.frame || F.clean) return;
  const toScreen = v => { const p = formProject(v); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h, p.z]; };
  const fr = F.frame;
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;

  if (formScene.ellipses) drawFormEllipses(ctx, dpr, toScreen);
  // Vanishing points belong to straight lines, and a fisheye has none.
  if (formScene.vp && !F.fishK) drawVanishingLines(ctx, w, h, dpr);
  else if (formScene.vp) {
    ctx.fillStyle = '#eee';
    ctx.fillText('No vanishing points through a fisheye: straight edges bend round the middle.', 10 * dpr, 40 * dpr);
  }

  // Which number is which form, once there is more than one to tell apart.
  // Clicking one selects it (see bindFormsOrbit).
  if (formScene.objects.length > 1) {
    F.meshes.forEach((m, i) => {
      const box = new F.T.Box3().setFromObject(m);
      const top = box.getCenter(new F.T.Vector3()).setY(box.max.y);
      const [x, y, z] = toScreen(top);
      if (z >= 1) return;
      const by = y - 14 * dpr, on = i === formScene.active;
      ctx.beginPath(); ctx.arc(x, by, 9 * dpr, 0, 2 * Math.PI);
      ctx.fillStyle = on ? '#d8a24a' : i === F.formHover ? 'rgba(216, 162, 74, .6)' : 'rgba(0, 0, 0, .55)'; ctx.fill();
      ctx.fillStyle = on ? '#17130a' : '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, by + 4 * dpr);
      ctx.textAlign = 'start';
      F.badges.push([x / dpr, by / dpr, i]);
    });
  }

  if (formScene.heads) drawFormHeads(ctx, dpr, toScreen);
  drawFormRig(ctx, dpr, toScreen);
  drawFormGizmo(ctx, dpr, toScreen);

  if (formScene.lightMarker) {
    // The second light: a small blue dot, for where it is - not a handle.
    if (formScene.fillOn) {
      const [fx, fy, fz] = toScreen(fr.anchor.clone().addScaledVector(fr.Lf, fr.rad * 1.25));
      if (fz < 1) {
        ctx.fillStyle = '#90caf9'; ctx.strokeStyle = 'rgba(0, 0, 0, .6)';
        ctx.beginPath(); ctx.arc(fx, fy, 5 * dpr, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
    }
    // The key light: a sun or lamp where it is, with a ray to the forms.
    let [sx, sy, sz] = toScreen(fr.anchor.clone().addScaledVector(fr.L, fr.markerDist));
    const [tx, ty] = toScreen(fr.anchor);
    // A lamp outside the picture - off to one side, or behind the camera for
    // a front light - still needs a handle to grab and wheel. Pinned to the
    // frame edge in its direction, taken from a point just off the forms
    // (always in front of the camera, unlike the lamp itself), and drawn
    // hollow so it does not read as the lamp's real position.
    const pad = 14 * dpr;
    const pinned = sz >= 1 || sx < pad || sx > w - pad || sy < pad || sy > h - pad;
    if (pinned) {
      const [nx, ny] = toScreen(fr.anchor.clone().addScaledVector(fr.L, fr.rad * 0.5));
      const dx = nx - tx, dy = ny - ty;
      const k = Math.min(
        dx > 0 ? (w - pad - tx) / dx : dx < 0 ? (pad - tx) / dx : Infinity,
        dy > 0 ? (h - pad - ty) / dy : dy < 0 ? (pad - ty) / dy : Infinity);
      if (!isFinite(k)) { sx = tx; sy = pad; } else { sx = tx + dx * k; sy = ty + dy * k; }
    }
    F.marker = [sx / dpr, sy / dpr];
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 213, 79, .8)'; ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(sx, sy, 7 * dpr, 0, 2 * Math.PI);
    if (pinned) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2 * dpr; ctx.stroke(); }
    else { ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = 'rgba(0, 0, 0, .6)'; ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#ffd54f';
    const label = fr.sun ? 'sun' : 'lamp ' + formatLightDist(formScene.lightDist);
    // Label on the inside of the handle, so a handle on the right edge does
    // not print its label off the canvas.
    const lx = sx > w / 2 ? sx - 11 * dpr - ctx.measureText(label).width : sx + 11 * dpr;
    ctx.fillText(label, lx, sy + 4 * dpr);
    ctx.restore();
  }

  if (formScene.zones) {
    // The key, bottom-left - the colours mean nothing without it.
    const rowH = 16 * dpr, x0 = 10 * dpr, y0 = h - 10 * dpr - FORM_ZONES.length * rowH;
    ctx.fillStyle = 'rgba(0, 0, 0, .55)';
    ctx.fillRect(x0 - 6 * dpr, y0 - 8 * dpr, 132 * dpr, FORM_ZONES.length * rowH + 10 * dpr);
    FORM_ZONES.forEach(([name, hex], i) => {
      const y = y0 + i * rowH;
      ctx.fillStyle = hex; ctx.fillRect(x0, y - 2 * dpr, 12 * dpr, 10 * dpr);
      ctx.fillStyle = '#eee'; ctx.fillText(name, x0 + 18 * dpr, y + 7 * dpr);
    });
  }

  drawFormNav(ctx, dpr);

  if (formScene.horizon) {
    // Eye level: where every horizontal direction vanishes. Traced round the
    // whole circle of them rather than drawn as one line across, because it
    // is one only through a level, ordinary lens - a Dutch angle tilts it and
    // the fisheye bends it into an arc.
    const T = F.T, cam = F.camera, pts = [];
    for (let a = 0; a <= 360; a += 2) {
      const far = new T.Vector3(Math.sin(a * THREE_DEG), 0, Math.cos(a * THREE_DEG)).multiplyScalar(1e4).add(cam.position);
      // In front of the camera, and not so near its side that an ordinary
      // lens throws the point off to infinity.
      const d = far.clone().applyMatrix4(cam.matrixWorldInverse);
      const p = formProject(far);
      pts.push(-d.z > (F.fishK ? -0.17 : 0.02) * d.length() ? [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h] : null);
    }
    const inside = pts.filter(p => p && p[0] >= 0 && p[0] <= w && p[1] >= 0 && p[1] <= h);
    ctx.save();
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    ctx.fillStyle = ctx.strokeStyle = '#4fc3f7';
    if (!inside.length) {
      const dir = cam.getWorldDirection(new T.Vector3()).setY(0).normalize();
      const up = formProject(cam.position.clone().addScaledVector(dir, 1e4)).y > 0;
      ctx.fillText(up ? '↑ eye level is above the frame' : '↓ eye level is below the frame', 10 * dpr, up ? 20 * dpr : h - 10 * dpr);
    } else {
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([8 * dpr, 6 * dpr]);
      ctx.beginPath();
      pts.forEach((p, i) => { if (p) (pts[i - 1] ? ctx.lineTo : ctx.moveTo).call(ctx, p[0], p[1]); });
      ctx.stroke();
      const left = inside.reduce((a, b) => (b[0] < a[0] ? b : a));
      ctx.fillText('eye level', Math.max(left[0], 10 * dpr), left[1] - 6 * dpr);
    }
    ctx.restore();
  }
}

/* The selected figure's skeleton: a line down each bone and a dot at each
   joint - the dots are what you click to pick a joint to bend (the pelvis
   dot is the whole figure). The line of the spine and limbs is also the
   gesture, which is what a figure drawing starts from. */
/* The heads grid: across each figure, a line every head's height from the
   crown down, numbered, as a proportion chart draws it - the chin on the
   first, the crotch near the middle one on a real body. It measures the
   figure standing straight, from the floor it stands on, and turns with it
   but never tilts: a posed figure is held against its standing height. */
function drawFormHeads(ctx, dpr, toScreen) {
  const T = forms.T;
  ctx.save();
  ctx.font = `${11 * dpr}px system-ui, sans-serif`;
  ctx.lineWidth = 1 * dpr;
  formScene.objects.forEach((o, i) => {
    const m = forms.meshes[i];
    if (!m || formShapeDef(o.shape).rig !== 'figure') return;
    const h = figureHeights(o.build, o.sy), tall = h.top - h.bottom, half = 0.6 * o.sx;
    const ry = o.ry * THREE_DEG, across = new T.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const at = (y, side) => toScreen(new T.Vector3(m.position.x, o.y + y, m.position.z).addScaledVector(across, side * half));
    const levels = [];
    for (let k = 0; k * h.unit < tall - 1e-6; k++) levels.push(tall - k * h.unit);
    levels.push(0);
    levels.forEach((y, k) => {
      const a = at(y, -1), b = at(y, 1);
      if (a[2] >= 1 || b[2] >= 1) return;
      ctx.strokeStyle = k === 0 || y === 0 ? 'rgba(216, 162, 74, .9)' : 'rgba(216, 162, 74, .6)';
      ctx.setLineDash(k === 0 || y === 0 ? [] : [4 * dpr, 3 * dpr]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (k === levels.length - 1) return;
      // The number between this line and the next, past the right-hand end.
      const [x, yy] = at((y + levels[k + 1]) / 2, 1.15);
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0, 0, 0, .7)'; ctx.fillStyle = '#f0d9a8';
      ctx.setLineDash([]);
      ctx.strokeText(String(k + 1), x, yy + 4 * dpr); ctx.fillText(String(k + 1), x, yy + 4 * dpr);
      ctx.lineWidth = 1 * dpr;
    });
  });
  ctx.restore();
}

function drawFormRig(ctx, dpr, toScreen) {
  const F = forms, T = F.T, m = F.meshes[formScene.active], rig = m && m.userData.rig;
  if (!rig) return;
  const sel = activeFormJoint();
  const at = node => toScreen(node.getWorldPosition(new T.Vector3()));
  const pts = { '': at(m) };
  for (const [name] of rig.def.joints) pts[name] = at(rig.nodes[name]);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, .45)'; ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  for (const [name, parent] of rig.def.joints) {
    const a = pts[parent || ''], b = pts[name];
    if (a[2] < 1 && b[2] < 1) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  }
  ctx.stroke();
  for (const [key, [x, y, z]] of Object.entries(pts)) {
    if (z >= 1) continue;
    const name = key || null, on = name === sel, hot = F.jointHover === name;
    ctx.beginPath(); ctx.arc(x, y, (on ? 6 : hot ? 5.5 : 4.5) * dpr, 0, 2 * Math.PI);
    ctx.fillStyle = on ? '#d8a24a' : hot ? '#fff' : 'rgba(255, 255, 255, .7)';
    ctx.strokeStyle = 'rgba(0, 0, 0, .7)'; ctx.lineWidth = 1 * dpr;
    ctx.fill(); ctx.stroke();
    F.jointDots.push([x / dpr, y / dpr, name]);
  }
  // The name of the joint under the pointer, else of the one picked - and
  // "Whole figure" only while pointing at the pelvis, not all the time.
  const label = F.jointHover !== undefined ? F.jointHover : sel;
  if (label !== undefined && (label !== null || F.jointHover === null) && !formXf) {
    const [x, y] = pts[label || ''];
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0, 0, 0, .8)'; ctx.fillStyle = '#fff';
    ctx.strokeText(formJointLabel(label), x + 10 * dpr, y - 9 * dpr);
    ctx.fillText(formJointLabel(label), x + 10 * dpr, y - 9 * dpr);
  }
  ctx.restore();
}

// The joint dot under a point on the stage (CSS px): [x, y, name], or
// undefined. The nearest one, since the dots of a folded arm crowd together.
function formJointDotAt(x, y) {
  let best, bd = 10;
  for (const d of forms.jointDots || []) {
    const dist = Math.hypot(x - d[0], y - d[1]);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

/* Cross-sections of the selected form - circles around its own axis, drawn
   in perspective as the ellipses they become - and that axis itself, run out
   past the form. The point of it: every ellipse's minor axis lies along the
   form's axis, the rule a hand-drawn cylinder most often breaks (ellipses
   drawn level while the cylinder leans), and the ellipses get rounder the
   further they are from eye level. */
function drawFormEllipses(ctx, dpr, toScreen) {
  const F = forms, T = F.T, o = activeFormObject(), def = formShapeDef(o.shape);
  const m = F.meshes[formScene.active];
  if (!def.sections || !m) return;
  ctx.save();
  ctx.strokeStyle = '#80deea'; ctx.lineWidth = 1.5 * dpr;
  for (const [y, r] of def.sections) {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * 2 * Math.PI;
      const [x, yy, z] = toScreen(new T.Vector3(r * Math.cos(a), y, r * Math.sin(a)).applyMatrix4(m.matrixWorld));
      if (z >= 1) continue;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const [a0, a1] = def.axis, ext = (a1 - a0) * 0.35;
  const [x0, y0] = toScreen(new T.Vector3(0, a0 - ext, 0).applyMatrix4(m.matrixWorld));
  const [x1, y1] = toScreen(new T.Vector3(0, a1 + ext, 0).applyMatrix4(m.matrixWorld));
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#80deea';
  ctx.fillText('axis', x1 + 6 * dpr, y1);
  ctx.restore();
}

/* The box the selected form sits in - its own local bounds, posed exactly
   like the form - with each edge run out to where it converges. That box is
   what a perspective drawing is built on even for a cylinder or an egg: draw
   the box, then find the form inside it.

   One colour per edge direction. A direction parallel to the picture plane
   has no vanishing point at all, so its edges are drawn as the parallels
   they are - how 1- and 2-point perspective look from the inside. */
function drawVanishingLines(ctx, w, h, dpr) {
  const F = forms, T = F.T, cam = F.camera, m = F.meshes[formScene.active];
  if (!m) return;
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const b = m.userData.localBox || m.geometry.boundingBox, corners = [];
  // Index bits: x = 4, y = 2, z = 1 - corners[k] and corners[k | bit] share an edge.
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    corners.push(new T.Vector3(x, y, z).applyMatrix4(m.matrixWorld));
  }
  const px = v => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; };
  const pts = corners.map(px);
  const fwd = cam.getWorldDirection(new T.Vector3());
  const far = Math.max(w, h) * 20;
  const axes = [[new T.Vector3(1, 0, 0), '#ff6b6b', 4], [new T.Vector3(0, 1, 0), '#69db7c', 2], [new T.Vector3(0, 0, 1), '#4dabf7', 1]];

  ctx.save();
  ctx.lineWidth = 1 * dpr;
  for (const [axis, col, bit] of axes) {
    const d = axis.clone().transformDirection(m.matrixWorld);
    // Parallel lines meet at the vanishing point of d and of -d alike; only
    // the one in front of the camera is on the picture.
    if (d.dot(fwd) < 0) d.negate();
    ctx.strokeStyle = ctx.fillStyle = col;

    // The box itself, solid.
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) if (!(k & bit)) { ctx.moveTo(...pts[k]); ctx.lineTo(...pts[k | bit]); }
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    if (d.dot(fwd) < 0.02) {
      // No vanishing point: run each edge out both ways as a parallel.
      for (let k = 0; k < 8; k++) if (!(k & bit)) {
        const [x1, y1] = pts[k], [x2, y2] = pts[k | bit], l = Math.hypot(x2 - x1, y2 - y1) || 1;
        const ux = (x2 - x1) / l * far, uy = (y2 - y1) / l * far;
        ctx.moveTo(x1 - ux, y1 - uy); ctx.lineTo(x2 + ux, y2 + uy);
      }
      ctx.stroke();
      continue;
    }
    const [vx, vy] = px(cam.position.clone().addScaledVector(d, 1e6));
    for (let k = 0; k < 8; k++) if (!(k & bit)) { ctx.moveTo(...pts[k]); ctx.lineTo(vx, vy); }
    ctx.stroke();

    ctx.globalAlpha = 1;
    const inside = vx >= 0 && vx <= w && vy >= 0 && vy <= h;
    if (inside) {
      ctx.beginPath(); ctx.arc(vx, vy, 5 * dpr, 0, 2 * Math.PI); ctx.fill();
      ctx.fillText('VP', vx + 8 * dpr, vy - 6 * dpr);
    } else {
      // Off the picture - usual with a long lens. Pinned to the frame edge in
      // its direction, so you still know which way to rule the lines.
      const cx = w / 2, cy = h / 2, dx = vx - cx, dy = vy - cy, pad = 16 * dpr;
      const sc = Math.min((w / 2 - pad) / Math.abs(dx || 1e-9), (h / 2 - pad) / Math.abs(dy || 1e-9));
      const ex = cx + dx * sc, ey = cy + dy * sc;
      ctx.beginPath(); ctx.arc(ex, ey, 5 * dpr, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText('VP off frame', ex + (dx > 0 ? -80 : 8) * dpr, ey + (dy > 0 ? -8 : 16) * dpr);
    }
  }
  ctx.restore();
}

/* ---- moving, turning and stretching a form in the view.
   Two ways in, one engine: the handles drawn on the selected form, and
   Blender's keys - G, R, S over the view, then X / Y / Z to lock an axis, a
   typed number for an exact amount, Ctrl to snap, click or Enter to keep it,
   right-click or Esc to put it back. Axes are named Blender's way round - Z
   up, Y into the picture - and coloured the same, so a Blender hand needs no
   translating. Z lifts a form off the floor; it never goes through it. */
const FORM_AXES = {
  x: { color: '#ff5c5c', dir: [1, 0, 0] },
  y: { color: '#7bd66a', dir: [0, 0, -1] },
  z: { color: '#5c9dff', dir: [0, 1, 0] },
};
// Scale acts in the form's own frame, whose "up" is its height.
const FORM_SCALE_KEY = { x: 'sx', y: 'sz', z: 'sy' };
const FORM_GIZMO_KEY = 'refboard.formsGizmo.v1';
const FORM_GIZMO_PX = 72; // handle length on screen, CSS px
let formGizmoMode = (() => {
  try { const v = localStorage.getItem(FORM_GIZMO_KEY); return ['move', 'rotate', 'scale', 'off'].includes(v) ? v : 'move'; }
  catch { return 'move'; }
})();
let formXf = null; // the transform in progress, if any

function formAxisDir(axis, q = null) {
  const d = new forms.T.Vector3(...FORM_AXES[axis].dir);
  return q ? d.applyQuaternion(q) : d;
}
// World units per CSS pixel at the depth of P: what keeps the handles the
// same size on screen however far the form is.
function formWorldPerPx(P) {
  const cam = forms.camera;
  const depth = P.clone().sub(cam.position).dot(cam.getWorldDirection(new forms.T.Vector3()));
  return 2 * depth * Math.tan(cam.fov * THREE_DEG / 2) / el('formsStage').clientHeight;
}
function formClientPos(P) {
  const rect = forms.renderer.domElement.getBoundingClientRect(), p = formProject(P);
  return [rect.left + (p.x + 1) / 2 * rect.width, rect.top + (1 - p.y) / 2 * rect.height];
}
// Where along the line P + t*d (d unit length) passes closest to the ray.
function rayLineParam(ray, P, d) {
  const w0 = P.clone().sub(ray.origin);
  const b = d.dot(ray.direction), den = 1 - b * b;
  if (den < 1e-6) return null; // the axis points straight down the ray
  return (b * ray.direction.dot(w0) - d.dot(w0)) / den;
}

/* The handles, drawn for the selected form in the mode the toolbar picks,
   and remembered as screen shapes for hit-testing (F.gizmo). While a
   transform runs they give way to what Blender shows instead: the locked
   axis as a line through the form, and a line out to the pointer. */
function drawFormGizmo(ctx, dpr, toScreen) {
  const F = forms, T = F.T, m = F.meshes[formScene.active], xf = formXf;
  if (!m || !m.userData.center) return;
  // A joint turns about its own pivot, not the figure's middle.
  const P = xf && xf.joint ? xf.P : m.userData.center;
  const [cx, cy, cz] = toScreen(P);
  if (cz >= 1) return;
  const len = FORM_GIZMO_PX * formWorldPerPx(P);
  const css = pts => pts.map(([x, y]) => [x / dpr, y / dpr]);
  const hot = (mode, axis) => F.gizmoHover === mode + ':' + axis;
  ctx.save();
  ctx.lineCap = 'round';

  if (xf) {
    if (xf.axis) {
      const d = formAxisDir(xf.axis, xf.local ? xf.q0 : null);
      const [ax, ay] = toScreen(P.clone().addScaledVector(d, -len * 12));
      const [bx, by] = toScreen(P.clone().addScaledVector(d, len * 12));
      ctx.strokeStyle = FORM_AXES[xf.axis].color; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    if (xf.mode !== 'move') {
      const rect = el('formsStage').getBoundingClientRect();
      ctx.strokeStyle = 'rgba(255, 255, 255, .7)'; ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo((xf.last[0] - rect.left) * dpr, (xf.last[1] - rect.top) * dpr); ctx.stroke();
      ctx.setLineDash([]);
    }
    // What is happening, in Blender's header words, bottom centre.
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    const text = formXfLabel(), tw = ctx.measureText(text).width, W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = 'rgba(0, 0, 0, .65)';
    ctx.fillRect(W / 2 - tw / 2 - 8 * dpr, H - 32 * dpr, tw + 16 * dpr, 22 * dpr);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, H - 17 * dpr);
    ctx.restore();
    return;
  }
  if (formGizmoMode === 'off') { ctx.restore(); return; }

  const stroke = (pts, color, on) => {
    ctx.strokeStyle = color; ctx.lineWidth = (on ? 3.5 : 2) * dpr;
    ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  };

  // A joint picked on a figure: whatever the toolbar says, the handles are
  // rings to bend it with - a joint only turns. They are the joint's own
  // axes (bend, twist, lean), not the world's, since that is how a joint
  // moves; the white ring still turns it about the line of sight.
  const joint = activeFormJoint();
  if (joint) {
    const node = m.userData.rig.nodes[joint];
    const JP = node.getWorldPosition(new T.Vector3()), q = node.getWorldQuaternion(new T.Quaternion());
    const [jx, jy, jz] = toScreen(JP);
    if (jz >= 1) { ctx.restore(); return; }
    const jl = FORM_GIZMO_PX * 0.75 * formWorldPerPx(JP), r = FORM_GIZMO_PX * dpr, ring = [];
    for (let i = 0; i <= 64; i++) ring.push([jx + r * Math.cos(i / 32 * Math.PI), jy + r * Math.sin(i / 32 * Math.PI)]);
    stroke(ring, 'rgba(255, 255, 255, .85)', hot('rotate', null));
    F.gizmo.push({ mode: 'rotate', axis: null, pts: css(ring) });
    for (const k of ['x', 'y', 'z']) {
      const a = formAxisDir(k, q);
      const u = new T.Vector3(1, 0, 0).applyQuaternion(q);
      if (Math.abs(u.dot(a)) > 0.9) u.set(0, 1, 0).applyQuaternion(q);
      const v = a.clone().cross(u).normalize(); u.crossVectors(v, a).normalize();
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 32 * Math.PI;
        const [x, y, z] = toScreen(JP.clone().addScaledVector(u, jl * Math.cos(t)).addScaledVector(v, jl * Math.sin(t)));
        if (z < 1) pts.push([x, y]);
      }
      stroke(pts, FORM_AXES[k].color, hot('rotate', k));
      F.gizmo.push({ mode: 'rotate', axis: k, local: true, pts: css(pts) });
    }
    ctx.restore();
    return;
  }

  // The outer white circle: turn about the line of sight, or scale evenly.
  const outer = () => {
    const r = FORM_GIZMO_PX * 1.3 * dpr, pts = [];
    for (let i = 0; i <= 64; i++) pts.push([cx + r * Math.cos(i / 32 * Math.PI), cy + r * Math.sin(i / 32 * Math.PI)]);
    const mode = formGizmoMode;
    stroke(pts, 'rgba(255, 255, 255, .85)', hot(mode, null));
    F.gizmo.push({ mode, axis: null, pts: css(pts) });
  };

  if (formGizmoMode === 'move') {
    for (const k of ['x', 'y', 'z']) {
      const [ex, ey] = toScreen(P.clone().addScaledVector(formAxisDir(k), len));
      const l = Math.hypot(ex - cx, ey - cy);
      if (l < 14 * dpr) continue; // pointing at the camera: nothing to grab
      const on = hot('move', k), c = FORM_AXES[k].color;
      stroke([[cx, cy], [ex, ey]], c, on);
      const ux = (ex - cx) / l, uy = (ey - cy) / l, a = (on ? 12 : 10) * dpr;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(ex + ux * a, ey + uy * a);
      ctx.lineTo(ex - uy * a * 0.5, ey + ux * a * 0.5); ctx.lineTo(ex + uy * a * 0.5, ey - ux * a * 0.5); ctx.fill();
      F.gizmo.push({ mode: 'move', axis: k, pts: css([[cx, cy], [ex + ux * a, ey + uy * a]]) });
    }
    // The middle square: slide freely along the floor. First in the list so
    // it wins where the arrows start from it.
    const r = (hot('move', null) ? 8 : 6) * dpr;
    ctx.fillStyle = 'rgba(255, 255, 255, .9)'; ctx.strokeStyle = 'rgba(0, 0, 0, .6)'; ctx.lineWidth = 1 * dpr;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); ctx.strokeRect(cx - r, cy - r, 2 * r, 2 * r);
    F.gizmo.unshift({ mode: 'move', axis: null, pts: [[cx / dpr, cy / dpr]], r: 11 });
  } else if (formGizmoMode === 'rotate') {
    outer();
    for (const k of ['x', 'y', 'z']) {
      const a = formAxisDir(k);
      const u = new T.Vector3(a.y, a.z, a.x), v = a.clone().cross(u); // two directions across the axis
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const t = i / 32 * Math.PI;
        const [x, y, z] = toScreen(P.clone().addScaledVector(u, len * Math.cos(t)).addScaledVector(v, len * Math.sin(t)));
        if (z < 1) pts.push([x, y]);
      }
      stroke(pts, FORM_AXES[k].color, hot('rotate', k));
      F.gizmo.push({ mode: 'rotate', axis: k, pts: css(pts) });
    }
  } else {
    outer();
    for (const k of ['x', 'y', 'z']) {
      // The form's own axes: that is what its width, height and depth are.
      const [ex, ey] = toScreen(P.clone().addScaledVector(formAxisDir(k, m.quaternion), len));
      if (Math.hypot(ex - cx, ey - cy) < 14 * dpr) continue;
      const on = hot('scale', k), c = FORM_AXES[k].color, r = (on ? 6 : 5) * dpr;
      stroke([[cx, cy], [ex, ey]], c, on);
      ctx.fillStyle = c; ctx.fillRect(ex - r, ey - r, 2 * r, 2 * r);
      F.gizmo.push({ mode: 'scale', axis: k, pts: css([[cx, cy], [ex, ey]]) });
    }
  }
  ctx.restore();
}

// The handle under a point on the stage (CSS px), or undefined.
function formGizmoAt(x, y) {
  const segDist = ([ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / l2, 0), 1) : 0;
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  };
  return (forms.gizmo || []).find(g => {
    if (g.pts.length === 1) return Math.hypot(x - g.pts[0][0], y - g.pts[0][1]) < g.r;
    for (let i = 1; i < g.pts.length; i++) if (segDist(g.pts[i - 1], g.pts[i]) < 7) return true;
    return false;
  });
}

function setFormGizmoMode(mode) {
  // Pressing the one that is on turns the handles off altogether.
  formGizmoMode = mode === formGizmoMode ? 'off' : mode;
  try { localStorage.setItem(FORM_GIZMO_KEY, formGizmoMode); } catch {}
  for (const b of el('formsTools').children) b.setAttribute('aria-pressed', String(b.dataset.gizmo === formGizmoMode));
  if (forms && forms.frame) drawFormsOverlay();
}

/* ---- undo, for what the handles and keys do to the forms. Only the forms
   are kept, not the lights or the camera: Ctrl+Z after a move should take
   back the move, not also the light you set a moment later. */
let formUndo = [], formRedo = [];
const formObjectsSnapshot = () => ({ objects: structuredClone(formScene.objects), active: formScene.active });
function pushFormUndo(snap) {
  formUndo.push(snap);
  if (formUndo.length > 60) formUndo.shift();
  formRedo = [];
}
function stepFormUndo(back) {
  const from = back ? formUndo : formRedo, to = back ? formRedo : formUndo;
  const snap = from.pop();
  if (!snap) return;
  to.push(formObjectsSnapshot());
  formScene.objects = snap.objects;
  formScene.active = Math.min(snap.active, snap.objects.length - 1);
  formsChanged();
}

/* ---- the axis gizmo, top right: Blender's navigation ball, where Blender has it. It turns with
   the camera, so it always says which way X, Y and Z point in the picture;
   clicking a ball looks along that axis from its side (Z: from above), and
   clicking the one already facing you swaps to the opposite side. Dragging
   on it orbits, like anywhere else on the view. The negative ends are the
   hollow balls. */
const FORM_NAV = { inset: 52, r: 32 }; // CSS px: centre in from the top right corner, reach
const formNavCenter = () => [el('formsStage').clientWidth - FORM_NAV.inset, FORM_NAV.inset];
// [yaw, pitch] that looks at the forms from the + or - end of each axis.
// Blender's Y points into the picture, which is where the camera sits at
// yaw 180; top and bottom face Y up the screen, as Blender's do.
const FORM_NAV_VIEWS = {
  'x+': [90, 0], 'x-': [-90, 0], 'y+': [180, 0], 'y-': [0, 0], 'z+': [0, 88], 'z-': [0, -88],
};

function drawFormNav(ctx, dpr) {
  const F = forms, T = F.T, q = F.camera.quaternion;
  const right = new T.Vector3(1, 0, 0).applyQuaternion(q);
  const up = new T.Vector3(0, 1, 0).applyQuaternion(q);
  const back = new T.Vector3(0, 0, 1).applyQuaternion(q); // towards the viewer
  const [ncx, ncy] = formNavCenter(), cx = ncx * dpr, cy = ncy * dpr, R = FORM_NAV.r * dpr;
  const balls = [];
  for (const k of ['x', 'y', 'z']) for (const sign of ['+', '-']) {
    const d = formAxisDir(k).multiplyScalar(sign === '+' ? 1 : -1);
    balls.push({ k, sign, x: cx + d.dot(right) * R, y: cy - d.dot(up) * R, z: d.dot(back) });
  }
  // Far ones first, so the nearer ball is drawn over whatever it hides.
  balls.sort((a, b) => a.z - b.z);
  ctx.save();
  if (F.navHover) {
    ctx.fillStyle = 'rgba(255, 255, 255, .08)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 13 * dpr, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.font = `bold ${10 * dpr}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of balls) {
    const color = FORM_AXES[b.k].color, hot = F.navHover === b.k + b.sign;
    if (b.sign === '+') {
      ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(b.x, b.y, 8 * dpr, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillText(b.k.toUpperCase(), b.x, b.y + 0.5 * dpr);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, .45)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(b.x, b.y, 7 * dpr, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      if (hot) { ctx.fillStyle = color; ctx.fillText('-' + b.k.toUpperCase(), b.x, b.y + 0.5 * dpr); }
    }
    if (hot) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(b.x, b.y, 10 * dpr, 0, 2 * Math.PI); ctx.stroke();
    }
  }
  ctx.restore();
  // Nearest ball first for hit-testing, the same order the eye sees them.
  F.navHits = balls.reverse().map(b => [b.x / dpr, b.y / dpr, b.k + b.sign]);
}

// The ball under a point on the stage (CSS px) - 'z+' and so on - 'area'
// elsewhere inside the gizmo's circle, or null.
function formNavAt(x, y) {
  const hit = (forms.navHits || []).find(([bx, by]) => Math.hypot(x - bx, y - by) < 10);
  if (hit) return hit[2];
  const [cx, cy] = formNavCenter();
  return Math.hypot(x - cx, y - cy) < FORM_NAV.r + 13 ? 'area' : null;
}

function formNavClick(id) {
  let [yaw, pitch] = FORM_NAV_VIEWS[id];
  if (Math.abs(wrap180(formScene.yaw - yaw)) < 1 && Math.abs(formScene.pitch - pitch) < 1) {
    [yaw, pitch] = FORM_NAV_VIEWS[id[0] + (id[1] === '+' ? '-' : '+')];
  }
  // From under the floor you would see the underside of a plane, not the
  // forms - with the ground showing, "from below" stops at the floor.
  pitch = Math.max(pitch, formFloorPitch());
  animateFormView(yaw, pitch);
}

/* Swings the camera to a view instead of jumping, as Blender does: a jump
   between two views of the same forms is hard to follow - which side is
   which. The short way round, a fifth of a second. */
let formViewAnim = 0;
function animateFormView(yaw, pitch) {
  cancelAnimationFrame(formViewAnim);
  const y0 = formScene.yaw, p0 = formScene.pitch, dy = wrap180(yaw - y0), dp = pitch - p0;
  const set = e => { setFormYaw(wrap180(y0 + dy * e)); formScene.pitch = p0 + dp * e; formsChanged(); };
  if (document.hidden) { set(1); return; } // no frames to animate in
  const t0 = performance.now();
  const step = now => {
    const t = Math.min((now - t0) / 220, 1);
    set(1 - (1 - t) ** 3);
    if (t < 1) formViewAnim = requestAnimationFrame(step);
  };
  formViewAnim = requestAnimationFrame(step);
}

/* Starts a transform of the selected form from a pointer position. Called
   again mid-way to switch mode (G, R or S pressed during another), which
   carries on from where the form now is but keeps the way back to where it
   started. */
function beginFormTransform(mode, clientX, clientY, { axis = null, drag = false, local = false } = {}) {
  const F = forms, T = F.T, m = F.meshes[formScene.active];
  if (!F.frame || !m || !m.userData.center) return;
  const prev = formXf;
  if (!prev) F.lockFrame = { target: F.frame.target.clone(), rad: F.frame.rad, height: F.frame.height };
  const o = activeFormObject();
  let P = m.userData.center.clone().setX(o.x).setZ(o.z);
  let q0 = new T.Quaternion().setFromEuler(new T.Euler(THREE_DEG * o.rx, THREE_DEG * o.ry, THREE_DEG * o.rz, 'YXZ'));
  // Turning with a joint picked turns that joint - about its own pivot, and
  // from the frame it hangs in. Moving and scaling always take the figure.
  const joint = mode === 'rotate' ? activeFormJoint() : null;
  let pq = null;
  if (joint) {
    const node = m.userData.rig.nodes[joint];
    P = node.getWorldPosition(new T.Vector3());
    q0 = node.getWorldQuaternion(new T.Quaternion());
    pq = node.parent.getWorldQuaternion(new T.Quaternion());
  }
  const c = formClientPos(P);
  formXf = {
    mode, axis, local, drag, typed: '', snap: false, joint, pq,
    undo: prev ? prev.undo : formObjectsSnapshot(),
    base: { ...o }, P, c, p0: [clientX, clientY], last: [clientX, clientY], q0,
    ang: Math.atan2(clientY - c[1], clientX - c[0]), turned: 0, value: '',
  };
  F.controls.enabled = false;
  updateFormTransform(clientX, clientY);
}

// The typed amount, once there is a number in it.
function formXfTyped() {
  const v = parseFloat(formXf.typed);
  return Number.isFinite(v) ? v : null;
}

function updateFormTransform(clientX, clientY) {
  const xf = formXf, F = forms, T = F.T;
  if (!xf) return;
  xf.last = [clientX, clientY];
  const o = activeFormObject(), b = xf.base, typed = formXfTyped();
  const r2 = v => Math.round(v * 100) / 100;

  if (xf.mode === 'move') {
    let dx = 0, dy = 0, dz = 0;
    if (xf.axis) {
      const d = formAxisDir(xf.axis);
      let t = typed;
      if (t === null) {
        // Along the axis line, from where it passes nearest the pointer now
        // to where it passed nearest it at the start: the grabbed point stays
        // under the pointer, whatever the angle of view.
        const t1 = rayLineParam(formsRay(clientX, clientY).ray, xf.P, d);
        const t0 = rayLineParam(formsRay(...xf.p0).ray, xf.P, d);
        if (t1 === null || t0 === null) return;
        t = t1 - t0;
        if (xf.snap) t = Math.round(t * 4) / 4;
      }
      dx = d.x * t; dy = d.y * t; dz = d.z * t;
    } else if (typed !== null) {
      dx = typed; // as in Blender: a number with no axis goes along X
    } else {
      // Free: across a floor-level plane through the form's middle.
      const pl = new T.Plane(new T.Vector3(0, 1, 0), -xf.P.y);
      const a = formsRay(...xf.p0).ray.intersectPlane(pl, new T.Vector3());
      const c = formsRay(clientX, clientY).ray.intersectPlane(pl, new T.Vector3());
      if (!a || !c) return; // pointer above the horizon: keep the last good spot
      dx = c.x - a.x; dz = c.z - a.z;
      if (xf.snap) { dx = Math.round(dx * 4) / 4; dz = Math.round(dz * 4) / 4; }
    }
    const lim = v => Math.min(Math.max(r2(v), -FORM_PLACE_LIMIT), FORM_PLACE_LIMIT);
    o.x = lim(b.x + dx); o.z = lim(b.z + dz);
    o.y = Math.min(Math.max(r2(b.y + dy), 0), FORM_PLACE_LIMIT); // never into the floor
    // Reported in Blender's axes: its Y is into the picture (our -z), its Z up.
    const moved = { x: o.x - b.x, y: b.z - o.z, z: o.y - b.y };
    xf.value = xf.axis ? `${xf.axis.toUpperCase()} ${r2(moved[xf.axis]).toFixed(2)}`
      : `X ${r2(moved.x).toFixed(2)}  Y ${r2(moved.y).toFixed(2)}`;
  } else if (xf.mode === 'rotate') {
    const cam = F.camera;
    // No axis: about the line of sight, like R alone in Blender.
    const a = xf.axis ? formAxisDir(xf.axis, xf.local ? xf.q0 : null) : cam.position.clone().sub(xf.P).normalize();
    // The pointer's angle around the form's middle on screen, added up move
    // by move so it can go round more than once.
    const ang = Math.atan2(clientY - xf.c[1], clientX - xf.c[0]);
    let dA = ang - xf.ang;
    dA -= 2 * Math.PI * Math.round(dA / (2 * Math.PI));
    xf.turned += dA; xf.ang = ang;
    let deg = typed;
    if (deg === null) {
      // Screen y runs down, so a growing angle is clockwise to the eye - which
      // is a negative turn about an axis pointing at the viewer.
      const toward = a.dot(cam.position.clone().sub(xf.P)) >= 0;
      deg = (toward ? -xf.turned : xf.turned) / THREE_DEG;
      if (xf.snap) deg = Math.round(deg / 5) * 5;
    }
    // Premultiplied: a turn about a world axis, applied after the pose the
    // form already has. The local axis was carried into the world by q0, so
    // the same product turns it about its own axis.
    const q = new T.Quaternion().setFromAxisAngle(a, deg * THREE_DEG).multiply(xf.q0);
    if (xf.joint) {
      // Back into the frame the joint hangs in: its angles are relative to
      // its parent, so the forearm keeps its bend when the upper arm moves.
      const e = new T.Euler().setFromQuaternion(xf.pq.clone().invert().multiply(q), 'XYZ');
      o.pose = { ...b.pose, [xf.joint]: [e.x, e.y, e.z].map(v => Math.round(v / THREE_DEG * 10) / 10) };
    } else {
      const e = new T.Euler().setFromQuaternion(q, 'YXZ');
      o.rx = Math.round(e.x / THREE_DEG * 10) / 10;
      o.ry = Math.round(e.y / THREE_DEG * 10) / 10;
      o.rz = Math.round(e.z / THREE_DEG * 10) / 10;
    }
    xf.value = `${xf.axis ? xf.axis.toUpperCase() + (xf.local ? ' local' : '') : 'view'} ${Math.round(deg * 10) / 10}°`;
  } else {
    // Blender's scale: distance from the middle now over distance at the start.
    const d0 = Math.max(Math.hypot(xf.p0[0] - xf.c[0], xf.p0[1] - xf.c[1]), 20);
    let f = typed;
    if (f === null) {
      f = Math.hypot(clientX - xf.c[0], clientY - xf.c[1]) / d0;
      if (xf.snap) f = Math.round(f * 10) / 10;
    }
    const lim = v => Math.min(Math.max(r2(v), FORM_SCALE_MIN), FORM_SCALE_MAX);
    if (xf.axis) { const k = FORM_SCALE_KEY[xf.axis]; o[k] = lim(b[k] * f); }
    else { o.sx = lim(b.sx * f); o.sy = lim(b.sy * f); o.sz = lim(b.sz * f); }
    xf.value = `${xf.axis ? xf.axis.toUpperCase() + ' ' : ''}×${r2(f).toFixed(2)}`;
  }
  formsChanged();
}

function formXfLabel() {
  const xf = formXf, name = { move: 'Move', rotate: 'Rotate', scale: 'Scale' }[xf.mode] +
    (xf.joint ? ' ' + formJointLabel(xf.joint).toLowerCase() : '');
  const typed = xf.typed ? `  [${xf.typed}]` : '';
  const hint = xf.drag ? 'Ctrl snap · Esc or right-click cancels'
    : 'X / Y / Z axis · type a number · Ctrl snap · click or Enter keeps it · Esc or right-click cancels';
  return `${name} ${xf.value}${typed}   —   ${hint}`;
}

function endFormTransform(keep) {
  const xf = formXf;
  if (!xf) return;
  formXf = null;
  forms.lockFrame = null;
  forms.controls.enabled = true;
  if (keep) {
    if (JSON.stringify(xf.undo.objects) !== JSON.stringify(formScene.objects)) pushFormUndo(xf.undo);
  } else {
    formScene.objects = xf.undo.objects;
    formScene.active = xf.undo.active;
  }
  formsChanged();
}

// Anywhere keys should drive the 3D view: it is on screen, nothing covers
// it, and no text-like field has the keyboard. A slider or checkbox that
// kept focus after a click does not count - letters mean nothing to it.
function formsKeysLive() {
  if (!forms || el('viewForms').classList.contains('hidden')) return false;
  if (!el('session').classList.contains('hidden') || !el('helpOverlay').classList.contains('hidden')) return false;
  if (el('formsCover').className === 'covered') return false;
  const a = document.activeElement;
  return !(a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' ||
    (a.tagName === 'INPUT' && !['range', 'checkbox', 'button', 'color'].includes(a.type))));
}

/* Keys by e.code - the physical key - not e.key: with a Ukrainian or any
   other layout active, the key marked G types "п", and a shortcut that only
   works on the English layout is one you keep having to switch for. */
function bindFormsKeys() {
  const F = forms;
  const overStage = () => {
    const p = F.pointer, r = el('formsStage').getBoundingClientRect();
    return p && p[0] >= r.left && p[0] <= r.right && p[1] >= r.top && p[1] <= r.bottom;
  };
  const MODES = { KeyG: 'move', KeyR: 'rotate', KeyS: 'scale' };
  const AXES = { KeyX: 'x', KeyY: 'y', KeyZ: 'z' };

  document.addEventListener('keydown', e => {
    if (!formsKeysLive()) return;
    const xf = formXf;
    if (xf) {
      const k = e.code;
      if (k === 'ControlLeft' || k === 'ControlRight') { xf.snap = true; updateFormTransform(...xf.last); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (k === 'Escape') endFormTransform(false);
      else if (k === 'Enter' || k === 'NumpadEnter' || k === 'Space') endFormTransform(true);
      else if (AXES[k]) {
        // Blender's cycle: an axis in the world, again for the form's own
        // axis (turning only - moves and scales already have their one
        // sensible frame), again to let go.
        const a = AXES[k];
        if (xf.axis !== a) { xf.axis = a; xf.local = false; }
        else if (xf.mode === 'rotate' && !xf.local) xf.local = true;
        else { xf.axis = null; xf.local = false; }
        updateFormTransform(...xf.last);
      } else if (MODES[k]) {
        if (MODES[k] !== xf.mode) beginFormTransform(MODES[k], ...xf.last, { drag: xf.drag });
      } else if (k === 'Backspace') { xf.typed = xf.typed.slice(0, -1); updateFormTransform(...xf.last); }
      else if (k === 'Minus' || k === 'NumpadSubtract') {
        // As in Blender, minus flips the sign wherever you are in the number.
        xf.typed = xf.typed.startsWith('-') ? xf.typed.slice(1) : '-' + xf.typed;
        updateFormTransform(...xf.last);
      } else {
        const ch = /^(Digit|Numpad)(\d)$/.exec(k)?.[2] ??
          (k === 'Period' || k === 'NumpadDecimal' || e.key === '.' || e.key === ',' ? '.' : null);
        if (ch !== null && !(ch === '.' && xf.typed.includes('.'))) { xf.typed += ch; updateFormTransform(...xf.last); }
      }
      return;
    }

    const k = e.code;
    // Shift+Alt+Z: overlays off and on, as in Blender. While they are off
    // only the view itself moves - nothing you cannot see can be edited.
    if (k === 'KeyZ' && e.shiftKey && e.altKey && !e.ctrlKey) { e.preventDefault(); setFormsClean(!F.clean); return; }
    if (F.clean) {
      if (k === 'Escape') { e.preventDefault(); setFormsClean(false); return; }
      if (!/^Numpad[1-9]$/.test(k)) return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'KeyZ') {
      e.preventDefault(); stepFormUndo(!e.shiftKey); return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'KeyY') { e.preventDefault(); stepFormUndo(false); return; }
    if (e.ctrlKey || e.metaKey || e.repeat) return;

    if (e.altKey && MODES[k]) {
      // Alt+G / R / S: back to the middle, square to the floor, unit size.
      e.preventDefault();
      const o = activeFormObject(), snap = formObjectsSnapshot(), joint = activeFormJoint();
      if (k === 'KeyG') Object.assign(o, { x: 0, y: 0, z: 0 });
      else if (k === 'KeyR' && joint) { const pose = { ...o.pose }; delete pose[joint]; o.pose = pose; }
      else if (k === 'KeyR') Object.assign(o, { rx: 0, ry: 0, rz: 0 });
      else Object.assign(o, { sx: 1, sy: 1, sz: 1 });
      pushFormUndo(snap);
      formsChanged();
      return;
    }
    if (e.altKey) return;

    if (MODES[k] && !e.shiftKey && overStage()) {
      e.preventDefault();
      beginFormTransform(MODES[k], ...F.pointer);
      return;
    }
    if (k === 'KeyD' && e.shiftKey && overStage() && formScene.objects.length < FORM_MAX_OBJECTS) {
      // Shift+D: a copy, already on the move - Esc takes the copy away again.
      e.preventDefault();
      const snap = formObjectsSnapshot();
      formScene.objects.push({ ...activeFormObject() });
      formScene.active = formScene.objects.length - 1;
      formsChanged();
      // Its handles need a frame to exist before they can be grabbed.
      requestAnimationFrame(() => {
        formsRender(formScene, forms.renderer.domElement.width, forms.renderer.domElement.height);
        beginFormTransform('move', ...F.pointer);
        if (formXf) formXf.undo = snap;
      });
      return;
    }
    if (k === 'Delete' && formScene.objects.length > 1) {
      e.preventDefault();
      pushFormUndo(formObjectsSnapshot());
      removeFormAt(formScene.active);
      formScene.active = Math.max(0, formScene.active - 1);
      formsChanged();
      return;
    }
    // The numpad views: 1 front, 3 right, 7 top (as near straight down as
    // the orbit allows), and 4 / 6 / 8 / 2 step the orbit 15° at a time.
    const views = { Numpad1: FORM_NAV_VIEWS['y-'], Numpad3: FORM_NAV_VIEWS['x+'], Numpad7: FORM_NAV_VIEWS['z+'] };
    const steps = { Numpad4: [-15, 0], Numpad6: [15, 0], Numpad8: [0, 15], Numpad2: [0, -15] };
    if (views[k] || steps[k]) {
      e.preventDefault();
      if (views[k]) { animateFormView(...views[k]); return; }
      let yaw = formScene.yaw, pitch = formScene.pitch;
      { yaw = wrap180(yaw + steps[k][0]); pitch = Math.min(Math.max(pitch + steps[k][1], formFloorPitch()), 88); }
      setFormYaw(yaw);
      formScene.pitch = pitch;
      formsChanged();
    }
  });
  document.addEventListener('keyup', e => {
    if (formXf && (e.code === 'ControlLeft' || e.code === 'ControlRight')) {
      formXf.snap = false; updateFormTransform(...formXf.last);
    }
  });
  // Tracked everywhere, not just over the stage: a transform keeps following
  // the pointer when it leaves the view, as it does in Blender.
  window.addEventListener('pointermove', e => {
    F.pointer = [e.clientX, e.clientY];
    if (formXf) { formXf.snap = e.ctrlKey; updateFormTransform(e.clientX, e.clientY); }
  });
  // Leaving the view mid-transform keeps what was done so far.
  window.addEventListener('blur', () => endFormTransform(true));

  el('formsTools').addEventListener('click', e => {
    const b = e.target.closest('[data-gizmo]');
    if (b) setFormGizmoMode(b.dataset.gizmo);
    if (e.target.closest('[data-clean]')) setFormsClean(!F.clean);
  });
  for (const b of el('formsTools').children) b.setAttribute('aria-pressed', String(b.dataset.gizmo === formGizmoMode));
}

/* Clean view: the scene and nothing else - no handles, badges, skeleton,
   axis ball or guides, in the render (contour lines, zones, floor grid are
   left out the way an export leaves them out) or over it. For looking at
   the light you have set, or drawing straight from the screen. */
function setFormsClean(on) {
  const F = forms;
  if (!F || F.clean === on) return;
  endFormTransform(true);
  F.clean = on;
  F.navHover = null; F.gizmoHover = null; F.formHover = -1; F.jointHover = undefined;
  el('formsStage').classList.toggle('clean', on);
  el('formsStage').style.cursor = '';
  el('formsTools').querySelector('[data-clean]').setAttribute('aria-pressed', String(on));
  requestFormsRender();
}

let formsFrame = 0;
function requestFormsRender() {
  if (!forms || formsFrame) return;
  formsFrame = requestAnimationFrame(() => {
    formsFrame = 0;
    const stage = el('formsStage');
    if (!stage.clientWidth) return; // view hidden: nothing to size against
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    formsRender(formScene, Math.round(stage.clientWidth * dpr), Math.round(stage.clientHeight * dpr), !!forms.clean);
    // Asked for lower than the floor allows (or a lens or zoom change moved
    // the floor's limit up): the render already stopped at the floor, and
    // the Eye height slider says where.
    if (formScene.pitch < formFloorPitch() - 0.5) { formScene.pitch = formFloorPitch(); syncFormsPanel(); saveFormScene(); }
    syncOrbitLimits();
    drawFormsOverlay();
    syncAnimeNote();
  });
}

/* ---- what to watch on the anime head at the angle it is seen from. Worked
   out from the render: which way the face points in the camera's frame,
   and how wide each eye comes out on screen - on the head's flat mask, and
   the same eyes on Loomis's round ball, to show the difference. */
function animeHeadReading(sc = formScene) {
  const F = forms, T = F.T;
  const i = formShapeDef(sc.objects[sc.active]?.shape).face ? sc.active
    : sc.objects.findIndex(o => formShapeDef(o.shape).face);
  const m = F.meshes[i];
  if (i < 0 || !m || !m.userData.face) return null;
  const cam = F.camera;
  const fwd = new T.Vector3(0, 0, 1).transformDirection(m.matrixWorld).transformDirection(cam.matrixWorldInverse);
  const turn = Math.atan2(fwd.x, fwd.z) / THREE_DEG, tilt = Math.asin(Math.max(-1, Math.min(1, fwd.y))) / THREE_DEG;
  // Screen widths: the aspect matters, NDC is squashed to a square.
  const px = p => { const v = formProject(new T.Vector3(...p).applyMatrix4(m.matrixWorld), cam); return [v.x * cam.aspect, v.y]; };
  const width = ([a, b]) => { const [p, q] = [px(a), px(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1]); };
  const o = sc.objects[i], marks = formAnimeFace().marks(o.eyes);
  const ratio = (a, b) => { const [x, y] = [width(marks[a]), width(marks[b])]; return Math.min(x, y) / Math.max(x, y); };
  return { turn, tilt, mask: ratio('right', 'left'), ball: ratio('rightBall', 'leftBall'),
    hair: o.hair !== 'none' ? { style: o.hair, colour: hairColourName(o.hairColor) } : null,
    eyes: { style: o.eyes, colour: eyeColourName(o.eyeColor) }, expression: o.expression };
}

// The angle as a drawing book names it - and as Generate's From row does.
function animeHeadView(r) {
  const a = Math.abs(r.turn);
  if (a > 115) return 'back';
  if (Math.abs(r.tilt) > 22 && a < 60) return r.tilt > 0 ? 'below' : 'above';
  return a < 12 ? 'front' : a < 65 ? 'three' : 'profile';
}

// What the hair does at each angle - added to the note while it has some.
const ANIME_HAIR_NOTE = {
  front: '<b>Hair:</b> the fringe casts a shadow of its own shape on the forehead - paint that shape, not a gradient.',
  three: '<b>Hair:</b> the ring follows the round of the skull, not the locks - one band, broken where each lock turns.',
  profile: "<b>Hair:</b> it sits well off the skull - the outline is the hair's, higher and further back than the head's.",
  below: "<b>Hair:</b> the undersides of the fringe and the tips lead; the fringe's shadow line is what separates it from the face.",
  above: '<b>Hair:</b> the locks fan out from the crown - start there, and let each one fall from it.',
  back: '<b>Hair:</b> from behind the ring is the whole form: a band round the back of the head, the locks fanning from the crown.',
};

/* What the eyes do at each angle - the anime eye is drawn, not seen, so it
   keeps rules a real eye would break: the lash line keeps its weight, the
   gleams stay put in the iris whatever the turn. Sharp eyes and soft ones
   have little lid to lose; shojo eyes the most. */
const ANIME_EYE_NOTE = {
  front: e => `<b>Eyes:</b> the lash line is the heaviest line on the face, thickest at the outer corner; the iris a tall ellipse ` +
    `cut by it; the gleams on the light's side in both eyes${e.gleams.length > 1 ? ', the big one high, the small one low across from it' : ''}.`,
  three: () => "<b>Eyes:</b> the far eye's iris is a narrower ellipse, and its lash line keeps its full weight - anime does not " +
    'thin it with distance. Looking where the head points, as here, each iris stays mid-eye; looking at you instead, both slide ' +
    "toward the near side of the face - the far eye's iris almost against its inner corner.",
  profile: e => `<b>Eyes:</b> a wedge, open toward the nose: the lash line sweeps back${e.lashes ? ' into its lashes' : ''}, ` +
    'the iris a thin upright ellipse set back from the front edge; the lower lid a short tick.',
  below: () => '<b>Eyes:</b> the lash line arches higher and more of the lower lid shows; the iris tucks up under the lashes.',
  above: e => `<b>Eyes:</b> the upper lid comes down over the iris - ${e.up < 0.1 ? 'already narrow, the eye all but shuts to a line' : 'the eye looks half shut'}; ` +
    'the lash line flattens, and the brows ride close to it.',
  back: () => '',
};

function animeHeadNote(r) {
  const view = animeHeadView(r), pct = v => Math.round(v * 100) + '%';
  const text = {
    front: '<b>Front</b> - both eyes the same, one eye apart. The nose is a mark and the mouth small: nothing breaks the outline of the face.',
    three: `<b>Three-quarter, ${Math.round(Math.abs(r.turn))}°</b> - the far eye is <b>${pct(r.mask)}</b> of the near one: ` +
      `it narrows, but on a real, round head it would be ${pct(r.ball)}. Anime keeps the face a flat mask. ` +
      'The far cheek bulges past the far eye; the nose points toward the far cheek, and the mouth is shorter on that side.',
    profile: '<b>Profile</b> - one eye, seen side-on. The nose is a point on the outline, the chin the lowest one.',
    below: '<b>From below</b> - the eye line curves up (⌒), the eyes move up the face and the chin and jaw grow; the nose tip may hide the nostrils\' mark.',
    above: '<b>From above</b> - the eye line curves down (◡), the forehead and the hair take most of the head, and the features crowd toward the chin.',
    back: '<b>From behind</b> - no face: the round back of the skull, the ears, the jaw\'s corner past the cheek.',
  }[view];
  const eyes = ANIME_EYE_NOTE[view](animeEyeStyle(r.eyes.style));
  // The expression, how to draw it - in profile, what it does to the outline.
  const X = animeExpression(r.expression);
  const feel = X === ANIME_EXPRESSIONS.calm || view === 'back' ? ''
    : ` <b>${X.label}:</b> ${view === 'profile' && X.profile ? X.profile[0].toUpperCase() + X.profile.slice(1) : X.hint[0].toUpperCase() + X.hint.slice(1)}`;
  return { view, text: text + feel + (eyes ? ' ' + eyes : '') + (r.hair ? ' ' + ANIME_HAIR_NOTE[view] : '') };
}

function syncAnimeNote() {
  const note = el('formAnimeNote'), r = forms.frame ? animeHeadReading() : null;
  note.classList.toggle('hidden', !r);
  if (!r) return;
  const { view, text } = animeHeadNote(r);
  const gen = genAvailable();
  const hair = r.hair ? `${r.hair.colour} ${r.hair.style} hair` : '';
  const eyes = `${r.eyes.colour} ${ANIME_EYES[r.eyes.style].label} eyes`;
  const feel = r.expression !== 'calm' ? `, ${animeExpression(r.expression).label.toLowerCase()}` : '';
  const key = text + gen + hair + eyes + feel;
  if (note.dataset.key === key) return;
  note.dataset.key = key;
  note.innerHTML = `<span>${text}</span>` + (gen ? `<button class="chip" type="button" id="formAnimeGen" ` +
    `title="With your ComfyUI: anime heads drawn from this angle, ${hair ? hair + ', ' : ''}${eyes}${feel} - to hold against the 3D one">Draw it at this angle</button>` : '');
}

/* To Generate: anime heads from the angle the 3D one is seen at - the
   drawing a studio would make of it, beside the construction - with its
   hair and eyes, by the names Generate's rows use. */
function animeHeadToGenerate(r) {
  const view = animeHeadView(r), hair = r.hair, E = ANIME_EYES[r.eyes.style];
  Object.assign(genChoices, { subject: 'character', framing: 'head', view, hair: hair ? hair.style : 'any',
    colour: hair ? hair.colour : 'any', eyes: r.eyes.colour, eyeShape: E.gen, expression: animeExpression(r.expression).gen });
  saveGenChoices();
  renderGenerate();
  setView({ kind: 'generate' });
  const seen = { front: 'from the front', three: 'at three-quarters', profile: 'in profile', below: 'from below',
    above: 'from above', back: 'from behind' }[view];
  el('genStatus').textContent = `The anime head's angle: a head ${seen}` +
    `${hair ? `, ${hair.colour} hair, ${HAIR_STYLES[hair.style].label.toLowerCase()}` : ''}, ${r.eyes.colour} eyes` +
    `${E.gen !== 'any' ? ', ' + E.label.toLowerCase() : ''}` +
    `${r.expression !== 'calm' ? ', ' + animeExpression(r.expression).label.toLowerCase() : ''}. Change anything, then Generate.`;
}

/* The expression sheet: one head in every expression (rows) at the angles
   a model sheet shows (columns) - the selected head alone, in the scene's
   light and finish, so each cell differs only in what the row and the
   column say. Row by row, so each face is drawn once per expression. */
// Profile short of 90°: a bob's fringe would hide the whole face side-on,
// and the near-profile is the one a model sheet draws the expression in.
const EXPRESSION_SHEET_VIEWS = [['Front', 0], ['Three-quarter', 35], ['Near profile', 75]];
function animeExpressionSheet(sc, head) {
  const cell = 360, top = 40, side = 120, keys = Object.keys(ANIME_EXPRESSIONS), views = EXPRESSION_SHEET_VIEWS;
  const out = document.createElement('canvas');
  out.width = side + views.length * cell; out.height = top + keys.length * cell;
  const g = out.getContext('2d');
  g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, out.width, out.height);
  g.fillStyle = '#3a3340'; g.font = '600 20px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  views.forEach(([label], c) => g.fillText(label, side + (c + 0.5) * cell, top / 2));
  try {
    keys.forEach((k, r) => {
      for (const [c, [, ry]] of views.entries()) {
        const one = { ...sc, objects: [{ ...head, x: 0, y: 0, z: 0, rx: 0, rz: 0, ry, expression: k }],
          active: 0, lightOn: 0, yaw: 0, pitch: 4, zoom: 0.72 };
        formsRender(one, cell, cell, true);
        g.drawImage(forms.renderer.domElement, side + c * cell, top + r * cell);
      }
      g.fillText(ANIME_EXPRESSIONS[k].label, side / 2, top + (r + 0.5) * cell);
    });
  } finally { requestFormsRender(); }
  return new Promise(res => out.toBlob(res, 'image/png'));
}

async function openExpressionSheet() {
  const btn = el('formExprSheet'), o = activeFormObject();
  if (!formShapeDef(o.shape).face) return;
  btn.disabled = true;
  try {
    const [src] = replaceFormUrls([await animeExpressionSheet(formScene, o)]);
    startSession([{ frames: [src], pack: '3D forms', group: 'Expression sheet' }], { browse: true, label: 'Expression sheet' });
  } finally { btn.disabled = false; }
}

// To Generate: the sheet drawn by the ComfyUI - one character, her
// expressions, in this head's hair and eyes.
function animeSheetToGenerate(o) {
  const E = ANIME_EYES[o.eyes], hair = o.hair !== 'none';
  Object.assign(genChoices, { subject: 'character', framing: 'expressions', view: 'front', hair: hair ? o.hair : 'any',
    colour: hair ? hairColourName(o.hairColor) : 'any', eyes: eyeColourName(o.eyeColor), eyeShape: E.gen });
  saveGenChoices();
  renderGenerate();
  setView({ kind: 'generate' });
  el('genStatus').textContent = `An expression sheet of the anime head: ${hair ? hairColourName(o.hairColor) + ' hair, ' : ''}` +
    `${eyeColourName(o.eyeColor)} eyes. Change anything, then Generate.`;
}

// The anime head on the selected form, turned three-quarters - for What's
// new and Ctrl+K - with `eyes` in that style, if given. Before the view has
// loaded it goes into the saved scene, which the view opens with.
function showAnimeHead(eyes, expression) {
  formScene = formScene || loadFormScene();
  // Coloured the anime way, with hair, unless it has some already.
  const o = activeFormObject(), was = o.shape === 'anime';
  Object.assign(o, { shape: 'anime', pose: FORM_OBJECT_DEFAULTS.pose, rx: 0, ry: 35, rz: 0, sx: 1, sy: 1, sz: 1 });
  if (!was) Object.assign(o, { finish: 'anime', gloss: FORM_FINISHES.anime.gloss, color: '#f6dccb', hair: o.hair === 'none' ? 'bob' : o.hair });
  if (ANIME_EYES[eyes]) o.eyes = eyes;
  if (ANIME_EXPRESSIONS[expression]) o.expression = expression;
  // Its face's tab, where its eyes and expression are set.
  if (forms) { formsChanged(); pickFormTab('face'); } else { saveFormScene(); try { localStorage.setItem(FORM_TAB_KEY, 'face'); } catch {} }
}

// The figure on the selected form in `build`'s proportions, standing, with
// the heads grid on - for What's new and Ctrl+K. Its pose, if it is already
// a figure, is kept: the point is the same pose in other proportions.
function showFigureBuild(build = 'anime') {
  formScene = formScene || loadFormScene();
  const o = activeFormObject();
  if (o.shape !== 'figure') Object.assign(o, { shape: 'figure', pose: FORM_OBJECT_DEFAULTS.pose, rx: 0, ry: 20, rz: 0, sx: 1, sy: 1, sz: 1 });
  o.build = FIGURE_BUILDS[build] ? build : 'anime';
  formScene.heads = true;
  if (forms) { formsChanged(); pickFormTab('object'); } else { saveFormScene(); try { localStorage.setItem(FORM_TAB_KEY, 'object'); } catch {} }
}

/* ---- anime shots (ANIME_SHOTS): the camera's height, lens, distance and
   roll set as a storyboard would pick a shot. The turn is left alone. */
function applyAnimeShot(k) {
  const p = ANIME_SHOTS[k];
  if (!p) return;
  Object.assign(formScene, { pitch: p.pitch, zoom: p.zoom, roll: p.roll, fisheye: p.fisheye });
  // The fisheye has a lens of its own; the slider keeps what it was for after.
  if (!p.fisheye) formScene.focal = p.focal;
  if (forms) formsChanged(); else saveFormScene();
}

// The shot on a figure, for What's new and Ctrl+K: the selected form becomes
// one if the scene has no figure or head to look at, and the View tab opens.
function showAnimeShot(k) {
  formScene = formScene || loadFormScene();
  if (!formShotSubject()) {
    Object.assign(activeFormObject(), { shape: 'figure', pose: FORM_OBJECT_DEFAULTS.pose, rx: 0, ry: 20, rz: 0, sx: 1, sy: 1, sz: 1 });
  }
  applyAnimeShot(k);
  if (forms) pickFormTab('view'); else try { localStorage.setItem(FORM_TAB_KEY, 'view'); } catch {}
}

// Who the shot is of: the selected form if it is a figure or a head, else
// the first one in the scene that is.
function formShotSubject(sc = formScene) {
  const who = o => o && (formRigOf(o.shape) === FORM_RIGS.figure || !!formShapeDef(o.shape).subject);
  return who(sc.objects[sc.active]) ? sc.objects[sc.active] : sc.objects.find(who) || null;
}

function syncShotNote(panel) {
  const k = animeShotOf(formScene), note = el('formShotNote');
  for (const b of panel.querySelectorAll('[data-shot]')) b.setAttribute('aria-pressed', String(b.dataset.shot === k));
  panel.querySelector('[data-k="focal"]').disabled = formScene.fisheye;
  const text = (k ? ANIME_SHOTS[k].hint + '.' : '') +
    (formScene.fisheye ? ' The Lens slider rests while the fisheye is on: it sees 180° across the corners.' : '');
  const gen = !!formShotSubject() && genAvailable();
  const html = (text ? `<span>${esc(text.trim())}</span>` : '') + (gen ? ' <button class="chip" type="button" id="formShotGen" ' +
    'title="With your ComfyUI: this figure or head drawn from this height, through this lens">Draw this shot</button>' : '');
  if (note.innerHTML !== html) note.innerHTML = html;
  note.classList.toggle('hidden', !html);
}

/* To Generate: the shot, by the names its rows use - From for the angle
   (below and above by the camera's height, else by how far round the
   subject it stands), Lens for the fisheye, the roll and the wide lens
   close in, How much for a figure or a head. */
function formShotToGenerate() {
  const o = formShotSubject();
  if (!o) return;
  const sc = formScene, head = !!formShapeDef(o.shape).subject;
  const turn = Math.abs(wrap180(sc.yaw - (o.ry || 0)));
  const view = sc.pitch <= -8 ? 'below' : sc.pitch >= 40 ? 'above'
    : turn < 22 ? 'front' : turn < 67 ? 'three' : turn < 125 ? 'profile' : 'back';
  const lens = sc.fisheye ? 'fisheye' : Math.abs(sc.roll) >= 8 ? 'dutch' : sc.focal <= 24 && sc.zoom <= 0.8 ? 'wide' : 'any';
  Object.assign(genChoices, { subject: 'character', framing: head ? 'head' : 'full', view, lens });
  saveGenChoices();
  renderGenerate();
  setView({ kind: 'generate' });
  const seen = { front: 'from the front', three: 'at three-quarters', profile: 'in profile', below: 'from below',
    above: 'from above', back: 'from behind' }[view];
  const through = { fisheye: ', through a fisheye', dutch: ', at a Dutch angle', wide: ', wide and close', any: '' }[lens];
  el('genStatus').textContent = `The 3D camera's shot: ${head ? 'a head' : 'a whole figure'} ${seen}${through}. Change anything, then Generate.`;
}

function bindAnimeNote() {
  const note = el('formAnimeNote');
  // Its own clicks: the stage under it would take them as a pick or a drag.
  for (const ev of ['pointerdown', 'pointerup', 'click']) note.addEventListener(ev, e => e.stopPropagation());
  note.addEventListener('click', e => {
    const r = e.target.closest('#formAnimeGen') && animeHeadReading();
    if (r) animeHeadToGenerate(r);
  });
}

// OrbitControls works in distances; the scene stores zoom relative to the
// framed distance, so its limits follow whatever the current forms need.
// The lowest the camera may go, in degrees of Eye height: just over the
// floor while it shows (see formsRender()), well under the forms without it.
function formFloorPitch() {
  return formScene.ground ? Math.ceil(forms?.frame?.minPitch ?? 0) : -60;
}

function syncOrbitLimits() {
  const ctl = forms.controls, fr = forms.frame;
  ctl.target.copy(fr.target);
  ctl.minDistance = fr.framed * 0.5;
  ctl.maxDistance = fr.framed * 3;
  // Stops just above the floor while it is showing - from under it you see
  // the underside of a plane that is meant to be the ground under a real
  // object. Without a floor the forms can be seen from below.
  ctl.maxPolarAngle = THREE_DEG * (90 - formFloorPitch());
  ctl.minPolarAngle = THREE_DEG * 2;
}

/* A new random pose of the scene. The ranges are the drill, not an accident:
   - Light never comes from the camera (±30° of it is flat and kills the
     form) and only rarely from far behind, where a form is mostly a
     silhouette - the useful band is the one where light, halftone and core
     shadow are all on screen at once.
   - Tilt and roll stay within what still reads as a form resting on the
     floor at an angle; a fully tumbled cone is just a hard-to-read triangle.
   - Eye level varies, because drawing the same form from above and at table
     height are two different perspective problems.
   Where the forms stand is left alone - that is a composition you made. */
function randomFormScene(base, anyShape) {
  const r = (a, b) => a + Math.random() * (b - a);
  const s = structuredClone(base);
  // The figure is a subject of its own, not one more shape to deal out.
  const keys = Object.keys(FORM_SHAPES).filter(k => !FORM_SHAPES[k].rig && !FORM_SHAPES[k].subject && !FORM_SHAPES[k].cloth);
  for (const o of s.objects) {
    const def = FORM_SHAPES[o.shape];
    if (def && def.rig) {
      // A figure gets a new pose and faces a new way, but stays upright:
      // tipped over, it is not a pose any more. A hand turns every way.
      o.pose = randomFormPose(FORM_RIGS[def.rig]);
      o.rx = def.rig === 'hand' ? Math.round(r(-60, 60)) : 0;
      o.rz = def.rig === 'hand' ? Math.round(r(-40, 40)) : 0;
      o.ry = Math.round(r(-180, 180));
      continue;
    }
    if (def && def.cloth) {
      // A cloth is the folds it fell into: only which way round it is seen.
      o.rx = 0; o.rz = 0; o.ry = Math.round(r(-180, 180));
      continue;
    }
    if (def && def.subject) {
      // A head nods and tilts the way a sitter's does - the angles a head
      // drawing is actually hard at - and turns any way round.
      o.rx = Math.round(r(-30, 25)); o.ry = Math.round(r(-180, 180)); o.rz = Math.round(r(-20, 20));
      continue;
    }
    if (anyShape && FORM_SHAPES[o.shape]) {
      o.shape = keys[Math.floor(Math.random() * keys.length)];
      o.sx = +r(0.6, 1.5).toFixed(2); o.sy = +r(0.6, 1.6).toFixed(2); o.sz = +r(0.6, 1.5).toFixed(2);
    }
    o.rx = Math.round(r(-35, 35)); o.ry = Math.round(r(-180, 180)); o.rz = Math.round(r(-25, 25));
  }
  // New proportions can grow two neighbours into each other. Keep their left-
  // to-right order and push them apart just enough to clear - a rough reach
  // per form (1.45 covers a unit cube's half-diagonal), since exact bounds
  // would need the posed geometry this function does not have.
  if (s.objects.length > 1) {
    const reach = o => 1.45 * Math.max(o.sx, o.sy, o.sz);
    const order = [...s.objects].sort((a, b) => a.x - b.x);
    for (let i = 1; i < order.length; i++) {
      const min = order[i - 1].x + reach(order[i - 1]) + reach(order[i]) + 0.3;
      if (order[i].x < min && Math.abs(order[i].z - order[i - 1].z) < reach(order[i - 1]) + reach(order[i])) {
        order[i].x = +min.toFixed(2);
      }
    }
  }
  s.lightAz = Math.round((Math.random() < 0.5 ? -1 : 1) * r(30, 140));
  s.lightEl = Math.round(r(18, 65));
  s.pitch = Math.round(r(5, 45));
  // A head gets one of the portrait lights, shaken a little and mirrored
  // half the time - a random direction mostly lands somewhere no portrait
  // painter would put a lamp.
  const head = s.objects.find(o => FORM_SHAPES[o.shape] && FORM_SHAPES[o.shape].subject);
  if (head) {
    const keys = Object.keys(PORTRAIT_LIGHTS), p = { ...PORTRAIT_LIGHTS[keys[Math.floor(Math.random() * keys.length)]] };
    const side = Math.random() < 0.5 ? -1 : 1;
    p.az = side * (p.az + r(-10, 10)); if (p.fillAz !== undefined) p.fillAz *= side;
    p.el = Math.max(3, p.el + r(-6, 6));
    s.pitch = Math.round(r(0, 25));
    Object.assign(s, portraitLight(s, head, p));
  }
  return s;
}

function formsSnapshot(sc) {
  const [ew, eh] = formExportSize();
  formsRender(sc, ew, eh, true);
  // The canvas bitmap is captured when toBlob() is called, so the live view
  // redrawing over it afterwards cannot leak into the image.
  return new Promise(res => forms.renderer.domElement.toBlob(res, 'image/png')).finally(requestFormsRender);
}

function replaceFormUrls(blobs) {
  formUrls.forEach(u => URL.revokeObjectURL(u));
  formUrls = blobs.map(b => URL.createObjectURL(b));
  return formUrls;
}

/* ---- your own models. The file is parsed in the browser and never leaves
   it. Every mesh in it is flattened into one geometry in its own pose, so a
   model is just another shape: the same material, finish, light and guides
   as a cube. Normalised to the primitives' size, so the proportion sliders
   and the framing mean the same thing for it. */
async function loadFormModel(file) {
  const F = forms, T = F.T;
  const status = el('formModelStatus');
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  status.textContent = `Loading ${file.name}...`;
  try {
    let root;
    if (ext === 'glb' || ext === 'gltf') {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      root = (await new GLTFLoader().parseAsync(await file.arrayBuffer(), '')).scene;
    } else if (ext === 'obj') {
      const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
      root = new OBJLoader().parse(await file.text());
    } else {
      throw new Error('only .glb, .gltf (self-contained) and .obj files can be loaded');
    }
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    root.updateMatrixWorld(true);
    const parts = [];
    root.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.getAttribute('position')) return;
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      // Only what the shading needs, and the same set on every part - merging
      // refuses parts whose attribute lists differ.
      const out = new T.BufferGeometry();
      out.setAttribute('position', g.getAttribute('position'));
      if (g.getAttribute('normal')) out.setAttribute('normal', g.getAttribute('normal'));
      else out.computeVertexNormals();
      const n = out.getAttribute('position').count;
      out.setAttribute('uv', g.getAttribute('uv') || new T.BufferAttribute(new Float32Array(n * 2), 2));
      parts.push(out);
    });
    if (!parts.length) throw new Error('there is no mesh in that file');
    const geo = mergeGeometries(parts);
    geo.computeBoundingSphere();
    const bs = geo.boundingSphere;
    geo.translate(-bs.center.x, -bs.center.y, -bs.center.z);
    geo.scale(1.3 / bs.radius, 1.3 / bs.radius, 1.3 / bs.radius);
    geo.computeBoundingBox();
    const key = 'model:' + (++F.modelCount);
    F.models[key] = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 18), geometry: geo };
    Object.assign(activeFormObject(), { shape: key, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0 });
    status.textContent = `${file.name} loaded - it lasts until the page is reloaded.`;
    formsChanged();
  } catch (err) {
    console.error('3D forms model:', err);
    status.textContent = `Could not load ${file.name}: ${err.message || err}`;
  }
}

/* ---- memory drill: study a fresh random scene for a few seconds, draw it
   with it hidden, then reveal it to compare. The classic "draw it from
   memory" exercise - it trains looking at structure rather than copying
   contours, because there is nothing left to copy. */
let formMemoryTimer = null;
function startMemoryDrill() {
  clearInterval(formMemoryTimer);
  formScene = randomFormScene(formScene, formScene.anyShape);
  formsChanged();
  const cover = el('formsCover');
  let left = formScene.memorySecs;
  cover.className = 'study';
  cover.innerHTML = `<span>Memorise it - ${left}s</span>`;
  formMemoryTimer = setInterval(() => {
    left--;
    if (left > 0) { cover.innerHTML = `<span>Memorise it - ${left}s</span>`; return; }
    clearInterval(formMemoryTimer);
    cover.className = 'covered';
    cover.textContent = 'Now draw it from memory. Click here to compare.';
  }, 1000);
}

/* ---- view drill: a random scene, and a task to draw it as it is NOT on
   screen - from the other side, from above, under another light or through
   another lens. Then the answer: the view swings to exactly that, to lay
   your drawing against (Check in viewer takes it to the full-screen viewer,
   where Compare lays a photo of the drawing over it). Turning a form in
   your head is the skill all construction drawing rests on, and it is the
   one a reference photo can never test - it only ever shows one side. */
const FORM_VIEW_TASKS = [
  sc => ({ text: 'from a quarter of the way round it, <b>to your right</b>', to: { yaw: wrap180(sc.yaw + 90) } }),
  sc => ({ text: 'from a quarter of the way round it, <b>to your left</b>', to: { yaw: wrap180(sc.yaw - 90) } }),
  sc => ({ text: 'from <b>the far side</b>', to: { yaw: wrap180(sc.yaw + 180) } }),
  sc => ({ text: 'from <b>45° round to your right</b>', to: { yaw: wrap180(sc.yaw + 45) } }),
  sc => sc.pitch < 45
    ? { text: '<b>from high above</b>', to: { pitch: 70 } }
    : { text: '<b>at table height</b> - eye level just over the floor', to: { pitch: 4 } },
  sc => ({ text: 'with <b>the light from the other side</b>', to: { lightAz: -sc.lightAz } }),
  sc => sc.lightEl > 35
    ? { text: 'with <b>the light low</b>, near the horizon - long shadows', to: { lightEl: 12 } }
    : { text: 'with <b>the light high overhead</b> - short shadows', to: { lightEl: 75 } },
  sc => sc.focal >= 35
    ? { text: 'through a <b>wide lens from close up</b> - steeper convergence', to: { focal: 20 } }
    : { text: 'through a <b>long lens from far off</b> - nearly parallel edges', to: { focal: 120 } },
];

function startViewDrill() {
  clearInterval(formMemoryTimer);
  el('formsCover').className = 'hidden';
  formScene = randomFormScene(formScene, formScene.anyShape);
  const task = FORM_VIEW_TASKS[Math.floor(Math.random() * FORM_VIEW_TASKS.length)](formScene);
  const from = {};
  for (const k of Object.keys(task.to)) from[k] = formScene[k];
  forms.drill = { ...task, from, shown: false };
  formsChanged();
  renderViewDrill();
}

// The camera swings, the light and lens just change - the swing is what
// lets you follow where the forms went.
function applyViewDrill(values) {
  const v = { ...values };
  if ('yaw' in v || 'pitch' in v) {
    animateFormView(v.yaw ?? formScene.yaw, v.pitch ?? formScene.pitch);
    delete v.yaw; delete v.pitch;
  }
  if (Object.keys(v).length) { Object.assign(formScene, v); formsChanged(); }
}

function renderViewDrill() {
  const box = el('formsTask'), d = forms.drill;
  box.classList.toggle('hidden', !d);
  if (!d) return;
  box.innerHTML = d.shown
    ? `<span>The answer - how it looks ${d.text}.</span>
       <button class="chip" type="button" data-drill="toggle">Back to the task</button>
       <button class="chip" type="button" data-drill="viewer" title="The answer in the full-screen viewer - Compare there lays a photo of your drawing over it">Check in viewer</button>
       <button class="chip" type="button" data-drill="next">Next</button>
       <button class="chip" type="button" data-drill="end">Done</button>`
    : `<span>Draw this ${d.text}.</span>
       <button class="chip" type="button" data-drill="toggle">Show the answer</button>
       <button class="chip" type="button" data-drill="next" title="A different scene and task">Another</button>
       <button class="chip" type="button" data-drill="end">Done</button>`;
}

function bindViewDrill() {
  el('formsTask').addEventListener('click', async e => {
    const b = e.target.closest('[data-drill]'), d = forms.drill;
    if (!b || !d) return;
    const act = b.dataset.drill;
    if (act === 'toggle') { d.shown = !d.shown; applyViewDrill(d.shown ? d.to : d.from); renderViewDrill(); }
    else if (act === 'next') startViewDrill();
    else if (act === 'end') { forms.drill = null; renderViewDrill(); }
    else if (act === 'viewer') {
      // Rendered from the answer's own values, not the screen: the camera
      // may still be half-way through its swing.
      const sc = { ...formScene, ...d.to };
      const [src] = replaceFormUrls([await formsSnapshot(sc)]);
      startSession([{ frames: [src], pack: '3D forms', group: '3D forms' }], { browse: true, label: '3D forms' });
    }
  });
}

/* ---- panel. Each row is [key, label, min, max, step, unit] for a slider,
   or [key, label, 'color' | 'check']. Keys found in FORM_OBJ_KEYS act on the
   selected form, everything else on the scene. Built once; syncFormsPanel()
   pushes values back in after anything changes several at once. */
const FORM_PANEL = [
  // Ordered by how often you reach for it: what you change every study
  // first, the set-and-forget colours and placement last.
  ['Forms', 'objects', []],
  // Shown only while the selected form is a figure - see syncFormsPanel().
  ['Pose', 'pose', []],
  // Shown only while the selected form is the anime head.
  ['Face', 'hair', []],
  ['Placement', null, [['x', 'Left-right', -FORM_PLACE_LIMIT, FORM_PLACE_LIMIT, 0.05], ['z', 'Back-front', -FORM_PLACE_LIMIT, FORM_PLACE_LIMIT, 0.05],
    ['y', 'Lift', 0, FORM_PLACE_LIMIT, 0.05]]],
  ['Proportions', null, [['sx', 'Width', FORM_SCALE_MIN, FORM_SCALE_MAX, 0.05], ['sy', 'Height', FORM_SCALE_MIN, FORM_SCALE_MAX, 0.05], ['sz', 'Depth', FORM_SCALE_MIN, FORM_SCALE_MAX, 0.05]]],
  // Roll runs the full circle: a rotation made with the rings decomposes
  // into tilt within ±90° but a roll anywhere around.
  ['Rotation', null, [['rx', 'Tilt', -90, 90, 1, '°'], ['ry', 'Turn', -180, 180, 1, '°'], ['rz', 'Roll', -180, 180, 1, '°']]],
  ['Surface', 'finish', [['color', 'Colour', 'color'], ['gloss', 'Shine', 0, 1, 0.02]]],
  ['Light', 'presets', [['lightAz', 'Direction', -180, 180, 1, '°'], ['lightEl', 'Height', 3, 89, 1, '°'],
    ['lightDist', 'Distance', 1.5, LIGHT_SUN, 0.1],
    ['intensity', 'Strength', 0, 2, 0.05], ['softness', 'Softness', 0, 1, 0.02], ['lightColor', 'Colour', 'color']]],
  ['Second light', 'fill', [['fillOn', 'On', 'check'], ['fillShadow', 'Casts a shadow', 'check'], ['fillAz', 'Direction', -180, 180, 1, '°'],
    ['fillEl', 'Height', 3, 89, 1, '°'], ['fillStrength', 'Strength', 0, 1, 0.02], ['fillColor', 'Colour', 'color']]],
  ['Camera', 'camera', [['focal', 'Lens', 18, 200, 1, 'mm'], ['pitch', 'Eye height', -60, 88, 1, '°'], ['roll', 'Roll', -45, 45, 1, '°'],
    ['fisheye', 'Fisheye lens', 'check']]],
  ['Guides', null, [['zones', 'Light and shadow zones', 'check'], ['lines', 'Cross-contour lines', 'check'],
    ['ellipses', 'Ellipses and axis', 'check'], ['vp', 'Vanishing points', 'check'],
    ['horizon', 'Eye-level line', 'check'], ['floorGrid', 'Floor grid', 'check'],
    ['lightMarker', 'Light handles', 'check']]],
  ['Use it', 'actions', []],
  ['Saved scenes', 'scenes', []],
  ['Ambient', null, [['ambient', 'Fill', 0, 1, 0.01], ['bounce', 'Bounce', 0, 1, 0.01], ['occlusion', 'Occlusion', 0, 1, 0.01]]],
  ['Scene', null, [['bg', 'Background', 'color'], ['groundColor', 'Ground', 'color'], ['ground', 'Ground and cast shadow', 'check']]],
  ['Air', 'air', [['haze', 'Haze', 0, 1, 0.02], ['hazeColor', 'Air colour', 'color']]],
];

/* Which panel groups are folded. Per browser and purely a convenience, so
   plain localStorage, apart from the scene - folding a group is not a
   change to the scene and must not end up in its saves or share links. The
   ones folded until you say otherwise are the set-and-forget ones, which
   keeps Placement, Proportions and Rotation near the top of the scroll. */
const FORMS_PANEL_KEY = 'refboard.formsPanel.v1';
/* The panel's tabs: what is being posed, its face (on a head that has one -
   the tab is there only then), how it is lit, how it is seen, and what to
   do with it. Each group lives on one. */
const FORM_TABS = [
  ['object', 'Object', ['Forms', 'Pose', 'Placement', 'Proportions', 'Rotation', 'Surface']],
  ['face', 'Face', ['Face']],
  ['light', 'Light', ['Light', 'Second light', 'Ambient']],
  ['view', 'View', ['Camera', 'Guides', 'Scene', 'Air']],
  ['use', 'Use', ['Use it', 'Saved scenes']],
];
const FORM_TAB_KEY = 'refboard.formsTab.v1';
const formTabOf = title => (FORM_TABS.find(t => t[2].includes(title)) || FORM_TABS[0])[0];
function pickFormTab(name) {
  const panel = el('formsPanel');
  for (const b of panel.querySelectorAll('.tabs [data-ftab]')) b.setAttribute('aria-selected', String(b.dataset.ftab === name));
  for (const g of panel.querySelectorAll('.fgroup')) g.classList.toggle('off-tab', g.dataset.tab !== name);
  try { localStorage.setItem(FORM_TAB_KEY, name); } catch {}
}
const FORM_PANEL_FOLDED = ['Second light', 'Ambient'];
function formPanelCollapsed() {
  try {
    const a = JSON.parse(localStorage.getItem(FORMS_PANEL_KEY));
    if (Array.isArray(a)) return new Set(a);
  } catch {}
  return new Set(FORM_PANEL_FOLDED);
}

function formsPanelHtml() {
  const row = ([k, label, a, b, step, unit = '']) => {
    if (a === 'color') return `<label class="frow"><span>${label}</span><input type="color" data-k="${k}"></label>`;
    if (a === 'check') return `<label class="opt"><input type="checkbox" data-k="${k}"> ${label}</label>`;
    return `<label class="frow"><span>${label}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${step}"><output data-unit="${unit}"></output></label>`;
  };
  const chips = (id, entries, attr, title = () => '') => `<div class="chips" id="${id}">${entries
    .map(([k, v]) => `<button class="chip" type="button" data-${attr}="${k}" title="${esc(title(v))}">${esc(v.label)}</button>`).join('')}</div>`;
  const extras = {
    objects: `<div class="chips" id="formObjects"></div>
      <div class="factions">
        <button class="ghost" type="button" id="formAdd" title="Put another form on the floor beside these">Add form</button>
        <button class="ghost" type="button" id="formRemove" title="Take the selected form away">Remove</button>
        <button class="ghost" type="button" id="formLoadModel" title="Your own model - .glb, .gltf or .obj; or drop the file on the view">Load model...</button>
        <input type="file" id="formModelInput" accept=".glb,.gltf,.obj" class="hidden">
      </div>
      <div class="count" id="formModelStatus"></div>
      <h4>Shape of the selected form</h4>
      <div class="chips" id="formShapes"></div>`,
    // A figure's proportions first - what kind of body, then how it stands.
    pose: `<div id="formBuildWrap"><h4>Body</h4>` + chips('formBuilds', Object.entries(FIGURE_BUILDS), 'build', b => b.hint) +
      `<label class="opt"><input type="checkbox" data-k="heads"> Heads grid</label>
      <div class="count" id="formBuildNote"></div><h4>Pose</h4></div>
      <select id="formJoint" title="Which joint to bend - or click its dot in the view"></select>
      <div class="count" id="formJointHint"></div>
      <div id="formJointRows">${[['Bend', 'Forward and back'], ['Twist', 'About its own length'], ['Lean', 'Out to the side']]
        .map(([l, t], i) => `<label class="frow" title="${t}"><span>${l}</span><input type="range" data-jaxis="${i}" min="-180" max="180" step="1"><output data-unit="°"></output></label>`).join('')}</div>
      <div class="chips" id="formPoses"></div>
      <div class="factions">
        <button class="ghost" type="button" id="formPoseRandom" title="One of the poses above, every joint moved a little">Random pose</button>
        <button class="ghost" type="button" id="formPoseMirror" title="Left and right swapped, as in a mirror - the other half of a contrapposto">Mirror</button>
        <button class="ghost" type="button" id="formPoseReset" title="Back to the rest pose">Reset pose</button>
      </div>`,
    // The face, top down: hair, eyes, expression - the first two alike (a
    // style, the named colours, any other) under your characters, which set
    // both at once; one note for all three, saying what the choice means.
    hair: (() => {
      const swatches = (id, table, attr, key, what) => `<div class="chips hair-colours" id="${id}">${Object.entries(table).map(([k, hex]) =>
        `<button class="chip swatch" type="button" data-${attr}="${hex}" title="${k[0].toUpperCase() + k.slice(1)}" ` +
        `aria-label="${k} ${what}" style="--swatch:${hex}"></button>`).join('')}` +
        `<label class="swatch-own" title="Any other colour"><input type="color" data-k="${key}" aria-label="${what[0].toUpperCase() + what.slice(1)} colour"></label></div>`;
      return `<div class="chips" id="formHairChars"></div>
      <h4 title="Its light is a ring round the head, broken at each lock - turn the head or move the light to see it slide">Hair</h4>` +
        chips('formHair', Object.entries(HAIR_STYLES), 'hair') +
        swatches('formHairColours', HAIR_COLOURS, 'hair-colour', 'hairColor', 'hair') +
        '<h4>Eyes</h4>' + chips('formEyes', Object.entries(ANIME_EYES), 'eyes', e => e.hint) +
        swatches('formEyeColours', EYE_COLOURS, 'eye-colour', 'eyeColor', 'eyes') +
        '<h4>Expression</h4>' + chips('formExpressions', Object.entries(ANIME_EXPRESSIONS), 'expression', x => x.hint) +
        '<div class="count" id="formFaceNote"></div>' +
        `<div class="factions">
          <button class="ghost" type="button" id="formExprSheet" title="This head in every expression, from the front, at three-quarters and in profile - one picture, opened in the viewer">Expression sheet</button>
          <button class="ghost hidden" type="button" id="formExprGen" title="With your ComfyUI: a sheet of one anime character's expressions, in this head's hair and eyes">Draw a sheet</button>
        </div>`;
    })(),
    finish: chips('formFinishes', Object.entries(FORM_FINISHES), 'finish', f => f.hint) +
      `<div class="count hidden" id="formCelNote">Flat tones, as anime is coloured: the colour, its shadow, a highlight.
        For the bright edge, turn on the Second light (Light tab) and pick Rim.</div>`,
    presets: chips('formPresets', Object.entries(LIGHT_PRESETS), 'preset', p => `Light from ${p.az}°, ${p.el}° up`) +
      `<div id="formPortraitWrap" class="hidden"><h4>Portrait lighting - on the selected head</h4>` +
      chips('formPortrait', Object.entries(PORTRAIT_LIGHTS), 'portrait', p => p.hint) + '</div>',
    fill: `<div class="chips">
        <button class="chip" type="button" data-fill="fill" title="Soft light from the other side of the camera - lifts the shadow side">Fill</button>
        <button class="chip" type="button" data-fill="rim" title="Light from behind - a bright edge that separates the form from the background">Rim</button></div>`,
    // Two kinds of preset: the perspective ones square the forms up to show
    // how many vanishing points there are; the anime shots only move the
    // camera, the way a storyboard picks a shot for what it should feel like.
    camera: '<h4>Perspective</h4>' + chips('formPerspective', Object.entries(PERSPECTIVE_PRESETS), 'persp', p => p.hint) +
      '<h4>Anime shots</h4>' + chips('formShots', Object.entries(ANIME_SHOTS), 'shot', p => p.hint) +
      '<div class="count" id="formShotNote"></div>' + `
      <div class="factions">
        <button class="ghost" type="button" id="formResetView" title="Camera back to the default angle and distance - the forms and lights are kept">Reset view</button></div>`,
    actions: `
      <div class="factions">
        <button class="ghost" type="button" id="formRandom" title="New random turn, tilt, light and eye level">Randomize</button>
        <button class="ghost" type="button" id="formView" title="Open this render in the full-screen viewer - tonal split, grid, angle tool, eyedropper">Open in viewer</button>
        <button class="ghost" type="button" id="formSave">Save PNG</button>
        <button class="ghost" type="button" id="formLink" title="A link that opens exactly this scene - on the tablet, or for someone else">Copy link</button>
        <button class="ghost" type="button" id="formReset" title="Every setting back to its default">Reset</button>
      </div>
      <div class="factions" style="align-items:center">
        <input type="number" id="formCount" min="2" max="60" title="How many scenes the session draws">
        <select id="formInterval" title="How long each scene stays up - the same interval the library sessions use"></select>
        <button class="ghost" type="button" id="formDraw" title="A timed session of random scenes">Draw random forms</button>
      </div>
      <label class="opt"><input type="checkbox" data-k="anyShape"> Any shape and proportions</label>
      <div class="factions" style="align-items:center">
        <button class="ghost" type="button" id="formMemory" title="Study a random scene, draw it with it hidden, then compare">Memory drill</button>
        <button class="ghost" type="button" id="formViewDrill" title="Draw a random scene the way it is NOT shown - from another side, above, a different light or lens - then see the answer">View drill</button>
      </div>`,
    air: `<div class="count">The air between you and a far form: with distance its contrast drops, its darks lift
        and everything drifts toward the colour of the air - how a painting says "far" without a line of perspective.</div>
      <div class="factions"><button class="ghost" type="button" id="formDepthPlanes" title="Four of the same form, receding into haze - near, middle and far planes">Depth planes</button></div>`,
    scenes: `<div class="factions">
        <input type="text" id="formSceneName" placeholder="Name this scene" maxlength="40">
        <button class="ghost" type="button" id="formSceneSave">Save</button></div>
      <div class="chips" id="formScenes"></div>`,
  };
  const groups = FORM_PANEL.map(([title, special, rows]) => {
    let body = (special && extras[special]) || '';
    if (special === 'actions') body += row(['memorySecs', 'Study for', 5, 60, 1, 's']);
    const shut = formPanelCollapsed().has(title);
    return `<div class="fgroup${shut ? ' collapsed' : ''}" data-tab="${formTabOf(title)}"><h3><button type="button" class="fhead" data-group="${esc(title)}" aria-expanded="${!shut}">${title}</button></h3>${body}${rows.map(row).join('')}</div>`;
  }).join('');
  return `<div class="tabs" role="tablist">${FORM_TABS.map(([k, label]) =>
    `<button type="button" role="tab" data-ftab="${k}">${label}</button>`).join('')}</div>` + groups;
}

/* Your characters (js/character.js): each sheet with its hair picked, as a
   chip that gives the 3D head her hair and, if the sheet has them, her eyes.
   Read from the store once per visit to the view; a sheet made meanwhile
   in the Colour studio shows up the next time the view opens. */
let formHairCharList = null;
function syncHairChars(o) {
  const box = el('formHairChars');
  if (!formHairCharList) {
    formHairCharList = [];
    storeItems('characters').then(list => {
      const hex = rgb => '#' + rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
      formHairCharList = Object.values(list || {}).filter(d => d && d.parts && d.parts.hair && d.parts.hair.base)
        .sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 4)
        .map(d => ({ name: d.name, hex: hex(d.parts.hair.base), eyes: d.parts.eyes && d.parts.eyes.base ? hex(d.parts.eyes.base) : '' }));
      if (formScene && formShapeDef(activeFormObject().shape).face) syncHairChars(activeFormObject());
    }).catch(() => {});
  }
  const html = formHairCharList.map(c => `<button class="chip" type="button" data-hair-char="${c.hex}" data-eye-char="${c.eyes}" ` +
    `aria-pressed="${c.hex === o.hairColor && (!c.eyes || c.eyes === o.eyeColor)}" ` +
    `title="${c.eyes ? 'Her hair and eyes' : 'Her hair colour'}, from ${esc(c.name)}'s character sheet">` +
    `<i class="dot" style="--swatch:${c.hex}"></i>${c.eyes ? `<i class="dot" style="--swatch:${c.eyes}"></i>` : ''}${esc(c.name)}</button>`).join('');
  if (box.innerHTML !== html) box.innerHTML = html;
  box.classList.toggle('hidden', !html);
}

function syncFormsPanel() {
  const panel = el('formsPanel'), o = activeFormObject();
  for (const inp of panel.querySelectorAll('[data-k]')) {
    const v = formVal(inp.dataset.k);
    if (inp.type === 'checkbox') inp.checked = v;
    else inp.value = v;
    const out = inp.nextElementSibling;
    if (out && out.tagName === 'OUTPUT') {
      out.textContent = inp.dataset.k === 'lightDist' ? formatLightDist(v) : inp.value + out.dataset.unit;
    }
  }
  // Rebuilt rather than updated: which forms exist, which models are loaded
  // and which scenes are saved all change their count, not just their state.
  el('formObjects').innerHTML = formScene.objects.map((ob, i) =>
    `<button class="chip" type="button" data-obj="${i}" aria-pressed="${i === formScene.active}">${i + 1} · ${esc(formShapeDef(ob.shape).label)}</button>`).join('');
  // In kinds, not one long row: the forms to shade, the subjects (a figure,
  // a hand, the heads), cloth, and your own models.
  const kinds = [
    ['Forms', Object.entries(FORM_SHAPES).filter(([, s]) => !s.rig && !s.subject && !s.cloth)],
    ['Figure and head', Object.entries(FORM_SHAPES).filter(([, s]) => s.rig || s.subject)],
    ['Cloth', Object.entries(FORM_SHAPES).filter(([, s]) => s.cloth)],
    ['Your models', Object.entries(forms.models).map(([k, m]) => [k, { label: m.name }])],
  ];
  const shapesHtml = kinds.filter(([, list]) => list.length).map(([title, list]) =>
    `<div class="shape-kind"><span>${title}</span>${list.map(([k, s]) =>
      `<button class="chip" type="button" data-shape="${k}" aria-pressed="${k === o.shape}">${esc(s.label)}</button>`).join('')}</div>`).join('');
  if (el('formShapes').innerHTML !== shapesHtml) el('formShapes').innerHTML = shapesHtml;
  el('formScenes').innerHTML = loadSavedFormScenes().map((e, i) =>
    `<span class="scene-chip"><button class="chip" type="button" data-scene="${i}">${esc(e.name)}</button><button class="icon-btn" type="button" data-scene-del="${i}" title="Delete this saved scene">&times;</button></span>`).join('');
  el('formRemove').disabled = formScene.objects.length < 2;
  el('formAdd').disabled = formScene.objects.length >= FORM_MAX_OBJECTS;

  const rig = formRigOf(o.shape), joint = activeFormJoint();
  panel.querySelector('[data-group="Pose"]').closest('.fgroup').classList.toggle('hidden', !rig);
  if (rig) {
    const js = el('formJoint');
    const opts = `<option value="">${rig.whole}</option>` +
      rig.joints.map(([j, , , label]) => `<option value="${j}">${label}</option>`).join('');
    if (js.innerHTML !== opts) js.innerHTML = opts;
    js.value = joint || '';
    el('formJointHint').textContent = joint
      ? 'R or the rings in the view bend it; Alt+R straightens it.'
      : `Click a dot on a joint, or a part of the ${rig === FORM_RIGS.hand ? 'hand' : 'figure'}, to bend it.`;
    // The class poses are the rig's own - a figure's and a hand's differ.
    const poses = Object.entries(rig.poses).map(([k, p]) =>
      `<button class="chip" type="button" data-pose-preset="${k}">${esc(p.label)}</button>`).join('');
    if (el('formPoses').dataset.rig !== rig.whole) { el('formPoses').innerHTML = poses; el('formPoses').dataset.rig = rig.whole; }
    const figure = rig === FORM_RIGS.figure;
    el('formBuildWrap').classList.toggle('hidden', !figure);
    if (figure) {
      for (const b of panel.querySelectorAll('[data-build]')) b.setAttribute('aria-pressed', String(b.dataset.build === o.build));
      const B = FIGURE_BUILDS[o.build];
      el('formBuildNote').innerHTML = `<b>${figureHeights(o.build).heads.toFixed(1)} heads.</b> ${esc(B.hint)}`;
    }
    el('formPoseMirror').classList.toggle('hidden', !rig.mirror);
    el('formPoseReset').title = rig.reset;
    el('formJointRows').classList.toggle('hidden', !joint);
    const v = (joint && o.pose[joint]) || [0, 0, 0];
    for (const inp of panel.querySelectorAll('[data-jaxis]')) {
      inp.value = v[inp.dataset.jaxis];
      inp.nextElementSibling.textContent = Math.round(inp.value) + '°';
    }
    for (const b of panel.querySelectorAll('[data-pose-preset]')) {
      b.setAttribute('aria-pressed', String(JSON.stringify(cleanFormPose(rig.poses[b.dataset.posePreset].pose, rig)) === JSON.stringify(o.pose)));
    }
  }

  const face = !!formShapeDef(o.shape).face;
  panel.querySelector('[data-group="Face"]').closest('.fgroup').classList.toggle('hidden', !face);
  // Its tab with it: off a head with no face, back to Object.
  const faceTab = panel.querySelector('[data-ftab="face"]');
  faceTab.classList.toggle('hidden', !face);
  if (!face && faceTab.getAttribute('aria-selected') === 'true') pickFormTab('object');
  if (face) {
    for (const b of panel.querySelectorAll('[data-hair]')) b.setAttribute('aria-pressed', String(b.dataset.hair === o.hair));
    for (const b of panel.querySelectorAll('[data-hair-colour]')) b.setAttribute('aria-pressed', String(b.dataset.hairColour === o.hairColor));
    el('formHairColours').classList.toggle('hidden', o.hair === 'none');
    for (const b of panel.querySelectorAll('[data-eyes]')) b.setAttribute('aria-pressed', String(b.dataset.eyes === o.eyes));
    for (const b of panel.querySelectorAll('[data-eye-colour]')) b.setAttribute('aria-pressed', String(b.dataset.eyeColour === o.eyeColor));
    for (const b of panel.querySelectorAll('[data-expression]')) b.setAttribute('aria-pressed', String(b.dataset.expression === o.expression));
    const X = animeExpression(o.expression);
    el('formFaceNote').innerHTML = `<b>${esc(ANIME_EYES[o.eyes].label)}:</b> ${esc(ANIME_EYES[o.eyes].hint)}` +
      (X === ANIME_EXPRESSIONS.calm ? '' : ` <b>${esc(X.label)}:</b> ${esc(X.hint)}`);
    el('formExprGen').classList.toggle('hidden', !genAvailable());
    syncHairChars(o);
  }
  // On the anime head the form's own colour is its skin.
  panel.querySelector('[data-k="color"]').previousElementSibling.textContent = face ? 'Skin' : 'Colour';

  for (const b of panel.querySelectorAll('[data-finish]')) b.setAttribute('aria-pressed', String(b.dataset.finish === o.finish));
  // Under cel shading Shine no longer blurs a highlight - it sizes one.
  const cel = !!FORM_FINISHES[o.finish].cel;
  panel.querySelector('[data-k="gloss"]').previousElementSibling.textContent = cel ? 'Highlight' : 'Shine';
  el('formCelNote').classList.toggle('hidden', !cel);
  const soft = panel.querySelector('[data-k="softness"]');
  soft.disabled = formSceneIsCel(formScene);
  soft.closest('.frow').title = soft.disabled ? 'Cast shadows are hard-edged while a form is Anime'
    : 'How big the light looks - a bare bulb is small, a window or an overcast sky is big. A bigger light throws a softer shadow: still sharp where a form touches the floor, softer the further it is thrown.';
  panel.querySelector('[data-k="fillShadow"]').disabled = formSceneIsCel(formScene);
  for (const [k, tip] of [
    ['fillShadow',"The second light throws a shadow of its own, like the first - fainter, since it is weaker, but it shows a rim light's shadow behind a form and a fill's across the floor. Off, it only lights. Not drawn in Anime."],
    ['ambient', 'The sky: light from above that reaches every surface, in the shadow too. Lifts every shadow evenly.'],
    ['bounce', "Light coming up off the floor, in the floor's own colour - strongest low on a form, fading up it - and light thrown from one form onto another near it, in the first one's colour."],
    ['occlusion', 'How much the forms shut the sky out of what is beside them: a soft dark halo on the floor, and a dark seam where one form meets another or rests on the floor - darkest at the touch, none far away. Only the sky is dimmed - the light itself is not. Off in Anime and the zones view.']]) {
    const r = panel.querySelector('[data-k="' + k + '"]');
    if (r) r.closest('.frow, .opt').title = tip;
  }
  for (const b of panel.querySelectorAll('[data-preset]')) {
    const p = LIGHT_PRESETS[b.dataset.preset];
    b.setAttribute('aria-pressed', String(p.az === formScene.lightAz && p.el === formScene.lightEl));
  }
  const head = !!formShapeDef(o.shape).subject;
  el('formPortraitWrap').classList.toggle('hidden', !head);
  if (head) for (const b of panel.querySelectorAll('[data-portrait]')) {
    const t = portraitLight(formScene, o, PORTRAIT_LIGHTS[b.dataset.portrait]);
    b.setAttribute('aria-pressed', String(t.lightAz === formScene.lightAz && t.lightEl === formScene.lightEl));
  }
  for (const b of panel.querySelectorAll('[data-persp]')) {
    const p = PERSPECTIVE_PRESETS[b.dataset.persp];
    b.setAttribute('aria-pressed', String(formScene.objects.every(ob => !ob.rx && !ob.ry && !ob.rz) &&
      Math.round(formScene.yaw) === p.yaw && Math.round(formScene.pitch) === p.pitch));
  }
  syncShotNote(panel);
  el('formCount').value = formScene.count;
  // Mirrors the session interval rather than keeping one of its own: the two
  // are the same setting, and changing it here changes it there.
  const iv = el('formInterval');
  const opts = PRESETS.map(v => [v, v ? fmt(v) + ' each' : 'No timer']);
  if (!PRESETS.includes(state.secs)) opts.push([state.secs, fmt(state.secs) + ' each']);
  const html = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  if (iv.innerHTML !== html) iv.innerHTML = html;
  iv.value = String(state.secs);
}

function formsChanged() { syncFormsPanel(); saveFormScene(); requestFormsRender(); }

// Moving the camera must not drag the lights with it (see bindFormsOrbit).
function setFormYaw(yaw) {
  const d = yaw - formScene.yaw;
  formScene.lightAz = wrap180(formScene.lightAz - d);
  formScene.fillAz = wrap180(formScene.fillAz - d);
  formScene.yaw = yaw;
}

function bindFormsPanel() {
  const panel = el('formsPanel');
  panel.addEventListener('input', e => {
    if (e.target.id === 'formJoint') { selectFormJoint(e.target.value || null); return; }
    if (e.target.dataset.jaxis !== undefined) {
      const j = activeFormJoint(), o = activeFormObject();
      if (!j) return;
      const v = [...(o.pose[j] || [0, 0, 0])];
      v[Number(e.target.dataset.jaxis)] = Number(e.target.value);
      o.pose = { ...o.pose, [j]: v };
      formsChanged();
      return;
    }
    const k = e.target.dataset.k;
    if (!k) return;
    setFormVal(k, e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'range' ? Number(e.target.value) : e.target.value);
    formsChanged();
  });
  let tab = 'object';
  try { tab = localStorage.getItem(FORM_TAB_KEY) || 'object'; } catch {}
  pickFormTab(FORM_TABS.some(t => t[0] === tab) ? tab : 'object');
  panel.addEventListener('click', e => {
    const hit = sel => e.target.closest(sel);
    let b;
    if ((b = hit('[data-ftab]'))) { pickFormTab(b.dataset.ftab); return; }
    if ((b = hit('.fhead'))) {
      const group = b.closest('.fgroup');
      const shut = group.classList.toggle('collapsed');
      b.setAttribute('aria-expanded', String(!shut));
      const set = formPanelCollapsed();
      if (shut) set.add(b.dataset.group); else set.delete(b.dataset.group);
      try { localStorage.setItem(FORMS_PANEL_KEY, JSON.stringify([...set])); } catch {}
      return;
    }
    if ((b = hit('[data-obj]'))) { formScene.active = Number(b.dataset.obj); formsChanged(); return; }
    if ((b = hit('[data-pose-preset]'))) {
      pushFormUndo(formObjectsSnapshot());
      const rig = activeFormRig();
      activeFormObject().pose = cleanFormPose(rig.poses[b.dataset.posePreset].pose, rig);
      formsChanged();
      return;
    }
    if ((b = hit('[data-shape]'))) {
      const o = activeFormObject();
      // A figure's joints mean nothing to a hand: a new rig starts at rest.
      if (formShapeDef(o.shape).rig !== formShapeDef(b.dataset.shape).rig) o.pose = {};
      o.shape = b.dataset.shape; formsChanged(); return;
    }
    if ((b = hit('[data-build]'))) {
      pushFormUndo(formObjectsSnapshot());
      activeFormObject().build = b.dataset.build;
      formsChanged();
      return;
    }
    if ((b = hit('[data-hair]'))) { activeFormObject().hair = b.dataset.hair; formsChanged(); return; }
    if ((b = hit('[data-hair-colour]'))) { activeFormObject().hairColor = b.dataset.hairColour; formsChanged(); return; }
    if ((b = hit('[data-eyes]'))) { activeFormObject().eyes = b.dataset.eyes; formsChanged(); return; }
    if ((b = hit('[data-eye-colour]'))) { activeFormObject().eyeColor = b.dataset.eyeColour; formsChanged(); return; }
    if ((b = hit('[data-expression]'))) { activeFormObject().expression = b.dataset.expression; formsChanged(); return; }
    if ((b = hit('[data-hair-char]'))) {
      const o = activeFormObject();
      Object.assign(o, { hairColor: b.dataset.hairChar, hair: o.hair === 'none' ? 'bob' : o.hair });
      if (b.dataset.eyeChar) o.eyeColor = b.dataset.eyeChar;
      formsChanged();
      return;
    }
    if ((b = hit('[data-finish]'))) {
      const o = activeFormObject();
      o.finish = b.dataset.finish;
      o.gloss = FORM_FINISHES[o.finish].gloss;
      formsChanged();
      return;
    }
    if ((b = hit('[data-persp]'))) {
      const p = PERSPECTIVE_PRESETS[b.dataset.persp];
      for (const o of formScene.objects) Object.assign(o, { rx: 0, ry: 0, rz: 0 });
      Object.assign(formScene, { pitch: p.pitch, zoom: 1 });
      setFormYaw(p.yaw);
      formsChanged();
      return;
    }
    if ((b = hit('[data-shot]'))) { applyAnimeShot(b.dataset.shot); return; }
    if ((b = hit('#formShotGen'))) { formShotToGenerate(); return; }
    if ((b = hit('[data-preset]'))) {
      const p = LIGHT_PRESETS[b.dataset.preset];
      formScene.lightAz = p.az; formScene.lightEl = p.el;
      formsChanged();
      return;
    }
    if ((b = hit('[data-portrait]'))) {
      Object.assign(formScene, portraitLight(formScene, activeFormObject(), PORTRAIT_LIGHTS[b.dataset.portrait]));
      formsChanged();
      return;
    }
    if ((b = hit('[data-fill]'))) {
      // Both on the side away from the key, since that is the side each of
      // them exists to do something about.
      const side = formScene.lightAz <= 0 ? 1 : -1;
      Object.assign(formScene, b.dataset.fill === 'fill'
        ? { fillOn: true, fillAz: side * 50, fillEl: 12, fillStrength: 0.3, fillColor: '#d6e4ff' }
        : { fillOn: true, fillAz: side * 150, fillEl: 30, fillStrength: 0.8, fillColor: '#ffffff' });
      formsChanged();
      return;
    }
    if ((b = hit('[data-scene-del]'))) {
      const list = loadSavedFormScenes();
      list.splice(Number(b.dataset.sceneDel), 1);
      storeSavedFormScenes(list);
      syncFormsPanel();
      return;
    }
    if ((b = hit('[data-scene]'))) {
      const entry = loadSavedFormScenes()[Number(b.dataset.scene)];
      if (entry) { formScene = normalizeFormScene(entry.scene); formsChanged(); }
    }
  });
  el('formInterval').addEventListener('change', e => {
    // Through the session panel's own chip, so its highlight, the custom box
    // and the saved settings all follow exactly as if it were clicked there.
    const i = PRESETS.indexOf(Number(e.target.value));
    if (i >= 0) el('intervals').children[i].click();
  });
  el('formCount').addEventListener('change', () => {
    formScene.count = Math.min(Math.max(Math.round(Number(el('formCount').value)) || 10, 2), 60);
    formsChanged();
  });

  el('formAdd').addEventListener('click', () => {
    const n = formScene.objects.length;
    if (n >= FORM_MAX_OBJECTS) return;
    // Alternating right and left of the first, far enough apart not to
    // intersect at default size. Where they end up is yours to change.
    const x = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 2.6;
    const shapes = ['sphere', 'cylinder', 'cone', 'cube', 'egg', 'pyramid'];
    formScene.objects.push({ ...FORM_OBJECT_DEFAULTS, shape: shapes[n % shapes.length], x });
    formScene.active = n;
    formsChanged();
  });
  el('formRemove').addEventListener('click', () => {
    if (formScene.objects.length < 2) return;
    removeFormAt(formScene.active);
    formScene.active = Math.max(0, formScene.active - 1);
    formsChanged();
  });
  el('formLoadModel').addEventListener('click', () => el('formModelInput').click());
  el('formModelInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadFormModel(f);
    e.target.value = '';
  });

  el('formSceneSave').addEventListener('click', () => {
    const name = el('formSceneName').value.trim() || `Scene ${loadSavedFormScenes().length + 1}`;
    // Same name replaces, so re-saving a tweaked setup does not pile up copies.
    const list = loadSavedFormScenes().filter(e => e.name !== name);
    list.unshift({ name, scene: structuredClone(formScene) });
    storeSavedFormScenes(list);
    el('formSceneName').value = '';
    syncFormsPanel();
  });

  el('formRandom').addEventListener('click', () => {
    formScene = randomFormScene(formScene, false);
    formsChanged();
  });
  el('formReset').addEventListener('click', () => {
    formScene = defaultFormScene();
    formsChanged();
  });
  el('formLink').addEventListener('click', e => copyLinkText(formSceneLink(), e.currentTarget));
  el('formSave').addEventListener('click', async () => {
    const blob = await formsSnapshot(formScene);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refboard-${formScene.objects.map(o => formShapeDef(o.shape).label.toLowerCase()).join('-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  // Browse mode, like opening a grid thumbnail: "look at this", no clock and
  // nothing logged as practice - see startSession().
  el('formView').addEventListener('click', async () => {
    const [src] = replaceFormUrls([await formsSnapshot(formScene)]);
    startSession([{ frames: [src], pack: '3D forms', group: '3D forms' }], { browse: true, label: '3D forms' });
  });
  el('formDraw').addEventListener('click', async () => {
    const btn = el('formDraw'), label = btn.textContent, blobs = [];
    btn.disabled = true;
    try {
      for (let i = 0; i < formScene.count; i++) {
        btn.textContent = `Rendering ${i + 1}/${formScene.count}...`;
        blobs.push(await formsSnapshot(randomFormScene(formScene, formScene.anyShape)));
      }
    } finally { btn.disabled = false; btn.textContent = label; }
    startSession(replaceFormUrls(blobs).map(src => ({ frames: [src], pack: '3D forms', group: '3D forms' })),
      { label: '3D forms' });
  });
  el('formExprSheet').addEventListener('click', openExpressionSheet);
  el('formExprGen').addEventListener('click', () => animeSheetToGenerate(activeFormObject()));
  el('formMemory').addEventListener('click', startMemoryDrill);
  el('formViewDrill').addEventListener('click', startViewDrill);
  const poseEdit = f => () => { pushFormUndo(formObjectsSnapshot()); f(activeFormObject()); formsChanged(); };
  el('formPoseRandom').addEventListener('click', poseEdit(o => { o.pose = randomFormPose(formRigOf(o.shape)); }));
  el('formPoseMirror').addEventListener('click', poseEdit(mirrorFormPose));
  el('formPoseReset').addEventListener('click', poseEdit(o => { o.pose = {}; }));
  // The same form four times, near to far along a diagonal - the size change
  // and the air change can only be compared like with like. Placed by where
  // they land on screen (x over distance to the camera), so no far one hides
  // exactly behind a near one.
  el('formDepthPlanes').addEventListener('click', () => {
    pushFormUndo(formObjectsSnapshot());
    const base = { ...activeFormObject(), pose: activeFormObject().pose };
    formScene.objects = [[-3.5, 5, 20], [-0.8, 0, -15], [1.8, -5, 35], [4.5, -10, -25]]
      .map(([x, z, ry]) => ({ ...base, x, z, y: 0, ry }));
    // A wide lens: the camera frames the scene at the same size whatever the
    // lens (a dolly zoom), so only a wide one brings it close enough for the
    // far form to shrink the way a far thing does.
    Object.assign(formScene, { active: 0, lightOn: 0, haze: Math.max(formScene.haze, 0.55), yaw: 0, pitch: 6, zoom: 1, focal: 20 });
    formsChanged();
  });
  el('formsCover').addEventListener('click', () => {
    if (el('formsCover').className === 'covered') el('formsCover').className = 'hidden';
  });
}

/* The scene, not the camera, is the source of truth: every render places
   the camera from formScene (that is what lets a snapshot of a random scene
   use its own eye height). OrbitControls moves the camera, and this reads
   where it ended up back into formScene, which the next render then places
   it at again - the same spot, so the two never fight. */
function bindFormsOrbit() {
  const F = forms, ctl = F.controls;
  ctl.addEventListener('change', () => {
    const fr = F.frame;
    if (!fr) return;
    setFormYaw(ctl.getAzimuthalAngle() / THREE_DEG);
    formScene.pitch = 90 - ctl.getPolarAngle() / THREE_DEG;
    formScene.zoom = ctl.getDistance() / fr.framed;
    formsChanged();
  });
  el('formResetView').addEventListener('click', () => {
    setFormYaw(FORM_DEFAULTS.yaw);
    formScene.pitch = FORM_DEFAULTS.pitch;
    formScene.zoom = FORM_DEFAULTS.zoom;
    formsChanged();
  });

  const stage = el('formsStage');
  const near = (e, pt, r) => {
    const b = stage.getBoundingClientRect();
    return !!pt && Math.hypot(e.clientX - b.left - pt[0], e.clientY - b.top - pt[1]) < r;
  };
  const nearMarker = e => near(e, F.marker, 14);
  const badgeAt = e => F.badges.find(bd => near(e, bd, 12));

  // A click, not a drag: OrbitControls owns drags, and a press that moved
  // under 5px was never meant to turn the view. No double-click gesture on
  // the stage - its first click would already have moved the light.
  let down = null, drag = null;
  // Capture phase, on the stage: this runs before OrbitControls' own
  // pointerdown on the canvas inside it, which checks `enabled` first - so
  // grabbing the light handle steers the light instead of orbiting.
  const navAt = e => {
    const b = stage.getBoundingClientRect();
    return formNavAt(e.clientX - b.left, e.clientY - b.top);
  };
  stage.addEventListener('pointerleave', () => {
    if (F.navHover || F.jointHover !== undefined) {
      F.navHover = null; F.jointHover = undefined;
      if (F.frame) drawFormsOverlay();
    }
  });
  const gizmoAt = e => {
    const b = stage.getBoundingClientRect();
    return formGizmoAt(e.clientX - b.left, e.clientY - b.top);
  };
  const jointDotAt = e => {
    const b = stage.getBoundingClientRect();
    return formJointDotAt(e.clientX - b.left, e.clientY - b.top);
  };
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('#formsTools, #formsTask')) { down = null; return; }
    // Clean: the view only turns - no handles to grab, nothing to pick.
    if (F.clean) { down = null; return; }
    if (formXf) {
      // A transform from a key runs until a click: left keeps it, right puts
      // it back - and neither may reach OrbitControls or place the light.
      e.preventDefault(); e.stopPropagation();
      down = null;
      if (e.button === 2) endFormTransform(false);
      else if (e.button === 0 && !formXf.drag) endFormTransform(true);
      return;
    }
    down = e.button === 0 ? [e.clientX, e.clientY] : null;
    // On the axis gizmo a press is left to OrbitControls - dragging there
    // orbits - and only a click, on release, picks a view.
    const onNav = down && navAt(e);
    // A joint dot wins over the rings drawn around a neighbouring joint:
    // picking is decided on release, like any click.
    const onDot = down && jointDotAt(e);
    drag = down && !onNav && !onDot && nearMarker(e) ? beginLightDrag() : null;
    const g = down && !drag && !onNav && !onDot && gizmoAt(e);
    if (g) {
      e.stopPropagation();
      down = null;
      stage.setPointerCapture(e.pointerId);
      beginFormTransform(g.mode, e.clientX, e.clientY, { axis: g.axis, drag: true, local: !!g.local });
      return;
    }
    ctl.enabled = !drag;
    if (drag) stage.setPointerCapture(e.pointerId);
  }, true);
  stage.addEventListener('pointermove', e => {
    if (drag) { dragLightTo(drag, e.clientX, e.clientY); return; }
    if (down || formXf || F.clean) return;
    const nav = navAt(e);
    if (nav !== F.navHover) { F.navHover = nav; if (F.frame) drawFormsOverlay(); }
    if (nav) { stage.style.cursor = nav === 'area' ? '' : 'pointer'; return; }
    const dot = jointDotAt(e), jh = dot ? dot[2] : undefined;
    const g = !dot && gizmoAt(e), key = g ? g.mode + ':' + g.axis : null;
    // A form other than the selected one, under the pointer, is one click
    // from being selected: say so with the cursor and its number badge. So
    // is a part of the selected figure other than the joint picked on it.
    const h = !g && !dot && !nearMarker(e) ? formHit(e.clientX, e.clientY) : null;
    const pick = h ? h.i : -1;
    const hover = pick !== formScene.active ? pick : -1;
    const part = h && pick === formScene.active && formShapeDef(activeFormObject().shape).rig &&
      h.joint !== activeFormJoint() ? h.joint : undefined;
    const jointHover = jh !== undefined ? jh : part;
    if (key !== F.gizmoHover || hover !== F.formHover || jointHover !== F.jointHover) {
      F.gizmoHover = key; F.formHover = hover; F.jointHover = jointHover;
      if (F.frame) drawFormsOverlay();
    }
    stage.style.cursor = nearMarker(e) ? 'move' : g || dot || hover >= 0 || part !== undefined || badgeAt(e) ? 'pointer' : '';
  });
  // The stage has no menu of its own, and right-click is Blender's cancel.
  stage.addEventListener('contextmenu', e => e.preventDefault());
  const release = () => { down = null; drag = null; ctl.enabled = !formXf; };
  stage.addEventListener('pointerup', e => {
    if (formXf && formXf.drag && e.button === 0) { endFormTransform(true); release(); return; }
    if (!drag && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) {
      // A click on another form selects it - the way Blender picks - and
      // only a click on the form already selected, or on the floor, moves
      // the light. So lighting a spot on a second form is two clicks.
      const nav = navAt(e);
      if (nav) { if (nav !== 'area') formNavClick(nav); release(); return; }
      // A joint's dot picks it; the one already picked lets go of it.
      const dot = jointDotAt(e);
      if (dot) { selectFormJoint(dot[2] === activeFormJoint() ? null : dot[2]); release(); return; }
      const bd = badgeAt(e), h = bd ? { i: bd[2] } : formHit(e.clientX, e.clientY), pick = h ? h.i : -1;
      if (pick >= 0 && pick !== formScene.active) {
        formScene.active = pick; F.formHover = -1; F.joint = null; formsChanged();
      } else if (pick >= 0 && formShapeDef(activeFormObject().shape).rig && h.joint !== undefined && h.joint !== activeFormJoint()) {
        // The same rule a level down: on a figure, a click on a part picks
        // its joint (the pelvis: the whole figure), and only a click on the
        // part already picked lights that spot.
        F.jointHover = undefined;
        selectFormJoint(h.joint);
      } else placeLightAt(e.clientX, e.clientY);
    }
    release();
  });
  stage.addEventListener('pointercancel', release);
  // Light distance on the wheel - over the handle, or anywhere with Shift.
  // Plain wheel elsewhere still reaches OrbitControls and zooms the camera.
  // Shift turns a wheel into horizontal scroll in some browsers, hence deltaX.
  stage.addEventListener('wheel', e => {
    if (!e.shiftKey && !nearMarker(e)) return;
    e.preventDefault(); e.stopPropagation();
    const next = Math.min(formScene.lightDist, LIGHT_SUN) * Math.exp((e.deltaY || e.deltaX) * 0.0015);
    formScene.lightDist = next >= LIGHT_SUN ? LIGHT_SUN : Math.max(1.5, +next.toFixed(2));
    formsChanged();
  }, { capture: true, passive: false });
  // Whatever the wheel did above, it must never also scroll the column the
  // stage sits in - the view sliding out from under the cursor mid-zoom.
  stage.addEventListener('wheel', e => e.preventDefault(), { passive: false });

  // A model file dropped straight on the view.
  stage.addEventListener('dragover', e => { e.preventDefault(); });
  stage.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadFormModel(f);
  });
  new ResizeObserver(requestFormsRender).observe(stage);
}

const formatLightDist = v => v >= LIGHT_SUN ? '∞' : '×' + v.toFixed(1);

// Takes a form away; the lamp stays on its own form if that one is left,
// and falls back to the first otherwise.
function removeFormAt(i) {
  formScene.objects.splice(i, 1);
  if (formScene.lightOn === i) formScene.lightOn = 0;
  else if (formScene.lightOn > i) formScene.lightOn--;
}

// What is under a point on the screen: { i, joint } - the form's index, and
// on a figure the joint the part belongs to (null: the pelvis) - or null.
function formHit(clientX, clientY) {
  const hit = formsRay(clientX, clientY).intersectObjects(forms.meshes, true)[0];
  if (!hit) return null;
  let o = hit.object;
  while (o && !forms.meshes.includes(o)) o = o.parent;
  return { i: forms.meshes.indexOf(o), joint: hit.object.userData.joint ?? null };
}
// Which form is under a point on the screen, or -1.
function formAt(clientX, clientY) {
  const h = formHit(clientX, clientY);
  return h ? h.i : -1;
}

function formsRay(clientX, clientY) {
  const F = forms, T = F.T;
  const rect = F.renderer.domElement.getBoundingClientRect();
  const ndc = new T.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2);
  const ray = new T.Raycaster();
  ray.setFromCamera(ndc, F.camera);
  // Through the fisheye, formProject() backwards: how far out the point is
  // gives the angle off the axis.
  if (F.fishK) {
    const x = ndc.x * F.camera.aspect, y = ndc.y, r = Math.hypot(x, y), th = 2 * Math.atan(r / F.fishK);
    const s = r ? Math.sin(th) / r : 0;
    ray.ray.direction.set(x * s, y * s, -Math.cos(th)).transformDirection(F.camera.matrixWorld);
  }
  return ray;
}

// A world direction (towards the light) back into the panel's terms.
function setLightFromVector(L) {
  // 3°..89°: a light below the floor lights nothing on this side of it, and
  // straight overhead has no direction for the slider to show.
  const up = Math.asin(Math.min(Math.max(L.y, -1), 1)) / THREE_DEG;
  formScene.lightEl = Math.round(Math.min(Math.max(up, 3), 89));
  formScene.lightAz = Math.round(wrap180(Math.atan2(L.x, L.z) / THREE_DEG - formScene.yaw));
  formsChanged();
}

/* Dragging the light handle.
   A lamp follows the pointer: it moves in the plane facing the camera at the
   depth it already stands at, so the handle stays under the cursor and
   dragging it away from the forms takes the lamp further away - the
   distance readout changes as it goes. A lamp behind the camera has no such
   plane in view, and the sun has no position at all; both swing on a
   virtual trackball instead - inside a sphere around the forms the pointer
   picks its near surface, outside it the nearest point along the ray, which
   is the rim, with no jump at the boundary. */
function beginLightDrag() {
  const F = forms, T = F.T, fr = F.frame;
  if (!fr) return null;
  const fwd = F.camera.getWorldDirection(new T.Vector3());
  if (!fr.sun) {
    const lamp = fr.anchor.clone().addScaledVector(fr.L, fr.markerDist);
    if (lamp.clone().sub(F.camera.position).dot(fwd) > F.camera.near * 2) {
      return { plane: new T.Plane().setFromNormalAndCoplanarPoint(fwd, lamp) };
    }
  }
  return { plane: null };
}
function dragLightTo(drag, clientX, clientY) {
  const F = forms, T = F.T, fr = F.frame;
  if (!fr) return;
  const ray = formsRay(clientX, clientY).ray;
  if (drag.plane) {
    const p = ray.intersectPlane(drag.plane, new T.Vector3());
    if (!p) return;
    const v = p.sub(fr.anchor);
    if (v.lengthSq() < 1e-9) return;
    formScene.lightDist = Math.round(Math.min(Math.max(v.length() / fr.rad, 1.5), LIGHT_SUN - 0.1) * 10) / 10;
    setLightFromVector(v.normalize());
    return;
  }
  const R = Math.min(fr.markerDist, F.camera.position.distanceTo(fr.anchor) * 0.9);
  const hit = ray.intersectSphere(new T.Sphere(fr.anchor, R), new T.Vector3());
  const p = hit || ray.closestPointToPoint(fr.anchor, new T.Vector3());
  const L = p.sub(fr.anchor);
  if (L.lengthSq() < 1e-9) return;
  setLightFromVector(L.normalize());
}

/* Two ways to aim the key light by clicking, matching the two questions an
   artist actually asks of it:
   - On a form: "I want the light to hit HERE" - the light comes straight
     along that point's surface normal, making it the brightest spot, with
     the terminator a quarter-turn away from it.
   - On the floor: "I want the shadow to fall THERE" - the light comes from
     the opposite side, low enough that the shadow of the forms' top reaches
     the click. A far click is a long evening shadow, a near one a noon one. */
function placeLightAt(clientX, clientY) {
  const F = forms, T = F.T, fr = F.frame;
  if (!fr) return;
  const ray = formsRay(clientX, clientY);
  let L;
  const hit = ray.intersectObjects(F.meshes, true)[0];
  // Either way the lamp moves over to the selected form: it is the one
  // being lit (a click on any other form only selects it - bindFormsOrbit).
  if (hit && hit.face) {
    // The normal matrix, not matrixWorld: a stretched form's normals tilt the
    // opposite way to its surface.
    L = hit.face.normal.clone().applyMatrix3(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  } else {
    const g = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3());
    if (!g) return; // the sky: no direction to take from it
    // Measured from the selected form: its top's shadow lands on the click.
    const m = F.meshes[formScene.active], c = m.userData.center;
    const dx = g.x - c.x, dz = g.z - c.z, d = Math.hypot(dx, dz);
    if (d < 1e-3) return;
    const elev = Math.atan2(m.userData.top, d);
    L = new T.Vector3(-dx / d * Math.cos(elev), Math.sin(elev), -dz / d * Math.cos(elev));
  }
  formScene.lightOn = formScene.active;
  setLightFromVector(L);
}

// Resolves once the 3D view is up - for a command that opens it and then
// renders from it.
const formsReady = () => forms ? Promise.resolve(forms) : (formsLoading || Promise.reject(new Error('3D view not open')));

function showForms() {
  // Character sheets may have changed in the Colour studio meanwhile.
  formHairCharList = null;
  if (forms) { syncFormsPanel(); requestFormsRender(); return; }
  if (formsLoading) return;
  const note = el('formsNoGl'), panel = el('formsPanel');
  note.textContent = 'Loading the 3D engine...';
  note.classList.remove('hidden');
  formsLoading = formsInitThree().then(F => {
    forms = F;
    // A share link wins over what this browser last had - opening one is an
    // explicit request for that scene.
    formScene = formSceneFromHash() || formScene || loadFormScene();
    note.classList.add('hidden');
    panel.innerHTML = formsPanelHtml();
    bindFormsPanel();
    bindFormsOrbit();
    bindAnimeNote();
    bindFormsKeys();
    bindViewDrill();
    syncFormsPanel();
    requestFormsRender();
  }).catch(err => {
    console.error('3D forms:', err);
    formsLoading = null; // the next visit tries again - a dropped connection is not permanent
    note.textContent = window.WebGL2RenderingContext
      ? 'Could not load the 3D engine (three.js, from cdn.jsdelivr.net) - check the connection and open this view again.'
      : 'This browser has no WebGL 2, which the 3D forms need. Every other part of the board still works.';
  });
}
