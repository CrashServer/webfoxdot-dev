// Two controllers at once — a keyboard to play and a box of faders to turn.
//
// Their CC numbers overlap by convention, not by accident: a nanoKONTROL2's faders
// are CC 0..7 and a keyboard's own volume is CC 7. Keyed by number alone they fight
// over one binding. And a keyboard that restates its state while nobody touches it
// used to win every MIDI learn, because learn latched onto the first CC that
// arrived rather than the first that MOVED.
import { makeMidi, shortName } from '../../js/midi/midi.js';

export default function ({ test, eq, ok }) {
    test('mididev: a bare midi(cc) still takes any device', () => {
        const b = makeMidi(7, 0, 1);
        eq(b.src, null);
        eq(b.toCode(), 'midi(7)');
    });

    test('mididev: a device filter is remembered', () => {
        const b = makeMidi(7, 0, 1, 'lin', 'nano');
        eq(b.src, 'nano');
    });

    test('mididev: a learned binding writes the device in the RIGHT argument', () => {
        // midi(21, "nano") would read the name as the low end of the range and bind
        // the fader to nothing at all. device is the fifth argument.
        const b = makeMidi(21, 0, 1);
        b.srcName = 'nanoKONTROL2 SLIDER/KNOB';
        eq(b.toCode(), 'midi(21, 0, 1, "lin", "nanoKONTROL2")');
    });

    test('mididev: a range survives the round trip', () => {
        const b = makeMidi(74, 200, 4000, 'exp');
        eq(b.toCode(), 'midi(74, 200, 4000, "exp")');
        b.srcName = 'nanoKONTROL2 SLIDER/KNOB';
        eq(b.toCode(), 'midi(74, 200, 4000, "exp", "nanoKONTROL2")');
    });

    test('mididev: the label says which box', () => {
        const b = makeMidi(7, 0, 1);
        eq(b.label(), 'midi cc7');
        b.srcName = 'nanoKONTROL2 SLIDER/KNOB';
        eq(b.label(), 'midi cc7 · nanoKONTROL2');
    });

    test('mididev: device names shorten to something typeable', () => {
        eq(shortName('nanoKONTROL2 SLIDER/KNOB'), 'nanoKONTROL2');
        eq(shortName('USB AudioDevice MIDI 1'), 'USB');
        eq(shortName(''), '');
    });
}
