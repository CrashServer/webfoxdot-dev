// gaze — shoegaze wavetable-style pad (CrashServer-inspired; stock-UGen reimplementation of
// the VOsc original, which needs boot-time wavetables absent under WASM). A slow-morphing
// detuned saw/tri swarm through dual Moog ladders with LFO drift, spread wide + shimmered.
// Params: cutoff, rq, detune, shimmer (high-octave layer), sub.
SynthDef(\fd_gaze, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.05, release=0.4,
                     cutoff=1200, rq=0.2, detune=0.02, shimmer=0.3, sub=0.3|
    var freq, sig, env, swarm, morph, lfo1, lfo2, shim, subOsc;
    freq = note.midicps;
    morph = SinOsc.kr(0.1).range(0, 1);                 // slow wavetable-ish morph
    swarm = Mix.ar([
        LFSaw.ar(freq * (1 - detune)),
        XFade2.ar(LFSaw.ar(freq), LFTri.ar(freq * (1 + (detune * 0.5))), (morph * 2) - 1),
        LFTri.ar(freq * (1 + detune))
    ]) * 0.28;
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    shim = LFSaw.ar(freq * 2 * (1 + (detune * 0.5))) * shimmer * 0.2;
    sig = swarm + subOsc + shim;
    lfo1 = SinOsc.kr(0.13).range(0.6, 1.4);
    lfo2 = SinOsc.kr(0.19, 1).range(0.5, 1.3);
    sig = MoogFF.ar(sig, (cutoff * lfo1).clip(60, 16000), rq.clip(0, 3.9));
    sig = MoogFF.ar(sig, (cutoff * 1.6 * lfo2).clip(60, 18000), (rq * 0.6).clip(0, 3.9));
    sig = Splay.ar([sig, DelayC.ar(sig, 0.02, 0.017), DelayC.ar(sig, 0.02, 0.011)]);
    sig = LeakDC.ar(sig);
    env = EnvGen.ar(Env.linen(attack, sus.max(0.01), release, 1, \sin), doneAction: 2);
    sig = Limiter.ar(sig, 0.9) * env * amp * 0.4;
    Out.ar(out, Balance2.ar(sig[0], sig[1], pan));
}).writeDefFile(~outDir);
"fd_gaze done".postln;
