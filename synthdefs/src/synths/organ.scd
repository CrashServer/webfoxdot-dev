// organ — drawbar additive organ (sine partials) + optional key-click "perc".
// `cutoff` is the organ's own LPF (named cutoff, not lpf, to avoid the FX key).
SynthDef(\fd_organ, {|out=0, note=60, amp=0.6, sus=1, pan=0, attack=0.01, release=0.1, cutoff=6000, perc=0|
    var freq, sig, env, click;
    freq = note.midicps;
    sig = (SinOsc.ar(freq * 0.5) * 0.4 + SinOsc.ar(freq) + SinOsc.ar(freq * 1.5) * 0.5
         + SinOsc.ar(freq * 2) * 0.4 + SinOsc.ar(freq * 3) * 0.25 + SinOsc.ar(freq * 4) * 0.2) * 0.2;
    click = EnvGen.ar(Env.perc(0.001, 0.05)) * perc * SinOsc.ar(freq * 4) * 0.3;
    sig = LPF.ar(sig + click, cutoff.clip(200, 18000));
    env = EnvGen.ar(Env.linen(attack.max(0.003), (sus - attack - release).max(0.01), release.max(0.02), 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_organ done".postln;
