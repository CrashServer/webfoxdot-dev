// ── Freq Matrix ───────────────────────────────────────────────────────────────
// N×M grid of cells — each cell brightness = its frequency bin amplitude.
// Direct, data-honest visualization. Beat flashes the entire grid.
// Hue mode tints bands (bass=warm, mid=neutral, treble=cool).

export const freqMatrixParams = () => ({
    cols:    { base: 32,  min: 4,   max: 128, step: 1, mod: { source: "" } },
    rows:    { base: 16,  min: 2,   max: 64,  step: 1, mod: { source: "" } },
    gap:     { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
    gamma:   { base: 1.5, min: 0.3, max: 5,   mod: { source: "" } },
    hue:     { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    mono:    { base: 1,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    mirror:  { base: 0,   min: 0,   max: 1,   step: 1, mod: { source: "" } },
    thresh:  { base: 0.05,min: 0,   max: 0.5, mod: { source: "" } },
});

export function drawFreqMatrix(ctx, w, h, p, t, extra) {
    const sp     = extra?.spectrum ?? [];
    const bins   = sp.length || 1;
    const bass   = bins > 3 ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 2.8) : 0;

    const cols   = Math.max(4, Math.round(p.cols ?? 32));
    const rows   = Math.max(2, Math.round(p.rows ?? 16));
    const gap    = Math.max(0, p.gap ?? 1);
    const gamma  = Math.max(0.3, p.gamma ?? 1.5);
    const mono   = (p.mono ?? 1) > 0.5;
    const mirror = (p.mirror ?? 0) > 0.5;
    const thresh = p.thresh ?? 0.05;
    const hue    = p.hue ?? 0;

    const cw = w / cols;
    const ch = h / rows;
    const gx = Math.min(cw * 0.5, gap);
    const gy = Math.min(ch * 0.5, gap);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Flash on beat
    const flash = bass * 0.15;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Map (row, col) to a frequency bin
            const effectiveCol = mirror && col >= cols / 2 ? cols - 1 - col : col;
            const binIdx = Math.floor(effectiveCol / cols * bins);
            const rowIdx = Math.floor(row / rows * bins);
            // Use col for horizontal sweep, average with row for 2D feel
            const raw = sp[binIdx] ?? 0;
            let v = Math.min(1, Math.pow(Math.max(0, raw), 1 / gamma));
            v = Math.max(0, v - thresh) / (1 - thresh);
            if (v < 0.001 && flash < 0.02) continue;

            const bright = Math.min(1, v + flash);
            const x = col * cw + gx * 0.5;
            const y = row * ch + gy * 0.5;
            const bw = cw - gx;
            const bh = ch - gy;

            if (mono) {
                const g = (bright * 255) | 0;
                ctx.fillStyle = `rgb(${g},${g},${g})`;
            } else {
                const bassEnd = bins * 0.15, midEnd = bins * 0.5;
                let bHue;
                if (binIdx < bassEnd)     bHue = (hue + 20) % 360;
                else if (binIdx < midEnd) bHue = hue % 360;
                else                      bHue = (hue + 200) % 360;
                ctx.fillStyle = `hsl(${bHue},${60 + v * 40}%,${10 + bright * 55}%)`;
            }

            ctx.fillRect(x, y, bw, bh);
        }
    }
}
