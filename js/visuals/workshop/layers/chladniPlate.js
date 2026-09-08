// ── Chladni Plate ─────────────────────────────────────────────────────────────
// Chladni figure simulation: the standing-wave nodal lines formed when a
// metal plate is vibrated at frequency f.  Pattern = sin(m·πx)·sin(n·πy) -
// sin(n·πx)·sin(m·πy).  Audio drives the mode selection and threshold.

const _st = new WeakMap();

export const chladniPlateParams = () => ({
    mMode:    { base: 3,    min: 1,  max: 10, step: 1, mod: { source: "" } }, // m vibration mode
    nMode:    { base: 5,    min: 1,  max: 10, step: 1, mod: { source: "" } }, // n vibration mode
    threshold:{ base: 0.08, min: 0.005,max:0.3,        mod: { source: "" } }, // sand thickness
    res:      { base: 300,  min: 80, max: 600,step:50,  mod: { source: "" } },
    hue:      { base: 45,   min: 0,  max: 360,          mod: { source: "" } },
    bgHue:    { base: 0,    min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    autoMode: { base: 1,    min: 0,  max: 1,  step: 1,  mod: { source: "" } }, // auto-cycle modes
    speed:    { base: 0.1,  min: 0,  max: 1,            mod: { source: "" } }, // mode cycle speed
    mix:      { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } }, // blend m,n with n,m
});

export function drawChladniPlate(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    let m = Math.round(Math.max(1, Math.min(10, p.mMode ?? 3)));
    let n = Math.round(Math.max(1, Math.min(10, p.nMode ?? 5)));
    const autoMode = (p.autoMode ?? 1) > 0.5;
    const speed    = p.speed ?? 0.1;
    const res      = Math.round(Math.max(80, Math.min(600, p.res ?? 300)));
    const thresh   = (p.threshold ?? 0.08) * (1 - bass * (p.pulse ?? 0.4) * 0.5);
    const hue      = p.hue ?? 45;
    const bgHue    = p.bgHue ?? 0;
    const glow     = p.glow ?? 0.5;
    const mix      = p.mix ?? 0;

    if (autoMode) {
        const phase = t * speed;
        m = Math.round(1 + (Math.sin(phase * 1.3) * 0.5 + 0.5) * 9);
        n = Math.round(1 + (Math.cos(phase * 0.7) * 0.5 + 0.5) * 9);
    }

    let st = _st.get(ctx);
    if (!st) {
        const oc = document.createElement("canvas");
        oc.width = res; oc.height = res;
        st = { oc, octx: oc.getContext("2d"), lastM: -1, lastN: -1, res, lastMix: -1 };
        _st.set(ctx, st);
    }

    // Regenerate if params changed
    if (st.lastM !== m || st.lastN !== n || st.res !== res || Math.abs(st.lastMix - mix) > 0.01) {
        st.lastM = m; st.lastN = n; st.res = res; st.lastMix = mix;
        if (st.oc.width !== res || st.oc.height !== res) { st.oc.width = res; st.oc.height = res; }
    }

    const oCtx = st.octx;
    const R = res;
    const id = oCtx.createImageData(R, R);
    const d  = id.data;

    const PI = Math.PI;
    for (let y = 0; y < R; y++) {
        const fy = y / (R - 1);
        const sinMy = Math.sin(m * PI * fy);
        const sinNy = Math.sin(n * PI * fy);
        for (let x = 0; x < R; x++) {
            const fx = x / (R - 1);
            const sinMx = Math.sin(m * PI * fx);
            const sinNx = Math.sin(n * PI * fx);
            // Chladni equation with mix blend
            const v0 = sinMx * sinNy - sinNx * sinMy;
            const v1 = sinNx * sinMy - sinMx * sinNy;
            const v  = v0 * (1 - mix) + v1 * mix;
            const absV = Math.abs(v);
            const isNode = absV < thresh;

            const i = (y * R + x) * 4;
            if (isNode) {
                // Sand colour
                const bright = 200 + Math.round((thresh - absV) / thresh * 55);
                const hN = hue / 60, c = 0.8, mm = (bright / 255) - c * 0.5;
                d[i]   = Math.min(255, bright + 30);
                d[i+1] = Math.min(255, bright);
                d[i+2] = Math.max(0, bright - 60);
                d[i+3] = 255;
            } else {
                // Plate colour (dark)
                const bg = 15 + Math.round(absV * 20);
                d[i]   = bg;
                d[i+1] = Math.round(bg * 0.9);
                d[i+2] = bg + 5;
                d[i+3] = 255;
            }
        }
    }
    oCtx.putImageData(id, 0, 0);

    ctx.clearRect(0, 0, w, h);
    if (glow > 0.05) ctx.filter = `blur(${glow * 2}px)`;
    ctx.imageSmoothingEnabled = true;
    // Center with aspect ratio
    const sz = Math.min(w, h);
    ctx.drawImage(st.oc, (w - sz) / 2, (h - sz) / 2, sz, sz);
    ctx.filter = "none";

    // Bass flash
    if (bass > 0.5) {
        ctx.fillStyle = `hsla(${hue},80%,70%,${(bass - 0.5) * 0.15})`;
        ctx.fillRect(0, 0, w, h);
    }
}
