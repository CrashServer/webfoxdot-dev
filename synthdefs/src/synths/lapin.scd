// lapin — Karplus/Pluck "rabbit" guitar, ported from FoxDot lapin (CrashServer).
// Adapted I/O: bus→out, freq from note.midicps, ReplaceOut→Out, env doneAction 0→2.
// Declared the loop var `d` (was an implicit global in the original).
// Params: out, note, amp, sus, pan, attack, release, decay, rate, level, peak, fmod

SynthDef(\fd_lapin, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.001, release=0.01,
                       decay=0.01, level=0.8, peak=1, fmod=0, rate=1, blur=1|
    var osc, freq, string, d;
    sus = sus * blur;
    string = {|f|
        var delay = f.reciprocal;
        Pluck.ar(SinOsc.ar(Line.ar(1000, 50, 0.01)) * Env.perc(0.001, 0.01).ar,
            Impulse.ar(0), delay, delay, 5 * rate, 0.5)
    };
    freq = note.midicps;
    freq = [freq, freq + fmod];

    osc = string.(freq) + string.(freq) + string.(freq * 0.5);
    osc = osc + (HPF.ar(LocalIn.ar(2), 3000) * -50.dbamp);
    osc = osc + HPF.ar(osc, 3000);
    osc = (osc * 32.dbamp).tanh;
    osc = (osc * 32.dbamp).tanh;
    osc = RLPF.ar(osc, 300, 0.5);
    osc = (osc * 32.dbamp).tanh;
    osc = CombN.ar(osc ! 4, 4 / (freq / 24), 4 / freq, 1) + osc;
    osc = BHiShelf.ar(osc, 3200, 1, -3.0);
    osc = LeakDC.ar(osc);
    osc = DelayC.ar(osc, 0.1, SinOsc.kr(0.1, [0, 1pi]).range(0, 1e-4));
    osc = HPF.ar(osc, 60);
    osc = RLPF.ar(osc, 6400 * [1, 1.1], 0.5);
    5.do {
        d = 0.2.rand;
        osc = AllpassN.ar(osc, d, d, 5);
    };
    osc = osc * EnvGen.ar(Env([0, peak, level, level, 0],
        [attack, decay, max((attack + decay + release), sus - (attack + decay + release)), release],
        curve: \sin), doneAction: 2);
    osc = osc * amp * 0.35;
    osc = Mix(osc) * 0.1;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_lapin done".postln;
