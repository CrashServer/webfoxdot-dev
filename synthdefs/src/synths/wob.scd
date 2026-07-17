// wob — dub wobble bass (CrashServer port): a detuned saw pair + pulse over a sub sine,
// saturated then swept by a morphable (sin→tri→saw) LFO through a 24 dB MoogFF ladder,
// with organic drift and portamento. Params: rate (LFO Hz), depth, cutoff, rq (0..3.9),
// lshape (0 sin→1 tri→2 saw), sub, dist, detune, drift, glide.
SynthDef(\fd_wob, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.015, release=0.08,
                    rate=2, depth=0.85, cutoff=400, rq=2.2, lshape=0, sub=0.55,
                    dist=1.8, detune=0.006, drift=0.4, glide=0|
    var freq, sig, subOsc, sawOsc, lfo, filterFreq, driftMod, env;
    freq = Lag.kr(note.midicps, glide);
    subOsc = SinOsc.ar(freq / 2) * sub;
    sawOsc = Mix([Saw.ar(freq * (1 - detune)), Saw.ar(freq * (1 + detune))]);
    sawOsc = sawOsc + (Pulse.ar(freq, 0.38) * 0.45);
    sig = sawOsc + subOsc;
    sig = (sig * dist).tanh;
    lfo = SelectX.kr(lshape.clip(0, 2), [SinOsc.kr(rate), LFTri.kr(rate), LFSaw.kr(rate)]);
    lfo = (lfo + 1) * 0.5;
    driftMod = LFNoise2.kr(0.25).range(1 - (drift * 0.18), 1 + (drift * 0.18));
    filterFreq = (cutoff * (1 + (lfo * depth * 8)) * driftMod).clip(30, 18000);
    sig = MoogFF.ar(sig, filterFreq, rq.clip(0, 3.92));
    sig = sig + (subOsc * 0.3);
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    sig = sig * env * amp * 0.32;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_wob done".postln;
