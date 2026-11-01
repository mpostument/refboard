namespace Refboard.Services;

/// <summary>
/// The text served at GET /api/scene: how anything outside the page - Claude,
/// a script - builds a 3D forms scene. The routes themselves are thin aliases
/// over UserStore documents (see Program.cs); the page does the work, in
/// wwwroot/js/forms-api.js, while the 3D forms view is open.
/// </summary>
public static class SceneApi
{
    public static string Docs(string baseUrl) => $$"""
        # refboard: build a 3D scene over HTTP

        The 3D forms scene is one JSON object. You hand a scene to the page and
        read back what it made of it. The page applies it only while the **3D
        forms view is open in a browser** (it looks every ~1.2 s), so open
        `{{baseUrl}}/` and the 3D forms first.

        ## Routes

        | Route | What |
        |---|---|
        | `GET {{baseUrl}}/api/scene` | this text |
        | `GET {{baseUrl}}/api/scene/schema` | every name a scene may use (shapes, finishes, hair, eyes, expressions, builds, rig joints with limits, poses), the units, and every key's default. Read this before writing a scene: do not guess names. |
        | `PUT {{baseUrl}}/api/scene` | hand over a scene (body below). 204 means *queued*, not applied. |
        | `GET {{baseUrl}}/api/scene/result` | what the last PUT did: `{ at, ok, dropped[], saved, error? }` |
        | `GET {{baseUrl}}/api/scene/saved` | the names of the saved scenes, `{ at, names[] }` - the same list as the chips in 3D forms > Use > Saved scenes |
        | `GET {{baseUrl}}/api/scene/current` | the scene as it is now in the page, `{ at, scene }` (changes made by hand show up too) |

        `schema`, `current`, `saved` and `result` are written by the page: they are 404 until
        the 3D forms view has been open once.

        ## The body of PUT

        ```json
        { "mode": "replace", "scene": { "lightAz": -60, "yaw": 30,
          "objects": [ { "shape": "sphere", "color": "#c8553d", "finish": "glossy", "x": -2 },
                       { "shape": "cube", "x": 1, "ry": 25 } ] } }
        ```

        - `replace` (default): start from the defaults, so the scene is exactly what you wrote.
        - `patch`: keep every scene key you do not name (an `objects` you name is replaced whole).
        - `"save": "Name"` keeps the result among the saved scenes (browser-local, like the Save button; the same
          name is saved over, up to 30 are kept). Alone, `{ "save": "Name" }` saves the scene as it is now.
        - `"load": "Name"` starts from a saved scene (a name from `saved`, any case), alone or with a `patch`:
          `{ "load": "Still life", "mode": "patch", "scene": { "lightAz": 40 }, "save": "Still life, lit left" }`.
        - A bare scene object, without the `{ mode, scene }` wrapper, also works (as `replace`).
        - Missing keys take their defaults. Unknown keys, unknown names and numbers out of range are dropped or
          clamped, and **`result.dropped` lists each one** ("objects[1].finish: \"shiny\" -> \"matte\"").
          An empty `dropped` means the page took everything as written.

        ## The loop

        ```
        curl {{baseUrl}}/api/scene/schema
        curl -X PUT {{baseUrl}}/api/scene -H 'Content-Type: application/json' -d '{ "scene": { ... } }'
        sleep 2; curl {{baseUrl}}/api/scene/result      # dropped should be []
        ```

        then look at the page (a screenshot of the 3D forms view) and adjust with `mode: "patch"`.

        ## Limits

        At most 6 objects. Positions are in a form's half-widths (+-10), angles in degrees. A figure's `pose`
        is `{ joint: [bend, twist, lean] }`; joints are in `schema.rigs.<rig>.joints`, ready poses in
        `schema.rigs.<rig>.poses`. Models loaded from a file cannot be named in a scene.

        This is a plain-HTTP LAN tool: anything that can reach this port can write a scene, the same as it
        can already upload and delete references.
        """;
}
