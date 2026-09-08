// Render-size cap for the CPU-drawn workshop layers. Its own module so the visual
// LANGUAGE can expose wres() without importing the deck — and therefore without
// dragging in the 1.6MB layer registry at boot, which is the whole point of loading
// that on demand.
//
// Measured first, because the obvious reason was wrong: these layers cost almost the
// same at 640×360 as at 3840×2160 (doomcorridor 0.4→0.5ms, mandelbulb 0.1→0.1ms).
// They do fixed geometry and agent work, not pixel filling — see wsdeck.js's frame
// budget for what actually costs.
//
// The cap earns its place on UPLOAD. Each deck reaches the GPU with a texImage2D from
// its canvas every frame, and 3840×2160 RGBA is 33MB — 2GB/s for two decks at 60fps,
// for a picture the shader then filters down anyway. 1280 is the compromise; wres(0)
// opts out, which is what text and data-wall layers want.
const DEFAULT = 1280;
let wsMax = DEFAULT;

export function setWorkshopRes(px) {
    const v = Number(px);
    wsMax = (px == null || !isFinite(v)) ? DEFAULT : (v <= 0 ? 0 : Math.max(160, Math.min(4096, Math.round(v))));
}
export function workshopRes() { return wsMax; }

/** The size the deck should draw at for a given output size, keeping the aspect. */
export function capSize(w, h) {
    if (!wsMax) return [w, h];
    const longest = Math.max(w, h);
    if (longest <= wsMax) return [w, h];
    const k = wsMax / longest;
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}
