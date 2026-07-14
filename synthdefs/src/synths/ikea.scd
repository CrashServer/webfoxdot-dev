// ikea — CrashServer's generative glitch-percussion machine (ported + rebuilt).
// One note spawns a self-generating texture: an internal trigger engine drives a
// glitch layer, two sub sines, white-noise bursts, a swept bass, a snare and a
// resonant "melody". Play it long: `p1 >> ikea(dur=8, sus=8)`.
//
// Rebuilt for the scsynth-WASM build, which lacks several UGens the original used:
//   • Demand-rate triggers (TDuty/Dxrand/Dseq) → Dust random impulses;
//   • MiPlaits snare → a synthesised noise+tone snare;
//   • MiRings / CrossoverDistortion melody → a Ringz resonator bank + tanh.
// Also fixes the original's dead `amp` (it was computed but never applied) and adds
// musical controls. Defaults reproduce the original character.
//
// Params:
//   note amp sus pan  — the usual
//   density (0.1–8)   — generative trigger rate (1 = original; higher = denser)
//   glitch noise bass tone snare — per-layer levels (1 = present)
//   bright (0.3–2)    — glitch/noise brightness
//   hhat              — glitch decay time · harm (0–1) resonant melody
//   fmod              — detune of the 2nd voice · vib — sub-sine vibrato depth
SynthDef(\fd_ikea, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=1, sus=1, pan=0, attack=0.02, release=0.1,
                    fmod=0, vib=0, density=1, glitch=1, noise=1, bass=1, tone=1,
                    bright=1, hhat=0.1, snare=1, harm=0|
    var osc, env, osc1, osc2, osc3, osc4, osc5, osc6, trig, trigs, freq, trigMod, vibr, rpitch;
    trigMod = LFNoise0.ar(8).round;
    freq = note.midicps;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    freq = [freq, freq + fmod] * Line.ar(Rand(0.5, 1.5), 1, 0.02);
    freq = freq / 4;
    vibr = SinOsc.kr(6, 0, vib * 0.03, 1);                       // 1 when vib=0

    // ── Generative trigger engine — Dust random impulses (2 decorrelated channels),
    //   rate scaled by density, amplitude jittered 0.5–1 for an uneven, glitchy feel.
    trigs = Dust.ar([7, 9] * density.clip(0.1, 8)) * LFNoise1.ar([13, 17]).range(0.5, 1);
    trig  = trigs[0];

    // ── GLITCH — pink noise pinged by the triggers, extreme BPF amplification, folded
    osc1 = BPF.ar(
        PinkNoise.ar(Decay.ar(trigs, hhat * LFNoise1.ar(4).abs)),
        (15000 * bright).clip(200, 20000), 0.9,
        25 * LFNoise1.ar(8).range(0, 1)).fold(-1, 1) * glitch;

    // ── TWO SUB SINES (+ real vibrato) + a whisper of air
    osc2 = LPF.ar(
        SinOsc.ar(44.midicps * vibr, 0, 0.5) + SinOsc.ar(90.midicps * vibr, 0, 0.6),
        freq) + HPF.ar(LPF.ar(WhiteNoise.ar(0.008), 12000), 2400);

    // ── WHITE-NOISE bursts
    osc3 = BPF.ar(
        WhiteNoise.ar(Decay2.ar(trigs * LFNoise1.ar(8, 0.5, 0.5), 0.02, 0.1) * 0.05),
        (TRand.ar(12000, 15000, trigs) * bright).clip(200, 18000), 0.9) * noise;

    // ── SWEPT BASS
    osc4 = (SinOsc.ar(0, (Sweep.ar(trig * trigMod, 2pi * [52.8, 740]) + (pi/3)).wrap(-pi, pi), [2, 0.05]).mean.tanh *
        EnvGen.ar(Env([0, 0.5, 0.4, 0], [0, 0.2, 0.01], -5), (trig * trigMod).abs))!2 * bass;

    osc2 = Pan2.ar(
        osc2 * EnvGen.ar(Env([0, 1, 0.6, 0], [0.0001, 0.4, 0.01]), trigs * LFNoise0.ar(8)),
        TRand.ar(-1, 1, trigs)) * tone;

    // ── SNARE — noise + a tuned body, pinged by the triggers
    osc5 = (WhiteNoise.ar + SinOsc.ar(180, 0, 0.7)) * Decay2.ar(trig, 0.004, 0.11);
    osc5 = HPF.ar(osc5, 280) * snare * 0.6;

    // ── MELODIC RESONATOR — a Ringz bank, pitch sample-held on the triggers so it
    //   wanders melodically; tanh-shaped (replaces the original's MiRings + crossover).
    rpitch = (Latch.kr(SinOsc.kr(0.3).range(0.5, 2), trigs[1]) * note.midicps).clip(40, 7000);
    osc6 = Ringz.ar(osc5, rpitch, 0.5) + (Ringz.ar(osc5, rpitch * 1.5, 0.35) * 0.6);
    osc6 = (osc5 + osc6).tanh * harm;

    // ── SUM + master shaping
    osc = (osc1 + osc2 + osc3 + osc4 + osc5 + osc6);
    osc = Limiter.ar(MidEQ.ar(osc, 14000, 0.7, 0.8));
    env = EnvGen.ar(Env([0, 1, 0.8, 0.8, 0], [attack, 0.01, (sus/2).max(0.01), (sus/2).max(0.01)]), doneAction: 2);
    osc = osc * env;
    osc = HPF.ar(osc, 30);
    osc = Mix(osc) * 0.5 * amp;                                  // amp now actually applies
    osc = Pan2.ar(osc, pan);
    Out.ar(out, osc);
}).writeDefFile(~outDir);
