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
import { OFFLOAD, isOffloaded, bitmapFor, offloadStats, releaseOffload, offloadEnabled }
    from '../../js/visuals/render/wsoffload.js';

export default function ({ test, eq, ok }) {
    test('wsoffload: only the measured-heavy layers are offloaded', () => {
        // Chosen from tools/bench-layers.mjs: these draw for longer than the frame
        // budget's throttle can hide. Everything else stays on the main thread, where
        // it costs less than the round trip would.
        ok(OFFLOAD.has('audiotterrain'), 'the 240ms one must be in the list');
        ok(!OFFLOAD.has('plasma'), 'a 0.02ms layer must not pay for a worker');
        ok(OFFLOAD.has('starnest'), 'it takes its buffer from makeBuffer now, so it can go');
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
