// glitchbass — impulse-driven clipped glitch bass (CrashServer port): a tanh'd sine run
// through two allpass chains modulated by TExpRand at the impulse rate → stuttering,
// metallic glitch artefacts, then an env-swept 4-pole LP. Params: cutoff, rq, rate (glitch density).
SynthDef(\fd_glitchbass, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.0001, release=0.05,
                           cutoff=2000, rq=0.8, rate=1|
    var freq, osc, env, clip;
    freq = note.midicps / 2;
    clip = LinLin.kr(rate.clip(0, 1), 0, 1, 2e-12, 2e-1);
    osc = AllpassC.ar(SinOsc.ar(freq).tanh, 1, TExpRand.ar(2e-4, clip, Impulse.ar(rate.max(0.1))), 2);
    osc = AllpassN.ar(osc, 0.01, XLine.kr(0.0001, 0.01, 20), 0.2);
    osc = osc / 2;
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    osc = BLowPass4.ar(osc, (cutoff * env.squared) + 200 + freq, rq.clip(0.05, 1));
    osc = HPF.ar(osc, 40);
    osc = osc * env * amp * 0.5;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_glitchbass done".postln;
