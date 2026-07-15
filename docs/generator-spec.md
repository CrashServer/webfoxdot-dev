# Generative player — `son()` / `soff()` — design spec (alpha23)

Spec only (not yet implemented). Goal: a generative "jam bot" for crashDot, modelled
on CrashServer's `son()`/`soff()` but reimplemented natively in JS.

## How CrashServer's version works (reference)
Source: `FoxDot/lib/Crashserver/crash_generator/` (~1700 lines Python).
- `son(s=999, d=999, l=999)` starts the bot; `s/d/l` set synth/drum/loop add
  probabilities. `soff()` stops it.
- `runServer.start()` reschedules itself on the Clock (`Clock.future(duration, …)`),
  duration randomised (`time * randint(multDurationMin, multDurationMax)`).
- Each tick → `server_order()`: if <3 players → force `add_player`; if >maxPlayer →
  force `stop_player`; else **weighted-random** pick from:
  `add_player · stop_player · add_fx · change_degree · add_player_param ·
   add_player_attribute · add_event · change_synth_attr`.
- `add_player`: weighted pick synth/drum/loop; generate degrees/dur/oct + synth args
  from a Grammar (`Grammar.py`, `synthArgs.py`, `weapons.py`), then `eval` a
  `~pN >> synth(...).unison(2)` line (and broadcast the text to peers via `sendOut`).
- `stop_player`: stop random playing player(s), respecting per-player min/max "turns"
  (each player gets a turn counter so new ones aren't killed instantly).
- Config: `server_conf.py` holds all probabilities + min/max counts/turns.

## crashDot implementation plan
New module `js/engine/generator.js`; globals `son`/`soff` in index.html buildCtx.

### Pieces we already have
- `SYNTH_DEFS` (29 synths) + each def's `defaults`/`extraParams` → pick synth + sane args.
- `FX_REGISTRY` / `FX_EFFECTS` → pick an FX + value.
- Sample chars (the loaded pack manifest) → drum/loop players via `play("…")`.
- `clock._schedule(beat, fn, lead)` → self-rescheduling tick.
- `runCode(text, {fromRemote:false})` → emit + run generated lines (and it already
  broadcasts to peers in a session — so the bot's output is shared automatically).
- `clock._players` → live players to mutate/stop.

### API
- `son(opts={})` — start. opts: `{ synth, drum, loop }` add-weights (default e.g.
  0.5/0.3/0.2), `{ min:3, max:8 }` player bounds, `{ every:[2,6] }` beats between
  ticks (randomised in range), `{ prefix:'g' }` so generated players use names
  g1,g2… (kept separate from the user's p1/b1 so the bot never fights manual code).
- `soff()` — stop the tick loop. Leaves its players running (or `soff(true)` to also
  stop the `g*` players). Mirrors CrashServer (`soff` stops the loop, `shutup`-style
  helper to clear).

### Tick (`_order()`), weighted action set mapped to crashDot
- **addPlayer**: pick type by weight. synth → `gN >> <randSynth>(<randDegrees>, oct=,
  dur=, <1-2 random FX>)`; drum → `gN >> play("<rand pattern from pack chars>")`;
  loop → `gN >> loop("<rand loop name>", dur=)` (if loops registered). Reuse a free
  `g*` slot or a new one up to `max`.
- **stopPlayer**: stop a random `g*` player (respect a per-player age so fresh ones
  survive; only stop ones older than N ticks). If 0 generated players → addPlayer.
- **mutateParam**: set one param on a random `g*` player live (`gN.lpf = …`, degree
  shift, dur change) via `setAttr` / a generated `gN.attr = value` line.
- **addFx**: add/raise a random FX on a random `g*` player.
- Self-balance: `< min` → force addPlayer; `> max` → force stopPlayer (as CrashServer).

### Generators (keep simple; not the full Grammar)
- degrees: `PRange`/`P[…]` of small ints, or a random scale-walk; occasional chord
  groups `(0,4,7)`.
- dur: pick from `[1/4, 1/2, 1, 2]`; oct from `[3,4,5,6]` weighted by synth role.
- synth args: for the chosen synth, pick 0–2 of its `extraParams`/FX with values
  sampled within sane ranges (lifted from the defaults). Filter cutoffs via a
  `midi`/`linvar`-style sweep occasionally.

### Safety / fit with crashDot
- Namespacing (`g*`) so the bot never overwrites the user's players.
- Hard cap on generated players (`max`) and on `clock` event growth.
- Everything goes through `runCode`, so in a session the bot's lines broadcast to
  peers and show in the new split-view feed automatically.
- `son()` should warn + no-op until audio is booted.

### Open questions (decide before building)
1. Should the bot honour Ableton Link / the section sequencer, or run free?
2. Should generated lines be WRITTEN into the editor (visible, editable) or run
   "off-buffer" (cleaner, but invisible)? CrashServer ran off-buffer + logged.
3. Drum/loop generation needs the loaded pack's char set — read from the sample
   manifest at son() time.
4. In a session, should only ONE peer run the bot (to avoid N bots)? Probably yes —
   gate on a flag / first-come.

### Effort
Medium: ~200–300 lines for `generator.js` + globals + a tiny config. No synthdefs,
no recompile. The full CrashServer Grammar/weapons is optional polish later.
