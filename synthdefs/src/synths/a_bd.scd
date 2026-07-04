// a_bd — electro bass-drum / kick (CrashServer port). A pitch-swept sine body +
// noise click + sub, heavily tanh-distorted with low-mid EQ boosts (French-electro
// kick). Percussive: `dur`/`sus` sets the decay tail. Low default note.
// Params: out, note, amp, sus, pan, attack, release, click, punch, sub, distortion.
// Edit then run: scripts/build.sh a_bd
SynthDef(\fd_a_bd, {|out=0, note=36, amp=0.9, sus=0.4, pan=0, attack=0.001, release=0.05,
                     click=1, punch=1, sub=1, distortion=3|
    var freq = note.midicps, kick, env, clickEnv, subEnv, dist;
    env      = EnvGen.ar(Env([0, 1, 0.7, 0.3, 0], [0.002, 0.01, 0.1, (sus).max(0.05)]), doneAction: 2);
    clickEnv = EnvGen.ar(Env([0, 1, 0], [0.001, 0.01]));
    subEnv   = EnvGen.ar(Env([0, 1, 0.8, 0], [0.005, 0.05, 0.4]));
    kick = Mix([
        SinOsc.ar(freq * EnvGen.ar(Env([3, 1, 0.7, 0.5], [0.002, 0.02, 0.2])), mul: env),
        LPF.ar(WhiteNoise.ar(click * clickEnv), 3000) * 0.3,
        SinOsc.ar(freq * 0.5 * EnvGen.ar(Env([2, 1], [0.01])), mul: subEnv * sub),
    ]);
    dist = (kick * (distortion * punch).max(0.01)).tanh * 0.8;
    dist = BPeakEQ.ar(dist, 80, 0.8, 3);
    dist = BPeakEQ.ar(dist, 2000, 0.5, 2);
    kick = (dist * 1.2).softclip * amp * 0.7;
    Out.ar(out, Pan2.ar(kick, pan));
}).writeDefFile(~outDir);
"fd_a_bd done".postln;
