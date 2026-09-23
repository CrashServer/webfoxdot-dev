// No command may take a scene's name.
//
// visualBuilders() fills one object with a builder per scene and then adds the
// language's own commands to the same object. A command named after a scene silently
// replaces that scene's builder, and the failure is invisible from the code: the line
// still runs, the command does whatever it does, and no layer is ever created.
//
// That is not hypothetical. `camera()` was first written as `webcam()`, which is a
// scene, so `v1 >> webcam()` asked the browser for the camera and made no layer — the
// camera light came on and the screen stayed black, reported exactly that way.
import { visualBuilders } from '../../js/visuals/vlang.js';
import { SCENES, WS_SCENES } from '../../js/visuals/vdata.js';

// Known and accepted: `pixelsort` is one of crashDot's own post-FX as well as a
// workshop layer, and the FX loop in visualBuilders() overwrites scene names without
// a guard, so the FX wins. Sets in the wild already use pixelsort() as an effect, so
// changing which one answers would break them — it is recorded here rather than
// fixed, and the workshop layer of that name is simply unreachable.
const SHADOWED = new Set(['pixelsort']);

export default function ({ test, eq, ok }) {
    test('vbuilders: every scene name still builds its own layer', () => {
        const out = visualBuilders();
        const stolen = [];
        for (const name of [...SCENES, ...WS_SCENES]) {
            if (SHADOWED.has(name)) continue;
            const fn = out[name];
            if (typeof fn !== 'function') { stolen.push(`${name}: not a builder at all`); continue; }
            let spec;
            try { spec = fn(); } catch (e) { stolen.push(`${name}: threw (${e.message})`); continue; }
            // A scene builder returns a spec carrying that scene's name. A command
            // returns a string, a promise, undefined — anything but this.
            if (!spec || spec.scene !== name) stolen.push(`${name}: builds ${spec && spec.scene ? spec.scene : typeof spec}`);
        }
        eq(stolen.join(' | '), '', `a command has taken these scene names: ${stolen.join(', ')}`);
    });

    test('vbuilders: the accepted shadow is still exactly one name', () => {
        // If this list ever needs a second entry, something took a layer's name by
        // accident — which is the bug this file exists for.
        eq([...SHADOWED].join(','), 'pixelsort');
    });

    test('vbuilders: the camera command is not named after the camera layer', () => {
        const out = visualBuilders();
        ok(typeof out.camera === 'function', 'camera() is the device command');
        eq(out.webcam().scene, 'webcam', 'webcam() must still build the layer');
    });
}
