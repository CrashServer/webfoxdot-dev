// pumpbass — pumping filter bass (crashDot original; FoxDot has no pumpbass source).
// Saw+pulse+sub through a growl-driven resonant LPF, optional noise + fuzz + highpass,
// and a per-note sidechain-style amp duck ("pump"). Params: out, note, amp, sus, pan,
// attack, release, cutoff, res, sub, body, growl, fuzz, fuzzgain, noiz, noizr, noizt,
// locut, pump.  (locut = high-pass roll-off, renamed from hpr so hpr can alias hpf_rq)
SynthDef(\fd_pumpbass, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.005, release=0.06,
                         cutoff=800, res=0.4, sub=0.3, body=4, growl=0.2,
                         fuzz=0, fuzzgain=1.5, noiz=0, noizr=1, noizt=0.5, locut=0, pump=1|
    var freq, osc, subosc, noise, env, pumpenv, sig, q;
    freq = note.midicps / 2;
    q = (1 - res).clip(0.05, 1.0);
    osc = Mix([
        VarSaw.ar(freq, width: LFTri.kr(0.3).range(0.2, 0.8), mul: 0.5),
        Pulse.ar(freq, width: 0.5, mul: 0.3)
    ]);
    subosc = SinOsc.ar(freq * 0.5, mul: sub);
    noise  = BPF.ar(WhiteNoise.ar, (freq * 4 * noizr).clip(80, 12000), 0.5, mul: noiz * noizt);
    osc = osc + subosc + noise;
    osc = (osc * (1 + (growl * 4))).tanh;                                 // growl drive
    osc = RLPF.ar(osc, (cutoff * (1 + body.linlin(0, 16, 0, 1.5))).clip(40, 18000), q);
    osc = XFade2.ar(osc, (osc * (1 + (fuzzgain * 4))).tanh, (fuzz.clip(0, 1) * 2 - 1));  // fuzz
    osc = HPF.ar(osc, (20 + (locut.clip(0, 1) * 400)));
    env = EnvGen.ar(Env.perc(attack, (sus + release).max(0.02), 1, -2), doneAction: 2);
    pumpenv = 1 - (EnvGen.kr(Env.perc(0.001, 0.3)) * 0.6 * pump.clip(0, 1));  // per-note duck
    sig = osc * env * pumpenv * amp * 0.4;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_pumpbass done".postln;
