// piano — acoustic-ish piano from core UGens (the WASM build has no MdaPiano).
// 6 inharmonic partials (stretched tuning), each with its own decay so the highs
// die first like real strings; two slightly-detuned "strings" per partial give a
// gentle beating; a short filtered-noise hammer click sits on the attack; tone +
// velocity (amp) open a lowpass for brightness. Params: tone, hammer.
SynthDef(\fd_piano, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.001, release=0.4,
                      tone=0.5, hammer=0.5|
    var freq, dur, detune, partials, strike, sig, env;
    freq   = note.midicps;
    dur    = (sus + release).max(0.3);
    detune = [0.9988, 1.0012];                          // 2 strings → slow beating
    partials = Mix.fill(6, {|i|
        var p    = i + 1;
        var pf   = freq * p * (1 + (0.0009 * p * p));    // inharmonic stretch (sharp highs)
        var pamp = 1 / (p ** 1.25);                      // partial level falls with order
        var pdec = (dur / (1 + (p * 0.7))).max(0.04);    // higher partials decay faster
        var penv = EnvGen.kr(Env.perc(0.001, pdec, 1, -4));
        (SinOsc.ar(pf * detune[0]) + SinOsc.ar(pf * detune[1])) * 0.5 * pamp * penv
    });
    strike = BPF.ar(WhiteNoise.ar, (freq * 5).clip(200, 12000), 0.6)
             * EnvGen.kr(Env.perc(0.0005, 0.035)) * hammer * 0.4;   // hammer click
    sig = partials + strike;
    sig = LPF.ar(sig, (700 + (tone * 4000) + (amp * 4000)).clip(400, 16000));
    env = EnvGen.ar(Env.perc(attack.max(0.001), dur, 1, -3.5), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.5;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_piano done".postln;
