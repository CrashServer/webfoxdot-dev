// Visual language — the "visual synths" of crashDot. Lets you drive the pop-out
// visuals window from the SAME editor as your audio, in a FoxDot-close syntax:
//
//   v1 >> plasma(hue=0.6, speed=2)
//   v2 >> tunnel(hue=[0,.3], dur=4) + scan(.5)
//   v3 >> spectrum() + trails(.7) + vignette(.4)
//   v1.stop()
//
// `vN` player names route here instead of the audio engine (see __p in index.html).
// A scene call (plasma/tunnel/…) returns a VSpec; `+ fx(...)` merges post-fx onto it
// (the transpiler turns `a + b` into `a.__add__(b)`). Evaluating a vN player posts the
// layer to the visuals window over the BroadcastChannel; the compositor there resolves
// any patterned params against the beat clock and renders/blends the layers.

import { postVLayer, postVStop } from './bridge.js';

// The visual vocabulary — mirrors the scene set in clift.js (the renderer).
export const SCENES = ['plasma', 'tunnel', 'spectrum', 'wave', 'grid', 'rain',
    'aurora', 'cells', 'starfield', 'fire', 'ripple', 'interference',
    'helix', 'spiral', 'nebula', 'flow', 'lissajous', 'attractor'];

// Post-FX builders: fx(name) → a fx-only VSpec that `+`-merges onto a scene.
const VFX = { scan: 0.5, trails: 0.7, vignette: 0.5, glitch: 1, invert: true, posterize: 3 };

// A visual layer spec: a scene name + scene params (hue/speed/bright/dur/…) + post-fx.
export class VSpec {
    constructor(scene = null, params = {}, fx = {}) { this.scene = scene; this.params = params; this.fx = fx; }
    // `scene(...) + fx(...)` → merge. Later wins for shared keys; a scene name from
    // either side is kept. Non-VSpec addends (e.g. `+ 2`) are ignored — a visual
    // layer has no degree to transpose.
    __add__(other) {
        if (!(other instanceof VSpec)) return this;
        return new VSpec(other.scene || this.scene,
            { ...this.params, ...other.params },
            { ...this.fx, ...other.fx });
    }
}

// scene(hue=.6, speed=2) — kwargify has already turned kwargs into a trailing object,
// so we just pick up the params object (positionals are ignored).
function sceneBuilder(name) {
    return (...args) => {
        const params = args.find(a => a && typeof a === 'object' && !Array.isArray(a)) || {};
        return new VSpec(name, params, {});
    };
}
// scan(.5) / invert() / posterize(3) — a fx-only spec. Bare call uses the default.
function fxBuilder(key, dflt) {
    return (v) => new VSpec(null, {}, { [key]: v === undefined ? dflt : v });
}

// A vN player: assigning to it (`>>`) posts/updates a layer; `.stop()` removes it.
class VisualPlayer {
    constructor(name) { this.name = name; }
    __rshift__(spec, reset) {
        const s = spec instanceof VSpec ? spec : new VSpec();
        postVLayer(this.name, { scene: s.scene, params: s.params, fx: s.fx, reset: !!reset });
        return this;
    }
    stop() { postVStop(this.name); return this; }
    // Tolerate FoxDot-isms so `v1.<anything>()` chained live never throws.
    every() { return this; }
    setAttr() { return this; }
}

const _players = new Map();
export function getVisualPlayer(name) {
    let p = _players.get(name);
    if (!p) { p = new VisualPlayer(name); _players.set(name, p); }
    return p;
}

// vN — v followed by digits (v1, v2, v12) is a visual layer id.
export function isVisualName(name) { return /^v\d+$/.test(name); }

// The scene + fx builder functions to merge into the editor's eval scope.
export function visualBuilders() {
    const out = {};
    for (const s of SCENES) out[s] = sceneBuilder(s);
    for (const [k, d] of Object.entries(VFX)) out[k] = fxBuilder(k, d);
    return out;
}
