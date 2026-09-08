// ── Hyperbolic Tiling (Poincaré Disk) ────────────────────────────────────────
// {p,q} tiling drawn via Möbius transformations. BFS generates tile centers up
// to given depth. Geodesics = circular arcs meeting boundary at right angles.
// Bass brightens lines; beat shifts colors; treble speeds rotation.

const _state = new WeakMap();

// Complex arithmetic
function cadd(a, b) { return [a[0]+b[0], a[1]+b[1]]; }
function csub(a, b) { return [a[0]-b[0], a[1]-b[1]]; }
function cmul(a, b) { return [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]]; }
function cdiv(a, b) {
    const d = b[0]*b[0]+b[1]*b[1] || 1e-12;
    return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d];
}
function cnorm(a) { return Math.sqrt(a[0]*a[0]+a[1]*a[1]); }
function cconj(a) { return [a[0], -a[1]]; }

// Möbius transform: z -> (az+b)/(cz+d)
function mobius(z, a, b, c, d) {
    return cdiv(cadd(cmul(a, z), b), cadd(cmul(c, z), d));
}

// Disk isometry: map 0 to p (reflection via translation)
function diskIso(z, p) {
    // T_p(z) = (z - p) / (1 - conj(p)*z)
    const num = csub(z, p);
    const den = csub([1,0], cmul(cconj(p), z));
    return cdiv(num, den);
}

// Reflect z across geodesic from a to b
function reflect(z, a, b) {
    // Map a to 0
    const za = diskIso(z, a);
    const ba = diskIso(b, a);
    // Reflect across line through 0 and ba: z -> conj(z * conj(ba/|ba|))
    const baNorm = cnorm(ba) || 1;
    const baDir  = [ba[0]/baNorm, ba[1]/baNorm];
    // Reflection of za across line through 0 in direction baDir:
    // r(z) = baDir^2 * conj(z)
    const baDir2 = cmul(baDir, baDir);
    const zar    = cmul(baDir2, cconj(za));
    // Map back
    return diskIso(zar, [-a[0], -a[1]]);
}

// Compute p vertices of a regular p-gon centered at 0 in Poincaré disk
// Side length determined by {p,q} relation
function fundamentalPoly(p, q) {
    // Circumradius in hyperbolic disk
    const alpha = Math.PI / p;
    const beta  = Math.PI / q;
    const gamma = Math.PI / 2;
    // Using formula for hyperbolic trig
    const cosAlpha = Math.cos(alpha), cosBeta = Math.cos(beta);
    const sinAlpha = Math.sin(alpha), sinBeta = Math.sin(beta);
    // r = tanh(circumradius) where cosh(r) = cos(alpha)/sin(beta)
    const coshR = Math.cos(alpha) / Math.sin(beta);
    if (coshR <= 1) return null; // degenerate
    const R = Math.acosh(coshR);
    const r = Math.tanh(R); // disk radius
    const verts = [];
    for (let i = 0; i < p; i++) {
        const a = (i / p) * Math.PI * 2 + Math.PI / p;
        verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return verts;
}

// BFS to generate tiles up to depth d
function genTiles(p, q, depth) {
    const verts = fundamentalPoly(p, q);
    if (!verts) return [];

    const tiles = [{ verts: verts.slice(), parity: 0 }];
    const seen  = new Set(['0,0']);

    for (let d = 0; d < depth; d++) {
        const batch = tiles.slice();
        for (let ti = 0; ti < batch.length; ti++) {
            const tile = batch[ti];
            for (let side = 0; side < p; side++) {
                const a = tile.verts[side];
                const b = tile.verts[(side + 1) % p];
                // Reflect all vertices across this side
                const newVerts = tile.verts.map(v => reflect(v, a, b));
                const center   = newVerts.reduce((acc, v) => [acc[0]+v[0]/p, acc[1]+v[1]/p], [0, 0]);
                const key      = `${(center[0]*100|0)},${(center[1]*100|0)}`;
                if (seen.has(key)) continue;
                if (cnorm(center) > 0.998) continue;
                seen.add(key);
                tiles.push({ verts: newVerts, parity: 1 - tile.parity });
                if (tiles.length > 2000) return tiles;
            }
        }
    }
    return tiles;
}

// Draw geodesic arc between two points in the Poincaré disk (on a canvas scaled to R)
function drawGeodesic(ctx, p1, p2, R) {
    // If nearly the same angle from center, draw line
    const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
    if (dx*dx + dy*dy < 1e-8) return;

    // Check if geodesic is a diameter (both points collinear with origin within tolerance)
    const cross = p1[0]*p2[1] - p1[1]*p2[0];
    if (Math.abs(cross) < 1e-6) {
        ctx.moveTo(p1[0]*R, p1[1]*R);
        ctx.lineTo(p2[0]*R, p2[1]*R);
        return;
    }

    // Find circle through p1, p2 orthogonal to unit circle
    // Center cx,cy: cx*(p1x^2+p1y^2-1) + ... (use inversion formula)
    const a1 = 2*(p1[0]-p2[0]), b1 = 2*(p1[1]-p2[1]);
    const c1 = p2[0]*p2[0]+p2[1]*p2[1] - p1[0]*p1[0]-p1[1]*p1[1];
    const a2 = 2*p1[0], b2 = 2*p1[1];
    const c2 = 1 - p1[0]*p1[0] - p1[1]*p1[1]; // orthogonality: cx*p1x+cy*p1y = (1+p1norm²)/2
    // Actually use the standard formula for the inversive distance:
    const denom = a1*b2 - a2*b1;
    if (Math.abs(denom) < 1e-10) {
        ctx.moveTo(p1[0]*R, p1[1]*R);
        ctx.lineTo(p2[0]*R, p2[1]*R);
        return;
    }
    const cx = (c1*b2 - c2*b1) / (-denom);
    const cy = (a1*c2 - a2*c1) / (-denom);
    const rad = Math.sqrt((p1[0]-cx)**2 + (p1[1]-cy)**2);

    const startAngle = Math.atan2(p1[1]-cy, p1[0]-cx);
    const endAngle   = Math.atan2(p2[1]-cy, p2[0]-cx);

    // Pick shorter arc
    let da = endAngle - startAngle;
    while (da >  Math.PI) da -= 2*Math.PI;
    while (da < -Math.PI) da += 2*Math.PI;

    const CCW = da < 0;
    ctx.arc(cx*R, cy*R, rad*R, startAngle, endAngle, CCW);
}

function makeState(p, q, depth) {
    return {
        time: 0,
        p, q, depth,
        tiles: genTiles(p, q, depth),
        prevBass: 0,
        pulse: 0,
        colorShift: 0,
    };
}

export const hyperbolicTileParams = () => ({
    hue:       { base: 180, min: 0,   max: 360, mod: { source: "" } },
    p:         { base: 7,   min: 3,   max: 8,   step: 1, mod: { source: "" } },
    q:         { base: 3,   min: 3,   max: 4,   step: 1, mod: { source: "" } },
    speed:     { base: 0.3, min: 0,   max: 2,   mod: { source: "" } },
    depth:     { base: 5,   min: 3,   max: 6,   step: 1, mod: { source: "" } },
    lineWidth: { base: 1.5, min: 0.5, max: 3,   mod: { source: "" } },
});

export function drawHyperbolicTile(ctx, w, h, p, t, extra) {
    const pVal  = Math.max(3, Math.min(8, Math.round(p.p ?? 7)));
    const qVal  = Math.max(3, Math.min(4, Math.round(p.q ?? 3)));
    const depth = Math.max(3, Math.min(6, Math.round(p.depth ?? 5)));

    let st = _state.get(ctx);
    if (!st || st.p !== pVal || st.q !== qVal || st.depth !== depth) {
        st = makeState(pVal, qVal, depth);
        _state.set(ctx, st);
    }

    st.time += 1 / 60;

    const sp = extra?.spectrum;
    let bass = 0, treble = 0;
    if (sp) {
        for (let i = 0; i < 5; i++) bass += sp[i]; bass /= 5;
        for (let i = 44; i < 64; i++) treble += sp[i]; treble /= 20;
    }

    if (bass > 0.6 && bass > st.prevBass + 0.1) {
        st.pulse = 1;
        st.colorShift = (st.colorShift + 60) % 360;
    }
    st.prevBass = bass;
    st.pulse *= 0.85;

    const hue    = p.hue ?? 180;
    const speed  = (p.speed ?? 0.3) * (1 + treble * 2);
    const lw     = p.lineWidth ?? 1.5;

    // Rotation: apply rotation to tiles by rotating verts
    const rot  = st.time * speed * 0.2;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);

    const R    = Math.min(w, h) * 0.47;
    const cx   = w / 2, cy = h / 2;

    ctx.fillStyle = `hsl(${hue},20%,4%)`;
    ctx.fillRect(0, 0, w, h);

    // Clipping circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    const tiles   = st.tiles;
    const bright  = 0.3 + bass * 0.4;
    const colShift = st.colorShift;

    for (let ti = 0; ti < tiles.length; ti++) {
        const tile   = tiles[ti];
        const verts  = tile.verts;
        const par    = tile.parity;
        const fillH  = (hue + (par === 0 ? 0 : 180) + colShift) % 360;
        const fillL  = par === 0 ? 8 : 12;

        ctx.beginPath();
        for (let vi = 0; vi < verts.length; vi++) {
            const v = verts[vi];
            // Rotate
            const rx = v[0] * cosR - v[1] * sinR;
            const ry = v[0] * sinR + v[1] * cosR;
            const nv = [rx, ry];
            const nx2 = verts[(vi + 1) % verts.length];
            const rx2 = nx2[0] * cosR - nx2[1] * sinR;
            const ry2 = nx2[0] * sinR + nx2[1] * cosR;
            const nv2 = [rx2, ry2];
            if (vi === 0) ctx.moveTo(nv[0]*R + cx, nv[1]*R + cy);
            // Draw geodesic arc (shifted to canvas coords)
            // We'll draw the chord for now and handle the arc transform
            ctx.lineTo(nv2[0]*R + cx, nv2[1]*R + cy);
        }
        ctx.closePath();
        ctx.fillStyle = `hsl(${fillH},40%,${fillL}%)`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${(hue + colShift)%360},80%,${bright*100|0}%,0.8)`;
        ctx.lineWidth   = lw;
        ctx.stroke();
    }

    // Boundary circle
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `hsl(${hue},60%,40%)`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.restore();
}
