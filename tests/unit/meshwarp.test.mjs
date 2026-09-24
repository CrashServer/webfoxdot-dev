// Warping an output shrank the picture: drawMeshWarp mapped its triangles as if the
// source were the OUTPUT's size, and the GL canvas rarely is (it follows its panel
// and vres). A half-res source came out half the size the moment it was warped.
// Checked with a stub 2D context: where does the source's far corner land?
import { createMeshWarp } from '../../js/visuals/render/meshwarp.js';

const el = () => ({ style: {}, addEventListener() {}, remove() {}, setPointerCapture() {} });
function warp(W, H) {
    const doc = { title: '', body: { style: {}, appendChild() {} }, createElement: el, addEventListener() {} };
    const win = { document: doc, addEventListener() {} };
    return createMeshWarp(win, { style: {}, offsetWidth: W, offsetHeight: H }, W, H);
}
// The furthest point any triangle puts the source's (width, height) corner at.
function farCorner(w, src) {
    let x = 0, y = 0, m = null;
    const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {},
        transform(...a) { m = a; },
        drawImage(img) {
            const [a, b, c, d, e, f] = m;
            x = Math.max(x, a * img.width + c * img.height + e);
            y = Math.max(y, b * img.width + d * img.height + f);
        } };
    w.drawMeshWarp(ctx, src);
    return { x, y };
}

export default function ({ test, near, ok }) {
    for (const [sw, sh] of [[640, 360], [1280, 720], [1920, 1080]]) {
        test(`meshwarp: a ${sw}×${sh} source fills a 1280×720 output once warped`, () => {
            const w = warp(1280, 720);
            w.setMode('4pt');
            // A hair off square: enough to leave the identity fast path.
            w.setCorners([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.01, y: 1 }]);
            ok(!w.isIdentity());
            const p = farCorner(w, { width: sw, height: sh });
            near(p.x, 1280, 16);   // the hair-off warp itself moves it ~10px
            near(p.y, 720, 16);
        });
    }
}
