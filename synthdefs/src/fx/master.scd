// fd_master — master safety limiter on the main output (bus 0).
//
// Runs at the TAIL of the node tree (after every player + FX chain has written
// to bus 0), so it sees the summed mix. A brickwall Limiter catches peaks so
// stacking loud players — or amp > 1 — no longer hard-clips into digital
// distortion. Transparent below the ceiling. (FoxDot uses a StageLimiter for
// the same job; StageLimiter is an sc3-plugin not in our WASM build, so this
// is the stock-UGen equivalent.)
SynthDef(\fd_master, {|gain=1, ceiling=0.95|
    var sig = In.ar(0, 2) * gain;
    sig = Limiter.ar(sig, ceiling, 0.01);
    sig = LeakDC.ar(sig);
    ReplaceOut.ar(0, sig);
}).writeDefFile(~outDir);
"fd_master done".postln;
