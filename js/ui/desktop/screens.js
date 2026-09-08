// ── Screens & panel backdrops ────────────────────────────────────────────────
//
// Two ways to put the visuals on the desktop:
//
//   SCREEN panel   a panel that IS a monitor — video1 >> plasma() plays in it,
//                  on the canvas, instead of in the pop-out window. Resize it,
//                  drag it, put it next to the code that drives it.
//
//   backdrop       the ▦ button in any panel's header runs the same picture
//                  BEHIND that panel's content. On the editor panel that is
//                  vbg() scoped to one window instead of the whole app.
//
// Both are fed by ONE renderer. The screen owns a GL surface; every backdrop is a
// plain 2D canvas that copies the screen's frames with drawImage. Browsers cap
// live WebGL2 contexts (and each one costs real GPU), so N panels showing the same
// picture should not mean N contexts.
//
// With no SCREEN panel open there is nothing to copy, so a backdrop quietly starts
// the screen's surface without revealing the panel — the renderer runs either way.

import { createSurface } from '../../visuals/surface.js';

let _surface = null;          // the single GL surface
let _mirrors = new Map();     // panel element → { canvas, ctx, off }

// Lazily build the one renderer, on a canvas that need not be visible.
function surface(clock) {
    if (_surface) return _surface;
    const c = document.createElement('canvas');
    c.id = 'wfd-screen-gl';
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    _surface = createSurface(c, clock, { fadeWhenIdle: false });
    _surface.el = c;
    return _surface;
}

/** The SCREEN panel's body: adopts the GL canvas itself, so it is the real thing. */
export function mountScreen(body, clock) {
    const s = surface(clock);
    body.style.cssText += ';position:relative;padding:0;background:#000;overflow:hidden';
    body.appendChild(s.el);
    // An overlay for showing something OTHER than the master mix — a single layer, or
    // a code buffer — driven by the outputs loop (see outputs.js setScreen). For the
    // master source it stays display:none and the GL canvas shows through untouched,
    // so the default path costs exactly nothing.
    const over = document.createElement('canvas');
    over.className = 'wfd-screen-src';
    over.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;z-index:2';
    body.appendChild(over);
    s.overlay = over;
    s.resize();          // now that it has a box, size the backing store to it
    s.start();
    return s;
}

/**
 * Toggle the visuals as a backdrop behind one panel's content.
 * @param {HTMLElement} panelEl  the .panel
 * @param {object} clock
 * @returns {boolean} whether the backdrop is now on
 */
export function toggleBackdrop(panelEl, clock) {
    const s = surface(clock);
    if (!s.ok()) return false;

    const existing = _mirrors.get(panelEl);
    if (existing) {
        existing.off();                      // unsubscribe from the frame stream
        existing.canvas.remove();
        _mirrors.delete(panelEl);
        panelEl.classList.remove('has-backdrop');
        // Nothing left watching and no visible screen → stop rendering entirely.
        if (!_mirrors.size && !document.getElementById('wfd-screen-gl')?.isConnected) s.stop();
        return false;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'wfd-backdrop';
    panelEl.prepend(canvas);
    const ctx = canvas.getContext('2d');
    const off = s.onFrame((src) => {
        // Match the panel's box in device px, then letterbox-free stretch: the
        // backdrop is decoration, so filling beats preserving the aspect ratio.
        const w = panelEl.clientWidth, h = panelEl.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        try { ctx.drawImage(src, 0, 0, cw, ch); } catch (_) {}
    });
    _mirrors.set(panelEl, { canvas, ctx, off });
    panelEl.classList.add('has-backdrop');
    s.start();
    return true;
}

export function backdropOn(panelEl) { return _mirrors.has(panelEl); }
export function screenSurface() { return _surface; }
