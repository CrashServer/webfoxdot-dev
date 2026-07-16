// blends.js — how deck A and deck B combine at the crossfader. Each blend is called
// per cell with the two decks' value + colour and the crossfader x ∈ [0,1]; it writes
// the mixed colour into `out` (no allocation on the hot path) and returns the mixed
// value (which drives the glyph in glyph render modes). u,v let spatial blends (wipe /
// dissolve) decide per position. Order matches vdata.BLEND_MODES so mix(blend=…) maps.

const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
function hash(u, v) { const s = Math.sin(u * 127.1 + v * 311.7) * 43758.5453; return s - Math.floor(s); }

export const BLEND_LIST = ['mix', 'add', 'screen', 'multiply', 'difference', 'wipe', 'dissolve'];

export const BLENDS = {
    // classic crossfade — A at x=0, B at x=1
    mix(av, bv, a, b, x, u, vv, out) {
        out[0] = a[0] + (b[0] - a[0]) * x; out[1] = a[1] + (b[1] - a[1]) * x; out[2] = a[2] + (b[2] - a[2]) * x;
        return av + (bv - av) * x;
    },
    // additive — B fades IN on top of A (never replaces it), clamped
    add(av, bv, a, b, x, u, vv, out) {
        out[0] = cl(a[0] + b[0] * x); out[1] = cl(a[1] + b[1] * x); out[2] = cl(a[2] + b[2] * x);
        return Math.min(1, av + bv * x);
    },
    // screen — softer additive (brightens without hard clipping)
    screen(av, bv, a, b, x, u, vv, out) {
        const s = (p, q) => 255 - (255 - p) * (255 - q * x) / 255;
        out[0] = s(a[0], b[0]); out[1] = s(a[1], b[1]); out[2] = s(a[2], b[2]);
        return 1 - (1 - av) * (1 - bv * x);
    },
    // multiply — B masks A darker as x rises
    multiply(av, bv, a, b, x, u, vv, out) {
        const m = (p, q) => p * (1 - x + x * q / 255);
        out[0] = m(a[0], b[0]); out[1] = m(a[1], b[1]); out[2] = m(a[2], b[2]);
        return av * (1 - x + x * bv);
    },
    // difference — high-contrast, glitchy
    difference(av, bv, a, b, x, u, vv, out) {
        out[0] = Math.abs(a[0] - b[0] * x); out[1] = Math.abs(a[1] - b[1] * x); out[2] = Math.abs(a[2] - b[2] * x);
        return Math.abs(av - bv * x);
    },
    // wipe — a hard vertical edge sweeping A→B as x grows
    wipe(av, bv, a, b, x, u, vv, out) {
        const B = u < x; const s = B ? b : a;
        out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
        return B ? bv : av;
    },
    // dissolve — per-cell random threshold, a grainy cut
    dissolve(av, bv, a, b, x, u, vv, out) {
        const B = hash(u * 97, vv * 61) < x; const s = B ? b : a;
        out[0] = s[0]; out[1] = s[1]; out[2] = s[2];
        return B ? bv : av;
    },
};

export function blendByIndex(i) { return BLENDS[BLEND_LIST[i | 0] || 'mix'] || BLENDS.mix; }
