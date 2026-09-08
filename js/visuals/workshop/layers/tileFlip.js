// ── Tile Flip ─────────────────────────────────────────────────────────────────
// Grid of tiles that flip (3-D rotation around Y-axis) triggered by audio or
// sequentially like a split-flap display.  Bass = burst flip; treble = hue.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function lcg(s) { return (s * 1664525 + 1013904223) & 0x7fffffff; }

export const tileFlipParams = () => ({
    cols:     { base: 8,    min: 3,  max: 20, step: 1, mod: { source: "" } },
    rows:     { base: 5,    min: 2,  max: 12, step: 1, mod: { source: "" } },
    speed:    { base: 3,    min: 0.5,max: 10,          mod: { source: "" } },
    gap:      { base: 3,    min: 0,  max: 10, step: 1, mod: { source: "" } },
    hue:      { base: 200,  min: 0,  max: 360,         mod: { source: "" } },
    hue2:     { base: 40,   min: 0,  max: 360,         mod: { source: "" } }, // back face hue
    glow:     { base: 0.4,  min: 0,  max: 1,           mod: { source: "" } },
    pulse:    { base: 0.6,  min: 0,  max: 1,           mod: { source: "" } },
    mode:     { base: 0,    min: 0,  max: 2,  step: 1, mod: { source: "" } }, // 0=wave 1=random 2=bass
    bgAlpha:  { base: 0.95, min: 0,  max: 1,           mod: { source: "" } },
});

export function drawTileFlip(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const cols  = Math.round(Math.max(3, Math.min(20, p.cols ?? 8)));
    const rows  = Math.round(Math.max(2, Math.min(12, p.rows ?? 5)));
    const speed = (p.speed ?? 3) * (1 + bass * (p.pulse ?? 0.6) * 0.5);
    const gap   = Math.max(0, p.gap ?? 3);
    const hue   = ((p.hue ?? 200) + treble * 60) % 360;
    const hue2  = p.hue2 ?? 40;
    const glow  = p.glow ?? 0.4;
    const mode  = Math.round(Math.max(0, Math.min(2, p.mode ?? 0)));
    const bgAlpha = p.bgAlpha ?? 0.95;

    const cellW = (w - gap * (cols + 1)) / cols;
    const cellH = (h - gap * (rows + 1)) / rows;
    const n     = cols * rows;

    let st = _st.get(ctx);
    if (!st || st.n !== n) {
        let seed = 7;
        const angles  = new Float32Array(n);
        const targets = new Float32Array(n);
        const delays  = new Float32Array(n).map((_, i) => {
            seed = lcg(seed);
            return (seed / 0x7fffffff) * 0.5;
        });
        st = { n, angles, targets, delays, lastBass: 0, seed, lastT: t };
        _st.set(ctx, st);
    }

    // Trigger flips based on mode
    if (mode === 0) {
        // Wave: each tile flips at a phase offset
        for (let i = 0; i < n; i++) {
            const col = i % cols, row = Math.floor(i / cols);
            const phase = (col + row) / (cols + rows);
            st.targets[i] = Math.PI * (0.5 + 0.5 * Math.sin(t * speed * 0.5 + phase * TAU));
        }
    } else if (mode === 1) {
        // Trigger random flips over time
        st.seed = lcg(st.seed);
        const ti = Math.floor((st.seed / 0x7fffffff) * n);
        if ((Math.floor(t * speed) % 1) < 0.1) {
            st.targets[ti] = st.angles[ti] < Math.PI * 0.5 ? Math.PI : 0;
        }
    } else {
        // Bass burst: flip random tiles
        if (bass > 0.6 && bass > st.lastBass + 0.15) {
            const nFlip = Math.ceil(bass * n * 0.3);
            for (let f = 0; f < nFlip; f++) {
                st.seed = lcg(st.seed);
                const ti = Math.floor((st.seed / 0x7fffffff) * n);
                st.targets[ti] = st.angles[ti] < Math.PI * 0.5 ? Math.PI : 0;
            }
        }
        st.lastBass = bass;
    }

    if (!st.lastT) st.lastT = t;
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    // Smooth angles toward targets
    for (let i = 0; i < n; i++) {
        const diff = st.targets[i] - st.angles[i];
        st.angles[i] += diff * Math.min(1, speed * dt * 4);
    }

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12;
        ctx.shadowColor = `hsl(${hue},100%,65%)`;
    }

    for (let i = 0; i < n; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x   = gap + col * (cellW + gap);
        const y   = gap + row * (cellH + gap);
        const ang = st.angles[i];

        // 3D flip via horizontal scale
        const cosA   = Math.cos(ang);
        const scaleX = Math.abs(cosA);
        const isFront = cosA >= 0;
        const faceHue = isFront ? hue : hue2;
        const bright  = 35 + treble * 25 + (isFront ? 10 : 0);

        ctx.save();
        ctx.translate(x + cellW / 2, y + cellH / 2);
        ctx.scale(scaleX, 1);
        ctx.fillStyle = `hsl(${faceHue},65%,${bright}%)`;
        ctx.fillRect(-cellW / 2, -cellH / 2, cellW, cellH);

        // Edge highlight on visible edge
        ctx.strokeStyle = `hsl(${faceHue},85%,${bright + 25}%)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(-cellW / 2, -cellH / 2, cellW, cellH);

        // Small stripe (split-flap style)
        ctx.fillStyle = `hsla(${faceHue},80%,${bright - 10}%,0.7)`;
        ctx.fillRect(-cellW / 2, -1, cellW, 2);

        ctx.restore();
    }

    ctx.shadowBlur = 0;
}
