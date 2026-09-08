// ── Cyberpunk World layer ──────────────────────────────────────────────────────
// Raymarched industrial corridor: arched concrete tunnel, cable bundles,
// neon floor channel, amber hub connectors, volumetric fog. Camera flies
// forward. Audio-reactive: bass pulses floor + hubs, mid sways cables,
// treble brightens ceiling lights.
import * as gl from "../webgl/glCyberpunkWorld.js";

export const cyberpunkWorldParams = () => ({
    camSpeed:          { base: 1.5,  min: 0,   max: 6,   mod: { source: "" } },
    camSway:           { base: 0.4,  min: 0,   max: 2,   mod: { source: "" } },
    fov:               { base: 80,   min: 40,  max: 120, mod: { source: "" } },
    fogDensity:        { base: 1.2,  min: 0,   max: 5,   mod: { source: "" } },
    channelHue:        { base: 140,  min: 0,   max: 360, mod: { source: "" } },  // 140 = neon green
    channelBrightness: { base: 2.0,  min: 0.5, max: 5,   mod: { source: "" } },
    lightSpacing:      { base: 7,    min: 3,   max: 20,  mod: { source: "" } },
    hubSpacing:        { base: 15,   min: 8,   max: 40,  mod: { source: "" } },
    hubGlow:           { base: 1.5,  min: 0,   max: 4,   mod: { source: "" } },
    cableSway:         { base: 1.0,  min: 0,   max: 3,   mod: { source: "" } },
    brightness:        { base: 1.0,  min: 0.2, max: 3,   mod: { source: "" } },
    contrast:          { base: 1.2,  min: 0.5, max: 2.5, mod: { source: "" } },
});

export function drawCyberpunkWorld(ctx, w, h, p, t, extra) {
    ctx.clearRect(0, 0, w, h);
    if (!gl.supported()) {
        ctx.fillStyle = "#333";
        ctx.font = "16px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WebGL2 not available on this device", w / 2, h / 2);
        return;
    }

    // Extract audio bands from spectrum (64 bins)
    const sp = extra?.spectrum;
    let bass = 0, mid = 0, treble = 0;
    if (sp) {
        // Bass: bins 0-4  (~20-200 Hz)
        for (let i = 0; i < 5; i++) bass += sp[i];
        bass /= 5;
        // Mid: bins 10-30  (~400-2000 Hz)
        for (let i = 10; i < 30; i++) mid += sp[i];
        mid /= 20;
        // Treble: bins 44-63  (~6000-20000 Hz)
        for (let i = 44; i < 64; i++) treble += sp[i];
        treble /= 20;
    }

    const glCanvas = gl.render(w, h, { ...p, bass, mid, treble }, t);
    // GL origin is bottom-left; rendered region sits at canvas bottom-left.
    if (glCanvas) ctx.drawImage(glCanvas, 0, glCanvas.height - h, w, h, 0, 0, w, h);
}
