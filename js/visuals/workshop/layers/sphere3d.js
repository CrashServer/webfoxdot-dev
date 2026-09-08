// ── Sphere 3D ─────────────────────────────────────────────────────────────
// A shaded, rotating 3D shape: sphere, cube, torus, or icosahedron.
// Painter's-algorithm face sort, Phong-lite normal shading, audio drives speed.
// Ported from web/src/layers/sphere3d.js (Canvas2D), adapted to the
// workshop draw-function pattern (FoxDot-specific text removed).

const _state = new WeakMap();

const LIGHT = (() => { const l = [0.5, 0.7, 1.0]; const m = Math.hypot(...l); return l.map((x) => x / m); })();

function buildSphere(D) {
    const v = [], f = [];
    for (let i = 0; i <= D; i++) {
        const la = Math.PI * (i / D - 0.5);
        for (let j = 0; j < D; j++) {
            const lo = 2 * Math.PI * j / D;
            v.push([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]);
        }
    }
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
        const a = i * D + j, b = i * D + (j + 1) % D, c = (i + 1) * D + j, d = (i + 1) * D + (j + 1) % D;
        f.push([a, b, d], [a, d, c]);
    }
    return { v, f };
}

function buildTorus(D) {
    const v = [], f = [], mn = (D * 0.6) | 0;
    for (let i = 0; i < D; i++) {
        const u = 2 * Math.PI * i / D;
        for (let j = 0; j < mn; j++) {
            const tt = 2 * Math.PI * j / mn, r = 1 + 0.4 * Math.cos(tt);
            v.push([r * Math.cos(u), 0.4 * Math.sin(tt), r * Math.sin(u)]);
        }
    }
    for (let i = 0; i < D; i++) for (let j = 0; j < mn; j++) {
        const a = i * mn + j, b = ((i + 1) % D) * mn + j, c = i * mn + (j + 1) % mn, d = ((i + 1) % D) * mn + (j + 1) % mn;
        f.push([a, b, d], [a, d, c]);
    }
    return { v, f };
}

function buildCube() {
    const v = [], f = [], n = 4;
    const face = (ax, s) => {
        const base = v.length;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
            const a = i / n * 2 - 1, b = j / n * 2 - 1;
            const pt = [0, 0, 0]; pt[ax] = s; pt[(ax + 1) % 3] = a; pt[(ax + 2) % 3] = b;
            v.push(pt);
        }
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const q = base + i * (n + 1) + j;
            f.push([q, q + 1, q + n + 2], [q, q + n + 2, q + n + 1]);
        }
    };
    for (let ax = 0; ax < 3; ax++) { face(ax, 1); face(ax, -1); }
    return { v, f };
}

function buildIco() {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]]
        .map((p) => { const m = Math.hypot(...p); return p.map((x) => x / m); });
    const f = [[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    return { v, f };
}

const SHAPE_BUILDERS = [
    (D) => buildSphere(D),
    () => buildCube(),
    (D) => buildTorus(D),
    () => buildIco(),
];
const SHAPE_NAMES = ["SPHERE", "CUBE", "TORUS", "ICOSAHEDRON"];

class Sphere3DViz {
    constructor() { this.rx = 0; this.ry = 0; this.rz = 0; this._shape = -1; this._D = -1; this.verts = []; this.faces = []; }

    ensure(shape, D) {
        if (shape === this._shape && D === this._D) return;
        this._shape = shape; this._D = D;
        const s = SHAPE_BUILDERS[shape](D);
        this.verts = s.v; this.faces = s.f;
    }

    frame(ctx, w, h, p, t, audio) {
        const shape = Math.max(0, Math.min(3, Math.round(p.shape ?? 0)));
        const D     = Math.max(6, Math.min(16, Math.round(p.detail ?? 12)));
        const hue   = (p.hue ?? 140) | 0;
        const spd   = (p.rotSpeed ?? 1) * (1 + audio * 1.5);

        this.ensure(shape, D);
        this.rx += 0.005 * spd;
        this.ry += 0.01  * spd;
        this.rz += 0.003 * spd;

        const cX = Math.cos(this.rx), sX = Math.sin(this.rx);
        const cY = Math.cos(this.ry), sY = Math.sin(this.ry);
        const cZ = Math.cos(this.rz), sZ = Math.sin(this.rz);
        const rot = ([x, y, z]) => {
            let yn = y * cX - z * sX, zn = y * sX + z * cX;
            let xn2 = x * cY - zn * sY, zn2 = x * sY + zn * cY;
            let xn3 = xn2 * cZ - yn * sZ, yn3 = xn2 * sZ + yn * cZ;
            return [xn3, yn3, zn2];
        };

        const U = Math.min(w, h);
        const R = U * 0.3, cx = w / 2, cy = h / 2;
        const RV = this.verts.map(rot);
        const P  = RV.map(([x, y, z]) => { const sc = R * 2 / (z + 4); return [cx + x * sc, cy - y * sc]; });

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);

        // Painter's sort (back-to-front)
        const order = this.faces.map((f, i) => [i, (RV[f[0]][2] + RV[f[1]][2] + RV[f[2]][2]) / 3])
            .sort((a, b) => a[1] - b[1]);

        for (const [fi] of order) {
            const f = this.faces[fi];
            const A = RV[f[0]], B = RV[f[1]], C = RV[f[2]];
            const u = [B[0]-A[0], B[1]-A[1], B[2]-A[2]], vv = [C[0]-A[0], C[1]-A[1], C[2]-A[2]];
            let nx = u[1]*vv[2]-u[2]*vv[1], ny = u[2]*vv[0]-u[0]*vv[2], nz = u[0]*vv[1]-u[1]*vv[0];
            const nm = Math.hypot(nx, ny, nz) || 1;
            const li = 0.25 + Math.max(0, (nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]) / nm) * 0.75;
            const l8 = Math.min(100, Math.round(li * 65));
            ctx.beginPath();
            ctx.moveTo(P[f[0]][0], P[f[0]][1]);
            ctx.lineTo(P[f[1]][0], P[f[1]][1]);
            ctx.lineTo(P[f[2]][0], P[f[2]][1]);
            ctx.closePath();
            ctx.fillStyle = `hsl(${hue},70%,${l8}%)`;
            ctx.strokeStyle = `hsla(${hue},60%,${Math.min(100, l8 + 20)}%,0.3)`;
            ctx.lineWidth = 0.5;
            ctx.fill();
            ctx.stroke();
        }

        // Shape label
        const fs = Math.max(10, U * 0.016) | 0;
        ctx.font = `bold ${fs}px 'Courier New',monospace`;
        ctx.textAlign = "left";
        ctx.fillStyle = `hsla(${hue},80%,70%,0.7)`;
        ctx.fillText(SHAPE_NAMES[shape], U * 0.02, U * 0.045);
    }
}

function audioLevel(spectrum) {
    if (!spectrum || !spectrum.length) return 0;
    let sum = 0;
    for (let i = 0; i < spectrum.length; i++) sum += spectrum[i];
    return Math.min(1, (sum / spectrum.length) * 3);
}

export const sphere3dParams = () => ({
    shape:      { base: 0,   min: 0,   max: 3,   mod: { source: "" } }, // 0=sphere 1=cube 2=torus 3=ico
    detail:     { base: 12,  min: 6,   max: 16,  mod: { source: "" } },
    rotSpeed:   { base: 1,   min: 0,   max: 4,   mod: { source: "" } },
    hue:        { base: 140, min: 0,   max: 360, mod: { source: "" } },
});

export function drawSphere3D(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new Sphere3DViz(); _state.set(ctx, viz); }
    const audio = audioLevel(extra?.spectrum);
    viz.frame(ctx, w, h, p, t, audio);
}
