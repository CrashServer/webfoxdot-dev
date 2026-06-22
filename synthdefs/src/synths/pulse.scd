// pulse — PWM pulse wave with RLPF
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq, width
// width: pulse duty cycle (0.05–0.95); 0.5 = square

SynthDef(\fd_pulse, {|out=0, note=60, amp=0.5, sus=1, pan=0, attack=0.01, release=0.1,
                       cutoff=6000, rq=0.8, width=0.5|
    var freq = note.midicps;
    var osc  = LFPulse.ar([freq, freq * 1.001], width: width.clip(0.05, 0.95));
    var dur  = (sus - attack - release).max(0.001);
    var env  = EnvGen.ar(Env.linen(attack, dur, release, 1, \lin), doneAction: 2);
    var sig  = Mix(osc) * 0.5 * amp * env;
    sig = RLPF.ar(HPF.ar(sig, 40), cutoff.clip(80, 20000), rq.clip(0.01, 1.0));
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_pulse done".postln;
