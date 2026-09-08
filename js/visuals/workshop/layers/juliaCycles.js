// ── Julia Cycles ──────────────────────────────────────────────────────────────
// Animated Julia set with auto-orbiting c parameter tracing the Mandelbrot
// boundary.  Rendered at reduced resolution and upscaled.  Bass pulses zoom;
// treble shifts hue.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Inline HSL→RGB (avoid canvas API overhead in tight loop)
function hsl2rgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2*l-1)) * s;
    const x = c * (1 - Math.abs(h * 6 % 2 - 1));
    const m = l - c * 0.5;
    let r=0, g=0, b=0;
    if (h < 1/6)      { r=c; g=x; }
    else if (h < 2/6) { r=x; g=c; }
    else if (h < 3/6) { g=c; b=x; }
    else if (h < 4/6) { g=x; b=c; }
    else if (h < 5/6) { r=x; b=c; }
    else              { r=c; b=x; }
    return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

export const juliaCyclesParams = () => ({
    res:      { base: 200,  min: 60,  max: 320, step: 20, mod: { source: "" } },
    maxIter:  { base: 60,   min: 20,  max: 200, step: 10, mod: { source: "" } },
    zoom:     { base: 1.0,  min: 0.1, max: 8,             mod: { source: "" } },
    orbitR:   { base: 0.75, min: 0.1, max: 1.5,           mod: { source: "" } }, // c orbit radius
    orbitSpeed:{ base: 0.08,min: 0,   max: 1,             mod: { source: "" } },
    hue:      { base: 240,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 200,  min: 0,   max: 360,           mod: { source: "" } },
    pulse:    { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } },
    smooth:   { base: 1,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // smooth iteration count
    invert:   { base: 0,    min: 0,   max: 1,   step: 1,  mod: { source: "" } },
});

export function drawJuliaCycles(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const res     = Math.round(Math.max(60, Math.min(320, p.res ?? 200)));
    const SW      = res, SH = Math.round(res * h / w);
    const maxIter = Math.round(Math.max(20, Math.min(200, p.maxIter ?? 60)));
    const zoom    = (p.zoom ?? 1.0) * (1 + bass * (p.pulse ?? 0.3) * 0.2);
    const orbitR  = p.orbitR ?? 0.75;
    const orbitAng= t * (p.orbitSpeed ?? 0.08) * TAU;
    const cr      = Math.cos(orbitAng) * orbitR;
    const ci      = Math.sin(orbitAng) * orbitR;
    const hue     = ((p.hue ?? 240) + treble * 60) % 360;
    const hueR    = p.hueRange ?? 200;
    const smooth  = (p.smooth ?? 1) > 0.5;
    const inv     = (p.invert ?? 0) > 0.5;

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d", { willReadFrequently: false }), SW, SH };
        _st.set(ctx, st);
    }

    const scale = 3.5 / zoom;
    const dx = scale / SW, dy = scale / SH;

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;

    for (let py = 0; py < SH; py++) {
        const zi0 = (py / SH - 0.5) * scale;
        for (let px = 0; px < SW; px++) {
            let zr = (px / SW - 0.5) * scale;
            let zi = zi0;
            let k = 0;
            for (; k < maxIter; k++) {
                const zr2 = zr*zr, zi2 = zi*zi;
                if (zr2 + zi2 > 4) break;
                zi = 2 * zr * zi + ci;
                zr = zr2 - zi2 + cr;
            }
            const idx = (py * SW + px) * 4;
            if (k >= maxIter) {
                d[idx] = d[idx+1] = d[idx+2] = inv ? 255 : 0;
                d[idx+3] = 255;
            } else {
                let frac = k / maxIter;
                if (smooth) {
                    // Smooth iteration count
                    const absZ = Math.sqrt((zr*zr + zi*zi));
                    if (absZ > 0) frac = (k + 1 - Math.log(Math.log(absZ)) / Math.LN2) / maxIter;
                    frac = Math.max(0, Math.min(1, frac));
                }
                if (inv) frac = 1 - frac;
                const h2 = (hue + frac * hueR) % 360;
                const l  = 0.3 + frac * 0.55;
                const [r2, g2, b2] = hsl2rgb(h2, 90, l * 100);
                d[idx] = r2; d[idx+1] = g2; d[idx+2] = b2; d[idx+3] = 255;
            }
        }
    }
    st.bctx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
}
