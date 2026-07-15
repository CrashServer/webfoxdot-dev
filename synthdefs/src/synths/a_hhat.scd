// a_hhat — French-electro metallic hi-hat (CrashServer port). Pitchless: degree is
// ignored, it's noise + ring-modulated metallic tones. Params: out, note, amp, sus,
// pan, attack, release, tone, decay, metallic, dist, open.
SynthDef(\fd_a_hhat, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.001, release=0.05,
                       tone=8000, decay=0.1, metallic=1, dist=2, open=0|
    var env, noise, metal, hat, drv;
    env = EnvGen.ar(Env([0, 1, 0.3, 0], [0.001, 0.01, (decay + (open * 0.3)).max(0.005)]), doneAction: 2);
    noise = Mix([
        BPF.ar(WhiteNoise.ar, tone.clip(200, 18000), 0.3, mul: env),
        BPF.ar(WhiteNoise.ar, (tone * 1.5).clip(200, 19000), 0.2, mul: env * 0.7),
        HPF.ar(WhiteNoise.ar, (tone * 0.7).clip(200, 18000), mul: env * 0.8)
    ]);
    metal = Mix([
        SinOsc.ar(tone * 0.8) * SinOsc.ar(tone * 1.1) * env * metallic * 0.4,
        SinOsc.ar(tone * 1.3) * SinOsc.ar(tone * 0.6) * env * metallic * 0.3,
        SinOsc.ar(tone * 2.1) * env * metallic * 0.2
    ]);
    hat  = (noise + metal) * 0.7;
    drv = (hat * dist).tanh * 0.9;
    drv = BPeakEQ.ar(drv, tone.clip(200, 18000), 0.5, 2);
    drv = HPF.ar(drv, 4000);
    hat  = (drv * 1.3).softclip * amp * 0.5;
    Out.ar(out, Pan2.ar(hat, pan));
}).writeDefFile(~outDir);
"fd_a_hhat done".postln;
