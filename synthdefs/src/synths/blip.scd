// blip — short digital blip, adapted from FoxDot blip (CrashServer)
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq, rate
// rate: number of Blip harmonics (1–80); higher = brighter attack

SynthDef(\fd_blip, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.7, sus=1, pan=0, attack=0.0001, release=0.1,
                       cutoff=12000, rq=0.6, rate=4|
    var freq  = Line.kr((note.midicps) * slidefrom, (note.midicps) * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    var freq2 = [freq * 2, freq * 2 * LFNoise2.ar(50).range(0.998, 1.002)];
    var osc   = (LFCub.ar(freq2 * 1.002, iphase: 1.5) + (LFTri.ar(freq2) * 0.3))
                * Blip.ar(freq, rate.clip(1, 80));
    var env   = XLine.ar(amp * 4, amp / 10000, sus.max(0.05) * 2, doneAction: 2) * 0.3;
    var sig   = Mix(osc * env);
    sig = HPF.ar(sig, 30);
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_blip done".postln;
