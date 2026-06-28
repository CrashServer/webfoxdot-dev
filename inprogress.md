# In-progress — alpha19 (resume after reboot)

Branch: **alpha19** (off alpha17). Working tree clean — everything below is committed.
Rollback anchor: tag `alpha17-stable` @ 6a1c149.

## Goal of alpha19
Make WebFoxDot run CrashServer-style FoxDot tracks (the big test track in chat).
Porting the missing language features, synths, and FX from `/home/svdk/live/FoxDot/`.

## Source locations (the originals we port from)
- SynthDefs:  `/home/svdk/live/FoxDot/FoxDot/osc/scsyndef/<name>.scd`
- FX:         `/home/svdk/live/FoxDot/FoxDot/lib/Crashserver/crashFX.py`
              (each `FxList.new(name, scName, {params}, ...)` + `fx.add("<sc code>")`)
- Sample loops (for loop()): under `/home/svdk/live/.../samples` or FoxDot loop dir.

## Build / run
- Compile one synth/fx:  `./scripts/build.sh <name>`  → writes `synthdefs/compiled/fd_<name>.scsyndef`
  (sclang lingers on exit; `timeout 70` → exit 124/143 is harmless once "fd_<name> done" printed)
- Dev server: `python3 serve.py` (127.0.0.1:8765, no-cache + COOP/COEP). Reload picks up JS/scsyndef.
- A new synth needs: the `.scd` (adapt I/O — see "Porting convention"), compile,
  an entry in `js/synths/registry.js` (SYNTH_DEFS), and add `fd_<name>` to
  `SYNTHDEFS_TO_LOAD` in `index.html`.
- A new FX needs: a section in `synthdefs/src/fx/fx_chain.scd` (args + locals +
  `XFade2`), recompile fx_chain, and param entries in `js/fx/registry.js`.

## Porting convention (FoxDot scsyndef → WebFoxDot)
- `\name` → `\fd_name`; `.add` → `.writeDefFile(~outDir);` + `"fd_name done".postln;`
- `bus=0` arg → `out=0`; add `note=60`; `freq = In.kr(bus,1)` → `freq = note.midicps`
  (keep any internal /2,/4 voicing). `ReplaceOut.ar(bus,…)` → `Out.ar(out,…)`.
- buildParams sends: out, note(midi), amp, pan, attack, sus(=total seconds), release,
  + each `extraParams` entry. So name envelope args `attack`/`release`; put others in extraParams.
- Gate ADSRs (`.kr(gate:gate, doneAction:…)`) → fixed-length env, hold = (sus-atk-dec-rel).max(.01),
  and ONE env must carry `doneAction:2` so the node frees.
- Only ONE LocalIn/LocalOut pair per SynthDef — the fx_chain's is already used by fbdelay,
  so feedback FX must use Comb* instead (see eb, feed).

## DONE in alpha19 (commits 2f94b1f … 9f76d45)
- **Non-synth tier**: Root note-names ("E"→4), `.penta()`, `.degrade(p)`,
  `.unison(n,detune,spread)`, `fperlin(period,lo,hi)`, fb/fi/fo usable as plain
  clock-synced values, cross-player reads `b1.degree`, var() durations as patterns.
- **Pattern arithmetic**: `linvar([1.4,0],32) * P[1,0,0.9]` etc. Transpiler emits
  `Pmath(a,'op',b)` (gated on a pattern token + top-level op; scalars stay native).
  Runtime `Pmath` in js/patterns/sequences.js.
- **Synths (8 new; total 29)**: ebass, faim, guit(MiPlaits), lapin, acidbass,
  hoover, cs80, moogpluck.
- **FX (10 new)**: octclean, fold, csweep, eb(echo), tube(+tubedrive alias),
  drcomp, lofi, vowel, feed, sbrk. (multicrush was already our exact port.)
- alpha18 (also on this branch, committed): sample-accurate timestamped clock;
  `<>` synth alternation; global stop Ctrl/Cmd+.; readable cm-builtin.

## PENDING — pick up here
1. **Finalize alpha19** — DONE (commit after 9ac5d6f):
   - VERSION 'alpha18'→'alpha19' in `js/ui/docs.js`; `index.html` tag `α18`→`α19`.
   - alpha19 CHANGELOG entry added (pattern arithmetic, lang features, 8 synths, 10 FX).
   - docs Synths/FX tabs + examples + autocomplete all auto-generate from
     `SYNTH_DEFS` / `FX_REGISTRY`, so they were already current.
   - `js/editor/foxdot_mode.js` highlight list: added ebass, faim, guit, lapin,
     moogpluck (acidbass/hoover/cs80 were already present). FX aren't highlighted
     (they're kwargs), so no FX list to update there.
2. **Remaining track gaps**:
   - `loop("hiphop16", dur=16, sample=2)` — needs named-loop-buffer loading + a
     PlayBuf player path (its own chunk). Source: scsyndef/loop.scd (uses PlayBuf,
     BufDur, Splay, beat_stretch). Not yet started.
   - `play()` `bank=` (sample-bank switching) — not supported.
   - `fx1`/`fx2` (lapin) — utility lpf/hpf routing FX in crashFX.py (lines ~633/642). Low priority.
3. **More synths/FX** if wanted — the user picked all 4 groups; only 1 per group ported
   so far. More candidates in scsyndef/: bass(subbass,fbass,dafbass,acidline),
   leads(darklead,a_glead,hardstab,rave), pads(darkpad,ethpad,sinepad,keys),
   plucks/wobble(mpluck,pluck2,wobble,wob). More FX in crashFX.py (clouds=MiClouds,
   mring=MiRings, chorus2, krush, doppler, sidechain, dubdelay, …).

## Notes / gotchas
- mi-UGens (MiPlaits/MiClouds/MiRings) ARE in our scsynth WASM build (guit uses MiPlaits).
- sc3-plugins UGens are NOT guaranteed: RLPFD (lapin) → swapped to RLPF; SmoothFoldS/
  EnvFollow (fold) → reimplemented with built-in .fold2; Fb quark (feed) → CombN.
- Unknown synth controls are silently ignored by scsynth, so partial ports still play.
- Don't redistribute the LOCAL FoxDot samples (not open-licensed); public kit is
  CrashServer/webfoxdot-kit. Git remote: git@github.com:CrashServer/webfoxdot-dev.git.
