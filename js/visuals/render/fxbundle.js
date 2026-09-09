// fxBundle — resolve the whole frame's post-FX from the live layers.
//
// The renderer takes ONE bundle for the frame, so when two layers ask for different
// amounts of the same effect they have to be reconciled here. Three rules, because
// the keys mean three different kinds of thing:
//
//   amounts   neutral at 0, so the loudest intent wins (glitch, blur, trails, …)
//   grades    neutral at 1, so the value FURTHEST FROM NEUTRAL wins (sat, contrast,
//             exposure, lutmix) — max() would let a default beat a real setting
//   ceiling   a promise not to exceed, so the LOWEST wins
//
// ── Why this is its own file ─────────────────────────────────────────────────
// It has two callers in two different documents: surface.js drives every surface in
// the main window (the SCREEN panel, the editor backdrop), and render/main.js drives
// the projection pop-out, which is a separate page with no visual language of its own.
// They each had their own copy, and surface.js's header claimed to be "the one copy"
// while main.js still carried a second — which then drifted: the pop-out silently
// applied none of displace/lumakey/matte/freeze/lut/lutmix, so the newest FX worked
// everywhere EXCEPT the surface you project from.
//
// A leaf module is what makes one copy possible. main.js importing surface.js would
// drag vlang and the bridge — window opening, timers, the whole main-window apparatus
// — into a page that deliberately has none of it. Same reason vperf.js and wsres.js
// are separate: the shared thing has to be smaller than either caller.

import { WORKSHOP_FX_NAMES } from '../workshop/catalog.js';

const WS_FX = new Set(WORKSHOP_FX_NAMES);

// ── The keys, and which rule each follows ────────────────────────────────────
// AMOUNT keys are neutral at 0 → loudest intent wins.
const AMOUNT = ['trails', 'feedback', 'glitch', 'scan', 'vignette', 'invert', 'blur', 'bloom',
                'posterize', 'droste', 'fold', 'hueshift', 'dither', 'pixelsort', 'mirror',
                'edge', 'pixelate', 'displace', 'lumakey', 'matte', 'freeze', 'lut'];
// GRADE keys are neutral at 1 → furthest from neutral wins. lutmix is one of these:
// max() only ever takes a LARGER value, so a lutmix of 0.5 could never beat its own
// default and a partial tint was impossible.
const GRADE  = ['sat', 'exposure', 'contrast', 'lutmix'];
const IS_GRADE = new Set(GRADE);

/**
 * @param {Array} layers  the live layers ({ ws, fx } each)
 * @returns {object}      one bundle of resolved FX values for the frame
 */
export function fxBundle(layers) {
    // ONE pass over the layers. This used to run a closure per key — 26 of them, each
    // walking the whole layer list — plus a fresh 27-key object, on every frame of
    // every surface. Now each layer is visited once and only the keys it actually
    // declares are touched, which for a typical stack is a handful rather than 26xN.
    const out = {};
    for (const k of AMOUNT) out[k] = 0;
    for (const k of GRADE)  out[k] = 1;
    out.ceiling = 1;
    const best = { sat: 0, exposure: 0, contrast: 0, lutmix: 0 };   // distance from neutral

    for (const l of layers) {
        const fx = l.fx;
        if (!fx) continue;
        for (const key in fx) {
            const v = fx[key];
            if (v == null) continue;
            if (IS_GRADE.has(key)) {
                if (typeof v !== 'number' || !isFinite(v)) continue;
                const d = Math.abs(v - 1);
                if (d > best[key]) { best[key] = d; out[key] = v; }
            } else if (key === 'ceiling') {
                // A ceiling is a promise not to exceed, so two layers asking for
                // different ones resolve to the LOWER.
                if (typeof v === 'number' && v < out.ceiling) out.ceiling = v;
            } else if (out[key] !== undefined) {
                // A workshop layer's FX are applied per-layer, on its own canvas, by
                // wsdeck.js. Counting them here as well would run them TWICE — and for
                // invert that means not at all, since inverting twice is the identity.
                // Anything the workshop does NOT have (trails, scan, fold, hueshift,
                // pixelsort) still falls through to this global pass.
                if (l.ws && WS_FX.has(key)) continue;
                if (typeof v === 'number') { if (v > out[key]) out[key] = v; }
                else if (v === true && out[key] < 1) out[key] = 1;
            }
        }
    }
    // invert is a switch, not an amount — the renderer wants a boolean.
    out.invert = out.invert >= 1;
    return out;
}
