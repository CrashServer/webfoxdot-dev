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

## Batch 3 — unison + per-eval + consolidation + bug
- ☐ **⑤** unison: resolve non-grouped params once per step
- ☐ **⑦** memoize compiled `new Function` by transpiled source
- ☐ **⑧** hoist transpiler regex literals to module scope
- ☐ **B1** shared `escapeHtml` (js/ui/util.js)
- ☐ **B2/B3** share degree/opts splitter + chainable-modifier base between SynthCall/MidiOutCall
- ☐ **B5** fold crashpanel's two 500ms timers into the 250ms _update
- ☐ **BUG** synthdef.js BINOP: min/max/% selector indices (mod=5, min=12, max=13) — verify + fix

## Batch 4 — the big one
- ☐ **①** fd_fx_chain → per-effect on-demand nodes (idle effects cost zero). Needs design:
      effect ordering, single LocalIn/LocalOut (fbdelay), recompile. Highest CPU payoff.

## Verification log
(filled per batch)
