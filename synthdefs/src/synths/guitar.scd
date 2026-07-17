// guitar — Karplus-Strong electric guitar: a plucked string (Pluck, noise-excited) pushed
// through overdrive and an amp-sim LPF, with a palm-mute-able env. Play single lines or
// power chords. Params: drive, cutoff, tone (string brightness -0.5..0.5), palm (0..1 mute).
SynthDef(\fd_guitar, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.001, release=0.12,
                       drive=3, cutoff=3000, tone=0.4, palm=0|
    var freq, exc, str, env, sig;
    freq = note.midicps;
    exc = WhiteNoise.ar(1) * EnvGen.ar(Env.perc(0.001, 0.03));      // pluck excitation burst
    str = Pluck.ar(exc, Impulse.ar(0), 0.05, freq.reciprocal, (sus * 2 + 2).clip(0.1, 8), coef: tone.clip(-0.5, 0.5));
    env = EnvGen.ar(Env.perc(attack, (sus * (1 - (palm * 0.7)) + release).max(0.03), 1, -3), doneAction: 2);
    sig = (str * drive.max(0.5)).tanh;                              // overdrive
    sig = RLPF.ar(sig, cutoff.clip(300, 12000), 0.6);              // amp-sim
    sig = sig * env * amp * 0.6;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_guitar done".postln;
