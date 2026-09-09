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

/**
 * @param {Array} layers  the live layers ({ ws, fx } each)
 * @returns {object}      one bundle of resolved FX values for the frame
 */
export function fxBundle(layers) {
    // A workshop layer's FX are applied per-layer, on its own canvas, by wsdeck.js. If
    // they were counted here as well they would run TWICE — and for invert that means
    // not at all, since inverting twice is the identity. So a key is skipped on a `ws`
    // layer when the workshop implements it; anything the workshop does NOT have
    // (trails, scan, fold, hueshift, pixelsort) still falls through to this global pass.
    const mx = (key, d = 0) => {
        let m = d;
        for (const l of layers) {
            if (l.ws && WS_FX.has(key)) continue;
            const f = l.fx && l.fx[key];
            if (typeof f === 'number' && f > m) m = f;
            else if (f === true && m < 1) m = 1;
        }
        return m;
    };
    const grade = (key) => {
        let m = 1, best = 0;
        for (const l of layers) {
            const v = l.fx && l.fx[key];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            const d = Math.abs(v - 1);
            if (d > best) { best = d; m = v; }
        }
        return m;
    };
    const ceiling = () => {
        let m = 1;
        for (const l of layers) { const v = l.fx && l.fx.ceiling; if (typeof v === 'number' && v < m) m = v; }
        return m;
    };
    return {
        sat: grade('sat'), exposure: grade('exposure'), contrast: grade('contrast'), ceiling: ceiling(),
        trails: mx('trails'), feedback: mx('feedback'), glitch: mx('glitch'), scan: mx('scan'),
        vignette: mx('vignette'), invert: mx('invert') >= 1, blur: mx('blur'), bloom: mx('bloom'),
        posterize: mx('posterize'), droste: mx('droste'), fold: mx('fold'), hueshift: mx('hueshift'),
        dither: mx('dither'), pixelsort: mx('pixelsort'), mirror: mx('mirror'), edge: mx('edge'),
        pixelate: mx('pixelate'),
        // Deck-to-deck and the frame recolour. lut is an INDEX, not an amount, so the
        // loudest-intent rule would be wrong for it in principle — but with one value
        // per frame and no meaningful ordering between palettes, "the last layer to
        // ask wins" and "the highest index wins" are equally arbitrary, and mx() is
        // the one every other key already uses.
        displace: mx('displace'), lumakey: mx('lumakey'), matte: mx('matte'),
        freeze: mx('freeze'), lut: mx('lut'),
        // lutmix is NEUTRAL AT 1 like the grade keys, not at 0 like everything else:
        // mx() only ever takes a value LARGER than what it has, so a lutmix of 0.5
        // could never win against its own default and a partial tint was impossible.
        lutmix: grade('lutmix'),
    };
}
