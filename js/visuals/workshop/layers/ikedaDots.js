// ── Ikeda Dots ────────────────────────────────────────────────────────────────
// Grid of dots where each dot's radius = its frequency bin amplitude.
// Bass flashes the whole field white; beat triggers a radius burst.
// Inspired by Ryoji Ikeda's "micro" / "superposition" series.

const _state = new WeakMap();

export const ikedaDotsParams = () => ({
    cols:    { base: 32,  min: 4,   max: 64,  step: 1, mod: { source: "" } },
    size:    { base: 1,   min: 0.1, max: 3,   mod: { source: "" } },
    hue:     { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    mono:    { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    thresh:  { base: 0.1, min: 0,   max: 0.9, mod: { source: "" } },
    speed:   { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
});

export function drawIkedaDots(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { pulse: 0, prevBass: 0, phase: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum ?? [];
    const bass = sp.length ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2.8) : 0;

    if (bass > 0.55 && bass > st.prevBass + 0.06) st.pulse = 1;
    st.prevBass = bass;
    st.pulse *= 0.88;
    st.phase += 0.016 * (p.speed ?? 1);

    const cols   = Math.max(4, Math.round(p.cols ?? 32));
    const rows   = Math.round(cols * h / w);
    const cw     = w / cols;
    const ch     = h / rows;
    const maxR   = Math.min(cw, ch) * 0.45 * (p.size ?? 1);
    const thresh = p.thresh ?? 0.1;
    const mono   = (p.mono ?? 1) > 0.5;
    const hue    = p.hue ?? 0;
    const bins   = sp.length || 1;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const flash = st.pulse * 0.4;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const idx = Math.floor((row * cols + col) / (rows * cols) * bins);
            let v = sp[idx] ?? 0;
            v = Math.min(1, v * 2.5);
            if (v < thresh) continue;

            const cx = (col + 0.5) * cw;
            const cy = (row + 0.5) * ch;
            const r  = maxR * (v + flash * (1 - v));

            if (mono) {
                const bright = Math.min(1, v + flash);
                const g = (bright * 255) | 0;
                ctx.fillStyle = `rgb(${g},${g},${g})`;
            } else {
                const h2 = (hue + v * 60 + st.phase * 20) % 360;
                const l  = 20 + v * 50 + flash * 30;
                ctx.fillStyle = `hsl(${h2},80%,${l}%)`;
            }

            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, 6.2832);
            ctx.fill();
        }
    }
}
