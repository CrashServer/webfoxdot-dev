// industrialdrone — clipped industrial drone/pad (CrashServer port): a triple-detuned saw
// swarm + feedback-FM sine + sub + filtered pink noise, softclipped through a resonant LPF.
// Long sus = evolving background wall. Params: cutoff, rq, dist (drive), detune, fbk, noise, sub.
SynthDef(\fd_industrialdrone, {|out=0, note=60, amp=0.8, sus=4, pan=0, attack=0.5, release=1,
                                cutoff=800, rq=0.4, dist=1.3, detune=0.01, fbk=0.4, noise=0.15, sub=0.5|
    var freq, sig, env, osc1, osc2, subOsc, noiseLayer;
    freq = note.midicps / 2;
    env = EnvGen.ar(Env.linen(attack, sus, release, 1, \sin), doneAction: 2);
    osc1 = Mix.ar([LFSaw.ar(freq), LFSaw.ar(freq * (1 + detune)), LFSaw.ar(freq * (1 - detune))]) * 0.25;
    osc2 = SinOscFB.ar(freq * 0.5, fbk) * 0.4;
    subOsc = SinOsc.ar(freq * 0.25) * sub;
    noiseLayer = LPF.ar(PinkNoise.ar, cutoff) * noise;
    sig = osc1 + osc2 + subOsc + noiseLayer;
    sig = RLPF.ar(sig, cutoff.clip(100, 8000), rq.clip(0.1, 0.8));
    sig = (sig * dist).softclip;
    sig = sig * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_industrialdrone done".postln;
