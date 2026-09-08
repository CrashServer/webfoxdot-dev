// ── Cube Field ────────────────────────────────────────────────────────────────
// Isometric-perspective grid of extruded 3D cubes with audio-reactive heights.
// Bass drives the height peaks; individual cubes pulse with spectrum bands.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const cubeFieldParams = () => ({
    cols:     { base: 12,   min: 4,   max: 24,  step: 1,  mod: { source: "" } },
    rows:     { base: 8,    min: 4,   max: 16,  step: 1,  step: 1, mod: { source: "" } },
    maxH:     { base: 0.4,  min: 0.05,max: 0.8,           mod: { source: "" } }, // max height fraction
    hue:      { base: 200,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 120,  min: 0,   max: 360,           mod: { source: "" } },
    pulse:    { base: 0.7,  min: 0,   max: 1,             mod: { source: "" } },
    glow:     { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
    tilt:     { base: 0.45, min: 0.1, max: 0.7,           mod: { source: "" } }, // iso tilt
    gap:      { base: 0.08, min: 0,   max: 0.3,           mod: { source: "" } }, // gap fraction
    bgAlpha:  { base: 0.9,  min: 0,   max: 1,             mod: { source: "" } },
    speed:    { base: 0.5,  min: 0,   max: 4,             mod: { source: "" } }, // wave speed
});

export function drawCubeField(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const cols   = Math.round(Math.max(4, Math.min(24, p.cols ?? 12)));
    const rows   = Math.round(Math.max(4, Math.min(16, p.rows ?? 8)));
    const maxH   = (p.maxH ?? 0.4) * h;
    const hue    = p.hue ?? 200;
    const hueR   = p.hueRange ?? 120;
    const pulse  = p.pulse ?? 0.7;
    const glow   = p.glow ?? 0.4;
    const tilt   = p.tilt ?? 0.45;
    const gap    = p.gap ?? 0.08;
    const bgAlpha= p.bgAlpha ?? 0.9;
    const speed  = p.speed ?? 0.5;

    ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
    ctx.fillRect(0, 0, w, h);

    const cw = w / cols;
    const rowH = cw * tilt;
    const totalGridH = rowH * rows;
    const startX = 0;
    const startY = (h - totalGridH) / 2 + totalGridH;

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 12;
    }

    // Draw back to front (painter's algorithm)
    for (let r = rows - 1; r >= 0; r--) {
        for (let c = 0; c < cols; c++) {
            const specBin = Math.min(63, Math.floor((c / cols) * 64));
            const specVal = spectrum ? spectrum[specBin] : 0;
            const wave = Math.sin((c / cols + r / rows) * TAU + t * speed) * 0.3 + 0.7;
            const cubeH = specVal * pulse * maxH * wave + bass * pulse * maxH * 0.3;

            const gapPx = cw * gap;
            const bw = cw - gapPx;

            // Base position (iso projection)
            const bx = startX + c * cw;
            const by = startY - r * rowH;

            // Height of cube in screen space
            const sh = cubeH;

            const h1 = (hue + (c / cols + r / rows) * hueR) % 360;
            const h2 = (h1 + 20) % 360;
            const h3 = (h1 - 20 + 360) % 360;
            const bright = 45 + treble * 20;

            // Top face
            ctx.fillStyle = `hsl(${h1},80%,${bright + 20}%)`;
            ctx.shadowColor = `hsl(${h1},100%,70%)`;
            ctx.beginPath();
            ctx.moveTo(bx + gapPx, by - sh);
            ctx.lineTo(bx + bw,    by - sh - rowH * (1 - gap));
            ctx.lineTo(bx + bw + cw * (1 - gap * 2) * 0, by - sh);
            ctx.lineTo(bx + gapPx * 2, by - sh + rowH * (1 - gap));
            // Simplified: rectangle top + parallelogram sides
            ctx.fillRect(bx + gapPx, by - sh - rowH / 2, bw, rowH * (1 - gap));

            // Front face
            if (sh > 0.5) {
                ctx.fillStyle = `hsl(${h2},75%,${bright}%)`;
                ctx.fillRect(bx + gapPx, by - sh, bw, sh);

                // Right face (darker)
                ctx.fillStyle = `hsl(${h3},60%,${bright - 10}%)`;
                ctx.fillRect(bx + bw, by - sh, cw * gap, sh);
            }
        }
    }
    ctx.shadowBlur = 0;
}
