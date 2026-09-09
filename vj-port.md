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
- *(nothing — `outputs.js` and `meshWarp.js` were ported too, see below.)*

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

## Projection mapping — done

`render/mapping.js`, from the workshop's `warp.js` + `edgeBlend.js`. Press **[m]** in
the pop-out visuals window: four corner handles, four edge-blend sliders, **[r]** to
reset.

**The warp is a CSS `matrix3d`, not a shader** — the workshop's idea, and the right
one. Solve the homography from the unit square onto four dragged corners, hand it to
the compositor: no render-pass change, no cost, and it works on any element. That last
part is what makes it fit here, because crashDot's output is TWO stacked canvases
(`#visgl` for the GPU path, `#vis` for glyph modes and the idle screen). They get the
identical matrix, and so does the blend overlay, or the overlay slides off the picture.

**Edge blending is a DOM overlay of four black gradients**, not the workshop's canvas
gradients: a WebGL canvas has no 2D context to draw into, and a CSS gradient is
resolution-independent and composited on the GPU. It is warped with everything else so
the blend edges follow the projected quad rather than the screen.

Corners clamp to [-0.5, 1.5] — a projector often throws beyond its surface, but not far
enough to invert the quad and lose the picture.

**Machine-local, never shared.** localStorage, never the vstate, never collab. Corners
and blends describe where a projector sits in a room, not what the piece looks like, so
joining a jam cannot yank a calibrated projector. Same line the workshop draws, for the
same reason. It announces itself once on load if a saved warp is active, because a
crooked picture with no visible handles is a bug report waiting to happen.

### Found on the way

**The visuals HUD is rewritten every frame**, so the static `[f]ull [c]lear` hint in
`visuals.html` had been invisible for as long as it had existed — the keys worked, the
reminder never showed. The hints are in the live HUD now. And a message written from
outside the loop needs to HOLD it: mapping owns the HUD while it is open, and releases
it rather than writing "off" (which would sit there until a next frame that a hidden
tab or throttled rAF may never deliver).

### Harness trap: `#btn-run` is disabled until audio boots

A test that sets the editor's text and clicks RUN evaluates **nothing** in a headless
run — the button carries `disabled` in the markup and is only enabled at boot (line
~1758), and a click on a disabled button is silently dropped. So an assertion of the
form "no eval errors after running the line" passes because nothing ran, not because
it ran cleanly. Several checks in this port read that way before it was noticed.

Two ways out, both used here:

- Set `btn-run.disabled = false` first. `runSelected()` does not itself require audio —
  visual code, `output()`, `wres()` and the pattern engine all work with the clock at
  zero — so this exercises the real editor path without booting scsynth.
- Better where possible: drive the module directly in the page's own realm
  (`vlang` + `createSurface`) and assert on RENDERED PIXELS. That is what actually
  verified the render pipeline; the button path only ever verified the wiring.

Note that importing `vlang.js` from a test page gets a DIFFERENT module instance than
the one inside an app iframe — asserting on the test page's `snapshot()` says nothing
about the app's. Either drive the whole thing in one realm, or assert on the DOM.

## The output manager

`render/outputs.js` + `render/meshwarp.js` + `ui/desktop/outputspanel.js`. The reason
it was worth porting whole rather than reducing to "warp the visuals window":

> **One output = one projector. N surfaces in it = N independently warped patches.**

That is how you map onto a physical 3D object without 3D rendering — pin a flat quad
onto each visible face of a box or a truss corner and the object reads as mapped.
MadMapper and Resolume do the same. A single warped window can only ever fit one plane,
which is what my first pass (`mapping.js`) could do.

**crashDot has more sources than the workshop did.** A surface can show the master mix
or, now that `wsdeck` exposes each live layer's own canvas, ONE layer — including the
code layers. So one face of the box carries the visuals and another carries the code
that is making them. That is the "coding tabs as textures" idea, and it costs nothing
extra: the layers already render the editor feed, and a layer canvas is already a
canvas.

**Rendering is a 2D canvas per surface, not a CSS transform.** A mesh warp is a grid of
texture-mapped triangles and CSS can only express a 4-point projective map, so the
canvas path is what buys `edge` and `mesh` mode. It also forces the read to happen
INSIDE the frame callback — the GL canvas is `preserveDrawingBuffer:false`, so reading
it later is black — which is why `surface.js` grew `eachFrame()`: outputs subscribe
there rather than to one surface, because which surface is live depends on the UI mode.

Default warp mode is **4pt**, not the workshop's `mesh`. Fitting a flat quad is the
first thing anyone does and four handles is the whole gesture; a 5×5 mesh is 25 handles
to say "the projector is off-square". `[m]` steps up when the wall is curved.

Outputs are **not reopened automatically** on a refresh — a page reload that spawns
projector windows unasked is worse than one that forgets them. The mapping is kept and
REOPEN reattaches it.

### Two ordering bugs worth remembering

`initDesktop` builds its panels synchronously, so anything a panel needs must be handed
over BEFORE it — the outputs manager was set up after, and the panel built empty. And
`#btn-run` is `disabled` until audio boots, so the app-level test that "ran" `output(2)`
was clicking a dead button; see the harness trap above.

## Two corrections after using it

**A video line no longer opens a window.** `_open()` used to call
`ensureVisualsOpen()`, which was right when the pop-out was the only place visuals
could go. With a SCREEN panel on the desktop and an explicit output manager, spawning
a browser window on every evaluation is a set fighting you — where the picture goes is
a decision made once, not a side effect of running a line. `setOpenHook` is a
hint-once no-op now, and index.html says in the log where the picture actually went
(SCREEN panel, or `output()`), once per session rather than per eval.

**A code buffer is an output source.** `render/codecanvas.js` draws a buffer's text
onto a canvas — syntax-coloured, sized to fit the surface's own aspect, redrawn only
when the text or the size changes. `getBuffers()` feeds it every buffer including the
detached ones, so the source list is `master · ws:<layer> · buf:<name>`.

Deliberately NOT the `codeFull` layer, and both are worth having: `codeFull` is a
performance — it accumulates evals, flashes, scrolls, and shows the code that RAN. A
`buf:` source is the buffer as it is right now, the thing you are typing into, which is
what belongs on a second surface while you work.

Colouring is five regexes (comment · string · number · the `>>` arrow · a call) rather
than CodeMirror's tokenizer, because this runs against a plain string on a canvas and
those five are what carry the meaning of a FoxDot line. Plain runs coalesce so a line
is a handful of `fillText` calls rather than one per character.

## Cleanup after the absorption

Three things the port left behind, found by re-reading rather than by a bug report.

**Offline was broken for visuals.** `sw-manifest.js` is generated by globbing `js/`,
and it had not been regenerated since the port — 130 entries, none of them the 220 new
files. The service worker would precache the shell and then 404 on every workshop
layer offline, which matters because running crashDot offline at a teaching workshop
is a documented use case (`workshop.md`). Regenerated: **386 entries, 4.65 MB**, of
which the workshop is 1.59 MB. Note this does NOT undo the lazy-load work — the
service worker STORES the files, the browser still never parses one until it is
imported.

**30 messages a second describing a picture crashDot already draws.** `_tick` was
mirroring every resolved workshop-layer param to an external workshop via
`workshop_state`, from back when `video1 >> mandelbulb()` was forwarded there rather
than rendered here. Removed, along with `wsSnapshot()`, which had no callers left. The
`w*()` commands still reach an external workshop — those are things you asked for;
this was not.

**Two warp keys.** `[m]` opened the handles on the visuals window while `[w]` opened
them in an output window, and inside an output `[m]` already meant something else
(cycle the warp MODE). One verb, one meaning: `[w]` shows the handles in both places
now, and `[m]` is only ever the mode.

The two warp systems themselves are NOT redundant and both stay. `mapping.js` warps
the visuals window with a CSS `matrix3d`, which is exactly right for a window whose
content is a WebGL canvas — nothing is copied. `outputs.js` draws through a mesh into
a 2D canvas per surface, which is what buys `edge` and `mesh` mode and per-surface
sources. Different tools for "warp the window I already have" and "build a projector
rig".

## vrec() — recording the picture

`render/vrec.js`, from the workshop's `export.js`. crashDot could already record the
audio, the code and the MIDI, and not what it looked like. `vrec()` arms, `vrec()`
again saves a `.webm`, `vrec("name")` names it — the same shape as `midi_rec()`,
because it is the same gesture.

Two things had to be measured rather than assumed, and both were wrong on the first
attempt:

**`captureStream` on a WebGL canvas produces no frames.** A 2D canvas drawn in a loop
yields a real WebM; the identical loop on a WebGL2 canvas yields **110 bytes** — a
header, no frames — with `preserveDrawingBuffer` both true *and* false. So this keeps a
plain 2D mirror and copies each frame in with `drawImage`, which is the same copy the
panel backdrops already make, from inside the render callback where the GL canvas is
actually readable.

**The mirror has to be IN THE DOCUMENT.** A detached canvas is barely sampled: 4.4 KB
attached versus 0.7 KB detached, same drawing, same loop. The browser only captures a
canvas that is part of a rendered document. Off-screen (`left:-10000px`) is fine —
*invisible* is not the same thing as *detached*, and that distinction cost two rounds
of debugging.

It costs one blit per frame while recording and nothing when not.

### How the isolation went, as a method note

The first failure looked like a harness limitation, and saying so would have been
wrong. What settled it was a CONTROL: a plain 2D canvas drawn in the same loop under
the same flags. It produced 10 KB, which turned "the environment cannot do this" into
"my canvas is different from that one" — and then the difference was findable by
bisecting the differences one at a time (WebGL vs 2D, attached vs detached, GPU flags
on vs off). Four small pages, and each answered exactly one question.

## vrand() — a random look, as code

`js/visuals/vrand.js`, in the spirit of the workshop's `randomize.js`. It pastes lines
like `chaos()` does rather than mutating live state, because in crashDot the piece is
the text: a generator that changes hidden state gives you a picture you cannot keep,
edit or share.

Two changes from the original, both following from "the output is code":

- **Seeded.** `vrand(3, 1234)` is the same look everywhere, so it can be sent in a
  message. An unseeded call writes the seed it used into the comment — a happy
  accident stays reproducible.
- **Ranges, not 0–1.** Values come from each param's own declared range, which meant
  teaching `tools/gen-workshop-catalog.mjs` to emit `[base, min, max]` triples:
  **1,987 ranges across the 206 layers**, catalog 40 KB → 84 KB.

### Three bugs the tests found

Generating 1,800 lines and running every one through the transpiler and the live
vocabulary caught what reading would not have:

1. **`metaballs(count=1.84)`** — a count emitted as a fraction. Fixed by rounding any
   param the layer declares as a whole number, where "declares" means its base *and*
   bounds are all integers. A magnitude threshold (`base >= 2`) was the first attempt
   and missed `scrollingtext`, which declares `rows` as base 1 over [1,4] — every bit
   as much a count as a 20.
2. **A default of 0 carries no scale** — in `mosaic`, `rows: 0` even means "same as
   cells". Randomising around it produced `rows=0.248`. Those params are left alone.
3. **The range check itself was wrong** for the sixteen names that exist as both a
   field scene and a workshop layer: it compared a field-scene line against the
   workshop's ranges. A shared name resolves to the field scene, so its ranges are the
   ones that do not apply.

## The LAYERS panel

`js/ui/desktop/layerspanel.js`. The workshop's `channelPanel.js` in JOB, not in code —
that one is built on its channel/driver architecture, which crashDot deliberately does
not have. Porting it literally would have meant taking `channel.js`, `drivers.js` and
`lfos.js` with it.

The gap it fills is real: 239 scenes with up to twenty params each, and the only way to
move one was to type a number and re-run. That is right for composing and wrong for
*finding*.

Every live layer gets a box: its params as rotary knobs from `js/ui/knob.js` (built for
the piano), ranges from the generated catalog, a deck toggle, and **→ CODE** which runs
`vsnap(false, name)` for that one layer. Perform with the knobs, keep it as text.

**A param under a pattern or TimeVar gets no knob**, and says `pattern` instead. A knob
cannot represent `sinvar([0,1],8)`; giving it one would throw the movement away on
first touch. Saying so is the honest interface.

### Two bugs the tests found

- **The knob list missed params you had actually set.** It was built from the scene's
  declared params plus a fixed universal list, so `hue` on a field scene — declared
  nowhere, universal in the compositor — never appeared, and the panel quietly
  disagreed with your own line about what the layer had. It now unions the declared
  params, the universal knobs and `Object.keys(params)`.
- **A rebuild under a dragging finger.** The panel refreshes twice a second; rebuilding
  the DOM each time would replace the knob you are holding. It rebuilds only when the
  SET of layers changes (a signature of names, scenes, decks and param KEYS — not
  values) and otherwise calls `setValue` on the existing knobs.

`vsnap(all, only)` gained the second argument for → CODE, and a single-layer snap
deliberately omits the crossfader and the palette: those are the set, not the layer.

## Fixed: a code buffer on an output showed black

Reported, and a design flaw rather than a slip.

Outputs were driven from `eachFrame` — the renderer's frame callback. That was right
for the `master` source, which can only be read there (the GL canvas is
`preserveDrawingBuffer:false`). It was wrong for everything else, because
`surface.frame()` **returns early when there are no visual layers**, before notifying
subscribers. So an output showing a code buffer only updated while a visual scene
happened to be running — and projecting your code is exactly the case where one is not.
Worse, if no surface was running at all, outputs never rendered.

**Outputs run their own rAF loop now**, alive exactly as long as an output is open.
Layer canvases and code-buffer canvases are plain 2D and readable at any time, so the
loop reads them directly. Only `master` still comes from the renderer: `feed(canvas)`
copies it, inside the callback, into a mirror the loop reads — the same trick `vrec.js`
uses, and in the document for the same reason.

The general shape of the mistake is worth keeping: **a consumer was bolted onto a
producer's schedule, and inherited that producer's reasons for stopping.** The
renderer stops when there is nothing to draw, which is correct for the renderer and
meaningless for an output whose source is somewhere else entirely.

## SCREEN is a destination too

The asymmetry was worth fixing: every output surface could show a single layer or a
code buffer, while SCREEN — the picture you actually look at while working — was
hard-wired to the master mix.

It is the first row of the OUTPUTS panel now, with the same source picker and
deliberately fewer controls: no warp (meaningless inside a pan/zoom workspace) and no
edge blend (nothing to blend against).

Mechanically an **overlay** over the GL canvas rather than a change to the renderer, so
the default path is untouched and free: for `master` the overlay is `display:none` and
the renderer draws straight through. Anything else is drawn into it FITTED, not
stretched — a code buffer rarely matches the panel's aspect and squashed text is worse
than a letterbox. The outputs loop keeps running while SCREEN is on a non-master
source even with no output window open, which is what `needsLoop()` accounts for.

## The FX chain on the layer row

The workshop's `fxStackPanel.js` in job: chips in chain order, a knob on each amount, ×
to remove, `+ fx` to add. A new effect lands at the END, which is where typing `+ vhs(0.6)`
would have put it — object key order is chain order.

The picker is grouped **whole frame (GPU)** / **this layer only**, because that is the
real distinction and it changes what the effect does.

### Two silent bugs, both about "which implementation runs"

`fxBundle` already decides this: a workshop-implemented effect on a `ws` layer is
handled per-layer and skipped in the global pass. The panel has to answer the *same*
question or it hands the wrong default to the wrong implementation — and both failures
are invisible rather than loud.

1. **Adding an effect used whatever default came to hand.** `invert` on a field scene
   got the workshop's `0.5`, but crashDot's whole-frame invert is a FLAG tested with
   `>= 1`. The panel would add an effect that then never happened.
2. **The "does the workshop implement this" test used the wrong set** — the 40 names
   crashDot *lacks*, not the 52 the workshop *has*. They differ by the twelve shared
   names, and the shared ones are precisely the ones that route to the workshop on a
   workshop layer. So `invert` there took crashDot's `true`, which a canvas effect
   cannot read.

Both now ask the renderer's question in the renderer's words. Verified: `invert` arrives
as `true` on a video synth and as a number on a workshop layer, and `posterize` picks up
the workshop's levels range on the layer where the workshop is the one drawing it.

## Per-layer opacity & blend

The workshop gives every channel its own **opacity** and **blend mode**; crashDot had
neither. Several layers on one deck could only stack by field-MAX, and the only blend
in the app was the crossfader's — which combines the two finished DECKS, a different
question.

`opacity` (0–1) and `blend` (`max · add · multiply · screen · difference · over`) are
ordinary params, so patterns and TimeVars drive them like anything else.

**`max` is the default** because it is precisely what stacking did before this existed.
An old set has to look identical, and it does.

Three implementations that must agree:

- `blendVal()` in the GL scene shader (`uL5` carries opacity + op)
- the same function in `compositor.js`, or the glyph modes would show a different
  picture from the GPU path
- the Canvas2D composite operation for workshop layers. `max` maps to `lighten` —
  Canvas2D has no exact equivalent, and per-channel max is the honest match.

**The first layer onto a cleared deck always draws plainly**, whatever its blend says:
`multiply` against transparent black is black and `difference` against it is a
negative. A blend mode is a relationship, and the first layer has nothing to be in a
relationship with yet.

## And: what the SCREEN panel shows

It was already the first row of OUTPUTS, but "what am I looking at" is asked while
looking at the picture, not at the projector desk. The SCREEN panel now has its own
picker, top-right, fading in on hover — a permanent widget over the picture is a
permanent distraction, and this is set rarely. Both drive the same manager, so they
cannot disagree.

## Merging the two multiplayer systems

Both projects have one. crashDot's is `js/collab/` (Yjs + y-websocket); the workshop's
is `src/net/room.js` + `roomPanel.js` + `roomLocks.js` + `collab.js`.

**The survey reframed the job, so record what it found.** crashDot already had:

- rooms, peers, colours, awareness;
- **chat**, and persistent — `ydoc.getArray('chat')`, so it replays for a late joiner
  rather than being a stream you had to be present for;
- **assignment**, and richer than the workshop's: `CAPS × ROLES` in `permissions.js`,
  editable live, gated on **receive** as well as send. The workshop's axis is a flat
  `MODULES` list (`transport · master · mapping · sequencer · presets · lfos · macros ·
  palette · scenes · xfader · channel:N`), which is a subset of the same idea;
- **shared visuals**, for free — a video line is text in the shared buffer, so every
  peer evaluates and renders it. There is no visual state to replicate;
- **a shared animation phase** — room time on the beat (see above).

The workshop's own `room.js` header names the three things that must agree for two
machines to draw the same frame: the state, the clock, and **the audio**. The first two
were already done here. The third was the real gap.

### The gap: every machine analysed its own output

`bridge.js`'s `getVisualAudio()` read the **local** analyser. A laptop driving a
projector with no audio booted saw a flat spectrum, so every audio-reactive layer —
`cymatics`, `freqtower`, `chladniplate`, most of the reactive catalogue — froze.
Identical code, identical clock, dead picture. This is the actual blocker for "some
doing visuals, some doing music".

Now: whoever is making sound publishes `{bass, mid, treble, level, spectrum[32]}`, and
a peer whose own analyser is silent consumes the room's.

- **On awareness, not the document.** Awareness is ephemeral and untracked by the CRDT,
  which is right for a signal worthless a frame later. Fifteen spectra a second in the
  doc's history would grow it forever to describe a sound nobody can hear any more.
- **Quantised to bytes.** It comes from a byte analyser; JSON floats would triple the
  payload for precision the eye cannot use.
- **Loudest wins, not the beat master.** The machine keeping time is not necessarily
  the one making the noise.
- Peers stale by >1.5 s are ignored.

### Stations — one switch, one mechanism

`both · music · visuals`, on the user record (so it persists and rides awareness).
Its only mechanical effect is the **master gain**, and that is the design rather than a
shortcut: the analyser taps the master output, so a silent station also has **silent
ears**, which is exactly the condition that makes `getVisualAudio()` fall back to the
room. *Muting the machine is what makes it listen.*

Re-applied after `bootAudio()` so it survives a boot. It is a convenience, not a lock —
`Master().gain = 1` unmutes a visuals station, and should.

The peer list shows `◈` for a visuals station and `♪` for **actually making sound**,
read from the published analysis rather than the declared station: what you can hear
beats what anyone claims.

**Watch the redraw rate.** Awareness now updates ~15×/s per sounding peer, and
`onPeers` rebuilt the peer list *and* the rules panel on every change. `_onPeersChange`
dedupes on a signature of what the UI actually draws (identity + the two badges), so an
arriving spectrum redraws nothing.

### Layer edits reach the room, behind a `visuals` capability

The LAYERS panel was purely local — you could dial in a look on a shared set and nobody
saw it. Params, per-layer FX and the deck button now ride the **sticky-state map**
(`vl:<layer>:<param>`, `vfx:<layer>:<key>`, `vch:<layer>`), which gives live propagation
and the join snapshot from one mechanism, throttled because a knob drag is ~60/s.

A **separate capability from `code`**, because turning a knob and rewriting the room's
set are different amounts of trust: a VJ who may not retype the music should still be
able to open the strobe. Host and player hold it; listener does not. Both the rules
panel and the log table build from `CAPS`, so the column appeared on its own.

**The ordering trap.** The join replay arrives *before* the code that creates the
layers — joining hands you the text but does not run it. Dropping those edits would
mean the room agreed on the code and disagreed about the performance. `vlang.js` holds
them in `pending` and `_drainPending()` empties it the moment the layer appears, once.

### Testing two peers headlessly

`node --check` does **not** catch everything — it passed a `docs.js` with `\\'` inside a
single-quoted string, the same class of miss as the earlier `live` shadowing. Load the
page and read the console.

The harness that worked (in the scratchpad, not the repo): one headless Chromium with
`--remote-debugging-port`, driven over CDP by a ~30-line client on Node's global
`WebSocket`. `Target.createTarget` per peer, `Runtime.evaluate` with
`returnByValue: true`, and — importantly — subscribe to `Runtime.consoleAPICalled` and
`Runtime.exceptionThrown` rather than asking the page for a homemade error array: a page
that fails to boot never installs one, and the empty result reads as a pass.

**Two same-origin pages share `localStorage`.** `collab.js` reads the identity from it
*after* an `await`, so two peers opened at once race for `wfd-user` and both come up as
the same person — with the same `user.id`, so `isSelf` is true for both and the peer
list looks broken. Open them **one at a time**, each fully ready before the next.

Both suites pass: 15 assertions across three live peers against a real
`collab-server.js` (shared analysis, stale/clear handling, stations on awareness,
`sounding` from the analysis, layer state live *and* replayed to a late joiner, chat),
and 7 on `vlang`'s pending-edit drain.

## Navigating without losing the layout

`?ui=desktop` → **go live** → classic layout. Reported, reproduced, fixed.

Every in-app navigation was `location.pathname + '?session=' + slug`, which drops the
whole rest of the query string. `desktopModeOn()` reads `?ui=` first and localStorage
second, so anyone in the desktop UI via the URL (not the persisted toggle) fell back to
classic on go live, on a galaxy join, and on the blocked-clipboard `replaceState`.

The query string carries **two kinds of thing**:

- `session` — which ROOM. Belongs to the jam; it is what a shared link is about.
- `ui`, `diag` — how THIS machine runs the app. Belongs to you, and nobody you send a
  link to wants them.

`js/net/appurl.js` splits them: `navUrl(slug)` keeps your setup and replaces the room
(clearing all three session spellings — `session`, `s`, and the bare `?=NAME` the boot
path accepts — so the old room cannot win on the next read); `roomLink(slug)` is the
absolute, clean link for the clipboard. The blocked-clipboard fallback now **logs** the
session link rather than pushing it into the address bar, since that URL is deliberately
stripped and parking it there changes how the machine boots next time.

### The toggle that did nothing

`?ui=` outranks the stored mode. So with `ui=desktop` in the bar, the desktop/classic
button wrote `classic` to storage, reloaded, read `?ui=desktop` again and stayed. It
now navigates to `navUrl(session)` with `ui=` stripped: pressing a toggle means the
toggle decides.

It is also a real button on the canvas now (learn bar), not only a right-click menu row
— the one control that gets you out of an experimental layout should be visible from
inside it. It names its destination, not its state (`desktop` in classic, `classic` on
the canvas), and carries no `.active`, which would have read as "classic is on".
