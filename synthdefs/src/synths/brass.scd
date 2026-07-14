// brass — saw/pulse stack through a resonant low-pass with a per-note filter
// envelope (the brass "blat") + tanh bite. `bright` scales the filter sweep,
// `cutoff`/`rq` shape it.
SynthDef(\fd_brass, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.7, sus=1, pan=0, attack=0.05, release=0.15, cutoff=2000, rq=0.4, bright=0.5|
    var freq, osc, fenv, sig, env;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    osc  = ((Saw.ar(freq) + Saw.ar(freq * 1.005) + Pulse.ar(freq, 0.4)) * 0.3);
    fenv = EnvGen.kr(Env.perc(attack.max(0.005), (sus * 0.6).max(0.05))) * cutoff * (bright * 4 + 1);
    sig  = RLPF.ar(osc, (cutoff + fenv).clip(80, 16000), rq.clip(0.1, 1.0));
    sig  = (sig * 1.5).tanh;
    env  = EnvGen.ar(Env.linen(attack.max(0.005), (sus - attack - release).max(0.01), release.max(0.02), 1, \sin), doneAction: 2);
    sig  = LeakDC.ar(sig) * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_brass done".postln;
