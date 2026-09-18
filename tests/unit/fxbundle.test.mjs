// One bundle per frame, resolved from the live layers. Two callers in two documents
// (the main window's surfaces and the projection pop-out) share this — they used to
// have a copy each, and the pop-out's drifted six effects behind.
import { fxBundle } from '../../js/visuals/render/fxbundle.js';

export default function ({ test, eq, ok }) {
    test('fxbundle: the loudest intent wins for an amount', () => {
        const b = fxBundle([{ fx: { glitch: 0.2 } }, { fx: { glitch: 0.7 } }, { fx: { glitch: 0.5 } }]);
        eq(b.glitch, 0.7);
    });
    test('fxbundle: a grade takes the value furthest from neutral', () => {
        eq(fxBundle([{ fx: { sat: 1.4 } }, { fx: { sat: 0.9 } }]).sat, 1.4);
        eq(fxBundle([{ fx: { sat: 1.1 } }, { fx: { sat: 0.2 } }]).sat, 0.2);
        // lutmix is a grade for exactly this reason: max() could never pick 0.5.
        eq(fxBundle([{ fx: { lutmix: 0.5 } }]).lutmix, 0.5);
    });
    test('fxbundle: a ceiling is a promise, so the LOWEST wins', () => {
        eq(fxBundle([{ fx: { ceiling: 0.8 } }, { fx: { ceiling: 0.5 } }]).ceiling, 0.5);
    });
    test('fxbundle: a workshop layer keeps its own per-layer effects', () => {
        // Counting them here too would run them twice — and for invert that means
        // not at all, since inverting twice is the identity.
        eq(fxBundle([{ ws: true, fx: { bloom: 0.9 } }]).bloom, 0);
        eq(fxBundle([{ ws: false, fx: { bloom: 0.9 } }]).bloom, 0.9);
        // trails is not a workshop effect, so it still falls through.
        eq(fxBundle([{ ws: true, fx: { trails: 0.4 } }]).trails, 0.4);
    });
    test('fxbundle: neutral with no layers, and invert is a switch', () => {
        const b = fxBundle([]);
        eq([b.sat, b.exposure, b.contrast, b.ceiling, b.lutmix], [1, 1, 1, 1, 1]);
        eq(b.glitch, 0);
        eq(b.invert, false);
        eq(fxBundle([{ fx: { invert: true } }]).invert, true);
    });
    test('fxbundle: the colour effects promoted to whole-frame are carried', () => {
        const b = fxBundle([{ fx: { rgbshift: 0.4, grain: 0.3, solarize: 0.8, threshold: 0.5, tint: 0.1, halftone: 0.6 } }]);
        eq([b.rgbshift, b.grain, b.solarize, b.threshold, b.tint, b.halftone], [0.4, 0.3, 0.8, 0.5, 0.1, 0.6]);
    });
    test('fxbundle: a NaN never reaches the renderer as a grade', () => {
        eq(fxBundle([{ fx: { sat: NaN } }]).sat, 1);
    });
}
