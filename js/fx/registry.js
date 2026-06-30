// FX registry — maps user-facing FoxDot-style param names to SC SynthDef params.
//
// To add a new FX:
//   1. Add a standalone SynthDef to synthdefs/src/fx/fx_effects.scd
//      (In.ar(in_bus,2) → wet → ReplaceOut.ar(in_bus, XFade2(sig,wet,gate*2-1)))
//   2. Add its param entries here, AND an entry to FX_EFFECTS (in chain order)
//   3. Run scripts/build.sh fx_effects, reload browser
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

    // DJ isolator filter (CrashServer port) — one knob, 0.5 = flat
    djf:       { scParam: 'djf',     default: 0.5, desc: 'DJ filter: 0.5=flat, <0.5 lowpass down, >0.5 highpass up' },
    djfq:      { scParam: 'djfq',    default: 0.3, desc: 'DJ filter resonance/Q' },

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
    rgate:      { scParam: 'rgate',     default: 0, desc: 'Rhythmic gate dry→wet mix (0=off)' },
    rgaterate:  { scParam: 'rgaterate', default: 4, desc: 'Gate slices per beat (tempo-locked)' },
    rgatewave:  { scParam: 'rgatewave', default: 0, desc: 'Gate shape: 0 pulse · 1 tri · 2 saw · 3 sine · 4 parabola' },

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
    beat_dur:  { scParam: 'beat_dur',  default: 0.5,  desc: 'Seconds per beat for fbtime/chop (60/bpm to tempo-lock)' },

    // Distortion / shaping
    shape:      { scParam: 'shape',       default: 0, desc: 'Sine-wavefolder distortion (0=off; drive scales up)' },
    dist2:      { scParam: 'dist2',       default: 0, desc: 'Fold + tanh saturation (0=off)' },
    dist2shape: { scParam: 'dist2shape',  default: 1, desc: 'dist2 fold threshold (0.05 hard .. 1 soft)' },

    // Rhythmic chop — gate the signal `chop` times per beat (uses beat_dur)
    chop:       { scParam: 'chop',        default: 0, desc: 'Rhythmic gate: slices per beat (0=off)' },

    // multicrush — 3-band drive (low/mid/high) with crossovers
    multicrush:  { scParam: 'multicrush',  default: 0,    desc: 'Multiband drive mix (0=off)' },
    mclowdrive:  { scParam: 'mclowdrive',  default: 2,    desc: 'Low-band drive (softclip)' },
    mcmiddrive:  { scParam: 'mcmiddrive',  default: 2,    desc: 'Mid-band drive (fold)' },
    mchighdrive: { scParam: 'mchighdrive', default: 2,    desc: 'High-band drive (tanh)' },
    mclofreq:    { scParam: 'mclofreq',    default: 300,  desc: 'Low/mid crossover Hz' },
    mchifreq:    { scParam: 'mchifreq',    default: 2500, desc: 'Mid/high crossover Hz' },

    // Vibrato — pitch wobble via an LFO-modulated delay
    vibrato:    { scParam: 'vibrato',    default: 0,     desc: 'Vibrato mix (0=off)' },
    vib_rate:   { scParam: 'vib_rate',   default: 5,     desc: 'Vibrato LFO rate Hz' },
    vib_depth:  { scParam: 'vib_depth',  default: 0.008, desc: 'Vibrato depth (delay mod seconds)' },

    // Ring modulation
    ringmod:      { scParam: 'ringmod',      default: 0,   desc: 'Ring-mod mix (0=off)' },
    ringmod_freq: { scParam: 'ringmod_freq', default: 200, desc: 'Ring-mod carrier Hz' },

    // Flanger (swept feedback comb)
    flanger:       { scParam: 'flanger',       default: 0,     desc: 'Flanger mix (0=off)' },
    flanger_rate:  { scParam: 'flanger_rate',  default: 0.5,   desc: 'Flanger LFO rate Hz' },
    flanger_depth: { scParam: 'flanger_depth', default: 0.004, desc: 'Flanger sweep depth (seconds)' },

    // Phaser (cascaded modulated allpass)
    phaser:      { scParam: 'phaser',      default: 0,   desc: 'Phaser mix (0=off)' },
    phaser_rate: { scParam: 'phaser_rate', default: 0.5, desc: 'Phaser LFO rate Hz' },

    // Formant — vowel band-pass bank (0/1/2 = ah/eh/oh)
    formant:       { scParam: 'formant',       default: 0, desc: 'Vowel-formant mix (0=off)' },
    formant_vowel: { scParam: 'formant_vowel', default: 0, desc: 'Vowel: 0 ah · 1 eh · 2 oh' },

    // octclean — clean octaver (PitchShift sub -1oct + up +1oct), CrashServer port
    octclean: { scParam: 'octclean', default: 0,   desc: 'Octaver mix (0=off)' },
    ocsub:    { scParam: 'ocsub',    default: 0.5, desc: 'Sub (-1 oct) amount' },
    ocup:     { scParam: 'ocup',     default: 0.3, desc: 'Up (+1 oct) amount' },

    // fold — wavefolder distortion (CrashServer port, built-in fold2)
    fold:     { scParam: 'fold',     default: 0, desc: 'Wavefold mix/drive (0=off)' },
    symetry:  { scParam: 'symetry',  default: 1, desc: 'Fold symmetry / DC offset (0..1)' },

    // csweep — resonant comb sweep (moving metallic resonance), CrashServer port
    csweep:   { scParam: 'csweep',   default: 0,   desc: 'Comb-sweep mix (0=off)' },
    cswfreq:  { scParam: 'cswfreq',  default: 200, desc: 'Comb pitch Hz' },
    cswdepth: { scParam: 'cswdepth', default: 0.3, desc: 'Sweep depth' },
    cswrate:  { scParam: 'cswrate',  default: 0.5, desc: 'Sweep LFO rate Hz' },
    cswdecay: { scParam: 'cswdecay', default: 0.5, desc: 'Comb resonance/decay' },

    // eb — tape-style echo (Roland EchoBoy-ish), CrashServer port
    eb:       { scParam: 'eb',       default: 0.5,  desc: 'Echo delay time (s); ebmix sets wet' },
    ebmix:    { scParam: 'ebmix',    default: 0,    desc: 'Echo wet mix (0=off)' },
    ebfeed:   { scParam: 'ebfeed',   default: 0.5,  desc: 'Echo feedback (0..0.95)' },
    ebmode:   { scParam: 'ebmode',   default: 0,    desc: 'Echo voicing: 0 digital · 1 analog · 2 tape' },
    ebwow:    { scParam: 'ebwow',    default: 0.1,  desc: 'Tape wow (slow pitch drift)' },
    ebflutter:{ scParam: 'ebflutter',default: 0.15, desc: 'Tape flutter (fast pitch jitter)' },
    ebsat:    { scParam: 'ebsat',    default: 0.3,  desc: 'Echo saturation (analog/tape modes)' },

    // tube — tube-style saturation (even harmonics + warmth), CrashServer port
    tube:     { scParam: 'tube',     default: 0,   desc: 'Tube-saturation mix (0=off)' },
    tubedrive:{ scParam: 'tube',     default: 0,   desc: 'Alias of tube (saturation mix)' },
    tubegain: { scParam: 'tubegain', default: 1.5, desc: 'Tube input drive' },
    tubewarm: { scParam: 'tubewarm', default: 0.6, desc: 'Even-harmonic warmth' },
    tubebias: { scParam: 'tubebias', default: 0.1, desc: 'Asymmetry bias' },

    // drcomp — drum-bus compressor + shelves (techno glue), CrashServer port
    drcomp:   { scParam: 'drcomp',   default: 0, desc: 'Drum compressor mix (0=off)' },

    // lofi — degrade: compress + tape wow + soft sat + band-limit, CrashServer port
    lofi:     { scParam: 'lofi',     default: 0,   desc: 'Lo-fi degrade mix (0=off)' },
    lofiwow:  { scParam: 'lofiwow',  default: 0.5, desc: 'Lo-fi tape wow amount' },
    lofiamp:  { scParam: 'lofiamp',  default: 0.5, desc: 'Lo-fi crush/compression intensity' },

    // vowel — sweepable formant filter (vowelf 0..4 = a e i o u), CrashServer port
    vowel:    { scParam: 'vowel',    default: 0, desc: 'Vowel-formant mix (0=off)' },
    vowelf:   { scParam: 'vowelf',   default: 0, desc: 'Vowel sweep: 0 a · 1 e · 2 i · 3 o · 4 u' },
    vowelq:   { scParam: 'vowelq',   default: 1, desc: 'Formant resonance' },

    // feed — resonant feedback comb (CombN), CrashServer port
    feed:     { scParam: 'feed',     default: 0,  desc: 'Feedback-comb amount (0=off)' },
    feedfreq: { scParam: 'feedfreq', default: 50, desc: 'In-loop HPF cutoff Hz' },

    // sbrk — stutter / beat-repeat (clocked RecordBuf/PlayBuf), CrashServer port
    sbrk:     { scParam: 'sbrk',     default: 0,   desc: 'Stutter/beat-repeat mix (0=off)' },
    sbrkdur:  { scParam: 'sbrkdur',  default: 0.5, desc: 'Stutter fragment length (s); smaller = faster' },
};

export const FX_KEYS = new Set(Object.keys(FX_REGISTRY));

// Per-effect nodes (approach A): each effect is its own SynthDef (fd_fx_*),
// inserted on demand. Ordered as the old fd_fx_chain applied them. `keys` = the
// user params this effect owns (sent via /n_set when present); `trig` = the
// param(s) whose presence activates the effect (its node is created). Absent
// effects = no node = zero CPU. Plus a permanent fd_fx_out tail (bus → main).
export const FX_EFFECTS = [
    { scName: 'fd_fx_lpf',        keys: ['lpf', 'lpf_rq'], trig: ['lpf'] },
    { scName: 'fd_fx_hpf',        keys: ['hpf', 'hpf_rq'], trig: ['hpf'] },
    { scName: 'fd_fx_djf',        keys: ['djf', 'djfq'], trig: ['djf'] },
    { scName: 'fd_fx_crush',      keys: ['crush', 'bits', 'srate'], trig: ['crush'] },
    { scName: 'fd_fx_resonbank',  keys: ['resonbank', 'rbfreq', 'rbdecay', 'rbspread'], trig: ['resonbank'] },
    { scName: 'fd_fx_rgate',      keys: ['rgate', 'rgaterate', 'rgatewave', 'beat_dur'], trig: ['rgate'] },
    { scName: 'fd_fx_mverb',      keys: ['mverb', 'mverbmix', 'mverbdamp', 'mverbdiff', 'mverbfreeze'], trig: ['mverb'] },
    { scName: 'fd_fx_cheapverb',  keys: ['cheapverb', 'cvdecay', 'cvdamp'], trig: ['cheapverb'] },
    { scName: 'fd_fx_chorus',     keys: ['chorus', 'chorus_rate', 'chorus_depth'], trig: ['chorus'] },
    { scName: 'fd_fx_tremolo',    keys: ['tremolo', 'trem_rate', 'trem_depth'], trig: ['tremolo'] },
    { scName: 'fd_fx_tanh',       keys: ['tanh', 'drive'], trig: ['tanh'] },
    { scName: 'fd_fx_reverb',     keys: ['reverb', 'room', 'damp'], trig: ['reverb'] },
    { scName: 'fd_fx_echo',       keys: ['echo', 'echo_time', 'echo_dec'], trig: ['echo'] },
    { scName: 'fd_fx_fbdelay',    keys: ['fbdelay', 'fbtime', 'fbfeed', 'fbcutoff', 'fbspread', 'beat_dur'], trig: ['fbdelay'] },
    { scName: 'fd_fx_shape',      keys: ['shape'], trig: ['shape'] },
    { scName: 'fd_fx_dist2',      keys: ['dist2', 'dist2shape'], trig: ['dist2'] },
    { scName: 'fd_fx_multicrush', keys: ['multicrush', 'mclowdrive', 'mcmiddrive', 'mchighdrive', 'mclofreq', 'mchifreq'], trig: ['multicrush'] },
    { scName: 'fd_fx_chop',       keys: ['chop', 'beat_dur'], trig: ['chop'] },
    { scName: 'fd_fx_vibrato',    keys: ['vibrato', 'vib_rate', 'vib_depth'], trig: ['vibrato'] },
    { scName: 'fd_fx_ringmod',    keys: ['ringmod', 'ringmod_freq'], trig: ['ringmod'] },
    { scName: 'fd_fx_flanger',    keys: ['flanger', 'flanger_rate', 'flanger_depth'], trig: ['flanger'] },
    { scName: 'fd_fx_phaser',     keys: ['phaser', 'phaser_rate'], trig: ['phaser'] },
    { scName: 'fd_fx_formant',    keys: ['formant', 'formant_vowel'], trig: ['formant'] },
    { scName: 'fd_fx_octclean',   keys: ['octclean', 'ocsub', 'ocup'], trig: ['octclean'] },
    { scName: 'fd_fx_fold',       keys: ['fold', 'symetry'], trig: ['fold'] },
    { scName: 'fd_fx_csweep',     keys: ['csweep', 'cswfreq', 'cswdepth', 'cswrate', 'cswdecay'], trig: ['csweep'] },
    { scName: 'fd_fx_eb',         keys: ['eb', 'ebmix', 'ebfeed', 'ebmode', 'ebwow', 'ebflutter', 'ebsat'], trig: ['ebmix'] },
    { scName: 'fd_fx_tube',       keys: ['tube', 'tubedrive', 'tubegain', 'tubewarm', 'tubebias'], trig: ['tube', 'tubedrive'] },
    { scName: 'fd_fx_drcomp',     keys: ['drcomp'], trig: ['drcomp'] },
    { scName: 'fd_fx_lofi',       keys: ['lofi', 'lofiwow', 'lofiamp'], trig: ['lofi'] },
    { scName: 'fd_fx_vowel',      keys: ['vowel', 'vowelf', 'vowelq'], trig: ['vowel'] },
    { scName: 'fd_fx_feed',       keys: ['feed', 'feedfreq'], trig: ['feed'] },
    { scName: 'fd_fx_sbrk',       keys: ['sbrk', 'sbrkdur'], trig: ['sbrk'] },
];

// Names to preload: the router + every per-effect def.
export const FX_SYNTHDEFS = ['fd_fx_out', ...FX_EFFECTS.map(e => e.scName)];
