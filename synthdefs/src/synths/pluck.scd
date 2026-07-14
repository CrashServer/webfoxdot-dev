// pluck — Karplus-Strong-inspired pluck, adapted from FoxDot pluck (CrashServer)
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq

SynthDef(\fd_pluck, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.8, sus=1, pan=0, attack=0.001, release=0.3,
                       cutoff=8000, rq=0.7|
    var freq  = Line.kr((note.midicps) * slidefrom, (note.midicps) * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    var freq2 = [freq, freq * LFNoise2.ar(50).range(0.999, 1.001)];
    var mod   = VarSaw.ar(freq2, iphase: 1.0, width: Line.ar(1, 0.2, sus.max(0.05) * 0.8));
    var osc   = (SinOsc.ar(freq2 * 1.002, mod) + SinOsc.ar(freq2, mod)) * 0.3;
    var env   = XLine.kr(amp * 3, amp / 10000, sus.max(0.05), doneAction: 2) * 0.3;
    var sig   = Mix(osc * env);
    sig = RLPF.ar(sig, cutoff.clip(80, 20000), rq.clip(0.01, 1.0));
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_pluck done".postln;
