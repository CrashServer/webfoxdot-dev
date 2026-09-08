// ── Metaballs 2D ─────────────────────────────────────────────────────────────
// Classic isosurface blob merging. N charged spheres move around the canvas;
// each pixel's "field" is the sum of (radius²)/(dx²+dy²) over all balls.
// Pixels above a threshold are filled with blended ball colours; below it gets
// the background. Sampled at low resolution and upscaled for performance.
// Audio-reactive: bass pulses the blob radii; treble increases ball speed.

const _st = new WeakMap();

export const metaballsParams = () => ({
    count:    { base: 7,   min: 2,   max: 20,  step: 1,  mod: { source: "" } },
    res:      { base: 120, min: 40,  max: 240, step: 20, mod: { source: "" } }, // sample width
    radius:   { base: 0.25,min: 0.05,max: 0.6,           mod: { source: "" } }, // ball radius rel to canvas
    speed:    { base: 0.4, min: 0,   max: 2,             mod: { source: "" } },
    threshold:{ base: 1.0, min: 0.3, max: 3,             mod: { source: "" } },
    pulse:    { base: 0.5, min: 0,   max: 1,             mod: { source: "" } },
    glow:     { base: 0.3, min: 0,   max: 1,             mod: { source: "" } },
    bgR:      { base: 0,   min: 0,   max: 255, step: 1,  mod: { source: "" } },
    bgG:      { base: 0,   min: 0,   max: 255, step: 1,  mod: { source: "" } },
    bgB:      { base: 0,   min: 0,   max: 255, step: 1,  mod: { source: "" } },
});

export function drawMetaballs(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*3) : 0;

    const N    = Math.round(Math.max(2, Math.min(20, p.count ?? 7)));
    const SW   = Math.round(Math.max(40, Math.min(240, p.res ?? 120)));
    const SH   = Math.round(SW * h / w);
    const rad  = (p.radius ?? 0.25) * (1 + bass * (p.pulse ?? 0.5) * 0.6);
    const spd  = (p.speed ?? 0.4) * (1 + treble * 0.5);
    const thr  = p.threshold ?? 1.0;
    const glow = p.glow ?? 0.3;
    const bgR  = Math.round(p.bgR ?? 0);
    const bgG  = Math.round(p.bgG ?? 0);
    const bgB  = Math.round(p.bgB ?? 0);

    let st = _st.get(ctx);
    if (!st || st.balls.length !== N) {
        st = {
            balls: Array.from({ length: N }, (_, i) => ({
                x: Math.random(), y: Math.random(),
                vx: (Math.random() - 0.5) * 0.006,
                vy: (Math.random() - 0.5) * 0.006,
                hue: (i / N) * 360,
            })),
            buf: null, bufCtx: null,
        };
        _st.set(ctx, st);
    }

    // Resize offscreen buffer if needed
    if (!st.buf || st.buf.width !== SW || st.buf.height !== SH) {
        st.buf = document.createElement("canvas");
        st.buf.width = SW; st.buf.height = SH;
        st.bufCtx = st.buf.getContext("2d", { willReadFrequently: false });
    }

    // Move balls (normalised 0..1 coords)
    const balls = st.balls;
    for (let i = 0; i < N; i++) {
        const b = balls[i];
        b.x += b.vx * spd;
        b.y += b.vy * spd;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
        if (b.x > 1) { b.x = 1; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        if (b.y > 1) { b.y = 1; b.vy = -Math.abs(b.vy); }
    }

    // Render into pixel buffer via ImageData
    const bufCtx = st.bufCtx;
    const id = bufCtx.createImageData(SW, SH);
    const d  = id.data;

    const r2 = (rad * SW) ** 2;

    for (let py = 0; py < SH; py++) {
        const fy = py / SH;
        for (let px = 0; px < SW; px++) {
            const fx = px / SW;
            let field = 0, wR = 0, wG = 0, wB = 0, wSum = 0;

            for (let i = 0; i < N; i++) {
                const b  = balls[i];
                const dx = (fx - b.x) * SW;
                const dy = (fy - b.y) * SH;
                const d2 = dx*dx + dy*dy + 0.001;
                const f  = r2 / d2;
                field += f;
                // Weight ball's colour by field contribution
                const c = f * f;
                wR += Math.round(Math.cos((b.hue / 360) * Math.PI * 2) * 127 + 128) * c;
                wG += Math.round(Math.cos(((b.hue + 120) / 360) * Math.PI * 2) * 127 + 128) * c;
                wB += Math.round(Math.cos(((b.hue + 240) / 360) * Math.PI * 2) * 127 + 128) * c;
                wSum += c;
            }

            const idx = (py * SW + px) * 4;
            if (field >= thr) {
                const blend = Math.min(1, (field - thr) * 3);
                d[idx]   = wSum > 0 ? wR / wSum : 200;
                d[idx+1] = wSum > 0 ? wG / wSum : 200;
                d[idx+2] = wSum > 0 ? wB / wSum : 200;
                d[idx+3] = Math.round(180 + blend * 75);
            } else {
                d[idx]   = bgR;
                d[idx+1] = bgG;
                d[idx+2] = bgB;
                d[idx+3] = 255;
            }
        }
    }
    bufCtx.putImageData(id, 0, 0);

    ctx.clearRect(0, 0, w, h);
    if (glow > 0.05) { ctx.shadowBlur = glow * 20; ctx.shadowColor = `hsl(${balls[0].hue},100%,70%)`; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, SW, SH, 0, 0, w, h);
    ctx.shadowBlur = 0;
}
