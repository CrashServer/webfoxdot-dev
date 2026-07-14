// varsaw — variable-width sawtooth, adapted from FoxDot varsaw (CrashServer).
// FoxDot original: VarSaw width=rate, two-partial detune [1,1.005], soft triangle env.
// Params: out, note, amp, sus, pan, attack, release, rate (VarSaw width 0..1)
SynthDef(\fd_varsaw, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.7, sus=1, pan=0, attack=0.01, release=0.02, rate=0.5|
    var freq, osc, dur, env, sig, atk, rel;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    atk  = attack.max(0.005);
    rel  = release.max(0.01);
    freq = [freq, freq * 1.005];                       // subtle stereo detune
    osc  = VarSaw.ar(freq, width: rate.clip(0.01, 0.99), mul: amp * 0.25);
    dur  = (sus - atk - rel).max(0.001);
    env  = EnvGen.ar(Env.linen(atk, dur, rel, 1, \sin), doneAction: 2);
    sig  = Mix(osc) * 0.5 * env;
    sig  = LeakDC.ar(sig);                              // anti-click DC removal
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_varsaw done".postln;
