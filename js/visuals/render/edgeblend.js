// ── Edge blending for output surfaces ────────────────────────────────────────
// Draws black gradient overlays on the 4 edges of a canvas after the warped
// content has been drawn.  Each edge value is a fraction [0, 0.5] of the
// canvas dimension — 0 = no blend, 0.5 = half the canvas darkened to black.
//
// This matches how real multi-projector edge blending works: the projector
// that owns the edge fades its own output to black in the overlap zone, while
// the adjacent projector does the same from its side.  The window background
// is already #000, so drawing a black gradient with globalAlpha is correct —
// it simply reduces the projector's light output in the overlap region.

export function createEdgeBlend() {
    return { left: 0, right: 0, top: 0, bottom: 0, gamma: 2.2 };
}

// Call after the surface content (warped or flat) has been drawn.
// Modifies ctx only when at least one blend value > 0.
export function applyEdgeBlend(ctx, W, H, blend) {
    const { left=0, right=0, top=0, bottom=0 } = blend;
    if (!left && !right && !top && !bottom) return;

    ctx.save();
    // source-atop: gradient pixels are only drawn where content already exists,
    // so the black doesn't spill outside the image into the transparent area.
    ctx.globalCompositeOperation = "source-atop";

    function drawEdge(x1, y1, x2, y2, rx, ry, rw, rh) {
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, rw, rh);
    }

    if (left   > 0) drawEdge(0,         0, left*W,       0,  0,           0,      left*W,    H);
    if (right  > 0) drawEdge(W,         0, W-right*W,    0,  W-right*W,   0,      right*W,   H);
    if (top    > 0) drawEdge(0,         0, 0,            top*H, 0,         0,      W,         top*H);
    if (bottom > 0) drawEdge(0,         H, 0,            H-bottom*H, 0,   H-bottom*H, W,      bottom*H);

    ctx.restore();
}
