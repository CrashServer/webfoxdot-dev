// Pattern helpers — all patterns expose a .get(step) method.
// patGet resolves any value: plain scalar, array, or pattern object.

import { isEnv, envValue } from './timevars.js';

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
            (this._modifiers ??= []).push(parseModifier(p, a));
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

// PDur(k, n, dur=1) — Euclidean durations: k pulses in n steps
// PDur(k, n, rotate=0, dur=1) — Euclidean durations: k pulses in n steps. `rotate`
// cyclically shifts the resulting duration list (FoxDot's `start`).
export function PDur(k, n, rotate = 0, dur = 1) {
    const steps = Array(n).fill(0);
    for (let i = 0; i < k; i++) steps[Math.round(i * n / k)] = 1;
    const durs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
        if (steps[i] === 1 && i > 0) { durs.push(acc * dur / n); acc = 1; }
        else acc++;
    }
    if (acc > 0) durs.push(acc * dur / n);
    if (rotate) { const r = ((Math.round(rotate) % durs.length) + durs.length) % durs.length; return durs.slice(r).concat(durs.slice(0, r)); }
    return durs;
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
    if (low === 0 && high === 0) return digits;
    return digits.map(d => { const v = low + (d / 9) * (high - low); return Math.round(v / rnd) * rnd; });
}

// PSum(n, total) — n durations that sum to total, e.g. PSum(3,8) → [3,3,2].
export function PSum(n, total, lim = 0.125) {
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    let data = [total + 1], step = 1;
    while (sum(data) > total) { data = Array(n).fill(step); step *= 0.5; }
    let i = 0;
    while (sum(data) < total && step >= lim) {
        if (sum(data) + step > total) step *= 0.5;
        else { data[i % n] += step; i++; }
    }
    return data;
}

// PDelta(deltas, start=0) — cumulative sum: start, start+d0, start+d0+d1, …
export function PDelta(deltas, start = 0) {
    const arr = Array.isArray(deltas) ? deltas : [deltas];
    return { get: (i) => { let v = start; for (let j = 0; j < i; j++) v += Number(arr[j % arr.length]) || 0; return v; } };
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
    return res;
}

// PJoin(...patterns) — concatenate several lists into one.
export function PJoin(...patterns) {
    const out = [];
    for (const p of patterns) for (const x of (Array.isArray(p) ? p : [p])) out.push(x);
    return out;
}

// PDelay(k, n, rotate=0, dur=1) — a group of onset offsets (delay times) from a
// Euclidean rhythm, e.g. use as delay=PDelay(3, 8).
export function PDelay(k, n, rotate = 0, dur = 1) {
    const durs = PDur(k, n, rotate, dur);
    const out = []; let acc = 0;
    for (const d of durs) { out.push(acc); acc += d; }
    return _group(...out);
}

// ── More FoxDot generators ────────────────────────────────────────────────────

// P10(n) — n-length list of random 1s and 0s (FoxDot P10). e.g. play(P10(8)).
export function P10(n = 8) { const out = []; for (let i = 0; i < (n | 0); i++) out.push(Math.random() < 0.5 ? 0 : 1); return out; }

// PSaw(lo, hi, steps) — rising sawtooth ramp (companion to PSine/PTri).
export function PSaw(lo = 0, hi = 1, steps = 16) {
    return { get: (step) => { const t = ((((step | 0) % steps) + steps) % steps) / steps; return lo + (hi - lo) * t; } };
}

// PSq(a, b, c) — powers: [a^b, (a+1)^b, … ] for c terms (FoxDot PSq).
export function PSq(a = 1, b = 2, c = 3) { const out = []; for (let x = a; x < a + c; x++) out.push(Math.pow(x, b)); return out; }

// PZero() — a constant 0 generator. PBool(seq) — every nonzero → 1, else 0.
export function PZero() { return { get: () => 0 }; }
export function PBool(seq) { return (Array.isArray(seq) ? seq : [seq]).map(x => (x ? 1 : 0)); }

// PFibMod — FoxDot's Fibonacci generator (same series as PFib).
export const PFibMod = PFib;

// PPairs(seq, func) — lace a sequence with a second obtained by func(item);
// default func is n → 8 - n. PPairs([0,2,4]) → [0,8,2,6,4,4].
export function PPairs(seq, func = (n) => 8 - n) {
    const out = [];
    for (const item of (Array.isArray(seq) ? seq : [seq])) { out.push(item); out.push(func(item)); }
    return out;
}

// PChar(string, start=0) — letters → degrees (a=0, b=1, …), non-letters → 0.
export function PChar(string, start = 0) {
    const out = [];
    for (const ch of String(string)) { const c = ch.toLowerCase(); out.push((c >= 'a' && c <= 'z') ? c.charCodeAt(0) - 97 + start : 0); }
    return out;
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
    const prev = [], dearth = tokens.map(() => 0);
    return { get: () => {
        const index = prev.length;
        for (let i = 0; i < tokens.length; i++) {
            const d1 = prev.reduce((a, x) => a + (x === tokens[i] ? 1 : 0), 0);
            dearth[i] = probs[i] * (index + 1) - d1;
        }
        let bi = 0; for (let i = 1; i < dearth.length; i++) if (dearth[i] > dearth[bi]) bi = i;
        const value = tokens[bi]; prev.push(value); return value;
    }};
}

// PPing(arr) — ping-pong through array [0,1,2,3,2,1,0,1,...]
export function PPing(arr) {
    const fwd = [...arr], rev = [...arr].reverse().slice(1, -1);
    const loop = [...fwd, ...rev];
    return { get: (i) => loop[i % loop.length] };
}

// ── Repetition / rotation ─────────────────────────────────────────────────────

// PStutter(seq, n) — each value repeated n times: [0,2,4] n=2 → [0,0,2,2,4,4]
export function PStutter(seq, n = 2) {
    const arr  = Array.isArray(seq) ? seq : [seq];
    const nArr = Array.isArray(n)   ? n   : null;
    const flat = arr.flatMap((v, i) => Array(nArr ? nArr[i % nArr.length] : n).fill(v));
    return { get: (step) => flat[step % flat.length] };
}

// PAlt(p1, p2, ...) — alternate between patterns one step at a time
export function PAlt(...pats) {
    return { get: (step) => patGet(pats[step % pats.length], step) };
}

// _alt(a, b, c) — FoxDot <a b c> alternation. Advances once per *read* (not per
// global step), so it cycles its items each time it's reached: top-level
// saw(<0 4 7>) plays 0,4,7,0,…; a param dur=<1 2> alternates 1,2,1,…. The
// transpiler turns <...> on a player line into this.
export function _alt(...items) {
    let i = 0;
    return { get: () => { const v = items[i % items.length]; i++; return patGet(v, i - 1); } };
}

// Pattern arithmetic: linvar([1.4,0],32) * P[1,0,0.9], P[0,2,4] + 2, etc. JS can't
// overload operators, so the transpiler rewrites arithmetic involving a pattern
// into Pmath(a, op, b). If both operands are plain scalars it computes eagerly
// (so 1/4 stays 0.25); otherwise it returns a lazy pattern resolved per step.
const _OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
export function Pmath(a, op, b) {
    const f = _OPS[op] ?? ((x) => x);
    const lazy = (v) => v != null && (typeof v.get === 'function' || Array.isArray(v) || isGroup(v) || isEnv(v));
    if (!lazy(a) && !lazy(b)) return f(a, b);
    const resolve = (v, step) => {
        let r = isGroup(v) ? patGet(v.__group[0], step) : patGet(v, step, v);
        return isEnv(r) ? envValue(r) : r;
    };
    return { get: (step) => f(resolve(a, step), resolve(b, step)) };
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
    return { get: (step) => seq[(step + offset) % seq.length] };
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
    for (let v = lo; v < hi; v += step) arr.push(v);
    return { get: (s) => arr[s % arr.length] };
}

// PStep(n, value, default=0) — FoxDot form: `value` every n steps (at 0, n, 2n…),
// `default` otherwise → PStep(4,7,6) = [7,6,6,6]. If the first arg is an object it
// falls back to the sparse {stepIndex: value} map form: PStep({0:7, 4:2}, cycle).
export function PStep(n, value = 1, dflt = 0) {
    if (typeof n === 'number') {
        const len = Math.max(1, Math.round(n));
        return { get: (step) => (((step % len) + len) % len === 0 ? value : dflt) };
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
            const t = (step % steps) / steps;
            return lo + (hi - lo) * (Math.sin(t * Math.PI * 2) * 0.5 + 0.5);
        }
    };
}

// PTri(lo, hi, steps) — triangular sweep
export function PTri(lo = 0, hi = 1, steps = 16) {
    return {
        get: (step) => {
            const t = (step % steps) / steps;
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
    pairs = pairs.map(p => isGroup(p) ? p.__group : p).filter(p => Array.isArray(p) && p.length >= 2);
    if (!pairs.length) return cyc([0]);
    const k = Math.max(...pairs.map(p => p[1]));
    const layers = pairs.map(([n, kk]) => _euclid(kk, n));   // n pulses in kk steps
    const result = [];
    for (let i = 0; i < k; i++) result.push(Math.max(...layers.map(L => L[i % L.length])));
    return cyc(result);
}

// PLife(chaos, low, high, steps) — elementary cellular-automaton values in [low,high]
export function PLife(chaos = 0, low = 0, high = 1, steps = 16) {
    const useInt = Number.isInteger(low) && Number.isInteger(high);
    const rule = (() => {
        const r = [[0,0],[0.15,254],[0.3,90],[0.5,110],[0.7,150],[0.85,30],[1,30]];
        for (let i = 0; i < r.length - 1; i++) {
            if (chaos <= r[i+1][0]) { const mid = (r[i][0] + r[i+1][0]) / 2; return chaos <= mid ? r[i][1] : r[i+1][1]; }
        }
        return 30;
    })();
    const ruleMap = {};
    for (let i = 0; i < 8; i++) ruleMap[`${(i>>2)&1}${(i>>1)&1}${i&1}`] = (rule >> i) & 1;
    let row = Array(steps).fill(0); row[steps >> 1] = 1;
    const grid = [row.slice()];
    const grow = (n) => {
        while (grid.length < n) {
            const last = grid[grid.length - 1], nr = Array(steps).fill(0);
            for (let j = 0; j < steps; j++) {
                const l = last[(j-1+steps)%steps], c = last[j], rt = last[(j+1)%steps];
                nr[j] = ruleMap[`${l}${c}${rt}`];
            }
            grid.push(nr);
        }
    };
    grow(300);
    return { get(index) {
        index = index | 0;
        const r = Math.floor(index / steps), c = ((index % steps) + steps) % steps;
        if (chaos <= 0) return high;
        const radius = 2;
        if (r + radius + 1 >= grid.length) grow(r + radius + 256);
        let total = 0, count = 0;
        for (let dr = -radius; dr <= radius; dr++) {
            const ri = r + dr; if (ri < 0) continue;
            for (let dc = -radius; dc <= radius; dc++) { total += grid[ri][((c+dc)%steps+steps)%steps]; count++; }
        }
        const density = total / count;
        const floor = low + (high - low) * (1 - chaos);
        const val = floor + (high - floor) * density;
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
export function PChord(degree = 0, type = '') {
    const off = _CHORD_TYPES[String(type).toLowerCase().trim()] || _CHORD_TYPES[''];
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
    return String(str).split(/[\s,|]+/).filter(Boolean).map(t => {
        const p = _parseRoman(t); return p ? PChord(p.deg, p.type) : 0;
    });
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
};
export function PProg(name = '50s') {
    return PRoman(_PROGS[String(name).toLowerCase()] || name);
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
    const set = new Set(_CLAVES[String(name).toLowerCase()] || _CLAVES['son']);
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
        if (grp && grp.length >= 2) { for (const d of PDur(grp[0], grp[1])) out.push(d); }
        else out.push(item);
    }
    return out;
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
    return out;
}

// PTree(seed, depth, step) — a self-similar melody (L-system): each degree d
// expands to [d, d+step], applied `depth` times. PTree([0],3,2) → 0,2,2,4,2,4,4,6.
export function PTree(seed = [0], depth = 3, step = 2) {
    let cur = (Array.isArray(seed) ? seed : [seed]).slice();
    for (let d = 0; d < depth; d++) { const next = []; for (const v of cur) next.push(v, v + step); cur = next; }
    return cur;
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
