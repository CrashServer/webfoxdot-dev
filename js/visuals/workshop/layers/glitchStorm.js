// ── Glitch Storm ─────────────────────────────────────────────────────────────
// Adapted from CRIC/512_VISUALISATION GlitchStormScene.
// Multi-technique Canvas2D glitch: scanline shift, RGB split, block corruption,
// flash overlays, and datamosh bars. Bass = intensity spike.

const _st = new WeakMap();

function lcg(s) { s = (s*1664525+1013904223)&0x7fffffff; return [s, s/0x7fffffff]; }

export const glitchStormParams = () => ({
    intensity:  { base: 0.5,  min: 0,   max: 1,           mod: { source: "" } },
    pulse:      { base: 0.8,  min: 0,   max: 1,           mod: { source: "" } },
    scanShift:  { base: 0.7,  min: 0,   max: 1,           mod: { source: "" } }, // horizontal line displacement
    rgbSplit:   { base: 0.6,  min: 0,   max: 1,           mod: { source: "" } }, // chromatic aberration
    blockCorr:  { base: 0.6,  min: 0,   max: 1,           mod: { source: "" } }, // rectangular corruption blocks
    flashAlpha: { base: 0.5,  min: 0,   max: 1,           mod: { source: "" } }, // color flash on beat
    hue:        { base: 120,  min: 0,   max: 360,         mod: { source: "" } }, // primary glitch hue (green)
    hue2:       { base: 0,    min: 0,   max: 360,         mod: { source: "" } }, // secondary (red)
    speed:      { base: 1.0,  min: 0.1, max: 4,           mod: { source: "" } },
    bgAlpha:    { base: 0.85, min: 0,   max: 1,           mod: { source: "" } },
    noise:      { base: 0.3,  min: 0,   max: 1,           mod: { source: "" } }, // TV noise density
});

export function drawGlitchStorm(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const intensity = (p.intensity ?? 0.5) * (1 + bass * (p.pulse ?? 0.8) * 1.5);
    const scanShift = p.scanShift ?? 0.7;
    const rgbSplit  = p.rgbSplit ?? 0.6;
    const blockCorr = p.blockCorr ?? 0.6;
    const flashA    = p.flashAlpha ?? 0.5;
    const hue       = p.hue ?? 120;
    const hue2      = p.hue2 ?? 0;
    const speed     = p.speed ?? 1.0;
    const bgAlpha   = p.bgAlpha ?? 0.85;
    const noise     = p.noise ?? 0.3;

    let st = _st.get(ctx);
    if (!st) {
        st = { seed: 42, prevBass: 0, flash: 0, flashHue: hue, datamoshBars: [], lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;

    // Bass hit: spawn datamosh bars and color flash
    if (bass > 0.4 && bass > st.prevBass + 0.08) {
        st.flash = bass * (p.pulse ?? 0.8) * flashA;
        st.flashHue = Math.random() > 0.5 ? hue : hue2;
        const nBars = Math.ceil(bass * 5);
        for (let i = 0; i < nBars; i++) {
            const y = Math.random() * h;
            const bh = 10 + Math.random() * h * 0.15 * intensity;
            st.datamoshBars.push({ y, h: bh, life: 0.5 + Math.random() * 0.5,
                                   hue: Math.random() > 0.5 ? hue : hue2,
                                   dx: (Math.random() - 0.5) * w * 0.2 });
        }
    }
    st.prevBass = bass;
    st.flash *= 0.85;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── Datamosh bars (horizontal color displacement blobs)
    for (const bar of st.datamoshBars) {
        bar.life -= dt * 2;
        if (bar.life <= 0) continue;
        const alpha = bar.life * 0.35 * intensity;
        ctx.fillStyle = `hsla(${bar.hue},90%,50%,${alpha})`;
        ctx.fillRect(bar.dx, bar.y, w, bar.h);
    }
    st.datamoshBars = st.datamoshBars.filter(b => b.life > 0);

    // ── TV noise grain
    if (noise > 0.05) {
        let s = st.seed;
        const nDots = Math.floor(noise * intensity * 800);
        ctx.fillStyle = `rgba(255,255,255,0.6)`;
        for (let i = 0; i < nDots; i++) {
            let r1, r2;
            [s, r1] = lcg(s); [s, r2] = lcg(s);
            const nx = r1 * w, ny = r2 * h;
            ctx.fillRect(nx, ny, 2, 1);
        }
        st.seed = s;
    }

    // ── Block corruption: random rectangles with displaced content
    if (blockCorr > 0.05 && intensity > 0.1) {
        const nBlocks = Math.floor(intensity * blockCorr * 8);
        let s = st.seed + 1;
        for (let i = 0; i < nBlocks; i++) {
            let r1, r2, r3, r4;
            [s, r1] = lcg(s); [s, r2] = lcg(s); [s, r3] = lcg(s); [s, r4] = lcg(s);
            const bx = r1 * w, by = r2 * h;
            const bw = 20 + r3 * w * 0.3, bh2 = 4 + r4 * 60 * intensity;
            // Solid color block (corruption artifact)
            const bHue = r1 > 0.5 ? hue : hue2;
            ctx.fillStyle = `hsla(${bHue},70%,${30+treble*30}%,${0.3*intensity})`;
            ctx.fillRect(bx, by, bw, bh2);
            // Glitch outline
            ctx.strokeStyle = `hsla(${bHue},100%,70%,${0.5*intensity})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, bh2);
        }
    }

    // ── Scanline shift: displace rows of pixels horizontally
    if (scanShift > 0.05 && intensity > 0.1) {
        const nLines = Math.floor(intensity * scanShift * 12);
        let s = st.seed + 2;
        for (let i = 0; i < nLines; i++) {
            let r1, r2, r3;
            [s, r1] = lcg(s); [s, r2] = lcg(s); [s, r3] = lcg(s);
            const ly = r1 * h;
            const lh = 2 + r2 * 12 * intensity;
            const dx = (r3 - 0.5) * w * 0.25 * scanShift * intensity;
            const lineHue = r1 > 0.6 ? hue : hue2;
            ctx.fillStyle = `hsla(${lineHue},80%,55%,${0.25*intensity})`;
            ctx.fillRect(dx, ly, w, lh);
        }
    }

    // ── RGB split (chromatic aberration overlay)
    if (rgbSplit > 0.05 && intensity > 0.15) {
        const splitAmt = rgbSplit * intensity * 20;
        // Red channel shifted left
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255,0,0,${rgbSplit*intensity*0.15})`;
        ctx.fillRect(-splitAmt, 0, w, h);
        // Blue channel shifted right
        ctx.fillStyle = `rgba(0,0,255,${rgbSplit*intensity*0.15})`;
        ctx.fillRect(splitAmt, 0, w, h);
        // Green slight vertical shift
        ctx.fillStyle = `rgba(0,255,0,${rgbSplit*intensity*0.08})`;
        ctx.fillRect(0, splitAmt * 0.5, w, h);
        ctx.globalCompositeOperation = 'source-over';
    }

    // ── Horizontal scan lines (CRT feel)
    ctx.fillStyle = `rgba(0,0,0,0.08)`;
    for (let sy = 0; sy < h; sy += 3) { ctx.fillRect(0, sy, w, 1); }

    // ── Vertical sync bars (rolling stripes)
    const barY = ((t * speed * 80) % (h + 60)) - 60;
    ctx.fillStyle = `hsla(${hue},60%,40%,${0.06 * intensity})`;
    ctx.fillRect(0, barY, w, 30);
    ctx.fillRect(0, barY + h / 2, w, 20);

    // ── Beat flash overlay
    if (st.flash > 0.01) {
        ctx.fillStyle = `hsla(${st.flashHue},90%,60%,${st.flash})`;
        ctx.fillRect(0, 0, w, h);
    }

    // ── Corner "ERROR" text
    if (intensity > 0.5 && mid > 0.3) {
        ctx.font = `bold ${Math.floor(10 + mid * 8)}px monospace`;
        ctx.fillStyle = `hsla(${hue2},90%,60%,${mid * 0.8})`;
        ctx.fillText('SIGNAL LOST', 10, 20);
        ctx.fillText(`ERR:${Math.floor(t * 1000) % 9999}`, 10, 36);
    }
}
