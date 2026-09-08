// ── Live-coding instrument parser (shared) ───────────────────────────────────
// Ported from web/src/layers/livecode_parse.js. Pulls `player >> instrument(…)`
// pairs out of the FoxDot code windows in extra.live, gives each a stable
// cartoon colour, and word-wraps code for fixed panels. Used by the live-code
// visual layers (instrumentPop, comicPanels, …).

const LINE_RE = /(?:^|\n)\s*([a-zA-Z_]\w*)\s*>>\s*([a-zA-Z_]\w*)\s*\(/g;

const _linesStr = (w) => {
    const l = w && w.lines;
    return l ? (Array.isArray(l) ? l.join("\n") : String(l)) : "";
};

// Memoised: called every frame by several live-code layers, but the code text
// only changes on eval. Keyed on the raw text; results are treated as read-only
// by all callers, so returning the cached array is safe. Bounded by a periodic
// clear (only a handful of distinct code windows are ever live).
const _EMPTY = [];
const _piCache = new Map();
export function parseInstruments(text) {
    if (!text) return _EMPTY;
    const hit = _piCache.get(text);
    if (hit) return hit;
    const out = [];
    LINE_RE.lastIndex = 0;
    let m;
    while ((m = LINE_RE.exec(text)) !== null) out.push({ player: m[1], inst: m[2] });
    if (_piCache.size > 16) _piCache.clear();
    _piCache.set(text, out);
    return out;
}

// 0 while no recent eval, ramping 1→0 over 0.5s after an eval.
export const flashOf = (w) => (w && w.evalFlashAge >= 0) ? Math.max(0, 1 - w.evalFlashAge / 0.5) : 0;

export function collectInstruments(lv, max = 12) {
    const seen = new Map();
    const add = (win, flash, src) => {
        for (const e of parseInstruments(_linesStr(win))) seen.set(e.player, { player: e.player, inst: e.inst, flash, src });
    };
    add(lv?.svdk, flashOf(lv?.svdk), 0);
    add(lv?.zbdm, flashOf(lv?.zbdm), 1);
    return [...seen.values()].slice(0, max);
}

export const DEMO_INSTRUMENTS = [
    { player: "d1", inst: "play", flash: 0, src: 0 },
    { player: "b1", inst: "bass", flash: 0, src: 1 },
    { player: "p1", inst: "pads", flash: 0, src: 0 },
    { player: "s1", inst: "pluck", flash: 0, src: 1 },
    { player: "d2", inst: "loop", flash: 0, src: 0 },
];

function hsv(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: return [v, t, p];
        case 1: return [q, v, p];
        case 2: return [p, v, t];
        case 3: return [p, q, v];
        case 4: return [t, p, v];
        default: return [v, p, q];
    }
}

// Stable bright cartoon colour per instrument name. Returns [r,g,b] in 0..1.
export function instrumentColor(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    const hue = ((h >>> 0) % 360) / 360;
    return hsv(hue, 0.72, 1.0);
}

// Greedy word-wrap: break at spaces, hard-split over-long tokens, cap to maxRows.
// Memoised on (maxCols, maxRows, text) — inputs are stable frame-to-frame (they
// change on eval / panel resize), and callers only read the returned lines.
const _wcCache = new Map();
export function wrapCode(text, maxCols, maxRows = 8) {
    const _key = (maxCols | 0) + "|" + maxRows + "|" + text;
    const _hit = _wcCache.get(_key);
    if (_hit) return _hit;
    const _out = _wrapCode(text, maxCols, maxRows);
    if (_wcCache.size > 32) _wcCache.clear();
    _wcCache.set(_key, _out);
    return _out;
}
function _wrapCode(text, maxCols, maxRows = 8) {
    maxCols = Math.max(4, maxCols | 0);
    const src = String(text ?? "").replace(/\t/g, "  ").replace(/\s+$/, "");
    if (src.length <= maxCols) return src ? [src] : [];
    const words = src.split(/(\s+)/).filter((w) => w.length);
    const lines = [];
    let cur = "";
    const push = () => { lines.push(cur); cur = ""; };
    for (let w of words) {
        while (w.length > maxCols) {
            const room = maxCols - cur.length;
            if (room > 0) { cur += w.slice(0, room); w = w.slice(room); }
            push();
            if (lines.length >= maxRows) return lines;
        }
        if (cur.length + w.length > maxCols) {
            if (/^\s+$/.test(w)) { push(); continue; }
            push();
        }
        cur += w;
        if (lines.length >= maxRows) return lines.slice(0, maxRows);
    }
    if (cur) push();
    return lines.slice(0, maxRows);
}
