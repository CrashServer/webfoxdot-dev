// defsynth() — define a SynthDef live in the browser (Path C: no sclang, no server).
//
//   defsynth("mylead", { cutoff: 2000, rq: 0.4 }, ({ out, note, amp, sus, pan, attack, release, cutoff, rq }) => {
//       const freq = note.midicps();
//       const env  = EnvGen.ar(Env.linen(attack, sus, release), { doneAction: 2 });
//       const sig  = RLPF.ar(Saw.ar(freq), cutoff, rq).mul(env).mul(amp);
//       Out.ar(out, Pan2.ar(sig, pan));
//   })
//
// The build function receives the standard WebFoxDot control contract
// (out, note, amp, sus, pan, attack, release) plus any extra params declared,
// each as a UGenOut. After loading, the synth is playable exactly like a
// built-in:  p1 >> mylead([0,4,7], cutoff=3000)

import { buildSynthDef } from './synthdef.js';
import { SYNTH_DEFS, makeSynth } from '../synths/registry.js';

// Standard control contract — matches what buildParams() sends to scsynth.
const STD = [
    { name: 'out',     default: 0 },
    { name: 'note',    default: 60 },
    { name: 'amp',     default: 0.8 },
    { name: 'sus',     default: 1 },
    { name: 'pan',     default: 0 },
    { name: 'attack',  default: 0.01 },
    { name: 'release', default: 0.1 },
];

let _sc = null;
let _onRegister = null;
// Callables for user-defined synths — index.html spreads this into the eval ctx.
export const userSynths = {};

export function initDefsynth(sc, onRegister) { _sc = sc; _onRegister = onRegister; }

export async function defsynth(name, extraParams, buildFn) {
    // Allow defsynth(name, buildFn) with no extra params
    if (typeof extraParams === 'function') { buildFn = extraParams; extraParams = {}; }
    extraParams = extraParams || {};

    const controls = [
        ...STD,
        ...Object.entries(extraParams).map(([n, d]) => ({ name: n, default: d })),
    ];

    const bytes = buildSynthDef(name, controls, buildFn);
    if (_sc) await _sc.loadSynthDef(bytes);

    // Register so the engine treats it like any built-in synth.
    SYNTH_DEFS[name] = {
        scName: name,
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.1, ...extraParams },
        extraParams: Object.keys(extraParams),
    };
    userSynths[name] = makeSynth(name);
    if (_onRegister) _onRegister(name);
    return name;
}
