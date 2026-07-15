# In-progress — alpha21 (resume after reboot)

Branch: **alpha21** (off alpha20). Rollback anchor: tag `alpha17-stable` @ 6a1c149.

## alpha21 — DONE: conditional FX routing (skip FX graph when unused)
- Players used to ALWAYS instantiate + route through fd_fx_chain (37 always-on
  effect stages), even a bare `d1 >> dbass()`. Now the FX chain is created LAZILY
  in _fire/_fireSample/_fireLoop, only when the player actually has an FX param
  (or FX envelope). No FX → synth routes straight to bus 0 (outBus computed as
  `this._fxChain ? this._bus : 0`, threaded into _trigger). Removed the 3
  unconditional `new FXChain` at activation. _resetState now FREES the chain
  (was: bypass) so `~d1 >>` returns a player to direct routing.
- FX persist via the existing arg inheritance: `dbass(mverb=0.5)` then
  `dbass(crush=4)` (no ~) → n_set sends BOTH (verified). Chain kept once created.
- VERIFIED (node mock + headless): bare→no chain; mverb→chain+reverb only;
  +crush→reverb+crush; ~reset→/n_free + back to direct; 4 mixed players 0 errors.
- SCOPE: helps FX-free players (big CPU win). Does NOT reduce cost for players that
  DO use FX — the 3-heavy-FX dropout still needs the fd_fx_chain idle-stage skip
  (next item).

## alpha21 — INVESTIGATING: synth voices drop after ~1 min (Chrome)
- SYMPTOM (user): synths + a play; after ~1 min the synth notes stop sounding but
  audio (the play/drums) keeps going. Repro code: dbass.unison(2) + saw(sinvar lpf,
  .every reverse) + play(x...).
- RULED OUT via headless CDP (see scratchpad repro/wall/metrics scripts):
  - JS clock/_fire: all players keep firing linearly for 3-min-equiv, 0 errors.
  - Highlight logic: all lines highlight (block AND line-by-line eval).
  - Bus/voice leak: flat at 3v / 3 buses; scheduler lag ~0ms.
  - scsynth server: 70s+ with audioHealthPct=100, 0 sched drops/lates, 0 glitches.
  - All synthdefs self-free (doneAction) — no server node leak.
- LIKELY AREA: headless has NO audio device → prescheduler takes the "bypass/
  immediate" path (preschedulerBypassed increments per msg), so the real-audio
  *scheduled* path (bundles timed against the AudioContext clock, drift-compensated)
  is never exercised here. The ~1-min degradation almost certainly lives there
  (clock-vs-audioclock drift / scheduler horizon). Can't repro without a real device.
- ADDED: `?diag` URL flag — logs scsynth getMetrics() every 3s (audioHealthPct,
  scsynthSchedulerDropped/Lates, preschedulerLates, driftOffsetMs, …) to console +
  log panel. NEXT: run real Chrome with ?diag for ~90s until synths drop, see which
  metric moves. Candidate fix if it's message pressure: diff FX n_set (only send
  changed params; today FXChain.update sends every step even for constant FX).

## alpha21 — DONE so far
- **MIDI value curves** (small, extends alpha20 midi()) — `midi`/`mlearn` 4th arg
  now: lin, exp, log, quad, cubic, sqrt, s (smoothstep). `js/midi/midi.js`
  `MIDI_CURVES` + `curvePos()`; exp eases-in (quad) on 0-based ranges instead of
  going linear. MIDI panel shows a curve reference line + labels each binding's
  curve. (commit e92e24f)
- **MIDI out** — new feature. Send notes to an external/virtual MIDI port from a
  player, phase-locked to the clock.
  - `js/midi/midiout.js` — engine: shares midi.js's MIDIAccess (`midiAccess()`
    export), `scheduleNote(note,vel,chan,whenMs,durMs)` uses `output.send(data,
    when)` with **performance.now() timestamps** (same domain as the clock →
    sub-beat accurate, immune to JS jitter). `allNotesOff(chans)` + `panicMidiOut()`
    (CC123/120 + output.clear()). `MidiOutCall` class (mirrors SynthCall) +
    `makeMidiOut()`. Output device selection (`selectMidiOut`, `midiOutState`).
  - `clock.js` `beatToPerfMs(beat)` — twin of beatToNTP in the perf-ms domain.
  - `player.js` — `_mode='midiout'`, `__rshift__` branch, `_fireMidiOut` (mirrors
    synth fire: degree→toMidi, group→chord, stutter/delay/transposition, vel=amp*
    127, note length=sus*leg). `stop()` sends all-notes-off on used channels;
    `panic()` calls panicMidiOut(). setAttr/_applyModifiers/every targets updated.
  - index.html: `midiout(deg, opts)` global + lazy `_ensureMidiOut()`; output-port
    `<select>` in the MIDI panel (`#cp-midi-out`), rendered in midipanel.js.
  - Idiom: `m1 >> midiout([0, (0,4,7), 5], channel=1, oct=4, dur=1, amp=0.9)`.
  - VERIFIED: unit-tested the full fire path with a fake MIDI port — single notes +
    chords (C-major 48/55/60), channel nibble, vel 102, note-off at exactly 1 beat,
    stop→CC123/120. Headless CDP boot = 0 console errors, midiout.js loads.
  - NEEDS REAL-PORT TEST: not yet driven into an actual DAW/hardware (this box has
    no virtual MIDI port set up). Route via ALSA/JACK virtual MIDI to confirm.
  - NOT DONE: MIDI clock out, program-change/CC out, note input (MIDI keyboard →
    play synths). Per-step value updates only (like midi()).
- VERSION → 'alpha21'; index.html tag → α21; changelog + docs + highlight updated.
- **Boot: match audio device sample rate** — SuperSonic forced the AudioContext to
  48 kHz; on Firefox, booting while another tab held the audio device at a
  different rate (e.g. a playing YouTube tab at 44.1 kHz) hung/crashed the browser.
  bootAudio() now probes the device rate (throwaway AudioContext → read sampleRate
  → close) and passes `audioContextOptions:{sampleRate:hw}` to match it. scsynth +
  synthdefs are rate-agnostic (clock is wall-clock; no 48k assumptions in app code),
  so this is safe. Added a 25s boot watchdog (Promise.race) that surfaces an
  actionable "close audio tabs and retry" error instead of a stuck "booting…".
  NOTE: a hard Firefox crash can't be caught in JS — the rate-match is the actual
  fix; the watchdog only covers hangs. Not yet confirmed on real Firefox+YouTube.
- loop() (the alpha20 feature that never reached origin/alpha20) is now listed in
  the alpha21 changelog + has its own examples section ('loop').
- **Sidebar UX** — every #crash-panel .cp-section is collapsible: `initFoldableSections()`
  in index.html adds `.cp-fold-h` to each section's header h3, toggles `.collapsed`
  on click, persists in localStorage (key `fold:<title>`). CSS hides non-header
  children when collapsed (`!important` to beat ID-level `#cp-midi-monitor` rules).
  Removed the curve-list line from the MIDI panel (kept per-binding curve label).

---

# Archived — alpha20 (shipped)

Branch: alpha20 (off alpha19). Rollback anchor: tag `alpha17-stable` @ 6a1c149.

## alpha20 — DONE so far
- **compkick synth** — industrial compressed kick ported from CrashServer
  (`synthdefs/src/synths/compkick.scd` → compiled `fd_compkick.scsyndef`). Registry
  entry + index.html SYNTHDEFS_TO_LOAD + foxdot_mode highlight. oct=3 ≈ 65Hz, oct=2 sub.
- **MIDI assignment (Web MIDI)** — new feature:
  - `js/midi/midi.js` — engine. A `midi(cc, lo, hi[, curve])` value is a `{get()}`
    object (same shape as a TimeVar) so the player's per-step `resolveArgs`/`patGet`
    samples it every beat → a knob sweeps any synth/FX param. `mlearn(lo,hi[,curve])`
    binds the next control touched. One CC can drive several params (macro). curve
    'exp' (geometric) for filter cutoffs. Keyed by CC number (channel-agnostic), CC
    messages only (0xB0). Lazy-enabled on first midi()/mlearn() (eval = user gesture).
  - `js/ui/midipanel.js` + `#cp-midi` section in index.html — enable button, live CC
    monitor (discover your controller's numbers), active bindings. CSS in style.css.
  - Globals `midi`/`mlearn` in index.html buildCtx; docs FUNCTIONS + changelog updated.
  - Idiom: `p1 >> compkick(); p1.lpf = midi(74, 100, 8000, 'exp')`.
  - Verified: headless CDP load = 0 console errors; mapping math unit-tested.
- **Ableton Link sync (follow-only)** — new feature:
  - Browsers can't speak Link (LAN UDP), so a Node Link peer bridges it:
    `server/link-bridge.js` (uses the `abletonlink` native addon — builds on
    Node 25, prebuilt) joins the Link session, relays `{bpm, beat, phase, peers,
    playing}` over a WebSocket on `config.json` port `link` (4445) at ~20Hz.
    Run: `cd server && npm run start-link`.
  - `js/sync/link.js` — browser client: connects (URL from config.json, like
    collab), auto-reconnects (2s), calls `clock.syncTo(msg)`.
  - `clock.js` `syncTo({bpm,phase,quantum})` — matches tempo, aligns bar phase:
    big error snaps (fast lock), small error nudged *0.08 (inaudible). Follow-only.
  - `js/ui/linkpanel.js` + `#cp-link` section — connect/disconnect toggle, shows
    peers · bpm · transport. Global `link(on)` in buildCtx. CSS in style.css.
  - VERIFIED end-to-end: a 2nd Link peer + WS client confirmed the bridge relays a
    live advancing session; headless browser clicked connect and showed real LAN
    peer "● 1 peer · 174.0 bpm" with 0 console errors. (There's a real Link peer on
    the dev LAN — sync works against actual Ableton/Link.)
  - DIRECTION: Ableton is master (we follow). Bidirectional/master-out not done.
    Transport start/stop is displayed but does NOT gate WebFoxDot's clock in v1
    (would disrupt section timing) — tempo + phase only.
  - NOTE: bridge is a separate process (native addon) — not started by serve.py.
    `abletonlink` teardown prints a harmless "terminate called" abort on exit.
- VERSION → 'alpha20'; index.html tag → α20; changelog entries added.
- KNOWN LIMITATION / next ideas: midi values update per-step (per beat), not
  sub-beat — fine for most params, steppy on slow pads. Could route FX-bound midi
  through a continuous n_set. Note-input (play synths from a MIDI keyboard) not done.
  `midi()*0.5` arithmetic not via Pmath (midi isn't a pattern token) — bind directly.

---

# Archived — alpha19 (shipped)

Branch: alpha19 (off alpha17). Working tree clean — everything below is committed.

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
   - `loop("break", dur=8, sample=2)` — DONE (alpha20). `fd_loop` synthdef
     (synthdefs/src/synths/loop.scd: PlayBuf(2) + beat_stretch BufDur/sus + Splay,
     fixed-len env w/ doneAction:2 so each step frees). `LoopCall` in sampler.js;
     player `_mode='loop'` + `_fireLoop`/`_triggerLoop` (mirror the sample path).
     Reuses the `_manifest`/`charToBufId` buffer store — `loadloop(name,url)` just
     calls loadSampleFromURL (multi-char loop names never collide with play chars).
     `loop`/`loadloop` globals; fd_loop in SYNTHDEFS_TO_LOAD; docs+highlight.
     Verified: headless boot + `b1 >> loop("a",dur=2)` → active loop:a, 0 errors.
     NOTE: fd_loop is stereo PlayBuf(2); a MONO loop buffer plays one-sided. If
     that bites, add an fd_loop1 (mono) and pick by buffer channel count.
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
