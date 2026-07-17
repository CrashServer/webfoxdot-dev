// growl — talking ring-mod growl: a sine ring-modulated by a subsonic saw, tanh-driven and
// filtered. Menacing bass-lead. Params: rate (growl speed), cutoff, rq.
SynthDef(\fd_growl, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.08,
                      rate=1, cutoff=3000, rq=0.5|
    var freq, osc, env, sig;
    freq = note.midicps;
    osc = SinOsc.ar(freq + SinOsc.kr(0.5 * rate, mul: freq * 0.02)) * Saw.ar((28 * rate).clip(5, 200)).range(0.2, 1.0);
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -2), doneAction: 2);
    sig = (osc * 3).tanh;
    sig = RLPF.ar(sig, cutoff.clip(200, 16000), rq.clip(0.1, 1.0)) * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_growl done".postln;
