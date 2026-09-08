// ── Mandelbox layer ───────────────────────────────────────────────────────
// Ported from the WebGPU version's layer_mandelbox.wgsl (see
// webgl/glMandelbox.js for the one behavior change). 7th layer on the
// shared WebGL2 context, 15th layer overall.
import * as gl from "../webgl/glMandelbox.js";

export const mandelboxParams = () => ({
    scale:      { base: 2.3, min: 1.5, max: 3,   mod: { source: "" } },
    spin:       { base: 0.2, min: -2,  max: 2,   mod: { source: "" } },
    iters:      { base: 10,  min: 4,   max: 14,  mod: { source: "" } },
    camDist:    { base: 2.6, min: 1.5, max: 5,   mod: { source: "" } },
    minR2:      { base: 0.3, min: 0.05, max: 0.9, mod: { source: "" } },
    hueA:       { base: 20,  min: 0,   max: 360, mod: { source: "" } },
    hueB:       { base: 260, min: 0,   max: 360, mod: { source: "" } },
    sat:        { base: 80,  min: 0,   max: 100, mod: { source: "" } },
    light:      { base: 55,  min: 0,   max: 100, mod: { source: "" } },
    glow:       { base: 0.8, min: 0,   max: 2,   mod: { source: "" } },
    brightness: { base: 1,   min: 0,   max: 2,   mod: { source: "" } },
});

export function drawMandelbox(ctx, w, h, p, t) {
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
