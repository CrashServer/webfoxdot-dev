// uiscale.js — one control for how big the whole interface is.
//
// crashDot's UI is authored small and dense: all 237 font sizes in the stylesheet
// are between 8px and 16px, and most are 9, 10 or 11. That is a deliberate look —
// it keeps a lot of state on screen at once — but it assumes the eyes of whoever
// authored it, and on a projector, a laptop across a room, or for anyone who simply
// needs text bigger, there was nothing to turn.
//
// ── Why `zoom` and not a font-size variable ─────────────────────────────────
// The obvious approach is a --ui-scale multiplier on every font-size. It scales the
// TEXT and nothing else, so padding, borders, fader widths and panel chrome stay put
// and the layout comes apart as the type grows into it — and it means rewriting 237
// declarations to find out.
//
// CSS `zoom` scales the whole box model coherently: text, padding, gaps, everything,
// reflowing rather than transforming, so hit-testing and text rendering stay correct
// (which is what rules out transform: scale()). One property, and the layout keeps
// the proportions it was designed with.
//
// It composes correctly with the desktop's own canvas zoom, which is a transform on
// a different element: panel.js measures the effective ratio off a real element
// (getBoundingClientRect().width / offsetWidth) rather than assuming it, so it picks
// up the product of the two and pointer deltas still convert correctly.
//
// ── Except the editor ────────────────────────────────────────────────────────
// CodeMirror cannot live inside a `zoom`. It positions the caret and the selection
// from cached offsetLeft values, which stay in UNZOOMED css pixels, and then places
// them against a getBoundingClientRect, which is scaled — so the two drift apart in
// proportion to how far along the line you are. Measured at 1.3 the caret is drawn
// 67px away from the character it is on; at 1.6, 165px. refresh() does not help,
// because nothing is stale: the two numbers are in different units.
//
// So the editor is taken back OUT of the zoom — `zoom: 1/scale` on the CodeMirror
// element cancels the ancestor exactly, putting it back in a space where its two
// measurements agree — and its font-size is multiplied instead, which is how text
// was always meant to get bigger. Same trick the desktop already uses to keep the
// editor unscaled against the canvas zoom; this is the second reason for it.

import { swallowed } from '../engine/swallowed.js';
const KEY = 'wfd-uiscale';
const MIN = 0.7, MAX = 2;
const DEFAULT = 1;

let _scale = DEFAULT;
// A SET, not a single callback. Two things need to know: index.html (to repaint the
// readout and refresh the editor) and the desktop (to rescale its editor layer, which
// is sized inline and so wins over the stylesheet). A single slot silently replaced
// the first subscriber with the second.
const _onChange = new Set();

/** Notified after every change. Returns an unsubscribe. */
export function onUiScaleChange(fn) { _onChange.add(fn); return () => _onChange.delete(fn); }

export function uiScale() { return _scale; }

const clamp = (n) => Math.max(MIN, Math.min(MAX, n));

// The editor's AUTHORED font size, read once while nothing is scaling it. Read later
// and it would measure a size this module had already changed, and every step would
// compound on the last.
let _basePx = 0;
function editorBasePx() {
    if (_basePx) return _basePx;
    const cm = document.querySelector('.CodeMirror');
    if (!cm) return 14;                       // before the editor exists; asked again later
    const px = parseFloat(getComputedStyle(cm).fontSize);
    if (px > 0) _basePx = px;
    return _basePx || 14;
}

export function setUiScale(n, { save = true } = {}) {
    const v = Number(n);
    if (!isFinite(v) || v <= 0) return _scale;
    _scale = Math.round(clamp(v) * 100) / 100;
    // On <html> rather than <body>: a few panels are position:fixed, and a fixed
    // element inside a zoomed ancestor is positioned against that ancestor — which
    // for the root is the viewport, so they land where they should.
    document.documentElement.style.zoom = _scale === 1 ? '' : String(_scale);
    // The editor opts out — see the note above. The stylesheet does the work; this
    // just tells it the number, and the base font size to multiply.
    document.documentElement.style.setProperty('--wfd-ui-scale', String(_scale));
    document.documentElement.style.setProperty('--wfd-editor-base', editorBasePx() + 'px');
    if (save) { try { localStorage.setItem(KEY, String(_scale)); } catch (_) {} }
    // One listener throwing must not stop the others hearing about it.
    for (const fn of _onChange) { try { fn(_scale); } catch (e) { swallowed('ui scale listener', e); } }
    return _scale;
}

/** Restore the saved size. Call once at boot, before the first paint if possible. */
export function initUiScale() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (_) {}
    const v = Number(saved);
    return setUiScale(isFinite(v) && v > 0 ? v : DEFAULT, { save: false });
}

/** Step by a ratio — what the +/- buttons and the keyboard shortcut use. */
export function nudgeUiScale(factor) { return setUiScale(_scale * factor); }

export const UI_SCALE_RANGE = { MIN, MAX, DEFAULT };
