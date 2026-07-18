# Example tracks — recognizable themes

Well-known melodies transcribed for **webfoxDot / crashDot**, each fleshed out into a small
arrangement — the tune plus a bassline, some harmony and a beat. Paste a block into the editor
and run it line by line with Ctrl+Enter (every statement is on its own line). Load the sample
kit first if you want the drums to sound. Rhythms are close approximations — nudge the `dur`
lists, `oct` and `amp` to taste.

Film / game themes use `Scale.default = "chromatic"` so the degrees are literal **semitones
from the root** (0 = root, 7 = a fifth up, −5 = a fourth down); the diatonic tunes use a named
scale so the degrees are ordinary scale steps. `_` in a degree list is a rest.

---

## Star Wars — Main Title (fanfare)

```
Clock.bpm = 108
Root.default = "C"
Scale.default = "chromatic"
sw >> brass([-5, -5, -5, 0, 7, 5, 4, 2, 12, 7, 5, 4, 2, 12, 7, 5, 4, 5, 2], dur=[1/2, 1/2, 1/2, 2, 1, 1/3, 1/3, 1/3, 2, 1, 1/3, 1/3, 1/3, 2, 1, 1/3, 1/3, 1/3, 2], oct=5, sus=1, amp=0.45, room=0.5, reverb=0.4)
sb >> dbass([0, 0, -5, 0], oct=3, dur=4, amp=0.5, lpf=900)
sp >> pads((0, 4, 7), oct=4, dur=8, sus=8, amp=0.16, cutoff=linvar([900, 2000], [16]), reverb=0.6, room=0.9)
sd >> play("x..x.x..", dur=1/2, amp=0.4, lpf=1400).sometimes("stutter", 4)
```

## Star Wars — The Imperial March (Darth Vader)

```
Clock.bpm = 104
Root.default = "G"
Scale.default = "chromatic"
im >> brass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=5, sus=1, amp=0.45, dist=2, room=0.4)
bs >> dbass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=3, amp=0.5, lpf=1100)
ch >> war((0, 3, 7), oct=4, dur=1, sus=0.25, amp=0.28, dist=1, lpf=sinvar([800, 2400], [8]))
sd >> play("x", dur=1, amp=0.6)
sn >> play("..o...o.", dur=1/2, amp=0.4).sometimes("stutter", 4)
```

## Seven Nation Army — The White Stripes

```
Clock.bpm = 124
Root.default = "E"
Scale.default = "chromatic"
sna >> fuzz([0, 0, 3, 0, -2, -4], dur=[3/2, 1/2, 1, 1, 1, 2], oct=4, amp=0.5, dist=6, lpf=2500)
snb >> fuzz([0, 0, 3, 0, -2, -4], dur=[3/2, 1/2, 1, 1, 1, 2], oct=5, amp=0.28, dist=7, lpf=4000)
d1 >> play("x", dur=1, amp=0.8)
d2 >> play(".o", dur=1, amp=0.6)
```

## Tetris — Korobeiniki (A theme)

```
Clock.bpm = 140
Root.default = "A"
Scale.default = "minor"
tet >> blip([4, 1, 2, 3, 2, 1, 0, 0, 2, 4, 3, 2, 1, 1, 2, 3, 4, 2, 0, 0], dur=[1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1, 1, 1, 1], oct=5, sus=0.3, amp=0.4)
ch >> pluck([(0, 2, 4), (0, 2, 4), (4, 6, 8), (4, 6, 8)], oct=4, dur=2, sus=0.4, amp=0.2, cutoff=sinvar([1200, 3000], [16]))
bs >> dbass([0, 0, 4, 4], oct=3, dur=2, amp=0.45, lpf=1000)
d1 >> play("x-o-", dur=1/2, amp=0.5).sometimes("stutter", 3)
```

## Super Mario Bros — overworld (Koji Kondo)

```
Clock.bpm = 100
Root.default = "C"
Scale.default = "chromatic"
mar >> blip([4, 4, _, 4, _, 0, 4, _, 7, _, _, -5], dur=1/2, oct=5, sus=0.25, amp=0.4)
bss >> dbass([0, 0, -5, -5, 3, 3, -5, -5], oct=3, dur=1/2, amp=0.4, lpf=900)
ch >> pluck([(0, 4, 7), _, (0, 4, 7), _], oct=4, dur=1/2, sus=0.3, amp=0.18)
d1 >> play("x-o-", dur=1/2, amp=0.45)
```

## Game of Thrones — main title

```
Clock.bpm = 150
Root.default = "C"
Scale.default = "minor"
got >> prophet([-3, 0, 2, 3, -3, 0, 2, 3, -3, 0, 2, 3, 2, 0], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 2, 2], oct=4, sus=1, amp=0.4, lpf=3000, room=0.5, reverb=0.4)
hi >> saw([-3, 0, 2, 3, -3, 0, 2, 3, 4, 5, 4, 3, 2, 0], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 2, 2], oct=5, sus=1, amp=0.18, lpf=linvar([1800, 4000], [16]), reverb=0.4).unison(2)
bs >> dbass([0, 0, -3, -5], oct=2, dur=4, amp=0.5, lpf=700)
d1 >> play("x...x...", dur=1/2, amp=0.6)
```

## Ode to Joy — Beethoven

```
Clock.bpm = 120
Root.default = "C"
Scale.default = "major"
ode >> rhodes([2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1, 2, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 1, 0, 0], dur=[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3/2, 1/2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3/2, 1/2], oct=5, sus=0.6, amp=0.4, room=0.4)
ch >> pads([(0, 2, 4), (4, 6, 8), (0, 2, 4), (4, 6, 1)], oct=4, dur=4, sus=4, amp=0.16, cutoff=linvar([1000, 2400], [16]), reverb=0.4)
bs >> dbass([0, 4, 0, 4], oct=3, dur=4, amp=0.45, lpf=800)
```

## Pop — the four-chord song (I–V–vi–IV)

```
Clock.bpm = 118
Root.default = "C"
Scale.default = "major"
ch >> pads(PProg("pop"), oct=4, dur=4, sus=4, amp=0.28, cutoff=1600, reverb=0.4, room=0.7, chorus=0.3)
bs >> dbass([0, 4, 5, 3], oct=3, dur=4, amp=0.5, lpf=800)
ar >> pluck([0, 2, 4, 2, 4, 6, 5, 3], oct=5, dur=1/2, sus=0.25, amp=0.2, room=0.3)
me >> bell([4, 2, 4, 7, 4, 2, 1, 0], dur=[1, 1, 1, 1, 1/2, 1/2, 1, 1], oct=5, sus=0.4, amp=0.28, room=0.5)
d1 >> play("x-o-", dur=1/2, amp=0.5)
```

---

# Classic rock · pop · electronic

## Smoke on the Water — Deep Purple

```
Clock.bpm = 112
Root.default = "G"
Scale.default = "chromatic"
sotw >> fuzz([0, 3, 5, 0, 3, 6, 5, 0, 3, 5, 3, 0], dur=[1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2], oct=4, amp=0.5, dist=5, lpf=2600)
bs >> dbass([0, 3, 5, 0, 3, 6, 5, 0, 3, 5, 3, 0], dur=[1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2], oct=2, amp=0.4, lpf=800)
og >> organ((0, 3, 7), oct=4, dur=4, sus=4, amp=0.14, cutoff=sinvar([1200, 2600], [16]), room=0.3)
d1 >> play("x-o-", dur=1/2, amp=0.6).sometimes("stutter", 4)
```

## Another One Bites the Dust — Queen

```
Clock.bpm = 110
Root.default = "E"
Scale.default = "chromatic"
aobtd >> dbass([0, _, 0, 0, _, _, 3, 0], dur=1/2, oct=2, amp=0.6, lpf=900)
d1 >> play("x..x..o.", dur=1/2, amp=0.7)
h1 >> play("-", dur=1/2, amp=0.25, hpf=7000)
gt >> fuzz((0, 3, 7), oct=4, dur=4, sus=0.2, amp=0.14, dist=3)
```

## Billie Jean — Michael Jackson

```
Clock.bpm = 117
Root.default = "F#"
Scale.default = "minor"
bj >> dbass([0, -3, -2, -1, 0, -1, -2, -3], dur=1/2, oct=3, amp=0.55, lpf=1100)
d1 >> play("x", dur=1, amp=0.7)
s1 >> play(".o", dur=1, amp=0.6)
h1 >> play("-", dur=1/2, amp=0.3, hpf=7000)
ch >> pads((0, 2, 4), oct=4, dur=4, sus=4, amp=0.15, cutoff=1500, reverb=0.3)
```

## Take On Me — a-ha

```
Clock.bpm = 168
Root.default = "A"
Scale.default = "major"
toms >> pulse([5, 5, 3, 1, 1, 4, 4, 4, 6, 6, 7, 8, 7, 7, 7, 4, 3, 5, 5, 5, 4, 4, 5, 4], dur=1/2, oct=5, sus=0.3, amp=0.4, room=0.4, reverb=0.3)
bs >> dbass([0, 4, 5, 3], oct=3, dur=4, amp=0.45, lpf=1000)
ch >> pads([(0, 2, 4), (4, 6, 8), (5, 7, 9), (3, 5, 7)], oct=4, dur=4, sus=4, amp=0.15, cutoff=1600, chorus=0.3)
d1 >> play("x-o-", dur=1/2, amp=0.5)
```

## Axel F — Beverly Hills Cop (Harold Faltermeyer)

```
Clock.bpm = 118
Root.default = "F"
Scale.default = "chromatic"
axel >> blip([0, 3, 0, 0, 5, 0, -2, 0, 0, 7, 0, 0, 8, 7, 3, 0], dur=[1, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1], oct=5, sus=0.3, amp=0.4, room=0.4)
bs >> dbass([0, 0, 0, 3, 0, 0, -2, 0], oct=3, dur=1, amp=0.45, lpf=1000)
st >> pluck((0, 3, 7), oct=4, dur=2, sus=0.3, amp=0.18)
d1 >> play("x-o-", dur=1/2, amp=0.55)
```

---

# More — electronic · pop · rock · metal · punk · movies

*(These lean on webfoxDot's richer features — `linvar`/`sinvar` filter sweeps, `PDur` rhythms,
`.every`/`.sometimes`/`.unison` transforms and chord voicings — so they evolve as they loop.)*

## Popcorn — Gershon Kingsley (classic electronic)

```
Clock.bpm = 130
Root.default = "A"
Scale.default = "minor"
pop >> pulse([0, -1, 0, -3, -5, -7, -3, 0, -1, 0, -3, -5, -7, -3, 0, 1, 2, 1, 2, 1, 2, 0], dur=[1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1], oct=5, sus=0.12, amp=0.4, cutoff=linvar([1200, 5000], [16]), lpr=0.3)
bs >> dbass([0, 0, 4, 4], oct=3, dur=PDur(3, 8), amp=0.4, lpf=800)
ar >> pluck([0, 2, 4], oct=6, dur=1/4, sus=0.1, amp=0.14, pan=sinvar([-0.6, 0.6], [8]))
d1 >> play("x-o-", dur=1/2, amp=0.5).sometimes("stutter", 2)
```

## Sweet Dreams — Eurythmics (synth-pop)

```
Clock.bpm = 126
Root.default = "C"
Scale.default = "minor"
sd >> sine([4, 4, 4, 4, 2, 0, 3, 3, 3, 2, 1, 0], dur=[1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2], oct=5, sus=0.4, amp=0.35, cutoff=sinvar([800, 3000], [16]), room=0.4)
bs >> dbass([0, 0, 5, 5, 3, 3, 4, 4], oct=3, dur=1/2, amp=0.5, lpf=linvar([500, 1600], [8]))
ar >> pluck(var([0, 2, 4], [4]), oct=5, dur=1/4, sus=0.2, amp=0.16).every(8, "reverse")
d1 >> play("x-o-", dur=1/2, amp=0.5)
```

## Africa — Toto (pop)

```
Clock.bpm = 92
Root.default = "A"
Scale.default = "major"
af >> pluck([0, 2, 2, 4, 2, 1, 0, 2], dur=[1/2, 1/2, 1, 1, 1/2, 1/2, 1, 1], oct=5, sus=0.3, amp=0.3, room=0.4).unison(2)
ch >> pads([(0, 2, 4), (5, 7, 9), (3, 5, 7), (4, 6, 8)], oct=4, dur=4, sus=4, amp=0.16, cutoff=linvar([1200, 2400], [16]), chorus=0.3, reverb=0.3)
bs >> dbass([0, 5, 3, 4], oct=3, dur=4, amp=0.45, lpf=900)
d1 >> play("x-o-", dur=1/2, amp=0.45)
```

## Come As You Are — Nirvana (rock)

```
Clock.bpm = 120
Root.default = "E"
Scale.default = "chromatic"
caya >> fuzz([0, 0, 0, 2, 3, 2, 0, -2, 0], dur=[1, 1, 1/2, 1/2, 1/2, 1/2, 1, 1, 2], oct=4, amp=0.45, dist=4, lpf=sinvar([1400, 3200], [8]), chorus=0.5)
bs >> dbass([0, 0, 0, 2, 3, 2, 0, -2, 0], dur=[1, 1, 1/2, 1/2, 1/2, 1/2, 1, 1, 2], oct=2, amp=0.4, lpf=700)
d1 >> play("x-o-", dur=1/2, amp=0.5).sometimes("stutter", 2)
```

## Sweet Child O' Mine — Guns N' Roses (rock)

```
Clock.bpm = 125
Root.default = "D"
Scale.default = "chromatic"
scom >> guitar([0, 12, 7, 5, 7, 12, 7, 5], dur=1/4, oct=4, sus=0.2, amp=0.35, lpf=linvar([2000, 5000], [16]))
bs >> dbass([0, 0, 0, 0, -2, -2, 5, 5], oct=3, dur=1/2, amp=0.4, lpf=900)
ch >> pads((0, 4, 7), oct=4, dur=8, sus=8, amp=0.12, cutoff=1500, reverb=0.3)
d1 >> play("x-o-", dur=1/2, amp=0.45)
```

## Enter Sandman — Metallica (metal)

```
Clock.bpm = 123
Root.default = "E"
Scale.default = "chromatic"
es >> war([0, 0, 0, 3, 0, 0, 5, 6, 5], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1], oct=3, amp=0.5, dist=3, lpf=linvar([1200, 4000], [8]))
bs >> dbass([0, 0, 0, 3, 0, 0, 5, 6, 5], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1], oct=2, amp=0.45, lpf=700)
d1 >> play("x", dur=1, amp=0.7)
d2 >> play("..o...o.", dur=1/2, amp=0.5)
h1 >> play("-", dur=1/2, amp=0.2, hpf=8000)
```

## Blitzkrieg Bop — Ramones (punk)

```
Clock.bpm = 180
Root.default = "A"
Scale.default = "chromatic"
bb >> war([0, 0, 0, 0, 5, 5, 5, 5, 7, 7, 7, 7, 5, 5, 5, 5], dur=1/4, oct=4, sus=0.2, amp=0.45, dist=4, lpf=3000)
bs >> dbass([0, 0, 5, 5, 7, 7, 5, 5], oct=3, dur=1/2, amp=0.45, lpf=1000)
d1 >> play("x-o-", dur=1/4, amp=0.6).sometimes("stutter", 3)
```

## Harry Potter — Hedwig's Theme (movie)

```
Clock.bpm = 96
Root.default = "E"
Scale.default = "chromatic"
hp >> bell([-5, 0, 3, 2, 0, 7, 5, 2, 0, 3, 2, -1, 1], dur=[3/2, 1, 1/2, 1, 1/2, 3, 3/2, 1, 3/2, 1, 1/2, 1, 3/2], oct=5, sus=0.5, amp=0.4, room=0.6, reverb=0.4)
ch >> pads([(0, 3, 7), (0, 3, 7), (0, 3, 8)], oct=3, dur=6, sus=6, amp=0.14, cutoff=1400, reverb=0.5)
bs >> dbass([0, -2, 0], oct=2, dur=6, amp=0.4, lpf=700)
```

## He's a Pirate — Pirates of the Caribbean (movie)

```
Clock.bpm = 140
Root.default = "D"
Scale.default = "minor"
hap >> saw([0, 0, 0, 1, 2, 2, 2, 2, 3, 4, 4, 4, 4, 5, 4, 3, 2], dur=[1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2], oct=5, sus=0.3, amp=0.32, lpf=linvar([1800, 4500], [8]), room=0.3).unison(3)
bs >> dbass([0, 0, 3, 3, 4, 4, 0, 0], oct=2, dur=1/2, amp=0.45, lpf=900)
ch >> pads([(0, 3, 7), (5, 0, 3), (2, 5, 0), (4, 6, 3)], oct=4, dur=2, sus=2, amp=0.15, cutoff=1600)
d1 >> play("x.x.o.x.", dur=1/2, amp=0.55)
```

## The Final Countdown — Europe (synth rock)

```
Clock.bpm = 118
Root.default = "F#"
Scale.default = "minor"
tfc >> saw([4, 5, 4, 3, 4, 3, 4, 2, 3, 2, 1, 2], dur=[1/2, 1/2, 1, 1, 2, 1/2, 1/2, 1, 1, 1/2, 1/2, 2], oct=5, sus=0.4, amp=0.35, lpf=linvar([2000, 5000], [16]), room=0.4).unison(3)
ch >> pads([(3, 5, 0), (4, 6, 1), (0, 2, 4), (2, 4, 6)], oct=4, dur=4, sus=4, amp=0.15, cutoff=1800, chorus=0.3)
bs >> dbass([3, 4, 0, 2], oct=3, dur=4, amp=0.45, lpf=1000)
d1 >> play("x-o-", dur=1/2, amp=0.5)
```

---

# Genre grooves — a base library

Reusable starting points rather than specific songs: drop one in, then swap the degrees, synth
or FX. They lean on the generative helpers (`PDur`, `PChord`, `var`, `linvar`/`sinvar`,
`.offbeat`/`.every`/`.sometimes`) so they breathe on their own.

## House (4-on-the-floor)

```
Clock.bpm = 125
Root.default = "A"
Scale.default = "minor"
k1 >> play("x", dur=1, amp=0.9)
h1 >> play(" -", dur=1/2, amp=0.3, hpf=7000)
cp >> play(".o", dur=1, amp=0.5)
bs >> dbass([0, 0, 0, 0, 5, 5, 3, 3], oct=3, dur=1/2, amp=0.5, lpf=linvar([700, 2500], [8]))
st >> pluck((0, 2, 4), oct=5, dur=1/2, sus=0.2, amp=0.22, room=0.3).every(4, "reverse")
pd >> pads((0, 2, 4), oct=4, dur=8, sus=8, amp=0.12, cutoff=sinvar([800, 2000], [16]))
```

## Techno (driving, acid)

```
Clock.bpm = 132
Root.default = "E"
Scale.default = "minor"
k1 >> play("x", dur=1, amp=0.95)
h1 >> play("-", dur=1/2, amp=0.3, hpf=8000)
ac >> acidline([0, 0, 3, 0, 5, 0, 3, 0], oct=4, dur=1/4, cutoff=expvar([300, 4000], 8), accent=P[0, 0, 1, 0], beef=3, amp=0.5)
bs >> dbass([0], oct=2, dur=1, amp=0.5, lpf=600)
st >> tekno([0, 7], oct=5, dur=PDur(3, 8), grit=0.5, wfold=sinvar([0, 0.5], [16]), amp=0.3, crush=0.3)
```

## Drum & Bass

```
Clock.bpm = 174
Root.default = "D"
Scale.default = "minor"
br >> play("x-o-x-xo", dur=1/2, amp=0.6).sometimes("stutter", 3)
sub >> dbass([0, 0, 0, 5], oct=2, dur=2, sus=2, amp=0.6, lpf=500)
pd >> pads((0, 2, 4), oct=4, dur=8, sus=8, amp=0.14, cutoff=linvar([600, 2000], [16]), reverb=0.4)
st >> blip([0, 3, 5, 7], oct=5, dur=PDur(5, 8), sus=0.2, amp=0.18, pan=PWhite(-0.6, 0.6))
```

## Dub / Reggae (one-drop + skank)

```
Clock.bpm = 140
Root.default = "A"
Scale.default = "minor"
k1 >> play("..x.", dur=1, amp=0.8)
sk >> organ((0, 2, 4), oct=4, dur=1, sus=0.2, amp=0.25, echo=0.4, echo_time=0.375).offbeat()
bs >> dbass([0, 0, 3, 0, 4, 0, 3, 0], oct=2, dur=1/2, amp=0.55, lpf=700)
h1 >> play("-", dur=1/2, amp=0.2, hpf=6000)
```

## Funk (syncopated)

```
Clock.bpm = 106
Root.default = "E"
Scale.default = "minor"
bs >> dbass([0, 0, 3, 0, 0, -2, 0, 3], oct=2, dur=1/4, amp=0.55, lpf=linvar([600, 2200], [8])).sometimes("stutter", 2)
gt >> pluck((0, 3, 5), oct=5, dur=1/4, sus=0.1, amp=0.2).sometimes("stutter", 4)
k1 >> play("x..x..x.", dur=1/2, amp=0.7)
s1 >> play("..o...o.", dur=1/2, amp=0.5)
h1 >> play("-", dur=1/4, amp=0.2, hpf=7000)
```

## Disco (octave bass)

```
Clock.bpm = 120
Root.default = "A"
Scale.default = "major"
k1 >> play("x", dur=1, amp=0.9)
h1 >> play(" -", dur=1/2, amp=0.3, hpf=8000)
bs >> dbass([0, 12, 0, 12, 4, 16, 4, 16], oct=2, dur=1/2, amp=0.5, lpf=1200)
st >> pluck((0, 2, 4), oct=5, dur=1/4, sus=0.15, amp=0.2).every(4, "reverse")
me >> saw([4, 5, 4, 2, 0], dur=[1, 1/2, 1/2, 1, 1], oct=5, sus=0.3, amp=0.2, room=0.3)
```

## Boom-bap (hip-hop)

```
Clock.bpm = 90
Root.default = "C"
Scale.default = "minor"
k1 >> play("x..x.x..", dur=1/2, amp=0.8)
s1 >> play("..o...o.", dur=1/2, amp=0.6)
h1 >> play("-", dur=1/4, amp=0.2, hpf=6000).sometimes("stutter", 4)
ch >> rhodes(PChord(0, var(["m7", "m9"], 8)), oct=4, dur=2, sus=1.5, amp=0.25, room=0.4, lpf=2000)
bs >> dbass([0, 0, 5, 3], oct=2, dur=1, amp=0.55, lpf=700)
```

## Trap (808 + hat rolls)

```
Clock.bpm = 140
Root.default = "F"
Scale.default = "minor"
k1 >> play("x..x....", dur=1/2, amp=0.9)
s1 >> play("....o...", dur=1/2, amp=0.6)
hh >> play("-", dur=1/4, amp=0.2, hpf=8000).sometimes("stutter", PRand([2, 3, 4]))
b8 >> dbass([0, 0, 5, 3], oct=2, dur=1, sus=0.8, amp=0.6, lpf=500)
ld >> bell([0, 3, 5, 7], oct=5, dur=PDur(3, 8), sus=0.3, amp=0.2, room=0.4)
```

## Bossa Nova

```
Clock.bpm = 130
Root.default = "C"
Scale.default = "major"
ch >> pluck(PChord(0, var(["maj7", "7", "m7"], 4)), oct=4, dur=1, sus=0.4, amp=0.25, room=0.3).offbeat()
bs >> dbass([0, 4, 0, 4], oct=2, dur=1, amp=0.45, lpf=800)
sh >> play("-", dur=1/2, amp=0.15, hpf=9000)
rm >> play("..x.x.x.", dur=1/2, amp=0.2)
```

## Ambient / Chill

```
Clock.bpm = 70
Root.default = "D"
Scale.default = "dorian"
pd >> pads(PProg("50s"), oct=4, dur=8, sus=8, amp=0.2, attack=3, cutoff=linvar([600, 1800], [32]), reverb=0.6, room=0.9, chorus=0.4)
be >> bell([0, 4, 7, 11], oct=5, dur=PDur(3, 16), sus=0.5, amp=0.15, room=0.7, pan=sinvar([-0.7, 0.7], [16]))
dr >> gaze([0, 7], oct=3, dur=16, sus=16, amp=0.2, shimmer=0.5, reverb=0.6)
```

---

# More themes — classical · film · games

## Für Elise — Beethoven

```
Clock.bpm = 120
Root.default = "A"
Scale.default = "chromatic"
fe >> rhodes([7, 6, 7, 6, 7, 2, 5, 3, 0, -9, -5, 0, 2, -5, -1, 2, 3], dur=[1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1], oct=5, sus=0.5, amp=0.4, room=0.3)
bs >> dbass([-12, -5, -8], dur=[2, 1, 1], oct=4, amp=0.32, lpf=900)
```

## Canon in D — Pachelbel

```
Clock.bpm = 100
Root.default = "D"
Scale.default = "major"
ch >> pads([(0, 2, 4), (4, 6, 1), (5, 0, 2), (2, 4, 6), (3, 5, 0), (0, 2, 4), (3, 5, 0), (4, 6, 1)], oct=4, dur=2, sus=2, amp=0.18, cutoff=linvar([1200, 2600], [16]), reverb=0.4)
bs >> dbass([0, 4, 5, 2, 3, 0, 3, 4], oct=3, dur=2, amp=0.45, lpf=800)
me >> bell([2, 1, 0, -1, -2, -3, -2, -1], dur=2, oct=5, sus=0.6, amp=0.3, room=0.5)
```

## In the Hall of the Mountain King — Grieg

```
Clock.bpm = 130
Root.default = "B"
Scale.default = "minor"
mk >> pluck([0, 1, 2, 3, 2, 4, 2, 4, 0, 1, 2, 3, 2, 4, 2, 0], dur=1/2, oct=4, sus=0.2, amp=linvar([0.2, 0.5], [32]))
bs >> dbass([0, 0, 4, 4], oct=2, dur=2, amp=0.4, lpf=700)
d1 >> play("x", dur=1, amp=linvar([0.3, 0.7], [32]))
```

## James Bond Theme

```
Clock.bpm = 128
Root.default = "E"
Scale.default = "chromatic"
bond >> guitar([0, 0, 0, 0, 2, 3, 2, 0], dur=[1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 1/2, 3/2], oct=4, sus=0.2, amp=0.35, lpf=sinvar([1200, 3000], [8]))
st >> brass([(0, 3, 7), (0, 3, 8)], oct=4, dur=4, sus=1, amp=0.22, dist=1)
bs >> dbass([0, 0, 0, 0, 2, 3, 2, 0], dur=1/2, oct=2, amp=0.4, lpf=700)
d1 >> play("x-o-", dur=1/2, amp=0.45)
```

## Jaws — John Williams (the menace)

```
Clock.bpm = 100
Root.default = "E"
Scale.default = "chromatic"
jaws >> dbass([0, 1], dur=var([1, 1/2, 1/4], [8, 8, 16]), oct=2, amp=linvar([0.3, 0.7], [32]), lpf=600)
st >> brass((0, 3, 7), oct=3, dur=8, sus=8, amp=linvar([0, 0.3], [16]), dist=1, room=0.5)
d1 >> play("x", dur=var([1, 1/2], [16, 16]), amp=0.5)
```

## Also Sprach Zarathustra — 2001: A Space Odyssey

```
Clock.bpm = 80
Root.default = "C"
Scale.default = "chromatic"
zar >> brass([-12, -5, 0, 4, 3], dur=[2, 2, 2, 2, 4], oct=5, sus=1.5, amp=0.4, room=0.6, reverb=0.5)
og >> pads((0, 4, 7), oct=3, dur=8, sus=8, amp=0.2, cutoff=linvar([400, 2000], [8]), reverb=0.6)
tp >> play("x", dur=1/4, amp=linvar([0.1, 0.8], [8]))
```

## Zelda's Lullaby — The Legend of Zelda

```
Clock.bpm = 96
Root.default = "B"
Scale.default = "minor"
zl >> bell([0, 2, -1, 0, 2, -1, 0, 2, 5, 4, 3], dur=[1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2], oct=5, sus=0.5, amp=0.35, room=0.5, reverb=0.4)
ch >> pads([(0, 2, 4), (0, 2, 4), (5, 0, 2)], oct=4, dur=4, sus=4, amp=0.14, cutoff=1500, reverb=0.4)
bs >> dbass([0, 0, 5], oct=3, dur=4, amp=0.4, lpf=800)
```

## Doctor Who — theme (electronic)

```
Clock.bpm = 128
Root.default = "E"
Scale.default = "minor"
dw >> dbass([0, 0, 0, 4, 0, 0, 0, 4], oct=2, dur=1/2, amp=0.5, lpf=sinvar([500, 1500], [8]))
sw >> sine([0, 4, 7], oct=6, dur=4, sus=3, amp=0.15, cutoff=sinvar([2000, 6000], [16]), room=0.6)
d1 >> play("x-x-", dur=1/2, amp=0.4)
```

## The Blue Danube — Strauss (waltz)

```
Clock.bpm = 150
Root.default = "D"
Scale.default = "major"
bd >> pluck([0, 2, 4, 4, 4, 5, 5], dur=[1, 1, 1, 1/2, 1/2, 1, 2], oct=5, sus=0.4, amp=0.35, room=0.4)
ch >> pads([(0, 2, 4), (0, 2, 4), (4, 6, 1), (4, 6, 1)], oct=4, dur=3, sus=3, amp=0.15, cutoff=1600)
bs >> dbass([0, _, _, 4, _, _], oct=3, dur=1, amp=0.4, lpf=800)
```

## Habanera — Bizet (Carmen)

```
Clock.bpm = 100
Root.default = "D"
Scale.default = "chromatic"
hab >> pluck([0, -1, -2, -3, -4, -5, -4, -5, -3, -2], dur=[1, 1/2, 1/2, 1, 1/2, 1/2, 1/2, 1/2, 1, 1], oct=5, sus=0.3, amp=0.35, room=0.3)
bs >> dbass([-12, 7, 3, 7], oct=4, dur=1/2, amp=0.4, lpf=800)
d1 >> play("x..x.x..", dur=1/2, amp=0.4)
```
