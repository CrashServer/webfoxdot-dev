// ── Blood Splatter ────────────────────────────────────────────────────────────
// Organic red splatter patterns — audio-reactive drops, trails, pools.
// Bass → new splatter bursts. Treble → spray texture.

const _st = new WeakMap();

export const bloodSplatterParams = () => ({
    hue:     { base: 0,   min: -40, max: 60,  mod: { source: "" } },
    size:    { base: 0.5, min: 0.1, max: 1,   mod: { source: "" } },
    density: { base: 0.5, min: 0.1, max: 1,   mod: { source: "" } },
    drip:    { base: 0.6, min: 0,   max: 1,   mod: { source: "" } },
    decay:   { base: 0.3, min: 0,   max: 1,   mod: { source: "" } },
    bright:  { base: 0.4, min: 0,   max: 1,   mod: { source: "" } },
    spray:   { base: 0.5, min: 0,   max: 1,   mod: { source: "" } },
});

function circle(ctx, x, y, r) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill();
}

export function drawBloodSplatter(ctx, w, h, p, t, extra) {
    const sp   = extra?.spectrum ?? [];
    const bass = sp.length > 3 ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 3.5) : 0;
    const treble = sp.length > 40 ? Math.min(1, (sp[30] + sp[40]) / 2 * 3) : 0;

    const hue     = p.hue ?? 0;
    const size    = p.size ?? 0.5;
    const density = p.density ?? 0.5;
    const drip    = p.drip ?? 0.6;
    const decay   = p.decay ?? 0.3;
    const bright  = p.bright ?? 0.4;
    const spray   = p.spray ?? 0.5;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            drops: [],    // {x, y, r, vy, life, maxLife}
            lastBass: 0,
            lastT: t,
        };
        _st.set(ctx, st);
    }

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;

    // Dark red background accumulation
    const fadeAlpha = decay * dt * 0.6;
    ctx.fillStyle = `rgba(2,0,0,${Math.min(1, fadeAlpha + 0.02)})`;
    ctx.fillRect(0, 0, w, h);

    const L = 20 + bright * 35;
    const baseColor = `hsl(${hue},90%,${L}%)`;
    const brightColor = `hsl(${hue + 10},100%,${L + 25}%)`;

    // Beat-triggered splatter burst
    if (bass > 0.5 && st.lastBass < 0.5) {
        const count = Math.floor(density * 8 * (1 + bass * 4));
        for (let i = 0; i < count; i++) {
            const ax = Math.random() * w;
            const ay = Math.random() * h * 0.7;
            const maxR = size * w * 0.04 * (0.5 + Math.random());
            // Main blob
            st.drops.push({ x: ax, y: ay, r: maxR, vy: 0, life: 1, maxLife: 1 });
            // Spray droplets
            const nSpray = Math.floor(spray * 12);
            for (let j = 0; j < nSpray; j++) {
                const angle = Math.random() * Math.PI * 2;
                const dist  = maxR * (1.5 + Math.random() * 3);
                st.drops.push({
                    x: ax + Math.cos(angle) * dist,
                    y: ay + Math.sin(angle) * dist,
                    r: maxR * 0.15 * Math.random(),
                    vy: 0, life: 1, maxLife: 0.6 + Math.random() * 0.4,
                });
            }
        }
    }
    st.lastBass = bass;

    // Treble → additional fine spray
    if (treble > 0.4) {
        const ns = Math.floor(spray * treble * 8);
        for (let i = 0; i < ns; i++) {
            st.drops.push({
                x: Math.random() * w,
                y: Math.random() * h * 0.5,
                r: size * w * 0.006 * Math.random(),
                vy: 0, life: 0.7, maxLife: 0.5,
            });
        }
    }

    // Draw + update drops
    ctx.fillStyle = baseColor;
    const surviving = [];
    for (const d of st.drops) {
        d.vy += drip * dt * h * 0.6;
        d.y  += d.vy * dt;
        d.life -= dt * (0.15 + decay * 0.3);

        if (d.life <= 0 || d.y > h + d.r * 2) continue;
        surviving.push(d);

        const alpha = Math.min(1, d.life / d.maxLife * 1.5);
        ctx.globalAlpha = alpha;

        // Highlight
        ctx.fillStyle = d.r < size * w * 0.01 ? brightColor : baseColor;
        circle(ctx, d.x, d.y, d.r);

        // Drip trail
        if (drip > 0.2 && d.r > size * w * 0.008 && d.vy > h * 0.01) {
            const trailLen = d.r * 2 * drip;
            ctx.fillRect(d.x - d.r * 0.3, d.y - trailLen, d.r * 0.6, trailLen);
        }
    }
    ctx.globalAlpha = 1;

    // Cap drop count
    if (surviving.length > 800) surviving.splice(0, surviving.length - 800);
    st.drops = surviving;
}
