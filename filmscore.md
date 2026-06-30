# filmscore — FoxDot set adapted to crashDot

Adaptation of `Téléchargements/code_20260628T093921506Z.py` (a 3-part live set:
`filmscore`, `machine`, `minutesaredays`). Each part is evaluated **live, line by
line** — there are no `#@part(N)` sub-sections, so the `#@#@` line is just a
foldable group label. Boot + load the kit first.

All player lines below have been verified to transpile + parse in the current
engine (alpha26).

---

## Part 1 — filmscore (cinematic, 60 bpm, C minor)

Zimmer/Williams-flavoured: piano ostinato, harp runs, brass theme, CS-80 chords,
choir climax.

```python
#@#@ filmscore
# cinematic score — 60 bpm, C minor
Clock.bpm = 60
Scale.default = "minor"
Root.default = "C"

oj >> piano([0,6,5,6], oct=3, dur=1, sus=0.88, amp=1, room=0.7, reverb=0.6)
pt >> piano([0,3,5,7,5,3,7,5], oct=5, dur=var([1,1,1,0.5,1,1,2,2],[1,1,1,1,1,1,1,2]), sus=var([0.8,0.8,0.8,0.4,0.8,0.8,1.5,1.5],[1,1,1,1,1,1,1,2]), amp=0.5, room=0.75, reverb=0.65, pan=sinvar([-0.2,0.2],16))
hp >> karp([0,3,5,7,5,3, 6,1,3,6,3,1, 5,0,3,5,3,0, 4,6,1,4,1,6], oct=6, dur=0.5, sus=PRand([0.4,0.6,0.8],6), amp=0.28, cheapverb=0.5, cvdecay=2, pan=sinvar([-0.4,0.4],6))
br >> brass([0,3,5,7,5,3,7,5, 0,3,5,7,9,7,5,3], oct=5, dur=var([1,0.5,0.5,1,0.5,0.5,1,2],[1,1,1,1,1,1,1,1]), sus=var([0.85,0.4,0.4,0.85,0.4,0.4,0.85,1.8],[1,1,1,1,1,1,1,1]), amp=sinvar([0.3,0.6],16), bright=0.75, room=0.6, reverb=0.5)
cx >> cs80([(0,3,5),(6,1,3),(5,0,3),(4,6,1)], oct=4, dur=4, sus=5, amp=sinvar([0.12,0.32],32), cutoff=sinvar([1000,3500],24), vibspeed=3.5, vibdepth=0.012, room=0.9, reverb=0.8)
ch >> choir([0,5,3,4], oct=4, dur=4, sus=sinvar([4,6],16), amp=sinvar([0,0.22],32), room=0.99, reverb=0.95, lpf=linvar([500,2000],64))

# climax — choir to chords, shimmer pad, bells, soft perc
ch >> choir([(0,3,5),(6,1,3),(5,0,3),(4,6,1)], oct=4, dur=4, sus=5.5, amp=sinvar([0.3,0.55],16), room=0.99, reverb=0.95, lpf=linvar([800,3000],32))
pt.stop()
oj.stop()
al >> pads([0,3,5,4], oct=6, dur=4, sus=6, amp=sinvar([0.05,0.22],16), room=0.99, reverb=0.95)
cl >> bell([7,9,12,7,5,3,7,9,12], oct=6, dur=PRand([0.5,1,2],9), sus=PRand([0.3,0.5,1],9), amp=sinvar([0.1,0.3],8), cheapverb=0.7, cvdecay=3)
pe >> play("..t...t.", dur=0.5, amp=sinvar([0.3,0.65],16), room=0.4, reverb=0.35)
```

### Substitutions (filmscore)

| Original | Used | Lost |
|---|---|---|
| `pianovel` | `piano` | velocity-curve nuance |
| `brass2` | `brass` | `growl`, `vibrate`/`vibdepth`, `tight` |
| `sinepad` | `pads` | `shimmer` |
| `bell2` | `bell` | (close) |
| `compperc` | `play("..t..")` | it's a sample, not the synth (`tone/body/noise/decay/drive`) |
| `mix=` | `reverb=` | FoxDot reverb = `room`(size)+`mix`(wet); crashDot = `room`+`reverb` |
| `swell` / `viola` / `gong` | dropped | were already commented in the source |

Clean 1:1: `karp`, `cs80` (incl. `vibspeed`/`vibdepth`/`cutoff`), `choir`
(`vox`/`cutoff`), `brass.bright`, `room`, `cheapverb`/`cvdecay`, `lpf`, and all
`var`/`sinvar`/`linvar`/`PRand` automation + chord groups.

---

## Part 2 — machine (industrial techno, 106 bpm, D minor)

Pounding multicrush bass, acid lead, gated drums, a pbuild industrial drop.

```python
#@#@ machine
# industrial techno — 106 bpm, D minor
Clock.bpm = 106
Scale.default = "minor"
Root.default = "D"

ba >> ebass([0,0,-5,0,-7,0,-5,-3], oct=4, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=0.85, hpf=120, lpf=sinvar([400,2000],16), multicrush=0.8, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000)
ag >> blip([7,5,0,7,5,7,0,5], oct=6, dur=0.5, sus=PRand([0.2,0.4,0.6],4), amp=sinvar([0.2,0.6],8), cutoff=sinvar([800,12000],4), rq=0.4, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02)
dk >> play("X...X.X.X...X...", dur=0.25, amp=var([1,0.9,1,0.88],4), fbdelay=0.4, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.1)
sn >> play("....o.......o...", dur=0.25, amp=0.85, sample=2, hpf=200)
cl >> play("..o.", dur=0.5, sample=5, amp=0.7, amplify=PEuclid(5,8), hpf=3500, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02)

# drop — pbuild industrial (gated) + an acid saw stab
~dk >> play(pbuild("industrial"), dur=0.25, amp=var([1,0.9,1,0.88],4), rgate=0.1, rgaterate=4, multicrush=4, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000)
wr >> ssaw([0,0,-5,-5,-7,-7,0,0], oct=5, dur=0.5, sus=0.4, amp=0.8, cutoff=sinvar([300,14000],8), rq=0.45, fbdelay=0.5, fbtime=0.25, fbfeed=0.85, fbcutoff=6000, fbspread=0.05).unison(3)
ba >> ebass([0,0,-5,0,-7,0,-5,-3], oct=5, dur=0.25, sus=var([0.3,0.2,0.35,0.25],[4,4,4,4]), amp=0.85, dist2=0.6, hpf=240, lpf=sinvar([400,2000],16))
```

### Substitutions (machine)

| Original | Used | Lost |
|---|---|---|
| `jbass` | `ebass` | `dynfuzz`/`dfgain`/`dftone` fuzz character |
| `war` | `ssaw` | `beef`, `vowel` formant |
| `angst` | `blip` | `rate`, `pitchShift` |
| `plaits` / `dbass` | kept (we have them) | — |
| `industrialsnare` | `play("....o..", sample=2)` | the synth |
| `a_gesa2` / `superbass` | dropped | no equivalent |

Clean 1:1: `multicrush` (+ `mc*` drives/freqs), `fbdelay` chain, `rgate`,
`dist2`, `hpf`/`lpf`, `cutoff`/`rq`, `.unison()`, `pbuild("industrial")`,
`PEuclid` accents.

---

## Part 3 — score (Coldplay "Yellow", 86 bpm, B major)

Clean nylon-guitar arpeggios, piano chords, emotional lead, strings swell.

```python
#@#@ score
# Yellow — 86 bpm, B major, clean arpeggios + emotional swell
Clock.bpm = 86
Scale.default = "major"
Root.default = "B"

gt >> pluck([0,2,4,2,0,2,4,2, 4,6,8,6,4,6,8,6, 5,7,9,7,5,7,9,7, 3,5,7,5,3,5,7,5], oct=5, dur=0.5, sus=0.45, amp=0.5, room=0.65, reverb=0.55, chorus=0.2, pan=sinvar([-0.15,0.15],16))
pd >> piano([(0,2,4),(4,6,8),(5,7,9),(3,5,7)], oct=4, dur=4, sus=3.6, amp=0.32, room=0.7, reverb=0.6)
ba >> bass([0,4,5,3], oct=4, dur=4, sus=3.5, amp=0.5, lpf=400, cutoff=350, rq=0.4).unison(3)
ml >> pluck([4,4,3,2,0,2,3,4,4,4,3,2,0], oct=6, dur=var([0.5,1],[8,5]), sus=PRand([0.5,0.7,1,1.5],5), amp=0.45, room=0.7, reverb=0.55, chorus=0.5, pan=0.1).unison(3)
sw >> pads([-7,-5,0,4], oct=4, dur=4, sus=4.5, attack=2, amp=sinvar([0.05,0.18],32), room=0.9, reverb=0.8)
vi >> pads([0,-2,3,2,0,-2], oct=4, dur=var([2,1,1,1,2,1],[4,2,2,2,4,2]), sus=var([1.8,0.8,0.8,0.8,1.8,0.8],[4,2,2,2,4,2]), amp=sinvar([0.15,0.35],16), room=0.9, reverb=0.8)
cx >> cs80([0,4,5,3], oct=4, dur=4, sus=4.5, amp=sinvar([0.1,0.28],32), cutoff=sinvar([1500,3500],32), vibspeed=4, vibdepth=0.015, room=0.9, reverb=0.8)
gt.only()   # isolate the guitar (intro); re-run the others to bring them back
```

### Substitutions (score)

| Original | Used | Lost |
|---|---|---|
| `nylon` | `pluck` | nylon-string body |
| `keys` | `pluck` | electric-piano timbre |
| `fbass` | `bass` | finger-bass character |
| `swell` | `pads` (slow attack) | bowed-string swell, `wide` |
| `viola` | `pads` | strings, `vibrato` |
| `mix=` | `reverb=` | (direct map) |

Clean 1:1: `piano`, `cs80` (incl. vib/cutoff), `chorus`, `room`, `lpf`/`cutoff`/
`rq`, `.unison()`, `.only()`, the `var`/`sinvar` automation + chord groups.

---

## Part 4 — Ghosts (120 bpm, C mixolydian)

Stuttered piano motif over a fast bass cascade. **Two synths/FX from this part are
now native ports** (no substitution needed):
- **`a_gesa`** synth — aggressive Gesaffelstein-style distorted sub-bass.
- **`djf`** FX — DJ isolator filter (one knob: `0.5` flat, `<0.5` lowpass sweep
  down, `>0.5` highpass sweep up).

```python
#@#@ Ghosts
# Ghosts — 120 bpm, C mixolydian (a_gesa + djf are native crashDot ports)
Clock.bpm = 120
Scale.default = "mixolydian"
Root.default = "C"

d1 >> piano(PStutter([1,4,5,6,5,6],[8,1,3,1,5,1]), dur=[1,1,1,1,1,1,3/4,1/2,3/4,1,1,1/4,3/4,1,1,1,3/4,1/2,3/4], oct=4)
d3 >> dbass([5,3,1,5,1,3,5,1,3,1,5,3,1,3,1,5,2,0,5,0,2,5,0,2,0,5,2,0,5,0,2,5,2,0,5,2,0,5,2,0,5,2,0,5,2,0,5,2,4,2,0,4,2,0,4,2,0,4,2,0,4,2,0,4], dur=1/4, oct=PStutter([6,5,6,7,6,5,6,5,6,7,6,5,6,5,6,5,6,5,6,5,6,5,6,5,6],[3,1,3,3,5,1,2,1,3,3,3,1,2,1,2,1,2,1,2,1,2,1,2,1,17]))
d2 >> dbass(PStutter([1,4,5,6,5,6],[8,1,3,1,5,1]), dur=1/4, oct=5, drive=0.1).unison(3)

# a_gesa (native) — Gesaffelstein bass + multicrush + a djf filter sweep
d4 >> a_gesa([5,3,1,5,1,3,5,1,3,1,5,3,1,3,1,5,2,0,5,0,2,5,0,2,0,5,2,0,5,0,2,5,2,0,5,2,0,5,2,0,5,2,0,5,2,0,5,2,4,2,0,4,2,0,4,2,0,4,2,0,4,2,0,4], dur=1/4, oct=PStutter([6,5,6,7,6,5,6,5,6,7,6,5,6,5,6,5,6,5,6,5,6,5,6,5,6],[3,1,3,3,5,1,2,1,3,3,3,1,2,1,2,1,2,1,2,1,2,1,2,1,17]), multicrush=0.5, mclowdrive=4, mcmiddrive=2, mchighdrive=1.8, mclofreq=2000, mchifreq=3000, djf=sinvar([0.3,0.7],16))
d5 >> a_gesa(PStutter([1,4,5,6,5,6],[8,1,3,1,5,1]), dur=[1,1,1,1,1,1,3/4,1/2,3/4,1,1,1/4,3/4,1,1,1,3/4,1/2,3/4], oct=7, distortion=12)
~g6 >> ebass(PStutter([1,4,5,6,5,6],[8,1,3,1,5,1]), dur=[1,1,1,1,1,1,3/4,1/2,3/4,1,1,1/4,3/4,1,1,1,3/4,1/2,3/4], oct=5).unison(3)
```

### Substitutions (Ghosts)

| Original | Used | Note |
|---|---|---|
| `a_gesa` | **`a_gesa`** | ✅ ported native this round |
| `djf` (implied dirt) | **`djf`** | ✅ ported native this round (DJ filter) |
| `pianovel` | `piano` | velocity nuance |
| `bbass` | `dbass` | different bass voicing |
| `a_xbass` | `ebass` | — |

Clean 1:1: `PStutter`, `multicrush` (+ `mc*`), `drive`, `dbass`, `.unison()`,
mixolydian scale, list-of-durs.

---

## Part 5 — Pump (126 bpm, phrygian)

French-electro pumping techno. **Three more native ports this round** — it runs
essentially verbatim:
- **`pumpbass`** — pumping filter bass (crashDot original; FoxDot had no source).
- **`a_daft`** — Daft Punk-style punchy filter bass.
- **`a_hhat`** — French-electro metallic hi-hat (pitchless).

```python
#@#@ pump
# Pump — 126 bpm, phrygian. pumpbass / a_daft / a_hhat are native crashDot synths.
Scale.default = "phrygian"
Root.default = 0
Clock.bpm = 126

~t2 >> pumpbass([0, 5, 0, 3, 0, 4, 0, 3], dur=1/2, sus=0.2, oct=5, amp=1.0, cutoff=linvar([400,3000],4), dist2=1, dist2shape=1, fuzz=0.0, noiz=0, noizr=0, noizt=0.9, fuzzgain=0.0, hpr=0.8, hpf=180, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02, beat_dur=1, rgate=0.5, rgaterate=4, rgatewave=0).unison(3)
k1 >> compkick(punch=1, comp=10, release=0.4, oct=4, click=8, drive=0.2, sub=1, body=15, fbdelay=0.5, fbtime=0.25, fbfeed=0.7, fbcutoff=3000, fbspread=0.02, beat_dur=1, tone=0.15, dur=1, multicrush=0.2, mclowdrive=1.5, mcmiddrive=2, mchighdrive=1.8, mclofreq=200, mchifreq=3000)

h1 >> a_hhat(0, dur=1/2, amp=Pacc("offbeat")*1.1, beat_dur=0.5, decay=0.04, hpf=9000)
t1 >> a_daft([0, rest(0), 1, 0, rest(0), 1, rest(0), 0], dur=4, sus=4, oct=5, amp=1.1, cutoff=linvar([600,3600],4), resonance=0.95, punch=2.5, dist2=0.5, dist2shape=0.6, hpf=200).unison(2)
h1 >> a_hhat(0, dur=1/2, amp=Pacc("offbeat")*1.3, beat_dur=0.5, decay=0.04, hpf=9000)
```

### Notes (Pump)

- `pumpbass`, `a_daft`, `a_hhat` are now **native** — no substitution.
- `pumpbass` is a crashDot original (no FoxDot source existed); it accepts all the
  used params (`cutoff/res/sub/body/growl/fuzz/fuzzgain/noiz/noizr/noizt/hpr/pump`)
  plus the chain FX (`dist2`, `rgate`, `fbdelay`, `hpf`).
- `a_daft`'s `fuzz`/`fuzzgain` aren't synth params (its source has only
  `cutoff/resonance/punch`); the bite comes from the `dist2` chain FX instead.
- `a_hhat` is pitchless — `decay`/`tone`/`metallic`/`open` shape it; `atk`/`rel`
  from the original are dropped (it has a fixed fast attack).

---

## Part 6 — ambient (68 bpm, D dorian) — from codeBank

A slow ambient drift (`codeBank/ambient.py`, "twoheadedstate"): layered evolving
pad chords, sparse bells, a low gong, deep sub. Long random durs (`PWhite`) keep
it from ever repeating. Evaluate the lines and let them breathe.

```python
#@#@ ambient
# twoheadedstate — 68 bpm, D dorian, ambient pads / bells / gong
Clock.bpm = 68
Scale.default = "dorian"
Root.default = "D"

m1 >> pads([(0,2,4),(0,4,7),(0,2,7),(0,3,6)], dur=PWhite(16,40), sus=PWhite(20,48), oct=5, amp=0.8, cutoff=linvar([800,3200],120), cheapverb=0.7, cvdecay=3, hpf=220)
r1 >> bell(PRand([0,4,7,11,2,9]), dur=PWhite(6,20), sus=PWhite(4,12), oct=5, amp=0.4, cheapverb=0.75, cvdecay=4, hpf=600, pan=PRand([-0.75,-0.35,0.35,0.75]))
g1 >> bell(PRand([0,4,7,11]), dur=PWhite(18,48), sus=PWhite(12,30), oct=4, amp=0.2, cheapverb=0.8, cvdecay=5, hpf=300, pan=PRand([-0.6,0.6]))
m3 >> pads([(0,2,4),(0,4,7),(0,2,7),(0,3,6)], dur=PWhite(16,40), sus=PWhite(20,48), oct=5, amp=0.35, cutoff=linvar([800,3200],120), cheapverb=0.7, cvdecay=3, hpf=220)
m2 >> pads([(0,1,4),(0,3,6),(0,1,7),(-1,2,5)], dur=PWhite(16,40), sus=PWhite(20,48), oct=5, amp=0.42, cutoff=linvar([600,2400],96), cheapverb=0.8, cvdecay=3.5, hpf=240)
b1 >> dbass([0,0,0,4,0,0,-3,0], dur=PWhite(6,16), sus=PWhite(8,24), oct=4, amp=1.3, lpf=260, hpf=35, pan=0)
```

### Substitutions (ambient)

| Original | Used | Lost |
|---|---|---|
| `pad2` | `pads` | `jpverb`/`jpsize`/`jpdamp` (JPverb), `stereowidth` |
| `gong` | `bell` (low, long) | the gong body |
| `subbass` | `dbass` | `tape`/`tapedrive`, `lpr` |

Clean 1:1: `bell`, `cheapverb`/`cvdecay`, `cutoff`/`lpf`/`hpf`, `pan`, chord
groups, `PWhite`/`PRand`/`linvar` automation.

---

## Part 7 — minutesaredays (skipped)

This part is **one synth, `faim`, all the way through**, driven by bespoke params:
`vadiod*` (a diode-ladder filter), `tape*` (tape saturation/wobble), `tube*`
(tube drive), `subenh`/`subhfreq`/`subhgain` (sub enhancer), `resonbank`/`rb*`
(resonator bank), `shape`. We have `faim` but **not** those FX, so an honest
adaptation would lose the whole sound-design point of the part. Better to port the
FX than to gut it.

---

## What to build for faithful versions

**Synths:** `pianovel`, `brass2` (growl/vibrate/tight), `sinepad` (shimmer),
`bell2`, `compperc`, `industrialsnare`, `war`, `angst`, `jbass`, `a_gesa2`,
`superbass`, and orchestral `swell`/`viola`/`gong`.

**FX / params:** `dynfuzz`+`dfgain`+`dftone` (dynamic fuzz), `pitchShift`,
`shimmer`, `growl`, `vowel` formant on more synths, and the `faim` sound-design
stack — `vadiod*`, `tape*`, `tube*`, `subenh*`, `resonbank`/`rb*`, `shape`.

Nothing above blocks Parts 1 & 2 — they play as written.
