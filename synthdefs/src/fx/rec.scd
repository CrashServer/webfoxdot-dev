// fd_rec — live sampling: record a stereo bus, or the live input, into a buffer.
//
// One pass, then it frees itself: RecordBuf with loop:0 fires doneAction:2 at the
// end of the buffer, so a take is exactly as long as the buffer JS allocated
// (N beats at the tempo when it was asked for). Started with a timetag, it lands
// on the bar sample-accurately, the same way every note does.
//
//   live=0 : In.ar(in_bus, 2) — bus 0 after fd_master (the finished mix), or a
//            player's private bus (that player alone, post-FX)
//   live=1 : SoundIn — whatever the page connected to the scsynth node's input
//            (audioin(): a mic, a line in, an interface)
//
// Both are computed and crossfaded by `live` rather than Select'd: Select over two
// stereo arrays multichannel-expands into the wrong shape.

SynthDef(\fd_rec, {|buf=0, in_bus=0, live=0, amp=1|
    var sig;
    sig = (In.ar(in_bus, 2) * (1 - live)) + (SoundIn.ar([0, 1]) * live);
    RecordBuf.ar(sig * amp, buf, loop: 0, doneAction: 2);
}).writeDefFile(~outDir);
"fd_rec done".postln;
