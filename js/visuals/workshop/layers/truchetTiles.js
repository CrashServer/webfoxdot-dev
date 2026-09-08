// ── Truchet Tiles ─────────────────────────────────────────────────────────────
// Animated truchet tiles: arc vs diagonal variant, smooth arc rotation over time,
// bass triggers cascade flip, treble secondary color, glow on arcs.

const _state = new WeakMap();

function cellHash(c, r, seed) {
    let h = (c * 73856093 ^ r * 19349663 ^ seed * 83492791) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
}

// Standard arc truchet
function drawArcTile(ctx, ox, oy, sz, type) {
    const r = sz / 2;
    ctx.beginPath();
    if (type === 0) {
        ctx.arc(ox,      oy,      r, 0,           Math.PI / 2);
        ctx.moveTo(ox + sz, oy + sz);
        ctx.arc(ox + sz, oy + sz, r, Math.PI,     Math.PI * 1.5);
    } else {
        ctx.arc(ox + sz, oy,      r, Math.PI / 2, Math.PI);
        ctx.moveTo(ox,   oy + sz);
        ctx.arc(ox,      oy + sz, r, Math.PI * 1.5, 0);
    }
    ctx.stroke();
}

// Diagonal truchet (two diagonal lines per tile)
function drawDiagTile(ctx, ox, oy, sz, type) {
    ctx.beginPath();
    if (type === 0) {
        ctx.moveTo(ox, oy);         ctx.lineTo(ox + sz, oy + sz);
    } else {
        ctx.moveTo(ox + sz, oy);    ctx.lineTo(ox, oy + sz);
    }
    ctx.stroke();
}

// Animated arc tile: arc rotates from one orientation toward another
function drawAnimArcTile(ctx, ox, oy, sz, typeFrom, typeTo, progress) {
    // Blend by drawing both at different alpha
    const a1 = 1 - progress, a2 = progress;
    ctx.save();
    ctx.globalAlpha *= a1;
    drawArcTile(ctx, ox, oy, sz, typeFrom);
    ctx.globalAlpha = ctx.globalAlpha / a1 * a2;
    drawArcTile(ctx, ox, oy, sz, typeTo);
    ctx.restore();
}

export const truchetTilesParams = () => ({
    hue:         { base: 20,  min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 180, min: 0,    max: 360, mod: { source: "" } },
    tileSize:    { base: 36,  min: 6,    max: 120, mod: { source: "" } },
    speed:       { base: 0.5, min: -5,   max: 5,   mod: { source: "" } },
    lineWidth:   { base: 3,   min: 0.4,  max: 12,  mod: { source: "" } },
    glow:        { base: 1.5, min: 0,    max: 5,   mod: { source: "" } },
    colorMode:   { base: 1,   min: 0,    max: 2,   mod: { source: "" } },
    tileVariant: { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
    sat:         { base: 80,  min: 0,    max: 100, mod: { source: "" } },
    bgBright:    { base: 3,   min: 0,    max: 30,  mod: { source: "" } },
    beatFlip:    { base: 1,   min: 0,    max: 1,   mod: { source: "" } },
    bassReact:   { base: 1.5, min: 0,    max: 5,   mod: { source: "" } },
    trebleSecondary: { base: 0.6, min: 0, max: 1,  mod: { source: "" } },
    animRotate:  { base: 0.5, min: 0,    max: 4,   mod: { source: "" } },
    fade:        { base: 0.12, min: 0.02, max: 0.8, mod: { source: "" } },
});

export function drawTruchetTiles(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, offset: 0, flipSeed: 0, prevBass: 0, glowFlash: 0, flipProgress: 0, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    // Bass-triggered pattern flip with smooth transition
    if (bass > 0.65 && st.prevBass < 0.65 && p.beatFlip > 0.5) {
        st.flipSeed = (st.flipSeed + 1) & 0xFFFF;
        st.glowFlash = 1;
        st.flipProgress = 0; // start transition
    }
    st.prevBass   = bass;
    st.glowFlash *= 0.84;
    // Animate flip transition (0→1 over ~0.3s)
    st.flipProgress = Math.min(1, st.flipProgress + dt * 3.5);

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    const spd = p.speed * (1 + mid * 0.5);
    const ts  = Math.max(6, Math.round(p.tileSize));
    st.offset = (st.offset + spd * 0.5) % ts;

    const lw     = p.lineWidth * (0.65 + bass * p.bassReact * 0.35);
    const cMode  = Math.round(p.colorMode);
    const isDiag = p.tileVariant > 0.5;
    const cols   = Math.ceil(w / ts) + 3;
    const rows   = Math.ceil(h / ts) + 3;
    const startX = -((st.offset | 0) + ts);
    const startY = -((st.offset | 0) + ts);
    const nBins  = sp ? sp.length : 1;

    // Dark background
    ctx.fillStyle = `hsl(${p.hue},${p.sat * 0.25}%,${p.bgBright}%)`;
    ctx.fillRect(0, 0, w, h);

    // Animating arc rotation: slowly shift tile configurations over time
    const animSeed = (st.flipSeed * 1000 + st.time * p.animRotate * 60) | 0;

    // Draw function for one tile
    const drawTile = (ox, oy, sz, type, strokeStyle, lw2) => {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = lw2;
        if (isDiag) {
            drawDiagTile(ctx, ox, oy, sz, type);
        } else {
            drawArcTile(ctx, ox, oy, sz, type);
        }
    };

    // Glow pass
    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = lw + p.glow * 10 + st.glowFlash * 18;
        ctx.lineCap   = "round";
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const ox = startX + c * ts, oy = startY + r * ts;
                const h0   = cellHash(c, r, st.flipSeed);
                const type = h0 < 0.5 ? 0 : 1;
                const bandIdx = (c * rows + r) % nBins;
                const binVal  = sp ? Math.min(1, (sp[bandIdx] ?? 0) * 2.5) : 0.4;
                let glowHue;
                if (cMode === 0) glowHue = p.hue;
                else if (cMode === 1) glowHue = type === 0 ? p.hue : (p.hue + p.hueSpread * 0.5) % 360;
                else glowHue = (p.hue + (bandIdx / nBins) * p.hueSpread) % 360;
                const glowA = 0.07 + binVal * 0.14 + treble * p.trebleSecondary * 0.1 + st.glowFlash * 0.16;
                ctx.strokeStyle = `hsla(${glowHue},100%,68%,${glowA})`;
                if (isDiag) drawDiagTile(ctx, ox, oy, ts, type);
                else        drawArcTile(ctx, ox, oy, ts, type);
            }
        }
        ctx.restore();
    }

    // Core tiles
    ctx.lineWidth = lw;
    ctx.lineCap   = "round";

    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const ox = startX + c * ts, oy = startY + r * ts;
            const h0   = cellHash(c, r, st.flipSeed);
            const type = h0 < 0.5 ? 0 : 1;
            const bandIdx = (c * rows + r) % nBins;
            const binVal  = sp ? Math.min(1, (sp[bandIdx] ?? 0) * 2.5) : 0.5;
            const cellBright = 28 + binVal * 48 + treble * 14 + st.glowFlash * 22;

            let strokeStyle;
            if (cMode === 0) {
                strokeStyle = `hsl(${p.hue},${p.sat}%,${cellBright}%)`;
            } else if (cMode === 1) {
                const dh = type === 0 ? p.hue : (p.hue + p.hueSpread * 0.5) % 360;
                strokeStyle = `hsl(${dh},${p.sat}%,${cellBright}%)`;
            } else {
                const ch = (p.hue + (bandIdx / nBins) * p.hueSpread) % 360;
                strokeStyle = `hsl(${ch},${p.sat}%,${cellBright}%)`;
            }

            // Primary tile
            ctx.strokeStyle = strokeStyle;
            if (isDiag) drawDiagTile(ctx, ox, oy, ts, type);
            else        drawArcTile(ctx, ox, oy, ts, type);

            // Treble secondary color: overlay complementary arc
            if (treble > 0.2 && p.trebleSecondary > 0.05 && binVal > 0.2) {
                const secHue = (p.hue + p.hueSpread * 0.5 + treble * 60) % 360;
                const secAlpha = treble * p.trebleSecondary * binVal * 0.7;
                ctx.save();
                ctx.globalAlpha = secAlpha;
                ctx.strokeStyle = `hsl(${secHue},100%,${cellBright + 15}%)`;
                ctx.lineWidth = lw * 0.5;
                // Draw the opposite tile type as overlay
                if (isDiag) drawDiagTile(ctx, ox, oy, ts, 1 - type);
                else        drawArcTile(ctx, ox, oy, ts, 1 - type);
                ctx.restore();
            }
        }
    }

    // Flash bloom on beat
    if (st.glowFlash > 0.08) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w,h) * 0.55);
        grad.addColorStop(0, `hsla(${p.hue},100%,82%,${st.glowFlash * 0.28})`);
        grad.addColorStop(0.5, `hsla(${(p.hue + p.hueSpread * 0.5) % 360},100%,60%,${st.glowFlash * 0.12})`);
        grad.addColorStop(1, `hsla(${p.hue},100%,40%,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}
