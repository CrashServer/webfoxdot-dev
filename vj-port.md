# Absorbing the workshop's visuals into crashDot

Branch `exp_ui_vj`. The decision (2026-09-08) was to **absorb** the stars/workshop
VJ tool's rendering into crashDot rather than bridge to it or host it in an iframe.

Source: `/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop`.

## What was already there (and reframed the job)

- `serve.py` already serves the workshop at `/workshop/`, same origin.
- `js/net/workshop-bridge.js` ↔ the workshop's `src/net/bridge.js` already talk over
  `BroadcastChannel('crashdot-workshop')`, with a documented command set.
- `js/visuals/vdata.js` already lists **49 workshop scene names** (`WS_SCENES`) and
  `vlang.js` already routes `video1 >> mandelbulb()` to the workshop over that bridge.

So the vocabulary exists. Absorbing means making those names render HERE.

## The two scene models, and why both are kept

| | crashDot scene | workshop layer |
|---|---|---|
| interface | `field(u,v,t,p,a) → 0..1` | `draw(ctx,w,h,p,t,extra)` |
| output | scalar field, coloured by a palette | imperative RGBA, owns its colour |
| state | none (pure) | per-canvas, via a `WeakMap` |
| GPU | mirrored into one mega-shader (`scenes-glsl.js`) | 2D canvas; 10 layers use a shared WebGL2 context |
| count | 50 | 206 |

Neither can be expressed as the other. A scalar field cannot carry per-pixel colour;
an imperative draw cannot be evaluated per-pixel in a fragment shader. So the
renderer grows a **second layer kind** rather than translating 206 draws into fields.

## Feasibility — the number that mattered

**191 of 207 layer files import nothing at all.** Ten import a `webgl/gl*.js` module,
six import `_livecodeParse.js`. That is why 32.6k lines could be copied essentially
verbatim: the layers are pure draw functions, and the workshop's own modulation
matrix has already resolved params to plain numbers before `draw` is called —
exactly what crashDot's `vlang` resolver produces.

## Stage 1 — done

- `js/visuals/workshop/layers/` (207 files) and `js/visuals/workshop/webgl/` (12),
  copied unmodified except for the bug fixes below.
- `js/visuals/workshop/index.js` — generated registry: `WORKSHOP_LAYERS`
  (206 × `{ label, makeParams, draw }`), `WORKSHOP_NAMES`, `defaults(kind)`,
  `paramRange(kind, name)`. Regenerate with `tools/gen-workshop-registry.py`.
- Verified in the browser: all 206 load, `makeParams()` succeeds for all 206, and
  `draw()` runs clean at four different `t` values with the `extra` object
  `channel.js` supplies. Only `webcam` and `media` render nothing, correctly — they
  need a camera or a media element.

### 12 bugs fixed that are broken upstream too

These threw `ReferenceError` on the FIRST frame, and `channel.js` has no try/catch
around `draw`, so they are dead in the workshop as well. Three causes:

- **`st` used where only `this` exists** — the `dt` block was pasted into a class
  method that has no local `st` (mycelium · rhizome · fpvDrone · cliftScene ·
  constellation, and boids, whose `update()` had no `t` either — it takes one now).
- **`dt` never computed** — used but never declared (circuitScanner · bzReaction ·
  waveform · hypnoscope). `bzReaction.frame()` has no `t` parameter at all, so its
  `dt` comes from the wall clock.
- **Temporal dead zone** — `dt`/`st` used above their own `const`/`let`
  (terminalPrompt · boidsTrails).

Worth sending back to the stars repo.

## Stage 2 — rendering (next)

The renderer window already stacks `#visgl` (WebGL2, below) and `#vis` (2D, above),
and the 2D canvas is either opaque (glyph/CPU mode) or fully cleared (GPU mode). A
workshop layer draws into an offscreen canvas and is composited onto that 2D
overlay with its blend and opacity — which needs a **third overlay state**:
transparent, but with canvas layers on it. No shader changes, so all 206 work on
the GPU path from day one.

Then: `vlang` routes a workshop name to a local layer instead of `workshopSend`;
`SCENE_PARAMS`-style autocomplete data generated from `makeParams()`; the SCREEN
panel and the panel backdrops pick it up for free, since both already read the
renderer's surface.

## Stage 3 — the rest of the workshop

`fx/registry.js` (3164) · `lfos.js` · `macros.js` · `randomize.js` · `drivers.js` ·
`xfader.js` · `sequencer.js` · lut/palette/limiter · `outputs.js` · `warp.js` ·
`meshWarp.js` · `edgeBlend.js` · the 20 `webscenes/*.json` presets.
