// dirt — grinding dirty lead/chord (CrashServer port): a saw + a wide VarSaw + a
// self-feedback sine, two octaves down, summed raw. Great for filthy stabs and chords.
// Params: rate (VarSaw brightness), cutoff (tames the top).
SynthDef(\fd_dirt, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.05,
                     rate=0.01, cutoff=6000|
    var freq, osc, env;
    freq = note.midicps / 4;
    osc = LFSaw.ar(freq, mul: 0.5)
        + VarSaw.ar(freq + 1, width: (0.85 + rate).clip(0.05, 0.98), mul: 0.5)
        + SinOscFB.ar(freq - 1, mul: 0.25);
    osc = LPF.ar(osc, cutoff.clip(200, 18000));
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -2), doneAction: 2);
    osc = osc * env * amp * 0.5;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_dirt done".postln;
