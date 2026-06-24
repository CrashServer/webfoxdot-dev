// bass — clean sub/mid bass, adapted from FoxDot bass (CrashServer)
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq
// LFTri + VarSaw + SinOscFB layered an octave down for weight.

SynthDef(\fd_bass, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.1,
                      cutoff=2000, rq=0.6|
    var freq = note.midicps / 2;
    var osc  = LFTri.ar(freq) + VarSaw.ar(freq, width: 0.3) + SinOscFB.ar(freq, 0.4);
    var dur  = (sus - attack - release).max(0.001);
    var env  = EnvGen.ar(Env.linen(attack, dur, release, 1, \sin), doneAction: 2);
    var sig  = RLPF.ar(osc * 0.3, cutoff.clip(60, 18000), rq.clip(0.05, 1.0));
    sig = sig * amp * env;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_bass done".postln;
