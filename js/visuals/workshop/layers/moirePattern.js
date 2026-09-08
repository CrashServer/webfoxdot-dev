// ── Moiré Pattern ─────────────────────────────────────────────────────────────
// Two overlapping rotating line grids drawn with globalCompositeOperation
// "difference" for true interference rings. Bass adds rotation impulse;
// treble increases density. Rainbow band mode via hue rotation.

const _state = new WeakMap();

export const moirePatternParams = () => ({
    hue:         { base: 200, min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 80,  min: 0,    max: 180, mod: { source: "" } },
    speed1:      { base: 0.2, min: -3,   max: 3,   mod: { source: "" } },
    speed2:      { base: -0.13, min: -3, max: 3,   mod: { source: "" } },
    spacing:     { base: 18,  min: 4,    max: 80,  mod: { source: "" } },
    angleOffset: { base: 5,   min: 0,    max: 45,  mod: { source: "" } },
    lineWidth:   { base: 1,   min: 0.2,  max: 6,   mod: { source: "" } },
    glow:        { base: 1,   min: 0,    max: 4,   mod: { source: "" } },
    colorMode:   { base: 0,   min: 0,    max: 2,   mod: { source: "" } },
    sat:         { base: 85,  min: 0,    max: 100, mod: { source: "" } },
    alpha:       { base: 0.8, min: 0.1,  max: 1,   mod: { source: "" } },
    bassImpulse: { base: 2,   min: 0,    max: 6,   mod: { source: "" } },
    trebleDensity: { base: 1, min: 0,    max: 4,   mod: { source: "" } },
    fade:        { base: 0.04, min: 0.01, max: 0.5, mod: { source: "" } },
});

// Draw a full set of parallel lines across the canvas at a given angle
function drawLineSet(ctx, w, h, angle, spacing, hue, sat, bright, alpha, lineW) {
    const diag  = Math.sqrt(w * w + h * h) * 0.6;
    const count = Math.ceil(diag / spacing) + 2;
    const cx = w / 2, cy = h / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    ctx.strokeStyle = `hsla(${hue},${sat}%,${bright}%,${alpha})`;
    ctx.lineWidth   = lineW;
    ctx.beginPath();
    for (let i = -count; i <= count; i++) {
        const ox = -sin * i * spacing, oy = cos * i * spacing;
        const ex =  cos * diag * 1.5, ey = sin * diag * 1.5;
        ctx.moveTo(cx + ox - ex, cy + oy - ey);
        ctx.lineTo(cx + ox + ex, cy + oy + ey);
    }
    ctx.stroke();
}

export function drawMoirePattern(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { angle1: 0, angle2: 0, impulse: 0, prevBass: 0, hueShift: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    // Bass impulse: sudden rotation kick
    if (bass > 0.6 && bass > st.prevBass + 0.1) st.impulse = bass * p.bassImpulse;
    st.prevBass  = bass;
    st.impulse  *= 0.9;

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.angle1   += dt * (p.speed1 + st.impulse * 0.04);
    st.angle2   += dt * (p.speed2 - st.impulse * 0.03);
    // Treble slowly shifts hue
    st.hueShift += dt * treble * 40;

    // Treble increases line density (decreases spacing)
    const spacing = Math.max(3, p.spacing / (1 + treble * p.trebleDensity * 0.8));
    const lw      = p.lineWidth * (0.7 + bass * 0.6);
    const cMode   = Math.round(p.colorMode);

    const hue1 = (p.hue + st.hueShift) % 360;
    const hue2 = (p.hue + p.hueSpread * 0.5 + st.hueShift) % 360;
    const bright1 = 60 + treble * 25;
    const bright2 = 60 + treble * 20;

    // The key technique: draw both grids with "difference" composite for moiré rings
    // First draw grid 1 on an additive lighter pass, then grid 2 with difference
    // Also draw a straight "source-over" version for color control

    const angle2 = st.angle2 + (p.angleOffset * Math.PI / 180);

    if (cMode === 2) {
        // Rainbow interference: draw multiple sets with hue spread
        ctx.save();
        const bands = 4;
        for (let b = 0; b < bands; b++) {
            const frac = b / bands;
            const bHue = (hue1 + frac * 120) % 360;
            const bSpc = spacing * (1 + frac * 0.18);
            const bAngle = st.angle1 + frac * 0.08;
            ctx.globalCompositeOperation = b === 0 ? "lighter" : "difference";
            drawLineSet(ctx, w, h, bAngle, bSpc, bHue, p.sat, bright1, p.alpha * 0.7, lw);
        }
        ctx.restore();
    } else {
        // Classic two-grid difference interference
        ctx.save();

        // Grid 1 — additive
        ctx.globalCompositeOperation = "lighter";
        drawLineSet(ctx, w, h, st.angle1, spacing, hue1, p.sat, bright1, p.alpha, lw);

        // Grid 2 — difference creates moiré rings
        ctx.globalCompositeOperation = "difference";
        drawLineSet(ctx, w, h, angle2, spacing, cMode === 0 ? hue1 : hue2, p.sat, bright2, p.alpha, lw);

        ctx.restore();
    }

    // Glow bloom overlay
    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Draw both sets again, very wide and transparent for bloom
        drawLineSet(ctx, w, h, st.angle1, spacing * 1.1, hue1, p.sat, bright1, p.alpha * 0.15 * p.glow, lw * p.glow * 5);
        drawLineSet(ctx, w, h, angle2, spacing * 1.1, hue2, p.sat, bright2, p.alpha * 0.12 * p.glow, lw * p.glow * 5);
        ctx.restore();
    }

    // Bass impulse radial flash
    if (st.impulse > 0.2 && p.glow > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const orbR = Math.min(w, h) * 0.45 * (st.impulse / p.bassImpulse);
        const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, orbR);
        grad.addColorStop(0, `hsla(${hue1},100%,85%,${(st.impulse / p.bassImpulse) * 0.5})`);
        grad.addColorStop(1, `hsla(${hue1},100%,40%,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(w/2, h/2, orbR, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}
