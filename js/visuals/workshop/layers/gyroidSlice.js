// ── Gyroid Surface Slice ──────────────────────────────────────────────────────
// Gyroid implicit: sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x) = 0.
// Renders a 2D slice animated through z. Double-slice for thickness.
// Slow 2D rotation in uv space. Bass shifts threshold; treble modulates freq;
// beat snaps to new z position.

const _state = new WeakMap();

function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
}

function gyroid(x, y, z) {
    return Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
}

function makeState() {
    return {
        time: 0,
        prevBass: 0,
        zOffset: 0,
        offscreen: null, offCtx: null, ow: 0, oh: 0,
    };
}

export const gyroidSliceParams = () => ({
    hue:       { base: 180, min: 0,    max: 360, mod: { source: "" } },
    freq:      { base: 2.5, min: 1,    max: 6,   mod: { source: "" } },
    speed:     { base: 0.4, min: 0.1,  max: 2,   mod: { source: "" } },
    thickness: { base: 0.2, min: 0.05, max: 0.5, mod: { source: "" } },
    spin:      { base: 0.15,min: 0,    max: 1,   mod: { source: "" } },
    glow:      { base: 1.5, min: 0,    max: 3,   mod: { source: "" } },
});

export function drawGyroidSlice(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) { st = makeState(); _state.set(ctx, st); }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0, treble = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
        for (let i = 44; i < 64; i++) treble += sp[i]; treble /= 20;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) {
        st.zOffset += Math.PI * (0.5 + Math.random());
    }
    st.prevBass = bass;

    const hue       = p.hue ?? 180;
    const freqBase  = (p.freq ?? 2.5) * (1 + treble * 0.3);
    const speed     = p.speed ?? 0.4;
    const threshold = Math.max(0.02, (p.thickness ?? 0.2) * (1 + bass * 0.5));
    const spinSpeed = p.spin ?? 0.15;
    const glow      = p.glow ?? 1.5;

    const zSlice = st.time * speed + st.zOffset;
    const rot    = st.time * spinSpeed * 0.3;
    const cosR   = Math.cos(rot), sinR = Math.sin(rot);

    const RW = Math.min(512, w), RH = Math.min(512, h);

    if (!st.offscreen || st.ow !== RW || st.oh !== RH) {
        st.offscreen = new OffscreenCanvas(RW, RH);
        st.offCtx    = st.offscreen.getContext('2d');
        st.ow = RW; st.oh = RH;
    }

    const id   = st.offCtx.createImageData(RW, RH);
    const data = id.data;

    const scaleX = 4 / RW * freqBase;
    const scaleY = 4 / RH * freqBase;

    // Pre-compute colors
    const surfRGB  = hsl2rgb(hue,          0.9, 0.60);
    const bgA_RGB  = hsl2rgb(hue + 120,   0.3, 0.08);
    const bgB_RGB  = hsl2rgb(hue + 240,   0.3, 0.12);
    const glowRGB  = hsl2rgb(hue,          1.0, 0.85);

    for (let py = 0; py < RH; py++) {
        const v = (py / RH - 0.5) * 2;
        for (let px = 0; px < RW; px++) {
            const u = (px / RW - 0.5) * 2;

            // Rotate UV
            const ru = u * cosR - v * sinR;
            const rv = u * sinR + v * cosR;

            const wx = ru * 2 * Math.PI;
            const wy = rv * 2 * Math.PI;

            const gv1 = gyroid(wx * scaleX * (RW/4), wy * scaleY * (RH/4), zSlice);
            const gv2 = gyroid(wx * scaleX * (RW/4), wy * scaleY * (RH/4), zSlice + 0.1);

            const onSurf1 = Math.abs(gv1) < threshold;
            const onSurf2 = Math.abs(gv2) < threshold;

            const off = (py * RW + px) << 2;
            if (onSurf1 || onSurf2) {
                const blend = onSurf1 && onSurf2 ? 1.0 : 0.7;
                // Glow enhancement near zero
                const nearness = 1 - Math.min(Math.abs(gv1), threshold) / threshold;
                const extra2   = nearness * nearness * glow * 0.5;
                data[off]     = Math.min(255, (surfRGB[0] * blend + glowRGB[0] * extra2) | 0);
                data[off + 1] = Math.min(255, (surfRGB[1] * blend + glowRGB[1] * extra2) | 0);
                data[off + 2] = Math.min(255, (surfRGB[2] * blend + glowRGB[2] * extra2) | 0);
                data[off + 3] = 255;
            } else if (gv1 > 0) {
                data[off] = bgA_RGB[0]; data[off+1] = bgA_RGB[1]; data[off+2] = bgA_RGB[2]; data[off+3] = 255;
            } else {
                data[off] = bgB_RGB[0]; data[off+1] = bgB_RGB[1]; data[off+2] = bgB_RGB[2]; data[off+3] = 255;
            }
        }
    }

    st.offCtx.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(st.offscreen, 0, 0, w, h);

    // Glow overlay pass on canvas
    if (glow > 0) {
        ctx.save();
        ctx.filter = `blur(${glow * 3 | 0}px)`;
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.15 * glow;
        ctx.drawImage(st.offscreen, 0, 0, w, h);
        ctx.restore();
    }
}
