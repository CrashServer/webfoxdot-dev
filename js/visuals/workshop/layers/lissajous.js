// ── Lissajous ─────────────────────────────────────────────────────────────────
// Phase-shifting Lissajous figures with ghost trail (WeakMap), multiple
// overlapping layers, per-point hue coloring, bass amplitude, treble phase speed.

const _state = new WeakMap();

export const lissajousParams = () => ({
    hue:         { base: 160,  min: 0,    max: 360, mod: { source: "" } },
    hueSpread:   { base: 140,  min: 0,    max: 360, mod: { source: "" } },
    freqA:       { base: 3,    min: 1,    max: 16,  mod: { source: "" } },
    freqB:       { base: 4,    min: 1,    max: 16,  mod: { source: "" } },
    delta:       { base: 0.5,  min: 0,    max: 6.28, mod: { source: "" } },
    speed:       { base: 0.4,  min: -5,   max: 5,   mod: { source: "" } },
    treblePhase: { base: 1.5,  min: 0,    max: 5,   mod: { source: "" } },
    glow:        { base: 1.5,  min: 0,    max: 5,   mod: { source: "" } },
    layers:      { base: 3,    min: 1,    max: 6,   mod: { source: "" } },
    sat:         { base: 90,   min: 0,    max: 100, mod: { source: "" } },
    thickness:   { base: 1.5,  min: 0.2,  max: 10,  mod: { source: "" } },
    colorMode:   { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    bassBoost:   { base: 0.55, min: 0,    max: 2.5, mod: { source: "" } },
    ghostFade:   { base: 0.03, min: 0.001, max: 0.3, mod: { source: "" } },
    ghostAlpha:  { base: 0.5,  min: 0,    max: 1,   mod: { source: "" } },
    phaseGhost:  { base: 0.4,  min: 0,    max: 2,   mod: { source: "" } },
});

function ensureTrail(st, w, h) {
    if (!st.tc || st.tc.width !== w || st.tc.height !== h) {
        st.tc = document.createElement("canvas");
        st.tc.width = w; st.tc.height = h;
        st.tctx = st.tc.getContext("2d");
    }
}

export function drawLissajous(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, tc: null, tctx: null, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    ensureTrail(st, w, h);
    const tctx = st.tctx, tc = st.tc;

    // Fade trail
    tctx.fillStyle = `rgba(0,0,0,${p.ghostFade})`;
    tctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const scaleX = w * 0.43 * (1 + bass * p.bassBoost * 0.4);
    const scaleY = h * 0.43 * (1 + bass * p.bassBoost * 0.4);
    // Treble accelerates phase shift for rapid morphing
    const phase  = st.time * p.speed + treble * p.treblePhase * st.time * 0.3;
    const freqA  = Math.round(p.freqA);
    const freqB  = p.freqB + treble * 1.8;
    const layerCount = Math.max(1, Math.min(6, Math.round(p.layers + mid * 1.5)));
    const steps  = 2400;
    const perPoint = p.colorMode > 0.5; // per-point hue coloring mode

    tctx.save();

    for (let L = 0; L < layerCount; L++) {
        const frac   = L / Math.max(1, layerCount - 1);
        const lHue   = (p.hue + frac * p.hueSpread) % 360;
        const bright = 55 + mid * 20 - frac * 8;
        const fA     = L === 0 ? freqA : freqA + L;
        const fB     = L === 0 ? freqB : freqB + L * 0.85;
        const delt   = p.delta + frac * 0.65;
        const sX     = scaleX * (1 - frac * 0.06);
        const sY     = scaleY * (1 - frac * 0.06);
        const ph     = phase + frac * 0.55;
        const tEnd   = Math.PI * 2 * freqA;

        if (!perPoint) {
            tctx.strokeStyle = `hsl(${lHue},${p.sat}%,${bright}%)`;
            tctx.lineWidth = p.thickness * (1 - frac * 0.22);
            if (p.glow > 0.05) {
                tctx.shadowBlur = 0;
            }
            tctx.beginPath();
            for (let i = 0; i <= steps; i++) {
                const tt = (i / steps) * tEnd;
                const x  = cx + sX * Math.sin(fA * tt + delt + ph);
                const y  = cy + sY * Math.sin(fB * tt + ph);
                i === 0 ? tctx.moveTo(x, y) : tctx.lineTo(x, y);
            }
            tctx.stroke();
        } else {
            // Per-point coloring: draw segments with individual hue based on phase
            tctx.lineWidth = p.thickness * (1 - frac * 0.22);
            tctx.shadowBlur = 0;
            const segSize = 8; // points per segment for coloring
            for (let i = 0; i < steps; i += segSize) {
                const tt0  = (i / steps) * tEnd;
                const tt1  = (Math.min(i + segSize, steps) / steps) * tEnd;
                const x0   = cx + sX * Math.sin(fA * tt0 + delt + ph);
                const y0   = cy + sY * Math.sin(fB * tt0 + ph);
                const x1   = cx + sX * Math.sin(fA * tt1 + delt + ph);
                const y1   = cy + sY * Math.sin(fB * tt1 + ph);
                // Hue based on normalized phase position
                const phaseFrac = i / steps;
                const segHue = (p.hue + phaseFrac * p.hueSpread + frac * 60 + st.time * 20) % 360;
                tctx.strokeStyle = `hsl(${segHue},${p.sat}%,${bright}%)`;
                tctx.beginPath();
                tctx.moveTo(x0, y0);
                tctx.lineTo(x1, y1);
                tctx.stroke();
            }
        }
    }

    // Ghost figures at offset phase (trail effect for multiple overlapping ghosts)
    if (p.phaseGhost > 0.05 && p.ghostAlpha > 0.05) {
        const ghostPhaseOff = p.phaseGhost;
        tctx.globalAlpha = p.ghostAlpha * 0.35;
        const ghHue = (p.hue + 90) % 360;
        tctx.strokeStyle = `hsl(${ghHue},${p.sat}%,50%)`;
        tctx.lineWidth = p.thickness * 0.5;
        tctx.shadowBlur = 0;
        const phG = phase - ghostPhaseOff;
        const tEnd2 = Math.PI * 2 * freqA;
        tctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const tt = (i / steps) * tEnd2;
            const x  = cx + scaleX * Math.sin(freqA * tt + p.delta + phG);
            const y  = cy + scaleY * Math.sin(freqB * tt + phG);
            i === 0 ? tctx.moveTo(x, y) : tctx.lineTo(x, y);
        }
        tctx.stroke();
        tctx.globalAlpha = 1;
    }

    tctx.shadowBlur = 0;
    tctx.restore();

    // Composite
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tc, 0, 0);

    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.6, p.glow * 0.22 + bass * 0.18);
        ctx.filter = `blur(${Math.round(p.glow * 11 + bass * 10)}px)`;
        ctx.drawImage(tc, 0, 0);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
