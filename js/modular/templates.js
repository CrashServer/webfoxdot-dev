// Starter patches for the modular panel's "Templates ▾" menu — small, varied
// graphs built entirely from the existing block palette (js/modular/blocks.js),
// so picking one is just a normal-looking patch you can immediately rewire,
// not special hidden state. build(graph) mutates an EMPTY graph via the real
// graph.js functions (addNode/connect) — same calls the UI itself makes.

import { addNode, connect } from './graph.js';
import { defaultParams } from './blocks.js';

function node(g, type, x, y, overrides) {
    return addNode(g, type, x, y, { ...defaultParams(type), ...overrides });
}

export const TEMPLATES = [
    {
        key: 'beep', label: 'Beep',
        desc: 'note-pitched sine → envelope → output — the minimal starting patch',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 30);
            const o = node(g, 'osc', 220, 30);
            const e = node(g, 'env', 410, 30);
            const out = node(g, 'output', 600, 30);
            connect(g, n2p, 'out', o, 'freq');
            connect(g, o, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'buzz', label: 'Buzz lead',
        desc: 'note-pitched saw → resonant filter → envelope (mirrors tour lesson 17\'s hand-written buzz)',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 30);
            const o = node(g, 'osc', 220, 30, { wave: 'saw' });
            const f = node(g, 'filter', 410, 30, { mode: 'resonant', cutoff: 1200, rq: 0.4 });
            const e = node(g, 'env', 600, 30);
            const out = node(g, 'output', 790, 30);
            connect(g, n2p, 'out', o, 'freq');
            connect(g, o, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'wobble', label: 'Wobble bass',
        desc: 'an LFO scaled into a cutoff sweep, modulating a saw through a lowpass filter',
        build(g) {
            const lfo = node(g, 'lfo', 30, 30, { shape: 'sine', rate: 5 });
            const scale = node(g, 'scale', 220, 30, { mul: 800, add: 1000 });
            const osc = node(g, 'osc', 30, 220, { wave: 'saw', freq: 110 });
            const f = node(g, 'filter', 410, 30, { mode: 'lowpass', rq: 0.3 });
            const e = node(g, 'env', 600, 30, { shape: 'linen' });
            const out = node(g, 'output', 790, 30);
            connect(g, lfo, 'out', scale, 'in');
            connect(g, scale, 'out', f, 'cutoff');
            connect(g, osc, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'pad', label: 'Detuned pad',
        desc: 'two note-pitched saws (one slightly detuned) mixed through a filter — a wide, chorus-y, chord-capable sustain',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 100);
            const detune = node(g, 'scale', 30, 220, { mul: 1.003, add: 0 });
            const o1 = node(g, 'osc', 220, 30, { wave: 'saw' });
            const o2 = node(g, 'osc', 220, 220, { wave: 'saw' });
            const mix = node(g, 'mix', 410, 100, { mode: 'add' });
            const f = node(g, 'filter', 600, 100, { mode: 'lowpass', cutoff: 2000 });
            const e = node(g, 'env', 790, 100, { shape: 'linen' });
            const out = node(g, 'output', 980, 100);
            connect(g, n2p, 'out', o1, 'freq');
            connect(g, n2p, 'out', detune, 'in');
            connect(g, detune, 'out', o2, 'freq');
            connect(g, o1, 'out', mix, 'a');
            connect(g, o2, 'out', mix, 'b');
            connect(g, mix, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'click', label: 'Noise click',
        desc: 'white noise through a narrow bandpass and a short percussive envelope',
        build(g) {
            const n = node(g, 'noise', 30, 30, { color: 'white' });
            const f = node(g, 'filter', 220, 30, { mode: 'bandpass', cutoff: 3000, rq: 0.2 });
            const e = node(g, 'env', 410, 30, { shape: 'perc' });
            const out = node(g, 'output', 600, 30);
            connect(g, n, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'zap', label: 'Zap',
        desc: 'an impulse train excites a tight resonant filter through a fast envelope — a classic electronic blip/zap',
        build(g) {
            const imp = node(g, 'impulse', 30, 30, { freq: 1 });
            const f = node(g, 'filter', 220, 30, { mode: 'resonant', cutoff: 2400, rq: 0.08 });
            const e = node(g, 'env', 410, 30, { shape: 'perc' });
            const out = node(g, 'output', 600, 30);
            connect(g, imp, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'kick', label: 'Kick drum',
        desc: 'a Ramp sweeps the oscillator pitch down fast (the classic 808-style drop) through a punchy envelope',
        build(g) {
            const ramp = node(g, 'ramp', 30, 30, { shape: 'exponential', start: 180, end: 45, dur: 0.09 });
            const osc = node(g, 'osc', 30, 220, { wave: 'sine' });
            const e = node(g, 'env', 220, 100, { shape: 'perc' });
            const out = node(g, 'output', 410, 100);
            connect(g, ramp, 'out', osc, 'freq');
            connect(g, osc, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        key: 'autopan', label: 'Auto-pan lead',
        desc: 'a note-pitched saw lead that sweeps left-right on its own — an LFO scaled down and wired straight into Output\'s pan',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 30);
            const o = node(g, 'osc', 220, 30, { wave: 'saw' });
            const f = node(g, 'filter', 410, 30, { mode: 'resonant', cutoff: 2000, rq: 0.4 });
            const e = node(g, 'env', 600, 30, { shape: 'linen' });
            const lfo = node(g, 'lfo', 30, 220, { shape: 'sine', rate: 0.5 });
            const width = node(g, 'scale', 220, 220, { mul: 0.8, add: 0 });
            const out = node(g, 'output', 790, 30);
            connect(g, n2p, 'out', o, 'freq');
            connect(g, o, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
            connect(g, lfo, 'out', width, 'in');
            connect(g, width, 'out', out, 'pan');
        },
    },
    {
        // Ported from synthdefs/src/synths/war.scd (the real hand-written "war"
        // voice) — 3 detuned saws -> tanh Distortion -> resonant Filter. The
        // original also mixes in a sub-octave Pulse and sweeps the filter
        // cutoff BY its own envelope (`cutoff * (0.5 + env)`) — skipped here:
        // Mix is 2-input (chaining N-1 of them for an N-way sum is fine, just
        // more nodes — not done here for clarity) and the Envelope block fuses
        // EnvGen with the final multiply, so there's no separate raw envelope
        // signal to tap for modulating something else at the same time.
        key: 'war', label: 'War (ported)',
        desc: '3 detuned saws through tanh drive into a resonant filter — approximates the hand-written "war" power-chord voice; play chords like [0,-5,-7]',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 100);
            const detuneDn = node(g, 'scale', 30, 30, { mul: 0.994, add: 0 });
            const detuneUp = node(g, 'scale', 30, 220, { mul: 1.006, add: 0 });
            const o1 = node(g, 'osc', 220, 30, { wave: 'saw' });
            const o2 = node(g, 'osc', 220, 100, { wave: 'saw' });
            const o3 = node(g, 'osc', 220, 220, { wave: 'saw' });
            const mix1 = node(g, 'mix', 410, 60, { mode: 'add' });
            const mix2 = node(g, 'mix', 600, 100, { mode: 'add' });
            const dist = node(g, 'distortion', 790, 100, { dist: 8 });
            const f = node(g, 'filter', 980, 100, { mode: 'resonant', cutoff: 1200, rq: 0.4 });
            const e = node(g, 'env', 1170, 100, { shape: 'perc' });
            const out = node(g, 'output', 1360, 100);
            connect(g, n2p, 'out', detuneDn, 'in'); connect(g, detuneDn, 'out', o1, 'freq');
            connect(g, n2p, 'out', o2, 'freq');
            connect(g, n2p, 'out', detuneUp, 'in'); connect(g, detuneUp, 'out', o3, 'freq');
            connect(g, o1, 'out', mix1, 'a'); connect(g, o2, 'out', mix1, 'b');
            connect(g, mix1, 'out', mix2, 'a'); connect(g, o3, 'out', mix2, 'b');
            connect(g, mix2, 'out', dist, 'in');
            connect(g, dist, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
    {
        // Ported from synthdefs/src/synths/growl.scd — a note-pitched sine
        // vibrato'd by a slow LFO, ring-modulated by a fast ranged saw (the
        // "talking" character), tanh-driven, filtered. Faithful — every stage
        // in the original has a direct block equivalent here.
        key: 'growl', label: 'Growl (ported)',
        desc: 'a talking ring-mod growl bass-lead — approximates the hand-written "growl" voice; vibrato + fast ring-mod give it a vocal wah',
        build(g) {
            const n2p = node(g, 'note2freq', 30, 30);
            const lfo = node(g, 'lfo', 30, 220, { shape: 'sine', rate: 0.5 });
            const vibDepth = node(g, 'scale', 220, 220, { mul: 10, add: 0 });
            const freqSum = node(g, 'mix', 410, 100, { mode: 'add' });
            const osc = node(g, 'osc', 600, 100, { wave: 'sine' });
            const ringLfo = node(g, 'osc', 30, 380, { wave: 'saw', freq: 28 });
            const ringRange = node(g, 'scale', 220, 380, { mul: 0.4, add: 0.6 });
            const ringMod = node(g, 'mix', 790, 220, { mode: 'multiply' });
            const dist = node(g, 'distortion', 980, 220, { dist: 3 });
            const f = node(g, 'filter', 1170, 220, { mode: 'resonant', cutoff: 3000, rq: 0.5 });
            const e = node(g, 'env', 1360, 220, { shape: 'perc' });
            const out = node(g, 'output', 1550, 220);
            connect(g, n2p, 'out', freqSum, 'a');
            connect(g, lfo, 'out', vibDepth, 'in'); connect(g, vibDepth, 'out', freqSum, 'b');
            connect(g, freqSum, 'out', osc, 'freq');
            connect(g, ringLfo, 'out', ringRange, 'in');
            connect(g, osc, 'out', ringMod, 'a'); connect(g, ringRange, 'out', ringMod, 'b');
            connect(g, ringMod, 'out', dist, 'in');
            connect(g, dist, 'out', f, 'in');
            connect(g, f, 'out', e, 'in');
            connect(g, e, 'out', out, 'in');
        },
    },
];

export function templateByKey(key) {
    return TEMPLATES.find(t => t.key === key) || null;
}
