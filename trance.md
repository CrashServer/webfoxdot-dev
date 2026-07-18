# Trance — a full arranged track

An uplifting-trance arrangement built from the little groove, taken through a real structure:
**intro → build → breakdown → build-up → drop → climax → outro**. It shows off three kinds of
evolution at once:

- **Degree evolution** — the lead swaps whole phrases (`var([[…], […]], 8)`), reverses every 8
  bars (`.every(8, "reverse")`), and the plucks are a re-shuffling, rotating figure
  (`PShuf(…).every(4, "rotate")`).
- **Scale evolution** — the breakdown melts to `dorian`, the climax tightens to `harmonicMinor`,
  then it resolves back to `minor` — all live via `Scale.default`.
- **Root modulation** — the classic trance key-lift: the drop jumps up a minor third to **C**, the
  climax keeps lifting with `Root.default = var(["C", "D"], 16)`, and the outro settles home to A.

Load the sample kit for the drums. Put the cursor on `#@intro` and hit Ctrl+Enter — it
auto-advances through the whole arrangement.

```
#@#@ trance

#@intro(16)
Clock.bpm = 138
Root.default = "A"
Scale.default = "minor"
k1 >> play("x", dur=1, amp=0.9)
oh >> play(" -", dur=1/2, amp=0.3, hpf=8000)
pd >> pads(PProg("pop"), oct=4, dur=8, sus=8, amp=0.14, cutoff=sinvar([900, 2600], [16]), reverb=0.4, chorus=0.3)

#@build(16)
bs >> dbass([0], oct=2, dur=1/4, amp=0.45, lpf=linvar([500, 1600], [16])).offbeat()
ar >> pluck(PShuf([0, 3, 4, 7, 10]), oct=5, dur=1/4, sus=0.15, amp=0.2, room=0.3).every(4, "rotate")

#@breakdown(16)
k1.stop()
bs.stop()
ar.stop()
Scale.default = var(["minor", "dorian"], 16)
th >> supersaw(var([[0, 3, 7, 4], [5, 3, 0, -2]], 8), oct=5, dur=1/2, sus=0.7, amp=0.3, cutoff=linvar([600, 3200], [16]), reverb=0.6, room=0.85).unison(3)
pd >> pads(PProg("pop"), oct=4, dur=8, sus=8, amp=0.22, attack=2, cutoff=linvar([700, 2400], [16]), reverb=0.7, room=0.9, chorus=0.4)

#@buildup(8)
Scale.default = "minor"
k1 >> play("x", dur=1, amp=linvar([0.4, 0.95], [8]))
ri >> play("-", dur=1/4, amp=linvar([0.1, 0.5], [8]), hpf=linvar([2000, 12000], [8]))
sn >> play("o", dur=var([1, 1/2, 1/4], [4, 2, 2]), amp=0.5)

#@drop(16)
Root.default = "C"
th.stop()
sn.stop()
ri.stop()
k1 >> play("x", dur=1, amp=0.95)
oh >> play(" -", dur=1/2, amp=0.35, hpf=8000)
bs >> dbass([0], oct=2, dur=1/4, amp=0.5, lpf=700).offbeat()
ld >> supersaw(var([[0, 3, 4, 7], [3, 7, 4, 10]], 8), oct=5, dur=1/2, sus=0.4, amp=0.32, cutoff=linvar([1500, 6000], [32]), reverb=0.4).unison(3).every(8, "reverse")
ar >> pluck(PShuf([0, 3, 4, 7, 10]), oct=6, dur=1/4, sus=0.12, amp=0.18, pan=sinvar([-0.6, 0.6], [8])).every(4, "rotate")
pd >> pads(PProg("pop"), oct=4, dur=8, sus=8, amp=0.14, cutoff=sinvar([1400, 4000], [16]), chorus=0.3)

#@climax(16)
Root.default = var(["C", "D"], 16)
Scale.default = "harmonicMinor"
ld >> supersaw(var([[0, 4, 7, 11], [7, 11, 7, 14]], 8), oct=5, dur=1/2, sus=0.4, amp=0.34, cutoff=linvar([2500, 7500], [16]), reverb=0.4).unison(4).every(8, "reverse")

#@outro(16)
Root.default = "A"
Scale.default = "minor"
ld.stop()
ar.stop()
bs.stop()
k1 >> play("x", dur=1, amp=linvar([0.9, 0], [16]))
pd >> pads(PProg("pop"), oct=4, dur=8, sus=8, amp=linvar([0.2, 0], [16]), cutoff=linvar([2200, 400], [16]), reverb=0.8, room=0.9)

#@end(8)
```
