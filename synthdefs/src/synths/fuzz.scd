// fuzz — raw aliased fuzz lead: an LFSaw self-FM'd by another LFSaw, then hard-clipped.
// Nasty, buzzy, punk. Params: cutoff, rq, drive.
SynthDef(\fd_fuzz, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.05,
                     cutoff=4000, rq=0.5, drive=6|
    var freq, osc, env, sig;
    freq = note.midicps;
    osc = LFSaw.ar(LFSaw.kr(freq, 0, freq, freq * 2));  // self-modulated → aliased buzz
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -2), doneAction: 2);
    sig = (osc * drive.max(0.5)).clip(-0.7, 0.7);
    sig = RLPF.ar(sig, cutoff.clip(200, 16000), rq.clip(0.1, 1.0));
    sig = sig * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_fuzz done".postln;
