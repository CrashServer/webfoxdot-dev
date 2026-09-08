# Porting the stars/workshop UI & visuals into crashDot

Working notes for the `exp_ui` branch — written so this can be picked up cold after a
crash or a reboot. Updated as we go.

> Not to be confused with `workshop.md`, which is about running crashDot offline at a
> teaching workshop. Different meaning of the word; that file is unrelated.

---

## Where things are

| | |
|---|---|
| crashDot | `/home/svdk/webfoxDot` |
| the workshop VJ tool | `/run/media/svdk/storage/DRIVE/500_Apps/stars/workshop` |
| dev server | `python3 serve.py` → http://127.0.0.1:8765 (also serves the workshop at `/workshop/`) |
| desktop mode | http://127.0.0.1:8765/?ui=desktop · classic: `?ui=classic` |

**Branch state:** `exp_ui`, branched off `dev01` at `31ecbbe`.

```
1c10f1b  mixer, modular, parts, docs, galaxy & rules become desktop panels
167859d  SCREEN panel + per-panel backdrops
294fdec  desktop mode — the whole app on an infinite pan/zoom canvas
31ecbbe  ← dev01 branch point
```

`dev01` is pushed to origin. **`exp_ui` is local only** — not pushed yet.
`relay.py` is untracked and was already there before any of this.

---

## What has been built

### Desktop mode (`js/ui/desktop/`)

An optional second layout behind a **DESKTOP** toolbar button or `?ui=desktop`. The
classic layout is untouched and is still the default. Switching either way is a page
reload, deliberately — the mode is persisted, and moving a dozen live nodes back into
a layout they no longer remember is a lot of code to get subtly wrong.

| file | origin |
|---|---|
| `canvas.js` | copied from workshop `src/ui/canvas.js` (278 lines) |
| `panel.js` | copied from workshop `src/ui/panel.js` (448 lines) |
| `layouts.js` | copied from workshop `src/ui/layoutManager.js` (39 lines) |
| `desktop.js` | new — crashDot's own layout + the adopt/host machinery |
| `screens.js` | new — SCREEN panel and per-panel backdrops |

**Changes made to the copied files** (keep these if the workshop versions are ever
re-imported — each is commented at the top of its file):

- Dropped the 1920×1080 "stage" rect (a live video-output footprint, meaningless
  here). The rect it draws is now the **home** area the default layout occupies.
- `Alt+drag` no longer pans while over a panel — inside CodeMirror that gesture is a
  column selection.
- `isTyping()` knows about CodeMirror, so Space never pans while you type.
- Added `spec.onResize`, because CodeMirror must be told when its box changes.
- `resetView()` = frame the home rect, not "zoom 1 at the origin". The default layout
  is 1920 wide and most windows are not.
- Storage keys renamed to `wfd-*`.

**localStorage keys:** `wfd-ui-mode`, `wfd-desktop-view`, `wfd-desktop-panels`,
`wfd-desktop-layouts`.

### The adopt rule

Panels never rebuild anything. Each is handed an element that already exists and
adopts it, so every `getElementById` in the rest of the app keeps resolving and every
listener stays attached.

- Built at boot: editor (`#editor-tabs` + `#editor-wrap`), log, and each
  `.cp-section` — the three anonymous ones gained ids (`cp-clock`, `cp-players`,
  `cp-compo`) so they are addressed by name, not by document position.
- Built lazily: mixer, modular, parts, room rules, docs, galaxy. These do not exist
  until first opened, so `hostFloating()` watches for the root, adopts it when it
  turns up, and mirrors its own `.hidden` / `[hidden]` state onto the panel. That is
  why every existing toggle still works and **none of those modules were changed**.
- The toolbar is deliberately **not** a panel: STOP is a panic button and must never
  be somewhere you have to pan to find. Its measured height drives `--toolbar-h`.
- Perform mode is deliberately left full-screen — it is a keyboard-free touch surface
  for playing live.

### Visuals (`js/visuals/surface.js`, `js/ui/desktop/screens.js`)

- `surface.js` is the single frame loop + audio smoothing + `fxBundle()`.
  `render/main.js` and `editorbg.js` each had their own copy of `fxBundle` with
  drifted signatures; `editorbg.js` is now a thin wrapper over a surface.
- **SCREEN panel** — a monitor on the canvas. `video1 >> kaleido()` plays in it.
- **`▦` in any panel header** — the same picture behind that panel's content.
- One GL context total. The screen owns it; each backdrop is a 2D canvas copying its
  frames. The copy must happen **inside** the render callback: the renderer asks for
  `preserveDrawingBuffer:false`, so a GL canvas read after compositing is black.

---

## Findings

### 1. crashDot already bridges to the workshop — and it is the default for 9 scenes

`js/visuals/vlang.js` `__rshift__` checks `WS_SET.has(scene)` **first** and returns
before reaching the local renderer, posting a BroadcastChannel message instead.

| | count | |
|---|---|---|
| local `SCENES` | 49 | |
| `WS_SCENES` | 49 | |
| **in both** | **9** | `plasma tunnel starfield grid swarm voronoi noise rings spectrum` — **bridged; crashDot's own renderer never runs** |
| local only | 40 | `wave rain spiral cells nebula moire bars ripple fire aurora kaleido warp metaballs hexgrid checker flow contour helix mandala lattice truchet marble testpattern interference biomech escher circuit panopticon penrose mobius hexdump lissajous ikedaglitch barcode equalizer datamatrix tron butterfly lightning mosaic` |
| workshop only | 40 | `mandelbulb mandelbox volume constellation boids attractor clifford lorenz reaction clift sphere3d splineweave starburst mycelium neoncity mazecity neuralnet crystalgrowth fractaltree phyllotaxis cyclicca gameoflife ifsfractal slimemold rhizome dnahelix hypnoscope wireframe3d freqtower shapes apollonian fpvdrone circuitscanner ikedabarcode ikedacircuit ikedamatrix ikedaoscillo ikedascan stringart codedisplay` |

So `video1 >> plasma()` renders **nothing** in crashDot unless the workshop is open in
another tab. Use `kaleido`, `fire`, `aurora`, `tron`, `mosaic`, `penrose`… to test the
local renderer.

### 2. The workshop's visual generators are 11 GLSL modules, not the JSON

`webscenes/*.json` and the 90 KB `webscenes-import.json` are **parameter presets** (20
saved looks), not renderers. The actual generators are `src/webgl/gl*.js` (~1700
lines): Apollonian, CyberpunkWorld, FreqTower, KaliTunnel, Mandelbox, Mandelbulb,
Noise, Plasma, Tunnel, Volume, Voronoi. Plus `src/fx/registry.js` (3164 lines).

Architectural difference that matters: crashDot folds **all** scenes into ONE static
shader so nothing recompiles while you type. The workshop compiles a program per
scene. That property is worth keeping and is the main cost of porting the GLSL in.

### 3. CodeMirror inside a scaled ancestor — two separate bugs

CodeMirror mixes `getBoundingClientRect()` (scaled by an ancestor transform) with
`offsetWidth` / `scrollLeft` / line heights (unscaled).

- **Gutter — FIXED.** `gutters.style.left = gutterWidth × (1 − zoom)` slid the gutter
  over the first character of every line (48px gutter at 80% ate ~9.2px).
  `unskewGutter()` in `desktop.js` recomputes it in unscaled px after every display
  update and view change.
- **Vertical geometry — NOT FIXED.** See open bug 1 below.

Note: a `charCoords → coordsChar` round-trip **passes** under scale because both sides
carry the same error. It is not a valid test. Use a real rendered character's
`getBoundingClientRect()` as ground truth instead.

---

## Open bugs

### 1. Cursor position wrong when the canvas is zoomed — FIXED

CodeMirror converts a screen-space Y delta — from `getBoundingClientRect()`, which an
ancestor transform scales — into document space using line heights measured with
`offsetHeight`, which it does not. Inside a scaled canvas the two disagreed by
`lineHeight × (1 − zoom)` **per line**, so the caret drifted further the further down
you went (measured: 4.0 px/line at 76% zoom). Unlike the gutter offset there is no
single value to correct — it is the whole vertical measurement layer — so patching it
would mean forking CodeMirror.

Fixed by taking the editor **out of the scale** instead. Its content lives in a
`.wfd-cm-layer` counter-scaled by `1/zoom` — net screen scale exactly 1, whatever the
canvas is doing — sized to `bodyBox × zoom` so it still fills the panel, with the font
size scaled by `zoom` to match. It looks like zoom because it *is* zoom: real layout at
a real font size, so every measurement CodeMirror makes is consistent.
`keepEditorUnscaled()` in `desktop.js`, driven by `onViewChange` and the panel's
`onResize`.

Verified exact click→character on four lines at 47%, 76%, 111% and back, with the
rendered line box tracking zoom (11.6 → 18.7 → 27.5 px) so it still reads as zoom.

**Test trap that cost time twice:** `document.querySelectorAll('.CodeMirror-line')` is
off by one — CodeMirror keeps a hidden line inside `.CodeMirror-measure` for measuring.
Scope to `.CodeMirror-code > div`. This produced a convincing but entirely false
"clicks land one line early" for several runs.

### 2. Galaxy does not load — FIXED

`js/galaxy/galaxy.js` sizes its canvas from `overlay.clientWidth/clientHeight` inside
its own `show()`, which runs **synchronously** — while the panel is still
`display:none`, because the MutationObserver that flips the panel visible only runs
afterwards. So it measured 0×0 and rendered nothing, for ever.

`hostFloating()` now fires a `window` resize event when a panel becomes visible and
when it is resized — once immediately (reading a box there forces the pending layout)
and once on the next frame. These modules already listen for window resize, so nothing
in them had to change. Verified by screenshot: the starfield, clusters and controls
all render inside the panel.

### 3. Galaxy panel will not move — COULD NOT REPRODUCE

The panel drags correctly under test (962,1732 → 1114,1811), and so does a control
panel. The original failure was in the **test harness**: synthetic `PointerEvent`s
have no active pointer, so `head.setPointerCapture()` throws `NotFoundError` and the
drag never wires up. Stub `setPointerCapture`/`releasePointerCapture` in the iframe
before dispatching synthetic drags.

Best guess at what was actually hit: the galaxy has its **own** header bar
(`#galaxy-head`, with the ✕ close button) sitting just below the panel header, and
dragging that does nothing. It is now styled `cursor: default` like the other hosted
heads, so it no longer looks draggable. Needs confirmation from a real mouse.

---

### 4. Zoom disturbed audio timing — FIXED

Reported as "sound timing gets messy when zooming in and out quickly", and it was
real. The note scheduler runs on the **main thread** with a 120 ms lookahead, and every
single wheel tick was doing:

| per wheel tick | before | after |
|---|---|---|
| CodeMirror `refresh()` (full re-measure + re-render) | 1 | 0.02 |
| `localStorage.setItem` — **synchronous** | 1 | 0.02 |
| forced layout reads | 20 | 1.3 |

A trackpad pinch fires 60+ wheel events a second, so that was ~60 full editor
relayouts and 60 synchronous disk writes per second, competing with the scheduler.

Two fixes:

- `canvas.js` `save()` is debounced 250 ms. The view only has to survive a reload.
- The editor relayout is deferred until the gesture **stops** (140 ms). During a
  gesture the layer keeps its last settled geometry and simply rides the canvas
  transform — apparent size stays `base × settledZoom × canvasZoom / settledZoom` =
  `base × canvasZoom`, which is exactly right. Only the internal measurement basis is
  briefly stale, and nobody places a cursor mid-pinch. Verified cursor still exact at
  rest, after a fast pinch in/out, and zoomed well out to 35%.

Also throttled the hosted-panel `remeasure()`, which fires a global window resize and
was being called per pointermove during a panel resize drag.

**General lesson for this branch:** anything wired to `onViewChange` or a panel's
`onResize` runs at pointer/wheel rate on the audio thread. Coalesce it.

## Open decision

**"Replace the crashDot GPU stack with the workshop's"** has two readings and the
wrong choice wastes days:

- **Bridge everything.** Cheapest — widen `WS_SET`, delete local scenes. But crashDot
  stops being self-contained: it is an offline PWA, and every visual would need the
  workshop running in another tab. Existing `#@` example sets that use local scenes go
  dark.
- **Port the GLSL in.** crashDot renders everything itself, offline, one app. Real
  work, and it has to be reconciled with the single-static-shader design.

Leaning: port the 7 heavyweight scenes crashDot has no equivalent of (Mandelbulb,
Mandelbox, Apollonian, KaliTunnel, CyberpunkWorld, FreqTower, Volume) and leave the 40
working local scenes alone.

---

## Detachable buffers

A scratch tab can be pulled off the strip (the ⧉ on the tab) into its own panel with
its own editor, so you can see two buffers at once. ⤴ in the panel header sends it
back. Only offered in desktop mode — `canDetach()` is checked at render time, because
a button that silently does nothing is worse than no button.

The thing that made this cheap: `index.html`'s `const editor` became **`let editor`**,
reassigned on focus. All 152 runtime references in that module read the binding at
call time, so Ctrl+Enter, the nudge keys, the inspector and the rest all act on
whichever editor has focus with no plumbing at all. `EDITOR_OPTS` is split out so a
detached buffer gets an identical instance, keymap included.

Two things had to be fixed first, and they are the trap if this is ever reworked:

- Only two `editor.on(...)` handlers closed over the outer `editor` — the solo
  autosave and the visuals cursor feed. Both now use their own `cm` argument, because
  they belong to one instance rather than to "the focused one". Anything new
  registered on a specific editor must do the same.
- CodeMirror refuses to put one Doc in two editors, so the strip switches away from a
  buffer before handing it over, and the panel swaps in a throwaway Doc before giving
  it back.

Detached panels get the same counter-scale treatment as the main editor, with the same
140 ms settle, so they stay cursor-exact and stay off the audio thread.

## Saving workspaces

`layouts.js` was ported but had no UI, so it was unreachable. There is a **layouts**
chip beside the zoom indicator now: save the current workspace under a name, restore
it, overwrite it, delete it, plus "reset view" and "reset panels".

A layout captures every panel's position, size, collapsed state **and colour**, plus
the **view** (pan + zoom) under a `__view` key. So "writing", "mixing" and
"performing" can be three arrangements of the same panels at three different zooms.
Restoring also writes the arrangement through to `LAYOUT_KEY`, so panels that have not
been built yet — the lazily-hosted mixer, modular, piano and so on — open in the right
place when you eventually open them.

Panel colour is part of a layout entry, so `applyLayout()` had to restore it too;
before, half an arrangement came back and half did not.

### Traps found the hard way (desktop)

- **`#desktop` is `overflow:hidden`, and that does NOT stop the browser scrolling
  it.** Focus landing on anything outside the visible area makes the browser scroll
  the container, which fights the pan transform. A detached editor panel far down the
  canvas dragged the whole workspace back to itself every time it took focus — "the
  view is stuck on that panel". `initCanvas` now pins `scrollLeft/scrollTop` to 0 on
  any scroll event. Anything else placed far off-origin will hit this.
- **A new UI module is not done until its CSS exists.** `layoutbar.js` was written and
  wired and looked fine in a scripted test — which clicked it by selector — while
  being invisible and unpositioned on screen, because no rules had been written for
  it. Tests that reach elements by selector cannot see that. Assert on
  `getBoundingClientRect()` and `elementFromPoint()` when the thing is supposed to be
  visible.

## Next: importing features & content from the workshop

Inventory of what is there, roughly in order of value-to-effort:

| module | lines | what it is |
|---|---|---|
| `src/lfos.js` | 182 | four user-shaped LFOs, own rate/shape/depth |
| `src/macros.js` | — | 8 named 0..1 faders broadcast to bound params |
| `src/drivers.js` | 178 | parameter modulation routing (the mod matrix's engine) |
| `src/randomize.js` | 104 | randomize a param within its range |
| `src/sequencer.js` | 216 | multi-row step sequencer with per-step snapshot recall |
| `src/xfader.js` | 190 | A/B bus crossfader |
| `src/lut.js` / `palette.js` | — | master colour grade · shared 5-stop gradient |
| `src/limiter.js` | — | master hard-clip |
| `src/presets.js` | 311 | pack/apply param sets |
| `src/channelSnapshots.js` | — | per-channel snapshot pack/apply |
| `src/outputs.js` | 536 | pop-out projector windows |
| `src/warp.js` / `meshWarp.js` / `edgeBlend.js` | 133/367/— | corner-pin, mesh warp, edge blend for projection |
| `src/webgl/gl*.js` | ~1700 | the 11 GLSL scene generators |
| `src/fx/registry.js` | 3164 | FX library |
| `webscenes/*.json` + `webscenes-import.json` | 20 presets | **content**, cheap to bring either way |

Already present in crashDot and NOT to be duplicated: MIDI in/out and MIDI learn,
tempo/clock, session/collab rooms, audio analysis, a mixer, a preset/parts system.

---

## Testing recipe

No test runner in this repo — everything is verified by driving the real app in
headless Chromium and asserting in-page. WebGL needs SwiftShader in headless:

```bash
python3 serve.py &                      # 127.0.0.1:8765

# write a test page into the repo root (it must be same-origin to import modules),
# assert into <pre id="out">, then:
chromium --headless --no-sandbox --enable-unsafe-swiftshader \
         --use-gl=angle --use-angle=swiftshader \
         --window-size=1600,1050 --virtual-time-budget=25000 \
         --dump-dom "http://127.0.0.1:8765/__test.html" > out.html
# then extract the <pre> and read the PASS/FAIL lines. Delete the test page after.
```

Gotchas learnt the hard way:

- `--disable-gpu` means **no WebGL2** — the visuals silently do nothing.
- A JS regex character class of emoji needs the `u` flag, or it matches shared
  surrogates and reports false positives.
- Sampling a WebGL canvas with `drawImage` from outside its frame returns black.
- Screenshots at a small `--window-size` do not reflect real layout; render the app in
  an iframe of the target width instead.
