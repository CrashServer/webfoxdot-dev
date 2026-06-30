// Generative players — chaos() (one-shot burst) and the building blocks a future
// son()/soff() bot will reuse (see generator-spec.md). Pure: it only BUILDS code
// lines; the caller runs them through runCode (so they also broadcast to peers).

import { SYNTH_DEFS } from '../synths/registry.js';

const pick   = (a) => a[Math.floor(Math.random() * a.length)];
const rint   = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const chance = (p) => Math.random() < p;

// Melodic/tonal synths worth generating (skip the sampler/loop/master helpers).
const GEN_SYNTHS = Object.keys(SYNTH_DEFS)
    .filter(n => !/sampler|loop|master|fx/.test(n));

function randDegrees() {
    const n = pick([2, 3, 4, 4, 5, 8]);
    const out = [];
    for (let i = 0; i < n; i++) {
        if (chance(0.15))      out.push('(' + [0, rint(2, 4), rint(4, 7)].join(',') + ')'); // chord
        else if (chance(0.1))  out.push('.');                                               // rest
        else                   out.push(rint(0, 7));
    }
    return '[' + out.join(', ') + ']';
}

function randFx() {
    return pick([
        `lpf=${rint(400, 6000)}`,
        `mverb=${(0.2 + Math.random() * 0.5).toFixed(2)}`,
        `room=${(0.4 + Math.random() * 0.5).toFixed(2)}, reverb=${(0.3 + Math.random() * 0.4).toFixed(2)}`,
        `chorus=${(0.3 + Math.random() * 0.5).toFixed(2)}`,
        `drive=${(1 + Math.random() * 4).toFixed(1)}, tanh=${(0.3 + Math.random() * 0.4).toFixed(2)}`,
        `echo=${(0.2 + Math.random() * 0.4).toFixed(2)}, echo_time=${pick(['0.25', '0.375', '0.5'])}`,
    ]);
}

function synthLine(name) {
    const synth = pick(GEN_SYNTHS);
    const dur   = pick(['1/4', '1/2', '1', '1', '2']);
    const oct   = pick([3, 4, 4, 5, 5, 6]);
    const amp   = (0.3 + Math.random() * 0.35).toFixed(2);
    const fx    = chance(0.6) ? ', ' + randFx() : '';
    const uni   = chance(0.3) ? '.unison(2)' : '';
    return `${name} >> ${synth}(${randDegrees()}, oct=${oct}, dur=${dur}, amp=${amp}${fx})${uni}`;
}

function drumLine(name, chars) {
    const len = pick([4, 8, 8]);
    let s = '';
    for (let i = 0; i < len; i++) s += chance(0.5) ? '.' : pick(chars);
    if (!/[^.]/.test(s)) s = pick(chars) + s.slice(1);   // ensure at least one hit
    const fx = chance(0.3) ? ', ' + randFx() : '';
    return `${name} >> play("${s}", amp=${(0.5 + Math.random() * 0.4).toFixed(2)}${fx})`;
}

// Generate `n` random player lines. type: 'synth' | 'drum' | null (mix).
// opts: { sampleChars: [...], taken: Set<existing names> } → names avoid collisions.
export function chaosLines(n = 4, type = null, { sampleChars = [], taken = new Set() } = {}) {
    const lines = [];
    let idx = 1;
    const freeName = () => { while (taken.has('g' + idx)) idx++; const nm = 'g' + idx; taken.add(nm); idx++; return nm; };
    for (let i = 0; i < Math.max(1, n | 0); i++) {
        let t = type;
        if (!t) t = (sampleChars.length && chance(0.35)) ? 'drum' : 'synth';
        const name = freeName();
        lines.push(t === 'drum' && sampleChars.length ? drumLine(name, sampleChars) : synthLine(name));
    }
    return lines;
}
