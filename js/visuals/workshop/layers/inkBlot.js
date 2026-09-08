// ── Ink Blot ──────────────────────────────────────────────────────────────────
// Symmetric procedural Rorschach inkblot generated from layered sine noise.
// Morphs over time; bass splashes new ink; treble spreads the edges.

const _st = new WeakMap();

export const inkBlotParams = () => ({
    complexity: { base: 6,    min: 1,  max: 12,  step: 1, mod: { source: "" } }, // noise octaves
    scale:      { base: 0.35, min: 0.1,max: 0.8,          mod: { source: "" } },
    speed:      { base: 0.15, min: 0,  max: 2,            mod: { source: "" } }, // morph speed
    hue:        { base: 0,    min: 0,  max: 360,          mod: { source: "" } }, // 0=black ink
    sat:        { base: 0,    min: 0,  max: 100,          mod: { source: "" } }, // 0=monochrome
    inkAlpha:   { base: 0.95, min: 0,  max: 1,            mod: { source: "" } },
    bgAlpha:    { base: 0.85, min: 0,  max: 1,            mod: { source: "" } },
    threshold:  { base: 0.5,  min: 0.1,max: 0.9,          mod: { source: "" } }, // ink boundary
    pulse:      { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    blur:       { base: 2,    min: 0,  max: 12,  step: 1, mod: { source: "" } }, // edge softening
    symmetry:   { base: 2,    min: 1,  max: 4,   step: 1, mod: { source: "" } }, // 2=bilateral, 4=4-fold
});

// 2D value noise from sine basis functions
function sineNoise(x, y, freq, oct) {
    let v = 0, amp = 1, f = freq, sum = 0;
    for (let o = 0; o < oct; o++) {
        v += Math.sin(x * f * 1.3 + y * f * 0.7) *
             Math.cos(y * f * 1.1 - x * f * 0.5) * amp;
        sum += amp;
        amp *= 0.5; f *= 2.1;
    }
    return v / sum;
}

export function drawInkBlot(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const oct      = Math.round(Math.max(1, Math.min(12, p.complexity ?? 6)));
    const scale    = (p.scale ?? 0.35) * Math.min(w, h);
    const speed    = p.speed ?? 0.15;
    const hue      = p.hue ?? 0;
    const sat      = p.sat ?? 0;
    const inkAlpha = p.inkAlpha ?? 0.95;
    const bgAlpha  = p.bgAlpha ?? 0.85;
    const thresh   = (p.threshold ?? 0.5) - bass * (p.pulse ?? 0.4) * 0.15;
    const blurPx   = p.blur ?? 2;
    const sym      = Math.round(Math.max(1, Math.min(4, p.symmetry ?? 2)));

    let st = _st.get(ctx);
    if (!st) {
        const oc = document.createElement("canvas");
        oc.width = Math.round(w / 3); oc.height = Math.round(h / 3);
        st = { oc, octx: oc.getContext("2d") };
        _st.set(ctx, st);
    }

    if (st.oc.width !== Math.round(w / 3) || st.oc.height !== Math.round(h / 3)) {
        st.oc.width = Math.round(w / 3);
        st.oc.height = Math.round(h / 3);
    }

    const SW = st.oc.width, SH = st.oc.height;
    const oCtx = st.octx;
    const id = oCtx.createImageData(SW, SH);
    const d  = id.data;

    const cx = SW / 2, cy = SH / 2;
    const freq = (3 / scale) * (SW / w);
    const T = t * speed;
    const edge = treble * 0.1;

    for (let y = 0; y < SH; y++) {
        for (let x = 0; x < SW; x++) {
            let qx = (x - cx) / (SW / 2);
            let qy = (y - cy) / (SH / 2);

            // Apply symmetry — fold coordinates
            if (sym >= 2) qx = Math.abs(qx);      // bilateral
            if (sym >= 4) qy = Math.abs(qy);      // 4-fold

            const n = sineNoise(qx + T * 0.3, qy + T * 0.2, freq, oct);
            const dist = Math.sqrt(qx*qx + qy*qy);
            const v = n * (1 - dist * 1.1 + edge) + dist * 0.1;
            const isInk = v > (thresh * 2 - 1);

            const i = (y * SW + x) * 4;
            if (isInk) {
                const l = 5 + (1 - Math.abs(v * 0.5)) * 20;
                d[i]   = sat > 0 ? Math.round(l * 2.55) : Math.round(l * 2.55);
                d[i+1] = Math.round(l * 2.55 * (1 - sat / 100 * 0.5));
                d[i+2] = Math.round(l * 2.55 * (1 - sat / 100 * 0.8));
                d[i+3] = Math.round(inkAlpha * 255);
            } else {
                d[i] = d[i+1] = d[i+2] = 240;
                d[i+3] = Math.round(bgAlpha * 255);
            }
        }
    }
    oCtx.putImageData(id, 0, 0);

    ctx.clearRect(0, 0, w, h);
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.oc, 0, 0, w, h);
    ctx.filter = "none";
}
