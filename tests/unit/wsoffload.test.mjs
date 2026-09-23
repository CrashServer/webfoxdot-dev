// The offload manager's contract with the deck.
//
// Everything here is about the fallback path, because that is the one that must
// never break: a browser with no Worker, a worker that fails to load, a layer that
// throws inside it. Any of those must come back as "no bitmap", so the deck draws on
// the main thread exactly as it did before this existed. A silent blank layer would
// be worse than the cost this is saving.
//
// The drawing itself needs OffscreenCanvas and a real worker, so that half is
// verified in the browser, not here.
import { OFFLOAD, isOffloaded, bitmapFor, offloadStats, releaseOffload, offloadEnabled,
         promote, wasPromoted, setPromoteMs, offloadSeeds }
    from '../../js/visuals/render/wsoffload.js';

export default function ({ test, eq, ok }) {
    test('wsoffload: the seed is small, because a list is the wrong mechanism', () => {
        // The bench numbers came off headless Chromium, which is ~5x slower at this
        // than a real machine: audiotterrain drew in 240ms there and 51ms on the first
        // real browser it met. So only the one that is heavy everywhere is seeded, and
        // everything else has to earn it by being measured on the machine it is on.
        ok(OFFLOAD.has('audiotterrain'), 'heavy on any hardware');
        ok(!OFFLOAD.has('plasma'), 'a 0.02ms layer must never pay for a worker');
        ok(offloadSeeds().includes('starnest'), 'a candidate, not an assumption');
        ok(!OFFLOAD.has('starnest'), 'it waits to be measured');
    });

    test('wsoffload: a layer is promoted once it is measured over the threshold', () => {
        setPromoteMs(24);
        eq(promote('cheapo', 5), false, '5ms is well inside what the budget hides');
        eq(OFFLOAD.has('cheapo'), false);
        eq(promote('spendy', 40), true, 'past what the throttle can hide');
        eq(OFFLOAD.has('spendy'), true);
        ok(wasPromoted('spendy'));
        ok(!wasPromoted('audiotterrain'), 'seeded is not the same as promoted');
    });

    test('wsoffload: promotion happens once and never reverses', () => {
        // A promoted layer stops being measured on the main thread, so there is no
        // cost left to demote it on — and one that flipped back and forth would be
        // worse than either choice.
        eq(promote('spendy', 90), false, 'already there');
        eq(promote('spendy', 1), false, 'and it does not come back');
        ok(OFFLOAD.has('spendy'));
    });

    test('wsoffload: the threshold is what the budget can hide, and is settable', () => {
        eq(setPromoteMs(50), 50);
        eq(promote('midweight', 40), false, 'under the new bar');
        eq(setPromoteMs(24), 24);
        eq(promote('midweight', 40), true);
        OFFLOAD.delete('midweight'); OFFLOAD.delete('spendy');
    });

    test('wsoffload: a layer not on the list is never offloaded', () => {
        eq(isOffloaded('plasma'), false);
        eq(isOffloaded('nonesuch'), false);
    });

    test('wsoffload: with no Worker in the environment it returns no bitmap', () => {
        // Node has no Worker or OffscreenCanvas, so this exercises the exact path a
        // browser without module workers takes.
        eq(bitmapFor('audiotterrain', 320, 180, {}, 1, { spectrum: null }), null);
    });

    test('wsoffload: once it has given up it stays given up', () => {
        // start() sets `broken` and is never retried — a worker that cannot load will
        // not load a thousand frames later either, and retrying every frame would
        // cost more than the layer.
        eq(offloadEnabled(), false, 'no worker here, so it is off');
        eq(bitmapFor('audiotterrain', 320, 180, {}, 1, {}), null);
    });

    test('wsoffload: stats and release are safe with nothing open', () => {
        ok(Array.isArray(offloadStats()));
        releaseOffload('audiotterrain');
        releaseOffload('never-opened');
    });
}
