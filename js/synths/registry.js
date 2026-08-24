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
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.01, release: 0.05, dist: 8, cutoff: 800, rq: 0.7 },
        extraParams: ['dist', 'cutoff', 'rq'],
    },
    // ── Rock / punk grit (CrashServer ports, stock-UGen reimplementations) ──
    // war — power-chord riff machine: detuned saws + sub through heavy tanh drive (dist)
    war: {
        scName: 'fd_war',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.005, release: 0.06, cutoff: 1200, rq: 0.4, dist: 8, sub: 0.3 },
        extraParams: ['cutoff', 'rq', 'dist', 'sub'],
    },
    // dab — dirty overdriven bass for walking / riff lines
    dab: {
        scName: 'fd_dab',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.008, release: 0.08, cutoff: 900, rq: 0.35, dist: 4, sub: 0.6 },
        extraParams: ['cutoff', 'rq', 'dist', 'sub'],
    },
    // fuzz — raw aliased fuzz lead (self-FM'd LFSaw, hard-clipped)
    fuzz: {
        scName: 'fd_fuzz',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.05, cutoff: 4000, rq: 0.5, dist: 6 },
        extraParams: ['cutoff', 'rq', 'dist'],
    },
    // growl — talking ring-mod growl bass-lead
    growl: {
        scName: 'fd_growl',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.08, rate: 1, cutoff: 3000, rq: 0.5 },
        extraParams: ['rate', 'cutoff', 'rq'],
    },
    // guitar — Karplus-Strong electric guitar (Pluck → overdrive → amp-sim), palm-mutable
    guitar: {
        scName: 'fd_guitar',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 0.12, dist: 3, cutoff: 3000, tone: 0.4, palm: 0 },
        extraParams: ['dist', 'cutoff', 'tone', 'palm'],
    },
    // a_xbass — aggressive rhythmic punk / math-rock bass with a built-in accent groove
    a_xbass: {
        scName: 'fd_a_xbass',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.05, dist: 8, cutoff: 800, rq: 0.7, rhythmType: 0, accent: 0.5 },
        extraParams: ['dist', 'cutoff', 'rq', 'rhythmType', 'accent'],
    },
    // ── Industrial / gritty / techno (CrashServer ports, stock-UGen reimplementations) ──
    // tekno — acid-techno lead: multidrive saws + Moog ladder + wavefolder
    tekno: {
        scName: 'fd_tekno',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.003, release: 0.02, cutoff: 800, rq: 0.5, grit: 0.5, wfold: 0, sub: 0.6, sync: 0 },
        extraParams: ['cutoff', 'rq', 'grit', 'wfold', 'sub', 'sync'],
    },
    // dirt — grinding dirty lead/chord (saw + VarSaw + self-FM sine, 2 octaves down)
    dirt: {
        scName: 'fd_dirt',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.05, rate: 0.01, cutoff: 6000 },
        extraParams: ['rate', 'cutoff'],
    },
    // doom — filthy hard-clipped doom bass with LFO-swept LPF
    doom: {
        scName: 'fd_doom',
        defaults: { oct: 4, amp: 0.7, dur: 1, pan: 0, attack: 0.001, release: 0.05, cutoff: 3000, rq: 0.5, pw: 0.5, wnoise: 0.1 },
        extraParams: ['cutoff', 'rq', 'pw', 'wnoise'],
    },
    // industrialdrone — evolving clipped drone/pad (detuned swarm + noise), use long sus
    industrialdrone: {
        scName: 'fd_industrialdrone',
        defaults: { oct: 4, amp: 0.8, dur: 4, sus: 4, pan: 0, attack: 0.5, release: 1, cutoff: 800, rq: 0.4, dist: 1.3, detune: 0.01, fbk: 0.4, noise: 0.15, sub: 0.5 },
        extraParams: ['cutoff', 'rq', 'dist', 'detune', 'fbk', 'noise', 'sub'],
    },
    // glitchbass — impulse-driven metallic glitch bass
    glitchbass: {
        scName: 'fd_glitchbass',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.0001, release: 0.05, cutoff: 2000, rq: 0.8, rate: 1 },
        extraParams: ['cutoff', 'rq', 'rate'],
    },
    // hardstab — hard rave/industrial stab (compressed brick-wall punch)
    hardstab: {
        scName: 'fd_hardstab',
        defaults: { oct: 5, amp: 0.8, dur: 1, sus: 0.2, pan: 0, attack: 0.001, release: 0.15, cutoff: 3000, rq: 0.5, dist: 3, wfold: 0.3, detune: 0.01, fbk: 0.2, squash: 6 },
        extraParams: ['cutoff', 'rq', 'dist', 'wfold', 'detune', 'fbk', 'squash'],
    },
    // industrialsnare — brutal layered/crushed industrial snare (perc)
    industrialsnare: {
        scName: 'fd_industrialsnare',
        defaults: { oct: 4, amp: 0.8, dur: 1, pan: 0, attack: 0.0005, release: 0.05, decay: 0.2, tone: 0.5, noise: 0.7, dist: 4, snap: 0.6 },
        extraParams: ['decay', 'tone', 'noise', 'dist', 'snap'],
    },
    // crunch — crunchy broken-digital noise perc (Crackle-modulated stepped noise)
    crunch: {
        scName: 'fd_crunch',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.1, grit: 15 },
        extraParams: ['grit'],
    },
    // lbass — Moog acid bass (tri/saw crossfade + pulse sub through env-swept ladder)
    lbass: {
        scName: 'fd_lbass',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.05, cutoff: 4500, rq: 0.5, tone: 0.16, detune: 0.3, oscmix: 0.5, submix: 0.5 },
        extraParams: ['cutoff', 'rq', 'tone', 'detune', 'oscmix', 'submix'],
    },
    // moog — classic Minimoog-style lead/bass: 2 detuned saws + sub-osc through
    // a self-resonant 4-pole Moog ladder filter with its own envelope + glide
    moog: {
        scName: 'fd_moog',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.005, release: 0.15, cutoff: 800, rq: 1.8, fenv: 3, fatk: 0.01, fdec: 0.3, fsus: 0.4, frel: 0.3, detune: 0.008, sub: 0.4, glide: 0 },
        extraParams: ['cutoff', 'rq', 'fenv', 'fatk', 'fdec', 'fsus', 'frel', 'detune', 'sub', 'glide'],
    },
    // wob — dub wobble bass (morphable LFO through 24dB MoogFF ladder)
    wob: {
        scName: 'fd_wob',
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.015, release: 0.08, rate: 2, depth: 0.85, cutoff: 400, rq: 2.2, lshape: 0, sub: 0.55, dist: 1.8, detune: 0.006, drift: 0.4, glide: 0 },
        extraParams: ['rate', 'depth', 'cutoff', 'rq', 'lshape', 'sub', 'dist', 'detune', 'drift', 'glide'],
    },
    // acidline — 303-style acid bassline (accent-swept resonant filter)
    acidline: {
        scName: 'fd_acidline',
        defaults: { oct: 4, amp: 0.9, dur: 1, sus: 0.3, pan: 0, attack: 0.001, release: 0.1, cutoff: 1000, rq: 0.6, beef: 2, accent: 0 },
        extraParams: ['cutoff', 'rq', 'beef', 'accent'],
    },
    // superbass — fat EBM supersaw bass (6 detuned side saws + sub, env-swept ladder)
    superbass: {
        scName: 'fd_superbass',
        defaults: { oct: 4, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.05, cutoff: 5000, rq: 0.5, sub: 1, fdecay: 4, spread: 0.5 },
        extraParams: ['cutoff', 'rq', 'sub', 'fdecay', 'spread'],
    },
    // darklead — dark resonant analog lead
    darklead: {
        scName: 'fd_darklead',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.2, cutoff: 2000, rq: 0.35, dist: 1.5, detune: 0.006, width: 0.5, sub: 0.4 },
        extraParams: ['cutoff', 'rq', 'dist', 'detune', 'width', 'sub'],
    },
    // virus — chaotic Henon-driven glitch lead/texture (experimental)
    virus: {
        scName: 'fd_virus',
        defaults: { oct: 5, amp: 0.6, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 5400, mod1: 0.1, mod2: 0.25, rate: 1 },
        extraParams: ['cutoff', 'mod1', 'mod2', 'rate'],
    },
    // gaze — shoegaze wavetable-style pad (morphing detuned swarm, dual ladders, wide)
    gaze: {
        scName: 'fd_gaze',
        defaults: { oct: 5, amp: 0.7, dur: 2, sus: 2, pan: 0, attack: 0.05, release: 0.4, cutoff: 1200, rq: 0.2, detune: 0.02, glow: 0.3, sub: 0.3 },
        extraParams: ['cutoff', 'rq', 'detune', 'glow', 'sub'],
    },
    // waves — evolving oceanic ambient pad/texture (FM + comb diffusion + verb)
    waves: {
        scName: 'fd_waves',
        defaults: { oct: 5, amp: 0.6, dur: 2, sus: 2, pan: 0, attack: 0.01, release: 0.5, rate: 4, mod: 1 },
        extraParams: ['rate', 'mod'],
    },
    // a_daft — Daft Punk-style punchy filter bass (CrashServer port)
    a_daft: {
        scName: 'fd_a_daft',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.005, release: 0.05, cutoff: 300, rq: 0.8, punch: 1.2 },
        extraParams: ['cutoff', 'rq', 'punch'],
    },
    // a_hhat — French-electro metallic hi-hat (CrashServer port, pitchless)
    a_hhat: {
        scName: 'fd_a_hhat',
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.001, release: 0.05, tone: 8000, decay: 0.1, metallic: 1, dist: 2, open: 0 },
        extraParams: ['tone', 'decay', 'metallic', 'dist', 'open'],
    },
    // a_bd — electro bass-drum / kick (CrashServer port). Percussive; play it low.
    a_bd: {
        scName: 'fd_a_bd',
        defaults: { oct: 3, amp: 1, dur: 1, pan: 0, attack: 0.001, release: 0.05, click: 1, punch: 1, sub: 1, dist: 3 },
        extraParams: ['click', 'punch', 'sub', 'dist'],
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
        defaults: { oct: 4, amp: 0.9, dur: 1, pan: 0, attack: 0.3, release: 1, cutoff: 1200, rq: 0.25, dist: 1.2, detune: 0.008, dark: 0.5, sub: 0.4 },
        extraParams: ['cutoff', 'rq', 'dist', 'detune', 'dark', 'sub'],
    },
    // synthbass — 80s / synthwave / Daft-Punk bass: detuned saws + sub, Moog ladder
    // filter w/ env + drive. Clear controls (sus=note length, detune=%, glide=porta).
    synthbass: {
        scName: 'fd_synthbass',
        defaults: { oct: 3, amp: 0.9, dur: 1, pan: 0, attack: 0.008, release: 0.08, detune: 0.3, cutoff: 900, rq: 0.35, fenv: 3, sub: 0.7, dist: 1.5, glide: 0 },
        extraParams: ['detune', 'cutoff', 'rq', 'fenv', 'sub', 'dist', 'glide'],
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
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.1, cutoff: 2000, rq: 0.6, fenv: 0.8, dist: 2, rate: 1 },
        extraParams: ['cutoff', 'rq', 'fenv', 'dist', 'rate'],
    },
    // a_stab — aggressive detuned major-chord stab
    a_stab: {
        scName: 'fd_a_stab',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.005, release: 0.05, cutoff: 1000, rq: 0.7, dist: 5 },
        extraParams: ['cutoff', 'rq', 'dist'],
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
        defaults: { oct: 5, amp: 1, dur: 1, pan: 0, attack: 0.005, release: 0.06, cutoff: 800, rq: 0.4, sub: 0.3, body: 4, dist: 0.2, fuzz: 0, fuzzgain: 1.5, noiz: 0, noizr: 1, noizt: 0.5, locut: 0, pump: 1 },
        extraParams: ['cutoff', 'rq', 'sub', 'body', 'dist', 'fuzz', 'fuzzgain', 'noiz', 'noizr', 'noizt', 'locut', 'pump'],
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
                    cutoff: 200, rq: 0.9, dist: 1.5, detune: 0.01, follow: 2, vib: 0 },
        extraParams: ['cutoff', 'rq', 'dist', 'detune', 'follow', 'vib'],
    },
    klank: {
        scName: 'fd_klank',
        defaults: { oct: 5, amp: 0.7, dur: 1, pan: 0, attack: 0.01, release: 0.05, rate: 16 },
        extraParams: ['rate'],   // rate = bit depth (16 clean … lower = grittier)
    },
    svdk: {
        scName: 'fd_svdk',
        defaults: { oct: 4, amp: 0.8, dur: 1, pan: 0, attack: 0.01, release: 0.1,
                    dist: 0.6, noise: 0.2, cutoff: 1200, rq: 0.4, track: 1, fenv: 0.3,
                    slide: 0.05, body: 0.6, harm: 0.5, drift: 0.2 },
        extraParams: ['dist', 'noise', 'cutoff', 'rq', 'track', 'fenv', 'slide', 'body', 'harm', 'drift'],
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
    // guit — plucked guitar (ported from FoxDot guit; stock-UGen Pluck reimplementation,
    // since the original MiPlaits engine is silent under the WASM build)
    guit: {
        scName: 'fd_guit',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.0001, release: 0.01,
                    decay: 0.01, detune: 0.01, tone: 0.7, dist: 0.7, fdecay: 1, mod: 0.2, level: 0.8, peak: 1 },
        extraParams: ['decay', 'detune', 'tone', 'dist', 'fdecay', 'mod', 'level', 'peak'],
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
                    vibrate: 4, vib: 0.015 },
        extraParams: ['fatk', 'fdec', 'fsus', 'frel', 'cutoff', 'detune', 'vibrate', 'vib', 'fmod'],
    },
    // Karplus pluck → Moog ladder (ported from FoxDot moogpluck)
    moogpluck: {
        scName: 'fd_moogpluck',
        defaults: { oct: 5, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.1,
                    cutoff: 4, pluck_mix: 0.8, rate: 1 },
        extraParams: ['cutoff', 'pluck_mix', 'rate', 'fmod'],
    },
    // Industrial compressed kick (ported from CrashServer compkick). oct=3 ≈ 65Hz
    // punchy kick; drop to oct=2 for a deep sub kick.
    compkick: {
        scName: 'fd_compkick',
        defaults: { oct: 3, amp: 0.9, dur: 1, pan: 0, attack: 0.001, release: 0.35,
                    punch: 0.7, squash: 8, click: 0.4, dist: 1.5, sub: 1, body: 0.6, tone: 0.3 },
        extraParams: ['punch', 'squash', 'click', 'dist', 'sub', 'body', 'tone', 'fmod'],
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
    // fbass — Karplus-Strong comb-filter exciter bass, credit Josh Mitchell (CrashServer port)
    fbass: {
        scName: 'fd_fbass',
        defaults: { oct: 3, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 0.2,
                    decay: 1, cutoff: 250, rq: 0.35 },
        extraParams: ['decay', 'cutoff', 'rq'],
    },
    // sawbass — detuned saw stack, filter-envelope RLPF sweep + Padé waveshaper (CrashServer port)
    sawbass: {
        scName: 'fd_sawbass',
        defaults: { oct: 3, amp: 0.9, dur: 1, pan: 0, attack: 0.01, release: 0.05,
                    cutoff: 1000, rq: 0.5 },
        extraParams: ['cutoff', 'rq'],
    },
    // marimba — Klank resonator (fixed harmonic ratios) over a PinkNoise exciter (CrashServer port)
    marimba: {
        scName: 'fd_marimba',
        defaults: { oct: 5, amp: 0.8, dur: 1, pan: 0, attack: 0.001, release: 1 },
        extraParams: [],
    },
    // hiss — one unified noise generator; type picks the color (string or int):
    // white/pink/brown/gray/crackle/dust/lfnoise. e.g. hiss(type="pink", cutoff=4000)
    // Named `hiss` (not `noise`) — `noise` is already taken by the video scene of
    // the same name (SYNTHS and visualBuilders() share one eval-context namespace).
    hiss: {
        scName: 'fd_hiss',
        defaults: { oct: 5, amp: 0.6, dur: 1, pan: 0, attack: 0.01, release: 0.1,
                    type: 0, cutoff: 12000, rq: 0.7, chaos: 0.5, density: 500, rate: 1000 },
        extraParams: ['type', 'cutoff', 'rq', 'chaos', 'density', 'rate'],
        enums: { type: ['white', 'pink', 'brown', 'gray', 'crackle', 'dust', 'lfnoise'] },
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

import { attachModifiers, isGroup, _group, unisonSpread, optName } from '../patterns/sequences.js';

export class SynthCall {
    constructor(name, args) {
        this.name = name; this.args = args;
        this._modifiers = null; this._after = null; this._degreeAdds = null;
    }
    // .after(beats, method, ...args) — one-shot: call a player method after N beats
    after(beats, method, ...args) { this._after = { beats, method, args }; return this; }
    // .every(beats, method, ...args) — call a player method every N beats (chainable)
    every(beats, method, ...args) { (this._everys ??= []).push({ beats, method, args }); return this; }
    // p >> synth(...) + N / + (a,b,c) — transpose the degree up; - N transposes down
    __add__(x) { (this._degreeAdds ??= []).push(x); return this; }
    __sub__(x) { (this._degreeAdds ??= []).push({ __sub: x }); return this; }
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
    // .slider() glissando params — only sent when actually used (a synth that has the
    // fd_ glide preamble reads them; others ignore the extra controls). Default no-op.
    if (r.slide != null || r.slidefrom != null || r.slidedelay != null) {
        base.push('slide', r.slide ?? 0, 'slidefrom', r.slidefrom ?? 1, 'slidedelay', r.slidedelay ?? 1);
    }
    // Enum-typed params (declared via def.enums.<param> = [names...]) accept a
    // string ("pink"), an int index, or a var/pattern of either — resolved here
    // to the numeric index the SynthDef's Select.ar switch expects.
    const extras = (def.extraParams ?? []).flatMap(p => {
        let v = r[p] ?? def.defaults[p] ?? 0;
        const names = def.enums?.[p];
        if (names && typeof v === 'string') {
            const i = names.indexOf(optName(v, names));
            v = i < 0 ? 0 : i;
        }
        return [p, v];
    });
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
