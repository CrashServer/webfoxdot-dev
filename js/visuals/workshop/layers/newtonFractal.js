// ── Newton / Nova Fractal ─────────────────────────────────────────────────────
// Newton's method applied to z^n - 1 = 0 in the complex plane.  Each pixel
// is coloured by which root it converges to and how many iterations it took.
// The boundaries between basins of attraction form intricate fractal filigree.
// Nova mode adds the parameter `c` to each iteration for Julia-like variation.
// Audio: bass → zoom pulse, treble → hue cycling.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Roots of z^n = 1
function roots(n) {
    return Array.from({ length: n }, (_, k) => [
        Math.cos(TAU * k / n), Math.sin(TAU * k / n)
    ]);
}

// Hue palette for roots (evenly spaced, then audio-offset)
const ROOT_HUES = [220, 40, 120, 300, 20, 180, 280, 80];

export const newtonFractalParams = () => ({
    res:     { base: 160,  min: 60,  max: 280, step: 20, mod: { source: "" } },
    order:   { base: 3,    min: 2,   max: 8,   step: 1,  mod: { source: "" } }, // z^n - 1
    maxIter: { base: 40,   min: 10,  max: 128, step: 4,  mod: { source: "" } },
    zoom:    { base: 1.0,  min: 0.1, max: 10,            mod: { source: "" } },
    centerX: { base: 0.0,  min: -2,  max: 2,             mod: { source: "" } },
    centerY: { base: 0.0,  min: -2,  max: 2,             mod: { source: "" } },
    nova:    { base: 0,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // 0=Newton, 1=Nova
    novaCX:  { base: 0.5,  min: -1,  max: 1,             mod: { source: "" } }, // Nova c.re
    novaCY:  { base: 0.0,  min: -1,  max: 1,             mod: { source: "" } }, // Nova c.im
    hueShift:{ base: 0,    min: 0,   max: 360,           mod: { source: "" } },
    pulse:   { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } },
    speed:   { base: 0.05, min: 0,   max: 1,             mod: { source: "" } }, // hue cycle
});

export function drawNewtonFractal(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const res     = Math.round(Math.max(60, Math.min(280, p.res ?? 160)));
    const SW      = res, SH = Math.round(res * h / w);
    const n       = Math.round(Math.max(2, Math.min(8, p.order ?? 3)));
    const maxIter = Math.round(Math.max(10, Math.min(128, p.maxIter ?? 40)));
    const zoom    = (p.zoom ?? 1.0) * (1 + bass * (p.pulse ?? 0.3) * 0.3);
    const nova    = (p.nova ?? 0) > 0.5;
    const ncx     = p.novaCX ?? 0.5, ncy = p.novaCY ?? 0;
    const hShift  = ((p.hueShift ?? 0) + treble * 60 + t * (p.speed ?? 0.05) * 60) % 360;
    const Rs      = roots(n);
    const eps     = 0.001;

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d", { willReadFrequently: false }), SW, SH };
        _st.set(ctx, st);
    }

    const scale  = 3.0 / zoom;
    const cx     = p.centerX ?? 0, cy2 = p.centerY ?? 0;
    const xOff   = cx - scale * 0.5;
    const yOff   = cy2 + scale * (SH / SW) * 0.5;
    const dx     = scale / SW;
    const dy     = -scale * (SH / SW) / SH;

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;

    for (let py = 0; py < SH; py++) {
        let zr = xOff, zi2_s = yOff + py * dy;
        zr = xOff;
        for (let px = 0; px < SW; px++) {
            let zrv = xOff + px * dx, ziv = zi2_s;
            let root = -1, iter = 0;
            for (let k = 0; k < maxIter; k++) {
                // compute z^n and z^(n-1) for Newton step
                let pr = 1, pi = 0;  // z^(n-1)
                let qr = zrv, qi = ziv; // z^1 at start
                for (let j = 1; j < n - 1; j++) {
                    const nr2 = pr * zrv - pi * ziv;
                    const ni2 = pr * ziv + pi * zrv;
                    pr = nr2; pi = ni2;
                }
                // z^n = z * z^(n-1)
                const zn_r = pr * zrv - pi * ziv; // z^(n-1) * z = z^n
                const zn_i = pr * ziv + pi * zrv;
                // f(z) = z^n - 1, f'(z) = n*z^(n-1)
                const fr = zn_r - 1, fi = zn_i;
                const dr2 = n * pr, di2 = n * pi;
                // divide f(z) / f'(z) using complex division
                const denom = dr2*dr2 + di2*di2 + 1e-30;
                const qR = (fr*dr2 + fi*di2) / denom;
                const qI = (fi*dr2 - fr*di2) / denom;
                if (nova) {
                    zrv = zrv - qR + ncx;
                    ziv = ziv - qI + ncy;
                } else {
                    zrv -= qR; ziv -= qI;
                }
                // Check convergence to any root
                for (let r = 0; r < n; r++) {
                    const dr3 = zrv - Rs[r][0], di3 = ziv - Rs[r][1];
                    if (dr3*dr3 + di3*di3 < eps) { root = r; break; }
                }
                iter = k;
                if (root >= 0) break;
            }
            const idx = (py * SW + px) * 4;
            if (root < 0) {
                d[idx] = 10; d[idx+1] = 10; d[idx+2] = 15; d[idx+3] = 255;
            } else {
                const baseHue = (ROOT_HUES[root % ROOT_HUES.length] + hShift) % 360;
                const bright  = 0.35 + (1 - iter / maxIter) * 0.55;
                const hN = baseHue / 60;
                const s2 = 0.9, lN = bright;
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
