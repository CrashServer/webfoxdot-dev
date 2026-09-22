// wsoffload.js — the main-thread half of drawing heavy layers in a worker.
//
// The contract with wsdeck is deliberately small: ask whether a layer is offloaded,
// hand over this frame's params, and take back whatever bitmap is ready. Nothing here
// ever waits for the worker. The deck composites the most recent bitmap it has, which
// is typically one frame old and, for a layer that was being throttled to every 6th
// frame before this existed, considerably fresher than what it replaced.
//
// Everything degrades to nothing: no worker, no OffscreenCanvas, a layer that throws,
// a browser without module workers — `bitmapFor` returns null and the deck draws it
// on the main thread exactly as it always did.

// Measured with tools/bench-layers.mjs: these draw for longer than the frame budget's
// throttle can hide (its cap is every 6th frame, on purpose), so they cost main-thread
// time no matter how the budget is set. starnest and fractalkaleidoscope belong here
// too on cost, but they reach for `document` and a worker has none.
export const OFFLOAD = new Set(['audiotterrain', 'holographicwave', 'kalitunnel', 'slimemold']);

let worker = null;
let started = false;      // tried to start, successfully or not
let broken = false;       // gave up; never try again this session
let nextId = 1;
const slots = new Map();  // layerName -> { id, opened, inFlight, bmp, ms, w, h, fails }
let _log = null;

export function setOffloadLog(fn) { _log = fn; }
export function offloadEnabled() { return !broken && OFFLOAD.size > 0; }

function start() {
    if (started) return worker;
    started = true;
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') { broken = true; return null; }
    try {
        worker = new Worker(new URL('./layerworker.js', import.meta.url), { type: 'module' });
        worker.onerror = (e) => {
            // A module worker that fails to load reports here and never again, so this
            // is the only chance to fall back cleanly.
            broken = true;
            for (const s of slots.values()) { s.opened = false; s.inFlight = false; }
            if (_log) _log(`visuals: the layer worker did not start (${e.message || 'load error'}) — drawing everything on the main thread`, 'warn');
        };
        worker.onmessage = (e) => {
            const m = e.data;
            const s = [...slots.values()].find(x => x.id === m.id);
            if (!s) return;
            if (m.cmd === 'opened') { s.opened = !!m.ok; if (!m.ok) s.fails++; return; }
            if (m.cmd === 'frame') {
                s.inFlight = false;
                if (m.err) {
                    if (++s.fails >= 3) { s.opened = false; s.give = true;
                        if (_log) _log(`visuals: "${s.name}" threw in the worker — back on the main thread`, 'warn'); }
                    return;
                }
                if (s.bmp && s.bmp.close) { try { s.bmp.close(); } catch (_) {} }
                s.bmp = m.bmp; s.ms = m.ms; s.fails = 0;
            }
        };
    } catch (_) { broken = true; worker = null; }
    return worker;
}

/** Should this layer draw in the worker? */
export function isOffloaded(name) {
    if (broken || !OFFLOAD.has(name)) return false;
    const s = slots.get(name);
    return !(s && s.give);
}

/**
 * Give the worker this frame's inputs and take back the newest bitmap.
 * Never blocks: if nothing has come back yet, the answer is null and the caller draws
 * it the old way for that frame.
 *
 * @returns {ImageBitmap|null}
 */
export function bitmapFor(name, w, h, params, t, extra) {
    if (broken) return null;
    const wk = start();
    if (!wk) return null;

    let s = slots.get(name);
    if (!s) { s = { name, id: nextId++, opened: false, inFlight: false, bmp: null, ms: null, w, h, fails: 0, give: false }; slots.set(name, s); }
    if (s.give) return null;

    if (!s.opened && !s.inFlight) {
        s.inFlight = true;
        wk.postMessage({ cmd: 'open', id: s.id, name, w, h });
        // `opened` comes back asynchronously; the first frame request goes out on the
        // next call, by which time it has almost always arrived.
        s.inFlight = false;
        return null;
    }
    if (s.opened && !s.inFlight) {
        s.inFlight = true;
        s.w = w; s.h = h;
        // Only the plain data a layer reads. The spectrum is copied rather than
        // transferred: transferring would detach the array the rest of the app is
        // still using this frame.
        const spectrum = extra && extra.spectrum ? new Float32Array(extra.spectrum) : null;
        try {
            wk.postMessage({ cmd: 'frame', id: s.id, w, h, t, params,
                             extra: { spectrum, message: null, cam: null, media: null, palette: null, live: null } });
        } catch (_) { s.inFlight = false; s.give = true; return null; }
    }
    return s.bmp || null;
}

/** What the worker is carrying, for perf(). */
export function offloadStats() {
    return [...slots.values()].filter(s => s.opened || s.bmp)
        .map(s => ({ name: s.name, ms: s.ms == null ? null : +s.ms.toFixed(1), live: !s.give }));
}

/** Drop a layer that is no longer on screen, so its canvas goes with it. */
export function releaseOffload(name) {
    const s = slots.get(name);
    if (!s) return;
    if (worker && s.opened) { try { worker.postMessage({ cmd: 'close', id: s.id }); } catch (_) {} }
    if (s.bmp && s.bmp.close) { try { s.bmp.close(); } catch (_) {} }
    slots.delete(name);
}
