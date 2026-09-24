# Local patches to the vendored SuperSonic build

`supersonic.js` is the upstream dist (https://github.com/samaaron/supersonic),
minified. Changes made here are listed so an upgrade can carry them forward —
search the file for `crashDot patch` to find each one.

## Drift smoothing (2026-09-24)

**Symptom:** a steady `v1 >> play("-")` was audibly not on the beat. Recorded with
`sample()` and measured, the hits sat 15.5–22.2ms after the grid in two clusters,
jumping every second or so — a ~7ms wobble, more than one 128-frame block.

**Cause:** the timing class re-measures the offset between the page clock and the
audio clock every second (`updateDriftOffset`, from `getOutputTimestamp()`) and
hands each reading straight to the worklet, which applies it to every timetag.
That reading is noisy by several ms; logged once a second it went
`1 0 0 -7 -8 -9 -5 -6 -10` over 8s — ~1000 ppm, which no pair of clocks drifts.
Every note moved with the noise.

**Patch:** `__smoothDrift(n)` — the value sent is the median of the last 9
readings, approached by at most 250µs per update (one a second). Real drift is a
few to a hundred ppm (≤0.1ms/s), well inside that; a noisy reading can no longer
move the grid. The history is cleared wherever the NTP start is re-anchored
(`initialize`, `resync`), so a resume after a hidden tab starts clean.
