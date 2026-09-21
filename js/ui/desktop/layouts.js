// ── Named panel layouts ───────────────────────────────────────────────────
// panel.js already persists ONE "current" arrangement (position/size/
// collapsed per panel id). This adds named snapshots of that arrangement —
// save your "performance" layout and your "calibration" layout separately,
// switch between them without re-dragging everything each time.
import { LAYOUT_KEY, getRegistry } from "./panel.js";
import { getView, setView } from "./canvas.js";

// A saved layout keeps the VIEW too, under this key alongside the panel ids —
// where you were looking is as much a part of a workspace as where things were.
const VIEW_KEY = "__view";

const NAMED_KEY = "wfd-desktop-layouts";

export function listLayouts() {
    try { return JSON.parse(localStorage.getItem(NAMED_KEY) || "{}"); }
    catch (_) { return {}; }
}

export function saveLayout(name) {
    let current;
    try { current = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); }
    catch (_) { current = {}; }
    const all = listLayouts();
    all[name] = { ...current, [VIEW_KEY]: getView() };
    localStorage.setItem(NAMED_KEY, JSON.stringify(all));
}

// Pushes the named layout onto every currently-built panel via its live
// applyLayout(). Panels not mentioned in the saved layout are left alone.
/**
 * Push a layout onto every built panel.
 *
 * `name` picks a saved one. A restored workspace has no name — it arrives as the
 * arrangement itself, already written to LAYOUT_KEY — so it passes the object in
 * `layoutObj` instead, and gets the same live application rather than a reload.
 */
// A transition in flight. One rAF loop at a time, and none at all when nothing is
// moving — a layout switch should not leave a timer running for the rest of the set.
let _tween = 0;
export function cancelLayoutTween() { if (_tween) { cancelAnimationFrame(_tween); _tween = 0; } }

/**
 * Glide to a layout instead of cutting to it, over `seconds`.
 *
 * Cheap by construction rather than by throttling:
 *   · only panels whose geometry actually CHANGES are touched at all
 *   · width/height are written only when they differ, because a panel that merely
 *     moves has nothing to re-lay-out inside it
 *   · onResize is not called per frame — it fires once at the end, so CodeMirror
 *     and the canvases remeasure a single time rather than sixty times a second
 *   · setView already debounces its own persistence by 250ms
 *   · the whole thing is one rAF loop that stops when it arrives
 *
 * Zoom moves geometrically. Linear zoom reads as a lurch — halfway between 0.3 and
 * 1.2 is not 0.75 to the eye, it is the geometric mean.
 */
function tweenTo(layout, seconds) {
    const registry = getRegistry();
    const moves = [];
    for (const [id, e] of Object.entries(layout)) {
        if (id === VIEW_KEY) continue;
        const el = registry.get(id)?.el;
        if (!el || el.offsetParent === null) continue;      // not built, or closed
        const from = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
        const to = { x: e.x ?? from.x, y: e.y ?? from.y, w: e.w ?? from.w, h: e.h ?? from.h };
        const size = to.w !== from.w || to.h !== from.h;
        if (!size && to.x === from.x && to.y === from.y) continue;
        moves.push({ el, from, to, size });
    }
    const v0 = getView(), v1 = layout[VIEW_KEY] || null;
    if (!moves.length && !v1) return false;

    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const ms = Math.max(16, seconds * 1000);
    const ease = (t) => t * t * (3 - 2 * t);              // smoothstep: no jolt at either end
    const lerp = (a2, b2, k) => a2 + (b2 - a2) * k;
    const step = (now) => {
        const k = ease(Math.min(1, (now - t0) / ms));
        for (const m of moves) {
            m.el.style.left = `${lerp(m.from.x, m.to.x, k)}px`;
            m.el.style.top  = `${lerp(m.from.y, m.to.y, k)}px`;
            if (m.size) {
                m.el.style.width  = `${lerp(m.from.w, m.to.w, k)}px`;
                m.el.style.height = `${lerp(m.from.h, m.to.h, k)}px`;
            }
        }
        if (v1) setView({ x: lerp(v0.x, v1.x, k), y: lerp(v0.y, v1.y, k),
                          zoom: v0.zoom * Math.pow(v1.zoom / v0.zoom, k) });
        if ((now - t0) < ms) { _tween = requestAnimationFrame(step); return; }
        _tween = 0;
        // Land exactly, and persist: the frames above only moved pixels.
        applyLayoutNow(layout);
        window.dispatchEvent(new Event('resize'));
    };
    _tween = requestAnimationFrame(step);
    return true;
}

export function applyLayout(name, layoutObj = null, seconds = 0) {
    const layout = layoutObj || listLayouts()[name];
    if (!layout) return false;
    cancelLayoutTween();                                   // a second recall wins
    if (seconds > 0 && tweenTo(layout, seconds)) return true;
    return applyLayoutNow(layout);
}

function applyLayoutNow(layout) {
    const registry = getRegistry();
    const saved = {};
    for (const [id, entry] of Object.entries(layout)) {
        if (id === VIEW_KEY) continue;
        registry.get(id)?.applyLayout(entry);
        saved[id] = entry;
    }
    // Panels that are not built yet (the lazily-hosted ones) must still land in the
    // right place when they are opened, so write the arrangement through to the
    // "current" layout panel.js reads at construction.
    try {
        const cur = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}");
        localStorage.setItem(LAYOUT_KEY, JSON.stringify({ ...cur, ...saved }));
    } catch (_) {}
    if (layout[VIEW_KEY]) setView(layout[VIEW_KEY]);
    return true;
}

export function deleteLayout(name) {
    const all = listLayouts();
    delete all[name];
    localStorage.setItem(NAMED_KEY, JSON.stringify(all));
}
