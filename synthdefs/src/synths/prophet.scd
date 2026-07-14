// prophet — warm PWM poly synth (analog-style), good for chords/leads/pads
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq
// Slow pulse-width modulation + a filter envelope for movement.

SynthDef(\fd_prophet, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.6, sus=1, pan=0, attack=0.02, release=0.2,
                         cutoff=3000, rq=0.4|
    var freq  = Line.kr((note.midicps) * slidefrom, (note.midicps) * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    var width = SinOsc.kr(0.3, [0, 0.5pi]).range(0.2, 0.8);   // slow PWM, stereo
    var osc   = Pulse.ar([freq, freq * 1.005], width) * 0.4;
    var dur   = (sus - attack - release).max(0.001);
    var env   = EnvGen.ar(Env.linen(attack, dur, release, 1, \sin), doneAction: 2);
    var fenv  = EnvGen.kr(Env.perc(attack, sus * 0.6)) * cutoff * 0.6;
    var sig   = RLPF.ar(osc, (cutoff + fenv).clip(80, 18000), rq.clip(0.05, 1.0));
    sig = Mix(sig) * 0.5 * amp * env;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_prophet done".postln;
