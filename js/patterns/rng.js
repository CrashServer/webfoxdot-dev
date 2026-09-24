// rng.js — one source of randomness, so a set can be reproduced and a room can agree.
//
// ── The problem ──────────────────────────────────────────────────────────────
// Fifteen generators here called Math.random() directly. Two consequences, both
// quiet enough to live with for a long time and both wrong:
//
//   · a saved set with PRand or chaos() played differently every time it loaded
//   · in a session, evals travel as SOURCE TEXT and each peer runs it — so
//     p1 >> pluck(PRand([0,4,7])) produced a different note sequence on every
//     machine in the room. The beat is synced, the code is synced, the music is not.
//
// ── Why a hash and not a stream ──────────────────────────────────────────────
// The obvious fix is one seeded PRNG that everybody advances in step. It does not
// work here, because PRand.get() re-rolls on every call and nothing guarantees two
// peers call it the same number of times: one machine drops a frame, skips a step,
// or evaluates a second line in between, and the two streams part company forever.
//
// So randomness is addressed rather than sequential: value = hash(seed, stream, step).
// Two peers asking for step 17 of the same pattern get the same number whatever else
// either of them has done. It is also what makes a set reproducible — re-running a
// line gives the same music, because the answer depends on WHERE you are in the
// pattern, not on how many random numbers have been drawn since boot.
//
// ── Unseeded stays exactly as it was ─────────────────────────────────────────
// With no seed set, every call falls through to Math.random(). That is the default,
// so nothing changes for anyone who never types seed().

let _base = null;        // null = unseeded → Math.random()
let _oneShot = 0;        // counter for construction-time draws (PShuf, P10, …)
let _scope = 0;          // per-eval sub-seed, derived from the code being run
let _stream = 0;         // pattern index within the current eval

/** 32-bit integer hash (splitmix32 finalizer) → uniform [0,1). */
function mix(a, b, c) {
    let x = (a ^ Math.imul(b ^ (b >>> 15), 0x2c1b3c6d) ^ Math.imul(c ^ (c >>> 13), 0x297a2d39)) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

/** Stable 32-bit hash of a string — how a line of code becomes a sub-seed. */
function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
}

export function isSeeded() { return _base != null; }
export function currentSeed() { return _base; }

/** seed(n) sets it · seed(null) goes back to unseeded. Returns the seed in force. */
export function setSeed(n) {
    if (n == null) { _base = null; return null; }
    const v = Number(n);
    if (!isFinite(v)) return _base;
    _base = Math.abs(Math.trunc(v)) >>> 0;
    return _base;
}

/**
 * Start a new eval. The sub-seed is derived from the CODE, so two peers running the
 * same line land on the same sub-seed without any of it having to travel: seed(42) is
 * itself a line of code, so it is already broadcast like everything else.
 *
 * `salt` is what .reroll() turns — same code, deliberately different music.
 */
export function beginEvalScope(code = '', salt = 0) {
    _scope = _base == null ? 0 : (mix(_base, hashStr(String(code)), salt >>> 0) * 4294967296) >>> 0;
    _stream = 0;
    _oneShot = 0;   // construction-time draws restart too, or the second run of a line
}                   // would not match the first — which is the whole point

/** A fresh stream id for a pattern being constructed. Same code → same order → same ids. */
export function nextStream() { return _stream++; }

/**
 * The value for `step` of `stream`. Deterministic under a seed, Math.random() without.
 * Pass a step of -1 for "just give me a number" (construction-time draws like PShuf's
 * shuffle), which advances a counter instead of addressing a position.
 */
export function randAt(stream, step) {
    if (_base == null) return Math.random();
    const s = (step == null || step < 0) ? (0x9e3779b9 ^ _oneShot++) : (step >>> 0);
    return mix(_scope, (stream >>> 0) * 0x85ebca6b, s);
}

/** A pattern's own handle: rng.at(step) for per-step values, rng.next() for one-offs. */
// Unseeded, randAt() is Math.random() on every call — so the SAME pattern read twice
// at the same step gave two different values. Reading another player's pattern is
// ordinary: p2 >> saw(p1.degree + 7), .follow, .accompany, .map — and a random p1
// played one note while everything reading it heard another. So an unseeded stream
// remembers what it drew for each recent step, and a second read agrees with the
// first. Per stream OBJECT, not per id: ids restart at 0 with every eval, and two
// separately evaluated patterns sharing a memo would play the same "random" line.
// Seeded draws are already a pure function of the step and need none of this.
const MEMO_STEPS = 512;
export function makeStream() {
    const id = nextStream();
    let memo = null;
    return {
        id,
        at: (step) => {
            if (_base != null || step == null || step < 0) return randAt(id, step);
            memo ??= new Map();
            let v = memo.get(step);
            if (v === undefined) {
                v = randAt(id, step);
                memo.set(step, v);
                if (memo.size > MEMO_STEPS) memo.delete(memo.keys().next().value);
            }
            return v;
        },
        next: () => randAt(id, -1),
    };
}
