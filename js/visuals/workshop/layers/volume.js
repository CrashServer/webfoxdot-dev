// ── Volume layer ──────────────────────────────────────────────────────────
// Seventh workshop layer, and the "advanced mapping" step up from the flat
// Canvas2D layers: a raymarched, lit SDF volume (smooth-union'd blobs), so
// students see real 3D shading (normals, diffuse, rim light) rather than a
// flat silhouette — the natural next thing after corner-pinning quads onto a
// physical 3D object. Renders via WebGL2 (src/webgl/glVolume.js); if the
// browser/tablet doesn't have it, draws a plain fallback message instead of
// breaking the rest of the (otherwise GPU-API-free) app.
import * as gl from "../webgl/glVolume.js";

export const volumeParams = () => ({
    spin:     { base: 0.4, min: -2,  max: 2,   mod: { source: "" } },
    smoothK:  { base: 0.5, min: 0.05, max: 1.5, mod: { source: "" } },
    dist:     { base: 3,   min: 1.5, max: 8,   mod: { source: "" } },
    hue:      { base: 200, min: 0,   max: 360, mod: { source: "" } },
    sat:      { base: 80,  min: 0,   max: 100, mod: { source: "" } },
    light:    { base: 55,  min: 0,   max: 100, mod: { source: "" } },
});

export function drawVolume(ctx, w, h, p, t) {
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
