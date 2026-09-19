// fd_sampler — mono buffer playback for play() patterns
// Params: out, buf, amp, pan, rate
// doneAction:2 on PlayBuf — synth frees when buffer finishes

SynthDef(\fd_sampler, {|out=0, buf=0, amp=0.8, pan=0, rate=1, sus=0|
    var sig, env;
    sig = PlayBuf.ar(1, buf, rate * BufRateScale.kr(buf), doneAction: 2);
    // sus > 0 TRIMS the sample: hold for sus seconds, then a 10 ms fade — FoxDot's
    // cut (its trimLength effect is exactly this envelope). sus = 0, the default,
    // plays the whole buffer, as this always did.
    //
    // The hold is made enormous rather than switched off, because a UGen graph is
    // not conditional: an envelope with a zero hold would end at once, and with
    // doneAction 2 it would free every untrimmed sample on its first block.
    env = EnvGen.kr(Env([1, 1, 0], [Select.kr(sus > 0, [1e6, sus]), 0.01]), doneAction: 2);
    sig = sig * amp * env;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_sampler done".postln;
