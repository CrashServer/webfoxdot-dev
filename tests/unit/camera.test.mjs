// The camera's failure paths.
//
// The success path needs a browser and a camera, and is checked there. What is
// checked here is that every way of NOT getting a camera ends as a state you can read
// and a sentence worth showing — because the previous behaviour was the layer drawing
// nothing, forever, with no explanation and no permission prompt, and anything that
// silent is worse than an error.
import { cameraState, cameraEl, startCamera, stopCamera, cameraList }
    from '../../js/visuals/camera.js';

export default function ({ test, eq, ok }) {
    test('camera: starts off, with nothing to draw', () => {
        eq(cameraState().state, 'off');
        eq(cameraState().live, false);
        eq(cameraEl(), null, 'a layer asking for the element gets null, not a broken one');
    });

    test('camera: without getUserMedia it says WHICH kind of missing', async () => {
        // Node has no navigator.mediaDevices, which is the same branch a page served
        // over plain http takes — and those need different advice, so they are
        // different states rather than one "unsupported".
        const ok2 = await startCamera();
        eq(ok2, false);
        const st = cameraState();
        ok(st.state === 'insecure' || st.state === 'unsupported', `got ${st.state}`);
        ok(st.detail.length > 0, 'a state with no explanation is not much better than silence');
        eq(cameraEl(), null);
    });

    test('camera: stopping when it never started is harmless', () => {
        stopCamera();
        eq(cameraState().state, 'off');
        eq(cameraEl(), null);
    });

    test('camera: listing devices without permission returns nothing, not a throw', async () => {
        const list = await cameraList();
        ok(Array.isArray(list));
        eq(list.length, 0);
    });
}
