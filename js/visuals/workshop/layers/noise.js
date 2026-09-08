// ── Noise layer ───────────────────────────────────────────────────────────
// 8 GPU noise subtypes in one layer, driver-assignable across all params.
// Runs on the shared WebGL2 context (glShared.js) — no extra context cost.
//
// type slider:  0 White · 1 Value · 2 Perlin · 3 Billow
//               4 Ridged · 5 Warp · 6 Cellular · 7 Curl
import * as gl from "../webgl/glNoise.js";

// Labels shown in the channel UI for the integer type slider.
// Stored here so the draw function can print it in the fallback text.
export const NOISE_TYPE_NAMES = [
    "White", "Value", "Perlin fBm", "Billow",
    "Ridged", "Domain Warp", "Cellular", "Curl",
];

export const noiseParams = () => ({
    // Integer 0-7. Slider snaps on draw (round in shader). Driver-assignable
    // so you can sweep through types with a CC or LFO.
    type:       { base: 2,   min: 0,   max: 7,   step: 1, mod: { source: "" } },
    scale:      { base: 4,   min: 0.2, max: 20,  mod: { source: "" } },
    speed:      { base: 0.3, min: -3,  max: 3,   mod: { source: "" } },
    // fBm controls — matter for types 2-5 and 7
    octaves:    { base: 4,   min: 1,   max: 8,   mod: { source: "" } },
    lacunarity: { base: 2,   min: 1.2, max: 4,   mod: { source: "" } },
    gain:       { base: 0.5, min: 0.1, max: 0.9, mod: { source: "" } },
    // Output shaping
    contrast:   { base: 1.5, min: 0.1, max: 6,   mod: { source: "" } },
    brightness: { base: 0,   min: -1,  max: 1,   mod: { source: "" } },
    // Color
    hue:        { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    hueRange:   { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    saturation: { base: 80,  min: 0,   max: 100, mod: { source: "" } },
});

export function drawNoise(ctx, w, h, p, t) {
    ctx.clearRect(0, 0, w, h);
    if (!gl.supported()) {
        ctx.fillStyle = "#333";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("WebGL2 not available", w / 2, h / 2);
        return;
    }
    const typeName = NOISE_TYPE_NAMES[Math.round(Math.min(7, Math.max(0, p.type)))] ?? "";
    const glCanvas = gl.render(w, h, p, t);
    if (glCanvas) ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);

    // Tiny type label in the corner — helpful while sweeping through types live
    ctx.save();
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText(typeName, w - 6, h - 4);
    ctx.restore();
}
