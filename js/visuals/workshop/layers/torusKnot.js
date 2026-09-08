// ── Torus Knot ────────────────────────────────────────────────────────────────
// Parametric (p,q) torus knot rendered as a 3D tube via Canvas2D software
// rasteriser. The tube is split into cross-section rings and rendered with
// depth-sorted painter's algorithm quads. Bass pulses the tube radius; treble
// drives hue cycling along the curve.

const _st = new WeakMap();
const TAU = Math.PI * 2;

// Knot curve point at parameter u
function knotPoint(u, P, Q, R, r) {
    const cx = (R + r * Math.cos(Q * u)) * Math.cos(P * u);
    const cy = (R + r * Math.cos(Q * u)) * Math.sin(P * u);
    const cz = r * Math.sin(Q * u);
    return [cx, cy, cz];
}

// Frenet frame at u (tangent, normal, binormal)
function knotFrame(u, P, Q, R, r) {
    const du = 0.001;
    const [ax, ay, az] = knotPoint(u, P, Q, R, r);
    const [bx, by, bz] = knotPoint(u + du, P, Q, R, r);
    let tx = bx - ax, ty = by - ay, tz = bz - az;
    const tl = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // Arbitrary normal perpendicular to tangent
    let nx, ny, nz;
    if (Math.abs(tx) < 0.9) { nx = 0; ny = tz; nz = -ty; }
    else                     { nx = ty; ny = -tx; nz = 0; }
    const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    // Binormal = T × N
    return { t: [tx, ty, tz], n: [nx, ny, nz],
             b: [ty*nz - tz*ny, tz*nx - tx*nz, tx*ny - ty*nx] };
}

export const torusKnotParams = () => ({
    p:        { base: 2,   min: 2,   max: 7,   step: 1,  mod: { source: "" } },
    q:        { base: 3,   min: 2,   max: 7,   step: 1,  mod: { source: "" } },
    R:        { base: 1.0, min: 0.4, max: 2.0,           mod: { source: "" } },
    r:        { base: 0.4, min: 0.1, max: 0.9,           mod: { source: "" } },
    tube:     { base: 0.12,min: 0.02,max: 0.35,          mod: { source: "" } },
    segments: { base: 180, min: 60,  max: 400, step: 20, mod: { source: "" } },
    tSegs:    { base: 7,   min: 3,   max: 12,  step: 1,  mod: { source: "" } },
    speedX:   { base: 0.25,min: -2,  max: 2,             mod: { source: "" } },
    speedY:   { base: 0.4, min: -2,  max: 2,             mod: { source: "" } },
    hue:      { base: 200, min: 0,   max: 360,           mod: { source: "" } },
    hueRange: { base: 120, min: 0,   max: 360,           mod: { source: "" } },
    glow:     { base: 0.4, min: 0,   max: 1,             mod: { source: "" } },
    pulse:    { base: 0.3, min: 0,   max: 1,             mod: { source: "" } },
});

export function drawTorusKnot(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*2.5) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[30]+spectrum[40]+spectrum[50])/3*2.5) : 0;

    const PP   = Math.max(2, Math.round(p.p ?? 2));
    const QQ   = Math.max(2, Math.round(p.q ?? 3));
    const R    = p.R ?? 1.0;
    const r    = p.r ?? 0.4;
    const tube = (p.tube ?? 0.12) * (1 + bass * (p.pulse ?? 0.3) * 0.8);
    const segs = Math.round(Math.max(60, Math.min(400, p.segments ?? 180)));
    const tS   = Math.round(Math.max(3, Math.min(12, p.tSegs ?? 7)));
    const sx   = p.speedX ?? 0.25;
    const sy   = p.speedY ?? 0.4;
    const hue  = p.hue ?? 200;
    const hueR = p.hueRange ?? 120;
    const glow = p.glow ?? 0.4;

    let st = _st.get(ctx);
    if (!st) { st = { rx: 0, ry: 0 }; _st.set(ctx, st); }
    st.rx += sx / 60;
    st.ry += (sy + treble * 0.3) / 60;

    const crx = Math.cos(st.rx), srx = Math.sin(st.rx);
    const cry = Math.cos(st.ry), sry = Math.sin(st.ry);

    const scale = Math.min(w, h) * 0.40;
    const ox = w / 2, oy = h / 2;

    const proj = (x3, y3, z3) => {
        const x1 =  x3 * cry + z3 * sry;
        const z1 = -x3 * sry + z3 * cry;
        const y2 =  y3 * crx - z1 * srx;
        const z2 =  y3 * srx + z1 * crx;
        const zv = z2 + 2.5;
        const sp = scale / Math.max(0.5, zv);
        return [ox + x1 * sp, oy - y2 * sp, z2];
    };

    ctx.clearRect(0, 0, w, h);

    // Build rings: segs+1 cross-section rings, each with tS vertices
    const rings = new Array(segs + 1);
    for (let i = 0; i <= segs; i++) {
        const u = (i / segs) * TAU;
        const [kx, ky, kz] = knotPoint(u, PP, QQ, R, r);
        const { n, b } = knotFrame(u, PP, QQ, R, r);
        const verts = new Array(tS);
        for (let j = 0; j < tS; j++) {
            const a = (j / tS) * TAU;
            const ca = Math.cos(a), sa = Math.sin(a);
            verts[j] = [kx + (ca*n[0] + sa*b[0]) * tube,
                        ky + (ca*n[1] + sa*b[1]) * tube,
                        kz + (ca*n[2] + sa*b[2]) * tube];
        }
        rings[i] = { verts, hue: (hue + (i / segs) * hueR) % 360 };
    }

    // Project all verts
    const prings = rings.map(ring => ({
        ...ring,
        pv: ring.verts.map(v => proj(...v)),
    }));

    // Collect quads for depth-sorted painter's algorithm
    const quads = [];
    for (let i = 0; i < segs; i++) {
        const r0 = prings[i], r1 = prings[i + 1];
        for (let j = 0; j < tS; j++) {
            const j1 = (j + 1) % tS;
            const a = r0.pv[j], b = r1.pv[j], c = r1.pv[j1], d = r0.pv[j1];
            const avgZ = (a[2] + b[2] + c[2] + d[2]) * 0.25;
            quads.push({ a, b, c, d, avgZ, h: r0.hue });
        }
    }

    // Sort back-to-front
    quads.sort((qa, qb) => qb.avgZ - qa.avgZ);

    // Draw
    const glowPx = glow * 8;
    for (let qi = 0; qi < quads.length; qi++) {
        const q = quads[qi];
        const depth = Math.max(0.1, Math.min(1, (q.avgZ + 2) / 4));
        const light = 20 + depth * 55;

        ctx.fillStyle = `hsl(${q.h},80%,${light}%)`;
        if (glow > 0.05 && qi % 4 === 0) { // apply glow only every 4 quads for perf
            ctx.shadowBlur = glowPx;
            ctx.shadowColor = `hsl(${q.h},100%,70%)`;
        }
        ctx.beginPath();
        ctx.moveTo(q.a[0], q.a[1]);
        ctx.lineTo(q.b[0], q.b[1]);
        ctx.lineTo(q.c[0], q.c[1]);
        ctx.lineTo(q.d[0], q.d[1]);
        ctx.closePath();
        ctx.fill();
        if (qi % 4 === 0) ctx.shadowBlur = 0;
    }
    ctx.shadowBlur = 0;
}
