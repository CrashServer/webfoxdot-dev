// ── Neon Grid 3D ─────────────────────────────────────────────────────────────
// Outrun / synthwave-style perspective grid floor + horizon line with sun/moon.
// Bass pulses the horizon burst; treble brightens the grid lines.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const neonGrid3DParams = () => ({
    hue:      { base: 300,  min: 0,   max: 360,           mod: { source: "" } }, // grid hue
    hue2:     { base: 180,  min: 0,   max: 360,           mod: { source: "" } }, // sky/sun hue
    speed:    { base: 1.0,  min: 0,   max: 6,             mod: { source: "" } }, // scroll speed
    lines:    { base: 14,   min: 4,   max: 30,  step: 1,  mod: { source: "" } }, // H grid lines
    cols:     { base: 18,   min: 4,   max: 40,  step: 1,  mod: { source: "" } }, // V grid lines
    horizon:  { base: 0.42, min: 0.2, max: 0.7,           mod: { source: "" } }, // horizon Y fraction
    glow:     { base: 0.8,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    sunSize:  { base: 0.18, min: 0,   max: 0.4,           mod: { source: "" } },
    sunStripes:{ base: 6,   min: 0,   max: 12, step: 1,   mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 1.2,  min: 0.3, max: 4,             mod: { source: "" } },
});

export function drawNeonGrid3D(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const hue      = p.hue ?? 300;
    const hue2     = p.hue2 ?? 180;
    const speed    = p.speed ?? 1.0;
    const nLines   = Math.round(Math.max(4, Math.min(30, p.lines ?? 14)));
    const nCols    = Math.round(Math.max(4, Math.min(40, p.cols ?? 18)));
    const horizFrac= p.horizon ?? 0.42;
    const glow     = p.glow ?? 0.8;
    const pulse    = p.pulse ?? 0.6;
    const sunSize  = (p.sunSize ?? 0.18) * Math.min(w, h) * (1 + bass * pulse * 0.15);
    const sunStripes= Math.round(Math.max(0, Math.min(12, p.sunStripes ?? 6)));
    const bgAlpha  = p.bgAlpha ?? 1;
    const thick    = p.thick ?? 1.2;

    let st = _st.get(ctx);
    if (!st) { st = { scroll: 0, lastT: t }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.scroll += speed * dt * 0.5;

    const hy = h * horizFrac; // horizon Y pixel
    const cx = w / 2;

    // Sky background gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, hy);
    skyGrad.addColorStop(0, `hsla(${hue2 + 40},80%,5%,${bgAlpha})`);
    skyGrad.addColorStop(1, `hsla(${hue2},70%,15%,${bgAlpha})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, hy);

    // Floor background
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, hy, w, h - hy);

    // Sun / retro orb
    if (sunSize > 4) {
        const sunY = hy - sunSize * 0.1;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * 40 * (1 + bass * pulse * 0.5);
            ctx.shadowColor = `hsl(${hue2},100%,70%)`;
        }
        // Full circle
        const sunGrad = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, sunSize);
        sunGrad.addColorStop(0, `hsl(${hue2 + 40},100%,90%)`);
        sunGrad.addColorStop(0.6, `hsl(${hue2},100%,65%)`);
        sunGrad.addColorStop(1, `hsla(${hue2 - 20},80%,40%,0)`);
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(cx, sunY, sunSize, 0, TAU);
        ctx.fill();

        // Horizontal stripes cutting sun (retro)
        if (sunStripes > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, sunY, sunSize, 0, TAU);
            ctx.clip();
            const stripeH = sunSize * 2 / (sunStripes * 2 + 1);
            for (let s = 0; s < sunStripes; s++) {
                const sy = sunY - sunSize + stripeH * (s * 2 + 1);
                ctx.fillStyle = `rgba(0,0,0,${0.4 + s * 0.04})`;
                ctx.fillRect(cx - sunSize, sy, sunSize * 2, stripeH * 0.7);
            }
            ctx.restore();
        }
        ctx.shadowBlur = 0;
    }

    // Grid glow
    if (glow > 0.05) {
        ctx.shadowBlur = glow * 8 * (1 + treble * 0.5);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }
    ctx.lineWidth = thick;

    // Vertical lines (perspective) — batched into one stroke call (shadowBlur is set once)
    const phase = (st.scroll % 1) * (w / nCols);
    ctx.strokeStyle = `hsla(${hue},90%,60%,${0.5 + treble * 0.4})`;
    ctx.beginPath();
    for (let i = 0; i <= nCols; i++) {
        const xBase = (i / nCols) * w + phase - w / nCols;
        const xHoriz = cx + (xBase - cx) * 0.02;
        ctx.moveTo(xHoriz, hy);
        ctx.lineTo(xBase, h);
    }
    ctx.stroke();

    // Horizontal lines (perspective, scrolling)
    for (let i = 0; i <= nLines; i++) {
        const frac = Math.pow(i / nLines, 2); // exponential spacing
        const scrollFrac = ((frac + st.scroll * 0.06) % 1);
        const y = hy + (h - hy) * scrollFrac;
        const alpha = 0.2 + scrollFrac * 0.6 + bass * pulse * 0.2;
        const xLeft  = cx - (cx * (1 - scrollFrac * 0.98));
        const xRight = cx + (cx * (1 - scrollFrac * 0.98));
        ctx.strokeStyle = `hsla(${(hue + 30) % 360},80%,65%,${alpha})`;
        ctx.lineWidth = thick * (0.3 + scrollFrac * 0.7);
        ctx.beginPath();
        ctx.moveTo(xLeft, y);
        ctx.lineTo(xRight, y);
        ctx.stroke();
    }

    // Bass burst on horizon
    if (bass > 0.5) {
        const burstAlpha = (bass - 0.5) * 2 * pulse * 0.4;
        const burstGrad = ctx.createRadialGradient(cx, hy, 0, cx, hy, w * 0.5);
        burstGrad.addColorStop(0, `hsla(${hue},100%,80%,${burstAlpha})`);
        burstGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = burstGrad;
        ctx.fillRect(0, hy - 40, w, 80);
    }

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
}
