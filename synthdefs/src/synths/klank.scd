// klank — resonant metallic ring, adapted from FoxDot klank (CrashServer).
// A Klank resonator bank excited by a noise tick, with an optional bitcrush.
// Note: the FoxDot original used Decimator (sc3-plugins, not in this build) and
// ClipNoise — replaced with a core round-bitcrush and WhiteNoise.
// Params: out, note, amp, sus, pan, attack, release, rate (bit depth; lower=grittier)
SynthDef(\fd_klank, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.7, sus=1, pan=0, attack=0.01, release=0.05, rate=16|
    var freq, osc, env, dur, atk, rel, levels;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    atk = attack.max(0.005);
    rel = release.max(0.01);
    osc = Klank.ar(`[[1, 2, 3, 4], [1, 1, 1, 1], [2, 2, 2, 2]], WhiteNoise.ar(0.0005).dup, freq);
    levels = (2 ** rate.clip(2, 16));                  // rate=16 → clean, lower → crushed
    osc = (osc * levels).round / levels;
    dur = ((sus * 1.5) - atk - rel).max(0.02);
    env = EnvGen.ar(Env.linen(atk, dur, rel, 1, \sin), doneAction: 2);
    osc = Mix(osc * env) * 0.5;
    osc = LeakDC.ar(osc);
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_klank done".postln;
