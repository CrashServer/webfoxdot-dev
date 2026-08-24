// spiceseq — the signature Berlin-School sequencer voice (Tangerine Dream /
// Jarre / Picq). A detuned saw pair + pulse + sub through a resonant MoogFF
// ladder with a SNAPPY per-note filter envelope, so every 16th-note "pings" and
// the resonance sings. Play it as fast arps with echo/pong for the classic
// pulsing desert-sequence. `accent` opens the filter + boosts resonance for the
// step you hit it on. Params: cutoff, rq (0-3.7), fdec (filter decay), fenv
// (env depth), detune, sub, accent, drift
SynthDef(\fd_spiceseq, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.004, release=0.06,
                         cutoff=700, rq=2.6, fdec=0.18, fenv=4, detune=0.005, sub=0.3,
                         accent=0, drift=0.2|
    var freq, saws, subOsc, sig, filtEnv, cf, env, driftMod;
    freq = note.midicps;
    driftMod = LFNoise2.kr(0.3).range(1 - (drift * 0.006), 1 + (drift * 0.006));
    freq = freq * driftMod;
    saws = Mix([Saw.ar(freq * (1 - detune)), Saw.ar(freq * (1 + detune)), Pulse.ar(freq, 0.45)]) * 0.3;
    subOsc = Pulse.ar(freq * 0.5, 0.5) * sub;
    sig = saws + subOsc;
    filtEnv = EnvGen.kr(Env.perc(0.001, fdec.max(0.02), 1, -4));
    cf = (cutoff + (filtEnv * cutoff * fenv * (1 + accent))).clip(40, 16000);
    sig = MoogFF.ar(sig, cf, (rq + (accent * 0.8)).clip(0, 3.7));
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.05), 1, -3), doneAction: 2);
    sig = sig * env * amp * (1 + (accent * 0.3)) * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_spiceseq done".postln;
