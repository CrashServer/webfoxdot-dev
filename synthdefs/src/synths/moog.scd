// moog — classic Minimoog-style subtractive lead/bass: two detuned sawtooth
// oscillators + a sub-oscillator, into a self-resonant 4-pole Moog ladder
// filter (MoogFF) driven by its own ADSR-ish envelope, with portamento.
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq (filter
//         resonance 0-3.9, self-oscillates near the top), fenv (filter
//         envelope depth in octaves), fatk, fdec, fsus, frel (filter env
//         stages), detune, sub (sub-osc level), glide (portamento time)

SynthDef(\fd_moog, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.005, release=0.15,
                     cutoff=800, rq=1.8, fenv=3, fatk=0.01, fdec=0.3, fsus=0.4, frel=0.3,
                     detune=0.008, sub=0.4, glide=0|
    var freq, osc1, osc2, subOsc, sig, ampEnv, filtEnv, cutoffMod, holdTime;
    freq = Lag.kr(note.midicps, glide);
    osc1 = Saw.ar(freq * (1 - detune));
    osc2 = Saw.ar(freq * (1 + detune));
    subOsc = Pulse.ar(freq / 2, 0.5) * sub;
    sig = ((osc1 + osc2) * 0.5) + subOsc;
    holdTime = (sus - fatk - fdec).max(0.05);
    filtEnv = EnvGen.kr(Env.new([0, 1, fsus, fsus, 0], [fatk, fdec, holdTime, frel], 2));
    cutoffMod = cutoff * (2 ** (filtEnv * fenv));
    sig = MoogFF.ar(sig, cutoffMod.clip(40, 18000), rq.clip(0, 3.9));
    ampEnv = EnvGen.ar(Env.linen(attack, sus.max(0.05), release, curve: \sin), doneAction: 2);
    sig = sig * ampEnv * amp * 0.35;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_moog done".postln;
