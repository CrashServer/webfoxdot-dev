// ── VHS Static ────────────────────────────────────────────────────────────────
// Vintage VHS tape noise: grain, tracking lines, chroma smear, head dropout.
// Bass triggers heavy dropout bands; treble brightens the signal level.
// With no content below it the layer generates its own static pattern.

const _st = new WeakMap();

export const vhsStaticParams = () => ({
    noise:      { base: 0.4,  min: 0, max: 1,   mod: { source: "" } }, // grain intensity
    tracking:   { base: 0.5,  min: 0, max: 1,   mod: { source: "" } }, // horizontal jitter lines
    dropout:    { base: 0.3,  min: 0, max: 1,   mod: { source: "" } }, // black dropout bands
    chroma:     { base: 0.4,  min: 0, max: 1,   mod: { source: "" } }, // colour bleeding
    hscroll:    { base: 0.02, min: 0, max: 0.2, mod: { source: "" } }, // horizontal roll speed
    vscroll:    { base: 0.0,  min: -0.5,max:0.5,mod: { source: "" } }, // vertical roll speed
    hue:        { base: 180,  min: 0, max: 360, mod: { source: "" } }, // tint hue
    pulse:      { base: 0.5,  min: 0, max: 1,   mod: { source: "" } },
    brightness: { base: 0.6,  min: 0, max: 1,   mod: { source: "" } }, // signal level
    scanlines:  { base: 0.3,  min: 0, max: 1,   mod: { source: "" } },
});

export function drawVhsStatic(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const noise    = (p.noise ?? 0.4) * (1 + bass * (p.pulse ?? 0.5) * 0.5);
    const tracking = p.tracking ?? 0.5;
    const dropout  = (p.dropout ?? 0.3) * (1 + bass * 0.8);
    const chroma   = p.chroma ?? 0.4;
    const hscroll  = p.hscroll ?? 0.02;
    const vscroll  = p.vscroll ?? 0;
    const hue      = p.hue ?? 180;
    const brightness= Math.min(1, (p.brightness ?? 0.6) + treble * 0.2);
    const scanAlpha= p.scanlines ?? 0.3;

    let st = _st.get(ctx);
    if (!st) {
        st = { offBuf: null, offCtx: null, scrollY: 0, lcg: 7777, lastT: t };
        _st.set(ctx, st);
    }

    // Off-screen pixel buffer for noise
    if (!st.offBuf || st.offBuf.width !== w || st.offBuf.height !== h) {
        const oc = document.createElement("canvas");
        oc.width = Math.round(w / 3); oc.height = Math.round(h / 3);
        st.offBuf = oc; st.offCtx = oc.getContext("2d");
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.scrollY = (st.scrollY + vscroll * dt * h + h) % h;
    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };

    const SW = st.offBuf.width, SH = st.offBuf.height;
    const oCtx = st.offCtx;
    const id = oCtx.createImageData(SW, SH);
    const d = id.data;

    // Generate low-res noise field
    const scrollPhase = t * hscroll * SW;
    for (let y = 0; y < SH; y++) {
        // Tracking jitter: horizontal offset per row
        const jitter = tracking > 0.01 && rand() < tracking * 0.05
            ? (rand() - 0.5) * SW * 0.15 : 0;
        for (let x = 0; x < SW; x++) {
            const i = (y * SW + x) * 4;
            const n = rand();
            const signal = brightness * (0.4 + n * 0.6);
            const v = Math.round(signal * 200);
            // Chroma: shift R slightly right, B slightly left
            const cr = chroma > 0 ? Math.min(255, v + Math.round(chroma * rand() * 60)) : v;
            const cb = chroma > 0 ? Math.max(0, v - Math.round(chroma * rand() * 40)) : v;
            d[i]   = cr;
            d[i+1] = v;
            d[i+2] = cb;
            d[i+3] = Math.round(noise * 220 + 35);
        }
        // Dropout band
        if (dropout > 0 && rand() < dropout * 0.03) {
            const bandH = Math.ceil(rand() * 4);
            for (let by = 0; by < bandH && y + by < SH; by++) {
                for (let x2 = 0; x2 < SW; x2++) {
                    const i = ((y + by) * SW + x2) * 4;
                    d[i] = d[i+1] = d[i+2] = 0; d[i+3] = 255;
                }
            }
        }
    }

    oCtx.putImageData(id, 0, 0);

    // Render to main canvas with scroll
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    // Base static pattern (tinted)
    ctx.filter = `hue-rotate(${hue - 180}deg) saturate(1.5)`;
    ctx.drawImage(st.offBuf, 0, 0, w, h);
    ctx.filter = "none";

    // Scanlines
    if (scanAlpha > 0.02) {
        for (let y = 0; y < h; y += 2) {
            ctx.fillStyle = `rgba(0,0,0,${scanAlpha * 0.8})`;
            ctx.fillRect(0, y, w, 1);
        }
    }

    // Heavy tracking glitch: full-width shifted stripe on bass
    if (bass > 0.6 && tracking > 0.1) {
        const ty = Math.round(rand() * h);
        const th2 = Math.round(rand() * 30 + 5);
        const shift = (rand() - 0.5) * w * 0.2 * bass;
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `hsla(${hue},80%,60%,${bass * 0.3})`;
        ctx.fillRect(shift, ty, w, th2);
        ctx.globalCompositeOperation = "source-over";
    }
    ctx.imageSmoothingEnabled = true;
}
