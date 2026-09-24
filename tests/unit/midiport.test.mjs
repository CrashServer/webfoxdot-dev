// MIDI out by device name: port="nano" on a line, midicc(…, port="nano"). With a
// keyboard and a controller both on the wire, the one rule that matters is that a
// name matching nothing sends NOTHING — a light pattern meant for the nanoKONTROL
// arriving at the SP5600 is a stream of CCs rewriting its sound.
import { resolveOutput } from '../../js/midi/midiout.js';

export default function ({ test, eq }) {
    const outs = [{ id: 'a', name: 'SP5600 MIDI 1' }, { id: 'b', name: 'nanoKONTROL2 CTRL' }];
    test('midiport: a fragment picks by name, any case', () => {
        eq(resolveOutput('nano', outs).id, 'b');
        eq(resolveOutput('sp56', outs).id, 'a');
        eq(resolveOutput('NANOKONTROL', outs).id, 'b');
    });
    test('midiport: no name → the panel\'s choice, else the first', () => {
        eq(resolveOutput(null, outs, 'b').id, 'b');
        eq(resolveOutput(null, outs, 'gone').id, 'a');
        eq(resolveOutput('', outs).id, 'a');
    });
    test('midiport: a name that matches nothing is nothing — never the default', () => {
        eq(resolveOutput('launchpad', outs, 'a'), null);
    });
    test('midiport: no outputs at all', () => eq(resolveOutput('nano', []), null));
}
