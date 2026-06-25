// piano — FM electric-piano: a bright attack (FM index envelope) settling to a
// mellow body. `tone` scales the brightness.
SynthDef(\fd_piano, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.002, release=0.3, tone=0.5|
    var freq, fenv, mod, car, sig, env;
    freq = note.midicps;
    fenv = EnvGen.kr(Env.perc(0.001, 0.4));
    mod  = SinOsc.ar(freq * 2) * freq * ((tone * 3) + 1) * fenv;
    car  = SinOsc.ar(freq + mod) + (SinOsc.ar(freq) * 0.5);
    env  = EnvGen.ar(Env.perc(attack.max(0.001), (sus * 0.9) + release.max(0.05), 1, -4), doneAction: 2);
    sig  = LeakDC.ar(car * env) * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_piano done".postln;
