// war — CrashServer's power-chord riff machine: fat detuned saws + a sub octave pushed
// through heavy tanh drive (beef) into a resonant, envelope-swept LPF, then softclipped.
// Play power chords ([0,-5,-7] / [0,7]) with a short sus for palm-muted chug.
// Params: cutoff, rq, beef (drive amount), sub. Edit then: scripts/build.sh war
SynthDef(\fd_war, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.005, release=0.06,
                    cutoff=1200, rq=0.4, beef=8, sub=0.3|
    var freq, osc, env, drv, sig;
    freq = note.midicps;
    osc = Mix([
        Saw.ar(freq * 0.994, mul: 0.5),
        Saw.ar(freq * 1.006, mul: 0.5),
        Saw.ar(freq, mul: 0.45),
        Pulse.ar(freq * 0.5, 0.5, mul: sub)            // sub octave for weight
    ]);
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    drv = (osc * beef.max(0.5)).tanh;                  // heavy distortion (beef = drive)
    sig = RLPF.ar(drv, (cutoff * (0.5 + env)).clip(60, 16000), rq.clip(0.05, 1.0));
    sig = sig.softclip * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_war done".postln;
