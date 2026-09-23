// Which camera does camera(x) mean?
//
// The rules are a pure function so they can be checked without a camera, because the
// interesting cases are the awkward ones: a machine with one camera, a name that
// matches nothing, an index past the end, and the fact that 0 has to mean the first
// camera rather than "off" — a toggle and a selector cannot both own zero, and
// picking is what you do more often.
import { resolveCamera } from '../../js/visuals/camera.js';

const LIST = [
    { id: 'aaa', label: 'HD Pro Webcam C920' },
    { id: 'bbb', label: 'Logitech StreamCam' },
    { id: 'ccc', label: 'OBS Virtual Camera' },
];

export default function ({ test, eq, ok }) {
    test('camerapick: an index, 0-based like every other index here', () => {
        eq(resolveCamera(0, LIST).device.id, 'aaa');
        eq(resolveCamera(2, LIST).device.id, 'ccc');
    });

    test('camerapick: an index past the end wraps, like theme(n)', () => {
        eq(resolveCamera(3, LIST).device.id, 'aaa');
        eq(resolveCamera(4, LIST).device.id, 'bbb');
        eq(resolveCamera(-1, LIST).device.id, 'ccc', 'and counts back from the end');
    });

    test('camerapick: a fragment of the name, case-insensitively', () => {
        eq(resolveCamera('logi', LIST).device.id, 'bbb');
        eq(resolveCamera('OBS', LIST).device.id, 'ccc');
        eq(resolveCamera('c920', LIST).device.id, 'aaa');
    });

    test('camerapick: a name that matches nothing picks nothing, and says so', () => {
        // Never silently fall back to the first: switching to the wrong camera
        // mid-set is worse than being told the name was wrong.
        const r = resolveCamera('nikon', LIST);
        eq(r.device, null);
        ok(r.why.includes('nikon'));
    });

    test('camerapick: nothing asked for keeps the one in use', () => {
        eq(resolveCamera(null, LIST, 'ccc').device.id, 'ccc');
        eq(resolveCamera(null, LIST).device.id, 'aaa', 'or the first, if none is');
    });

    test('camerapick: an empty list is not a crash', () => {
        eq(resolveCamera(0, []).device, null);
        eq(resolveCamera('logi', null).device, null);
    });

    test('camerapick: one camera makes every index that one', () => {
        const one = [{ id: 'solo', label: 'Integrated Camera' }];
        eq(resolveCamera(0, one).device.id, 'solo');
        eq(resolveCamera(7, one).device.id, 'solo');
    });
}
