// choir — vowel/formant pad. Detuned saw voices + breath noise pushed through
// three formant band-passes (vox selects ah/eh/oh), gentle pitch vibrato, slow
// linen envelope. `vox` 0-2 picks the vowel; `cutoff` tames the top.
// (Named vox/cutoff — NOT vowel/lpf — to avoid clashing with the FX-chain keys.)
SynthDef(\fd_choir, {|out=0, note=60, amp=0.6, sus=1, pan=0, attack=0.3, release=0.4, vox=0, cutoff=4000|
    var freq, vib, src, f1, f2, f3, formants, sig, env;
    freq = note.midicps;
    vib  = SinOsc.kr(5, Rand(0, 2pi)).range(0.996, 1.004);   // subtle pitch shimmer
    freq = freq * vib;
    src  = ((Saw.ar(freq) + Saw.ar(freq * 1.003) + Saw.ar(freq * 0.997)) * 0.2) + WhiteNoise.ar(0.015);
    f1 = Select.kr(vox.clip(0, 2), [730, 530, 570]);
    f2 = Select.kr(vox.clip(0, 2), [1090, 1840, 840]);
    f3 = Select.kr(vox.clip(0, 2), [2440, 2480, 2410]);
    formants = BPF.ar(src, f1, 0.08, 3) + BPF.ar(src, f2, 0.1, 2) + BPF.ar(src, f3, 0.12, 1.5);
    sig = LPF.ar(formants, cutoff.clip(200, 18000));
    env = EnvGen.ar(Env.linen(attack.max(0.005), (sus - attack - release).max(0.01), release.max(0.02), 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_choir done".postln;
