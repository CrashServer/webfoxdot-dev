// superbass — fat EBM supersaw bass (CrashServer port, audionerd-supersaw based): a center
// saw + 6 detuned side saws (JP-8000 detune curve driven by `spread`) plus a pulse sub,
// through an env-swept ladder (MoogFF, substituting the original VALadder). Params: cutoff,
// rq (0..3.9), sub, fdecay (filter env length ×sus), spread (0..1 detune amount).
SynthDef(\fd_superbass, {|out=0, note=60, amp=0.8, sus=1, pan=0, attack=0.01, release=0.05,
                          cutoff=5000, rq=0.5, sub=1, fdecay=4, spread=0.5|
    var freq, osc, env, detuneFactor, freqs, center, side, subOsc, filterEnv, curve;
    freq = note.midicps / 2;
    curve = spread.clip(0, 1);
    // JP-8000-style detune curve (audionerd) approximated
    detuneFactor = freq * ((0.2 * curve.squared) + (0.35 * curve) + 0.003);
    center = LFSaw.ar(freq, Rand());
    freqs = [-0.11002313, -0.06288439, -0.01952356, 0.01991221, 0.06216538, 0.10745242];
    side = Mix.fill(6, {|n| LFSaw.ar(freq + (detuneFactor * freqs[n]), Rand(0, 2)) });
    subOsc = LFPulse.ar(freq / 2, 0, mul: sub);
    osc = (center * 0.55) + (side * 0.45) + subOsc;
    osc = HPF.ar(osc, freq);
    filterEnv = EnvGen.ar(Env([1e-3, 1, 1e-3], [0.01, sus * fdecay], \exp), doneAction: 0);
    osc = MoogFF.ar(osc, (cutoff * filterEnv).clip(20, 18000), rq.clip(0, 3.9));
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -3), doneAction: 2);
    osc = LeakDC.ar(osc) * env * amp * 0.25;
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_superbass done".postln;
