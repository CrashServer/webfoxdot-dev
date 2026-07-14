// ssaw — supersaw: 7 detuned saws through a resonant low-pass. `detune` spreads.
SynthDef(\fd_ssaw, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.6, sus=1, pan=0, attack=0.02, release=0.2, cutoff=4000, rq=0.6, detune=0.5|
    var freq, d, sig, env;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    d = (detune * 0.02).clip(0, 0.06);
    sig = Mix.ar([Saw.ar(freq * (1 - d)), Saw.ar(freq * (1 - (d * 0.5))), Saw.ar(freq),
                  Saw.ar(freq * (1 + (d * 0.5))), Saw.ar(freq * (1 + d)),
                  Saw.ar(freq * (1 + (d * 0.7))), Saw.ar(freq * (1 - (d * 0.7)))]) * 0.14;
    sig = RLPF.ar(sig, cutoff.clip(80, 18000), rq.clip(0.1, 1.0));
    env = EnvGen.ar(Env.linen(attack.max(0.003), (sus - attack - release).max(0.01), release.max(0.02), 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_ssaw done".postln;
