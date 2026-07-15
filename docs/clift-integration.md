# clift visuals in crashDot — integration theory (alpha28)

**Status:** theory + an MVP shipped in alpha28 (see "MVP" below). Decision-led.

## MVP (alpha28) — pop-out, in-house renderer

Decided against vendoring `clift_final` (it's a 31GB Three.js/Vite app — the dist is
mostly video assets) and built a compact, no-build, same-origin renderer instead:

- **`js/visuals/bridge.js`** (main window): taps `sc.node` (the scsynth worklet
  output) with one `AnalyserNode`, and posts `{bass,mid,treble,level,bpm,beat,bar}`
  ~30×/s plus each evaluated line over a `BroadcastChannel('crashdot-visuals')`.
  `openVisuals()` opens the pop-up; `startVisualsAudio(sc,clock)` runs after boot;
  `postCode()` is called from `runCode`.
- **`visuals.html` + `js/visuals/clift.js`** (pop-out window): an ASCII grid on a
  canvas with 4 scenes (plasma / tunnel / spectrum / code-rain) reactive to the
  bands + beat; FPS-capped (30) and auto-paused when hidden. Keys: space = next
  scene, a = auto-cycle, f = fullscreen.
- **▦ toolbar button** opens it.

Why this nails the resource constraint: the pop-out has its **own event loop**, so
all canvas work is off crashDot's audio-clock thread. Main-window cost = one
analyser read + a small BroadcastChannel post per tick.

Next (from the theory below): in-page docked mode via Worker+OffscreenCanvas+SAB;
map structural events (drop/solo/chaos) to scene/auto changes; optionally graduate
to the full clift scene set.

---

**Original theory follows.**

**Goal:** render clift-style ASCII/shader visuals live *inside* (or alongside)
crashDot, reactive to (a) the audio we generate and (b) the code/beats we run —
**without stealing resources from the audio clock.**

---

## 1. What clift is, and the lucky alignment

`CRIC/clift_final` is a browser-native VJ engine (TypeScript + Three.js/WebGL2).
Its own DESIGN.md states three pillars that are *exactly* this request:

1. **Live-coding first-class** — it already ingests code over WebSocket and reacts
   (beat sync, attack events, code-driven scene triggers).
2. **Audio-reactive everything** — every scene has an audio contract
   (`bass/mid/treble/beat/spectrum`).
3. The ASCII / half-block / Braille look is done as **shaders over a low-res render
   target**, not char cells.

Crucially, clift_final's WS protocol (`src/live/ws-protocol.ts`) is **already a
FoxDot bridge**:

```ts
MsgBpm   { type:"bpm", bpm }
MsgBeat  { type:"beat", energy? }
MsgCode  { type:"svdkCode"|"evaluate_code", code, userName:"svdk" }
MsgInstantCode { type:"svdkInstantCode", windowLines, currentLineNumber, … }
MsgFoxdotLog   { type:"foxdot_log", data, attackRequestName }   // ← per-attack trigger
MsgLink  { type:"link", bpm, phase, beat, linked }
```

crashDot **is** a FoxDot port. So crashDot can pose as the `svdk` source and clift
reacts with essentially zero new clift code. That is the whole shortcut.

Its audio contract (`src/types.ts` `AudioData`): `spectrum: Float32Array(64)`,
`bass/lowMid/mid/highMid/treble/volume` (+ `…Slow`), `beatDetected`,
`beatIntensity`.

---

## 2. The hard constraint: don't starve the audio clock

crashDot's note scheduler runs on the **main thread** (`LOOKAHEAD_S` budget; the
`load-meter` already warns when main-thread lag makes notes late). Visuals must not
compete. Two consequences drive the architecture:

- **Keep all WebGL work off the main thread** → render clift in a **Web Worker +
  `OffscreenCanvas`**. The main thread only posts tiny control/audio messages.
- **The ASCII aesthetic is naturally cheap** — it renders to a low-res grid (e.g.
  160×100 internal, upscaled). Few cells → low GPU + low upscale cost. clift is a
  *good* fit for "don't eat resources" compared to a full-res shader vis.

Guardrails: 30 fps cap by default (toggle 60), internal target ≤ ~200×120,
**auto-pause when the tab is hidden or zen mode is on**, a master visuals on/off,
and a "vis load" readout so a struggling machine drops visuals first — never notes.

---

## 3. Data plumbing

### 3a. Code / beat reactivity ("based on what we code") — cheap, exact
crashDot already emits everything clift's bridge wants. Map 1:1:

| crashDot event (exists today) | → clift WS message |
|---|---|
| `clock` beat / bar (we have phrase counters + exact phase) | `beat` + `bpm` (and `link` with `phase`) |
| `emitStep(name, step)` (fires per note) | `foxdot_log` with `attackRequestName=name` (attack/scene trigger) |
| a `>>` eval (player/synth/degree) | `svdkCode` (full line) |
| cursor line + window | `svdkInstantCode` (windowLines / currentLineNumber) |
| `stop` / `solo` / `drop` / `chaos` | structural cues → clift auto-mode buildup/drop |

We **derive beat from the clock**, not from audio onset detection — we already know
tempo and phase exactly, so it's both cheaper and tighter than FFT beat detection.

A small `clift-bridge.js` adapter translates these into clift messages. Cost on the
audio path: a few `postMessage`/`BroadcastChannel.postMessage` calls per beat +
one per note — negligible.

### 3b. Audio reactivity ("audio reactivity") — one analyser
- Insert a single Web Audio `AnalyserNode` on SuperSonic's output (tap `sc`'s
  AudioContext / before `destination`). FFT (1024) runs on the audio thread — cheap.
- Reduce to `bass/mid/treble/volume` band sums + a 32–64-bin downsampled spectrum.
- **Transport options:**
  - *Embedded (same page):* write bands into a `SharedArrayBuffer` the worker reads
    — **zero-copy, no postMessage churn.** crashDot already runs cross-origin
    isolated (COOP/COEP for WASM threads), so SAB is available. This is the elegant
    path.
  - *Popped-out (separate tab):* a separate tab can't see crashDot's AudioContext;
    send the downsampled spectrum as a custom WS/BroadcastChannel message, or let
    clift analyse the system loopback/mic.

---

## 4. Integration options (pick by effort vs coupling)

**A. Embedded worker module (best end-state).** Bundle a trimmed clift renderer as
a Worker; crashDot owns a docked/overlay `OffscreenCanvas`. Shared SAB for audio,
postMessage for events. Single process, single screen, tightest. Most work.

**B. Pop-out clift driven by crashDot (best first step).** crashDot broadcasts the
normalized event+audio stream over `BroadcastChannel` (same machine) and/or the WS
protocol clift_final already speaks. User opens clift in a second window/screen
(ideal for projection). **Zero cost on crashDot's audio path** (separate process),
zero risk, ships fast.

**C. Minimal in-house ASCII vis.** Port 3–5 clift scenes to a tiny crashDot canvas,
no full clift. Lightest, least faithful — a fallback if A/B prove heavy.

**Recommendation:** ship **B** first (pop-out via the existing WS/BroadcastChannel
bridge — instant audio+code-reactive visuals on a second screen, ~0 impact on
crashDot), then graduate to **A** (worker + OffscreenCanvas + SAB) as an in-page
docked panel for single-screen use, behind the same bridge so both share one
adapter.

---

## 5. Resource budget (targets)

| | budget |
|---|---|
| Main thread (crashDot) | event posting + 1 analyser read/frame (< ~0.2 ms); **audio clock untouched** |
| Worker / GPU | 30 fps cap (toggle 60), internal ≤ 200×120, auto-pause hidden/zen |
| Memory | 1 AnalyserNode + small SAB; clift scenes lazy-loaded |
| Safety | master on/off + "vis load" readout; visuals degrade before audio |

---

## 6. Phasing

1. **Bridge** (`clift-bridge.js`): emit normalized events (clock beats → `beat`/`bpm`,
   `emitStep` → `foxdot_log`/attack, evals → `svdkCode`/`svdkInstantCode`, structural
   cues) + an `AnalyserNode` bands feed, over `BroadcastChannel` (+ optional WS reusing
   clift_final's schema).
2. **Pop-out clift (option B)** consuming it. Validate audio + code reactivity;
   measure crashDot `load-meter` delta (target ≈ 0).
3. **In-page docked clift (option A):** Worker + `OffscreenCanvas` + SAB, FPS-capped,
   auto-pause, toggle button next to ⬓/⛶.
4. **Curate** scenes; map structural events (drop/solo/chaos/stopAll) to clift
   auto-mode buildup/drop.

---

## 7. To confirm at implementation time

- SuperSonic's AudioContext / output-node accessor for the analyser tap
  (`sc.context` / equivalent in `lib/dist/supersonic.js`).
- `OffscreenCanvas` + Worker WebGL support on targets (Chromium ✓, Firefox ✓,
  Safari partial → main-thread fallback path from §2).
- Exact reuse vs trim of clift_final's scene set + `ws-protocol.ts` (it's a superset;
  we only need the inbound subset above).
- Whether to vendor a trimmed clift build into `crashDot/lib/` or load it from a
  sibling origin.

---

## TL;DR

clift_final was already built to be driven by a FoxDot live-coding source over WS
and to be audio-reactive. crashDot is that source. **Start by making crashDot speak
clift's bridge (beats from the clock, attacks from `emitStep`, code from evals) and
run clift popped-out** — near-zero cost, instant payoff. Then bring it in-page on a
**Worker + OffscreenCanvas + SAB** so the GPU never touches the main thread, with FPS
caps and auto-pause so visuals can never make a note late. The ASCII look keeps it
cheap by design.
