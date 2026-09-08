// ── SuperShape 3D ─────────────────────────────────────────────────────────────
// 3D Superformula surface — two instances of the Gielis formula applied to
// latitude and longitude sweeps. m controls petal count; n1/n2/n3 sculpt the
// edge profile from star → circle → spiky → bulging. The combination of two
// independent Superformula sweeps yields an enormous variety of biological and
// crystalline forms.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function sf(angle, m, n1, n2, n3) {
    const t  = m * angle / 4;
    const v  = (Math.abs(Math.cos(t)) ** n2 + Math.abs(Math.sin(t)) ** n3);
    if (v === 0) return 0;
    return v ** (-1 / n1);
}

export const supershapeParams = () => ({
    m1:     { base: 4,   min: 1,   max: 16,  step: 1,  mod: { source: "" } }, // latitude petal count
    n11:    { base: 1.0, min: 0.1, max: 12,            mod: { source: "" } },
    n12:    { base: 1.0, min: 0.1, max: 8,             mod: { source: "" } },
    n13:    { base: 1.0, min: 0.1, max: 8,             mod: { source: "" } },
    m2:     { base: 4,   min: 1,   max: 16,  step: 1,  mod: { source: "" } }, // longitude petal count
    n21:    { base: 1.0, min: 0.1, max: 12,            mod: { source: "" } },
    n22:    { base: 1.0, min: 0.1, max: 8,             mod: { source: "" } },
    n23:    { base: 1.0, min: 0.1, max: 8,             mod: { source: "" } },
    res:    { base: 36,  min: 12,  max: 60,  step: 4,  mod: { source: "" } },
    speedX: { base: 0.3, min: -2,  max: 2,             mod: { source: "" } },
    speedY: { base: 0.4, min: -2,  max: 2,             mod: { source: "" } },
    hue:    { base: 40,  min: 0,   max: 360,           mod: { source: "" } },
    hueAlt: { base: 200, min: 0,   max: 360,           mod: { source: "" } },
    glow:   { base: 0.35,min: 0,   max: 1,             mod: { source: "" } },
    pulse:  { base: 0.3, min: 0,   max: 1,             mod: { source: "" } },
});

export function drawSupershape(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*2.5) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*2.5) : 0;

    const M1  = Math.max(1, Math.round(p.m1 ?? 4));
    const N11 = Math.max(0.01, p.n11 ?? 1);
    const N12 = Math.max(0.01, p.n12 ?? 1);
    const N13 = Math.max(0.01, p.n13 ?? 1);
    const M2  = Math.max(1, Math.round(p.m2 ?? 4));
    const N21 = Math.max(0.01, p.n21 ?? 1);
    const N22 = Math.max(0.01, p.n22 ?? 1);
    const N23 = Math.max(0.01, p.n23 ?? 1);
    const res  = Math.round(Math.max(12, Math.min(60, p.res ?? 36)));
    const hue  = p.hue ?? 40;
    const hueA = p.hueAlt ?? 200;
    const glow = p.glow ?? 0.35;
    const pulseScale = 1 + bass * (p.pulse ?? 0.3) * 0.5;

    let st = _st.get(ctx);
    if (!st) { st = { rx: 0, ry: 0 }; _st.set(ctx, st); }
    st.rx += (p.speedX ?? 0.3) / 60;
    st.ry += ((p.speedY ?? 0.4) + treble * 0.2) / 60;

    const crx = Math.cos(st.rx), srx = Math.sin(st.rx);
    const cry = Math.cos(st.ry), sry = Math.sin(st.ry);
    const scale = Math.min(w, h) * 0.28 * pulseScale;
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

    // Build vertex grid: (res+1) × (res+1)
    const rows = res + 1, cols = res + 1;
    const verts = new Array(rows * cols);
    for (let ri = 0; ri < rows; ri++) {
        const theta = -Math.PI / 2 + (ri / res) * Math.PI; // -π/2..π/2
        const r2 = sf(theta, M2, N21, N22, N23);
        for (let ci = 0; ci < cols; ci++) {
            const phi = (ci / res) * TAU; // 0..2π
            const r1 = sf(phi, M1, N11, N12, N13);
            const x  = r1 * Math.cos(phi) * r2 * Math.cos(theta);
            const y  = r1 * Math.sin(phi) * r2 * Math.cos(theta);
            const z  = r2 * Math.sin(theta);
            verts[ri * cols + ci] = proj(x, y, z);
        }
    }

    // Collect and depth-sort quads
    const nq = res * res;
    const quads = new Array(nq);
    let qi = 0;
    for (let ri = 0; ri < res; ri++) {
        for (let ci = 0; ci < res; ci++) {
            const a = verts[ri * cols + ci];
            const b = verts[ri * cols + ci + 1];
            const c = verts[(ri+1) * cols + ci + 1];
            const d = verts[(ri+1) * cols + ci];
            const avgZ = (a[2]+b[2]+c[2]+d[2]) * 0.25;
            const hf = (ri / res + ci / res) * 0.5; // 0..1 across surface
            quads[qi++] = { a, b, c, d, avgZ, hf };
        }
    }
    quads.sort((qa, qb) => qb.avgZ - qa.avgZ);

    ctx.clearRect(0, 0, w, h);
    const glowPx = glow * 8;
    for (let i = 0; i < nq; i++) {
        const q = quads[i];
        const depth = Math.max(0, Math.min(1, (q.avgZ + 2) / 4));
        const blendHue = hue + q.hf * ((hueA - hue + 360) % 360);
        const light = 15 + depth * 60;
        ctx.fillStyle = `hsl(${blendHue % 360},80%,${light}%)`;
        if (glow > 0.05 && i % 3 === 0) { ctx.shadowBlur = glowPx; ctx.shadowColor = `hsl(${blendHue % 360},100%,70%)`; }
        ctx.beginPath();
        ctx.moveTo(q.a[0], q.a[1]);
        ctx.lineTo(q.b[0], q.b[1]);
        ctx.lineTo(q.c[0], q.c[1]);
        ctx.lineTo(q.d[0], q.d[1]);
        ctx.closePath();
        ctx.fill();
        if (i % 3 === 0) ctx.shadowBlur = 0;
    }
    ctx.shadowBlur = 0;
}
