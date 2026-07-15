// darkpad — a dark, detuned six-saw pad with a sub sine and a soft-clipped, dark-
// tilted double low-pass. Lush atmosphere for techno / ambient. (CrashServer port.)
// Params: out, note, amp, sus, pan, attack, release, cutoff, rq, dist, detune, dark, sub.
// Edit then run: scripts/build.sh darkpad
SynthDef(\fd_darkpad, {|out=0, note=60, amp=0.9, sus=4, pan=0, attack=0.3, release=1,
                       cutoff=1200, rq=0.25, dist=1.2, detune=0.008, dark=0.5, sub=0.4|
    var freq = note.midicps.clip(20, 10000), sig, env, subOsc, filtered, final;
    env = EnvGen.ar(Env([0, 1, 1, 0],
        [attack, (sus - attack - release).max(0.05), release], [-4, 0, -4]), doneAction: 2);
    sig = (LFSaw.ar(freq)
         + LFSaw.ar(freq * (1 + detune))
         + LFSaw.ar(freq * (1 - detune))
         + (LFSaw.ar(freq * (1 + (detune * 2))) * 0.5)
         + (LFSaw.ar(freq * (1 - (detune * 2))) * 0.5)
         + (LFTri.ar(freq) * 0.4)) * 0.12;
    subOsc = SinOsc.ar(freq * 0.5) * sub;
    sig = sig + subOsc;
    filtered = RLPF.ar(sig, (cutoff * (1.5 - dark).clip(0.2, 1.5)).clip(100, 8000), rq.clip(0.1, 0.7));
    filtered = LPF.ar(filtered, (cutoff * (2 - dark).clip(0.5, 2)).clip(200, 12000));
    filtered = (filtered * dist).softclip;
    final = filtered * env * 0.5;
    Out.ar(out, Pan2.ar(final, pan) * amp);
}).writeDefFile(~outDir);
"fd_darkpad done".postln;
