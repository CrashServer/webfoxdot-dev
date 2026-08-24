// spicelead — a dark, hollow, breathy oriental reed (Picq "Dune" — the ney/duduk
// solo voice). A soft triangle + a narrow nasal pulse (NOT a bright saw stack —
// the real record has almost no energy above 2.5kHz), one octave-down triangle
// for body, through a warm low-pass, with real vibrato, portamento (glide) and a
// low band-passed breath-noise transient on each attack for the reed "chiff".
// Deliberately dark by default. Params: cutoff, rq, vib, vibrate, glide, breath, tone
SynthDef(\fd_spicelead, {|out=0, note=60, amp=0.7, sus=1, pan=0, attack=0.06, release=0.2,
                          cutoff=1500, rq=0.4, vib=0.5, vibrate=5.5, glide=0.06,
                          breath=0.1, tone=0.35|
    var freq, vibr, body, noise, sig, env, cf;
    freq = Lag.kr(note.midicps, glide);
    vibr = SinOsc.kr(vibrate, Rand(0, 2pi)).range(1 - (vib * 0.02), 1 + (vib * 0.02));
    freq = freq * vibr;
    // hollow reed core: triangle (soft) + narrow pulse (nasal), blended by `tone`,
    // plus a sub-octave triangle for warmth/body
    body = ((LFTri.ar(freq) * (1 - tone)) + (Pulse.ar(freq, 0.22) * tone)) * 0.5;
    body = body + (LFTri.ar(freq * 0.5) * 0.35);
    noise = BPF.ar(WhiteNoise.ar(breath), (freq * 1.5).clip(150, 6000), 0.5) * 1.5;
    noise = noise * EnvGen.kr(Env.perc(0.02, 0.28));   // breath enters on attack, fades
    sig = body + noise;
    cf = (cutoff + (EnvGen.kr(Env.perc(0.04, 0.5)) * cutoff * 0.3)).clip(200, 9000);
    sig = LPF.ar(RLPF.ar(sig, cf, rq.clip(0.1, 1.0)), 7000);   // dark, band-limited
    env = EnvGen.ar(Env.linen(attack, (sus - attack - release).max(0.02), release, 1, \sin), doneAction: 2);
    sig = LeakDC.ar(sig) * env * amp * 0.32;
    Out.ar(out, Pan2.ar(sig, pan));
}).writeDefFile(~outDir);
"fd_spicelead done".postln;
