// opldrone — slow, high-feedback FM pad/drone for atmospheric sub-rumble
// (Dune-style "sand and wind" beds). Three detuned unison FM voices + a sine
// sub, gentle vibrato drift, long attack/release for layering under a lead.
// Params: out, note, amp, sus, pan, attack, release, ratio, index, feedback,
//         detune, vib, vibrate, sub

SynthDef(\fd_opldrone, {|out=0, note=60, amp=0.7, sus=4, pan=0, attack=1.2, release=1.5,
                         ratio=1.5, index=3, feedback=0.6, detune=0.006,
                         vib=0.4, vibrate=0.15, sub=0.35|
    var freq, vibLfo, mkFM, sig, subOsc, dur, env;
    freq = note.midicps;
    vibLfo = SinOsc.kr(vibrate, Rand(0, 2pi)).range(1 - (vib * 0.02), 1 + (vib * 0.02));
    mkFM = { |detuneRatio|
        var f = freq * detuneRatio * vibLfo, modFreq = f * ratio, modOsc, modPhase;
        modOsc = SinOscFB.ar(modFreq, feedback.clip(0, 1.5));
        modPhase = modOsc * f * index;
        SinOsc.ar(f + modPhase);
    };
    sig = mkFM.(1 - detune) + mkFM.(1) + mkFM.(1 + detune);
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    sig = ((sig * 0.33) + subOsc) * 0.5;
    dur = (sus - attack - release).max(0.05);
    env = EnvGen.ar(Env.linen(attack, dur, release, 1, \sin), doneAction: 2);
    sig = sig * env * amp;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_opldrone done".postln;
