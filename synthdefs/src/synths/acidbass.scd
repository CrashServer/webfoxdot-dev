// acidbass — TB-303-style acid bass (otophilia / CrashServer). Adapted to
// WebFoxDot I/O: bus→out, note.midicps, ReplaceOut→Out, gate ADSR → fixed-length
// envelopes (hold = sus - attack - decay - release) that free the node.
// Params: out, note, amp, sus, pan, attack, release, decay, rate, width, rq

SynthDef(\fd_acidbass, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.001, release=0.3,
                          decay=0.4, rate=4, width=0.51, rq=0.4, fmod=0|
    var ampEnv, filterEnv, osc, freq, hold;
    freq = (note.midicps / 2) + fmod;
    hold = (sus - attack - decay - release).max(0.01);
    ampEnv = EnvGen.ar(Env.new([0, 1, 0.3, 0.3, 0], [attack, decay, hold, release], [0, -4, 0, -4]), doneAction: 2);
    filterEnv = EnvGen.kr(Env.new([1, 2.pow(rate.clip(0, 6)), 2, 2, 1], [attack, decay * 2, hold, release], [4, -4, 0, -4]));
    osc = LFPulse.ar(freq, width: width.clip(0.09, 0.99)).range(-1, 1);
    osc = RLPF.ar(osc, (freq * filterEnv).clip(40, 18000), rq.clip(0.05, 1));
    osc = HPF.ar(osc, 40);
    osc = osc * ampEnv * amp * 0.4;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_acidbass done".postln;
