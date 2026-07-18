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
sp >> pads((0, 4, 7), oct=4, dur=8, sus=8, amp=0.16, cutoff=1400, reverb=0.6, room=0.9)
sd >> play("x..x.x..", dur=1/2, amp=0.4, lpf=1400)
```

## Star Wars — The Imperial March (Darth Vader)

```
Clock.bpm = 104
Root.default = "G"
Scale.default = "chromatic"
im >> brass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=5, sus=1, amp=0.45, dist=2, room=0.4)
bs >> dbass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=3, amp=0.5, lpf=1100)
ch >> war((0, 3, 7), oct=4, dur=1, sus=0.25, amp=0.28, dist=1)
sd >> play("x", dur=1, amp=0.6)
sn >> play("..o...o.", dur=1/2, amp=0.4)
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
ch >> pluck([(0, 2, 4), (0, 2, 4), (4, 6, 8), (4, 6, 8)], oct=4, dur=2, sus=0.4, amp=0.2)
bs >> dbass([0, 0, 4, 4], oct=3, dur=2, amp=0.45, lpf=1000)
d1 >> play("x-o-", dur=1/2, amp=0.5)
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
hi >> saw([-3, 0, 2, 3, -3, 0, 2, 3, 4, 5, 4, 3, 2, 0], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 2, 2], oct=5, sus=1, amp=0.18, lpf=3500, reverb=0.4)
bs >> dbass([0, 0, -3, -5], oct=2, dur=4, amp=0.5, lpf=700)
d1 >> play("x...x...", dur=1/2, amp=0.6)
```

## Ode to Joy — Beethoven

```
Clock.bpm = 120
Root.default = "C"
Scale.default = "major"
ode >> rhodes([2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1, 2, 2, 3, 4, 4, 3, 2, 1, 0, 1, 2, 1, 0, 0], dur=[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3/2, 1/2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3/2, 1/2], oct=5, sus=0.6, amp=0.4, room=0.4)
ch >> pads([(0, 2, 4), (4, 6, 8), (0, 2, 4), (4, 6, 1)], oct=4, dur=4, sus=4, amp=0.16, cutoff=1600, reverb=0.4)
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
og >> organ((0, 3, 7), oct=4, dur=4, sus=4, amp=0.14, cutoff=1800, room=0.3)
d1 >> play("x-o-", dur=1/2, amp=0.6)
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
