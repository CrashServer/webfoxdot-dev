// arpy — the classic FoxDot arpeggio pluck: a filtered impulse train through a
// short perc envelope. Bright, plucky, perfect for arpeggios. (FoxDot port.)
// Params: out, note, amp, sus, pan, attack, release, fmod, rate.
// Edit then run: scripts/build.sh arpy
SynthDef(\fd_arpy, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.5, fmod=0, rate=1|
    var freq = note.midicps, osc, env;
    freq = [freq, freq + fmod] + [0, 0.5];
    osc = LPF.ar(Impulse.ar(freq, rate), 5000);
    env = EnvGen.ar(Env.perc(attack.max(0.001), (sus * release).max(0.02), 1, -4), doneAction: 2);
    osc = Mix(osc * env) * 2.5;
    Out.ar(out, Pan2.ar(osc, pan) * amp);
}).writeDefFile(~outDir);
"fd_arpy done".postln;
