// layerworker.js — draws the expensive workshop layers off the main thread.
//
// The main thread's job during a set is the clock: notes are dispatched from it, so
// anything that blocks it for longer than the lookahead makes notes late. Most layers
// are far too cheap to matter — 180 of 186 draw in under 24ms and the frame budget
// hides them completely. A handful cannot be hidden, because the budget's throttle is
// capped at every 6th frame on purpose (past that the picture visibly stutters), so a
// layer that takes 240ms to draw still costs 40ms of main thread per frame however
// the budget is set. Those are the ones that come here.
//
// One worker hosts every offloaded layer rather than one worker each: the layer
// registry is 1.3MB of modules and parsing it per layer would cost more than it saves.
// They draw in sequence, which is fine — the point is that the sequence is not on the
// thread the clock lives on.
//
// Each layer gets its own OffscreenCanvas, because layers keep state keyed by their
// context and sharing one would make two layers fight over the same particle system.

import { WORKSHOP_LAYERS } from '../workshop/index.js';

const slots = new Map();   // id -> { cv, ctx, kind, name }

self.onmessage = (e) => {
    const m = e.data;

    if (m.cmd === 'open') {
        const kind = WORKSHOP_LAYERS[m.name];
        if (!kind || typeof kind.draw !== 'function') {
            self.postMessage({ cmd: 'opened', id: m.id, ok: false, why: 'no such layer' });
            return;
        }
        const cv = new OffscreenCanvas(Math.max(1, m.w | 0), Math.max(1, m.h | 0));
        slots.set(m.id, { cv, ctx: cv.getContext('2d', { willReadFrequently: false }), kind, name: m.name });
        self.postMessage({ cmd: 'opened', id: m.id, ok: true });
        return;
    }

    if (m.cmd === 'close') { slots.delete(m.id); return; }

    if (m.cmd === 'frame') {
        const s = slots.get(m.id);
        if (!s) { self.postMessage({ cmd: 'frame', id: m.id, err: 'not open' }); return; }
        // A resize is a new canvas: layers size their grids and populations from w/h
        // on first draw and rebuild when it changes, so the context has to survive a
        // steady size and be replaced when it really moves.
        if (s.cv.width !== m.w || s.cv.height !== m.h) {
            s.cv = new OffscreenCanvas(Math.max(1, m.w | 0), Math.max(1, m.h | 0));
            s.ctx = s.cv.getContext('2d', { willReadFrequently: false });
        }
        const t0 = performance.now();
        try {
            s.ctx.globalAlpha = 1;
            s.ctx.globalCompositeOperation = 'source-over';
            s.ctx.setTransform(1, 0, 0, 1, 0, 0);
            s.kind.draw(s.ctx, s.cv.width, s.cv.height, m.params, m.t, m.extra || {});
        } catch (err) {
            self.postMessage({ cmd: 'frame', id: m.id, err: String(err && err.message || err) });
            return;
        }
        const ms = performance.now() - t0;
        // transferToImageBitmap hands the pixels over without copying them, and leaves
        // this canvas cleared for the next draw — which is why each layer that paints
        // its own fade keeps working: it fades what it drew, not what we kept.
        const bmp = s.cv.transferToImageBitmap();
        self.postMessage({ cmd: 'frame', id: m.id, ms, bmp }, [bmp]);
    }
};
