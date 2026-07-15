// a_daft — Daft Punk-style punchy filter bass (CrashServer port). Saw stack into a
// resonant LPF whose cutoff is driven hard by the envelope (the funk). Params: out,
// note, amp, sus, pan, attack, release, cutoff, rq, punch.
SynthDef(\fd_a_daft, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.005, release=0.05,
                       cutoff=300, rq=0.8, punch=1.2|
    var freq, osc, env, sig;
    freq = note.midicps / 4;                       // sub-bass range
    osc = Mix([
        VarSaw.ar(freq, width: 0.0, mul: 0.6),
        VarSaw.ar(freq * 1.005, width: 0.2, mul: 0.4),
        Pulse.ar(freq * 2, width: 0.5, mul: 0.2)
    ]);
    env = EnvGen.ar(Env([0, 1, 0.8, 0.6, 0],
        [attack, 0.02, (sus * 0.3).max(0.001), (sus * 0.7 + release).max(0.001)]),
        doneAction: 2);
    osc = (osc * punch).softclip;
    sig = RLPF.ar(osc,
        (cutoff * (1 + (env.pow(3) * 2)) * (1 + (LFTri.kr(0.25) * 0.3))).clip(40, 18000),
        rq.clip(0.05, 1.0));
    sig = sig * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_a_daft done".postln;
