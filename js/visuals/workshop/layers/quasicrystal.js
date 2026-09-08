// ── Quasicrystal ─────────────────────────────────────────────────────────────
// Ported from the native src/layers/quasicrystal.cu. Sum of N rotated plane
// waves produces an N-fold interference pattern with quasiperiodic symmetry.
// Bass swells the amplitude, treble drifts the phase. Rendered at reduced
// resolution into a buffer canvas and scaled up (per-pixel in JS).

const _st = new WeakMap();

export const quasicrystalParams = () => ({
    waves:      { base: 7,   min: 3,   max: 12,  step: 1, mod: { source: "" } },
    scale:      { base: 18,  min: 4,   max: 60,           mod: { source: "" } },
    speed:      { base: 0.3, min: -2,  max: 2,            mod: { source: "" } },
    contrast:   { base: 1.2, min: 0.3, max: 3,            mod: { source: "" } },
    hue:        { base: 200, min: 0,   max: 360,          mod: { source: "" } },
    hueRange:   { base: 120, min: 0,   max: 360,          mod: { source: "" } },
    sat:        { base: 70,  min: 0,   max: 100,          mod: { source: "" } },
    pulse:      { base: 0.5, min: 0,   max: 1,            mod: { source: "" } },
    res:        { base: 180, min: 60,  max: 320, step: 1, mod: { source: "" } },
    brightness: { base: 1,   min: 0,   max: 2,            mod: { source: "" } },
});

function hsl2rgb(hDeg, s, l, out, idx) {
    const hN = (((hDeg % 360) + 360) % 360) / 60;
    const C = (1 - Math.abs(2 * l - 1)) * s;
    const X = C * (1 - Math.abs(hN % 2 - 1));
    const m = l - C / 2;
    let r = 0, g = 0, b = 0;
    if      (hN < 1) { r = C; g = X; }
    else if (hN < 2) { r = X; g = C; }
    else if (hN < 3) { g = C; b = X; }
    else if (hN < 4) { g = X; b = C; }
    else if (hN < 5) { r = X; b = C; }
    else             { r = C; b = X; }
    out[idx]   = (r + m) * 255;
    out[idx+1] = (g + m) * 255;
    out[idx+2] = (b + m) * 255;
    out[idx+3] = 255;
}

export function drawQuasicrystal(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nWaves  = Math.round(Math.max(3, Math.min(12, p.waves ?? 7)));
    const scale   = (p.scale ?? 18) * (1 + bass * (p.pulse ?? 0.5) * 0.4);
    const speed   = p.speed ?? 0.3;
    const contrast= p.contrast ?? 1.2;
    const hue0    = p.hue ?? 200;
    const hueR    = p.hueRange ?? 120;
    const sat     = (p.sat ?? 70) / 100;
    const bright  = p.brightness ?? 1;
    const res     = Math.round(Math.max(60, Math.min(320, p.res ?? 180)));
    const SW = res, SH = Math.round(res * h / w);

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d", { willReadFrequently: false }), SW, SH };
        _st.set(ctx, st);
    }

    // Precompute wave directions + phases
    const dirs = new Float32Array(nWaves * 2);
    const phase = t * speed + treble * 2.0;
    for (let i = 0; i < nWaves; i++) {
        const a = Math.PI * i / nWaves;
        dirs[i*2]   = Math.cos(a);
        dirs[i*2+1] = Math.sin(a);
    }

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;
    const aspect = SH / SW;
    for (let py = 0; py < SH; py++) {
        const v = (py / SH - 0.5) * scale * aspect;
        for (let px = 0; px < SW; px++) {
            const u = (px / SW - 0.5) * scale;
            let sum = 0;
            for (let i = 0; i < nWaves; i++) {
                sum += Math.cos(u * dirs[i*2] + v * dirs[i*2+1] + phase);
            }
            // banding [0,1]
            const band = 0.5 + 0.5 * Math.cos(sum * contrast);
            const hue = hue0 + band * hueR;
            const l = Math.min(0.92, (0.12 + band * 0.6) * bright);
            hsl2rgb(hue, sat, l, d, (py * SW + px) * 4);
        }
    }
    st.bctx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
}
