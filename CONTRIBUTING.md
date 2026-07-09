# Contributing to crashDot (webfoxDot)

crashDot is a browser-native port of [FoxDot](https://foxdot.org): you write
FoxDot-style Python-ish code, it transpiles to JavaScript, evaluates, and drives
[SuperCollider](https://supercollider.github.io/)'s `scsynth` **compiled to
WebAssembly** — all client-side. This guide covers the common ways to extend it:
**synths, FX, patterns, player methods, and examples.**

Please credit the lineage in anything you build: **FoxDot** (Ryan Kirkbride, MIT)
and **SuperCollider** (`scsynth`, GPLv3). Because `scsynth` is bundled, treat the
project as copyleft.

---

## How it fits together

```
your code (FoxDot-ish)
  → transpile          js/editor/transpiler.js   (var()→_var(), (a,b)→group, [::]→slice, …)
  → eval               index.html <script module> (runs in a scope full of synths/patterns/fx)
  → Player engine      js/engine/player.js        (schedules notes on the beat clock)
  → Clock              js/engine/clock.js          (beat → timestamped OSC bundle)
  → scsynth (WASM)     lib/dist/ (SuperSonic)      (fires each bundle sample-accurately)
```

- **Audio DSP** (synths + FX) lives in SuperCollider `.scd` source under
  `synthdefs/src/`, compiled to binary `.scsyndef` in `synthdefs/compiled/`.
- **Everything the user types** (synth names, FX params, patterns, methods) is
  wired up in JS: `js/synths/registry.js`, `js/fx/registry.js`,
  `js/patterns/sequences.js`, `js/engine/player.js`, plus the editor helpers in
  `js/editor/` and the reference docs in `js/ui/docs.js`.

### Repo layout (the bits you'll touch)

| Path | What |
|------|------|
| `synthdefs/src/synths/*.scd` | one SuperCollider SynthDef per synth |
| `synthdefs/src/fx/fx_effects.scd` | all the FX SynthDefs |
| `synthdefs/compiled/*.scsyndef` | compiled binaries (loaded at boot) |
| `scripts/build.sh` | compile `.scd` → `.scsyndef` (needs `sclang`) |
| `js/synths/registry.js` | `SYNTH_DEFS` — names, defaults, params |
| `js/fx/registry.js` | `FX_REGISTRY` + `FX_EFFECTS` — params + routing |
| `js/patterns/sequences.js` | `P*` pattern generators |
| `js/engine/player.js` | the `Player` class + its chainable methods |
| `js/editor/autocomplete.js` | autocomplete menus (synths/fx/patterns/methods) |
| `js/ui/docs.js` | in-app reference, examples, and the changelog |
| `index.html` | boot, the eval scope, `SYNTHDEFS_TO_LOAD` |

---

## Prerequisites & running locally

- **A browser** — that's it to *run* it. The app needs `SharedArrayBuffer`, so it
  must be served with COOP/COEP headers; `serve.py` sets them for you.
- **SuperCollider** (`sclang` on your PATH) — only needed to **recompile
  synthdefs** (add/change a synth or FX). If you're only touching JS, skip it.
- **Node.js** — only needed for the multiplayer collab server.

```bash
python3 serve.py                 # static app on http://127.0.0.1:8765
node server/collab-server.js     # optional: multiplayer + galaxy on :4444
# (in this repo's sandboxed dev boxes: COLLAB_HOST=127.0.0.1 node server/collab-server.js)
```

Open the app, click **boot**, click **♪ load kit** (default sample pack), and
you're live.

---

## Adding a synth

Example: a synth the user calls as `p1 >> mysynth([0,4,7], oct=5, cutoff=1200)`.

**1. Write the DSP** — `synthdefs/src/synths/mysynth.scd`:

```supercollider
// mysynth — one-line description
SynthDef(\fd_mysynth, {|note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.1,
                       cutoff=1200, res=0.4|
    var freq = note.midicps, env, sig;
    env = EnvGen.ar(Env.perc(attack, release), doneAction: 2);   // free itself when done
    sig = Saw.ar(freq) * env * amp;
    sig = RLPF.ar(sig, cutoff.clip(40, 18000), res.clip(0.05, 1));
    Out.ar(0, Pan2.ar(sig, pan));                                 // ALWAYS Out to bus 0, stereo
}).writeDefFile(~outDir);
```

Conventions: name it `\fd_<name>`; take `note` (MIDI, use `.midicps`), the common
base `amp sus pan attack release`, and your own extras; end with a `doneAction: 2`
envelope so voices free themselves; write to bus `0` via `Pan2`.
**Only use UGens that exist in the scsynth-WASM build** — see the caveat below.

**2. Compile it:**

```bash
./scripts/build.sh mysynth      # → synthdefs/compiled/fd_mysynth.scsyndef
```

**3. Register it** — `js/synths/registry.js`:

```js
mysynth: {
    scName: 'fd_mysynth',
    defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 1200, res: 0.4 },
    extraParams: ['cutoff', 'res'],   // params beyond the base note/amp/sus/pan/attack/release/out
},
```

`defaults` also drives autocomplete's inserted call.

**4. Load it at boot** — add `'fd_mysynth'` to `SYNTHDEFS_TO_LOAD` in `index.html`
(near the top of the boot section).

**5. (Optional) Group it in autocomplete** — add `'mysynth'` to a family in
`SYNTH_SUBCATS` in `js/editor/autocomplete.js` (`bass/lead/keys/pads/pluck/perc/
tone`); unlisted synths still work, they just appear under "other".

Syntax highlighting is **automatic** (derived from `SYNTH_DEFS` keys). Add a blurb
to the in-app **Synths** reference in `js/ui/docs.js` if you like.

---

## Adding an FX

FX are per-player nodes on a private bus, created on demand and inherited across
re-evals. Example: `p1 >> saw([0], myfx=0.5, myfxtone=800)`.

**1. Write the DSP** — add a SynthDef to `synthdefs/src/fx/fx_effects.scd`:

```supercollider
// myfx — one-line description. myfx = wet mix (0..1), myfxtone = a control.
SynthDef(\fd_fx_myfx, {|in_bus=64, myfx=0, myfxtone=800|
    var sig = In.ar(in_bus, 2), wet;                     // read the player's stereo bus
    wet = BPF.ar(sig, myfxtone.clip(40, 18000), 0.5);    // ...do something...
    ReplaceOut.ar(in_bus, sig + ((wet - sig) * myfx.clip(0, 1)));  // linear dry↔wet, back to the bus
}).writeDefFile(~outDir);
```

Pattern: `In.ar(in_bus, 2)` → process → `ReplaceOut.ar(in_bus, mixed)`. Keep a
proper wet mix so `myfx=0` is a clean bypass.

**2. Compile:** `./scripts/build.sh` (recompiles all FX).

**3. Register it** — `js/fx/registry.js`, in two places:

```js
// (a) FX_REGISTRY — one entry per user-facing param:
myfx:     { scParam: 'myfx',     default: 0,   desc: 'My FX — wet mix (0=off)' },
myfxtone: { scParam: 'myfxtone', default: 800, desc: 'My FX tone (Hz)' },

// (b) FX_EFFECTS — the routing entry:
{ scName: 'fd_fx_myfx', keys: ['myfx', 'myfxtone'], trig: ['myfx'] },
```

- `keys` = every param the node accepts. `trig` = the param(s) whose presence in a
  player's args **activates** the node (usually the mix key). Order in `FX_EFFECTS`
  is the signal-chain order.
- FX are added to the boot load list **automatically** (`FX_SYNTHDEFS` derives from
  `FX_EFFECTS`) — no `index.html` change needed.

**4. (Optional) Autocomplete** — add an entry to `FX_GROUPS` and a family in
`FX_SUBCATS` in `js/editor/autocomplete.js` so it shows in the fx flyout with a
sensible "on" value.

---

## Adding a pattern generator

Example: `PMything(...)`.

**1. Implement + export** from `js/patterns/sequences.js`. Return a pattern object —
a cycling list via `cyc([...])`, a lazy `{ get(step) { … } }`, or a `Pattern`
(Array subclass). Numbers/arrays/groups from user code arrive as-is.

```js
export function PMything(n = 8) {
    const seq = Array.from({ length: n }, (_, i) => i % 4);
    return cyc(seq);   // resolved per step via .get(step)
}
```

**2. Highlighting** is **automatic** (derived from the module's `P*` exports).
Keep internal helpers un-exported or they'll be treated as patterns.

**3. Autocomplete** — add a template to `PATTERN_TEMPLATES` and list it in a family
in `js/editor/autocomplete.js` (e.g. `PMything: 'PMything(8)'`).

**4. Docs + Alt+I** — add an entry to the `PATTERNS` array in `js/ui/docs.js`:

```js
{ name: 'PMything(n)', desc: 'What it does, briefly' },
```

> ⚠️ The Alt+I inspector and the Patterns tab key off this array. A pattern that's
> exported/highlighted/autocompleted but **missing here shows "no info"** on Alt+I.

---

## Adding a player method

Chainable methods like `.every(...)`, `.human(...)`, `.unison(...)`.

**1. Add the method** to the `Player` class in `js/engine/player.js`. Return `this`
so it chains:

```js
myMethod(x = 1) {
    this._myState = x;      // read it back in _fire()/fireVoices where notes are built
    return this;
}
```

**2. Advertise it** — add a template to `PLAYER_METHODS` in
`js/editor/autocomplete.js` (e.g. `'myMethod(1)'`). Typing `.` after a player opens
this menu.

**3. Document** it in the relevant docs section / add a tutorial example.

---

## Adding an example (Live set / tutorial)

Examples live in `js/ui/docs.js` and feed **three** surfaces at once: the
`examples ▾` dropdown, the **Examples** docs tab, and the **galaxy** nebulae.

**1. Define a section** (put the code at column 0 — the indentation is preserved
when loaded):

```js
const myset = section('My Set — yourname', `
    ${note('One-paragraph description. Boot + load the kit first.')}
    ${code(`#@#@ my_set

#@intro(16)
p1 >> pads([0, 3, (0,3,7)], oct=4, dur=8, amp=0.5)

#@end(16)`)}
`, 'myset');    // ← the id (used by the URL/galaxy; must be unique)
```

`code()` HTML-escapes `<` `>` for display; loading unescapes them, so `oct=<5 6>`
round-trips fine.

**2. Add it to a category** in the `GROUPS` array (further down in `docs.js`):

```js
['Live sets', [rise, shorelines, myset, /* … */]],
```

Categories: `Live sets · Techniques · Basics · Patterns & time · Sound design ·
Perform & MIDI · Tut · …`. The category name is the galaxy cluster name.

---

## Recompiling synthdefs

```bash
./scripts/build.sh            # compile every synth + FX
./scripts/build.sh dbass      # compile just one (matches synthdefs/src/**/dbass.scd)
```

Commit **both** the `.scd` source and the resulting `.scsyndef` binary — the app
loads the compiled binary; the deploy doesn't run `sclang`.

> ### ⚠️ The WASM-UGen caveat (read this)
> `sclang` knows every UGen, but the **scsynth-WASM build ships a subset**. A def
> that references a missing (or half-implemented) UGen may compile and "load" yet
> produce **silence or a wrong result** — no error. This bit the `squiz` FX (it
> used the `Squiz` UGen, which barely processes in WASM). **Always verify a new
> synth/FX actually sounds right in the browser**, and prefer common UGens
> (`SinOsc/Saw/Pulse/LPF/HPF/BPF/RLPF/PitchShift/CombN/Delay*/Env*/…`). If a UGen
> misbehaves, re-implement with ones that are present.

---

## Updating the changelog

Add an entry to `CHANGELOG` in `js/ui/docs.js` and bump `VERSION`. Write each item
as **`"Short headline — full details…"`** — the log auto-collapses to the headline
and expands the rest on click, so lead with a terse hook and put specifics after
the em-dash.

---

## Conventions & gotchas

- **Match the surrounding style** — no build step, native ES modules, terse
  comments that explain *why*.
- **Verify by ear + headless.** Boot the app and listen; the repo's tests drive a
  headless Chromium over CDP for regression checks.
- **Registry is the source of truth** — highlighting and the runtime scope derive
  from `SYNTH_DEFS` / the pattern exports, so keep them accurate; the autocomplete
  families and docs tables are hand-maintained, so update them too.
- **Don't advertise what doesn't exist** — a name in the highlighter/autocomplete
  with no implementation reads as a real feature and throws when used.
- **Keep the multiplayer server small** — it's the only ongoing ops cost.

Thanks for contributing — a new synth, FX, or Live set is the best kind of PR. 🎛️
