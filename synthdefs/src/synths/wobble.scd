// wobble — dubstep wobble bass (CrashServer port). Detuned pulses + saws + a touch
// of noise driven into a Moog ladder filter whose cutoff is swept by an LFO (rate =
// wobbles/sec), for the classic talking bass. Params: out, note, amp, sus, pan,
// attack, release, rate (wobble speed), cutoff (LFO top), wphase (LFO shape rate).
// Uses MoogFF (core UGen). Edit then run: scripts/build.sh wobble
SynthDef(\fd_wobble, {|out=0, note=36, amp=0.8, sus=0.5, pan=0, attack=0.02, release=0.1,
                       rate=6, cutoff=8500, wphase=0.5|
    var freq = note.midicps, src, fco, osc, env;
    src = (Pulse.ar(freq * 0.98, mul: 0.5) + Pulse.ar(freq, mul: 0.5)
           + PinkNoise.ar(LFNoise0.ar(2).range(0, 1.0))
           + Saw.ar(freq, mul: 2) + Saw.ar(freq * 1.025, mul: 2)).clip2(0.5);
    fco = LFCub.kr(LFPulse.kr(wphase, 0.5, width: 0.25).range(0.1, rate)).exprange(60, cutoff.clip(200, 16000));
    osc = MoogFF.ar(src, fco, 2.6) * 0.2;
    osc = HPF.ar(osc, 40);
    env = EnvGen.ar(Env([0, 1, 0.85, 0.85, 0],
        [attack, 0.01, (sus - attack - release).max(0.01), release]), doneAction: 2);
    Out.ar(out, Pan2.ar(osc * env, pan) * amp);
}).writeDefFile(~outDir);
"fd_wobble done".postln;
