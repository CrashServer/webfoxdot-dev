// ── Infinite canvas: pan + zoom for the panel workspace ────────────────────
//
// Ported from the stars/workshop VJ tool (src/ui/canvas.js), which is where this
// pan/zoom desktop comes from. Changed for crashDot: no 1920×1080 "stage" rect
// (that was a live video-output footprint — there is no such thing here), our own
// storage key, and Alt+drag no longer pans while the pointer is over a panel,
// because Alt+drag inside CodeMirror is a column selection.
// Ctrl+scroll (or trackpad pinch, which fires as ctrlKey+wheel) to zoom,
// centered on the cursor. Middle-mouse drag or Space+drag to pan.
// Double-click on background to reset view.
//
// Coordinate spaces:
//   desktop-layout px — the coordinate space of #desktop (before its CSS zoom).
//   canvas-space px   — the coordinate space inside #vj-canvas before its
//                       transform (scale). All panel left/top values live here.
//   panX/panY          — translate of #vj-canvas in desktop-layout px.
//   zoom               — scale of #vj-canvas (transform: scale(zoom)).
//
// Conversion: canvasX = (desktopX - panX) / zoom
//             desktopX = canvasX * zoom + panX
//
// CSS `zoom` on #desktop (UI scale): accounted for by uiZoom() which measures
// the ratio of getBoundingClientRect vs offsetWidth — same ratio that pointer
// event clientX/Y is already in viewport pixels and thus needs undoing.

const STORAGE_KEY = "wfd-desktop-view";

// Fine dot pitch at zoom=1 (matches panel.js GRID for snap alignment).
const GRID = 22;

// The default layout's footprint, drawn as a faint "home" rectangle.
const HOME_W = 1920, HOME_H = 1080;

const MIN_ZOOM = 0.15, MAX_ZOOM = 3;

// The workspace — the total drawable surface, in canvas-space px. Big enough
// that you never reach the end of it at a working zoom, small enough that the
// soft pan clamp in apply() can still keep you from losing your panels.
const WORK_W  = 7680;
const WORK_H  = 4320;
const WORK_OX = -1000;   // workspace left edge in canvas-space
const WORK_OY = -800;    // workspace top  edge in canvas-space

let canvasEl = null, desktop = null;
let panX = 0, panY = 0, zoom = 1;
let panning = false;
let panStartX = 0, panStartY = 0, panBaseX = 0, panBaseY = 0;
let spaceDown = false;

// When true, background left-drag draws instead of panning (collab blackboard).
// Middle-mouse, Space+drag, Alt+drag still pan regardless.
let _drawMode = false;
export function setDrawMode(active) { _drawMode = active; }

// Called after every pan/zoom apply() — lets overlay elements in #desktop
// (e.g. cursor layer) follow the canvas transform without being inside it.
const _viewCbs = new Set();
export function onViewChange(cb) {
    _viewCbs.add(cb);
    return () => _viewCbs.delete(cb);
}

export function initCanvas(canvas) {
    canvasEl = canvas;
    desktop  = canvas.parentElement;

    // Restore saved view (ignore stale data gracefully). Nothing saved → frame
    // the default layout, which is wider than most windows.
    let restored = false;
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (s && isFinite(s.panX) && isFinite(s.panY) && isFinite(s.zoom)) {
            panX = s.panX; panY = s.panY;
            zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom));
            restored = true;
        }
    } catch (_) {}

    // ── Two-zone background divs ────────────────────────────────────────────
    // Both are the FIRST children appended to #vj-canvas so they are naturally
    // behind all panels (panels have explicit positive z-index). No z-index is
    // set on these divs — source-order is enough and avoids the z-index:-1
    // "behind a transparent stacking context" ambiguity that Firefox handles
    // differently than Chromium.

    // Outer workspace — 2×4K area with very faint tint vs. the void.
    const workspace = document.createElement("div");
    workspace.className = "canvas-workspace";
    workspace.style.cssText =
        `position:absolute;left:${WORK_OX}px;top:${WORK_OY}px;` +
        `width:${WORK_W}px;height:${WORK_H}px;pointer-events:none;`;
    canvas.appendChild(workspace);

    // Home rectangle — the area the default layout is arranged in, drawn a shade
    // brighter so "where everything started" stays findable after a long pan.
    const stage = document.createElement("div");
    stage.className = "canvas-stage";
    stage.style.cssText =
        `position:absolute;left:0;top:0;` +
        `width:${HOME_W}px;height:${HOME_H}px;pointer-events:none;`;
    canvas.appendChild(stage);

    if (restored) apply(); else fitHome();

    // ── Zoom: Ctrl+scroll / trackpad pinch ───────────────────────────────────
    desktop.addEventListener("wheel", (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    // ── Pan: middle-mouse, Alt+drag, Space+drag, or background left-drag ─────
    desktop.addEventListener("pointerdown", (e) => {
        const onPanel    = !!e.target.closest(".panel");
        const isMiddle   = e.button === 1;
        const isAltDrag  = e.button === 0 && e.altKey && !onPanel;
        const isSpaceDrag = e.button === 0 && spaceDown && !onPanel;
        // Left-drag on bare background pans only when collab draw mode is off.
        const isBgDrag   = e.button === 0 && !onPanel && !_drawMode;
        if (!isMiddle && !isAltDrag && !isSpaceDrag && !isBgDrag) return;
        e.preventDefault();
        panning = true;
        panStartX = e.clientX; panStartY = e.clientY;
        panBaseX  = panX;      panBaseY  = panY;
        desktop.setPointerCapture(e.pointerId);
        desktop.classList.add("panning");
    });

    desktop.addEventListener("pointermove", (e) => {
        if (!panning) return;
        const uz = uiZoom();
        panX = panBaseX + (e.clientX - panStartX) / uz;
        panY = panBaseY + (e.clientY - panStartY) / uz;
        apply();
    });

    const endPan = (e) => {
        if (!panning) return;
        panning = false;
        try { desktop.releasePointerCapture(e.pointerId); } catch (_) {}
        desktop.classList.remove("panning");
        if (!spaceDown) desktop.classList.remove("space-pan");
        save();
    };
    desktop.addEventListener("pointerup",     endPan);
    desktop.addEventListener("pointercancel", endPan);

    // ── Double-click background → reset view ─────────────────────────────────
    desktop.addEventListener("dblclick", (e) => {
        if (!e.target.closest(".panel")) resetView();
    });

    // ── Space key: show grab cursor while held ────────────────────────────────
    const isTyping = () => {
        const el = document.activeElement;
        const t  = el?.tagName;
        if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return true;
        // CodeMirror focuses a hidden textarea (caught above) on most browsers and a
        // contenteditable on others — and Space in the editor is a space, never a pan.
        return !!el && (el.isContentEditable || !!el.closest?.(".CodeMirror"));
    };
    window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && !e.repeat && !isTyping()) {
            e.preventDefault();
            spaceDown = true;
            desktop.classList.add("space-pan");
        }
    });
    window.addEventListener("keyup", (e) => {
        if (e.code !== "Space") return;
        spaceDown = false;
        if (!panning) desktop.classList.remove("space-pan");
    });

    // Zoom indicator chip — click to reset.
    document.getElementById("canvas-zoom-ind")
        ?.addEventListener("click", resetView);
}

// Reset = frame the home rectangle, not "zoom 1 at the origin". The default
// layout is 1920 wide and most windows are not, so a literal reset would leave a
// first-time user staring at panels they cannot see and no reason to suspect the
// canvas extends past the edge.
export function resetView() {
    fitHome();
    save();
}

// Zoom/pan so the home rectangle fills the viewport with a small margin.
export function fitHome() {
    if (!desktop) return;
    const vw = desktop.clientWidth  || window.innerWidth;
    const vh = desktop.clientHeight || window.innerHeight;
    const M  = 24;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
        Math.min((vw - M * 2) / HOME_W, (vh - M * 2) / HOME_H)));
    panX = (vw - HOME_W * zoom) / 2;
    panY = (vh - HOME_H * zoom) / 2;
    apply();
}

export function getZoom() { return zoom; }
export function getPan()  { return { x: panX, y: panY }; }

// Pan so that `el` (a DOM element in canvas-space) is centered in the viewport.
// No-ops if el is already fully inside with 40 px breathing room.
export function panToReveal(el) {
    if (!el || !canvasEl) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const GUARD = 40;
    if (rect.width > 0 &&
        rect.left >= GUARD && rect.right  <= vw - GUARD &&
        rect.top  >= GUARD && rect.bottom <= vh - GUARD) return;
    const uz = uiZoom();
    panX += (vw / 2 - (rect.left + rect.right)  / 2) / uz;
    panY += (vh / 2 - (rect.top  + rect.bottom) / 2) / uz;
    apply();
}

// Convert viewport px → canvas-space px.
export function screenToCanvas(screenX, screenY) {
    const rect = desktop.getBoundingClientRect();
    const uz = uiZoom();
    return {
        x: ((screenX - rect.left) / uz - panX) / zoom,
        y: ((screenY - rect.top)  / uz - panY) / zoom,
    };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Ratio of CSS-zoomed visual size to layout size on #desktop.
// Pointer clientX/Y is in viewport (visual) px; panel offsetLeft/Top is in
// layout px. This factor converts between them.
function uiZoom() {
    if (!desktop) return 1;
    const w = desktop.offsetWidth;
    return w ? (desktop.getBoundingClientRect().width / w) || 1 : 1;
}

function zoomAt(screenMx, screenMy, factor) {
    const rect   = desktop.getBoundingClientRect();
    const uz     = uiZoom();
    const cx = (screenMx - rect.left) / uz;
    const cy = (screenMy - rect.top)  / uz;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    panX = cx - (cx - panX) * newZoom / zoom;
    panY = cy - (cy - panY) * newZoom / zoom;
    zoom = newZoom;
    apply(); save();
}

function apply() {
    if (!canvasEl) return;

    // Soft pan clamp: at least 200px of the workspace must stay visible.
    if (desktop) {
        const vw = desktop.clientWidth  || window.innerWidth;
        const vh = desktop.clientHeight || window.innerHeight;
        const M  = 200;
        // workspace right/bottom must stay >= M px inside the left/top screen edge
        panX = Math.max(M - (WORK_OX + WORK_W) * zoom, panX);
        panY = Math.max(M - (WORK_OY + WORK_H) * zoom, panY);
        // workspace left/top must stay <= M px inside the right/bottom screen edge
        panX = Math.min(vw - M - WORK_OX * zoom, panX);
        panY = Math.min(vh - M - WORK_OY * zoom, panY);
    }

    // Apply transform: use left/top for translation (avoids transform-origin
    // arithmetic for pinned panels), scale() for zoom.
    canvasEl.style.left      = `${panX}px`;
    canvasEl.style.top       = `${panY}px`;
    canvasEl.style.transform = zoom !== 1 ? `scale(${zoom})` : "";

    // Pinned panels stay at a fixed desktop-space position — back-solve their
    // canvas-space coordinates from the pinned desktop-space target.
    for (const p of canvasEl.querySelectorAll(".panel[data-pinned]")) {
        const dpx = parseFloat(p.dataset.pinDpx) || 0;
        const dpy = parseFloat(p.dataset.pinDpy) || 0;
        p.style.left = `${(dpx - panX) / zoom}px`;
        p.style.top  = `${(Math.max(dpy, 0) - panY) / zoom}px`;
    }

    // ── Dot-grid background on #desktop ──────────────────────────────────────
    // The CSS defines two radial-gradient layers (coarse + fine). We maintain
    // a 5:1 tile-size ratio and set them separately so both scale with zoom.
    // A single backgroundPosition value applies to all layers uniformly (they
    // shift together), but the modulo uses the fine-grid pitch so it stays
    // within [0, fineSize) which is also within the coarse tile.
    const gs = GRID * zoom;          // fine grid tile size
    const gsC = gs * 5;              // coarse grid tile size (5:1 ratio)
    desktop.style.backgroundSize =
        `${gsC}px ${gsC}px, ${gs}px ${gs}px`;
    desktop.style.backgroundPosition =
        `${panX % gs}px ${panY % gs}px`;

    const ind = document.getElementById("canvas-zoom-ind");
    if (ind) ind.textContent = `${Math.round(zoom * 100)}%`;

    // Notify overlay elements in #desktop that follow the canvas transform.
    for (const cb of _viewCbs) cb(panX, panY, zoom);
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ panX, panY, zoom }));
    } catch (_) {}
}
