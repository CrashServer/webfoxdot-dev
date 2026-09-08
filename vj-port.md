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

## Stage 2 — rendering — done

`video1 >> doomcorridor()` renders in crashDot. 190 new scene names (206 workshop
layers minus 16 that collide with a field scene, where the field scene wins because
it is the GPU-native one).

**Where they join the picture.** A workshop layer draws on the CPU into its own
canvas; `render/wsdeck.js` composites the live ones into ONE canvas per deck; the GL
renderer takes those two as textures (`uWsA`/`uWsB`) and folds them in at deck
level — after the field layers are coloured by the palette, before the A↔B
crossfade. So the crossfader, the trails/feedback pass and every post-fx apply to a
workshop layer exactly as to a field scene, with no shader work per layer and one
canvas out (which is what the SCREEN panel and the backdrop `onFrame` copies need).

`av`/`bv` are raised by the workshop pixels too, not just the colours: the crossfade
blends in VALUE space as well as colour, so a deck that is entirely workshop would
otherwise read as empty and `wipe`/`dissolve` would misbehave.

**Two things about workshop layers drove wsdeck.js.** Their state is keyed by
CONTEXT (`_state.get(ctx)` on a module WeakMap), so every live layer needs its own
canvas kept for as long as it is on screen — share one and their states collide,
recreate it per frame and every particle system restarts 60×/second. And they size
themselves from `w`/`h`, rebuilding grids and populations on a change, so the deck
resizes only when the render size actually changes.

crashDot's universal knobs are applied on the way into the deck, so no layer has to
know about them: `zoom`/`rot`/`panx`/`pany` as a canvas transform, `bright`×`gain`
as alpha. (`contrast` and `inv` are field-space operations and are not yet mapped.)

**Upload cost**: `texImage2D` straight from the canvas — the one overload the browser
hands to the driver without a readback.

`UNPACK_FLIP_Y_WEBGL` is explicitly false: GL's texture origin is bottom-left, the
canvas's is top-left, and the scene shader's `uv` is already v-down, so flipping
would put every workshop layer upside down.

**Discoverability.** `WS_SCENE_PARAMS` was a hand-kept table of 11 entries covering
49 forwarded names; it is derived from `makeParams()` now, so all 206 layers have
their real params with real defaults and it cannot go stale. Ctrl+Space on a `videoN`
player offers two groups — "video synths" (fields; `hue`/`pal` steer them) and
"workshop layers" (imperative; they bring their own colour, so `pal` does nothing).

**A collision bug caught by the tests**: `sceneParams()` first tested
`SCENE_PARAMS[name]`, so `plasma` — a field scene that declares no specific params —
fell through and inherited the *workshop* plasma's six knobs. It tests scene
MEMBERSHIP now, matching how `visualBuilders()` resolves the same collision.

**What still routes over the bridge**: the `w*()` command builders (`wpreset`,
`wblend`, `wfx`, `wseq`, …). Those drive an EXTERNAL workshop for anyone running
one. A scene name no longer does.

## Stage 3 — done, and what was deliberately left

### Ported

**52 per-layer FX** (`fx/registry.js`, vendored whole — it imports nothing). They are
canvas operations, so they run on the LAYER's canvas before it reaches the deck. That
is the thing crashDot's own FX cannot do: those are uniforms in the present shader,
applied once to the finished frame. ~35 are effects crashDot did not have at all —
vhs · datamosh · oilPaint · neonGlow · ledWall · badSignal · halftone · duotone ·
thermal · crystalize · displace3d · warholGrid · lensFlare · frameDiff …

The chain ping-pongs two scratch canvases, and the stack ENTRIES are held per layer
rather than rebuilt each frame — feedback, datamosh, frameDiff and motionBlur keep a
buffer on their entry between frames.

*Trap*: a workshop-implemented FX on a workshop layer would otherwise run twice, once
per-layer and once in the global pass — and for `invert`, twice is not at all.
`fxBundle` skips a key on a `ws` layer when the workshop implements it. The five
crashDot has that the workshop does not (trails · scan · fold · hueshift · pixelsort)
still fall through globally.

**Master grade + limiter** (`lut.js`, `limiter.js`) as present-pass uniforms:
`sat()` `exposure()` `contrast()` `ceiling()`. The originals do a `ctx.filter` blit
and a `getImageData` loop over the finished frame; as uniforms they are three
multiplies at the end of a pass that already runs, so there is no readback — which is
the whole reason a master stage was not worth having before.

These are **neutral at 1**, unlike every other fx key, which forced two rules: a grade
takes the value FURTHEST FROM NEUTRAL (sat(0) beats sat(1.2) — greyscale is a stronger
intent than a lift, and `max` would pick the lift), and two ceilings resolve to the
LOWER one, because a ceiling is a promise not to exceed.

### Multiplayer

**The visual program already syncs**, and always did: `video1 >> doomcorridor()` is
text in the shared buffer, every peer evaluates it, every peer renders it locally.
There is no visual state to replicate because there is no visual state — which is why
this is the right architecture for a jam and why `vsnap()` matters more than a preset
system would.

**What did NOT sync, and now does: PHASE.** Workshop layers animate from `t`, and a
machine-local `t` means two peers running the same line see the same scene at
different phases — a strobe flashing on different frames, a sweep halfway round when
yours is starting. The workshop hit this first and named it: its `fxStack` passes
"room time, so every machine in a classroom flashes on the same frame instead of each
running off its own wall clock". crashDot already has the shared clock, so workshop
layers now run on **beats converted to seconds at a 120bpm reference** — monotonic
because the beat is, identical on every peer because the beat is, and
tempo-proportional, which for music-driven visuals is what you want anyway. Field
scenes keep wall time: they are pure functions of (u,v,t) in one shader and changing
their phase would alter every existing set's look.

**What still does not sync, honestly**: layers that call `Math.random()` differ in
their fine detail per peer — particle positions, glitch placement. This is the SAME
contract crashDot's audio already has (a `PRand` re-rolls independently on each
machine), so it is consistent rather than a new wart. The program is shared; the dice
are not.

**Rule for anything added later**: a visual control that is set by HAND rather than by
code must go through `shareState` like the mixer and the gate do — share the RESULTING
state, never the verb. Nothing added so far is in that category, because everything is
code.

### `vsnap()` — presets, the crashDot way

There are no workshop preset FILES to port: its presets live in localStorage, and
`webscenes/*.json` turned out to be an IMPORT format from a different tool
(`webSceneImport.js`), not the workshop's own.

Which is just as well, because a localStorage blob is the wrong shape here. `vsnap()`
prints the lines you would have typed to get what is on screen — every live layer with
its params at their current values, its FX chain, the crossfader, the palette. A look
becomes something you read, edit and paste into a set, and it survives a jam, which a
preset in your localStorage does not. `vsnap(true)` writes every knob, which is how
you discover what a layer even has.

### Deliberately NOT ported

- **`lfos.js` + `drivers.js`** (modulation matrix). crashDot already modulates every
  visual param with the full pattern/TimeVar vocabulary — `hue=sinvar([0,1],8)`,
  `cells=PRand(4,12)` — on the audio clock, resolved by the same engine the audio
  players use. That is strictly more expressive than four LFOs, and it is CODE, so it
  syncs in a jam while an LFO panel would not. Adding a second modulation system would
  be redundant and a multiplayer liability.
- **`sequencer.js`, `xfader.js`**. `#@` sections and `mix()` already do this, and both
  are code.
- **`outputs.js` · `warp.js` · `meshWarp.js` · `edgeBlend.js`** (1,077 lines).
  Multi-projector output with corner-pin and mesh warping. Genuinely useful and
  genuinely unique, but it is physical-room tooling that needs its own calibration UI
  and a second window — a project of its own rather than a port, and untestable
  headlessly. The workshop's own presets deliberately exclude output mapping for the
  same reason: "tied to the physical room, not a visual look".

## Keeping it off the audio thread

Workshop layers draw on the CPU, on the same thread as the note scheduler. Measured
before assuming anything, and the obvious assumption was wrong.

**Cost is almost independent of resolution.** Per frame, one layer:

| layer | 640×360 | 1280×720 | 1920×1080 | 3840×2160 |
|---|---|---|---|---|
| doomcorridor | 0.4 | 0.5 | 0.5 | 0.5 |
| boids | 0.4 | 0.4 | 0.5 | 0.8 |
| mandelbulb | 0.1 | 0.1 | 0.1 | 0.1 |
| matrixrain | 0.5 | 0.1 | 0.1 | 0.2 |
| **slimemold** | **16.0** | **24.0** | **16.9** | **17.4** |

They do fixed geometry and agent work, not pixel filling. So a resolution cap — the
first thing I reached for — fixes a cost that does not exist. What costs is the LAYER:
`slimemold` runs a per-agent simulation and takes ~17ms at every size, more than a
whole 60fps frame, on the thread the clock runs on.

**The fix is a per-layer frame budget.** Each layer keeps an EMA of its own draw cost
and redraws every Nth frame, N chosen so its average stays under 4ms; its canvas
persists, so skipped frames still composite the last picture. A heavy layer runs at 10
or 20fps inside a 60fps mix instead of dragging the mix down to its own rate. Nearly
every layer (0.1–0.8ms) never throttles at all.

**Phases are staggered**, and that mattered more than the throttle itself: without it,
four layers each drawing every 6th frame all draw on frame 0 — a fine average and a
catastrophic every-sixth-frame. The average was never the thing that makes audio late.

| | before | after |
|---|---|---|
| slimemold alone | ~17 ms every frame | avg 2.4 ms |
| 4 layers incl. slimemold | ~20 ms every frame | avg 6.4 ms, peak 23 ms |
| 4 layers, unstaggered | — | peak 73 ms |

The residual peak is one draw of one expensive layer; that is irreducible without
changing the layer.

**`wres(px)`** still exists but for the honest reason: UPLOAD. Each deck reaches the
GPU via `texImage2D` from its canvas every frame, and 3840×2160 RGBA is 33MB — 2GB/s
for two decks at 60fps, for a picture that is then filtered down anyway. Default 1280
on the longest edge; `wres(0)` opts out, which is what text and data-wall layers want.

### Harness trap

**`--virtual-time-budget` freezes `performance.now()`.** Every timing in the first
benchmark read `0.0`. It has to be dropped for any measurement — and then `--dump-dom`
fires at the load event, so the benchmark must be synchronous and its imports STATIC
(a module script's static imports resolve before load; a dynamic `import()` does not).
Together with the rAF trap in `workshop-port.md`, that is two things this flag silently
breaks.

## Boot weight — the registry loads on demand

Vendoring the layers put **220 files / 1,584 KB** on the boot path of every session,
including one that never opens a visual. The registry has to import all 206 modules to
build `{ label, makeParams, draw }`, and `vdata.js` imports the registry for the
vocabulary, and everything imports `vdata`.

Split in two:

- **`workshop/catalog.js`** — GENERATED (`node tools/gen-workshop-catalog.mjs`), 40 KB
  of pure data: names, labels, and every layer's and effect's parameter defaults,
  extracted by running each `makeParams()` at build time. This is all the visual
  LANGUAGE and autocomplete need, and it cannot drift from the registry because it is
  generated from it.
- **`workshop/index.js`** — the heavy registry, imported only by `wsdeck.js`, which is
  itself `import()`ed the first time a workshop layer is actually used.

`wsres.js` exists for the same reason: `wres()` is part of the language, and the
language must not reach into the deck.

Measured: **1 file / 40 KB at boot**, 207 modules arriving on demand a frame or two
after the first workshop layer. A field-scene set never loads one.

A few layers touch browser globals at module level (a `Path2D` built once), so the
generator installs proxy stubs — enough for the module to evaluate, and anything
genuinely missing still throws with a name rather than silently shipping an empty
parameter table.
