// guit — plucked electric guitar, ported from FoxDot guit (CrashServer).
// The original used MiPlaits (engine 11 = inharmonic string), but our scsynth
// WASM has no mi-UGens (see plaits.scd), so this is a stock-UGen Karplus-Strong
// take: two lightly-detuned Pluck strings + `dist` body drive + `mod` vibrato.
// Params: out, note, amp, sus, pan, attack, release, decay, detune, tone, dist, fdecay, mod, level, peak

SynthDef(\fd_guit, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=1, sus=1, pan=0, attack=0.0001, release=0.01,
                      decay=0.01, peak=1, level=1, detune=0.01, tone=0.7, dist=0.7, fdecay=1, mod=0.2|
    var freq, exc, trig, coef, ring, str, sig, env, dt;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    trig = Impulse.ar(0);
    // pluck excitation: a short noise burst, brighter (shorter) with `tone`
    exc  = WhiteNoise.ar(1) * EnvGen.ar(Env.perc(0.001, 0.005 + (0.02 * (1 - tone.clip(0, 1)))));
    coef = ((1 - tone.clip(0, 1)) * 0.5).clip(0, 0.5);          // tone -> string brightness (0 = bright)
    ring = (sus * fdecay * (0.5 + (decay.clip(0, 1) * 4))).clip(0.1, 8);   // string decay time
    dt   = detune.clip(0, 0.2) * 0.5;
    // two lightly-detuned strings for a chorused body
    str  = Pluck.ar(exc, trig, 0.05, (freq * (1 - dt)).reciprocal.clip(0.0002, 0.05), ring, coef)
         + Pluck.ar(exc, trig, 0.05, (freq * (1 + dt)).reciprocal.clip(0.0002, 0.05), ring, coef);
    str  = str * 0.5;
    // body: gentle drive via `dist`, then a resonant lowpass that tracks pitch
    sig  = (str * (1 + (dist.clip(0, 1) * 3))).tanh;
    sig  = RLPF.ar(sig, (freq * 6).clip(200, 16000), 0.6);
    // subtle vibrato via `mod`
    sig  = DelayC.ar(sig, 0.02, ((SinOsc.ar(5) * 0.5 + 0.5) * mod.clip(0, 1) * 0.004) + 0.0005);
    env  = EnvGen.ar(Env([0, peak, level, level, 0],
        [attack.max(0.0001), decay.max(0.001), (sus - attack - release).max(0.05), release.max(0.005)],
        curve: \sin), doneAction: 2);
    sig  = sig * env * amp * 0.4;
    sig  = HPF.ar(sig, 50);
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_guit done".postln;
