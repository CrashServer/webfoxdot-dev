// Pattern helpers — all patterns expose a .get(step) method.
// patGet resolves any value: plain scalar, array, or pattern object.

export function patGet(val, step, def) {
    if (val === null || val === undefined) return def;
    if (typeof val?.get === 'function') return val.get(step);
    if (Array.isArray(val)) return val[((step % val.length) + val.length) % val.length];
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
