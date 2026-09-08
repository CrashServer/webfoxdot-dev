// ── Flower of Life ────────────────────────────────────────────────────────────
// Sacred-geometry pattern: overlapping circles on a triangular grid — the
// Flower of Life, Seed of Life (inner ring only), or Metatron's Cube (adds
// straight lines connecting all circle centres).  Rotates slowly and breathes
// on the beat.  Audio: bass pulses the radius; treble brightens the glow.

const _st = new WeakMap();
const TAU = Math.PI * 2;
const SQ3H = Math.sqrt(3) / 2; // √3/2

// Pre-build hex-grid circle centres for `rings` rings (normalised, radius=1)
function buildCentres(rings) {
    const cs = [[0, 0]];
    // Six direction unit vectors (hex grid, 60° apart)
    const dirs = [
        [1, 0], [0.5, SQ3H], [-0.5, SQ3H],
        [-1, 0], [-0.5, -SQ3H], [0.5, -SQ3H],
    ];
    for (let ring = 1; ring <= rings; ring++) {
        // Start at `ring` steps in direction 4 (lower-left)
        let [x, y] = [dirs[4][0] * ring, dirs[4][1] * ring];
        for (let d = 0; d < 6; d++) {
            for (let step = 0; step < ring; step++) {
                cs.push([x, y]);
                x += dirs[d][0]; y += dirs[d][1];
            }
        }
    }
    return cs;
}

export const flowerOfLifeParams = () => ({
    rings:    { base: 2,    min: 0,   max: 5,   step: 1,  mod: { source: "" } }, // 0=seed(1), 1=flower(7), 2=full
    mode:     { base: 0,    min: 0,   max: 1,   step: 1,  mod: { source: "" } }, // 0=circles, 1=+metatron lines
    scale:    { base: 1.0,  min: 0.2, max: 3,             mod: { source: "" } },
    rotSpeed: { base: 0.04, min: -1,  max: 1,             mod: { source: "" } },
    hue:      { base: 180,  min: 0,   max: 360,           mod: { source: "" } },
    sat:      { base: 75,   min: 0,   max: 100,           mod: { source: "" } },
    glow:     { base: 0.5,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 1.5,  min: 0.5, max: 6,             mod: { source: "" } },
    pulse:    { base: 0.25, min: 0,   max: 1,             mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,   max: 1,             mod: { source: "" } }, // background fill
});

export function drawFlowerOfLife(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const rings    = Math.round(Math.max(0, Math.min(5, p.rings ?? 2)));
    const mode     = Math.round(Math.max(0, Math.min(1, p.mode ?? 0)));
    const scale    = (p.scale ?? 1.0) * (1 + bass * (p.pulse ?? 0.25) * 0.2);
    const hue      = p.hue ?? 180;
    const sat      = p.sat ?? 75;
    const glow     = p.glow ?? 0.5;
    const thick    = p.thick ?? 1.5;
    const bgAlpha  = p.bgAlpha ?? 0;

    let st = _st.get(ctx);
    if (!st || st.rings !== rings) {
        st = { rings, centres: buildCentres(rings), rot: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rot += (p.rotSpeed ?? 0.04) * dt * (1 + treble * 0.3);

    const cx   = w / 2, cy = h / 2;
    const R    = Math.min(w, h) * 0.12 * scale; // circle radius (px)
    const rot  = st.rot;
    const cs   = st.centres;

    // Background
    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    const glowPx = glow * 8 * (1 + bass * 0.5);
    const alpha  = 0.6 + treble * 0.35;

    // Glow layer (draw arcs twice: first at larger line width + low alpha)
    if (glow > 0.05) {
        ctx.save();
        ctx.globalAlpha = glow * 0.2;
        ctx.lineWidth = thick * 3;
        ctx.strokeStyle = `hsl(${hue},${sat}%,80%)`;
        ctx.shadowBlur = glowPx * 2;
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
        for (const [ox, oy] of cs) {
            ctx.beginPath();
            ctx.arc(ox * R, oy * R, R, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Main circles
    ctx.globalAlpha = alpha;
    ctx.lineWidth = thick;
    ctx.shadowBlur = glowPx;
    ctx.shadowColor = `hsl(${hue},100%,70%)`;

    for (let i = 0; i < cs.length; i++) {
        const [ox, oy] = cs[i];
        // Colour varies radially
        const dist = Math.sqrt(ox*ox + oy*oy);
        const h2   = (hue + dist * 15) % 360;
        ctx.strokeStyle = `hsl(${h2},${sat}%,${60 + treble * 20}%)`;
        ctx.beginPath();
        ctx.arc(ox * R, oy * R, R, 0, TAU);
        ctx.stroke();
    }

    // Metatron's Cube: straight lines connecting every pair of centres
    if (mode === 1) {
        ctx.save();
        ctx.globalAlpha = 0.35 + bass * 0.15;
        ctx.lineWidth = thick * 0.6;
        ctx.strokeStyle = `hsl(${(hue+120)%360},${sat}%,65%)`;
        ctx.shadowBlur = glowPx * 0.5;
        ctx.shadowColor = `hsl(${(hue+120)%360},100%,70%)`;
        ctx.beginPath();
        for (let a = 0; a < cs.length; a++) {
            for (let b = a + 1; b < cs.length; b++) {
                ctx.moveTo(cs[a][0] * R, cs[a][1] * R);
                ctx.lineTo(cs[b][0] * R, cs[b][1] * R);
            }
        }
        ctx.stroke();
        ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
}
