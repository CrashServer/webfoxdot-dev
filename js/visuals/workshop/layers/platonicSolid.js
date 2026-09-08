// ── Platonic Solid ────────────────────────────────────────────────────────────
// Wireframe / solid rendering of the 5 Platonic solids in 3D perspective.
// Audio: bass pulses scale; treble brightens edges.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function norm(v) {
    const l = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    return l < 1e-10 ? v : [v[0]/l,v[1]/l,v[2]/l];
}
function cross(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }

// Build vertex sets for each solid (unit-sphere normalised)
const PHI = (1 + Math.sqrt(5)) / 2;

function mkTetra() {
    const v = [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(norm);
    const f = [[0,1,2],[0,2,3],[0,3,1],[1,3,2]];
    return { v, f };
}
function mkCube() {
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(norm);
    const f = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
    return { v, f };
}
function mkOcta() {
    const v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(norm);
    const f = [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,2,5],[1,5,3],[1,3,4]];
    return { v, f };
}
function mkDodeca() {
    const p = PHI, ip = 1/PHI;
    const v = [
        [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
        [0,ip,p],[0,ip,-p],[0,-ip,p],[0,-ip,-p],
        [ip,p,0],[ip,-p,0],[-ip,p,0],[-ip,-p,0],
        [p,0,ip],[p,0,-ip],[-p,0,ip],[-p,0,-ip],
    ].map(norm);
    // Simplified face list (pentagons)
    const f = [
        [0,16,2,10,8],[0,8,4,14,12],[0,12,1,17,16],
        [3,11,9,1,17],[3,17,16,2,13],[3,13,7,15,11],
        [6,10,2,13,15],[6,15,7,19,18],[6,18,4,8,10],
        [5,9,11,15,19],[5,19,18,4,14],[5,14,12,1,9],
    ];
    return { v, f };
}
function mkIcosa() {
    const v = [];
    v.push([0,1,PHI],[0,-1,PHI],[0,1,-PHI],[0,-1,-PHI]);
    v.push([1,PHI,0],[-1,PHI,0],[1,-PHI,0],[-1,-PHI,0]);
    v.push([PHI,0,1],[PHI,0,-1],[-PHI,0,1],[-PHI,0,-1]);
    const vn = v.map(norm);
    const f = [
        [0,1,8],[0,8,4],[0,4,10],[0,10,5],[0,5,1],
        [3,9,2],[3,6,9],[3,7,6],[3,11,7],[3,2,11],
        [1,6,8],[8,6,9],[8,9,4],[4,9,2],[4,2,10],
        [10,2,11],[10,11,5],[5,11,7],[5,7,1],[1,7,6],
    ];
    return { v: vn, f };
}

const SOLIDS = [mkTetra, mkCube, mkOcta, mkDodeca, mkIcosa];
const NAMES = ["Tetrahedron","Cube","Octahedron","Dodecahedron","Icosahedron"];

function project(v, rotX, rotY, fov, scale) {
    // Rotate Y
    const cx = Math.cos(rotY), sx = Math.sin(rotY);
    let x = cx*v[0]+sx*v[2], y = v[1], z = -sx*v[0]+cx*v[2];
    // Rotate X
    const cy2 = Math.cos(rotX), sy = Math.sin(rotX);
    const y2 = cy2*y - sy*z, z2 = sy*y + cy2*z;
    z = z2; y = y2;
    // Perspective
    const d = fov / (fov + z + 2);
    return [x * d * scale, y * d * scale, z];
}

export const platonicSolidParams = () => ({
    shape:    { base: 4,    min: 0,   max: 4,   step: 1,  mod: { source: "" } }, // 0=tetra…4=icosa
    mode:     { base: 0,    min: 0,   max: 2,   step: 1,  mod: { source: "" } }, // 0=wire, 1=solid, 2=both
    scale:    { base: 0.35, min: 0.1, max: 0.8,           mod: { source: "" } },
    rotX:     { base: 0.3,  min: -2,  max: 2,             mod: { source: "" } }, // rotation speed X
    rotY:     { base: 0.5,  min: -2,  max: 2,             mod: { source: "" } }, // rotation speed Y
    hue:      { base: 200,  min: 0,   max: 360,           mod: { source: "" } },
    glow:     { base: 0.6,  min: 0,   max: 1,             mod: { source: "" } },
    thick:    { base: 1.5,  min: 0.3, max: 5,             mod: { source: "" } },
    pulse:    { base: 0.4,  min: 0,   max: 1,             mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,   max: 1,             mod: { source: "" } },
    fov:      { base: 3.5,  min: 1,   max: 8,             mod: { source: "" } },
});

export function drawPlatonicSolid(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const shapeIdx = Math.round(Math.max(0, Math.min(4, p.shape ?? 4)));
    const mode   = Math.round(Math.max(0, Math.min(2, p.mode ?? 0)));
    const scale  = (p.scale ?? 0.35) * Math.min(w, h) * (1 + bass * (p.pulse ?? 0.4) * 0.15);
    const hue    = p.hue ?? 200;
    const glow   = p.glow ?? 0.6;
    const thick  = p.thick ?? 1.5;
    const bgAlpha= p.bgAlpha ?? 0;
    const fov    = p.fov ?? 3.5;

    let st = _st.get(ctx);
    if (!st || st.shapeIdx !== shapeIdx) {
        const builder = SOLIDS[shapeIdx];
        const solid = builder();
        st = { shapeIdx, solid, rx: 0, ry: 0, lastT: t };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rx += (p.rotX ?? 0.3) * dt;
    st.ry += (p.rotY ?? 0.5) * dt * (1 + bass * 0.2);

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    const { v, f } = st.solid;
    const cx = w / 2, cy = h / 2;
    const pts = v.map(vx => {
        const [px, py, pz] = project(vx, st.rx, st.ry, fov, scale);
        return [cx + px, cy + py, pz];
    });

    // Sort faces back-to-front
    const faceDepths = f.map((face, i) => {
        const z = face.reduce((s, vi) => s + pts[vi][2], 0) / face.length;
        return { i, z };
    }).sort((a, b) => b.z - a.z);

    if (glow > 0.05) {
        ctx.shadowBlur = glow * 15 * (1 + treble * 0.4);
        ctx.shadowColor = `hsl(${hue},100%,70%)`;
    }

    for (const { i } of faceDepths) {
        const face = f[i];
        const fpts = face.map(vi => pts[vi]);

        // Face normal for lighting
        const v0 = v[face[0]], v1 = v[face[1]], v2 = v[face[2]];
        const e1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
        const e2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
        const fn = norm(cross(e1, e2));
        const [rx, ry] = [Math.cos(st.ry) * fn[0] - Math.sin(st.ry) * fn[2],
                          Math.cos(st.rx) * fn[1] - Math.sin(st.rx) * fn[2]];
        const light = Math.max(0, dot(fn, [0.3, 0.5, 1]));

        if (mode === 1 || mode === 2) {
            ctx.beginPath();
            ctx.moveTo(fpts[0][0], fpts[0][1]);
            for (let j = 1; j < fpts.length; j++) ctx.lineTo(fpts[j][0], fpts[j][1]);
            ctx.closePath();
            ctx.fillStyle = `hsla(${hue},70%,${20 + light * 30}%,0.6)`;
            ctx.fill();
        }
        if (mode === 0 || mode === 2) {
            ctx.beginPath();
            ctx.moveTo(fpts[0][0], fpts[0][1]);
            for (let j = 1; j < fpts.length; j++) ctx.lineTo(fpts[j][0], fpts[j][1]);
            ctx.closePath();
            ctx.strokeStyle = `hsl(${hue},90%,${55 + treble * 30}%)`;
            ctx.lineWidth = thick;
            ctx.stroke();
        }
    }
    ctx.shadowBlur = 0;
}
