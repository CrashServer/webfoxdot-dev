// ── Radar Sweep ───────────────────────────────────────────────────────────────
// Circular radar / sonar sweep with audio-reactive blip echoes.
// Bass spawns new blips on the sweep line; treble brightens the sweep phosphor.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const radarSweepParams = () => ({
    speed:    { base: 0.4,  min: 0.05,max: 4,             mod: { source: "" } }, // rotations/sec
    rings:    { base: 5,    min: 1,   max: 10,  step: 1,  mod: { source: "" } },
    hue:      { base: 120,  min: 0,   max: 360,           mod: { source: "" } },
    glow:     { base: 0.8,  min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    blipDecay:{ base: 0.98, min: 0.8, max: 0.999,         mod: { source: "" } }, // blip fade per frame
    crosshair:{ base: 1,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // show crosshairs
    bgAlpha:  { base: 0.9,  min: 0,   max: 1,             mod: { source: "" } },
    sweepLen: { base: 0.7,  min: 0.1, max: 1,             mod: { source: "" } }, // sweep arc length (0..1)
});

export function drawRadarSweep(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const speed    = p.speed ?? 0.4;
    const nRings   = Math.round(Math.max(1, Math.min(10, p.rings ?? 5)));
    const hue      = p.hue ?? 120;
    const glow     = p.glow ?? 0.8;
    const pulse    = p.pulse ?? 0.6;
    const blipDcy  = p.blipDecay ?? 0.98;
    const crosshair= (p.crosshair ?? 1) > 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.9;
    const sweepLen = p.sweepLen ?? 0.7;

    let st = _st.get(ctx);
    if (!st) {
        st = { angle: 0, blips: [], prevBass: 0, lcg: 3333, lastT: t };
        _st.set(ctx, st);
    }

    const rand = () => { st.lcg = (st.lcg * 1664525 + 1013904223) & 0x7fffffff; return st.lcg / 0x7fffffff; };

    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.angle = (st.angle + speed * dt * TAU) % TAU;

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.44 * (1 + bass * pulse * 0.05);

    // Background
    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 10;
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
    }

    // Rings
    ctx.strokeStyle = `hsla(${hue},80%,35%,0.6)`;
    ctx.lineWidth = 0.5;
    for (let r = 1; r <= nRings; r++) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * r / nRings, 0, TAU);
        ctx.stroke();
    }

    // Crosshair
    if (crosshair) {
        ctx.strokeStyle = `hsla(${hue},70%,30%,0.5)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
        ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
        ctx.stroke();
    }

    // Sweep gradient
    const sweepArc = sweepLen * TAU;
    for (let i = 0; i < 32; i++) {
        const frac = i / 32;
        const a    = st.angle - frac * sweepArc;
        const alpha= (1 - frac) * (0.3 + treble * 0.2) * glow;
        const ag = ctx.createConicalGradient
            ? null // not widely supported
            : null;
        // Fallback: draw thin wedge slices
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, a - sweepArc / 32, a);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue},90%,55%,${alpha})`;
        ctx.fill();
    }

    // Sweep leading edge beam
    ctx.shadowBlur = glow * 20 * (1 + treble * 0.5);
    ctx.shadowColor = `hsl(${hue},100%,80%)`;
    ctx.strokeStyle = `hsl(${hue},100%,${70 + treble * 25}%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(st.angle) * R, cy + Math.sin(st.angle) * R);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Spawn blips on bass hit
    const beatHit = bass > 0.5 && st.prevBass < 0.4;
    st.prevBass = bass;
    if (beatHit || (bass > 0.7 && rand() < 0.3)) {
        const n = Math.ceil(rand() * 3 + bass * 3);
        for (let i = 0; i < n; i++) {
            const br = (0.2 + rand() * 0.8) * R;
            const ba = st.angle + (rand() - 0.5) * 0.5;
            st.blips.push({
                x: cx + Math.cos(ba) * br,
                y: cy + Math.sin(ba) * br,
                r: 2 + rand() * 4 + bass * 3,
                alpha: 1,
                h: (hue + (rand() - 0.5) * 60) % 360,
            });
        }
    }

    // Draw and decay blips
    for (let i = st.blips.length - 1; i >= 0; i--) {
        const b = st.blips[i];
        b.alpha *= blipDcy;
        if (b.alpha < 0.02) { st.blips.splice(i, 1); continue; }
        ctx.shadowBlur = glow * 12 * b.alpha;
        ctx.shadowColor = `hsl(${b.h},100%,70%)`;
        ctx.fillStyle = `hsla(${b.h},100%,70%,${b.alpha})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * b.alpha + 1, 0, TAU);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Outer ring border
    ctx.strokeStyle = `hsla(${hue},80%,40%,0.7)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
}
