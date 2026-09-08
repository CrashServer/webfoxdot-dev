// compositor.js — THE mixer. Per cell it samples deck A (ch-0 layers) and deck B (ch-1
// layers), each combined by field-MAX (stacking never blows out), colourises each deck
// with its palette, then crosses A↔B with the blend mode. Mixing happens in value space
// then colour — that's what keeps overlap + blend coherent.
//
// Every layer also gets universal knobs for free (applied here, so no scene re-codes):
//   coords → zoom · rot · panx · pany      value → bright · gain · contrast · inv
// on top of each scene's own speed / scale / hue / pal.

import { getScene } from './scenes/index.js';
import { blendByIndex } from './blends.js';
import { sample as paletteSample } from './palette.js';
import { layerBlendIndex } from '../vdata.js';

const _a = [0, 0, 0], _b = [0, 0, 0], _out = [0, 0, 0];
const cl01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const num = (x, d) => { const n = Number(x); return (x == null || Number.isNaN(n)) ? d : n; };

// A deck = its layers (with per-layer transforms precomputed once) + palette + hue.
function deck(layers, globalPalette) {
    const items = []; let pal = globalPalette, hue = 0;
    for (const l of layers) {
        const sc = getScene(l.scene); if (!sc) continue;
        const p = l.params || {};
        const rot = num(p.rot, 0), zoom = num(p.zoom, 1);
        items.push({
            fn: sc.field, p,
            cos: Math.cos(rot), sin: Math.sin(rot), iz: zoom === 0 ? 1 : 1 / zoom,
            px: num(p.panx, 0), py: num(p.pany, 0),
            bright: num(p.bright, 1), gain: num(p.gain, 1), contrast: num(p.contrast, 0), inv: p.inv === true || p.inv === 1,
            opacity: Math.max(0, Math.min(1, num(p.opacity, 1))), blend: layerBlendIndex(p.blend),
        });
        if (p.pal != null) pal = p.pal;                 // last layer on the deck sets its palette / hue
        if (p.hue != null) hue = num(p.hue, 0);
    }
    return { items, pal, hue };
}

// Sample one layer: transform the coords, run the field, transform the value.
function sampleLayer(L, u, v, t, a) {
    let du = (u - 0.5) * L.iz, dv = (v - 0.5) * L.iz;               // zoom about centre
    if (L.sin) { const nu = du * L.cos - dv * L.sin, nv = du * L.sin + dv * L.cos; du = nu; dv = nv; }   // rotate
    let f = L.fn(du + 0.5 - L.px, dv + 0.5 - L.py, t, L.p, a);      // pan
    f = f * L.bright * L.gain;
    if (L.contrast) f = 0.5 + (f - 0.5) * (1 + L.contrast);         // contrast about mid
    if (L.inv) f = 1 - f;
    return f < 0 ? 0 : f > 1 ? 1 : f;
}

// Mirrors blendVal() in the GL scene shader exactly — the two backends must not
// disagree about what stacking means, or switching to a glyph mode changes the picture.
function blendVal(op, a, b) {
    if (op === 1) return Math.min(1, a + b);
    if (op === 2) return a * b;
    if (op === 3) return 1 - (1 - a) * (1 - b);
    if (op === 4) return Math.abs(a - b);
    if (op === 5) return b;
    return a > b ? a : b;
}

export function composite(grid, vstate, t, audio) {
    const { cols, rows, val, r, gch, b } = grid;
    const layers = vstate.layers || [];
    const A = deck(layers.filter((l) => l.ch !== 1), vstate.palette);
    const B = deck(layers.filter((l) => l.ch === 1), vstate.palette);

    let x = vstate.mix ? vstate.mix.value : (B.items.length && !A.items.length ? 1 : 0);
    x = cl01(x);
    const blend = blendByIndex(vstate.mix ? vstate.mix.blend : 0);
    const nA = A.items.length, nB = B.items.length;

    for (let j = 0; j < rows; j++) {
        const vv = rows > 1 ? j / (rows - 1) : 0;
        const row = j * cols;
        for (let i = 0; i < cols; i++) {
            const uu = cols > 1 ? i / (cols - 1) : 0;
            let av = 0; for (let s = 0; s < nA; s++) av = blendVal(A.items[s].blend, av, sampleLayer(A.items[s], uu, vv, t, audio) * A.items[s].opacity);
            let bv = 0; for (let s = 0; s < nB; s++) bv = blendVal(B.items[s].blend, bv, sampleLayer(B.items[s], uu, vv, t, audio) * B.items[s].opacity);
            const ca = paletteSample(A.pal, av, A.hue); _a[0] = ca[0]; _a[1] = ca[1]; _a[2] = ca[2];
            const cb = paletteSample(B.pal, bv, B.hue); _b[0] = cb[0]; _b[1] = cb[1]; _b[2] = cb[2];
            const mv = blend(av, bv, _a, _b, x, uu, vv, _out);
            const idx = row + i;
            val[idx] = cl01(mv); r[idx] = _out[0]; gch[idx] = _out[1]; b[idx] = _out[2];
        }
    }
}
