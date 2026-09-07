// ── Named panel layouts ───────────────────────────────────────────────────
// panel.js already persists ONE "current" arrangement (position/size/
// collapsed per panel id). This adds named snapshots of that arrangement —
// save your "performance" layout and your "calibration" layout separately,
// switch between them without re-dragging everything each time.
import { LAYOUT_KEY, getRegistry } from "./panel.js";

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
    all[name] = current;
    localStorage.setItem(NAMED_KEY, JSON.stringify(all));
}

// Pushes the named layout onto every currently-built panel via its live
// applyLayout(). Panels not mentioned in the saved layout are left alone.
export function applyLayout(name) {
    const all = listLayouts();
    const layout = all[name];
    if (!layout) return false;
    const registry = getRegistry();
    for (const [id, entry] of Object.entries(layout)) registry.get(id)?.applyLayout(entry);
    return true;
}

export function deleteLayout(name) {
    const all = listLayouts();
    delete all[name];
    localStorage.setItem(NAMED_KEY, JSON.stringify(all));
}
