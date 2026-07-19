// Generative players — chaos() (one-shot burst) and the building blocks a future
// son()/soff() bot will reuse. Pure: it only BUILDS code
// lines; the caller runs them through runCode (so they also broadcast to peers).

import { SYNTH_DEFS } from '../synths/registry.js';

const pick   = (a) => a[Math.floor(Math.random() * a.length)];
const rint   = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const chance = (p) => Math.random() < p;
const flt    = (lo, hi, d = 2) => (lo + Math.random() * (hi - lo)).toFixed(d);
// pick n DISTINCT thunks from a list and call each (so we never emit lpf= twice).
const pickN  = (a, n) => { const c = [...a], out = []; for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); return out; };

// Melodic/tonal synths worth generating (skip sampler/loop/master + ikea, which is a
// long-sustain texture generator that doesn't suit random note-by-note triggering).
const GEN_SYNTHS = Object.keys(SYNTH_DEFS).filter(n => !/sampler|loop|master|fx|^ikea$/.test(n));

// Rough role → so we pick musically-appropriate patterns/octaves per synth. Every
// synth is classified so none falls through to a generic 'lead' by accident.
const ROLES = {
    bass:  ['dbass', 'bass', 'ebass', 'acidbass', 'pumpbass', 'tb303', 'a_gesa', 'a_daft', 'wobble', 'synthbass', 'dafbass', 'cbass', 'svdk', 'dab', 'growl', 'a_xbass', 'doom', 'glitchbass', 'lbass', 'wob', 'acidline', 'superbass'],
    lead:  ['saw', 'ssaw', 'pulse', 'blip', 'hoover', 'prophet', 'cs80', 'plaits', 'faim', 'fm', 'supersaw', 'a_vlead', 'a_daftlead', 'a_stab', 'varsaw', 'war', 'fuzz', 'guitar', 'tekno', 'dirt', 'hardstab', 'darklead', 'virus'],
    pad:   ['pads', 'choir', 'brass', 'organ', 'darkpad', 'a_vpad', 'industrialdrone', 'gaze', 'waves'],
    keys:  ['bell', 'basic', 'karp', 'rhodes', 'piano', 'sine', 'rsin', 'klank'],
    pluck: ['pluck', 'moogpluck', 'guit', 'donk', 'lapin', 'arpy'],
    perc:  ['a_bd', 'a_hhat', 'compkick', 'industrialsnare', 'crunch'],
};
const roleOf = (n) => { for (const [r, list] of Object.entries(ROLES)) if (list.includes(n)) return r; return 'lead'; };

const CHORDLIST = () => pick(['[0,4,7]', '[0,3,7]', '[0,4,7,11]', '[0,2,4,7]', '[0,3,5,7]', '[0,4,7,10]']);
const ROMAN     = () => pick(['"I V vi IV"', '"i VI III VII"', '"ii V I"', '"I vi IV V"', '"i iv VII"', '"i iv v"']);
const randList  = (n, lo, hi) => '[' + Array.from({ length: n }, () => rint(lo, hi)).join(', ') + ']';
// A degree list peppered with rests (_ = silence). Index 0 always sounds.
const restList  = (n, lo, hi) => '[' + Array.from({ length: n }, (_, i) => (i > 0 && chance(0.3)) ? '_' : rint(lo, hi)).join(', ') + ']';
// A list where some slots are themselves a [sub, list] (per-bar alternation) — nesting.
const nestList  = (n, lo, hi) => '[' + Array.from({ length: n }, (_, i) =>
    (i > 0 && chance(0.28)) ? `[${rint(lo, hi)}, ${rint(lo, hi)}]` : rint(lo, hi)).join(', ') + ']';
// A shuffled ZERO-SUM delta list for PDelta — sums to 0 over the cycle so the
// running total wanders but always returns, instead of ramping off to silence.
const zeroDeltas = () => {
    const a = rint(1, 2), b = rint(1, 2), d = [a, b, -a, -b];
    for (let k = d.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [d[k], d[j]] = [d[j], d[k]]; }
    return '[' + d.join(', ') + ']';
};

// ── value builders — turn a numeric range into a scalar, a list, a NESTED list, a
// pattern, a TimeVar (var/linvar/sinvar/Pvar) or a frozen [:n] slice, so ANY param
// (oct, amp, pan, filter freq, fx depth…) can be static OR evolve over time.
// integer value in [lo, hi] — whole-number params (oct, bits, …)
const intVal = (lo, hi) => {
    const mid = rint(lo, hi);
    return pick([`${mid}`, `${mid}`, `${mid}`,                                  // plain (weighted)
        `[${lo}, ${hi}]`, `[${lo}, ${hi}, ${lo}]`, `[${lo}, [${hi}, ${lo}]]`,   // list · nested
        `PStep(${pick([4, 8])}, ${hi}, ${lo})`, `PRand([${lo}, ${lo}, ${hi}])`, // periodic · weighted-random
        `PxRand(${lo}, ${hi + 1})`, `PWalk(1, 1, ${mid})`,                      // non-repeat · ±1 wander
        `var([${lo}, ${hi}], ${pick([4, 8])})`, `Pvar([${lo}, ${hi}], ${pick([8, 16])})`]); // step-var · pattern-swap
};
// float value in [lo, hi] — scalar / random / LFO / ramp / step-var / frozen slice
const floatVal = (lo, hi) => {
    const q = (hi - lo) * 0.25;
    return pick([`${flt(lo, hi)}`, `${flt(lo, hi)}`, `${flt(lo, hi)}`,          // plain (weighted)
        `PWhite(${flt(lo, lo + q)}, ${flt(hi - q, hi)})`,
        `sinvar([${flt(lo, lo + q)}, ${flt(hi - q, hi)}], [${pick([8, 16])}])`,
        `linvar([${flt(lo, hi)}, ${flt(lo, hi)}], [${pick([8, 16])}])`,
        `var([${flt(lo, hi)}, ${flt(lo, hi)}, ${flt(lo, hi)}], ${pick([4, 8])})`,
        `PWhite(${flt(lo, hi)}, ${flt(lo, hi)})[:${pick([4, 8])}]`]);           // frozen random phrase
};
// filter/frequency value in [lo, hi] Hz — scalar or a moving sweep
const freqVal = (lo, hi) => {
    const m = Math.round((lo + hi) / 2);
    return pick([`${rint(lo, hi)}`, `${rint(lo, hi)}`,
        `linvar([${rint(lo, m)}, ${rint(m, hi)}], [${pick([8, 16])}])`,
        `sinvar([${rint(lo, m)}, ${rint(m, hi)}], [${pick([4, 8])}])`,
        `PLorenz(${rint(lo, m)}, ${rint(m, hi)})`,
        `var([${rint(lo, hi)}, ${rint(lo, hi)}, ${rint(lo, hi)}], ${pick([4, 8])})`]);
};

// ── deeper structure builders (nesting · tuplets · polymeter · sus) ────────────
// A degree/dur list whose slots can themselves recurse into sub-lists — per-bar →
// per-beat → per-16th subdivisions.
const deepList = (lo, hi, depth = 2) => '[' + Array.from({ length: rint(2, 4) }, (_, i) =>
    (i > 0 && depth > 0 && chance(0.4)) ? deepList(lo, hi, depth - 1) : rint(lo, hi)).join(', ') + ']';
// A simultaneous group whose members can be subdivided — (0, [4, 7], 2) = root + a
// two-note ratchet + a third voice, all struck together.
const chordSub = () => '(' + Array.from({ length: rint(2, 4) }, (_, i) =>
    (i > 0 && chance(0.35)) ? `[${rint(0, 7)}, ${rint(0, 7)}]` : rint(0, 7)).join(', ') + ')';
// Tuplet / ratchet durations — a slot subdivided into 2..4 hits (flam, roll, triplet).
const tupletDur = () => pick(['[1/4, [1/8, 1/8]]', '[1/2, [1/4, 1/4, 1/4]]', '[1/4, [1/8, 1/8, 1/8]]',
    '[1, [1/2, 1/2]]', '[1/2, 1/4, [1/8, 1/8]]', '[1/4, [1/8, [1/16, 1/16]]]',
    '[1/2, [1/4, [1/8, 1/8]]]', '[3/4, 1/4, [1/8, 1/8]]', '[1/4, 1/4, 1/6, 1/6, 1/6]']);
// Polymeter — durations that cycle against the bar so the phrase drifts and re-aligns.
const polyDur = () => pick([`var([1/4, 1/3, 1/2], [${pick([3, 5])}, ${pick([4, 7])}, ${pick([2, 3])}])`,
    `PDur([${rint(3, 5)}, ${rint(5, 7)}], ${pick([8, 16])})`, `Pvar([PDur(3, 8), PDur(5, 8)], ${pick([8, 16])})`,
    `PDur(${rint(5, 7)}, ${pick([8, 12, 16])})`, '[1/4, 1/4, 1/3, 1/3, 1/3]']);
// sus (note length) shaped per role — staccato / palm-mute vs legato / swell, often evolving.
const susVal = (role) => role === 'bass'
        ? pick(['0.1', flt(0.2, 0.5), 'PDur(3,8)*0.9', 'var([0.1, 0.5], 8)', `[${flt(0.1, 0.3)}, ${flt(0.4, 0.8)}]`])
    : (role === 'pad' || role === 'keys')
        ? pick(['2', '4', 'linvar([2, 6], [16])', `var([2, 4], ${pick([8, 16])})`, 'sinvar([2, 8], [16])'])
        : pick(['0.1', flt(0.1, 0.4), 'PWhite(0.1, 0.6)', `[${flt(0.1, 0.3)}, ${flt(0.5, 1.5)}]`, 'var([0.1, 1], 8)', 'sinvar([0.1, 0.8], [8])']);

// A generator FUNCTION usable as a degree — meant to be NESTED inside a list so a single
// line already contains an arp / walk / motif alongside plain notes. (No [:n] slices here —
// they don't transpile safely inside a list literal.)
const fnDeg = (lo = 0, hi = 7) => pick([
    `arp(${CHORDLIST()}, "${pick(['up', 'down', 'updown'])}")`,
    `motif(${rint(2, 4)})`, `melody()`, `PWalk(${rint(3, 5)}, 1)`, `PxRand(${lo}, ${hi})`,
    `PSine(${lo}, ${hi})`, `PBrown(${lo}, ${hi}, 1)`, `PGrowArp(${CHORDLIST()})`,
    `PShuf([${lo}, ${rint(2, 4)}, ${hi}])`, `PContour(${rint(0, 3)}, 4, ${hi})`]);
// A list that MIXES plain degrees, nested ratchets, chord voices, rests AND nested
// generator functions — e.g. [0, arp([0,4,7], "up"), (2,5), PWalk(3,1)] — so a single
// degree already evolves within the bar instead of repeating one flat shape.
const mixList = (lo, hi) => '[' + Array.from({ length: rint(3, 5) }, (_, i) => {
    if (i === 0) return rint(lo, Math.min(hi, lo + 2));            // anchor low
    const r = Math.random();
    if (r < 0.30) return fnDeg(lo, hi);                            // nested function
    if (r < 0.46) return `[${rint(lo, hi)}, ${rint(lo, hi)}]`;     // ratchet
    if (r < 0.58) return `(${rint(0, 4)}, ${rint(4, 7)})`;         // chord voice
    if (r < 0.68) return '_';                                      // rest
    return rint(lo, hi);
}).join(', ') + ']';
// A duration list that nests rhythm-generator functions (PDur/PBeat) among plain values.
const mixDur = () => '[' + Array.from({ length: rint(2, 4) }, (_, i) => {
    const r = Math.random();
    if (r < 0.28) return pick(['PDur(3,8)', 'PDur(5,8)', 'PBeat("x xx x")']);
    if (r < 0.48) return pick(['[1/8, 1/8]', '[1/4, 1/4]', '[1/8, 1/8, 1/8]']);
    return pick(['1/4', '1/2', '1', '3/4', '1/8']);
}).join(', ') + ']';

// Degree strategies — the clever bit: draw widely from the pattern library per role.
function degBass() {
    return pick([`[0]`, `[0, 0, ${rint(3, 7)}, 0]`, `[0, ${rint(-3, 0)}, ${rint(3, 7)}, 0]`,
                 `PRange(0, 4)`, randList(rint(2, 4), 0, 5), `[0, {0, 3, 5}]`, restList(4, 0, 5),
                 `PWalk(4, 1)`, `PxRand(0, 5)`, `[0, [0, 5], ${rint(2, 5)}, 0]`, `PStep(4, ${rint(3, 7)}, 0)`,
                 `PSaw(0, ${rint(3, 5)})`, `PLorenz(0, ${rint(3, 5)})`, nestList(rint(3, 4), 0, 5),
                 `PPing([0, ${rint(2, 5)}, ${rint(-3, 0)}])`,
                 // deeper / grittier riff shapes
                 deepList(-2, 5, 2), `[0, 0, [-5, -7], 0]`, `[0, [0, 7], ${rint(-3, 0)}, [0, 5]]`,
                 `[0, 0, -5, -5, -7, -7, 0, 0]`, `${chordSub()}`, `[(0, ${rint(3, 7)}), 0, ${rint(-3, 0)}]`,
                 `PStutter([0, ${rint(-3, 0)}, ${rint(3, 7)}], [${rint(3, 6)}, 1, ${rint(1, 3)}])`,
                 `P[0, 0, ${rint(3, 7)}, 0] + P*[0, 0, 0, ${rint(5, 7)}]`,
                 // lists that nest generator functions among the notes
                 mixList(-2, 5), mixList(0, 5)]);
}
function degLead() {
    return pick([`arp(${CHORDLIST()}, "${pick(['up', 'down', 'updown', 'downup'])}")`, `PArp(${CHORDLIST()}, ${rint(0, 9)})`,
                 `arp(${CHORDLIST()}, ${rint(0, 4)})`, `arp(${CHORDLIST()}, var([0, 1, 2], ${pick([4, 8])}))`,
                 `PGrowArp(${CHORDLIST()})`, `melody()[:${rint(4, 8)}]`, `motif(${rint(3, 5)})`, `motif(${rint(4, 8)}, 7, 2, ${pick([4, 8])})`,
                 `PContour(${rint(0, 4)}, 8, 7)`, `PContour(${randList(rint(3, 5), 0, 7)}, 8, 7)`,
                 `P${CHORDLIST()}.invert()`, `P${randList(rint(3, 5), 0, 7)}.layer("add", ${rint(2, 4)})`, `P${randList(rint(4, 6), 0, 7)}.arp([0, ${rint(4, 7)}])`,
                 `PRange(0, ${rint(5, 12)})`, `PCircle(8)`, `PWalk(${rint(5, 9)}, 1)`, `PxRand(0, ${rint(6, 10)})`, restList(rint(4, 6), 0, 7),
                 `PBrown(0, ${rint(5, 9)}, ${rint(1, 2)})`, `PBrown(-${rint(3, 5)}, ${rint(4, 7)}, 1)`, `P${randList(rint(3, 5), 0, 7)}.mirror()`,
                 `PShuf(${CHORDLIST()})`, `PStutter(${randList(rint(3, 4), 0, 7)}, 2)`, `PAlt(${randList(2, 0, 4)}, ${randList(2, 4, 9)})`,
                 `PSine(0, ${rint(5, 9)})`, `PTri(0, ${rint(5, 9)})`, `PLorenz(0, ${rint(5, 9)})`, `PHenon(0, ${rint(5, 9)})`,
                 `PLogistic(3.9, ${flt(0.3, 0.7)}, 0, ${rint(5, 9)})`,
                 `PPing(${randList(rint(3, 5), 0, 7)})`, `PDelta(${zeroDeltas()}, ${rint(0, 3)})`,
                 nestList(rint(3, 5), 0, 7),
                 `P*${randList(rint(3, 5), 0, 9)}`, randList(rint(3, 6), 0, 9),
                 // deeper nesting + chord/arp hybrids + layered transforms
                 deepList(0, 9, 2), deepList(-3, 9, 2), `${chordSub()}`,
                 `[${rint(0, 5)}, ${chordSub()}, ${rint(0, 7)}, [${rint(0, 7)}, ${rint(0, 7)}]]`,
                 `arp(${CHORDLIST()}, "up") + P[0, 0, ${rint(3, 5)}]`,
                 `PZip(${randList(rint(3, 4), 0, 7)}, ${randList(rint(3, 4), 0, 7)})`,
                 `PStutter(${randList(rint(3, 4), 0, 7)}, [${rint(2, 4)}, 1, ${rint(1, 3)}])`,
                 `P${randList(rint(3, 5), 0, 7)}.stretch(${pick([8, 16])})`,
                 `P${randList(rint(3, 5), 0, 9)}.palindrome()`, `melody()[:${rint(5, 9)}] + P*[0, ${rint(3, 7)}]`,
                 `PShuf(${randList(rint(4, 6), 0, 9)})`,
                 // lists that nest generator functions among the notes
                 mixList(0, 8), mixList(-3, 9), mixList(0, 7)]);
}
function degPad() {
    return pick([`PRoman(${ROMAN()})`, `PProg("${pick(['50s', '251', 'pop', 'andalusian', 'canon'])}")`, `PProg(${rint(0, 6)})`,
                 `PChord(0, "${pick(['7', '9', 'sus4', 'add9', '11'])}")`, `PCircle(8, 0, "7")`,
                 `P${CHORDLIST()}.layer("add", ${rint(2, 4)})`,
                 `[0, (0,4,7), 5, (2,5,9)]`, `(0,4,7,11)`, `PZip(${CHORDLIST()}, ${randList(3, 4, 9)})`,
                 // nested voicings + evolving chord qualities
                 `[(0,4,7), [(2,5,9), (4,7,11)], (5,9,0)]`, `PChord(0, var(["7", "9", "add9", "m7"], ${pick([8, 16])}))`,
                 `Pvar([PRoman(${ROMAN()}), PRoman(${ROMAN()})], ${pick([8, 16])})`,
                 `PProg("${pick(['50s', '251', 'andalusian', 'canon'])}").layer("add", ${rint(2, 4)})`,
                 `[(0,4,7), (0,3,7), [(0,5,7), (0,4,7,11)]]`]);
}
const degForRole = (role) => role === 'bass' ? degBass()
    : (role === 'pad' || role === 'keys') ? degPad()
    : role === 'perc' ? pick([`[0]`, `[0]`, `[0, _, 0, _]`, restList(rint(4, 8), 0, 2), `PBin(${pick([8, 16])})`, `PEuclid(${pick([8, 16])}, ${rint(3, 5)})`])
    : role === 'pluck' ? (chance(0.5) ? degLead() : pick([`PCircle(8)`, `arp(${CHORDLIST()}, "up")`, `PGrowArp(${CHORDLIST()})`, randList(rint(3, 6), 0, 9)]))
    : degLead();

const durForRole = (role) => {
    // ~1 in 3 non-pad lines gets an intricate rhythm: tuplet, polymeter, or a mixed list
    // that nests rhythm-generator functions (PDur/PBeat) among plain durations.
    if (role !== 'pad' && role !== 'keys' && chance(0.34)) return pick([tupletDur(), polyDur(), mixDur(), mixDur()]);
    if (role === 'bass') return pick(['1/2', '1', '2', '3/4', '4/3', 'PDur(3,8)', 'PDur([3,5],8)', 'PDur([3,3,2],8)', 'PDur(5,8)',
        '[1, [1/2, 1/2]]', '[1, [1/2, [1/4, 1/4]]]', '[3/4, 1/4]', '[2, 1, 1]', 'var([1, 1/2], 8)', 'var([2, 1, 1/2], [2, 3, 3])', 'PBeat("x x xx")']);
    if (role === 'pad' || role === 'keys') return pick(['2', '4', '1', '3', '8', '[2, 4]', '[4, [2, 2]]', '[4, [2, [1, 1]]]', '[1, 2, 1]',
        'Pvar([2, 4], 16)', 'var([4, 2], [3, 1])', 'linvar([2, 6], [16])', 'var([4, 2, 3], 8)']);
    if (role === 'perc') return pick(['1/4', '1/2', '1', '1/8', '1/3', 'PDur(3,8)', 'PDur(5,8)', 'PDur(5,16)', 'PBeat("x xx x")', 'PBeat("x x xx x")',
        '[1/4, 1/2]', '[1/4, [1/8, 1/8]]', '[1/8, 1/8, 1/4]', tupletDur(), mixDur()]);
    // lead / pluck — the widest palette (no duplicate-weighting, so no one value dominates)
    return pick(['1/4', '1/2', '1', '3/4', '1/8', '1/3', '2/3', 'PDur(3,8)', 'PDur([3,5],8)', 'PDur(5,8)', 'PDur(5,16)',
        'PGroove("swing")', 'PGroove("gallop")', `PGroove(${rint(0, 9)})`, 'PBeat("x xx x")', 'PBeat("x x xx")',
        '[1/4, 1/2]', '[1/2, 1/4, 1/4]', '[1/4, [1/4, 1/2]]', '[3/4, 1/4]', '[1/2, [1/4, 1/4, 1/4]]', '[1/4, [1/8, 1/8], 1/2]',
        'var([1/4, 1/2], 8)', 'var([1/2, 1/4, 1/8], [2, 3, 3])', 'Pvar([1/4, 1/2], 8)']);
};
// oct — integer octave, static or evolving, kept inside the role's ~2-octave window.
const octForRole = (role) => {
    const base = role === 'bass' ? [3, 3, 4] : role === 'perc' ? [3, 4, 5] : role === 'pluck' ? [5, 6] : (role === 'pad' || role === 'keys') ? [4, 5] : [5, 5, 6];
    const lo = Math.min(...base), hi = Math.max(...base) + 1;
    return chance(0.5) ? String(pick(base)) : intVal(lo, hi);   // half plain (role-weighted), half a pattern/var
};
// amp — a float that may itself be a random/accent pattern or an evolving TimeVar.
const ampForRole = (role) => {
    const lo = role === 'bass' ? 0.5 : (role === 'pad' || role === 'keys') ? 0.3 : 0.28;
    const hi = role === 'bass' ? 0.8 : (role === 'pad' || role === 'keys') ? 0.45 : 0.42;
    if (chance(0.12)) return `Pacc("${pick(['offbeat', 'ghost', 'backbeat'])}")`;
    return floatVal(lo, hi);
};
// Occasional extra param that is itself a pattern/timevar — pan movement, a transpose.
const panExtra = () => !chance(0.32) ? '' : ', ' + pick([
    `pan=PGauss(0, ${flt(0.3, 0.6)})`, `pan=sinvar([-1, 1], [${pick([8, 16])}])`, `pan=PWhite(-0.7, 0.7)`, `pan=[-0.5, 0.5]`,
    `pan=[-0.6, [0, 0.6]]`, `pan=var([-0.5, 0.5], ${pick([4, 8])})`, `pan=PWhite(-0.8, 0.8)[:${pick([4, 8])}]`,
]);
const transposeExtra = () => !chance(0.22) ? '' : ' + ' + pick([`${rint(2, 7)}`, `(0,4,7)`, `(0,3,7)`, `[0, ${rint(2, 5)}]`]);

// An FX mix/depth (0..1) that usually MOVES — chaos should modulate its effects live,
// not merely switch them on. Scalar / weighted-random / LFO-swept / stepped / per-step.
const fxv = (lo, hi) => {
    const q = (hi - lo) * 0.3;
    return pick([`${flt(lo, hi)}`, `${flt(lo, hi)}`,
        `sinvar([${flt(lo, lo + q)}, ${flt(hi - q, hi)}], [${pick([8, 16])}])`,
        `linvar([${flt(lo, hi)}, ${flt(lo, hi)}], [${pick([8, 16, 32])}])`,
        `var([${flt(lo, hi)}, ${flt(lo, hi)}], ${pick([4, 8])})`,
        `PWhite(${flt(lo, lo + q)}, ${flt(hi - q, hi)})`,
        `[${flt(lo, hi)}, ${flt(lo, hi)}]`]);
};
// An FX rate/time/count that sometimes evolves into a var or per-step pattern.
const fxr = (...opts) => pick([...opts, ...opts,
    `var([${pick(opts)}, ${pick(opts)}], ${pick([4, 8])})`, `P[${pick(opts)}, ${pick(opts)}]`]);

// FX ideas — a broad palette; every depth can breathe on a TimeVar and rates/counts can
// themselves pattern, so the FX evolve. Each is a distinct thunk (pickN never repeats a key).
const FX = [
    () => `lpf=${freqVal(300, 6000)}${chance(0.4) ? `, lpr=${floatVal(0.2, 0.6)}` : ''}`,
    () => `hpf=${freqVal(200, 1200)}`,
    () => `bpf=${freqVal(600, 3000)}, bpr=${floatVal(0.1, 0.5)}`,
    () => `djf=${pick([flt(0.15, 0.4), flt(0.6, 0.85), 'sinvar([0.2, 0.8], [16])'])}`,
    () => `mverb=${fxv(0.3, 0.7)}, mverbmix=0.6`,
    () => `room=${flt(0.5, 0.9)}, reverb=${fxv(0.3, 0.6)}`,
    () => `cheapverb=${fxv(0.4, 0.7)}`,
    () => `chorus=${fxv(0.3, 0.7)}, chorus_rate=${fxr('0.3', '0.5', '0.8')}`,
    () => `echo=${fxv(0.2, 0.5)}, echo_time=${fxr('0.25', '0.375', '0.5')}`,
    () => `fbdelay=${flt(0.4, 0.6)}, fbtime=0.25, fbfeed=${fxv(0.3, 0.6)}, fbcutoff=3000`,
    () => `pong=${fxv(0.3, 0.6)}, pongtime=${pick(['0.25', '0.375'])}`,
    () => `spin=${fxv(0.4, 0.8)}`,
    () => `chop=${fxr('2', '4', '4', '8')}`,
    () => `rgate=${fxv(0.5, 0.9)}, rgaterate=${fxr('4', '8', '16')}`,
    () => `tremolo=${fxv(0.4, 0.7)}, trem_rate=${fxr('4', '8')}`,
    () => `vibrato=${fxv(0.4, 0.8)}, vib_rate=${rint(4, 8)}`,
    () => `flanger=${fxv(0.4, 0.7)}, flanger_rate=${pick([flt(0.2, 0.6), 'sinvar([0.1, 0.6], [16])'])}`,
    () => `phaser=${fxv(0.4, 0.7)}, phaser_rate=${pick([flt(0.2, 0.6), 'sinvar([0.1, 0.6], [16])'])}`,
    () => `ringmod=${fxv(0.3, 0.6)}, ringmod_freq=${pick([`${rint(100, 900)}`, `linvar([${rint(100, 400)}, ${rint(500, 900)}], [8])`])}`,
    () => `formant=${fxv(0.4, 0.8)}, formant_vowel=${fxr('0', '1', '2', '4')}`,
    () => `vowel=${fxv(0.4, 0.7)}`,
    () => `drive=${flt(1, 5, 1)}, tanh=${fxv(0.3, 0.6)}`,
    () => `shape=${fxv(0.4, 0.7)}`,
    () => `dist2=${fxv(0.4, 0.7)}, dist2shape=${floatVal(0.1, 0.5)}`,
    () => `crush=${fxv(0.4, 0.7)}, bits=${fxr('4', '5', '6', '8')}`,
    () => `multicrush=${fxv(0.4, 0.7)}`,
    () => `fold=${fxv(0.3, 0.6)}, symetry=${rint(1, 3)}`,
    () => `lofi=${fxv(0.4, 0.7)}`,
    () => `tube=${fxv(0.4, 0.8)}`,
    () => `resonbank=${fxv(0.2, 0.4)}, rbfreq=${rint(40, 80)}`,
    () => `eq3=1, eqlow=${rint(-4, 5)}, eqhigh=${rint(-4, 5)}`,
    // ── newer FX (alpha29/30 ports) ──
    () => `mpf=${freqVal(400, 2200)}, mpr=${floatVal(1, 3.5)}`,                       // Moog ladder LPF
    () => `resonz=${fxv(0.5, 0.8)}, rfreq=${freqVal(400, 2200)}`,                     // resonant band
    () => `fshift=${pick([`${rint(20, 300)}`, `linvar([${rint(20, 150)}, ${rint(150, 300)}], [16])`])}, fmix=${fxv(0.3, 0.6)}`, // frequency shift (metallic)
    () => `shimmer=${fxv(0.4, 0.7)}, shimpitch=${flt(0.4, 1)}`,                       // octave-shimmer reverb
    () => `room2=${flt(0.5, 0.9)}, mix2=${fxv(0.2, 0.4)}`,                            // stereo reverb
    () => `combres=${fxv(0.4, 0.7)}, combfreq=${rint(120, 400)}`,                     // comb resonator
    () => `subenh=${fxv(0.4, 0.7)}`,                                                  // sub-bass enhancer
    () => `stereowidth=${fxv(0.5, 0.85)}`,                                            // stereo widener
    () => `pumper=${flt(0.6, 0.9)}, pumprate=1`,                                      // sidechain pump
    // ── glitch / character FX ──
    () => `octclean=${fxv(0.4, 0.8)}, ocsub=${fxv(0.3, 0.7)}, ocup=${fxv(0.2, 0.5)}`, // clean octaver (±1 oct)
    () => `squiz=${fxv(0.4, 0.7)}, squizpitch=${fxr('2', '3', '4', '5')}`,            // grainy pitch-up glitch
    () => `drop=${fxv(0.4, 0.7)}, dropof=${flt(0.3, 0.6)}`,                           // waveform dropout glitch
    () => `ebmix=${fxv(0.4, 0.7)}, ebfeed=${fxv(0.3, 0.6)}`,                          // tape echo
    () => `csweep=${fxv(0.4, 0.7)}, cswrate=${flt(0.1, 0.5)}`,                        // auto filter sweep
    () => `sbrk=${fxv(0.4, 0.7)}`,                                                    // beat-repeat stutter
    () => `feed=${fxv(0.4, 0.7)}, feedfreq=${rint(200, 2000)}`,                       // feedback tone
    () => `comp=${flt(0.5, 0.8)}, compthresh=${flt(0.3, 0.6)}`,                       // compressor
    () => `drcomp=${fxv(0.4, 0.8)}`,                                                  // dynamics / drum compressor
    () => `lpf=PLorenz(${rint(300, 700)}, ${rint(3000, 6000)})`,                      // chaotic filter movement
];
// Live transforms + fatteners chained onto the player.
const METHODS = [
    () => `.every(${pick([4, 8, 8, 16])}, "${pick(['rotate', 'reverse', 'mirror'])}")`,
    () => `.sometimes("${pick(['stutter', 'mirror', 'reverse'])}"${chance(0.5) ? ', ' + rint(2, 4) : ''})`,
    () => `.unison(${pick([2, 2, 3, 4])}${chance(0.4) ? ', ' + flt(0.2, 0.5) : ''})`,
    () => `.penta()`,
    () => `.human(${rint(15, 35)}, ${rint(4, 10)})`,
    () => `.reroll(${pick([4, 8, 8, 16])})`,   // re-roll frozen random generators over time
];

// ── Styles ────────────────────────────────────────────────────────────────────
// chaos()/son() pick ONE style per block so the output is coherent — and it varies
// call-to-call: a punk block, a techno block, a synthwave block, an ambient block, or
// the broad "eclectic" default. Each style biases the synth pool, scale, degree/rhythm
// idiom, register, FX and dynamics. Only synths that exist in the roster are listed.
const powerDeg = () => pick(['[0,0,-5,-5,-7,-7,0,0]', '[0,7]', '[0,0,0,7]', '[0,0,3,5]', '[0,-5,0,-7]']);
const pentaDeg = () => pick(['PRand([0,3,5,7,10])', 'PxRand(0,10)', 'PWalk(5,1)', '[0,3,5,7]', 'PShuf([0,3,5,7,10])']);
const STYLES = {
    // PUNK / rock — gritty voices, power chords + pentatonic, palm-muted chug, driven.
    punk: {
        pools: { bass: ['dab', 'growl', 'dbass', 'ebass', 'a_gesa', 'cbass', 'doom', 'superbass'], lead: ['war', 'fuzz', 'guitar', 'saw', 'ssaw', 'pulse', 'dirt', 'darklead'], keys: ['guitar', 'war'] },
        scales: ['minor', 'phrygian', 'blues', 'harmonicMinor'], scaleChance: 0.9,
        roles: ['bass', 'lead', 'lead', 'lead', 'keys'],
        deg: (r) => r === 'bass' ? pick(['[0]', '[0,0,7,0]', '[0,0,-5,-5,-7,-7,0,0]', '[0,7,0,5]', pentaDeg()]) : (chance(0.55) ? powerDeg() : pentaDeg()),
        oct: (r) => String(r === 'bass' ? pick([3, 4]) : pick([5, 6])),
        dur: () => pick(['1/2', '1/2', '1/4', '1']),
        amp: (r) => r === 'bass' ? '0.8' : String(flt(0.6, 0.85)),
        extra: (r) => `, sus=${flt(0.3, 0.5)}`,
        fxChance: 0.7,
        fx: [() => `crush=${flt(0.4, 0.7)}, bits=${rint(3, 6)}`, () => `dist2=${flt(0.4, 0.7)}`, () => `tanh=${flt(0.4, 0.7)}`,
             () => `fold=${flt(0.3, 0.6)}`, () => `drive=${flt(2, 5, 1)}, tanh=${flt(0.3, 0.6)}`, () => `rgate=${flt(0.6, 0.9)}, rgaterate=8`,
             () => `echo=${flt(0.2, 0.4)}, echo_time=0.375`, () => `lpf=${freqVal(600, 5000)}`],
    },
    // TECHNO — repetitive acid/sub bass, stabs, driving 16ths, filter sweeps + pump.
    techno: {
        pools: { bass: ['dbass', 'acidbass', 'tb303', 'dab', 'pumpbass', 'a_daft', 'lbass', 'wob', 'acidline'], lead: ['saw', 'pulse', 'blip', 'ssaw', 'fuzz', 'tekno', 'hardstab'], keys: ['pluck', 'blip'] },
        scales: ['minor', 'phrygian', 'dorian'], scaleChance: 0.85,
        roles: ['bass', 'bass', 'lead', 'lead', 'keys'],
        deg: (r) => r === 'bass' ? pick(['[0]', '[0,0,0,7]', 'PxRand(0,5)', 'PRand([0,0,3,5,7])', '[0, _, 0, 3]']) : pick(['[0]', 'PxRand(0,7)', `arp(${CHORDLIST()}, "up")`, 'PRand([0,3,7,10])']),
        oct: (r) => String(r === 'bass' ? pick([3, 4]) : pick([5, 6])),
        dur: (r) => r === 'bass' ? pick(['1/2', '1', '1/2']) : pick(['1/4', '1/4', '1/16', 'PDur(3,8)']),
        amp: (r) => r === 'bass' ? String(flt(0.7, 0.85)) : String(flt(0.4, 0.6)),
        fxChance: 0.75,
        fx: [() => `lpf=${freqVal(400, 5000)}, lpr=${floatVal(0.2, 0.5)}`, () => `djf=${flt(0.6, 0.85)}`, () => `crush=${flt(0.4, 0.6)}, bits=${rint(4, 8)}`,
             () => `pong=${flt(0.3, 0.5)}, pongtime=0.375`, () => `pumper=${flt(0.7, 0.9)}, pumprate=1`, () => `fbdelay=0.5, fbtime=0.25, fbfeed=${flt(0.3, 0.5)}, fbcutoff=3000`,
             () => `mpf=${freqVal(400, 2200)}, mpr=${flt(1, 3)}`],
    },
    // INDUSTRIAL — harsh machine music: doom/glitch bass, tekno/hardstab leads, clipped
    // drones + brutal snares, heavy crush/fold/multicrush, driving 16ths, dark scales.
    industrial: {
        pools: { bass: ['doom', 'glitchbass', 'wob', 'a_gesa', 'superbass', 'dab'], lead: ['tekno', 'hardstab', 'dirt', 'darklead', 'virus'], pad: ['industrialdrone', 'gaze'], perc: ['industrialsnare', 'crunch'] },
        scales: ['phrygian', 'minor', 'locrian', 'harmonicMinor'], scaleChance: 0.92,
        roles: ['bass', 'bass', 'lead', 'lead', 'pad', 'perc'],
        deg: (r) => r === 'bass' ? pick(['[0]', '[0,0,0,-5]', 'PxRand(0,5)', '[0, _, 0, 3]', 'PStep(4, 0, -5)'])
            : r === 'pad' ? pick(['[0]', '(0,3,7)', degPad()])
            : r === 'perc' ? pick(['[0]', restList(rint(4, 8), 0, 2)])
            : pick(['[0]', 'PxRand(0,7)', powerDeg(), 'PRand([0,3,5,7,10])']),
        oct: (r) => String(r === 'bass' ? pick([2, 3, 4]) : r === 'pad' ? pick([4, 5]) : r === 'perc' ? pick([4, 5]) : pick([5, 6])),
        dur: (r) => r === 'bass' ? pick(['1/2', '1', 'PDur(3,8)']) : r === 'pad' ? pick(['4', '8']) : r === 'perc' ? pick(['1/4', '1/2', 'PBeat("x xx x")']) : pick(['1/4', '1/16', '1/2', 'PDur([3,5],8)']),
        amp: (r) => r === 'bass' ? String(flt(0.7, 0.9)) : r === 'pad' ? String(flt(0.25, 0.4)) : r === 'perc' ? String(flt(0.5, 0.7)) : String(flt(0.4, 0.6)),
        fxChance: 0.82,
        fx: [() => `crush=${flt(0.5, 0.8)}, bits=${rint(3, 6)}`, () => `dist2=${flt(0.5, 0.8)}`, () => `fold=${flt(0.4, 0.7)}`,
             () => `multicrush=${flt(0.5, 0.8)}`, () => `rgate=${flt(0.6, 0.9)}, rgaterate=${pick([8, 16])}`, () => `lpf=${freqVal(400, 4000)}, lpr=${floatVal(0.2, 0.5)}`,
             () => `fbdelay=0.5, fbtime=0.25, fbfeed=${flt(0.3, 0.5)}, fbcutoff=2000`],
    },
    // SYNTHWAVE — the lush 80s: analog leads/pads, arps + roman progressions, reverb/chorus.
    synthwave: {
        pools: { bass: ['dbass', 'synthbass', 'cbass'], lead: ['prophet', 'cs80', 'hoover', 'supersaw', 'ssaw', 'plaits'], pad: ['pads', 'choir', 'brass', 'a_vpad'], keys: ['rhodes', 'bell'] },
        scales: ['minor', 'dorian', 'major', 'lydian'], scaleChance: 0.7,
        roles: ['bass', 'lead', 'lead', 'pad', 'keys'],
        deg: (r) => r === 'bass' ? degBass() : (r === 'pad' || r === 'keys') ? degPad() : degLead(),
        oct: (r) => String(r === 'bass' ? pick([3, 4]) : (r === 'pad' || r === 'keys') ? pick([4, 5]) : pick([5, 6])),
        dur: (r) => r === 'bass' ? pick(['1/2', '1']) : (r === 'pad' || r === 'keys') ? pick(['2', '4']) : pick(['1/4', '1/2', 'PDur(3,8)']),
        amp: (r) => r === 'bass' ? String(flt(0.6, 0.8)) : (r === 'pad' || r === 'keys') ? String(flt(0.3, 0.45)) : String(flt(0.3, 0.45)),
        fxChance: 0.8,
        fx: [() => `chorus=${flt(0.3, 0.7)}, chorus_rate=${flt(0.2, 0.6)}`, () => `reverb=${floatVal(0.3, 0.6)}, room=${flt(0.5, 0.8)}`, () => `mverb=${floatVal(0.3, 0.6)}, mverbmix=0.6`,
             () => `echo=${flt(0.2, 0.4)}, echo_time=0.375`, () => `phaser=${flt(0.4, 0.6)}, phaser_rate=${flt(0.2, 0.5)}`, () => `lpf=${freqVal(1200, 6000)}`],
    },
    // AMBIENT — slow evolving pads/textures, long notes, big reverb + shimmer, sparse.
    ambient: {
        pools: { pad: ['pads', 'choir', 'darkpad', 'organ', 'a_vpad', 'gaze', 'waves', 'industrialdrone'], lead: ['plaits', 'bell', 'sine', 'klank', 'rsin'], bass: ['dbass', 'synthbass'] },
        scales: ['dorian', 'lydian', 'minor', 'melodicMinor', 'egyptian'], scaleChance: 0.8,
        roles: ['pad', 'pad', 'lead', 'bass'],
        deg: (r) => r === 'bass' ? pick(['[0]', '[0, 5]', 'PWalk(3,1)']) : (r === 'pad') ? degPad() : pick(['motif(3)', 'melody()[:4]', `arp(${CHORDLIST()}, "up")`, 'PSine(0,7)']),
        oct: (r) => String(r === 'bass' ? pick([3, 4]) : r === 'pad' ? pick([4, 5]) : pick([5, 6])),
        dur: (r) => r === 'pad' ? pick(['4', '8', '4']) : r === 'bass' ? pick(['4', '2']) : pick(['1', '2', '4']),
        amp: (r) => r === 'pad' ? String(flt(0.25, 0.4)) : String(flt(0.2, 0.35)),
        fxChance: 0.9,
        fx: [() => `shimmer=${flt(0.4, 0.7)}, shimpitch=${flt(0.5, 1)}`, () => `room2=${flt(0.6, 0.9)}, mix2=${flt(0.3, 0.4)}`, () => `mverb=${floatVal(0.5, 0.8)}, mverbmix=0.7`,
             () => `cheapverb=${floatVal(0.5, 0.8)}, cvdecay=${rint(2, 6)}`, () => `reverb=${floatVal(0.4, 0.7)}`, () => `lpf=${freqVal(600, 3000)}`],
    },
};

// Build one styled line. `S` is a STYLES entry; role/synth/degree/rhythm/FX all come from it.
function synthLineStyled(name, S) {
    const role  = pick(S.roles);
    const synth = pick(S.pools[role] || S.pools.lead);
    let deg = S.deg(role);
    if (chance(0.1)) deg = `Pvar([${deg}, ${S.deg(role)}], ${pick([8, 16])})`;
    const fxN  = chance(S.fxChance) ? (chance(0.45) ? (chance(0.35) ? 3 : 2) : 1) : 0;
    const fx   = fxN ? ', ' + pickN(S.fx, fxN).map(f => f()).join(', ') : '';
    const extra = S.extra ? S.extra(role) : '';
    const susE  = (!extra.includes('sus=') && chance(0.4)) ? `, sus=${susVal(role)}` : '';
    const meth = chance(0.35) ? pickN(METHODS, 1).map(f => f()).join('') : '';
    return `${name} >> ${synth}(${deg}, oct=${S.oct(role)}, dur=${S.dur(role)}, amp=${S.amp(role)}${susE}${extra}${panExtra()}${fx})${meth}`;
}

function synthLine(name) {
    const synth = pick(GEN_SYNTHS);
    const role  = roleOf(synth);
    // degree — occasionally a Pvar that swaps between two whole phrases over time.
    let deg = degForRole(role);
    if (chance(0.12)) deg = `Pvar([${deg}, ${degForRole(role)}], ${pick([8, 16])})`;
    const fxN   = chance(0.82) ? (chance(0.5) ? (chance(0.4) ? 3 : 2) : 1) : 0;
    const fx    = fxN ? ', ' + pickN(FX, fxN).map(f => f()).join(', ') : '';
    const mN    = chance(0.6) ? (chance(0.3) ? 2 : 1) : 0;
    const meth  = pickN(METHODS, mN).map(f => f()).join('');
    const susE  = chance(0.35) ? `, sus=${susVal(role)}` : '';
    return `${name} >> ${synth}(${deg}, oct=${octForRole(role)}, dur=${durForRole(role)}, amp=${ampForRole(role)}${susE}${panExtra()}${fx})${meth}${transposeExtra()}`;
}

function drumLine(name, chars) {
    const hit = () => pick(chars);
    let patt;
    if (chance(0.28)) {
        // a Euclidean drum pattern using a real loaded char
        patt = `play(PEuclid2(${rint(3, 5)}, ${pick([8, 16])}, ".", "${hit()}")`;
    } else if (chance(0.18)) {
        // a ROTATED euclid (PEuclidR) turned into a play string via .submap
        patt = `play(PEuclidR(${pick([8, 16])}, ${rint(3, 5)}, ${rint(1, 3)}).submap({1:"${hit()}", 0:"."})`;
    } else {
        // a hand-rolled string, sometimes with a [subdivided] or (layered) step
        const len = pick([8, 8, 16]); let s = '';
        for (let i = 0; i < len; i++) {
            if (chance(0.12) && i < len - 1) s += '[' + hit() + hit() + ']';
            else if (chance(0.08)) s += '(' + hit() + hit() + ')';
            else s += chance(0.5) ? '.' : hit();
        }
        if (!/[^.[\]()]/.test(s)) s = hit() + s.slice(1);
        patt = `play("${s}"`;
    }
    const dur  = pick(['1/4', '1/2', '1/2']);
    const fx   = chance(0.35) ? ', ' + pick(FX)() : '';
    const meth = chance(0.3) ? `.sometimes("stutter", ${rint(2, 4)})` : '';
    return `${name} >> ${patt}, dur=${dur}, amp=${flt(0.55, 0.9)}${fx})${meth}`;
}

// Generate `n` random player lines. type: 'synth' | 'drum' | null (mix).
// opts: { sampleChars: [...], taken: Set<existing names> } → names avoid collisions.
const SCALES = ['minor', 'major', 'dorian', 'phrygian', 'mixolydian', 'lydian', 'harmonicMinor',
    'melodicMinor', 'hungarianMinor', 'blues', 'egyptian', 'wholeTone', 'bhairav'];

export function chaosLines(n = 4, type = null, { sampleChars = [], taken = new Set() } = {}) {
    const lines = [];
    // Pick ONE coherent style for the block — eclectic weighted so it stays broad/varied,
    // then punk / techno / synthwave / ambient for a focused vibe. No arg needed: chaos()
    // just lands somewhere different each time.
    const S = STYLES[pick(['eclectic', 'eclectic', 'punk', 'techno', 'industrial', 'synthwave', 'ambient'])] || null;
    if (S) { if (chance(S.scaleChance)) lines.push(`Scale.default = "${pick(S.scales)}"`); }
    else if (chance(0.4)) lines.push(`Scale.default = "${pick(SCALES)}"`);
    let idx = 1;
    const freeName = () => { while (taken.has('g' + idx)) idx++; const nm = 'g' + idx; taken.add(nm); idx++; return nm; };
    for (let i = 0; i < Math.max(1, n | 0); i++) {
        let t = type;
        if (!t) t = (sampleChars.length && chance(0.35)) ? 'drum' : 'synth';
        const name = freeName();
        lines.push(t === 'drum' && sampleChars.length ? drumLine(name, sampleChars)
            : (S ? synthLineStyled(name, S) : synthLine(name)));
    }
    return lines;
}

// ── son() / soff() — generative jam bot ───────────────────────────────────────
// A self-rescheduling bot that adds / stops / mutates its own `g*` players over
// time (kept apart from the user's players so it never fights manual code). Every
// line runs through `run` (= runCode) so in a session the bot's output broadcasts
// to peers automatically. Dependencies are injected so this
// module stays pure/testable: { clock, run, sampleChars }.
// FX trigger params only (each activates its own effect node); single-value so
// they work as a live `gN.<param> = <value>` mutation line.
const FX_MUTATE = [
    () => ['lpf', rint(400, 6000)],
    () => ['hpf', rint(200, 2000)],
    () => ['bpf', rint(600, 4000)],
    () => ['mpf', rint(400, 2200)],
    () => ['resonz', flt(0.5, 0.8)],
    () => ['mverb', flt(0.2, 0.7)],
    () => ['reverb', flt(0.3, 0.6)],
    () => ['cheapverb', flt(0.4, 0.7)],
    () => ['shimmer', flt(0.3, 0.7)],
    () => ['chorus', flt(0.3, 0.7)],
    () => ['flanger', flt(0.4, 0.7)],
    () => ['phaser', flt(0.4, 0.7)],
    () => ['ringmod', flt(0.3, 0.6)],
    () => ['spin', flt(0.4, 0.8)],
    () => ['tremolo', flt(0.4, 0.7)],
    () => ['vibrato', flt(0.4, 0.7)],
    () => ['vowel', flt(0.4, 0.7)],
    () => ['formant', flt(0.4, 0.8)],
    () => ['fshift', rint(20, 300)],
    () => ['tanh', flt(0.3, 0.6)],
    () => ['drive', flt(1, 4, 1)],
    () => ['shape', flt(0.3, 0.6)],
    () => ['dist2', flt(0.4, 0.7)],
    () => ['fold', flt(0.3, 0.6)],
    () => ['crush', flt(0.4, 0.7)],
    () => ['lofi', flt(0.4, 0.7)],
    () => ['tube', flt(0.4, 0.8)],
    () => ['squiz', flt(0.4, 0.7)],
    () => ['drop', flt(0.4, 0.7)],
    () => ['octclean', flt(0.4, 0.8)],
    () => ['echo', flt(0.2, 0.5)],
    () => ['pong', flt(0.3, 0.6)],
    () => ['ebmix', flt(0.4, 0.7)],
    () => ['pumper', flt(0.6, 0.9)],
    () => ['chop', pick([2, 4, 8])],
    () => ['rgate', flt(0.5, 0.9)],
    () => ['drcomp', flt(0.4, 0.8)],
];

export class JamBot {
    constructor({ clock, run, sampleChars = () => [], prefix = 'g' } = {}) {
        this.clock = clock; this.run = run; this.sampleChars = sampleChars; this.prefix = prefix;
        this.running = false;
        this.active = new Set();   // generated player names currently live
        this.born   = new Map();   // name → tick it was created (so fresh ones survive)
        this.tick   = 0;
        this.opts   = {};
    }

    start(opts = {}) {
        // max is a HARD cap on the bot's own g* players (your manual players don't
        // count). Default 3–5 — it keeps turning voices over to stay under it.
        this.opts = { synth: 0.5, drum: 0.35, min: 3, max: 5, every: [2, 6], ...opts };
        if (this.opts.max < 1) this.opts.max = 1;
        if (this.opts.min > this.opts.max) this.opts.min = this.opts.max;
        if (this.running) return `jam bot already running (${this.active.size} players)`;
        this.running = true;
        this._pickStyle();
        this._next();
        return `jam bot on — g* players, ${this.opts.min}–${this.opts.max} voices`;
    }

    stop(clearPlayers = false) {
        this.running = false;
        if (clearPlayers) { for (const n of [...this.active]) this._stopByName(n); }
        return 'jam bot off' + (clearPlayers ? ' (players stopped)' : '');
    }

    _next() {
        const [lo, hi] = this.opts.every;
        const dur = lo + Math.random() * Math.max(0, hi - lo);
        this.clock.future(dur, () => { if (this.running) { try { this._order(); } catch (e) { /* keep the loop alive */ } this._next(); } });
    }

    _pickStyle() {
        // A jam sits in one style, drifting occasionally — punk / techno / synthwave /
        // ambient, or eclectic (the broad default). Sets a matching scale when it changes.
        this.style = STYLES[pick(['eclectic', 'eclectic', 'punk', 'techno', 'industrial', 'synthwave', 'ambient'])] || null;
        if (this.style && chance(this.style.scaleChance)) this.run(`Scale.default = "${pick(this.style.scales)}"`);
    }

    _order() {
        this.tick++;
        if (chance(0.06)) this._pickStyle();          // occasionally drift to a new style
        // Prune names whose players the user/Alt+X stopped out from under us.
        for (const n of [...this.active]) { const p = this.clock._players.get(n); if (!p || p._active === false) this._forget(n); }
        const n = this.active.size;
        if (n >= this.opts.max) {
            // At the hard cap → make room by retiring a voice (even a fresh one), or
            // just tweak an existing one. NEVER add.
            if (Math.random() < 0.55) this._stopOne(true);
            else if (Math.random() < 0.5) this._mutate();
            else this._fx();
            return;
        }
        if (n < this.opts.min) { this._add(); return; }
        // In-band: mostly add/tweak, but regularly stop one so voices keep turning over.
        const action = pick(['add', 'add', 'stop', 'stop', 'mutate', 'mutate', 'fx', 'fx']);
        if (action === 'add') this._add();
        else if (action === 'stop') this._stopOne();
        else if (action === 'mutate') this._mutate();
        else this._fx();
    }

    _freeName() {
        let i = 1; while (this.active.has(this.prefix + i) || this.clock._players.get(this.prefix + i)) i++;
        return this.prefix + i;
    }

    _add() {
        if (this.active.size >= this.opts.max) return;
        const name  = this._freeName();
        const chars = this.sampleChars();
        const wantDrum = chars.length && Math.random() < this.opts.drum / (this.opts.synth + this.opts.drum);
        const line = wantDrum ? drumLine(name, chars) : (this.style ? synthLineStyled(name, this.style) : synthLine(name));
        this.active.add(name); this.born.set(name, this.tick);
        this.run(line);
    }

    _stopOne(force = false) {
        // Prefer retiring players that have lived a couple ticks (let fresh ones
        // breathe). At the cap (force) we retire even a fresh one to make room.
        let pool = [...this.active].filter(n => this.tick - (this.born.get(n) ?? this.tick) >= 2);
        if (!pool.length && force) pool = [...this.active];
        if (pool.length) this._stopByName(pick(pool));
    }

    _stopByName(name) {
        const p = this.clock._players.get(name);
        if (p) p.stop();
        this._forget(name);
    }

    _forget(name) { this.active.delete(name); this.born.delete(name); }

    _live() { return [...this.active]; }

    _mutate() {
        const names = this._live(); if (!names.length) return this._add();
        const name = pick(names);
        const attr = pick(['amp', 'oct', 'dur', 'degree']);
        let v;
        if (attr === 'amp')  v = (0.25 + Math.random() * 0.4).toFixed(2);
        else if (attr === 'oct') v = pick([3, 4, 4, 5, 5, 6]);
        else if (attr === 'dur') v = pick(['1/4', '1/2', '1', '2']);
        else v = degLead();
        this.run(`${name}.${attr} = ${v}`);
    }

    _fx() {
        const names = this._live(); if (!names.length) return this._add();
        const [k, v] = pick(FX_MUTATE)();
        this.run(`${pick(names)}.${k} = ${v}`);
    }
}
