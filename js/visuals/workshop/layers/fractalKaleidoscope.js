// ── Fractal Kaleidoscope ──────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION FractalKaleidoscopeScene.
// Polar-coordinate folded fractal rendered via ImageData pixel-by-pixel.
// Bass = zoom burst. Mid = iteration boost. Treble = chroma rotation.

const _st = new WeakMap();

const IW=240, IH=135;

function hsl2rgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h/30) % 12;
    const a = s * Math.min(l, 1-l);
    const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
    return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

export const fractalKaleidoscopeParams = () => ({
    segments:  { base: 6,   min: 2,   max: 16,  step: 1, mod: { source: "" } },
    zoom:      { base: 1.2, min: 0.2, max: 4,            mod: { source: "" } },
    rotation:  { base: 0.1, min: -2,  max: 2,            mod: { source: "" } },
    iterations:{ base: 40,  min: 10,  max: 120, step: 1, mod: { source: "" } },
    chromaShift:{ base:0.3, min: 0,   max: 1,            mod: { source: "" } },
    pulse:     { base: 0.8, min: 0,   max: 1,            mod: { source: "" } },
    hueBase:   { base: 0,   min: 0,   max: 360,          mod: { source: "" } },
    bgAlpha:   { base: 1,   min: 0,   max: 1,            mod: { source: "" } },
});

export function drawFractalKaleidoscope(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const segments  = Math.max(2, Math.round(p.segments ?? 6));
    const zoomParam = p.zoom ?? 1.2;
    const rotation  = p.rotation ?? 0.1;
    const maxIter   = Math.round(Math.min(120, (p.iterations ?? 40) + mid * 30));
    const chromaShift = p.chromaShift ?? 0.3;
    const pulse     = p.pulse ?? 0.8;
    const hueBase   = p.hueBase ?? 0;
    const bgAlpha   = p.bgAlpha ?? 1;

    // Smooth zoom with bass burst
    let st = _st.get(ctx);
    if (!st) { st = { zoomMod: 1, imgData: null, buf: null }; _st.set(ctx, st); }
    st.zoomMod = 0.92 * st.zoomMod + 0.08 * (1 + bass * pulse * 2);
    const zoom = zoomParam * st.zoomMod;

    const img = ctx.createImageData(IW, IH);
    const d = img.data;
    const cx = IW/2, cy = IH/2;
    const aspect = IW/IH;

    const rot = t * rotation;
    const segAngle = Math.PI / segments;

    for (let py = 0; py < IH; py++) {
        for (let px = 0; px < IW; px++) {
            // Normalize to [-1,1]
            let x = (px - cx) / cx * aspect;
            let y = (py - cy) / cy;

            // Polar fold
            let r  = Math.sqrt(x*x + y*y);
            let a  = Math.atan2(y, x) + rot;

            // Kaleidoscope folding: mirror into one segment
            a = a % (2 * segAngle);
            if (a < 0) a += 2 * segAngle;
            if (a > segAngle) a = 2 * segAngle - a;

            // Back to cartesian with zoom
            x = Math.cos(a) * r * zoom;
            y = Math.sin(a) * r * zoom;

            // Mandelbrot / Julia fractal iteration
            let zx = x, zy = y;
            const cx2 = Math.cos(t * 0.07) * 0.35;
            const cy2 = Math.sin(t * 0.11) * 0.3 + 0.1;
            let i = 0;
            while (i < maxIter && zx*zx + zy*zy < 4) {
                const tmp = zx*zx - zy*zy + cx2;
                zy = 2*zx*zy + cy2;
                zx = tmp;
                i++;
            }

            const pi = (py * IW + px) * 4;
            if (i === maxIter) {
                d[pi]=0; d[pi+1]=0; d[pi+2]=0; d[pi+3]=Math.round(bgAlpha*255);
            } else {
                const smooth = i - Math.log2(Math.log2(zx*zx + zy*zy));
                const hue = (hueBase + smooth * (12 + treble * 40) + chromaShift * 360) % 360;
                const sat = 80 + bass * 20;
                const lig = Math.min(90, 30 + smooth / maxIter * 70);
                const [r2,g2,b2] = hsl2rgb(hue, sat, lig);
                d[pi]=r2; d[pi+1]=g2; d[pi+2]=b2; d[pi+3]=255;
            }
        }
    }

    if (!st.buf) {
        st.buf = document.createElement('canvas');
        st.buf.width = IW; st.buf.height = IH;
    }
    st.buf.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
}
