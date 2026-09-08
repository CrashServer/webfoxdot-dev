// ── Crystal Lattice ───────────────────────────────────────────────────────────
// 3D perspective view of crystal lattice wireframe with strong audio deformation.
// Types: 0=cubic  1=BCC  2=FCC  3=diamond  4=hexagonal
// Bass: scale burst + atom displacement wave. Treble: edge brightness + hue shift.

const _st = new WeakMap();
const TAU = Math.PI * 2;

function project(vx, vy, vz, rx, ry, fov, scale, cx, cy) {
    const cy2 = Math.cos(ry), sy = Math.sin(ry);
    const x1 = cy2 * vx + sy * vz, z1 = -sy * vx + cy2 * vz;
    const cx2 = Math.cos(rx), sx = Math.sin(rx);
    const y2  = cx2 * vy - sx * z1, z2 = sx * vy + cx2 * z1;
    const d = fov / (fov + z2 + 3);
    return [cx + x1 * d * scale, cy + y2 * d * scale, z2];
}

function buildAtoms(type, N) {
    const atoms = [];
    const step = 2 / N;
    const off = 1;

    if (type <= 2) {
        // Cubic (0), BCC (1), FCC (2)
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= N; j++) {
                for (let k = 0; k <= N; k++) {
                    const x = i * step - off, y = j * step - off, z = k * step - off;
                    atoms.push([x, y, z, 0]);
                    if (type === 1 && i < N && j < N && k < N) {
                        // BCC: body centre of each cell
                        atoms.push([x + step/2, y + step/2, z + step/2, 1]);
                    }
                    if (type === 2 && i < N) {
                        // FCC: face centres
                        atoms.push([x + step/2, y + step/2, z, 2]);
                        atoms.push([x + step/2, y, z + step/2, 2]);
                        atoms.push([x, y + step/2, z + step/2, 2]);
                    }
                }
            }
        }
    } else if (type === 3) {
        // Diamond: FCC + basis offset (0.25,0.25,0.25)
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= N; j++) {
                for (let k = 0; k <= N; k++) {
                    const x = i * step - off, y = j * step - off, z = k * step - off;
                    atoms.push([x, y, z, 0]);
                    if (i < N) {
                        atoms.push([x + step/2, y + step/2, z, 0]);
                        atoms.push([x + step/2, y, z + step/2, 0]);
                        atoms.push([x, y + step/2, z + step/2, 0]);
                    }
                    // Second FCC sublattice offset by (0.25,0.25,0.25)
                    const bx = x + step*0.25, by = y + step*0.25, bz = z + step*0.25;
                    if (bx <= off+0.01 && by <= off+0.01 && bz <= off+0.01) {
                        atoms.push([bx, by, bz, 1]);
                        if (i < N) {
                            atoms.push([bx + step/2, by + step/2, bz, 1]);
                            atoms.push([bx + step/2, by, bz + step/2, 1]);
                            atoms.push([bx, by + step/2, bz + step/2, 1]);
                        }
                    }
                }
            }
        }
    } else {
        // Hexagonal (HCP-like): layers of hex grid
        const nLayers = N + 1;
        const hex_r = step * 0.6;
        for (let layer = 0; layer < nLayers; layer++) {
            const z = layer * step * 1.633 - off;
            const layerOff = (layer % 2) * 0.5;
            for (let i = -N; i <= N; i++) {
                for (let j = -N; j <= N; j++) {
                    const x = (i + j * 0.5 + layerOff * 0.5) * hex_r * 1.7 * step;
                    const y = j * hex_r * 1.47 * step;
                    if (Math.abs(x) <= off + 0.1 && Math.abs(y) <= off + 0.1)
                        atoms.push([x, y, z, layer % 2]);
                }
            }
        }
    }
    return atoms;
}

function buildBonds(type, N, atoms) {
    if (type >= 3) return []; // bonds for hex/diamond drawn separately
    const bonds = [];
    const nodeCount = (N + 1) ** 3;
    for (let i = 0; i < nodeCount; i++) {
        const a = i % (N + 1);
        const b = Math.floor(i / (N + 1)) % (N + 1);
        const c = Math.floor(i / (N + 1) / (N + 1));
        const idx = c * (N+1)*(N+1) + b * (N+1) + a;
        if (a < N) bonds.push([idx, c * (N+1)*(N+1) + b * (N+1) + a + 1]);
        if (b < N) bonds.push([idx, c * (N+1)*(N+1) + (b+1) * (N+1) + a]);
        if (c < N) bonds.push([idx, (c+1) * (N+1)*(N+1) + b * (N+1) + a]);
    }
    return bonds;
}

export const crystalLatticeParams = () => ({
    type:     { base: 0,    min: 0,   max: 4,   step: 1, mod: { source: "" } }, // 0=cubic 1=BCC 2=FCC 3=diamond 4=hex
    size:     { base: 2,    min: 1,   max: 4,   step: 1, mod: { source: "" } },
    scale:    { base: 0.3,  min: 0.1, max: 0.7,          mod: { source: "" } },
    rotX:     { base: 0.2,  min: -2,  max: 2,            mod: { source: "" } },
    rotY:     { base: 0.4,  min: -2,  max: 2,            mod: { source: "" } },
    hue:      { base: 180,  min: 0,   max: 360,          mod: { source: "" } },
    hueRange: { base: 100,  min: 0,   max: 180,          mod: { source: "" } },
    glow:     { base: 0.7,  min: 0,   max: 1,            mod: { source: "" } },
    thick:    { base: 0.8,  min: 0.1, max: 3,            mod: { source: "" } },
    pulse:    { base: 0.8,  min: 0,   max: 1,            mod: { source: "" } }, // audio strength
    wobble:   { base: 0.5,  min: 0,   max: 1,            mod: { source: "" } }, // atom displacement
    fov:      { base: 4,    min: 1,   max: 10,           mod: { source: "" } },
    atomSize: { base: 3.0,  min: 0,   max: 10,           mod: { source: "" } },
    bgAlpha:  { base: 0.0,  min: 0,   max: 1,            mod: { source: "" } },
});

export function drawCrystalLattice(ctx, w, h, p, t, extra) {
    const spectrum = extra?.spectrum;
    const bass   = spectrum ? Math.min(1, (spectrum[1]+spectrum[2]+spectrum[3])/3*3) : 0;
    const mid    = spectrum ? Math.min(1, (spectrum[8]+spectrum[12]+spectrum[16])/3*3) : 0;
    const treble = spectrum ? Math.min(1, (spectrum[28]+spectrum[38]+spectrum[48])/3*3) : 0;

    const type   = Math.round(Math.max(0, Math.min(4, p.type ?? 0)));
    const N      = Math.round(Math.max(1, Math.min(4, p.size ?? 2)));
    const pulse  = p.pulse ?? 0.8;
    const wobble = p.wobble ?? 0.5;
    const baseScale = (p.scale ?? 0.3) * Math.min(w, h);
    const scale  = baseScale * (1 + bass * pulse * 0.7 + mid * pulse * 0.2);
    const hue    = p.hue ?? 180;
    const hueR   = p.hueRange ?? 100;
    const glow   = p.glow ?? 0.7;
    const thick  = (p.thick ?? 0.8) * (1 + bass * pulse * 0.6);
    const fov    = p.fov ?? 4;
    const atomSz = p.atomSize ?? 3.0;
    const bgAlpha= p.bgAlpha ?? 0;

    let st = _st.get(ctx);
    if (!st || st.type !== type || st.N !== N) {
        const atoms = buildAtoms(type, N);
        const bonds = buildBonds(type, N, atoms);
        st = { rx: 0, ry: 0, lastT: t, type, N, atoms, bonds };
        _st.set(ctx, st);
    }
    const dt = Math.min(0.1, t - st.lastT); st.lastT = t;
    st.rx += (p.rotX ?? 0.2) * dt * (1 + bass * pulse * 0.8);
    st.ry += (p.rotY ?? 0.4) * dt * (1 + bass * pulse * 0.4);

    if (bgAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${bgAlpha})`;
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.clearRect(0, 0, w, h);
    }

    const cx = w / 2, cy = h / 2;
    const atoms = st.atoms;

    // Displace atoms based on audio (wave distortion)
    const wobAmt = wobble * bass * 0.18;
    const pts = atoms.map(([vx, vy, vz, sub]) => {
        const phase = vx * 3.7 + vy * 2.9 + vz * 4.1;
        const dx = wobAmt * Math.sin(t * 6 + phase);
        const dy = wobAmt * Math.cos(t * 5.3 + phase * 1.3);
        const dz = wobAmt * Math.sin(t * 4.7 + phase * 0.8);
        return project(vx + dx, vy + dy, vz + dz, st.rx, st.ry, fov, scale, cx, cy);
    });

    // Depth sort
    const idxs = pts.map((_, i) => i).sort((a, b) => pts[b][2] - pts[a][2]);

    // Draw cubic/BCC/FCC bonds
    if (st.bonds.length > 0) {
        ctx.lineWidth = thick;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * 12 * (1 + treble * 0.5);
            ctx.shadowColor = `hsl(${hue},100%,70%)`;
        }
        for (let bi = 0; bi < st.bonds.length; bi++) {
            const [ia, ib] = st.bonds[bi];
            if (ia >= pts.length || ib >= pts.length) continue;
            const pA = pts[ia], pB = pts[ib];
            const depth = (pA[2] + pB[2]) / 2;
            const h2 = (hue + (depth + 1) * hueR * 0.5) % 360;
            const bright = 40 + treble * 35 + bass * pulse * 20;
            ctx.strokeStyle = `hsl(${h2},85%,${bright}%)`;
            ctx.beginPath();
            ctx.moveTo(pA[0], pA[1]);
            ctx.lineTo(pB[0], pB[1]);
            ctx.stroke();
        }
    } else if (type >= 3) {
        // For diamond/hex: connect nearby atoms by proximity
        ctx.lineWidth = thick;
        if (glow > 0.05) {
            ctx.shadowBlur = glow * 10 * (1 + treble * 0.4);
            ctx.shadowColor = `hsl(${hue},100%,70%)`;
        }
        const bondDist = (2 / N) * 0.9;
        const bdSq = bondDist * bondDist;
        for (let i = 0; i < atoms.length; i++) {
            for (let j = i + 1; j < atoms.length; j++) {
                const dx = atoms[i][0]-atoms[j][0], dy = atoms[i][1]-atoms[j][1], dz = atoms[i][2]-atoms[j][2];
                if (dx*dx+dy*dy+dz*dz < bdSq) {
                    const pA = pts[i], pB = pts[j];
                    const depth = (pA[2] + pB[2]) / 2;
                    const h2 = (hue + (depth + 1) * hueR * 0.5) % 360;
                    const bright = 40 + treble * 35 + bass * pulse * 20;
                    ctx.strokeStyle = `hsl(${h2},85%,${bright}%)`;
                    ctx.beginPath();
                    ctx.moveTo(pA[0], pA[1]);
                    ctx.lineTo(pB[0], pB[1]);
                    ctx.stroke();
                }
            }
        }
    }

    // Draw atoms (sorted back to front)
    if (atomSz > 0.1) {
        for (const i of idxs) {
            const [px, py, pz] = pts[i];
            const depth = (pz + 1) / 2;
            const sub = atoms[i][3];
            const h2 = (hue + depth * hueR + sub * 40) % 360;
            const r  = atomSz * (0.5 + depth * 0.5) * (1 + bass * pulse * 0.9);
            ctx.shadowColor = `hsl(${h2},100%,70%)`;
            const bright = 55 + treble * 30 + bass * pulse * 20;
            ctx.fillStyle = `hsl(${h2},90%,${bright}%)`;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, TAU);
            ctx.fill();
        }
    }

    ctx.shadowBlur = 0;
}
