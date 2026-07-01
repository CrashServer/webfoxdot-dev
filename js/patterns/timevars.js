// TimeVar functions — advance continuously against real Clock beat time,
// not step count. Signature matches FoxDot: var([vals], [durs])
//
// Usage:
//   p1 >> dbass([0,2], cutoff=linvar([400, 2000], [8, 8]))
//   p1 >> saw([0,4,7], amp=sinvar([0.3, 0.8], [16]))
//
// Note: "var" is a JS reserved word — the transpiler rewrites
//   var([...],[...])  →  _var([...],[...])
// automatically in runCode().

// Shared clock reference — set by engine/clock.js bootstrap
let _clock = null;
export function setClockRef(c) { _clock = c; }

// Resolve a value that may be a pattern object or array into a number,
// so var/linvar can hold patterns: var([PRand([4,16,32]), 1/4]).
function rv(v) {
    if (v == null) return v;
    if (typeof v.get === 'function') return v.get(_clock ? Math.floor(_clock.now()) : 0);
    if (Array.isArray(v)) {
        const step = _clock ? Math.floor(_clock.now()) : 0;
        return rv(v[((step % v.length) + v.length) % v.length]);
    }
    return v;
}

function normDurs(vals, durs) {
    if (!Array.isArray(vals)) vals = [vals];
    if (durs && typeof durs.get === 'function') durs = durs.get(0);   // pattern dur → number
    let d = Array.isArray(durs) ? durs
            : typeof durs === 'number' ? vals.map(() => durs)
            : vals.map(() => 4);
    // durs may themselves be patterns: var([0,0.6], [PRand(6,12), PRand(3,8)]).
    // Resolve each to a number (fixed at creation) so totals/positions are numeric.
    d = d.map(x => { const n = rv(x); return typeof n === 'number' && isFinite(n) ? n : 4; });
    return { vals, durs: d, total: d.reduce((a, b) => a + b, 0) };
}

function tpos(durs, total) {
    const beat = _clock ? _clock.now() : 0;
    let t = ((beat % total) + total) % total;
    let idx = 0;
    while (idx < durs.length - 1 && t >= durs[idx]) { t -= durs[idx]; idx++; }
    return { idx, t };
}

// Step-hold: stays at val[i] for durs[i] beats, then jumps
export function _var(vals, durs) {
    const { vals: vs, durs: ds, total } = normDurs(vals, durs);
    return { isTimeVar: true, get(_) {
        const { idx } = tpos(ds, total);
        return rv(vs[idx % vs.length]);
    }};
}

// Linear interpolation between adjacent values
// lininf/expinf — ramp from start→finish over `time` beats, then hold at finish
// (FoxDot's linvar([start,finish],[time, inf])). A huge second duration ≈ forever.
export function lininf(start = 0, finish = 1, time = 32) { return _linvar([start, finish, finish], [time, 1e9, 1e9]); }
export function expinf(start = 0, finish = 1, time = 32) { return _expvar([start, finish, finish], [time, 1e9, 1e9]); }

export function _linvar(vals, durs) {
    const { vals: vs, durs: ds, total } = normDurs(vals, durs);
    return { isTimeVar: true, get(_) {
        const { idx, t } = tpos(ds, total);
        const frac = Math.min(1, t / Math.max(0.001, ds[idx]));
        const v0 = rv(vs[idx % vs.length]), v1 = rv(vs[(idx + 1) % vs.length]);
        return v0 + (v1 - v0) * frac;
    }};
}

// Sine-eased interpolation (soft s-curve)
export function _sinvar(vals, durs) {
    const { vals: vs, durs: ds, total } = normDurs(vals, durs);
    return { isTimeVar: true, get(_) {
        const { idx, t } = tpos(ds, total);
        const frac = (1 - Math.cos(Math.min(1, t / Math.max(0.001, ds[idx])) * Math.PI)) / 2;
        const v0 = rv(vs[idx % vs.length]), v1 = rv(vs[(idx + 1) % vs.length]);
        return v0 + (v1 - v0) * frac;
    }};
}

// fperlin(period, lo, hi) — smooth value-noise LFO: wanders randomly between lo
// and hi, a new random target roughly every `period` beats, smoothstep-eased
// (so it's continuous, unlike PWhite). Clock-synced like the *var family.
export function _fperlin(period = 8, lo = 0, hi = 1) {
    const seed = Math.random() * 1000;
    const hash = (i) => { const x = Math.sin((i + seed) * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const noise = (t) => {
        const i = Math.floor(t), f = t - i;
        const u = f * f * (3 - 2 * f);                 // smoothstep ease
        return hash(i) * (1 - u) + hash(i + 1) * u;
    };
    const p = Math.max(0.001, period);
    return { isTimeVar: true, get() {
        const beat = _clock ? _clock.now() : 0;
        return lo + (hi - lo) * noise(beat / p);
    }};
}

// Exponential interpolation (good for cutoff and frequency sweeps)
export function _expvar(vals, durs) {
    const { vals: vs, durs: ds, total } = normDurs(vals, durs);
    return { isTimeVar: true, get(_) {
        const { idx, t } = tpos(ds, total);
        const frac = Math.min(1, t / Math.max(0.001, ds[idx]));
        const v0 = Math.max(0.0001, rv(vs[idx % vs.length]));
        const v1 = Math.max(0.0001, rv(vs[(idx + 1) % vs.length]));
        return v0 * Math.pow(v1 / v0, frac);
    }};
}

// ── Parameter envelopes (Axis 3) ──────────────────────────────────────────────
// Tagged objects evaluated per-note against beats-elapsed-since-trigger.
// Used with a "_" suffix on an FX param name:  lpf_=fi(0.5, 400, 2000)
// Signature: f*(dur, a, b) — dur in beats, a/b the endpoints.
//   fi: fade in  a→b over dur, holds at b
//   fo: fade out b→a over dur, holds at a
//   fb: bounce   a↔b, looping every dur (triangle), runs for the note's sus
export function _fi(dur, a, b) { return { __env: 'fi', dur, a, b }; }
export function _fo(dur, a, b) { return { __env: 'fo', dur, a, b }; }
export function _fb(dur, a, b) { return { __env: 'fb', dur, a, b }; }

export function isEnv(v) {
    return v != null && typeof v === 'object' && typeof v.__env === 'string';
}

// Evaluate an envelope as a *plain, clock-synced value* — i.e. when fb/fi/fo is
// used directly on a param (lpf=fb(24,1200,5800)) rather than as a per-note "_"
// envelope. fb bounces over `dur` beats of clock time; fi/fo ramp then hold.
export function envValue(env) {
    return evalEnv(env, _clock ? _clock.now() : 0);
}

// Evaluate an envelope at elapsedBeats since the note triggered.
export function evalEnv(env, elapsedBeats) {
    const { __env: kind, dur, a, b } = env;
    const d = Math.max(0.001, dur);
    if (kind === 'fb') {
        const q = ((elapsedBeats / d) % 1 + 1) % 1;
        return q < 0.5 ? a + (b - a) * (2 * q)
                       : b - (b - a) * (2 * (q - 0.5));
    }
    const p = Math.min(1, Math.max(0, elapsedBeats / d));
    if (kind === 'fo') return b - (b - a) * p;
    return a + (b - a) * p; // fi
}
