// donk — Ringz resonator donk, adapted from FoxDot donk (CrashServer)
// Params: out, note, amp, sus, pan
// sus: ring decay time (longer = more tail)
// Uses DetectSilence to auto-free when Ringz decays to silence

SynthDef(\fd_donk, {|out=0, note=60, amp=0.9, sus=0.5, pan=0|
    var freq, osc, env;
    // Floor the resonant frequency so low octaves don't drift into sub-DC
    // territory, where the impulse excitation pops instead of pitching.
    freq = (note.midicps / 2).max(20);
    osc  = Ringz.ar(Impulse.ar(0), [freq, freq + 1.5], sus, amp * 0.5);
    osc  = Mix(osc) * 0.5;
    osc  = LeakDC.ar(osc);                                 // remove DC offset (low-octave thump)
    // 3 ms fade-in softens the hard impulse onset that clicks at low octaves;
    // the Ringz decay (sus) still gives the punchy donk tail.
    env  = EnvGen.ar(Env([0, 1, 1], [0.003, sus], \lin));
    osc  = osc * env;
    DetectSilence.ar(osc, 0.0001, 0.05, doneAction: 2);
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_donk done".postln;
