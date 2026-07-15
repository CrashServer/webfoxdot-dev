// synthbass — an 80s / synthwave / Daft-Punk bass. Detuned saws + a sub sine
// through a Moog ladder filter with a snappy filter envelope and tanh dist.
// Built from scratch with clear, predictable controls:
//   sus     — TOTAL note length in seconds (amp env spans exactly sus)
//   note    — MIDI note (octave is exact: freq = note.midicps); sub is one 8ve down
//   detune  — saw spread in % (0 = single pitch, ~0.3 fat, ~1 very wide)
//   cutoff  — base filter cutoff Hz;  fenv — how far the env opens it;  rq — resonance
//   sub     — sub-oscillator level;   dist — saturation/warmth;  glide — portamento s
// Edit then: scripts/build.sh synthbass
SynthDef(\fd_synthbass, {|out=0, note=36, amp=0.8, sus=1, pan=0, attack=0.008, release=0.08,
                         detune=0.3, cutoff=900, rq=0.35, fenv=3, sub=0.7, dist=1.5, glide=0|
    var freq, saws, subosc, sig, ampEnv, filtEnv, fc, hold;
    // Pitch — glide slews the frequency for portamento (glide=0 → instant).
    freq = Lag.kr(note.midicps, glide);
    // Amp envelope: attack · hold · release — total length = sus (one carries doneAction).
    hold    = (sus - attack - release).max(0.01);
    ampEnv  = EnvGen.ar(Env([0, 1, 0.85, 0], [attack, hold, release], [-2, 0, -3]), doneAction: 2);
    // Filter envelope — a percussive dip that opens the cutoff then settles.
    filtEnv = EnvGen.kr(Env.perc(0.004, (sus * 0.55).clip(0.04, 3), 1, -4));
    // 3 detuned saws spread by ±detune% → the fat synthwave/Daft width.
    saws    = LFSaw.ar(freq * (1 + (detune * 0.01 * [0, 1, -1])));
    saws    = Mix(saws) * 0.33;
    // Sub sine one octave down for weight.
    subosc  = SinOsc.ar(freq * 0.5) * sub;
    sig     = saws + subosc;
    // Moog ladder low-pass, cutoff pushed up by the filter envelope (fenv = amount).
    fc      = (cutoff * (1 + (filtEnv * fenv))).clip(30, 16000);
    sig     = MoogFF.ar(sig, fc, (rq * 3.8).clip(0, 3.6));
    // Gentle tanh dist for the analog/Daft warmth + DC block.
    sig     = LeakDC.ar((sig * dist).tanh);
    Out.ar(out, Pan2.ar(sig * ampEnv, pan) * amp * 0.5);
}).writeDefFile(~outDir);
"fd_synthbass done".postln;
