// fm — two-operator FM synthesis
// Params: out, note, amp, sus, pan, attack, release, ratio, index, cutoff, rq
// ratio: modulator freq / carrier freq (1=unison, 2=octave, 3.5=metallic)
// index: modulation depth (0=pure sine, higher=richer harmonics)

SynthDef(\fd_fm, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.2,
                    ratio=2, index=5, cutoff=8000, rq=0.8|
    var freq = note.midicps;
    var mod  = SinOsc.ar(freq * ratio, mul: freq * index);
    var osc  = SinOsc.ar([freq + mod, freq * 1.001 + mod]);
    var dur  = (sus - attack - release).max(0.001);
    var env  = EnvGen.ar(Env.linen(attack, dur, release, 1, \lin), doneAction: 2);
    var sig  = Mix(osc) * 0.5 * amp * env;
    sig = RLPF.ar(sig, cutoff.clip(80, 20000), rq.clip(0.01, 1.0));
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_fm done".postln;
