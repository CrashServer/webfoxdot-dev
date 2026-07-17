// doom — filthy doom bass (CrashServer port): saw + detuned pulse, drifted by per-voice
// noise, hard-clipped then tanh-saturated through an LFO-swept resonant LPF. Very dirty.
// Params: cutoff, rq, pw (pulse width), wnoise (white-noise grit).
SynthDef(\fd_doom, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.001, release=0.05,
                     cutoff=3000, rq=0.5, pw=0.5, wnoise=0.1|
    var freq, sig, osc1, osc2, env, lfo;
    freq = note.midicps / 4;
    freq = freq * LFNoise1.kr(1).bipolar(1/8).midiratio;
    osc1 = LFSaw.ar(freq, 0.75);
    osc2 = Pulse.ar(freq * 1.01, pw.clip(0.01, 0.99));
    sig = osc1 + osc2 + WhiteNoise.ar(wnoise.clip(0, 1));
    sig = (sig * 20).clip(-1, 1);
    lfo = SinOsc.kr(4).range(0, 1000);
    sig = RLPF.ar(sig, (cutoff + lfo).clip(20, 18000), rq.clip(0.01, 1));
    sig = (sig * 200).tanh;
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    sig = sig * env * amp * 0.25;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_doom done".postln;
