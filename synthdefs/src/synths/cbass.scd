// cbass — CrashServer "compressed bass": dual saw + pulse + sub sine, tanh drive,
// frequency-tracking RLPF, and a compander glue. Adapted from FoxDot cbass.
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq, boost, detune, follow, vib
SynthDef(\fd_cbass, {|out=0, note=48, amp=0.9, sus=1, pan=0, attack=0.01, release=0.1,
                     cutoff=200, rq=0.9, boost=1.5, detune=0.01, follow=2, vib=0|
    var freq, osc1, osc2, subOsc, env, filt, mod, dist, oscSum, freqFollower, dynCut;
    freq = note.midicps;
    osc1 = Saw.ar(freq * [1 - detune, 1 + detune]);
    osc2 = Pulse.ar(freq * [0.5 - detune, 0.5 + detune], 0.13);
    subOsc = SinOsc.ar(freq * 0.25);
    subOsc = RHPF.ar(subOsc * 0.5, 40, 0.48);
    mod = SinOsc.kr(vib).range(0.9, 1.1);
    osc1 = osc1 * mod; osc2 = osc2 * mod; subOsc = subOsc * mod;
    oscSum = (osc1 + osc2 + subOsc) * 0.5;
    dist = tanh(oscSum * (1 + (boost * 5)));
    env = EnvGen.kr(Env.perc(attack.max(0.005), (sus * 1.2).max(0.02)), doneAction: 2);
    freqFollower = Lag.kr(freq, 0.1);
    dynCut = Lag.kr(cutoff + (freqFollower * follow), 0.1).clip(1, 20000);
    filt = RLPF.ar(dist, dynCut, rq.clip(0.05, 1.0));
    filt = Compander.ar(filt, filt, thresh: 0.2, slopeAbove: 0.5, slopeBelow: 1, clampTime: 0.01, relaxTime: 0.1);
    filt = Mix(filt) * env * amp * 0.5;
    filt = LeakDC.ar(filt);
    Out.ar(out, Pan2.ar(filt, pan));
}).writeDefFile(~outDir);
"fd_cbass done".postln;
