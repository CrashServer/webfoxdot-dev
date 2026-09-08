// ── Elastic Grid ──────────────────────────────────────────────────────────────
// NxN grid of points displaced analytically by sine warp + audio spectrum.
// Draws horizontal and vertical polylines through displaced positions, plus
// glowing intersection dots. Bass increases warpStrength; each column perturbed
// by its spectrum band; beat adds a large pulse warp.

const _state = new WeakMap();

export const elasticGridParams = () => ({
    hue:          { base: 180, min: 0,   max: 360, mod: { source: "" } },
    count:        { base: 10,  min: 4,   max: 20,  step: 1, mod: { source: "" } },
    warpStrength: { base: 0.3, min: 0,   max: 1,   mod: { source: "" } },
    warpFreq:     { base: 2,   min: 0.5, max: 4,   mod: { source: "" } },
    speed:        { base: 0.3, min: 0,   max: 2,   mod: { source: "" } },
    glow:         { base: 1.5, min: 0,   max: 3,   mod: { source: "" } },
    lineWidth:    { base: 1.5, min: 0.5, max: 4,   mod: { source: "" } },
});

export function drawElasticGrid(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, prevBass: 0, pulseBurst: 0 }; _state.set(ctx, st); }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) st.pulseBurst = 1;
    st.prevBass = bass;
    st.pulseBurst *= 0.88;

    const hue         = p.hue ?? 180;
    const count       = Math.max(4, Math.min(20, Math.round(p.count ?? 10)));
    const warpFreq    = p.warpFreq ?? 2;
    const warpSpeed   = (p.speed ?? 0.3);
    const baseWarp    = (p.warpStrength ?? 0.3) * (1 + bass * 1.5);
    const glow        = p.glow ?? 1.5;
    const lw          = p.lineWidth ?? 1.5;
    const pulseExtra  = st.pulseBurst * 0.4;
    const warpStr     = Math.min(1.5, baseWarp + pulseExtra);
    const T           = st.time * warpSpeed;

    // Compute displaced position for grid point (c, r) in [0, count-1]^2
    function getPos(c, r) {
        const gx = (c / (count - 1)) * w;
        const gy = (r / (count - 1)) * h;

        // Analytical warp
        const nx  = c / count;
        const ny  = r / count;
        const dx  = Math.sin(ny * warpFreq * Math.PI * 2 + T) * warpStr * Math.sin(T * 0.3) * w * 0.12;
        const dy  = Math.sin(nx * warpFreq * Math.PI * 2 + T + 1.5) * warpStr * Math.cos(T * 0.3) * h * 0.12;

        // Spectrum influence: each column perturbed by spectrum band
        let specShiftY = 0;
        if (sp) {
            const bandIdx = (c / count * 63) | 0;
            specShiftY = sp[bandIdx] * 0.18 * h;
        }

        return { x: gx + dx, y: gy + dy + specShiftY };
    }

    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth   = lw;
    ctx.strokeStyle = `hsl(${hue},70%,45%)`;
    ctx.shadowBlur = 0;

    // Horizontal lines
    for (let r = 0; r < count; r++) {
        ctx.beginPath();
        for (let c = 0; c < count; c++) {
            const { x, y } = getPos(c, r);
            c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Vertical lines
    for (let c = 0; c < count; c++) {
        ctx.beginPath();
        for (let r = 0; r < count; r++) {
            const { x, y } = getPos(c, r);
            r === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Intersection dots with glow
    if (glow > 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle   = `hsl(${hue},90%,75%)`;
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                const { x, y } = getPos(c, r);
                ctx.beginPath();
                ctx.arc(x, y, lw * 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
    }
}
