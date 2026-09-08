// ── String Art ────────────────────────────────────────────────────────────────
// Modular arithmetic line art: multiple overlapping curves with different
// divisors, hue gradient along strings, bass shifts divisor for morphing,
// treble changes opacity rhythm, animated rotation and drift.

const _state = new WeakMap();

export const stringArtParams = () => ({
    points:      { base: 150,  min: 20,  max: 400, mod: { source: "" } },
    multiplier:  { base: 2.5,  min: 1,   max: 25,  mod: { source: "" } },
    drift:       { base: 0.5,  min: 0,   max: 8,   mod: { source: "" } },
    speed:       { base: 0.15, min: -3,  max: 3,   mod: { source: "" } },
    spinSpeed:   { base: 0.08, min: -2,  max: 2,   mod: { source: "" } },
    curves:      { base: 3,    min: 1,   max: 6,   mod: { source: "" } },
    curveDivisorStep: { base: 1, min: 0.2, max: 5, mod: { source: "" } },
    hue:         { base: 240,  min: 0,   max: 360, mod: { source: "" } },
    hueSpread:   { base: 120,  min: 0,   max: 360, mod: { source: "" } },
    sat:         { base: 85,   min: 0,   max: 100, mod: { source: "" } },
    glow:        { base: 1.2,  min: 0,   max: 5,   mod: { source: "" } },
    lineWidth:   { base: 0.8,  min: 0.1, max: 6,   mod: { source: "" } },
    bassReact:   { base: 1.8,  min: 0,   max: 5,   mod: { source: "" } },
    trebleAlpha: { base: 1,    min: 0,   max: 3,   mod: { source: "" } },
    fade:        { base: 0.06, min: 0.01, max: 0.5, mod: { source: "" } },
    scale:       { base: 0.88, min: 0.3, max: 1.2, mod: { source: "" } },
});

export function drawStringArt(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, spinOffset: 0, pulse: 0, prevBass: 0, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    if (bass > 0.55 && bass > st.prevBass + 0.1) st.pulse = 1;
    st.prevBass  = bass;
    st.pulse    *= 0.87;
    st.spinOffset += dt * p.spinSpeed * (1 + bass * p.bassReact * 0.4);

    ctx.fillStyle = `rgba(0,0,0,${p.fade})`;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const pts   = Math.max(20, Math.round(p.points));
    const R     = Math.min(cx, cy) * p.scale;
    const nBins = sp ? sp.length : 0;
    const curves = Math.max(1, Math.round(p.curves));

    // Bass shifts divisor — morphing between cardioid forms
    const bassDivisorShift = bass * p.bassReact * 1.2;

    for (let cv = 0; cv < curves; cv++) {
        const cvFrac = cv / Math.max(1, curves - 1);
        // Each curve gets its own divisor offset
        const animMult = p.multiplier + Math.sin(st.time * p.speed * 0.4 + cv * 0.9) * p.drift
                       + st.pulse * 0.4 + mid * 1.2 + bassDivisorShift
                       + cv * p.curveDivisorStep;
        const baseAngle = st.spinOffset + cvFrac * Math.PI / curves;
        const curveHueBase = (p.hue + cvFrac * p.hueSpread) % 360;

        // Treble creates pulsing alpha rhythm per curve
        const treblePhase = Math.sin(st.time * 4 + cv * 1.5) * 0.5 + 0.5;
        const alphaRhythm = treble > 0.1 ? (0.5 + treblePhase * 0.5 * treble * p.trebleAlpha) : 1;
        const alpha = (0.12 + bass * 0.2 + st.pulse * 0.15) * alphaRhythm;
        const lw    = p.lineWidth * (0.5 + bass * 0.7 + st.pulse * 1.2) * (1 - cvFrac * 0.2);

        // Glow pass (sparse)
        if (p.glow > 0.05) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.lineWidth = lw * p.glow * 4;
            ctx.globalAlpha = Math.min(1, (0.05 + bass * 0.06) * alphaRhythm);
            for (let i = 0; i < pts; i += Math.max(1, Math.floor(pts / 80))) {
                const j      = (i * animMult) % pts;
                const a1     = baseAngle + (i / pts) * Math.PI * 2;
                const a2     = baseAngle + (j / pts) * Math.PI * 2;
                // Hue along the string based on position
                const ph = (curveHueBase + (i / pts) * p.hueSpread * 0.5) % 360;
                ctx.strokeStyle = `hsl(${ph},100%,72%)`;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
                ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // All strings with per-string hue gradient
        for (let i = 0; i < pts; i++) {
            const j      = (i * animMult) % pts;
            const a1     = baseAngle + (i / pts) * Math.PI * 2;
            const a2     = baseAngle + (j / pts) * Math.PI * 2;
            const binIdx = nBins ? Math.floor((i / pts) * nBins) : 0;
            const binVal = nBins ? Math.min(1, (sp[binIdx] ?? 0) * 2) : 0.4;
            // Hue gradient: start of string vs end differ by hueSpread portion
            const ph  = (curveHueBase + (i / pts) * p.hueSpread * 0.7 + mid * 25 + treble * 15) % 360;
            const bright = 48 + binVal * 36;
            const lineAlpha = Math.min(1, alpha * (0.25 + binVal * 1.2) * alphaRhythm);

            ctx.strokeStyle = `hsla(${ph},${p.sat + binVal*14}%,${bright}%,${lineAlpha})`;
            ctx.lineWidth   = lw * (0.5 + binVal * 1.2);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
            ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
            ctx.stroke();
        }
    }

    // Ring dots: sparkle at string endpoints on treble
    if (treble > 0.15) {
        const pts0 = Math.max(20, Math.round(p.points));
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const baseAngle = st.spinOffset;
        for (let i = 0; i < pts0; i += Math.max(1, Math.floor(pts0 / 48))) {
            const a = baseAngle + (i / pts0) * Math.PI * 2;
            const binIdx = nBins ? Math.floor((i / pts0) * nBins) : 0;
            const binVal = nBins ? (sp[binIdx] ?? 0) : 0;
            if (binVal < 0.15) continue;
            const ph = (p.hue + (i / pts0) * p.hueSpread) % 360;
            ctx.fillStyle = `hsla(${ph},100%,85%,${treble * binVal * 0.85})`;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1.5 + treble * 3.5, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
}
