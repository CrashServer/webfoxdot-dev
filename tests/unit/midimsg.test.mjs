// The MIDI bytes for settings: Control Change, Program Change, NRPN.
//
// These are unit-tested rather than checked on a device because this platform's
// browser will report a port as open and put nothing on the wire — so the only
// honest place to verify them is before they reach one. The shapes below were read
// off a Medeli SP5600 announcing its own state at power-on, not from memory.
import { ccMessage, programMessages, nrpnMessages } from '../../js/midi/midiout.js';

const hex = (m) => m.map(b => b.toString(16).padStart(2, '0')).join(' ');
const hexAll = (ms) => ms.map(hex).join(' | ');

export default function ({ test, eq, ok }) {
    test('midimsg: control change, on the right channel', () => {
        eq(hex(ccMessage(74, 100, 1)), 'b0 4a 64');
        eq(hex(ccMessage(74, 100, 2)), 'b1 4a 64');
        eq(hex(ccMessage(7, 56, 16)), 'bf 07 38');     // channel 16 is nibble f
    });

    test('midimsg: values and channels are clamped, not wrapped', () => {
        // A wrapped 128 becomes 0 — silence where you asked for full — and a
        // wrapped channel talks to an instrument you did not mean.
        eq(hex(ccMessage(74, 200, 1)), 'b0 4a 7f');
        eq(hex(ccMessage(74, -5, 1)), 'b0 4a 00');
        eq(hex(ccMessage(999, 10, 1)), 'b0 7f 0a');
        eq(hex(ccMessage(1, 10, 99)), 'bf 01 0a');
        eq(hex(ccMessage(1, 10, 0)), 'b0 01 0a');
    });

    test('midimsg: program change puts the bank FIRST', () => {
        // A synth latches the bank when the program arrives, so the other order
        // picks the sound out of whichever bank happened to be selected.
        eq(hexAll(programMessages(5, 121, 100, 1)), 'b0 00 79 | b0 20 64 | c0 05');
        eq(hexAll(programMessages(5)), 'c0 05');                    // no bank asked for
        eq(hexAll(programMessages(5, 121)), 'b0 00 79 | c0 05');    // MSB only
    });

    test('midimsg: NRPN is 99/98 to address, then 6 to set', () => {
        eq(hexAll(nrpnMessages(50, 12, 64, 1)), 'b0 63 32 | b0 62 0c | b0 06 40');
    });

    test('midimsg: the NRPN fine byte is sent only when asked for', () => {
        // Plenty of devices ignore CC38, and some read a stray one as a second edit.
        ok(!hexAll(nrpnMessages(50, 12, 64, 1)).includes('26'), 'sent CC38 unasked');
        eq(hexAll(nrpnMessages(50, 12, 64, 1, 0)).split(' | ').pop(), 'b0 26 00');
    });

    test('midimsg: a real SP5600 program select round-trips', () => {
        // Exactly the bytes the keyboard itself transmits when it powers on.
        eq(hexAll(programMessages(0, 121, 100, 1)), 'b0 00 79 | b0 20 64 | c0 00');
    });
}
