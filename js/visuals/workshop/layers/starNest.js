// ── Star Nest ─────────────────────────────────────────────────────────────────
// Volumetric star-field tunnel — ported from the famous "Star Nest" GLSL by
// Kali (Pablo Roman Andrioli).  Fold-space iteration produces infinite depth.
// Rendered at a small offscreen resolution and upscaled.
// Audio: bass brightens and slows; treble shifts towards blue-white.

const _st = new WeakMap();

export const starNestParams = () => ({
    res:        { base: 140,  min: 60,  max: 240, step: 20, mod: { source: "" } },
    volSteps:   { base: 12,   min: 4,   max: 20,  step: 1,  mod: { source: "" } },
    iters:      { base: 10,   min: 4,   max: 20,  step: 1,  mod: { source: "" } },
    zoom:       { base: 0.8,  min: 0.2, max: 3,             mod: { source: "" } },
    speed:      { base: 0.02, min: 0,   max: 0.2,           mod: { source: "" } },
    formup:     { base: 0.53, min: 0.3, max: 0.8,           mod: { source: "" } }, // the magic number
    tile:       { base: 0.85, min: 0.4, max: 1.4,           mod: { source: "" } },
    brightness: { base: 0.003,min: 0.0005, max: 0.01,       mod: { source: "" } },
    darkMatter: { base: 0.3,  min: 0,   max: 1,             mod: { source: "" } },
    distFade:   { base: 0.73, min: 0.3, max: 0.95,          mod: { source: "" } },
    saturation: { base: 0.85, min: 0,   max: 1,             mod: { source: "" } },
    hue:        { base: 210,  min: 0,   max: 360,           mod: { source: "" } }, // tint hue
    pulse:      { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
});

export function drawStarNest(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const res      = Math.round(Math.max(60, Math.min(240, p.res ?? 140)));
    const SW       = res, SH = Math.round(res * h / w);
    const vSteps   = Math.round(Math.max(4, Math.min(20, p.volSteps ?? 12)));
    const iters    = Math.round(Math.max(4, Math.min(20, p.iters ?? 10)));
    const zoom     = p.zoom ?? 0.8;
    const speed    = p.speed ?? 0.02;
    const formup   = p.formup ?? 0.53;
    const tile     = p.tile ?? 0.85;
    const bright   = (p.brightness ?? 0.003) * (1 + bass * (p.pulse ?? 0.4) * 2);
    const dark     = p.darkMatter ?? 0.3;
    const fade     = p.distFade ?? 0.73;
    const sat      = p.saturation ?? 0.85;
    const hue      = (p.hue ?? 210) / 360; // normalised

    let st = _st.get(ctx);
    if (!st || st.SW !== SW || st.SH !== SH) {
        const buf = document.createElement("canvas");
        buf.width = SW; buf.height = SH;
        st = { buf, bctx: buf.getContext("2d", { willReadFrequently: false }), SW, SH };
        _st.set(ctx, st);
    }

    const id = st.bctx.createImageData(SW, SH);
    const d  = id.data;

    const time = t * speed + 0.25;
    // Camera position (flies through the tunnel)
    const fromX = 1 + time * 2, fromY = 0.5 + time, fromZ = 0.5 + time * 0.5;

    for (let py = 0; py < SH; py++) {
        const uvy = (py / SH - 0.5) * (SH / SW);
        for (let px = 0; px < SW; px++) {
            const uvx = px / SW - 0.5;
            // Ray direction
            let dirX = uvx * zoom, dirY = uvy * zoom, dirZ = 1;
            const dLen = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ);
            dirX /= dLen; dirY /= dLen; dirZ /= dLen;

            // Volumetric march
            let s    = 0.1, f = 1;
            let vr   = 0, vg = 0, vb = 0;

            for (let r = 0; r < vSteps; r++) {
                // World position
                let px2 = fromX + s * dirX * 0.5;
                let py2 = fromY + s * dirY * 0.5;
                let pz2 = fromZ + s * dirZ * 0.5;

                // Tiling fold
                const t2 = tile;
                const t22 = t2 * 2;
                px2 = Math.abs(t2 - ((px2 % t22 + t22) % t22));
                py2 = Math.abs(t2 - ((py2 % t22 + t22) % t22));
                pz2 = Math.abs(t2 - ((pz2 % t22 + t22) % t22));

                // Kali's magic fold
                let pa = 0, a = 0;
                for (let i = 0; i < iters; i++) {
                    const len2 = px2*px2 + py2*py2 + pz2*pz2 + 1e-20;
                    px2 = Math.abs(px2) / len2 - formup;
                    py2 = Math.abs(py2) / len2 - formup;
                    pz2 = Math.abs(pz2) / len2 - formup;
                    const lenN = Math.sqrt(px2*px2 + py2*py2 + pz2*pz2);
                    a += Math.abs(lenN - pa);
                    pa = lenN;
                }

                // Dark matter
                const dm = Math.max(0, dark - a * a * 0.001);
                a = a * a * a;
                if (r > 5) f *= 1 - dm;

                // Accumulate colour based on step depth
                vr += f;
                vg += f;
                vb += f;
                vr += s * s * a * bright * f;
                vg += s * s * a * bright * f * (treble * 0.3 + 0.85);
                vb += s * s * a * bright * f * (1 + hue);

                f  *= fade;
                s  += 0.1;
            }

            // Mix saturation
            const grey = 0.2126 * vr + 0.7152 * vg + 0.0722 * vb;
            vr = grey + (vr - grey) * sat;
            vg = grey + (vg - grey) * sat;
            vb = grey + (vb - grey) * sat;

            // Apply hue tint
            const tR = 0.8 + hue * 0.2, tG = 0.9, tB = 0.6 + hue * 0.4;
            vr *= tR; vg *= tG; vb *= tB;

            const gain = 0.008;
            const idx = (py * SW + px) * 4;
            d[idx]   = Math.min(255, Math.round(vr * gain * 255));
            d[idx+1] = Math.min(255, Math.round(vg * gain * 255));
            d[idx+2] = Math.min(255, Math.round(vb * gain * 255));
            d[idx+3] = 255;
        }
    }
    st.bctx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.buf, 0, 0, w, h);
}
