// hiss — one unified noise generator, `type` picks the color/character (CrashServer
// port + consolidation of live-rig noise/pink/brown/crackle/dust into one voice).
// Named `hiss` (not `noise`) because `noise` is already a video-scene name.
// type: 0 white · 1 pink · 2 brown · 3 gray · 4 crackle · 5 dust · 6 lfnoise (stepped)
// Accepts a string ("pink") or an int (1) from the JS side — see registry.js `enums`.
// Params: type, cutoff, rq, chaos (crackle chaos amount), density (dust Hz), rate (lfnoise Hz)
SynthDef(\fd_hiss, {|out=0, note=60, amp=0.6, sus=1, pan=0, attack=0.01, release=0.1,
                     type=0, cutoff=12000, rq=0.7, chaos=0.5, density=500, rate=1000|
    var src, env, sig;
    src = Select.ar(type.clip(0, 6), [
        WhiteNoise.ar(1) * 0.5,
        PinkNoise.ar(1) * 0.7,
        BrownNoise.ar(1) * 0.35,
        GrayNoise.ar(1) * 0.5,
        Crackle.ar(chaos.clip(0, 1).linlin(0, 1, 1.05, 1.99)) * 0.5,
        Dust2.ar(density.clip(1, 5000)) * 0.9,
        LFNoise2.ar(rate.clip(1, 20000)) * 0.7,
    ]);
    src = HPF.ar(src, 20);
    src = RLPF.ar(src, cutoff.clip(40, 20000), rq.clip(0.05, 1.0));
    env = EnvGen.ar(Env([0, 1, 1, 0], [attack, sus, release]), doneAction: 2);
    sig = src * env * amp;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_hiss done".postln;
