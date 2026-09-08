// Tesseract — rotating 4D polytopes with filled faces and audio reactivity.
// shape=0: hypercube (16 verts, 32 edges, 24 faces)
// shape=1: 16-cell / hexadecachoron (8 verts, 24 edges, 32 faces)
// shape=2: dual — both overlaid, hypercube outer + 16-cell inner

const _state = new WeakMap();

// ── Hypercube (4D cube) ───────────────────────────────────────────────────────
function buildCubeVerts() {
    const v = [];
    for (let i = 0; i < 16; i++)
        v.push([(i&1)?1:-1, (i&2)?1:-1, (i&4)?1:-1, (i&8)?1:-1]);
    return v;
}

function buildCubeEdges(verts) {
    const e = [];
    for (let a = 0; a < 16; a++)
        for (let b = a+1; b < 16; b++) {
            let d = 0;
            for (let k = 0; k < 4; k++) if (verts[a][k] !== verts[b][k]) d++;
            if (d === 1) e.push([a, b]);
        }
    return e;
}

function buildCubeFaces(verts) {
    const faces = [];
    for (let ai = 0; ai < 4; ai++) {
        for (let aj = ai+1; aj < 4; aj++) {
            const others = [0,1,2,3].filter(a => a !== ai && a !== aj);
            for (let ov = 0; ov < 4; ov++) {
                const fa = (ov&1) ? 1 : -1, fb = (ov&2) ? 1 : -1;
                const quad = [];
                for (let vi = 0; vi < 16; vi++)
                    if (verts[vi][others[0]] === fa && verts[vi][others[1]] === fb)
                        quad.push(vi);
                quad.sort((a, b) => Math.atan2(verts[a][aj], verts[a][ai]) - Math.atan2(verts[b][aj], verts[b][ai]));
                faces.push({ quad, ai, aj, depth: fa + fb });
            }
        }
    }
    return faces;
}

// ── 16-cell (cross-polytope) ──────────────────────────────────────────────────
// 8 vertices: all permutations of (±1, 0, 0, 0)
function buildCellVerts() {
    const v = [];
    for (let ax = 0; ax < 4; ax++) {
        for (const s of [1, -1]) {
            const p = [0, 0, 0, 0];
            p[ax] = s;
            v.push(p);
        }
    }
    return v; // 8 vertices
}

// All pairs connected except antipodal pairs (differ only by sign in one axis)
function buildCellEdges(verts) {
    const e = [];
    for (let a = 0; a < 8; a++)
        for (let b = a+1; b < 8; b++) {
            // Antipodal = same axis, opposite sign (dot product = -1)
            const dot = verts[a][0]*verts[b][0] + verts[a][1]*verts[b][1] +
                        verts[a][2]*verts[b][2] + verts[a][3]*verts[b][3];
            if (dot !== -1) e.push([a, b]);
        }
    return e; // 24 edges
}

// 32 triangular faces: all triples of mutually non-antipodal vertices
function buildCellFaces(verts) {
    const faces = [];
    for (let a = 0; a < 8; a++)
        for (let b = a+1; b < 8; b++) {
            const dotAB = verts[a].reduce((s,v,k) => s+v*verts[b][k], 0);
            if (dotAB === -1) continue;
            for (let c = b+1; c < 8; c++) {
                const dotAC = verts[a].reduce((s,v,k) => s+v*verts[c][k], 0);
                const dotBC = verts[b].reduce((s,v,k) => s+v*verts[c][k], 0);
                if (dotAC !== -1 && dotBC !== -1) faces.push({ tri: [a, b, c] });
            }
        }
    return faces;
}

const CUBE_VERTS  = buildCubeVerts();
const CUBE_EDGES  = buildCubeEdges(CUBE_VERTS);
const CUBE_FACES  = buildCubeFaces(CUBE_VERTS);
const CELL_VERTS  = buildCellVerts();
const CELL_EDGES  = buildCellEdges(CELL_VERTS);
const CELL_FACES  = buildCellFaces(CELL_VERTS);

function rot4(v, i, j, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const vi = v[i], vj = v[j];
    v[i] = vi*c - vj*s;
    v[j] = vi*s + vj*c;
}

export const tesseractParams = () => ({
    shape:      { base: 0,    min: 0,   max: 2,   step: 1, mod: { source: "" } }, // 0=cube 1=16-cell 2=dual
    hue:        { base: 200,  min: 0,   max: 360,          mod: { source: "" } },
    hue2:       { base: 40,   min: 0,   max: 360,          mod: { source: "" } }, // 16-cell hue (dual mode)
    speed:      { base: 0.4,  min: 0,   max: 3,            mod: { source: "" } },
    speedXW:    { base: 0.7,  min: -3,  max: 3,            mod: { source: "" } }, // XW plane spin multiplier
    speedYZ:    { base: 0.5,  min: -3,  max: 3,            mod: { source: "" } }, // YZ plane spin multiplier
    glow:       { base: 2.5,  min: 0,   max: 4,            mod: { source: "" } },
    scale:      { base: 0.9,  min: 0.2, max: 2.0,          mod: { source: "" } },
    faceAlpha:  { base: 0.15, min: 0,   max: 1,            mod: { source: "" } },
    pulse:      { base: 0.6,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawTesseract(ctx, w, h, p, t, extra) {
    let st = _state.get(ctx);
    if (!st) {
        st = { time: 0, angles: [0,0,0,0,0,0], pulse: 0, prevBass: 0, prevMid: 0, lastT: t };
        _state.set(ctx, st);
    }
    const dt = Math.min(0.05, t - st.lastT); st.lastT = t;
    st.time += dt;

    const spec = extra?.spectrum;
    let bass = 0, mid = 0, treble = 0;
    if (spec?.length) {
        for (let i = 0;  i < 5;  i++) bass   += spec[i];  bass   /= 5;
        for (let i = 5;  i < 20; i++) mid    += spec[i];  mid    /= 15;
        for (let i = 44; i < 64; i++) treble += spec[i];  treble /= 20;
    }

    const pv = p.pulse ?? 0.6;
    if (bass > 0.5 && bass > st.prevBass + 0.08) st.pulse = Math.min(1, st.pulse + bass * pv);
    st.prevBass = bass;
    st.pulse *= 0.86;

    const spd = (p.speed ?? 0.4) * dt;
    const sxw = p.speedXW ?? 0.7;
    const syz = p.speedYZ ?? 0.5;
    st.angles[0] += spd * 1.00;
    st.angles[1] += spd * 0.70 + mid * 0.004;
    st.angles[2] += spd * sxw  + bass * 0.006 * pv;
    st.angles[3] += spd * syz;
    st.angles[4] += spd * 0.80 + treble * 0.003;
    st.angles[5] += spd * 0.60;

    const ZW_DIST  = 2.0;
    const CAM_DIST = 3.0;
    const basePx   = Math.min(w, h) * 0.42 * (p.scale ?? 0.9);
    const scale2D  = basePx * (1 + bass * 0.18 * pv + st.pulse * 0.12);
    const cx = w/2, cy = h/2;
    const hue       = p.hue ?? 200;
    const hue2      = p.hue2 ?? 40;
    const glowStr   = p.glow ?? 2.5;
    const faceAlpha = (p.faceAlpha ?? 0.15) + mid * 0.18 + st.pulse * 0.15;
    const shape     = Math.round(Math.max(0, Math.min(2, p.shape ?? 0)));

    function project4D(baseVerts) {
        return baseVerts.map(bv => {
            const v = bv.slice();
            rot4(v, 0, 1, st.angles[0]);
            rot4(v, 0, 2, st.angles[1]);
            rot4(v, 0, 3, st.angles[2]);
            rot4(v, 1, 2, st.angles[3]);
            rot4(v, 1, 3, st.angles[4]);
            rot4(v, 2, 3, st.angles[5]);
            const wDiv = v[3] + ZW_DIST;
            const x3 = v[0] / wDiv, y3 = v[1] / wDiv, z3 = v[2] / wDiv;
            const zDiv = z3 + CAM_DIST;
            return { px: cx + (x3/zDiv)*scale2D, py: cy + (y3/zDiv)*scale2D, w4: v[3] };
        });
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `hsl(${hue},20%,3%)`;
    ctx.fillRect(0, 0, w, h);

    function drawFacesQuad(proj, faces, baseHue, wCoords) {
        if (faceAlpha <= 0.005) return;
        const sorted = faces.slice().sort((fa, fb) => {
            const wa = fa.quad.reduce((s,vi) => s+wCoords[vi], 0) / 4;
            const wb = fb.quad.reduce((s,vi) => s+wCoords[vi], 0) / 4;
            return wa - wb;
        });
        for (const { quad } of sorted) {
            const avgW = quad.reduce((s,vi) => s+wCoords[vi], 0) / 4;
            const tVal = (avgW + 1.5) / 3;
            const fHue = (baseHue + tVal * 70 + treble * 30) % 360;
            const fLight = 18 + tVal * 38 + bass * 22 * pv * (1-tVal) + treble * 18 * tVal;
            const fAlpha = faceAlpha * (0.35 + tVal * 0.65);
            ctx.beginPath();
            ctx.moveTo(proj[quad[0]].px, proj[quad[0]].py);
            for (let k = 1; k < 4; k++) ctx.lineTo(proj[quad[k]].px, proj[quad[k]].py);
            ctx.closePath();
            ctx.fillStyle = `hsla(${fHue},70%,${fLight}%,${fAlpha})`;
            ctx.fill();
        }
    }

    function drawFacesTri(proj, faces, baseHue, wCoords) {
        if (faceAlpha <= 0.005) return;
        const sorted = faces.slice().sort((fa, fb) => {
            const wa = fa.tri.reduce((s,vi) => s+wCoords[vi], 0) / 3;
            const wb = fb.tri.reduce((s,vi) => s+wCoords[vi], 0) / 3;
            return wa - wb;
        });
        for (const { tri } of sorted) {
            const avgW = tri.reduce((s,vi) => s+wCoords[vi], 0) / 3;
            const tVal = Math.max(0, Math.min(1, avgW + 0.5));
            const fHue = (baseHue + tVal * 90 + bass * 40 * pv) % 360;
            const fLight = 20 + tVal * 35 + bass * 20 * pv + treble * 15;
            const fAlpha = faceAlpha * (0.4 + tVal * 0.6);
            ctx.beginPath();
            ctx.moveTo(proj[tri[0]].px, proj[tri[0]].py);
            ctx.lineTo(proj[tri[1]].px, proj[tri[1]].py);
            ctx.lineTo(proj[tri[2]].px, proj[tri[2]].py);
            ctx.closePath();
            ctx.fillStyle = `hsla(${fHue},75%,${fLight}%,${fAlpha})`;
            ctx.fill();
        }
    }

    function drawEdges(proj, edges, baseHue, wCoords) {
        for (let pass = 0; pass < 2; pass++) {
            ctx.save();
            ctx.lineWidth  = pass === 0 ? 2.5 : 1.4;
            ctx.globalAlpha = pass === 0 ? 0.5 : 1;
            if (pass === 0 && glowStr > 0.05) {
                ctx.shadowBlur = glowStr * 10 * (1 + bass * pv * 0.5 + st.pulse * 0.3);
                ctx.shadowColor = `hsl(${baseHue},100%,75%)`;
            }
            for (const [a, b] of edges) {
                const avgW = (wCoords[a] + wCoords[b]) / 2;
                const tVal = (avgW + 1.5) / 3;
                const light = 30 + tVal * 55 + treble * 18 + st.pulse * 25;
                const alpha = 0.3 + tVal * 0.7;
                const eHue  = (baseHue + (1-tVal) * 40 + mid * 20) % 360;
                ctx.strokeStyle = `hsla(${eHue},90%,${light}%,${alpha})`;
                ctx.beginPath();
                ctx.moveTo(proj[a].px, proj[a].py);
                ctx.lineTo(proj[b].px, proj[b].py);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    if (shape === 0 || shape === 2) {
        const proj = project4D(CUBE_VERTS);
        const w4   = proj.map(p => p.w4);
        drawFacesQuad(proj, CUBE_FACES, hue, w4);
        drawEdges(proj, CUBE_EDGES, hue, w4);
    }

    if (shape === 1 || shape === 2) {
        // Scale 16-cell slightly smaller in dual mode so they don't overlap badly
        const cellScale = shape === 2 ? 0.6 : 1.0;
        const scaledVerts = CELL_VERTS.map(v => v.map(x => x * cellScale));
        const proj = project4D(scaledVerts);
        const w4   = proj.map(p => p.w4);
        drawFacesTri(proj, CELL_FACES, hue2, w4);
        drawEdges(proj, CELL_EDGES, hue2, w4);
    }

    if (st.pulse > 0.05) {
        ctx.fillStyle = `hsla(${hue},90%,70%,${st.pulse * 0.1})`;
        ctx.fillRect(0, 0, w, h);
    }
}
