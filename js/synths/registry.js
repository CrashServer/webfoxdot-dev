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
    // a_gesa — aggressive Gesaffelstein-style distorted sub-bass (CrashServer port)
    a_gesa: {
        scName: 'fd_a_gesa',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.01, release: 0.05, distortion: 8, cutoff: 800, resonance: 0.7 },
        extraParams: ['distortion', 'cutoff', 'resonance'],
    },
    // a_daft — Daft Punk-style punchy filter bass (CrashServer port)
    a_daft: {
        scName: 'fd_a_daft',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.005, release: 0.05, cutoff: 300, resonance: 0.8, punch: 1.2 },
        extraParams: ['cutoff', 'resonance', 'punch'],
    },
    // a_hhat — French-electro metallic hi-hat (CrashServer port, pitchless)
    a_hhat: {
        scName: 'fd_a_hhat',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.001, release: 0.05, tone: 8000, decay: 0.1, metallic: 1, distortion: 2, open: 0 },
        extraParams: ['tone', 'decay', 'metallic', 'distortion', 'open'],
    },
    // a_bd — electro bass-drum / kick (CrashServer port). Percussive; play it low.
    a_bd: {
        scName: 'fd_a_bd',
        defaults: { oct: 3, amp: 1, dur: 1, pan: 0, attack: 0.001, release: 0.05, click: 1, punch: 1, sub: 1, distortion: 3 },
        extraParams: ['click', 'punch', 'sub', 'distortion'],
    },
    // rhodes — Rhodes-style electric piano (CrashServer port)
    rhodes: {
        scName: 'fd_rhodes',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.001, release: 0.1, cutoff: 2000, rq: 0.5 },
        extraParams: ['cutoff', 'rq'],
    },
    // supersaw — fat detuned saw stack (CrashServer port)
    supersaw: {
        scName: 'fd_supersaw',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.01, release: 0.05, cutoff: 2000, rq: 0.7 },
        extraParams: ['cutoff', 'rq'],
    },
    // arpy — classic FoxDot arpeggio pluck (filtered impulse train + perc env)
    arpy: {
        scName: 'fd_arpy',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.5, fmod: 0, rate: 1 },
        extraParams: ['fmod', 'rate'],
    },
    // darkpad — dark detuned six-saw pad + sub, soft-clipped dark filter (CrashServer port)
    darkpad: {
        scName: 'fd_darkpad',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.3, release: 1, cutoff: 1200, res: 0.25, drive: 1.2, detune: 0.008, dark: 0.5, sub: 0.4 },
        extraParams: ['cutoff', 'res', 'drive', 'detune', 'dark', 'sub'],
    },
    // synthbass — 80s / synthwave / Daft-Punk bass: detuned saws + sub, Moog ladder
    // filter w/ env + drive. Clear controls (sus=note length, detune=%, glide=porta).
    synthbass: {
        scName: 'fd_synthbass',
        defaults: { oct: 3, amp: 0.9, dur: 1, pan: 0, attack: 0.008, release: 0.08, detune: 0.3, cutoff: 900, res: 0.35, fenv: 3, sub: 0.7, drive: 1.5, glide: 0 },
        extraParams: ['detune', 'cutoff', 'res', 'fenv', 'sub', 'drive', 'glide'],
    },
    // ── French-electro / Justice / Daft-Punk pack (CrashServer ports) ──────────
    // dafbass — Daft-Punk distorted harmonic bass (play it low)
    dafbass: {
        scName: 'fd_dafbass',
        defaults: { oct: 2, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.02, rate: 1 },
        extraParams: ['rate'],
    },
    // a_daftlead — Justice/Daft detuned saw lead with a filter sweep
    a_daftlead: {
        scName: 'fd_a_daftlead',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 2000, resonance: 0.6, filterEnv: 0.8, drive: 2, rate: 1 },
        extraParams: ['cutoff', 'resonance', 'filterEnv', 'drive', 'rate'],
    },
    // a_stab — aggressive detuned major-chord stab
    a_stab: {
        scName: 'fd_a_stab',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.005, release: 0.05, filterFreq: 1000, resonance: 0.7, distortion: 5 },
        extraParams: ['filterFreq', 'resonance', 'distortion'],
    },
    // a_vlead — complex glitchy chopped lead
    a_vlead: {
        scName: 'fd_a_vlead',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.1, complexity: 0.7, glitch: 0.5, cutoff: 3000, rate: 1 },
        extraParams: ['complexity', 'glitch', 'cutoff', 'rate'],
    },
    // a_vpad — evolving granular-textured pad
    a_vpad: {
        scName: 'fd_a_vpad',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.8, release: 1, texture: 0.8, granularity: 0.6, cutoff: 1000 },
        extraParams: ['texture', 'granularity', 'cutoff'],
    },
    // wobble — dubstep wobble bass (CrashServer port; MoogFF LFO-swept). Play it low.
    wobble: {
        scName: 'fd_wobble',
        defaults: { oct: 4, amp: 1, dur: 1, pan: 0, attack: 0.02, release: 0.1, rate: 6, cutoff: 8500, wphase: 0.5 },
        extraParams: ['rate', 'cutoff', 'wphase'],
    },
    // pumpbass — pumping filter bass (crashDot original; sidechain-style per-note duck)
    pumpbass: {
        scName: 'fd_pumpbass',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.005, release: 0.06, cutoff: 800, res: 0.4, sub: 0.3, body: 4, growl: 0.2, fuzz: 0, fuzzgain: 1.5, noiz: 0, noizr: 1, noizt: 0.5, hpr: 0, pump: 1 },
        extraParams: ['cutoff', 'res', 'sub', 'body', 'growl', 'fuzz', 'fuzzgain', 'noiz', 'noizr', 'noizt', 'hpr', 'pump'],
    },
    saw: {
        scName: 'fd_saw',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 8000, rq: 0.8, rate: 0.5 },
        extraParams: ['cutoff', 'rq', 'rate'],
    },
    varsaw: {
        scName: 'fd_varsaw',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.15, rate: 0.5 },
        extraParams: ['rate'],   // rate = VarSaw width (0=thin/nasal … 1=full)
    },
    cbass: {
        scName: 'fd_cbass',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.1,
                    cutoff: 200, rq: 0.9, boost: 1.5, detune: 0.01, follow: 2, vib: 0 },
        extraParams: ['cutoff', 'rq', 'boost', 'detune', 'follow', 'vib'],
    },
    klank: {
        scName: 'fd_klank',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.05, rate: 16 },
        extraParams: ['rate'],   // rate = bit depth (16 clean … lower = grittier)
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
    plaits: {
        scName: 'fd_plaits',
        defaults: { oct: 4, amp: 0.6, dur: 1, pan: 0, attack: 0.01, release: 0.2,
                    engine: 0, timbre: 0.5, harm: 0.5, morph: 0.5, cutoff: 6000, rq: 0.6 },
        extraParams: ['engine', 'timbre', 'harm', 'morph', 'cutoff', 'rq'],
    },
    tb303: {
        scName: 'fd_tb303',
        defaults: { oct: 3, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.08,
                    cutoff: 500, rq: 0.3, env: 2, wave: 0, dist: 0 },
        extraParams: ['cutoff', 'rq', 'env', 'wave', 'dist'],
    },
    choir: {
        scName: 'fd_choir',
        defaults: { oct: 4, amp: 0.6, dur: 2, pan: 0, attack: 0.3, release: 0.4, vox: 0, cutoff: 4000 },
        extraParams: ['vox', 'cutoff'],
    },
    brass: {
        scName: 'fd_brass',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.05, release: 0.15, cutoff: 2000, rq: 0.4, bright: 0.5 },
        extraParams: ['cutoff', 'rq', 'bright'],
    },
    organ: {
        scName: 'fd_organ',
        defaults: { oct: 4, amp: 0.6, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 6000, perc: 0 },
        extraParams: ['cutoff', 'perc'],
    },
    ssaw: {
        scName: 'fd_ssaw',
        defaults: { oct: 4, amp: 0.6, dur: 1, pan: 0, attack: 0.02, release: 0.2, cutoff: 4000, rq: 0.6, detune: 0.5 },
        extraParams: ['cutoff', 'rq', 'detune'],
    },
    karp: {
        scName: 'fd_karp',
        defaults: { oct: 4, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 0.2, cutoff: 6000 },
        extraParams: ['cutoff'],
    },
    // "basic" — an additive synth (was named "piano"; it doesn't really sound like
    // a piano). `piano` is kept as an alias in the eval context for old code.
    basic: {
        scName: 'fd_piano',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.001, release: 0.4, tone: 0.5, hammer: 0.5 },
        extraParams: ['tone', 'hammer'],
    },
    // electric bass — Klank stiff-string model (ported from FoxDot ebass)
    ebass: {
        scName: 'fd_ebass',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.18,
                    pick: 0.414, rq: 0.5, cutoff: 250, decay: 0.01 },
        extraParams: ['pick', 'rq', 'cutoff', 'decay'],
    },
    // stacked-FM guitar voice (ported from FoxDot faim)
    faim: {
        scName: 'fd_faim',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 0.01,
                    decay: 0.01, beef: 0, rate: 0.01, level: 0.8, peak: 1 },
        extraParams: ['decay', 'beef', 'rate', 'level', 'peak', 'fmod'],
    },
    // Plaits-engine guitar (ported from FoxDot guit — uses MiPlaits)
    guit: {
        scName: 'fd_guit',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.0001, release: 0.01,
                    decay: 0.01, detune: 0.01, tone: 0.7, beef: 0.7, fdecay: 1, mod: 0.2, level: 0.8, peak: 1 },
        extraParams: ['decay', 'detune', 'tone', 'beef', 'fdecay', 'mod', 'level', 'peak'],
    },
    // Karplus/Pluck "rabbit" guitar (ported from FoxDot lapin)
    lapin: {
        scName: 'fd_lapin',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.01,
                    decay: 0.01, rate: 1, level: 0.8, peak: 1 },
        extraParams: ['decay', 'rate', 'level', 'peak', 'fmod'],
    },
    // TB-303 acid bass (ported from FoxDot acidbass)
    acidbass: {
        scName: 'fd_acidbass',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.3,
                    decay: 0.4, rate: 4, width: 0.51, rq: 0.4 },
        extraParams: ['decay', 'rate', 'width', 'rq', 'fmod'],
    },
    // rave hoover stab (ported from FoxDot hoover)
    hoover: {
        scName: 'fd_hoover',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.01,
                    decay: 0.2, level: 0.8, peak: 1, porta: 1, portadur: 0.125 },
        extraParams: ['decay', 'level', 'peak', 'porta', 'portadur', 'fmod'],
    },
    // CS-80 / Vangelis lead (ported from FoxDot cs80)
    cs80: {
        scName: 'fd_cs80',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.3, release: 1.0,
                    fatk: 0.75, fdec: 0.5, fsus: 0.8, frel: 1.0, cutoff: 2200, detune: 0.002,
                    vibspeed: 4, vibdepth: 0.015 },
        extraParams: ['fatk', 'fdec', 'fsus', 'frel', 'cutoff', 'detune', 'vibspeed', 'vibdepth', 'fmod'],
    },
    // Karplus pluck → Moog ladder (ported from FoxDot moogpluck)
    moogpluck: {
        scName: 'fd_moogpluck',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.1,
                    pluck_filter: 4, pluck_mix: 0.8, rate: 1 },
        extraParams: ['pluck_filter', 'pluck_mix', 'rate', 'fmod'],
    },
    // Industrial compressed kick (ported from CrashServer compkick). oct=3 ≈ 65Hz
    // punchy kick; drop to oct=2 for a deep sub kick.
    compkick: {
        scName: 'fd_compkick',
        defaults: { oct: 3, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.35,
                    punch: 0.7, comp: 8, click: 0.4, crunch: 1.5, sub: 1, body: 0.6, tone: 0.3 },
        extraParams: ['punch', 'comp', 'click', 'crunch', 'sub', 'body', 'tone', 'fmod'],
    },
    // ikea — CrashServer's generative glitch-percussion machine (ported + extended).
    // One note spawns a self-generating texture; play it long (dur/sus = 8).
    ikea: {
        scName: 'fd_ikea',
        defaults: { oct: 4, amp: 0.8, dur: 8, sus: 8, pan: 0,
                    density: 1, glitch: 1, noise: 1, bass: 1, tone: 1, bright: 1,
                    hhat: 0.1, sn: 0.1, harm: 0, fmod: 0, vib: 0 },
        extraParams: ['density', 'glitch', 'noise', 'bass', 'tone', 'bright', 'hhat', 'sn', 'harm', 'fmod', 'vib'],
    },
};

// Normalise shared defaults across every synth: amp 1, pan 0, oct 5 (FoxDot-style
// — degree is what you set, level/pan/octave are uniform). attack/release/dur and
// each synth's own params stay as defined.
for (const def of Object.values(SYNTH_DEFS)) {
    def.defaults.amp = 1;
    def.defaults.pan = 0;
    def.defaults.oct = 5;
}

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
    unison(n = 2, detune = 0.125, spread = 100) {
        if (!n) { this.args.pan = 0; this.args.pshift = 0; return this; }
        const { pan, pshift } = unisonSpread(n, detune, spread);
        this.args.pan    = _group(...pan);
        this.args.pshift = _group(...pshift);
        return this;
    }
    // .degrade(prob) — randomly silence prob (0–1) of steps (default 0.5)
    degrade(prob = 0.5) { this._degrade = prob; return this; }
    // .penta() — constrain degrees to the (minor) pentatonic scale for this player
    penta() { this._penta = true; return this; }
    // .gtr(string) — tune the player like a guitar string (chromatic + string root)
    gtr(string = 1) { (this._calls ??= []).push(['gtr', string]); return this; }
    // .chroma() — use the chromatic scale for this player (degrees = semitones)
    chroma() { (this._calls ??= []).push(['chroma']); return this; }
    // Chained player methods — applied to the player on activation. Lets you write
    // p1 >> saw(...).solo(4) / .stop(8) / .only(8). Timed args grid-align (mult of N).
    solo(beats) { (this._calls ??= []).push(['solo', beats]); return this; }
    only(beats) { (this._calls ??= []).push(['only', beats]); return this; }
    stop(beats) { (this._calls ??= []).push(['stop', beats]); return this; }
}
// Every other player method is chainable on a synth call too — recorded as
// _calls and replayed on the player at activation, so you can write
//   p1 >> saw(...).accompany("b1").jump(1)   or   .every(4, "rotate")
for (const m of ['reverse', 'shuffle', 'drummer', 'follow', 'accompany', 'map',
                 'jump', 'rotate', 'mirror', 'strum', 'offbeat', 'multiply', 'once', 'reroll']) {
    SynthCall.prototype[m] = function (...a) { (this._calls ??= []).push([m, ...a]); return this; };
}
// .stutter(n) chained directly = roll every step n times (persistent, = .multiply).
SynthCall.prototype.stutter = function (n = 2) { (this._calls ??= []).push(['multiply', n]); return this; };

// .sometimes / .often / .rarely / .always / … — chainable probability modifiers
attachModifiers(SynthCall);

// Generic param builder — works for any entry in SYNTH_DEFS.
// outBus: player's private audio bus (0 = direct to output, no FX)
export function buildParams(synthName, midi, r, secPerBeat, outBus = 0) {
    const def = SYNTH_DEFS[synthName];
    if (!def) return null;
    // leg (legato) scales the note length relative to the step: 1 fills the step,
    // >1 overlaps (pad-like), <1 staccato.
    const sus   = (r.sus ?? r.dur ?? 1) * (r.leg ?? 1);
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
