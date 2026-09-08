// ── Punk Static ───────────────────────────────────────────────────────────────
// Aggressive TV disruption: horizontal RGB pixel tears, scanline burns,
// digital block corruption. Harder and more violent than VHS Static.

const _st = new WeakMap();

export const punkStaticParams = () => ({
    tears:  { base: 0.6, min: 0, max: 1,   mod: { source: "" } },
    rgb:    { base: 0.7, min: 0, max: 1,   mod: { source: "" } },
    blocks: { base: 0.4, min: 0, max: 1,   mod: { source: "" } },
    burn:   { base: 0.3, min: 0, max: 1,   mod: { source: "" } },
    hue:    { base: 0,   min: 0, max: 360, mod: { source: "" } },
    invert: { base: 0,   min: 0, max: 1, step: 1, mod: { source: "" } },
    speed:  { base: 1,   min: 0, max: 4,   mod: { source: "" } },
});

function lcg(s) { return (s * 1664525 + 1013904223) & 0xffffffff; }

export function drawPunkStatic(ctx, w, h, p, t, extra) {
    const sp  = extra?.spectrum ?? [];
    const bass = sp.length > 3 ? Math.min(1, (sp[1] + sp[2] + sp[3]) / 3 * 3) : 0;
    const mid  = sp.length > 20 ? Math.min(1, (sp[10] + sp[18]) / 2 * 3) : 0;

    const tears  = Math.min(1, (p.tears ?? 0.6) + bass * 0.4);
    const rgb    = p.rgb ?? 0.7;
    const blocks = Math.min(1, (p.blocks ?? 0.4) + mid * 0.3);
    const burn   = p.burn ?? 0.3;
    const hue    = p.hue ?? 0;
    const speed  = p.speed ?? 1;
    const doInvert = (p.invert ?? 0) > 0.5;

    let st = _st.get(ctx);
    if (!st) { st = { seed: 42, lastT: t, phase: 0 }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.phase += dt * speed * (1 + bass * 3);

    const ph = st.phase;
    let seed = st.seed = lcg(st.seed ^ (ph * 1000) | 0);

    ctx.clearRect(0, 0, w, h);

    // Dark base
    const baseL = 4 + burn * 15;
    ctx.fillStyle = `hsl(${hue},30%,${baseL}%)`;
    ctx.fillRect(0, 0, w, h);

    // Scanline burns — bright horizontal bands
    const numBurns = Math.floor(burn * 12 * (1 + bass * 3));
    for (let i = 0; i < numBurns; i++) {
        seed = lcg(seed);
        const y  = ((seed & 0xffff) / 0xffff * h) | 0;
        const bh = 1 + ((seed >> 16) & 7);
        const br = 50 + bass * 40;
        ctx.fillStyle = `hsl(${(hue + 20) % 360},90%,${br}%)`;
        ctx.fillRect(0, y, w, bh);
    }

    // Horizontal tears with RGB shift
    const numTears = Math.floor(tears * 20 * (1 + bass * 5));
    for (let i = 0; i < numTears; i++) {
        seed = lcg(seed);
        const y  = ((seed & 0xffff) / 0xffff * h) | 0;
        const th = 1 + ((seed >> 12) & 15);
        const tx = (Math.sin(ph * 3.7 + i * 1.3) * w * 0.15) | 0;

        if (rgb > 0.05) {
            const shift = (rgb * 20) | 0;
            // R channel
            ctx.fillStyle = `rgba(255,0,0,${0.4 + bass * 0.4})`;
            ctx.fillRect(tx - shift, y, w, th);
            // G channel
            ctx.fillStyle = `rgba(0,255,0,${0.4 + bass * 0.4})`;
            ctx.fillRect(tx, y, w, th);
            // B channel
            ctx.fillStyle = `rgba(0,0,255,${0.4 + bass * 0.4})`;
            ctx.fillRect(tx + shift, y, w, th);
        } else {
            ctx.fillStyle = `rgba(220,220,220,${0.5 + bass * 0.4})`;
            ctx.fillRect(tx, y, w, th);
        }
    }

    // Block corruption — rectangular glitch blocks
    const numBlocks = Math.floor(blocks * 12 * (1 + mid * 3));
    for (let i = 0; i < numBlocks; i++) {
        seed = lcg(seed);
        const bx = ((seed & 0xffff) / 0xffff * w) | 0;
        seed = lcg(seed);
        const by = ((seed & 0xffff) / 0xffff * h) | 0;
        const bw2 = 8 + ((seed >> 16) & 127);
        const bh2 = 2 + ((seed >> 8) & 31);
        seed = lcg(seed);
        const c1 = (seed >> 16) & 0xff;
        const c2 = (seed >> 8) & 0xff;
        const c3 = seed & 0xff;
        ctx.fillStyle = doInvert
            ? `rgb(${255-c1},${255-c2},${255-c3})`
            : `rgb(${c1},${c2},${c3})`;
        ctx.fillRect(bx, by, bw2, bh2);
    }

    if (doInvert) {
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
    }
}
