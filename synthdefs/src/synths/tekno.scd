// tekno — acid-techno lead (CrashServer port): detuned analog-drift saws + PWM pulse
// pushed through a pre-filter multidrive (tanh + asymmetric clip) into a Moog ladder
// with an envelope-swept cutoff, then a sine wavefolder and console-saturation EQ.
// Params: cutoff, rq, grit (pre-drive), wfold (wavefolder), sub, sync (hard-sync blend).
SynthDef(\fd_tekno, {|out=0, note=60, amp=0.9, sus=1, pan=0, attack=0.003, release=0.02,
                      cutoff=800, rq=0.5, grit=0.5, wfold=0, sub=0.6, sync=0|
    var freq, osc, subOsc, subSq, main, syncOsc, pw, env, filt, filtenv, folded, sig;
    freq = note.midicps;
    // sub: sine fundamental + square one octave down
    subOsc = (SinOsc.ar(freq) * 1.15).tanh;
    subSq  = LPF.ar(Pulse.ar(freq * 0.5, 0.5, 0.5), 250);
    subOsc = LPF.ar((subOsc + subSq) * sub, 400);
    // main oscillators — detuned saws with analog drift
    osc  = LFSaw.ar(freq * (1 + (LFNoise2.kr(0.3) * 0.002)));
    main = LFSaw.ar(freq * (1.005 + (LFNoise2.kr(0.25) * 0.002)));
    syncOsc = SyncSaw.ar(freq, freq * (1 + sync));
    main = XFade2.ar(main, syncOsc, sync.clip(0, 2) - 1);
    pw = SinOsc.kr(0.7).range((0.5 * 0.6), 0.5);
    main = main + Pulse.ar(freq, pw, 0.35);
    main = (osc * 0.4) + (main * 0.6);
    // pre-filter multidrive
    main = (main * (1 + (grit * 3))).tanh;
    main = (main + (main.squared * grit * 0.3)).clip(-1.2, 0.9);
    // envelope-swept Moog ladder + tame LP
    filtenv = EnvGen.kr(Env.perc(0.001, 0.3, 1, -5));
    filt = (cutoff + (filtenv * 4000) + (freq * 0.6)).clip(30, 18000);
    main = MoogFF.ar(main, filt, rq.clip(0, 0.97) * 4);
    main = RLPF.ar(main, (filt * 1.5).clip(30, 18000), 0.7);
    // sine wavefolder
    folded = (main * (1 + (wfold * 6))).sin + ((main * (2 + (wfold * 4))).sin * 0.3);
    main = XFade2.ar(main, folded, (wfold.clip(0, 1) * 2) - 1);
    sig = subOsc + main;
    sig = (sig * 1.2).tanh;
    sig = HPF.ar(LeakDC.ar(sig), 25);
    sig = BLowShelf.ar(sig, 80, 0.7, 3);
    sig = BPeakEQ.ar(sig, 2800, 0.6, grit * 2.5);
    env = EnvGen.ar(Env.linen(attack, (sus - 0.008).max(0.005), release, 1, -3), doneAction: 2);
    sig = sig * env * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_tekno done".postln;
