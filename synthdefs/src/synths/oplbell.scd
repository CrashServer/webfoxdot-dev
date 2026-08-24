// oplbell — FM bell/mallet, AdLib-style: a non-integer ratio for inharmonic,
// bell-like partials, a fast-decaying modulator (bright metallic attack that
// quickly dulls to a plain sine tail) and a percussive amp envelope. Good for
// melodic percussion / Dune-esque mallet runs.
// Params: out, note, amp, sus, pan, attack, release, ratio, index, feedback,
//         decay (modulator brightness decay time), keyscale

SynthDef(\fd_oplbell, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.001, release=0.3,
                        ratio=3.5, index=6, feedback=0.2, decay=0.25, keyscale=0.5|
    var freq, ks, modFreq, modEnv, modOsc, modPhase, sig, env;
    freq = note.midicps;
    ks = ((note - 60) / 48).clip(0, 1);
    modFreq = freq * ratio;
    modEnv = EnvGen.kr(Env([1, 0], [decay * (1 - (ks * keyscale * 0.6))], -3));
    modOsc = SinOscFB.ar(modFreq, feedback.clip(0, 1.5));
    modPhase = modOsc * freq * index * modEnv;
    sig = SinOsc.ar(freq + modPhase);
    env = EnvGen.ar(Env.perc(attack, (sus * (1 - (ks * keyscale * 0.4))).max(0.05), 1, -4), doneAction: 2);
    sig = sig * env * amp * (1 - (ks * keyscale * 0.4)) * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_oplbell done".postln;
