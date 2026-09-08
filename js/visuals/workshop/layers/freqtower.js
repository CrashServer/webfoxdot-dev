// ── FreqTower layer ───────────────────────────────────────────────────────
// Full port of web/shaders/layer_freqtower.wgsl — see glFreqTower.js for
// the feature list. JS side handles burst peak-hold: instantaneous attack,
// exponential decay (~1.3 s to zero at 60 fps).
import * as gl from "../webgl/glFreqTower.js";

export const freqTowerParams = () => ({
    spin:       { base: 0.25, min: -2,    max: 2,   mod: { source: "" } },
    camDist:    { base: 2.4,  min: 1.2,   max: 6,   mod: { source: "" } },
    camHeight:  { base: 0.12, min: -0.5,  max: 0.5, mod: { source: "" } },
    scale:      { base: 1,    min: 0.4,   max: 2,   mod: { source: "" } },
    thickReact: { base: 1,    min: 0,     max: 3,   mod: { source: "" } },
    evolveAmt:  { base: 0.4,  min: 0,     max: 1,   mod: { source: "" } },
    evolveSpd:  { base: 0.7,  min: 0.05,  max: 3,   mod: { source: "" } },
    burstStr:   { base: 1.2,  min: 0,     max: 3,   mod: { source: "" } },
    glow:       { base: 0.8,  min: 0,     max: 2,   mod: { source: "" } },
    brightness: { base: 1,    min: 0,     max: 2,   mod: { source: "" } },
    hueBass:    { base: 10,   min: 0,     max: 360, mod: { source: "" } },
    hueTreble:  { base: 200,  min: 0,     max: 360, mod: { source: "" } },
    sat:        { base: 85,   min: 0,     max: 100, mod: { source: "" } },
    light:      { base: 55,   min: 0,     max: 100, mod: { source: "" } },
});

// Per-instance burst state — one Float32Array per channel using this layer.
// Keyed by the Canvas2D context (unique per channel).
const _burstByCtx = new WeakMap();

export function drawFreqTower(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    if (!gl.supported()) {
        ctx.fillStyle = "#333";
        ctx.font = "16px system-ui, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("WebGL2 not available on this device", w / 2, h / 2);
        return;
    }

    const spectrum = extra?.spectrum ?? new Float32Array(64);

    // JS-side burst peak-hold: instant attack, exponential decay ~1.3 s
    let burst = _burstByCtx.get(ctx);
    if (!burst) { burst = new Float32Array(16); _burstByCtx.set(ctx, burst); }
    for (let i = 0; i < 16; i++) {
        const b = i * 4;
        const energy = (spectrum[b] + spectrum[b+1] + spectrum[b+2] + spectrum[b+3]) * 0.25;
        if (energy > burst[i]) burst[i] = energy;
        else burst[i] *= 0.92;
    }

    const glCanvas = gl.render(w, h, p, t, spectrum, burst);
    if (glCanvas) ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);
}
