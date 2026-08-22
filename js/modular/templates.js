// Starter patches for the modular panel's "Templates ▾" menu — small, varied
// graphs built entirely from the existing block palette (js/modular/blocks.js),
// so picking one is just a normal-looking patch you can immediately rewire,
// not special hidden state. build(graph) mutates an EMPTY graph via the real
// graph.js functions (addNode/connect) — same calls the UI itself makes.

import { addNode, connect } from './graph.js';
import { defaultParams } from './blocks.js';

function node(g, type, x, y, overrides, roles) {
    const id = addNode(g, type, x, y, { ...defaultParams(type), ...overrides });
    if (roles) g.nodes[g.nodes.length - 1].roles = roles;   // addNode always appends
    return id;
}

export const TEMPLATES = [
    {
        key: 'beep', label: 'Beep', category: 'Basics',
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
        key: 'buzz', label: 'Buzz lead', category: 'Basics',
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
        key: 'wobble', label: 'Wobble bass', category: 'Bass & Percussion',
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
        key: 'pad', label: 'Detuned pad', category: 'Leads & Pads',
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
        key: 'click', label: 'Noise click', category: 'Bass & Percussion',
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
        key: 'zap', label: 'Zap', category: 'Bass & Percussion',
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
        key: 'kick', label: 'Kick drum', category: 'Bass & Percussion',
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
        key: 'autopan', label: 'Auto-pan lead', category: 'Leads & Pads',
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
        key: 'war', label: 'War (ported)', category: 'Ported synths',
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
        key: 'growl', label: 'Growl (ported)', category: 'Ported synths',
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
    {
        // An "authentic, all parameters" attempt at the Minimoog Model D
        // architecture, built entirely from the current block palette:
        //   - 3 oscillators, individually tuned (OSC2/OSC3 default to the
        //     classic +10-cents-thick / -1-octave settings) AND individually
        //     leveled in the mixer, plus a noise source (off by default,
        //     matching the real hardware) — the real mixer panel exactly.
        //   - Glide (portamento) shared by all 3 oscillators.
        //   - The filter's cutoff is the SUM of three independent knobs —
        //     a manual base Cutoff, a dedicated filter EG's Amount of
        //     Contour, and Keyboard tracking — same 3-way summing the real
        //     hardware's filter section does. Emphasis (rq) is the filter's
        //     own resonance port.
        //   - A separate amplitude ADSR shapes loudness and frees the voice.
        // Filter is RLPF (2-pole/12dB), the closest available stand-in — the
        // real Model D's ladder filter is a 4-pole/24dB nonlinear circuit
        // (MoogFF in real SC) not in js/scsynth/ugens.js; see beta11's
        // changelog entry on porting real synths for why that wasn't added
        // speculatively (unverified whether it's even compiled into this
        // app's WASM scsynth build).
        key: 'moog', label: 'Mini Moog', category: 'Ported synths',
        desc: 'authentic-spirit Minimoog: 3 tuned+leveled oscillators, glide, a filter with its own contour EG + keyboard tracking on top of the cutoff knob, separate amp ADSR — every classic front-panel parameter is a knob here',
        build(g) {
            // pitch + glide
            const n2p = node(g, 'note2freq', 30, 30);
            const glide = node(g, 'glide', 220, 30, { time: 0.03 }, { time: 'glideTime' });

            // 3 oscillators — each its own tune ratio, then its own mixer level
            const o1Tune = node(g, 'scale', 410, 30, { mul: 1, add: 0 }, { mul: 'osc1Tune' });
            const o2Tune = node(g, 'scale', 410, 220, { mul: 1.0059, add: 0 }, { mul: 'osc2Tune' });
            const o3Tune = node(g, 'scale', 410, 410, { mul: 0.5, add: 0 }, { mul: 'osc3Range' });
            const o1 = node(g, 'osc', 600, 30, { wave: 'saw' });
            const o2 = node(g, 'osc', 600, 220, { wave: 'saw' });
            const o3 = node(g, 'osc', 600, 410, { wave: 'triangle' });
            const noiseSrc = node(g, 'noise', 600, 600, { color: 'white' });
            const o1Lvl = node(g, 'scale', 790, 30, { mul: 1, add: 0 }, { mul: 'osc1Vol' });
            const o2Lvl = node(g, 'scale', 790, 220, { mul: 0.8, add: 0 }, { mul: 'osc2Vol' });
            const o3Lvl = node(g, 'scale', 790, 410, { mul: 0.6, add: 0 }, { mul: 'osc3Vol' });
            const noiseLvl = node(g, 'scale', 790, 600, { mul: 0, add: 0 }, { mul: 'noiseVol' });

            // mixer sum (2-input Mix chained for the 4-way total)
            const mix1 = node(g, 'mix', 980, 120, { mode: 'add' });
            const mix2 = node(g, 'mix', 1170, 220, { mode: 'add' });
            const mix3 = node(g, 'mix', 1360, 320, { mode: 'add' });

            // filter cutoff = base knob + (contour EG * amount) + (pitch * tracking)
            const cutoffBase = node(g, 'number', 30, 700, { value: 500 }, { value: 'cutoff' });
            const filterEnv = node(g, 'envgen', 220, 780, { shape: 'adsr', decay: 0.4, sustainLevel: 0.3 });
            const contourAmt = node(g, 'scale', 410, 780, { mul: 3000, add: 0 }, { mul: 'filterContour' });
            const trackAmt = node(g, 'scale', 220, 960, { mul: 0.3, add: 0 }, { mul: 'filterTracking' });
            const cutoffSum1 = node(g, 'mix', 600, 820, { mode: 'add' });
            const cutoffSum2 = node(g, 'mix', 790, 860, { mode: 'add' });
            const filt = node(g, 'filter', 1550, 320, { mode: 'resonant', rq: 0.3 }, { rq: 'emphasis' });

            // amp envelope + output
            const ampEnv = node(g, 'env', 1740, 320, { shape: 'adsr', decay: 0.2, sustainLevel: 0.7 });
            const out = node(g, 'output', 1930, 320);

            connect(g, n2p, 'out', glide, 'in');
            connect(g, glide, 'out', o1Tune, 'in'); connect(g, o1Tune, 'out', o1, 'freq');
            connect(g, glide, 'out', o2Tune, 'in'); connect(g, o2Tune, 'out', o2, 'freq');
            connect(g, glide, 'out', o3Tune, 'in'); connect(g, o3Tune, 'out', o3, 'freq');
            connect(g, o1, 'out', o1Lvl, 'in');
            connect(g, o2, 'out', o2Lvl, 'in');
            connect(g, o3, 'out', o3Lvl, 'in');
            connect(g, noiseSrc, 'out', noiseLvl, 'in');
            connect(g, o1Lvl, 'out', mix1, 'a'); connect(g, o2Lvl, 'out', mix1, 'b');
            connect(g, mix1, 'out', mix2, 'a'); connect(g, o3Lvl, 'out', mix2, 'b');
            connect(g, mix2, 'out', mix3, 'a'); connect(g, noiseLvl, 'out', mix3, 'b');

            connect(g, filterEnv, 'out', contourAmt, 'in');
            connect(g, glide, 'out', trackAmt, 'in');
            connect(g, cutoffBase, 'out', cutoffSum1, 'a'); connect(g, contourAmt, 'out', cutoffSum1, 'b');
            connect(g, cutoffSum1, 'out', cutoffSum2, 'a'); connect(g, trackAmt, 'out', cutoffSum2, 'b');
            connect(g, cutoffSum2, 'out', filt, 'cutoff');
            connect(g, mix3, 'out', filt, 'in');

            connect(g, filt, 'out', ampEnv, 'in');
            connect(g, ampEnv, 'out', out, 'in');
        },
    },
];

export function templateByKey(key) {
    return TEMPLATES.find(t => t.key === key) || null;
}
