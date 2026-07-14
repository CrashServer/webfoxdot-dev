// karp — Karplus-Strong plucked string: noise burst into a tuned comb, auto-freed.
SynthDef(\fd_karp, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.8, sus=1, pan=0, attack=0.001, release=0.2, cutoff=6000|
    var freq, exc, sig;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    exc  = WhiteNoise.ar(1) * EnvGen.ar(Env.perc(0.001, 0.02));
    sig  = CombL.ar(exc, 0.05, freq.reciprocal.clip(0.0001, 0.05), (sus * 4).clip(0.1, 12));
    sig  = LPF.ar(sig, cutoff.clip(200, 18000));
    sig  = LeakDC.ar(sig) * amp * 0.6;
    DetectSilence.ar(sig, 0.0001, 0.1, doneAction: 2);
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_karp done".postln;
