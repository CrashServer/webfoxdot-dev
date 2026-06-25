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
     fbdelay=0, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, beat_dur=0.5,
     shape=0, dist2=0, dist2shape=1, chop=0,
     multicrush=0, mclowdrive=2, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500,
     vibrato=0, vib_rate=5, vib_depth=0.008,
     ringmod=0, ringmod_freq=200, flanger=0, flanger_rate=0.5, flanger_depth=0.004,
     phaser=0, phaser_rate=0.5, formant=0, formant_vowel=0,
     octclean=0, ocsub=0.5, ocup=0.3,
     fold=0, symetry=1,
     csweep=0, cswfreq=200, cswdepth=0.3, cswrate=0.5, cswdecay=0.5,
     eb=0.5, ebfeed=0.5, ebmix=0, ebmode=0, ebwow=0.1, ebflutter=0.15, ebsat=0.3,
     tube=0, tubegain=1.5, tubewarm=0.6, tubebias=0.1,
     drcomp=0,
     lofi=0, lofiwow=0.5, lofiamp=0.5|

    var sig, wet, dry, fbDelTime, fb, fbL, fbR, mcLow, mcMid, mcHigh, vibT,
        flT, phWet, phMod, ff1, ff2, ff3,
        ocSub, ocUp, foldGain, cswDel, cswLfo,
        ebWow, ebFlut, ebDelT, sat, harm, loR, loT, loG, loRate, loDepth, loMul;
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

    // ── shape — sine wavefolder distortion (drive scales with shape) ──────
    wet = (sig * (shape * 20 + 1)).fold2(1).distort * 0.6;
    sig = XFade2.ar(sig, wet, shape.clip(0, 1) * 2 - 1);

    // ── dist2 — fold + tanh saturation with a tilt ────────────────────────
    wet = Fold.ar(sig, dist2shape.clip(0.05, 1).neg, dist2shape.clip(0.05, 1));
    wet = (wet * (dist2 * 8 + 1)).tanh;
    wet = LPF.ar(wet, 9000);
    sig = XFade2.ar(sig, wet, dist2.clip(0, 1) * 2 - 1);

    // ── multicrush — 3-band drive (low softclip / mid fold / high tanh) ───
    mcLow  = (LPF.ar(sig, mclofreq) * mclowdrive).softclip;
    mcMid  = HPF.ar(LPF.ar(sig, mchifreq), mclofreq) * mcmiddrive;
    mcMid  = (mcMid + (mcMid.cubed * 0.2)).fold(-0.9, 0.9);
    mcHigh = LPF.ar((HPF.ar(sig, mchifreq) * mchighdrive).tanh, 12000);
    wet    = Limiter.ar(LeakDC.ar(mcLow + mcMid + mcHigh) * 0.7, 0.95, 0.001);
    sig    = XFade2.ar(sig, wet, multicrush.clip(0, 1) * 2 - 1);

    // ── chop — rhythmic gate, `chop` slices per beat (uses beat_dur) ──────
    wet = sig * LFPulse.kr((chop / beat_dur).clip(0.1, 200), 0, 0.5).range(0.02, 1);
    sig = XFade2.ar(sig, wet, (chop > 0) * 2 - 1);

    // ── vibrato — pitch wobble via an LFO-modulated delay line ────────────
    vibT = (0.02 + (SinOsc.kr(vib_rate.clip(0.1, 14)) * vib_depth.clip(0, 0.02))).clip(0.001, 0.05);
    wet  = DelayC.ar(sig, 0.05, vibT);
    sig  = XFade2.ar(sig, wet, vibrato.clip(0, 1) * 2 - 1);

    // ── ringmod — multiply by a sine carrier ──────────────────────────────
    wet = sig * SinOsc.ar(ringmod_freq.clip(1, 8000));
    sig = XFade2.ar(sig, wet, ringmod.clip(0, 1) * 2 - 1);

    // ── flanger — short feedback comb, LFO-swept delay ────────────────────
    flT = (0.001 + SinOsc.kr(flanger_rate.clip(0.01, 10)).range(0, flanger_depth.clip(0, 0.01))).clip(0.0002, 0.02);
    wet = sig + (CombC.ar(sig, 0.02, flT, 0.2) * 0.7);
    sig = XFade2.ar(sig, wet, flanger.clip(0, 1) * 2 - 1);

    // ── phaser — cascaded LFO-modulated allpass micro-delays ──────────────
    phMod = SinOsc.kr(phaser_rate.clip(0.01, 10)).range(0.0001, 0.0009);
    phWet = sig;
    6.do { phWet = AllpassC.ar(phWet, 0.001, phMod, 0); };
    sig = XFade2.ar(sig, sig + phWet, phaser.clip(0, 1) * 2 - 1);

    // ── formant — vowel band-pass bank (vowel 0/1/2 = ah/eh/oh) ───────────
    ff1 = Select.kr(formant_vowel.clip(0, 2), [730, 530, 570]);
    ff2 = Select.kr(formant_vowel.clip(0, 2), [1090, 1840, 840]);
    ff3 = Select.kr(formant_vowel.clip(0, 2), [2440, 2480, 2410]);
    wet = BPF.ar(sig, ff1, 0.1, 3) + BPF.ar(sig, ff2, 0.1, 2) + BPF.ar(sig, ff3, 0.12, 1.5);
    sig = XFade2.ar(sig, wet, formant.clip(0, 1) * 2 - 1);

    // ── octclean — clean octaver: PitchShift sub (-1oct) + up (+1oct) ─────
    ocSub = PitchShift.ar(sig, 0.1,  0.5, 0, 0.004);
    ocUp  = PitchShift.ar(sig, 0.05, 2.0, 0, 0.004);
    wet   = sig + (ocSub * ocsub.clip(0, 1)) + (ocUp * ocup.clip(0, 1));
    sig   = XFade2.ar(sig, LeakDC.ar(wet), octclean.clip(0, 1) * 2 - 1);

    // ── fold — wavefolder (built-in fold2 ~ CrashServer SmoothFoldS) ──────
    foldGain = LinLin.kr(fold.clip(0, 1), 0, 1, 1, 20);
    wet = ((sig + LinLin.kr(symetry.clip(0, 1), 0, 1, 1, 0)) * foldGain).fold2(1);
    wet = LeakDC.ar(wet * max(foldGain * 0.75, 1).reciprocal);
    sig = XFade2.ar(sig, wet, fold.clip(0, 1) * 2 - 1);

    // ── csweep — resonant comb sweep (moving metallic resonance) ──────────
    cswDel = cswfreq.clip(20, 8000).reciprocal;
    cswLfo = SinOsc.kr(cswrate.clip(0.01, 20)).range(1 - cswdepth, 1 + cswdepth);
    wet = CombC.ar(sig, 0.05, (cswDel * cswLfo).clip(0.00005, 0.05), cswdecay.clip(0, 4));
    sig = XFade2.ar(sig, LeakDC.ar(wet), csweep.clip(0, 1) * 2 - 1);

    // ── eb — tape-style echo (Roland EchoBoy-ish). CombC feedback (the chain's
    //    one LocalIn is taken by fbdelay), wow/flutter modulated, tone + sat.
    //    ebmix = wet level (0=off) · ebmode 0/1/2 = digital/analog/tape ──────
    ebWow  = SinOsc.kr(0.5 + (0.3 * LFNoise1.kr(0.2)), 0, ebwow * 0.003);
    ebFlut = LFNoise1.kr(10 + (20 * LFNoise1.kr(0.5)), ebflutter * 0.002);
    ebDelT = (eb.clip(0.001, 2) * (1 + ebWow + ebFlut)).clip(0.0001, 2);
    wet    = CombC.ar(sig, 2.0, ebDelT, eb.clip(0.001, 2) * (1 + (ebfeed.clip(0, 0.95) * 24)));
    wet    = LPF.ar(HPF.ar(wet, 100), 8000);
    wet    = Select.ar(ebmode.clip(0, 2), [wet, (wet * (1 + (ebsat * 2))).tanh * 0.7, (wet * (1 + (ebsat * 4))).distort * 0.5]);
    sig    = HPF.ar((sig * (1 - ebmix.clip(0, 1))) + (wet * ebmix.clip(0, 1)), 40);

    // ── tube — tube-style saturation: even harmonics + warmth ─────────────
    dry  = sig;
    sat  = Compander.ar(sig, sig, 0.3, 1, 0.5, 0.001, 0.06, 1.3) + (tubebias * 0.15);
    sat  = sat * tubegain * 1.8;
    sat  = sat - (sat.cubed * 0.25);
    harm = (sig.squared * tubewarm * 0.4).softclip + (sig.cubed * tubewarm * 0.15);
    sat  = (sat + harm).softclip;
    sat  = LeakDC.ar(sat);
    sat  = BLowShelf.ar(LPF.ar(sat, 9000), 150, 0.7, tubewarm * 2);
    sat  = BPeakEQ.ar(sat, 2500, 0.6, tubewarm * 1.5);
    sat  = Compander.ar(sat, sat, 0.35, 1, 0.6, 0.003, 0.06, 1.3);
    sig  = XFade2.ar(dry, sat * 0.8, tube.clip(0, 1) * 2 - 1);

    // ── drcomp — drum bus compressor + shelves (techno glue) ──────────────
    wet = Compander.ar(sig, sig, 0.1, 1, 0.1, 0.002, 0.05, 3);
    wet = BHiShelf.ar(BLowShelf.ar(wet, 200, 1, 2), 6000, 1, 3);
    sig = XFade2.ar(sig, wet * 0.7, drcomp.clip(0, 1) * 2 - 1);

    // ── lofi — degrade: compress + tape wow + soft sat + band-limit ───────
    loR    = LinExp.kr(lofiamp.clip(0, 1), 0, 1, 0.15, 0.01);
    loT    = LinLin.kr(lofiamp.clip(0, 1), 0, 1, 0.8, 0.33);
    loG    = 1 / (((1.0 - loT) * loR) + loT);
    wet    = Limiter.ar(Compander.ar(sig, sig, loT, 1.0, loR, 0.1, 1, loG), 1, 0.0008);
    loRate = LinExp.kr(lofiwow.clip(0, 1), 0, 1, 0.5, 4);
    loDepth = LinExp.kr(lofiwow.clip(0, 1), 0, 1, 1, 30);
    loMul  = ((2 ** (loDepth / 1200)) - 1) / (4 * loRate);
    wet    = DelayC.ar(wet, 0.05, SinOsc.ar(loRate, 2, loMul, loMul + 0.001));
    wet    = (wet * 1.5).tanh;
    wet    = HPF.ar(LPF.ar(wet, 5000), 60);
    sig    = XFade2.ar(sig, wet, lofi.clip(0, 1) * 2 - 1);

    Out.ar(out, sig);
}).writeDefFile(~outDir);
"fd_fx_chain done".postln;
