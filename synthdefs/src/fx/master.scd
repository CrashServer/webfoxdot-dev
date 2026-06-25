// fd_master — global master FX + safety limiter on the main output (bus 0).
//
// Runs at the TAIL of the node tree, reads the summed mix in place, applies a
// global FX set, then a brickwall Limiter so nothing hard-clips. Driven live
// from JS via Server.addFx(...) / Server.clearFx() / Master().attr = value
// (n_set on this node). All FX default to 0 = bypass.
SynthDef(\fd_master, {|gain=1, ceiling=0.95,
                       lpf=0, lpf_rq=0.7, hpf=0, hpf_rq=0.7,
                       mverb=0, echo=0, echo_time=0.25, echo_dec=0.5,
                       tanh=0, tanh_drive=2, lofi=0|
    var sig, wet;
    sig = In.ar(0, 2) * gain.clip(0, 4);

    wet = RLPF.ar(sig, (lpf > 0).if(lpf.clip(20, 20000), 20000), lpf_rq.clip(0.01, 1.0));
    sig = XFade2.ar(sig, wet, (lpf > 0) * 2 - 1);

    wet = RHPF.ar(sig, (hpf > 0).if(hpf.clip(20, 20000), 20), hpf_rq.clip(0.01, 1.0));
    sig = XFade2.ar(sig, wet, (hpf > 0) * 2 - 1);

    wet = (sig * tanh_drive.clip(0.001, 100)).tanh;
    sig = XFade2.ar(sig, wet, tanh * 2 - 1);

    // mverb — Schroeder allpass wash
    wet = sig;
    wet = AllpassN.ar(wet, 0.1, [0.047, 0.051], 2.5);
    wet = AllpassN.ar(wet, 0.1, [0.061, 0.068], 2.0);
    wet = AllpassN.ar(wet, 0.1, [0.031, 0.037], 2.0);
    sig = XFade2.ar(sig, wet, mverb.clip(0, 1) * 2 - 1);

    wet = sig + CombL.ar(sig, 2.0, echo_time.clip(0.001, 2.0), echo_dec.clip(0, 8));
    sig = XFade2.ar(sig, wet, echo.clip(0, 1) * 2 - 1);

    // lofi — gentle global saturation/glue
    wet = (sig * 1.5).tanh * 0.8;
    sig = XFade2.ar(sig, wet, lofi.clip(0, 1) * 2 - 1);

    sig = Limiter.ar(LeakDC.ar(sig), ceiling.clip(0.1, 1.0), 0.01);
    ReplaceOut.ar(0, sig);
}).writeDefFile(~outDir);
"fd_master done".postln;
