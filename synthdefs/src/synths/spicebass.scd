// spicebass — deep, warm Berlin-School bass (Tangerine Dream / Picq "Dune").
// Two lightly-detuned saws + a strong sub sine through a MoogFF ladder with a
// gentle per-note filter envelope and analog drift, softly saturated. Rounder
// and deeper than superbass — meant to sit low and hypnotic under a sequence.
// Params: cutoff, rq (0-3.5), sub, detune, drift, fenv (filter-env depth), glide

SynthDef(\fd_spicebass, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.008, release=0.1,
                          cutoff=550, rq=1.1, sub=0.7, detune=0.007, drift=0.3, fenv=1.6, glide=0|
    var freq, saws, subOsc, sig, filtEnv, cf, env, driftMod;
    freq = Lag.kr(note.midicps, glide);
    driftMod = LFNoise2.kr(0.2).range(1 - (drift * 0.008), 1 + (drift * 0.008));
    freq = freq * driftMod;
    saws = Mix([Saw.ar(freq * (1 - detune)), Saw.ar(freq * (1 + detune)), Saw.ar(freq)]) * 0.3;
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    sig = saws + subOsc;
    filtEnv = EnvGen.kr(Env.perc(0.005, (sus * 0.5).max(0.1), 1, -4));
    cf = (cutoff * (1 + (filtEnv * fenv))).clip(30, 12000);
    sig = MoogFF.ar(sig, cf, rq.clip(0, 3.5));
    sig = (sig * 1.2).tanh;
    env = EnvGen.ar(Env.linen(attack, (sus - attack - release).max(0.02), release, 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.3;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_spicebass done".postln;
