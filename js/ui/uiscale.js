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

const KEY = 'wfd-uiscale';
const MIN = 0.7, MAX = 2;
const DEFAULT = 1;

let _scale = DEFAULT;
let _onChange = null;

/** Notified after every change — the editor needs a refresh() to re-measure. */
export function onUiScaleChange(fn) { _onChange = fn; }

export function uiScale() { return _scale; }

const clamp = (n) => Math.max(MIN, Math.min(MAX, n));

export function setUiScale(n, { save = true } = {}) {
    const v = Number(n);
    if (!isFinite(v) || v <= 0) return _scale;
    _scale = Math.round(clamp(v) * 100) / 100;
    // On <html> rather than <body>: a few panels are position:fixed, and a fixed
    // element inside a zoomed ancestor is positioned against that ancestor — which
    // for the root is the viewport, so they land where they should.
    document.documentElement.style.zoom = _scale === 1 ? '' : String(_scale);
    if (save) { try { localStorage.setItem(KEY, String(_scale)); } catch (_) {} }
    try { _onChange?.(_scale); } catch (_) {}
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
