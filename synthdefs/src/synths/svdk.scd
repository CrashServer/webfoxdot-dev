// svdk — CrashServer's signature dirty bass/lead. Triple detuned saws (Juno-ish) +
// upper harmonics + a fat sub layer + noise, through a tracking resonant filter, a
// Metal-Zone-style multi-stage distortion, EQ shaping and slow stereo drift.
// Adapted from FoxDot svdk (In.kr/bus/ReplaceOut -> note/out; self-freeing env).
// Params: out, note, amp, sus, pan, attack, release,
//         dist, noise, cutoff, rq, track, fenv, slide, body, harm, drift
SynthDef(\fd_svdk, {|out=0, note=48, amp=0.8, sus=1, pan=0, attack=0.01, release=0.1,
                    dist=0.6, noise=0.2, cutoff=1200, rq=0.4, track=1, fenv=0.3,
                    slide=0.05, body=0.6, harm=0.5, drift=0.2|
    var freq, freqSlide, osc, harmonics, subDeep, subSine, sub, nz, midPath;
    var fltEnv, fltFreq, q, filtered, bassPath, sig, env, dur, atk, rel;
    var driftL, driftR, sigL, sigR;
    freq = note.midicps;
    atk  = attack.max(0.005);
    rel  = release.max(0.02);
    freqSlide = Lag.kr(freq, slide);                          // portamento

    // Triple detuned saws — Juno character
    osc = LFSaw.ar(freqSlide, 0, 0.5);
    osc = osc + LFSaw.ar(freqSlide * 1.006, 0.33, 0.4);
    osc = osc + LFSaw.ar(freqSlide * 0.998, 0.66, 0.3);

    // Upper harmonics for richness
    harmonics = SinOsc.ar(freqSlide * 2, 0, 0.2 * harm);
    harmonics = harmonics + SinOsc.ar(freqSlide * 3, 0, 0.12 * harm);
    harmonics = harmonics + SinOsc.ar(freqSlide * 5, 0, 0.08 * harm);
    harmonics = harmonics + Pulse.ar(freqSlide * 2, 0.3, 0.1 * harm);

    // Sub oscillators — the body
    subDeep = SinOsc.ar(freqSlide * 0.25, 0, 0.4 * body);
    subSine = SinOsc.ar(freqSlide * 0.5, 0, 0.7 * body);
    sub     = Pulse.ar(freqSlide * 0.5, 0.5, 0.4 * body);
    sub     = sub + LFTri.ar(freqSlide, 0, 0.3 * body);

    // Noise
    nz = (WhiteNoise.ar * noise * 0.5) + (PinkNoise.ar * noise * 0.3);

    midPath = osc + harmonics + nz;

    // Filter envelope + keyboard tracking
    fltEnv  = EnvGen.kr(Env.perc(0.001, (sus * 0.4).max(0.02), 1, -6), levelScale: fenv);
    fltFreq = (cutoff + (freq * track * 0.25) + (fltEnv * cutoff * 2)).clip(60, 6000);
    q      = (1 - rq).linexp(0, 1, 0.05, 1);
    filtered = RLPF.ar(midPath, fltFreq, q);
    filtered = filtered + (BPF.ar(midPath, fltFreq, 0.1) * rq * 0.4);

    // Bass path bypasses the harsh filter, stays fat
    bassPath = subDeep + subSine + sub;
    bassPath = LPF.ar(bassPath, 300);
    bassPath = (bassPath * (1 + (dist * 0.6))).tanh;

    sig = filtered + bassPath;

    // Metal-Zone-style multi-stage distortion
    sig = sig * (1 + (dist * 3));
    sig = (sig * 1.5).tanh;
    sig = (sig * (1 + (dist * 2))).clip(-0.75, 0.75);
    sig = sig + ((sig * dist * 2).fold(-0.5, 0.5) * dist * 0.4);
    sig = (sig * (1 + dist)).tanh;

    // EQ shaping
    sig = BLowShelf.ar(sig, 80, 1, body * 5);
    sig = BLowShelf.ar(sig, 150, 1, body * 3);
    sig = BPeakEQ.ar(sig, 500, 1.5, dist * -3);
    sig = BPeakEQ.ar(sig, 2000, 0.8, dist * 3);
    sig = BHiShelf.ar(sig, 3500, 1, dist * rq * 3);

    // Clean up
    sig = HPF.ar(sig, 25);
    sig = LPF.ar(sig, 16000);
    sig = LeakDC.ar(sig);

    // Amplitude envelope (self-freeing, crashDot sus convention)
    dur = (sus - atk - rel).max(0.001);
    env = EnvGen.ar(Env.linen(atk, dur, rel, 1, -2), doneAction: 2);
    sig = sig * env * amp * 0.35;

    // Slow stereo drift for long notes
    driftL = LFNoise2.kr(0.3 + (drift * 0.2)) * drift * 0.4;
    driftR = LFNoise2.kr(0.25 + (drift * 0.15)) * drift * 0.4;
    sigL = sig * (1 + (LFNoise2.kr(0.1) * drift * 0.003));
    sigR = sig * (1 + (LFNoise2.kr(0.12) * drift * 0.003));
    sigL = sigL * (1 - (pan + driftL).clip(-1, 1)).sqrt;
    sigR = sigR * (1 + (pan + driftR).clip(-1, 1)).sqrt;
    sigR = DelayC.ar(sigR, 0.02, drift * 0.008);

    Out.ar(out, [sigL, sigR]);
}).writeDefFile(~outDir);
"fd_svdk done".postln;
