// Synth registry — add new synths here after compiling their .scd source.
//
// Each entry:
//   scName:      compiled SynthDef name (must match filename in synthdefs/compiled/)
//   defaults:    default param values (also drives autocomplete)
//   extraParams: extra SC params beyond the common base (note, amp, sus, pan, attack, release, out)
//
// To add a synth:
//   1. Create synthdefs/src/synths/mysynth.scd
//   2. Add an entry here
//   3. Run scripts/build.sh

export const SYNTH_DEFS = {
    dbass: {
        scName: 'fd_dbass',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.02, release: 0.12, cutoff: 2000, rq: 0.5, phase: 0.9 },
        extraParams: ['cutoff', 'rq', 'phase'],
    },
    saw: {
        scName: 'fd_saw',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 8000, rq: 0.8, rate: 0.5 },
        extraParams: ['cutoff', 'rq', 'rate'],
    },
    sine: {
        scName: 'fd_sine',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.001, release: 0.05, cutoff: 2800, rq: 0.8, rate: 0.1 },
        extraParams: ['cutoff', 'rq', 'rate'],
    },
    rsin: {
        scName: 'fd_rsin',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.2, cutoff: 2000, rq: 0.1, feedback: 0 },
        extraParams: ['cutoff', 'rq', 'feedback'],
    },
    donk: {
        scName: 'fd_donk',
        defaults: { oct: 3, amp: 0.9, dur: 0.5, pan: 0 },
        extraParams: [],
        rawSus: true,  // sus = Ringz decay in seconds — pass dur*secPerBeat directly, no atk/rel subtraction
    },
    pluck: {
        scName: 'fd_pluck',
        defaults: { oct: 4, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 0.3, cutoff: 8000, rq: 0.7 },
        extraParams: ['cutoff', 'rq'],
    },
    pulse: {
        scName: 'fd_pulse',
        defaults: { oct: 4, amp: 0.5, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 6000, rq: 0.8, width: 0.5 },
        extraParams: ['cutoff', 'rq', 'width'],
    },
    blip: {
        scName: 'fd_blip',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.0001, release: 0.1, cutoff: 12000, rq: 0.6, rate: 4 },
        extraParams: ['cutoff', 'rq', 'rate'],
    },
    fm: {
        scName: 'fd_fm',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.2, ratio: 2, index: 5, cutoff: 8000, rq: 0.8 },
        extraParams: ['ratio', 'index', 'cutoff', 'rq'],
    },
    bell: {
        scName: 'fd_bell',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.001, release: 0.5, rate: 1 },
        extraParams: ['rate'],
    },
    pads: {
        scName: 'fd_pads',
        defaults: { oct: 4, amp: 0.6, dur: 2, pan: 0, attack: 0.1, release: 0.4, cutoff: 1200, rq: 0.6 },
        extraParams: ['cutoff', 'rq'],
    },
    bass: {
        scName: 'fd_bass',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 2000, rq: 0.6 },
        extraParams: ['cutoff', 'rq'],
    },
    prophet: {
        scName: 'fd_prophet',
        defaults: { oct: 4, amp: 0.6, dur: 1, pan: 0, attack: 0.02, release: 0.2, cutoff: 3000, rq: 0.4 },
        extraParams: ['cutoff', 'rq'],
    },
};

import { attachModifiers, isGroup, _group, unisonSpread } from '../patterns/sequences.js';

export class SynthCall {
    constructor(name, args) {
        this.name = name; this.args = args;
        this._modifiers = null; this._after = null; this._degreeAdds = null;
    }
    // .after(beats, method, ...args) — one-shot: call a player method after N beats
    after(beats, method, ...args) { this._after = { beats, method, args }; return this; }
    // .every(beats, method, ...args) — call a player method every N beats (chainable)
    every(beats, method, ...args) { (this._everys ??= []).push({ beats, method, args }); return this; }
    // p >> synth(...) + N / + (a,b,c) — transpose the degree (chainable)
    __add__(x) { (this._degreeAdds ??= []).push(x); return this; }
    // .unison(n, detune) — n detuned + stereo-spread voices (FoxDot formula).
    // Sets pan and pshift (semitone detune) groups; the group→voice machinery
    // does the rest. unison(4, 0.5) → pan=(-1,-0.5,0.5,1), pshift=(-0.5,-0.25,0.25,0.5)
    unison(n = 2, detune = 0.125) {
        if (!n) { this.args.pan = 0; this.args.pshift = 0; return this; }
        const { pan, pshift } = unisonSpread(n, detune);
        this.args.pan    = _group(...pan);
        this.args.pshift = _group(...pshift);
        return this;
    }
}
// .sometimes / .often / .rarely / .always / … — chainable probability modifiers
attachModifiers(SynthCall);

// Generic param builder — works for any entry in SYNTH_DEFS.
// outBus: player's private audio bus (0 = direct to output, no FX)
export function buildParams(synthName, midi, r, secPerBeat, outBus = 0) {
    const def = SYNTH_DEFS[synthName];
    if (!def) return null;
    const sus   = r.sus ?? r.dur ?? 1;
    const atkS  = r.attack  ?? def.defaults.attack  ?? 0.01;
    const relS  = r.release ?? Math.min(0.3, sus * secPerBeat * 0.3);

    let base;
    if (def.rawSus) {
        // Synths like donk use sus as raw decay seconds (no atk/rel envelope subtraction)
        base = [
            'out', outBus, 'note', midi,
            'amp', Math.min(1.5, r.amp ?? def.defaults.amp ?? 0.8),
            'pan', r.pan ?? 0,
            'sus', Math.max(0.001, sus * secPerBeat),
        ];
    } else {
        // SynthDefs expect sus = total duration in seconds; they subtract attack+release internally
        const susS = Math.max(atkS + relS + 0.001, sus * secPerBeat);
        base = [
            'out',     outBus,
            'note',    midi,
            'amp',     Math.min(1.5, r.amp ?? def.defaults.amp ?? 0.8),
            'pan',     r.pan  ?? 0,
            'attack',  atkS,
            'sus',     susS,
            'release', relS,
        ];
    }
    const extras = (def.extraParams ?? []).flatMap(p => [p, r[p] ?? def.defaults[p] ?? 0]);
    return { scName: def.scName, params: [...base, ...extras] };
}

// Factory: returns a callable synth function (for use in eval context).
// The SynthCall carries ONLY the args the user explicitly wrote — the player
// merges synth defaults (fresh) or the previous args (inherited) at >> time.
export function makeSynth(name) {
    return function(degreeArg, opts = {}) {
        // A plain object as the first arg is the opts dict (degree(opts) form);
        // a group/array/pattern is a degree.
        const isOptsObj = degreeArg !== null && typeof degreeArg === 'object'
                && !Array.isArray(degreeArg)
                && !isGroup(degreeArg)
                && typeof degreeArg.get !== 'function';
        const userArgs = isOptsObj ? { ...degreeArg } : { ...opts };
        if (!isOptsObj && degreeArg !== undefined) userArgs.degree = degreeArg;
        return new SynthCall(name, userArgs);
    };
}
