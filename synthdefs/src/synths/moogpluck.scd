// moogpluck — Karplus pluck through a Moog ladder filter (CrashServer).
// Adapted I/O: bus→out, note.midicps, ReplaceOut→Out; single Impulse-triggered
// pluck (original passed a constant trigger), linen env frees the node.
// Params: out, note, amp, sus, pan, attack, release, pluck_filter, pluck_mix, rate

SynthDef(\fd_moogpluck, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.9, sus=1, pan=0, attack=0.001, release=0.1,
                          pluck_filter=4, pluck_mix=0.8, rate=1, fmod=0|
    var pluck, moog, osc, freq;
    freq  = note.midicps + fmod;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    pluck = Pluck.ar(PinkNoise.ar, Impulse.kr(0), freq.reciprocal, freq.reciprocal, sus, (rate - 0.2).clip(-0.5, 0.99));
    moog  = MoogFF.ar(pluck, (freq * pluck_filter).clip(40, 18000), 2);
    osc   = SelectX.ar(pluck_mix.clip(0, 1), [LPF.ar(pluck, 2500), moog]);
    osc   = Mix(osc) * 4 * amp;
    osc   = osc * EnvGen.ar(Env.linen(attack, sus.max(0.1), release + 0.2, curve: \sin), doneAction: 2);
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_moogpluck done".postln;
