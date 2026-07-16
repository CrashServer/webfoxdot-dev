// compositor.js — THE mixer. For every cell it evaluates deck A (ch 0 layers) and deck
// B (ch 1 layers), each combined by field-MAX so stacked scenes on one deck never blow
// out; colourises each deck with its palette; then crosses A↔B with the blend mode.
// The mixing happens in field/value space, then colour — that's what makes overlap +
// blend coherent. It imports zero concrete scenes/blends (all via the registries).

import { getScene } from './scenes/index.js';
import { blendByIndex } from './blends.js';
import { sample as paletteSample } from './palette.js';

const _a = [0, 0, 0], _b = [0, 0, 0], _out = [0, 0, 0];
const cl01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;

// A deck = the resolved scene fns for a channel + its palette / brightness / hue.
function deck(layers, globalPalette) {
    const scenes = [];
    let pal = globalPalette, bright = 1, hue = 0;
    for (const l of layers) {
        const sc = getScene(l.scene); if (!sc) continue;
        scenes.push({ fn: sc.field, p: l.params || {} });
        if (l.params) {
            if (l.params.pal != null) pal = l.params.pal;          // last layer on the deck sets its palette
            if (l.params.bright != null) bright = Number(l.params.bright) || 1;
            if (l.params.hue != null) hue = Number(l.params.hue) || 0;
        }
    }
    return { scenes, pal, bright, hue };
}

export function composite(grid, vstate, t, audio) {
    const { cols, rows, val, r, gch, b } = grid;
    const layers = vstate.layers || [];
    const A = deck(layers.filter((l) => l.ch !== 1), vstate.palette);
    const B = deck(layers.filter((l) => l.ch === 1), vstate.palette);

    // crossfader: explicit mix() value, else auto (only-A → 0, only-B → 1)
    let x = vstate.mix ? vstate.mix.value : (B.scenes.length && !A.scenes.length ? 1 : 0);
    x = cl01(x);
    const blend = blendByIndex(vstate.mix ? vstate.mix.blend : 0);
    const nA = A.scenes.length, nB = B.scenes.length;

    for (let j = 0; j < rows; j++) {
        const vv = rows > 1 ? j / (rows - 1) : 0;
        const row = j * cols;
        for (let i = 0; i < cols; i++) {
            const uu = cols > 1 ? i / (cols - 1) : 0;
            let av = 0; for (let s = 0; s < nA; s++) { const f = A.scenes[s].fn(uu, vv, t, A.scenes[s].p, audio); if (f > av) av = f; }
            let bv = 0; for (let s = 0; s < nB; s++) { const f = B.scenes[s].fn(uu, vv, t, B.scenes[s].p, audio); if (f > bv) bv = f; }
            av = cl01(av); bv = cl01(bv);
            const ca = paletteSample(A.pal, av * A.bright, A.hue); _a[0] = ca[0]; _a[1] = ca[1]; _a[2] = ca[2];
            const cb = paletteSample(B.pal, bv * B.bright, B.hue); _b[0] = cb[0]; _b[1] = cb[1]; _b[2] = cb[2];
            const mv = blend(av, bv, _a, _b, x, uu, vv, _out);
            const idx = row + i;
            val[idx] = cl01(mv);
            r[idx] = _out[0]; gch[idx] = _out[1]; b[idx] = _out[2];
        }
    }
}
