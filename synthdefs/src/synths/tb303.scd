// tb303 — classic acid bass: saw/square through a resonant low-pass with a
// per-note filter envelope (env = mod amount) and optional drive. The squelch
// comes from high rq (resonance) + env sweeping the cutoff.
SynthDef(\fd_tb303, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.08,
                     cutoff=500, rq=0.3, env=2, wave=0, dist=0|
    var freq, osc, fenv, sig;
    freq = note.midicps;
    osc  = SelectX.ar(wave.clip(0, 1), [Saw.ar(freq), Pulse.ar(freq, 0.5)]);
    fenv = EnvGen.kr(Env.perc(0.005, (sus * 0.7).max(0.05))) * cutoff * env;
    sig  = RLPF.ar(osc, (cutoff + fenv).clip(40, 18000), rq.clip(0.05, 1.0));
    sig  = (sig * (1 + (dist * 5))).tanh;
    sig  = sig * EnvGen.ar(Env.linen(attack.max(0.003), sus, release.max(0.02), 1, \sin), doneAction: 2);
    sig  = LeakDC.ar(sig) * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_tb303 done".postln;
