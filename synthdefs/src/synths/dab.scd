// dab — dirty overdriven bass for walking / riff lines: detuned saws + sub octave through
// tanh drive into a resonant, env-swept LPF, softclipped. Params: cutoff, rq, drive, sub.
SynthDef(\fd_dab, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.008, release=0.08,
                    cutoff=900, rq=0.35, drive=4, sub=0.6|
    var freq, osc, env, sig;
    freq = note.midicps / 2;                           // bass range
    osc = Mix([ Saw.ar(freq * 0.99, mul: 0.5), Saw.ar(freq * 1.01, mul: 0.5), Pulse.ar(freq * 0.5, 0.5, mul: sub) ]);
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -4), doneAction: 2);
    sig = (osc * drive.max(0.5)).tanh;
    sig = RLPF.ar(sig, (cutoff * (0.4 + (env * 1.4))).clip(40, 12000), rq.clip(0.05, 1.0));
    sig = sig.softclip * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_dab done".postln;
