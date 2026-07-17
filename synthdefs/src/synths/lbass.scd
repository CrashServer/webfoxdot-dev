// lbass — Moog acid bass (CrashServer port): a tri/saw oscillator pair (crossfaded by
// oscmix) blended with a filtered pulse sub (submix), through an envelope-swept MoogFF
// ladder. Classic resonant 303-ish low end. Params: cutoff, rq, tone (filter env depth),
// detune, oscmix (tri↔saw), submix (osc↔sub).
SynthDef(\fd_lbass, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.01, release=0.05,
                      cutoff=4500, rq=0.5, tone=0.16, detune=0.3, oscmix=0.5, submix=0.5|
    var freq, osc, osc1, osc2, subOsc, env, envf;
    freq = note.midicps / 2;
    osc1 = Mix([LFTri.ar(freq + detune, LFNoise0.ar(2, 4)), LFTri.ar(freq - detune, LFNoise0.ar(2, 4))]) * 0.5;
    osc2 = Mix([LFSaw.ar(freq + detune, LFNoise0.ar(6, 2)), LFSaw.ar(freq - detune, LFNoise0.ar(6, 2))]) * 0.5;
    subOsc = LPF.ar(LFPulse.ar(freq / 2), 400);
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    envf = EnvGen.ar(Env.adsr(0.01, 0.05, tone.clip(0, 1), 0.5));
    osc = SelectX.ar(oscmix.clip(0, 1), [osc1, osc2]);
    osc = SelectX.ar(submix.clip(0, 1), [osc * 0.8, subOsc]);
    osc = MoogFF.ar(osc, (cutoff * envf).clip(20, 18000), rq.clip(0, 3.99) * 4, mul: 2);
    osc = LeakDC.ar(HPF.ar(osc, 40));
    osc = osc * env * amp * 0.4;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_lbass done".postln;
