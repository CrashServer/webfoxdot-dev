// French-electro / Justice / Daft-Punk pack (CrashServer ports). Core UGens only.
// Ported to the crashDot contract: freq = note.midicps (exact octave), sus = total
// note seconds, each amp env carries doneAction:2. Build:  scripts/build.sh a_synths

// ── dafbass — Daft-Punk distorted harmonic bass ─────────────────────────────
SynthDef(\fd_dafbass, {|out=0, note=36, amp=0.9, sus=1, pan=0, attack=0.001, release=0.02, rate=1|
    var freq = note.midicps, osc, env, harm;
    freq = freq * Line.kr(Rand(0.5, 1.5), 1, 0.02);          // startup pitch swoop
    harm = [1, 1.01, 2, 2.01];
    harm = harm ++ (harm * rate);
    osc  = (SinOsc.ar(freq * harm).sum.distort * 2) + LFPulse.ar(freq * harm, 0, 0.5).sum.distort;
    env  = EnvGen.ar(Env([0, 1, 0.8, 0.8, 0], [attack, 0.01, (sus - attack - 0.01 - release).max(0.01), release], curve: \sin), doneAction: 2);
    osc  = HPF.ar(osc * env, 40);
    Out.ar(out, Pan2.ar(osc * 0.2, pan) * amp);
}).writeDefFile(~outDir);

// ── a_daftlead — Justice / Daft detuned saw lead with filter sweep ──────────
SynthDef(\fd_a_daftlead, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.01, release=0.1, cutoff=2000, resonance=0.6, filterEnv=0.8, drive=2, rate=1|
    var freq = note.midicps, osc, env, fc;
    freq = [freq, freq * 1.007] * Line.kr(Rand(0.99, 1.01), 1, 0.01);
    osc  = Mix([ VarSaw.ar(freq, 0, 0.0, 0.6), VarSaw.ar(freq * 1.005, 0, 0.1, 0.4), Pulse.ar(freq * 0.5, 0.5, 0.2) ]);
    env  = EnvGen.ar(Env([0, 1, 0.7, 0], [attack, (sus * 0.35).max(0.02), (sus * 0.6).max(0.05)], curve: -2), doneAction: 2);
    fc   = (cutoff * (1 + (filterEnv * env.pow(2))) * (1 + (LFTri.ar(rate * 0.3) * 0.4))).clip(50, 9000);
    osc  = RLPF.ar((osc * drive).tanh, fc, resonance.clip(0.05, 1.0));
    Out.ar(out, Pan2.ar(osc * env * 0.4, pan) * amp);
}).writeDefFile(~outDir);

// ── a_stab — aggressive detuned major-chord stab ────────────────────────────
SynthDef(\fd_a_stab, {|out=0, note=60, amp=0.9, sus=0.3, pan=0, attack=0.005, release=0.05, filterFreq=1000, resonance=0.7, distortion=5|
    var freq = note.midicps, osc, env, fenv, chord;
    chord = [freq, freq * 1.25, freq * 1.5, freq * 2];
    osc   = Mix(chord.collect({|f| Mix([ Saw.ar([f, f * 1.003], 0.15), Pulse.ar(f * 0.5, 0.2, 0.1) ]) }));
    env   = EnvGen.ar(Env([0, 1, 0.3, 0], [attack, 0.08, (sus - attack - 0.08).max(0.05)], curve: -4), doneAction: 2);
    fenv  = EnvGen.ar(Env([0.5, 1, 0.2], [0.01, (sus * 0.9).max(0.05)]));
    osc   = RLPF.ar((osc * distortion).tanh, (filterFreq * fenv).clip(50, 12000), resonance.clip(0.05, 1.0));
    Out.ar(out, Pan2.ar(osc * env * 0.3, pan) * amp);
}).writeDefFile(~outDir);

// ── a_vlead — complex glitchy chopped lead ──────────────────────────────────
SynthDef(\fd_a_vlead, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.001, release=0.1, complexity=0.7, glitch=0.5, cutoff=3000, rate=1|
    var freq = note.midicps, osc, env, mf, chopped, filt;
    mf  = freq * [1, 1.003, 0.997] * (1 + (LFNoise1.ar([7.3, 11.7, 5.1]) * complexity * 0.1));
    osc = Mix([ VarSaw.ar(mf, 0, LFNoise0.ar(16).range(0, 1), 0.5),
                Pulse.ar(mf * 1.5, LFNoise1.ar([3.7, 8.1]).range(0.1, 0.9), 0.4),
                SinOsc.ar(mf * (2 + LFNoise0.ar(12)), LFNoise1.ar(8) * complexity, 0.3) ]);
    env = EnvGen.ar(Env([0, 1, 0.7, 0], [attack, (sus * 0.3).max(0.02), (sus * 0.65).max(0.05)], curve: -2), doneAction: 2);
    chopped = osc * LFPulse.ar(LFNoise0.ar(rate * 2).range(8, 64), 0, LFNoise1.ar(4).range(0.1, 0.9)).range(glitch, 1);
    filt = BPF.ar(chopped, (cutoff * env.pow(0.3)).clip(50, 16000), 0.5, 0.7) + RLPF.ar(chopped, (cutoff * 0.5).clip(50, 16000), 0.3, 0.3);
    Out.ar(out, Pan2.ar(filt * env * 0.4, (pan + (LFNoise1.ar(7) * 0.3)).clip(-1, 1)) * amp);
}).writeDefFile(~outDir);

// ── a_vpad — evolving granular-textured pad ─────────────────────────────────
SynthDef(\fd_a_vpad, {|out=0, note=60, amp=0.9, sus=4, pan=0, attack=0.8, release=1, texture=0.8, granularity=0.6, cutoff=1000|
    var freq = note.midicps, osc, env, gran, filt;
    osc = Mix([ VarSaw.ar(freq * [1, 1.007, 0.993] * (1 + (LFNoise1.ar([0.3, 0.7, 1.1]) * 0.02)), 0, LFNoise1.ar([2.1, 3.7]).range(0.2, 0.8), 0.4),
                Pulse.ar(freq * [0.5, 0.503] * (1 + (LFNoise0.ar([0.1, 0.13]) * 0.01)), LFNoise1.ar([1.3, 2.7]).range(0.3, 0.7), 0.3),
                SinOsc.ar(freq * (1 + (LFNoise1.ar([4.1, 6.7]) * 0.1)), LFNoise1.ar([8.3, 12.1]) * texture, 0.3) ]);
    env = EnvGen.ar(Env([0, 1, 0.85, 0], [attack, (sus - attack - release).max(0.1), release], curve: \sin), doneAction: 2);
    gran = osc * LFNoise0.ar(LFNoise1.ar(0.1).range(20, 200)).range(1 - granularity, 1);
    filt = BPF.ar(gran, (cutoff * (1 + (LFNoise1.ar([0.07, 0.11]) * 0.5))).clip(50, 16000), LFNoise1.ar(0.03).range(0.1, 0.6), 0.6)
         + RLPF.ar(gran, (cutoff * 0.7).clip(50, 16000), 0.4, 0.4);
    Out.ar(out, Pan2.ar(filt * env * 0.3, (pan + (LFNoise1.ar([0.17, 0.23]) * 0.2)).clip(-1, 1)) * amp);
}).writeDefFile(~outDir);

"fd_a_synths done".postln;
