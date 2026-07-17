// darklead — dark resonant lead (CrashServer port): a triple-detuned saw + pulse over a
// sub sine, softclipped through a resonant LPF and a top-end tame. Brooding and analog.
// Params: cutoff, rq, dist (drive), detune, width (pulse width), sub.
SynthDef(\fd_darklead, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.2,
                         cutoff=2000, rq=0.35, dist=1.5, detune=0.006, width=0.5, sub=0.4|
    var freq, sig, env, osc1, osc2, osc3, subOsc, filtered;
    freq = note.midicps;
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -4), doneAction: 2);
    osc1 = LFSaw.ar(freq);
    osc2 = LFSaw.ar(freq * (1 + detune));
    osc3 = LFSaw.ar(freq * (1 - detune));
    sig = ((osc1 + osc2 + osc3) * 0.25) + (LFPulse.ar(freq, width: width).bipolar * 0.2);
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    sig = sig + subOsc;
    filtered = RLPF.ar(sig, cutoff.clip(100, 12000), rq.clip(0.1, 0.9));
    filtered = LPF.ar((filtered * dist).softclip, 8000);
    sig = filtered * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_darklead done".postln;
