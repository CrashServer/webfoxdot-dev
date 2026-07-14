// plaits — multi-engine macro-oscillator: a stock-UGen take on Mutable
// Instruments' Plaits (our scsynth WASM has no mi-UGens). `engine` (0-7) picks
// the synthesis model; timbre / harm / morph are the three voice controls;
// cutoff/rq shape the output. All engines run at note.midicps and are blended
// by Select, then enveloped (Env.linen, doneAction 2).
//
//   0 va        virtual-analog detuned saws + sub (timbre = pulse width)
//   1 fm        2-op phase-mod (harm = ratio, timbre = index)
//   2 fold      sine wavefolder (timbre = drive)
//   3 harmonic  band-limited harmonics (harm = number of partials)
//   4 wavetable morph sine->tri->saw->pulse (morph)
//   5 noise     resonant filtered noise (harm = pitch, timbre = resonance)
//   6 string    Karplus-Strong pluck (harm = decay)
//   7 modal     struck modal resonator (morph = decay)

SynthDef(\fd_plaits, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.6, sus=1, pan=0, attack=0.01, release=0.2,
                       engine=0, timbre=0.5, harm=0.5, morph=0.5, cutoff=6000, rq=0.6|
    var freq, t, h, m, ratio, va, fm, fold, harmEng, wt, noiseEng, strEng, modalEng, e, sig, env;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    t = timbre.clip(0, 1);  h = harm.clip(0, 1);  m = morph.clip(0, 1);

    va       = (Saw.ar(freq) + Saw.ar(freq * 1.007) + Pulse.ar(freq * 0.5, t.linlin(0, 1, 0.1, 0.9))) * 0.3;
    ratio    = (h * 8).round.max(1);
    fm       = SinOsc.ar(freq, SinOsc.ar(freq * ratio) * (t * 8));
    fold     = ((SinOsc.ar(freq) * (1 + (t * 8))) * pi).sin * 0.5;
    harmEng  = Blip.ar(freq, (h * 40 + 1));
    wt       = SelectX.ar(m * 3, [SinOsc.ar(freq), LFTri.ar(freq), Saw.ar(freq), Pulse.ar(freq, 0.5)]);
    noiseEng = RLPF.ar(WhiteNoise.ar(0.6), (freq * (1 + (h * 3))).clip(20, 18000), (1 - t).clip(0.02, 1));
    strEng   = CombL.ar(WhiteNoise.ar(0.5) * EnvGen.ar(Env.perc(0.001, 0.03)),
                        0.05, freq.reciprocal.clip(0.0001, 0.05), (h * 4 + 0.2));
    modalEng = Mix(Ringz.ar(Impulse.ar(0) * 0.5, freq * [1, 2.01, 3.3], (m * 2 + 0.1))) * 0.3;

    e   = Select.ar(engine.clip(0, 7), [va, fm, fold, harmEng, wt, noiseEng, strEng, modalEng]);
    sig = RLPF.ar(e, cutoff.clip(40, 18000), rq.clip(0.05, 1.0));
    env = EnvGen.ar(Env.linen(attack.max(0.003), (sus - attack - release).max(0.01), release.max(0.02), 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.6;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_plaits done".postln;
