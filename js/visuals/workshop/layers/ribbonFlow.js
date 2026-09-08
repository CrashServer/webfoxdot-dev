// ── Ribbon Flow ───────────────────────────────────────────────────────────────
// 3D ribbon/tape trails flowing through space.  Each ribbon follows a Lissajous
// path with a width that pulses to audio.  Bass = width pulse; treble = speed.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function project3(x, y, z, fov, cx, cy, scale) {
    const d = fov / (fov + z + 3);
    return [cx + x * d * scale, cy + y * d * scale];
}

export const ribbonFlowParams = () => ({
    ribbons:  { base: 4,    min: 1,  max: 8,   step: 1, mod: { source: "" } },
    pts:      { base: 80,   min: 20, max: 200, step:10, mod: { source: "" } }, // pts per ribbon
    width:    { base: 12,   min: 2,  max: 40,           mod: { source: "" } },
    speed:    { base: 0.3,  min: 0,  max: 2,            mod: { source: "" } },
    twist:    { base: 2.0,  min: 0,  max: 8,            mod: { source: "" } }, // ribbon twist rate
    hue:      { base: 280,  min: 0,  max: 360,          mod: { source: "" } },
    hueRange: { base: 200,  min: 0,  max: 360,          mod: { source: "" } },
    glow:     { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    pulse:    { base: 0.5,  min: 0,  max: 1,            mod: { source: "" } },
    fov:      { base: 4,    min: 1,  max: 10,           mod: { source: "" } },
    rotX:     { base: 0.1,  min: -1, max: 1,            mod: { source: "" } },
    rotY:     { base: 0.2,  min: -1, max: 1,            mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,  max: 1,            mod: { source: "" } },
});

export function drawRibbonFlow(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const nRibbons = Math.round(Math.max(1, Math.min(8, p.ribbons ?? 4)));
    const nPts  = Math.round(Math.max(20, Math.min(200, p.pts ?? 80)));
    const width = (p.width ?? 12) * (1 + bass * (p.pulse ?? 0.5) * 0.5);
    const speed = (p.speed ?? 0.3) * (1 + treble * 0.3);
    const twist = p.twist ?? 2.0;
    const hue   = p.hue ?? 280;
    const hueR  = p.hueRange ?? 200;
    const glow  = p.glow ?? 0.5;
    const fov   = p.fov ?? 4;
    const bgAlpha = p.bgAlpha ?? 0;

    let st = _st.get(ctx);
    if (!st) {
        st = {
            rx: 0, ry: 0, lastT: t,
            ribbonDefs: Array.from({ length: 8 }, (_, i) => ({
                fx: 1 + (i % 3), fy: 1 + Math.floor(i / 3),
                fz: 0.5 + i * 0.3,
                phX: (i / 8) * TAU, phY: (i / 8) * TAU * 0.7,
                hOff: (i / 8) * hueR,
            })),
        };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rx += (p.rotX ?? 0.1) * dt;
    st.ry += (p.rotY ?? 0.2) * dt;

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    const cx = w / 2, cy = h / 2;
    const scale = Math.min(w, h) * 0.3;
    const cosRx = Math.cos(st.rx), sinRx = Math.sin(st.rx);
    const cosRy = Math.cos(st.ry), sinRy = Math.sin(st.ry);

    if (glow > 0.05) ctx.shadowBlur = glow * 12 * (1 + treble * 0.3);

    for (let r = 0; r < nRibbons; r++) {
        const def = st.ribbonDefs[r];
        const ch  = (hue + def.hOff) % 360;
        ctx.shadowColor = `hsl(${ch},100%,70%)`;

        // Build spine points
        const spine = [];
        for (let i = 0; i <= nPts; i++) {
            const u = (i / nPts) * TAU;
            const T = t * speed;
            const x0 = Math.sin(def.fx * u + def.phX + T);
            const y0 = Math.sin(def.fy * u + def.phY + T * 0.7);
            const z0 = Math.cos(def.fz * u + T * 0.5);
            // Rotate X
            const y1 = cosRx * y0 - sinRx * z0;
            const z1 = sinRx * y0 + cosRx * z0;
            // Rotate Y
            const x2 = cosRy * x0 + sinRy * z1;
            const z2 = -sinRy * x0 + cosRy * z1;
            const [sx, sy] = project3(x2, y1, z2, fov, cx, cy, scale);
            spine.push({ sx, sy, u, z: z2 });
        }

        // Draw ribbon as filled quads (two offset paths)
        ctx.globalAlpha = 0.7 + treble * 0.3;
        for (let i = 0; i < spine.length - 1; i++) {
            const a = spine[i], b = spine[i + 1];
            const nx = -(b.sy - a.sy), ny = b.sx - a.sx;
            const nl = Math.sqrt(nx*nx + ny*ny) + 1e-6;
            const tw = Math.sin(a.u * twist) * 0.5 + 0.5;
            const hw = width * (0.3 + tw * 0.7) * (1 + (a.z + 1) * 0.2);
            const ox = nx / nl * hw, oy = ny / nl * hw;

            const frac = i / spine.length;
            const alpha = Math.sin(frac * Math.PI) * 0.8;
            ctx.fillStyle = `hsla(${ch},85%,${50 + treble * 20}%,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.sx + ox, a.sy + oy);
            ctx.lineTo(b.sx + ox, b.sy + oy);
            ctx.lineTo(b.sx - ox, b.sy - oy);
            ctx.lineTo(a.sx - ox, a.sy - oy);
            ctx.closePath();
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}
