// supersaw — a fat detuned saw stack (CrashServer port). Seven sawtooths spread
// around the note by a slow random detune, summed and low-passed — a lush trance/
// rave lead or pad. Params: out, note, amp, sus, pan, attack, release, cutoff, rq.
// Edit then run: scripts/build.sh supersaw
SynthDef(\fd_supersaw, {|out=0, note=60, slide=0, slidefrom=1, slidedelay=1, amp=0.6, sus=1, pan=0, attack=0.01, release=0.05,
                         cutoff=2000, rq=0.7|
    var freq = note.midicps, detuned, osc, env;
    freq = Line.kr(freq * slidefrom, freq * (1 + slide), (sus * slidedelay).max(0.001));   // .slider() glissando
    detuned = ({ freq * LFNoise2.kr(0.5).range(0.985, 1.015) } ! 7);
    osc = Mix(LFSaw.ar(detuned)) * (1 / 7);
    env = EnvGen.ar(Env([0, 1, 0.85, 0.85, 0],
        [attack, 0.02, (sus - attack - 0.02 - release).max(0.01), release], curve: \sin), doneAction: 2);
    osc = RLPF.ar(osc, cutoff.clip(40, 18000), rq.clip(0.05, 1.0));
    Out.ar(out, Pan2.ar(osc * env, pan) * amp);
}).writeDefFile(~outDir);
"fd_supersaw done".postln;
