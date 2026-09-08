// ── Voronoi layer ─────────────────────────────────────────────────────────
// Ported from the WebGPU version's layer_voronoi.wgsl (see webgl/glVoronoi.js
// for what changed). Animated cellular/crystalline pattern.
import * as gl from "../webgl/glVoronoi.js";

export const voronoiParams = () => ({
    scale:      { base: 1,    min: 0.2, max: 4,   mod: { source: "" } },
    speed:      { base: 0.4,  min: -3,  max: 3,   mod: { source: "" } },
    edge:       { base: 0.15, min: 0.01,max: 1,   mod: { source: "" } },
    contrast:   { base: 1,    min: 0.2, max: 3,   mod: { source: "" } },
    hueA:       { base: 280,  min: 0,   max: 360, mod: { source: "" } },
    hueB:       { base: 160,  min: 0,   max: 360, mod: { source: "" } },
    sat:        { base: 80,   min: 0,   max: 100, mod: { source: "" } },
    light:      { base: 55,   min: 0,   max: 100, mod: { source: "" } },
    glow:       { base: 0.5,  min: 0,   max: 2,   mod: { source: "" } },
    brightness: { base: 1,    min: 0,   max: 2,   mod: { source: "" } },
});

export function drawVoronoi(ctx, w, h, p, t) {
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
