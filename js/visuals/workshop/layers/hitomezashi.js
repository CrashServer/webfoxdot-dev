// ── Hitomezashi ───────────────────────────────────────────────────────────────
// Japanese stitch pattern: animated row/column phase offsets create wave flow.
// Bass shifts row phases for beat pulse; treble speeds column animation.
// Two colors alternate, glow, sparkle, smooth wave across pattern.

const _state = new WeakMap();

function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n ^= (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n ^= (n >>> 15);
    return n >>> 0;
}

export const hitomezashiParams = () => ({
    cellSize:    { base: 24,  min: 4,    max: 120, mod: { source: "" } },
    hueH:        { base: 40,  min: 0,    max: 360, mod: { source: "" } },
    hueV:        { base: 200, min: 0,    max: 360, mod: { source: "" } },
    sat:         { base: 85,  min: 0,    max: 100, mod: { source: "" } },
    bright:      { base: 65,  min: 20,   max: 100, mod: { source: "" } },
    speed:       { base: 0.6, min: -6,   max: 6,   mod: { source: "" } },
    lineWidth:   { base: 2.5, min: 0.4,  max: 12,  mod: { source: "" } },
    glow:        { base: 1,   min: 0,    max: 5,   mod: { source: "" } },
    waveAmp:     { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    waveFreq:    { base: 2,   min: 0.2,  max: 8,   mod: { source: "" } },
    seedSpeed:   { base: 0.04, min: 0,   max: 0.5, mod: { source: "" } },
    fade:        { base: 0.15, min: 0.02, max: 0.9, mod: { source: "" } },
    sparkle:     { base: 0.5, min: 0,    max: 1,   mod: { source: "" } },
    bassReact:   { base: 1.8, min: 0,    max: 5,   mod: { source: "" } },
    trebleCol:   { base: 1,   min: 0,    max: 4,   mod: { source: "" } },
});

export function drawHitomezashi(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { scrollX: 0, scrollY: 0, lastT: 0, seed: 0, rowPhases: null, colPhases: null }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    const cell   = Math.max(4, (p.cellSize * (1 + mid * 0.15)) | 0);
    // Bass accelerates the row scroll = beat pulse across the wave
    const spd    = p.speed * (1 + bass * p.bassReact * 0.4);
    // Treble speeds column scrolling separately
    const colSpd = p.speed * (1 + treble * p.trebleCol * 0.8);

    st.scrollX   = (st.scrollX + colSpd * dt * cell * 0.5) % cell;
    st.scrollY   = (st.scrollY + spd   * dt * cell * 0.35) % cell;
    st.seed      = (st.seed + p.seedSpeed * dt * 100) | 0;

    const offX = -((st.scrollX + cell) % cell);
    const offY = -((st.scrollY + cell) % cell);
    const cols  = Math.ceil(w / cell) + 3;
    const rows  = Math.ceil(h / cell) + 3;
    const seed  = st.seed;

    const lw = p.lineWidth * (0.7 + bass * 0.7);
    const br = p.bright + bass * 14;

    ctx.save();
    ctx.lineWidth = lw;
    ctx.lineCap   = "round";

    // Wave: row phase is offset sinusoidally by column index (and time)
    // creating a flowing wave across the stitch pattern
    const waveT = t * p.speed * 0.5;

    function rowBit(ri, ci) {
        // Base hash bit
        const base = hash(ri + seed) & 1;
        // Wave modulation: wave front sweeps across columns
        const wavePhase = ci * 0.15 * p.waveFreq + waveT;
        const waveShift = Math.sin(wavePhase) * p.waveAmp;
        // Bass adds a lateral pulse wave from left
        const bassWave  = bass * p.bassReact * Math.sin(ci * 0.1 + t * 3) * 0.5;
        // Convert to bit: shift > 0.35 flips the bit
        const shifted = (waveShift + bassWave) > 0.35 ? 1 : 0;
        return (base ^ shifted) & 1;
    }

    function colBit(ci, ri) {
        const base = hash(ci + seed * 31) & 1;
        // Treble drives column wave
        const wavePhase = ri * 0.15 * p.waveFreq - waveT * p.trebleCol;
        const waveShift = Math.sin(wavePhase) * p.waveAmp * (0.5 + treble * 0.5);
        const shifted = waveShift > 0.35 ? 1 : 0;
        return (base ^ shifted) & 1;
    }

    // Horizontal stitches — glow pass
    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = lw + p.glow * 8;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `hsla(${p.hueH},${p.sat}%,${br}%,0.28)`;
        ctx.beginPath();
        for (let ri = -1; ri < rows; ri++) {
            const y = ri * cell + offY;
            for (let ci = -1; ci < cols; ci++) {
                const bit = rowBit(ri, ci);
                if (((bit + ci) & 1) === 0) {
                    const x = ci * cell + offX;
                    ctx.moveTo(x, y); ctx.lineTo(x + cell * 0.5, y);
                }
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // Horizontal stitches — main pass (hueH for even rows, hueV for odd = two-color alternation)
    ctx.shadowBlur = 0;
    for (let ri = -1; ri < rows; ri++) {
        const y = ri * cell + offY;
        // Alternate two colors by row
        const stitchHue = (ri & 1) === 0 ? p.hueH : ((p.hueH + p.hueV) / 2) % 360;
        ctx.strokeStyle = `hsl(${stitchHue},${p.sat}%,${br}%)`;
        ctx.beginPath();
        for (let ci = -1; ci < cols; ci++) {
            const bit = rowBit(ri, ci);
            if (((bit + ci) & 1) === 0) {
                const x = ci * cell + offX;
                ctx.moveTo(x, y); ctx.lineTo(x + cell * 0.5, y);
            }
        }
        ctx.stroke();
    }

    // Vertical stitches — glow pass
    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = lw + p.glow * 8;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `hsla(${p.hueV},${p.sat}%,${br}%,0.28)`;
        ctx.beginPath();
        for (let ci = -1; ci < cols; ci++) {
            const x = ci * cell + offX;
            for (let ri = -1; ri < rows; ri++) {
                const bit = colBit(ci, ri);
                if (((bit + ri) & 1) === 0) {
                    const y = ri * cell + offY;
                    ctx.moveTo(x, y); ctx.lineTo(x, y + cell * 0.5);
                }
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    // Vertical stitches — main pass (hueV for even cols, mix for odd)
    ctx.shadowBlur = 0;
    for (let ci = -1; ci < cols; ci++) {
        const x = ci * cell + offX;
        const stitchHue = (ci & 1) === 0 ? p.hueV : ((p.hueH + p.hueV * 2) / 3) % 360;
        ctx.strokeStyle = `hsl(${stitchHue},${p.sat}%,${br}%)`;
        ctx.beginPath();
        for (let ri = -1; ri < rows; ri++) {
            const bit = colBit(ci, ri);
            if (((bit + ri) & 1) === 0) {
                const y = ri * cell + offY;
                ctx.moveTo(x, y); ctx.lineTo(x, y + cell * 0.5);
            }
        }
        ctx.stroke();
    }

    // Treble sparkle at stitch endpoints
    if (treble > 0.15 && p.sparkle > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const r = lw * 1.6 * treble * p.sparkle;
        for (let ri = -1; ri < rows; ri += 2) {
            const y = ri * cell + offY;
            for (let ci = -1; ci < cols; ci += 2) {
                const bit = rowBit(ri, ci);
                if (((bit + ci) & 1) === 0) {
                    const x = ci * cell + offX + cell * 0.25;
                    const binIdx = sp ? ((ri * cols + ci) & 0xFF) % sp.length : 0;
                    const binVal = sp ? (sp[binIdx] ?? 0) : 0;
                    if (binVal < 0.12) continue;
                    const sparHue = (p.hueH * 0.5 + p.hueV * 0.5) % 360;
                    ctx.fillStyle = `hsla(${sparHue},100%,92%,${treble * binVal * p.sparkle})`;
                    ctx.beginPath(); ctx.arc(x, y, r + binVal * r, 0, Math.PI*2); ctx.fill();
                }
            }
        }
        ctx.restore();
    }

    ctx.restore();
}
