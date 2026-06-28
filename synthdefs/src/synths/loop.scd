// fd_loop — beat-synced audio-loop player (ported from FoxDot loop). Stereo
// PlayBuf; by default the buffer is time-stretched to fit `sus` seconds (one
// bar/step), so loops lock to the tempo. A fixed-length env carries doneAction:2
// so each step's node frees itself — no accumulating loop nodes.
//
// Params: out, buf, amp, pan, rate, sus(seconds), beat_stretch, looping, pos, fades
//   beat_stretch>0 : playRate = BufDur/sus * rate  (warp whole buffer into sus)
//   beat_stretch=0 : playRate = rate               (natural speed/pitch)

SynthDef(\fd_loop, {|out=0, buf=0, amp=1, pan=0, rate=1, sus=1, beat_stretch=1,
                      looping=0, pos=0, fades=0.01|
    var sig, env, playRate, stretchRate, stretchOn;
    stretchOn   = (beat_stretch > 0);
    stretchRate = (BufDur.kr(buf) / sus) * rate;
    playRate    = (rate * (1 - stretchOn)) + (stretchRate * stretchOn);
    sig = PlayBuf.ar(2, buf, BufRateScale.kr(buf) * playRate,
                     startPos: BufSampleRate.kr(buf) * pos, loop: looping);
    // Fixed-length amp env (≈ sus) frees the node even when looping=1.
    env = EnvGen.ar(Env.linen(fades, (sus - (2 * fades)).max(0.01), fades), doneAction: 2);
    sig = sig * env * amp;
    Out.ar(out, Splay.ar(sig, spread: 1, center: pan, levelComp: true));
}).writeDefFile(~outDir);
"fd_loop done".postln;
