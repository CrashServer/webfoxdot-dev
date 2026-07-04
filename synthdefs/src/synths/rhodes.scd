// rhodes — Rhodes-style electric piano (CrashServer port). Two detuned pulse
// partials through a resonant 4-pole low-pass whose cutoff tracks a soft
// (sine-curve) envelope, so it opens bright and settles — the classic e-piano bark.
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq.
// Edit then run: scripts/build.sh rhodes
SynthDef(\fd_rhodes, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.001, release=0.1,
                       cutoff=2000, rq=0.5|
    var freq = note.midicps, osc, env;
    osc = Pulse.ar(freq * [1, 33.5.midiratio], [0.2, 0.1], [0.7, 0.3]);
    env = EnvGen.ar(Env([0, 1, 0.8, 0.8, 0],
        [attack, 0.01, (sus - attack - 0.01 - release).max(0.01), release], curve: \sin), doneAction: 2);
    osc = RLPF.ar(osc, ((cutoff * env.squared) + 200 + freq).clip(40, 18000), rq.clip(0.05, 1.0));
    osc = Mix(osc * env) * 0.5;
    Out.ar(out, Pan2.ar(osc, pan) * amp);
}).writeDefFile(~outDir);
"fd_rhodes done".postln;
