// cs80 — Yamaha CS-80 / Vangelis "Blade Runner" lead (Mike Hairston / CrashServer).
// Adapted I/O: bus→out, note.midicps, ReplaceOut→Out, gate ADSR → fixed-length
// envelopes that free the node.
// Params: out, note, amp, sus, pan, attack, release, fatk, fdec, fsus, frel,
//         cutoff, detune, vibrate, vib

SynthDef(\fd_cs80, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.3, release=1.0,
                     fatk=0.75, fdec=0.5, fsus=0.8, frel=1.0, cutoff=2200, detune=0.002,
                     vibrate=4, vib=0.015, fmod=0|
    var env, fenv, vibr, ffreq, osc, freq, hold;
    freq = note.midicps + fmod;
    hold = (sus - attack - release).max(0.05);
    env  = EnvGen.kr(Env.linen(attack, hold, release, curve: \sin), doneAction: 2);
    fenv = EnvGen.kr(Env.new([0, 1, fsus, fsus, 0], [fatk, fdec, hold.max(0.05), frel], 2));
    vibr = SinOsc.kr(vibrate).range(1 / (1 + vib), 1 + vib);
    freq = freq * vibr;
    osc  = Saw.ar([freq, freq * (1 + detune)], mul: env * amp * 0.25);
    osc  = Mix.ar(osc);
    ffreq = max(fenv * freq * 12, cutoff) + 100;
    osc  = LPF.ar(osc, ffreq.clip(100, 18000));
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_cs80 done".postln;
