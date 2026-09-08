// ── Wireframe 3D ──────────────────────────────────────────────────────────────
// Rotating 3D wireframes with perspective depth cueing and additive glow.
// Five shapes: cube, icosahedron, torus, octahedron, dodecahedron.
// Bass pulses scale; mid shifts hue; treble adds a second ghost wireframe at
// a different rotation phase. Depth-sorted edges for correct rendering order.

const _state = new WeakMap();
const PHI = (1 + Math.sqrt(5)) / 2;

function buildCube() {
    const v = [];
    for (let a = -1; a <= 1; a += 2)
        for (let b = -1; b <= 1; b += 2)
            for (let c = -1; c <= 1; c += 2) v.push([a, b, c]);
    const e = [];
    for (let i = 0; i < 8; i++)
        for (let j = i+1; j < 8; j++) {
            const d = Math.abs(v[i][0]-v[j][0]) + Math.abs(v[i][1]-v[j][1]) + Math.abs(v[i][2]-v[j][2]);
            if (Math.abs(d - 2) < 0.01) e.push([i, j]);
        }
    return { v, e };
}

function buildIcosahedron() {
    const raw = [[0,1,PHI],[0,-1,PHI],[0,1,-PHI],[0,-1,-PHI]];
    const v = [];
    for (const [a,b,c] of raw) v.push([a,b,c],[b,c,a],[c,a,b]);
    const len = Math.sqrt(1 + PHI*PHI);
    for (const p of v) { p[0]/=len; p[1]/=len; p[2]/=len; }
    const thresh = (2/len)*1.02;
    const e = [];
    for (let i = 0; i < v.length; i++)
        for (let j = i+1; j < v.length; j++) {
            if (Math.hypot(v[i][0]-v[j][0],v[i][1]-v[j][1],v[i][2]-v[j][2]) < thresh) e.push([i,j]);
        }
    return { v, e };
}

function buildOctahedron() {
    const v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const e = [];
    for (let i = 0; i < 6; i++)
        for (let j = i+1; j < 6; j++) {
            const dot = v[i][0]*v[j][0]+v[i][1]*v[j][1]+v[i][2]*v[j][2];
            if (Math.abs(dot) < 0.01) e.push([i,j]);
        }
    return { v, e };
}

function buildTorus(N=20, M=10) {
    const R=0.68, r=0.28, v=[];
    for (let i=0;i<N;i++) { const th=(i/N)*Math.PI*2; for (let j=0;j<M;j++) { const ph=(j/M)*Math.PI*2; v.push([(R+r*Math.cos(ph))*Math.cos(th),(R+r*Math.cos(ph))*Math.sin(th),r*Math.sin(ph)]); } }
    const e=[];
    for (let i=0;i<N;i++) for (let j=0;j<M;j++) { e.push([i*M+j,((i+1)%N)*M+j]); e.push([i*M+j,i*M+(j+1)%M]); }
    return {v,e};
}

function buildDodecahedron() {
    const s = 1/PHI, t2 = PHI;
    const verts = [
        [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
        [0,s,t2],[0,s,-t2],[0,-s,t2],[0,-s,-t2],
        [s,t2,0],[s,-t2,0],[-s,t2,0],[-s,-t2,0],
        [t2,0,s],[t2,0,-s],[-t2,0,s],[-t2,0,-s],
    ];
    const len = Math.hypot(verts[0][0],verts[0][1],verts[0][2]);
    const v = verts.map(p=>[p[0]/len,p[1]/len,p[2]/len]);
    const thresh = 0.85;
    const e=[];
    for (let i=0;i<v.length;i++)
        for (let j=i+1;j<v.length;j++)
            if (Math.hypot(v[i][0]-v[j][0],v[i][1]-v[j][1],v[i][2]-v[j][2]) < thresh) e.push([i,j]);
    return {v,e};
}

const _shapes = [];
function getShape(idx) {
    if (!_shapes[idx]) _shapes[idx] = [buildCube,buildIcosahedron,buildTorus,buildOctahedron,buildDodecahedron][idx]();
    return _shapes[idx];
}

function rotX(v,a) { const c=Math.cos(a),s=Math.sin(a); return [v[0],v[1]*c-v[2]*s,v[1]*s+v[2]*c]; }
function rotY(v,a) { const c=Math.cos(a),s=Math.sin(a); return [v[0]*c+v[2]*s,v[1],-v[0]*s+v[2]*c]; }
function rotZ(v,a) { const c=Math.cos(a),s=Math.sin(a); return [v[0]*c-v[1]*s,v[0]*s+v[1]*c,v[2]]; }

function project3D(v, cx, cy, sc, dist) {
    const z = v[2] + dist;
    if (z < 0.01) return null;
    const f = dist / z;
    return { x: cx + v[0]*sc*f, y: cy + v[1]*sc*f, z: z, depth: f };
}

class WireframeViz {
    constructor() { this.rx=0; this.ry=0; this.rz=0; this.pulse=0; this.hueShift=0; }

    frame(ctx, w, h, p, t, bass, mid, treble) {
        const preset   = Math.round(Math.max(0, Math.min(4, p.preset ?? 1)));
        const hue      = ((p.hue ?? 180) + this.hueShift) % 360;
        const speed    = p.speed   ?? 1;
        const glow     = p.glow    ?? 1.5;
        const scaleP   = Math.min(w, h) * 0.38 * (p.scale ?? 1);
        const fade     = p.fade    ?? 0.1;
        const ghost    = p.ghost   ?? 0.5;
        const depthCue = p.depthCue ?? 1;
        const dist     = 3.5;

        if (bass > 0.45) this.pulse = Math.min(1, this.pulse + bass * 0.6);
        this.pulse *= 0.9;
        this.hueShift += mid * 1.2;

        const rotSpeed = speed * (1 + bass * 0.5);
        this.ry += 0.38 * rotSpeed / 60;
        this.rx += 0.14 * rotSpeed / 60;
        this.rz += 0.06 * rotSpeed / 60;

        ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, w, h);

        const {v, e} = getShape(preset);
        const sc  = scaleP * (1 + bass * 0.3 + this.pulse * 0.4);
        const cx  = w/2, cy = h/2;

        const rotVert = (vt, rxO=0, ryO=0, rzO=0) => {
            let r = rotX(vt, this.rx + rxO);
            r = rotY(r, this.ry + ryO);
            r = rotZ(r, this.rz + rzO);
            return r;
        };

        const pts  = v.map(vt => project3D(rotVert(vt), cx, cy, sc, dist));

        // Sort edges by average depth (painter's algorithm)
        const sortedEdges = e.map(([i,j]) => {
            const pi = pts[i], pj = pts[j];
            if (!pi || !pj) return null;
            return { i, j, avgZ: (pi.z + pj.z) / 2, depthFrac: ((pi.depth + pj.depth) / 2) };
        }).filter(Boolean);
        sortedEdges.sort((a, b) => b.avgZ - a.avgZ);

        // Main wireframe
        for (const {i, j, depthFrac} of sortedEdges) {
            const pi = pts[i], pj = pts[j];
            const depthAlpha = depthCue > 0 ? (0.2 + depthFrac * 0.8) : 1;
            const lum = 45 + bass * 20 + this.pulse * 20 + treble * 10;
            const alpha = (0.5 + bass * 0.3 + this.pulse * 0.2) * depthAlpha;
            ctx.strokeStyle = `hsla(${hue},85%,${lum}%,${Math.min(1,alpha)})`;
            ctx.lineWidth = (0.8 + bass * 1.5 + this.pulse * 0.5) * depthAlpha;
            if (glow > 0.1) {ctx.shadowBlur = 0; }
            ctx.beginPath(); ctx.moveTo(pi.x, pi.y); ctx.lineTo(pj.x, pj.y); ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Ghost wireframe (treble driven, phase-shifted rotation)
        if (ghost > 0.05 && treble > 0.1) {
            const ghostPts = v.map(vt => project3D(rotVert(vt, 0.3, 0.5, 0.2), cx, cy, sc * 0.85, dist));
            ctx.globalAlpha = ghost * treble * 0.6;
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = `hsl(${(hue + 120) % 360},80%,50%)`;
            ctx.lineWidth = 0.6;
ctx.shadowBlur = 0;
            for (const [i2, j2] of e) {
                if (!ghostPts[i2] || !ghostPts[j2]) continue;
                ctx.beginPath(); ctx.moveTo(ghostPts[i2].x, ghostPts[i2].y); ctx.lineTo(ghostPts[j2].x, ghostPts[j2].y); ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        }

        // Vertex dots (treble)
        if (treble > 0.25) {
            ctx.fillStyle = `hsla(${hue},100%,90%,${treble * 0.8})`;
ctx.shadowBlur = 0;
            for (const pt of pts) {
                if (!pt) continue;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5 + treble * 2, 0, Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
    }
}

export const wireframe3DParams = () => ({
    preset:   { base: 1,    min: 0,    max: 4,   mod: { source: "" } },
    speed:    { base: 1,    min: -4,   max: 4,   mod: { source: "" } },
    scale:    { base: 1,    min: 0.2,  max: 2.5, mod: { source: "" } },
    hue:      { base: 180,  min: 0,    max: 360, mod: { source: "" } },
    glow:     { base: 1.5,  min: 0,    max: 3,   mod: { source: "" } },
    fade:     { base: 0.1,  min: 0.01, max: 0.8, mod: { source: "" } },
    ghost:    { base: 0.5,  min: 0,    max: 1,   mod: { source: "" } },
    depthCue: { base: 1,    min: 0,    max: 1,   mod: { source: "" } },
    rotX:     { base: 0,    min: -2,   max: 2,   mod: { source: "" } },
    rotZ:     { base: 0,    min: -2,   max: 2,   mod: { source: "" } },
});

export function drawWireframe3D(ctx, w, h, p, t, extra) {
    let viz = _state.get(ctx);
    if (!viz) { viz = new WireframeViz(); _state.set(ctx, viz); }
    const sp = extra?.spectrum;
    const bass   = sp ? Math.min(1, (sp[1]+sp[2]+sp[3])/3*2) : 0;
    const mid    = sp ? Math.min(1, (sp[8]+sp[10]+sp[12])/3*2) : 0;
    const treble = sp ? Math.min(1, (sp[30]+sp[40]+sp[50])/3*2) : 0;
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    viz.frame(ctx, w, h, p, t, bass, mid, treble);
}
