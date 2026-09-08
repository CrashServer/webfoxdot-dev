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
export function applyLayout(name) {
    const all = listLayouts();
    const layout = all[name];
    if (!layout) return false;
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
