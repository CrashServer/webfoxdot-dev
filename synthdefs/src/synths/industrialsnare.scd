// industrialsnare — brutal layered snare (CrashServer port): pitched FM body + band-passed
// noise + a crackle/dust "wire" rattle + metallic ring-mod, run through a tanh→clip→fold
// distortion chain, compressed and EQ'd for aggression. Params: decay, tone, noise, dist, snap.
SynthDef(\fd_industrialsnare, {|out=0, note=53, amp=0.8, sus=1, pan=0, attack=0.0005, release=0.05,
                                decay=0.2, tone=0.5, noise=0.7, dist=4, snap=0.6|
    var freq, sig, env, toneOsc, noiseOsc, rattleOsc, ringOsc, snapOsc, pitchEnv, compressed;
    freq = note.midicps;
    pitchEnv = EnvGen.ar(Env([3, 1.2, 1], [0.001, 0.015], [\exp, \lin]));
    env = EnvGen.ar(Env.perc(0.0005, decay, 1, -6), doneAction: 2);
    toneOsc = SinOsc.ar(freq * pitchEnv);
    toneOsc = toneOsc + (SinOsc.ar(freq * pitchEnv * 1.6, toneOsc * 2) * 0.4);
    toneOsc = toneOsc + (SinOscFB.ar(freq * pitchEnv * 0.5, 0.8) * 0.3);
    toneOsc = toneOsc * env * tone;
    noiseOsc = WhiteNoise.ar;
    noiseOsc = BPF.ar(noiseOsc, 2000, 0.8) + (HPF.ar(noiseOsc, 4000) * 0.5);
    noiseOsc = noiseOsc * EnvGen.ar(Env.perc(0.0003, decay * 0.8, 1, -4)) * noise;
    rattleOsc = Mix.ar([Crackle.ar(1.95) * 0.3, LFNoise0.ar(8000) * 0.4, Dust2.ar(12000) * 0.3]);
    rattleOsc = RHPF.ar(rattleOsc, 3000, 0.4) * EnvGen.ar(Env.perc(0.001, decay * 1.2, 1, -3)) * 0.5;
    ringOsc = (SinOsc.ar(freq * 3.2) * SinOsc.ar(freq * 4.7)) + (SinOsc.ar(freq * 2.1) * SinOsc.ar(freq * 5.3) * 0.5);
    ringOsc = ringOsc * Decay.ar(Impulse.ar(0), decay * 0.3) * 0.3;
    snapOsc = HPF.ar(WhiteNoise.ar, 6000) * EnvGen.ar(Env.perc(0.0001, 0.008, 1, -12)) * snap;
    sig = toneOsc + noiseOsc + rattleOsc + ringOsc + snapOsc;
    sig = (sig * dist).tanh;
    sig = (sig * 2).clip(-1, 1);
    sig = sig + ((sig * dist * 0.5).fold(-0.7, 0.7) * 0.3);
    compressed = Compander.ar(sig, sig, 0.1, 1, 0.1, 0.0001, 0.02, 3);
    compressed = Limiter.ar(compressed, 0.95, 0.0003);
    sig = BPeakEQ.ar(compressed, 4000, 0.7, 4 * snap);
    sig = sig * amp * 0.35;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_industrialsnare done".postln;
