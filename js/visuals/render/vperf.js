// How much of the main thread the picture may take.
//
// ── What "audio vs video priority" actually means here ───────────────────────
// The audio ENGINE is not on the main thread: scsynth is compiled to WebAssembly and
// runs in an AudioWorklet, on the browser's real-time audio thread. No amount of
// visual work can starve the DSP itself, and a stuttering picture never turns into a
// crackling sound.
//
// What IS on the main thread is the CLOCK — clock.js re-arms itself with
// setTimeout(…, 10) — and therefore the SCHEDULING of every note. Events are
// dispatched LOOKAHEAD_S = 0.12s early with an NTP timetag, so scsynth plays them at
// the right instant regardless of jitter: the main thread can stall for up to about
// 120ms and nothing is late. Past that, notes miss their timetag and arrive late.
//
// So the trade is real but narrow, and it is a trade about LATENESS, not about audio
// quality. These three knobs decide how much of a frame the visuals may spend before
// they start eating that 120ms of slack:
//
//   vfps(n)      how often to draw at all. The biggest lever by far — 30fps is half
//                the main-thread work of 60 for a picture most sets cannot tell apart.
//   vbudget(ms)  how long the CPU-drawn workshop layers may take per frame. Layers
//                over budget redraw every Nth frame instead (see wsdeck.js).
//   vres/wres    how big to draw — GPU shader work and canvas upload respectively.
//
// Its own module, like wsres.js, so the visual LANGUAGE can expose these without
// importing the deck and dragging the 1.6MB layer registry in at boot.

const DEFAULT_FPS    = 0;      // 0 = every frame the browser offers
const DEFAULT_BUDGET = 4;      // ms — measured: slimemold alone is ~17ms

let fpsCap   = DEFAULT_FPS;
let budgetMs = DEFAULT_BUDGET;
let nextDue  = 0;

export function setVisualFps(n) {
    const v = Number(n);
    fpsCap = (n == null || !isFinite(v) || v <= 0) ? 0 : Math.max(1, Math.min(240, v));
    nextDue = 0;
    return fpsCap;
}
export function visualFps() { return fpsCap; }

export function setVisualBudget(ms) {
    const v = Number(ms);
    budgetMs = (ms == null || !isFinite(v)) ? DEFAULT_BUDGET : Math.max(0.5, Math.min(50, v));
    return budgetMs;
}
export function visualBudget() { return budgetMs; }

/**
 * Frame gate for a rAF loop. Call with the rAF timestamp AFTER re-arming the next
 * frame, and return early when it says no.
 *
 * Deliberately not a setInterval: rAF is the only callback the compositor aligns to,
 * so a capped loop still paints on a real frame boundary rather than half-way through
 * one. Drifting `nextDue` forward from the deadline rather than from `ts` keeps the
 * average rate honest when a frame runs long, and the clamp stops it trying to catch
 * up after a tab has been in the background.
 */
export function allowFrame(ts) {
    if (!fpsCap) return true;
    const step = 1000 / fpsCap;
    if (ts < nextDue) return false;
    nextDue = (nextDue && ts - nextDue < step * 4) ? nextDue + step : ts + step;
    return true;
}

// ── Measurement, so the report is something you read rather than guess ───────
let emaMs = 0, frames = 0, sinceMs = 0, lastFps = 0;
export function noteFrame(ms, ts) {
    emaMs += (ms - emaMs) * 0.1;
    frames++;
    if (!sinceMs) sinceMs = ts;
    else if (ts - sinceMs >= 1000) { lastFps = frames * 1000 / (ts - sinceMs); frames = 0; sinceMs = ts; }
}
/** { ms: mean cost of a visual frame, fps: frames actually drawn per second }. */
export function visualStats() { return { ms: emaMs, fps: lastFps }; }
