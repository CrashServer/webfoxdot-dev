// midi(…, init=): where a binding starts before its control has sent anything.
// Untouched bindings start mid-range, which is right for a fader and wrong for a
// button: a mute written midi(48, 1, 0) played at half volume, and a light echoing
// a button sat lit, until the button was first pressed.
import { makeMidi } from '../../js/midi/midi.js';

export default function ({ test, near }) {
    test('midiinit: untouched starts mid-range, as before', () => near(makeMidi(90, 0, 1).get(), 0.5));
    test('midiinit: init puts a mute at 1 and an echo light at 0', () => {
        near(makeMidi(91, 1, 0, 'lin', null, { init: 1 }).get(), 1);
        near(makeMidi(92, 0, 127, 'lin', null, { init: 0 }).get(), 0);
    });
    test('midiinit: init outside the range is clamped to it', () => near(makeMidi(93, 0, 10, 'lin', null, { init: 50 }).get(), 10));
}
