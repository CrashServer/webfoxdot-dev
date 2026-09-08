// ── Burning Ship Fractal ──────────────────────────────────────────────────────
// Escape-time fractal: z_{n+1} = (|Re(z)| + i|Im(z)|)^2 + c.
// The abs() on both components before squaring produces the burning-ship
// silhouette.  Rendered at reduced resolution and upscaled; smooth
// (fractional) iteration colouring.  Audio: bass zooms in, treble shifts hue.

const _st = new WeakMap();

export const burningShipParams = () => ({
    res:     { base: 180,  min: 60,   max: 320,  step: 20, mod: { source: "" } },
    maxIter: { base: 120,  min: 32,   max: 512,  step: 16, mod: { source: "" } },
    zoom:    { base: 1.0,  min: 0.05, max: 20,             mod: { source: "" } },
    centerX: { base: -0.4, min: -2,   max: 2,              mod: { source: "" } },
    centerY: { base: -0.6, min: -2,   max: 2,              mod: { source: "" } },
    hue:     { base: 20,   min: 0,    max: 360,            mod: { source: "" } },
    hueRange:{ base: 240,  min: 0,    max: 360,            mod: { source: "" } },
    pulse:   { base: 0.4,  min: 0,    max: 1,              mod: { source: "" } },
    speed:   { base: 0.0,  min: -1,   max: 1,              mod: { source: "" } }, // auto-zoom
});

export function drawBurningShip(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const res     = Math.round(Math.max(60, Math.min(320, p.res ?? 180)));
    const SW      = res, SH = Math.round(res * h / w);
    const maxIter = Math.round(Math.max(32, Math.min(512, p.maxIter ?? 120)));
    const zoom    = (p.zoom ?? 1.0) / (1 + bass * (p.pulse ?? 0.4) * 0.5);
    const autoZ   = (p.speed ?? 0) * t;
    const cx      = (p.centerX ?? -0.4);
    const cy      = (p.centerY ?? -0.6);
    const hue0    = ((p.hue ?? 20) + treble * 40) % 360;
    const hueR    = p.hueRange ?? 240;
    const bailout = 4.0;

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d", { willReadFrequently: false }), SW, SH };
        _st.set(ctx, st);
    }

    const scale = 3.5 / (zoom * Math.exp(autoZ * 0.5));
    const xOff  = cx - scale * 0.5;
    const yOff  = cy + scale * (SH / SW) * 0.5;
    const dx    = scale / SW;
    const dy    = -scale * (SH / SW) / SH;

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;

    for (let py = 0; py < SH; py++) {
        const ci = yOff + py * dy;
        for (let px = 0; px < SW; px++) {
            const cr = xOff + px * dx;
            let zr = 0, zi = 0, n = 0;
            while (n < maxIter) {
                const ar = Math.abs(zr), ai = Math.abs(zi);
                const zr2 = ar*ar - ai*ai + cr;
                const zi2 = 2*ar*ai + ci;
                zr = zr2; zi = zi2;
                if (zr*zr + zi*zi > bailout) break;
                n++;
            }
            const idx = (py * SW + px) * 4;
            if (n === maxIter) {
                d[idx] = 0; d[idx+1] = 0; d[idx+2] = 0; d[idx+3] = 255;
            } else {
                // Smooth iteration: n_smooth = n + 1 - log2(log2(|z|) / log2(bailout))
                const log2 = Math.log(zr*zr + zi*zi) * 0.5 / Math.log(bailout);
                const ns   = n + 1 - Math.log(Math.max(1e-9, log2)) / Math.LN2;
                const t2   = (ns / maxIter) * hueR + hue0;
                const l    = 20 + (ns / maxIter) * 55;
                // Convert hsl to rgb inline (perf)
                const hN = ((t2 % 360) + 360) % 360 / 60;
                const s2 = 0.85, lN = l / 100;
                const C  = (1 - Math.abs(2*lN - 1)) * s2;
                const X  = C * (1 - Math.abs(hN % 2 - 1));
                const m  = lN - C * 0.5;
                let r2 = 0, g2 = 0, b2 = 0;
                if      (hN < 1) { r2=C; g2=X; }
                else if (hN < 2) { r2=X; g2=C; }
                else if (hN < 3) { g2=C; b2=X; }
                else if (hN < 4) { g2=X; b2=C; }
                else if (hN < 5) { r2=X; b2=C; }
                else             { r2=C; b2=X; }
                d[idx]   = Math.round((r2+m)*255);
                d[idx+1] = Math.round((g2+m)*255);
                d[idx+2] = Math.round((b2+m)*255);
                d[idx+3] = 255;
            }
        }
    }
    st.bctx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
}
