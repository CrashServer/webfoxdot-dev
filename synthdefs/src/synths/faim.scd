// faim — stacked-FM guitar voice, ported from FoxDot faim (CrashServer).
// Adapted to WebFoxDot I/O: bus→out, freq from note.midicps, ReplaceOut→Out,
// final envelope doneAction 0→2 (so the node frees).
// Params: out, note, amp, sus, pan, attack, release, decay, beef, rate, level, peak, fmod

SynthDef(\fd_faim, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.001, release=0.01,
                      decay=0.01, level=0.8, peak=1, gate=1, fmod=0, beef=0, rate=0.01, blur=1|
    var sig, freq;
    var sig1, sig2, sig3, sig4, sig5, sig6;
    var env1, env2, env3, env4, env5, env6;
    sus  = sus * blur;
    freq = note.midicps;
    freq = [freq, freq + fmod];
    freq = freq / 2;
    freq = freq * ((0..1) / 1 - 0.5 * 0.0007 + 1);
    env1 = EnvGen.kr(Env([0,1,0.051,0],[0.001,0.01,0.8], [4,-8]), 1);
    env2 = EnvGen.kr(Env([0,1,0.051,0],[0.005,0.5,1.5], [0,-8], releaseNode:2), 1);
    env3 = EnvGen.kr(Env([0,1,1,0],[0.01,0.01,0.2], [0,0,-4], releaseNode:2), gate);
    env4 = EnvGen.kr(Env([0,1,0],[0.002,2.8], [0,-4]), 1);
    env5 = EnvGen.kr(Env([0,1,1,0],[0.001,0.1,0.8], [4,0,-4], releaseNode:2), gate);
    env6 = EnvGen.kr(Env([0,1,0],[0.001,3.0], [0,-4]), 1);
    sig1 = SinOsc.ar(freq * 11) * env1 + (SinOsc.ar(rate) * env1);
    sig2 = SinOsc.ar(freq * 8 * (sig1 * 2.5 + 1)) * env2;
    sig3 = SinOsc.ar(freq * 2) * env3;
    sig4 = SinOsc.ar(freq * 1 * (sig3 * 2.5 + 1) + 0) * env4;
    sig5 = SinOsc.ar(freq * (1+beef) * (sig2 * 2.5 + 1) * (sig4 * 2.5 + 1)) * env5;
    sig6 = SinOsc.ar(freq * 1) * env6;
    sig  = [sig1, sig2, sig3, sig4, sig5, sig6] * DC.ar([0.0, 0.0, (1+beef)/4, 0.0, 0.5, 1]);
    sig  = sig / (2 + beef);
    sig  = sig.flop.sum;

    sig = sig * EnvGen.ar(Env([0, peak, level, level, 0],
        [attack, decay, max((attack + decay + release), sus - (attack + decay + release)), release],
        curve: \sin), doneAction: 2);

    sig = BLowShelf.ar(sig, 40, 1, -12);
    sig = sig * AmpComp.kr(freq) * 0.65;
    sig = Limiter.ar(sig);
    sig = sig.tanh;
    sig = Mix(sig) * 0.1;
    sig = Pan2.ar(sig, pan, amp);
    Out.ar(out, sig);
}).writeDefFile(~outDir);
"fd_faim done".postln;
