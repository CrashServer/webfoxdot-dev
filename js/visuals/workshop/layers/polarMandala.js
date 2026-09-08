// ── Polar Mandala ─────────────────────────────────────────────────────────────
// N-fold symmetric pattern in polar coordinates: a rose curve
// r = cos(petals/2 * θ) with concentric rings and radial dividers, all
// assembled via rotational symmetry.  Ported from the native PolarMandala
// layer.  Audio: bass pulses the outermost ring; treble brightens the glow.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const polarMandalaParams = () => ({
    symmetry: { base: 6,    min: 2,   max: 16,  step: 1,  mod: { source: "" } }, // N-fold
    petals:   { base: 6,    min: 1,   max: 16,  step: 1,  mod: { source: "" } }, // rose-curve order
    rings:    { base: 5,    min: 1,   max: 12,  step: 1,  mod: { source: "" } }, // concentric circles
    outerR:   { base: 0.42, min: 0.1, max: 0.5,           mod: { source: "" } }, // max radius (0..0.5 of min(w,h))
    rotSpeed: { base: 0.08, min: -2,  max: 2,             mod: { source: "" } },
    hue:      { base: 260,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 120,  min: 0,   max: 360,           mod: { source: "" } },
    sat:      { base: 85,   min: 0,   max: 100,           mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 1.2,  min: 0.3, max: 5,             mod: { source: "" } },
    pulse:    { base: 0.35, min: 0,   max: 1,             mod: { source: "" } },
    fill:     { base: 0,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // fill petals
    speed:    { base: 0.5,  min: -4,  max: 4,             mod: { source: "" } }, // hue cycle speed
});

export function drawPolarMandala(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const N       = Math.round(Math.max(2, Math.min(16, p.symmetry ?? 6)));
    const petals  = Math.round(Math.max(1, Math.min(16, p.petals ?? 6)));
    const rings   = Math.round(Math.max(1, Math.min(12, p.rings ?? 5)));
    const outerR  = (p.outerR ?? 0.42) * Math.min(w, h) * (1 + bass * (p.pulse ?? 0.35) * 0.18);
    const hue0    = ((p.hue ?? 260) + t * (p.speed ?? 0.5) * 10) % 360;
    const hueR    = p.hueRange ?? 120;
    const sat     = p.sat ?? 85;
    const glow    = p.glow ?? 0.6;
    const thick   = p.thick ?? 1.2;
    const doFill  = (p.fill ?? 0) > 0.5;

    let st = _st.get(ctx);
    if (!st) { st = { rot: 0, lastT: t }; _st.set(ctx, st); }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rot += (p.rotSpeed ?? 0.08) * dt * (1 + treble * 0.2);

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);

    const glowPx  = glow * 10 * (1 + bass * 0.4);
    const ROSE_PTS = 300; // points per rose petal arc

    ctx.shadowBlur = glowPx;
    ctx.lineWidth = thick;

    // Draw N rotational copies
    for (let seg = 0; seg < N; seg++) {
        ctx.save();
        ctx.rotate(st.rot + seg * TAU / N);

        // ── Rose curve ──────────────────────────────────────────────────────
        const roseH = (hue0 + seg * hueR / N) % 360;
        ctx.shadowColor = `hsl(${roseH},100%,65%)`;

        if (doFill) {
            ctx.fillStyle = `hsla(${roseH},${sat}%,45%,0.35)`;
            ctx.beginPath();
            for (let i = 0; i <= ROSE_PTS; i++) {
                const th = (i / ROSE_PTS) * TAU;
                const r  = outerR * Math.abs(Math.cos(petals * 0.5 * th));
                const x2 = r * Math.cos(th), y2 = r * Math.sin(th);
                i === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
            }
            ctx.fill();
        }

        ctx.strokeStyle = `hsl(${roseH},${sat}%,${60 + treble * 20}%)`;
        ctx.beginPath();
        for (let i = 0; i <= ROSE_PTS; i++) {
            const th = (i / ROSE_PTS) * TAU;
            const r  = outerR * Math.abs(Math.cos(petals * 0.5 * th));
            const x2 = r * Math.cos(th), y2 = r * Math.sin(th);
            i === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        ctx.restore();
    }

    // ── Concentric rings ──────────────────────────────────────────────────
    for (let ring = 1; ring <= rings; ring++) {
        const frac = ring / rings;
        const rr   = outerR * frac;
        const h2   = (hue0 + frac * hueR) % 360;
        const alpha = 0.3 + (1 - frac) * 0.5;
        ctx.strokeStyle = `hsla(${h2},${sat}%,60%,${alpha})`;
        ctx.shadowColor = `hsl(${h2},100%,65%)`;
        ctx.shadowBlur = glowPx * 0.5;
        ctx.lineWidth = thick * (1 - frac * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.stroke();
    }

    // ── Radial spokes ─────────────────────────────────────────────────────
    ctx.save();
    ctx.rotate(st.rot * 0.5);
    ctx.shadowBlur = glowPx * 0.3;
    const spokeH = (hue0 + 60) % 360;
    ctx.strokeStyle = `hsla(${spokeH},${sat}%,50%,0.4)`;
    ctx.lineWidth = thick * 0.5;
    ctx.beginPath();
    for (let sp = 0; sp < N * 2; sp++) {
        const a = sp * TAU / (N * 2);
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    }
    ctx.stroke();
    ctx.restore();

    // ── Centre dot ────────────────────────────────────────────────────────
    ctx.shadowBlur = glowPx * 2;
    ctx.shadowColor = `hsl(${hue0},100%,80%)`;
    ctx.fillStyle = `hsl(${hue0},90%,80%)`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, outerR * 0.025), 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}
