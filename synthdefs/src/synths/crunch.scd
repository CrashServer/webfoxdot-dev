// crunch — crunchy percussive noise (CrashServer port): a stepped-noise oscillator whose
// sample rate is chaotically modulated by a Crackle generator scaled by pitch → gritty,
// broken-digital texture. Great for industrial hits and glitch perc. Params: grit (density).
SynthDef(\fd_crunch, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.1, grit=15|
    var freq, osc, env;
    freq = note.midicps;
    osc = LFNoise0.ar((Crackle.kr(1.95) * freq) * grit.max(1), mul: 2);
    env = EnvGen.ar(Env.perc(attack, (0.1 + release).max(0.02), 0.5, 0), doneAction: 2);
    osc = osc * env * amp * 0.5;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_crunch done".postln;
