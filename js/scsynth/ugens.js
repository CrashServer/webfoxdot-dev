// UGen DSL — SC-style factories used inside defsynth() build functions.
//   SinOsc.ar(freq, phase) · RLPF.ar(in, freq, rq) · Out.ar(bus, sig) …
// Each factory builds a UGen node on the current graph and returns a UGenOut
// (or array of UGenOut for multi-channel) that supports .mul()/.add()/etc.

import { UGen, UGenOut, RATE } from './synthdef.js';

// Build a UGen with positional args; missing trailing args filled from defaults.
function make(name, rate, args, defaults, numOut = 1, special = 0) {
    const inputs = defaults.map((d, i) => (args[i] === undefined ? d : args[i]));
    const u = new UGen(name, rate, inputs, numOut, special);
    return numOut === 1 ? u.out(0) : u.outs;
}

// Factory with .ar and .kr; `defaults` is the positional input default list.
function ugen(name, defaults, { numOut = 1 } = {}) {
    return {
        ar: (...a) => make(name, RATE.ar, a, defaults, numOut),
        kr: (...a) => make(name, RATE.kr, a, defaults, numOut),
    };
}

// ── Oscillators ───────────────────────────────────────────────────────────────
export const SinOsc  = ugen('SinOsc',  [440, 0]);
export const Saw     = ugen('Saw',     [440]);
export const LFSaw   = ugen('LFSaw',   [440, 0]);
export const Pulse   = ugen('Pulse',   [440, 0.5]);
export const LFPulse = ugen('LFPulse', [440, 0, 0.5]);
export const VarSaw  = ugen('VarSaw',  [440, 0, 0.5]);
export const LFTri   = ugen('LFTri',   [440, 0]);
export const Blip    = ugen('Blip',    [440, 200]);
export const Impulse = ugen('Impulse', [440, 0]);

// ── Noise ───────────────────────────────────────────────────────────────────
export const WhiteNoise = ugen('WhiteNoise', []);
export const PinkNoise  = ugen('PinkNoise',  []);
export const LFNoise0   = ugen('LFNoise0',   [500]);
export const LFNoise1   = ugen('LFNoise1',   [500]);
export const LFNoise2   = ugen('LFNoise2',   [500]);

// ── Filters ───────────────────────────────────────────────────────────────────
export const RLPF = ugen('RLPF', [0, 440, 1]);
export const RHPF = ugen('RHPF', [0, 440, 1]);
export const LPF  = ugen('LPF',  [0, 440]);
export const HPF  = ugen('HPF',  [0, 440]);
export const BPF  = ugen('BPF',  [0, 440, 1]);
export const LeakDC = ugen('LeakDC', [0, 0.995]);   // DC-blocker — cheap safety net after heavy distortion/waveshaping

// ── Lines / ranges ─────────────────────────────────────────────────────────────
export const Line  = ugen('Line',  [0, 1, 1, 0]);   // start, end, dur, doneAction
export const XLine = ugen('XLine', [1, 2, 1, 0]);

// ── Envelopes ───────────────────────────────────────────────────────────────
// Env.* return a flattened envelope spec (numbers and/or UGenOut durations).
// EnvGen.ar(env, {gate, levelScale, levelBias, timeScale, doneAction}).
//   doneAction: 2 frees the synth when the envelope ends.
function curvePair(curve) {
    if (typeof curve === 'number') return [5, curve];           // custom curve value
    const t = { step: 0, lin: 1, linear: 1, exp: 2, exponential: 2,
                sin: 3, sine: 3, wel: 4, welch: 4, sqr: 6, cub: 7, hold: 8 };
    return [t[curve] ?? 1, 0];
}

export const Env = {
    // perc(attack, release, level, curve)
    perc(atk = 0.01, rel = 1, level = 1, curve = -4) {
        const [t, v] = curvePair(curve);
        return [0, 2, -99, -99, level, atk, t, v, 0, rel, t, v];
    },
    // linen(attack, sustain, release, level, curve)
    linen(atk = 0.01, sus = 1, rel = 1, level = 1, curve = 'lin') {
        const [t, v] = curvePair(curve);
        return [0, 3, -99, -99, level, atk, t, v, level, sus, t, v, 0, rel, t, v];
    },
    // triangle(dur, level) — symmetric up/down
    triangle(dur = 1, level = 1) {
        return [0, 2, -99, -99, level, dur / 2, 1, 0, 0, dur / 2, 1, 0];
    },
    // adsr(attack, decay, sustainLevel, sustain, release, level, curve) — unlike
    // SC's real (gate-held) Env.adsr, this stays self-contained/duration-based
    // like perc/linen above: attack up to level, decay down to level*sustainLevel,
    // HOLD there for `sustain` seconds, then release to 0 — no gate needed.
    adsr(atk = 0.01, dec = 0.3, susLevel = 0.5, sus = 1, rel = 1, level = 1, curve = 'lin') {
        const [t, v] = curvePair(curve);
        const sl = level * susLevel;
        return [0, 4, -99, -99, level, atk, t, v, sl, dec, t, v, sl, sus, t, v, 0, rel, t, v];
    },
};

function makeEnvGen(rate, env, o = {}) {
    const { gate = 1, levelScale = 1, levelBias = 0, timeScale = 1, doneAction = 0 } = o;
    const inputs = [gate, levelScale, levelBias, timeScale, doneAction, ...env];
    return new UGen('EnvGen', rate, inputs, 1, 0).out(0);
}
export const EnvGen = {
    ar: (env, o) => makeEnvGen(RATE.ar, env, o),
    kr: (env, o) => makeEnvGen(RATE.kr, env, o),
};

// ── Stereo / output ─────────────────────────────────────────────────────────────
// Pan2.ar(in, pos, level) → [left, right]
export const Pan2 = ugen('Pan2', [0, 0, 1], { numOut: 2 });

// Out.ar(bus, channels) — channels may be a single UGenOut/number or an array.
// Produces zero outputs.
export const Out = {
    ar: (bus, channels) => {
        const chans = Array.isArray(channels) ? channels : [channels];
        return new UGen('Out', RATE.ar, [bus, ...chans], 0, 0);
    },
    kr: (bus, channels) => {
        const chans = Array.isArray(channels) ? channels : [channels];
        return new UGen('Out', RATE.kr, [bus, ...chans], 0, 0);
    },
};
