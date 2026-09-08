// ── Grid ──────────────────────────────────────────────────────────────────────
// Animated grid with sinusoidal warp, perspective compression, scan lines,
// diagonal overlay, bass cell flash, and additive glow intersections.

const _state = new WeakMap();

export const gridParams = () => ({
    cols:        { base: 16,  min: 2,    max: 80,  mod: { source: "" } },
    rows:        { base: 12,  min: 2,    max: 60,  mod: { source: "" } },
    lineW:       { base: 1.5, min: 0.2,  max: 14,  mod: { source: "" } },
    hue:         { base: 180, min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 120, min: 0,    max: 360, mod: { source: "" } },
    sat:         { base: 90,  min: 0,    max: 100, mod: { source: "" } },
    glow:        { base: 1.2, min: 0,    max: 5,   mod: { source: "" } },
    warpAmp:     { base: 18,  min: 0,    max: 100, mod: { source: "" } },
    warpFreq:    { base: 1.5, min: 0.1,  max: 8,   mod: { source: "" } },
    warpSpeed:   { base: 0.4, min: -4,   max: 4,   mod: { source: "" } },
    perspective: { base: 0.3, min: 0,    max: 1,   mod: { source: "" } },
    scanSpeed:   { base: 0.8, min: -4,   max: 4,   mod: { source: "" } },
    diagonal:    { base: 0.4, min: 0,    max: 1,   mod: { source: "" } },
    dotSize:     { base: 4,   min: 0,    max: 20,  mod: { source: "" } },
    fade:        { base: 0.18, min: 0.02, max: 0.9, mod: { source: "" } },
    bassWarp:    { base: 1.8, min: 0,    max: 5,   mod: { source: "" } },
    usePalette:  { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
});

export function drawGrid(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { flow: 0, warpPhase: 0, scanY: 0, prevBass: 0, flashPulse: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    const pal    = p.usePalette > 0.5 ? extra?.palette ?? null : null;

    if (bass > 0.6 && bass > st.prevBass + 0.1) st.flashPulse = 1;
    st.prevBass   = bass;
    st.flashPulse *= 0.82;

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.flow      += dt * 0.4;
    st.warpPhase += dt * p.warpSpeed;
    st.scanY = (st.scanY + dt * p.scanSpeed * (1 + treble * 2) * h * 0.5) % h;

    const cols    = Math.max(2, Math.round(p.cols));
    const rows    = Math.max(2, Math.round(p.rows));
    const warpAmp = p.warpAmp * (1 + bass * p.bassWarp);
    const wf      = p.warpFreq;
    const nBins   = sp ? sp.length : 0;

    function rowY(j) {
        const raw = j / rows;
        if (p.perspective < 0.01) return raw * h;
        return Math.pow(raw, 1 + p.perspective * 2.5) * h;
    }

    const cw = w / cols;
    const W1 = cols + 1, H1 = rows + 1;
    // Pooled node buffer: reused across frames, re-allocated only when the grid
    // resolution changes (cols/rows are driver-assignable, so it can vary).
    const need = W1 * H1 * 2;
    if (!st.nodes || st.nodes.length < need) st.nodes = new Float32Array(need);
    const nodes = st.nodes;
    for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
            const bx = i * cw;
            const by = rowY(j);
            const nx = bx + Math.sin(by * wf * 0.008 + st.warpPhase + j * 0.28) * warpAmp
                          + Math.sin(t * 0.6 + i * 0.5) * warpAmp * 0.25 * mid;
            const ny = by + Math.sin(bx * wf * 0.008 + st.warpPhase * 0.75 + i * 0.28) * warpAmp * 0.7
                          + Math.cos(t * 0.45 + j * 0.45) * warpAmp * 0.25 * mid;
            const idx = (i * H1 + j) * 2;
            nodes[idx] = nx; nodes[idx+1] = ny;
        }
    }
    const getN = (i, j) => { const idx = (i * H1 + j) * 2; return [nodes[idx], nodes[idx+1]]; };

    function palColor(f) {
        if (!pal) return null;
        return pal[Math.min(pal.length - 1, Math.floor(Math.max(0, Math.min(0.9999, f)) * pal.length))];
    }

    const doGlow = p.glow > 0.05;

    // Horizontal lines — glow pass then core pass in one loop to avoid double traversal
    for (let j = 0; j <= rows; j++) {
        const binIdx = nBins ? Math.floor((j / rows) * nBins * 0.45) : 0;
        const binVal = nBins ? (sp[binIdx] ?? 0) : 0;
        const frac   = j / rows;
        const rowHue = (p.hue + frac * p.hueSpread + st.flow * 50) % 360;
        const bright = 38 + binVal * 46 + treble * 10 + st.flashPulse * 18;
        const alpha  = 0.4 + binVal * 0.6;
        const lw     = p.lineW * (0.5 + binVal * 1.3 + bass * 0.35);

        const rowMid   = getN(0, j)[1];
        const scanBoost = Math.max(0, 1 - Math.abs(rowMid - st.scanY) / 40);
        const col = palColor(frac);

        ctx.beginPath();
        for (let i = 0; i < cols; i++) {
            const [x0,y0] = getN(i,j); const [x1,y1] = getN(i+1,j);
            ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
        }

        if (doGlow) {
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = col ?? `hsla(${rowHue},${p.sat}%,${bright}%,${alpha * 0.3 * p.glow})`;
            ctx.lineWidth = lw + p.glow * 10;
            ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = col ?? `hsla(${rowHue},${p.sat}%,${bright + 12 + scanBoost * 30}%,${Math.min(1, alpha + scanBoost * 0.5)})`;
        ctx.lineWidth = lw + scanBoost * p.lineW * 3;
        ctx.stroke();
    }

    // Vertical lines
    for (let i = 0; i <= cols; i++) {
        const binIdx = nBins ? Math.floor((i / cols) * nBins * 0.45 + nBins * 0.25) : 0;
        const binVal = nBins ? (sp[binIdx] ?? 0) : 0;
        const frac   = i / cols;
        const colHue = (p.hue + p.hueSpread * 0.5 + frac * p.hueSpread * 0.5 + st.flow * 35) % 360;
        const bright = 38 + binVal * 46 + bass * 10;
        const alpha  = 0.35 + binVal * 0.55;
        const lw     = p.lineW * (0.4 + binVal * 1.1 + mid * 0.3);
        const col = palColor(frac);

        ctx.beginPath();
        for (let j = 0; j < rows; j++) {
            const [x0,y0] = getN(i,j); const [x1,y1] = getN(i,j+1);
            ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
        }

        if (doGlow) {
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = col ?? `hsla(${colHue},${p.sat}%,${bright}%,${alpha * 0.3 * p.glow})`;
            ctx.lineWidth = lw + p.glow * 10;
            ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = col ?? `hsla(${colHue},${p.sat}%,${bright + 10}%,${alpha})`;
        ctx.lineWidth = lw;
        ctx.stroke();
    }

    // Diagonal overlay — all lines in one batched path
    if (p.diagonal > 0.05) {
        ctx.save();
        ctx.globalAlpha = p.diagonal * 0.5;
        ctx.globalCompositeOperation = "source-over";
        const diagHue = (p.hue + 180) % 360;
        ctx.strokeStyle = `hsl(${diagHue},${p.sat}%,${50 + treble * 20}%)`;
        ctx.lineWidth = p.lineW * 0.6;
        ctx.beginPath();
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const [ax,ay] = getN(i,j+1);
                const [bx,by] = getN(i+1,j);
                ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // Bass cell flash
    if (st.flashPulse > 0.1 && nBins > 0) {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < cols; i++) {
            const binIdx = Math.floor((i / cols) * nBins * 0.5);
            const bv = sp[binIdx] ?? 0;
            if (bv < 0.3) continue;
            const col = palColor(i / cols);
            const ch  = (p.hue + (i/cols)*p.hueSpread) % 360;
            ctx.fillStyle = col ?? `hsla(${ch},100%,70%,${bv * st.flashPulse * 0.35})`;
            ctx.globalAlpha = col ? bv * st.flashPulse * 0.35 : 1;
            for (let j = 0; j < rows; j++) {
                const [ax,ay] = getN(i,j);
                const [bx]    = getN(i+1,j);
                const [,cy2]  = getN(i,j+1);
                ctx.fillRect(ax, ay, bx - ax, cy2 - ay);
            }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
    }

    // Intersection dots — batch glow circles then solid circles
    if (p.dotSize > 0) {
        if (doGlow) {
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i <= cols; i++) {
                for (let j = 0; j <= rows; j++) {
                    const [nx, ny] = getN(i, j);
                    const binIdx = nBins ? Math.floor(((i * H1 + j) / (W1*H1)) * nBins) : 0;
                    const binVal = nBins ? (sp[binIdx] ?? 0) : 0;
                    const r = p.dotSize * (0.25 + binVal + bass * 0.4 * (1 - Math.hypot(i/cols-0.5, j/rows-0.5)));
                    if (r < 0.5) continue;
                    const col = palColor((i / cols + j / rows) * 0.5);
                    const nodeHue = (p.hue + (i/cols + j/rows) * p.hueSpread * 0.5) % 360;
                    ctx.fillStyle = col ?? `hsla(${nodeHue},100%,75%,${0.2 + binVal * 0.5})`;
                    ctx.globalAlpha = col ? (0.2 + binVal * 0.5) * p.glow * 0.4 : 1;
                    ctx.beginPath(); ctx.arc(nx, ny, r * 2.2, 0, Math.PI*2); ctx.fill();
                }
            }
            ctx.globalAlpha = 1;
        }
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                const [nx, ny] = getN(i, j);
                const binIdx = nBins ? Math.floor(((i * H1 + j) / (W1*H1)) * nBins) : 0;
                const binVal = nBins ? (sp[binIdx] ?? 0) : 0;
                const r = p.dotSize * (0.25 + binVal + bass * 0.4 * (1 - Math.hypot(i/cols-0.5, j/rows-0.5)));
                if (r < 0.5) continue;
                const col = palColor((i / cols + j / rows) * 0.5);
                const nodeHue = (p.hue + (i/cols + j/rows) * p.hueSpread * 0.5) % 360;
                ctx.fillStyle = col ?? `hsla(${nodeHue},${p.sat}%,${60+binVal*30}%,${0.75+binVal*0.25})`;
                ctx.globalAlpha = col ? (0.75 + binVal * 0.25) : 1;
                ctx.beginPath(); ctx.arc(nx, ny, r, 0, Math.PI*2); ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }
}
