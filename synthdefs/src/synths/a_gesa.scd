// a_gesa — aggressive Gesaffelstein-style distorted sub-bass (CrashServer port).
// Saw + pulse + sub-harmonic, heavy tanh dist, resonant LPF with env-driven
// cutoff and a final softclip. Params: out, note, amp, sus, pan, attack, release,
// dist, cutoff, rq. Edit then run: scripts/build.sh a_gesa
SynthDef(\fd_a_gesa, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.01, release=0.05,
                       dist=8, cutoff=800, rq=0.7|
    var freq, osc, env, drv, sig;
    freq = note.midicps / 4;                       // sub-bass range
    osc = Mix([
        VarSaw.ar(freq, width: LFNoise1.kr(2).range(0.1, 0.9), mul: 0.6),
        Pulse.ar(freq * 0.5, width: LFTri.kr(0.3).range(0.2, 0.8), mul: 0.4),
        SinOsc.ar(freq * 2, mul: 0.2)              // harmonic for punch
    ]);
    env = EnvGen.ar(Env([0, 1, 0.9, 0.7, 0],
        [attack, 0.05, (sus * 0.3).max(0.001), (sus * 0.7 + release).max(0.001)]),
        doneAction: 2);
    drv = (osc * dist.max(0.01)).tanh * 0.7;
    sig  = RLPF.ar(drv,
        (cutoff * (1 + (LFNoise1.kr(2) * 0.3)) * env.pow(0.5)).clip(40, 18000),
        rq.clip(0.05, 1.0));
    sig  = (sig * 1.5).softclip * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_a_gesa done".postln;
