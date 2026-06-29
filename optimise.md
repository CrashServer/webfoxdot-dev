# Optimisation tracker (alpha21)

Deep-analysis-driven cleanup. Each item: status, what, where, how verified.
Status: ☐ todo · ◐ in progress · ☑ done (committed)

## Batch 1 — safe quick wins (dead code + OSC + per-eval) — ☑ DONE (commit pending)
- ☑ **D1** delete `FXChain.reset()` — js/fx/chain.js
- ☑ **D2** delete `fxDefaultParams()` — js/fx/registry.js
- ☑ **D3** delete `onMidiOutChange` re-export — js/midi/midiout.js
- ☑ **D4** delete `MIDI_CURVES` — js/midi/midi.js
- ☑ **D5** delete `getActiveLine()` — js/engine/sections.js
- ☑ **③** removed redundant per-note `/n_free` in `_trigger` (synthdefs self-free, doneAction:2)
- ☑ **②** FX `n_set` value-diffing in `FXChain` (`_last` cache; static FX→1 msg then 0)
- ☑ **⑥** `buildCtx()` static part memoized once; only `userSynths` merged per eval
  Verified: syntax+import ok; 0 dead refs; mock(diff sends 1/1/2, only-changed; no /n_free,
  /s_new still sent); headless 20s+ run audioHealth 100/glitch 0/0 drops (no leak); normal
  synth+sample play 0 errors.

## ⚠️ Bug discovered during testing — ☑ FIXED
- ☑ **BUG-defsynth** transpiler mangled multi-line arrow bodies: `({…}) => {` → `=>)`.
  Fix: in kwargify, when a `(` has no matching `)` on the line (depth>0 at end-of-
  string = a multi-line construct), emit the rest verbatim instead of reformatting
  (js/editor/transpiler.js). Verified: defsynth("mylead", …)=>{…} now transpiles
  intact, `synth "mylead" defined ✓`, plays (1 voice); normal player lines unaffected.

## Batch 2 — per-step hot path + highlight — ☑ DONE
- ☑ **④ (safe subset)** compute hasFx/hasEnvs once (removed 3 redundant Object.keys/step);
  thread secPerBeat from _fire into _trigger (was recomputed per voice×rep).
  DEFERRED (deep arg-partition/static-vs-dynamic cache): poor risk/reward — patGet on a
  scalar is one cheap branch, and a stale cache in the live-coding hot path is a subtle
  correctness hazard. DSP (batch 4) is the real CPU cost, not these few allocations.
- ☑ **⑨** highlight skips the clear+markText DOM churn when the marked span signature is
  unchanged from the prior step (`_markSig` map; common for length-1/slow patterns).
  Verified: mock (FX routing/chord intact, bare bypass, secPerBeat passed); headless —
  all 4 players still highlight (chords incl.), 4v, 0 errors.

## Batch 3 — per-eval + consolidation + bug — ☑ DONE
- ☑ **BUG** synthdef.js BINOP: corrected min=12, max=13 (were 5/6, colliding with %=5
  and ==). They're unreachable today (only +,-,*,/ exposed via UGenOut) but the table
  is now accurate for when min/max get wired up.
- ☑ **⑧** hoisted the 9 transpiler regex literals to module scope (built once, not per
  line per eval). Verified: P*[]/P[]/play/setAttr/every/rest all still transpile right.
- ☑ **⑦** memoize compiled `new Function` by (transpiled source + ctx key-count). Re-
  running the same block (the common loop) skips re-parsing ~130 params; a new defsynth
  appends a key → count change → recompile. Verified re-eval + new block + 0 errors.
- ☑ **B5** folded crashpanel's two 500ms Scale/Root reflect timers into the 250ms
  _update (_reflectScaleRoot). Verified Scale.default="major" reflects in the select.
- DEFERRED (rationale): **⑤** unison resolve-once — only multi-voice, and per-voice copy
  is cheap assignments (not patGet); marginal. **B1** shared escapeHtml — a new module
  for one 1-liner is churn > value. **B2/B3** SynthCall/MidiOutCall base class — touches
  the `instanceof` dispatch in __rshift__ for a cosmetic dedup; risk > value.

## Batch 4 — the big one (① fd_fx_chain idle-stage cost)
Problem: one fd_fx_chain runs ALL ~32 effect stages every block (XFade2 only selects
output; wet DSP always computes). N FX players = N× the full rack. Heavy offenders:
octclean 2×PitchShift, tube/drcomp/lofi 4×Compander, sbrk always-on RecordBuf+PlayBuf.

Approaches considered:
- **A — full per-effect on-demand**: split the rack into ~32 individual SynthDefs,
  each In.ar(bus)→process→ReplaceOut.ar(bus); FXChain inserts a node only when a
  param goes non-zero (ordered via /n_after), frees it when back to default. Idle
  cost = 0. Hard: deterministic ordering, per-node LocalIn/LocalOut (fbdelay),
  param→effect grouping, "returned to default→remove". Effort high; ~32 recompiles.
- **B — interim: extract only the heavy always-on offenders** (octclean PitchShift,
  sbrk RecordBuf/PlayBuf, the 4 Companders) into separate on-demand nodes; keep the
  cheap filters/allpass in the common chain. ~80% of the CPU win, far less risk.
  Effort medium; ~4 new synthdefs + fx_chain recompile.
- C (bypass-guard inside the static def): impossible in scsynth (can't skip UGens).

Decision: ___ (awaiting user)
- ☐ **①** implement chosen approach

## Verification log
(filled per batch)
