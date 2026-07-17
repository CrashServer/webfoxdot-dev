// waves — evolving oceanic pad/texture (CrashServer port): cascaded FM sines feeding a
// Gendy-modulated feedback oscillator, through a comb-filter diffusion bank, allpass smear,
// frequency shift and FreeVerb. Long, shifting, ambient. Params: rate (FM depth), mod (ratio).
SynthDef(\fd_waves, {|out=0, note=57, amp=0.5, sus=1, pan=0, attack=0.01, release=0.5,
                      rate=4, mod=1|
    var freq, env, sig, sig2, osc;
    freq = note.midicps;
    env = EnvGen.ar(Env.linen(attack, sus.max(0.01), release, 1, \lin), doneAction: 2);
    sig = SinOsc.ar(freq * (mod + 1), 0, freq * (rate + 4) * LFNoise1.kr(10.reciprocal).abs);
    sig2 = SinOsc.ar((freq * mod) + sig, 0, 0.5);
    sig = SinOscFB.ar(sig2, Gendy5.ar(0.1, 0.4, 0.1, mul: 0.2)) + sig2;
    sig = DelayN.ar(sig2, 0.048, 0.048);
    sig = Mix.arFill(4, { CombN.ar(sig, 0.1, LFNoise1.ar(Rand(0, 0.1), 0.04, 0.05), 15) });
    sig = AllpassN.ar(sig, 0.05, [Rand(0, 0.05), Rand(0, 0.05)], 1);
    sig = FreqShift.ar(sig, (freq / 2) * -1);
    sig = HPF.ar(sig, 150);
    sig = FreeVerb.ar(sig);
    sig = Limiter.ar(sig).tanh;
    osc = Mix(sig * env) * 0.1 * amp;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_waves done".postln;
