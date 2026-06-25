// fd_fx_chain — per-player FX processor
//
// One running instance per active player. Reads from that player's private
// audio bus, applies effects in order, writes to main output (bus 0).
//
// ── How to add a new effect ─────────────────────────────────────────────
//  1. Add its params to the |arg list| with defaults
//  2. Add a section below (compute wet, XFade2 with mix * 2 - 1)
//  3. Add the param mapping to js/fx/registry.js
//  4. Run scripts/build.sh, reload browser
//
// ── XFade2 mix convention ────────────────────────────────────────────────
//  XFade2.ar(dry, wet, mix * 2 - 1)
//    mix=0  → -1 → all dry (effect off)
//    mix=0.5 →  0 → 50/50
//    mix=1  → +1 → all wet
//
// After editing: run   scripts/build.sh

SynthDef(\fd_fx_chain, {
    |out=0, in_bus=64,
     lpf=0, lpf_rq=0.7,
     hpf=0, hpf_rq=0.7,
     crush=0, crush_bits=8, crush_rate=44100,
     resonbank=0, rbfreq=60, rbdecay=0.5, rbspread=1,
     rgate=0, rgaterate=4, rgatewave=0,
     reverb=0, rev_room=0.6, rev_damp=0.5,
     mverb=0, mverbmix=0.5, mverbdamp=0.5, mverbdiff=0.5, mverbfreeze=0,
     cheapverb=0, cvdecay=1.5, cvdamp=0.5,
     chorus=0, chorus_rate=0.6, chorus_depth=0.004,
     tremolo=0, trem_rate=4, trem_depth=0.6,
     tanh=0, tanh_drive=2,
     echo=0, echo_time=0.25, echo_dec=0.5,
     fbdelay=0, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, beat_dur=0.5|

    var sig, wet, fbDelTime, fb, fbL, fbR;
    sig = In.ar(in_bus, 2);

    // ── Low-pass filter — lpf = cutoff Hz (0 = bypass) ──────────────────
    wet = RLPF.ar(sig, (lpf > 0).if(lpf.clip(20, 20000), 20000), lpf_rq.clip(0.01, 1.0));
    sig = XFade2.ar(sig, wet, (lpf > 0) * 2 - 1);

    // ── High-pass filter — hpf = cutoff Hz (0 = bypass) ─────────────────
    wet = RHPF.ar(sig, (hpf > 0).if(hpf.clip(20, 20000), 20), hpf_rq.clip(0.01, 1.0));
    sig = XFade2.ar(sig, wet, (hpf > 0) * 2 - 1);

    // ── Bitcrush — bit-depth quantize + sample-rate decimate ─────────────
    //   crush_bits: quantization levels (lower = grittier, e.g. 4)
    //   crush_rate: downsample target in Hz (lower = more aliasing, e.g. 4000)
    wet = Latch.ar(sig, Impulse.ar(crush_rate.clip(500, 44100)));
    wet = (wet * crush_bits.clip(1, 256)).round / crush_bits.clip(1, 256);
    sig = XFade2.ar(sig, wet, crush * 2 - 1);

    // ── Resonator bank — rbfreq = MIDI note, rbdecay = ring time, rbspread = detune
    wet = Ringz.ar(sig,
            [rbfreq.midicps, rbfreq.midicps * (1 + (rbspread * 0.01))].clip(20, 18000),
            rbdecay.clip(0.01, 4)) * 0.25;
    sig = XFade2.ar(sig, wet, resonbank * 2 - 1);

    // ── Rhythmic gate — rgaterate cycles/sec, rgatewave 0 = pulse, 1 = sine ──
    wet = sig * Select.kr(rgatewave.clip(0, 1).round, [
            LFPulse.kr(rgaterate.clip(0.1, 50), 0, 0.5),
            SinOsc.kr(rgaterate.clip(0.1, 50)).range(0, 1) ]);
    sig = XFade2.ar(sig, wet, rgate * 2 - 1);

    // ── mverb — denser reverb (mverbmix internal wet, damp, diffusion, freeze) ─
    wet = sig;
    wet = AllpassN.ar(wet, 0.08, [0.041, 0.047], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = AllpassN.ar(wet, 0.08, [0.053, 0.061], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = AllpassN.ar(wet, 0.08, [0.067, 0.073], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = LPF.ar(wet, ((1 - mverbdamp.clip(0,1)) * 8000) + 800);
    wet = XFade2.ar(sig, wet, mverbmix * 2 - 1);
    sig = XFade2.ar(sig, wet, mverb * 2 - 1);

    // ── cheapverb — short comb reverb (cvdecay, cvdamp) ──────────────────────
    wet = CombL.ar(sig, 0.1, [0.0297, 0.0371], cvdecay.clip(0.05, 6));
    wet = LPF.ar(wet, ((1 - cvdamp.clip(0,1)) * 8000) + 500) * 0.5;
    sig = XFade2.ar(sig, wet, cheapverb * 2 - 1);

    // ── Chorus — modulated stereo delay (depth seconds, rate Hz) ─────────────
    wet = sig + DelayC.ar(sig, 0.05,
            (SinOsc.kr([chorus_rate, chorus_rate * 1.3], [0, 1]) * chorus_depth.clip(0.0002, 0.02))
            + chorus_depth.clip(0.0002, 0.02) + 0.001);
    wet = wet * 0.5;
    sig = XFade2.ar(sig, wet, chorus * 2 - 1);

    // ── Tremolo — smooth amplitude LFO (rate Hz, depth 0-1) ──────────────────
    wet = sig * SinOsc.kr(trem_rate.clip(0.1, 40)).range(1 - trem_depth.clip(0, 1), 1);
    sig = XFade2.ar(sig, wet, tremolo * 2 - 1);

    // ── Tanh saturation ──────────────────────────────────────────────────
    wet = (sig * tanh_drive.clip(0.001, 100)).tanh;
    sig = XFade2.ar(sig, wet, tanh * 2 - 1);

    // ── Reverb (Schroeder allpass — avoids FreeVerb2 plugin dependency) ─────
    wet = sig;
    wet = AllpassN.ar(wet, 0.05, [0.047, 0.051], 0.5 + rev_room * 3);
    wet = AllpassN.ar(wet, 0.1,  [0.061, 0.068], 0.5 + rev_room * 2);
    wet = AllpassN.ar(wet, 0.1,  [0.031, 0.037], 0.5 + rev_room * 2);
    wet = wet * (1 - rev_damp * 0.6);
    sig = XFade2.ar(sig, wet, reverb * 2 - 1);

    // ── Echo (CombL delay) ────────────────────────────────────────────────
    wet = sig + CombL.ar(sig, 2.0, echo_time.clip(0.001, 2.0), echo_dec.clip(0, 8));
    sig = XFade2.ar(sig, wet, echo * 2 - 1);

    // ── Feedback delay (stereo ping, filtered feedback) ───────────────────
    // delay time = fbtime * beat_dur (set beat_dur = 60/bpm for tempo-lock).
    fbDelTime = (fbtime * beat_dur).clip(0.001, 2);
    fb = LocalIn.ar(2) * fbfeed.clip(0, 0.98);
    fb = HPF.ar(fb, 80);
    fb = LPF.ar(fb, fbcutoff.clip(80, 18000));
    fb = (fb * 1.1).softclip;
    fbL = DelayC.ar(sig[0] + fb[1], 2, fbDelTime);
    fbR = DelayC.ar(sig[1] + fb[0], 2, (fbDelTime * (1 + fbspread)).clip(0.001, 2));
    LocalOut.ar([fbL, fbR]);
    wet = sig + ([fbL, fbR] * 0.7);
    sig = XFade2.ar(sig, wet, fbdelay * 2 - 1);

    Out.ar(out, sig);
}).writeDefFile(~outDir);
"fd_fx_chain done".postln;
