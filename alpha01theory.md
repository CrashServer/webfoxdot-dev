# WebFoxDot alpha01 — Language Design Theory

## Context

WebFoxDot ports FoxDot's live-coding model to the browser (scsynth via WASM), but also
enhances and rethinks parts of the design for internal coherence. This document captures
the design decisions and theories explored during alpha01.

---

## 1. The coherence problem with brackets

FoxDot has an inconsistency: `(0,4,7)` means **chord** in synth args (Python tuple), but
`(xo)` means **alternate** inside a play() string. Same bracket, opposite semantics.

WebFoxDot resolves this by making every bracket mean the same thing in **both** synth
degree arrays and play() pattern strings.

### Unified bracket semantics

| bracket | meaning | synth example | play() example |
|---------|---------|--------------|----------------|
| `(a b)` | **chord / simultaneous** — fire all at once | `(0 4 7)` | `(Xo)` |
| `[a b]` | **subdivide** — all values packed into one step duration | `[2 4]` nested in degree | `[Xo]` |
| `{a b}` | **random pick** — choose one each step | `{0 4 7}` | `{Xo}` |
| `<a b>` | **alternate / cycle** — step through on successive hits | `<0 4>` | `<Xo>` |

The outer sequence container differs by context:
- Synths: `[0, 3, 2]` — comma-separated degree array
- play(): `"X o X o"` — space-separated characters (space = rest)

`<>` is repurposed from FoxDot's layer/zip operation (rarely used live, replaced by two
players) to **alternate**, which aligns with TidalCycles `<bd sd>` semantics.

### FoxDot play() bracket reference (for comparison)

| bracket | FoxDot original meaning |
|---------|------------------------|
| `(xo)` | alternate — cycles on each loop |
| `[xo]` | subdivide (PGroupPlus) |
| `{xo}` | random pick (PRand) |
| `<xo>` | layer / zip patterns (complex, dropped) |
| `\|x2\|` | sample index selector (replaced by `sample=` kwarg) |

---

## 2. Three axes of variation

Parameters and sequences vary at three distinct timescales. Keeping these separate is
what makes the notation coherent.

### Axis 1 — Per-step shape (structural, instantaneous)

Governs **what fires** on each step. Works identically in synths and play().
Uses the bracket system above. No duration concept.

```python
p1 >> dbass([(0,4,7), 3, {0,5}, <0,4>])
#             chord   seq  rand  alt/cycle

b1 >> play("(Xo) h [Xo] {X-} <Xo>")
#          sim  seq sub  rand  alt
```

### Axis 2 — Per-n-beats motion (temporal evolution)

Governs **how a numeric value evolves over n beats**. Applies to params only (not to
sequence structure). Uses the `f*` function family — all share the signature `f*(n, a, b)`
where `n` is always the duration in beats.

| function | motion |
|----------|--------|
| `fi(n,a,b)` | fade in: a→b over n beats, once |
| `fo(n,a,b)` | fade out: b→a, once |
| `fb(n,a,b)` | bounce: a↔b looping every n beats |
| `fs(n,a,b)` | sine: smooth a↔b |
| `fe(n,a,b)` | exponential sweep |
| `fr(n,a,b)` | random walk within [a,b] over n steps |
| `fh(n,a,b)` | hold: step-switch every n beats (like `var`) |
| `fq(n,a,b)` | sine wave mapped to [a,b] |
| `fz(n,a,b)` | sawtooth mapped to [a,b] |
| `fw(n,a,b)` | walk: bounded brownian drift |
| `fd(n,a,b)` | drunk: slow brownian drift |
| `fn(n,a,b)` | like fi but starts from current beat (live use) |

`n` is always explicit because temporal evolution always needs a duration.

### Axis 2 shorthand operators

Per-step (stateless, no `n` needed) — sugar over Axis 1 bracket notation:

| operator | equivalent | meaning |
|----------|-----------|---------|
| `a?b` | `{a, b}` | random pick from discrete set |
| `a~b` | `fr(∞, a, b)` | continuous random in range (PWhite-style) |
| `a!b` | `<a, b>` | alternate between a and b |

These work in parameter positions:
```python
p1 >> dbass([0,3], cutoff=200?2000, amp=0.4!0.9)
```

For temporal evolution with a duration, use the `f*` family directly.

### Axis 3 — Parameter envelopes (sub-beat, note-triggered)

Marked by a **`_` suffix** on the parameter name. Same function syntax as Axis 2 — the
suffix changes the *evaluation contract*, not the function.

`_` means specifically: **apply this as an envelope on the parameter, triggered on each
note fire.** This is not an LFO. An envelope is by definition:
- Trigger-reset — restarts when the note fires
- Duration relative to the note's time context (beats from trigger)
- Typically one-shot or tied to note sustain

```python
lpf=400                         # static — sampled once at trigger
lpf=fi(8, 400, 2000)           # Axis 2 — steps toward 2000 over 8 beats (per-beat)
lpf_=fi(0.5, 400, 2000)       # Axis 3 — filter opens 400→2000 over 0.5 beats per note
lpf_=fo(1, 2000, 400)         # Axis 3 — filter closes 2000→400 over 1 beat per note
amp_=fi(0.25, 0, 0.9)         # Axis 3 — amplitude attack over 0.25 beats per note
```

Without `_`: the beat clock samples the value once at note-trigger time.  
With `_`: a sub-beat scheduler runs the envelope from trigger time, sending `n_set`
to the FX chain (or synth node) at ~60fps for the envelope's duration.

**No new functions needed.** `fi`/`fo` from the f* family already mean "one-shot, holds
at end value" — exactly envelope behaviour. `fb`/`sinvar` would loop within the note
sustain, giving a tremolo/filter-wobble effect per note.

**Free-running LFOs are a separate concept** — they live inside the SynthDef as UGen
graphs (Path A) or in persistent synth nodes (Path C). The `_` suffix does not cover
them. See section 3 for the distinction.

---

## 3. LFOs and dynamic parameter modulation

### The FoxDot limitation

FoxDot fires notes as discrete OSC events. Each note trigger sets parameters once — the
SC SynthDef's envelope runs and the node frees. There is no mechanism to continuously
modulate a parameter **within** a note's sustain. You cannot, for example, have a filter
cutoff sweep from 200→2000 Hz over the course of a held note unless the SynthDef itself
has a baked-in LFO.

This means:
- `cutoff=fb(8, 200, 2000)` updates cutoff **at each beat boundary**, but within a
  note the cutoff is frozen at whatever value it had when the note was triggered
- Smooth LFO-style modulation is not possible from the pattern layer
- The "envelope" of a parameter is decided at trigger time, not continuously

### What WebFoxDot can do differently

WebFoxDot has one major structural advantage over FoxDot: the **FX chain is a persistent
node** — one running SynthDef per player that lives as long as the player is active.
Currently FX params are updated once per beat. But there is no architectural obstacle to
updating them at **sub-beat resolution** (e.g. every 16ms from the JS clock tick).

This gives us a natural hook for continuous LFO-style modulation — at least on FX params.

### Three possible implementation paths

**Path A — Baked-in LFO UGens per SynthDef**

Add `lfo_rate`, `lfo_depth`, `lfo_target` (implied) to each SynthDef's SC code:
```supercollider
var lfo = SinOsc.kr(lfo_rate) * lfo_depth;
var filtered = RLPF.ar(sig, cutoff + lfo, rq);
```
- Pro: LFO runs inside SC, perfectly sample-accurate, zero JS overhead
- Con: Must be pre-defined per-synth; can only modulate the wired target
- Con: Rate, depth, shape are limited to what's compiled into the SynthDef

**Path B — JS sub-beat scheduler → n_set on persistent FX chain**

The JS clock already ticks at 10ms. Add a modulation layer that, for each active player
with LFO params, computes the current LFO value and sends `n_set` to the FX chain node:
```
Clock tick (10ms)
  → for each player with active LFOs
      → compute LFO value at current time
      → sc.send('/n_set', fxChainId, 'lpf_freq', value)
```
- Pro: Works without changing any SynthDef
- Pro: Any FX param can be LFO'd: reverb, lpf_freq, echo_time, etc.
- Con: Limited to FX chain params (not synth-internal params like fm ratio)
- Con: 10ms granularity — fine for audible LFOs (>0.1Hz), borderline for audio-rate

**Path C — Persistent synth nodes + n_set**

Change from "new node per note event" to "one persistent node per voice + n_set on each
beat for pitch/amp changes." The node lives for the player's lifetime.
- Pro: Full continuous control over all synth params
- Con: Major architectural change to player model (envelope handling, polyphony)
- Con: Envelope-per-note semantics become harder (must gate manually)
- Note: This is how traditional hardware synths and many DAW instruments work

### Parameter envelopes (`_`) vs free-running LFOs — a clean split

These are two different things and should not share notation:

| | `_` parameter envelope | free-running LFO |
|--|------------------------|-----------------|
| triggered by | each note fire | continuous, independent |
| phase | resets on each note | free-running wall-clock |
| duration | relative to note time | independent of notes |
| implemented via | JS sub-beat scheduler + n_set | SynthDef UGen (Path A) or persistent node (Path C) |
| notation | `lpf_=fi(0.5, 400, 2000)` | `lfo_rate=0.5, lfo_depth=300` (baked) |

**Parameter envelopes (`_` suffix):**

```python
# Filter envelope — opens over 0.5 beats then holds
p1 >> saw([0,3], lpf_=fi(0.5, 400, 4000))

# Amplitude attack + release shape (sub-beat, per note)
p1 >> saw([0,3], amp_=fi(0.1, 0, 0.9))

# Filter wobble tied to note (loops within sustain)
p1 >> saw([0,3], lpf_=fb(0.25, 400, 2000))
```

**Duration and capping:**

Duration in `_` expressions is in **absolute beats**, consistent with the rest of the
system. The envelope is **capped at `sus`** (the note's sounding length), not `dur`
(the rhythmic slot). On the next note trigger, the envelope **restarts from zero**.

```
dur=0.5, sus=0.5 (default)   fi(2, 400, 4000) → runs 0.5 beats, cut at sus
dur=0.5, sus=2               fi(2, 400, 4000) → runs full 2 beats
dur=0.5, sus=2               fi(0.5, 400, 4000) → runs 0.5 beats, holds 4000 for rest of sus
```

Rule of thumb: if you want the envelope to complete, set its duration ≤ `sus`.
For long sweeps that span multiple notes, use Axis 2 without `_`.

The `_` scheduler: on each note trigger, start evaluating the envelope expression
against beat-offset-from-trigger, sending `n_set` to the FX chain or synth node
at ~60fps until `sus` elapses or the envelope completes, whichever comes first.

**Free-running LFOs (SynthDef-baked, Path A):**

```python
# LFO baked into the SynthDef — rate and depth exposed as params
p1 >> saw([0,3], lfo_rate=0.5, lfo_depth=800)     # 0.5Hz sine on cutoff, always running
p1 >> saw([0,3], lfo_rate=fb(16, 0.1, 4))         # LFO rate that itself evolves
```

The LFO lives inside the SC UGen graph, running sample-accurately. Rate and depth
are regular Axis 1/2 params — they update per step or per n beats, but the LFO
*between* updates is SC-native.

### Where to start

| capability | path | effort |
|------------|------|--------|
| Parameter envelopes on FX params | B — `_` scheduler + n_set to FX chain | low |
| Parameter envelopes on synth-internal params | C — persistent nodes | high |
| Free-running LFOs on synth-internal params | A — baked UGen, expose `lfo_rate`/`lfo_depth` | medium |

---

## 4. Section sequencing — `#@` and `#@#@`

Inspired by webTroop's section system, adapted for browser-native execution.

### The problem it solves

A live set has structure: intro → verse → drop → chorus → end. Without sections,
you manage this entirely by hand — running blocks manually, remembering what to
stop. `#@` makes the structure explicit and automatable without removing manual
control.

### `#@` — Section headers

A section is a named block of code delimited by its `#@` line and the next `#@`
(or EOF). Running a section:
1. Cancels any pending auto-advance (`__sec_cancel()`)
2. Evaluates the section's code through the normal transpile pipeline
3. Optionally schedules an advance to the next section after N beats

```python
#@intro(16)
p1 >> dbass([0, -3, 0, 4], oct=3, amp=0.9)
b1 >> play(X.oX.o, amp=0.9)

#@verse(32)
p1 >> dbass([0, -3, 5, 4], oct=3, amp=0.9)
p2 >> pluck([0, 4, 7], oct=4, amp=0.6)
b1 >> play(X.oX.o, amp=0.9)
# b2 >> play(.h.h, amp=0.7)          ← commented = stop b2 on entry

#@chorus(16)
p1 >> dbass([0, 5, 3, 4], oct=3)
p3 >> fm([0, 7], oct=4, ratio=2)
# p2 >>                              ← commented = stop p2

#@end(8)
```

**Running `#@intro(16)`**: evaluates the block, then after 16 beats auto-fires
`#@verse`. The chain continues until a section has no beat count or hits `#@end`.

**Sections without a beat count** (`#@name`) play indefinitely — no auto-advance.
Useful for open sections you want to leave manually.

### Section types

| syntax | behaviour |
|--------|-----------|
| `#@name(beats)` | run block, advance to next section after N beats |
| `#@name` | run block, no auto-advance (open section) |
| `#@loop(beats, a:2, b:1)` | after beats, jump to `a` or `b` — weighted random |
| `#@end(beats)` | fade all players over N beats, then stop clock |
| `#@endfade(beats)` | smoother fade with FX cleanup |
| `#@clear` | immediate full stop (Clock.clear + all players) |

### Commented players = stop on entry

When entering a section, lines matching `# p1 >>` (commented-out player lines)
are automatically converted to `p1.stop()`. This means you describe a section by
what is **active** — players absent from the section just get commented out and
they stop cleanly.

```python
#@drop(16)
p1 >> dbass([0, -3], oct=3, amp=0.9)
b1 >> play(X.oX.o, amp=0.9)
# p2 >>           ← p2 was running — this becomes p2.stop()
# p3 >>           ← same for p3
```

This is the key ergonomic insight: write the section as its full state, comment
out what's not in it, and transitions are handled automatically.

### `#@#@` — Track groupings

`#@#@` is a higher-level header that groups related sections into a named track.
It has no execution semantics — it's purely organisational.

```python
#@#@ intro_track

#@intro(16)
p1 >> dbass([0, -3, 0, 4], oct=3)
b1 >> play(X.oX.o)

#@intro_build(8)
p2 >> pluck([0, 4, 7], oct=5)

#@#@ main_track

#@verse(32, chorus:2, bridge:1)
...

#@chorus(16)
...
```

**Fold behaviour**: `#@#@ track` folds the entire track (all `#@` sections until
the next `#@#@`). `#@section` folds just that one section. Both fold levels are
implemented in the editor's fold helper.

This gives a two-level document structure:
- **Track** (`#@#@`): a named passage in the set (intro, main, outro)
- **Section** (`#@`): a named state within a track, with timing

### `#@loop` — non-linear jumps

```python
#@loop(8, verse:3, chorus:1)
```

After 8 beats, jump to `verse` 75% of the time, `chorus` 25% of the time (weights
3:1). The decision is made fresh each loop, creating controlled variation.

Combined with open sections this lets you build non-linear set structures:
```python
#@#@ main_loop

#@groove(32, groove:4, fill:1)
p1 >> dbass([0, -3, 0, 4], oct=3)
b1 >> play(X.oX.o)

#@fill(8, groove:1)
b1 >> play(<X.oX.> [XoX] X.X., amp=0.9)
```

The groove runs 32 beats → 80% back to groove, 20% fill → fill runs 8 beats →
always back to groove. Stable loop with occasional variation.

### Implementation in WebFoxDot

The section system lives entirely in the browser — no server-side scheduling
needed (unlike webTroop where `_seq_schedule` called back to a Python process).

```
transpiler: #@ lines → section registry entries, not evaluated as code
__sec_run(name)   — find section, transpile+eval its code, schedule next if beats set
__sec_cancel()    — clear pending advance timeout
__sec_schedule(beats, fn) — use Clock._schedule for beat-accurate timing
```

In multiplayer: `#@section` execution is an eval broadcast event — all clients
transition simultaneously, beat-locked. Section state (which section is active)
lives in the relay server's room state so late-joining clients know where the set is.

---

## 5. Summary — the full language model

```
p1 >> saw([0, <0,4>, (0,7)], oct=4, cutoff=fb(8, 200, 2000), lpf_=sinvar([200, 4000], 2))
          └── Axis 1 ──────┘         └──── Axis 2 ──────────┘  └────────── Axis 3 ──────┘
              brackets                    f* / linvar                  same functions,
         (chord, sub, rand, alt)       (beat-level evolution)          _ suffix = continuous
```

- **Axis 1** (brackets `() [] {} <>`): structural shape of the sequence — same in synths and play()
- **Axis 2** (f* / linvar / sinvar / var): how a numeric param evolves beat-to-beat
- **Axis 3** (`_` suffix + same f* functions): continuous sub-beat modulation — free-running or trigger-reset
