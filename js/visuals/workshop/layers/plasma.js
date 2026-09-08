// ── Plasma layer ──────────────────────────────────────────────────────────
// Ninth workshop layer, and the second WebGL-backed one — shares a single
// WebGL2 context with Volume (src/webgl/glShared.js) instead of opening its
// own, so adding more shader layers later doesn't burn through the browser's
// ~16-context limit. Same graceful fallback as Volume if WebGL2 is missing.
import * as gl from "../webgl/glPlasma.js";

export const plasmaParams = () => ({
    speed:     { base: 0.6, min: -2,  max: 2,   mod: { source: "" } },
    scale:     { base: 6,   min: 1,   max: 20,  mod: { source: "" } },
    hue:       { base: 280, min: 0,   max: 360, mod: { source: "" } },
    hueSpread: { base: 180, min: 0,   max: 360, mod: { source: "" } },
    sat:       { base: 85,  min: 0,   max: 100, mod: { source: "" } },
    light:     { base: 60,  min: 0,   max: 100, mod: { source: "" } },
});

export function drawPlasma(ctx, w, h, p, t) {
    ctx.clearRect(0, 0, w, h);
    if (!gl.supported()) {
        ctx.fillStyle = "#333";
        ctx.font = "16px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("WebGL2 not available on this device", w / 2, h / 2);
        return;
    }
    const glCanvas = gl.render(w, h, p, t);
    // The shared GL canvas is sized to the LARGEST layer on screen and
    // ours rendered at its origin — which is the BOTTOM-left as an image.
    if (glCanvas) ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);
}
