// spicepad — a lush, slowly-evolving Berlin-School pad (Picq "Dune" atmosphere).
// Six individually-drifting detuned saws (JP-8000-style spread) + a slow-PWM
// pulse + sub sine + a breath of band-passed pink noise for the "sandy, grainy"
// organic texture Picq described, all under a slow filter-LFO sweep. Slow attack/
// release for washes. Params: cutoff, rq, detune, spread, rate (LFO Hz), sub, air
SynthDef(\fd_spicepad, {|out=0, note=60, amp=0.7, sus=4, pan=0, attack=1.5, release=2,
                         cutoff=1700, rq=0.5, detune=0.008, spread=0.5, rate=0.1, sub=0.3, air=0.15|
    var freq, saws, subOsc, noise, sig, lfo, cf, env;
    freq = note.midicps;
    saws = Mix.fill(6, {|i|
        var d = (i - 2.5) * detune * (1 + spread);
        LFSaw.ar(freq * (1 + d) * LFNoise2.kr(0.2).range(0.997, 1.003))
    }) * (1 / 6);
    saws = saws + (Pulse.ar(freq, SinOsc.kr(rate * 1.3).range(0.3, 0.7)) * 0.3);
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    noise = BPF.ar(PinkNoise.ar(air), (freq * 2).clip(80, 12000), 0.6);   // airy grain
    sig = (saws + subOsc + noise) * 0.5;
    lfo = SinOsc.kr(rate, Rand(0, 2pi)).range(0.4, 1);
    cf = (cutoff * lfo).clip(120, 14000);
    sig = RLPF.ar(sig, cf, rq.clip(0.1, 1.0));
    env = EnvGen.ar(Env.linen(attack, (sus - attack - release).max(0.05), release, 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.34;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_spicepad done".postln;
