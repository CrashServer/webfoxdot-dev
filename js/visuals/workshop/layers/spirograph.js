// ── Spirograph ────────────────────────────────────────────────────────────────
// Hypotrochoid/epitrochoid curves built incrementally via WeakMap trail canvas.
// Multiple layers, both modes, bass warps d, treble changes ratio, hue shift.

const _state = new WeakMap();

export const spirographParams = () => ({
    hue:        { base: 280,  min: 0,    max: 360, mod: { source: "" } },
    hueSpread:  { base: 140,  min: 0,    max: 360, mod: { source: "" } },
    R:          { base: 0.68, min: 0.2,  max: 0.98, mod: { source: "" } },
    r:          { base: 0.28, min: 0.03, max: 0.6,  mod: { source: "" } },
    d:          { base: 0.85, min: 0,    max: 2,    mod: { source: "" } },
    speed:      { base: 1,    min: 0.05, max: 6,    mod: { source: "" } },
    layers:     { base: 3,    min: 1,    max: 6,    mod: { source: "" } },
    mode:       { base: 0,    min: 0,    max: 1,    mod: { source: "" } },
    clearRate:  { base: 0.003, min: 0,  max: 0.1,  mod: { source: "" } },
    glow:       { base: 1.2,  min: 0,    max: 5,    mod: { source: "" } },
    sat:        { base: 90,   min: 0,    max: 100,  mod: { source: "" } },
    thickness:  { base: 1.2,  min: 0.2,  max: 8,    mod: { source: "" } },
    bassWarp:   { base: 0.35, min: 0,    max: 2,    mod: { source: "" } },
    trebleRatio:{ base: 0.2,  min: 0,    max: 1,    mod: { source: "" } },
    hueSpeed:   { base: 12,   min: 0,    max: 120,  mod: { source: "" } },
});

function ensureTrail(st, w, h) {
    if (!st.tc || st.tc.width !== w || st.tc.height !== h) {
        st.tc = document.createElement("canvas");
        st.tc.width = w; st.tc.height = h;
        st.tctx = st.tc.getContext("2d");
        st.theta = 0;
    }
}

export function drawSpirograph(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = { time: 0, theta: 0, tc: null, tctx: null, hueOff: 0, lastT: 0 }; _state.set(ctx, st); }
    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;

    ensureTrail(st, w, h);
    const tctx = st.tctx, tc = st.tc;

    // Gradual fade of trail
    if (p.clearRate > 0.0001) {
        tctx.fillStyle = `rgba(0,0,0,${p.clearRate})`;
        tctx.fillRect(0, 0, w, h);
    }

    st.hueOff += dt * p.hueSpeed;

    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) * 0.44;
    const layerCount = Math.max(1, Math.min(6, Math.round(p.layers + mid * 1.5)));
    const dTheta = (p.speed + treble * 2.5) * 0.04;
    const ppf    = Math.max(80, Math.round(240 + treble * 450));
    const isEpi  = p.mode > 0.5;

    tctx.save();

    for (let L = 0; L < layerCount; L++) {
        const frac  = L / Math.max(1, layerCount - 1);
        const Rfrac = p.R + L * 0.025 - frac * 0.05;
        const rfrac = Math.max(0.02, p.r - L * 0.035 + frac * 0.015);
        // Treble shifts the R/r ratio
        const rfracT = Math.max(0.02, rfrac + treble * p.trebleRatio * 0.12);
        // Bass warps pen distance d
        const dAbs   = (p.d + bass * p.bassWarp * 0.45 - frac * 0.07) * scale;
        const Rabs   = Rfrac * scale;
        const rabs   = rfracT * scale;

        const layerHue = (p.hue + frac * p.hueSpread + st.hueOff) % 360;
        const bright   = 55 + treble * 28 - frac * 8;
        tctx.strokeStyle = `hsl(${layerHue},${p.sat}%,${bright}%)`;
        tctx.lineWidth   = p.thickness * (1 - frac * 0.28);
        if (p.glow > 0.05) {
            tctx.shadowBlur = 0;
        }

        tctx.beginPath();
        const theta0 = st.theta + L * 0.75;
        for (let i = 0; i <= ppf; i++) {
            const th = theta0 + (i / ppf) * dTheta * ppf;
            let x, y;
            if (isEpi) {
                // Epitrochoid: pen on circle rolling outside
                x = cx + (Rabs + rabs) * Math.cos(th) - dAbs * Math.cos(((Rabs + rabs) / rabs) * th);
                y = cy + (Rabs + rabs) * Math.sin(th) - dAbs * Math.sin(((Rabs + rabs) / rabs) * th);
            } else {
                // Hypotrochoid: pen on circle rolling inside
                x = cx + (Rabs - rabs) * Math.cos(th) + dAbs * Math.cos(((Rabs - rabs) / rabs) * th);
                y = cy + (Rabs - rabs) * Math.sin(th) - dAbs * Math.sin(((Rabs - rabs) / rabs) * th);
            }
            i === 0 ? tctx.moveTo(x, y) : tctx.lineTo(x, y);
        }
        tctx.stroke();
    }
    tctx.shadowBlur = 0;
    tctx.restore();

    st.theta += dTheta * ppf;

    // Composite to main canvas
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(tc, 0, 0);

    // Additive bloom
    if (p.glow > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.65, p.glow * 0.22 + bass * 0.22);
        ctx.filter = `blur(${Math.round(p.glow * 9 + bass * 14)}px)`;
        ctx.drawImage(tc, 0, 0);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
