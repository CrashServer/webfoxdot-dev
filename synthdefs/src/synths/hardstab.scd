// hardstab — hard rave/industrial stab (CrashServer port): a detuned saw+pulse swarm with
// a feedback layer, tanh + wavefold saturation, an env-swept resonant LP, then compressed
// and limited for a brick-wall punch. Params: cutoff, rq, dist (drive), wfold, detune, fbk, squash.
SynthDef(\fd_hardstab, {|out=0, note=60, amp=0.8, sus=0.2, pan=0, attack=0.001, release=0.15,
                         cutoff=3000, rq=0.5, dist=3, wfold=0.3, detune=0.01, fbk=0.2, squash=6|
    var freq, sig, env, oscs, filtered, compressed;
    freq = note.midicps;
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -6), doneAction: 2);
    oscs = Mix.ar([
        LFSaw.ar(freq), LFSaw.ar(freq * (1 + detune)), LFSaw.ar(freq * (1 - detune)),
        LFSaw.ar(freq * 2) * 0.3, LFSaw.ar(freq * 2 * (1 + detune)) * 0.3
    ]) * 0.25;
    oscs = oscs + (LFPulse.ar(freq, width: 0.3).bipolar * 0.2);
    oscs = oscs + (SinOscFB.ar(freq, fbk * 2) * fbk * 0.3);
    sig = (oscs * dist).tanh;
    sig = sig + ((sig * wfold * 4).fold(-1, 1) * wfold * 0.3);
    filtered = RLPF.ar(sig, (cutoff * EnvGen.ar(Env.perc(0.001, sus * 0.5))).clip(50, 15000), rq.clip(0.1, 0.9));
    compressed = Compander.ar(filtered, filtered, 0.05, 1, 1 / squash, 0.0005, 0.02, squash);
    compressed = Limiter.ar(compressed, 0.9, 0.001);
    sig = compressed * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_hardstab done".postln;
