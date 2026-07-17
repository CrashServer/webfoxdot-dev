// a_xbass — aggressive rhythmic punk / math-rock bass (CrashServer port): a distorted
// multi-osc sub-bass (saw + pulse + sub, heavy tanh drive, resonant env-swept LPF, like
// a_gesa) with a BUILT-IN accent-gate groove selectable by rhythmType — 0 punk 8ths,
// 1 math 7/8, 2 poly 5/4, 3 gallop. Params: dist, cutoff, rq, rhythmType, accent (0..1
// groove depth). Timing rides beat_dur (passed by the engine).
SynthDef(\fd_a_xbass, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.01, release=0.05,
                        dist=8, cutoff=800, rq=0.7, rhythmType=0, accent=0.5, beat_dur=0.5|
    var freq, osc, env, drv, sig, rate, gate;
    freq = note.midicps / 4;                            // sub-bass range
    osc = Mix([
        VarSaw.ar(freq, width: LFNoise1.kr(2).range(0.1, 0.9), mul: 0.6),
        Pulse.ar(freq * 0.5, width: LFTri.kr(0.3).range(0.2, 0.8), mul: 0.4),
        SinOsc.ar(freq * 2, mul: 0.2)                   // harmonic for punch
    ]);
    rate = beat_dur.max(0.05).reciprocal;               // beats per second
    gate = Select.kr(rhythmType.clip(0, 3).round, [
        Demand.kr(Impulse.kr(rate * 2),   0, Dseq([1, 0.6, 0.8, 1, 0.7, 1, 0.6, 0.9], inf)),   // punk 8ths
        Demand.kr(Impulse.kr(rate * 2),   0, Dseq([1, 0.5, 0.8, 0.3, 1, 0.6, 0.4], inf)),       // math 7/8
        Demand.kr(Impulse.kr(rate * 1.6), 0, Dseq([1, 0.4, 0.7, 0.6, 0.9, 0.3, 0.8, 0.5], inf)),// poly 5/4
        Demand.kr(Impulse.kr(rate * 3),   0, Dseq([1, 0.3, 0.3, 1, 0.3, 0.3], inf))             // gallop
    ]);
    gate = (gate * accent.clip(0, 1)) + (1 - accent.clip(0, 1));   // accent depth
    env = EnvGen.ar(Env([0, 1, 0.9, 0.7, 0],
        [attack, 0.05, (sus * 0.3).max(0.001), (sus * 0.7 + release).max(0.001)]), doneAction: 2);
    drv = (osc * dist.max(0.5)).tanh * 0.7;
    sig = RLPF.ar(drv, (cutoff * (1 + (LFNoise1.kr(2) * 0.3)) * env.pow(0.5)).clip(40, 18000), rq.clip(0.05, 1.0));
    sig = (sig * 1.5).softclip * env * gate * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_a_xbass done".postln;
