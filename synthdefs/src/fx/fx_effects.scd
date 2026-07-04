// fd_fx_* — per-effect FX nodes (one SynthDef per effect, on-demand).
//
// Replaces the monolithic fd_fx_chain. Each effect reads the player's private
// bus, processes IN-PLACE (ReplaceOut to the same bus), so a series of these
// nodes in canonical order == the old chain. FXChain (js/fx/chain.js) creates a
// node only for effects the player actually uses, so absent effects cost zero
// CPU (the whole point — the old def computed all 32 every block).
//
// Convention (same as the old chain): sig = In.ar(in_bus,2); wet = <dsp>;
//   ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, gate*2-1))   (gate 0=dry, 1=wet)
// A few (eb/feed) keep their original non-XFade blend.
//
// fd_fx_out is the permanent tail node: copies the bus to the main output.
//
// After editing: run  scripts/build.sh fx_effects

// ── tail router: private bus → main out ──────────────────────────────────────
SynthDef(\fd_fx_out, {|out=0, in_bus=64|
    Out.ar(out, In.ar(in_bus, 2));
}).writeDefFile(~outDir);

// ── lpf — low-pass (cutoff Hz, 0 = bypass) ──────────────────────────────────
SynthDef(\fd_fx_lpf, {|in_bus=64, lpf=0, lpf_rq=0.7|
    var sig = In.ar(in_bus, 2), wet;
    wet = RLPF.ar(sig, (lpf > 0).if(lpf.clip(20, 20000), 20000), lpf_rq.clip(0.01, 1.0));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (lpf > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── hpf — high-pass ─────────────────────────────────────────────────────────
SynthDef(\fd_fx_hpf, {|in_bus=64, hpf=0, hpf_rq=0.7|
    var sig = In.ar(in_bus, 2), wet;
    wet = RHPF.ar(sig, (hpf > 0).if(hpf.clip(20, 20000), 20), hpf_rq.clip(0.01, 1.0));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (hpf > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── djf — DJ isolator filter (CrashServer port) ─────────────────────────────
// One knob: 0.5 = flat, <0.5 sweeps a lowpass down, >0.5 sweeps a highpass up.
SynthDef(\fd_fx_djf, {|in_bus=64, djf=0.5, djfq=0.3|
    var sig = In.ar(in_bus, 2), lpf, hpf, q = djfq.clip(0.02, 1.0);
    lpf = djf.linexp(0, 0.5, 50, 15000).clip(50, 15000);
    hpf = djf.linexp(0.5, 1, 50, 15000).clip(50, 15000);
    sig = RHPF.ar(RLPF.ar(sig, lpf, q), hpf, q);
    ReplaceOut.ar(in_bus, sig);
}).writeDefFile(~outDir);

// ── crush — bitcrush + decimate ─────────────────────────────────────────────
SynthDef(\fd_fx_crush, {|in_bus=64, crush=0, crush_bits=8, crush_rate=44100|
    var sig = In.ar(in_bus, 2), wet;
    wet = Latch.ar(sig, Impulse.ar(crush_rate.clip(500, 44100)));
    wet = (wet * crush_bits.clip(1, 256)).round / crush_bits.clip(1, 256);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, crush * 2 - 1));
}).writeDefFile(~outDir);

// ── resonbank — Ringz resonator ─────────────────────────────────────────────
SynthDef(\fd_fx_resonbank, {|in_bus=64, resonbank=0, rbfreq=60, rbdecay=0.5, rbspread=1|
    var sig = In.ar(in_bus, 2), wet;
    wet = Ringz.ar(sig,
            [rbfreq.midicps, rbfreq.midicps * (1 + (rbspread * 0.01))].clip(20, 18000),
            rbdecay.clip(0.01, 4)) * 0.25;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, resonbank * 2 - 1));
}).writeDefFile(~outDir);

// ── rgate — rhythmic gate (FoxDot/CrashServer `chop` port) ───────────────────
// rgaterate = slices per beat (tempo-locked via beat_dur = 60/bpm, injected by JS).
// rgatewave = 0 pulse · 1 tri · 2 saw · 3 sine · 4 parabola. A 0.01 floor keeps the
// gate from fully silencing (matches FoxDot add:0.01); rgate is the dry→wet mix.
SynthDef(\fd_fx_rgate, {|in_bus=64, rgate=0, rgaterate=4, rgatewave=0, beat_dur=0.5|
    var sig = In.ar(in_bus, 2), freq, lfo, wet;
    freq = (rgaterate / beat_dur).clip(0.1, 200);
    lfo = SelectX.kr(rgatewave.clip(0, 4), [
            LFPulse.kr(freq, 0, 0.5, 1, 0.01),
            LFTri.kr(freq, 0, 1, 0.01),
            LFSaw.kr(freq, 0, 1, 0.01),
            SinOsc.kr(freq, 0, 1, 0.01),
            LFPar.kr(freq, 0, 1, 0.01) ]);
    wet = sig * lfo;
    ReplaceOut.ar(in_bus, SelectX.ar(rgate.clip(0, 1), [sig, wet]));
}).writeDefFile(~outDir);

// ── mverb — denser allpass reverb ───────────────────────────────────────────
SynthDef(\fd_fx_mverb, {|in_bus=64, mverb=0, mverbmix=0.5, mverbdamp=0.5, mverbdiff=0.5, mverbfreeze=0|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig;
    wet = AllpassN.ar(wet, 0.08, [0.041, 0.047], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = AllpassN.ar(wet, 0.08, [0.053, 0.061], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = AllpassN.ar(wet, 0.08, [0.067, 0.073], 0.7 + (mverbdiff * 3) + (mverbfreeze.clip(0,1) * 26));
    wet = LPF.ar(wet, ((1 - mverbdamp.clip(0,1)) * 8000) + 800);
    wet = XFade2.ar(sig, wet, mverbmix * 2 - 1);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, mverb * 2 - 1));
}).writeDefFile(~outDir);

// ── cheapverb — short comb reverb ───────────────────────────────────────────
SynthDef(\fd_fx_cheapverb, {|in_bus=64, cheapverb=0, cvdecay=1.5, cvdamp=0.5|
    var sig = In.ar(in_bus, 2), wet;
    wet = CombL.ar(sig, 0.1, [0.0297, 0.0371], cvdecay.clip(0.05, 6));
    wet = LPF.ar(wet, ((1 - cvdamp.clip(0,1)) * 8000) + 500) * 0.5;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, cheapverb * 2 - 1));
}).writeDefFile(~outDir);

// ── chorus — modulated stereo delay ─────────────────────────────────────────
SynthDef(\fd_fx_chorus, {|in_bus=64, chorus=0, chorus_rate=0.6, chorus_depth=0.004|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig + DelayC.ar(sig, 0.05,
            (SinOsc.kr([chorus_rate, chorus_rate * 1.3], [0, 1]) * chorus_depth.clip(0.0002, 0.02))
            + chorus_depth.clip(0.0002, 0.02) + 0.001);
    wet = wet * 0.5;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, chorus * 2 - 1));
}).writeDefFile(~outDir);

// ── tremolo — amplitude LFO ─────────────────────────────────────────────────
SynthDef(\fd_fx_tremolo, {|in_bus=64, tremolo=0, trem_rate=4, trem_depth=0.6|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig * SinOsc.kr(trem_rate.clip(0.1, 40)).range(1 - trem_depth.clip(0, 1), 1);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, tremolo * 2 - 1));
}).writeDefFile(~outDir);

// ── tanh — saturation ───────────────────────────────────────────────────────
SynthDef(\fd_fx_tanh, {|in_bus=64, tanh=0, tanh_drive=2|
    var sig = In.ar(in_bus, 2), wet;
    wet = (sig * tanh_drive.clip(0.001, 100)).tanh;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, tanh * 2 - 1));
}).writeDefFile(~outDir);

// ── reverb — Schroeder allpass ──────────────────────────────────────────────
SynthDef(\fd_fx_reverb, {|in_bus=64, reverb=0, rev_room=0.6, rev_damp=0.5|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig;
    wet = AllpassN.ar(wet, 0.05, [0.047, 0.051], 0.5 + rev_room * 3);
    wet = AllpassN.ar(wet, 0.1,  [0.061, 0.068], 0.5 + rev_room * 2);
    wet = AllpassN.ar(wet, 0.1,  [0.031, 0.037], 0.5 + rev_room * 2);
    wet = wet * (1 - rev_damp * 0.6);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, reverb * 2 - 1));
}).writeDefFile(~outDir);

// ── echo — CombL delay ──────────────────────────────────────────────────────
SynthDef(\fd_fx_echo, {|in_bus=64, echo=0, echo_time=0.25, echo_dec=0.5|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig + CombL.ar(sig, 2.0, echo_time.clip(0.001, 2.0), echo_dec.clip(0, 8));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, echo * 2 - 1));
}).writeDefFile(~outDir);

// ── fbdelay — stereo ping feedback delay (own LocalIn/LocalOut) ─────────────
SynthDef(\fd_fx_fbdelay, {|in_bus=64, fbdelay=0, fbtime=0.25, fbfeed=0.5, fbcutoff=3000, fbspread=0.02, beat_dur=0.5|
    var sig = In.ar(in_bus, 2), wet, fbDelTime, fb, fbL, fbR;
    fbDelTime = (fbtime * beat_dur).clip(0.001, 2);
    fb = LocalIn.ar(2) * fbfeed.clip(0, 0.98);
    fb = HPF.ar(fb, 80);
    fb = LPF.ar(fb, fbcutoff.clip(80, 18000));
    fb = (fb * 1.1).softclip;
    fbL = DelayC.ar(sig[0] + fb[1], 2, fbDelTime);
    fbR = DelayC.ar(sig[1] + fb[0], 2, (fbDelTime * (1 + fbspread)).clip(0.001, 2));
    LocalOut.ar([fbL, fbR]);
    wet = sig + ([fbL, fbR] * 0.7);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, fbdelay * 2 - 1));
}).writeDefFile(~outDir);

// ── shape — sine wavefolder ─────────────────────────────────────────────────
SynthDef(\fd_fx_shape, {|in_bus=64, shape=0|
    var sig = In.ar(in_bus, 2), wet;
    wet = (sig * (shape * 20 + 1)).fold2(1).distort * 0.6;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, shape.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── dist2 — fold + tanh with tilt ───────────────────────────────────────────
SynthDef(\fd_fx_dist2, {|in_bus=64, dist2=0, dist2shape=1|
    var sig = In.ar(in_bus, 2), wet;
    wet = Fold.ar(sig, dist2shape.clip(0.05, 1).neg, dist2shape.clip(0.05, 1));
    wet = (wet * (dist2 * 8 + 1)).tanh;
    wet = LPF.ar(wet, 9000);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, dist2.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── multicrush — 3-band drive ───────────────────────────────────────────────
SynthDef(\fd_fx_multicrush, {|in_bus=64, multicrush=0, mclowdrive=2, mcmiddrive=2, mchighdrive=2, mclofreq=300, mchifreq=2500|
    var sig = In.ar(in_bus, 2), wet, mcLow, mcMid, mcHigh;
    mcLow  = (LPF.ar(sig, mclofreq) * mclowdrive).softclip;
    mcMid  = HPF.ar(LPF.ar(sig, mchifreq), mclofreq) * mcmiddrive;
    mcMid  = (mcMid + (mcMid.cubed * 0.2)).fold(-0.9, 0.9);
    mcHigh = LPF.ar((HPF.ar(sig, mchifreq) * mchighdrive).tanh, 12000);
    wet    = Limiter.ar(LeakDC.ar(mcLow + mcMid + mcHigh) * 0.7, 0.95, 0.001);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, multicrush.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── chop — rhythmic slice gate (uses beat_dur) ──────────────────────────────
SynthDef(\fd_fx_chop, {|in_bus=64, chop=0, beat_dur=0.5|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig * LFPulse.kr((chop / beat_dur).clip(0.1, 200), 0, 0.5).range(0.02, 1);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (chop > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── vibrato — pitch wobble via modulated delay ──────────────────────────────
SynthDef(\fd_fx_vibrato, {|in_bus=64, vibrato=0, vib_rate=5, vib_depth=0.008|
    var sig = In.ar(in_bus, 2), wet, vibT;
    vibT = (0.02 + (SinOsc.kr(vib_rate.clip(0.1, 14)) * vib_depth.clip(0, 0.02))).clip(0.001, 0.05);
    wet  = DelayC.ar(sig, 0.05, vibT);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, vibrato.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── ringmod — sine carrier multiply ─────────────────────────────────────────
SynthDef(\fd_fx_ringmod, {|in_bus=64, ringmod=0, ringmod_freq=200|
    var sig = In.ar(in_bus, 2), wet;
    wet = sig * SinOsc.ar(ringmod_freq.clip(1, 8000));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, ringmod.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── flanger — swept feedback comb ───────────────────────────────────────────
SynthDef(\fd_fx_flanger, {|in_bus=64, flanger=0, flanger_rate=0.5, flanger_depth=0.004|
    var sig = In.ar(in_bus, 2), wet, flT;
    flT = (0.001 + SinOsc.kr(flanger_rate.clip(0.01, 10)).range(0, flanger_depth.clip(0, 0.01))).clip(0.0002, 0.02);
    wet = sig + (CombC.ar(sig, 0.02, flT, 0.2) * 0.7);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, flanger.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── phaser — cascaded allpass micro-delays ──────────────────────────────────
SynthDef(\fd_fx_phaser, {|in_bus=64, phaser=0, phaser_rate=0.5|
    var sig = In.ar(in_bus, 2), phWet, phMod;
    phMod = SinOsc.kr(phaser_rate.clip(0.01, 10)).range(0.0001, 0.0009);
    phWet = sig;
    6.do { phWet = AllpassC.ar(phWet, 0.001, phMod, 0); };
    ReplaceOut.ar(in_bus, XFade2.ar(sig, sig + phWet, phaser.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── formant — vowel band-pass bank ──────────────────────────────────────────
SynthDef(\fd_fx_formant, {|in_bus=64, formant=0, formant_vowel=0|
    var sig = In.ar(in_bus, 2), wet, ff1, ff2, ff3;
    ff1 = Select.kr(formant_vowel.clip(0, 2), [730, 530, 570]);
    ff2 = Select.kr(formant_vowel.clip(0, 2), [1090, 1840, 840]);
    ff3 = Select.kr(formant_vowel.clip(0, 2), [2440, 2480, 2410]);
    wet = BPF.ar(sig, ff1, 0.1, 3) + BPF.ar(sig, ff2, 0.1, 2) + BPF.ar(sig, ff3, 0.12, 1.5);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, formant.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── octclean — clean octaver (PitchShift sub + up) ──────────────────────────
SynthDef(\fd_fx_octclean, {|in_bus=64, octclean=0, ocsub=0.5, ocup=0.3|
    var sig = In.ar(in_bus, 2), wet, ocSub, ocUp;
    ocSub = PitchShift.ar(sig, 0.1,  0.5, 0, 0.004);
    ocUp  = PitchShift.ar(sig, 0.05, 2.0, 0, 0.004);
    wet   = sig + (ocSub * ocsub.clip(0, 1)) + (ocUp * ocup.clip(0, 1));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, LeakDC.ar(wet), octclean.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── fold — wavefolder ───────────────────────────────────────────────────────
SynthDef(\fd_fx_fold, {|in_bus=64, fold=0, symetry=1|
    var sig = In.ar(in_bus, 2), wet, foldGain;
    foldGain = LinLin.kr(fold.clip(0, 1), 0, 1, 1, 20);
    wet = ((sig + LinLin.kr(symetry.clip(0, 1), 0, 1, 1, 0)) * foldGain).fold2(1);
    wet = LeakDC.ar(wet * max(foldGain * 0.75, 1).reciprocal);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, fold.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── csweep — resonant comb sweep ────────────────────────────────────────────
SynthDef(\fd_fx_csweep, {|in_bus=64, csweep=0, cswfreq=200, cswdepth=0.3, cswrate=0.5, cswdecay=0.5|
    var sig = In.ar(in_bus, 2), wet, cswDel, cswLfo;
    cswDel = cswfreq.clip(20, 8000).reciprocal;
    cswLfo = SinOsc.kr(cswrate.clip(0.01, 20)).range(1 - cswdepth, 1 + cswdepth);
    wet = CombC.ar(sig, 0.05, (cswDel * cswLfo).clip(0.00005, 0.05), cswdecay.clip(0, 4));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, LeakDC.ar(wet), csweep.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── eb — tape echo (gate = ebmix; non-XFade blend) ──────────────────────────
SynthDef(\fd_fx_eb, {|in_bus=64, eb=0.5, ebfeed=0.5, ebmix=0, ebmode=0, ebwow=0.1, ebflutter=0.15, ebsat=0.3|
    var sig = In.ar(in_bus, 2), wet, ebWow, ebFlut, ebDelT;
    ebWow  = SinOsc.kr(0.5 + (0.3 * LFNoise1.kr(0.2)), 0, ebwow * 0.003);
    ebFlut = LFNoise1.kr(10 + (20 * LFNoise1.kr(0.5)), ebflutter * 0.002);
    ebDelT = (eb.clip(0.001, 2) * (1 + ebWow + ebFlut)).clip(0.0001, 2);
    wet    = CombC.ar(sig, 2.0, ebDelT, eb.clip(0.001, 2) * (1 + (ebfeed.clip(0, 0.95) * 24)));
    wet    = LPF.ar(HPF.ar(wet, 100), 8000);
    wet    = Select.ar(ebmode.clip(0, 2), [wet, (wet * (1 + (ebsat * 2))).tanh * 0.7, (wet * (1 + (ebsat * 4))).distort * 0.5]);
    ReplaceOut.ar(in_bus, HPF.ar((sig * (1 - ebmix.clip(0, 1))) + (wet * ebmix.clip(0, 1)), 40));
}).writeDefFile(~outDir);

// ── tube — tube saturation ──────────────────────────────────────────────────
SynthDef(\fd_fx_tube, {|in_bus=64, tube=0, tubegain=1.5, tubewarm=0.6, tubebias=0.1|
    var sig = In.ar(in_bus, 2), dry, sat, harm;
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
    ReplaceOut.ar(in_bus, XFade2.ar(dry, sat * 0.8, tube.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── drcomp — drum-bus compressor + shelves ──────────────────────────────────
SynthDef(\fd_fx_drcomp, {|in_bus=64, drcomp=0|
    var sig = In.ar(in_bus, 2), wet;
    wet = Compander.ar(sig, sig, 0.1, 1, 0.1, 0.002, 0.05, 3);
    wet = BHiShelf.ar(BLowShelf.ar(wet, 200, 1, 2), 6000, 1, 3);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet * 0.7, drcomp.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── lofi — degrade (compress + wow + sat + band-limit) ──────────────────────
SynthDef(\fd_fx_lofi, {|in_bus=64, lofi=0, lofiwow=0.5, lofiamp=0.5|
    var sig = In.ar(in_bus, 2), wet, loR, loT, loG, loRate, loDepth, loMul;
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
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, lofi.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── vowel — formant sweep filter ────────────────────────────────────────────
SynthDef(\fd_fx_vowel, {|in_bus=64, vowel=0, vowelf=0, vowelq=1|
    var sig = In.ar(in_bus, 2), wet, vf1, vf2, vf3, vb1, vb2, vb3;
    vf1 = Select.kr(vowelf.floor.clip(0, 3), [LinXFade2.kr(800, 400, vowelf.frac * 2 - 1), LinXFade2.kr(400, 350, (vowelf - 1).frac * 2 - 1), LinXFade2.kr(350, 450, (vowelf - 2).frac * 2 - 1), LinXFade2.kr(450, 325, (vowelf - 3).frac * 2 - 1)]);
    vf2 = Select.kr(vowelf.floor.clip(0, 3), [LinXFade2.kr(1150, 1600, vowelf.frac * 2 - 1), LinXFade2.kr(1600, 2100, (vowelf - 1).frac * 2 - 1), LinXFade2.kr(2100, 800, (vowelf - 2).frac * 2 - 1), LinXFade2.kr(800, 700, (vowelf - 3).frac * 2 - 1)]);
    vf3 = Select.kr(vowelf.floor.clip(0, 3), [LinXFade2.kr(2800, 2700, vowelf.frac * 2 - 1), LinXFade2.kr(2700, 3000, (vowelf - 1).frac * 2 - 1), LinXFade2.kr(3000, 2830, (vowelf - 2).frac * 2 - 1), LinXFade2.kr(2830, 2530, (vowelf - 3).frac * 2 - 1)]);
    vb1 = (80 / vowelq).max(20); vb2 = (60 / vowelq).max(15); vb3 = (50 / vowelq).max(12);
    wet = (BPF.ar(sig, vf1, vb1 / vf1) * 3) + (BPF.ar(sig, vf2, vb2 / vf2) * 2) + (BPF.ar(sig, vf3, vb3 / vf3) * 1.5);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, LeakDC.ar(wet), vowel.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── feed — resonant feedback comb (additive blend) ──────────────────────────
SynthDef(\fd_fx_feed, {|in_bus=64, feed=0, feedfreq=50|
    var sig = In.ar(in_bus, 2), wet;
    wet = CombN.ar(HPF.ar(sig, feedfreq.clip(20, 8000)), 0.5, 0.125, (feed.clip(0, 0.95) * 8) + 0.1).tanh;
    ReplaceOut.ar(in_bus, sig + (LeakDC.ar(wet) * feed.clip(0, 1) * 0.6));
}).writeDefFile(~outDir);

// ── sbrk — clocked stutter / beat-repeat ────────────────────────────────────
SynthDef(\fd_fx_sbrk, {|in_bus=64, sbrk=0, sbrkdur=0.5|
    var sig = In.ar(in_bus, 2), wet, sbBuf, sbTrig, sbRate;
    sbBuf  = LocalBuf(44100 * 0.5, 2).clear;
    RecordBuf.ar(sig, sbBuf, loop: 1, run: 1);
    sbRate = sbrkdur.reciprocal.clip(1, 32);
    sbTrig = Impulse.ar(sbRate);
    wet    = PlayBuf.ar(2, sbBuf, BufRateScale.kr(sbBuf), trigger: sbTrig, loop: 1);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, sbrk.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── bpf — resonant band-pass (center Hz, 0 = bypass) ────────────────────────
// bpf_rq = bandwidth ratio (small = narrow/resonant). A mild makeup gain keeps
// narrow bands from disappearing.
SynthDef(\fd_fx_bpf, {|in_bus=64, bpf=0, bpf_rq=0.5|
    var sig = In.ar(in_bus, 2), wet, rq = bpf_rq.clip(0.01, 2.0);
    wet = BPF.ar(sig, (bpf > 0).if(bpf.clip(20, 18000), 1000), rq) * rq.reciprocal.sqrt.clip(1, 3);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (bpf > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── eq3 — 3-band EQ (low shelf / mid peak / high shelf, gains in dB) ─────────
// eq3 = dry→wet mix (0 = off). eqlow/eqmid/eqhigh in dB (±24). Frequencies and
// mid-Q are tweakable (eqlowf/eqmidf/eqmidq/eqhighf).
SynthDef(\fd_fx_eq3, {|in_bus=64, eq3=0, eqlow=0, eqmid=0, eqhigh=0, eqlowf=200, eqmidf=1000, eqmidq=1, eqhighf=5000|
    var sig = In.ar(in_bus, 2), wet;
    wet = BLowShelf.ar(sig, eqlowf.clip(40, 2000), 1, eqlow.clip(-24, 24));
    wet = BPeakEQ.ar(wet, eqmidf.clip(200, 8000), eqmidq.clip(0.1, 4), eqmid.clip(-24, 24));
    wet = BHiShelf.ar(wet, eqhighf.clip(1000, 16000), 1, eqhigh.clip(-24, 24));
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, eq3.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

// ── spin — stereo auto-pan (rotates the stereo image with an LFO) ────────────
// spin = dry→wet mix (0 = off). spinrate = rotations/sec.
SynthDef(\fd_fx_spin, {|in_bus=64, spin=0, spinrate=2|
    var sig = In.ar(in_bus, 2), wet, lfo = SinOsc.kr(spinrate.clip(0.01, 40));
    wet = Rotate2.ar(sig[0], sig[1], lfo);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (spin > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── pong — ping-pong stereo delay (echoes bounce L↔R) ────────────────────────
// pong = mix. pongtime = delay in BEATS (tempo-locked via beat_dur). pongfeed =
// feedback 0–0.9. A cross-fed LocalIn/LocalOut loop makes each echo swap sides.
SynthDef(\fd_fx_pong, {|in_bus=64, pong=0, pongtime=0.25, pongfeed=0.5, beat_dur=0.5|
    var sig = In.ar(in_bus, 2), wet, l, r,
        dt = (pongtime * beat_dur).clip(0.01, 1.5), fb = pongfeed.clip(0, 0.9),
        fbk = LocalIn.ar(2);
    l = DelayL.ar(sig[0] + (fbk[1] * fb), 1.5, dt);
    r = DelayL.ar(sig[1] + (fbk[0] * fb), 1.5, dt);
    LocalOut.ar([l, r]);
    wet = sig + [l, r];
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (pong > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── squiz — zero-crossing pitch-up glitch (Squiz) ───────────────────────────
// squiz = mix, squizpitch = pitch ratio (1–8), squizzc = zero-crossings averaged.
SynthDef(\fd_fx_squiz, {|in_bus=64, squiz=0, squizpitch=2, squizzc=1|
    var sig = In.ar(in_bus, 2), wet;
    wet = Squiz.ar(sig, squizpitch.clip(1, 8), squizzc.clip(1, 16).round);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (squiz > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── drop — waveform dropout / decimate glitch (WaveLoss) ─────────────────────
// drop = mix (also how aggressively it drops), dropof = window size.
SynthDef(\fd_fx_drop, {|in_bus=64, drop=0, dropof=40|
    var sig = In.ar(in_bus, 2), wet, n = dropof.clip(2, 100).round;
    wet = WaveLoss.ar(sig, (drop.clip(0, 1) * n).round, n, 2);
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, (drop > 0) * 2 - 1));
}).writeDefFile(~outDir);

// ── comp — compressor (Compander) with makeup gain ──────────────────────────
// comp = dry→wet mix, compthresh = threshold, compratio = ratio (2–20:1).
SynthDef(\fd_fx_comp, {|in_bus=64, comp=0, compthresh=0.3, compratio=4|
    var sig = In.ar(in_bus, 2), wet, ratio = compratio.clip(1, 20);
    wet = Compander.ar(sig, sig, compthresh.clip(0.01, 1.0), 1, 1 / ratio, 0.01, 0.1) * ratio.sqrt;
    ReplaceOut.ar(in_bus, XFade2.ar(sig, wet, comp.clip(0, 1) * 2 - 1));
}).writeDefFile(~outDir);

"fd_fx_effects done".postln;
