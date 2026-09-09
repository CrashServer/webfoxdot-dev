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

import { WORKSHOP_LAYERS, WORKSHOP_FX } from '../workshop/index.js';
import { visualBudget } from './vperf.js';
import { defaults, fxDefaults, fxPrimary } from '../workshop/catalog.js';
import { capSize } from './wsres.js';
import { LAYER_BLENDS, LAYER_BLEND_OPS, layerBlendIndex } from '../vdata.js';

const num = (x, d) => { const n = Number(x); return (x == null || Number.isNaN(n)) ? d : n; };

export function isWorkshopLayer(name) { return !!WORKSHOP_LAYERS[name]; }

export function createWorkshopDeck() {
    const cache = new Map();          // player name → { kind, canvas, ctx }
    const deck = [null, null];        // the two composite canvases, made on demand
    const dctx = [null, null];
    let W = 0, H = 0;

    function sized(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }

    // ── Per-layer frame budget ───────────────────────────────────────────────
    // What actually costs is the layer, not the size: slimemold runs a per-agent
    // simulation and takes ~17ms at EVERY resolution — more than a whole 60fps frame,
    // on the thread the note scheduler runs on. One such layer makes the audio late.
    //
    // crashDot's rule is that audio has priority, so a layer that cannot afford a
    // frame does not get one: each keeps an EMA of its own draw cost and redraws every
    // Nth frame, N chosen so its average stays under BUDGET_MS. Its canvas persists, so
    // the skipped frames still composite the last picture — a heavy layer runs at 30
    // or 20fps under a 60fps mix instead of dragging everything down to its own rate.
    // Cheap layers (0.1–0.8ms, which is nearly all of them) never throttle at all.
    const BUDGET_MS = () => visualBudget();
    const MAX_SKIP = 6;
    let frame = 0, phaseSeq = 0;

    function slotFor(name, kind, w, h) {
        let s = cache.get(name);
        if (s && s.kind !== kind) { cache.delete(name); s = null; }   // a new kind is a new instance
        if (!s) {
            const canvas = document.createElement('canvas');
            s = { kind, canvas, ctx: canvas.getContext('2d', { willReadFrequently: false }),
                  // cost EMA + redraw interval + PHASE — see the budget note. The phase
                  // is what keeps two throttled layers from landing on the same frame:
                  // without it, four layers each drawing every 6th frame all draw on
                  // frame 0, and the average is fine while every sixth frame is a
                  // disaster. The average was never the thing that makes audio late.
                  cost: null, every: 1, phase: phaseSeq++ };
            cache.set(name, s);
        }
        sized(s.canvas, w, h);
        return s;
    }

    // ── per-layer FX chain ───────────────────────────────────────────────────
    // A workshop effect is a canvas operation, so it runs on the LAYER's canvas
    // before it reaches the deck — which is the thing crashDot's own post-fx cannot
    // do, because those are uniforms applied once to the finished frame.
    //
    // The chain ping-pongs between two scratch canvases. They are module-scope in the
    // workshop because it applies one channel's whole stack before starting the next;
    // the same holds here (one layer at a time), so a pair per deck is enough.
    let fxA = null, fxB = null;
    function scratch(w, h) {
        if (!fxA) { fxA = document.createElement('canvas'); fxB = document.createElement('canvas'); }
        sized(fxA, w, h); sized(fxB, w, h);
        return [fxA, fxB];
    }

    // Stateful effects (feedback · datamosh · frameDiff · motionBlur) keep a buffer on
    // their stack ENTRY between frames, so the entries have to be held, not rebuilt.
    // Keyed by layer name + effect type; dropped with the layer.
    function entriesFor(s, fx) {
        const want = Object.keys(fx || {}).filter((k) => WORKSHOP_FX[k] && fx[k] !== false && fx[k] != null);
        if (!s.fx) s.fx = new Map();
        for (const k of [...s.fx.keys()]) if (!want.includes(k)) s.fx.delete(k);
        return want.map((type) => {
            let e = s.fx.get(type);
            if (!e) { e = { id: type, type, enabled: true, params: fxDefaults(type) }; s.fx.set(type, e); }
            // A bare bloom(0.4) sets the effect's FIRST declared param and leaves the
            // rest at their defaults — the same convention the wfx() bridge command uses.
            const v = fx[type];
            if (typeof v === 'number') { const pk = fxPrimary(type); if (pk) e.params[pk] = v; }
            else if (v && typeof v === 'object') Object.assign(e.params, v);
            return e;
        });
    }

    function applyFx(s, fx, w, h, t) {
        const chain = entriesFor(s, fx);
        if (!chain.length) return s.canvas;
        const [A, B] = scratch(w, h);
        let read = s.canvas, write = A, spare = B;
        for (const e of chain) {
            const kind = WORKSHOP_FX[e.type];
            const g = write.getContext('2d');
            g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, w, h);
            try { kind.apply(read, g, w, h, e.params, e, t); }
            catch (err) { if (!e.warned) { e.warned = true; console.warn(`visuals: fx "${e.type}" threw —`, err?.message || err); } continue; }
            read = write;
            const tmp = write; write = spare; spare = tmp;
        }
        return read;
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
    function render(layers, w, h, t, aud, liveCode = null) {
        [w, h] = capSize(Math.max(1, w | 0), Math.max(1, h | 0));
        if (w !== W || h !== H) { W = w; H = h; }

        // Drop the canvases of layers that are no longer live, so a long session does
        // not accumulate a canvas per name ever used.
        frame++;
        const live = new Set(layers.map((l) => l.name));
        for (const k of [...cache.keys()]) if (!live.has(k)) cache.delete(k);
        if (!layers.length) return { a: null, b: null };

        // `extra` is exactly what the workshop's channel.js hands a layer. spectrum is
        // the one that matters — the layers derive their own bass/mid/treble from it
        // with length-relative indices, so crashDot's 32 bins work unchanged.
        // `live` here is the live-CODING feed the code layers render, not to be confused
        // with the set of live LAYERS above — which is exactly the collision that made
        // this module fail to parse the first time.
        const extra = { spectrum: aud && aud.spectrum, message: null, cam: null, media: null, palette: null, live: liveCode };

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
            // Redraw only on this layer's own schedule; otherwise reuse its canvas.
            const due = ((frame + s.phase) % s.every) === 0 || s.cost == null;
            if (due) {
                s.ctx.clearRect(0, 0, w, h);
                const t0 = performance.now();
                try { kind.draw(s.ctx, w, h, p, t, extra); }
                catch (e) { if (!s.warned) { s.warned = true; console.warn(`visuals: workshop layer "${l.scene}" threw —`, e?.message || e); } continue; }
                const ms = performance.now() - t0;
                s.cost = s.cost == null ? ms : s.cost * 0.85 + ms * 0.15;
                const want = Math.max(1, Math.min(MAX_SKIP, Math.ceil(s.cost / BUDGET_MS())));
                if (want !== s.every) {
                    s.every = want;
                    if (want > 1 && !s.told) {
                        s.told = true;
                        console.info(`visuals: "${l.scene}" costs ${s.cost.toFixed(1)}ms a frame — drawing it every ${want} frames so the audio clock keeps its slot`);
                    }
                }
            }

            const painted = applyFx(s, l.fx, w, h, t);

            deckCanvas(d, w, h);
            const g = dctx[d];
            const first = !used[d];
            if (first) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); used[d] = true; }

            // crashDot's universal knobs, applied on the way into the deck so no layer
            // has to know about them: zoom/rot/pan as a transform, bright*gain as
            // alpha, and now opacity and blend — the same two controls the workshop
            // gives each of its channels.
            //
            // opacity and bright/gain both scale, and they are not the same thing:
            // bright is how bright the LAYER is, opacity is how much of it reaches the
            // deck. They multiply, which is what you would expect from a lamp behind a
            // curtain.
            const zoom = num(p.zoom, 1) || 1, rot = num(p.rot, 0);
            const px = num(p.panx, 0), py = num(p.pany, 0);
            const alpha = Math.max(0, Math.min(1,
                num(p.bright, 1) * num(p.gain, 1) * num(p.opacity, 1)));
            g.save();
            g.globalAlpha = alpha;
            // `max` is the default because it is what stacking did before this existed.
            // The FIRST layer onto a freshly cleared deck draws plainly: `multiply`
            // against transparent black is black, and `difference` against it is a
            // negative — a blend mode is a relationship, and the first layer has
            // nothing to be in a relationship with.
            g.globalCompositeOperation = first ? 'source-over'
                : (LAYER_BLEND_OPS[LAYER_BLENDS[layerBlendIndex(p.blend)]] || 'lighten');
            if (zoom !== 1 || rot || px || py) {
                g.translate(w / 2 + px * w, h / 2 + py * h);
                if (rot) g.rotate(rot);
                if (zoom !== 1) g.scale(zoom, zoom);
                g.translate(-w / 2, -h / 2);
            }
            g.drawImage(painted, 0, 0);
            g.restore();
        }
        return { a: used[0] ? deck[0] : null, b: used[1] ? deck[1] : null };
    }

    return {
        render,
        // Every live layer's own canvas, so an output surface can map ONE layer rather
        // than the finished mix — one face of a box showing the visuals, another
        // showing the code layer that is describing them.
        sources: () => [...cache].map(([name, s]) => ({ id: 'ws:' + name, label: name + ' (' + s.kind + ')', canvas: s.canvas })),
        // The budget already keeps an EMA of every layer's draw cost and the interval
        // it was throttled to — reading them back costs nothing, and it is the only
        // place that knows WHICH layer is expensive.
        stats: () => [...cache].map(([name, s]) => ({ name, kind: s.kind, cost: s.cost, every: s.every })),
        dispose() { cache.clear(); deck[0] = deck[1] = null; dctx[0] = dctx[1] = null; } };
}
