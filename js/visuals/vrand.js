// ── vrand() — a random look, written as code ─────────────────────────────────
//
// The visual twin of chaos(), and it works the same way on purpose: it does not
// change what is on screen, it PASTES LINES you read, edit and run. In crashDot the
// piece is the text, so a generator that mutates hidden state gives you a picture you
// cannot keep, cannot edit and cannot share; a generator that writes code gives you
// all three, and it reaches a jam because the buffer does.
//
// Ported in spirit from the workshop's randomize.js, with two changes.
//
// It is SEEDED. The workshop rerolls with Math.random, which is right for a button on
// a desk and wrong for something whose output is code: vrand(4, 1234) gives everyone
// the same four layers, so a look can be described in a message. Called without a
// seed it picks one and writes it into the comment, so a happy accident is
// reproducible after the fact — which is the thing you always want and never have.
//
// And it randomises within each param's OWN declared range, from the generated
// catalog (1,987 of them), rather than a shared 0..1. A cutoff at 0.5 and a particle
// count at 0.5 are not the same request.

import { SCENES, SCENE_PARAMS, WS_SCENES, WS_FX_NAMES } from './vdata.js';
import { WORKSHOP_RANGES } from './workshop/catalog.js';

// Layers that need something you have not given them (a camera, a file) or that exist
// for debugging draw nothing useful when picked blind — the workshop excludes the same
// set from its own reroll, for the same reason.
const SKIP = new Set(['webcam', 'media', 'gifbank', 'testpat', 'black', 'text', 'cityosm', 'mastofeed']);

// FX that read well without tuning. The rest are not worse, they just need a value
// chosen on purpose rather than at random.
const NICE_FX = ['bloom', 'blur', 'vignette', 'feedback', 'edge', 'chromaticAberration',
    'tint', 'grain', 'zoomPulse', 'posterize', 'solarize', 'scanlines', 'mirror',
    'glitch', 'ripple', 'duotone', 'hueRotate', 'neonGlow', 'thermal', 'sliceGlitch',
    'kaleidoscope', 'zoomBurst', 'echoZoom', 'droste', 'lensFlare', 'pixelDrift', 'vhs'];

// A small deterministic PRNG (mulberry32) — the point of the seed is that the same
// number gives the same look on any machine, which Math.random cannot promise.
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const round = (v) => {
    const a = Math.abs(v);
    if (a >= 100) return Math.round(v);
    if (a >= 10) return Math.round(v * 10) / 10;
    return Math.round(v * 1000) / 1000;
};

/**
 * @param {number} n     how many layers
 * @param {number} seed  omit for a fresh one — it is written into the comment
 * @returns {string} lines to paste
 */
export function vrandLines(n = 2, seed = null) {
    const s = (seed == null || !isFinite(seed)) ? (Math.random() * 1e9) | 0 : seed | 0;
    const r = rng(s);
    const pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];

    const wsPool = WS_SCENES.filter((k) => !SKIP.has(k));
    const count = Math.max(1, Math.min(6, n | 0 || 2));
    const lines = [`# vrand(${count}, ${s})  — run vrand(${count}, ${s}) for exactly this again`];

    for (let i = 0; i < count; i++) {
        // Mostly workshop layers (there are far more of them and they are the reason
        // to reroll at all), sometimes a field scene, which the palette then colours.
        const isField = r() < 0.3;
        const scene = isField ? pick(SCENES) : pick(wsPool);
        const args = [];

        if (isField) {
            // A field scene declares few params and no ranges, so move what it has
            // around its own default rather than inventing a scale for it.
            for (const p of (SCENE_PARAMS[scene] || [])) {
                if (r() < 0.45) continue;
                const d = Number(p.d) || 0;
                // A default of 0 carries no scale — in mosaic it even means "same as
                // cells" — so there is nothing to randomise AROUND. Leave it at its
                // default rather than inventing a number for it; rows=0.248 is not a
                // look, it is a guess with decimals.
                if (d === 0) continue;
                let v = d * (0.4 + r() * 1.8);
                // A COUNT is not a dial. arms, sectors, petals, cells, divisions —
                // anything whose default is a whole number 2 or more is a quantity, and
                // metaballs(count=1.84) is not a look, it is a mistake with decimals.
                if (Number.isInteger(d) && d >= 2) v = Math.max(1, Math.round(v));
                args.push(`${p.n}=${round(v)}`);
            }
            if (r() < 0.6) args.push(`speed=${round(0.3 + r() * 2.2)}`);
        } else {
            const ranges = WORKSHOP_RANGES[scene] || {};
            const keys = Object.keys(ranges);
            // Not every knob, or the line is unreadable and nothing stands out. A
            // third of them, which is enough to make it a different picture.
            for (const k of keys) {
                if (r() > 0.34) continue;
                const [base, min, max] = ranges[k];
                let v = min + r() * (max - min);
                // A param whose base AND bounds are all whole numbers is counting
                // something — rows, segments, iterations. Reading it off the declared
                // triple beats a magnitude threshold: scrollingtext declares rows as
                // base 1 over [1,4], which "2 or more" would have missed, and it is
                // every bit as much a count as a 20.
                if (Number.isInteger(base) && Number.isInteger(min) && Number.isInteger(max))
                    v = Math.max(min, Math.min(max, Math.round(v)));
                args.push(`${k}=${round(v)}`);
            }
        }
        if (count > 1) args.push(`ch=${i % 2}`);

        let line = `video${i + 1} >> ${scene}(${args.join(', ')})`;
        if (r() < 0.55) line += ` + ${pick(NICE_FX)}(${round(0.2 + r() * 0.6)})`;
        if (r() < 0.25) line += ` + ${pick(NICE_FX)}(${round(0.2 + r() * 0.6)})`;
        lines.push(line);
    }

    if (count > 1) lines.push(`video9 >> mix(sinvar([0, 1], ${pick([8, 16, 32, 64])}))`);
    if (r() < 0.5) lines.push(`palette("${pick(['fire', 'ice', 'neon', 'cyber', 'sunset', 'matrix', 'blood', 'mono'])}")`);
    return lines;
}

export { NICE_FX as VRAND_FX };
