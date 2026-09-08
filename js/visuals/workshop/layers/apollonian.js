// ── Apollonian layer ──────────────────────────────────────────────────────
// Ported from the WebGPU version's layer_apollonian.wgsl (see
// webgl/glApollonian.js for the one behavior change). 5th layer on the
// shared WebGL2 context.
import * as gl from "../webgl/glApollonian.js";

export const apollonianParams = () => ({
    scale:      { base: 1.4, min: 0.3, max: 4,   mod: { source: "" } },
    speed:      { base: 0.3, min: -2,  max: 2,   mod: { source: "" } },
    iters:      { base: 8,   min: 3,   max: 12,  mod: { source: "" } },
    kBase:      { base: 1.2, min: 0.2, max: 3,   mod: { source: "" } },
    hueA:       { base: 300, min: 0,   max: 360, mod: { source: "" } },
    hueB:       { base: 180, min: 0,   max: 360, mod: { source: "" } },
    sat:        { base: 85,  min: 0,   max: 100, mod: { source: "" } },
    light:      { base: 55,  min: 0,   max: 100, mod: { source: "" } },
    glow:       { base: 1,   min: 0,   max: 2,   mod: { source: "" } },
    brightness: { base: 1,   min: 0,   max: 2,   mod: { source: "" } },
});

export function drawApollonian(ctx, w, h, p, t) {
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
