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

`layouts.js` was ported but had no UI, so it was unreachable. There is a **LAYOUTS
panel** now — an ordinary panel like the rest — listing saved workspaces, with save,
restore, overwrite, delete, plus "reset view" and "reset panels". The toolbar's
**LAYOUTS** button (shown only in desktop mode) pans to it and raises it, so it stays
findable after you have panned elsewhere.

A layout captures every panel's position, size, collapsed state **and colour**, plus
the **view** (pan + zoom) under a `__view` key. So "writing", "mixing" and
"performing" can be three arrangements of the same panels at three different zooms.
Restoring also writes the arrangement through to `LAYOUT_KEY`, so panels that have not
been built yet — the lazily-hosted mixer, modular, piano and so on — open in the right
place when you eventually open them.

Panel colour is part of a layout entry, so `applyLayout()` had to restore it too;
before, half an arrangement came back and half did not.

### Where generated code goes

**Rule: code the app writes goes back to the buffer whose code asked for it** — never
to whichever buffer happens to have focus. `runCode()` records `_evalDoc` for the
duration of an evaluation (the arrangement's doc when a `#@` chain is running, the
recorded source doc for a `.reroll()`, the main doc for a remote peer's eval,
otherwise the doc it was run from), and `codeDoc()` reads it. Every writer goes
through that: `insertCode`, `attack`'s `place`/`callLine`, `ascii_gen`, `audiviz` and
their site-finding helpers.

Before this they all used `editor`, which since detachable buffers means *the focused
editor*. A `#@` section or a `.reroll()` loop re-running every few beats therefore
pasted into whatever scratch buffer was open — worse when one was detached, because a
detached editor holds focus. `ascii_gen` was the loudest: its "already drawn?" guard
also read the focused buffer, so it never matched and it redrew its card on **every
pass**.

A scratch buffer should only ever contain what you put there.

The other half is where a PANEL sends code. `codeDoc()`'s fallback is "the editor you
last focused", which with several buffers open — some detached into their own panels —
is not something you can point at, so the piano looked like it picked one at random.
It has a **`to` picker** now, listing every buffer (tab strip + detached), defaulting
to the one you are looking at and remembering your choice while that buffer exists.
`insertCodeInto(doc, text)` is the doc-targeted write; `bufferTargets()` merges
`_tabs.list()` with the desktop's `detachedBuffers()`.

### The live gutter is per-buffer

`_srcLine` mapped a player name to a LINE NUMBER, which means nothing once there is
more than one buffer. `refreshLiveGutter` then scanned whichever buffer had focus, so
an untouched scratch buffer that merely happened to contain a line for a live player
was given the ▶ "this is the version you hear" marker — on a line that had never been
evaluated. It records `{ line, doc }` now, and nothing is marked in a buffer the
player is not sounding from.

**This one is not desktop-only** — buffers shipped in `dev01`, so the bug is there too
and this fix belongs on that branch.

### Traps found the hard way (desktop)

- **Gate the paste, not the gesture.** Text kept arriving in buffers from the system
  clipboard. Chasing the SOURCE was a losing game — drag, X11 primary selection,
  middle-click, each guarded in turn and it kept happening. The fix is at the other
  end: a deliberate paste is always preceded by Ctrl/Cmd+V, Shift+Insert or a context
  menu, so `guardPaste()` records that intent and refuses any `paste` event without
  it. Mechanism-independent, and it covers the classic layout too.
  Note when testing: **CodeMirror calls `preventDefault()` on pastes it handles
  itself**, so `defaultPrevented` says nothing about whether YOUR guard fired —
  assert on the guard's own effect instead.
- **On X11, a selection over chrome becomes a paste waiting to happen.** Selecting
  anything fills the PRIMARY selection, and a middle-click pastes it — and
  middle-drag is the canvas pan gesture. Dragging across the piano's key labels and
  then middle-clicking to pan pasted `D4 E4 F4 G4…` into the editor under the
  pointer. Two guards: `#desktop` is `user-select: none` with only `.CodeMirror`
  opted back in, and middle-button `mousedown`/`auxclick` are prevented — the
  pointerdown's preventDefault is not enough, because the paste rides the
  compatibility mouse events.
- **Bailing out of a pointerdown handler without `preventDefault()` leaves the native
  drag alive.** `beginDrag` returns early when the press lands on a header button —
  and the browser then happily started a text drag of that button's own LABEL.
  Dropped on an editor, CodeMirror inserted it, which is how stray `◉ ⌂ ↩ ⊙ ▦ ▁`
  characters appeared in buffers with no obvious way to reproduce. Panel chrome now
  refuses `dragstart` outright; the panel body still allows it, because dragging a
  selection out of a detached editor is a real gesture.

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

## Piano

`js/ui/piano.js`, portable (no desktop dependency, cherry-picks onto `dev01`). Plays
any synth by mouse or computer keyboard, records against the clock, and writes a
player line in scale degrees.

Under the keyboard is **one drag-knob per parameter the chosen synth actually has**,
built from `SYNTH_DEFS[name].defaults` and rebuilt when the synth changes. They feed
the sounding voice and the generated line: only the ones you MOVED are written out,
so the line stays readable. Double-click a label to reset that parameter.

- `playSynthNote()` used to drop everything except `sus`/`amp`; it spreads opts
  through to `buildParams` now, which already knows which names a given synth takes.
  MIDI note-input gets the same benefit.
- Synth definitions carry defaults but **no ranges** — the engine never needed them.
  `RANGES` in piano.js gives the common names a range chosen by ear (cutoff/lpf/hpf
  exponential 20–20k, rq 0.01–2, attack/release exponential, pan −1..1, …) and
  anything unknown derives one from its own default rather than assuming 0..1.
- Reuses `makeKnob()` from `js/ui/knob.js` — the modular panel's drag control, so the
  feel and the exponential curves are the same everywhere. `makeKnob({ rotary: true })`
  draws a real dial (270° sweep, dead zone at the bottom, value arc + pointer) instead
  of the horizontal bar; only the paint differs, so the two forms cannot drift apart.

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

## Everything is a panel

The last fixed chrome is gone. Panels are **closable** (`×` in the header,
`spec.closable !== false`), which forced three other things to exist:

- **`windows` panel** (`windows.js`) — a chip per panel, lit when open, click to
  toggle. The one panel with `closable: false`, because a `×` with no way back is
  a trap door. Owned panels answer via `panel.isOpen()/setOpen()`; hosted modules
  are asked and toggled through their **own** button (`spec.btn`), never by hiding
  the panel behind their back — do that and the module's flag and the panel
  disagree, and the next press of the toolbar button does nothing. The generic `×`
  on a hosted panel routes to `closeFloating(spec)` for the same reason. State is
  polled at 400 ms rather than pushed, since the `×`, the module's own `✕`, Escape
  and a recalled layout can all change it.
- **`menu` panel** — `#toolbar`, adopted. It was fixed above the canvas on the
  grounds that STOP is a panic button; stop-all is bound **globally** (Ctrl+; ·
  Ctrl+, · Ctrl+.), so the bar had no claim to be the exception. `--toolbar-h` is
  now `0`. Its body is `overflow: visible` — the EXAMPLES dropdown hangs out of the
  bar and `auto` clipped it into a scrollbar.
- **`changelog` panel** — `changelogHTML()` exported from `docs.js`, same builder
  as the docs tab so the two cannot drift, plus the click-to-expand wiring.

`open` is persisted in the same per-panel entry as position and colour, and
`applyLayout` restores it — an arrangement that forgets what was put AWAY is only
half an arrangement.

**The home rectangle now starts at `HOME_Y = -96`**, not at the origin. The menu
panel sits above y=0 where a top bar belongs, and `fitHome()` has to frame it or
the one panel a first-time user most needs is just off the top edge. `fitHome`
solves for the pan that puts `HOME_Y` on the margin rather than assuming the
origin is the corner.

**Wordmark**: `.canvas-wordmark` inside `#wfd-canvas`, so it pans and zooms with
the workspace instead of floating over it as chrome. `pointer-events: none`.

## Traps found the hard way (UI)

**A captured pointer retargets the following click.** `beginDrag` calls
`setPointerCapture` on the panel header, so Chrome dispatches the subsequent
`dblclick` at the **header**, not at the `.panel-title` you actually hit — and the
header's own `dblclick` collapses the panel. That is why double-click-to-rename on
a detached buffer did nothing (it collapsed instead). Synthetic `PointerEvent`s do
NOT reproduce it, because `setPointerCapture` throws on a synthetic pointerId and
the capture never happens — the headless test passed while the feature was broken.
Fix: record the `pointerdown` target (that event is not retargeted; capture starts
*with* it) and route the dblclick on that. Renaming now lives in `panel.js` as
`spec.onRename`, so any panel gets it.

**`confirm()` is the wrong weight.** Replaced with `armButton()` in `panel.js`: the
button itself arms (turns red, reads `×?`), a second click within 3 s commits,
`pointerleave` or the timeout disarms. `skip()` is asked at CLICK time, so an empty
buffer closes in one click and a buffer with text asks twice.

**Panels had no DOM id** — only a registry key. `win.dataset.panelId = spec.id` now,
which is also what makes them addressable from a test.

## The bar, split three ways — and a right-click menu

One 1900px strip of sixteen buttons is a list, not a grouping — BOOT sat next to
RUN, GO LIVE next to EXAMPLES, and you learned positions rather than meanings. It
is three small panels now, grouped by *when* you reach for a thing:

| panel | holds |
|---|---|
| `run` | status dot · boot · load kit · run · stop · reload · perform · synth status |
| `collab` | share · go live · split |
| `learn` | tour · examples · version |

Boot and transport share a bar: they are used at very different RATES — the kit
loads once, stop gets hit all night — but they are adjacent in the only order that
matters, *boot, load the kit, then run*, and splitting them put a panel edge in the
middle of that sentence.

**The rule that decides membership: a bar holds VERBS.** Anything whose button only
showed or hid a panel — mix, parts, piano, modular, galaxy, docs, layouts — is a
noun, and nouns are rows in the **canvas context menu** (`menu.js`). ZEN and
CLASSIC UI went the same way: they act on the view, and the menu is where the view
is managed, which is why the `view` bar exists no more.

`collab`, not `share`: SHARE is a button *inside* it, and a panel called "share"
holding a button called "SHARE" is one word doing two jobs.

### The menu replaced a WINDOWS panel

A panel whose only job is to list panels is itself a panel — one more thing to
place, one more row in its own list, and useless until you can already see it. A
menu costs nothing until asked for and opens where the pointer already is.

Two verbs per row, because they answer different questions: the **row** toggles
("should this exist right now") and **⊕** goes to it ("where is it" — opens it if
closed, then `centerOn`). Toggling leaves the menu open so a workspace can be set
up in one visit; going somewhere closes it. Marks refresh in place rather than
rebuilding, or the rows move out from under the pointer you are about to click.

It skips `.panel-body`: inside a panel's CONTENT the browser's own menu is the
right one (spell check in the editor, copy in the log). The canvas and the panel
chrome are ours.

**Buffers are listed too.** With detachable tabs a buffer is either a tab in the
strip or a panel on the canvas, and "where did my scratch go" should have one
answer wherever it currently lives. The strip half comes from `index.html` via
`_dk.setBuffers({ list, go })` rather than the desktop reaching into the tabs;
`detached` now stores `{ doc, panel }` so a detached buffer can be centred like any
window.

`centerOn()` is new in `canvas.js` beside `panToReveal()` — reveal's "go there only
if you cannot see it" is right for an incidental nudge, but a GO TO you asked for
should put the thing in front of you even if a corner was already showing.

### Notes

Buttons are ADOPTED, not rebuilt — same elements, ids and listeners, so nothing in
`index.html` knows. The ones that left the bar stay inside the now-hidden
`#toolbar`; a programmatic `.click()` still works on an element in a `display:none`
parent, which is exactly how a menu row toggles a hosted module.

`#toolbar` is hidden rather than removed: what is left in it is the app title (the
canvas wordmark covers that) and the mobile drawer toggle, and a stray
`getElementById` on either should keep resolving rather than throw in one UI mode
only. CSS: the uppercase/letter-spacing vocabulary moved from `#toolbar button` to
`#toolbar button, .wfd-bar button` so it follows the buttons out. Bar bodies are
`overflow: visible` — the EXAMPLES dropdown hangs out of its panel and `auto` would
clip it into a scrollbar.

The home rectangle is `-96 … 1220` so the bar row above the editor is inside what
"reset view" frames.

### Panel count: 22 → 11

Two consolidations, chosen over two others that were offered:

**The control column is ONE panel again.** clock · players · composition · session ·
Ableton Link · midi · settings were six panels because every `.cp-section` *could*
be one, not because six was the right number — the first three are read at a glance
and the last two are set once, so they cost six headers, six borders and six rows in
the window list to buy nothing. `wfd-controls` adopts all seven sections, which is
exactly what they were in the classic layout: one scrolling column of foldable
sections. The fold headers still work because `initFoldableSections()` wires them
(line ~2511 of index.html) well before the desktop adopts the elements, and the
handlers travel with the nodes.

The CSS needed one exception. `body.desktop-ui .panel-body > .cp-section > h3 {
display: none }` hides a lone section's heading because the panel title already says
it — correct for a one-section panel, wrong here, and worse than cosmetic: the
heading IS the fold handle, so hiding the first one made clock the single section you
could not collapse. `.wfd-body-wfd-controls > .cp-section > h3 { display: block }`
plus a hairline between sections.

**`transport` + `engine` → `run`.** See above.

Not taken (still available): folding `layouts` into the context menu as a submenu,
and dropping the `changelog` panel back to being only a docs tab.

The freed right-hand column (x 1524) now holds `changelog` and `layouts`, and
`screen` was shortened to 336px so it ends on the home rectangle's floor. Verified:
every default panel sits inside the home rect and is visible at reset.

## Everything is a panel

The last fixed chrome is gone. Panels are **closable** (`×` in the header,
`spec.closable !== false`), which forced three other things to exist:

- **`windows` panel** (`windows.js`) — a chip per panel, lit when open, click to
  toggle. The one panel with `closable: false`, because a `×` with no way back is
  a trap door. Owned panels answer via `panel.isOpen()/setOpen()`; hosted modules
  are asked and toggled through their **own** button (`spec.btn`), never by hiding
  the panel behind their back — do that and the module's flag and the panel
  disagree, and the next press of the toolbar button does nothing. The generic `×`
  on a hosted panel routes to `closeFloating(spec)` for the same reason. State is
  polled at 400 ms rather than pushed, since the `×`, the module's own `✕`, Escape
  and a recalled layout can all change it.
- **`menu` panel** — `#toolbar`, adopted. It was fixed above the canvas on the
  grounds that STOP is a panic button; stop-all is bound **globally** (Ctrl+; ·
  Ctrl+, · Ctrl+.), so the bar had no claim to be the exception. `--toolbar-h` is
  now `0`. Its body is `overflow: visible` — the EXAMPLES dropdown hangs out of the
  bar and `auto` clipped it into a scrollbar.
- **`changelog` panel** — `changelogHTML()` exported from `docs.js`, same builder
  as the docs tab so the two cannot drift, plus the click-to-expand wiring.

`open` is persisted in the same per-panel entry as position and colour, and
`applyLayout` restores it — an arrangement that forgets what was put AWAY is only
half an arrangement.

**The home rectangle now starts at `HOME_Y = -96`**, not at the origin. The menu
panel sits above y=0 where a top bar belongs, and `fitHome()` has to frame it or
the one panel a first-time user most needs is just off the top edge. `fitHome`
solves for the pan that puts `HOME_Y` on the margin rather than assuming the
origin is the corner.

**Wordmark**: `.canvas-wordmark` inside `#wfd-canvas`, so it pans and zooms with
the workspace instead of floating over it as chrome. `pointer-events: none`.

## Traps found the hard way (UI)

**A captured pointer retargets the following click.** `beginDrag` calls
`setPointerCapture` on the panel header, so Chrome dispatches the subsequent
`dblclick` at the **header**, not at the `.panel-title` you actually hit — and the
header's own `dblclick` collapses the panel. That is why double-click-to-rename on
a detached buffer did nothing (it collapsed instead). Synthetic `PointerEvent`s do
NOT reproduce it, because `setPointerCapture` throws on a synthetic pointerId and
the capture never happens — the headless test passed while the feature was broken.
Fix: record the `pointerdown` target (that event is not retargeted; capture starts
*with* it) and route the dblclick on that. Renaming now lives in `panel.js` as
`spec.onRename`, so any panel gets it.

**`confirm()` is the wrong weight.** Replaced with `armButton()` in `panel.js`: the
button itself arms (turns red, reads `×?`), a second click within 3 s commits,
`pointerleave` or the timeout disarms. `skip()` is asked at CLICK time, so an empty
buffer closes in one click and a buffer with text asks twice.

**Panels had no DOM id** — only a registry key. `win.dataset.panelId = spec.id` now,
which is also what makes them addressable from a test.

## The bar, split three ways — and a right-click menu

One 1900px strip of sixteen buttons is a list, not a grouping — BOOT sat next to
RUN, GO LIVE next to EXAMPLES, and you learned positions rather than meanings. It
is three small panels now, grouped by *when* you reach for a thing:

| panel | holds |
|---|---|
| `run` | status dot · boot · load kit · run · stop · reload · perform · synth status |
| `collab` | share · go live · split |
| `learn` | tour · examples · version |

Boot and transport share a bar: they are used at very different RATES — the kit
loads once, stop gets hit all night — but they are adjacent in the only order that
matters, *boot, load the kit, then run*, and splitting them put a panel edge in the
middle of that sentence.

**The rule that decides membership: a bar holds VERBS.** Anything whose button only
showed or hid a panel — mix, parts, piano, modular, galaxy, docs, layouts — is a
noun, and nouns are rows in the **canvas context menu** (`menu.js`). ZEN and
CLASSIC UI went the same way: they act on the view, and the menu is where the view
is managed, which is why the `view` bar exists no more.

`collab`, not `share`: SHARE is a button *inside* it, and a panel called "share"
holding a button called "SHARE" is one word doing two jobs.

### The menu replaced a WINDOWS panel

A panel whose only job is to list panels is itself a panel — one more thing to
place, one more row in its own list, and useless until you can already see it. A
menu costs nothing until asked for and opens where the pointer already is.

Two verbs per row, because they answer different questions: the **row** toggles
("should this exist right now") and **⊕** goes to it ("where is it" — opens it if
closed, then `centerOn`). Toggling leaves the menu open so a workspace can be set
up in one visit; going somewhere closes it. Marks refresh in place rather than
rebuilding, or the rows move out from under the pointer you are about to click.

It skips `.panel-body`: inside a panel's CONTENT the browser's own menu is the
right one (spell check in the editor, copy in the log). The canvas and the panel
chrome are ours.

**Buffers are listed too.** With detachable tabs a buffer is either a tab in the
strip or a panel on the canvas, and "where did my scratch go" should have one
answer wherever it currently lives. The strip half comes from `index.html` via
`_dk.setBuffers({ list, go })` rather than the desktop reaching into the tabs;
`detached` now stores `{ doc, panel }` so a detached buffer can be centred like any
window.

`centerOn()` is new in `canvas.js` beside `panToReveal()` — reveal's "go there only
if you cannot see it" is right for an incidental nudge, but a GO TO you asked for
should put the thing in front of you even if a corner was already showing.

### Notes

Buttons are ADOPTED, not rebuilt — same elements, ids and listeners, so nothing in
`index.html` knows. The ones that left the bar stay inside the now-hidden
`#toolbar`; a programmatic `.click()` still works on an element in a `display:none`
parent, which is exactly how a menu row toggles a hosted module.

`#toolbar` is hidden rather than removed: what is left in it is the app title (the
canvas wordmark covers that) and the mobile drawer toggle, and a stray
`getElementById` on either should keep resolving rather than throw in one UI mode
only. CSS: the uppercase/letter-spacing vocabulary moved from `#toolbar button` to
`#toolbar button, .wfd-bar button` so it follows the buttons out. Bar bodies are
`overflow: visible` — the EXAMPLES dropdown hangs out of its panel and `auto` would
clip it into a scrollbar.

The home rectangle is `-96 … 1220` so the bar row above the editor is inside what
"reset view" frames.

### Still open: too many panels

15 owned + 7 floating. The obvious reductions, largest first:

1. **The six `status` panels** (clock · players · composition · session · midi ·
   settings) were ONE scrolling column in the classic layout (`#crash-panel` with
   `.cp-section`s). Merging them back into one panel with collapsible sections is
   6 → 1 and restores something that already worked.
2. **`transport` + `engine`** into one `run` bar — five controls, and boot/kit are
   adjacent to run/stop in the workflow anyway. 4 bars → 3.
3. **`layouts`** is a list of names with save/delete — a submenu in the context
   menu would do, removing another panel.

## Everything is a panel

The last fixed chrome is gone. Panels are **closable** (`×` in the header,
`spec.closable !== false`), which forced three other things to exist:

- **`windows` panel** (`windows.js`) — a chip per panel, lit when open, click to
  toggle. The one panel with `closable: false`, because a `×` with no way back is
  a trap door. Owned panels answer via `panel.isOpen()/setOpen()`; hosted modules
  are asked and toggled through their **own** button (`spec.btn`), never by hiding
  the panel behind their back — do that and the module's flag and the panel
  disagree, and the next press of the toolbar button does nothing. The generic `×`
  on a hosted panel routes to `closeFloating(spec)` for the same reason. State is
  polled at 400 ms rather than pushed, since the `×`, the module's own `✕`, Escape
  and a recalled layout can all change it.
- **`menu` panel** — `#toolbar`, adopted. It was fixed above the canvas on the
  grounds that STOP is a panic button; stop-all is bound **globally** (Ctrl+; ·
  Ctrl+, · Ctrl+.), so the bar had no claim to be the exception. `--toolbar-h` is
  now `0`. Its body is `overflow: visible` — the EXAMPLES dropdown hangs out of the
  bar and `auto` clipped it into a scrollbar.
- **`changelog` panel** — `changelogHTML()` exported from `docs.js`, same builder
  as the docs tab so the two cannot drift, plus the click-to-expand wiring.

`open` is persisted in the same per-panel entry as position and colour, and
`applyLayout` restores it — an arrangement that forgets what was put AWAY is only
half an arrangement.

**The home rectangle now starts at `HOME_Y = -96`**, not at the origin. The menu
panel sits above y=0 where a top bar belongs, and `fitHome()` has to frame it or
the one panel a first-time user most needs is just off the top edge. `fitHome`
solves for the pan that puts `HOME_Y` on the margin rather than assuming the
origin is the corner.

**Wordmark**: `.canvas-wordmark` inside `#wfd-canvas`, so it pans and zooms with
the workspace instead of floating over it as chrome. `pointer-events: none`.

## Traps found the hard way (UI)

**A captured pointer retargets the following click.** `beginDrag` calls
`setPointerCapture` on the panel header, so Chrome dispatches the subsequent
`dblclick` at the **header**, not at the `.panel-title` you actually hit — and the
header's own `dblclick` collapses the panel. That is why double-click-to-rename on
a detached buffer did nothing (it collapsed instead). Synthetic `PointerEvent`s do
NOT reproduce it, because `setPointerCapture` throws on a synthetic pointerId and
the capture never happens — the headless test passed while the feature was broken.
Fix: record the `pointerdown` target (that event is not retargeted; capture starts
*with* it) and route the dblclick on that. Renaming now lives in `panel.js` as
`spec.onRename`, so any panel gets it.

**`confirm()` is the wrong weight.** Replaced with `armButton()` in `panel.js`: the
button itself arms (turns red, reads `×?`), a second click within 3 s commits,
`pointerleave` or the timeout disarms. `skip()` is asked at CLICK time, so an empty
buffer closes in one click and a buffer with text asks twice.

**Panels had no DOM id** — only a registry key. `win.dataset.panelId = spec.id` now,
which is also what makes them addressable from a test.

## The bar, split five ways

One 1900px strip of sixteen buttons is a list, not a grouping — BOOT sat next to
RUN, GO LIVE next to EXAMPLES, and you learned positions rather than meanings. It
is five small panels now, grouped by *when* you reach for a thing:

| panel | holds |
|---|---|
| `transport` | run · stop · reload · perform |
| `engine` | status dot · boot · load kit · synth status |
| `collab` | share · go live · split |
| `learn` | tour · examples · version |
| `view` | windows · zen · desktop |

**The rule that decides membership: a bar holds VERBS.** Anything whose button
only showed or hid a panel — mix, parts, piano, modular, galaxy, docs, layouts —
is a noun, and nouns are chips in the WINDOWS panel, which also shows whether the
thing is *currently open*, something a button never did. Keeping both was two
controls for one state and the pair could disagree. Verified: zero overlap between
bar button labels and chip names.

The one exception is the WINDOWS button — the index has to be reachable without
already having found the index. That is also why the windows panel is the only one
with `closable: false`, and why it has no chip of its own.

`collab`, not `share`: SHARE is a button *inside* it, and a panel called "share"
holding a button called "SHARE" is one word doing two jobs.

Chips are grouped `workspace · status · tools · learn · collab · bars`, because 23
of them in one flat run would be a worse index than the row it replaced.

Buttons are ADOPTED, not rebuilt — same elements, ids and listeners, so nothing in
`index.html` knows. The ones that left the bar stay inside the now-hidden
`#toolbar`; a programmatic `.click()` still works on an element in a `display:none`
parent, which is exactly how a WINDOWS chip toggles a hosted module.

`#toolbar` is hidden rather than removed: what is left in it is the app title (the
canvas wordmark covers that) and the mobile drawer toggle, and a stray
`getElementById` on either should keep resolving rather than throw in one UI mode
only. CSS: the uppercase/letter-spacing vocabulary moved from `#toolbar button` to
`#toolbar button, .wfd-bar button` so it follows the buttons out. Bar bodies are
`overflow: visible` — the EXAMPLES dropdown hangs out of its panel and `auto` would
clip it into a scrollbar.

The home rectangle is now `-96 … 1220` so both the bar row above the editor and the
windows panel below the right-hand column are inside what "reset view" frames.

## Canvas HUD — bpm & counters on the floor

`hud.js`. The same numbers the clock section carries, drawn big and dim behind the
panels like the wordmark. Off by default; toggled from the canvas menu's `view`
section, persisted in `wfd-hud`.

The phrase counters are glanced at constantly and read in a tenth of a second —
exactly what should not require finding a panel, and exactly what a 10px row in a
sidebar is bad at. On the floor they are legible across a room, which is the
situation this layout is for.

**Cost.** The note scheduler is on the main thread, so a per-frame loop that writes
DOM every frame is a loop that jitters audio (that is how zoom used to disturb
timing). It reads the clock each frame but writes only when a displayed VALUE
changes — the counters step once per BEAT, so ~2 DOM touches a second at 120bpm —
and the rAF loop does not run at all while hidden. `setVisible(true)` paints
**synchronously** before scheduling: showing empty boxes until the next frame reads
as broken, and a throttled rAF can make that wait arbitrarily long.

Menu gained `toggles()` — rows under `view` with a state dot, which leave the menu
open like the panel rows. An action button has nothing to report; a toggle does.

## Traps found the hard way (testing)

**`--virtual-time-budget` fires `requestAnimationFrame` exactly ONCE.** Virtual time
advances instantly and nothing composites, so every rAF loop in the app freezes
after one tick. Measured: 1 tick per run, with `--headless=new`,
`--headless=old` and `--run-all-compositor-stages-before-draw` alike. That silently
makes a large part of this app untestable — the var needles, the live gutter, the
crash panel's `_updateBeat`, and this HUD are all rAF — and it fails by showing
STALE values, not by erroring.

The fix: shim rAF onto `setTimeout` inside the app frame, patched before its
deferred module scripts run. Poll `iframe.contentWindow` from the moment the iframe
navigates (a `load` listener is far too late):

```js
const iv = setInterval(() => {
  const w = fr.contentWindow;
  if (w && !w.__rafShim && w.location.pathname.includes('index')) {
    w.__rafShim = 1;
    w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(w.performance.now()), 16);
    w.cancelAnimationFrame  = (id) => w.clearTimeout(id);
  }
}, 0);
fr.addEventListener('load', () => clearInterval(iv), { once: true });
```

Verified: 31 ticks in 500 ms, and the HUD's bpm then follows a live `Clock.bpm`
change. Use this in any test that asserts on something animated.

## Engine work done from here (portable to dev01)

None of this is desktop-specific — cherry-pick it onto `dev01` when the branch lands.

**A latched NaN silenced the whole mix.** Reported as: heavy `#@` set, lines
evaluate and players show active, no sound, and only a page refresh brings it back.
`fd_master` ends in `Sanitize.ar`, but that sits at the TAIL and replaces bad
samples with **zero** — so one NaN reaching `fbdelay`'s or `pong`'s
`LocalIn`/`LocalOut` loop circulates forever, poisons the summed bus every block,
and is sanitised to continuous silence. The FX node holding it survives
re-evaluation, which is why re-running the line does nothing. Fixed in
`synthdefs/src/fx/fx_effects.scd`: `Sanitize.ar(LocalIn.ar(2))` in both feedback
loops (a bad sample now flushes on the next block — the delay self-heals), and
`Sanitize.ar` in `fd_fx_out`, the tail node every player's private bus passes
through, so a player that blows up silences only itself. Rebuilt with
`./scripts/build.sh fx_effects` → `fd_fx_fbdelay`, `fd_fx_pong`, `fd_fx_out`.

*Not confirmed by reproduction* — it is the hypothesis that fits every symptom,
and the guards are correct regardless. Discriminating test next time it happens,
**before refreshing**: `unsolo()` restores sound → the gate (see below);
top-bar RELOAD / `softReload()` restores it → a stuck node, i.e. this; neither →
reload with `?diag` and read `audioHealthPct` / `scsynthWasmErrors`.

**`soloRnd()` wrote gains behind the gate's back.** It set `_amplify = 0` on every
player directly and relied on a scheduled event 8 beats later to undo it. Nothing
in the UI showed why the room had gone quiet, and a lost restore (the clock's
`_tick` returns early when `_running` is false, so pending `_events` freeze) meant
permanent silence. It goes through `gate.soloOnly()` / `gate.clearSolo()` now, like
an eval-time `.solo()` — visible in the Players panel and the mixer, and cleared by
anything that recomputes the gate.

## Detached buffers: close & rename

A detached buffer panel had only ⤺ (back to the strip), so closing one meant
reattaching it first and then closing it there, and it could not be renamed at all.
It now carries × (discards it; confirms first if the buffer has text) and a
double-click-to-rename on the panel title using the same `.ed-tab-rename` field the
strip uses. Both exits share one `teardown()` that releases the doc with
`swapDoc(new Doc(''))` before the panel goes — CodeMirror refuses to hand a document
to a second editor while this one still holds it, and the strip is about to do
exactly that. Rename rewrites the `detached` map key (so the piano's `to` picker and
`bufferTargets()` follow it) but deliberately leaves the panel `id` alone, because
the saved layout is keyed by it.

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
