// acidline — 303-style acid bassline (CrashServer port): a saw+pulse through a pre-drive,
// swept by a filter envelope (accent deepens it) into a resonant RLPF, post-saturated,
// compressed and limited. Params: cutoff, rq, beef (drive), accent (0..1 env intensity).
SynthDef(\fd_acidline, {|out=0, note=60, amp=0.9, sus=0.3, pan=0, attack=0.001, release=0.1,
                         cutoff=1000, rq=0.6, beef=2, accent=0|
    var freq, sig, env, filterEnv, osc, filtered;
    freq = note.midicps / 2;
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -6), doneAction: 2);
    filterEnv = EnvGen.ar(Env.perc(0.001, sus * 0.5, 1 + accent, -8));
    osc = LFSaw.ar(freq) + (LFPulse.ar(freq, width: 0.5).bipolar * 0.3);
    osc = (osc * (1 + (beef * 0.5))).tanh;
    filtered = RLPF.ar(osc, (cutoff * (1 + (filterEnv * 3))).clip(50, 15000), rq.clip(0.05, 0.95));
    filtered = (filtered * beef).tanh;
    filtered = Compander.ar(filtered, filtered, 0.1, 1, 0.3, 0.001, 0.03, 2);
    sig = Limiter.ar(filtered, 0.9, 0.001) * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_acidline done".postln;
