// ── Floating panel system ────────────────────────────────────────────────
//
// Ported from the stars/workshop VJ tool (src/ui/panel.js). Unchanged apart from
// the storage key and a resize/move callback (spec.onResize) — CodeMirror has to
// be told when its box changes or it renders into stale geometry.
// Every major section (preview/mixer, channels, LUT, limiter, sequencer,
// outputs, presets) is a draggable, resizable, collapsible panel on a free
// desktop — drag the header to move, the corner handle to resize, the ▁
// button to collapse. Layout (position/size/collapsed) persists per panel id
// in localStorage, so an arranged workspace survives a reload. Pointer
// Events throughout, so this works with touch/tablet the same as mouse.

import { getPan, getZoom } from "./canvas.js";

export const LAYOUT_KEY = "wfd-desktop-panels";

// ── Layout migrations ────────────────────────────────────────────────────
// A saved size is normally sacred: you put the panel there, it stays there. But when
// a panel's CONTENT changes shape the old frame stops meaning anything — the main bar
// went from a horizontal strip to a labelled column, and a 1100x72 frame around a
// 190x450 column shows you three rows and leaves a wide empty box beside them.
//
// So: a version stamp, and a list of the ids whose default geometry has moved on.
// Everything else in the layout is untouched, which is the point of doing it this way
// rather than clearing the lot.
const LAYOUT_VERSION = 2;
const RESHAPED = ['wfd-bar-run'];
let zTop = 1;

// ── Magnetic snapping ────────────────────────────────────────────────────
// Panels move in free pixels; while dragging/resizing, their edges are pulled
// onto nearby "lines" — the edges and centres of every OTHER panel, the
// desktop bounds, and (weakly) a background grid. That's what lets two panels
// butt together flush no matter what size they are; a hard grid quantize
// can't, because a panel's far edge only lands on a grid line if its width
// happens to be a grid multiple. Hold Alt to move freely.
const GRID = 22;        // background grid, now only a weak hint
const SNAP_DIST = 8;    // pull radius for panel/desktop edges
const GRID_DIST = 4;    // weaker pull for bare grid lines

// Every visible panel except `selfEl`, as candidate lines + sizes.
// No viewport-edge lines: on an infinite canvas, "the edge of the screen" isn't
// a meaningful anchor. Panels snap only to each other and to the grid.
function collectTargets(desktop, selfEl) {
    const xs = [], ys = [];
    const ws = [], hs = [];
    for (const el of desktop.querySelectorAll(".panel")) {
        if (el === selfEl || el.offsetParent === null) continue;
        const l = el.offsetLeft, t = el.offsetTop;
        const w = el.offsetWidth, h = el.offsetHeight;
        xs.push(l, l + w, l + w / 2);
        ys.push(t, t + h, t + h / 2);
        ws.push(w); hs.push(h);
    }
    return { xs, ys, ws, hs };
}

// Best pull for a span [pos, pos+size]: tries its near edge, far edge and
// centre against `lines`, and returns the winning shift (or null).
function snapSpan(pos, size, lines, dist) {
    let bestD = dist, out = null;
    for (const off of [0, size, size / 2]) {
        for (const line of lines) {
            const d = Math.abs(line - (pos + off));
            if (d < bestD) { bestD = d; out = { delta: line - (pos + off), line }; }
        }
    }
    return out;
}

// Same idea for a single moving edge (resize): only the far edge travels.
function snapEdge(edge, lines, dist) {
    let bestD = dist, out = null;
    for (const line of lines) {
        const d = Math.abs(line - edge);
        if (d < bestD) { bestD = d; out = { delta: line - edge, line }; }
    }
    return out;
}

function gridLinesNear(value, size) {
    const near = (v) => Math.round(v / GRID) * GRID;
    return [near(value), near(value + size), near(value + size / 2)];
}

// ── Guide lines ──
// One reusable pair per desktop, shown only while a snap is actually engaged.
let guides = null;
function ensureGuides(desktop) {
    if (guides && guides.v.parentNode === desktop) return guides;
    const mk = (vertical) => {
        const g = document.createElement("div");
        g.style.cssText = `position:absolute;display:none;pointer-events:none;z-index:99999;background:var(--accent);opacity:.55;${
            vertical ? "width:1px;top:0;" : "height:1px;left:0;"}`;
        desktop.appendChild(g);
        return g;
    };
    guides = { v: mk(true), h: mk(false) };
    return guides;
}
function showGuide(desktop, axis, at) {
    const g = ensureGuides(desktop);
    if (axis === "x") {
        g.v.style.left = `${at}px`;
        g.v.style.height = "100000px";
        g.v.style.display = "block";
    } else {
        g.h.style.top = `${at}px`;
        g.h.style.width = "100000px";
        g.h.style.display = "block";
    }
}
function hideGuide(axis) {
    if (!guides) return;
    if (axis === "x") guides.v.style.display = "none";
    else guides.h.style.display = "none";
}
function hideGuides() { hideGuide("x"); hideGuide("y"); }

// The desktop carries a `zoom` (the UI scale control). Under zoom, offsetLeft/
// offsetWidth/clientWidth stay in unzoomed CSS px — the space panel geometry is
// authored and persisted in — while getBoundingClientRect and pointer clientX
// are scaled. So only pointer DELTAS need converting; measuring the ratio off a
// real element gets it right whatever the browser does, and yields 1 when unset.
function zoomFactor(el) {
    const w = el.offsetWidth;
    return w ? (el.getBoundingClientRect().width / w) || 1 : 1;
}

// Every panel registers itself here so a named-layout switch (ui/layoutManager.js)
// can push new positions onto ALREADY-BUILT panels, not just ones about to be created.
const registry = new Map();
export function getRegistry() { return registry; }

function loadLayout() {
    let all;
    try { all = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "{}"); }
    catch (_) { return {}; }
    if (!all || typeof all !== 'object') return {};
    if ((all.__v | 0) < LAYOUT_VERSION) {
        // Drop only the geometry of the reshaped panels; keep whether they were open,
        // which is a preference about the workspace rather than about the shape.
        for (const id of RESHAPED) {
            if (!all[id]) continue;
            const { open, collapsed } = all[id];
            all[id] = {};
            if (open !== undefined) all[id].open = open;
            if (collapsed !== undefined) all[id].collapsed = collapsed;
        }
        all.__v = LAYOUT_VERSION;
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(all)); } catch (_) {}
    }
    return all;
}
function saveLayoutEntry(id, entry) {
    const all = loadLayout();
    all[id] = { ...all[id], ...entry };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
}

// spec = { id, title, x, y, w, h, minW?, minH?, bodyId?, onResize? }
// Returns { el, body, bringToFront }. If `bodyId` is given, the body element
// gets that id directly (so existing code's getElementById(...) keeps
// working unchanged) — otherwise the caller populates `body` itself.
export function createPanel(desktop, spec) {
    const saved = loadLayout()[spec.id] || {};
    const x = saved.x ?? spec.x, y = saved.y ?? spec.y;
    const w = saved.w ?? spec.w;
    let h = saved.h ?? spec.h;
    const minW = spec.minW ?? 200, minH = spec.minH ?? 120;

    const win = document.createElement("div");
    win.className = "panel";
    win.dataset.panelId = spec.id;
    win.style.left = `${x}px`; win.style.top = `${y}px`;
    win.style.width = `${w}px`; win.style.height = `${h}px`;
    win.style.zIndex = ++zTop;

    const head = document.createElement("div");
    head.className = "panel-head";
    const title = document.createElement("span");
    title.className = "panel-title";
    title.textContent = spec.title;
    // ── color picker ───────────────────────────────────────────────────────
    // v = panel background; t = title text (bright tint, readable on dark bg)
    const PANEL_COLORS = [
        { label: "default", v: "",        t: "" },
        { label: "navy",    v: "#0e2c4a", t: "#6ab8ff" },
        { label: "violet",  v: "#1e1050", t: "#b088ff" },
        { label: "forest",  v: "#0c2c18", t: "#60d87a" },
        { label: "crimson", v: "#300c0c", t: "#ff7070" },
        { label: "teal",    v: "#082c2c", t: "#44d8d8" },
        { label: "amber",   v: "#2e2000", t: "#f0c840" },
        { label: "slate",   v: "#12203c", t: "#88aee8" },
        { label: "rose",    v: "#30081e", t: "#f070b0" },
        { label: "bronze",  v: "#281808", t: "#d09850" },
    ];

    function applyPanelColor(v, t) {
        win.style.background = v;
        title.style.color = t || "";
        // The ◉ button reflects the active tint so you can see the color at a glance
        colorBtn.style.color = t || "";
    }

    const colorWrap = document.createElement("span");
    colorWrap.className = "panel-color-wrap";
    const colorBtn = document.createElement("button");
    colorBtn.className = "panel-color-btn";
    colorBtn.textContent = "◉";
    colorBtn.title = "panel colour — tint this panel so you can find it at a glance";
    const colorPicker = document.createElement("div");
    colorPicker.className = "panel-color-picker";
    for (const { label, v, t } of PANEL_COLORS) {
        const sw = document.createElement("button");
        sw.className = "panel-color-swatch" + (v === (saved.panelColor ?? "") ? " on" : "");
        sw.style.background = v || "var(--bg-2)";
        sw.dataset.v = v;
        sw.title = label;
        sw.addEventListener("click", (e) => {
            e.stopPropagation();
            applyPanelColor(v, t);
            for (const s of colorPicker.querySelectorAll(".panel-color-swatch")) s.classList.toggle("on", s === sw);
            saveLayoutEntry(spec.id, { panelColor: v, panelTitleColor: t });
            colorPicker.classList.remove("open");
        });
        colorPicker.appendChild(sw);
    }
    colorBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = colorPicker.classList.contains("open");
        document.querySelectorAll(".panel-color-picker.open").forEach(p => p.classList.remove("open"));
        if (!wasOpen) colorPicker.classList.add("open");
    });
    colorWrap.append(colorBtn, colorPicker);
    // Restore saved color on load
    if (saved.panelColor != null) applyPanelColor(saved.panelColor, saved.panelTitleColor ?? "");

    const pinBtn = document.createElement("button");
    pinBtn.className = "panel-pin";
    pinBtn.textContent = "⊙";
    pinBtn.title = "pin — panel stays at this screen position while canvas pans/zooms";

    const setHomeBtn = document.createElement("button");
    setHomeBtn.className = "panel-home-set";
    setHomeBtn.textContent = "⌂";
    setHomeBtn.title = "set home — save this position as the panel's home";

    const sendHomeBtn = document.createElement("button");
    sendHomeBtn.className = "panel-home-go";
    sendHomeBtn.textContent = "↩";
    sendHomeBtn.title = "send home — unpin and return panel to its saved home position";
    sendHomeBtn.style.display = "none";

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "panel-collapse";
    collapseBtn.textContent = "▁";
    collapseBtn.title = "collapse/expand";

    // ── close ──
    // A panel you cannot put away is furniture, not a window. Closing hides it and
    // records that in the same per-panel entry as position and colour, so an
    // arrangement remembers what was OUT as well as where it was. Reopening is the
    // WINDOWS panel's job — which is why the one panel that lists the others passes
    // closable:false and keeps no ×.
    const closeBtn = document.createElement("button");
    closeBtn.className = "panel-close";
    closeBtn.textContent = "×";
    closeBtn.title = "close — reopen it from the WINDOWS panel";

    head.append(title, colorWrap, setHomeBtn, sendHomeBtn, pinBtn, collapseBtn);
    if (spec.closable !== false) head.append(closeBtn);
    win.appendChild(head);

    const body = document.createElement("div");
    body.className = "panel-body";
    if (spec.bodyId) body.id = spec.bodyId;
    win.appendChild(body);

    const handle = document.createElement("div");
    handle.className = "panel-resize";
    win.appendChild(handle);

    desktop.appendChild(win);

    function bringToFront() { win.style.zIndex = ++zTop; }
    win.addEventListener("pointerdown", bringToFront);

    // Show/hide without destroying anything: the panel keeps its adopted DOM, its
    // listeners and its geometry, so reopening is instant and nothing inside has to
    // know it was away. `persist` is off when the caller is only MIRRORING a state it
    // already owns (a hosted module's own hidden flag), so we never fight it.
    function setOpen(on, persist = true) {
        win.style.display = on ? "" : "none";
        if (persist) saveLayoutEntry(spec.id, { open: !!on });
        if (on) bringToFront();
        spec.onOpenChange?.(!!on);
    }
    function isOpen() { return win.style.display !== "none"; }
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // A hosted module owns its own open flag and its own toggle button; closing
        // the PANEL behind its back would leave the two disagreeing, so hand the
        // close back to whoever adopted it.
        if (spec.onClose) spec.onClose();
        else setOpen(false);
    });
    // Come back closed if that is how it was left. Hosted panels re-sync from their
    // module a moment later, so this is only the starting position for them.
    if (spec.closable !== false && saved.open === false) win.style.display = "none";

    // ── pin: lock panel to viewport regardless of canvas pan/zoom ──
    // dpx/dpy are the panel's position in #desktop layout pixels — they stay
    // constant while the canvas moves; canvas.js back-solves to canvas-space px.
    function pinDesktopPos() {
        const { x: px, y: py } = getPan();
        const z = getZoom();
        return { dpx: win.offsetLeft * z + px, dpy: win.offsetTop * z + py };
    }
    function applyPinState() {
        const isPinned = !!win.dataset.pinned;
        pinBtn.classList.toggle("on", isPinned);
        pinBtn.title = isPinned
            ? "pinned — panel follows viewport; click to release"
            : "pin — panel stays at this screen position while canvas pans/zooms";
        saveLayoutEntry(spec.id, isPinned
            ? { pinned: true, pinDpx: +win.dataset.pinDpx, pinDpy: +win.dataset.pinDpy }
            : { pinned: false });
    }
    pinBtn.addEventListener("click", () => {
        if (win.dataset.pinned) {
            delete win.dataset.pinned;
            delete win.dataset.pinDpx;
            delete win.dataset.pinDpy;
        } else {
            const { dpx, dpy } = pinDesktopPos();
            win.dataset.pinned = "1";
            win.dataset.pinDpx = dpx;
            win.dataset.pinDpy = dpy;
        }
        applyPinState();
    });
    // Restore pin from saved layout
    if (saved.pinned && saved.pinDpx != null) {
        win.dataset.pinned = "1";
        win.dataset.pinDpx = saved.pinDpx;
        win.dataset.pinDpy = saved.pinDpy ?? 0;
        pinBtn.classList.add("on");
    }

    // ── home: save / restore a fixed canvas-space position ──
    function applyHomeState() {
        const hasHome = saved.homeX != null;
        sendHomeBtn.style.display = hasHome ? "" : "none";
        setHomeBtn.classList.toggle("on", hasHome);
    }
    setHomeBtn.addEventListener("click", () => {
        saved.homeX = win.offsetLeft;
        saved.homeY = win.offsetTop;
        saveLayoutEntry(spec.id, { homeX: saved.homeX, homeY: saved.homeY });
        setHomeBtn.classList.add("on");
        sendHomeBtn.style.display = "";
    });
    sendHomeBtn.addEventListener("click", () => {
        if (saved.homeX == null) return;
        // Unpin first so canvas.js stops back-solving this panel's position
        if (win.dataset.pinned) {
            delete win.dataset.pinned;
            delete win.dataset.pinDpx;
            delete win.dataset.pinDpy;
            applyPinState();
        }
        win.style.left = `${saved.homeX}px`;
        win.style.top  = `${saved.homeY}px`;
        saveLayoutEntry(spec.id, { x: saved.homeX, y: saved.homeY });
    });
    applyHomeState();

    // Close any open color picker when clicking outside
    document.addEventListener("pointerdown", (e) => {
        if (!colorWrap.contains(e.target)) colorPicker.classList.remove("open");
    }, { capture: true });

    // ── drag (by header) ──
    // Named rather than inline so extra handles can share it — a hosted panel adopts
    // a module that brought its own header bar, and people grab that bar.
    const beginDrag = (e) => {
        if (e.target === collapseBtn || e.target === pinBtn || e.target === setHomeBtn || e.target === sendHomeBtn || colorWrap.contains(e.target)) return;
        if (e.target.closest("button, input, select, textarea, a")) return;
        const grip = e.currentTarget;
        e.preventDefault();
        try { grip.setPointerCapture(e.pointerId); } catch (_) {}
        const startX = e.clientX, startY = e.clientY;
        const baseX = win.offsetLeft, baseY = win.offsetTop;
        const targets = collectTargets(desktop, win);
        const z = zoomFactor(win);
        const move = (ev) => {
            let nx = baseX + (ev.clientX - startX) / z;
            let ny = baseY + (ev.clientY - startY) / z;
            const w = win.offsetWidth, hgt = win.offsetHeight;
            if (ev.altKey) {
                hideGuides();
            } else {
                const sx = snapSpan(nx, w, targets.xs, SNAP_DIST)
                    ?? snapSpan(nx, w, gridLinesNear(nx, w), GRID_DIST);
                const sy = snapSpan(ny, hgt, targets.ys, SNAP_DIST)
                    ?? snapSpan(ny, hgt, gridLinesNear(ny, hgt), GRID_DIST);
                if (sx) { nx += sx.delta; showGuide(desktop, "x", sx.line); } else hideGuide("x");
                if (sy) { ny += sy.delta; showGuide(desktop, "y", sy.line); } else hideGuide("y");
            }
            win.style.left = `${nx}px`; win.style.top = `${ny}px`;
        };
        const up = () => {
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", up);
            hideGuides();
            if (win.dataset.pinned) {
                // Re-anchor at the new screen position after the drag
                const { dpx, dpy } = pinDesktopPos();
                win.dataset.pinDpx = dpx;
                win.dataset.pinDpy = dpy;
                applyPinState();
            } else {
                saveLayoutEntry(spec.id, { x: win.offsetLeft, y: win.offsetTop });
            }
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
    };
    head.addEventListener("pointerdown", beginDrag);

    // Panel chrome must never start a NATIVE text drag. beginDrag bails out on a
    // button without preventing the default, so the browser was free to drag that
    // button's own label — and dropping it on an editor made CodeMirror insert it.
    // That is where stray ◉ ⌂ ↩ ⊙ ▦ ▁ characters were coming from in the buffers.
    // Text inside the panel BODY stays draggable: dragging a selection out of a
    // detached editor is a real thing to want.
    win.addEventListener("dragstart", (e) => {
        if (e.target.closest && e.target.closest(".panel-head, .panel-resize")) e.preventDefault();
    });

    // ── resize (corner handle) ──
    handle.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        const startX = e.clientX, startY = e.clientY;
        const baseW = win.offsetWidth, baseH = win.offsetHeight;
        const targets = collectTargets(desktop, win);
        const z = zoomFactor(win);
        const move = (ev) => {
            let nw = Math.max(minW, baseW + (ev.clientX - startX) / z);
            let nh = Math.max(minH, baseH + (ev.clientY - startY) / z);
            const x = win.offsetLeft, y = win.offsetTop;
            if (ev.altKey) {
                hideGuides();
            } else {
                // The far edge snaps to neighbouring lines; failing that, the
                // size itself snaps to a neighbour's size (so panels can be
                // made visibly equal), then weakly to the grid.
                const sx = snapEdge(x + nw, targets.xs, SNAP_DIST);
                const sy = snapEdge(y + nh, targets.ys, SNAP_DIST);
                if (sx) { nw = Math.max(minW, nw + sx.delta); showGuide(desktop, "x", sx.line); }
                else {
                    hideGuide("x");
                    const eq = snapEdge(nw, targets.ws, SNAP_DIST)
                        ?? snapEdge(nw, [Math.round(nw / GRID) * GRID], GRID_DIST);
                    if (eq) nw = Math.max(minW, nw + eq.delta);
                }
                if (sy) { nh = Math.max(minH, nh + sy.delta); showGuide(desktop, "y", sy.line); }
                else {
                    hideGuide("y");
                    const eq = snapEdge(nh, targets.hs, SNAP_DIST)
                        ?? snapEdge(nh, [Math.round(nh / GRID) * GRID], GRID_DIST);
                    if (eq) nh = Math.max(minH, nh + eq.delta);
                }
            }
            win.style.width = `${nw}px`; win.style.height = `${nh}px`;
            spec.onResize?.();
        };
        const up = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            hideGuides();
            h = win.offsetHeight;
            saveLayoutEntry(spec.id, { w: win.offsetWidth, h });
            spec.onResize?.();
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
    });

    // ── collapse ──
    let collapsed = !!saved.collapsed;
    function applyCollapsed() {
        body.style.display = collapsed ? "none" : "";
        handle.style.display = collapsed ? "none" : "";
        win.style.height = collapsed ? "" : `${h}px`;
        win.classList.toggle("collapsed", collapsed);
    }
    applyCollapsed();
    function toggleCollapse() {
        collapsed = !collapsed;
        applyCollapsed();
        saveLayoutEntry(spec.id, { collapsed });
    }
    collapseBtn.addEventListener("click", toggleCollapse);

    // ── rename in place ──
    // Offered only when the caller supplies onRename — a panel whose title is a
    // fixed label has nothing to rename.
    function startRename() {
        if (!spec.onRename || title.querySelector("input")) return;
        const was = title.textContent;
        const input = document.createElement("input");
        input.className = "panel-title-input";
        input.value = was;
        input.spellcheck = false;
        input.size = Math.max(4, was.length + 1);
        title.textContent = "";
        title.appendChild(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (commit) => {
            if (done) return;
            done = true;
            const v = input.value.trim().slice(0, 24);
            title.textContent = (commit && v) ? v : was;
            if (commit && v && v !== was) spec.onRename(v);
        };
        input.addEventListener("keydown", (ev) => {
            ev.stopPropagation();                       // never reaches an editor keymap
            if (ev.key === "Enter")  { ev.preventDefault(); finish(true); }
            if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
        });
        input.addEventListener("input", () => { input.size = Math.max(4, input.value.length + 1); });
        input.addEventListener("blur", () => finish(true));
        // Clicks in the field must not drag the panel or collapse it.
        for (const t of ["click", "pointerdown", "dblclick"])
            input.addEventListener(t, (ev) => ev.stopPropagation());
    }

    // beginDrag takes pointer capture on the HEADER, and a captured pointer makes
    // the browser retarget the following click/dblclick to the capture element. So
    // a double-click on the title arrives with e.target === head and a listener that
    // tests e.target would collapse the panel instead of renaming it — which is
    // exactly what it did. Remember where the POINTER went down (that event is not
    // retargeted, capture only starts with it) and route on that instead.
    let lastDown = null;
    head.addEventListener("pointerdown", (e) => { lastDown = e.target; }, true);
    head.addEventListener("dblclick", (e) => {
        if (e.target === collapseBtn || lastDown === collapseBtn) return; // handled via click
        if (spec.onRename && lastDown && (lastDown === title || title.contains(lastDown))) {
            startRename();
            return;
        }
        toggleCollapse();
    });
    if (spec.onRename) title.title = "double-click to rename";

    // Push a layout entry onto this ALREADY-BUILT panel immediately (used by
    // named-layout switching) — also persists it as the new "current" layout.
    function applyLayout(entry) {
        // Colour is part of a saved workspace, not decoration on the side: it is
        // stored in this same per-panel entry, so recalling a layout has to put it
        // back or half the arrangement returns and half does not.
        if (entry.panelColor !== undefined) {
            applyPanelColor(entry.panelColor, entry.panelTitleColor || "");
            for (const s of colorPicker.querySelectorAll(".panel-color-swatch"))
                s.classList.toggle("on", s.dataset.v === (entry.panelColor || ""));
        }
        if (entry.x != null) win.style.left = `${entry.x}px`;
        if (entry.y != null) win.style.top = `${entry.y}px`;
        if (entry.w != null) win.style.width = `${entry.w}px`;
        if (entry.h != null) { h = entry.h; if (!collapsed) win.style.height = `${h}px`; }
        if (entry.collapsed != null && entry.collapsed !== collapsed) {
            collapsed = entry.collapsed;
            applyCollapsed();
        }
        if (entry.open != null && spec.closable !== false) setOpen(!!entry.open, false);
        saveLayoutEntry(spec.id, entry);
    }

    // Let a hosted module's own header bar move the panel too — see hostFloating().
    const addDragHandle = (el) => { if (el) el.addEventListener("pointerdown", beginDrag); };
    const api = { el: win, body, bringToFront, applyLayout, addDragHandle, setOpen, isOpen, startRename, setTitle(t) { title.textContent = t; } };
    registry.set(spec.id, api);
    return api;
}

/**
 * Two-step confirm ON the button, instead of a browser confirm() — an unstyled
 * modal that stops the world is the wrong weight for "are you sure" about one
 * panel, and it cannot be themed or dismissed by clicking away. First click arms
 * (the button says so); a second within `ms` commits; anything else disarms.
 */
export function armButton(btn, { armedText = "×?", armedTitle = "click again to confirm", onConfirm, skip, ms = 3000 } = {}) {
    const text = btn.textContent, title = btn.title;
    let timer = null;
    const disarm = () => {
        clearTimeout(timer); timer = null;
        btn.classList.remove("armed");
        btn.textContent = text; btn.title = title;
    };
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (timer) { disarm(); onConfirm?.(); return; }
        // Nothing to lose → no ceremony. Asked at click time, not at build time, so
        // it tracks what the panel holds NOW.
        if (skip?.()) { onConfirm?.(); return; }
        btn.classList.add("armed");
        btn.textContent = armedText; btn.title = armedTitle;
        timer = setTimeout(disarm, ms);
    });
    btn.addEventListener("pointerleave", () => { if (timer) disarm(); });
    return disarm;
}

export function resetAllLayouts() {
    localStorage.removeItem(LAYOUT_KEY);
    // Force reload so panels re-read their spec defaults
    location.reload();
}
