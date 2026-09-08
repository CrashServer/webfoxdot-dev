// ── Möbius Strip ─────────────────────────────────────────────────────────────
// Classic one-sided parametric surface: a strip given a half-twist before its
// ends are joined. The `twist` param generalises this — integer half-turns give
// non-orientable surfaces; odd values produce a one-sided strip, even values
// produce orientable two-sided bands. Rendered as depth-sorted painter's quads.

const _st = new WeakMap();
const TAU = Math.PI * 2;

export const mobiusStripParams = () => ({
    twist:    { base: 1,   min: 0,   max: 6,   step: 1,  mod: { source: "" } }, // half-turns (1 = Möbius)
    width:    { base: 0.4, min: 0.05,max: 1.2,           mod: { source: "" } }, // strip width
    R:        { base: 1.0, min: 0.3, max: 2,             mod: { source: "" } }, // major radius
    uSegs:    { base: 80,  min: 24,  max: 200, step: 8,  mod: { source: "" } }, // segments along loop
    vSegs:    { base: 12,  min: 4,   max: 30,  step: 1,  mod: { source: "" } }, // segments across width
    speedX:   { base: 0.2, min: -2,  max: 2,             mod: { source: "" } },
    speedY:   { base: 0.35,min: -2,  max: 2,             mod: { source: "" } },
    hue:      { base: 30,  min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 160, min: 0,   max: 360,           mod: { source: "" } },
    glow:     { base: 0.3, min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.25,min: 0,   max: 1,             mod: { source: "" } },
});

export function drawMobiusStrip(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*2.5) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*2.5) : 0;

    const twist  = Math.round(Math.max(0, p.twist ?? 1));
    const W      = (p.width  ?? 0.4) * (1 + bass * (p.pulse ?? 0.25) * 0.4);
    const R      = p.R ?? 1.0;
    const uS     = Math.round(Math.max(24, Math.min(200, p.uSegs ?? 80)));
    const vS     = Math.round(Math.max(4,  Math.min(30,  p.vSegs ?? 12)));
    const hue    = p.hue ?? 30;
    const hueR   = p.hueRange ?? 160;
    const glow   = p.glow ?? 0.3;

    let st = _st.get(ctx);
    if (!st) { st = { rx: 0, ry: 0 }; _st.set(ctx, st); }
    st.rx += ((p.speedX ?? 0.2) + treble * 0.1) / 60;
    st.ry += (p.speedY ?? 0.35) / 60;

    const crx = Math.cos(st.rx), srx = Math.sin(st.rx);
    const cry = Math.cos(st.ry), sry = Math.sin(st.ry);
    const scale = Math.min(w, h) * 0.27;
    const ox = w / 2, oy = h / 2;

    const proj = (x3, y3, z3) => {
        const x1 =  x3 * cry + z3 * sry;
        const z1 = -x3 * sry + z3 * cry;
        const y2 =  y3 * crx - z1 * srx;
        const z2 =  y3 * srx + z1 * crx;
        const zv = z2 + 4;
        const sp = scale / Math.max(0.5, zv);
        return [ox + x1 * sp, oy - y2 * sp, z2];
    };

    // Build vertex grid
    const rows = uS + 1, cols = vS + 1;
    const verts = new Array(rows * cols);
    for (let ui = 0; ui < rows; ui++) {
        const u   = (ui / uS) * TAU;
        const cu  = Math.cos(u), su = Math.sin(u);
        for (let vi = 0; vi < cols; vi++) {
            const v = (vi / vS - 0.5) * W; // -W/2..W/2
            const alpha = u * twist / 2;    // half-twist angle along the loop
            const ca  = Math.cos(alpha), sa = Math.sin(alpha);
            // Local frame: radial (cu,su,0) and normal (0,0,1) twisted
            const x = (R + v * ca) * cu;
            const y = (R + v * ca) * su;
            const z = v * sa;
            verts[ui * cols + vi] = proj(x, y, z);
        }
    }

    // Collect quads
    const nq = uS * vS;
    const quads = new Array(nq);
    let qi = 0;
    for (let ui = 0; ui < uS; ui++) {
        for (let vi = 0; vi < vS; vi++) {
            const a = verts[ui * cols + vi];
            const b = verts[ui * cols + vi + 1];
            const c = verts[(ui+1) * cols + vi + 1];
            const d = verts[(ui+1) * cols + vi];
            const avgZ = (a[2]+b[2]+c[2]+d[2]) * 0.25;
            quads[qi++] = { a, b, c, d, avgZ, hf: ui / uS };
        }
    }
    quads.sort((a, b) => b.avgZ - a.avgZ);

    ctx.clearRect(0, 0, w, h);
    const glowPx = glow * 7;
    for (let i = 0; i < nq; i++) {
        const q = quads[i];
        const depth = Math.max(0, Math.min(1, (q.avgZ + 2) / 4));
        const qHue  = (hue + q.hf * hueR) % 360;
        const light = 12 + depth * 65;
        ctx.fillStyle = `hsl(${qHue},85%,${light}%)`;
        if (glow > 0.05 && i % 4 === 0) { ctx.shadowBlur = glowPx; ctx.shadowColor = `hsl(${qHue},100%,70%)`; }
        ctx.beginPath();
        ctx.moveTo(q.a[0], q.a[1]);
        ctx.lineTo(q.b[0], q.b[1]);
        ctx.lineTo(q.c[0], q.c[1]);
        ctx.lineTo(q.d[0], q.d[1]);
        ctx.closePath();
        ctx.fill();
        if (i % 4 === 0) ctx.shadowBlur = 0;
    }
    ctx.shadowBlur = 0;
}
