# Example tracks — recognizable themes

A handful of well-known melodies transcribed for **webfoxDot / crashDot**. Each block is
self-contained: it sets the tempo / key / scale, then plays the tune on one voice.

Paste a block into the editor and run it line by line with Ctrl+Enter (each statement is on
its own line). Rhythms are close approximations — nudge the `dur` lists to taste.

Film themes use `Scale.default = "chromatic"` so the degrees are literal **semitones from the
root** (0 = root, 7 = a fifth up, −5 = a fourth down); the diatonic tunes use a named scale so
the degrees are ordinary scale steps.

---

## Star Wars — Main Title (fanfare)

```
Clock.bpm = 108
Root.default = "C"
Scale.default = "chromatic"
sw >> brass([-5, -5, -5, 0, 7, 5, 4, 2, 12, 7, 5, 4, 2, 12, 7, 5, 4, 5, 2], dur=[1/2, 1/2, 1/2, 2, 1, 1/3, 1/3, 1/3, 2, 1, 1/3, 1/3, 1/3, 2, 1, 1/3, 1/3, 1/3, 2], oct=5, sus=1, amp=0.5, room=0.5, reverb=0.4)
```

## Star Wars — The Imperial March (Darth Vader)

```
Clock.bpm = 104
Root.default = "G"
Scale.default = "chromatic"
im >> brass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=5, sus=1, amp=0.5, dist=2, room=0.4)
bs >> dbass([0, 0, 0, -4, 3, 0, -4, 3, 0, 7, 7, 7, 8, 3, -1, -4, 3, 0], dur=[1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2, 1, 1, 1, 3/4, 1/4, 1, 3/4, 1/4, 2], oct=3, amp=0.5, lpf=1200)
```

## Seven Nation Army — The White Stripes (the riff)

```
Clock.bpm = 124
Root.default = "E"
Scale.default = "chromatic"
sna >> fuzz([0, 0, 3, 0, -2, -4], dur=[3/2, 1/2, 1, 1, 1, 2], oct=4, amp=0.5, dist=6, lpf=2500)
```

## Tetris — Korobeiniki (A theme)

```
Clock.bpm = 140
Root.default = "A"
Scale.default = "minor"
tet >> blip([4, 1, 2, 3, 2, 1, 0, 0, 2, 4, 3, 2, 1, 1, 2, 3, 4, 2, 0, 0], dur=[1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1/2, 1/2, 1, 1, 1, 1, 1], oct=5, sus=0.3, amp=0.4)
```

## Super Mario Bros — overworld (Koji Kondo)

```
Clock.bpm = 100
Root.default = "C"
Scale.default = "chromatic"
mar >> blip([4, 4, _, 4, _, 0, 4, _, 7, _, _, -5], dur=1/2, oct=5, sus=0.25, amp=0.4)
```

## Game of Thrones — main title

```
Clock.bpm = 150
Root.default = "C"
Scale.default = "minor"
got >> prophet([-3, 0, 2, 3, -3, 0, 2, 3, -3, 0, 2, 3, 2, 0], dur=[1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 1, 1, 1/2, 1/2, 2, 2], oct=4, sus=1, amp=0.4, lpf=3000, room=0.5, reverb=0.4)
```

## Ode to Joy — Beethoven (diatonic, the easy one)

```
Clock.bpm = 120
Root.default = "C"
Scale.default = "major"
ode >> rhodes([2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1], dur=[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3/2, 1/2, 2], oct=5, sus=0.6, amp=0.4, room=0.4)
```

## Pop — the four-chord song (I–V–vi–IV)

The progression behind a hundred pop hits — C · G · Am · F — with a bass and a topline.

```
Clock.bpm = 118
Root.default = "C"
Scale.default = "major"
ch >> pads(PProg("pop"), oct=4, dur=4, sus=4, amp=0.3, cutoff=1600, reverb=0.4, room=0.7, chorus=0.3)
bs >> dbass([0, 4, 5, 3], oct=3, dur=4, amp=0.5, lpf=800)
me >> bell([4, 2, 4, 7, 4, 2, 1, 0], dur=[1, 1, 1, 1, 1/2, 1/2, 1, 1], oct=5, sus=0.4, amp=0.3, room=0.5)
```
