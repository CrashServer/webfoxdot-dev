// ebass — electric bass (Klank stiff-string model), ported from FoxDot ebass
// (Josh Mitchell / CrashServer FoxDot mod). Adapted to WebFoxDot I/O:
//   bus→out, freq from note.midicps (was In.kr), ReplaceOut→Out.
// Params: out, note, amp, sus, pan, attack, release, pick, rq, cutoff, decay

SynthDef(\fd_ebass, {|out=0, note=60, amp=1, sus=1, pan=0, attack=0.001, release=0.01,
                       pick=0.414, rq=0.5, cutoff=250, decay=0.01|
    var exciter, freqArray, ampArray, decArray, constant, mute, snd, freq;
    var openFreq, pickupPos, pickupWidth, decayCoef, dampCoef;
    openFreq    = 82.5;
    pickupPos   = 17 * decay;
    pickupWidth = 0.75;
    decayCoef   = 0.125;
    dampCoef    = 0.0002;

    freq = note.midicps / 4;

    constant = pickupWidth / 25.5;        // scale length 25.5"
    constant = constant * pi / 2;
    constant = constant / 82.5;

    // Stiff-string partial frequencies
    freqArray = Array.fill(10, {|i| (i + 1) * sqrt(1 + ((i + 1).pow(2) * 0.00001)) });
    freqArray = freqArray / freqArray[0];

    // Partial decay times
    decArray = Array.fill(10, {|i|
        exp((-1 * i) / ((1 / decayCoef) + ((dampCoef / 10) * freq.pow(2)) + (dampCoef * freqArray[i].pow(2))))
    });
    decArray = decArray / decArray[0];

    freqArray = freqArray * freq;

    // Pick position + pickup placement → partial amplitudes
    ampArray = Array.fill(10, {|i|
        ((1 - ((freqArray[i] - 19000) / 1000).tanh) / 2) *
        sin(((i + 1) * pi) * pick) *
        (sin(pi * pickupPos * freqArray[i] / openFreq) *
            ((sin(constant * freqArray[i]) / (constant * freqArray[i])) - cos(constant * freqArray[i]))
        ) / (freqArray[i].pow(2))
    });
    ampArray = ampArray * 2 / (constant.pow(2));

    exciter = Impulse.ar(0) * 1;
    snd = Klank.ar(Ref.new([freqArray, ampArray, decArray]), exciter, decayscale: sus * 2 + release);
    snd = Mix.ar(snd);

    snd = RLPF.ar(snd, cutoff.clip(40, 18000), rq.clip(0.01, 1.0));
    snd = LPF.ar(snd, 250);

    // Mute envelope — also frees the node
    mute = Env.new([1, 1, 0, 0], [release + sus, 0.05, 0.01]).ar(doneAction: 2);
    snd  = LPF.ar(snd, LinExp.ar(mute, 0, 1, 20, 20000));

    snd = snd * amp;
    snd = snd.tanh;
    snd = LeakDC.ar(snd);
    snd = Limiter.ar(snd);
    Out.ar(out, Pan2.ar(snd, pan));
}).writeDefFile(~outDir);
"fd_ebass done".postln;
