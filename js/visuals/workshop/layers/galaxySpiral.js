// ── Galaxy Spiral ─────────────────────────────────────────────────────────────
// Logarithmic-spiral star field with N arms, dust lanes and a bright nucleus.
// Bass pulses the core; treble brightens arm stars.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const galaxySpiralParams = () => ({
    arms:     { base: 2,    min: 1,   max: 6,   step: 1,  mod: { source: "" } },
    stars:    { base: 3000, min: 500, max: 8000, step: 100,mod: { source: "" } },
    spread:   { base: 0.3,  min: 0.05,max: 0.8,           mod: { source: "" } }, // arm width
    twist:    { base: 2.5,  min: 0.5, max: 6,             mod: { source: "" } }, // spiral tightness
    rotSpeed: { base: 0.05, min: -0.5,max: 0.5,           mod: { source: "" } },
    hue:      { base: 220,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 60,   min: 0,   max: 180,           mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } },
    tilt:     { base: 0.15, min: 0,   max: 0.5,           mod: { source: "" } }, // y-axis foreshorten
    starSize: { base: 1.5,  min: 0.5, max: 4,             mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,   max: 1,             mod: { source: "" } },
});

export function drawGalaxySpiral(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const arms    = Math.round(Math.max(1, Math.min(6, p.arms ?? 2)));
    const nStars  = Math.round(Math.max(500, Math.min(8000, p.stars ?? 3000)));
    const spread  = p.spread ?? 0.3;
    const twist   = p.twist ?? 2.5;
    const rotSpeed= p.rotSpeed ?? 0.05;
    const hue     = p.hue ?? 220;
    const hueR    = p.hueRange ?? 60;
    const pulse   = p.pulse ?? 0.5;
    const tilt    = 1 - (p.tilt ?? 0.15);
    const starSz  = p.starSize ?? 1.5;
    const bgAlpha = p.bgAlpha ?? 0;

    let st = _st.get(ctx);
    if (!st || st.nStars !== nStars || st.arms !== arms) {
        // Generate star positions in polar coords
        const stars = new Float32Array(nStars * 4); // r, th, hoff, size
        for (let i = 0; i < nStars; i++) {
            const r = Math.pow(Math.random(), 0.6);
            const arm = Math.floor(Math.random() * arms);
            const armAngle = arm * TAU / arms;
            const spiralTh = armAngle + r * twist;
            const noise = (Math.random() - 0.5) * spread * (1 - r * 0.5);
            const noiseR = (Math.random() - 0.5) * spread * 0.3;
            stars[i*4]   = r + noiseR;
            stars[i*4+1] = spiralTh + noise;
            stars[i*4+2] = Math.random() * hueR;
            stars[i*4+3] = 0.2 + Math.random() * 0.8;
        }
        st = { nStars, arms, stars, rot: 0, lastT: t };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rot += rotSpeed * dt;

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    const cx = w / 2, cy = h / 2;
    const maxR = Math.min(w, h) * 0.45 * (1 + bass * pulse * 0.08);

    // Nucleus glow
    const nuclR = maxR * 0.06 * (1 + bass * pulse * 0.5);
    const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, nuclR);
    ng.addColorStop(0, `hsl(${hue + 40},100%,95%)`);
    ng.addColorStop(0.3, `hsl(${hue},90%,75%)`);
    ng.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.ellipse(cx, cy, nuclR * 2.5, nuclR * 2.5 * tilt, 0, 0, TAU);
    ctx.fill();

    // Stars
    const stars = st.stars;
    for (let i = 0; i < nStars; i++) {
        const r  = stars[i*4];
        const th = stars[i*4+1] + st.rot;
        const sz = stars[i*4+3];

        const px = cx + Math.cos(th) * r * maxR;
        const py = cy + Math.sin(th) * r * maxR * tilt;

        const sh = (hue + stars[i*4+2]) % 360;
        const bright = 40 + (1 - r) * 40 + treble * 20;
        const alpha = sz * (0.6 + (1 - r) * 0.4);
        const radius = starSz * sz * (1 + bass * 0.3 * (1 - r));

        ctx.fillStyle = `hsla(${sh},80%,${bright}%,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, TAU);
        ctx.fill();
    }

    // Dust lane (dark band along equator)
    const dustG = ctx.createLinearGradient(cx - maxR, cy - 3, cx + maxR, cy + 3);
    dustG.addColorStop(0, "rgba(0,0,0,0)");
    dustG.addColorStop(0.5, "rgba(0,0,0,0.25)");
    dustG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = dustG;
    ctx.fillRect(cx - maxR, cy - 6, maxR * 2, 12);
}
