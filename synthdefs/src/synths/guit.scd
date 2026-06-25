// guit — Plaits-engine guitar, ported from FoxDot guit (CrashServer).
// Uses MiPlaits (mi-UGens, same as our `plaits` synth). Adapted I/O:
// bus→out, freq from note.midicps, ReplaceOut→Out, env doneAction 0→2.
// Params: out, note, amp, sus, pan, attack, release, decay, detune, tone, beef, fdecay, mod, level, peak

SynthDef(\fd_guit, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.0001, release=0.01,
                      decay=0.01, peak=1, level=1, detune=0.01, tone=0.7, beef=0.7, fdecay=1, mod=0.2|
    var osc, env, freq;
    freq = note.midicps;
    env  = EnvGen.ar(Env([0, peak, level, level, 0],
        [attack, decay, max((attack + decay + release), sus - (attack + decay + release)), release],
        curve: \sin), doneAction: 2);
    osc  = MiPlaits.ar(freq.cpsmidi, engine: 11, harm: detune, timbre: tone, trigger: env,
                       morph: beef, fm_mod: mod, timb_mod: 1, morph_mod: 1, decay: sus * fdecay, lpg_colour: 1.0);
    osc  = osc * env;
    osc  = Mix.ar(osc[0] ! 2) * amp * 0.5;
    osc  = HPF.ar(osc, 40);
    Out.ar(out, Pan2.ar(osc, pan));
}).writeDefFile(~outDir);
"fd_guit done".postln;
