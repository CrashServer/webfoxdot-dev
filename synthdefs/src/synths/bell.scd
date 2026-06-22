// bell — metallic struck bell via Klank resonator bank
// Params: out, note, amp, sus, pan, attack, release, rate
// rate: ring time scaler (higher = longer metallic ring)

SynthDef(\fd_bell, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.001, release=0.5,
                      rate=1|
    var freq = note.midicps;
    var exciter = Impulse.ar(0) + (PinkNoise.ar(0.02) * EnvGen.ar(Env.perc(0.001, 0.01)));
    var osc = Klank.ar(
        `[[0.5, 1, 1.19, 1.71, 2.0, 2.74, 3.0, 3.76, 4.07],
          [0.25, 1, 0.8, 0.5, 0.9, 0.4, 0.3, 0.25, 0.2],
          [0.3, 1, 0.8, 0.6, 0.7, 0.5, 0.4, 0.3, 0.2]],
        exciter, freq, 0, (sus * rate).clip(0.1, 8));
    var env = EnvGen.ar(Env.perc(attack, (sus * rate).max(0.1), 1, -4), doneAction: 2);
    var sig = osc * env * amp * 0.3;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_bell done".postln;
