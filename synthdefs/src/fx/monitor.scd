// fd_monitor — hear the live input (audioin()) through the mix.
//
// SoundIn onto bus 0, so it passes the master FX and the limiter like any player,
// and a sample() of the mix records it too. Lives in the player group, so stop-all
// and panic free it along with everything else — a monitor that is feeding back is
// exactly the thing panic is for. gate fades it in and out rather than clicking.

SynthDef(\fd_monitor, {|amp=0.5, pan=0, gate=1|
    var sig, env;
    sig = SoundIn.ar([0, 1]);
    env = EnvGen.kr(Env.asr(0.05, 1, 0.15), gate, doneAction: 2);
    Out.ar(0, Balance2.ar(sig[0], sig[1], pan.clip(-1, 1)) * amp.clip(0, 2).lag(0.1) * env);
}).writeDefFile(~outDir);
"fd_monitor done".postln;
