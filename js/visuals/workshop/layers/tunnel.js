// ── Tunnel layer ──────────────────────────────────────────────────────────
// Ported from the WebGPU version's layer_tunnel.wgsl (see webgl/glTunnel.js
// for what changed). Classic angular-stripe wormhole toward a vanishing point.
import * as gl from "../webgl/glTunnel.js";

export const tunnelParams = () => ({
    stripes:    { base: 10,   min: 1,   max: 40,  mod: { source: "" } },
    speed:      { base: 0.5,  min: -3,  max: 3,   mod: { source: "" } },
    twist:      { base: 0,    min: -5,  max: 5,   mod: { source: "" } },
    contrast:   { base: 1,    min: 0.2, max: 3,   mod: { source: "" } },
    hueA:       { base: 200,  min: 0,   max: 360, mod: { source: "" } },
    hueB:       { base: 40,   min: 0,   max: 360, mod: { source: "" } },
    sat:        { base: 85,   min: 0,   max: 100, mod: { source: "" } },
    light:      { base: 55,   min: 0,   max: 100, mod: { source: "" } },
    glow:       { base: 0.6,  min: 0,   max: 2,   mod: { source: "" } },
    brightness: { base: 1,    min: 0,   max: 2,   mod: { source: "" } },
});

export function drawTunnel(ctx, w, h, p, t) {
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
