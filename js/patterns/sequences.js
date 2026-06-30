// Pattern helpers — all patterns expose a .get(step) method.
// patGet resolves any value: plain scalar, array, or pattern object.

import { isEnv, envValue } from './timevars.js';

export function patGet(val, step, def) {
    if (val === null || val === undefined) return def;
    if (typeof val?.get === 'function') return val.get(step);
    if (Array.isArray(val)) {
        const el = val[((step % val.length) + val.length) % val.length];
        // Resolve a pattern nested inside the list (e.g. [0, {2,4}] → PRand picks
        // each step) so {…}/P*[…] work in degree lists, like they do in play().
        // Groups (chords) have no .get, so they survive for voice expansion.
        return (el && typeof el.get === 'function') ? el.get(step) : el;
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
export function PDur(k, n, dur = 1) {
    const steps = Array(n).fill(0);
    for (let i = 0; i < k; i++) steps[Math.round(i * n / k)] = 1;
    const durs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
        if (steps[i] === 1 && i > 0) { durs.push(acc * dur / n); acc = 1; }
        else acc++;
    }
    if (acc > 0) durs.push(acc * dur / n);
    return durs;
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

// PStep(mapping, cycle) — sparse {stepIndex: value} lookup, default 0
export function PStep(mapping, cycle = null) {
    const entries = Object.entries(mapping).map(([k, v]) => [Number(k), v]);
    const max = cycle ?? (Math.max(...entries.map(([k]) => k)) + 1);
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
