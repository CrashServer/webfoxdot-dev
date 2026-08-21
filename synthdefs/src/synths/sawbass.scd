// sawbass — detuned saw stack through a filter-envelope RLPF sweep plus a rational
// (Padé-style) waveshaper for extra bite, then shelved/peaked EQ. CrashServer port.
// Params: cutoff, rq.
SynthDef(\fd_sawbass, {|out=0, note=48, amp=0.9, sus=1, pan=0, attack=0.01, release=0.05,
                        cutoff=1000, rq=0.5|
    var freq, osc1, osc2, filt, filt2, env, filterEnv, ab;
    freq = note.midicps;
    osc1 = Saw.ar(freq);
    osc2 = Mix(Saw.ar(freq * [0.25, 1, 1.5], [0.5, 0.4, 0.1]));
    filterEnv = EnvGen.ar(Env.adsr(attack, 0.5, 0.2, sus));
    filt = RLPF.ar(osc1 + osc2, (cutoff * filterEnv + 100).clip(60, 18000), rq.clip(0.05, 1.0));
    ab = filt;
    filt2 = (filt * (ab + 2)) / (filt.squared + ab + 1);
    filt2 = BLowShelf.ar(filt2, 300, 1.0, -12);
    filt2 = BPeakEQ.ar(filt2, 1600, 1.0, -6);
    env = EnvGen.ar(Env([0, 1, 0.8, 0.8, 0], [attack, 0, sus, release]), doneAction: 2);
    Out.ar(out, Pan2.ar(HPF.ar((filt + filt2) * env * amp * 0.25, 40), pan));
}).writeDefFile(~outDir);
"fd_sawbass done".postln;
