// ── Workshop layer deck ──────────────────────────────────────────────────────
//
// The bridge between the two kinds of scene crashDot now has.
//
// A crashDot scene is a pure scalar field, evaluated per-pixel in one shader. A
// workshop layer is an imperative RGBA draw — draw(ctx, w, h, p, t, extra) — that
// owns its colour AND its state. It cannot go in the shader, so it renders here, on
// the CPU, into a canvas per deck; the renderer takes those two canvases as textures
// and folds them into the same crossfade the field scenes go through.
//
// Two things about workshop layers drive the design.
//
// STATE IS KEYED BY CONTEXT. Every layer that remembers anything between frames does
// it with `_state.get(ctx)` on a module-level WeakMap. So each live layer needs its
// OWN canvas, kept for as long as that layer is on screen: share one and their states
// collide; recreate it per frame and every particle system restarts sixty times a
// second. The cache below is that guarantee, keyed by the player name, and dropped
// the moment the name stops being a workshop layer or changes kind.
//
// THEY SIZE THEMSELVES FROM w/h. Many build a grid or a particle population on the
// first frame and rebuild when the size changes, so resizing is cheap but not free —
// the cache resizes only when the deck size actually changes.

import { WORKSHOP_LAYERS, defaults } from '../workshop/index.js';

const num = (x, d) => { const n = Number(x); return (x == null || Number.isNaN(n)) ? d : n; };

export function isWorkshopLayer(name) { return !!WORKSHOP_LAYERS[name]; }

export function createWorkshopDeck() {
    const cache = new Map();          // player name → { kind, canvas, ctx }
    const deck = [null, null];        // the two composite canvases, made on demand
    const dctx = [null, null];
    let W = 0, H = 0;

    function sized(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }

    function slotFor(name, kind, w, h) {
        let s = cache.get(name);
        if (s && s.kind !== kind) { cache.delete(name); s = null; }   // a new kind is a new instance
        if (!s) {
            const canvas = document.createElement('canvas');
            s = { kind, canvas, ctx: canvas.getContext('2d', { willReadFrequently: false }) };
            cache.set(name, s);
        }
        sized(s.canvas, w, h);
        return s;
    }

    function deckCanvas(i, w, h) {
        if (!deck[i]) { deck[i] = document.createElement('canvas'); dctx[i] = deck[i].getContext('2d'); }
        sized(deck[i], w, h);
        return i;
    }

    /**
     * @param {Array}  layers  resolved layers whose `scene` is a workshop kind
     * @param {number} w,h     deck size in px (the renderer's backing size)
     * @param {number} t       seconds
     * @param {object} aud     { bass, mid, treble, level, spectrum }
     * @returns {{a: HTMLCanvasElement|null, b: HTMLCanvasElement|null}}
     */
    function render(layers, w, h, t, aud) {
        w = Math.max(1, w | 0); h = Math.max(1, h | 0);
        if (w !== W || h !== H) { W = w; H = h; }

        // Drop the canvases of layers that are no longer live, so a long session does
        // not accumulate a canvas per name ever used.
        const live = new Set(layers.map((l) => l.name));
        for (const k of [...cache.keys()]) if (!live.has(k)) cache.delete(k);
        if (!layers.length) return { a: null, b: null };

        // `extra` is exactly what the workshop's channel.js hands a layer. spectrum is
        // the one that matters — the layers derive their own bass/mid/treble from it
        // with length-relative indices, so crashDot's 32 bins work unchanged.
        const extra = { spectrum: aud && aud.spectrum, message: null, cam: null, media: null, palette: null, live: null };

        const used = [false, false];
        for (const l of layers) {
            const kind = WORKSHOP_LAYERS[l.scene];
            if (!kind) continue;
            const d = l.ch === 1 ? 1 : 0;
            const s = slotFor(l.name, l.scene, w, h);
            const p = { ...defaults(l.scene), ...(l.params || {}) };
            if (extra.message == null && typeof p.text === 'string') extra.message = p.text;

            // Reset the context the way channel.js does: layers that leak globalAlpha or
            // a composite mode would otherwise corrupt the next frame.
            s.ctx.globalAlpha = 1;
            s.ctx.globalCompositeOperation = 'source-over';
            s.ctx.setTransform(1, 0, 0, 1, 0, 0);
            s.ctx.clearRect(0, 0, w, h);
            try { kind.draw(s.ctx, w, h, p, t, extra); }
            catch (e) { if (!s.warned) { s.warned = true; console.warn(`visuals: workshop layer "${l.scene}" threw —`, e?.message || e); } continue; }

            deckCanvas(d, w, h);
            const g = dctx[d];
            if (!used[d]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); used[d] = true; }

            // crashDot's universal knobs, applied on the way into the deck so no layer
            // has to know about them: zoom/rot/pan as a transform, bright*gain as alpha.
            const zoom = num(p.zoom, 1) || 1, rot = num(p.rot, 0);
            const px = num(p.panx, 0), py = num(p.pany, 0);
            const alpha = Math.max(0, Math.min(1, num(p.bright, 1) * num(p.gain, 1)));
            g.save();
            g.globalAlpha = alpha;
            if (zoom !== 1 || rot || px || py) {
                g.translate(w / 2 + px * w, h / 2 + py * h);
                if (rot) g.rotate(rot);
                if (zoom !== 1) g.scale(zoom, zoom);
                g.translate(-w / 2, -h / 2);
            }
            g.drawImage(s.canvas, 0, 0);
            g.restore();
        }
        return { a: used[0] ? deck[0] : null, b: used[1] ? deck[1] : null };
    }

    return { render, dispose() { cache.clear(); deck[0] = deck[1] = null; dctx[0] = dctx[1] = null; } };
}
