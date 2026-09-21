// themefade.js — theme("paper", 2): the palette moves instead of cutting.
//
// A theme is a block of colour custom properties on :root.<name>, so switching one
// is a class swap: every colour in the interface changes on the same frame. That is
// right for picking a theme while you work and wrong on stage, where it reads as a
// glitch rather than as a move.
//
// Custom properties cannot be transitioned in CSS — not without registering each one
// through @property, and there are two dozen of them across ten themes — so the glide
// is done here: read where the colours are, swap the class, read where they are
// GOING, then pin the old values inline (inline beats a class rule) and walk them
// across. Nothing paints between the swap and the pin because none of that yields, so
// the switch itself stays invisible; what you see is the walk.
//
// The keys are read off the stylesheet rather than listed here. A second list of
// palette entries would drift the first time somebody adds a colour, and the failure
// would be a theme that fades everything except its one new colour, which snaps.

let raf   = 0;      // the running glide
let pins  = [];     // properties currently pinned inline, in need of cleanup
let keys  = null;   // palette property names, read once

/** Every custom property any :root rule defines. */
function paletteKeys() {
    if (keys) return keys;
    const out = new Set();
    for (const sheet of document.styleSheets) {
        let rules = null;
        // A cross-origin stylesheet throws on .cssRules rather than returning null.
        try { rules = sheet.cssRules; } catch (_) { continue; }
        if (!rules) continue;
        for (const r of rules) {
            if (!r.selectorText || !/(^|,)\s*:root\b/.test(r.selectorText)) continue;
            for (let i = 0; i < r.style.length; i++) {
                const n = r.style[i];
                if (n.startsWith('--')) out.add(n);
            }
        }
    }
    keys = [...out];
    return keys;
}

/**
 * A colour as [r, g, b, a], or null for anything that is not one.
 *
 * Not every palette entry is a colour — --cp-width is a length — and those are left
 * to the class swap, which has already applied them.
 */
export function parseColor(str) {
    const s = String(str || '').trim().toLowerCase();
    if (!s) return null;
    if (s[0] === '#') {
        const h = s.slice(1);
        const n = h.length;
        if (n === 3 || n === 4) {
            const v = [...h].map(c => parseInt(c + c, 16));
            if (v.some(x => !isFinite(x))) return null;
            return [v[0], v[1], v[2], n === 4 ? v[3] / 255 : 1];
        }
        if (n === 6 || n === 8) {
            const v = [];
            for (let i = 0; i < n; i += 2) v.push(parseInt(h.slice(i, i + 2), 16));
            if (v.some(x => !isFinite(x))) return null;
            return [v[0], v[1], v[2], n === 8 ? v[3] / 255 : 1];
        }
        return null;
    }
    // rgb(1,2,3) · rgba(1,2,3,0.4) · rgb(1 2 3 / 40%) — the modern space-separated
    // form included, because that is what some browsers hand back.
    const m = /^rgba?\(([^)]*)\)$/.exec(s);
    if (!m) return null;
    const parts = m[1].replace(/\//g, ' ').split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const num = (x, scale) => {
        const f = parseFloat(x);
        if (!isFinite(f)) return null;
        return x.endsWith('%') ? (f / 100) * scale : f;
    };
    const r = num(parts[0], 255), g = num(parts[1], 255), b = num(parts[2], 255);
    if (r == null || g == null || b == null) return null;
    const a = parts.length > 3 ? num(parts[3], 1) : 1;
    return [r, g, b, a == null ? 1 : a];
}

const css = (c) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${
    Math.round(Math.max(0, Math.min(1, c[3])) * 1000) / 1000})`;

const mix = (a, b, t) => css([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
                              a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);

function stopRaf() { if (raf) cancelAnimationFrame(raf); raf = 0; }

/** Drop the inline pins, so the class rules are what decides the colours again. */
function clearPins() {
    const root = document.documentElement;
    for (const k of pins) root.style.removeProperty(k);
    pins = [];
}

/** Switch now, with no glide — and make sure a running one cannot freeze the palette. */
export function themeNow(cls) {
    stopRaf();
    clearPins();
    document.documentElement.className = cls;
}

export function cancelThemeFade() { stopRaf(); clearPins(); }

/** True while a glide is running — the log line says "over 2s" only if it really is. */
export function themeFading() { return !!raf; }

/**
 * Glide into a theme.
 * @param {string} cls      the class for the theme ('' for dark)
 * @param {number} seconds  how long to take; 0 or less switches immediately
 * @returns {boolean}       whether anything is actually gliding
 */
export function fadeTheme(cls, seconds) {
    const root = document.documentElement;
    const ms = Number(seconds) * 1000;
    if (!isFinite(ms) || ms <= 0) { themeNow(cls); return false; }

    // Where the colours are NOW. Read before anything changes, and from the live
    // computed style, so a glide started mid-glide picks up where that one had got
    // to instead of snapping back to the palette it was leaving.
    const cs   = getComputedStyle(root);
    const from = new Map();
    for (const k of paletteKeys()) {
        const c = parseColor(cs.getPropertyValue(k));
        if (c) from.set(k, c);
    }

    // The rAF stops but the pins stay: clearing them here would show one frame of
    // the destination before the glide begins.
    stopRaf();
    root.className = cls;

    // cs is LIVE, so it now reports the new theme — that is the destination.
    const to = new Map();
    for (const k of from.keys()) {
        const c = parseColor(cs.getPropertyValue(k));
        if (c) to.set(k, c);
    }

    pins = [];
    for (const [k, c] of from) {
        if (!to.has(k)) continue;           // gone from this theme: let the class have it
        root.style.setProperty(k, css(c));
        pins.push(k);
    }
    if (!pins.length) return false;

    const t0 = performance.now();
    const step = (now) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = p * p * (3 - 2 * p);      // smoothstep: no lurch at either end
        for (const k of pins) root.style.setProperty(k, mix(from.get(k), to.get(k), e));
        if (p < 1) { raf = requestAnimationFrame(step); return; }
        raf = 0;
        clearPins();                        // hand the colours back to the class rules
    };
    raf = requestAnimationFrame(step);
    return true;
}
