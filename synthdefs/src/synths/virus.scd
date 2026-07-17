// virus — chaotic Henon-driven lead/texture (CrashServer port): a Henon-map chaos generator
// modulates a bank of pulse-gated sine partials, pink noise and a resonant impulse, all
// tanh-summed and low-passed. Wild, glitchy, alien. Params: cutoff, mod1, mod2 (Henon coeffs), rate.
SynthDef(\fd_virus, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.1,
                      cutoff=5400, mod1=0.1, mod2=0.25, rate=1|
    var freq, osc, mainEnv, speed, freqs, pulse, a, bass, tone1, tone2, tone3, noise, impulse;
    freq = note.midicps / 2;
    mainEnv = EnvGen.kr(Env.triangle(sus, 1), doneAction: 2);
    speed = Array.geom(4, rate, 1.5);
    freqs = Array.geom(8, freq / 2, 1.5);
    pulse = {|rat1, rat2| LFPulse.ar(rat1, [0, 0.5, 1].choose) * LFPulse.ar(rat2) };
    a = Lag.ar(HenonN.ar(speed.choose * (mainEnv * 10000.rand), mod1, mod2), 0.01);
    bass = SinOsc.ar(freqs.choose * (a * 1.0.rand), 0, Lag.ar(pulse.(rate, speed.choose), 0.001));
    tone1 = SinOsc.ar((freqs.choose + Rand(0, 5)) * a, 0, 0.01 * pulse.(speed.choose, speed.choose));
    tone2 = SinOsc.ar(freqs.choose * a, 0, 0.1 * pulse.(speed.choose, rate));
    tone3 = SinOsc.ar(freqs.choose * a, 0, 0.05 * pulse.(speed.choose, rate)) * mainEnv.round(0.25);
    noise = PinkNoise.ar(a * 0.1 * pulse.(rate, rate));
    impulse = RLPF.ar(Impulse.ar(pulse.(rate, speed.choose), a), freqs.choose + (a * 10), 0.01, 0.1).tanh;
    osc = (bass + tone1 + tone2 + tone3 + noise + impulse).tanh;
    osc = LPF.ar(osc, cutoff.clip(200, 18000));
    osc = osc * mainEnv * amp * 0.5;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_virus done".postln;
