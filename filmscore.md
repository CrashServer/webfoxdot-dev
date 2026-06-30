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

## Part 3 — minutesaredays (skipped)

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
