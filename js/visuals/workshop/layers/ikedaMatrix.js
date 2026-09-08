// ── Ikeda Matrix ──────────────────────────────────────────────────────────────
// Ryoji Ikeda data-aesthetic: precision grid of spectrum-driven cells.
// Squares / digits / dots / bars display frequency data at clinical resolution.
// Bass inverts palette and triggers a full-grid strobe; treble adds scan lines;
// mid drives a secondary color layer for non-mono mode.

const _state = new WeakMap();

class IkedaMatrixViz {
    constructor() { this.invert = 0; this.scanline = 0; this.t = 0; this.lastT = 0;}

    frame(ctx, w, h, p, t, bass, mid, treble, spectrum) {

        const dt = Math.min(0.05, t - this.lastT); this.lastT = t;
        this.t += dt;
        const cols    = Math.round(Math.max(4, Math.min(80, p.cols ?? 40)));
        const rows    = Math.round(Math.max(4, Math.min(40, p.rows ?? 20)));
        const mode    = Math.round(Math.max(0, Math.min(3, p.mode ?? 0)));
        const hue     = (p.hue  ?? 0) | 0;
        const hue2    = (p.hue2 ?? 120) | 0;
        const mono    = (p.mono ?? 1) > 0.5;
        const gamma   = Math.max(0.2, p.gamma ?? 1.4);
        const scanLines = (p.scanLines ?? 0) > 0.5;
        const mirrorX = (p.mirrorX ?? 0) > 0.5;
        const timeShift = p.timeShift ?? 0;

        if (bass > 0.6) this.invert = Math.min(1, this.invert + bass * 0.9);
        this.invert *= 0.93;
        this.scanline = (this.scanline + treble * 4 + 1) % h;

        const inv = this.invert > 0.45;
        ctx.fillStyle = inv ? "#eee" : "#000";
        ctx.fillRect(0, 0, w, h);

        const cw = w / cols, ch = h / rows;
        const gap = Math.max(1, Math.min(4, cw * 0.08));

        // Fine grid
        ctx.strokeStyle = inv ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
        ctx.lineWidth = 0.5;
        for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, h); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(w, r * ch); ctx.stroke(); }

        const fontSize = Math.max(6, Math.min(cw * 0.58, ch * 0.7, 24));
        if (mode === 1 || mode === 3) {
            ctx.font = `${fontSize}px monospace`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
        }

        const halfCols = mirrorX ? Math.ceil(cols / 2) : cols;

        for (let r = 0; r < rows; r++) {
            for (let c2 = 0; c2 < halfCols; c2++) {
                // Time-shift: different rows see different time slices
                const tOffset = timeShift > 0 ? r / rows * timeShift : 0;
                const binC = mirrorX ? c2 : c2;
                const bin = Math.min((spectrum?.length ?? 1) - 1, (binC / cols * (spectrum?.length ?? 1)) | 0);
                const raw = spectrum ? Math.min(1, spectrum[bin] + mid * 0.1) : 0;
                const v   = Math.pow(raw, 1 / gamma);

                // Mid drives secondary value for color mixing
                const v2 = Math.pow(Math.min(1, raw + mid * 0.3), 1 / gamma);

                const cx2 = c2 * cw + cw / 2;
                const cy  = r  * ch + ch / 2;
                const lum = inv ? 100 - v * 92 : v * 92;

                let fillColor;
                if (mono) {
                    const g2 = (lum / 100 * 255) | 0;
                    fillColor = inv ? `rgb(${255-g2},${255-g2},${255-g2})` : `rgb(${g2},${g2},${g2})`;
                } else {
                    // Hue shifts with mid energy
                    const cellHue = hue + v2 * (hue2 - hue);
                    fillColor = inv ? `hsl(${cellHue},${v*80}%,${100 - lum}%)` : `hsl(${cellHue},${v*90}%,${lum}%)`;
                }
                ctx.fillStyle = fillColor;

                const drawCell = (cx3, cy3, flip) => {
                    if (mode === 0) {
                        const sz = Math.max(0, (cw - gap * 2) * v);
                        const sh = sz * (ch / cw);
                        if (sz > 0.5) ctx.fillRect(cx3 - sz/2, cy3 - sh/2, sz, sh);
                    } else if (mode === 1) {
                        if (v > 0.04) ctx.fillText((v * 9) | 0, cx3, cy3);
                    } else if (mode === 2) {
                        const r2 = Math.min(cw, ch) * 0.44 * v;
                        if (r2 > 0.5) { ctx.beginPath(); ctx.arc(cx3, cy3, r2, 0, Math.PI*2); ctx.fill(); }
                    } else {
                        // Vertical bar per cell
                        const barH = ch * 0.85 * v;
                        if (barH > 0.5) ctx.fillRect(cx3 - cw * 0.3, cy3 + ch * 0.425 - barH, cw * 0.6, barH);
                    }
                };

                drawCell(cx2, cy, false);
                if (mirrorX) {
                    const cx3 = (cols - 1 - c2) * cw + cw / 2;
                    drawCell(cx3, cy, true);
                }
            }
        }

        // CRT scanline overlay (treble driven)
        if (scanLines && treble > 0.05) {
            ctx.fillStyle = inv ? `rgba(0,0,0,${0.08 + treble * 0.1})` : `rgba(0,0,0,${0.12 + treble * 0.12})`;
            for (let sy = 0; sy < h; sy += 3) ctx.fillRect(0, sy, w, 1);
        }
        // Bright scanline bar (treble driven)
        if (treble > 0.3) {
            ctx.fillStyle = inv ? `rgba(0,0,0,${treble * 0.15})` : `rgba(255,255,255,${treble * 0.1})`;
            ctx.fillRect(0, this.scanline - 2, w, 4);
        }

        // Bass invert flash vignette
        if (this.invert > 0.1) {
            ctx.fillStyle = inv ? `rgba(255,255,255,${this.invert * 0.15})` : `rgba(255,255,255,${this.invert * 0.08})`;
            ctx.fillRect(0, 0, w, h);
        }
    }
}

export const ikedaMatrixParams = () => ({
    cols:      { base: 40,  min: 4,   max: 80,  mod: { source: "" } },
    rows:      { base: 20,  min: 4,   max: 40,  mod: { source: "" } },
    mode:      { base: 0,   min: 0,   max: 3,   mod: { source: "" } },
    gamma:     { base: 1.4, min: 0.2, max: 5,   mod: { source: "" } },
    mono:      { base: 1,   min: 0,   max: 1,   mod: { source: "" } },
    hue:       { base: 0,   min: 0,   max: 360, mod: { source: "" } },
    hue2:      { base: 120, min: 0,   max: 360, mod: { source: "" } },
    scanLines: { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    mirrorX:   { base: 0,   min: 0,   max: 1,   mod: { source: "" } },
    timeShift: { base: 0,   min: 0,   max: 2,   mod: { source: "" } },
});

export function drawIkedaMatrix(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new IkedaMatrixViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    ctx.clearRect(0, 0, w, h);
    viz.frame(ctx, w, h, p, t, bass, mid, treble, sp);
}
