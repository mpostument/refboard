/* refboard - A scene as text, and a door for Claude: the 3D forms' scene is
   one JSON object (formScene, js/forms.js), so it can be copied out, pasted
   in, and - with the server - handed over by anything that can write a
   document.

   Two ways in, one way of applying:
     - the panel's "Scene as text": copy the scene, paste one (JSON, or a
       #forms= share link) and Load;
     - the server's own document store (/api/items, no new endpoint): while
       the 3D forms are open, the page looks every second or so for the
       document scene-in/next, applies it and deletes it.
   Both go through normalizeFormScene(), so a hand-written scene can only
   ever produce a valid one - and applying says what it had to change
   ("objects[1].finish: 'shiny' -> 'matte'"), because that silence is what
   would otherwise make a wrong name look like a bug in the picture.

   What goes the other way, for the writer's benefit (all under scene-out/):
     schema   every name a scene may use, taken from the live tables - so it
              cannot drift from the code - with the units;
     current  the scene as it is now, after the writer's changes and yours;
     result   what the last scene-in/next did: when, and what was changed;
     saved    the names of the saved scenes (the panel's chips), for "load".
   The document store is the server's, so only there does anything outside
   the page reach it; in the other modes the panel's text box still works. */
"use strict";

const FORMS_API_EVERY = 1200;
let formsApiTimer = null, formsApiBusy = false, formsApiPublished = '', formsApiSaved = '', formsApiSchemaSent = false;

// Everything a scene may say, from the tables the page itself reads.
function formSceneSchema() {
  const names = t => Object.entries(t).map(([id, v]) => ({ id, label: v.label || id }));
  const rigs = {};
  for (const [id, r] of Object.entries(FORM_RIGS)) {
    rigs[id] = {
      joints: r.joints.map(j => {
        let limits = null;
        try { limits = r.limits(j[0]); } catch {}
        return { id: j[0], parent: j[1], label: j[3], limits };
      }),
      poses: Object.fromEntries(Object.entries(r.poses).map(([k, p]) => [k, { label: p.label, pose: p.pose }])),
    };
  }
  return {
    about: 'A scene is { ...sceneKeys, objects: [ {...objectKeys} ] }. Anything missing takes its default; ' +
      'anything unknown or out of range is dropped or clamped, and scene-out/result says which. ' +
      'Write { "scene": {...}, "mode": "replace" | "patch" } to scene-in/next. patch keeps every scene key ' +
      'you do not name (objects, if named, are replaced whole); replace starts from the defaults. ' +
      'Add "save": "name" to keep the result among the saved scenes (the panel chips; the same name is saved over), ' +
      'and "load": "name" to start from one - alone, or before a patch.',
    maxObjects: FORM_MAX_OBJECTS,
    units: {
      'x, z': `floor position, in a form's half-widths, +-${FORM_PLACE_LIMIT}`,
      y: `lift off the floor, up to ${FORM_PLACE_LIMIT}; 0 rests on it`,
      'rx, ry, rz': 'rotation in degrees',
      'sx, sy, sz': `stretch, ${FORM_SCALE_MIN} to ${FORM_SCALE_MAX}`,
      'lightAz, fillAz': 'degrees as seen from the camera: 0 behind your shoulder, +90 from your right',
      'lightEl, fillEl': 'degrees above the horizon',
      lightDist: `in scene radii; ${LIGHT_SUN} and up is the sun (parallel rays)`,
      'yaw, pitch, roll': 'camera degrees; roll is limited to +-45',
      focal: 'lens in mm', 'bg, groundColor, color, ...Color': '#rrggbb',
      pose: '{ joint: [bend, twist, lean] } in degrees, joints from rigs[shape rig]; a joint left out is at rest',
    },
    sceneKeys: Object.fromEntries(Object.entries(FORM_DEFAULTS).filter(([k]) => k !== 'objects')
      .map(([k, v]) => [k, { default: v, type: typeof v }])),
    objectKeys: Object.fromEntries(FORM_OBJ_KEYS.map(k => [k, { default: FORM_OBJECT_DEFAULTS[k], type: typeof FORM_OBJECT_DEFAULTS[k] }])),
    enums: {
      shape: Object.entries(FORM_SHAPES).map(([id, v]) => ({ id, label: v.label, rig: v.rig || null })),
      finish: names(FORM_FINISHES), hair: names(HAIR_STYLES), eyes: names(ANIME_EYES),
      expression: names(ANIME_EXPRESSIONS), build: names(FIGURE_BUILDS), setting: names(FORM_SETTINGS),
    },
    rigs,
  };
}

// The leaves of `raw` that normalizing changed, as short sentences.
function formSceneDropped(raw, norm) {
  const out = [], same = (a, b) => JSON.stringify(a) === JSON.stringify(b), def = FORM_DEFAULTS;
  if (!raw || typeof raw !== 'object') return ['not an object - the defaults were used'];
  for (const k of Object.keys(raw)) {
    if (k === 'objects') continue;
    if (!(k in def)) out.push(`${k}: unknown scene key`);
    else if (!same(raw[k], norm[k])) out.push(`${k}: ${JSON.stringify(raw[k])} -> ${JSON.stringify(norm[k])}`);
  }
  const list = Array.isArray(raw.objects) ? raw.objects : [];
  if (list.length > FORM_MAX_OBJECTS) out.push(`objects: ${list.length} given, only the first ${FORM_MAX_OBJECTS} kept`);
  list.slice(0, FORM_MAX_OBJECTS).forEach((o, i) => {
    for (const k of Object.keys(o || {})) {
      const at = `objects[${i}].${k}`, n = norm.objects[i];
      if (!FORM_OBJ_KEYS.includes(k)) out.push(`${at}: unknown object key`);
      else if (k === 'pose') {
        for (const j of Object.keys(o.pose || {})) if (!(j in n.pose)) out.push(`${at}.${j}: not a joint of this shape, or not three numbers`);
      } else if (!same(o[k], n[k])) out.push(`${at}: ${JSON.stringify(o[k])} -> ${JSON.stringify(n[k])}`);
    }
  });
  return out;
}

// The saved scenes (the panel's chips), by name; a name is saved over, not twice.
const formSavedNames = () => loadSavedFormScenes().map(e => e.name);
function formSceneStore(name) {
  name = String(name).trim().slice(0, 40);
  const list = loadSavedFormScenes().filter(e => e.name.toLowerCase() !== name.toLowerCase());
  list.unshift({ name, scene: structuredClone(formScene) });
  storeSavedFormScenes(list);
  syncFormsPanel();
  return name;
}

// Anything a person or a program might hand over: a scene, a share link, or
// { scene, mode, load, save } - load a saved scene by name instead of (or
// before) a scene, save the result under a name after. Returns
// { dropped, saved } - what normalizing changed, and the name saved under -
// or throws a sentence.
function formSceneApply(input) {
  let raw = input, mode = 'replace', load = null, save = null;
  if (typeof raw === 'string') {
    const t = raw.trim(), m = /#forms=([\w-]+)/.exec(t);
    try {
      raw = m ? JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))) : JSON.parse(t);
    } catch { throw new Error('That is neither JSON nor a refboard share link.'); }
  }
  if (raw && typeof raw === 'object' && ('scene' in raw || 'load' in raw || 'save' in raw)) {
    mode = raw.mode === 'patch' ? 'patch' : 'replace';
    load = typeof raw.load === 'string' ? raw.load : null;
    save = typeof raw.save === 'string' && raw.save.trim() ? raw.save : null;
    raw = raw.scene && typeof raw.scene === 'object' ? raw.scene : null;
    if (!raw && !load && !save) throw new Error('Nothing to do: give a scene, a name to load, or a name to save.');
  }
  let dropped = [];
  if (load) {
    const e = loadSavedFormScenes().find(e => e.name.toLowerCase() === load.trim().toLowerCase());
    if (!e) throw new Error(`No saved scene called "${load}". Saved: ${formSavedNames().join(', ') || 'none'}.`);
    formScene = normalizeFormScene(e.scene);
    formsChanged();
  }
  if (raw) {
    if (typeof raw !== 'object') throw new Error('A scene is a JSON object.');
    const norm = normalizeFormScene(mode === 'patch' || load ? { ...formScene, ...raw } : raw);
    dropped = formSceneDropped(raw, norm);
    formScene = norm;
    formsChanged();
  }
  return { dropped, saved: save ? formSceneStore(save) : null };
}

function formSceneText() { return JSON.stringify(formScene, null, 1); }

async function formsApiTick() {
  if (formsApiBusy || storeMode !== 'server' || view.kind !== 'forms' || !formScene) return;
  formsApiBusy = true;
  try {
    if (!formsApiSchemaSent) {
      await storePutItem('scene-out', 'schema', formSceneSchema());
      formsApiSchemaSent = true;
    }
    const inbox = (await storeItems('scene-in')).next;
    if (inbox) {
      // Deleted first: a scene that throws must not be tried again every second.
      await storeDeleteItem('scene-in', 'next');
      let result;
      try { result = { ok: true, ...formSceneApply(inbox) }; }
      catch (e) { result = { ok: false, error: e.message, dropped: [], saved: null }; }
      await storePutItem('scene-out', 'result', { at: new Date().toISOString(), ...result });
    }
    const names = JSON.stringify(formSavedNames());
    if (names !== formsApiSaved) {
      await storePutItem('scene-out', 'saved', { at: new Date().toISOString(), names: JSON.parse(names) });
      formsApiSaved = names;
    }
    const now = formSceneText();
    if (now !== formsApiPublished) {
      await storePutItem('scene-out', 'current', { at: new Date().toISOString(), scene: formScene });
      formsApiPublished = now;
    }
  } catch {} finally { formsApiBusy = false; }
}

// The panel's text box, and the server loop while this view is open.
function bindFormsApi() {
  const msg = t => { el('formSceneMsg').textContent = t; };
  el('formSceneCopy').addEventListener('click', async () => {
    el('formSceneText').value = formSceneText();
    try { await navigator.clipboard.writeText(el('formSceneText').value); msg('Copied. Paste it anywhere, or hand it to Claude.'); }
    catch { msg('Select the text and copy it yourself.'); }
  });
  el('formSceneLoad').addEventListener('click', () => {
    try {
      const d = formSceneApply(el('formSceneText').value).dropped;
      msg(d.length ? `Loaded; ${d.length} thing${d.length > 1 ? 's' : ''} changed: ${d.slice(0, 3).join('; ')}${d.length > 3 ? '...' : ''}` : 'Loaded.');
    } catch (e) { msg(e.message); }
  });
  clearInterval(formsApiTimer);
  formsApiTimer = setInterval(formsApiTick, FORMS_API_EVERY);
}
