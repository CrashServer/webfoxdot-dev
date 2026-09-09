// Pattern helpers — all patterns expose a .get(step) method.
// patGet resolves any value: plain scalar, array, or pattern object.

import { isEnv, envValue, currentBeat, _var } from './timevars.js';
import { REST } from './rest.js';

export function patGet(val, step, def) {
    if (val === null || val === undefined) return def;
    if (typeof val?.get === 'function') return val.get(step);
    if (Array.isArray(val)) {
        const len = val.length;
        const el  = val[((step % len) + len) % len];
        // Resolve a pattern nested inside the list (e.g. [0, {2,4}] → PRand picks
        // each step) so {…}/P*[…] work in degree lists, like they do in play().
        if (el && typeof el.get === 'function') return el.get(step);
        // A nested list alternates one element per outer cycle (like <…>): [0,[4,2]]
        // → 0,4,0,2, and deeper nesting keeps working — so old FoxDot bracket
        // patterns stay functional in synths. (play() uses its own parser, which
        // subdivides a step instead; that path is unaffected.)
        if (Array.isArray(el)) return patGet(el, Math.floor(step / len));
        // Groups (chords) have no .get / aren't arrays → survive for voice expansion.
        return el;
    }
    return val;
}

// ── Pattern class — chainable transforms ─────────────────────────────────────
// A Pattern is a real Array subclass (so it stays fully array-compatible: spread,
// map, Array.isArray, patGet's array branch all work) that ALSO carries FoxDot's
// chainable transform methods. P[a,b,c] transpiles to Ppat([a,b,c]); many list
// generators (PDur, PBeat, PCircle, …) return one too, so you can write
//   d1 >> pluck(P[0,2,4,7].rotate(1).palindrome())
//   b1 >> play(PDur(3,8).mirror())
export class Pattern extends Array {
    // reversed copy (non-mutating, unlike Array.prototype.reverse)
    reverse()      { return Ppat([...this].reverse()); }
    mirror()       { return this.reverse(); }
    // self followed by its reverse
    palindrome()   { return Ppat([...this, ...[...this].reverse()]); }
    // cyclic shift by n (negative = left)
    rotate(n = 1)  { const L = this.length || 1, r = ((Math.round(n) % L) + L) % L; return Ppat([...this.slice(r), ...this.slice(0, r)]); }
    // running cumulative sum: [1,2,1] → [start, start+1, start+3]
    accum(start = 0) { let a = start; return Ppat(this.map(x => { const v = a; a += Number(x) || 0; return v; })); }
    // repeat cyclically to exactly `size` steps
    stretch(size)  { const out = []; for (let i = 0; i < size; i++) out.push(this[i % this.length]); return Ppat(out); }
    // first / last `size` elements
    trim(size)     { return Ppat(this.slice(0, size)); }
    ltrim(size)    { return Ppat(this.slice(-size)); }
    // repeat the whole pattern n times
    loop(n = 2)    { const out = []; for (let i = 0; i < n; i++) out.push(...this); return Ppat(out); }
    dup(n = 2)     { return this.loop(n); }
    // each element repeated n times in place
    stutter(n = 2) { const out = []; for (const x of this) for (let i = 0; i < n; i++) out.push(x); return Ppat(out); }
    // shuffled / sorted copies
    shuffle()      { const a = [...this]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return Ppat(a); }
    sort()         { return Ppat([...this].sort((x, y) => x - y)); }
    // add an interval as a simultaneous grace layer: each step plays x AND x+v
    offadd(v = 0)  { return Ppat(this.map(x => _group(x, (Number(x) || 0) + v))); }
    offmul(v = 1)  { return Ppat(this.map(x => _group(x, (Number(x) || 0) * v))); }
    // interleave with another list into per-step groups (chords)
    zip(other)     { const b = Array.isArray(other) ? other : [other]; return Ppat(this.map((x, i) => _group(x, b[i % b.length]))); }
    // add a scalar/interval to every element
    add(v = 0)     { return Ppat(this.map(x => (Number(x) || 0) + v)); }
    // amen-break slice reorder over `size` equal parts (iconic breakbeat shuffle)
    amen(size = 4) {
        const n = this.length, p = Math.max(1, Math.floor(n / size)), part = (i) => this.slice(i * p, (i + 1) * p);
        if (size < 4) return Ppat([...this]);
        return Ppat([...part(0), ...part(1), ...part(0), ...part(3), ...part(2), ...part(1), ...part(2), ...part(3)].slice(0, n));
    }
    // zip self with a transformed copy → per-step groups (instant harmony/counterpoint):
    //   P[0,2,4].layer("add", 2)   → each step plays the note AND a third above
    layer(method = 'add', ...args) {
        if (typeof this[method] !== 'function') return Ppat([...this]);
        return this.zip(this[method](...args));
    }
    // arpeggiate: expand each element by every offset in `arpPattern`
    //   P[0,4].arp([0,12]) → [0,12,4,16]
    arp(arpPattern = [0, 4, 7]) {
        const ap = Array.isArray(arpPattern) ? arpPattern : [arpPattern];
        const out = [];
        for (const x of this) for (const a of ap) out.push((Number(x) || 0) + (Number(a) || 0));
        return Ppat(out);
    }
    // melodic inversion — reflect the contour around its own range (min↔max)
    invert() {
        const nums = this.filter(x => typeof x === 'number');
        if (!nums.length) return Ppat([...this]);
        const hi = Math.max(...nums), lo = Math.min(...nums);
        return Ppat(this.map(x => typeof x === 'number' ? (hi + lo - x) : x));
    }
    // dict remap of values: .submap({0:5, 4:7}) — unmatched values pass through
    submap(mapping = {}) {
        return Ppat(this.map(x => { const k = String(x); return (k in mapping) ? mapping[k] : x; }));
    }
    // rescale numeric values to 0–1 (for mapping into any param range)
    norm() {
        const nums = this.filter(x => typeof x === 'number');
        if (!nums.length) return Ppat([...this]);
        const hi = Math.max(...nums), lo = Math.min(...nums), range = (hi - lo) || 1;
        return Ppat(this.map(x => typeof x === 'number' ? (x - lo) / range : x));
    }
    // keep elements where the (cyclic) boolean mask is truthy — pairs with PEuclid/PBin
    select(mask = []) {
        const m = Array.isArray(mask) ? mask : [mask];
        if (!m.length) return Ppat([...this]);
        return Ppat(this.filter((_, i) => m[i % m.length]));
    }
    // reverse each consecutive block of n (adjacent-pair swap by default)
    swap(n = 2) {
        const out = [], k = Math.max(1, Math.round(n));
        for (let i = 0; i < this.length; i += k) out.push(...[...this.slice(i, i + k)].reverse());
        return Ppat(out);
    }
    // drop consecutive duplicates
    undup() {
        const out = [];
        for (const x of this) if (out.length === 0 || out[out.length - 1] !== x) out.push(x);
        return Ppat(out);
    }
}
// Wrap any array/value into a Pattern. Emitted by the transpiler for P[…].
export function Ppat(a) { return Pattern.from(Array.isArray(a) ? a : [a]); }

// ── Groups / chords ──────────────────────────────────────────────────────────
// (a, b, c) in a param position → a group: values fired SIMULTANEOUSLY (chord),
// or zipped across layered voices when several params are groups. Distinct from
// [a, b, c] which is a per-step sequence. Built by the transpiler as __group(...).
export function _group(...items) { return { __group: items }; }
export function isGroup(v) { return v != null && Array.isArray(v.__group); }

// ── Probability modifiers ─────────────────────────────────────────────────────
// .sometimes("stutter", 4)                  → 50% chance per step, call stutter(4)
// .often(0.8, "reverse")                     → override probability
// .rarely("stutter", 2, rate=2, amp=0.5)     → trailing kwargs temporarily
//                                              override params for that trigger
// Aliases and their default probabilities (FoxDot-style):
export const PROB = {
    always: 1, almostAlways: 0.9, often: 0.7, sometimes: 0.5,
    rarely: 0.25, almostNever: 0.1, never: 0,
};

// Build one modifier spec from a method-call's args.
export function parseModifier(defaultProb, rawArgs) {
    const args = [...rawArgs];
    let prob = defaultProb;
    if (typeof args[0] === 'number') prob = args.shift();
    const method = args.shift();
    // A trailing plain object (from kwargs) = temporary param overrides.
    let kwargs = null;
    const last = args[args.length - 1];
    if (last && typeof last === 'object' && !Array.isArray(last)
            && !last.__group && typeof last.get !== 'function') {
        kwargs = args.pop();
    }
    return { prob, method, args, kwargs };
}

// Mix the probability-alias methods onto a call class (SynthCall / PlayStringCall).
// Each appends to _modifiers so several can be chained.
export function attachModifiers(cls) {
    for (const [name, p] of Object.entries(PROB)) {
        cls.prototype[name] = function (...a) {
            const spec = parseModifier(p, a);
            spec.alias = name;   // which modifier (sometimes/often/…) — for the editor flash
            (this._modifiers ??= []).push(spec);
            return this;
        };
    }
    // .human(velocity, humanize, swing) — humanise dynamics + micro-timing (FoxDot).
    // Sets a 2-step `delay` (timing jitter, ± humanize% of dur, biased by swing%)
    // and `amplify` (velocity) pattern. Works on synths (.args) and play() (.opts).
    cls.prototype.human = function (velocity = 20, humanize = 5, swing = 0) {
        const a = this.args ?? this.opts;
        if (humanize === 0) humanize = 1;
        if (velocity !== 0) {
            const dur = typeof a.dur === 'number' ? a.dur : 1;
            const sw  = dur * swing / 100;
            a.delay   = [0, PWhite(-(humanize / 100) * dur + sw, (humanize / 100) * dur + sw)];
            a.amplify = [1, PWhite((100 - velocity) / 100, 1)];
        } else {
            a.delay = 0;
            a.amplify = 1;
        }
        return this;
    };
    // .fill(on=1) — instant drum FILL: randomises dur to short values and gates amplify
    // in on/off bursts so the player stutters in and out (port of FoxDot's Player.fill).
    // Works on synths (.args) and play() (.opts).
    //   1 (default) weighted-random dur + bursty amplify · 2 random dur, full amp
    //   3 steady 1/2 dur + denser bursts                 · 0/other reset (1/2 dur, amp 1)
    cls.prototype.fill = function (on = 1) {
        const a = this.args ?? this.opts;
        if (on === 2)      { a.dur = PRand([1/4, 1/2, 3/4]); a.amplify = 1; }
        else if (on === 3) { a.dur = 1/2; a.amplify = _var([0, 1], [3, 3]); }
        else if (on)       { a.dur = PwRand([1/4, 1/2, 3/4], [45, 45, 10]); a.amplify = _var([0, 1], [7, 2]); }
        else               { a.dur = 1/2; a.amplify = 1; }
        return this;
    };
    // .slider(start=0, on=1) — glissando between notes (port of FoxDot's Player.slider).
    // Each glided note sweeps freq from freq*slidefrom to freq*(1+slide) over
    // sus*slidedelay (the fd_ glide preamble). Only synths with that preamble slide;
    // others ignore it harmlessly.
    //   start = 0 / 1        scalar: FoxDot's alternating glissando (0/1 = which phase)
    //   start = [0, 0, 1]    PATTERN: per note, 1 = glide this note · 0 = steady
    //   start = var([0,1],…) a var works too — the direction can breathe over time
    cls.prototype.slider = function (start = 0, on = 1) {
        const a = this.args ?? this.opts;
        if (!on) { a.slide = 0; a.slidefrom = 1; a.slidedelay = 1; return this; }
        if (Array.isArray(start) || (start && typeof start.get === 'function')) {
            // per-note control: read `start` each step — 1 = sweep this note up, 0 = steady
            a.slide     = { get: (step) => patGet(start, step) ? 1 : 0 };
            a.slidefrom = { get: (step) => patGet(start, step) ? 0 : 1 };
        } else {
            a.slide     = start ? [1, 0] : [0, 1];   // scalar: alternating, phase-seeded
            a.slidefrom = start ? [0, 1] : [1, 0];
        }
        a.slidedelay = 0.75;
        return this;
    };
}

// ── Basic sequences ──────────────────────────────────────────────────────────

// PRand(lo, hi) — random integer in [lo, hi). PRand([arr]) picks from array.
export function PRand(lo, hi) {
    if (Array.isArray(lo)) { const a = lo; return { get: () => a[Math.floor(Math.random() * a.length)] }; }
    if (hi === undefined) { hi = lo; lo = 0; }
    return { get: () => Math.floor(Math.random() * (hi - lo)) + lo };
}

// PWhite(lo=0, hi=1) — random float in [lo, hi]
export function PWhite(lo = 0, hi = 1) {
    return { get: () => lo + Math.random() * (hi - lo) };
}

// melody(range=7, maxStep=2) — a simple melodic generator: a bounded random walk
// over scale degrees. On its own it wanders forever; freeze a fixed phrase that
// repeats with a slice — melody()[:8] samples 8 degrees once and loops them.
export function melody(range = 7, maxStep = 2) {
    let cur = 0;
    return { get: () => {
        const v = cur;
        const d = Math.floor(Math.random() * (2 * maxStep + 1)) - maxStep;
        cur = Math.max(-range, Math.min(range, cur + d));
        return v;
    } };
}

// Pslice(pat, start, stop) — Python-style slice that FREEZES a generator into a
// fixed, repeating pattern. melody()[:8] / PWhite(0,1)[:8] sample N values once
// and loop them, so a random generator becomes a stable N-step phrase that
// repeats — instead of a fresh random value every single step.
//   - array in  → a plain sliced array (already fixed)
//   - {get} in  → sample get(start..stop-1) once, return that frozen array
// An open-ended slice on a generator (no stop) can't be materialised, so the
// generator is returned unchanged.
export function Pslice(pat, start, stop) {
    const a = start == null ? 0 : start;
    if (Array.isArray(pat)) {
        return pat.slice(a, stop == null ? undefined : stop);
    }
    if (pat && typeof pat.get === 'function') {
        if (stop == null) return pat;
        const out = [];
        for (let i = a; i < stop; i++) out.push(pat.get(i));
        return out;
    }
    return pat;
}

// PWalk(max=7, step=1, start=0) — random walk bounded to ±max
export function PWalk(max = 7, step = 1, start = 0) {
    let cur = start;
    return {
        get: () => {
            const v = cur;
            cur = Math.max(-max, Math.min(max, cur + (Math.random() < 0.5 ? step : -step)));
            return v;
        }
    };
}

// The euclidean-duration list for k pulses in n steps (rotate cyclically shifts it).
function _pdurList(k, n, rotate = 0, dur = 1) {
    k = Math.max(1, Math.round(Number(k) || 1));
    const steps = Array(n).fill(0);
    for (let i = 0; i < k; i++) steps[Math.round(i * n / k)] = 1;
    const durs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
        if (steps[i] === 1 && i > 0) { durs.push(acc * dur / n); acc = 1; }
        else acc++;
    }
    if (acc > 0) durs.push(acc * dur / n);
    if (rotate && durs.length) { const r = ((Math.round(rotate) % durs.length) + durs.length) % durs.length; return durs.slice(r).concat(durs.slice(0, r)); }
    return durs;
}

// PDur(k, n, rotate=0, dur=1) — Euclidean durations: k pulses in n steps. `rotate`
// cyclically shifts the resulting duration list (FoxDot's `start`). `k` may be a
// pattern/alternation — PDur(<3,5>, 8) plays the 3-in-8 rhythm one cycle, the
// 5-in-8 the next, and so on (k is re-resolved each time the cycle completes).
export function PDur(k, n, rotate = 0, dur = 1) {
    if (k != null && typeof k === 'object' && typeof k.get === 'function') {
        // Advance a cycle counter so an alternating k (PDur(<3 5>,8)) steps through
        // its values — patGet(k, 0) every rebuild froze on the first item (_alt caches).
        let cyc = 0, durs = _pdurList(patGet(k, cyc), n, rotate, dur), i = 0;
        return { get() {
            if (i >= durs.length) { cyc++; durs = _pdurList(patGet(k, cyc), n, rotate, dur); i = 0; }
            return durs[i++] ?? 1;
        } };
    }
    return Ppat(_pdurList(k, n, rotate, dur));
}

// PDrum(k, n, char) — a Euclidean drum play() string: k pulses spread over n steps.
//   play(PDrum(5, 8))  →  "x.xx.xx."
export function PDrum(k = 3, n = 8, char = 'x') {
    return _euclid(n, k).map(s => (s ? char : '.')).join('');
}

// PwRand(values, weights) — weighted random pick each step (FoxDot P*[...]-style
// with weights). PwRand([0, 4, 7], [8, 2, 1]) favours 0.
export function PwRand(values, weights) {
    const vals = Array.isArray(values) ? values : [values];
    const wts  = Array.isArray(weights) ? weights : vals.map(() => 1);
    const total = wts.reduce((a, b, i) => a + (b ?? 1), 0) || vals.length;
    return { get: () => { let r = Math.random() * total; for (let i = 0; i < vals.length; i++) { r -= (wts[i] ?? 1); if (r <= 0) return vals[i]; } return vals[vals.length - 1]; } };
}

// PxRand(lo, hi) / PxRand([values]) — random with no immediate repeat.
export function PxRand(lo, hi) {
    const arr = Array.isArray(lo) ? lo : null;
    if (!arr && hi === undefined) { hi = lo; lo = 0; }
    let last = null;
    const pick = () => arr ? arr[Math.floor(Math.random() * arr.length)] : Math.floor(Math.random() * (hi - lo)) + lo;
    return { get: () => { let v, g = 0; do { v = pick(); } while (v === last && ++g < 8); last = v; return v; } };
}

// PLog(mean=0, deviation=1) — log-normal random floats (int if mean is an integer).
export function PLog(mean = 0, deviation = 1) {
    return { get: () => {
        const u1 = Math.random() || 1e-9, u2 = Math.random();
        const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const v = Math.exp(mean + deviation * n);
        return Number.isInteger(mean) ? Math.round(v) : v;
    } };
}

// PTime(low=0, high=0, rnd=1) — digits of the current wall-clock second as a pattern
// (a quirky "the machine's clock" generator). With low/high, map digits into [low,hi].
export function PTime(low = 0, high = 0, rnd = 1) {
    const digits = String(Math.floor(Date.now() / 1000)).split('').map(Number);
    if (low === 0 && high === 0) return Ppat(digits);
    return Ppat(digits.map(d => { const v = low + (d / 9) * (high - low); return Math.round(v / rnd) * rnd; }));
}

// PSum(n, total) — n durations that sum to total, e.g. PSum(3,8) → [3,3,2].
export function PSum(n, total, lim = 0.125) {
    n = Math.max(1, Math.round(n) || 1);                 // n=0 → data[i%0] = NaN key
    if (!(total > 0)) return Ppat([total || 0]);
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    let data = [total + 1], step = 1;
    while (sum(data) > total) { data = Array(n).fill(step); step *= 0.5; }
    let i = 0;
    while (sum(data) < total && step >= lim) {
        if (sum(data) + step > total) step *= 0.5;
        else { data[i % n] += step; i++; }
    }
    return Ppat(data);
}

// PDelta(deltas, start=0) — cumulative sum: start, start+d0, start+d0+d1, …
export function PDelta(deltas, start = 0) {
    const arr = Array.isArray(deltas) ? deltas : [deltas];
    return { get: (i) => { let v = start; for (let j = 0; j < i; j++) v += Number(patGet(arr[j % arr.length], j)) || 0; return v; } };
}

// PIndex() — the step index. PSquare() — the index squared. PFib() — Fibonacci.
export function PIndex()  { return { get: (i) => i }; }
export function PSquare() { return { get: (i) => i * i }; }
export function PFib()    { const c = [0, 1]; return { get: (i) => { while (c.length <= i) c.push(c[c.length - 1] + c[c.length - 2]); return c[i]; } }; }

// PBeat(string, start=0, dur=0.5) — durations from a pulse string (non " "/"." = hit):
//   PBeat("x xxx x") → [1, 0.5, 0.5, 1, 0.5]
export function PBeat(string, start = 0, dur = 0.5) {
    const data = [...String(string)].map(c => (c !== ' ' && c !== '.') ? 1 : 0);
    const out = []; let cur = 0;
    for (const d of data) { if (d === 1) { if (cur > 0) out.push(cur); cur = 1; } else cur += 1; }
    if (cur > 0) out.push(cur);
    let res = out.map(d => d * dur);
    if (start && res.length) { const r = ((Math.round(start) % res.length) + res.length) % res.length; res = res.slice(r).concat(res.slice(0, r)); }
    return Ppat(res);
}

// PJoin(...patterns) — concatenate several lists into one.
export function PJoin(...patterns) {
    const out = [];
    for (const p of patterns) for (const x of (Array.isArray(p) ? p : [p])) out.push(x);
    return Ppat(out);
}

// PDelay(k, n, rotate=0, dur=1) — a group of onset offsets (delay times) from a
// Euclidean rhythm, e.g. use as delay=PDelay(3, 8).
export function PDelay(k, n, rotate = 0, dur = 1) {
    const durs = _pdurList(k, n, rotate, dur);
    const out = []; let acc = 0;
    for (const d of durs) { out.push(acc); acc += d; }
    return _group(...out);
}

// ── More FoxDot generators ────────────────────────────────────────────────────

// P10(n) — n-length list of random 1s and 0s (FoxDot P10). e.g. play(P10(8)).
export function P10(n = 8) { const out = []; for (let i = 0; i < (n | 0); i++) out.push(Math.random() < 0.5 ? 0 : 1); return Ppat(out); }

// PSaw(lo, hi, steps) — rising sawtooth ramp (companion to PSine/PTri).
export function PSaw(lo = 0, hi = 1, steps = 16) {
    return { get: (step) => { const t = ((((step | 0) % steps) + steps) % steps) / steps; return lo + (hi - lo) * t; } };
}

// PSq(a, b, c) — powers: [a^b, (a+1)^b, … ] for c terms (FoxDot PSq).
export function PSq(a = 1, b = 2, c = 3) { const out = []; for (let x = a; x < a + c; x++) out.push(Math.pow(x, b)); return Ppat(out); }

// PZero() — a constant 0 generator. PBool(seq) — every nonzero → 1, else 0.
export function PZero() { return { get: () => 0 }; }
export function PBool(seq) { return Ppat((Array.isArray(seq) ? seq : [seq]).map(x => (x ? 1 : 0))); }

// PFibMod — FoxDot's Fibonacci generator (same series as PFib).
export const PFibMod = PFib;

// PPairs(seq, func) — lace a sequence with a second obtained by func(item);
// default func is n → 8 - n. PPairs([0,2,4]) → [0,8,2,6,4,4].
export function PPairs(seq, func = (n) => 8 - n) {
    const out = [];
    for (const item of (Array.isArray(seq) ? seq : [seq])) { out.push(item); out.push(func(item)); }
    return Ppat(out);
}

// PChar(string, start=0) — letters → degrees (a=0, b=1, …), non-letters → 0.
export function PChar(string, start = 0) {
    const out = [];
    for (const ch of String(string)) { const c = ch.toLowerCase(); out.push((c >= 'a' && c <= 'z') ? c.charCodeAt(0) - 97 + start : 0); }
    return Ppat(out);
}

// PQuicken(dur, stepsize, steps) — a group of delay amounts that gradually
// accelerate (FoxDot). Use as delay=PQuicken() for a ritardando/accel feel.
export function PQuicken(dur = 0.5, stepsize = 3, steps = 6) {
    const delay = []; let count = 0, d = dur;
    for (let i = 0; i < steps; i++) { for (let j = 0; j < stepsize - 1; j++) { delay.push(count); count += d / stepsize; } d /= stepsize; }
    return _group(...(delay.length ? delay : [0]));
}

// PStrum(n, spread) — a group of onset delays that fan out like a guitar strum.
export function PStrum(n = 4, spread = 1 / 8) {
    const out = []; for (let i = 0; i < Math.max(1, n | 0); i++) out.push(i * spread);
    return _group(...out);
}

// PZip2(a, b) — zip two lists into a group per step over their LCM length
// (FoxDot). Each step fires (a_i, b_i) as a chord/group.
export function PZip2(a, b) {
    const A = Array.isArray(a) ? a : [a], B = Array.isArray(b) ? b : [b];
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    const n = (A.length * B.length) / (gcd(A.length, B.length) || 1);
    const out = []; for (let i = 0; i < n; i++) out.push(_group(A[i % A.length], B[i % B.length]));
    return out;
}

// PZ12(tokens=[1,0], p=[1,0.5]) — FoxDot's "dearth" algorithm: emits tokens so
// their running frequency tracks the target probabilities p (evenly spread, not
// clumped like plain random). Works with two tokens.
export function PZ12(tokens = [1, 0], p = [1, 0.5]) {
    const maxp = Math.max(...p) || 1;
    const probs = p.map(v => v / maxp);
    // Track per-token counts + a step index instead of retaining the full history —
    // the old `prev` array grew (and was reduce-scanned) unbounded in a live session.
    const counts = tokens.map(() => 0);
    let index = 0;
    return { get: () => {
        const dearth = tokens.map((_, i) => probs[i] * (index + 1) - counts[i]);
        let bi = 0; for (let i = 1; i < dearth.length; i++) if (dearth[i] > dearth[bi]) bi = i;
        counts[bi]++; index++;
        return tokens[bi];
    }};
}

// PPing(arr) — ping-pong through array [0,1,2,3,2,1,0,1,...]
export function PPing(arr) {
    const fwd = [...arr], rev = [...arr].reverse().slice(1, -1);
    const loop = [...fwd, ...rev];
    return { get: (i) => patGet(loop[i % loop.length], i) };
}

// ── Repetition / rotation ─────────────────────────────────────────────────────

// PStutter(seq, n) — each value repeated n times: [0,2,4] n=2 → [0,0,2,2,4,4]
export function PStutter(seq, n = 2) {
    const arr  = Array.isArray(seq) ? seq : [seq];
    const nArr = Array.isArray(n)   ? n   : null;
    const flat = arr.flatMap((v, i) => Array(nArr ? nArr[i % nArr.length] : n).fill(v));
    return { get: (step) => patGet(flat[step % flat.length], step) };
}

// PAlt(p1, p2, ...) — alternate between patterns one step at a time
export function PAlt(...pats) {
    return { get: (step) => patGet(pats[step % pats.length], step) };
}

// _alt(a, b, c) — FoxDot <a b c> alternation. Advances once per *read* (not per
// global step), so it cycles its items each time it's reached: top-level
// saw(<0 4 7>) plays 0,4,7,0,…; a param dur=<1 2> alternates 1,2,1,…. The
// transpiler turns <...> on a player line into this.
// <a b c> alternation — advances one item each STEP. Caches per step so that
// several reads within the same step (e.g. unison, which reads the degree once
// per voice) all return the SAME item instead of racing the counter forward.
export function _alt(...items) {
    let i = 0, lastStep, cached;
    return { get: (step) => {
        if (step === undefined || step !== lastStep) {
            lastStep = step; cached = patGet(items[i % items.length], step); i++;
        }
        return cached;
    } };
}

// <a b c> SUBDIVISION — cram the items into one step (a ratchet/flam). Returns a raw
// marker (NO .get, so it survives arg resolution intact); the fire path detects
// `.__sub` on the degree and schedules each item at 1/N of the step. Nests: <0 <4 7>>.
export function _sub(...items) { return { __sub: items }; }

// Pattern arithmetic: linvar([1.4,0],32) * P[1,0,0.9], P[0,2,4] + 2, etc. JS can't
// overload operators, so the transpiler rewrites arithmetic involving a pattern
// into Pmath(a, op, b). If both operands are plain scalars it computes eagerly
// (so 1/4 stays 0.25); otherwise it returns a lazy pattern resolved per step.
const _OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
// A missing operand must never become NaN. `p2 >> saw(p1.degree + 7)` run BEFORE the
// p1 line is ordinary live-coding order, and getAttr on a player that has not played
// resolves to undefined — which used to make the whole expression NaN, and a NaN
// degree or amp poisons the summed bus: the master limiter sanitises it to zero and
// the mix goes silent until a page refresh. So a term that is not there contributes
// nothing, and the other side comes through unchanged.
//
// Only undefined/null and actual NaN count as missing. Strings are left alone, so
// '+' still concatenates and a named blend or curve still arrives intact.
const _absent = (v) => v == null || (typeof v === 'number' && !isFinite(v));
export function Pmath(a, op, b) {
    const raw = _OPS[op] ?? ((x) => x);
    const f = (x, y) => (_absent(x) ? (_absent(y) ? 0 : y) : _absent(y) ? x : raw(x, y));
    const lazy = (v) => v != null && (typeof v.get === 'function' || Array.isArray(v) || isGroup(v) || isEnv(v));
    if (!lazy(a) && !lazy(b)) return f(a, b);
    const scalar = (v, step) => { const r = patGet(v, step, v); return isEnv(r) ? envValue(r) : r; };
    return { get: (step) => {
        // Group operand → broadcast the op across the chord's voices (return a group),
        // e.g. (0,4,7)+2 → (2,6,9). The old code collapsed to the first voice, dropping
        // the rest of the chord. (Arrays stay per-step sequences, not chords.)
        if (isGroup(a) || isGroup(b)) {
            const av = isGroup(a) ? a.__group : [a], bv = isGroup(b) ? b.__group : [b];
            const nn = Math.max(av.length, bv.length), out = [];
            for (let i = 0; i < nn; i++) out.push(f(scalar(av[i % av.length], step), scalar(bv[i % bv.length], step)));
            return _group(...out);
        }
        return f(scalar(a, step), scalar(b, step));
    } };
}

// PShuf(seq) — shuffle once at creation, cycle forever
export function PShuf(seq) {
    const arr = [...(Array.isArray(seq) ? seq : [seq])];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return { get: (step) => arr[step % arr.length] };
}

// ── Probability ──────────────────────────────────────────────────────────────

// PBern(p=0.5, a=1, b=0) — Bernoulli: returns a with prob p, else b
export function PBern(p = 0.5, a = 1, b = 0) {
    return { get: () => Math.random() < p ? a : b };
}

// PCoin — alias for PBern
export const PCoin = PBern;

// ── Euclidean ────────────────────────────────────────────────────────────────

// PEuclid(n, k, offset=0) — k pulses in n steps; returns 1/0 per step
export function PEuclid(n, k, offset = 0) {
    const seq = _euclid(n, k);
    return { get: (step) => seq[(((step + offset) % seq.length) + seq.length) % seq.length] };
}

// PEuclidR(n, k, rotation=0) — a rotated Euclidean rhythm as a concrete 0/1
// Pattern (composes with pattern methods / arithmetic), e.g. play(PEuclidR(8,3,1)
// .submap({1:'x',0:'.'})) or amp=PEuclidR(16,7,2).
export function PEuclidR(n, k, rotation = 0) {
    const seq = _euclid(n, k);
    const r = ((Math.round(rotation) % n) + n) % n;
    return Ppat([...seq.slice(r), ...seq.slice(0, r)]);
}

function _euclid(n, k) {
    const seq = Array(n).fill(0);
    let b = 0;
    for (let i = 0; i < n; i++) { b += k; if (b >= n) { b -= n; seq[i] = 1; } }
    return seq;
}

// PEuclid2(n, k, lo, hi) — Euclidean rhythm of n pulses in k steps, filled with
// `lo`/`hi` instead of 0/1. Great for play() char patterns:
//   play(PEuclid2(3, 8, '.', 'x'))  → a kick on the 3-in-8 euclid grid
export function PEuclid2(n, k, lo = 0, hi = 1) {
    const arr = _euclid(k, n).map(x => (x ? hi : lo));
    // Char fills → a ready-to-play string (play(PEuclid2(3,8,".","x")) → "..x..x.x")
    if (typeof lo === 'string' && typeof hi === 'string') return arr.join('');
    return cyc(arr);
}

// PFr(mapl, maph, seed, size) — fractal step pattern (FoxDot's simple PFrac),
// deterministic from `seed`, mapped into [mapl, maph]. e.g. cutoff=PFr(300, 4000)
export function PFr(mapl = 0, maph = 1, seed = 1664, size = 16) {
    const unit = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return (x - Math.floor(x)) * 0.99; };
    const a = unit(seed);                       // FoxDot seeds a and b from the same value
    const data = [];
    for (let i = 0; i < size; i++) {
        const f = (((a * i + a) % 1) + 1) % 1;
        data.push(mapl + f * (maph - mapl));
    }
    return cyc(data);
}

// PArp(seq, index=0) — BlueARP-style arpeggiator (FoxDot Extensions/PArp). seq is
// up to 4 degrees [k1,k2,k3,k4]; index 0-9 picks a built-in 3K arp shape. Octave
// offsets add a diatonic octave (7 scale steps). e.g. PArp([0,4,7], 5)
export function PArp(seq, index = 0) {
    const s  = Array.isArray(seq) ? seq : [seq];
    const k1 = s[0], k2 = s[1] ?? s[0], k3 = s[2] ?? s[0];
    const OC = 7;   // diatonic octave (degrees); fine for 7-note scales
    const dict = [
        [[k1,k2,k3,k1, k2,k3,k1,k2, k3,k1,k2,k3, k1,k2,k3,k2], [0]],
        [[k3,k2,k1,k3, k2,k1,k3,k2, k1,k3,k2,k1, k3,k2,k1,k2], [0]],
        [[k1,k2,k3,k2, k1,k2,k3,k2, k1,k2,k3,k2, k1,k3,k1,k2], [0]],
        [[k3,k2,k1,k2, k3,k2,k1,k2, k3,k2,k1,k2, k3,k2,k3,k1], [0]],
        [[k2,k3,k1,k3, k2,k3,k1,k3], [0,-1,0,-1, 0,-1,0,-1]],
        [[k1,k3,k2,k1, k1,k1,k2,k3], [-1,0,0,-1, 0,-1,0,0]],
        [[k1,k1,k3,k1, k1,k2,k1,k3], [-1,-5,0,-1, 0,0,-1,0]],
        [[k3,k1,k2,k1, k3,k1,k2,k1], [0]],
        [[k3,k2,k1,k3, k2,k1,k3,k2], [0]],
        [[k1,k1,k1,k2, k1,k1,k1,k3], [-1,1,0,0, -1,1,0,0]],
    ];
    const [notes, octs] = dict[((index % dict.length) + dict.length) % dict.length];
    return cyc(notes.map((n, i) => n + octs[i % octs.length] * OC));
}

// PStretch(seq, size) — repeat seq cyclically to exactly `size` steps.
export function PStretch(seq, size = 8) {
    const a = Array.isArray(seq) ? seq : [seq];
    const out = [];
    for (let i = 0; i < size; i++) out.push(a[i % a.length]);
    return cyc(out.length ? out : [0]);
}

// PZip(a, b) — interleave two sequences: [a0,b0,a1,b1,…] (cycles the shorter).
export function PZip(a, b) {
    const A = Array.isArray(a) ? a : [a], B = Array.isArray(b) ? b : [b];
    const n = Math.max(A.length, B.length), out = [];
    for (let i = 0; i < n; i++) { out.push(A[i % A.length], B[i % B.length]); }
    return cyc(out);
}

// PReverse(seq) — the sequence reversed, cycling.
export function PReverse(seq) {
    const a = (Array.isArray(seq) ? seq : [seq]).slice().reverse();
    return cyc(a.length ? a : [0]);
}

// PMorse(text, point, tiret) — Morse-code rhythm as a `dur` pattern: dots = point,
// dashes = tiret, a longer gap between letters. e.g. dur=PMorse("sos")
const _MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---',
    P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--',
    X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };
export function PMorse(text, point = 1 / 4, tiret = 3 / 4) {
    const durs = [];
    for (const ch of String(text)) {
        const code = _MORSE[ch.toUpperCase()];
        if (!code) continue;
        for (const sym of code) durs.push(sym === '.' ? point : tiret);
        durs.push(5 * point);   // inter-letter gap
    }
    return cyc(durs.length ? durs : [point]);
}

// PGauss(mean=0, deviation=1) — Gaussian-distributed random per step (Box–Muller).
// Integer mean → rounded ints, like FoxDot. e.g. pan=PGauss(0, 0.3)
export function PGauss(mean = 0, deviation = 1) {
    const isInt = Number.isInteger(mean);
    const gauss = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const g = mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        return isInt ? Math.round(g) : g;
    };
    return { get: () => gauss() };
}

// ── Range / step ─────────────────────────────────────────────────────────────

// PRange(lo, hi, step=1) — cycle through arithmetic range
export function PRange(lo, hi, step = 1) {
    const arr = [];
    if (step > 0)      for (let v = lo; v < hi; v += step) arr.push(v);
    else if (step < 0) for (let v = lo; v > hi; v += step) arr.push(v);
    if (!arr.length) arr.push(lo);   // degenerate (step 0, lo≥hi) → a constant, no hang/NaN
    return { get: (s) => arr[(((s | 0) % arr.length) + arr.length) % arr.length] };
}

// PStep(n, value, default=0) — FoxDot form: `value` every n steps (at 0, n, 2n…),
// `default` otherwise → PStep(4,7,6) = [7,6,6,6]. If the first arg is an object it
// falls back to the sparse {stepIndex: value} map form: PStep({0:7, 4:2}, cycle).
export function PStep(n, value = 1, dflt = 0) {
    // Period `n` may be a pattern/timevar (or list) → resolve it per step, so
    // PStep(var([4,2,3], 2), 7, 9) shifts its accent grid over time.
    if (n != null && typeof n === 'object' && (typeof n.get === 'function' || Array.isArray(n))) {
        return { get: (step) => {
            const len = Math.max(1, Math.round(patGet(n, step)) || 1);
            return (((step % len) + len) % len === 0) ? patGet(value, step) : patGet(dflt, step);
        } };
    }
    if (typeof n === 'number') {
        const len = Math.max(1, Math.round(n));
        // value / default may themselves be patterns or lists ({5,6,7} → PRand,
        // [5,6,7] cycling) — resolve per step so PStep(4, {5,6,7}, {6,4,3}) works.
        return { get: (step) => (((step % len) + len) % len === 0 ? patGet(value, step) : patGet(dflt, step)) };
    }
    const mapping = n, cycle = value === 1 ? null : value;
    const max = cycle ?? (Math.max(...Object.keys(mapping).map(Number)) + 1);
    return { get: (step) => { const s = ((step % max) + max) % max; return mapping[s] ?? 0; } };
}

// ── Shape ────────────────────────────────────────────────────────────────────

// PSine(lo, hi, steps) — sinusoidal sweep
export function PSine(lo = 0, hi = 1, steps = 16) {
    return {
        get: (step) => {
            const t = ((((step | 0) % steps) + steps) % steps) / steps;
            return lo + (hi - lo) * (Math.sin(t * Math.PI * 2) * 0.5 + 0.5);
        }
    };
}

// PTri(lo, hi, steps) — triangular sweep
export function PTri(lo = 0, hi = 1, steps = 16) {
    return {
        get: (step) => {
            const t = ((((step | 0) % steps) + steps) % steps) / steps;
            return lo + (hi - lo) * (t < 0.5 ? t * 2 : (1 - t) * 2);
        }
    };
}

// ── Markov chains ────────────────────────────────────────────────────────────

// PChain(mapping) — {value: [nextValues...], ...} Markov chain
export function PChain(mapping) {
    const keys = Object.keys(mapping);
    let cur = keys[0];
    return {
        get: () => {
            const nexts = mapping[cur];
            cur = (!nexts || !nexts.length)
                ? keys[Math.floor(Math.random() * keys.length)]
                : String(nexts[Math.floor(Math.random() * nexts.length)]);
            return isNaN(Number(cur)) ? cur : Number(cur);
        }
    };
}

export const PMarkov = PChain;

// ── Grooves & generative (CrashServer patterns) ──────────────────────────────
const cyc = (arr) => ({ get: (s) => arr[(((s | 0) % arr.length) + arr.length) % arr.length] });

// Pacc(ptype, steps, intensity) — accent pattern for amp/amplify.
// ptype: 0-6 or name (backbeat fourfloor offbeat ghost synco tresillo halftime).
const _ACCENT = {
    0: [0.6,0.4,0.4,0.4,1.0,0.4,0.4,0.4, 0.6,0.4,0.4,0.4,1.0,0.4,0.4,0.4],
    1: [1.0,0.4,0.4,0.4,1.0,0.4,0.4,0.4, 1.0,0.4,0.4,0.4,1.0,0.4,0.4,0.4],
    2: [0.4,0.4,1.0,0.4,0.4,0.4,1.0,0.4, 0.4,0.4,1.0,0.4,0.4,0.4,1.0,0.4],
    3: [1.0,0.25,0.3,0.25,0.7,0.25,0.3,0.25, 1.0,0.25,0.3,0.25,0.7,0.25,0.3,0.25],
    4: [0.4,0.4,1.0,0.4,0.4,1.0,0.4,0.4, 1.0,0.4,0.4,0.4,1.0,0.4,0.4,1.0],
    5: [1.0,0.3,0.3,1.0,0.3,0.3,1.0,0.3, 1.0,0.3,0.3,1.0,0.3,0.3,1.0,0.3],
    6: [1.0,0.3,0.5,0.3,0.7,0.3,0.5,0.3, 0.5,0.3,0.4,0.3,0.6,0.3,0.4,0.3],
};
const _ACCENT_NAMES = { backbeat:0, fourfloor:1, offbeat:2, ghost:3, synco:4, tresillo:5, halftime:6 };
export function Pacc(ptype = 0, steps = 16, intensity = 1.0) {
    if (typeof ptype === 'string') ptype = _ACCENT_NAMES[ptype.toLowerCase()] ?? 0;
    const tpl = _ACCENT[ptype] ?? _ACCENT[0];
    const data = [];
    for (let i = 0; i < steps; i++) {
        const v = tpl[i % tpl.length];
        data.push(intensity >= 1 ? v : 0.7 + (v - 0.7) * intensity);
    }
    return cyc(data);
}

// PSwing(amount, steps) — on-beats 1.0, off-beats (1 - amount*variation)
export function PSwing(amount = 0.1, steps = 8) {
    const data = [], variation = [1.0, 0.85, 0.95, 0.75];
    for (let i = 0; i < Math.floor(steps / 2); i++) { const v = amount * variation[i % 4]; data.push(1.0, 1.0 - v); }
    return cyc(data.length ? data : [1]);
}

// PBin(number) — binary digits of number (random if 0): PBin(8) → [1,0,0,0]
export function PBin(number = 0) {
    if (!number) number = Math.floor(Math.random() * 999990) + 10;
    return cyc((number >>> 0).toString(2).split('').map(Number));
}

// PFDur((n,k), …) — layered Euclidean density: 1 where any layer hits.
// Pairs may be written as tuples (3,8) — which transpile to groups — or arrays [3,8].
export function PFDur(...pairs) {
    // Accept bare numbers too — PFDur(3, 8) or PFDur(3, 8, 5, 8) pair up into (n,k)
    // layers, so it works like PEuclid(n,k) instead of silently returning all 0s when
    // the tuples are omitted.
    if (pairs.length >= 2 && pairs.every(p => typeof p === 'number')) {
        const paired = [];
        for (let i = 0; i + 1 < pairs.length; i += 2) paired.push([pairs[i], pairs[i + 1]]);
        pairs = paired;
    }
    pairs = pairs.map(p => isGroup(p) ? p.__group : p).filter(p => Array.isArray(p) && p.length >= 2);
    if (!pairs.length) return cyc([0]);
    const k = Math.max(...pairs.map(p => p[1]));
    const layers = pairs.map(([n, kk]) => _euclid(kk, n));   // n pulses in kk steps
    const result = [];
    for (let i = 0; i < k; i++) result.push(Math.max(...layers.map(L => L[i % L.length])));
    return cyc(result);
}

// PLife(chaos, low, high, steps, seed) — elementary cellular-automaton values in [low,high]
// chaos 0..1 walks a gradient of Wolfram rules (fixed/periodic -> edge-of-chaos ->
// fully chaotic); two rules interfere (XOR) increasingly as chaos rises, seed points
// and sampling window both widen with chaos, and each step's value is read as a raw
// bit-pattern (not a density average, which is a low-pass filter that collapses
// everything toward the mean) so the full [low,high] range is actually used.
const _PLIFE_RULE_CURVE = [
    [0.00, 0,   0],
    [0.08, 250, 250],
    [0.16, 108, 232],
    [0.24, 232, 178],
    [0.32, 178, 122],
    [0.40, 122, 110],
    [0.48, 110, 54],
    [0.56, 54,  126],
    [0.64, 126, 90],
    [0.72, 90,  60],
    [0.80, 60,  45],
    [0.88, 45,  150],
    [0.94, 150, 182],
    [1.00, 30,  105],
];
function _plifeMakeRulemap(rule) {
    const m = {};
    for (let i = 0; i < 8; i++) m[`${(i>>2)&1}${(i>>1)&1}${i&1}`] = (rule >> i) & 1;
    return m;
}
function _plifeRng(seed) {
    // small deterministic PRNG (mulberry32) so a given seed always replays identically
    let s = (seed >>> 0) || (Math.random() * 0xffffffff) >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function PLife(chaos = 0, low = 0, high = 1, steps = 16, seed = null) {
    chaos = Math.max(0, Math.min(1, chaos));
    steps = Math.max(1, steps | 0);
    const useInt = Number.isInteger(low) && Number.isInteger(high);
    const rng = _plifeRng(seed);

    let rule, rule2, blend;
    {
        const curve = _PLIFE_RULE_CURVE;
        rule = curve[curve.length - 1][1]; rule2 = curve[curve.length - 1][2]; blend = chaos;
        for (let i = 0; i < curve.length - 1; i++) {
            const [x0, r0, r0b] = curve[i], [x1, r1, r1b] = curve[i+1];
            if (chaos <= x1) {
                const span = (x1 - x0) || 1;
                const t = (chaos - x0) / span;
                [rule, rule2] = t < 0.5 ? [r0, r0b] : [r1, r1b];
                blend = chaos * t;
                break;
            }
        }
    }
    const radius = 1 + Math.round(chaos * 3);
    const ruleMap1 = _plifeMakeRulemap(rule);
    const ruleMap2 = _plifeMakeRulemap(rule2);

    const seedRow = () => {
        const row = Array(steps).fill(0);
        row[steps >> 1] = 1;
        const nExtra = Math.round(chaos * (steps / 3));
        for (let i = 0; i < nExtra; i++) row[Math.floor(rng() * steps)] = 1;
        return row;
    };
    const grid = [seedRow()];
    const grow = (n) => {
        while (grid.length < n) {
            const last = grid[grid.length - 1], nr = Array(steps).fill(0);
            for (let j = 0; j < steps; j++) {
                const l = last[(j-1+steps)%steps], c = last[j], rt = last[(j+1)%steps];
                const key = `${l}${c}${rt}`;
                const v1 = ruleMap1[key], v2 = ruleMap2[key];
                nr[j] = rng() < blend ? (v1 ^ v2) : v1;
            }
            grid.push(nr);
        }
    };
    grow(300);
    return { get(index) {
        index = index | 0;
        const r = Math.floor(index / steps), c = ((index % steps) + steps) % steps;
        if (chaos <= 0) return high;
        if (r + 1 >= grid.length) grow(r + 256);
        // read a window of the current row as a raw binary number
        let raw = 0;
        for (let dc = -radius; dc <= radius; dc++) raw = (raw << 1) | grid[r][((c+dc)%steps+steps)%steps];
        const maxraw = (1 << (2 * radius + 1)) - 1;
        const frac = maxraw ? raw / maxraw : 0;
        const val = low + (high - low) * frac;
        return useInt ? Math.round(val) : val;
    }};
}

// ── Harmony & chords ──────────────────────────────────────────────────────────
// Chords are built diatonically — as offsets in SCALE DEGREES from a root degree
// (stack of thirds = +0,+2,+4…), so the quality follows the current Scale/Root
// automatically (PChord(0) in major = major triad, PChord(1) = the ii minor).
// Each chord is a _group → its notes fire simultaneously.
const _CHORD_TYPES = {
    '': [0, 2, 4], 'triad': [0, 2, 4], '3': [0, 2, 4],
    '5': [0, 4], 'power': [0, 4], 'oct': [0, 7],
    '6': [0, 2, 4, 5], '7': [0, 2, 4, 6], 'maj7': [0, 2, 4, 6], 'm7': [0, 2, 4, 6],
    '9': [0, 2, 4, 6, 8], '11': [0, 2, 4, 6, 8, 10], '13': [0, 2, 4, 6, 8, 10, 12],
    'sus2': [0, 1, 4], 'sus4': [0, 3, 4], 'add9': [0, 2, 4, 7],
};

// PChord(degree, type) — a diatonic chord group on `degree`. e.g. PChord(0, "7").
const _moves = (v) => v != null && typeof v === 'object' && (typeof v.get === 'function' || Array.isArray(v));
const _offsetsFor = (t) => _CHORD_TYPES[String(t).toLowerCase().trim()] || _CHORD_TYPES[''];
const _MAX_VOICES = Math.max(...Object.values(_CHORD_TYPES).map(a => a.length));   // 7 (a 13th)

export function PChord(degree = 0, type = '') {
    const rootMoves = _moves(degree);
    const typeMoves = _moves(type);
    const rootAt = (step) => Number(patGet(degree, step)) || 0;

    // A pattern/timevar TYPE → the chord QUALITY changes over time, so the voice count
    // varies (triad=3 … 13th=7). Build a group sized to the largest chord; each voice
    // resolves the current type per step and plays its note, or a REST when that voice
    // isn't part of the current (smaller) chord: PChord(0, var([7, 9, 6])) morphs quality.
    if (typeMoves) {
        return _group(...Array.from({ length: _MAX_VOICES }, (_v, vi) => ({ get: (step) => {
            const off = _offsetsFor(patGet(type, step));
            return vi < off.length ? rootAt(step) + off[vi] : REST;
        } })));
    }

    const off = _offsetsFor(type);
    // A pattern/timevar/list ROOT → each voice resolves (root + offset) per step, so
    // the whole chord can move: PChord(var([1,2,3]), "9").
    if (rootMoves) {
        return _group(...off.map(o => ({ get: (step) => rootAt(step) + o })));
    }
    return _group(...off.map(o => degree + o));
}

// Roman-numeral → scale degree (I/i=0 … VII/vii=6). Case is ignored (quality is
// diatonic anyway); a trailing suffix (7, 9, sus4…) selects the chord type.
const _ROMAN = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };
function _parseRoman(tok) {
    const m = String(tok).trim().match(/^([ivx]+)(.*)$/i);
    if (!m) return null;
    const deg = _ROMAN[m[1].toLowerCase()];
    if (deg === undefined) return null;
    return { deg, type: m[2] };
}

// PRoman("I IV V vi") — a progression: each numeral becomes a diatonic chord
// group, stepping one chord per step. Suffixes work: "V7", "ii7", "Isus4".
export function PRoman(str) {
    return Ppat(String(str).split(/[\s,|]+/).filter(Boolean).map(t => {
        const p = _parseRoman(t); return p ? PChord(p.deg, p.type) : 0;
    }));
}

// PProg(name) — a named chord progression (→ PRoman). Unknown names are treated
// as a roman string. e.g. PProg("50s"), PProg("251"), PProg("I V vi IV").
const _PROGS = {
    '50s': 'I vi IV V', 'doowop': 'I vi IV V',
    'pop': 'I V vi IV', 'axis': 'I V vi IV',
    '251': 'ii V I', 'jazz': 'ii V I',
    'blues': 'I I I I IV IV I I V IV I V',
    'andalusian': 'i VII VI V', 'andalus': 'i VII VI V',
    'minor': 'i iv v', 'canon': 'I V vi iii IV I IV V', 'pachelbel': 'I V vi iii IV I IV V',
    // cadences (functional endings)
    'perfect': 'V I', 'authentic': 'V I', 'plagal': 'IV I', 'amen': 'IV I',
    'half': 'I V', 'deceptive': 'V vi', 'interrupted': 'V vi',
};
export function PProg(name = '50s') {
    if (typeof name === 'number' || (name && typeof name.get === 'function'))
        name = optName(name, Object.keys(_PROGS));
    return Ppat(PRoman(_PROGS[String(name).toLowerCase()] || name));
}

// ── Rhythm vocabulary ─────────────────────────────────────────────────────────

// Classic clave / bell onset positions on a 16-step grid.
const _CLAVES = {
    'son': [0, 3, 6, 10, 12], 'rumba': [0, 3, 7, 10, 12], 'bossa': [0, 3, 6, 10, 13],
    'shiko': [0, 4, 6, 10, 12], 'soukous': [0, 3, 6, 10, 11], 'gahu': [0, 3, 6, 10, 14],
    'son23': [4, 6, 10, 13, 16].map(x => x % 16), 'rumba23': [4, 7, 10, 13, 16].map(x => x % 16),
};
// PClave(name, hit, rest) — a 16-step clave play() string. e.g. play(PClave("son")).
export function PClave(name = 'son', hit = 'x', rest = '.') {
    name = optName(name, Object.keys(_CLAVES));
    const set = new Set(_CLAVES[name] || _CLAVES['son']);
    let s = ''; for (let i = 0; i < 16; i++) s += set.has(i) ? hit : rest;
    return s;
}

// PRhythm([1, (3,8)]) — FoxDot's rhythm parser: any (a,b) tuple/group or [a,b]
// list expands to its PDur(a,b) durations inline; plain numbers pass through.
export function PRhythm(durations) {
    const arr = Array.isArray(durations) ? durations : [durations];
    const out = [];
    for (const item of arr) {
        const grp = isGroup(item) ? item.__group : (Array.isArray(item) ? item : null);
        if (grp && grp.length >= 2) { for (const d of _pdurList(grp[0], grp[1])) out.push(d); }
        else out.push(item);
    }
    return Ppat(out);
}

// PPoly(a, b, span=1) — cross-rhythm: merge an a-pulse and a b-pulse evenly over
// `span` beats, returning the gap durations. PPoly(3, 4) → a 3-against-4 groove.
export function PPoly(a, b, span = 1) {
    const pts = new Set();
    for (let i = 0; i < a; i++) pts.add(i / a);
    for (let i = 0; i < b; i++) pts.add(i / b);
    const s = [...pts].sort((x, y) => x - y), out = [];
    for (let i = 0; i < s.length; i++) out.push(((i + 1 < s.length ? s[i + 1] : 1) - s[i]) * span);
    return out;
}

// ── Chaos & dynamical systems ─────────────────────────────────────────────────
// Value streams from chaotic maps, normalised into [lo, hi]. Deterministic once
// seeded, but non-repeating — great for organic drift on any param.

// PLogistic(r, x0, lo, hi) — the logistic map x←r·x·(1-x). r≈3.6–4 is chaotic.
export function PLogistic(r = 3.9, x0 = 0.5, lo = 0, hi = 1) {
    let x = x0;
    return { get: () => { x = r * x * (1 - x); return lo + (hi - lo) * Math.min(1, Math.max(0, x)); } };
}

// PBrown(lo, hi, step) — brownian random walk (float), reflecting at the bounds.
export function PBrown(lo = 0, hi = 1, step = 0.1) {
    let x = (lo + hi) / 2;
    return { get: () => {
        x += (Math.random() * 2 - 1) * step * (hi - lo);
        if (x < lo) x = lo + (lo - x); if (x > hi) x = hi - (x - hi);
        x = Math.min(hi, Math.max(lo, x)); return x;
    } };
}

// PHenon(lo, hi, a, b) / PLorenz(lo, hi, dt) — strange-attractor coordinate
// streams (the classic Hénon map / Lorenz system), mapped into [lo, hi].
export function PHenon(lo = 0, hi = 1, a = 1.4, b = 0.3) {
    let x = 0, y = 0;
    return { get: () => { const nx = 1 - a * x * x + y; y = b * x; x = nx; return lo + (hi - lo) * Math.min(1, Math.max(0, (x + 1.3) / 2.6)); } };
}
export function PLorenz(lo = 0, hi = 1, dt = 0.01) {
    let x = 0.1, y = 0, z = 0; const s = 10, rr = 28, bb = 8 / 3;
    return { get: () => {
        for (let k = 0; k < 8; k++) { const dx = s * (y - x), dy = x * (rr - z) - y, dz = x * y - bb * z; x += dx * dt; y += dy * dt; z += dz * dt; }
        return lo + (hi - lo) * Math.min(1, Math.max(0, (x + 20) / 40));
    } };
}

// ── Number sequences ──────────────────────────────────────────────────────────

// PPrime(start=2) — successive prime numbers from `start`.
export function PPrime(start = 2) {
    const isP = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    const cache = []; let n = Math.max(2, Math.floor(start));
    return { get: (i) => { i = i | 0; while (cache.length <= i) { while (!isP(n)) n++; cache.push(n++); } return cache[i]; } };
}

// PThue() — the Thue–Morse sequence (parity of set bits): 0,1,1,0,1,0,0,1,…
// Self-similar and non-periodic — a great gate for evolving rhythms/amps.
export function PThue() { return { get: (i) => { let b = 0, x = i | 0; while (x) { b ^= (x & 1); x >>= 1; } return b; } }; }

// PGrowArp(seq) — a growing arpeggio: [a], [a,b], [a,b,c]… flattened.
//   PGrowArp([0,2,4,7]) → 0, 0,2, 0,2,4, 0,2,4,7
export function PGrowArp(seq) {
    const a = Array.isArray(seq) ? seq : [seq], out = [];
    for (let n = 1; n <= a.length; n++) for (let j = 0; j < n; j++) out.push(a[j]);
    return Ppat(out);
}

// PTree(seed, depth, step) — a self-similar melody (L-system): each degree d
// expands to [d, d+step], applied `depth` times. PTree([0],3,2) → 0,2,2,4,2,4,4,6.
export function PTree(seed = [0], depth = 3, step = 2) {
    let cur = (Array.isArray(seed) ? seed : [seed]).slice();
    for (let d = 0; d < depth; d++) { const next = []; for (const v of cur) next.push(v, v + step); cur = next; }
    return Ppat(cur);
}

// ── Curve shapes ──────────────────────────────────────────────────────────────
// Per-step LFO curves over `steps` steps — like PSine/PTri, for any continuous
// param (great on dur/sus too: PSlide for swells, PPulse for stabs).

// PExp(lo, hi, steps) — exponential ramp (geometric when lo,hi > 0).
export function PExp(lo = 0, hi = 1, steps = 16) {
    return { get: (step) => {
        const t = ((((step | 0) % steps) + steps) % steps) / steps;
        if (lo > 0 && hi > 0) return lo * Math.pow(hi / lo, t);
        return lo + (hi - lo) * (Math.exp(2 * t) - 1) / (Math.exp(2) - 1);
    } };
}

// PPulse(lo, hi, steps, width=0.5) — square/pulse wave; width is the duty cycle
// (fraction of the cycle spent at hi). width=0.1 → short stabs.
export function PPulse(lo = 0, hi = 1, steps = 16, width = 0.5) {
    return { get: (step) => (((((step | 0) % steps) + steps) % steps) / steps < width ? hi : lo) };
}

// PSlide(lo, hi, steps) — smoothstep-eased ramp (soft S-curve lo→hi).
export function PSlide(lo = 0, hi = 1, steps = 16) {
    return { get: (step) => {
        const t = ((((step | 0) % steps) + steps) % steps) / steps;
        return lo + (hi - lo) * t * t * (3 - 2 * t);
    } };
}

// ── Melody / note generators ──────────────────────────────────────────────────

// motif(n, range, maxStep) — a FROZEN n-note motif (a random walk, sampled once)
// that then repeats. Like melody()[:n] but in one call — a stable phrase.
// motif(n, range, maxStep, reroll) — a frozen random melody of n notes. With
// reroll > 0, it regenerates itself every `reroll` beats (self-contained, no
// reroll() call needed): motif(8, 7, 2, 4) picks a fresh motif every 4 beats.
export function motif(n = 4, range = 7, maxStep = 2, reroll = 0) {
    const gen = () => { const m = melody(range, maxStep), out = []; for (let i = 0; i < n; i++) out.push(m.get(i)); return out; };
    let notes = gen();
    if (reroll > 0) {
        let window = Math.floor(currentBeat() / reroll);
        return { get: (step) => {
            const w = Math.floor(currentBeat() / reroll);
            if (w !== window) { window = w; notes = gen(); }
            return notes[(((step | 0) % n) + n) % n];
        } };
    }
    return { get: (step) => notes[(((step | 0) % n) + n) % n] };
}

// arp(degrees, mode) — arpeggiate a set of chord degrees continuously.
// mode: up | down | updown | downup | random. e.g. arp([0, 4, 7], "updown").
// Resolve a named-option argument to a canonical lowercase string. Accepts a
// string ("updown"), an INTEGER index into `names` (wraps), or a var/timevar/
// pattern ({get}) sampled at `step` (so the option can vary over time). Lets
// arp/PGroove/PContour/… take arp(deg, 2) or arp(deg, var(["up","down"], 4)).
export function optName(val, names, step = 0) {
    if (val && typeof val.get === 'function') val = val.get(step);
    if (typeof val === 'number' && names.length)
        return names[((Math.round(val) % names.length) + names.length) % names.length];
    return String(val).toLowerCase();
}

const _ARP_MODES = ['up', 'down', 'updown', 'downup', 'random'];
// shift a degree element up by n (number, each group member, or leave generators)
function _shiftDeg(el, n) {
    if (!n) return el;
    if (typeof el === 'number') return el + n;
    if (isGroup(el)) return _group(...el.__group.map(x => _shiftDeg(x, n)));
    return el;
}
// arp(degrees, mode, octaves, perOct) — reorder degrees by mode and cycle them one
// per step. mode: a NAME (up/down/updown/downup/random), an INTEGER index, or a var
// (mode changes over time). octaves>1 spans the pattern across octaves (+perOct
// degrees each; perOct=7 = a diatonic octave). e.g. arp([0,4,7], 2, 2).
export function arp(degrees, mode = 'up', octaves = 1, perOct = 7) {
    let base = (Array.isArray(degrees) ? degrees : [degrees]).slice();
    const oc = Math.max(1, Math.round(octaves) || 1);
    if (oc > 1) {
        const spanned = [];
        for (let o = 0; o < oc; o++) for (const d of base) spanned.push(_shiftDeg(d, o * perOct));
        base = spanned;
    }
    const order = (m) => {
        let seq = base.slice();
        if (m === 'down') seq.reverse();
        else if (m === 'updown') seq = seq.concat(seq.slice(1, -1).reverse());
        else if (m === 'downup') seq = seq.slice().reverse().concat(seq.slice(1, -1));
        return seq;
    };
    // Resolve a chosen element: a nested generator ({get} — PRand, a var, <alt>…)
    // is sampled at the step so it actually varies; groups/numbers pass through.
    const rez = (el, step) => (el && typeof el.get === 'function') ? el.get(step) : el;
    const pick = (seq, step) => rez(seq[((((step | 0) % seq.length) + seq.length) % seq.length)], step);
    const rnd  = (seq, step) => rez(seq[Math.floor(Math.random() * seq.length)], step);
    if (mode && typeof mode.get === 'function') {          // var/pattern → mode varies over time
        return { get: (step) => {
            const m = optName(mode, _ARP_MODES, step), seq = order(m);
            return m === 'random' ? rnd(seq, step) : pick(seq, step);
        } };
    }
    const m = optName(mode, _ARP_MODES), seq = order(m);
    if (m === 'random') return { get: (step) => rnd(seq, step) };
    return { get: (step) => pick(seq, step) };
}

// PContour(shape, n, range) — a melodic contour: n scale degrees in [0,range]
// following a shape. shape: up | down | arch | valley | wave. Great to sketch a
// phrase whose overall direction you control, leaving the scale to keep it sweet.
// shape may be a NAME (up/down/arch/valley/wave), a NUMBER (index into that list),
// or an ARRAY of control points to interpolate your own contour over n steps.
const _CONTOURS = ['up', 'down', 'arch', 'valley', 'wave'];
export function PContour(shape = 'arch', n = 8, range = 7) {
    // Custom contour: interpolate the control points across n steps.
    if (Array.isArray(shape)) {
        const pts = shape.map(Number), notes = [];
        for (let i = 0; i < n; i++) {
            const x = (n > 1 ? i / (n - 1) : 0) * (pts.length - 1);
            const a = Math.floor(x), b = Math.min(pts.length - 1, a + 1);
            notes.push(Math.round(pts[a] + (pts[b] - pts[a]) * (x - a)));
        }
        return { get: (step) => notes[(((step | 0) % n) + n) % n] };
    }
    shape = optName(shape, _CONTOURS);   // string / int / var → contour name
    const curve = (t) => shape === 'up' ? t
        : shape === 'down' ? 1 - t
        : shape === 'arch' ? Math.sin(t * Math.PI)
        : shape === 'valley' ? 1 - Math.sin(t * Math.PI)
        : shape === 'wave' ? (Math.sin(t * Math.PI * 2) * 0.5 + 0.5)
        : t;
    const notes = [];
    for (let i = 0; i < n; i++) notes.push(Math.round(curve(n > 1 ? i / (n - 1) : 0) * range));
    return { get: (step) => notes[(((step | 0) % n) + n) % n] };
}

// ── Duration feels ────────────────────────────────────────────────────────────
// Named rhythmic feels as a cyclic dur pattern (works for sus too).
const _GROOVES = {
    straight: [1], eighths: [0.5], sixteenths: [0.25],
    swing: [2 / 3, 1 / 3], swing16: [1 / 3, 1 / 6], shuffle: [2 / 3, 1 / 3], triplet: [1 / 3, 1 / 3, 1 / 3],
    dotted: [0.75, 0.25], gallop: [0.5, 0.25, 0.25], revgallop: [0.25, 0.25, 0.5],
    tresillo: [0.75, 0.75, 0.5], habanera: [0.75, 0.25, 0.5, 0.5], clave: [0.75, 0.75, 0.5],
};
// PGroove(name) — a dur pattern for a feel. The selector can be a NAME ("swing"), an
// INTEGER (indexes the groove list), a VAR (feel changes over time), or a LIST/pattern
// ([0, 1, 2] cycles through grooves). e.g. dur=PGroove("swing") · PGroove(3) ·
// PGroove(var([0,1],8)) · PGroove([0, 2, 5]).
export function PGroove(name = 'swing') {
    const keys = Object.keys(_GROOVES);
    // A var / array / nested pattern → resolve the selector each step (patGet handles
    // .get(), arrays and scalars uniformly), then look up that step's groove.
    if (name && (typeof name.get === 'function' || Array.isArray(name))) {
        return { get: (step) => {
            const g = _GROOVES[optName(patGet(name, step), keys, step)] || _GROOVES['straight'];
            return g[(((step | 0) % g.length) + g.length) % g.length];
        } };
    }
    return cyc((_GROOVES[optName(name, keys)] || _GROOVES['straight']).slice());
}

// ── Composition helpers ───────────────────────────────────────────────────────

// PCircle(n, start, type) — the DIATONIC circle of fifths as scale degrees:
// each step moves down a fifth (+3 scale degrees), giving I IV vii iii vi ii V …
// Because these are scale degrees, it stays coherent with the current Root/Scale
// automatically. Pass a chord `type` to get chord groups instead of single roots.
//   d1 >> pluck(PCircle(8))            # roots around the circle
//   k1 >> keys(PCircle(8, 0, "7"))     # a turnaround of 7th chords
export function PCircle(n = 8, start = 0, type = null) {
    const degs = [];
    for (let i = 0, d = start; i < n; i++, d += 3) degs.push(((d % 7) + 7) % 7);
    return Ppat(type != null ? degs.map(x => PChord(x, type)) : degs);
}

// unison(n, detune, spread) — pan positions + semitone pshift offsets (FoxDot
// formula). spread (0–100, default 100) scales the stereo width of the voices.
export function unisonSpread(n, detune, spread = 100) {
    const pan = [], pshift = [];
    const uni = (n % 2 === 0) ? n : n - 1;
    const w = spread / 100;
    for (let i = 1; i <= Math.floor(uni / 2); i++) { pan.push(w*2*i/uni); pan.unshift(-w*2*i/uni); }
    for (let i = 1; i <= Math.floor(uni / 2); i++) { pshift.push(detune*(i/(uni/2))); pshift.unshift(detune*-(i/(uni/2))); }
    if (n % 2 !== 0 && n > 1) { pan.splice(Math.floor(pan.length/2), 0, 0); pshift.splice(Math.floor(pan.length/2), 0, 0); }
    return { pan, pshift };
}
