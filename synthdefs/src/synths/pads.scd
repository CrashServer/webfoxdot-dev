// pads — lush sustained pad, adapted from FoxDot pads (CrashServer)
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq
// Slow filter sweep + detuned stereo for a warm, evolving pad.

SynthDef(\fd_pads, {|out=0, note=60, amp=0.6, sus=1, pan=0, attack=0.1, release=0.4,
                      cutoff=1200, rq=0.6|
    var freq = note.midicps * [1, 1.005];
    var osc  = SinOsc.ar(Line.kr(freq * 4, freq, 0.02)
                + (Line.kr(10, freq * 2, sus) * Pulse.ar(freq, width: SinOsc.kr(0.225 / sus.max(0.05)))),
                mul: 0.5);
    var dur  = (sus - attack - release).max(0.001);
    var env  = EnvGen.ar(Env([0, 1, 0.7, 0], [attack, dur, release], \sin), doneAction: 2);
    var sig  = RHPF.ar(osc, Line.kr(400, cutoff.clip(200, 8000), sus), rq.clip(0.05, 1.0));
    sig = Mix(sig) * 0.5 * amp * env;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_pads done".postln;
