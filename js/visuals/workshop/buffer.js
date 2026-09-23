// buffer.js — an offscreen drawing buffer that exists in a worker too.
//
// Several layers render at a low internal resolution into a scratch canvas and then
// stretch it over the frame. They made that scratch with document.createElement, which
// is the natural thing on the main thread and the one thing a worker cannot do — and
// those same layers are among the most expensive in the set, so they are exactly the
// ones worth moving off it. See wsoffload.js.
//
// OffscreenCanvas needs its size at construction, but width and height stay settable
// afterwards, so callers that assign them keep working unchanged either way.

/**
 * A canvas to draw into that is never shown.
 * @param {number} w @param {number} h
 * @returns {HTMLCanvasElement|OffscreenCanvas}
 */
export function makeBuffer(w = 1, h = 1) {
    if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
        return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(Math.max(1, w | 0), Math.max(1, h | 0));
    }
    throw new Error('no canvas available for an offscreen buffer');
}
