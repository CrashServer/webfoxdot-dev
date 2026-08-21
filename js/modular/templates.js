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
        desc: 'sine → envelope → output — the minimal starting patch',
        build(g) {
            const o = node(g, 'osc', 30, 30);
            const e = node(g, 'env', 220, 30);
            const out = node(g, 'output', 410, 30);
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
        desc: 'two slightly-detuned saws mixed through a filter — a wide, chorus-y sustain',
        build(g) {
            const o1 = node(g, 'osc', 30, 30, { wave: 'saw', freq: 220 });
            const o2 = node(g, 'osc', 30, 220, { wave: 'saw', freq: 221.5 });
            const mix = node(g, 'mix', 220, 100, { mode: 'add' });
            const f = node(g, 'filter', 410, 100, { mode: 'lowpass', cutoff: 2000 });
            const e = node(g, 'env', 600, 100, { shape: 'linen' });
            const out = node(g, 'output', 790, 100);
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
];

export function templateByKey(key) {
    return TEMPLATES.find(t => t.key === key) || null;
}
