// fbass — Karplus-Strong-style comb-filter exciter bass (CrashServer port, credit: Josh Mitchell)
// A short noise-ish exciter burst rings a frequency-tuned comb delay, tracked by an
// amplitude-following RLPF, then compressed and soft-clipped. Params: decay, cutoff, rq.
SynthDef(\fd_fbass, {|out=0, note=48, amp=0.8, sus=1, pan=0, attack=0.001, release=0.2,
                       decay=1, cutoff=250, rq=0.35|
    var freq, total, exciter, snd, env;
    freq = note.midicps;
    freq = [freq, freq];
    freq = freq / 4;
    total = (attack + decay + sus + release) * freq;
    exciter = EnvGen.ar(Env([0, 1, 1, 0, 0], [attack, decay, sus, release] / total));
    env = EnvGen.ar(Env([0, 1, 0.8, 0.8, 0], [0.002, 0.01, sus, sus]), doneAction: 2);
    snd = CombN.ar(exciter, 0.06, 1 / freq, sus);
    snd = RLPF.ar(snd, LinExp.ar(Amplitude.ar(snd), 0, 1, cutoff.clip(30, 4000), 18000), rq.clip(0.05, 1.0));
    snd = Compander.ar(snd, snd, 0.4, 1, 1 / 2.5, 0.005, 0.05);
    snd = HPF.ar(snd, 40);
    snd = Mix(snd.tanh);
    snd = LeakDC.ar(snd) * env * amp;
    Out.ar(out, Pan2.ar(snd, pan));
}).writeDefFile(~outDir);
"fd_fbass done".postln;
