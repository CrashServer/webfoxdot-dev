// hoover — the rave hoover stab (CrashServer, after mcld's reverse-engineering).
// Adapted I/O: bus→out, note.midicps, ReplaceOut→Out, free env doneAction 0→2.
// Params: out, note, amp, sus, pan, attack, release, decay, level, peak, porta, portadur

SynthDef(\fd_hoover, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.01, release=0.01,
                       decay=0.2, level=0.8, peak=1, porta=1, portadur=0.125, fmod=0|
    var osc, midfreqs, vibamount, freq;
    freq = note.midicps;
    freq = Line.kr((freq * porta).clip(20, 22000), freq, sus * portadur);
    freq = [freq, freq + fmod];
    vibamount = EnvGen.kr(Env([0, 0, 1], [0.0, 0.4], loopNode: 1), HPZ1.kr(freq).abs);
    freq = LinXFade2.kr(freq, freq * LFPar.kr(3).exprange(0.98, 1.02), vibamount * 2 - 1);
    midfreqs = freq + (3.87 * (-2 .. 2));
    midfreqs = midfreqs.collect {|f| f + (LFNoise1.kr(2) * 3) };
    osc = Saw.ar(midfreqs).sum + SinOsc.ar(freq * [0.25, 0.5, 0.75], 0, [1, 0.3, 0.2] * 2).sum;
    osc = osc + BPF.ar(osc, 1000, mul: 0.5) + BPF.ar(osc, 3000, mul: 0.3);
    osc = osc * EnvGen.ar(Env([0, peak, level, level, 0],
        [attack, decay, max((attack + decay + release), sus - (attack + decay + release)), release],
        curve: \sin), doneAction: 2);
    Out.ar(out, Pan2.ar(osc * 0.15 * amp, pan));
}).writeDefFile(~outDir);
"fd_hoover done".postln;
