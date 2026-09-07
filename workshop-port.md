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

### 1. Cursor position wrong when the canvas is zoomed — diagnosed, not fixed

Reproduced at 76% zoom: clicking line 2 puts the cursor on line 1, and the painted
caret's vertical error grows **4.0 px per line** = `lineHeight × (1 − zoom)`.
CodeMirror converts a scaled screen-space Y delta into document space using unscaled
line heights. Too deep in its measurement layer to patch from outside the way the
gutter was.

**Planned fix:** stop putting CodeMirror inside a scaled ancestor. Counter-scale the
editor panel's contents by `1/zoom` and scale the **font-size** by `zoom` instead —
visually equivalent to zooming, but every measurement becomes real layout, so the
cursor is exact. Set the wrapper's size to `bodyW × zoom` / `bodyH × zoom` so it still
fills the panel, and `editor.refresh()` on every view change.

**Trade-off to flag before shipping:** with real font scaling this behaves like true
zoom, so it should look the same. If font scaling turns out to be too coarse at small
zoom, the fallback is constant-size text in a shrinking viewport, which looks wrong.

### 2. Galaxy does not load — diagnosed, not fixed

`js/galaxy/galaxy.js:159` sizes its canvas from `overlay.clientWidth/clientHeight`.
Its panel starts `display:none`, so that measures **0×0** and nothing ever renders.
Needs a resize once the panel actually becomes visible — hook it to the panel's
visibility sync in `hostFloating()`.

### 3. Galaxy panel will not move — not yet diagnosed

---

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
