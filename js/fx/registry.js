// FX registry — maps user-facing FoxDot-style param names to SC SynthDef params.
//
// To add a new FX:
//   1. Add its section to synthdefs/src/fx/fx_chain.scd
//   2. Add param entries here
//   3. Run scripts/build.sh, reload browser
//
// Keys listed here are treated as FX params in player >> calls
// and are NOT forwarded to the player synth.

export const FX_REGISTRY = {
    // Low-pass filter — lpf = cutoff Hz (0 = off)
    lpf:       { scParam: 'lpf',     default: 0,   desc: 'LPF cutoff Hz (0=off, e.g. 2000)' },
    lpf_rq:    { scParam: 'lpf_rq',  default: 0.7, desc: 'LPF resonance (0.01=sharp, 1=flat)' },

    // High-pass filter — hpf = cutoff Hz (0 = off)
    hpf:       { scParam: 'hpf',     default: 0,   desc: 'HPF cutoff Hz (0=off, e.g. 400)' },
    hpf_rq:    { scParam: 'hpf_rq',  default: 0.7, desc: 'HPF resonance' },

    // Bitcrush — bit-depth quantize + sample-rate decimate
    crush:      { scParam: 'crush',      default: 0,     desc: 'Bitcrush mix (0=off)' },
    bits:       { scParam: 'crush_bits', default: 8,     desc: 'Quantization levels (lower=grittier, e.g. 4)' },
    srate:      { scParam: 'crush_rate', default: 44100, desc: 'Downsample target Hz (lower=more aliasing)' },

    // Resonator bank — rings the input at rbfreq
    resonbank:  { scParam: 'resonbank', default: 0,   desc: 'Resonator mix (0=off)' },
    rbfreq:     { scParam: 'rbfreq',    default: 60,  desc: 'Resonance pitch (MIDI note)' },
    rbdecay:    { scParam: 'rbdecay',   default: 0.5, desc: 'Ring time in seconds' },
    rbspread:   { scParam: 'rbspread',  default: 1,   desc: 'Stereo detune %' },

    // Rhythmic gate
    rgate:      { scParam: 'rgate',     default: 0, desc: 'Gate mix (0=off)' },
    rgaterate:  { scParam: 'rgaterate', default: 4, desc: 'Gate rate (cycles/sec)' },
    rgatewave:  { scParam: 'rgatewave', default: 0, desc: 'Gate shape: 0=pulse, 1=sine' },

    // mverb — denser reverb
    mverb:      { scParam: 'mverb',       default: 0,   desc: 'mverb mix (0=off)' },
    mverbmix:   { scParam: 'mverbmix',    default: 0.5, desc: 'Internal wet/dry' },
    mverbdamp:  { scParam: 'mverbdamp',   default: 0.5, desc: 'High-freq damping' },
    mverbdiff:  { scParam: 'mverbdiff',   default: 0.5, desc: 'Diffusion / size' },
    mverbfreeze:{ scParam: 'mverbfreeze', default: 0,   desc: 'Freeze (infinite tail)' },

    // cheapverb — short comb reverb
    cheapverb:  { scParam: 'cheapverb', default: 0,   desc: 'Cheap reverb mix (0=off)' },
    cvdecay:    { scParam: 'cvdecay',   default: 1.5, desc: 'Decay seconds' },
    cvdamp:     { scParam: 'cvdamp',    default: 0.5, desc: 'High-freq damping' },

    // Chorus — modulated stereo delay
    chorus:        { scParam: 'chorus',       default: 0,     desc: 'Chorus mix (0=off)' },
    chorus_rate:   { scParam: 'chorus_rate',  default: 0.6,   desc: 'LFO rate Hz' },
    chorus_depth:  { scParam: 'chorus_depth', default: 0.004, desc: 'Mod depth seconds' },

    // Tremolo — smooth amplitude LFO
    tremolo:    { scParam: 'tremolo',   default: 0, desc: 'Tremolo mix (0=off)' },
    trem_rate:  { scParam: 'trem_rate', default: 4, desc: 'LFO rate Hz' },
    trem_depth: { scParam: 'trem_depth',default: 0.6, desc: 'Depth 0-1' },

    // Reverb
    reverb:    { scParam: 'reverb',   default: 0,    desc: 'Reverb mix' },
    room:      { scParam: 'rev_room', default: 0.6,  desc: 'Room size' },
    damp:      { scParam: 'rev_damp', default: 0.5,  desc: 'High-freq damping' },

    // Tanh saturation / distortion
    tanh:      { scParam: 'tanh',      default: 0,   desc: 'Soft clip mix' },
    drive:     { scParam: 'tanh_drive',default: 2,   desc: 'Drive amount' },

    // Echo (CombL)
    echo:      { scParam: 'echo',      default: 0,   desc: 'Echo mix' },
    echo_time: { scParam: 'echo_time', default: 0.25,desc: 'Echo delay in seconds' },
    echo_dec:  { scParam: 'echo_dec',  default: 0.5, desc: 'Echo decay/feedback' },

    // Feedback delay — stereo ping with filtered feedback (FoxDot fbdelay)
    fbdelay:   { scParam: 'fbdelay',   default: 0,    desc: 'Feedback-delay mix (0=off)' },
    fbtime:    { scParam: 'fbtime',    default: 0.25, desc: 'Delay time × beat_dur (e.g. 0.25)' },
    fbfeed:    { scParam: 'fbfeed',    default: 0.5,  desc: 'Feedback amount 0–0.98' },
    fbcutoff:  { scParam: 'fbcutoff',  default: 3000, desc: 'Low-pass on the feedback path (Hz)' },
    fbspread:  { scParam: 'fbspread',  default: 0.02, desc: 'Stereo time offset (ping-pong feel)' },
    beat_dur:  { scParam: 'beat_dur',  default: 0.5,  desc: 'Seconds per beat for fbtime (60/bpm to tempo-lock)' },
};

export const FX_KEYS = new Set(Object.keys(FX_REGISTRY));

// Build SC param list from resolved user FX args
export function buildFxParams(r) {
    const params = [];
    for (const [key, val] of Object.entries(r)) {
        const reg = FX_REGISTRY[key];
        if (reg) params.push(reg.scParam, val);
    }
    return params;
}

// Flat [scParam, default, ...] for every FX param — resets a chain to bypass
// (used when a player is reset with ~ so stale FX, e.g. an old lpf, are cleared).
export function fxDefaultParams() {
    const params = [];
    for (const reg of Object.values(FX_REGISTRY)) params.push(reg.scParam, reg.default);
    return params;
}
