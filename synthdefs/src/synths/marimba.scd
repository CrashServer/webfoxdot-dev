// marimba — Klank resonator (fixed harmonic ratios) excited by a PinkNoise burst.
// CrashServer port. No extra params beyond the common set — the resonator's
// character comes from its fixed partial ratios (0.5, 1, 4, 9).
SynthDef(\fd_marimba, {|out=0, note=72, amp=0.8, sus=1, pan=0, attack=0.001, release=1|
    var freq, osc, env;
    freq = note.midicps;
    osc = Klank.ar(`[[0.5, 1, 4, 9], [0.5, 1, 1, 1], [1, 1, 1, 1]], PinkNoise.ar([0.007, 0.007]), freq, [0, 2]);
    env = EnvGen.ar(Env.perc(attackTime: attack, releaseTime: release.max(0.02), level: amp * 6, curve: -6), doneAction: 2);
    osc = Mix(osc * env) * 0.5;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_marimba done".postln;
