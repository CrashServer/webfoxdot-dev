// ── Laser Show ────────────────────────────────────────────────────────────────
// Sweeping laser beams with intersection point sparks.  Beams reflect off
// virtual mirrors at the canvas edges.  Bass adds more beams; treble brightens.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const laserShowParams = () => ({
    beams:    { base: 4,    min: 1,  max: 12,  step: 1, mod: { source: "" } },
    speed:    { base: 0.3,  min: 0,  max: 2,            mod: { source: "" } },
    reflect:  { base: 3,    min: 0,  max: 6,   step: 1, mod: { source: "" } }, // bounces
    hue:      { base: 120,  min: 0,  max: 360,          mod: { source: "" } },
    hueRange: { base: 180,  min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.9,  min: 0,  max: 1,            mod: { source: "" } },
    thick:    { base: 1.5,  min: 0.3,max: 4,            mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    fanAngle: { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } }, // fan spread (0=single, 1=fan)
    dots:     { base: 1,    min: 0,  max: 1,  step: 1,  mod: { source: "" } }, // intersection dots
    bgAlpha:  { base: 0.85, min: 0,  max: 1,            mod: { source: "" } },
});

function traceBeam(x0, y0, dx, dy, w, h, bounces, ctx, hue, thick, glow) {
    let x = x0, y = y0, vx = dx, vy = dy;
    const dots = [];
    dots.push([x, y]);

    for (let b = 0; b < bounces; b++) {
        // Find intersection with walls
        let tMin = Infinity, face = -1;
        if (vx > 0) { const t2 = (w - x) / vx; if (t2 > 1e-6 && t2 < tMin) { tMin = t2; face = 0; } }
        if (vx < 0) { const t2 = -x / vx; if (t2 > 1e-6 && t2 < tMin) { tMin = t2; face = 1; } }
        if (vy > 0) { const t2 = (h - y) / vy; if (t2 > 1e-6 && t2 < tMin) { tMin = t2; face = 2; } }
        if (vy < 0) { const t2 = -y / vy; if (t2 > 1e-6 && t2 < tMin) { tMin = t2; face = 3; } }

        if (tMin === Infinity) break;
        const nx = x + vx * tMin, ny = y + vy * tMin;

        ctx.lineTo(nx, ny);
        dots.push([nx, ny]);
        x = nx; y = ny;
        if (face === 0 || face === 1) vx = -vx;
        else vy = -vy;
    }
    return dots;
}

export function drawLaserShow(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nBeams = Math.round(Math.max(1, Math.min(12, (p.beams ?? 4) + Math.floor(bass * (p.pulse ?? 0.5) * 3))));
    const speed  = p.speed ?? 0.3;
    const reflect= Math.round(Math.max(0, Math.min(6, p.reflect ?? 3)));
    const hue    = p.hue ?? 120;
    const hueR   = p.hueRange ?? 180;
    const glow   = p.glow ?? 0.9;
    const thick  = (p.thick ?? 1.5) * (1 + bass * 0.3);
    const fanAngle = p.fanAngle ?? 0;
    const showDots = (p.dots ?? 1) > 0.5;
    const bgAlpha  = p.bgAlpha ?? 0.85;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            beams: Array.from({ length: 12 }, (_, i) => ({
                ox: 0.5, oy: 0.5,
                baseAngle: (i / 12) * TAU,
                sweepSpeed: (0.5 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
                hOff: (i / 12) * hueR,
            })),
        };
        _st.set(ctx, st);
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = "round";
    const allDots = [];

    for (let b = 0; b < nBeams; b++) {
        const beam = st.beams[b];
        const angle = beam.baseAngle + t * speed * beam.sweepSpeed;
        const bHue  = (hue + beam.hOff) % 360;
        const alpha = 0.8 + treble * 0.2;

        if (glow > 0.05) {
            ctx.shadowBlur = glow * 15 * (1 + bass * 0.3);
            ctx.shadowColor = `hsl(${bHue},100%,70%)`;
        }

        const origins = fanAngle > 0.01
            ? [angle - fanAngle, angle, angle + fanAngle].map(a => a)
            : [angle];

        // Batch all origins of this beam into one stroke (same style = one GPU shadow pass)
        ctx.strokeStyle = `hsla(${bHue},100%,${60 + treble * 25}%,${alpha})`;
        ctx.lineWidth = thick;
        ctx.beginPath();
        for (const a of origins) {
            const dx = Math.cos(a), dy = Math.sin(a);
            const ox = (beam.ox) * w, oy = (beam.oy) * h;
            ctx.moveTo(ox, oy);
            const dots = traceBeam(ox, oy, dx, dy, w, h, reflect, ctx, bHue, thick, glow);
            allDots.push(...dots.slice(1).map(d => ({ x: d[0], y: d[1], hue: bHue })));
        }
        ctx.stroke();
    }

    // Intersection dots — group by hue so shadowBlur is set once per beam color
    if (showDots && glow > 0.05) {
        const dotsByHue = new Map();
        for (const dot of allDots) {
            if (!dotsByHue.has(dot.hue)) dotsByHue.set(dot.hue, []);
            dotsByHue.get(dot.hue).push(dot);
        }
        const dotR = thick * (1.5 + bass * 2);
        ctx.shadowBlur = glow * 20 * (1 + bass * 0.5);
        for (const [dHue, dots] of dotsByHue) {
            ctx.shadowColor = `hsl(${dHue},100%,90%)`;
            ctx.fillStyle   = `hsl(${dHue},100%,90%)`;
            ctx.beginPath();
            for (const dot of dots) { ctx.moveTo(dot.x + dotR, dot.y); ctx.arc(dot.x, dot.y, dotR, 0, TAU); }
            ctx.fill();
        }
    }

    ctx.shadowBlur = 0;
    ctx.lineCap = "butt";
}
