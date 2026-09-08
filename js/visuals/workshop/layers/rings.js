// ── Rings ─────────────────────────────────────────────────────────────────────
// Concentric rings with harmonic pulsing, bass-driven breathing, hue-shifted
// rainbow rings, secondary harmonic set, glow, fill mode, and treble inner rings.

const _state = new WeakMap();

export const ringsParams = () => ({
    count:        { base: 14,  min: 1,    max: 50,  mod: { source: "" } },
    thick:        { base: 2,   min: 0.3,  max: 20,  mod: { source: "" } },
    spacing:      { base: 28,  min: 4,    max: 120, mod: { source: "" } },
    hue:          { base: 200, min: 0,    max: 360, mod: { source: "" } },
    hueSpread:    { base: 120, min: 0,    max: 360, mod: { source: "" } },
    sat:          { base: 90,  min: 0,    max: 100, mod: { source: "" } },
    glow:         { base: 1.5, min: 0,    max: 5,   mod: { source: "" } },
    rotSpeed:     { base: 0.2, min: -4,   max: 4,   mod: { source: "" } },
    pulseAmt:     { base: 18,  min: 0,    max: 80,  mod: { source: "" } },
    harmonics:    { base: 3,   min: 1,    max: 6,   mod: { source: "" } },
    harmonic2Hue: { base: 60,  min: 0,    max: 360, mod: { source: "" } },
    segments:     { base: 0,   min: 0,    max: 60,  mod: { source: "" } },
    fillMode:     { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
    bassBoost:    { base: 1.8, min: 0,    max: 5,   mod: { source: "" } },
    fade:         { base: 0.15, min: 0.01, max: 0.9, mod: { source: "" } },
    rainbow:      { base: 0,   min: 0,    max: 1,   mod: { source: "" } },
    usePalette:   { base: 0,  min: 0,    max: 1,   mod: { source: "" } },
});

function drawRingSet(ctx, count, spacing, thick, hueBase, hueSpread, sat, glow,
                     fillMode, segments, angle, bass, mid, treble,
                     bassBoost, pulseAmt, harmonics, time, rainbow, pal) {
    const doGlow = glow > 0.05;
    const doFill = fillMode > 0.5;
    const segsN  = Math.max(0, Math.round(segments));

    for (let i = 1; i <= count; i++) {
        const frac = (i - 1) / count;
        let wobble = 0;
        const hCap = Math.min(harmonics, 5);
        for (let h2 = 1; h2 <= hCap; h2++) {
            wobble += Math.sin(time * 1.8 * h2 + i * 0.65 * h2) / h2;
        }
        wobble *= pulseAmt;

        const bassExpand = bass * bassBoost * (1 - frac) * spacing * 0.55;
        const r = i * spacing + wobble + bassExpand;
        if (!(r > 0)) continue;

        const binLike = 0.3 + bass * 0.4 * (1 - frac) + treble * 0.15;
        const brightness = 42 + binLike * 42;
        const alpha = 0.5 + binLike * 0.5;
        const lineW = thick * (0.5 + binLike * 0.9);

        let coreStyle, glowStyle, fillStyle;
        if (pal) {
            const col = pal[Math.min(pal.length - 1, Math.floor(frac * pal.length))];
            coreStyle = col; glowStyle = col; fillStyle = col;
            ctx.globalAlpha = alpha;
        } else {
            const ringHue = rainbow > 0.5
                ? (time * 30 + frac * 360) % 360
                : (hueBase + frac * hueSpread + mid * 40) % 360;
            coreStyle = `hsla(${ringHue},${sat}%,${brightness + 12}%,${alpha})`;
            glowStyle = `hsla(${ringHue},${sat}%,${brightness}%,${alpha * 0.3})`;
            fillStyle  = `hsla(${ringHue},${sat}%,${brightness - 10}%,${alpha * 0.35})`;
            ctx.globalAlpha = 1;
        }

        if (doFill) {
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = fillStyle;
            ctx.globalAlpha = pal ? alpha * 0.35 : 1;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Glow: wider lighter stroke, no shadowBlur
        if (doGlow) {
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = glowStyle;
            ctx.globalAlpha = pal ? alpha * 0.3 : 1;
            ctx.lineWidth = lineW + glow * (6 + binLike * 14);
            arcOrSegments(ctx, r, angle, segsN);
        }

        // Core ring
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = coreStyle;
        ctx.globalAlpha = pal ? alpha : 1;
        ctx.lineWidth = lineW;
        arcOrSegments(ctx, r, angle, segsN);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}

function arcOrSegments(ctx, r, angle, segs) {
    ctx.beginPath();
    if (segs === 0) {
        ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
        const gap = Math.PI / segs / 4;
        const step = Math.PI * 2 / segs;
        for (let s = 0; s < segs; s++) {
            const a0 = angle + s * step + gap;
            const a1 = angle + (s + 1) * step - gap;
            ctx.moveTo(r * Math.cos(a0), r * Math.sin(a0));
            ctx.arc(0, 0, r, a0, a1);
        }
    }
    ctx.stroke();
}

export function drawRings(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { angle: 0, time: 0 }; _state.set(ctx, st); }

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    const _pal = p.usePalette > 0.5 ? extra?.palette ?? null : null;

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time  += dt;
    st.angle += dt * p.rotSpeed * (1 + treble * 1.8);

    const cx = w / 2, cy = h / 2;
    const count     = Math.max(1, Math.round(p.count));
    const harmonics = Math.max(1, Math.round(p.harmonics));

    ctx.save();
    ctx.translate(cx, cy);

    // Primary ring set
    drawRingSet(ctx, count, p.spacing, p.thick, p.hue, p.hueSpread, p.sat,
                p.glow, p.fillMode, p.segments, st.angle,
                bass, mid, treble, p.bassBoost, p.pulseAmt, harmonics,
                st.time, p.rainbow, _pal);

    // Secondary harmonic ring set (half count, offset hue, counter-rotates)
    const secondCount = Math.max(1, Math.round(count * 0.5));
    drawRingSet(ctx, secondCount, p.spacing * 1.6, p.thick * 0.6,
                (p.hue + p.harmonic2Hue) % 360, p.hueSpread * 0.5, p.sat,
                p.glow * 0.7, p.fillMode, p.segments, -st.angle * 1.3,
                bass * 0.6, mid, treble, p.bassBoost * 0.7, p.pulseAmt * 0.8, harmonics,
                st.time, p.rainbow, _pal);

    // Treble inner rings — no shadowBlur, no save/restore per ring
    if (treble > 0.2) {
        const innerCount = Math.min(8, Math.round(3 + treble * 5));
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = p.thick * 0.4;
        for (let i = 1; i <= innerCount; i++) {
            const r = i * p.spacing * 0.3 * (0.4 + treble * 0.6);
            if (!(r > 0)) continue;
            const iHue = (p.hue + i * 30 + st.time * 80) % 360;
            ctx.strokeStyle = `hsla(${iHue},100%,80%,${treble * 0.5})`;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
    }

    // Central bass pulse orb
    if (bass > 0.25) {
        ctx.globalCompositeOperation = "lighter";
        const orbR = Math.max(1, bass * p.spacing * 0.8 * p.bassBoost);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, orbR);
        grad.addColorStop(0, `hsla(${p.hue},80%,95%,${bass * 0.9})`);
        grad.addColorStop(0.5, `hsla(${p.hue},100%,60%,${bass * 0.5})`);
        grad.addColorStop(1, `hsla(${p.hue},100%,40%,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, orbR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
    }

    ctx.restore();
}
