// opl2 — OPL2/AdLib-style 2-operator FM voice. The modulator has true
// self-feedback (SinOscFB, like the real chip's operator feedback) and
// either drives the carrier's phase (alg=0, FM) or sums with it as a second
// partial (alg=1, additive) — alg blends continuously between the two. The
// modulator carries its own brightness envelope (mdec/msus), independent of
// the overall amp envelope — the "bright attack, duller sustain" timbral
// evolution that is a big part of what makes FM voices sound like FM voices.
// keyscale attenuates level and speeds up envelopes on higher notes,
// mirroring the real chip's key-scale-level/-rate.
// Params: out, note, amp, sus, pan, attack, release, ratio, index, feedback,
//         alg (0 FM … 1 additive), mdec, msus (modulator brightness decay/
//         sustain), vib, vibrate, keyscale

SynthDef(\fd_opl2, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.01, release=0.2,
                      ratio=2, index=4, feedback=0, alg=0, mdec=0.4, msus=0.4,
                      vib=0, vibrate=5.5, keyscale=0.3|
    var freq, ks, vibLfo, modFreq, modEnv, modOsc, modPhase, fmSig, addSig, sig, dur, env;
    freq = note.midicps;
    ks = ((note - 60) / 48).clip(0, 1);
    vibLfo = SinOsc.kr(vibrate).range(1 - (vib * 0.03), 1 + (vib * 0.03));
    freq = freq * vibLfo;
    modFreq = freq * ratio;
    modEnv = EnvGen.kr(Env([1, msus], [mdec * (1 - (ks * keyscale * 0.6))], -2));
    modOsc = SinOscFB.ar(modFreq, feedback.clip(0, 1.5));
    modPhase = modOsc * freq * index * modEnv;
    fmSig  = SinOsc.ar(freq + modPhase);
    addSig = (SinOsc.ar(freq) + (modOsc * (index * 0.1).min(1) * modEnv)) * 0.6;
    sig = XFade2.ar(fmSig, addSig, (alg.clip(0, 1) * 2) - 1);
    dur = (sus - attack - release).max(0.001);
    env = EnvGen.ar(Env.linen(attack, dur, release, 1, \sin), doneAction: 2);
    sig = sig * env * amp * (1 - (ks * keyscale * 0.5)) * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_opl2 done".postln;
