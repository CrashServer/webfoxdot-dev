// ── Nebula Dust ───────────────────────────────────────────────────────────────
// Hubble-palette gaseous nebula: large soft clouds layered with star particles.
// Bass expands the core; treble brightens filaments.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const nebulaDustParams = () => ({
    clouds:   { base: 6,    min: 2,  max: 12,  step: 1, mod: { source: "" } },
    stars:    { base: 400,  min: 50, max: 1500,step: 50,mod: { source: "" } },
    hue:      { base: 260,  min: 0,  max: 360,          mod: { source: "" } }, // primary cloud
    hue2:     { base: 20,   min: 0,  max: 360,          mod: { source: "" } }, // emission hue
    speed:    { base: 0.02, min: 0,  max: 0.2,          mod: { source: "" } }, // drift speed
    pulse:    { base: 0.4,  min: 0,  max: 1,            mod: { source: "" } },
    density:  { base: 0.5,  min: 0.1,max:1,             mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,  max: 1,            mod: { source: "" } },
    scale:    { base: 1.0,  min: 0.3,max: 2,            mod: { source: "" } },
    bgAlpha:  { base: 1.0,  min: 0,  max: 1,            mod: { source: "" } },
});

export function drawNebulaDust(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nClouds= Math.round(Math.max(2, Math.min(12, p.clouds ?? 6)));
    const nStars = Math.round(Math.max(50, Math.min(1500, p.stars ?? 400)));
    const hue    = p.hue ?? 260;
    const hue2   = p.hue2 ?? 20;
    const speed  = p.speed ?? 0.02;
    const pulse  = p.pulse ?? 0.4;
    const density= p.density ?? 0.5;
    const glow   = p.glow ?? 0.6;
    const scale  = p.scale ?? 1.0;
    const bgAlpha= p.bgAlpha ?? 1.0;

    let st = _st.get(ctx);
    if (!st) {
        const clouds = Array.from({ length: 12 }, (_, i) => ({
            x: 0.15 + Math.random() * 0.7,
            y: 0.15 + Math.random() * 0.7,
            rx: (0.15 + Math.random() * 0.3) * scale,
            ry: (0.1 + Math.random() * 0.2) * scale,
            rot: Math.random() * Math.PI,
            hOff: (Math.random() - 0.5) * 80,
            bright: 0.3 + Math.random() * 0.4,
            drift: (Math.random() - 0.5) * 0.01,
            driftY: (Math.random() - 0.5) * 0.007,
        }));
        const stars = Array.from({ length: 1500 }, () => ({
            x: Math.random(),
            y: Math.random(),
            r: 0.3 + Math.random() * 1.5,
            bright: 0.3 + Math.random() * 0.7,
            twinkle: Math.random() * TAU,
            twinkleSpeed: 0.5 + Math.random() * 3,
        }));
        st = { clouds, stars };
        _st.set(ctx, st);
    }

    // Background
    ctx.fillStyle = `rgba(0,0,5,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Draw clouds
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < nClouds; i++) {
        const c = st.clouds[i];
        c.rot += c.drift * speed;

        const cx2 = c.x * w;
        const cy2 = c.y * h;
        const rx  = c.rx * Math.min(w, h) * (1 + bass * pulse * 0.1);
        const ry  = c.ry * Math.min(w, h);
        const ch  = (hue + c.hOff + (i % 2 === 0 ? 0 : hue2 - hue)) % 360;
        const br  = c.bright * density * (0.7 + treble * 0.3);

        ctx.save();
        ctx.translate(cx2, cy2);
        ctx.rotate(c.rot);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
        grad.addColorStop(0,   `hsla(${ch},80%,${Math.round(br * 50)}%,${Math.min(1, br * 0.9)})`);
        grad.addColorStop(0.4, `hsla(${ch},70%,${Math.round(br * 35)}%,${Math.min(1, br * 0.5)})`);
        grad.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.scale(1, ry / rx);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    // Stars
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < nStars; i++) {
        const s = st.stars[i];
        const twinkle = 0.6 + 0.4 * Math.sin(s.twinkle + t * s.twinkleSpeed);
        const alpha = s.bright * twinkle * (0.6 + treble * 0.4);
        const r = s.r * (1 + bass * pulse * 0.5) * scale;

        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
        if (glow > 0.05 && s.bright > 0.7) {
            ctx.shadowBlur = r * 3 * glow;
            ctx.shadowColor = `hsl(${hue + 40},80%,90%)`;
        }
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, r, 0, TAU);
        ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
}
